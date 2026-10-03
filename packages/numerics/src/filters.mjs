// Digital filter design and analysis, following scipy.signal conventions:
// IIR via analog prototype → frequency transform → bilinear transform (with prewarping),
// FIR via the windowed-sinc method (firwin).
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csqrt, csub, polyFromRoots, polyRoots, polyval } from './polynomial.mjs';

export const FILTER_TYPES = Object.freeze(['lowpass', 'highpass', 'bandpass', 'bandstop']);
export const FIR_WINDOWS = Object.freeze(['rectangular', 'hann', 'hamming', 'blackman', 'kaiser']);
const prod = (values) => values.reduce((total, value) => cmul(total, value), complex(1));

function bounded(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  return number;
}

function analogPrototype(family, order, rippleDb) {
  const m = Array.from({ length: order }, (_, i) => -order + 1 + 2 * i);
  if (family === 'butterworth') return { zeros: [], poles: m.map((value) => cscale(cexp(complex(0, Math.PI * value / (2 * order))), -1)), gain: 1 };
  const epsilon = Math.sqrt(10 ** (rippleDb / 10) - 1);
  const mu = Math.asinh(1 / epsilon) / order;
  // p = −sinh(μ + jθ) with θ = πm / 2N
  const poles = m.map((value) => { const theta = Math.PI * value / (2 * order); return complex(-Math.sinh(mu) * Math.cos(theta), -Math.cosh(mu) * Math.sin(theta)); });
  let gain = prod(poles.map((pole) => cscale(pole, -1))).re;
  if (order % 2 === 0) gain /= Math.sqrt(1 + epsilon * epsilon);
  return { zeros: [], poles, gain };
}

function transform({ zeros, poles, gain }, type, [w1, w2]) {
  const degree = poles.length - zeros.length;
  if (type === 'lowpass') return { zeros: zeros.map((z) => cscale(z, w1)), poles: poles.map((p) => cscale(p, w1)), gain: gain * w1 ** degree };
  if (type === 'highpass') {
    const k = gain * cdiv(prod(zeros.map((z) => cscale(z, -1))), prod(poles.map((p) => cscale(p, -1)))).re;
    return { zeros: [...zeros.map((z) => cdiv(complex(w1), z)), ...new Array(degree).fill(complex(0))], poles: poles.map((p) => cdiv(complex(w1), p)), gain: k };
  }
  const bw = w2 - w1, wo = Math.sqrt(w1 * w2);
  const split = (root) => { const half = cscale(root, bw / 2); const radical = csqrt(csub(cmul(half, half), complex(wo * wo))); return [cadd(half, radical), csub(half, radical)]; };
  if (type === 'bandpass') return { zeros: [...zeros.flatMap(split), ...new Array(degree).fill(complex(0))], poles: poles.flatMap(split), gain: gain * bw ** degree };
  // bandstop
  const k = gain * cdiv(prod(zeros.map((z) => cscale(z, -1))), prod(poles.map((p) => cscale(p, -1)))).re;
  const invert = (root) => { const half = cdiv(complex(bw / 2), root); const radical = csqrt(csub(cmul(half, half), complex(wo * wo))); return [cadd(half, radical), csub(half, radical)]; };
  return { zeros: [...zeros.flatMap(invert), ...Array.from({ length: degree }, () => [complex(0, wo), complex(0, -wo)]).flat()], poles: poles.flatMap(invert), gain: k };
}

function bilinear({ zeros, poles, gain }, fs) {
  const fs2 = complex(2 * fs);
  const degree = poles.length - zeros.length;
  return {
    zeros: [...zeros.map((z) => cdiv(cadd(fs2, z), csub(fs2, z))), ...new Array(degree).fill(complex(-1))],
    poles: poles.map((p) => cdiv(cadd(fs2, p), csub(fs2, p))),
    gain: gain * cdiv(prod(zeros.map((z) => csub(fs2, z))), prod(poles.map((p) => csub(fs2, p)))).re,
  };
}

