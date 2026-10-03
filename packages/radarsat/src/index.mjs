// Radar, satellite communication, antennas and microwave tubes.

export const C = 299792458;
export const BOLTZMANN_DBW = 10 * Math.log10(1.380649e-23); // −228.6 dBW/K/Hz
export const MU_EARTH = 398600.4418e9; // m³/s²
export const R_EARTH = 6378.137e3; // equatorial radius, m
export const SIDEREAL_DAY = 86164.0905; // s
const E_CHARGE = 1.602176634e-19, E_MASS = 9.1093837015e-31;
const db = (x) => 10 * Math.log10(x), undb = (x) => 10 ** (x / 10);
const rad = (deg) => deg * Math.PI / 180, deg = (r) => r * 180 / Math.PI;

function positive(value, label) {
  const n = Number(value);
  if (!(n > 0) || !Number.isFinite(n)) throw new RangeError(`${label} must be a positive number.`);
  return n;
}

// ---------------------------------------------------------------------------
// Radar.

/**
 * Radar range equation (monostatic): Rmax⁴ = Pt·G²·λ²·σ / ((4π)³·Smin), with Smin = k·T0·B·F·(S/N)min·L.
 * Returns Rmax and the received SNR against range.
 */
export function radarRange({ pt = 1e6, gainDb = 40, frequency = 3e9, rcs = 1, bandwidth = 1e6, noiseFigureDb = 3, snrDb = 13, lossDb = 0, pulses = 1 } = {}) {
  const lambda = C / positive(frequency, 'Frequency');
  const g = undb(gainDb);
  const noise = 1.380649e-23 * 290 * positive(bandwidth, 'Bandwidth') * undb(noiseFigureDb);
  const smin = noise * undb(snrDb) * undb(lossDb) / pulses;
  const rmax = (positive(pt, 'Peak power') * g * g * lambda ** 2 * positive(rcs, 'RCS') / ((4 * Math.PI) ** 3 * smin)) ** 0.25;
  const snrAt = (range) => db(pt * g * g * lambda ** 2 * rcs * pulses / ((4 * Math.PI) ** 3 * range ** 4 * noise * undb(lossDb)));
  return { lambda, smin, sminDbm: db(smin) + 30, noisePowerDbm: db(noise) + 30, rmax, snrAt };
}

/** Pulse radar timing: unambiguous range, resolution, duty cycle, average power and blind range. */
export function pulseRadar({ prf = 1000, pulseWidth = 1e-6, pt = 1e6 } = {}) {
  const pri = 1 / positive(prf, 'PRF');
  const duty = positive(pulseWidth, 'Pulse width') / pri;
  return { pri, unambiguousRange: C * pri / 2, rangeResolution: C * pulseWidth / 2, duty, averagePower: pt * duty, minimumRange: C * pulseWidth / 2, bandwidth: 1 / pulseWidth };
}

/** Doppler shift of a target with radial velocity v (positive = approaching) and MTI blind speeds. */
export function doppler({ frequency = 10e9, velocity = 30, prf = 1000, count = 4 } = {}) {
  const lambda = C / positive(frequency, 'Frequency');
  const fd = 2 * velocity / lambda;
  const blind = Array.from({ length: count }, (_, k) => (k + 1) * lambda * prf / 2);
  // A single-delay-line canceller passes |H| = 2|sin(π fd / PRF)|.
  const cancellerGain = 2 * Math.abs(Math.sin(Math.PI * fd / prf));
  return { lambda, fd, blindSpeeds: blind, firstBlind: blind[0], cancellerGain, maxUnambiguousVelocity: lambda * prf / 4 };
}

/** FMCW radar: range from the beat frequency for a sawtooth sweep of bandwidth B in time Ts. */
export function fmcw({ bandwidth = 150e6, sweepTime = 1e-3, beat = 50e3, frequency = 24e9, dopplerVelocity = 0 } = {}) {
  const slope = positive(bandwidth, 'Sweep bandwidth') / positive(sweepTime, 'Sweep time');
  const range = C * beat / (2 * slope);
  return { slope, range, rangeResolution: C / (2 * bandwidth), maxBeatFor: (r) => 2 * slope * r / C, dopplerShift: 2 * dopplerVelocity * frequency / C };
}

