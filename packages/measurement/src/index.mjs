// Electronic measurements: AC bridges (solved as complex impedances), Lissajous patterns,
// statistics and error propagation, meter design (shunts, multipliers, ohmmeter) and the Q-meter.

const TWO_PI = 2 * Math.PI;
const c = (re, im = 0) => ({ re, im });
const add = (a, b) => c(a.re + b.re, a.im + b.im);
const mul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const sub = (a, b) => c(a.re - b.re, a.im - b.im);
const abs = (a) => Math.hypot(a.re, a.im);
const inv = (a) => div(c(1), a);

/** Impedance of a simple arm: series or parallel R, L, C (any may be omitted). */
export function armImpedance({ r = 0, l = 0, cap = 0, form = 'series' }, frequency) {
  const w = TWO_PI * frequency;
  if (form === 'parallel') {
    let y = c(0);
    if (r > 0) y = add(y, c(1 / r));
    if (cap > 0) y = add(y, c(0, w * cap));
    if (l > 0) y = add(y, c(0, -1 / (w * l)));
    if (y.re === 0 && y.im === 0) throw new RangeError('A parallel arm needs at least one element.');
    return inv(y);
  }
  let z = c(r);
  if (l > 0) z = add(z, c(0, w * l));
  if (cap > 0) z = add(z, c(0, -1 / (w * cap)));
  return z;
}

/** Interpret an impedance at f as series R with L (positive X) or C (negative X). */
export function seriesEquivalent(z, frequency) {
  const w = TWO_PI * frequency;
  return z.im >= 0 ? { r: z.re, l: z.im / w, c: null, q: z.re > 0 ? z.im / z.re : Infinity } : { r: z.re, l: null, c: -1 / (w * z.im), d: -z.re / z.im };
}

/**
 * Four-arm bridge: arm 1 (unknown, a–b), arm 2 (b–c... ) arranged so that balance is Z1·Z4 = Z2·Z3.
 * Returns the unknown that balances the given arms, and the detector voltage for a given unknown.
 */
export function bridgeUnknown(z2, z3, z4) { return div(mul(z2, z3), z4); }

/** Detector voltage (phasor, volts) of a bridge driven by vs: V = vs·(Z3/(Z1+Z3) − Z4/(Z2+Z4)). */
export function bridgeDetector(z1, z2, z3, z4, vs = 1) {
  return mul(c(vs), sub(div(z3, add(z1, z3)), div(z4, add(z2, z4))));
}

export const BRIDGES = Object.freeze({
  maxwell: { name: 'Maxwell inductance–capacitance', measures: 'L', arms: 'Z1 = Lx + Rx, Z2 = R2, Z3 = R3, Z4 = R1 ∥ C1', formula: 'Lx = R2·R3·C1, Rx = R2·R3/R1, Q = ωC1R1' },
  hay: { name: 'Hay', measures: 'L', arms: 'Z1 = Lx + Rx, Z2 = R2, Z3 = R3, Z4 = R1 + C1 (series)', formula: 'Lx = R2R3C1/(1 + ω²C1²R1²), Rx = ω²C1²R1R2R3/(1 + ω²C1²R1²)' },
  owen: { name: 'Owen', measures: 'L', arms: 'Z1 = Lx + Rx, Z2 = R2 + C2, Z3 = R3, Z4 = C4', formula: 'Lx = R2·R3·C4, Rx = R3·C4/C2' },
  schering: { name: 'Schering', measures: 'C', arms: 'Z1 = Cx + Rx, Z2 = C2, Z3 = R3, Z4 = R4 ∥ C4', formula: 'Cx = C2·R4/R3, Rx = R3·C4/C2, D = ωC4R4' },
  desauty: { name: 'De Sauty', measures: 'C', arms: 'Z1 = Cx, Z2 = C2, Z3 = R3, Z4 = R4', formula: 'Cx = C2·R4/R3' },
  wien: { name: 'Wien (frequency)', measures: 'f', arms: 'Z1 = R1 + C1, Z2 = R2 ∥ C2, Z3 = R3, Z4 = R4', formula: 'f = 1/(2π√(R1R2C1C2)), R3/R4 = R1/R2 + C2/C1' },
});

/**
 * Solve a named bridge at balance. `values` holds the known arms (R2, R3, R1, C1, C2, C4, R4 …).
 * The answer comes from the general complex balance Z1 = Z2·Z3/Z4, and the closed-form textbook
 * result is returned next to it.
 */
