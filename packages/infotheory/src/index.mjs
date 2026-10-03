// Information theory and spread spectrum: entropy, source coding (Huffman, Shannon–Fano, LZW),
// channel capacity (BSC, BEC, AWGN and any discrete memoryless channel by Blahut–Arimoto),
// PN and Gold sequences, DSSS and FHSS, and an OFDM link with cyclic prefix and multipath.

const log2 = (x) => Math.log(x) / Math.LN2;

function normalise(probabilities) {
  const values = probabilities.map(Number);
  if (!values.length || values.some((p) => !Number.isFinite(p) || p < 0)) throw new RangeError('Probabilities must be non-negative numbers.');
  const total = values.reduce((sum, p) => sum + p, 0);
  if (!(total > 0)) throw new RangeError('Probabilities must not all be zero.');
  return values.map((p) => p / total);
}

/** Entropy in bits (or the given base) of a probability list; it is normalised first. */
export function entropy(probabilities, base = 2) {
  return normalise(probabilities).reduce((sum, p) => (p > 0 ? sum - p * Math.log(p) : sum), 0) / Math.log(base);
}

/** Binary entropy function Hb(p). */
export function binaryEntropy(p) {
  if (p <= 0 || p >= 1) return 0;
  return -p * log2(p) - (1 - p) * log2(1 - p);
}

/** Symbol statistics of a text: [{ symbol, count, p }] sorted by falling probability. */
export function textSource(text) {
  const counts = new Map();
  for (const ch of String(text)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) throw new RangeError('Enter some text.');
  return [...counts].map(([symbol, count]) => ({ symbol, count, p: count / total })).sort((a, b) => b.p - a.p || (a.symbol < b.symbol ? -1 : 1));
}

function codeFigures(symbols, codes) {
  const p = normalise(symbols.map((s) => s.p));
  const average = codes.reduce((sum, code, i) => sum + p[i] * code.length, 0);
  const h = entropy(p);
  const kraft = codes.reduce((sum, code) => sum + 2 ** -code.length, 0);
  return { entropy: h, averageLength: average, efficiency: average > 0 ? h / average : 1, redundancy: average > 0 ? 1 - h / average : 0, kraft, variance: codes.reduce((sum, code, i) => sum + p[i] * (code.length - average) ** 2, 0) };
}

function checkSymbols(symbols) {
  if (!Array.isArray(symbols) || symbols.length < 2) throw new RangeError('Enter at least two symbols.');
  const names = new Set(symbols.map((s) => s.symbol));
  if (names.size !== symbols.length) throw new RangeError('Symbol names must be unique.');
  normalise(symbols.map((s) => s.p));
}

/**
 * Binary Huffman code. Ties are broken by placing the combined node as high as possible
 * (the textbook "minimum variance" rule), so the code-length variance is the smallest.
 * Returns codes in the input order plus the merge steps (the reduction table).
 */
export function huffman(symbols) {
  checkSymbols(symbols);
  const p = normalise(symbols.map((s) => s.p));
  let nodes = p.map((value, index) => ({ p: value, members: [index], order: index, combined: false }));
  const codes = symbols.map(() => '');
  const steps = [];
  let serial = symbols.length;
  while (nodes.length > 1) {
    // Highest probability first; a combined node goes above an original one of equal probability.
    nodes.sort((a, b) => b.p - a.p || Number(b.combined) - Number(a.combined) || a.order - b.order);
    steps.push(nodes.map((node) => ({ p: node.p, members: node.members.map((i) => symbols[i].symbol) })));
    const low = nodes.pop(), high = nodes.pop();
    for (const i of high.members) codes[i] = `0${codes[i]}`;
    for (const i of low.members) codes[i] = `1${codes[i]}`;
    nodes.push({ p: high.p + low.p, members: [...high.members, ...low.members], order: serial++, combined: true });
  }
  return { codes: symbols.map((s, i) => ({ symbol: s.symbol, p: p[i], code: codes[i] })), steps, ...codeFigures(symbols, codes) };
}

