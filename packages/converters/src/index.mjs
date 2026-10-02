// Data converters: ideal and non-ideal ADC transfer functions, static (DNL/INL) and dynamic
// (SNR, SINAD, SFDR, ENOB) testing, SAR / flash / dual-slope / sigma-delta conversions shown step
// by step, and R-2R and binary-weighted DACs with resistor mismatch.

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------
// Utilities.

/** Seeded pseudo-random generator (mulberry32) with a Gaussian helper. */
export function createRandom(seed = 1) {
  let state = seed >>> 0;
  const next = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gaussian = () => { let u = 0; while (u === 0) u = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * next()); };
  return { next, gaussian };
}

/** In-place radix-2 complex FFT; length must be a power of two. */
export function fftRadix2(re, im) {
  const n = re.length;
  if (n & (n - 1)) throw new RangeError('FFT length must be a power of two.');
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = -TAU / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k += 1) {
        const wr = Math.cos(step * k), wi = Math.sin(step * k);
        const a = start + k, b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}

/** One-sided power spectrum |X[k]|² for k = 0…n/2 (optionally Blackman-Harris windowed). */
export function powerSpectrum(samples, { window = 'none' } = {}) {
  const n = samples.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  let gain = 0;
  for (let k = 0; k < n; k += 1) {
    const x = TAU * k / n;
    const w = window === 'blackman-harris' ? 0.35875 - 0.48829 * Math.cos(x) + 0.14128 * Math.cos(2 * x) - 0.01168 * Math.cos(3 * x) : 1;
    re[k] = samples[k] * w; gain += w;
  }
  fftRadix2(re, im);
  const power = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k += 1) power[k] = (re[k] ** 2 + im[k] ** 2) * (k === 0 || k === n / 2 ? 1 : 2) / (gain * gain);
  return power;
}

const isPrime = (value) => { if (value < 2) return false; for (let d = 2; d * d <= value; d += 1) if (value % d === 0) return false; return true; };
/** The prime number of cycles nearest to `target` (coherent sampling with no repeated codes). */
export function coherentCycles(n, target) {
  for (let delta = 0; delta < n / 2; delta += 1) { if (isPrime(target - delta)) return target - delta; if (isPrime(target + delta)) return target + delta; }
  return 1;
}

// ---------------------------------------------------------------------------
// ADC transfer function and linearity.

/**
 * Transition voltages T[1…2ⁿ−1] of an n-bit unipolar ADC (code k starts at T[k]).
 * Ideal: T[k] = (k − ½)·LSB. Errors: offset and gain (in LSB / %), a bow-shaped INL of
 * `bowLsb` at mid-scale, and random threshold mismatch (σ in LSB, seeded).
 */
export function adcThresholds({ bits = 8, vref = 5, offsetLsb = 0, gainErrorPercent = 0, bowLsb = 0, mismatchLsb = 0, seed = 1 } = {}) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 16) throw new RangeError('Resolution must be 1–16 bits.');
  if (!(vref > 0)) throw new RangeError('Reference voltage must be positive.');
  const levels = 2 ** bits, lsb = vref / levels;
  const random = createRandom(seed);
  const thresholds = new Float64Array(levels); // index 0 unused
  for (let k = 1; k < levels; k += 1) {
    const x = k / levels;
    const ideal = (k - 0.5) * lsb;
    thresholds[k] = ideal * (1 + gainErrorPercent / 100) + offsetLsb * lsb + bowLsb * lsb * 4 * x * (1 - x) + mismatchLsb * lsb * random.gaussian();
  }
  // Physical comparators can cross: keep the sequence ordered so codes stay monotonic (a crossed
  // pair shows up as a missing code).
  for (let k = 2; k < levels; k += 1) if (thresholds[k] < thresholds[k - 1]) thresholds[k] = thresholds[k - 1];
  return { bits, vref, lsb, thresholds };
}

/** Output code for input v (binary search over the transition voltages). */
export function adcCode(adc, v) {
  const { thresholds } = adc;
  let low = 0, high = thresholds.length - 1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (thresholds[mid] <= v) low = mid; else high = mid - 1; }
  return low;
}

/**
 * Static linearity from the transition voltages (end-point method): DNL[k] = W[k]/LSB − 1 for
 * codes 1…2ⁿ−2, INL[k] = deviation of T[k] from the line through the first and last transitions.
 */
