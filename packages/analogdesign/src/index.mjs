// Analog Design Studio: design-to-specification for the classic ENTC circuits. Each designer
// picks standard (E-series) parts, reports the values the real parts give, and returns both a
// Circuit Lab component list and a phasor netlist so the design can be checked by simulation.
import { nearestPreferred } from '../../calculators/src/index.mjs';
import { parseNetlist, solveNetwork } from '../../network/src/index.mjs';

const VT = 0.02585;
const TWO_PI = 2 * Math.PI;

function positive(value, label, max = 1e15) {
  const number = Number(value);
  if (!(number > 0) || number > max || !Number.isFinite(number)) throw new RangeError(`${label} must be a positive number.`);
  return number;
}
const pick = (value, series = 'E24') => (series === 'exact' ? value : nearestPreferred(value, series).value);
const parallel = (...values) => 1 / values.reduce((sum, value) => sum + 1 / value, 0);

// Circuit Lab component helpers (same shape as src/data/example-circuits.js).
const part = (id, type, value, unit, n1, n2, x, y, rotation = 0) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation });
const device = (id, type, value, unit, [n1, n2, n3], x, y) => ({ id, type, label: id, value, unit, n1, n2, n3, x, y, rotation: 0 });
const ground = (x, y = 300) => part('GND', 'ground', 0, 'V', '0', '0', x, y);

/** Magnitude and phase (degrees) of V(out)/V(in) for a netlist driven by `Vin in 0 1`. */
export function networkGain(netlist, frequency, out = 'out') {
  const solution = solveNetwork(parseNetlist(netlist), { frequency });
  const [re, im] = solution.voltages[out] ?? [0, 0];
  return { magnitude: Math.hypot(re, im), phase: Math.atan2(im, re) * 180 / Math.PI, re, im };
}

/** Log-spaced frequency response of a netlist. */
export function networkSweep(netlist, { start, stop, points = 200, out = 'out' }) {
  const elements = parseNetlist(netlist);
  const frequencies = Array.from({ length: points }, (_, k) => start * (stop / start) ** (k / (points - 1)));
  const response = frequencies.map((frequency) => {
    const [re, im] = solveNetwork(elements, { frequency }).voltages[out] ?? [0, 0];
    return { magnitudeDb: 20 * Math.log10(Math.hypot(re, im) || 1e-30), phase: Math.atan2(im, re) * 180 / Math.PI };
  });
  return { frequencies, magnitudeDb: response.map((r) => r.magnitudeDb), phase: response.map((r) => r.phase) };
}

// Ideal op-amp for the phasor solver: a VCVS with a very large gain.
const OPAMP = (name, plus, minus, out) => `E${name} ${out} 0 ${plus} ${minus} 1e7`;

// ---------------------------------------------------------------------------
// BJT voltage-divider bias and common-emitter amplifier.

/**
 * Design a voltage-divider-biased CE stage. Rules (Boylestad/Sedra): VE = reFraction·VCC,
 * VCE = vceFraction·VCC, divider current = stiffness·IB. Then the exact Q-point of the chosen
 * standard parts is found from the Thévenin equivalent of the divider.
 */
