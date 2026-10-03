// CMOS inverter analysis with the SPICE level-1 (square-law) MOSFET: voltage transfer
// characteristic, switching threshold, noise margins, short-circuit current, transient
// response and propagation delays with a load capacitance, and dynamic power.

export const DEFAULT_PROCESS = Object.freeze({ vdd: 1.8, vtn: 0.45, vtp: -0.45, kpn: 200e-6, kpp: 80e-6, lambdaN: 0.05, lambdaP: 0.1, wn: 1, ln: 1, wp: 2.5, lp: 1 });

/** Level-1 drain current (A) for an NMOS with gate–source vgs and drain–source vds ≥ 0. */
export function level1Current(vgs, vds, { vt, kp, w, l, lambda = 0 }) {
  if (vds < 0) return -level1Current(vgs - vds, -vds, { vt, kp, w, l, lambda }); // swap source and drain
  const vov = vgs - vt;
  if (vov <= 0) return 0;
  const beta = kp * w / l;
  if (vds < vov) return beta * (vov * vds - vds * vds / 2) * (1 + lambda * vds);
  return beta / 2 * vov * vov * (1 + lambda * vds);
}

const nmos = (p) => ({ vt: p.vtn, kp: p.kpn, w: p.wn, l: p.ln, lambda: p.lambdaN });
const pmos = (p) => ({ vt: -p.vtp, kp: p.kpp, w: p.wp, l: p.lp, lambda: p.lambdaP }); // PMOS as an NMOS with mirrored voltages

/** Currents of the pull-down (NMOS) and pull-up (PMOS) for given input and output voltages. */
export function inverterCurrents(vin, vout, p = DEFAULT_PROCESS) {
  return { n: level1Current(vin, vout, nmos(p)), p: level1Current(p.vdd - vin, p.vdd - vout, pmos(p)) };
}

/** Static output voltage: solve I_n(vin, vout) = I_p(vin, vout) by bisection. */
export function solveOutput(vin, p = DEFAULT_PROCESS) {
  let low = 0, high = p.vdd;
  const f = (vout) => { const { n, p: up } = inverterCurrents(vin, vout, p); return up - n; }; // decreasing in vout
  if (f(high) >= 0) return high;
  if (f(low) <= 0) return low;
  for (let k = 0; k < 100; k += 1) { const mid = (low + high) / 2; if (f(mid) > 0) low = mid; else high = mid; }
  return (low + high) / 2;
}

/**
 * Voltage transfer characteristic and its key points: VOH, VOL, switching threshold VM
 * (Vin = Vout), VIL and VIH (gain = −1) and the noise margins NML = VIL − VOL, NMH = VOH − VIH.
 */
export function inverterVtc(p = DEFAULT_PROCESS, points = 721) {
  const vin = Array.from({ length: points }, (_, k) => p.vdd * k / (points - 1));
  const vout = vin.map((v) => solveOutput(v, p));
  const current = vin.map((v, k) => inverterCurrents(v, vout[k], p).n);
  const output = (v) => solveOutput(v, p);
  const gain = (v) => { const h = 1e-5; return (output(Math.min(p.vdd, v + h)) - output(Math.max(0, v - h))) / (Math.min(p.vdd, v + h) - Math.max(0, v - h)); };
  // VM: bisection on vout − vin.
  let low = 0, high = p.vdd;
  for (let k = 0; k < 80; k += 1) { const mid = (low + high) / 2; if (output(mid) > mid) low = mid; else high = mid; }
  const vm = (low + high) / 2;
  const findUnityGain = (from, to) => {
    // gain crosses −1 between from and to; bisection on gain(v) + 1.
    let a = from, b = to;
    const ga = gain(a) + 1;
    for (let k = 0; k < 60; k += 1) { const mid = (a + b) / 2; if ((gain(mid) + 1 > 0) === (ga > 0)) a = mid; else b = mid; }
    return (a + b) / 2;
  };
  const vil = findUnityGain(Math.max(0, p.vtn), vm - 1e-4);
  const vih = findUnityGain(vm + 1e-4, Math.min(p.vdd, p.vdd + p.vtp));
  const voh = output(0), vol = output(p.vdd);
  const vOutAtVil = output(vil), vOutAtVih = output(vih);
  return {
    vin, vout, current, vm, vil, vih, voh, vol, nml: vil - vol, nmh: voh - vih, gainAtVm: gain(vm), peakCurrent: Math.max(...current),
    vOutAtVil, vOutAtVih, ratio: Math.sqrt(p.kpp * p.wp / p.lp / (p.kpn * p.wn / p.ln)),
    theory: inverterTheory(p),
  };
}

/**
 * Textbook long-channel results (λ = 0, Kang & Leblebici): VM = [VTn + r(VDD + VTp)] / (1 + r)
 * with r = √(kp/kn); VIL = (2Vout + VTp − VDD + kR·VTn)/(1 + kR) with the NMOS saturated and the
 * PMOS linear; VIH = (VDD + VTp + kR(2Vout + VTn))/(1 + kR) with the NMOS linear and the PMOS
 * saturated (kR = kn/kp). Each pair is solved together with the current equality.
 */
