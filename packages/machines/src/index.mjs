// Electrical machines and power devices: transformer tests, DC motors, the induction-motor
// equivalent circuit, SCR triggering, snubbers, series/parallel strings and switching losses.

const TWO_PI = 2 * Math.PI;
const c = (re, im = 0) => ({ re, im });
const add = (a, b) => c(a.re + b.re, a.im + b.im);
const mul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const abs = (a) => Math.hypot(a.re, a.im);

function positive(value, label) {
  const n = Number(value);
  if (!(n > 0) || !Number.isFinite(n)) throw new RangeError(`${label} must be a positive number.`);
  return n;
}

// ---------------------------------------------------------------------------
// Transformer.

/**
 * Single-phase transformer from the open-circuit test (on the LV side) and short-circuit test
 * (on the HV side): equivalent-circuit parameters, efficiency and regulation.
 */
export function transformerTests({ kva = 20, hv = 2500, lv = 250, oc = { v: 250, i: 1.4, p: 105 }, sc = { v: 104, i: 8, p: 320 } } = {}) {
  const s = positive(kva, 'Rating') * 1000;
  const ratio = positive(hv, 'HV voltage') / positive(lv, 'LV voltage');
  const pf0 = oc.p / (oc.v * oc.i);
  if (!(pf0 > 0 && pf0 < 1)) throw new RangeError('Open-circuit power factor must be between 0 and 1.');
  const iw = oc.i * pf0, imu = oc.i * Math.sqrt(1 - pf0 * pf0);
  const r0 = oc.v / iw, x0 = oc.v / imu;
  const z = sc.v / sc.i, r = sc.p / sc.i ** 2;
  if (!(z > r)) throw new RangeError('Short-circuit impedance must exceed its resistance.');
  const x = Math.sqrt(z * z - r * r);
  const ratedHv = s / hv;
  const copperFull = sc.p * (ratedHv / sc.i) ** 2;
  const efficiency = (fraction, pf) => { const out = fraction * s * pf; return out / (out + oc.p + fraction ** 2 * copperFull); };
  // Regulation (approximate, Kapp): (I·R·cosφ ± I·X·sinφ)/V; lagging pf gives +.
  const regulation = (fraction, pf, lagging = true) => { const sin = Math.sqrt(1 - pf * pf) * (lagging ? 1 : -1); return fraction * ratedHv * (r * pf + x * sin) / hv; };
  const xMax = Math.sqrt(oc.p / copperFull);
  return { rating: s, ratio, pf0, iw, imu, r0, x0, rEq: r, xEq: x, zEq: z, ratedHv, ratedLv: s / lv, coreLoss: oc.p, copperFull, efficiency, regulation, maxEfficiencyLoad: xMax, maxEfficiency: efficiency(xMax, 1), percentImpedance: 100 * z * ratedHv / hv };
}

/** All-day (energy) efficiency for a daily load cycle of [hours, fraction of rating, pf]; the core is energised for 24 h. */
export function allDayEfficiency(transformer, cycle) {
  const hours = cycle.reduce((sum, [h]) => sum + h, 0);
  if (hours > 24 + 1e-9) throw new RangeError('The load cycle is longer than 24 hours.');
  const output = cycle.reduce((sum, [h, fraction, pf]) => sum + h * fraction * transformer.rating * pf, 0);
  const copper = cycle.reduce((sum, [h, fraction]) => sum + h * fraction ** 2 * transformer.copperFull, 0);
  const core = 24 * transformer.coreLoss;
  return { output, copper, core, efficiency: output / (output + copper + core) };
}

// ---------------------------------------------------------------------------
// DC motors.

/**
 * DC shunt motor: from the rated point (V, armature current, speed) find kΦ, then speed at any
 * load torque, optionally with extra armature resistance or a weaker field (fieldFraction < 1).
 */
export function dcShuntMotor({ v = 220, ra = 0.5, ratedIa = 20, ratedRpm = 1500, extraRa = 0, fieldFraction = 1 } = {}) {
  const wRated = ratedRpm * TWO_PI / 60;
  const kPhiRated = (v - ratedIa * ra) / wRated;
  const kPhi = kPhiRated * positive(fieldFraction, 'Field fraction');
  const rTotal = ra + extraRa;
  const speedAt = (torque) => (v / kPhi - rTotal * torque / kPhi ** 2) * 60 / TWO_PI;
  const ratedTorque = kPhiRated * ratedIa;
  return { kPhi, kPhiRated, ratedTorque, noLoadRpm: v / kPhi * 60 / TWO_PI, speedAt, currentAt: (torque) => torque / kPhi, backEmfRated: v - ratedIa * ra, stallTorque: kPhi * v / rTotal, startingCurrent: v / rTotal };
}

/** DC series motor with an unsaturated field (Φ ∝ Ia): T = K·Ia², ω = (V − Ia(Ra + Rse))/(K·Ia). */
export function dcSeriesMotor({ v = 220, ra = 0.3, rse = 0.2, ratedIa = 30, ratedRpm = 1000 } = {}) {
  const r = ra + rse;
  const k = (v - ratedIa * r) / (ratedIa * ratedRpm * TWO_PI / 60);
  const atCurrent = (ia) => ({ torque: k * ia * ia, rpm: (v - ia * r) / (k * ia) * 60 / TWO_PI });
  const atTorque = (torque) => atCurrent(Math.sqrt(torque / k));
  return { k, atCurrent, atTorque, ratedTorque: k * ratedIa ** 2, startingTorque: k * (v / r) ** 2 };
}