export function designBias({ vcc = 12, ic = 2e-3, beta = 100, vbe = 0.7, reFraction = 0.1, vceFraction = 0.5, stiffness = 10, rl = 10e3, fLow = 100, series = 'E24', bypass = true } = {}) {
  positive(vcc, 'VCC', 1000); positive(ic, 'IC', 10); positive(beta, 'β', 1e5); positive(stiffness, 'Divider stiffness', 1000);
  if (!(reFraction > 0 && vceFraction > 0 && reFraction + vceFraction < 0.95)) throw new RangeError('VE and VCE fractions must leave room for the collector resistor.');
  const ib = ic / beta, ie = ic + ib;
  const ve = reFraction * vcc, vce = vceFraction * vcc;
  const ideal = { re: ve / ie, rc: (vcc - vce - ve) / ic, r2: (ve + vbe) / (stiffness * ib) };
  ideal.r1 = (vcc - ve - vbe) / ((stiffness + 1) * ib);
  const chosen = { re: pick(ideal.re, series), rc: pick(ideal.rc, series), r1: pick(ideal.r1, series), r2: pick(ideal.r2, series) };
  // Exact Q-point of the chosen parts (Thévenin of the divider).
  const vth = vcc * chosen.r2 / (chosen.r1 + chosen.r2), rth = parallel(chosen.r1, chosen.r2);
  const ibq = (vth - vbe) / (rth + (beta + 1) * chosen.re);
  if (!(ibq > 0)) throw new RangeError('With these values the transistor is cut off.');
  let icq = beta * ibq, ieq = icq + ibq;
  let vceq = vcc - icq * chosen.rc - ieq * chosen.re;
  const saturated = vceq < 0.2;
  if (saturated) { icq = (vcc - 0.2) / (chosen.rc + chosen.re * (1 + 1 / beta)); ieq = icq * (1 + 1 / beta); vceq = 0.2; }
  const re = VT / ieq, rpi = beta * VT / icq;
  const rin = parallel(chosen.r1, chosen.r2, bypass ? rpi : rpi + (beta + 1) * chosen.re);
  const gain = bypass ? -parallel(chosen.rc, rl) / re : -parallel(chosen.rc, rl) / (re + chosen.re);
  // Stability factor S = ∂IC/∂ICO = (1 + β)/(1 + β·RE/(RE + RTH)).
  const stability = (1 + beta) / (1 + beta * chosen.re / (chosen.re + rth));
  // Coupling and bypass capacitors: each sets a pole at fLow/10 except the bypass, which sets fLow.
  const capacitors = {
    cin: pick(1 / (TWO_PI * (fLow / 10) * rin), 'E6'),
    cout: pick(1 / (TWO_PI * (fLow / 10) * (chosen.rc + rl)), 'E6'),
    ce: bypass ? pick(1 / (TWO_PI * fLow * parallel(chosen.re, (rth + rpi) / (beta + 1))), 'E6') : null,
  };
  const loadLine = { icSat: vcc / (chosen.rc + chosen.re), vceCut: vcc };
  const components = [
    part('VCC', 'voltage', vcc, 'V', 'vcc', '0', 100, 90), part('VS', 'voltage', 0.01, 'V', 's', '0', 100, 240),
    part('CIN', 'capacitor', capacitors.cin, 'F', 's', 'b', 220, 240), part('R1', 'resistor', chosen.r1, 'Ω', 'vcc', 'b', 300, 120), part('R2', 'resistor', chosen.r2, 'Ω', 'b', '0', 300, 320),
    device('Q1', 'npn', beta, 'β', ['c', 'b', 'e'], 440, 220), part('RC', 'resistor', chosen.rc, 'Ω', 'vcc', 'c', 560, 120), part('RE', 'resistor', chosen.re, 'Ω', 'e', '0', 560, 320),
    ...(bypass ? [part('CE', 'capacitor', capacitors.ce, 'F', 'e', '0', 680, 320)] : []),
    part('COUT', 'capacitor', capacitors.cout, 'F', 'c', 'out', 680, 140), part('RL', 'resistor', rl, 'Ω', 'out', '0', 800, 220), ground(440, 360),
  ];
  return { ideal, chosen, q: { ib: ibq, ic: icq, ie: ieq, vce: vceq, vb: vth - ibq * rth, ve: ieq * chosen.re, vc: vcc - icq * chosen.rc, saturated }, vth, rth, smallSignal: { re, rpi, gm: icq / VT, rin, gain, gainDb: 20 * Math.log10(Math.abs(gain)) }, stability, capacitors, loadLine, components, analysis: { analysis: 'ac', startHz: 1, stopHz: 10_000_000, pointsPerDecade: 20, source: 'VS' }, trace: 'V(out)' };
}

// ---------------------------------------------------------------------------
// Oscillators.

