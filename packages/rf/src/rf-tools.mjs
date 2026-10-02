// RF design tools: reflection/VSWR, Smith-chart impedance matching (L-network, single
// stub, quarter-wave), transmission-line input impedance and standing waves, line
// impedance calculators, linear antenna arrays and radio link budgets.
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csub } from '../../numerics/src/polynomial.mjs';

export const SPEED_OF_LIGHT = 299_792_458;
export const FREE_SPACE_IMPEDANCE = 376.730313668;

function bounded(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  return number;
}
const toComplex = (value, label) => {
  const z = typeof value === 'number' ? complex(value) : complex(Number(value?.re), Number(value?.im ?? 0));
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) throw new TypeError(`${label} must be a finite complex number.`);
  return z;
};
const ONE = complex(1);
const ctanh = (z) => { const e = cexp(cscale(z, 2)); return cdiv(csub(e, ONE), cadd(e, ONE)); };

// ---------------------------------------------------------------------------
// Reflection and mismatch.

export function reflection(loadImpedance, z0 = 50) {
  const zl = toComplex(loadImpedance, 'Load impedance');
  const reference = bounded(z0, 1e-3, 1e6, 'Characteristic impedance');
  const denominator = cadd(zl, complex(reference));
  const gamma = cabs(denominator) === 0 ? complex(-1) : cdiv(csub(zl, complex(reference)), denominator);
  const magnitude = cabs(gamma);
  return {
    gamma, magnitude, angle: Math.atan2(gamma.im, gamma.re) * 180 / Math.PI,
    normalized: cscale(zl, 1 / reference),
    vswr: magnitude >= 1 ? Infinity : (1 + magnitude) / (1 - magnitude),
    returnLossDb: magnitude === 0 ? Infinity : -20 * Math.log10(magnitude),
    mismatchLossDb: magnitude >= 1 ? Infinity : -10 * Math.log10(1 - magnitude * magnitude),
    powerDelivered: Math.max(0, 1 - magnitude * magnitude),
  };
}

export const impedanceFromGamma = (gamma, z0 = 50) => cscale(cdiv(cadd(ONE, gamma), csub(ONE, gamma)), z0);

// ---------------------------------------------------------------------------
// Lumped L-network matching (Pozar §5.1).

function reactanceElement(reactance, omega) {
  if (Math.abs(reactance) < 1e-12) return { kind: 'none', value: 0, unit: '' };
  return reactance > 0 ? { kind: 'inductor', value: reactance / omega, unit: 'H' } : { kind: 'capacitor', value: -1 / (omega * reactance), unit: 'F' };
}
function susceptanceElement(susceptance, omega) {
  if (Math.abs(susceptance) < 1e-15) return { kind: 'none', value: 0, unit: '' };
  return susceptance > 0 ? { kind: 'capacitor', value: susceptance / omega, unit: 'F' } : { kind: 'inductor', value: -1 / (omega * susceptance), unit: 'H' };
}

/** Both L-section solutions matching ZL to a real Z0 at `frequency` Hz, each verified by its input impedance. */
export function lMatch(loadImpedance, z0 = 50, frequency = 1e8) {
  const zl = toComplex(loadImpedance, 'Load impedance');
  const reference = bounded(z0, 1e-3, 1e6, 'Characteristic impedance');
  const omega = 2 * Math.PI * bounded(frequency, 1, 1e13, 'Frequency');
  const { re: rl, im: xl } = zl;
  if (!(rl > 0)) throw new RangeError('The load resistance must be positive for a lossless L-network match.');
  const solutions = [];
  if (rl > reference) {
    // Shunt susceptance across the load, series reactance toward the source.
    const root = Math.sqrt(rl / reference) * Math.sqrt(rl * rl + xl * xl - reference * rl);
    for (const sign of [1, -1]) {
      const b = (xl + sign * root) / (rl * rl + xl * xl);
      const x = 1 / b + xl * reference / rl - reference / (b * rl);
      const zin = cadd(cdiv(ONE, cadd(cdiv(ONE, zl), complex(0, b))), complex(0, x));
      solutions.push({ topology: 'shunt-at-load', series: { reactance: x, ...reactanceElement(x, omega) }, shunt: { susceptance: b, ...susceptanceElement(b, omega) }, inputImpedance: zin });
    }
  } else {
    // Series reactance at the load, shunt susceptance toward the source.
    const root = Math.sqrt(rl * (reference - rl));
    for (const sign of [1, -1]) {
      const x = sign * root - xl;
      const b = sign * Math.sqrt((reference - rl) / rl) / reference;
      const zin = cdiv(ONE, cadd(cdiv(ONE, cadd(zl, complex(0, x))), complex(0, b)));
      solutions.push({ topology: 'series-at-load', series: { reactance: x, ...reactanceElement(x, omega) }, shunt: { susceptance: b, ...susceptanceElement(b, omega) }, inputImpedance: zin });
    }
  }
  return { load: zl, z0: reference, frequency: omega / (2 * Math.PI), solutions };
}

