// Speech processing: source–filter vowel synthesis, short-time energy and zero-crossing rate,
// pitch (autocorrelation, AMDF, cepstrum), LPC by Levinson–Durbin with formants from the roots,
// the real cepstrum, spectrogram and MFCCs (python_speech_features conventions).

const TWO_PI = 2 * Math.PI;

// ---------------------------------------------------------------------------
// FFT helpers.

export function fft(re, im, inverse = false) {
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
    const wr0 = Math.cos(angle), wi0 = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const a = start + k, b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
}
const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** Power spectrum |X(k)|² for k = 0 … N/2 of a real frame zero-padded to nfft. */
export function powerSpectrum(frame, nfft = nextPow2(frame.length)) {
  const re = new Array(nfft).fill(0), im = new Array(nfft).fill(0);
  for (let k = 0; k < Math.min(frame.length, nfft); k += 1) re[k] = frame[k];
  fft(re, im);
  return Array.from({ length: nfft / 2 + 1 }, (_, k) => re[k] * re[k] + im[k] * im[k]);
}

export const hamming = (n) => Array.from({ length: n }, (_, k) => 0.54 - 0.46 * Math.cos(TWO_PI * k / (n - 1)));

// ---------------------------------------------------------------------------
// Synthesis.

/**
 * Source–filter vowel: an impulse train at f0 (with optional jitter-free vibrato off) through a
 * cascade of two-pole resonators at the formant frequencies and bandwidths (Klatt cascade).
 */
export function synthesizeVowel({ f0 = 120, formants = [[730, 90], [1090, 110], [2440, 170]], fs = 8000, duration = 0.5, noise = 0, seed = 1 } = {}) {
  const n = Math.round(fs * duration);
  let state = seed >>> 0 || 1;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 - 0.5; };
  let x = Array.from({ length: n }, (_, k) => (f0 > 0 ? (Math.floor(k * f0 / fs) !== Math.floor((k - 1) * f0 / fs) ? 1 : 0) : random()));
  for (const [f, bw] of formants) {
    const r = Math.exp(-Math.PI * bw / fs), theta = TWO_PI * f / fs;
    const a1 = 2 * r * Math.cos(theta), a2 = -r * r, gain = 1 - a1 - a2;
    const y = new Array(n).fill(0);
    for (let k = 0; k < n; k += 1) y[k] = gain * x[k] + a1 * (y[k - 1] ?? 0) + a2 * (y[k - 2] ?? 0);
    x = y;
  }
  const peak = Math.max(...x.map(Math.abs)) || 1;
  return x.map((v) => v / peak + noise * random());
}

/** Unvoiced fricative-like noise (high-passed white noise). */
export function synthesizeNoise({ fs = 8000, duration = 0.2, seed = 2 } = {}) {
  let state = seed >>> 0 || 1;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 - 0.5; };
  const w = Array.from({ length: Math.round(fs * duration) }, random);
  return w.map((v, k) => 0.6 * (v - (w[k - 1] ?? 0)));
}

// ---------------------------------------------------------------------------
// Short-time analysis.

/** Split into frames of `length` samples every `step` samples (last partial frame dropped). */
export function frames(signal, length, step) {
  const out = [];
  for (let start = 0; start + length <= signal.length; start += step) out.push(signal.slice(start, start + length));
  return out;
}

/** Short-time energy, zero-crossing rate (crossings per sample) and a voiced/unvoiced/silence label per frame. */
export function shortTimeFeatures(signal, { fs = 8000, frameMs = 25, stepMs = 10 } = {}) {
  const length = Math.round(fs * frameMs / 1000), step = Math.round(fs * stepMs / 1000);
  const list = frames(signal, length, step);
  const energy = list.map((f) => f.reduce((sum, v) => sum + v * v, 0) / f.length);
  const zcr = list.map((f) => { let z = 0; for (let k = 1; k < f.length; k += 1) if ((f[k] >= 0) !== (f[k - 1] >= 0)) z += 1; return z / (f.length - 1); });
  const peak = Math.max(...energy, 1e-12);
  const label = energy.map((e, k) => (e < 0.02 * peak ? 'silence' : zcr[k] > 0.25 ? 'unvoiced' : 'voiced'));
  return { times: list.map((_, k) => (k * step + length / 2) / fs), energy, zcr, label, length, step };
}