export const OSCILLATORS = Object.freeze({
  wien: 'Wien bridge (op-amp)',
  phase: 'RC phase shift (op-amp, 3 CR sections)',
  colpitts: 'Colpitts (LC)',
  hartley: 'Hartley (LC)',
  crystal: 'Crystal (quartz)',
});

/** Design an oscillator for frequency f. For RC types `c` is the chosen capacitor; for LC types `l` is the inductor (Hartley: total L split in `ratio`). */
export function designOscillator({ type = 'wien', frequency = 1000, c = 10e-9, l = 100e-6, ratio = 0.1, series = 'E24', crystal = { ls: 0.0254, cs: 0.0199e-12, cp: 5.6e-12, rs: 25 } } = {}) {
  const f = positive(frequency, 'Frequency', 1e10);
  if (type === 'wien') {
    const r = pick(1 / (TWO_PI * f * positive(c, 'C')), series);
    const r1 = pick(10e3, series), rf = 2 * r1;
    const actual = 1 / (TWO_PI * r * c);
    const netlist = `Vin in 0 1\nRs in a ${r}\nCs a out ${c}\nRp out 0 ${r}\nCp out 0 ${c}`;
    const beta = networkGain(netlist, actual);
    return { type, values: { R: r, C: c, R1: r1, Rf: rf }, actual, requiredGain: 3, condition: 'Rf ≥ 2·R1 (gain 1 + Rf/R1 ≥ 3)', feedback: { magnitude: beta.magnitude, phase: beta.phase, expected: 1 / 3 }, netlist, formula: 'f = 1/(2πRC)' };
  }
  if (type === 'phase') {
    const r = pick(1 / (TWO_PI * f * Math.sqrt(6) * positive(c, 'C')), series);
    const actual = 1 / (TWO_PI * Math.sqrt(6) * r * c);
    // Three high-pass CR sections; the third R is the inverting amplifier's input resistor (virtual ground).
    const netlist = `Vin in 0 1\nC1 in a ${c}\nR1 a 0 ${r}\nC2 a b ${c}\nR2 b 0 ${r}\nC3 b out ${c}\nR3 out 0 ${r}`;
    const beta = networkGain(netlist, actual);
    const rf = pick(29 * r, series);
    return { type, values: { R: r, C: c, Rf: rf }, actual, requiredGain: 29, condition: 'Rf ≥ 29·R (inverting gain ≥ 29)', feedback: { magnitude: beta.magnitude, phase: beta.phase, expected: 1 / 29 }, netlist, formula: 'f = 1/(2π√6·RC)' };
  }
  if (type === 'colpitts') {
    // f = 1/(2π√(L·Ceq)), Ceq = C1C2/(C1+C2); choose C2 = 10·C1 so the feedback β = C1/C2 = 0.1.
    const ceq = 1 / (TWO_PI ** 2 * f ** 2 * positive(l, 'L'));
    const c1 = pick(ceq * 1.1, series), c2 = pick(ceq * 11, series);
    const actualCeq = c1 * c2 / (c1 + c2);
    return { type, values: { L: l, C1: c1, C2: c2 }, actual: 1 / (TWO_PI * Math.sqrt(l * actualCeq)), requiredGain: c2 / c1, condition: `gain ≥ C2/C1 = ${(c2 / c1).toPrecision(4)}`, feedback: { magnitude: c1 / c2, phase: 180, expected: c1 / c2 }, formula: 'f = 1/(2π√(L·C1C2/(C1+C2)))' };
  }
  if (type === 'hartley') {
    const total = positive(l, 'L');
    const l2 = total * ratio, l1 = total - l2;
    const cap = pick(1 / (TWO_PI ** 2 * f ** 2 * total), series);
    return { type, values: { L1: l1, L2: l2, C: cap }, actual: 1 / (TWO_PI * Math.sqrt(total * cap)), requiredGain: l1 / l2, condition: `gain ≥ L1/L2 = ${(l1 / l2).toPrecision(4)}`, feedback: { magnitude: l2 / l1, phase: 180, expected: l2 / l1 }, formula: 'f = 1/(2π√((L1+L2)·C)) (no mutual inductance)' };
  }
  if (type === 'crystal') {
    const { ls, cs, cp, rs } = crystal;
    const fsr = 1 / (TWO_PI * Math.sqrt(ls * cs));
    const fpr = 1 / (TWO_PI * Math.sqrt(ls * cs * cp / (cs + cp)));
    return { type, values: { Ls: ls, Cs: cs, Cp: cp, Rs: rs }, actual: fsr, parallel: fpr, q: TWO_PI * fsr * ls / rs, requiredGain: 1, condition: 'oscillates between fs and fp, where the crystal looks inductive', feedback: null, formula: 'fs = 1/(2π√(LsCs)), fp = fs·√(1 + Cs/Cp)' };
  }
  throw new RangeError(`Unknown oscillator type ${type}.`);
}

