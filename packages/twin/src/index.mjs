// Real + Virtual Bench: parse the OpenENTC Twin firmware's serial replies (the same text comes
// from a real Arduino over USB and from the built-in Uno simulator), convert ADC codes to volts,
// fit the RC charging curve and compare both runs with theory.

export const TWIN_BANNER = 'OPENENTC-TWIN';
export const TWIN_BAUD = 115200;

/** ATmega328P ADC: code = floor(V·1024/Vref), so the code's centre is (code + 0.5)·Vref/1024. */
export const adcToVolts = (code, vref = 5) => (Math.min(1023, Math.max(0, code)) + 0.5) * vref / 1024;

/** Parse everything the firmware has printed so far. */
export function parseTwinOutput(text) {
  const result = { banner: null, rc: null, dc: null, stream: [], errors: [], complete: 0 };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(TWIN_BANNER)) { result.banner = line; continue; }
    if (line === 'END') { result.complete += 1; continue; }
    if (line.startsWith('ERR')) { result.errors.push(line); continue; }
    const parts = line.split(',');
    if (parts[0] === 'BEGIN RC') { result.rc = { period: Number(parts[1]) / 1e6, samples: [] }; continue; }
    if (parts[0] === 'RC' && result.rc) { const i = Number(parts[1]), code = Number(parts[2]); if (Number.isFinite(i) && Number.isFinite(code)) result.rc.samples[i] = code; continue; }
    if (parts[0] === 'DC') { result.dc = { a0: Number(parts[1]), a1: Number(parts[2]) }; continue; }
    if (parts[0] === 'S') { result.stream.push({ ms: Number(parts[1]), a0: Number(parts[2]), a1: Number(parts[3]) }); continue; }
  }
  if (result.rc) result.rc.samples = result.rc.samples.filter((v) => v !== undefined);
  return result;
}

/** Theoretical capacitor voltage after a step: V(t) = Vs·(1 − e^(−t/RC)). */
export const rcCharge = (t, r, c, vs = 5) => vs * (1 - Math.exp(-t / (r * c)));

/**
 * Fit V(t) = V∞·(1 − e^(−(t − t0)/τ)) to a charging curve. V∞ comes from the settled tail (or is
 * given); τ and t0 from a least-squares line through ln(1 − V/V∞) for points between 5 % and 90 %.
 */
export function fitCharging(times, volts, { vFinal = null } = {}) {
  if (times.length !== volts.length || times.length < 8) throw new RangeError('Need at least 8 samples to fit.');
  const tail = volts.slice(Math.floor(volts.length * 0.9));
  let vInf = vFinal ?? tail.reduce((a, b) => a + b, 0) / tail.length;
  if (!(vInf > 0)) throw new RangeError('The capacitor never charged — check the wiring.');
  let line = null;
  // When the curve has not fully settled, the tail mean underestimates V∞; refine it a few times
  // from the fitted curve itself.
  for (let iteration = 0; iteration < (vFinal === null ? 6 : 1); iteration += 1) {
    line = fitLog(times, volts, vInf);
    if (vFinal !== null) break;
    const tailTimes = times.slice(Math.floor(times.length * 0.9));
    const estimates = tailTimes.map((t, k) => tail[k] / (1 - Math.exp(-(t - line.t0) / line.tau))).filter(Number.isFinite);
    vInf = estimates.reduce((a, b) => a + b, 0) / estimates.length;
  }
  return { ...line, vFinal: vInf };
}

function fitLog(times, volts, vInf) {
  const pts = times.map((t, k) => [t, volts[k] / vInf]).filter(([, x]) => x > 0.05 && x < 0.9);
  if (pts.length < 4) throw new RangeError('Too few samples on the rising edge: use a shorter sample period or a larger RC.');
  const ys = pts.map(([, x]) => Math.log(1 - x)), xs = pts.map(([t]) => t);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k += 1) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const tau = -1 / slope;
  return { tau, t0: intercept * tau, r2: (sxy * sxy) / (sxx * syy), points: n };
}

/**
 * Compare an RC run with theory. raws are ADC codes sampled every `period` seconds starting at
 * the step. Returns the measured curve, the fitted τ, the error against R·C and the C value the
 * measurement implies (assuming R is right).
 */
export function compareRc({ r, c, vs = 5, vref = 5, period, raws }) {
  const times = raws.map((_, k) => k * period);
  const volts = raws.map((code) => adcToVolts(code, vref));
  const fit = fitCharging(times, volts);
  const tauTheory = r * c;
  return { times, volts, theory: times.map((t) => rcCharge(t, r, c, vs)), fit, tauTheory, errorPercent: 100 * (fit.tau - tauTheory) / tauTheory, impliedC: fit.tau / r, settled: fit.vFinal / vs };
}

/** Divider on A1: theory vs the averaged reading. */
export function compareDivider({ vs = 5, rTop, rBottom, vref = 5, code }) {
  const theory = vs * rBottom / (rTop + rBottom);
  const measured = adcToVolts(code, vref);
  return { theory, measured, errorPercent: 100 * (measured - theory) / theory, impliedRatio: measured / vs };
}

/** Explain the usual reasons a real board differs from the simulation, ranked by the size of the error. */
export function explainDifference(errorPercent) {
  const e = Math.abs(errorPercent);
  if (e < 2) return 'Real and virtual agree within ADC resolution — excellent wiring and accurate parts.';
  if (e < 12) return 'Within normal component tolerance: resistors are ±1–5 % and electrolytic capacitors often ±20 %. The measured τ tells you the real C.';
  if (e < 40) return 'Larger than tolerance: check the capacitor value code, a loose breadboard contact, or the supply (USB 5 V is often 4.7–5.1 V).';
  return 'Very different: check the wiring (D8 → R → A0 → C → GND), the capacitor polarity, and that the right R and C are entered.';
}