/** Shannon–Fano code: sort by probability and split each group where the two halves are closest. */
export function shannonFano(symbols) {
  checkSymbols(symbols);
  const p = normalise(symbols.map((s) => s.p));
  const order = p.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
  const codes = symbols.map(() => '');
  const splits = [];
  const split = (group, depth) => {
    if (group.length < 2) return;
    const total = group.reduce((sum, item) => sum + item.value, 0);
    let running = 0, best = 1, bestGap = Infinity;
    for (let k = 1; k < group.length; k += 1) {
      running += group[k - 1].value;
      const gap = Math.abs(total - 2 * running);
      if (gap < bestGap - 1e-12) { bestGap = gap; best = k; }
    }
    const top = group.slice(0, best), bottom = group.slice(best);
    splits.push({ depth, top: top.map((item) => symbols[item.index].symbol), bottom: bottom.map((item) => symbols[item.index].symbol) });
    for (const item of top) codes[item.index] += '0';
    for (const item of bottom) codes[item.index] += '1';
    split(top, depth + 1);
    split(bottom, depth + 1);
  };
  split(order, 0);
  return { codes: symbols.map((s, i) => ({ symbol: s.symbol, p: p[i], code: codes[i] })), splits, ...codeFigures(symbols, codes) };
}

/** Encode a text with a code table; returns the bit string. */
export function encodeWithCode(text, codes) {
  const table = new Map(codes.map((entry) => [entry.symbol, entry.code]));
  let bits = '';
  for (const ch of String(text)) {
    const code = table.get(ch);
    if (code === undefined) throw new RangeError(`Symbol "${ch}" is not in the code.`);
    bits += code;
  }
  return bits;
}

/** Decode a bit string with a prefix code. */
export function decodeWithCode(bits, codes) {
  const table = new Map(codes.map((entry) => [entry.code, entry.symbol]));
  let out = '', current = '';
  for (const bit of String(bits)) {
    current += bit;
    if (table.has(current)) { out += table.get(current); current = ''; }
  }
  if (current) throw new RangeError('The bit string ends in the middle of a code word.');
  return out;
}

/** LZW compression with a dictionary seeded by the distinct characters of the text (sorted). */
export function lzwEncode(text) {
  const input = String(text);
  if (!input) throw new RangeError('Enter some text.');
  const alphabet = [...new Set(input)].sort();
  const dictionary = new Map(alphabet.map((ch, i) => [ch, i]));
  const output = [], added = [];
  let w = '';
  for (const ch of input) {
    const wc = w + ch;
    if (dictionary.has(wc)) { w = wc; continue; }
    output.push({ phrase: w, code: dictionary.get(w) });
    added.push({ code: dictionary.size, phrase: wc });
    dictionary.set(wc, dictionary.size);
    w = ch;
  }
  output.push({ phrase: w, code: dictionary.get(w) });
  const bitsPerCode = Math.max(1, Math.ceil(log2(dictionary.size)));
  return { alphabet, output, codes: output.map((item) => item.code), added, dictionarySize: dictionary.size, bitsPerCode, compressedBits: output.length * bitsPerCode, originalBits: input.length * Math.max(1, Math.ceil(log2(alphabet.length))) };
}

/** LZW decompression for the same alphabet. */
export function lzwDecode(codes, alphabet) {
  const dictionary = [...alphabet];
  if (!codes.length) return '';
  let w = dictionary[codes[0]];
  if (w === undefined) throw new RangeError('Invalid first code.');
  let out = w;
  for (const code of codes.slice(1)) {
    let entry;
    if (code < dictionary.length) entry = dictionary[code];
    else if (code === dictionary.length) entry = w + w[0];
    else throw new RangeError(`Invalid code ${code}.`);
    out += entry;
    dictionary.push(w + entry[0]);
    w = entry;
  }
  return out;
}

/** Binary symmetric channel capacity 1 − Hb(p). */
export const bscCapacity = (p) => 1 - binaryEntropy(p);
/** Binary erasure channel capacity 1 − ε. */
export const becCapacity = (e) => 1 - e;

/** Shannon–Hartley capacity C = B log2(1 + S/N), with S/N given in dB. */
export function awgnCapacity(bandwidth, snrDb) {
  const snr = 10 ** (snrDb / 10);
  return { capacity: bandwidth * log2(1 + snr), spectralEfficiency: log2(1 + snr), snr, shannonLimitDb: 10 * Math.log10(Math.LN2) };
}

