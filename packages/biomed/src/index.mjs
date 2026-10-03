// Biomedical signal processing: synthetic ECG (Gaussian P-QRS-T waves with heart-rate
// variability, ectopic beats, baseline wander, mains hum and muscle noise), zero-phase
// cleaning filters, the Pan–Tompkins QRS detector, heart-rate variability (time domain,
// Poincaré, LF/HF), and synthetic EEG with Welch band powers.

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gaussianSource(seed) { const random = mulberry32(seed); return () => { let u = 0; while (u === 0) u = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random()); }; }

// ---------------------------------------------------------------------------
// ECG synthesis.

// Wave: [offset from R in seconds at 60 bpm, amplitude mV, width s].
const ECG_WAVES = [['P', -0.2, 0.15, 0.025], ['Q', -0.025, -0.12, 0.01], ['R', 0, 1.2, 0.011], ['S', 0.03, -0.25, 0.012], ['T', 0.3, 0.32, 0.055]];

/**
 * Synthetic ECG lead with known R-peak times. Wave timing scales with √RR (Bazett), the RR series
 * has Gaussian variability plus respiratory sinus arrhythmia, and every `pvcEvery`-th beat can be a
 * premature ventricular contraction (early, wide, no P wave, compensatory pause).
 */
export function synthesizeEcg({ duration = 20, sampleRate = 360, heartRate = 72, hrvStd = 0.03, respiration = 0.25, rsa = 0.04, pvcEvery = 0, baseline = 0.3, mains = 0.05, mainsFrequency = 50, emg = 0.02, seed = 1 } = {}) {
  const n = Math.round(duration * sampleRate), g = gaussianSource(seed), signal = new Float64Array(n), clean = new Float64Array(n);
  const meanRr = 60 / heartRate, beats = [];
  let t = 0.4 + meanRr / 2, index = 0;
  while (t < duration - 0.4) {
    index += 1;
    const pvc = pvcEvery > 0 && index % pvcEvery === 0;
    beats.push({ time: t, pvc });
    const rr = meanRr * (1 + hrvStd * g() + rsa * Math.sin(2 * Math.PI * respiration * t));
    t += pvc ? rr * 1.35 : rr; // compensatory pause after an ectopic beat
    if (pvcEvery > 0 && (index + 1) % pvcEvery === 0) t -= rr * 0.35; // next beat comes early
  }
  for (const beat of beats) {
    const scale = Math.sqrt(meanRr);
    const waves = beat.pvc ? [['Q', -0.04, -0.3, 0.03], ['R', 0, 1.6, 0.035], ['S', 0.07, -0.6, 0.04], ['T', 0.32, -0.45, 0.08]] : ECG_WAVES;
    for (const [, offset, amplitude, width] of waves) {
      const centre = beat.time + offset * scale, w = width * (beat.pvc ? 1 : scale ** 0.3);
      const from = Math.max(0, Math.floor((centre - 5 * w) * sampleRate)), to = Math.min(n - 1, Math.ceil((centre + 5 * w) * sampleRate));
      for (let k = from; k <= to; k += 1) clean[k] += amplitude * Math.exp(-((k / sampleRate - centre) ** 2) / (2 * w * w));
    }
  }
  const phase = 2 * Math.PI * g();
  for (let k = 0; k < n; k += 1) {
    const time = k / sampleRate;
    signal[k] = clean[k] + baseline * Math.sin(2 * Math.PI * respiration * time + phase) + mains * Math.sin(2 * Math.PI * mainsFrequency * time) + emg * g();
  }
  return { sampleRate, signal, clean, beats: beats.map((b) => ({ ...b, sample: Math.round(b.time * sampleRate) })) };
}

// ---------------------------------------------------------------------------
// Filters (biquads after the RBJ cookbook) and zero-phase filtering.