/** Pitch by autocorrelation (with centre clipping) over lags fs/fMax … fs/fMin. */
export function pitchAutocorrelation(frame, { fs = 8000, fMin = 60, fMax = 400, clip = 0.3 } = {}) {
  const peak = Math.max(...frame.map(Math.abs)) || 1, cl = clip * peak;
  const x = frame.map((v) => (v > cl ? v - cl : v < -cl ? v + cl : 0));
  const r0 = x.reduce((s, v) => s + v * v, 0) || 1e-30;
  const lo = Math.floor(fs / fMax), hi = Math.min(x.length - 1, Math.ceil(fs / fMin));
  const r = [];
  let best = lo, bestValue = -Infinity;
  for (let lag = 0; lag <= hi; lag += 1) {
    let s = 0;
    for (let k = 0; k + lag < x.length; k += 1) s += x[k] * x[k + lag];
    r.push(s / r0);
    if (lag >= lo && s > bestValue) { bestValue = s; best = lag; }
  }
  // Parabolic interpolation around the peak.
  const y0 = r[best - 1] ?? r[best], y1 = r[best], y2 = r[best + 1] ?? r[best];
  const shift = (y0 - 2 * y1 + y2) !== 0 ? 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) : 0;
  const lag = best + shift;
  return { f0: fs / lag, lag, strength: bestValue / r0, autocorrelation: r };
}

/** Pitch by the average magnitude difference function (deepest valley, with an octave-error check). */
export function pitchAmdf(frame, { fs = 8000, fMin = 60, fMax = 400 } = {}) {
  const lo = Math.floor(fs / fMax), hi = Math.min(frame.length - 2, Math.ceil(fs / fMin));
  const d = [];
  let best = lo, bestValue = Infinity;
  for (let lag = 0; lag <= hi; lag += 1) {
    let s = 0;
    for (let k = 0; k + lag < frame.length; k += 1) s += Math.abs(frame[k] - frame[k + lag]);
    const v = s / (frame.length - lag);
    d.push(v);
    if (lag >= lo && v < bestValue) { bestValue = v; best = lag; }
  }
  // Octave check: take the first local minimum that is almost as deep as the global one.
  const top = Math.max(...d.slice(lo)), limit = bestValue + 0.1 * (top - bestValue);
  for (let lag = lo + 1; lag < best; lag += 1) if (d[lag] <= limit && d[lag] <= d[lag - 1] && d[lag] <= d[lag + 1]) { best = lag; break; }
  return { f0: fs / best, lag: best, amdf: d };
}

/** Real cepstrum c[n] = IFFT(log|X|) of a windowed frame; pitch from the cepstral peak. */
export function cepstrum(frame, { fs = 8000, fMin = 60, fMax = 400, nfft = null, lifter = 30 } = {}) {
  const w = hamming(frame.length);
  const size = nfft ?? nextPow2(frame.length * 2);
  const re = new Array(size).fill(0), im = new Array(size).fill(0);
  frame.forEach((v, k) => { re[k] = v * w[k]; });
  fft(re, im);
  const logMag = re.map((v, k) => Math.log(Math.hypot(v, im[k]) + 1e-12));
  const cr = [...logMag], ci = new Array(size).fill(0);
  fft(cr, ci, true);
  const lo = Math.floor(fs / fMax), hi = Math.min(size / 2, Math.ceil(fs / fMin));
  let best = lo;
  for (let q = lo; q <= hi; q += 1) if (cr[q] > cr[best]) best = q;
  // Low-quefrency lifter gives the smoothed vocal-tract envelope.
  const lr = cr.map((v, q) => (q < lifter || q > size - lifter ? v : 0)), li = new Array(size).fill(0);
  fft(lr, li);
  return { cepstrum: cr.slice(0, size / 2), f0: fs / best, quefrency: best, logSpectrum: logMag.slice(0, size / 2 + 1), envelope: lr.slice(0, size / 2 + 1), nfft: size };
}

// ---------------------------------------------------------------------------
// Linear prediction.

/** Autocorrelation r[0..p] of a frame. */
export function autocorrelation(x, p) {
  return Array.from({ length: p + 1 }, (_, lag) => { let s = 0; for (let k = 0; k + lag < x.length; k += 1) s += x[k] * x[k + lag]; return s; });
}

