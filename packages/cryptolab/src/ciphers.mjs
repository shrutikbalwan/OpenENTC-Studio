// Block ciphers and a hash, written out so every round can be shown: AES (FIPS 197, 128/192/
// 256-bit keys), DES (FIPS 46-3) and SHA-256 (FIPS 180-4) plus HMAC-SHA-256.

export const hexToBytes = (hex) => {
  const clean = String(hex).replace(/\s+/g, '').toLowerCase();
  if (!/^([0-9a-f]{2})*$/.test(clean)) throw new RangeError('Enter hexadecimal bytes (an even number of 0–9, a–f).');
  return Uint8Array.from(clean.match(/../g) || [], (pair) => parseInt(pair, 16));
};
export const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------------------
// AES.

const xtime = (b) => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
export function gmul(a, b) { let p = 0; for (let i = 0; i < 8; i += 1) { if (b & 1) p ^= a; a = xtime(a); b >>= 1; } return p; }
/** S-box from the multiplicative inverse in GF(2⁸) followed by the affine map (FIPS 197 §5.1.1). */
export const SBOX = (() => {
  const box = new Uint8Array(256);
  for (let x = 0; x < 256; x += 1) {
    let inverse = 0;
    if (x) for (let y = 1; y < 256; y += 1) if (gmul(x, y) === 1) { inverse = y; break; }
    let s = inverse;
    for (let k = 1; k <= 4; k += 1) s ^= ((inverse << k) | (inverse >> (8 - k))) & 0xff;
    box[x] = s ^ 0x63;
  }
  return box;
})();
export const INV_SBOX = (() => { const box = new Uint8Array(256); SBOX.forEach((value, index) => { box[value] = index; }); return box; })();

/** Key schedule: Nk = 4/6/8 words → 4(Nr + 1) words. */
export function aesKeyExpansion(key) {
  const nk = key.length / 4;
  if (![4, 6, 8].includes(nk)) throw new RangeError('AES keys are 16, 24 or 32 bytes.');
  const nr = nk + 6, words = [];
  for (let i = 0; i < nk; i += 1) words.push([...key.slice(4 * i, 4 * i + 4)]);
  let rcon = 1;
  const notes = [];
  for (let i = nk; i < 4 * (nr + 1); i += 1) {
    let temp = [...words[i - 1]], note = '';
    if (i % nk === 0) { temp = [SBOX[temp[1]] ^ rcon, SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]]; note = `RotWord, SubWord, ⊕ Rcon ${rcon.toString(16).padStart(2, '0')}`; rcon = xtime(rcon); }
    else if (nk > 6 && i % nk === 4) { temp = temp.map((b) => SBOX[b]); note = 'SubWord'; }
    words.push(temp.map((b, k) => b ^ words[i - nk][k]));
    notes.push({ index: i, note });
  }
  return { nr, words, notes };
}

const subBytes = (s, box) => s.map((b) => box[b]);
// State is column-major: s[r + 4c].
const shiftRows = (s, inverse = false) => s.map((_, i) => { const r = i % 4, c = Math.floor(i / 4); return s[r + 4 * ((c + (inverse ? 4 - r : r)) % 4)]; });
function mixColumns(s, inverse = false) {
  const m = inverse ? [14, 11, 13, 9] : [2, 3, 1, 1], out = [];
  for (let c = 0; c < 4; c += 1) {
    const col = s.slice(4 * c, 4 * c + 4);
    for (let r = 0; r < 4; r += 1) out.push(gmul(col[0], m[(4 - r) % 4]) ^ gmul(col[1], m[(5 - r) % 4]) ^ gmul(col[2], m[(6 - r) % 4]) ^ gmul(col[3], m[(7 - r) % 4]));
  }
  return out;
}
const roundKey = (words, round) => words.slice(4 * round, 4 * round + 4).flat();
const xor = (a, b) => a.map((value, i) => value ^ b[i]);

/** Encrypt one 16-byte block, recording the state after every step of every round. */
export function aesEncryptBlock(block, key) {
  if (block.length !== 16) throw new RangeError('An AES block is 16 bytes.');
  const { nr, words, notes } = aesKeyExpansion(key);
  let state = xor([...block], roundKey(words, 0));
  const rounds = [{ round: 0, input: [...block], roundKey: roundKey(words, 0), end: state }];
  for (let round = 1; round <= nr; round += 1) {
    const start = state, afterSub = subBytes(start, SBOX), afterShift = shiftRows(afterSub);
    const afterMix = round === nr ? null : mixColumns(afterShift);
    state = xor(afterMix ?? afterShift, roundKey(words, round));
    rounds.push({ round, start, afterSub, afterShift, afterMix, roundKey: roundKey(words, round), end: state });
  }
  return { output: Uint8Array.from(state), rounds, keySchedule: { words, notes, nr } };
}

