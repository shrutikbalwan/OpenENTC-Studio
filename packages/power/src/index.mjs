// Power electronics: ideal-switch, time-domain simulation of rectifiers (diode and SCR, single
// and three phase), DC-DC converters, voltage-source inverters and AC voltage controllers, with
// the textbook formulas next to the simulated results.

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Waveform metrics.

/** Mean, RMS, peak values of uniformly sampled data over one period. */
export function periodStats(values) {
  let sum = 0, square = 0, max = -Infinity, min = Infinity;
  for (const v of values) { sum += v; square += v * v; if (v > max) max = v; if (v < min) min = v; }
  const n = values.length;
  return { mean: sum / n, rms: Math.sqrt(square / n), max, min, pp: max - min };
}

/**
 * Fourier coefficients of one period of uniformly sampled data: harmonics 1…count as
 * { order, amplitude (peak), rms, phase (degrees, sine reference) }, plus the DC term and THD.
 */
export function harmonics(values, count = 25) {
  const n = values.length;
  const list = [];
  let dc = 0;
  for (const v of values) dc += v;
  dc /= n;
  for (let order = 1; order <= count; order += 1) {
    let a = 0, b = 0;
    for (let k = 0; k < n; k += 1) { const angle = TAU * order * k / n; a += values[k] * Math.cos(angle); b += values[k] * Math.sin(angle); }
    a *= 2 / n; b *= 2 / n;
    const amplitude = Math.hypot(a, b);
    list.push({ order, amplitude, rms: amplitude / Math.SQRT2, phase: Math.atan2(a, b) / DEG });
  }
  const fundamental = list[0].rms;
  const distortion = Math.sqrt(list.slice(1).reduce((sum, h) => sum + h.rms * h.rms, 0));
  return { dc, list, thd: fundamental > 1e-12 ? distortion / fundamental : null };
}

/** THD from the total RMS (all harmonics, not just the first `count`): √(Irms² − I1² − Idc²) / I1. */
function totalThd(values, fundamentalRms, dc = 0) {
  const { rms } = periodStats(values);
  return fundamentalRms > 1e-12 ? Math.sqrt(Math.max(0, rms * rms - fundamentalRms * fundamentalRms - dc * dc)) / fundamentalRms : null;
}

// ---------------------------------------------------------------------------
// Rectifiers.

export const RECTIFIERS = Object.freeze({
  'half-wave': { phases: 1, label: 'Single-phase half-wave' },
  'half-wave-fwd': { phases: 1, label: 'Single-phase half-wave with freewheeling diode' },
  'full-bridge': { phases: 1, label: 'Single-phase full converter (bridge / centre-tap)' },
  'semi-bridge': { phases: 1, label: 'Single-phase semi-converter (half-controlled bridge)' },
  'three-pulse': { phases: 3, label: 'Three-phase half-wave (3-pulse)' },
  'six-pulse': { phases: 3, label: 'Three-phase full converter (6-pulse bridge)' },
});

/**
 * Steady-state waveforms of a rectifier with ideal devices. `alpha` is the firing angle in
 * degrees (diodes: controlled = false). Long gate pulses: a thyristor fires as soon as it is
 * forward biased within its window. Load: R, L (series) and back-EMF E; or a smoothing
 * capacitor C across R (diode rectifiers). Vm is the peak phase voltage.
 */