export function inverterTheory(p = DEFAULT_PROCESS) {
  const kn = p.kpn * p.wn / p.ln, kp = p.kpp * p.wp / p.lp;
  const kr = kn / kp, r = Math.sqrt(kp / kn);
  const { vdd, vtn, vtp } = p;
  const vm = (vtn + r * (vdd + vtp)) / (1 + r);
  const bisect = (f, a, b) => { let fa = f(a); for (let k = 0; k < 100; k += 1) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
  // VIL: NMOS saturated, PMOS linear.
  const voutAtVil = (vin) => ((1 + kr) * vin - vtp + vdd - kr * vtn) / 2;
  const vil = bisect((vin) => { const vout = voutAtVil(vin); return kn / 2 * (vin - vtn) ** 2 - kp * ((vin - vdd - vtp) * (vout - vdd) - (vout - vdd) ** 2 / 2); }, vtn + 1e-9, vm);
  // VIH: NMOS linear, PMOS saturated.
  const voutAtVih = (vin) => ((1 + kr) * vin - vdd - vtp - kr * vtn) / (2 * kr);
  const vih = bisect((vin) => { const vout = voutAtVih(vin); return kn * ((vin - vtn) * vout - vout * vout / 2) - kp / 2 * (vin - vdd - vtp) ** 2; }, vm, vdd + vtp - 1e-9);
  return { vm, kr, vil, vih, voutAtVil: voutAtVil(vil), voutAtVih: voutAtVih(vih), nml: vil, nmh: vdd - vih };
}

/** Step-input propagation delays for λ = 0 (exact for the square-law model). */
export function delayTheory(p = DEFAULT_PROCESS, cl = 100e-15) {
  const kn = p.kpn * p.wn / p.ln, kp = p.kpp * p.wp / p.lp;
  const one = (k, vt) => cl / (k * (p.vdd - vt)) * (2 * vt / (p.vdd - vt) + Math.log(4 * (p.vdd - vt) / p.vdd - 1));
  const tphl = one(kn, p.vtn), tplh = one(kp, -p.vtp);
  return { tphl, tplh, tp: (tphl + tplh) / 2 };
}

/**
 * Transient response: input steps (or ramps over `riseTime`) low→high at t0 and high→low at
 * t0 + half; the output node C·dV/dt = Ip − In is integrated with RK4. Measures 50 % delays,
 * 10–90 % output transition times, and the energy drawn from VDD per cycle.
 */
export function inverterTransient(p = DEFAULT_PROCESS, { cl = 100e-15, riseTime = 0, period = null, steps = 20000 } = {}) {
  const estimate = delayTheory(p, cl);
  const half = period ? period / 2 : 12 * Math.max(estimate.tphl, estimate.tplh) + 2 * riseTime;
  const t0 = half * 0.05;
  const total = 2 * half;
  const dt = total / steps;
  const vin = (t) => {
    const ramp = (start) => (riseTime > 0 ? Math.min(1, Math.max(0, (t - start) / riseTime)) : t >= start ? 1 : 0);
    return p.vdd * (ramp(t0) - ramp(t0 + half));
  };
  const derivative = (t, v) => { const { n, p: up } = inverterCurrents(vin(t), v, p); return (up - n) / cl; };
  let v = solveOutput(0, p);
  const time = [], input = [], output = [], supply = [];
  let energy = 0;
  for (let k = 0; k <= steps; k += 1) {
    const t = k * dt;
    time.push(t); input.push(vin(t)); output.push(v);
    const supplyCurrent = inverterCurrents(vin(t), v, p).p;
    supply.push(supplyCurrent);
    if (k === steps) break;
    const k1 = derivative(t, v), k2 = derivative(t + dt / 2, v + dt / 2 * k1), k3 = derivative(t + dt / 2, v + dt / 2 * k2), k4 = derivative(t + dt, v + dt * k3);
    v += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
    energy += supplyCurrent * p.vdd * dt;
  }
  const crossing = (values, level, from, rising) => {
    for (let k = Math.max(1, from); k < values.length; k += 1) {
      if (rising ? values[k - 1] < level && values[k] >= level : values[k - 1] > level && values[k] <= level) return time[k - 1] + (level - values[k - 1]) / (values[k] - values[k - 1]) * dt;
    }
    return null;
  };
  const mid = p.vdd / 2;
  const startFall = Math.floor(t0 / dt), startRise = Math.floor((t0 + half) / dt);
  const inRise = crossing(input, mid, startFall, true) ?? t0, inFall = crossing(input, mid, startRise, false) ?? t0 + half;
  const outFall = crossing(output, mid, startFall, false), outRise = crossing(output, mid, startRise, true);
  const tf = (crossing(output, 0.1 * p.vdd, startFall, false) ?? NaN) - (crossing(output, 0.9 * p.vdd, startFall, false) ?? NaN);
  const tr = (crossing(output, 0.9 * p.vdd, startRise, true) ?? NaN) - (crossing(output, 0.1 * p.vdd, startRise, true) ?? NaN);
  const tphl = outFall === null ? null : outFall - inRise, tplh = outRise === null ? null : outRise - inFall;
  return {
    time, input, output, supply, tphl, tplh, tp: tphl !== null && tplh !== null ? (tphl + tplh) / 2 : null, fallTime: tf, riseTime: tr,
    energyPerCycle: energy, switchingEnergy: cl * p.vdd * p.vdd, theory: estimate,
  };
}

/** Dynamic power α·C·VDD²·f plus static leakage I_leak·VDD. */
export function dynamicPower({ cl = 100e-15, vdd = 1.8, frequency = 100e6, activity = 1, leakage = 0 } = {}) {
  return { dynamic: activity * cl * vdd * vdd * frequency, static: leakage * vdd, total: activity * cl * vdd * vdd * frequency + leakage * vdd, energyPerTransition: cl * vdd * vdd / 2 };
}

/** PMOS width for a symmetric inverter (VM = VDD/2, equal rise and fall) with the given NMOS. */
export function symmetricPmosWidth(p = DEFAULT_PROCESS) {
  return p.wn / p.ln * p.kpn / p.kpp * p.lp * ((p.vdd / 2 - p.vtn) / (p.vdd / 2 + p.vtp)) ** 2;
}