export function linearity(adc) {
  const { thresholds } = adc;
  const last = thresholds.length - 1;
  const lsbActual = (thresholds[last] - thresholds[1]) / (last - 1);
  const dnl = [], inl = [];
  for (let k = 1; k < last; k += 1) dnl.push((thresholds[k + 1] - thresholds[k]) / lsbActual - 1);
  for (let k = 1; k <= last; k += 1) inl.push((thresholds[k] - (thresholds[1] + (k - 1) * lsbActual)) / lsbActual);
  const missing = dnl.map((value, index) => (value <= -0.999 ? index + 1 : null)).filter((value) => value !== null);
  const idealLsb = adc.vref / 2 ** adc.bits;
  return {
    dnl, inl, missingCodes: missing, maxDnl: Math.max(...dnl.map(Math.abs)), maxInl: Math.max(...inl.map(Math.abs)),
    offsetLsb: (thresholds[1] - 0.5 * idealLsb) / idealLsb, gainErrorPercent: (lsbActual / idealLsb - 1) * 100,
  };
}

/**
 * Ramp histogram test (as on production testers): code counts of a slow linear ramp give the
 * code widths; the transition voltages rebuilt from the cumulative counts give DNL and INL by
 * the same end-point method as `linearity`.
 */
export function histogramTest(adc, { samplesPerCode = 64 } = {}) {
  const levels = 2 ** adc.bits;
  // The ramp over-drives both ends (−10 % … 110 % of Vref) so offset and gain errors cannot hide codes.
  const start = -0.1 * adc.vref, span = 1.2 * adc.vref;
  const total = Math.round(levels * samplesPerCode * 1.2);
  const counts = new Float64Array(levels);
  for (let k = 0; k < total; k += 1) counts[adcCode(adc, start + (k + 0.5) / total * span)] += 1;
  const thresholds = new Float64Array(levels);
  let cumulative = 0;
  for (let k = 1; k < levels; k += 1) { cumulative += counts[k - 1]; thresholds[k] = start + cumulative / total * span; }
  const { dnl, inl, missingCodes, maxDnl, maxInl } = linearity({ ...adc, thresholds });
  return { counts: Array.from(counts), dnl, inl, missingCodes, maxDnl, maxInl };
}

/**
 * Dynamic test: a coherently sampled sine (prime number of cycles in n samples) through the ADC.
 * Returns the spectrum (dBFS), SNR, SINAD, THD, SFDR and ENOB = (SINAD − 1.76) / 6.02.
 */
export function dynamicTest(adc, { n = 4096, cycles = null, amplitudeFraction = 0.999, harmonicsCount = 7, noiseLsb = 0, seed = 2 } = {}) {
  const levels = 2 ** adc.bits;
  const m = cycles ?? coherentCycles(n, Math.round(n / 31));
  const random = createRandom(seed);
  const mid = adc.vref / 2, amplitude = amplitudeFraction * adc.vref / 2;
  const codes = new Float64Array(n);
  for (let k = 0; k < n; k += 1) codes[k] = adcCode(adc, mid + amplitude * Math.sin(TAU * m * k / n) + noiseLsb * adc.lsb * random.gaussian());
  const power = powerSpectrum(Array.from(codes, (c) => c - (levels - 1) / 2));
  const signal = power[m];
  const harmonicBins = new Set();
  let harmonicPower = 0;
  for (let h = 2; h <= harmonicsCount; h += 1) {
    let bin = (h * m) % n; if (bin > n / 2) bin = n - bin;
    if (bin === 0 || bin === m || harmonicBins.has(bin)) continue;
    harmonicBins.add(bin); harmonicPower += power[bin];
  }
  let noise = 0, spur = 0;
  for (let k = 1; k <= n / 2; k += 1) {
    if (k === m) continue;
    if (!harmonicBins.has(k)) noise += power[k];
    spur = Math.max(spur, power[k]);
  }
  const fullScale = (levels / 2) ** 2 / 2; // power of a full-scale sine in codes²
  const db = (ratio) => 10 * Math.log10(ratio);
  const sinad = db(signal / (noise + harmonicPower));
  return {
    cycles: m, codes: Array.from(codes), spectrumDbfs: Array.from(power, (p) => db(Math.max(p, 1e-30) / fullScale)),
    snr: db(signal / noise), sinad, thd: db(harmonicPower / signal), sfdr: db(signal / spur), enob: (sinad - 1.76) / 6.02,
    idealSnr: 6.02 * adc.bits + 1.76 + db(amplitudeFraction ** 2),
  };
}

// ---------------------------------------------------------------------------
// Conversion algorithms, step by step.

/** Successive approximation: binary search with a DAC (levels k·Vref/2ⁿ), MSB first. */
export function sarConvert(vin, { bits = 8, vref = 5, comparatorOffset = 0 } = {}) {
  const levels = 2 ** bits;
  let code = 0;
  const steps = [];
  for (let bit = bits - 1; bit >= 0; bit -= 1) {
    const trial = code | (1 << bit);
    const dac = trial * vref / levels;
    const keep = vin + comparatorOffset >= dac;
    steps.push({ bit, trial, dac, keep, code: keep ? trial : code });
    if (keep) code = trial;
  }
  return { code, steps, voltage: code * vref / levels, clocks: bits };
}