function cutoffs(type, cutoff, sampleRate) {
  const list = Array.isArray(cutoff) ? cutoff.map(Number) : [Number(cutoff)];
  const needed = type === 'bandpass' || type === 'bandstop' ? 2 : 1;
  if (list.length !== needed) throw new RangeError(`${type} needs ${needed} cutoff frequenc${needed === 1 ? 'y' : 'ies'}.`);
  list.forEach((value) => bounded(value, sampleRate * 1e-6, sampleRate / 2 * (1 - 1e-9), 'Cutoff frequency (below Nyquist)'));
  if (needed === 2 && !(list[0] < list[1])) throw new RangeError('The lower cutoff must be below the upper cutoff.');
  return list;
}

/**
 * IIR design. family: 'butterworth' | 'chebyshev1'. cutoff in Hz (array for band filters);
 * for Chebyshev I the cutoff is the passband edge where the gain is −rippleDb.
 */
export function designIir({ family = 'butterworth', type = 'lowpass', order = 4, cutoff = 1000, sampleRate = 8000, rippleDb = 1 } = {}) {
  if (!['butterworth', 'chebyshev1'].includes(family)) throw new RangeError('Family must be butterworth or chebyshev1.');
  if (!FILTER_TYPES.includes(type)) throw new RangeError(`Type must be one of ${FILTER_TYPES.join(', ')}.`);
  const n = Math.trunc(bounded(order, 1, 12, 'Order'));
  const fs = bounded(sampleRate, 1, 1e9, 'Sample rate');
  const edges = cutoffs(type, cutoff, fs);
  const ripple = family === 'chebyshev1' ? bounded(rippleDb, 0.01, 10, 'Passband ripple (dB)') : 0;
  const warped = edges.map((f) => 2 * fs * Math.tan(Math.PI * f / fs));
  const digital = bilinear(transform(analogPrototype(family, n, ripple), type, warped), fs);
  const b = polyFromRoots(digital.zeros).map((c) => c * digital.gain);
  const a = polyFromRoots(digital.poles);
  return { kind: 'iir', family, type, order: n, sampleRate: fs, cutoff: edges, rippleDb: ripple, b, a, zeros: digital.zeros, poles: digital.poles, gain: digital.gain, stable: digital.poles.every((pole) => cabs(pole) < 1) };
}

function besselI0(x) { let sum = 1, term = 1; for (let k = 1; k < 60; k += 1) { term *= (x / (2 * k)) ** 2; sum += term; if (term < 1e-17 * sum) break; } return sum; }

/** Symmetric window of length n (scipy get_window(..., fftbins=False)). */
export function firWindow(name, n, beta = 8.6) {
  if (!FIR_WINDOWS.includes(name)) throw new RangeError(`Window must be one of ${FIR_WINDOWS.join(', ')}.`);
  if (n === 1) return [1];
  return Array.from({ length: n }, (_, i) => {
    const x = 2 * Math.PI * i / (n - 1);
    if (name === 'rectangular') return 1;
    if (name === 'hann') return 0.5 - 0.5 * Math.cos(x);
    if (name === 'hamming') return 0.54 - 0.46 * Math.cos(x);
    if (name === 'blackman') return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
    const ratio = 2 * i / (n - 1) - 1;
    return besselI0(beta * Math.sqrt(1 - ratio * ratio)) / besselI0(beta);
  });
}

const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

/** Windowed-sinc FIR (scipy firwin): unity gain at DC, Nyquist or the passband centre. */
export function designFir({ type = 'lowpass', taps = 31, cutoff = 1000, sampleRate = 8000, window = 'hamming', beta = 8.6 } = {}) {
  if (!FILTER_TYPES.includes(type)) throw new RangeError(`Type must be one of ${FILTER_TYPES.join(', ')}.`);
  const n = Math.trunc(bounded(taps, 3, 513, 'Number of taps'));
  if ((type === 'highpass' || type === 'bandstop') && n % 2 === 0) throw new RangeError('High-pass and band-stop FIR filters need an odd number of taps.');
  const fs = bounded(sampleRate, 1, 1e9, 'Sample rate');
  const edges = cutoffs(type, cutoff, fs).map((f) => f / (fs / 2));
  const bands = type === 'lowpass' ? [[0, edges[0]]] : type === 'highpass' ? [[edges[0], 1]] : type === 'bandpass' ? [[edges[0], edges[1]]] : [[0, edges[0]], [edges[1], 1]];
  const alpha = (n - 1) / 2;
  const w = firWindow(window, n, Number(beta));
  const h = Array.from({ length: n }, (_, i) => {
    const m = i - alpha;
    return w[i] * bands.reduce((sum, [left, right]) => sum + right * sinc(right * m) - (left ? left * sinc(left * m) : 0), 0);
  });
  const [left, right] = bands[0];
  const scaleFrequency = left === 0 ? 0 : right === 1 ? 1 : (left + right) / 2;
  const scale = h.reduce((sum, value, i) => sum + value * Math.cos(Math.PI * (i - alpha) * scaleFrequency), 0);
  const b = h.map((value) => value / scale);
  return { kind: 'fir', type, taps: n, sampleRate: fs, cutoff: edges.map((value) => value * fs / 2), window, b, a: [1], linearPhase: true, delay: alpha };
}

