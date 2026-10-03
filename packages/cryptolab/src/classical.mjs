// Classical ciphers with their intermediate tables: Caesar (with chi-squared cracking),
// Vigenère (with index of coincidence), Playfair, Hill and rail fence.

const A = 65;
export const lettersOnly = (text) => String(text).toUpperCase().replace(/[^A-Z]/g, '');
const mod = (value, m) => ((value % m) + m) % m;

// Relative letter frequencies of English (Lewand), A–Z.
export const ENGLISH_FREQUENCIES = Object.freeze([0.08167, 0.01492, 0.02782, 0.04253, 0.12702, 0.02228, 0.02015, 0.06094, 0.06966, 0.00153, 0.00772, 0.04025, 0.02406, 0.06749, 0.07507, 0.01929, 0.00095, 0.05987, 0.06327, 0.09056, 0.02758, 0.00978, 0.0236, 0.0015, 0.01974, 0.00074]);

export function letterCounts(text) {
  const counts = Array(26).fill(0);
  for (const ch of lettersOnly(text)) counts[ch.charCodeAt(0) - A] += 1;
  return counts;
}

/** χ² distance of a text's letter counts from English. */
export function chiSquared(text) {
  const counts = letterCounts(text), total = counts.reduce((sum, value) => sum + value, 0) || 1;
  return counts.reduce((sum, count, i) => sum + (count - total * ENGLISH_FREQUENCIES[i]) ** 2 / (total * ENGLISH_FREQUENCIES[i]), 0);
}

/** Shift letters, keeping case and leaving other characters alone. */
export function caesar(text, shift) {
  return String(text).replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + mod(ch.charCodeAt(0) - base + shift, 26));
  });
}

/** Try all 26 shifts and rank them by closeness to English. */
export function crackCaesar(ciphertext) {
  return Array.from({ length: 26 }, (_, key) => { const plain = caesar(ciphertext, -key); return { key, plain, score: chiSquared(plain) }; }).sort((a, b) => a.score - b.score);
}

export function vigenere(text, key, decrypt = false) {
  const k = lettersOnly(key);
  if (!k) throw new RangeError('The Vigenère key needs at least one letter.');
  let index = 0;
  const steps = [];
  const output = String(text).replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97, shift = k.charCodeAt(index % k.length) - A;
    const out = String.fromCharCode(base + mod(ch.charCodeAt(0) - base + (decrypt ? -shift : shift), 26));
    if (steps.length < 64) steps.push({ input: ch.toUpperCase(), key: k[index % k.length], output: out.toUpperCase() });
    index += 1;
    return out;
  });
  return { output, steps };
}

/** Index of coincidence and Friedman's key-length estimate. */
export function indexOfCoincidence(text) {
  const counts = letterCounts(text), n = counts.reduce((sum, value) => sum + value, 0);
  const ic = n > 1 ? counts.reduce((sum, c) => sum + c * (c - 1), 0) / (n * (n - 1)) : 0;
  const friedman = ic > 0.0385 ? 0.0265 * n / ((n - 1) * ic - 0.0385 * n + 0.0655) : null;
  return { ic, friedman };
}

/** Recover a Vigenère key of a given length by cracking each column as a Caesar shift. */
export function crackVigenere(ciphertext, keyLength) {
  const letters = lettersOnly(ciphertext);
  const key = Array.from({ length: keyLength }, (_, column) => {
    const slice = [...letters].filter((_, i) => i % keyLength === column).join('');
    return String.fromCharCode(A + crackCaesar(slice)[0].key);
  }).join('');
  return { key, plain: vigenere(ciphertext, key, true).output };
}

// ---------------------------------------------------------------------------
// Playfair.

export function playfairSquare(key) {
  const seen = new Set(), square = [];
  for (const ch of `${lettersOnly(key)}ABCDEFGHIKLMNOPQRSTUVWXYZ`.replace(/J/g, 'I')) if (!seen.has(ch)) { seen.add(ch); square.push(ch); }
  return Array.from({ length: 5 }, (_, row) => square.slice(row * 5, row * 5 + 5));
}

/** Split plaintext into digraphs: J→I, X between doubled letters, X (or Q after X) to finish. */
export function playfairDigraphs(text) {
  const letters = lettersOnly(text).replace(/J/g, 'I'), pairs = [];
  for (let i = 0; i < letters.length;) {
    const first = letters[i], second = letters[i + 1];
    if (second === undefined) { pairs.push(first + (first === 'X' ? 'Q' : 'X')); i += 1; }
    else if (first === second) { pairs.push(first + (first === 'X' ? 'Q' : 'X')); i += 1; }
    else { pairs.push(first + second); i += 2; }
  }
  return pairs;
}

