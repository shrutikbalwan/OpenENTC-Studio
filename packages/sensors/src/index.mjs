// Sensors and signal conditioning: thermocouples (NIST ITS-90 reference functions), Pt RTDs
// (IEC 60751 Callendar–Van Dusen), NTC thermistors (β and Steinhart–Hart), strain-gauge
// Wheatstone bridges, LVDTs, instrumentation-amplifier design and a full sensor → amplifier →
// ADC → temperature measurement chain.

/**
 * NIST SRD 60 / ITS-90 thermocouple reference functions: E (mV) = Σ cᵢ·tⁱ (t in °C), plus
 * a₀·exp(a₁(t − a₂)²) for type K above 0 °C. Each entry: [tMin, tMax, c[], gaussian?].
 */
export const THERMOCOUPLE_COEFFICIENTS = Object.freeze({
  E: [[-270.0, 0.0, [0.0, 0.058665508708, 4.5410977124e-05, -7.7998048686e-07, -2.5800160843e-08, -5.9452583057e-10, -9.3214058667e-12, -1.0287605534e-13, -8.0370123621e-16, -4.3979497391e-18, -1.6414776355e-20, -3.9673619516e-23, -5.5827328721e-26, -3.4657842013e-29]], [0.0, 1000.0, [0.0, 0.05866550871, 4.5032275582e-05, 2.8908407212e-08, -3.3056896652e-10, 6.502440327e-13, -1.9197495504e-16, -1.2536600497e-18, 2.1489217569e-21, -1.4388041782e-24, 3.5960899481e-28]]],
  J: [[-210.0, 760.0, [0.0, 0.050381187815, 3.047583693e-05, -8.568106572e-08, 1.3228195295e-10, -1.7052958337e-13, 2.0948090697e-16, -1.2538395336e-19, 1.5631725697e-23]], [760.0, 1200.0, [296.45625681, -1.4976127786, 0.0031787103924, -3.1847686701e-06, 1.5720819004e-09, -3.0691369056e-13]]],
  K: [[-270.0, 0.0, [0.0, 0.039450128025, 2.3622373598e-05, -3.2858906784e-07, -4.9904828777e-09, -6.7509059173e-11, -5.7410327428e-13, -3.1088872894e-15, -1.0451609365e-17, -1.9889266878e-20, -1.6322697486e-23]], [0.0, 1372.0, [-0.017600413686, 0.038921204975, 1.8558770032e-05, -9.9457592874e-08, 3.1840945719e-10, -5.6072844889e-13, 5.6075059059e-16, -3.2020720003e-19, 9.7151147152e-23, -1.2104721275e-26], [0.1185976, -0.0001183432, 126.9686]]],
  N: [[-270.0, 0.0, [0.0, 0.026159105962, 1.0957484228e-05, -9.3841111554e-08, -4.6412039759e-11, -2.6303357716e-12, -2.2653438003e-14, -7.6089300791e-17, -9.3419667835e-20]], [0.0, 1300.0, [0.0, 0.025929394601, 1.571014188e-05, 4.3825627237e-08, -2.5261169794e-10, 6.4311819339e-13, -1.0063471519e-15, 9.9745338992e-19, -6.0863245607e-22, 2.0849229339e-25, -3.0682196151e-29]]],
  T: [[-270.0, 0.0, [0.0, 0.038748106364, 4.4194434347e-05, 1.1844323105e-07, 2.0032973554e-08, 9.0138019559e-10, 2.2651156593e-11, 3.6071154205e-13, 3.8493939883e-15, 2.8213521925e-17, 1.4251594779e-19, 4.8768662286e-22, 1.079553927e-24, 1.3945027062e-27, 7.9795153927e-31]], [0.0, 400.0, [0.0, 0.038748106364, 3.329222788e-05, 2.0618243404e-07, -2.1882256846e-09, 1.0996880928e-11, -3.0815758772e-14, 4.547913529e-17, -2.7512901673e-20]]],
});
export const THERMOCOUPLE_TYPES = Object.freeze({ K: 'Type K (chromel–alumel)', J: 'Type J (iron–constantan)', T: 'Type T (copper–constantan)', E: 'Type E (chromel–constantan)', N: 'Type N (nicrosil–nisil)' });

function tcRange(type) {
  const table = THERMOCOUPLE_COEFFICIENTS[type];
  if (!table) throw new RangeError(`Unknown thermocouple type "${type}".`);
  return [table[0][0], table.at(-1)[1]];
}