// ---------------------------------------------------------------------------
// Satellites.

/** Circular or elliptical orbit from perigee and apogee altitudes (m): period, speeds and semi-major axis. */
export function orbit({ perigeeAltitude = 35786e3, apogeeAltitude = null } = {}) {
  const rp = R_EARTH + perigeeAltitude, ra = R_EARTH + (apogeeAltitude ?? perigeeAltitude);
  if (!(rp > R_EARTH)) throw new RangeError('The perigee must be above the Earth.');
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const period = 2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH);
  const speed = (r) => Math.sqrt(MU_EARTH * (2 / r - 1 / a));
  return { a, e, period, perigeeSpeed: speed(rp), apogeeSpeed: speed(ra), geostationaryRadius: (MU_EARTH * (SIDEREAL_DAY / (2 * Math.PI)) ** 2) ** (1 / 3) };
}

/** Points on an orbit ellipse (focus at the Earth's centre) for drawing. */
export function orbitTrace({ a, e }, points = 180) {
  return Array.from({ length: points + 1 }, (_, k) => { const nu = 2 * Math.PI * k / points; const r = a * (1 - e * e) / (1 + e * Math.cos(nu)); return [r * Math.cos(nu), r * Math.sin(nu)]; });
}

/**
 * Look angles from an earth station (latitude, longitude, degrees) to a geostationary satellite
 * at a sub-satellite longitude (spherical Earth, Pratt & Bostian): azimuth from true north,
 * elevation and slant range.
 */
export function lookAngles({ latitude = 18.52, longitude = 73.86, satelliteLongitude = 83, radius = null } = {}) {
  const rs = radius ?? orbit({}).geostationaryRadius;
  const le = rad(latitude), b = rad(((((satelliteLongitude - longitude) % 360) + 540) % 360) - 180);
  const cosGamma = Math.cos(le) * Math.cos(b);
  const gamma = Math.acos(cosGamma);
  const slant = Math.sqrt(rs * rs + R_EARTH * R_EARTH - 2 * rs * R_EARTH * cosGamma);
  const elevation = deg(Math.atan2(cosGamma - R_EARTH / rs, Math.sin(gamma)));
  // Azimuth: α = atan(tan|B| / sin|Le|), placed in the quadrant set by hemisphere and east/west.
  const alpha = deg(Math.atan2(Math.tan(Math.abs(b)), Math.sin(Math.abs(le))));
  const diff = ((((satelliteLongitude - longitude) % 360) + 540) % 360) - 180;
  const east = diff > 0;
  let azimuth;
  if (latitude >= 0) azimuth = east ? 180 - alpha : 180 + alpha;
  else azimuth = east ? alpha : 360 - alpha;
  return { azimuth: ((azimuth % 360) + 360) % 360, elevation, slantRange: slant, centralAngle: deg(gamma), visible: cosGamma >= R_EARTH / rs };
}

/** One satellite link: C/N0 = EIRP − FSPL − other losses + G/T − k; C/N = C/N0 − 10 log B. */
export function satelliteLink({ eirpDbw = 50, frequency = 4e9, distance = 38000e3, gtDb = 20, otherLossDb = 1, bandwidth = 36e6 } = {}) {
  const fspl = 20 * Math.log10(4 * Math.PI * distance * frequency / C);
  const cn0 = eirpDbw - fspl - otherLossDb + gtDb - BOLTZMANN_DBW;
  return { fspl, cn0, cn: cn0 - db(bandwidth), received: eirpDbw - fspl - otherLossDb };
}

/** Combined C/N of an uplink and downlink (and optional interference): 1/(C/N) = Σ 1/(C/N)ᵢ. */
export const combineCn = (...values) => -db(values.reduce((sum, v) => sum + 1 / undb(v), 0));

