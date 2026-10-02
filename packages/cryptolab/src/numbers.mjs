// Number theory for public-key cryptography (BigInt throughout): extended Euclid with its
// table, modular inverse, square-and-multiply with every step, Miller–Rabin, CRT, RSA (key
// generation, encryption, CRT decryption, signatures), Diffie–Hellman with a man-in-the-middle,
// primitive roots and baby-step giant-step discrete logarithms.

export const toBig = (value) => {
  if (typeof value === 'bigint') return value;
  const text = String(value).trim().replace(/[_\s]/g, '');
  if (!/^-?(0x[0-9a-f]+|\d+)$/i.test(text)) throw new RangeError(`"${value}" is not a whole number.`);
  return BigInt(text);
};
const mod = (a, m) => ((a % m) + m) % m;
const abs = (a) => (a < 0n ? -a : a);

/** Extended Euclid: rows (q, r, s, t) with s·a + t·b = r at every step. */
export function extendedEuclid(aInput, bInput) {
  const a = toBig(aInput), b = toBig(bInput);
  const rows = [{ q: null, r: a, s: 1n, t: 0n }, { q: null, r: b, s: 0n, t: 1n }];
  while (rows.at(-1).r !== 0n) {
    const [p, c] = rows.slice(-2), q = p.r / c.r;
    rows.push({ q, r: p.r - q * c.r, s: p.s - q * c.s, t: p.t - q * c.t });
  }
  const last = rows.at(-2);
  return { gcd: abs(last.r), x: last.r < 0n ? -last.s : last.s, y: last.r < 0n ? -last.t : last.t, rows };
}

export function modInverse(aInput, mInput) {
  const a = toBig(aInput), m = toBig(mInput);
  const { gcd, x, rows } = extendedEuclid(mod(a, m), m);
  if (gcd !== 1n) throw new RangeError(`${a} has no inverse modulo ${m} (gcd = ${gcd}).`);
  return { inverse: mod(x, m), rows };
}

/** Left-to-right square-and-multiply, recording each bit's square and multiply. */
export function modPow(baseInput, exponentInput, modulusInput, { record = true } = {}) {
  const base = toBig(baseInput), exponent = toBig(exponentInput), modulus = toBig(modulusInput);
  if (modulus <= 0n || exponent < 0n) throw new RangeError('Modulus must be positive and exponent non-negative.');
  if (modulus === 1n) return { result: 0n, steps: [] };
  const bits = exponent.toString(2), b = mod(base, modulus), steps = [];
  let result = 1n;
  for (const bit of bits) {
    const squared = (result * result) % modulus;
    result = bit === '1' ? (squared * b) % modulus : squared;
    if (record && steps.length < 4096) steps.push({ bit: Number(bit), squared, result });
  }
  return { result, steps, bits };
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/** Miller–Rabin; with the first 12 prime bases it is deterministic below 3.3·10²⁴. */
export function millerRabin(nInput, bases = SMALL_PRIMES) {
  const n = toBig(nInput);
  if (n < 2n) return { prime: false, witness: null, trace: [] };
  for (const p of SMALL_PRIMES) { if (n === p) return { prime: true, witness: null, trace: [] }; if (n % p === 0n) return { prime: false, witness: p, trace: [{ base: p, divides: true }] }; }
  let d = n - 1n, s = 0;
  while (d % 2n === 0n) { d /= 2n; s += 1; }
  const trace = [];
  for (const a of bases) {
    if (a >= n - 1n) continue;
    let x = modPow(a, d, n, { record: false }).result;
    const sequence = [x];
    if (x === 1n || x === n - 1n) { trace.push({ base: a, d, s, sequence, passes: true }); continue; }
    let passes = false;
    for (let r = 1; r < s; r += 1) { x = (x * x) % n; sequence.push(x); if (x === n - 1n) { passes = true; break; } }
    trace.push({ base: a, d, s, sequence, passes });
    if (!passes) return { prime: false, witness: a, trace };
  }
  return { prime: true, witness: null, trace, deterministic: n < 3317044064679887385961981n };
}

/** Chinese remainder theorem for pairwise-coprime moduli. */
export function crt(remainders, moduli) {
  const r = remainders.map(toBig), m = moduli.map(toBig);
  const M = m.reduce((product, value) => product * value, 1n);
  const terms = m.map((mi, i) => { const Mi = M / mi, inverse = modInverse(Mi, mi).inverse; return { mi, Mi, inverse, term: r[i] * Mi * inverse }; });
  return { x: mod(terms.reduce((sum, term) => sum + term.term, 0n), M), modulus: M, terms };
}

// ---------------------------------------------------------------------------
// RSA.

/** Deterministic pseudo-random BigInt stream (xorshift128+) for reproducible key generation. */
function bigRandom(seed) {
  let s0 = BigInt(seed) * 0x9e3779b97f4a7c15n & 0xffffffffffffffffn || 1n, s1 = (BigInt(seed) ^ 0xdeadbeefcafebaben) & 0xffffffffffffffffn || 2n;
  const next = () => { let x = s0; const y = s1; s0 = y; x ^= (x << 23n) & 0xffffffffffffffffn; s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n); return (s1 + y) & 0xffffffffffffffffn; };
  return (bits) => { let value = 0n; for (let have = 0; have < bits; have += 64) value = (value << 64n) | next(); return value >> BigInt(Math.ceil(bits / 64) * 64 - bits); };
}