export function aesDecryptBlock(block, key) {
  const { nr, words } = aesKeyExpansion(key);
  let state = xor([...block], roundKey(words, nr));
  const rounds = [];
  for (let round = nr - 1; round >= 0; round -= 1) {
    const afterShift = shiftRows(state, true), afterSub = subBytes(afterShift, INV_SBOX), afterKey = xor(afterSub, roundKey(words, round));
    state = round === 0 ? afterKey : mixColumns(afterKey, true);
    rounds.push({ round, afterShift, afterSub, afterKey, end: state });
  }
  return { output: Uint8Array.from(state), rounds };
}

/** ECB or CBC over PKCS#7-padded data (for comparing with library output). */
export function aesEncrypt(data, key, { mode = 'ecb', iv = new Uint8Array(16), pad = true } = {}) {
  const input = [...data];
  if (pad) { const n = 16 - (input.length % 16); for (let k = 0; k < n; k += 1) input.push(n); }
  if (input.length % 16) throw new RangeError('Without padding the data must be a multiple of 16 bytes.');
  const out = [];
  let previous = [...iv];
  for (let i = 0; i < input.length; i += 16) {
    let block = input.slice(i, i + 16);
    if (mode === 'cbc') block = xor(block, previous);
    const cipher = [...aesEncryptBlock(block, key).output];
    out.push(...cipher); previous = cipher;
  }
  return Uint8Array.from(out);
}

// ---------------------------------------------------------------------------
// DES.

const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const FP = IP.map((_, i) => IP.indexOf(i + 1) + 1);
const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const SBOXES = [
  '14 4 13 1 2 15 11 8 3 10 6 12 5 9 0 7 0 15 7 4 14 2 13 1 10 6 12 11 9 5 3 8 4 1 14 8 13 6 2 11 15 12 9 7 3 10 5 0 15 12 8 2 4 9 1 7 5 11 3 14 10 0 6 13',
  '15 1 8 14 6 11 3 4 9 7 2 13 12 0 5 10 3 13 4 7 15 2 8 14 12 0 1 10 6 9 11 5 0 14 7 11 10 4 13 1 5 8 12 6 9 3 2 15 13 8 10 1 3 15 4 2 11 6 7 12 0 5 14 9',
  '10 0 9 14 6 3 15 5 1 13 12 7 11 4 2 8 13 7 0 9 3 4 6 10 2 8 5 14 12 11 15 1 13 6 4 9 8 15 3 0 11 1 2 12 5 10 14 7 1 10 13 0 6 9 8 7 4 15 14 3 11 5 2 12',
  '7 13 14 3 0 6 9 10 1 2 8 5 11 12 4 15 13 8 11 5 6 15 0 3 4 7 2 12 1 10 14 9 10 6 9 0 12 11 7 13 15 1 3 14 5 2 8 4 3 15 0 6 10 1 13 8 9 4 5 11 12 7 2 14',
  '2 12 4 1 7 10 11 6 8 5 3 15 13 0 14 9 14 11 2 12 4 7 13 1 5 0 15 10 3 9 8 6 4 2 1 11 10 13 7 8 15 9 12 5 6 3 0 14 11 8 12 7 1 14 2 13 6 15 0 9 10 4 5 3',
  '12 1 10 15 9 2 6 8 0 13 3 4 14 7 5 11 10 15 4 2 7 12 9 5 6 1 13 14 0 11 3 8 9 14 15 5 2 8 12 3 7 0 4 10 1 13 11 6 4 3 2 12 9 5 15 10 11 14 1 7 6 0 8 13',
  '4 11 2 14 15 0 8 13 3 12 9 7 5 10 6 1 13 0 11 7 4 9 1 10 14 3 5 12 2 15 8 6 1 4 11 13 12 3 7 14 10 15 6 8 0 5 9 2 6 11 13 8 1 4 10 7 9 5 0 15 14 2 3 12',
  '13 2 8 4 6 15 11 1 10 9 3 14 5 0 12 7 1 15 13 8 10 3 7 4 12 5 6 11 0 14 9 2 7 11 4 1 9 12 14 2 0 6 10 13 15 3 5 8 2 1 14 7 4 10 8 13 15 12 9 0 3 5 6 11',
].map((text) => text.split(' ').map(Number));

const toBits = (bytes) => [...bytes].flatMap((byte) => Array.from({ length: 8 }, (_, k) => (byte >> (7 - k)) & 1));
const fromBits = (bits) => Uint8Array.from({ length: bits.length / 8 }, (_, i) => bits.slice(8 * i, 8 * i + 8).reduce((v, b) => (v << 1) | b, 0));
const permute = (bits, table) => table.map((position) => bits[position - 1]);
const rotate = (bits, n) => [...bits.slice(n), ...bits.slice(0, n)];
export const bitsToHex = (bits) => bytesToHex(fromBits(bits.length % 8 ? [...bits, ...Array(8 - (bits.length % 8)).fill(0)] : bits));