/** System noise temperature and G/T for an earth station: antenna noise, feed loss, LNA and receiver. */
export function gOverT({ antennaGainDb = 45, antennaNoise = 30, feedLossDb = 0.3, lnaNoise = 50, lnaGainDb = 50, receiverNoise = 1000 } = {}) {
  const l = undb(feedLossDb);
  const tsys = antennaNoise / l + 290 * (1 - 1 / l) + lnaNoise + receiverNoise / undb(lnaGainDb);
  const gainAtLna = antennaGainDb - feedLossDb;
  return { tsys, gtDb: gainAtLna - db(tsys) };
}

// ---------------------------------------------------------------------------
// Antennas.

/** Far-field pattern of a centre-fed thin dipole of length L (in wavelengths), normalised to 1. */
export function dipolePattern(lengthWavelengths = 0.5, points = 361) {
  const kl2 = Math.PI * positive(lengthWavelengths, 'Length');
  const raw = Array.from({ length: points }, (_, k) => {
    const theta = Math.PI * k / (points - 1);
    const s = Math.sin(theta);
    if (s < 1e-9) return 0;
    return Math.abs((Math.cos(kl2 * Math.cos(theta)) - Math.cos(kl2)) / s);
  });
  const peak = Math.max(...raw);
  const angles = raw.map((_, k) => 180 * k / (points - 1));
  return { angles, field: raw.map((v) => v / peak) };
}

/** Directivity of a pattern E(θ) with no φ dependence: D = 2·max|E|² / ∫|E|² sinθ dθ (Simpson). */
export function directivity(field, angles) {
  const n = field.length;
  if (n % 2 === 0) throw new RangeError('Use an odd number of points.');
  const h = rad(angles[1] - angles[0]);
  let sum = 0;
  for (let k = 0; k < n; k += 1) { const w = k === 0 || k === n - 1 ? 1 : k % 2 ? 4 : 2; sum += w * field[k] ** 2 * Math.sin(rad(angles[k])); }
  const integral = sum * h / 3;
  const peak = Math.max(...field.map((v) => v * v));
  return 2 * peak / integral;
}

/** Half-power beamwidth (degrees) of a normalised field pattern, around its maximum. */
export function halfPowerBeamwidth(field, angles) {
  const peakIndex = field.indexOf(Math.max(...field));
  const level = Math.SQRT1_2;
  const cross = (step) => {
    for (let k = peakIndex; k >= 0 && k < field.length - 1 && k > 0; k += step) {
      const next = k + step;
      if (field[next] < level) { const t = (field[k] - level) / (field[k] - field[next]); return angles[k] + t * (angles[next] - angles[k]); }
    }
    return null;
  };
  const a = cross(-1), b = cross(1);
  return a === null || b === null ? null : Math.abs(b - a);
}

/** Aperture antennas: effective area, dish and horn gain, beamwidth estimate. */
export function apertureAntenna({ frequency = 10e9, diameter = 1, efficiency = 0.55, hornA = 0.1, hornB = 0.08, hornEfficiency = 0.51 } = {}) {
  const lambda = C / positive(frequency, 'Frequency');
  const dish = efficiency * (Math.PI * diameter / lambda) ** 2;
  const horn = hornEfficiency * 4 * Math.PI * hornA * hornB / lambda ** 2;
  return { lambda, dishGain: dish, dishGainDb: db(dish), dishBeamwidth: 70 * lambda / diameter, hornGain: horn, hornGainDb: db(horn), effectiveArea: (gain) => gain * lambda ** 2 / (4 * Math.PI), farField: 2 * diameter ** 2 / lambda };
}

/** Friis transmission: received power between two antennas (dB quantities). */
export function friisLink({ ptDbm = 20, gtDb = 10, grDb = 10, frequency = 2.4e9, distance = 1000 } = {}) {
  const lambda = C / frequency;
  const fspl = 20 * Math.log10(4 * Math.PI * distance / lambda);
  return { fspl, prDbm: ptDbm + gtDb + grDb - fspl };
}

// ---------------------------------------------------------------------------
// Microwave tubes and passive measurements.

