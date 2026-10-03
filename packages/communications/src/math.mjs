// Shared numerical helpers for the communication labs.

/** Complementary error function (Numerical Recipes erfcc; fractional error < 1.2e-7 everywhere). */
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const result = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? result : 2 - result;
}

/** Gaussian tail probability Q(x) = P(N(0,1) > x). */
export const qFunction = (x) => 0.5 * erfc(x / Math.SQRT2);

/** Deterministic uniform and Gaussian generators so experiments are reproducible. */
export function createRandom(seed = 1) {
  let state = (Math.trunc(seed) >>> 0) || 1;
  let spare = null;
  const uniform = () => { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return (state + 0.5) / 4294967296; };
  const gaussian = () => {
    if (spare !== null) { const value = spare; spare = null; return value; }
    const radius = Math.sqrt(-2 * Math.log(uniform())), angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
  return { uniform, gaussian, bit: () => (uniform() < 0.5 ? 0 : 1) };
}

/** In-place iterative radix-2 FFT. Lengths must be powers of two. */
export function fftInPlace(re, im) {
  const n = re.length;
  if (n & (n - 1)) throw new RangeError('FFT length must be a power of two.');
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const wr = Math.cos(angle * k), wi = Math.sin(angle * k);
        const a = start + k, b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}

// Flat-top window (SRS coefficients): scalloping loss below 0.02 dB, so line amplitudes
// read correctly even when a tone falls between FFT bins.
const FLAT_TOP = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];

/** Single-sided amplitude spectrum; a sinusoid of amplitude A shows a peak of A. */
export function amplitudeSpectrum(samples, sampleRate) {
  const n = 2 ** Math.floor(Math.log2(samples.length));
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let index = 0; index < n; index += 1) {
    const phase = 2 * Math.PI * index / (n - 1);
    re[index] = samples[index] * FLAT_TOP.reduce((sum, coefficient, k) => sum + (k % 2 ? -1 : 1) * coefficient * Math.cos(k * phase), 0);
  }
  fftInPlace(re, im);
  const half = n / 2;
  return {
    frequency: Array.from({ length: half }, (_, index) => index * sampleRate / n),
    amplitude: Array.from({ length: half }, (_, index) => Math.hypot(re[index], im[index]) * (index ? 2 : 1) / (n * FLAT_TOP[0])),
  };
}

/** Analytic signal s + j·H{s} via the FFT (zero the negative frequencies, double the positive). */
export function analyticSignal(samples) {
  const n = samples.length;
  if (n & (n - 1)) throw new RangeError('Analytic signal length must be a power of two.');
  const re = Float64Array.from(samples), im = new Float64Array(n);
  fftInPlace(re, im);
  for (let index = 1; index < n / 2; index += 1) { re[index] *= 2; im[index] *= 2; }
  for (let index = n / 2 + 1; index < n; index += 1) { re[index] = 0; im[index] = 0; }
  // Inverse FFT through conjugation.
  for (let index = 0; index < n; index += 1) im[index] = -im[index];
  fftInPlace(re, im);
  return { re: Array.from(re, (value) => value / n), im: Array.from(im, (value) => -value / n) };
}

/** Bessel function of the first kind J_n(x) by its power series (accurate for the x used in FM labs). */
export function besselJ(order, x) {
  let term = (x / 2) ** order;
  for (let k = 1; k <= order; k += 1) term /= k;
  let sum = term;
  for (let k = 1; k < 200; k += 1) {
    term *= -((x / 2) ** 2) / (k * (k + order));
    sum += term;
    if (Math.abs(term) < 1e-16 * Math.max(1, Math.abs(sum))) break;
  }
  return sum;
}

export function boundedNumber(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  return number;
}