export function desSubkeys(key) {
  if (key.length !== 8) throw new RangeError('A DES key is 8 bytes (56 key bits + 8 parity bits).');
  let cd = permute(toBits(key), PC1), c = cd.slice(0, 28), d = cd.slice(28);
  return SHIFTS.map((shift) => { c = rotate(c, shift); d = rotate(d, shift); cd = [...c, ...d]; return permute(cd, PC2); });
}

function feistel(right, subkey) {
  const expanded = permute(right, E), mixed = expanded.map((b, i) => b ^ subkey[i]);
  const sOut = [];
  const lookups = [];
  for (let box = 0; box < 8; box += 1) {
    const six = mixed.slice(6 * box, 6 * box + 6), row = (six[0] << 1) | six[5], col = (six[1] << 3) | (six[2] << 2) | (six[3] << 1) | six[4];
    const value = SBOXES[box][16 * row + col];
    lookups.push({ box: box + 1, input: six.join(''), row, col, value });
    sOut.push(...Array.from({ length: 4 }, (_, k) => (value >> (3 - k)) & 1));
  }
  return { expanded, mixed, lookups, sOut, output: permute(sOut, P) };
}

/** One 8-byte block; decrypt uses the subkeys in reverse. Records L, R, K and f for each round. */
export function desBlock(block, key, decrypt = false) {
  if (block.length !== 8) throw new RangeError('A DES block is 8 bytes.');
  const keys = desSubkeys(key), order = decrypt ? [...keys].reverse() : keys;
  const permuted = permute(toBits(block), IP);
  let left = permuted.slice(0, 32), right = permuted.slice(32);
  const rounds = [];
  order.forEach((subkey, index) => {
    const f = feistel(right, subkey);
    const newRight = left.map((b, i) => b ^ f.output[i]);
    rounds.push({ round: index + 1, left: bitsToHex(left), right: bitsToHex(right), subkey: bitsToHex(subkey), expanded: bitsToHex(f.expanded), sboxes: f.lookups, f: bitsToHex(f.output), newRight: bitsToHex(newRight) });
    left = right; right = newRight;
  });
  const output = fromBits(permute([...right, ...left], FP));
  return { output, initialPermutation: bitsToHex(permuted), rounds };
}

// ---------------------------------------------------------------------------
// SHA-256.

const PRIMES = (() => { const list = []; for (let n = 2; list.length < 64; n += 1) if (list.every((p) => n % p)) list.push(n); return list; })();
// K: first 32 bits of the fractional parts of the cube roots of the first 64 primes; H0: square roots of the first 8.
const fraction32 = (x) => Math.floor((x - Math.floor(x)) * 2 ** 32) >>> 0;
export const SHA256_K = Uint32Array.from(PRIMES.map((p) => fraction32(Math.cbrt(p))));
export const SHA256_H0 = Uint32Array.from(PRIMES.slice(0, 8).map((p) => fraction32(Math.sqrt(p))));
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 of bytes, recording the padded message, each block's schedule W and the 64 rounds. */
export function sha256(input, { record = true } = {}) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : Uint8Array.from(input);
  const bitLength = bytes.length * 8, padded = [...bytes, 0x80];
  while (padded.length % 64 !== 56) padded.push(0);
  for (let k = 7; k >= 0; k -= 1) padded.push(Math.floor(bitLength / 2 ** (8 * k)) & 0xff);
  const h = Uint32Array.from(SHA256_H0), blocks = [];
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Uint32Array(64);
    for (let t = 0; t < 16; t += 1) w[t] = (padded[offset + 4 * t] << 24) | (padded[offset + 4 * t + 1] << 16) | (padded[offset + 4 * t + 2] << 8) | padded[offset + 4 * t + 3];
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    const rounds = [];
    for (let t = 0; t < 64; t += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[t] + w[t]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      if (record) rounds.push([a, b, c, d, e, f, g, hh]);
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => { h[i] = (h[i] + value) >>> 0; });
    if (record && blocks.length < 16) blocks.push({ w: [...w], rounds, hash: [...h] });
  }
  const digest = [...h].map((value) => value.toString(16).padStart(8, '0')).join('');
  return { digest, padded: Uint8Array.from(padded), blocks, bitLength };
}

export function hmacSha256(keyInput, messageInput) {
  let key = typeof keyInput === 'string' ? new TextEncoder().encode(keyInput) : Uint8Array.from(keyInput);
  const message = typeof messageInput === 'string' ? new TextEncoder().encode(messageInput) : Uint8Array.from(messageInput);
  if (key.length > 64) key = hexToBytes(sha256(key, { record: false }).digest);
  const block = new Uint8Array(64); block.set(key);
  const inner = sha256([...block.map((b) => b ^ 0x36), ...message], { record: false }).digest;
  return sha256([...block.map((b) => b ^ 0x5c), ...hexToBytes(inner)], { record: false }).digest;
}