// ---------------------------------------------------------------------------
// Transmission lines.

/** Zin of a line (lengths in wavelengths) terminated in ZL, with optional loss in nepers per wavelength. */
export function lineInputImpedance(loadImpedance, z0, lengthWavelengths, attenuationNepersPerWavelength = 0) {
  const zl = toComplex(loadImpedance, 'Load impedance');
  const gammaL = complex(attenuationNepersPerWavelength * lengthWavelengths, 2 * Math.PI * lengthWavelengths);
  if (!Number.isFinite(zl.re) || zl.re > 1e15) return cdiv(complex(z0), ctanh(gammaL)); // open circuit
  const t = ctanh(gammaL);
  return cscale(cdiv(cadd(zl, cscale(t, z0)), cadd(complex(z0), cmul(zl, t))), z0);
}

/**
 * Line from load to generator: input impedance, Γ along the line (a Smith-chart arc) and
 * the |V| standing-wave pattern, with positions of the first voltage maximum and minimum.
 */
export function transmissionLine({ load = { re: 100, im: 50 }, z0 = 50, length = 0.3, lossDbPerWavelength = 0, points = 241 } = {}) {
  const zl = toComplex(load, 'Load impedance');
  const reference = bounded(z0, 1e-3, 1e6, 'Characteristic impedance');
  const span = bounded(length, 0, 100, 'Line length (wavelengths)');
  const alpha = bounded(lossDbPerWavelength, 0, 100, 'Loss (dB per wavelength)') / 8.685889638;
  const count = Math.trunc(bounded(points, 11, 2001, 'Points'));
  const loadReflection = reflection(zl, reference);
  const positions = Array.from({ length: count }, (_, k) => span * k / (count - 1));
  const trace = positions.map((d) => {
    const gamma = cmul(loadReflection.gamma, cexp(complex(-2 * alpha * d, -4 * Math.PI * d)));
    // V(d) ∝ e^{γd}(1 + Γ(d)), normalised to the forward wave at the load.
    const voltage = cabs(cmul(cexp(complex(alpha * d, 2 * Math.PI * d)), cadd(ONE, gamma)));
    return { d, gamma, voltage };
  });
  const angle = Math.atan2(loadReflection.gamma.im, loadReflection.gamma.re);
  // Voltage maxima where Γ(d) is real and positive: θ − 4πd = 0 (mod 2π).
  const firstMaximum = loadReflection.magnitude === 0 ? null : (((angle / (4 * Math.PI)) % 0.5) + 0.5) % 0.5;
  const firstMinimum = firstMaximum === null ? null : (firstMaximum + 0.25) % 0.5;
  return {
    load: zl, z0: reference, length: span, reflection: loadReflection,
    inputImpedance: lineInputImpedance(zl, reference, span, alpha * 1),
    trace, firstMaximum, firstMinimum,
  };
}

/** Quarter-wave transformer: for a complex load, first move to the nearest real-impedance point. */
export function quarterWaveMatch(loadImpedance, z0 = 50) {
  const zl = toComplex(loadImpedance, 'Load impedance');
  const reference = bounded(z0, 1e-3, 1e6, 'Characteristic impedance');
  if (!(zl.re > 0)) throw new RangeError('The load resistance must be positive.');
  if (Math.abs(zl.im) < 1e-9 * Math.max(1, zl.re)) return { offset: 0, realImpedance: zl.re, transformerImpedance: Math.sqrt(reference * zl.re) };
  const { firstMaximum, firstMinimum, reflection: r } = transmissionLine({ load: zl, z0: reference, length: 0 });
  const options = [
    { offset: firstMaximum, realImpedance: reference * r.vswr },
    { offset: firstMinimum, realImpedance: reference / r.vswr },
  ].sort((a, b) => a.offset - b.offset);
  return { ...options[0], transformerImpedance: Math.sqrt(reference * options[0].realImpedance), alternatives: options.map((option) => ({ ...option, transformerImpedance: Math.sqrt(reference * option.realImpedance) })) };
}