export function biquad(type, frequency, sampleRate, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * frequency / sampleRate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b, a;
  if (type === 'lowpass') { b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]; a = [1 + alpha, -2 * cos, 1 - alpha]; }
  else if (type === 'highpass') { b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]; a = [1 + alpha, -2 * cos, 1 - alpha]; }
  else if (type === 'notch') { b = [1, -2 * cos, 1]; a = [1 + alpha, -2 * cos, 1 - alpha]; }
  else if (type === 'bandpass') { b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cos, 1 - alpha]; }
  else throw new RangeError(`Unknown biquad "${type}".`);
  return { b: b.map((v) => v / a[0]), a: a.map((v) => v / a[0]) };
}
export function lfilterSection({ b, a }, x) {
  const y = new Float64Array(x.length);
  for (let n = 0; n < x.length; n += 1) {
    let acc = 0;
    for (let k = 0; k < b.length; k += 1) if (n - k >= 0) acc += b[k] * x[n - k];
    for (let k = 1; k < a.length; k += 1) if (n - k >= 0) acc -= a[k] * y[n - k];
    y[n] = acc;
  }
  return y;
}
/** Forward–backward filtering (zero phase, squared magnitude), with the edges padded by reflection. */
export function filtfilt(section, x, pad = 3 * Math.max(section.b.length, section.a.length) * 20) {
  const p = Math.min(pad, x.length - 1), padded = new Float64Array(x.length + 2 * p);
  for (let k = 0; k < p; k += 1) { padded[k] = 2 * x[0] - x[p - k]; padded[padded.length - 1 - k] = 2 * x[x.length - 1] - x[x.length - 1 - (p - k)]; }
  padded.set(x, p);
  const forward = lfilterSection(section, padded), backward = lfilterSection(section, forward.reverse()).reverse();
  return backward.slice(p, p + x.length);
}
/** Cleaning chain: high-pass (baseline), notch (mains), low-pass (muscle). */
export function cleanEcg(x, sampleRate, { highpass = 0.5, notch = 50, lowpass = 40 } = {}) {
  let y = Float64Array.from(x);
  if (highpass > 0) y = filtfilt(biquad('highpass', highpass, sampleRate), y);
  if (notch > 0) y = filtfilt(biquad('notch', notch, sampleRate, 30), y);
  if (lowpass > 0 && lowpass < sampleRate / 2) y = filtfilt(biquad('lowpass', lowpass, sampleRate), y);
  return y;
}

// ---------------------------------------------------------------------------
// Pan–Tompkins.

/**
 * Pan & Tompkins (1985): 5–15 Hz band-pass, five-point derivative, squaring, 150 ms moving-window
 * integration, adaptive signal/noise thresholds on the integrated signal, a 200 ms refractory
 * period and search-back when no beat is found for 166 % of the mean RR. Peaks are then located on
 * the band-passed signal.
 */
export function panTompkins(x, sampleRate) {
  const fs = sampleRate;
  const bandpassed = filtfilt(biquad('lowpass', 15, fs), filtfilt(biquad('highpass', 5, fs), x));
  const derivative = new Float64Array(x.length);
  for (let n = 2; n < x.length - 2; n += 1) derivative[n] = (-bandpassed[n - 2] - 2 * bandpassed[n - 1] + 2 * bandpassed[n + 1] + bandpassed[n + 2]) * fs / 8;
  const squared = derivative.map((v) => v * v);
  const window = Math.max(1, Math.round(0.15 * fs)), integrated = new Float64Array(x.length);
  let running = 0;
  for (let n = 0; n < x.length; n += 1) { running += squared[n] - (n >= window ? squared[n - window] : 0); integrated[n] = running / window; }
  // Local maxima of the integrated signal, at least 200 ms apart.
  const refractory = Math.round(0.2 * fs), peaks = [];
  for (let n = 1; n < x.length - 1; n += 1) if (integrated[n] > integrated[n - 1] && integrated[n] >= integrated[n + 1]) {
    if (peaks.length && n - peaks.at(-1) < refractory) { if (integrated[n] > integrated[peaks.at(-1)]) peaks[peaks.length - 1] = n; } else peaks.push(n);
  }
  // Learning phase: first 2 s.
  const learn = integrated.slice(0, Math.min(x.length, 2 * fs));
  let spki = Math.max(...learn) / 3, npki = learn.reduce((s, v) => s + v, 0) / learn.length / 2;
  let thresholdI = npki + 0.25 * (spki - npki);
  const qrs = [], thresholds = [];
  const rrHistory = [];
  for (const peak of peaks) {
    const value = integrated[peak];
    if (value > thresholdI) {
      qrs.push(peak); spki = 0.125 * value + 0.875 * spki;
      if (qrs.length > 1) rrHistory.push(peak - qrs.at(-2));
    } else {
      npki = 0.125 * value + 0.875 * npki;
      // Search back: a long gap since the last beat — accept the largest peak above half the threshold.
      const meanRr = rrHistory.length ? rrHistory.slice(-8).reduce((s, v) => s + v, 0) / Math.min(8, rrHistory.length) : null;
      if (meanRr && qrs.length && peak - qrs.at(-1) > 1.66 * meanRr && value > thresholdI / 2) { qrs.push(peak); spki = 0.25 * value + 0.75 * spki; rrHistory.push(peak - qrs.at(-2)); }
    }
    thresholdI = npki + 0.25 * (spki - npki);
    thresholds.push({ sample: peak, threshold: thresholdI });
  }
  // The integrator lags the QRS: find the largest |band-passed| sample in the preceding 150 ms.
  const delay = Math.round(0.15 * fs);
  const rPeaks = qrs.map((q) => {
    let best = Math.max(0, q - delay);
    for (let n = Math.max(0, q - delay); n <= Math.min(x.length - 1, q); n += 1) if (Math.abs(bandpassed[n]) > Math.abs(bandpassed[best])) best = n;
    // Refine on the raw signal: largest deviation from the local mean, so negative (ectopic) QRS complexes count too.
    const lo = Math.max(0, best - Math.round(0.1 * fs)), hi = Math.min(x.length - 1, best + Math.round(0.1 * fs));
    let baseline = 0; for (let n = lo; n <= hi; n += 1) baseline += x[n]; baseline /= hi - lo + 1;
    let r = best;
    for (let n = Math.max(0, best - Math.round(0.04 * fs)); n <= Math.min(x.length - 1, best + Math.round(0.04 * fs)); n += 1) if (Math.abs(x[n] - baseline) > Math.abs(x[r] - baseline)) r = n;
    return r;
  }).filter((r, i, list) => i === 0 || r - list[i - 1] > refractory);
  return { bandpassed, derivative, squared, integrated, thresholds, rPeaks };
}