/**
 * Reflex klystron: repeller voltage for mode n (n = 1, 2, …, transit 2πn − π/2) at frequency f
 * with beam voltage V0 and repeller spacing L (Liao): (V0 + Vr)²/V0 = 8ω²L²m / ((2πn − π/2)²e).
 */
export function reflexKlystron({ v0 = 300, frequency = 9e9, spacing = 1e-3, modes = 4 } = {}) {
  const w = 2 * Math.PI * positive(frequency, 'Frequency');
  const rows = Array.from({ length: modes }, (_, k) => {
    const n = k + 1, angle = 2 * Math.PI * n - Math.PI / 2;
    const sum = Math.sqrt(8 * w * w * spacing ** 2 * E_MASS * v0 / (angle ** 2 * E_CHARGE));
    return { n, cycles: n - 0.25, repeller: sum - v0, possible: sum > v0, efficiency: 2 * 2.408 * besselJ1(2.408) / angle };
  });
  return { modes: rows };
}

function besselJ1(x) {
  // Series for J1, enough for the bunching parameters used here.
  let term = x / 2, sum = term;
  for (let k = 1; k < 30; k += 1) { term *= -(x * x / 4) / (k * (k + 1)); sum += term; }
  return sum;
}

/** Two-cavity klystron bunching: parameter X = βi·V1·θ0/(2V0); with the output-gap voltage ≈ V0 the electronic efficiency is J1(X), 58.2 % at X = 1.841. */
export function twoCavityKlystron({ v0 = 1000, v1 = 50, frequency = 3e9, drift = 0.02, beta = 1 } = {}) {
  const u0 = Math.sqrt(2 * E_CHARGE * v0 / E_MASS);
  const theta0 = 2 * Math.PI * frequency * drift / u0;
  const x = beta * v1 * theta0 / (2 * v0);
  return { u0, theta0, bunching: x, efficiency: besselJ1(x), maxEfficiencyBunching: 1.841, optimumV1: 2 * v0 * 1.841 / (beta * theta0) };
}

/** Cylindrical magnetron: Hull cut-off field for a voltage, cut-off voltage for a field and cyclotron frequency. */
export function magnetron({ v0 = 26e3, b0 = 0.336, cathodeRadius = 0.05, anodeRadius = 0.1 } = {}) {
  const a = cathodeRadius, b = anodeRadius;
  if (!(b > a)) throw new RangeError('The anode radius must exceed the cathode radius.');
  const shape = b * (1 - (a * a) / (b * b));
  const hullField = Math.sqrt(8 * E_MASS * v0 / E_CHARGE) / shape;
  const hullVoltage = E_CHARGE * b0 ** 2 * shape ** 2 / (8 * E_MASS);
  const wc = E_CHARGE * b0 / E_MASS;
  return { hullField, hullVoltage, cyclotron: wc / (2 * Math.PI), oscillates: v0 < hullVoltage, regime: v0 < hullVoltage ? 'electrons return to the cathode (cut-off) — oscillation possible' : 'electrons reach the anode — no magnetron action' };
}

/** Directional coupler figures from the four port powers (W): coupling, directivity, isolation, insertion loss. */
export function directionalCoupler({ p1 = 1, p2 = 0.89, p3 = 0.01, p4 = 1e-5 } = {}) {
  return { coupling: db(p1 / p3), directivity: db(p3 / p4), isolation: db(p1 / p4), insertionLoss: db(p1 / p2) };
}

/** VSWR from a slotted-line reading, and the double-minimum method for high VSWR. */
export function vswrMeasurement({ vmax = 2, vmin = 1, guideWavelength = 0.04, minimumWidth = null } = {}) {
  const vswr = vmax / vmin;
  const gamma = (vswr - 1) / (vswr + 1);
  const result = { vswr, gamma, returnLoss: -20 * Math.log10(gamma || 1e-30), mismatchLossDb: -db(1 - gamma * gamma) };
  if (minimumWidth) result.doubleMinimum = Math.sqrt(1 + 1 / Math.sin(Math.PI * minimumWidth / guideWavelength) ** 2);
  return result;
}