export function randomPrime(bits, seed = 1) {
  if (bits < 4 || bits > 2048) throw new RangeError('Prime size must be 4–2048 bits.');
  const random = bigRandom(seed);
  for (let attempt = 0; attempt < 100_000; attempt += 1) {
    const candidate = random(bits) | (1n << BigInt(bits - 1)) | 1n | (bits > 2 ? 1n << BigInt(bits - 2) : 0n);
    if (millerRabin(candidate, bits > 80 ? [...SMALL_PRIMES, 41n, 43n, 47n, 53n] : SMALL_PRIMES).prime) return candidate;
  }
  throw new RangeError('No prime found.');
}

/** RSA key from p, q and e, with the extended-Euclid working for d. */
export function rsaKey(pInput, qInput, eInput = 65537n) {
  const p = toBig(pInput), q = toBig(qInput), e = toBig(eInput);
  if (p === q) throw new RangeError('p and q must be different primes.');
  for (const [name, value] of [['p', p], ['q', q]]) if (!millerRabin(value).prime) throw new RangeError(`${name} = ${value} is not prime.`);
  const n = p * q, phi = (p - 1n) * (q - 1n);
  const gcd = extendedEuclid(e, phi).gcd;
  if (e <= 1n || e >= phi || gcd !== 1n) throw new RangeError(`e must satisfy 1 < e < φ(n) and gcd(e, φ(n)) = 1 (gcd = ${gcd}).`);
  const { inverse: d, rows } = modInverse(e, phi);
  return { p, q, n, phi, e, d, dp: d % (p - 1n), dq: d % (q - 1n), qInverse: modInverse(q, p).inverse, bits: n.toString(2).length, euclid: rows };
}

export function generateRsa(bits = 512, seed = 1, e = 65537n) {
  for (let k = 0; k < 64; k += 1) {
    const p = randomPrime(Math.ceil(bits / 2), seed * 2 + k * 7919), q = randomPrime(Math.floor(bits / 2), seed * 2 + 1 + k * 104729);
    try { return rsaKey(p, q, e); } catch { /* e not coprime with φ: try another pair */ }
  }
  throw new RangeError('Could not generate a key.');
}

/** m^e mod n with the square-and-multiply table. */
export const rsaEncrypt = (m, key) => { const message = toBig(m); if (message < 0n || message >= key.n) throw new RangeError('The message number must be 0 ≤ m < n.'); return modPow(message, key.e, key.n); };
/** Plain and CRT decryption: m1 = c^dp mod p, m2 = c^dq mod q, h = qInv(m1 − m2) mod p, m = m2 + hq. */
export function rsaDecrypt(c, key) {
  const cipher = toBig(c), plain = modPow(cipher, key.d, key.n, { record: false }).result;
  const m1 = modPow(cipher, key.dp, key.p, { record: false }).result, m2 = modPow(cipher, key.dq, key.q, { record: false }).result;
  const h = mod(key.qInverse * (m1 - m2), key.p);
  return { plain, crt: { m1, m2, h, m: m2 + h * key.q } };
}