/** Thermoelectric voltage (mV) with the reference junction at 0 °C. */
export function thermocoupleEmf(type, celsius) {
  const table = THERMOCOUPLE_COEFFICIENTS[type];
  const [low, high] = tcRange(type);
  if (!(celsius >= low && celsius <= high)) throw new RangeError(`Type ${type} covers ${low} °C to ${high} °C.`);
  const [, , coefficients, gaussian] = table.find(([from, to]) => celsius >= from && celsius <= to);
  let emf = 0;
  for (let k = coefficients.length - 1; k >= 0; k -= 1) emf = emf * celsius + coefficients[k];
  if (gaussian) emf += gaussian[0] * Math.exp(gaussian[1] * (celsius - gaussian[2]) ** 2);
  return emf;
}

/** Seebeck coefficient dE/dT (µV/°C) at a temperature. */
export function seebeck(type, celsius) {
  const [low, high] = tcRange(type);
  const h = 0.01, a = Math.max(low, celsius - h), b = Math.min(high, celsius + h);
  return (thermocoupleEmf(type, b) - thermocoupleEmf(type, a)) / (b - a) * 1000;
}

/** Temperature (°C) for an EMF (mV, reference at 0 °C): bisection on the exact reference function. */
export function thermocoupleTemperature(type, millivolts) {
  let [low, high] = tcRange(type);
  if (millivolts < thermocoupleEmf(type, low) || millivolts > thermocoupleEmf(type, high)) throw new RangeError(`${millivolts} mV is outside the type ${type} table.`);
  for (let k = 0; k < 80; k += 1) { const mid = (low + high) / 2; if (thermocoupleEmf(type, mid) < millivolts) low = mid; else high = mid; }
  return (low + high) / 2;
}

/**
 * Cold-junction compensation: the voltmeter sees E(T_hot) − E(T_cold). Returns the compensated
 * temperature and, for comparison, the error of skipping compensation or using a straight line.
 */
export function coldJunction({ type = 'K', measuredMv, coldC = 25 }) {
  const compensated = thermocoupleTemperature(type, measuredMv + thermocoupleEmf(type, coldC));
  const linear = coldC + measuredMv / (seebeck(type, 0) / 1000);
  return { hotC: compensated, uncompensatedC: thermocoupleTemperature(type, measuredMv), linearC: linear, coldEmf: thermocoupleEmf(type, coldC) };
}

// ---------------------------------------------------------------------------
// Resistance thermometers.

export const IEC_60751 = Object.freeze({ a: 3.9083e-3, b: -5.775e-7, c: -4.183e-12 });

/** Platinum RTD resistance (Callendar–Van Dusen, IEC 60751), −200 °C to 850 °C. */
export function rtdResistance(celsius, { r0 = 100, a = IEC_60751.a, b = IEC_60751.b, c = IEC_60751.c } = {}) {
  if (!(celsius >= -200 && celsius <= 850)) throw new RangeError('Platinum RTDs are specified from −200 °C to 850 °C.');
  return r0 * (1 + a * celsius + b * celsius ** 2 + (celsius < 0 ? c * (celsius - 100) * celsius ** 3 : 0));
}

/** Temperature of a platinum RTD: closed form above 0 °C, Newton iteration below. */
export function rtdTemperature(ohms, { r0 = 100, a = IEC_60751.a, b = IEC_60751.b, c = IEC_60751.c } = {}) {
  const ratio = ohms / r0;
  if (ratio >= 1) return (-a + Math.sqrt(a * a - 4 * b * (1 - ratio))) / (2 * b);
  let t = (ratio - 1) / a;
  for (let k = 0; k < 50; k += 1) {
    const f = 1 + a * t + b * t * t + c * (t - 100) * t ** 3 - ratio;
    const df = a + 2 * b * t + c * (4 * t ** 3 - 300 * t * t);
    const step = f / df;
    t -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return t;
}

/** NTC thermistor, β model: R = R25·exp(β(1/T − 1/298.15)). */
export function ntcResistance(celsius, { r25 = 10_000, beta = 3950 } = {}) {
  return r25 * Math.exp(beta * (1 / (celsius + 273.15) - 1 / 298.15));
}
export function ntcTemperatureBeta(ohms, { r25 = 10_000, beta = 3950 } = {}) {
  return 1 / (1 / 298.15 + Math.log(ohms / r25) / beta) - 273.15;
}

/** Steinhart–Hart coefficients through three (°C, Ω) points: 1/T = A + B·ln R + C·(ln R)³. */
export function steinhartHart(points) {
  if (points.length !== 3) throw new RangeError('Steinhart–Hart needs exactly three calibration points.');
  const rows = points.map(([celsius, ohms]) => { const l = Math.log(ohms); return [1, l, l ** 3, 1 / (celsius + 273.15)]; });
  // Gaussian elimination on the 3×3 system.
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col] / rows[col][col];
      for (let k = col; k < 4; k += 1) rows[row][k] -= factor * rows[col][k];
    }
  }
  return { a: rows[0][3] / rows[0][0], b: rows[1][3] / rows[1][1], c: rows[2][3] / rows[2][2] };
}
export function steinhartTemperature(ohms, { a, b, c }) { const l = Math.log(ohms); return 1 / (a + b * l + c * l ** 3) - 273.15; }