/** Single shunt-stub match (Pozar §5.2): distance from the load and open/short stub lengths, in wavelengths. */
export function singleStubMatch(loadImpedance, z0 = 50) {
  const zl = toComplex(loadImpedance, 'Load impedance');
  const reference = bounded(z0, 1e-3, 1e6, 'Characteristic impedance');
  const { re: rl, im: xl } = zl;
  if (!(rl > 0)) throw new RangeError('The load resistance must be positive.');
  const ts = Math.abs(rl - reference) < 1e-12 ? [-xl / (2 * reference)] : [1, -1].map((sign) => (xl + sign * Math.sqrt(rl * ((reference - rl) ** 2 + xl * xl) / reference)) / (rl - reference));
  const wrap = (value) => ((value % 0.5) + 0.5) % 0.5;
  return ts.map((t) => {
    const distance = t >= 0 ? Math.atan(t) / (2 * Math.PI) : (Math.PI + Math.atan(t)) / (2 * Math.PI);
    const denominator = rl * rl + (xl + reference * t) ** 2;
    const b = (rl * rl * t - (reference - xl * t) * (xl + reference * t)) / (reference * denominator);
    const y0 = 1 / reference;
    const openLength = wrap(-Math.atan(b / y0) / (2 * Math.PI));
    const shortLength = wrap(Math.atan(y0 / b) / (2 * Math.PI));
    // Verify: line admittance at d plus the stub's −jB gives Y0.
    const yLine = cdiv(ONE, lineInputImpedance(zl, reference, distance));
    const yStub = cdiv(ONE, lineInputImpedance(complex(1e18), reference, openLength));
    return { distance, susceptance: b, openStub: openLength, shortStub: shortLength, inputAdmittance: cadd(yLine, yStub) };
  }).sort((a, b) => a.distance - b.distance);
}

// ---------------------------------------------------------------------------
// Line impedance calculators.

/** Microstrip analysis (Hammerstad-Jensen): width and height in the same unit. */
export function microstrip({ width = 3, height = 1.6, permittivity = 4.4 } = {}) {
  const u = bounded(width, 1e-6, 1e6, 'Trace width') / bounded(height, 1e-6, 1e6, 'Substrate height');
  const er = bounded(permittivity, 1, 200, 'Relative permittivity');
  const a = 1 + Math.log((u ** 4 + (u / 52) ** 2) / (u ** 4 + 0.432)) / 49 + Math.log(1 + (u / 18.1) ** 3) / 18.7;
  const b = 0.564 * ((er - 0.9) / (er + 3)) ** 0.053;
  const effective = (er + 1) / 2 + ((er - 1) / 2) * (1 + 10 / u) ** (-a * b);
  const f = 6 + (2 * Math.PI - 6) * Math.exp(-((30.666 / u) ** 0.7528));
  const z0Air = (FREE_SPACE_IMPEDANCE / (2 * Math.PI)) * Math.log(f / u + Math.sqrt(1 + (2 / u) ** 2));
  return { ratio: u, effectivePermittivity: effective, impedance: z0Air / Math.sqrt(effective), velocityFactor: 1 / Math.sqrt(effective) };
}

/** Microstrip synthesis: the width (in the height's unit) that gives `impedance` ohms. */
export function microstripWidth({ impedance = 50, height = 1.6, permittivity = 4.4 } = {}) {
  const target = bounded(impedance, 5, 250, 'Target impedance');
  let low = 1e-4, high = 1e3; // W/h; Z0 falls monotonically with width
  for (let k = 0; k < 200; k += 1) {
    const mid = Math.sqrt(low * high);
    if (microstrip({ width: mid, height: 1, permittivity }).impedance > target) low = mid; else high = mid;
  }
  const ratio = Math.sqrt(low * high);
  return { width: ratio * height, ...microstrip({ width: ratio, height: 1, permittivity }) };
}