/** Sensitivity and positive predictivity of detections against reference beats (±tolerance s). */
export function scoreDetections(detected, reference, sampleRate, tolerance = 0.075) {
  const window = tolerance * sampleRate, used = new Set();
  let truePositives = 0;
  for (const r of reference) {
    const match = detected.findIndex((d, i) => !used.has(i) && Math.abs(d - r) <= window);
    if (match >= 0) { used.add(match); truePositives += 1; }
  }
  return { truePositives, falseNegatives: reference.length - truePositives, falsePositives: detected.length - truePositives, sensitivity: truePositives / Math.max(1, reference.length), ppv: truePositives / Math.max(1, detected.length) };
}

// ---------------------------------------------------------------------------
// Heart-rate variability.

export function hrv(rPeaks, sampleRate) {
  const rr = rPeaks.slice(1).map((r, i) => (r - rPeaks[i]) / sampleRate * 1000);
  if (rr.length < 2) throw new RangeError('Need at least three beats for HRV.');
  const mean = rr.reduce((s, v) => s + v, 0) / rr.length;
  const sdnn = Math.sqrt(rr.reduce((s, v) => s + (v - mean) ** 2, 0) / (rr.length - 1));
  const diffs = rr.slice(1).map((v, i) => v - rr[i]);
  const rmssd = Math.sqrt(diffs.reduce((s, v) => s + v * v, 0) / diffs.length);
  const pnn50 = diffs.filter((d) => Math.abs(d) > 50).length / diffs.length;
  const sdsd = Math.sqrt(diffs.reduce((s, v) => s + v * v, 0) / diffs.length - (diffs.reduce((s, v) => s + v, 0) / diffs.length) ** 2);
  const sd1 = sdsd / Math.SQRT2, sd2 = Math.sqrt(Math.max(0, 2 * sdnn * sdnn - sd1 * sd1));
  return { rr, meanRr: mean, meanHr: 60000 / mean, sdnn, rmssd, pnn50, sd1, sd2, minHr: 60000 / Math.max(...rr), maxHr: 60000 / Math.min(...rr) };
}

/** LF (0.04–0.15 Hz) and HF (0.15–0.4 Hz) power of the RR series resampled at 4 Hz (linear). */
export function hrvSpectrum(rPeaks, sampleRate, { resample = 4 } = {}) {
  const times = rPeaks.slice(1).map((r) => r / sampleRate), rr = rPeaks.slice(1).map((r, i) => (r - rPeaks[i]) / sampleRate * 1000);
  const start = times[0], end = times.at(-1), n = Math.floor((end - start) * resample);
  if (n < 16) throw new RangeError('The recording is too short for a frequency-domain HRV estimate.');
  const series = new Float64Array(n);
  for (let k = 0, j = 0; k < n; k += 1) { const t = start + k / resample; while (j < times.length - 2 && times[j + 1] < t) j += 1; const f = (t - times[j]) / (times[j + 1] - times[j]); series[k] = rr[j] + f * (rr[j + 1] - rr[j]); }
  const mean = series.reduce((s, v) => s + v, 0) / n;
  const psd = welch(series.map((v) => v - mean), resample, { segment: Math.min(256, 1 << Math.floor(Math.log2(n))) });
  const band = (lo, hi) => psd.frequency.reduce((s, f, i) => s + (f >= lo && f < hi ? psd.power[i] * psd.df : 0), 0);
  const lf = band(0.04, 0.15), hf = band(0.15, 0.4);
  return { ...psd, lf, hf, ratio: hf > 0 ? lf / hf : Infinity };
}

// ---------------------------------------------------------------------------
// Spectra and EEG.