// ---------------------------------------------------------------------------
// Active filters.

/** Q of each second-order section of an nth-order Butterworth filter (one first-order section when n is odd). */
export function butterworthQs(order) {
  const n = Math.round(order);
  if (!(n >= 1 && n <= 10)) throw new RangeError('Order must be 1 to 10.');
  return Array.from({ length: Math.floor(n / 2) }, (_, k) => 1 / (2 * Math.sin((2 * k + 1) * Math.PI / (2 * n))));
}

/**
 * Unity-gain Sallen–Key low-pass or high-pass filter of any order (Butterworth), as a cascade of
 * second-order sections plus one RC section for odd orders (TI SLOA024 forms): low-pass sections
 * fix the capacitors and solve for R1, R2; high-pass sections use equal capacitors.
 */
export function designSallenKey({ kind = 'lowpass', order = 2, fc = 1000, c = 10e-9, series = 'E24' } = {}) {
  const f = positive(fc, 'Cut-off frequency', 1e9);
  const cap = positive(c, 'C');
  const qs = butterworthQs(order);
  const w = TWO_PI * f;
  const stages = [];
  let netlist = 'Vin in 0 1\n', node = 'in', k = 0;
  for (const q of qs) {
    k += 1;
    const out = `s${k}`;
    if (kind === 'lowpass') {
      // C2 (to ground) = C0 and C1 (feedback) the next E12 value ≥ 4Q²·C2, then R1, R2 from
      // R1 + R2 = 1/(QωC2) and R1·R2 = 1/(ω²C1C2) — the roots are real because C1/C2 ≥ 4Q².
      const c2 = pick(cap, series === 'exact' ? 'exact' : 'E12');
      const c1 = series === 'exact' ? 4 * q * q * c2 * 1.2 : nearestPreferred(4 * q * q * c2 * 1.02, 'E12').above;
      const sum = 1 / (q * w * c2), product = 1 / (w * w * c1 * c2), root = Math.sqrt(Math.max(0, sum * sum - 4 * product));
      const r1 = pick((sum + root) / 2, series), r2 = pick((sum - root) / 2, series);
      const actualF = 1 / (TWO_PI * Math.sqrt(r1 * r2 * c1 * c2)), actualQ = Math.sqrt(r1 * r2 * c1 * c2) / (c2 * (r1 + r2));
      stages.push({ q, R1: r1, R2: r2, C1: c1, C2: c2, f0: actualF, actualQ });
      netlist += `R${k}a ${node} m${k} ${r1}\nR${k}b m${k} p${k} ${r2}\nC${k}a m${k} ${out} ${c1}\nC${k}b p${k} 0 ${c2}\n${OPAMP(`${k}`, `p${k}`, out, out)}\n`;
    } else {
      // Equal capacitors: R1 (to output) = 1/(2Q·ωC), R2 (to ground) = 2Q/(ωC).
      const r1 = pick(1 / (2 * q * w * cap), series), r2 = pick(2 * q / (w * cap), series);
      const actualF = 1 / (TWO_PI * cap * Math.sqrt(r1 * r2)), actualQ = Math.sqrt(r1 * r2) / (2 * r1);
      stages.push({ q, R1: r1, R2: r2, C1: cap, C2: cap, f0: actualF, actualQ });
      netlist += `C${k}a ${node} m${k} ${cap}\nC${k}b m${k} p${k} ${cap}\nR${k}a m${k} ${out} ${r1}\nR${k}b p${k} 0 ${r2}\n${OPAMP(`${k}`, `p${k}`, out, out)}\n`;
    }
    node = out;
  }
  if (Math.round(order) % 2) {
    const r = pick(1 / (w * cap), series);
    stages.push({ q: 0.5, R1: r, C1: cap, f0: 1 / (TWO_PI * r * cap), firstOrder: true });
    netlist += kind === 'lowpass' ? `R9 ${node} p9 ${r}\nC9 p9 0 ${cap}\n${OPAMP('9', 'p9', 'out', 'out')}\n` : `C9 ${node} p9 ${cap}\nR9 p9 0 ${r}\n${OPAMP('9', 'p9', 'out', 'out')}\n`;
  } else {
    netlist = netlist.replace(new RegExp(`\\b${node}\\b`, 'g'), 'out');
  }
  const atCutoff = networkGain(netlist, f);
  return { kind, order: Math.round(order), fc: f, stages, netlist, atCutoffDb: 20 * Math.log10(atCutoff.magnitude), sweep: networkSweep(netlist, { start: f / 100, stop: f * 100, points: 241 }) };
}