export function simulateRectifier({ type = 'full-bridge', controlled = true, alpha = 30, vm = 325.27, frequency = 50, r = 10, l = 0, e = 0, c = 0, stepsPerCycle = 3600, maxCycles = 400 } = {}) {
  const spec = RECTIFIERS[type];
  if (!spec) throw new RangeError(`Unknown rectifier "${type}".`);
  if (!(r > 0)) throw new RangeError('Load resistance must be positive.');
  if (l < 0 || c < 0) throw new RangeError('L and C cannot be negative.');
  const firing = controlled ? Math.min(180, Math.max(0, Number(alpha))) * DEG : 0;
  if (c > 0 && (controlled || l > 0 || e)) throw new RangeError('The capacitor filter is modelled for diode rectifiers with a resistive load.');
  const omega = TAU * frequency, dt = 1 / (frequency * stepsPerCycle), dTheta = TAU / stepsPerCycle;
  const phaseVoltage = (theta, phase) => vm * Math.sin(theta - phase * 120 * DEG);
  // Gate windows (long pulses). Single phase: positive pair from α to π, negative from π + α to 2π.
  const wrap = (x) => ((x % TAU) + TAU) % TAU;
  const inWindow = (theta, start, width) => !controlled || wrap(theta - start) < width;
  const settleCycles = l > 0 ? Math.min(maxCycles, Math.ceil(6 * l / r * frequency) + 4) : c > 0 ? Math.min(maxCycles, Math.ceil(6 * r * c * frequency) + 4) : 2;
  let i = 0, vc = 0, state = 'off', top = -1, bottom = -1;
  const record = { theta: [], vs: [], vo: [], io: [], is: [], vt: [], phases: [] };
  const total = settleCycles * stepsPerCycle;
  for (let step = 0; step <= total; step += 1) {
    const theta = step * dTheta;
    let vo, is = 0, vt = 0;
    if (spec.phases === 1) {
      const vs = vm * Math.sin(theta);
      if (c > 0) {
        // Capacitor-input filter: diodes conduct while the rectified source exceeds the capacitor.
        const rectified = type === 'full-bridge' || type === 'semi-bridge' ? Math.abs(vs) : Math.max(0, vs);
        const slope = type === 'full-bridge' || type === 'semi-bridge' ? omega * vm * Math.cos(theta) * Math.sign(vs) : omega * vm * Math.cos(theta);
        const charging = rectified >= vc && c * slope + rectified / r > 0;
        if (charging) { vc = rectified; i = c * slope + vc / r; } else { i = 0; vc -= vc / (r * c) * dt; }
        vo = vc; is = vs >= 0 ? i : -i; if (type.startsWith('half')) is = vs >= 0 ? i : 0;
        vt = vs - vo;
      } else {
        const positive = vs, negative = -vs;
        // Firing: a gated pair turns on when it would raise the output above its present value.
        const present = state === 'P' ? positive : state === 'N' ? negative : state === 'FW' ? 0 : e;
        const gateP = inWindow(theta, firing, Math.PI - firing + 1e-9), gateN = inWindow(theta, Math.PI + firing, Math.PI - firing + 1e-9);
        if (type === 'half-wave' || type === 'half-wave-fwd') {
          if (state !== 'P' && gateP && positive > present) state = 'P';
          if (type === 'half-wave-fwd' && state === 'P' && positive < 0) state = i > 0 || l === 0 ? 'FW' : 'off';
        } else {
          if (state !== 'P' && gateP && positive > present) state = 'P';
          else if (state !== 'N' && gateN && negative > present) state = 'N';
          if (type === 'semi-bridge' && ((state === 'P' && positive < 0) || (state === 'N' && negative < 0))) state = 'FW';
        }
        vo = state === 'P' ? positive : state === 'N' ? negative : state === 'FW' ? 0 : e;
        if (l > 0) {
          if (state !== 'off') { i += (vo - r * i - e) / l * dt; if (i <= 0) { i = 0; state = 'off'; vo = e; } }
        } else {
          i = (vo - e) / r;
          if (i < 0 || (state === 'FW' && l === 0)) { i = 0; state = 'off'; vo = e; }
        }
        if (state === 'off') vo = e;
        is = state === 'P' ? i : state === 'N' ? -i : 0;
        // Voltage across thyristor T1 (anode to cathode): zero while it conducts.
        vt = state === 'P' ? 0 : type.startsWith('half-wave') ? vs - (state === 'FW' ? 0 : e) : state === 'N' ? vs : state === 'FW' ? 0 : (vs - e) / 2; // bridge: T1 blocks vs while T3/T4 conduct, shares vs − E with T2 when all are off
      }
      if (step >= total - stepsPerCycle) { record.theta.push(theta % TAU || (step === total ? TAU : 0)); record.vs.push(vs); record.vo.push(vo); record.io.push(i); record.is.push(is); record.vt.push(vt); }
    } else {
      // Three phase. Top-group thyristor x is gated for 120° from α + 30° + 120°·x (its natural
      // commutation point is 30° after the phase voltage zero); bottom group 180° later.
      const v = [0, 1, 2].map((phase) => phaseVoltage(theta, phase));
      const gatedTop = [0, 1, 2].filter((phase) => inWindow(theta, firing + 30 * DEG + phase * 120 * DEG, 120 * DEG + 1e-9));
      const gatedBottom = [0, 1, 2].filter((phase) => inWindow(theta, firing + 210 * DEG + phase * 120 * DEG, 120 * DEG + 1e-9));
      const six = type === 'six-pulse';
      const output = (t, b) => v[t] - (six ? v[b] : 0);
      if (top >= 0) {
        const better = gatedTop.filter((phase) => v[phase] > v[top]).sort((a, b) => v[b] - v[a])[0];
        if (better !== undefined) top = better;
      }
      if (six && bottom >= 0) {
        const better = gatedBottom.filter((phase) => v[phase] < v[bottom]).sort((a, b) => v[a] - v[b])[0];
        if (better !== undefined) bottom = better;
      }
      if (top < 0 || (six && bottom < 0)) {
        // Starting conduction needs a gated pair whose voltage exceeds E.
        const candidates = [];
        for (const t of gatedTop) for (const b of six ? gatedBottom : [null]) if (b !== t) candidates.push([t, b, output(t, b)]);
        const best = candidates.filter(([, , value]) => value > e).sort((a, b) => b[2] - a[2])[0];
        if (best) { top = best[0]; bottom = six ? best[1] : -1; }
      }
      const on = top >= 0 && (!six || bottom >= 0);
      vo = on ? output(top, bottom) : e;
      if (on) {
        if (l > 0) { i += (vo - r * i - e) / l * dt; if (i <= 0) { i = 0; top = -1; bottom = -1; vo = e; } }
        else { i = (vo - e) / r; if (i < 0) { i = 0; top = -1; bottom = -1; vo = e; } }
      }
      const ia = (top === 0 ? i : 0) - (six && bottom === 0 ? i : 0);
      if (step >= total - stepsPerCycle) { record.theta.push(theta % TAU); record.vs.push(v[0]); record.phases.push(v); record.vo.push(vo); record.io.push(i); record.is.push(ia); record.vt.push(v[0] - (top >= 0 ? v[top] : vo + (six && bottom >= 0 ? v[bottom] : 0))); }
    }
  }
  // Drop the duplicated end point so the record is exactly one period.
  for (const key of Object.keys(record)) if (record[key].length > stepsPerCycle) record[key] = record[key].slice(0, stepsPerCycle);
  const vo = periodStats(record.vo), io = periodStats(record.io), is = periodStats(record.is), vs = periodStats(record.vs);
  const ih = harmonics(record.is, 25);
  const power = record.vo.reduce((sum, value, k) => sum + value * record.io[k], 0) / record.vo.length;
  const sourceVa = (spec.phases === 3 ? 3 : 1) * vs.rms * is.rms;
  const displacement = ih.list[0].amplitude > 1e-12 ? Math.cos(ih.list[0].phase * DEG) : null;
  return {
    type, controlled, alpha: firing / DEG, frequency, vm, waveform: record,
    vdc: vo.mean, vrms: vo.rms, idc: io.mean, irms: io.rms, ripple: vo.pp,
    formFactor: vo.mean > 1e-9 ? vo.rms / vo.mean : null, rippleFactor: vo.mean > 1e-9 ? Math.sqrt(Math.max(0, vo.rms ** 2 - vo.mean ** 2)) / vo.mean : null,
    loadPower: power, sourceCurrentRms: is.rms, inputPowerFactor: sourceVa > 1e-12 ? power / sourceVa : null, displacementFactor: displacement,
    currentThd: totalThd(record.is, ih.list[0].rms, ih.dc), sourceHarmonics: ih.list,
    continuous: l > 0 ? Math.min(...record.io) > io.max * 1e-6 : null,
    theory: rectifierTheory({ type, controlled, alpha: firing / DEG, vm, r, l, e, c, frequency }),
  };
}