/** Minimum Eb/N0 (dB) for a spectral efficiency η bits/s/Hz: (2^η − 1)/η. */
export const minimumEbN0Db = (eta) => 10 * Math.log10(eta > 0 ? (2 ** eta - 1) / eta : Math.LN2);

function checkChannel(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) throw new RangeError('Enter a channel matrix.');
  const width = matrix[0].length;
  matrix.forEach((row, i) => {
    if (row.length !== width) throw new RangeError('Every row must have the same number of outputs.');
    const total = row.reduce((sum, value) => sum + value, 0);
    if (row.some((value) => !(value >= 0)) || Math.abs(total - 1) > 1e-6) throw new RangeError(`Row ${i + 1} must be probabilities that add to 1.`);
  });
}

/** Mutual information I(X;Y), H(X), H(Y), H(X|Y), H(Y|X) for a channel matrix P(y|x) and input distribution. */
export function mutualInformation(matrix, inputs) {
  checkChannel(matrix);
  const px = normalise(inputs);
  if (px.length !== matrix.length) throw new RangeError('One input probability per row.');
  const py = matrix[0].map((_, j) => matrix.reduce((sum, row, i) => sum + px[i] * row[j], 0));
  let information = 0;
  matrix.forEach((row, i) => row.forEach((value, j) => { if (value > 0 && px[i] > 0) information += px[i] * value * log2(value / py[j]); }));
  const hx = entropy(px), hy = entropy(py.map((v) => Math.max(v, 0)));
  return { information, hx, hy, hxGivenY: hx - information, hyGivenX: hy - information, py };
}

/** Capacity of a discrete memoryless channel by the Blahut–Arimoto algorithm. */
export function channelCapacity(matrix, { tolerance = 1e-12, maxIterations = 10000 } = {}) {
  checkChannel(matrix);
  const n = matrix.length, m = matrix[0].length;
  let px = Array(n).fill(1 / n);
  let lower = 0, upper = Infinity, iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    const py = Array.from({ length: m }, (_, j) => matrix.reduce((sum, row, i) => sum + px[i] * row[j], 0));
    const c = matrix.map((row) => Math.exp(row.reduce((sum, value, j) => (value > 0 ? sum + value * Math.log(value / py[j]) : sum), 0)));
    const total = c.reduce((sum, value, i) => sum + px[i] * value, 0);
    lower = Math.log(total) / Math.LN2;
    upper = Math.log(Math.max(...c)) / Math.LN2;
    px = px.map((value, i) => value * c[i] / total);
    if (upper - lower < tolerance) break;
  }
  return { capacity: lower, upperBound: upper, inputDistribution: px, iterations };
}

// ---------------------------------------------------------------------------
// PN sequences.

/** Primitive feedback polynomials (exponents of the taps, Fibonacci form) for degrees 2–10. */
export const PRIMITIVE_TAPS = Object.freeze({ 2: [2, 1], 3: [3, 2], 4: [4, 3], 5: [5, 3], 6: [6, 5], 7: [7, 6], 8: [8, 6, 5, 4], 9: [9, 5], 10: [10, 7] });
/** Preferred pairs for Gold codes in this register's tap convention (found by exhaustive search; three-valued cross-correlation). */
export const GOLD_PAIRS = Object.freeze({ 5: [[5, 3], [5, 3, 2, 1]], 6: [[6, 5], [6, 5, 3, 2]], 7: [[7, 6], [7, 3]], 9: [[9, 5], [9, 5, 4, 1]], 10: [[10, 7], [10, 7, 6, 5, 4, 1]] });

/**
 * Fibonacci LFSR. taps are exponents of x in the feedback polynomial (the degree first);
 * the register state is a bit array whose last cell is the output. Returns one period (2^n − 1) by default.
 */