/** Levinson–Durbin recursion: predictor a[1..p] (x̂[n] = Σ a_k x[n−k]), reflection coefficients and error. */
export function levinson(r, p) {
  if (!(r[0] > 0)) throw new RangeError('The frame has no energy.');
  let a = [1], error = r[0];
  const reflection = [];
  for (let i = 1; i <= p; i += 1) {
    let acc = r[i];
    for (let j = 1; j < i; j += 1) acc -= a[j] * r[i - j];
    const k = acc / error;
    reflection.push(k);
    const next = [...a, 0];
    next[i] = k;
    for (let j = 1; j < i; j += 1) next[j] = a[j] - k * a[i - j];
    a = next;
    error *= 1 - k * k;
  }
  return { a: a.slice(1), reflection, error };
}

/** LPC of a frame: pre-emphasis, Hamming window, autocorrelation and Levinson–Durbin. */
export function lpc(frame, order = 10, { preemphasis = 0.97 } = {}) {
  const x = frame.map((v, k) => v - preemphasis * (frame[k - 1] ?? 0));
  const w = hamming(x.length);
  const y = x.map((v, k) => v * w[k]);
  const r = autocorrelation(y, order);
  const result = levinson(r, order);
  return { ...result, r, gain: Math.sqrt(result.error) };
}

/** LPC spectral envelope in dB: 20 log(G / |A(e^jω)|), A(z) = 1 − Σ a_k z^−k. */
export function lpcSpectrum(a, gain, { fs = 8000, points = 256 } = {}) {
  const freqs = Array.from({ length: points }, (_, k) => fs / 2 * k / (points - 1));
  const db = freqs.map((f) => {
    const w = TWO_PI * f / fs;
    let re = 1, im = 0;
    a.forEach((ak, k) => { re -= ak * Math.cos(w * (k + 1)); im += ak * Math.sin(w * (k + 1)); });
    return 20 * Math.log10(gain / Math.hypot(re, im));
  });
  return { freqs, db };
}

/** Roots of a polynomial c[0]·z^n + … + c[n] (Durand–Kerner). */
export function polynomialRoots(coefficients, { iterations = 500, tolerance = 1e-12 } = {}) {
  const c = coefficients.map((v) => v / coefficients[0]);
  const n = c.length - 1;
  let roots = Array.from({ length: n }, (_, k) => ({ re: 0.9 * Math.cos(TWO_PI * k / n + 0.4), im: 0.9 * Math.sin(TWO_PI * k / n + 0.4) }));
  const evaluate = (z) => { let re = 1, im = 0; for (let k = 1; k <= n; k += 1) { const t = re * z.re - im * z.im + c[k]; im = re * z.im + im * z.re; re = t; } return { re, im }; };
  for (let it = 0; it < iterations; it += 1) {
    let change = 0;
    roots = roots.map((z, i) => {
      let dr = 1, di = 0;
      roots.forEach((w, j) => { if (i !== j) { const xr = z.re - w.re, xi = z.im - w.im; const t = dr * xr - di * xi; di = dr * xi + di * xr; dr = t; } });
      const p = evaluate(z);
      const d = dr * dr + di * di || 1e-300;
      const qr = (p.re * dr + p.im * di) / d, qi = (p.im * dr - p.re * di) / d;
      change = Math.max(change, Math.hypot(qr, qi));
      return { re: z.re - qr, im: z.im - qi };
    });
    if (change < tolerance) break;
  }
  return roots;
}

/** Formants from the LPC polynomial roots: frequency = angle·fs/2π, bandwidth = −ln|z|·fs/π. */
export function formants(a, { fs = 8000, maxBandwidth = 400, minFrequency = 90 } = {}) {
  const roots = polynomialRoots([1, ...a.map((v) => -v)]);
  return roots.filter((z) => z.im > 1e-6)
    .map((z) => ({ frequency: Math.atan2(z.im, z.re) * fs / TWO_PI, bandwidth: -Math.log(Math.hypot(z.re, z.im)) * fs / Math.PI }))
    .filter((f) => f.frequency > minFrequency && f.bandwidth < maxBandwidth)
    .sort((p, q) => p.frequency - q.frequency);
}

