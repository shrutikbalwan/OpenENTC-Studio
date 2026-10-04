// Numerical kernels: signals, windows, FFT, convolution, resampling, polynomials, complex
// arithmetic and digital filter design (Butterworth, Chebyshev I, windowed-sinc FIR).
export * from './polynomial.mjs';
export * from './filters.mjs';

const MAX_SAMPLES = 1_000_000;
const MAX_FFT_SAMPLES = 4096;
export const MAX_N2_OPERATIONS = 25_000_000;

function finite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be finite.`);
  return value;
}

export function createSignal(samples, { sampleRate, units = '1', start = 0 } = {}) {
  if (!Array.isArray(samples) && !ArrayBuffer.isView(samples)) throw new TypeError('Signal samples must be an array.');
  if (samples.length < 1 || samples.length > MAX_SAMPLES) throw new RangeError('Signal sample count is outside the allowed range.');
  finite(sampleRate, 'sampleRate');
  if (sampleRate <= 0) throw new RangeError('sampleRate must be positive.');
  if (typeof units !== 'string' || !units.trim()) throw new TypeError('Signal units are required.');
  finite(start, 'start');
  const data = Float64Array.from(samples, (value) => finite(value, 'sample'));
  return Object.freeze({ kind: 'time-series', data, sampleRate, units, start });
}

export function generateSine({ frequency, amplitude = 1, phase = 0, offset = 0, sampleRate, length }) {
  for (const [name, value] of [['frequency', frequency], ['amplitude', amplitude], ['phase', phase], ['offset', offset]]) finite(value, name);
  finite(sampleRate, 'sampleRate');
  if (sampleRate <= 0 || !Number.isInteger(length) || length < 1 || length > MAX_SAMPLES) throw new RangeError('Invalid sine sampling parameters.');
  return createSignal(Array.from({ length }, (_, index) => offset + amplitude * Math.sin(2 * Math.PI * frequency * index / sampleRate + phase)), { sampleRate, units: '1' });
}

export function seededNoise(length, { seed = 1, amplitude = 1, sampleRate = 1, units = '1' } = {}) {
  if (!Number.isInteger(length) || length < 1 || length > MAX_SAMPLES) throw new RangeError('Invalid noise length.');
  finite(seed, 'seed');
  finite(amplitude, 'amplitude');
  let state = (Math.trunc(seed) >>> 0) || 1;
  const samples = Array.from({ length }, () => { state = (1664525 * state + 1013904223) >>> 0; return ((state / 0x100000000) * 2 - 1) * amplitude; });
  return createSignal(samples, { sampleRate, units });
}

export function convolve(input, kernel) {
  const a = input.data || input;
  const b = kernel.data || kernel;
  if ((!Array.isArray(a) && !ArrayBuffer.isView(a)) || (!Array.isArray(b) && !ArrayBuffer.isView(b)) || !a.length || !b.length) throw new TypeError('Convolution inputs must be non-empty arrays.');
  if (a.length + b.length - 1 > MAX_SAMPLES) throw new RangeError('Convolution output exceeds the sample limit.');
  if (a.length * b.length > MAX_N2_OPERATIONS) throw new RangeError('Convolution workload exceeds the computation limit.');
  const result = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) result[i + j] += finite(a[i], 'sample') * finite(b[j], 'sample');
  return input.kind === 'time-series' ? createSignal(result, { sampleRate: input.sampleRate, units: input.units, start: input.start }) : result;
}

export function filterFir(signal, coefficients) {
  const data = signal?.data || signal;
  if ((!Array.isArray(data) && !ArrayBuffer.isView(data)) || !data.length || data.length > MAX_SAMPLES) throw new TypeError('FIR input must be a non-empty bounded signal.');
  if ((!Array.isArray(coefficients) && !ArrayBuffer.isView(coefficients)) || !coefficients.length || coefficients.length > 4096) throw new RangeError('FIR coefficients are empty or exceed the limit.');
  if (data.length * coefficients.length > MAX_N2_OPERATIONS) throw new RangeError('FIR workload exceeds the computation limit.');
  const output = new Float64Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    for (let tap = 0; tap < coefficients.length && tap <= index; tap += 1) output[index] += finite(data[index - tap], 'sample') * finite(coefficients[tap], 'coefficient');
  }
  return signal?.kind === 'time-series' ? createSignal(output, { sampleRate: signal.sampleRate, units: signal.units, start: signal.start }) : output;
}

export function applyWindow(signal, { window = 'hann' } = {}) {
  const data = signal.data || signal;
  if (!['hann', 'hamming', 'rectangular'].includes(window)) throw new TypeError('Window must be hann, hamming, or rectangular.');
  if (!data?.length || data.length > MAX_SAMPLES) throw new TypeError('Window input must be a non-empty bounded signal.');
  const denominator = Math.max(1, data.length - 1);
  const output = Float64Array.from(data, (value, index) => {
    finite(value, 'sample');
    if (window === 'rectangular') return value;
    const coefficient = window === 'hann' ? 0.5 - 0.5 * Math.cos(2 * Math.PI * index / denominator) : 0.54 - 0.46 * Math.cos(2 * Math.PI * index / denominator);
    return value * coefficient;
  });
  return signal.kind === 'time-series' ? createSignal(output, { sampleRate: signal.sampleRate, units: signal.units, start: signal.start }) : output;
}

export function correlate(input, reference) {
  const first = input.data || input; const second = reference.data || reference;
  if (!first?.length || !second?.length || first.length + second.length - 1 > MAX_SAMPLES) throw new RangeError('Correlation inputs are empty or exceed the sample limit.');
  if (first.length * second.length > MAX_N2_OPERATIONS) throw new RangeError('Correlation workload exceeds the computation limit.');
  const output = new Float64Array(first.length + second.length - 1);
  let offset = 0;
  for (let lag = -(second.length - 1); lag < first.length; lag += 1, offset += 1) for (let index = 0; index < first.length; index += 1) {
    const referenceIndex = index - lag;
    if (referenceIndex >= 0 && referenceIndex < second.length) output[offset] += finite(first[index], 'sample') * finite(second[referenceIndex], 'sample');
  }
  return Object.freeze({ kind: 'correlation', data: output, lagStart: -(second.length - 1), sampleRate: input.sampleRate || 1, units: input.units || '1' });
}

export function resample(signal, targetSampleRate) {
  const data = signal.data || signal;
  if (!data?.length || data.length > MAX_SAMPLES) throw new TypeError('Resample input must be a non-empty bounded signal.');
  finite(targetSampleRate, 'targetSampleRate');
  const sourceSampleRate = finite(signal.sampleRate || 1, 'sampleRate');
  if (sourceSampleRate <= 0 || targetSampleRate <= 0) throw new RangeError('Sample rates must be positive.');
  const outputLength = Math.max(1, Math.round(data.length * targetSampleRate / sourceSampleRate));
  if (outputLength > MAX_SAMPLES) throw new RangeError('Resample output exceeds the sample limit.');
  const output = new Float64Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * sourceSampleRate / targetSampleRate;
    const left = Math.min(data.length - 1, Math.floor(position)); const right = Math.min(data.length - 1, left + 1); const fraction = position - left;
    output[index] = finite(data[left], 'sample') + (finite(data[right], 'sample') - finite(data[left], 'sample')) * fraction;
  }
  return signal.kind === 'time-series' ? createSignal(output, { sampleRate: targetSampleRate, units: signal.units, start: signal.start }) : output;
}

// Iterative radix-2 Cooley-Tukey FFT (O(n log n)) for power-of-two lengths.
function radix2(samples) {
  const n = samples.length;
  const real = Float64Array.from(samples); const imaginary = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const swap = real[i]; real[i] = real[j]; real[j] = swap; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1; const step = -2 * Math.PI / size;
    for (let k = 0; k < half; k += 1) {
      const wr = Math.cos(step * k); const wi = Math.sin(step * k);
      for (let start = 0; start < n; start += size) {
        const a = start + k; const b = a + half;
        const tr = wr * real[b] - wi * imaginary[b]; const ti = wr * imaginary[b] + wi * real[b];
        real[b] = real[a] - tr; imaginary[b] = imaginary[a] - ti;
        real[a] += tr; imaginary[a] += ti;
      }
    }
  }
  return { real, imaginary };
}

// Direct DFT for other lengths, with one table of twiddle factors instead of a cos/sin per term.
function tableDft(samples) {
  const n = samples.length;
  const cos = Float64Array.from({ length: n }, (_, m) => Math.cos(-2 * Math.PI * m / n));
  const sin = Float64Array.from({ length: n }, (_, m) => Math.sin(-2 * Math.PI * m / n));
  const real = new Float64Array(n); const imaginary = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    let re = 0; let im = 0;
    for (let j = 0, m = 0; j < n; j += 1, m = (m + k) % n) { re += samples[j] * cos[m]; im += samples[j] * sin[m]; }
    real[k] = re; imaginary[k] = im;
  }
  return { real, imaginary };
}

export function fft(signal) {
  const data = signal.data || signal;
  if (!Array.isArray(data) && !ArrayBuffer.isView(data)) throw new TypeError('FFT input must be a signal or array.');
  if (!data.length || data.length > MAX_FFT_SAMPLES) throw new RangeError(`FFT supports 1-${MAX_FFT_SAMPLES} samples.`);
  const n = data.length;
  const samples = Float64Array.from(data, (value) => finite(value, 'sample'));
  const { real, imaginary } = (n & (n - 1)) === 0 ? radix2(samples) : tableDft(samples);
  return Object.freeze({ kind: 'spectrum', real, imaginary, frequencies: Float64Array.from({ length: data.length }, (_, index) => index * ((signal.sampleRate || 1) / data.length)), sampleRate: signal.sampleRate || 1, units: signal.units || '1' });
}
