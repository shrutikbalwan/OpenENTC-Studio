const MAX_BITS = 1_000_000;
const SCALE = 1 / Math.sqrt(2);

function validateBits(bits) {
  if ((!Array.isArray(bits) && !ArrayBuffer.isView(bits)) || !bits.length || bits.length > MAX_BITS || bits.length % 2) throw new TypeError('QPSK bits must be a non-empty even-length bounded sequence.');
  if (Array.from(bits).some((bit) => bit !== 0 && bit !== 1)) throw new TypeError('QPSK bits must contain only 0 or 1.');
  return bits;
}

export function qpskModulate(bits) {
  validateBits(bits);
  const symbols = Array.from({ length: bits.length / 2 }, (_, index) => {
    const first = bits[index * 2], second = bits[index * 2 + 1];
    const i = first ? -1 : 1;
    const q = second ? -1 : 1;
    return Object.freeze({ i: i * SCALE, q: q * SCALE });
  });
  return Object.freeze({ kind: 'constellation', modulation: 'QPSK', bitsPerSymbol: 2, symbols: Object.freeze(symbols), sampleRate: null, units: 'normalized' });
}

export function qpskDemodulate(constellation) {
  if (!constellation || !Array.isArray(constellation.symbols) || constellation.symbols.length * 2 > MAX_BITS) throw new TypeError('QPSK constellation is invalid or too large.');
  const bits = [];
  for (const symbol of constellation.symbols) {
    if (!symbol || !Number.isFinite(symbol.i) || !Number.isFinite(symbol.q)) throw new TypeError('QPSK symbols must have finite I/Q values.');
    bits.push(symbol.i < 0 ? 1 : 0, symbol.q < 0 ? 1 : 0);
  }
  return Object.freeze(bits);
}

export function addAwgn(constellation, { sigma = 0, seed = 1 } = {}) {
  if (!constellation || !Array.isArray(constellation.symbols)) throw new TypeError('Constellation is required.');
  if (!Number.isFinite(sigma) || sigma < 0 || !Number.isFinite(seed)) throw new TypeError('AWGN parameters are invalid.');
  let state = (Math.trunc(seed) >>> 0) || 1;
  const uniform = () => { state = (1664525 * state + 1013904223) >>> 0; return (state + 1) / 0x100000001; };
  const gaussian = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()) * sigma;
  return Object.freeze({ ...constellation, symbols: Object.freeze(constellation.symbols.map((symbol) => Object.freeze({ i: symbol.i + gaussian(), q: symbol.q + gaussian() }))), channel: 'AWGN', noiseSigma: sigma, seed: Math.trunc(seed) });
}

export function bitErrorRate(expected, actual) {
  validateBits(expected); validateBits(actual);
  if (expected.length !== actual.length) throw new RangeError('BER sequences must have equal length.');
  const errors = expected.reduce((count, bit, index) => count + (bit !== actual[index] ? 1 : 0), 0);
  return Object.freeze({ kind: 'ber', errors, bits: expected.length, rate: errors / expected.length });
}