// ---------------------------------------------------------------------------
// Spectrogram and MFCC.

/** Short-time Fourier transform magnitude in dB (Hamming window). */
export function spectrogram(signal, { fs = 8000, frameMs = 25, stepMs = 10, nfft = 512 } = {}) {
  const length = Math.round(fs * frameMs / 1000), step = Math.round(fs * stepMs / 1000);
  const w = hamming(length);
  const list = frames(signal, length, step);
  const db = list.map((f) => powerSpectrum(f.map((v, k) => v * w[k]), nfft).map((p) => 10 * Math.log10(p + 1e-12)));
  return { db, times: list.map((_, k) => (k * step + length / 2) / fs), freqs: Array.from({ length: nfft / 2 + 1 }, (_, k) => k * fs / nfft) };
}

export const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
export const melToHz = (mel) => 700 * (10 ** (mel / 2595) - 1);

/** Triangular mel filterbank on FFT bins (python_speech_features get_filterbanks). */
export function melFilterbank({ filters = 26, nfft = 512, fs = 16000, lowFreq = 0, highFreq = null } = {}) {
  const high = highFreq ?? fs / 2;
  const lowMel = hzToMel(lowFreq), highMel = hzToMel(high);
  const points = Array.from({ length: filters + 2 }, (_, k) => lowMel + (highMel - lowMel) * k / (filters + 1));
  const bins = points.map((m) => Math.floor((nfft + 1) * melToHz(m) / fs));
  return Array.from({ length: filters }, (_, j) => {
    const row = new Array(nfft / 2 + 1).fill(0);
    for (let i = bins[j]; i < bins[j + 1]; i += 1) row[i] = (i - bins[j]) / (bins[j + 1] - bins[j]);
    for (let i = bins[j + 1]; i < bins[j + 2]; i += 1) row[i] = (bins[j + 2] - i) / (bins[j + 2] - bins[j + 1]);
    return row;
  });
}

const roundHalfUp = (x) => Math.floor(x + 0.5);

/** MFCCs exactly as python_speech_features.mfcc (rectangular window, power spectrum / nfft, log, DCT-II ortho, lifter, log energy in c0). */
export function mfcc(signal, { fs = 16000, winlen = 0.025, winstep = 0.01, numcep = 13, nfilt = 26, nfft = 512, lowFreq = 0, highFreq = null, preemph = 0.97, ceplifter = 22, appendEnergy = true } = {}) {
  const x = signal.map((v, k) => (k === 0 ? v : v - preemph * signal[k - 1]));
  const frameLen = roundHalfUp(winlen * fs), step = roundHalfUp(winstep * fs);
  const count = x.length <= frameLen ? 1 : 1 + Math.ceil((x.length - frameLen) / step);
  const padded = [...x, ...new Array(Math.max(0, (count - 1) * step + frameLen - x.length)).fill(0)];
  const bank = melFilterbank({ filters: nfilt, nfft, fs, lowFreq, highFreq });
  const eps = 2.220446049250313e-16;
  const lift = Array.from({ length: numcep }, (_, n) => (ceplifter > 0 ? 1 + (ceplifter / 2) * Math.sin(Math.PI * n / ceplifter) : 1));
  const features = [];
  for (let f = 0; f < count; f += 1) {
    const frame = padded.slice(f * step, f * step + frameLen);
    const pspec = powerSpectrum(frame.length > nfft ? frame.slice(0, nfft) : frame, nfft).map((p) => p / nfft);
    const energy = pspec.reduce((a, b) => a + b, 0) || eps;
    const logBank = bank.map((row) => Math.log(row.reduce((s, w, i) => s + w * pspec[i], 0) || eps));
    // DCT-II with orthonormal scaling.
    const coeffs = Array.from({ length: numcep }, (_, k) => {
      let s = 0;
      for (let n = 0; n < nfilt; n += 1) s += logBank[n] * Math.cos(Math.PI * k * (2 * n + 1) / (2 * nfilt));
      return s * (k === 0 ? Math.sqrt(1 / (4 * nfilt)) : Math.sqrt(1 / (2 * nfilt))) * 2;
    }).map((v, k) => v * lift[k]);
    if (appendEnergy) coeffs[0] = Math.log(energy);
    features.push(coeffs);
  }
  return features;
}