export function coaxImpedance({ inner = 0.9, outer = 2.95, permittivity = 2.25 } = {}) {
  const d = bounded(inner, 1e-9, 1e6, 'Inner diameter'), D = bounded(outer, 1e-9, 1e6, 'Outer diameter');
  if (!(D > d)) throw new RangeError('The outer diameter must exceed the inner diameter.');
  const er = bounded(permittivity, 1, 200, 'Relative permittivity');
  return { impedance: (FREE_SPACE_IMPEDANCE / (2 * Math.PI * Math.sqrt(er))) * Math.log(D / d), velocityFactor: 1 / Math.sqrt(er), cutoffFrequency: SPEED_OF_LIGHT / (Math.PI * ((D + d) / 2) * 1e-3 * Math.sqrt(er)) };
}

export function twinLeadImpedance({ spacing = 10, diameter = 1, permittivity = 1 } = {}) {
  const s = bounded(spacing, 1e-9, 1e6, 'Centre spacing'), d = bounded(diameter, 1e-9, 1e6, 'Wire diameter');
  if (!(s > d)) throw new RangeError('The spacing must exceed the wire diameter.');
  const er = bounded(permittivity, 1, 200, 'Relative permittivity');
  return { impedance: (FREE_SPACE_IMPEDANCE / (Math.PI * Math.sqrt(er))) * Math.acosh(s / d), velocityFactor: 1 / Math.sqrt(er) };
}

// ---------------------------------------------------------------------------
// Antennas.

export const ELEMENT_PATTERNS = Object.freeze({ isotropic: 'Isotropic', 'short-dipole': 'Short dipole (collinear)', 'half-wave-dipole': 'Half-wave dipole (collinear)' });

function elementFactor(kind, theta) {
  const s = Math.sin(theta);
  if (kind === 'short-dipole') return Math.abs(s);
  if (kind === 'half-wave-dipole') return Math.abs(s) < 1e-9 ? 0 : Math.abs(Math.cos((Math.PI / 2) * Math.cos(theta)) / s);
  return 1;
}

/**
 * Uniform linear array of N elements along the z axis with spacing d (wavelengths) and
 * progressive phase chosen to steer the main beam to `steer` degrees from the axis
 * (90° = broadside, 0° = end-fire). Pattern is rotationally symmetric about the axis.
 */
export function linearArray({ elements = 4, spacing = 0.5, steer = 90, element = 'isotropic', points = 721 } = {}) {
  const n = Math.trunc(bounded(elements, 1, 64, 'Number of elements'));
  const d = bounded(spacing, 0.01, 5, 'Element spacing (wavelengths)');
  const steerAngle = bounded(steer, 0, 180, 'Steering angle') * Math.PI / 180;
  if (!ELEMENT_PATTERNS[element]) throw new RangeError(`Element must be one of ${Object.keys(ELEMENT_PATTERNS).join(', ')}.`);
  const count = Math.trunc(bounded(points, 181, 7201, 'Points'));
  const kd = 2 * Math.PI * d;
  const beta = -kd * Math.cos(steerAngle);
  const factor = (theta) => {
    const psi = kd * Math.cos(theta) + beta;
    const af = Math.abs(Math.sin(n * psi / 2)) < 1e-12 && Math.abs(Math.sin(psi / 2)) < 1e-12 ? n : Math.abs(Math.sin(n * psi / 2) / Math.sin(psi / 2));
    return (af / n) * elementFactor(element, theta);
  };
  const theta = Array.from({ length: count }, (_, k) => Math.PI * k / (count - 1));
  const field = theta.map(factor);
  const peak = Math.max(...field);
  const normalized = field.map((value) => value / peak);
  const decibels = normalized.map((value) => 20 * Math.log10(Math.max(value, 1e-6)));
  // Directivity of an axisymmetric pattern: D = 2·Umax / ∫ U(θ) sinθ dθ (Simpson, fine grid).
  const fine = 4000;
  let integral = 0;
  for (let k = 0; k <= fine; k += 1) {
    const t = Math.PI * k / fine;
    const weight = k === 0 || k === fine ? 1 : k % 2 ? 4 : 2;
    integral += weight * (factor(t) / peak) ** 2 * Math.sin(t);
  }
  integral *= Math.PI / fine / 3;
  const directivity = 2 / integral;
  const mainIndex = normalized.indexOf(1);
  const halfPower = Math.SQRT1_2;
  const edge = (step) => {
    for (let k = mainIndex; k >= 0 && k < count; k += step) if (normalized[k] < halfPower) { const a = normalized[k - step], b = normalized[k]; return theta[k - step] + (theta[k] - theta[k - step]) * (a - halfPower) / (a - b); }
    return null;
  };
  const lower = edge(-1), upper = edge(1);
  // Beam width across the axis of symmetry doubles an end-fire lobe that touches θ = 0 or π.
  const beamwidth = lower !== null && upper !== null ? upper - lower : lower === null && upper !== null ? 2 * upper : upper === null && lower !== null ? 2 * (Math.PI - lower) : null;
  let sidelobe = -Infinity;
  for (let k = 1; k < count - 1; k += 1) {
    if (normalized[k] >= normalized[k - 1] && normalized[k] >= normalized[k + 1] && normalized[k] < 0.999) sidelobe = Math.max(sidelobe, decibels[k]);
  }
  const radiationResistance = element === 'half-wave-dipole' ? 73.08 : null;
  return {
    elements: n, spacing: d, steer: steerAngle * 180 / Math.PI, element, progressivePhase: beta * 180 / Math.PI,
    theta: theta.map((value) => value * 180 / Math.PI), normalized, decibels,
    mainBeam: theta[mainIndex] * 180 / Math.PI, directivity, directivityDbi: 10 * Math.log10(directivity),
    beamwidth: beamwidth === null ? null : beamwidth * 180 / Math.PI, sidelobeDb: Number.isFinite(sidelobe) ? sidelobe : null,
    gratingLobes: d * (1 + Math.abs(Math.cos(steerAngle))) >= 1, radiationResistance,
  };
}