/** LM35-style linear sensor: 10 mV/°C. */
export const lm35Voltage = (celsius) => celsius * 0.01;

// ---------------------------------------------------------------------------
// Bridges and displacement sensors.

/** Wheatstone bridge: arms R1–R2 (left divider) and R3–R4 (right); Vout = V(R2 node) − V(R4 node). */
export function wheatstone({ vex = 5, r1, r2, r3, r4 }) {
  // Left divider: R1 from +Vex to node A, R2 from A to ground. Right: R3 from +Vex to B, R4 from B to ground.
  const va = vex * r2 / (r1 + r2), vb = vex * r4 / (r3 + r4);
  return { va, vb, vout: va - vb, balanced: Math.abs(r1 * r4 - r2 * r3) < 1e-12 * Math.max(r1 * r4, 1) };
}

/**
 * Strain-gauge bridge output (exact, not the small-strain approximation). Quarter: one active
 * gauge; half: two gauges with opposite strain in adjacent arms (bending); full: four active.
 */
export function strainBridge({ vex = 5, gaugeFactor = 2.0, strain = 1e-3, config = 'quarter', r = 350 } = {}) {
  const x = gaugeFactor * strain; // ΔR/R
  let arms;
  if (config === 'quarter') arms = { r1: r, r2: r * (1 + x), r3: r, r4: r };
  else if (config === 'half') arms = { r1: r * (1 - x), r2: r * (1 + x), r3: r, r4: r };
  else if (config === 'full') arms = { r1: r * (1 - x), r2: r * (1 + x), r3: r * (1 + x), r4: r * (1 - x) };
  else throw new RangeError('Bridge configuration must be quarter, half or full.');
  const { vout } = wheatstone({ vex, ...arms });
  const factor = { quarter: 0.25, half: 0.5, full: 1 }[config];
  const linear = vex * factor * x;
  return { vout, linear, nonlinearityPercent: linear ? (vout - linear) / linear * 100 : 0, sensitivity: vout / strain / vex, deltaR: r * x, arms };
}

/** LVDT: output amplitude ∝ displacement (sensitivity in mV/V/mm); phase 0° or 180° by direction. */
export function lvdt({ displacementMm = 0, sensitivity = 50, vex = 3, rangeMm = 5, residualMv = 0 } = {}) {
  const inRange = Math.abs(displacementMm) <= rangeMm;
  const amplitude = Math.hypot(sensitivity * vex * Math.abs(displacementMm), residualMv);
  return { amplitudeMv: amplitude, phaseDeg: displacementMm >= 0 ? 0 : 180, signedMv: Math.sign(displacementMm) * sensitivity * vex * Math.abs(displacementMm), inRange };
}

// ---------------------------------------------------------------------------
// Signal conditioning.

export const INAMPS = Object.freeze({
  ad620: { label: 'AD620 (G = 1 + 49.4 kΩ / RG)', constant: 49_400 },
  ina128: { label: 'INA128 (G = 1 + 50 kΩ / RG)', constant: 50_000 },
  'three-opamp': { label: '3 op-amp, R = 10 kΩ (G = 1 + 2R / RG)', constant: 20_000 },
});

const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976];
/** Nearest E96 (1 %) resistor value. */
export function nearestE96(value) {
  const decade = 10 ** Math.floor(Math.log10(value) - 2);
  let best = null;
  for (const scale of [decade / 10, decade, decade * 10]) for (const base of E96) { const candidate = base * scale; if (!best || Math.abs(Math.log(candidate / value)) < Math.abs(Math.log(best / value))) best = candidate; }
  return Number(best.toPrecision(3));
}