export function lfsr(taps, { seed = null, length = null } = {}) {
  const degree = Math.max(...taps);
  if (!Number.isInteger(degree) || degree < 2 || degree > 20) throw new RangeError('Degree must be 2 to 20.');
  let state = seed ? [...seed] : Array(degree).fill(1);
  if (state.length !== degree || state.every((bit) => !bit)) throw new RangeError('The seed must have one bit per stage and not be all zero.');
  const total = length ?? 2 ** degree - 1;
  const out = [], states = [];
  for (let k = 0; k < total; k += 1) {
    if (k < 64) states.push(state.join(''));
    out.push(state[degree - 1]);
    const feedback = taps.reduce((bit, tap) => bit ^ state[tap - 1], 0);
    state = [feedback, ...state.slice(0, degree - 1)];
  }
  return { sequence: out, states, degree };
}

/** Periodic autocorrelation of a ±1 version of a 0/1 sequence (unnormalised). */
export function periodicCorrelation(a, b = a) {
  const n = a.length;
  if (b.length !== n) throw new RangeError('Sequences must be the same length.');
  const x = a.map((bit) => 1 - 2 * bit), y = b.map((bit) => 1 - 2 * bit);
  return Array.from({ length: n }, (_, shift) => x.reduce((sum, value, k) => sum + value * y[(k + shift) % n], 0));
}

/** m-sequence properties: balance, run counts and the two-valued autocorrelation. */
export function sequenceProperties(sequence) {
  const ones = sequence.reduce((a, b) => a + b, 0);
  const runs = {};
  let run = 1;
  for (let k = 1; k <= sequence.length; k += 1) {
    if (k < sequence.length && sequence[k] === sequence[k - 1]) { run += 1; continue; }
    runs[run] = (runs[run] ?? 0) + 1;
    run = 1;
  }
  // Wrap-around: a run that spans the end and the start counts once.
  if (sequence.length > 1 && sequence[0] === sequence.at(-1)) {
    let head = 0; while (head < sequence.length && sequence[head] === sequence[0]) head += 1;
    let tail = 0; while (tail < sequence.length && sequence[sequence.length - 1 - tail] === sequence[0]) tail += 1;
    if (head < sequence.length) { runs[head] -= 1; runs[tail] -= 1; runs[head + tail] = (runs[head + tail] ?? 0) + 1; for (const key of Object.keys(runs)) if (!runs[key]) delete runs[key]; }
  }
  const correlation = periodicCorrelation(sequence);
  return { length: sequence.length, ones, zeros: sequence.length - ones, runs, correlation, offPeak: [...new Set(correlation.slice(1))].sort((a, b) => a - b) };
}

/** The Gold family from a preferred pair: u, v and u ⊕ shift(v) for every shift. */
export function goldCodes(degree) {
  const pair = GOLD_PAIRS[degree];
  if (!pair) throw new RangeError(`No preferred pair stored for degree ${degree}.`);
  const u = lfsr(pair[0]).sequence, v = lfsr(pair[1]).sequence, n = u.length;
  const family = [u, v, ...Array.from({ length: n }, (_, shift) => u.map((bit, k) => bit ^ v[(k + shift) % n]))];
  const t = 2 ** Math.floor((degree + 2) / 2) + 1;
  return { degree, length: n, pair, family, bound: [-t, -1, t - 2] };
}

// ---------------------------------------------------------------------------
// Seeded random numbers.