export function solveBridge(type, values, frequency = 1000) {
  const v = values, w = TWO_PI * frequency;
  if (type === 'maxwell') {
    const z = bridgeUnknown(c(v.R2), c(v.R3), armImpedance({ r: v.R1, cap: v.C1, form: 'parallel' }, frequency));
    return { z, unknown: seriesEquivalent(z, frequency), closed: { l: v.R2 * v.R3 * v.C1, r: v.R2 * v.R3 / v.R1, q: w * v.C1 * v.R1 } };
  }
  if (type === 'hay') {
    const z = bridgeUnknown(c(v.R2), c(v.R3), armImpedance({ r: v.R1, cap: v.C1 }, frequency));
    const k = 1 + w * w * v.C1 * v.C1 * v.R1 * v.R1;
    return { z, unknown: seriesEquivalent(z, frequency), closed: { l: v.R2 * v.R3 * v.C1 / k, r: w * w * v.C1 * v.C1 * v.R1 * v.R2 * v.R3 / k, q: 1 / (w * v.C1 * v.R1) } };
  }
  if (type === 'owen') {
    const z = bridgeUnknown(armImpedance({ r: v.R2, cap: v.C2 }, frequency), c(v.R3), armImpedance({ cap: v.C4 }, frequency));
    return { z, unknown: seriesEquivalent(z, frequency), closed: { l: v.R2 * v.R3 * v.C4, r: v.R3 * v.C4 / v.C2 } };
  }
  if (type === 'schering') {
    const z = bridgeUnknown(armImpedance({ cap: v.C2 }, frequency), c(v.R3), armImpedance({ r: v.R4, cap: v.C4, form: 'parallel' }, frequency));
    return { z, unknown: seriesEquivalent(z, frequency), closed: { c: v.C2 * v.R4 / v.R3, r: v.R3 * v.C4 / v.C2, d: w * v.C4 * v.R4 } };
  }
  if (type === 'desauty') {
    const z = bridgeUnknown(armImpedance({ cap: v.C2 }, frequency), c(v.R3), c(v.R4));
    return { z, unknown: seriesEquivalent(z, frequency), closed: { c: v.C2 * v.R4 / v.R3 } };
  }
  if (type === 'wien') {
    const f = 1 / (TWO_PI * Math.sqrt(v.R1 * v.R2 * v.C1 * v.C2));
    const ratio = v.R1 / v.R2 + v.C2 / v.C1;
    // Check: at f with R3 = ratio·R4 the detector reads zero.
    const z1 = armImpedance({ r: v.R1, cap: v.C1 }, f), z2 = armImpedance({ r: v.R2, cap: v.C2, form: 'parallel' }, f);
    const detector = abs(bridgeDetector(z1, z2, c(ratio * v.R4), c(v.R4)));
    return { frequency: f, ratio, detector, closed: { f, ratio } };
  }
  throw new RangeError(`Unknown bridge ${type}.`);
}

// ---------------------------------------------------------------------------
// Lissajous figures.

/** Trace x = Ax sin(2π fx t), y = Ay sin(2π fy t + φ) over the common period. */
export function lissajous({ fx = 1000, fy = 2000, ax = 1, ay = 1, phase = 0, points = 1200 } = {}) {
  const ratio = rationalApprox(fy / fx);
  const period = ratio.q / fx;
  const phi = phase * Math.PI / 180;
  const trace = Array.from({ length: points + 1 }, (_, k) => { const t = period * k / points; return [ax * Math.sin(TWO_PI * fx * t), ay * Math.sin(TWO_PI * fy * t + phi)]; });
  // Tangency counts: a horizontal line touches the figure fy/fx × (vertical touches) times.
  const result = { trace, ratio: `${ratio.p}:${ratio.q}`, horizontalTangencies: ratio.p, verticalTangencies: ratio.q };
  if (ratio.p === 1 && ratio.q === 1) {
    // Equal frequencies: an ellipse; sin φ = y-intercept / y-max.
    const intercept = ay * Math.sin(phi);
    result.ellipse = { intercept, ymax: ay, phaseFromIntercept: Math.asin(Math.min(1, Math.abs(intercept / ay))) * 180 / Math.PI };
  }
  return result;
}

/** Small-denominator rational approximation p/q of x. */
export function rationalApprox(x, maxDenominator = 12) {
  let best = { p: Math.round(x), q: 1, error: Math.abs(x - Math.round(x)) };
  for (let q = 1; q <= maxDenominator; q += 1) {
    const p = Math.round(x * q);
    const error = Math.abs(x - p / q);
    if (error < best.error - 1e-12) best = { p, q, error };
  }
  return best;
}

/** Recover the phase between two equal-frequency signals from an ellipse's intercept and maximum. */
export const phaseFromEllipse = (intercept, ymax) => Math.asin(Math.min(1, Math.abs(intercept / ymax))) * 180 / Math.PI;

// ---------------------------------------------------------------------------
// Statistics and errors.

