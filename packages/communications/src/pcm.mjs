// Sampling, quantization (PCM) and line coding.
import { boundedNumber } from './math.mjs';

export const LINE_CODES = Object.freeze({
  'unipolar-nrz': 'Unipolar NRZ', 'polar-nrz': 'Polar NRZ', 'unipolar-rz': 'Unipolar RZ', 'polar-rz': 'Polar RZ',
  manchester: 'Manchester (IEEE 802.3)', ami: 'Bipolar AMI', nrzi: 'NRZI',
});
const MU = 255;
// An irrational cycles-per-sample ratio so the sine visits every quantizer level evenly.
const INCOMMENSURATE = (Math.sqrt(5) - 1) / 53;

/** Mid-rise uniform quantizer over [-1, 1] with 2^bits levels. */
export function quantize(value, bits) {
  const levels = 2 ** bits, step = 2 / levels;
  const index = Math.min(levels - 1, Math.max(0, Math.floor((value + 1) / step)));
  return -1 + step * (index + 0.5);
}

const compress = (x) => Math.sign(x) * Math.log1p(MU * Math.abs(x)) / Math.log1p(MU);
const expand = (y) => Math.sign(y) * Math.expm1(Math.abs(y) * Math.log1p(MU)) / MU;

/** Measured signal-to-quantization-noise ratio (dB) of a sine of the given amplitude. */
export function measureSqnr(bits, { law = 'uniform', amplitude = 1, samples = 20_000 } = {}) {
  let signal = 0, noise = 0;
  for (let n = 0; n < samples; n += 1) {
    const x = amplitude * Math.sin(2 * Math.PI * INCOMMENSURATE * n + 0.3);
    const y = law === 'mu-law' ? expand(quantize(compress(x), bits)) : quantize(x, bits);
    signal += x * x; noise += (y - x) ** 2;
  }
  return 10 * Math.log10(signal / noise);
}

/**
 * Sample a sine of `signalFrequency` at `sampleRate`, quantize with `bits` (uniform or
 * μ-law) and report aliasing, the PCM bit rate and SQNR against 6.02n + 1.76 dB.
 */
export function samplingDemo({ signalFrequency = 1000, sampleRate = 8000, bits = 4, law = 'uniform', amplitude = 1, periods = 3 } = {}) {
  const f0 = boundedNumber(signalFrequency, 1, 1e9, 'Signal frequency');
  const fs = boundedNumber(sampleRate, 1, 1e10, 'Sample rate');
  const n = Math.trunc(boundedNumber(bits, 1, 16, 'Bits per sample'));
  const level = boundedNumber(amplitude, 0.001, 1, 'Amplitude');
  if (!['uniform', 'mu-law'].includes(law)) throw new RangeError('Law must be uniform or mu-law.');
  const duration = boundedNumber(periods, 1, 20, 'Periods') / f0;
  const dense = 600;
  const analog = Array.from({ length: dense + 1 }, (_, k) => { const t = duration * k / dense; return { t, value: level * Math.sin(2 * Math.PI * f0 * t) }; });
  const count = Math.min(2000, Math.floor(duration * fs) + 1);
  const samples = Array.from({ length: count }, (_, k) => {
    const t = k / fs, value = level * Math.sin(2 * Math.PI * f0 * t);
    const quantized = law === 'mu-law' ? expand(quantize(compress(value), n)) : quantize(value, n);
    return { t, value, quantized, code: Math.min(2 ** n - 1, Math.max(0, Math.floor(((law === 'mu-law' ? compress(value) : value) + 1) / (2 / 2 ** n)))) };
  });
  const folded = Math.abs(f0 - Math.round(f0 / fs) * fs);
  return {
    kind: 'sampling', signalFrequency: f0, sampleRate: fs, bits: n, law, amplitude: level, analog, samples,
    nyquistRate: 2 * f0, aliased: fs < 2 * f0, apparentFrequency: folded, bitRate: fs * n,
    sqnr: measureSqnr(n, { law, amplitude: level }), sqnrTheory: 6.02 * n + 1.76 + 20 * Math.log10(level),
  };
}

/** Line-code waveform as segments in bit-period units, with DC level and transition count. */
export function lineCode(bitText, code) {
  if (!LINE_CODES[code]) throw new RangeError(`Line code must be one of ${Object.keys(LINE_CODES).join(', ')}.`);
  if (!/^[01]{1,64}$/.test(bitText)) throw new SyntaxError('Enter 1 to 64 bits of 0 and 1.');
  const segments = [];
  let lastMark = -1, nrziLevel = -1;
  [...bitText].forEach((character, index) => {
    const bit = Number(character);
    const half = (first, second) => { segments.push({ start: index, end: index + 0.5, level: first }, { start: index + 0.5, end: index + 1, level: second }); };
    if (code === 'unipolar-nrz') half(bit, bit);
    else if (code === 'polar-nrz') half(bit ? 1 : -1, bit ? 1 : -1);
    else if (code === 'unipolar-rz') half(bit, 0);
    else if (code === 'polar-rz') half(bit ? 1 : -1, 0);
    else if (code === 'manchester') half(bit ? -1 : 1, bit ? 1 : -1);
    else if (code === 'ami') { if (bit) lastMark = -lastMark; half(bit ? lastMark : 0, bit ? lastMark : 0); }
    else { if (bit) nrziLevel = -nrziLevel; half(nrziLevel, nrziLevel); }
  });
  const merged = segments.reduce((list, segment) => { const previous = list.at(-1); if (previous && previous.level === segment.level) previous.end = segment.end; else list.push({ ...segment }); return list; }, []);
  const average = segments.reduce((sum, segment) => sum + segment.level * (segment.end - segment.start), 0) / bitText.length;
  return { kind: 'line-code', code, name: LINE_CODES[code], bits: bitText, segments: merged, dcLevel: average, transitions: merged.length - 1 };
}