export function playfair(text, key, decrypt = false) {
  const square = playfairSquare(key);
  const where = {};
  square.forEach((row, r) => row.forEach((ch, c) => { where[ch] = [r, c]; }));
  const pairs = decrypt ? (lettersOnly(text).replace(/J/g, 'I').match(/.{1,2}/g) || []) : playfairDigraphs(text);
  if (decrypt && pairs.some((pair) => pair.length !== 2 || pair[0] === pair[1])) throw new RangeError('Playfair ciphertext must be an even number of letters with no doubled pairs.');
  const step = decrypt ? 4 : 1;
  const steps = pairs.map((pair) => {
    const [r1, c1] = where[pair[0]], [r2, c2] = where[pair[1]];
    let out, rule;
    if (r1 === r2) { out = square[r1][(c1 + step) % 5] + square[r2][(c2 + step) % 5]; rule = 'same row'; }
    else if (c1 === c2) { out = square[(r1 + step) % 5][c1] + square[(r2 + step) % 5][c2]; rule = 'same column'; }
    else { out = square[r1][c2] + square[r2][c1]; rule = 'rectangle'; }
    return { pair, out, rule };
  });
  return { square, steps, output: steps.map((s) => s.out).join('') };
}

// ---------------------------------------------------------------------------
// Hill cipher.

function determinant(m) {
  if (m.length === 1) return m[0][0];
  return m[0].reduce((sum, value, j) => sum + (j % 2 ? -1 : 1) * value * determinant(m.slice(1).map((row) => row.filter((_, k) => k !== j))), 0);
}
export function modInverseSmall(a, m) {
  const value = mod(a, m);
  for (let x = 1; x < m; x += 1) if ((value * x) % m === 1) return x;
  return null;
}
/** Inverse of a key matrix modulo 26 (adjugate × det⁻¹), or an explanation why none exists. */
export function hillInverse(matrix) {
  const n = matrix.length, det = mod(determinant(matrix), 26), detInverse = modInverseSmall(det, 26);
  if (detInverse === null) return { det, inverse: null, reason: `det = ${det} shares a factor with 26, so the key is not invertible.` };
  const cofactor = (i, j) => (((i + j) % 2) ? -1 : 1) * determinant(matrix.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j)));
  const inverse = n === 1 ? [[detInverse]] : Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => mod(cofactor(j, i) * detInverse, 26)));
  return { det, detInverse, inverse, reason: null };
}

export function hill(text, matrix, decrypt = false) {
  const n = matrix.length;
  if (!n || matrix.some((row) => row.length !== n)) throw new RangeError('The Hill key must be a square matrix.');
  const info = hillInverse(matrix);
  if (!info.inverse) throw new RangeError(info.reason);
  const key = decrypt ? info.inverse : matrix;
  let letters = lettersOnly(text);
  while (letters.length % n) letters += 'X';
  const blocks = [];
  for (let i = 0; i < letters.length; i += n) {
    const vector = [...letters.slice(i, i + n)].map((ch) => ch.charCodeAt(0) - A);
    const product = key.map((row) => row.reduce((sum, value, k) => sum + value * vector[k], 0));
    blocks.push({ input: letters.slice(i, i + n), vector, product, result: product.map((value) => mod(value, 26)), output: product.map((value) => String.fromCharCode(A + mod(value, 26))).join('') });
  }
  return { ...info, blocks, output: blocks.map((block) => block.output).join('') };
}

// ---------------------------------------------------------------------------
// Rail fence.

function railPattern(length, rails) {
  const pattern = [];
  let rail = 0, direction = 1;
  for (let i = 0; i < length; i += 1) { pattern.push(rail); if (rails > 1) { if (rail === 0) direction = 1; else if (rail === rails - 1) direction = -1; rail += direction; } }
  return pattern;
}
export function railFence(text, rails, decrypt = false) {
  if (!Number.isInteger(rails) || rails < 1) throw new RangeError('Rails must be a whole number ≥ 1.');
  const chars = [...String(text).replace(/\s+/g, '')];
  const pattern = railPattern(chars.length, rails);
  const grid = Array.from({ length: rails }, () => Array(chars.length).fill(''));
  if (!decrypt) {
    chars.forEach((ch, i) => { grid[pattern[i]][i] = ch; });
    return { grid, output: grid.map((row) => row.join('')).join('') };
  }
  const order = pattern.map((rail, i) => ({ rail, i })).sort((a, b) => a.rail - b.rail || a.i - b.i);
  const plain = Array(chars.length);
  order.forEach((entry, k) => { plain[entry.i] = chars[k]; grid[entry.rail][entry.i] = chars[k]; });
  return { grid, output: plain.join('') };
}