// ---------------------------------------------------------------------------
// Induction motor.

/**
 * Three-phase induction motor per-phase equivalent circuit (IEEE, Chapman): line voltage,
 * R1, X1, Xm, R2', X2', poles, frequency, star connection. Thévenin reduction gives torque–slip,
 * slip at maximum torque, pull-out and starting torque.
 */
export function inductionMotor({ vLine = 460, r1 = 0.641, x1 = 1.106, xm = 26.3, r2 = 0.332, x2 = 0.464, poles = 4, frequency = 60, star = true, rotationalLoss = 0 } = {}) {
  const vPhase = star ? vLine / Math.sqrt(3) : vLine;
  const ns = 120 * frequency / poles, ws = ns * TWO_PI / 60;
  const zs = c(r1, x1), jxm = c(0, xm);
  const vthC = div(mul(c(vPhase), jxm), add(zs, jxm));
  const zth = div(mul(zs, jxm), add(zs, jxm));
  const vth = abs(vthC), rth = zth.re, xth = zth.im;
  const torque = (s) => 3 * vth * vth * (r2 / s) / (ws * ((rth + r2 / s) ** 2 + (xth + x2) ** 2));
  const sMax = r2 / Math.sqrt(rth * rth + (xth + x2) ** 2);
  const tMax = 3 * vth * vth / (2 * ws * (rth + Math.sqrt(rth * rth + (xth + x2) ** 2)));
  const operating = (s) => {
    const z2 = c(r2 / s, x2);
    const zf = div(mul(jxm, z2), add(jxm, z2));
    const zin = add(zs, zf);
    const i1 = div(c(vPhase), zin);
    const pin = 3 * vPhase * abs(i1) * Math.cos(Math.atan2(zin.im, zin.re));
    const pag = 3 * abs(i1) ** 2 * zf.re;
    const pconv = (1 - s) * pag;
    const pout = pconv - rotationalLoss;
    return { s, rpm: ns * (1 - s), current: abs(i1), pf: Math.cos(Math.atan2(zin.im, zin.re)), pin, airGap: pag, rotorCopper: s * pag, converted: pconv, output: pout, efficiency: pout / pin, inducedTorque: pag / ws, loadTorque: pout / ((1 - s) * ws) };
  };
  return { vPhase, ns, ws, vth, rth, xth, torque, sMax, tMax, startingTorque: torque(1), operating };
}

// ---------------------------------------------------------------------------
// SCR triggering, protection and strings.

/** UJT relaxation oscillator: frequency, peak voltage and the allowed range of the timing resistor. */
export function ujtOscillator({ vbb = 20, eta = 0.63, r = 20e3, cap = 0.1e-6, vd = 0.7, vv = 2, iv = 4e-3, ip = 5e-6 } = {}) {
  const vp = eta * vbb + vd;
  const period = r * cap * Math.log(1 / (1 - eta));
  const rMax = (vbb - vp) / ip, rMin = (vbb - vv) / iv;
  return { vp, period, frequency: 1 / period, rMin, rMax, oscillates: r > rMin && r < rMax };
}

/** Resistance (R) triggering of an SCR on a sine supply: firing angle for a gate trigger current. */
export function resistanceFiring({ vm = 325, r = 20e3, rMin = 2e3, igt = 1e-3, vgt = 0.7 } = {}) {
  const needed = igt * (r + rMin) + vgt;
  if (needed > vm) return { alpha: null, fires: false, needed };
  return { alpha: Math.asin(needed / vm) * 180 / Math.PI, fires: true, needed, maxAlpha: 90 };
}

/** RC snubber for an SCR with source inductance L: Rs from the dv/dt limit, Cs from damping ζ (Rashid). */
export function snubber({ vs = 300, l = 50e-6, dvdt = 50e6, zeta = 0.65 } = {}) {
  const rs = positive(l, 'Inductance') * positive(dvdt, 'dv/dt limit') / positive(vs, 'Supply');
  const cs = 4 * zeta * zeta * l / (rs * rs);
  return { rs, cs, dischargeCurrent: vs / rs, check: 2 * zeta * Math.sqrt(l / cs) };
}

/** Series SCR string: static sharing resistor, dynamic sharing capacitor and string efficiency. */
export function seriesString({ vs = 10e3, n = 6, vbm = 2e3, deltaIb = 10e-3, deltaQ = 20e-6 } = {}) {
  if (!(n >= 2)) throw new RangeError('A string needs at least two SCRs.');
  const margin = n * vbm - vs;
  if (!(margin > 0)) throw new RangeError('n·Vbm must exceed the string voltage.');
  return { r: margin / ((n - 1) * deltaIb), c: (n - 1) * deltaQ / margin, efficiency: vs / (n * vbm), derating: 1 - vs / (n * vbm) };
}

/** Switching and conduction loss of a MOSFET or IGBT in a hard-switched converter. */
export function switchingLoss({ device = 'mosfet', v = 400, i = 10, tr = 50e-9, tf = 80e-9, frequency = 50e3, duty = 0.5, rdsOn = 0.1, vceSat = 1.8 } = {}) {
  const switching = 0.5 * v * i * (tr + tf) * frequency;
  const conduction = device === 'igbt' ? vceSat * i * duty : i * i * rdsOn * duty;
  return { switching, conduction, total: switching + conduction };
}