/**
 * Flash ADC: a resistor ladder (R/2 at the bottom and 3R/2 at the top for ±½ LSB rounding)
 * feeds 2ⁿ − 1 comparators; the thermometer code is encoded to binary.
 */
export function flashConvert(vin, { bits = 3, vref = 5 } = {}) {
  if (bits > 8) throw new RangeError('A flash converter here has at most 8 bits (255 comparators).');
  const levels = 2 ** bits, lsb = vref / levels;
  const references = Array.from({ length: levels - 1 }, (_, k) => (k + 0.5) * lsb);
  const thermometer = references.map((reference) => (vin >= reference ? 1 : 0));
  const code = thermometer.reduce((sum, bit) => sum + bit, 0);
  return { code, references, thermometer, comparators: levels - 1, resistors: levels };
}

/**
 * Dual-slope integrating ADC: integrate −Vin/RC for 2ⁿ clocks (T1), then integrate +Vref/RC
 * until the output returns to zero; count = 2ⁿ·Vin/Vref (independent of R, C and the clock).
 */
export function dualSlope(vin, { bits = 12, vref = 2, clock = 204_800, r = 100e3, c = 1e-6 } = {}) {
  if (!(vin >= 0 && vin <= vref)) throw new RangeError('Input must be between 0 and Vref.');
  const n1 = 2 ** bits, t1 = n1 / clock, rc = r * c;
  const peak = vin * t1 / rc; // integrator output magnitude at the end of T1
  const count = Math.floor(n1 * vin / vref); // counted clocks until zero crossing
  const t2 = peak * rc / vref;
  return { count, n1, t1, t2, peak, conversionTime: t1 + t2, waveform: [[0, 0], [t1, -peak], [t1 + t2, 0]], resultVoltage: count * vref / n1 };
}

/** Normal-mode rejection of an integrating ADC with integration time T1: |sin(πfT1)/(πfT1)|. */
export function integratingRejection(frequency, t1) {
  const x = Math.PI * frequency * t1;
  return x === 0 ? 1 : Math.abs(Math.sin(x) / x);
}

/**
 * Sigma-delta modulator (1st or 2nd order, 1-bit quantiser, output ±1) driven by a sine.
 * Returns the bitstream, its spectrum, the in-band SQNR for oversampling ratio `osr` and a
 * decimated output (sinc^(order+1) filter, decimation by `osr`).
 */
export function sigmaDelta({ order = 1, osr = 64, n = 16384, amplitude = 0.5, cycles = null, dither = 0, seed = 3 } = {}) {
  if (![1, 2].includes(order)) throw new RangeError('Modulator order must be 1 or 2.');
  const m = cycles ?? coherentCycles(n, Math.max(3, Math.round(n / osr / 8)));
  const random = createRandom(seed);
  const bits = new Int8Array(n);
  let i1 = 0, i2 = 0, y = 0;
  for (let k = 0; k < n; k += 1) {
    const x = amplitude * Math.sin(TAU * m * k / n);
    if (order === 1) { i1 += x - y; y = i1 + dither * random.gaussian() >= 0 ? 1 : -1; }
    else { i1 += x - y; i2 += i1 - y; y = i2 + dither * random.gaussian() >= 0 ? 1 : -1; }
    bits[k] = y;
  }
  const power = powerSpectrum(Array.from(bits), { window: 'blackman-harris' });
  const band = Math.floor(n / (2 * osr));
  let signal = 0, noise = 0;
  for (let k = 1; k <= band; k += 1) { if (Math.abs(k - m) <= 3) signal += power[k]; else noise += power[k]; }
  // Decimation: cascade of (order + 1) moving averages of length OSR, then keep every OSR-th sample.
  let filtered = Array.from(bits, Number);
  for (let stage = 0; stage <= order; stage += 1) {
    const out = new Array(filtered.length).fill(0);
    let sum = 0;
    for (let k = 0; k < filtered.length; k += 1) { sum += filtered[k]; if (k >= osr) sum -= filtered[k - osr]; out[k] = sum / osr; }
    filtered = out;
  }
  const decimated = [];
  for (let k = (order + 1) * osr; k < n; k += osr) decimated.push({ index: k, value: filtered[k] });
  const sqnr = 10 * Math.log10(signal / noise);
  const theory = order === 1 ? 6.02 + 1.76 - 5.17 + 30 * Math.log10(osr) : 6.02 + 1.76 - 12.9 + 50 * Math.log10(osr);
  return { order, osr, cycles: m, bitstream: Array.from(bits), spectrumDb: Array.from(power, (p) => 10 * Math.log10(Math.max(p, 1e-30))), bandEdgeBin: band, sqnr, theorySqnrFullScale: theory, decimated, ones: bits.reduce((sum, b) => sum + (b > 0 ? 1 : 0), 0) / n };
}