/** H(e^jω) on `points` frequencies from 0 to Nyquist: magnitude, dB, unwrapped phase and group delay. */
export function frequencyResponseDigital(b, a, sampleRate, points = 512) {
  const frequency = Array.from({ length: points }, (_, k) => k * sampleRate / 2 / (points - 1));
  const response = frequency.map((f) => {
    const z = cexp(complex(0, 2 * Math.PI * f / sampleRate));
    // Evaluate in z^-1: B(z)/A(z) = Σ b_k z^-k / Σ a_k z^-k
    const zInverse = cdiv(complex(1), z);
    return cdiv(polyval([...b].reverse(), zInverse), polyval([...a].reverse(), zInverse));
  });
  const magnitude = response.map(cabs);
  const phase = [];
  response.forEach((value, k) => { let angle = Math.atan2(value.im, value.re); if (k) { while (angle - phase[k - 1] > Math.PI) angle -= 2 * Math.PI; while (angle - phase[k - 1] < -Math.PI) angle += 2 * Math.PI; } phase.push(angle); });
  const groupDelay = phase.map((_, k) => { const lo = Math.max(0, k - 1), hi = Math.min(points - 1, k + 1); return -(phase[hi] - phase[lo]) / (2 * Math.PI * (frequency[hi] - frequency[lo]) / sampleRate); });
  return { frequency, magnitude, decibels: magnitude.map((value) => 20 * Math.log10(Math.max(value, 1e-12))), phase, groupDelay };
}

/** Direct-form II transposed filtering (scipy lfilter). */
export function lfilter(b, a, input) {
  if (!a.length || a[0] === 0) throw new RangeError('a[0] must be non-zero.');
  const n = Math.max(a.length, b.length);
  const bn = [...b, ...new Array(n - b.length).fill(0)].map((value) => value / a[0]);
  const an = [...a, ...new Array(n - a.length).fill(0)].map((value) => value / a[0]);
  const state = new Array(n).fill(0);
  return Array.from(input, (x) => {
    const y = bn[0] * x + state[0];
    for (let k = 1; k < n; k += 1) state[k - 1] = bn[k] * x + state[k] - an[k] * y;
    return y;
  });
}

/** Impulse response h[n] for the first `length` samples. */
export const impulseResponse = (b, a, length = 64) => lfilter(b, a, Array.from({ length }, (_, n) => (n === 0 ? 1 : 0)));

/** Poles and zeros of any b/a (in z) for the pole-zero plot. */
export function poleZero(filter) {
  if (filter.zeros && filter.poles) return { zeros: filter.zeros, poles: filter.poles };
  const pad = (coefficients, length) => [...coefficients, ...new Array(length - coefficients.length).fill(0)];
  const length = Math.max(filter.b.length, filter.a.length);
  return { zeros: polyRoots(pad(filter.b, length)), poles: polyRoots(pad(filter.a, length)) };
}

/** Linear convolution y = x * h with per-output terms for a step-by-step view. */
export function convolutionSteps(x, h) {
  const xs = x.map(Number), hs = h.map(Number);
  if (!xs.length || !hs.length || xs.length > 64 || hs.length > 64 || [...xs, ...hs].some((value) => !Number.isFinite(value))) throw new RangeError('Enter 1 to 64 finite numbers for each sequence.');
  return Array.from({ length: xs.length + hs.length - 1 }, (_, n) => {
    const terms = [];
    for (let k = 0; k < xs.length; k += 1) if (n - k >= 0 && n - k < hs.length) terms.push({ k, x: xs[k], h: hs[n - k], product: xs[k] * hs[n - k] });
    return { n, terms, value: terms.reduce((sum, term) => sum + term.product, 0) };
  });
}