/** Multiple-feedback (MFB) band-pass: centre f0, quality Q, centre gain −A0 (needs A0 < 2Q²). */
export function designBandpass({ f0 = 1000, q = 5, gain = 2, c = 10e-9, series = 'E24' } = {}) {
  const f = positive(f0, 'Centre frequency', 1e9), cap = positive(c, 'C');
  if (!(q > 0.5 && q <= 100)) throw new RangeError('Q must be between 0.5 and 100.');
  if (!(gain > 0 && gain < 2 * q * q)) throw new RangeError('Centre gain must be below 2Q².');
  const w = TWO_PI * f;
  const r1 = pick(q / (gain * w * cap), series), r3 = pick(2 * q / (w * cap), series);
  const r2 = pick(q / ((2 * q * q - gain) * w * cap), series);
  const netlist = `Vin in 0 1\nR1 in m ${r1}\nR2 m 0 ${r2}\nC1 m out ${cap}\nC2 m n ${cap}\nR3 n out ${r3}\n${OPAMP('1', '0', 'n', 'out')}`;
  // Exact figures of the chosen parts.
  const actualF = Math.sqrt((r1 + r2) / (r1 * r2 * r3)) / (TWO_PI * cap);
  const actualGain = r3 / (2 * r1);
  const actualQ = Math.PI * actualF * r3 * cap;
  const centre = networkGain(netlist, actualF);
  return { values: { R1: r1, R2: r2, R3: r3, C1: cap, C2: cap }, f0: actualF, q: actualQ, gain: actualGain, bandwidth: actualF / actualQ, netlist, centre: { magnitude: centre.magnitude, phase: centre.phase }, sweep: networkSweep(netlist, { start: f / 30, stop: f * 30, points: 241 }) };
}

// ---------------------------------------------------------------------------
// Regulators, Schmitt trigger and PLL.