/** Textbook output-voltage formulas (ideal devices, no source inductance). */
export function rectifierTheory({ type, controlled = true, alpha = 0, vm, r, l = 0, e = 0, c = 0, frequency = 50 }) {
  const a = (controlled ? alpha : 0) * DEG;
  if (c > 0) {
    const pulses = type === 'half-wave' || type === 'half-wave-fwd' ? 1 : 2;
    const ripple = vm / (pulses * frequency * r * c);
    return { vdc: vm - ripple / 2, ripple, note: 'Capacitor filter, Vr ≈ Vm / (p·f·R·C)' };
  }
  const resistive = l === 0 && e === 0;
  switch (type) {
    case 'half-wave': return resistive ? { vdc: vm / TAU * (1 + Math.cos(a)), vrms: vm / 2 * Math.sqrt((Math.PI - a + Math.sin(2 * a) / 2) / Math.PI), note: 'R load: Vdc = Vm(1 + cos α) / 2π' } : { note: 'RL load: conduction continues past π until the current falls to zero (extinction angle β).' };
    case 'half-wave-fwd': return { vdc: vm / TAU * (1 + Math.cos(a)), note: 'Freewheeling diode: Vdc = Vm(1 + cos α) / 2π' };
    case 'full-bridge': return resistive ? { vdc: vm / Math.PI * (1 + Math.cos(a)), vrms: vm / Math.SQRT2 * Math.sqrt((Math.PI - a + Math.sin(2 * a) / 2) / Math.PI), note: 'R load: Vdc = Vm(1 + cos α) / π' } : { vdc: 2 * vm / Math.PI * Math.cos(a), note: 'Continuous current: Vdc = 2Vm cos α / π' };
    case 'semi-bridge': return { vdc: vm / Math.PI * (1 + Math.cos(a)), note: 'Vdc = Vm(1 + cos α) / π' };
    case 'three-pulse': return resistive && a > 30 * DEG ? { vdc: 3 * vm / TAU * (1 + Math.cos(a + 30 * DEG)), note: 'R load, α > 30°: Vdc = 3Vm[1 + cos(α + 30°)] / 2π' } : { vdc: 3 * Math.sqrt(3) * vm / TAU * Math.cos(a), note: 'Continuous: Vdc = 3√3·Vm cos α / 2π' };
    case 'six-pulse': return resistive && a > 60 * DEG ? { vdc: 3 * Math.sqrt(3) * vm / Math.PI * (1 + Math.cos(a + 60 * DEG)), note: 'R load, α > 60°: Vdc = 3√3·Vm[1 + cos(α + 60°)] / π' } : { vdc: 3 * Math.sqrt(3) * vm / Math.PI * Math.cos(a), note: 'Continuous: Vdc = 3√3·Vm cos α / π = 1.35·VLL cos α' };
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// DC-DC converters.

export const CONVERTERS = Object.freeze({ buck: 'Buck (step-down)', boost: 'Boost (step-up)', 'buck-boost': 'Buck-boost (inverting)' });

/** Ideal-converter formulas for CCM and DCM. K = 2Lf/R. */
export function converterTheory({ type, vin, duty: d, frequency: f, l, c, r }) {
  const k = 2 * l * f / r;
  const out = { type };
  if (type === 'buck') {
    out.criticalL = (1 - d) * r / (2 * f);
    out.ccm = l >= out.criticalL;
    out.ratio = out.ccm ? d : 2 / (1 + Math.sqrt(1 + 4 * k / (d * d)));
    out.vo = out.ratio * vin;
    out.rippleI = out.ccm ? (vin - out.vo) * d / (l * f) : null;
    out.rippleV = out.ccm ? out.rippleI / (8 * f * c) : null;
    out.il = out.vo / r;
  } else if (type === 'boost') {
    out.criticalL = d * (1 - d) ** 2 * r / (2 * f);
    out.ccm = l >= out.criticalL;
    out.ratio = out.ccm ? 1 / (1 - d) : (1 + Math.sqrt(1 + 4 * d * d / k)) / 2;
    out.vo = out.ratio * vin;
    out.rippleI = out.ccm ? vin * d / (l * f) : null;
    out.rippleV = out.ccm ? out.vo * d / (r * c * f) : null;
    out.il = out.vo * out.vo / r / vin; // the inductor carries the input current
  } else if (type === 'buck-boost') {
    out.criticalL = (1 - d) ** 2 * r / (2 * f);
    out.ccm = l >= out.criticalL;
    out.ratio = out.ccm ? -d / (1 - d) : -d / Math.sqrt(k);
    out.vo = out.ratio * vin;
    out.rippleI = out.ccm ? vin * d / (l * f) : null;
    out.rippleV = out.ccm ? Math.abs(out.vo) * d / (r * c * f) : null;
    out.il = out.ccm ? out.vo * out.vo / r / vin / d : null;
  } else throw new RangeError(`Unknown converter "${type}".`);
  return out;
}

/**
 * Switching waveforms of a DC-DC converter in steady state (ideal switch and diode, R load).
 * Integrates the inductor current and capacitor voltage through each switching period; the
 * diode turns off when the inductor current reaches zero (DCM).
 */
export function simulateConverter({ type = 'buck', vin = 12, duty = 0.5, frequency = 50e3, l = 100e-6, c = 100e-6, r = 10, stepsPerPeriod = 1000, maxPeriods = 20000 } = {}) {
  if (!CONVERTERS[type]) throw new RangeError(`Unknown converter "${type}".`);
  if (!(duty > 0 && duty < 1)) throw new RangeError('Duty cycle must be between 0 and 1.');
  for (const [name, value] of [['Frequency', frequency], ['L', l], ['C', c], ['R', r], ['Input voltage', vin]]) if (!(value > 0)) throw new RangeError(`${name} must be positive.`);
  const theory = converterTheory({ type, vin, duty, frequency, l, c, r });
  const period = 1 / frequency, dt = period / stepsPerPeriod, onSteps = Math.round(duty * stepsPerPeriod);
  // State: inductor current iL (≥ 0) and capacitor voltage magnitude v. Start from the ideal steady state.
  let il = Math.max(0, theory.il ?? theory.vo * theory.vo / r / vin), v = Math.abs(theory.vo);
  const derivative = (on, current, volts) => {
    let dil, dv;
    if (type === 'buck') { dil = on ? (vin - volts) / l : -volts / l; dv = (current - volts / r) / c; }
    else if (type === 'boost') { dil = on ? vin / l : (vin - volts) / l; dv = on ? -volts / r / c : (current - volts / r) / c; }
    else { dil = on ? vin / l : -volts / l; dv = on ? -volts / r / c : (current - volts / r) / c; }
    return [dil, dv];
  };
  const advance = (on) => {
    // Heun's method; the inductor current is clamped at zero while the diode blocks (DCM).
    const [a1, b1] = derivative(on, il, v);
    let il2 = il + a1 * dt, v2 = v + b1 * dt;
    const conducting = on || il > 0;
    if (!conducting || (!on && il2 < 0)) il2 = Math.max(0, il2);
    const [a2, b2] = derivative(on, il2, v2);
    let nextIl = il + (a1 + a2) / 2 * dt;
    const nextV = v + (b1 + b2) / 2 * dt;
    if (!on && nextIl < 0) nextIl = 0;
    if (!on && il === 0) { nextIl = 0; }
    return [nextIl, nextV, conducting];
  };
  let previous = null, periods = 0;
  for (; periods < maxPeriods; periods += 1) {
    const startIl = il, startV = v;
    for (let k = 0; k < stepsPerPeriod; k += 1) {
      const on = k < onSteps;
      let conducting;
      [il, v, conducting] = advance(on);
      if (!on && !conducting) il = 0;
    }
    if (previous && Math.abs(v - startV) < 1e-7 * Math.max(1, v) && Math.abs(il - startIl) < 1e-7 * Math.max(1, Math.abs(il))) break;
    previous = [startIl, startV];
  }
  // Record two periods.
  const wave = { t: [], gate: [], il: [], vo: [], isw: [], idiode: [], vsw: [] };
  for (let k = 0; k < 2 * stepsPerPeriod; k += 1) {
    const on = k % stepsPerPeriod < onSteps;
    const diode = !on && il > 0;
    const vo = type === 'buck-boost' ? -v : v;
    wave.t.push(k * dt); wave.gate.push(on ? 1 : 0); wave.il.push(il); wave.vo.push(vo);
    wave.isw.push(on ? il : 0); wave.idiode.push(diode ? il : 0);
    wave.vsw.push(on ? 0 : type === 'buck' ? (diode ? vin : vin - v) : type === 'boost' ? (diode ? v : vin) : (diode ? vin + v : vin));
    [il, v] = advance(on);
  }
  const ilStats = periodStats(wave.il.slice(0, stepsPerPeriod)), voStats = periodStats(wave.vo.slice(0, stepsPerPeriod));
  const zeroTime = wave.il.slice(0, stepsPerPeriod).filter((value) => value <= 1e-9).length / stepsPerPeriod;
  return {
    type, waveform: wave, periods,
    vo: voStats.mean, rippleV: voStats.pp, ilAverage: ilStats.mean, ilMax: ilStats.max, ilMin: ilStats.min, rippleI: ilStats.pp,
    mode: zeroTime > 0.002 ? 'DCM' : 'CCM', ratio: voStats.mean / vin, outputPower: voStats.rms ** 2 / r,
    theory,
  };
}

// ---------------------------------------------------------------------------
// Inverters.

export const INVERTERS = Object.freeze({ square: 'Square wave (180°)', 'quasi-square': 'Quasi-square (pulse width)', 'spwm-bipolar': 'Sinusoidal PWM, bipolar', 'spwm-unipolar': 'Sinusoidal PWM, unipolar', 'three-phase-six-step': 'Three-phase, 180° six-step', 'three-phase-spwm': 'Three-phase SPWM' });

/**
 * Output of a voltage-source inverter over one fundamental period (sampled), the load current
 * of a series R-L load in steady state (by harmonic superposition) and the spectrum.
 * Three-phase modes give the line voltage vab and the phase (load star) voltage van.
 */
export function simulateInverter({ mode = 'spwm-bipolar', vdc = 400, frequency = 50, ma = 0.8, mf = 21, width = 120, r = 10, l = 0.02, samples = 16384, harmonicsCount = 99 } = {}) {
  if (!INVERTERS[mode]) throw new RangeError(`Unknown inverter mode "${mode}".`);
  if (!(ma >= 0)) throw new RangeError('Modulation index must be zero or positive.');
  const t = Array.from({ length: samples }, (_, k) => k / samples / frequency);
  const theta = t.map((time) => TAU * frequency * time);
  const carrier = (x) => { const u = ((x * mf / TAU) % 1 + 1) % 1; return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; }; // triangle −1…1 synchronised to the reference
  const leg = (x, shift) => {
    // Pole voltage (relative to the DC midpoint) of a leg following reference sin(x − shift).
    const reference = ma * Math.sin(x - shift);
    if (mode === 'three-phase-six-step') return (Math.sin(x - shift) >= 0 ? 0.5 : -0.5) * vdc;
    return (reference >= carrier(x) ? 0.5 : -0.5) * vdc;
  };
  let vo, vphase = null;
  if (mode === 'square') vo = theta.map((x) => (Math.sin(x) >= 0 ? vdc : -vdc));
  else if (mode === 'quasi-square') { const half = width * DEG / 2; vo = theta.map((x) => { const u = ((x % TAU) + TAU) % TAU; return Math.abs(u - Math.PI / 2) < half ? vdc : Math.abs(u - 3 * Math.PI / 2) < half ? -vdc : 0; }); }
  else if (mode === 'spwm-bipolar') vo = theta.map((x) => (ma * Math.sin(x) >= carrier(x) ? vdc : -vdc));
  else if (mode === 'spwm-unipolar') vo = theta.map((x) => ((ma * Math.sin(x) >= carrier(x) ? 1 : 0) - (-ma * Math.sin(x) >= carrier(x) ? 1 : 0)) * vdc);
  else {
    const poles = theta.map((x) => [0, 1, 2].map((p) => leg(x, p * 120 * DEG)));
    vo = poles.map(([a, b]) => a - b); // line voltage vab
    vphase = poles.map(([a, b, c]) => (2 * a - b - c) / 3);
  }
  const loadVoltage = vphase ?? vo;
  const spectrum = harmonics(vo, harmonicsCount);
  const phaseSpectrum = vphase ? harmonics(vphase, harmonicsCount) : spectrum;
  // Load current: superpose the steady-state response of R + jωL to each harmonic.
  const omega = TAU * frequency;
  const current = new Array(samples).fill(0);
  for (const h of phaseSpectrum.list) {
    if (h.amplitude < 1e-9 * vdc) continue;
    const z = Math.hypot(r, h.order * omega * l), lag = Math.atan2(h.order * omega * l, r);
    for (let k = 0; k < samples; k += 1) current[k] += h.amplitude / z * Math.sin(h.order * theta[k] + h.phase * DEG - lag);
  }
  if (Math.abs(phaseSpectrum.dc) > 1e-9 && r > 0) for (let k = 0; k < samples; k += 1) current[k] += phaseSpectrum.dc / r;
  const fundamental = spectrum.list[0];
  return {
    mode, waveform: { t, vo, vphase, io: current },
    fundamentalPeak: fundamental.amplitude, fundamentalRms: fundamental.rms, vrms: periodStats(vo).rms,
    voltageThd: totalThd(vo, fundamental.rms, spectrum.dc), currentThd: totalThd(current, harmonics(current, 1).list[0].rms),
    spectrum: spectrum.list, phaseSpectrum: vphase ? phaseSpectrum.list : null, loadPower: periodStats(current).rms ** 2 * r,
    theory: inverterTheory({ mode, vdc, ma, width }),
  };
}

export function inverterTheory({ mode, vdc, ma = 1, width = 180 }) {
  switch (mode) {
    case 'square': return { fundamentalPeak: 4 * vdc / Math.PI, vrms: vdc, thd: Math.sqrt(Math.PI ** 2 / 8 - 1), note: 'V1 = 4Vdc/π, THD = 48.3 %' };
    case 'quasi-square': return { fundamentalPeak: 4 * vdc / Math.PI * Math.sin(width * DEG / 2), vrms: vdc * Math.sqrt(width / 180), note: 'V1 = (4Vdc/π)·sin(pulse width / 2)' };
    case 'spwm-bipolar': case 'spwm-unipolar': return ma <= 1 ? { fundamentalPeak: ma * vdc, note: 'Linear region: V1 = ma·Vdc' } : { note: 'Over-modulation (ma > 1): V1 grows less than linearly towards 4Vdc/π.' };
    case 'three-phase-six-step': return { fundamentalPeak: 2 * Math.sqrt(3) / Math.PI * vdc, vrms: Math.sqrt(2 / 3) * vdc, note: 'Line voltage V1 = (2√3/π)·Vdc (0.78·Vdc RMS)' };
    case 'three-phase-spwm': return ma <= 1 ? { fundamentalPeak: Math.sqrt(3) / 2 * ma * vdc, note: 'Line voltage V1 = (√3/2)·ma·Vdc' } : { note: 'Over-modulation (ma > 1).' };
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// AC voltage controller (single-phase, back-to-back SCRs / triac).

export function simulateAcController({ vm = 325.27, frequency = 50, alpha = 60, r = 10, l = 0, stepsPerCycle = 3600 } = {}) {
  const a = Math.min(180, Math.max(0, alpha)) * DEG;
  const dt = 1 / (frequency * stepsPerCycle), dTheta = TAU / stepsPerCycle;
  const cycles = l > 0 ? Math.min(200, Math.ceil(6 * l / r * frequency) + 3) : 1;
  let i = 0, on = 0;
  const wave = { theta: [], vs: [], vo: [], io: [] };
  for (let step = 0; step < cycles * stepsPerCycle; step += 1) {
    const theta = step * dTheta, u = theta % TAU, vs = vm * Math.sin(theta);
    // Gate pulses (long): forward SCR from α to π, reverse SCR from π + α to 2π.
    if (!on && u >= a && u < Math.PI && vs > 0) on = 1;
    if (!on && u >= Math.PI + a && vs < 0) on = -1;
    if (on) {
      if (l > 0) { const next = i + (vs - r * i) / l * dt; if (Math.sign(next) !== on && next !== 0) { i = 0; on = 0; } else i = next; }
      else { i = vs / r; if (Math.sign(i) !== on) { i = 0; on = 0; } }
    }
    const vo = on ? vs : 0;
    if (step >= (cycles - 1) * stepsPerCycle) { wave.theta.push(u); wave.vs.push(vs); wave.vo.push(vo); wave.io.push(i); }
  }
  const vo = periodStats(wave.vo), io = periodStats(wave.io);
  const ih = harmonics(wave.io, 15);
  const vsRms = vm / Math.SQRT2;
  const power = wave.vo.reduce((sum, v, k) => sum + v * wave.io[k], 0) / wave.vo.length;
  return {
    waveform: wave, vrms: vo.rms, irms: io.rms, power, powerFactor: power / (vsRms * io.rms || 1), currentThd: totalThd(wave.io, ih.list[0].rms), harmonics: ih.list,
    theory: l === 0 ? { vrms: vsRms * Math.sqrt((Math.PI - a + Math.sin(2 * a) / 2) / Math.PI), note: 'R load: Vo = Vs·√[(π − α + sin 2α / 2) / π]' } : { note: 'RL load: no control below α = load angle φ = tan⁻¹(ωL/R).' },
  };
}