function fftReal(x) {
  const n = x.length, re = Float64Array.from(x), im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i += 1) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let size = 2; size <= n; size <<= 1) { const angle = -2 * Math.PI / size; for (let s = 0; s < n; s += size) for (let k = 0; k < size / 2; k += 1) { const wr = Math.cos(angle * k), wi = Math.sin(angle * k), a = s + k, b = a + size / 2; const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
  return { re, im };
}

/** Welch PSD, Hann window, 50 % overlap, one-sided density (scipy.signal.welch defaults, detrend='constant'). */
export function welch(x, sampleRate, { segment = 256 } = {}) {
  const n = segment, step = n / 2, w = Float64Array.from({ length: n }, (_, k) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / n));
  const scale = 1 / (sampleRate * w.reduce((s, v) => s + v * v, 0)), power = new Float64Array(n / 2 + 1);
  let count = 0;
  for (let start = 0; start + n <= x.length; start += step) {
    const seg = x.slice(start, start + n), mean = seg.reduce((s, v) => s + v, 0) / n;
    const { re, im } = fftReal(Float64Array.from(seg, (v, k) => (v - mean) * w[k]));
    for (let k = 0; k <= n / 2; k += 1) power[k] += (re[k] ** 2 + im[k] ** 2) * scale * (k === 0 || k === n / 2 ? 1 : 2);
    count += 1;
  }
  if (!count) throw new RangeError('Signal shorter than one Welch segment.');
  return { frequency: Array.from({ length: n / 2 + 1 }, (_, k) => k * sampleRate / n), power: Array.from(power, (v) => v / count), df: sampleRate / n };
}

export const EEG_BANDS = Object.freeze([['delta', 0.5, 4], ['theta', 4, 8], ['alpha', 8, 13], ['beta', 13, 30], ['gamma', 30, 45]]);
export const EEG_STATES = Object.freeze({
  relaxed: { label: 'Relaxed, eyes closed', amplitudes: { delta: 10, theta: 8, alpha: 35, beta: 6, gamma: 2 } },
  alert: { label: 'Alert, eyes open', amplitudes: { delta: 8, theta: 6, alpha: 8, beta: 15, gamma: 4 } },
  drowsy: { label: 'Drowsy', amplitudes: { delta: 15, theta: 25, alpha: 12, beta: 5, gamma: 2 } },
  sleep: { label: 'Deep sleep (N3)', amplitudes: { delta: 60, theta: 12, alpha: 4, beta: 3, gamma: 1 } },
});

/** Synthetic EEG (µV): each band is a sum of random-phase sinusoids, plus white noise and blinks. */
export function synthesizeEeg({ state = 'relaxed', duration = 30, sampleRate = 256, noise = 3, blinks = 0, seed = 1 } = {}) {
  const random = mulberry32(seed), g = gaussianSource(seed + 11), n = Math.round(duration * sampleRate), x = new Float64Array(n);
  const amplitudes = EEG_STATES[state]?.amplitudes;
  if (!amplitudes) throw new RangeError(`Unknown EEG state "${state}".`);
  for (const [name, lo, hi] of EEG_BANDS) {
    const components = 12;
    for (let c = 0; c < components; c += 1) {
      const f = lo + (hi - lo) * random(), phase = 2 * Math.PI * random(), a = amplitudes[name] * Math.sqrt(2 / components);
      for (let k = 0; k < n; k += 1) x[k] += a * Math.sin(2 * Math.PI * f * k / sampleRate + phase);
    }
  }
  for (let k = 0; k < n; k += 1) x[k] += noise * g();
  for (let b = 0; b < blinks; b += 1) { const centre = (b + 0.5) * duration / blinks; for (let k = 0; k < n; k += 1) x[k] += 120 * Math.exp(-(((k / sampleRate) - centre) ** 2) / (2 * 0.08 ** 2)); }
  return { sampleRate, signal: x };
}

/** Absolute and relative band powers from the Welch PSD (2-s segments). */
export function bandPowers(x, sampleRate, { segment = null } = {}) {
  const psd = welch(x, sampleRate, { segment: segment ?? 1 << Math.round(Math.log2(2 * sampleRate)) });
  const total = psd.frequency.reduce((s, f, i) => s + (f >= 0.5 && f < 45 ? psd.power[i] * psd.df : 0), 0);
  const bands = EEG_BANDS.map(([name, lo, hi]) => { const p = psd.frequency.reduce((s, f, i) => s + (f >= lo && f < hi ? psd.power[i] * psd.df : 0), 0); return { name, lo, hi, power: p, relative: p / total }; });
  const dominant = bands.reduce((best, band) => (band.power > best.power ? band : best));
  const peak = psd.frequency.reduce((best, f, i) => (f >= 0.5 && f < 45 && psd.power[i] > psd.power[best] ? i : best), 1);
  return { psd, bands, total, dominant: dominant.name, peakFrequency: psd.frequency[peak], thetaBetaRatio: bands[1].power / bands[3].power };
}