/** Zener shunt regulator: series resistor for the worst case (lowest Vin, highest load) and the ratings. */
export function designZener({ vinMin = 12, vinMax = 15, vz = 5.1, izMin = 5e-3, ilMax = 20e-3, ilMin = 0, rz = 0, series = 'E24' } = {}) {
  if (!(vinMin > vz)) throw new RangeError('The lowest input must be above the Zener voltage.');
  if (!(vinMax >= vinMin)) throw new RangeError('Vin(max) must be at least Vin(min).');
  const ideal = (vinMin - vz) / (izMin + ilMax);
  const list = nearestPreferred(ideal, series === 'exact' ? 'E24' : series);
  const rs = series === 'exact' ? ideal : (list.below > 0 ? list.below : list.value); // round down so Iz never drops below Iz(min)
  const izMax = (vinMax - vz) / rs - ilMin;
  const izAtMin = (vinMin - vz) / rs - ilMax;
  const pz = vz * izMax, pr = (vinMax - vz) ** 2 / rs;
  const lineRegulation = rz > 0 ? rz / (rs + rz) : 0;
  return { rs, ideal, izMax, izAtMin, pz, pr, ratings: { zenerW: pick(2 * pz, 'E6'), resistorW: [0.25, 0.5, 1, 2, 5, 10].find((w) => w >= 2 * pr) ?? 2 * pr }, lineRegulation, ok: izAtMin >= izMin * 0.999 };
}

/** LM317 adjustable regulator: R2 for Vout with R1 (Vref = 1.25 V, IADJ = 50 µA), dissipation and dropout check. */
export function designLm317({ vout = 9, vin = 15, iload = 0.5, r1 = 240, series = 'E24' } = {}) {
  const vref = 1.25, iadj = 50e-6;
  if (!(vout >= vref)) throw new RangeError('Vout must be at least 1.25 V.');
  const ideal = (vout - vref) / (vref / r1 + iadj);
  const r2 = pick(ideal, series);
  const actual = vref * (1 + r2 / r1) + iadj * r2;
  const dissipation = (vin - actual) * iload;
  return { r1, r2, ideal, vout: actual, dissipation, headroom: vin - actual, dropoutOk: vin - actual >= 3, minLoad: vref / r1 };
}

/** Op-amp Schmitt trigger with thresholds VUT > VLT and ±Vsat outputs. */
export function designSchmitt({ vut = 2, vlt = -1, vsat = 13, kind = 'inverting', r2 = 10e3, series = 'E24' } = {}) {
  if (!(vut > vlt)) throw new RangeError('Upper threshold must be above the lower threshold.');
  const hysteresis = vut - vlt;
  if (!(hysteresis < 2 * vsat)) throw new RangeError('Hysteresis must be smaller than 2·Vsat.');
  if (kind === 'inverting') {
    // VUT = β·Vsat + (1−β)·Vref, VLT = −β·Vsat + (1−β)·Vref, β = R2/(R1+R2).
    const beta = hysteresis / (2 * vsat);
    const vref = (vut + vlt) / 2 / (1 - beta);
    const r1 = pick(r2 * (1 - beta) / beta, series);
    const b = r2 / (r1 + r2);
    return { kind, r1, r2, vref, beta: b, vut: b * vsat + (1 - b) * vref, vlt: -b * vsat + (1 - b) * vref, hysteresis: 2 * b * vsat };
  }
  // Non-inverting: thresholds = Vref(1 + R1/R2) ± Vsat·R1/R2 with the input through R1.
  const ratio = hysteresis / (2 * vsat);
  const r1 = pick(r2 * ratio, series);
  const k = r1 / r2;
  const vref = (vut + vlt) / 2 / (1 + k);
  return { kind, r1, r2, vref, beta: k, vut: vref * (1 + k) + vsat * k, vlt: vref * (1 + k) - vsat * k, hysteresis: 2 * vsat * k };
}

/** NE565 PLL: free-running frequency, lock range and capture range (Signetics data-sheet formulas). */
export function designPll({ rt = 10e3, ct = 10e-9, c2 = 10e-6, vcc = 12 } = {}) {
  const f0 = 0.3 / (positive(rt, 'R1') * positive(ct, 'C1'));
  const lock = 8 * f0 / positive(vcc, 'Supply (total)');
  const capture = Math.sqrt(lock / (TWO_PI * 3.6e3 * positive(c2, 'C2'))) ;
  return { f0, lockRange: lock, captureRange: capture, lockBand: [f0 - lock, f0 + lock], captureBand: [f0 - capture, f0 + capture] };
}