/** Statistics of repeated readings (sample standard deviation with n − 1). */
export function readingStatistics(values) {
  const x = values.map(Number).filter(Number.isFinite);
  if (x.length < 2) throw new RangeError('Enter at least two readings.');
  const n = x.length, mean = x.reduce((a, b) => a + b, 0) / n;
  const deviations = x.map((v) => v - mean);
  const variance = deviations.reduce((a, d) => a + d * d, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const sorted = [...x].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return { n, mean, median, range: sorted.at(-1) - sorted[0], averageDeviation: deviations.reduce((a, d) => a + Math.abs(d), 0) / n, sd, variance, probableError: 0.6745 * sd, standardError: sd / Math.sqrt(n), probableErrorOfMean: 0.6745 * sd / Math.sqrt(n), deviations };
}

/**
 * Error in a result y = k·Π xᵢ^pᵢ (products, quotients and powers) or y = Σ xᵢ (sums) from
 * the relative (or absolute, for sums) errors of the inputs: worst case and root-sum-square.
 */
export function combineErrors(kind, terms) {
  if (kind === 'sum') {
    const worst = terms.reduce((a, t) => a + Math.abs(t.error), 0);
    return { worst, rss: Math.sqrt(terms.reduce((a, t) => a + t.error ** 2, 0)), value: terms.reduce((a, t) => a + t.value, 0), absolute: true };
  }
  const worst = terms.reduce((a, t) => a + Math.abs((t.power ?? 1) * t.error), 0);
  const rss = Math.sqrt(terms.reduce((a, t) => a + ((t.power ?? 1) * t.error) ** 2, 0));
  return { worst, rss, value: terms.reduce((a, t) => a * t.value ** (t.power ?? 1), 1), absolute: false };
}

/** Accuracy quoted as ±% of full scale, turned into ±% of the actual reading. */
export const fullScaleToReading = (percentFsd, fullScale, reading) => percentFsd * fullScale / reading;

/** Voltmeter loading: reading across Rb of a divider Ra–Rb when the meter has sensitivity S Ω/V on range R. */
export function voltmeterLoading({ vs = 10, ra = 100e3, rb = 100e3, sensitivity = 20e3, range = 10 } = {}) {
  const rm = sensitivity * range;
  const trueV = vs * rb / (ra + rb);
  const rp = rb * rm / (rb + rm);
  const read = vs * rp / (ra + rp);
  return { meterResistance: rm, trueV, reading: read, errorPercent: 100 * (read - trueV) / trueV };
}

// ---------------------------------------------------------------------------
// Meter design.

/** Shunt that extends a PMMC movement (Im full-scale, Rm) to range I. */
export function ammeterShunt({ im = 1e-3, rm = 100, range = 1 } = {}) {
  if (!(range > im)) throw new RangeError('The range must be larger than the movement current.');
  const m = range / im;
  return { multiplyingPower: m, shunt: rm / (m - 1), shuntCurrent: range - im };
}

/** Ayrton (universal) shunt for several ranges: section resistances, lowest range first. */
export function ayrtonShunt({ im = 1e-3, rm = 100, ranges = [0.01, 0.1, 1] } = {}) {
  const sorted = [...ranges].sort((a, b) => a - b);
  if (sorted[0] <= im) throw new RangeError('Every range must exceed the movement current.');
  const total = im * rm / (sorted[0] - im); // whole shunt Rsh for the lowest range
  // For range Ik the tap leaves resistance Rk in parallel with the meter path (Rm + Rsh − Rk): Rk = Im(Rsh + Rm)/Ik.
  const taps = sorted.map((i) => im * (total + rm) / i);
  const sections = taps.map((r, k) => r - (taps[k + 1] ?? 0));
  return { totalShunt: total, taps, sections, ranges: sorted };
}

/** Series multiplier for a voltmeter range V; also the sensitivity in Ω/V. */
export function voltmeterMultiplier({ im = 50e-6, rm = 2000, range = 10 } = {}) {
  const rs = range / im - rm;
  if (!(rs >= 0)) throw new RangeError('The range is below the movement voltage Im·Rm.');
  return { multiplier: rs, sensitivity: 1 / im, totalResistance: range / im };
}

/** Series ohmmeter: zero-adjust and half-scale resistance, and the scale (fraction of FSD) for given Rx. */
export function seriesOhmmeter({ battery = 3, im = 1e-3, rm = 50, halfScale = 1500 } = {}) {
  if (!(battery > im * halfScale)) throw new RangeError('The battery must drive more than full-scale current through the half-scale resistance (E > Im·Rh).');
  const r1 = halfScale - im * rm * halfScale / battery;
  const r2 = im * rm * halfScale / (battery - im * halfScale);
  const deflection = (rx) => halfScale / (halfScale + rx);
  return { r1, r2, halfScale, deflection, scale: [0, 150, 500, 1500, 4500, 15000].map((rx) => ({ rx, fraction: deflection(rx) })) };
}

// ---------------------------------------------------------------------------
// Q-meter.

/** Q-meter readings: indicated Q, distributed capacitance by the double-frequency method and true Q. */
export function qMeter({ f1 = 1e6, c1 = 400e-12, c2 = 95e-12, indicatedQ = 120, shuntR = 0.02 } = {}) {
  // Resonate at f1 with C1, at 2f1 with C2: Cd = (C1 − 4C2)/3.
  const cd = (c1 - 4 * c2) / 3;
  const l = 1 / ((TWO_PI * f1) ** 2 * (c1 + cd));
  const trueQ = indicatedQ * (1 + cd / c1);
  // Effect of the insertion (shunt) resistance R: Qtrue = Qind·(1 + R/Rcoil).
  const rcoil = TWO_PI * f1 * l / trueQ;
  const withShunt = trueQ * (1 + shuntR / rcoil);
  return { distributedC: cd, inductance: l, trueQ, coilResistance: rcoil, correctedForShunt: withShunt };
}