// ---------------------------------------------------------------------------
// DACs.

/**
 * R-2R ladder DAC (voltage mode, unloaded output at the MSB node) with resistor tolerance.
 * Every code's output is found by nodal analysis of the actual (mismatched) ladder.
 */
export function r2rDac({ bits = 8, vref = 5, r = 10e3, tolerancePercent = 0, seed = 4 } = {}) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 14) throw new RangeError('Resolution must be 1–14 bits.');
  const random = createRandom(seed);
  const vary = (value) => value * (1 + tolerancePercent / 100 * random.gaussian() / 3); // tolerance ≈ 3σ
  const legs = Array.from({ length: bits }, () => vary(2 * r)); // leg k from node k to bit k
  const series = Array.from({ length: bits - 1 }, () => vary(r)); // between node k and k+1
  const termination = vary(2 * r); // node 0 to ground
  const levels = 2 ** bits;
  // Tridiagonal nodal equations G·v = i (Thomas algorithm), once per code.
  const output = new Float64Array(levels);
  const diag = new Float64Array(bits), lower = new Float64Array(bits), upper = new Float64Array(bits);
  for (let k = 0; k < bits; k += 1) {
    diag[k] = 1 / legs[k] + (k === 0 ? 1 / termination : 1 / series[k - 1]) + (k < bits - 1 ? 1 / series[k] : 0);
    if (k > 0) lower[k] = -1 / series[k - 1];
    if (k < bits - 1) upper[k] = -1 / series[k];
  }
  const c = new Float64Array(bits), d = new Float64Array(bits);
  for (let code = 0; code < levels; code += 1) {
    for (let k = 0; k < bits; k += 1) {
      const rhs = ((code >> k) & 1) * vref / legs[k];
      const denominator = diag[k] - (k > 0 ? lower[k] * c[k - 1] : 0);
      c[k] = upper[k] / denominator;
      d[k] = (rhs - (k > 0 ? lower[k] * d[k - 1] : 0)) / denominator;
    }
    output[code] = d[bits - 1]; // the output is the last node, so no back substitution is needed
  }
  return dacReport({ kind: 'R-2R ladder', bits, vref, output, resistors: { legs, series, termination }, count: 2 * bits });
}

/** Binary-weighted resistor DAC with an inverting summing amplifier (Rf = R/2 → 0…−Vref). */
export function weightedDac({ bits = 8, vref = 5, r = 10e3, tolerancePercent = 0, seed = 5 } = {}) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 14) throw new RangeError('Resolution must be 1–14 bits.');
  const random = createRandom(seed);
  const vary = (value) => value * (1 + tolerancePercent / 100 * random.gaussian() / 3);
  const inputs = Array.from({ length: bits }, (_, k) => vary(r * 2 ** (bits - 1 - k))); // MSB uses R
  const rf = vary(r / 2);
  const levels = 2 ** bits;
  const output = new Float64Array(levels);
  for (let code = 0; code < levels; code += 1) {
    let current = 0;
    for (let k = 0; k < bits; k += 1) if ((code >> k) & 1) current += vref / inputs[k];
    output[code] = current * rf; // magnitude of −Rf·ΣI
  }
  return dacReport({ kind: 'Binary-weighted resistors', bits, vref, output, resistors: { inputs, rf }, count: bits + 1, spread: 2 ** (bits - 1) });
}

function dacReport({ kind, bits, vref, output, resistors, count, spread = 2 }) {
  const levels = output.length;
  const lsb = (output[levels - 1] - output[0]) / (levels - 1);
  const idealLsb = vref / levels;
  const dnl = [], inl = [];
  for (let code = 1; code < levels; code += 1) dnl.push((output[code] - output[code - 1]) / lsb - 1);
  for (let code = 0; code < levels; code += 1) inl.push((output[code] - (output[0] + code * lsb)) / lsb);
  return {
    kind, bits, vref, levels: Array.from(output), lsb, idealLsb, fullScale: output[levels - 1], resistors, resistorCount: count, resistorSpread: spread,
    dnl, inl, maxDnl: Math.max(...dnl.map(Math.abs)), maxInl: Math.max(...inl.map(Math.abs)), monotonic: dnl.every((value) => value > -1),
    worstStep: dnl.reduce((worst, value, index) => (Math.abs(value) > Math.abs(dnl[worst]) ? index : worst), 0) + 1,
  };
}