/** Text ⇄ numbers: UTF-8 bytes packed big-endian into blocks smaller than n. */
export function textToBlocks(text, n) {
  const bytes = new TextEncoder().encode(String(text)), size = Math.max(1, Math.floor((n.toString(2).length - 1) / 8));
  const blocks = [];
  for (let i = 0; i < bytes.length; i += size) blocks.push([...bytes.slice(i, i + size)].reduce((value, byte) => (value << 8n) | BigInt(byte), 0n));
  return { blocks, blockBytes: size, lastBytes: bytes.length % size || size };
}
export function blocksToText(blocks, blockBytes, lastBytes = blockBytes) {
  const bytes = [];
  blocks.forEach((block, index) => {
    const count = index === blocks.length - 1 ? lastBytes : blockBytes;
    for (let k = count - 1; k >= 0; k -= 1) bytes.push(Number((block >> BigInt(8 * k)) & 0xffn));
  });
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ---------------------------------------------------------------------------
// Diffie–Hellman and discrete logarithms.

/** Prime factors by trial division (for p − 1 when p is small). */
export function factorize(nInput, limit = 10_000_000n) {
  let n = toBig(nInput); const factors = [];
  for (let d = 2n; d * d <= n && d <= limit; d += d === 2n ? 1n : 2n) { if (n % d === 0n) { let count = 0; while (n % d === 0n) { n /= d; count += 1; } factors.push({ prime: d, power: count }); } }
  if (n > 1n) factors.push({ prime: n, power: 1, unverified: n > limit * limit });
  return factors;
}

/** g is a primitive root mod prime p iff g^((p−1)/q) ≠ 1 for every prime q | p − 1. */
export function isPrimitiveRoot(gInput, pInput) {
  const g = toBig(gInput), p = toBig(pInput);
  if (p > 2n ** 64n) return null;
  const factors = factorize(p - 1n);
  if (factors.some((f) => f.unverified)) return null;
  return factors.every(({ prime }) => modPow(g, (p - 1n) / prime, p, { record: false }).result !== 1n);
}

export function diffieHellman({ p: pInput, g: gInput, a: aInput, b: bInput, eveA = null, eveB = null }) {
  const p = toBig(pInput), g = toBig(gInput), a = toBig(aInput), b = toBig(bInput);
  if (!millerRabin(p).prime) throw new RangeError('p must be prime.');
  const A = modPow(g, a, p), B = modPow(g, b, p);
  const kAlice = modPow(B.result, a, p, { record: false }).result, kBob = modPow(A.result, b, p, { record: false }).result;
  const result = { p, g, A: A.result, B: B.result, aliceSteps: A.steps, kAlice, kBob, agree: kAlice === kBob, primitive: isPrimitiveRoot(g, p) };
  if (eveA !== null && eveB !== null) {
    const e1 = toBig(eveA), e2 = toBig(eveB);
    const E1 = modPow(g, e1, p, { record: false }).result, E2 = modPow(g, e2, p, { record: false }).result;
    // Eve sends E1 to Bob (pretending to be Alice) and E2 to Alice (pretending to be Bob).
    result.mitm = { E1, E2, aliceKey: modPow(E2, a, p, { record: false }).result, bobKey: modPow(E1, b, p, { record: false }).result, eveWithAlice: modPow(A.result, e2, p, { record: false }).result, eveWithBob: modPow(B.result, e1, p, { record: false }).result };
  }
  return result;
}

/** Baby-step giant-step: x with g^x ≡ h (mod p), O(√p) time and memory; p below ~10¹².*/
export function discreteLog(gInput, hInput, pInput) {
  const g = toBig(gInput), h = toBig(hInput), p = toBig(pInput);
  if (p > 10n ** 12n) throw new RangeError('Baby-step giant-step here is limited to p < 10¹² — which is exactly why real DH uses 2048-bit primes.');
  const m = BigInt(Math.ceil(Math.sqrt(Number(p - 1n))));
  const table = new Map();
  let value = 1n;
  for (let j = 0n; j < m; j += 1n) { if (!table.has(value)) table.set(value, j); value = (value * g) % p; }
  const factor = modPow(modInverse(g, p).inverse, m, p, { record: false }).result;
  let gamma = mod(h, p);
  for (let i = 0n; i < m; i += 1n) {
    if (table.has(gamma)) return { x: i * m + table.get(gamma), m, operations: Number(m + i + 1n) };
    gamma = (gamma * factor) % p;
  }
  return { x: null, m, operations: Number(2n * m) };
}