/** Radiation resistance of a short (Hertzian-like, triangular current) dipole of length l/λ. */
export const shortDipoleResistance = (lengthWavelengths) => 20 * Math.PI * Math.PI * lengthWavelengths ** 2;

// ---------------------------------------------------------------------------
// Link budget.

export const freeSpacePathLossDb = (distance, frequency) => 20 * Math.log10(4 * Math.PI * distance * frequency / SPEED_OF_LIGHT);

/** Friis link budget with thermal noise floor, SNR, fade margin and range at zero margin. */
export function linkBudget({ frequency = 2.4e9, distance = 1000, txPowerDbm = 20, txGainDbi = 2, rxGainDbi = 2, txLossDb = 1, rxLossDb = 1, otherLossDb = 0, bandwidth = 1e6, noiseFigureDb = 6, requiredSnrDb = 10, temperature = 290 } = {}) {
  const f = bounded(frequency, 1e3, 1e13, 'Frequency');
  const r = bounded(distance, 1e-3, 1e12, 'Distance');
  const b = bounded(bandwidth, 1, 1e12, 'Bandwidth');
  const values = { txPowerDbm, txGainDbi, rxGainDbi, txLossDb, rxLossDb, otherLossDb, noiseFigureDb, requiredSnrDb };
  for (const [key, value] of Object.entries(values)) bounded(value, -300, 300, key);
  const wavelength = SPEED_OF_LIGHT / f;
  const fspl = freeSpacePathLossDb(r, f);
  const eirp = txPowerDbm - txLossDb + txGainDbi;
  const received = eirp - fspl - otherLossDb + rxGainDbi - rxLossDb;
  const boltzmann = 1.380649e-23;
  const noiseFloor = 10 * Math.log10(boltzmann * bounded(temperature, 1, 1e4, 'Temperature') * b / 1e-3) + noiseFigureDb;
  const snr = received - noiseFloor;
  const sensitivity = noiseFloor + requiredSnrDb;
  const margin = received - sensitivity;
  return {
    frequency: f, distance: r, wavelength, fspl, eirpDbm: eirp, receivedDbm: received, receivedWatts: 1e-3 * 10 ** (received / 10),
    noiseFloorDbm: noiseFloor, snrDb: snr, sensitivityDbm: sensitivity, marginDb: margin, maxRange: r * 10 ** (margin / 20),
    fresnelRadius: 0.5 * Math.sqrt(wavelength * r), shannonCapacity: b * Math.log2(1 + 10 ** (snr / 10)),
  };
}