/**
 * Design the gain stage that maps a sensor span onto an ADC input range: G = ΔV_ADC / ΔV_sensor,
 * output reference (level shift) V_REF = V_ADC,min − G·V_sensor,min, RG from the in-amp's gain
 * equation rounded to E96.
 */
export function designInamp({ sensorMin, sensorMax, adcMin = 0, adcMax = 5, inamp = 'ad620', marginPercent = 5 } = {}) {
  if (!(sensorMax > sensorMin)) throw new RangeError('Sensor maximum must exceed the minimum.');
  const spec = INAMPS[inamp];
  if (!spec) throw new RangeError(`Unknown in-amp "${inamp}".`);
  const usable = (adcMax - adcMin) * (1 - 2 * marginPercent / 100);
  const target = usable / (sensorMax - sensorMin);
  const rgIdeal = target > 1 ? spec.constant / (target - 1) : Infinity;
  const rg = Number.isFinite(rgIdeal) ? nearestE96(rgIdeal) : Infinity;
  const gain = Number.isFinite(rg) ? 1 + spec.constant / rg : 1;
  const centreIn = (sensorMin + sensorMax) / 2, centreOut = (adcMin + adcMax) / 2;
  const reference = centreOut - gain * centreIn;
  return { targetGain: target, rgIdeal, rg, gain, reference, outMin: reference + gain * sensorMin, outMax: reference + gain * sensorMax };
}

/**
 * Complete temperature measurement chain: sensor → (bridge/excitation) → in-amp → N-bit ADC →
 * temperature, using either the exact inverse of the sensor law or a straight-line fit.
 * Returns per-temperature voltages, codes and errors, plus resolution.
 */
export function measurementChain({ sensor = 'pt100', tMin = 0, tMax = 200, excitation = 1e-3, adcBits = 12, vref = 5, inamp = 'ad620', linearize = 'exact', points = 101, coldC = 25, beta = 3950, r25 = 10_000, divider = 10_000 } = {}) {
  const output = (t) => {
    if (sensor === 'pt100') return rtdResistance(t) * excitation;
    if (sensor === 'pt1000') return rtdResistance(t, { r0: 1000 }) * excitation;
    if (sensor === 'k-type') return (thermocoupleEmf('K', t) - thermocoupleEmf('K', coldC)) / 1000;
    if (sensor === 'ntc') { const r = ntcResistance(t, { r25, beta }); return vref * divider / (r + divider); }
    if (sensor === 'lm35') return lm35Voltage(t);
    throw new RangeError(`Unknown sensor "${sensor}".`);
  };
  const inverse = (v) => {
    if (sensor === 'pt100') return rtdTemperature(v / excitation);
    if (sensor === 'pt1000') return rtdTemperature(v / excitation, { r0: 1000 });
    if (sensor === 'k-type') return thermocoupleTemperature('K', v * 1000 + thermocoupleEmf('K', coldC));
    if (sensor === 'ntc') { const r = divider * (vref - v) / v; return ntcTemperatureBeta(r, { r25, beta }); }
    return v / 0.01;
  };
  const vLow = output(tMin), vHigh = output(tMax);
  const [sMin, sMax] = vLow < vHigh ? [vLow, vHigh] : [vHigh, vLow];
  const amp = designInamp({ sensorMin: sMin, sensorMax: sMax, adcMin: 0, adcMax: vref, inamp });
  const levels = 2 ** adcBits, lsb = vref / levels;
  const rows = [];
  for (let k = 0; k < points; k += 1) {
    const t = tMin + (tMax - tMin) * k / (points - 1);
    const v = output(t);
    const vAmp = amp.reference + amp.gain * v;
    const code = Math.max(0, Math.min(levels - 1, Math.floor(vAmp / lsb + 0.5)));
    const vBack = (code * lsb - amp.reference) / amp.gain;
    const tExact = inverse(vBack);
    const tLinear = tMin + (vBack - vLow) / (vHigh - vLow) * (tMax - tMin);
    const tReading = linearize === 'exact' ? tExact : tLinear;
    rows.push({ t, sensorV: v, ampV: vAmp, code, reading: tReading, error: tReading - t, linearError: tLinear - t, exactError: tExact - t });
  }
  const resolution = (tMax - tMin) / Math.abs((amp.gain * (vHigh - vLow)) / lsb);
  return { amp, rows, resolution, maxError: Math.max(...rows.map((row) => Math.abs(row.error))), maxLinearError: Math.max(...rows.map((row) => Math.abs(row.linearError))), sensorSpan: [vLow, vHigh] };
}