export function createRandom(seed = 1) {
  let a = seed >>> 0 || 1;
  const uniform = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare = null;
  const gaussian = () => {
    if (spare !== null) { const value = spare; spare = null; return value; }
    let u = 0; while (u <= 1e-300) u = uniform();
    const v = uniform(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { uniform, gaussian };
}

/**
 * DSSS with BPSK. Each data bit is multiplied by N chips of an m-sequence, sent through AWGN
 * (Eb/N0 in dB) plus an optional narrowband tone jammer (jammer-to-signal ratio in dB), then despread.
 */
export function dsss({ degree = 5, bits = 2000, ebN0Db = 6, jsrDb = -Infinity, jammerFrequency = 0.01, seed = 1, spread = true } = {}) {
  const code = lfsr(PRIMITIVE_TAPS[degree]).sequence.map((bit) => 1 - 2 * bit);
  const n = spread ? code.length : 1;
  const random = createRandom(seed);
  const data = Array.from({ length: bits }, () => (random.uniform() < 0.5 ? 0 : 1));
  // Chip energy Ec = Eb/N, so the noise per chip has variance N0/2 with N0 = Eb / (Eb/N0) and Eb = N·Ec = N.
  const ec = 1 / n;
  const n0 = 1 / 10 ** (ebN0Db / 10);
  const sigma = Math.sqrt(n0 / 2);
  const jammerAmplitude = Number.isFinite(jsrDb) ? Math.sqrt(2 * ec * 10 ** (jsrDb / 10)) : 0;
  let errors = 0;
  const chips = [], received = [], despread = [];
  for (let b = 0; b < bits; b += 1) {
    const symbol = 1 - 2 * data[b];
    let sum = 0;
    for (let c = 0; c < n; c += 1) {
      const index = b * n + c;
      const tx = Math.sqrt(ec) * symbol * (spread ? code[c] : 1);
      const rx = tx + sigma * random.gaussian() + jammerAmplitude * Math.cos(2 * Math.PI * jammerFrequency * index);
      if (index < 600) { chips.push(tx); received.push(rx); }
      sum += rx * (spread ? code[c] : 1) * Math.sqrt(ec);
    }
    if (b < 200) despread.push(sum);
    if ((sum < 0 ? 1 : 0) !== data[b]) errors += 1;
  }
  return { chipsPerBit: n, processingGainDb: 10 * Math.log10(n), errors, bits, ber: errors / bits, theoryBer: 0.5 * erfc(Math.sqrt(10 ** (ebN0Db / 10))), chips, received, despread, code };
}

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7). */
export function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** Frequency-hopping pattern: a PN register picks one of 2^k channels every hop. */
export function fhss({ degree = 5, channelBits = 3, hops = 32, baseFrequency = 2.402e9, spacing = 1e6, seed = null } = {}) {
  const taps = PRIMITIVE_TAPS[degree];
  if (channelBits > degree) throw new RangeError('Channel bits cannot exceed the register length.');
  let state = seed ? [...seed] : Array(degree).fill(1);
  const pattern = [];
  for (let h = 0; h < hops; h += 1) {
    const channel = state.slice(0, channelBits).reduce((value, bit) => value * 2 + bit, 0);
    pattern.push({ hop: h, channel, frequency: baseFrequency + channel * spacing });
    for (let s = 0; s < channelBits; s += 1) { const feedback = taps.reduce((bit, tap) => bit ^ state[tap - 1], 0); state = [feedback, ...state.slice(0, degree - 1)]; }
  }
  const channels = 2 ** channelBits;
  const use = Array(channels).fill(0); pattern.forEach((item) => { use[item.channel] += 1; });
  return { pattern, channels, use, bandwidth: channels * spacing, processingGainDb: 10 * Math.log10(channels) };
}

// ---------------------------------------------------------------------------
// OFDM.

function fft(re, im, inverse = false) {
  const n = re.length;
  if (n & (n - 1)) throw new RangeError('FFT length must be a power of two.');
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const wr = Math.cos(angle * k), wi = Math.sin(angle * k);
        const a = start + k, b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
}
export { fft as fftInPlace };

const QAM_LEVELS = { qpsk: [-1, 1], '16qam': [-3, -1, 1, 3] };
/** Gray-coded square QAM mapper. */
export function qamMap(bits, scheme = 'qpsk') {
  const levels = QAM_LEVELS[scheme];
  if (!levels) throw new RangeError(`Unknown scheme ${scheme}.`);
  const half = Math.log2(levels.length), per = 2 * half;
  const gray = (value) => value ^ (value >> 1);
  const index = new Map(levels.map((_, k) => [gray(k), k]));
  const scale = Math.sqrt(scheme === 'qpsk' ? 2 : 10);
  const symbols = [];
  for (let k = 0; k + per <= bits.length; k += per) {
    const value = (offset) => bits.slice(k + offset, k + offset + half).reduce((v, bit) => v * 2 + bit, 0);
    symbols.push({ re: levels[index.get(value(0))] / scale, im: levels[index.get(value(half))] / scale });
  }
  return { symbols, bitsPerSymbol: per };
}

/** Nearest-point Gray QAM demapper. */
export function qamDemap(symbols, scheme = 'qpsk') {
  const levels = QAM_LEVELS[scheme];
  const half = Math.log2(levels.length);
  const scale = Math.sqrt(scheme === 'qpsk' ? 2 : 10);
  const toBits = (x) => {
    let best = 0;
    levels.forEach((level, k) => { if (Math.abs(x * scale - level) < Math.abs(x * scale - levels[best])) best = k; });
    const g = best ^ (best >> 1);
    return Array.from({ length: half }, (_, b) => (g >> (half - 1 - b)) & 1);
  };
  return symbols.flatMap((s) => [...toBits(s.re), ...toBits(s.im)]);
}

/**
 * OFDM link: N subcarriers, cyclic prefix of cp samples, a multipath channel given as real tap
 * gains, AWGN at Es/N0 (dB), FFT and a one-tap zero-forcing equaliser per subcarrier.
 */
export function ofdmLink({ subcarriers = 64, cp = 16, symbols = 40, scheme = 'qpsk', channel = [1, 0, 0, 0.6, 0, 0, 0.45, 0, 0.3], snrDb = 25, seed = 3 } = {}) {
  if (!Number.isInteger(Math.log2(subcarriers))) throw new RangeError('Subcarriers must be a power of two.');
  if (cp < 0 || cp >= subcarriers) throw new RangeError('The cyclic prefix must be shorter than the symbol.');
  const random = createRandom(seed);
  const perSymbol = subcarriers * (scheme === 'qpsk' ? 2 : 4);
  const bits = Array.from({ length: perSymbol * symbols }, () => (random.uniform() < 0.5 ? 0 : 1));
  const mapped = qamMap(bits, scheme).symbols;
  // Transmit: IFFT each block, scale to unit average power, add the cyclic prefix.
  const tx = [];
  for (let s = 0; s < symbols; s += 1) {
    const re = [], im = [];
    for (let k = 0; k < subcarriers; k += 1) { re.push(mapped[s * subcarriers + k].re); im.push(mapped[s * subcarriers + k].im); }
    fft(re, im, true);
    const block = re.map((value, k) => ({ re: value * Math.sqrt(subcarriers), im: im[k] * Math.sqrt(subcarriers) }));
    tx.push(...block.slice(subcarriers - cp), ...block);
  }
  // Channel: linear convolution with the taps, then AWGN.
  const sigma = Math.sqrt(1 / 10 ** (snrDb / 10) / 2);
  const rx = tx.map((_, n) => {
    let re = 0, im = 0;
    channel.forEach((tap, l) => { if (n - l >= 0) { re += tap * tx[n - l].re; im += tap * tx[n - l].im; } });
    return { re: re + sigma * random.gaussian(), im: im + sigma * random.gaussian() };
  });
  // Channel frequency response H[k].
  const hr = Array(subcarriers).fill(0), hi = Array(subcarriers).fill(0);
  channel.forEach((tap, l) => { if (l < subcarriers) hr[l] = tap; });
  fft(hr, hi);
  const equalised = [], raw = [];
  for (let s = 0; s < symbols; s += 1) {
    const start = s * (subcarriers + cp) + cp;
    const re = [], im = [];
    for (let k = 0; k < subcarriers; k += 1) { re.push(rx[start + k].re / Math.sqrt(subcarriers)); im.push(rx[start + k].im / Math.sqrt(subcarriers)); }
    fft(re, im);
    for (let k = 0; k < subcarriers; k += 1) {
      const d = hr[k] ** 2 + hi[k] ** 2 || 1e-300;
      raw.push({ re: re[k], im: im[k] });
      equalised.push({ re: (re[k] * hr[k] + im[k] * hi[k]) / d, im: (im[k] * hr[k] - re[k] * hi[k]) / d });
    }
  }
  const decided = qamDemap(equalised, scheme);
  const errors = decided.reduce((sum, bit, k) => sum + (bit !== bits[k] ? 1 : 0), 0);
  const delaySpread = channel.length - 1;
  return {
    bits: bits.length, errors, ber: errors / bits.length, equalised, raw,
    channelResponseDb: hr.map((value, k) => 10 * Math.log10(value ** 2 + hi[k] ** 2 + 1e-30)),
    delaySpread, cpCoversChannel: cp >= delaySpread, efficiency: subcarriers / (subcarriers + cp),
    txPreview: tx.slice(0, 3 * (subcarriers + cp)).map((v) => v.re)
  };
}
