// Electromagnetics and microwave engineering: fields of point charges (with a numerical
// Gauss's-law check), uniform plane waves in lossy media, reflection at interfaces (Fresnel,
// Brewster, total internal reflection), polarisation, rectangular and circular waveguide
// modes, and two-port S-parameter networks (conversions, cascading, amplifier stability).
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csqrt, csub } from '../../numerics/src/polynomial.mjs';

export const C0 = 299_792_458;
export const MU0 = 4e-7 * Math.PI * 1.00000000055; // CODATA 2018 μ0
export const EPS0 = 1 / (MU0 * C0 * C0);
export const ETA0 = MU0 * C0;
const K_E = 1 / (4 * Math.PI * EPS0);
const ONE = complex(1), ZERO = complex(0), J = complex(0, 1);
const cneg = (a) => complex(-a.re, -a.im);
const cconj = (a) => complex(a.re, -a.im);
const cosh = (a) => cscale(cadd(cexp(a), cexp(cneg(a))), 0.5);
const sinh = (a) => cscale(csub(cexp(a), cexp(cneg(a))), 0.5);
const toComplex = (value) => (typeof value === 'number' ? complex(value) : value);
const db20 = (value) => 20 * Math.log10(Math.max(value, 1e-300));

// ---------------------------------------------------------------------------
// Electrostatics: point charges in 3-D, evaluated anywhere (the UI shows the z = 0 plane).

/** E (V/m) and V (volts) at a point from charges [{ q (coulombs), x, y, z? }] (metres). */
export function chargeField(charges, x, y, z = 0) {
  let ex = 0, ey = 0, ez = 0, v = 0;
  for (const charge of charges) {
    const dx = x - charge.x, dy = y - charge.y, dz = z - (charge.z ?? 0);
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 === 0) return { ex: NaN, ey: NaN, ez: NaN, v: NaN, magnitude: Infinity };
    const r = Math.sqrt(r2), k = K_E * charge.q / (r2 * r);
    ex += k * dx; ey += k * dy; ez += k * dz; v += K_E * charge.q / r;
  }
  return { ex, ey, ez, v, magnitude: Math.hypot(ex, ey, ez) };
}

/** Electric flux through a sphere (Fibonacci quadrature) — Gauss's law says Q_enclosed/ε0. */
export function gaussFlux(charges, { x = 0, y = 0, z = 0, radius = 1, points = 4000 } = {}) {
  let flux = 0;
  const golden = Math.PI * (3 - Math.sqrt(5)), area = 4 * Math.PI * radius * radius / points;
  for (let i = 0; i < points; i += 1) {
    const nz = 1 - (2 * i + 1) / points, ring = Math.sqrt(1 - nz * nz), phi = golden * i;
    const nx = ring * Math.cos(phi), ny = ring * Math.sin(phi);
    const field = chargeField(charges, x + radius * nx, y + radius * ny, z + radius * nz);
    flux += (field.ex * nx + field.ey * ny + field.ez * nz) * area;
  }
  const enclosed = charges.filter((charge) => Math.hypot(charge.x - x, charge.y - y, (charge.z ?? 0) - z) < radius).reduce((sum, charge) => sum + charge.q, 0);
  return { flux, enclosed, expected: enclosed / EPS0 };
}

/** Potential on a grid in the z = 0 plane plus field lines traced from the charges. */
export function fieldMap(charges, { xMin, xMax, yMin, yMax, columns = 60, rows = 45, linesPerCharge = 12 } = {}) {
  const potential = [];
  for (let row = 0; row < rows; row += 1) {
    const y = yMax - (yMax - yMin) * (row + 0.5) / rows;
    potential.push(Array.from({ length: columns }, (_, col) => chargeField(charges, xMin + (xMax - xMin) * (col + 0.5) / columns, y).v));
  }
  const span = Math.max(xMax - xMin, yMax - yMin), step = span / 400, near = span / 120;
  const inside = (x, y) => x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  const lines = [];
  const total = charges.reduce((sum, charge) => sum + charge.q, 0);
  // Start lines from the positive charges (or the negative ones when the total is negative).
  const sign = total < 0 ? -1 : 1;
  for (const source of charges.filter((charge) => Math.sign(charge.q) === sign)) {
    for (let k = 0; k < linesPerCharge; k += 1) {
      const angle = 2 * Math.PI * (k + 0.5) / linesPerCharge;
      let x = source.x + near * Math.cos(angle), y = source.y + near * Math.sin(angle);
      const points = [[x, y]];
      for (let n = 0; n < 1500 && inside(x, y); n += 1) {
        const direction = (px, py) => { const f = chargeField(charges, px, py); const m = Math.hypot(f.ex, f.ey) || 1; return [sign * f.ex / m, sign * f.ey / m]; };
        const [k1x, k1y] = direction(x, y);
        const [k2x, k2y] = direction(x + step * k1x / 2, y + step * k1y / 2);
        const [k3x, k3y] = direction(x + step * k2x / 2, y + step * k2y / 2);
        const [k4x, k4y] = direction(x + step * k3x, y + step * k3y);
        x += step * (k1x + 2 * k2x + 2 * k3x + k4x) / 6; y += step * (k1y + 2 * k2y + 2 * k3y + k4y) / 6;
        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
        points.push([x, y]);
        if (charges.some((charge) => charge !== source && Math.hypot(charge.x - x, charge.y - y) < near * 0.6)) break;
      }
      lines.push(points);
    }
  }
  return { potential, lines };
}

// ---------------------------------------------------------------------------
// Uniform plane waves.

/** Propagation constant γ = α + jβ and intrinsic impedance η of a (lossy) medium. */
export function planeWave({ frequency, epsR = 1, muR = 1, sigma = 0 }) {
  if (!(frequency > 0)) throw new RangeError('Frequency must be positive.');
  const omega = 2 * Math.PI * frequency, mu = MU0 * muR, eps = EPS0 * epsR;
  const series = complex(0, omega * mu), shunt = complex(sigma, omega * eps);
  const gamma = csqrt(cmul(series, shunt));
  const eta = csqrt(cdiv(series, shunt));
  const lossTangent = sigma / (omega * eps);
  const alpha = gamma.re, beta = gamma.im;
  return {
    alpha, beta, alphaDbPerMetre: alpha * 20 / Math.LN10, eta, etaMagnitude: cabs(eta), etaAngle: Math.atan2(eta.im, eta.re) * 180 / Math.PI,
    wavelength: 2 * Math.PI / beta, phaseVelocity: omega / beta, skinDepth: alpha > 0 ? 1 / alpha : Infinity, lossTangent,
    regime: lossTangent < 0.01 ? 'low-loss dielectric' : lossTangent > 100 ? 'good conductor' : 'general lossy medium',
    surfaceResistance: sigma > 0 ? Math.sqrt(omega * mu / (2 * sigma)) : null,
  };
}

/** Skin depth of a good conductor, δ = 1/√(π f μ σ). */
export const skinDepth = (frequency, sigma, muR = 1) => 1 / Math.sqrt(Math.PI * frequency * MU0 * muR * sigma);

// ---------------------------------------------------------------------------
// Reflection and transmission.

/** Normal incidence between media of intrinsic impedance η1 → η2 (numbers or complex). */
export function normalIncidence(eta1, eta2) {
  const a = toComplex(eta1), b = toComplex(eta2);
  const gamma = cdiv(csub(b, a), cadd(b, a));
  const tau = cadd(ONE, gamma);
  const magnitude = cabs(gamma);
  return { gamma, tau, reflectance: magnitude ** 2, transmittance: 1 - magnitude ** 2, swr: magnitude < 1 ? (1 + magnitude) / (1 - magnitude) : Infinity };
}

/** Oblique incidence on a planar boundary between non-magnetic media with refractive indices n1, n2. */
export function fresnel({ n1, n2, angle }) {
  const thetaI = angle * Math.PI / 180;
  const cosI = Math.cos(thetaI), sinT = n1 * Math.sin(thetaI) / n2;
  const cosT = csqrt(complex(1 - sinT * sinT));
  const tir = sinT > 1;
  const n1c = complex(n1 * cosI), n2c = complex(n2 * cosI);
  const rs = cdiv(csub(n1c, cscale(cosT, n2)), cadd(n1c, cscale(cosT, n2)));
  const rp = cdiv(csub(n2c, cscale(cosT, n1)), cadd(n2c, cscale(cosT, n1)));
  const ts = cdiv(complex(2 * n1 * cosI), cadd(n1c, cscale(cosT, n2)));
  const tp = cdiv(complex(2 * n1 * cosI), cadd(n2c, cscale(cosT, n1)));
  const Rs = cabs(rs) ** 2, Rp = cabs(rp) ** 2;
  const power = tir ? 0 : n2 * cosT.re / (n1 * cosI);
  return {
    rs, rp, ts, tp, Rs, Rp, Ts: tir ? 0 : power * cabs(ts) ** 2, Tp: tir ? 0 : power * cabs(tp) ** 2,
    transmittedAngle: tir ? null : Math.asin(sinT) * 180 / Math.PI, tir,
    phaseS: Math.atan2(rs.im, rs.re) * 180 / Math.PI, phaseP: Math.atan2(rp.im, rp.re) * 180 / Math.PI,
    brewster: Math.atan(n2 / n1) * 180 / Math.PI, critical: n1 > n2 ? Math.asin(n2 / n1) * 180 / Math.PI : null,
  };
}

/** Reflectance against incidence angle for both polarisations. */
export function fresnelCurve(n1, n2, points = 181) {
  const angles = Array.from({ length: points }, (_, k) => 90 * k / (points - 1) - (k === points - 1 ? 1e-9 : 0));
  const results = angles.map((angle) => fresnel({ n1, n2, angle }));
  return { angles, Rs: results.map((r) => r.Rs), Rp: results.map((r) => r.Rp) };
}

/** Polarisation of E = x̂·Ex cos ωt + ŷ·Ey cos(ωt + δ) for a wave travelling in +z (IEEE sense). */
export function polarization({ ex, ey, phase }) {
  const delta = phase * Math.PI / 180;
  const s0 = ex * ex + ey * ey, s1 = ex * ex - ey * ey, s2 = 2 * ex * ey * Math.cos(delta), s3 = 2 * ex * ey * Math.sin(delta);
  if (s0 === 0) throw new RangeError('At least one field component must be non-zero.');
  const chi = 0.5 * Math.asin(Math.max(-1, Math.min(1, s3 / s0)));
  const tilt = 0.5 * Math.atan2(s2, s1) * 180 / Math.PI;
  const axialRatio = Math.abs(Math.tan(chi)) < 1e-12 ? Infinity : 1 / Math.abs(Math.tan(chi));
  const kind = Math.abs(s3) < 1e-9 * s0 ? 'linear' : Math.abs(axialRatio - 1) < 1e-6 ? 'circular' : 'elliptical';
  const sense = kind === 'linear' ? null : s3 < 0 ? 'right-hand' : 'left-hand';
  const trace = Array.from({ length: 121 }, (_, k) => { const wt = 2 * Math.PI * k / 120; return [ex * Math.cos(wt), ey * Math.cos(wt + delta)]; });
  return { stokes: [s0, s1, s2, s3], tilt, axialRatio, axialRatioDb: db20(axialRatio), kind, sense, trace };
}

// ---------------------------------------------------------------------------
// Waveguides.

// Zeros of Jn (TM) and Jn' (TE), n = 0…3, first three roots (scipy.special.jn_zeros / jnp_zeros).
export const BESSEL_ZEROS = Object.freeze({
  TM: [[2.4048255576957724, 5.520078110286311, 8.653727912911013], [3.8317059702075125, 7.015586669815619, 10.173468135062722], [5.135622301840683, 8.417244140399866, 11.61984117214906], [6.380161895923984, 9.76102312998167, 13.015200721698434]],
  TE: [[3.8317059702075125, 7.015586669815619, 10.173468135062722], [1.8411837813406595, 5.3314427735250325, 8.536316366346286], [3.0542369282271404, 6.706133194158459, 9.969467823087596], [4.201188941210528, 8.015236598375953, 11.345924310743007]],
});

function modeAt(cutoff, frequency, epsR, kind) {
  const v = C0 / Math.sqrt(epsR), eta = ETA0 / Math.sqrt(epsR), k = 2 * Math.PI * frequency / v;
  const ratio = cutoff / frequency, propagating = ratio < 1;
  const root = Math.sqrt(Math.abs(1 - ratio * ratio));
  const beta = propagating ? k * root : 0, attenuation = propagating ? 0 : k * root;
  return {
    cutoff, propagating, beta, attenuation, attenuationDbPerMetre: attenuation * 20 / Math.LN10,
    guideWavelength: propagating ? 2 * Math.PI / beta : Infinity,
    phaseVelocity: propagating ? v / root : Infinity, groupVelocity: propagating ? v * root : 0,
    impedance: propagating ? (kind === 'TE' ? eta / root : eta * root) : null,
  };
}

/** TE/TM modes of an a × b rectangular guide (metres), sorted by cut-off frequency. */
export function rectangularWaveguide({ a, b, epsR = 1, frequency, maxIndex = 4, sigma = null }) {
  if (!(a > 0 && b > 0)) throw new RangeError('Waveguide dimensions must be positive.');
  const v = C0 / Math.sqrt(epsR), modes = [];
  for (let m = 0; m <= maxIndex; m += 1) {
    for (let n = 0; n <= maxIndex; n += 1) {
      if (m === 0 && n === 0) continue;
      const cutoff = v / 2 * Math.hypot(m / a, n / b);
      modes.push({ kind: 'TE', m, n, name: `TE${m}${n}`, ...modeAt(cutoff, frequency, epsR, 'TE') });
      if (m > 0 && n > 0) modes.push({ kind: 'TM', m, n, name: `TM${m}${n}`, ...modeAt(cutoff, frequency, epsR, 'TM') });
    }
  }
  modes.sort((p, q) => p.cutoff - q.cutoff || (p.kind === 'TE' ? -1 : 1));
  const dominant = modes[0], next = modes.find((mode) => mode.cutoff > dominant.cutoff * (1 + 1e-9));
  let conductorLoss = null;
  if (sigma && dominant.name === 'TE10' && dominant.propagating) {
    // Pozar (3.96): αc = Rs (2bπ² + a³k²) / (a³ b β k η) for TE10.
    const k = 2 * Math.PI * frequency / v, eta = ETA0 / Math.sqrt(epsR), rs = Math.sqrt(Math.PI * frequency * MU0 / sigma);
    const alpha = rs * (2 * b * Math.PI ** 2 + a ** 3 * k ** 2) / (a ** 3 * b * dominant.beta * k * eta);
    conductorLoss = { alpha, dbPerMetre: alpha * 20 / Math.LN10, surfaceResistance: rs };
  }
  return { modes, dominant, singleModeBand: [dominant.cutoff, next ? next.cutoff : Infinity], conductorLoss };
}

/** Transverse E-field of a rectangular-guide mode on a grid (x across a, y across b). */
export function rectangularModePattern({ kind, m, n }, a, b, columns = 24, rows = 12) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    const y = b * (row + 0.5) / rows;
    for (let col = 0; col < columns; col += 1) {
      const x = a * (col + 0.5) / columns;
      const cx = Math.cos(m * Math.PI * x / a), sx = Math.sin(m * Math.PI * x / a), cy = Math.cos(n * Math.PI * y / b), sy = Math.sin(n * Math.PI * y / b);
      const ex = kind === 'TE' ? (n / b) * cx * sy : (m / a) * cx * sy;
      const ey = kind === 'TE' ? -(m / a) * sx * cy : (n / b) * sx * cy;
      cells.push({ x, y, ex, ey });
    }
  }
  const peak = Math.max(...cells.map((cell) => Math.hypot(cell.ex, cell.ey)), 1e-300);
  return cells.map((cell) => ({ ...cell, ex: cell.ex / peak, ey: cell.ey / peak, magnitude: Math.hypot(cell.ex, cell.ey) / peak }));
}

/** TE/TM modes of a circular guide of radius a (metres). */
export function circularWaveguide({ radius, epsR = 1, frequency }) {
  if (!(radius > 0)) throw new RangeError('Radius must be positive.');
  const v = C0 / Math.sqrt(epsR), modes = [];
  for (const kind of ['TE', 'TM']) {
    BESSEL_ZEROS[kind].forEach((roots, n) => roots.forEach((root, index) => {
      const cutoff = v * root / (2 * Math.PI * radius);
      modes.push({ kind, n, m: index + 1, name: `${kind}${n}${index + 1}`, root, ...modeAt(cutoff, frequency, epsR, kind) });
    }));
  }
  modes.sort((p, q) => p.cutoff - q.cutoff || (p.kind === 'TE' ? -1 : 1));
  const dominant = modes[0], next = modes.find((mode) => mode.cutoff > dominant.cutoff * (1 + 1e-9));
  return { modes, dominant, singleModeBand: [dominant.cutoff, next ? next.cutoff : Infinity] };
}

// ---------------------------------------------------------------------------
// Two-port networks (2 × 2 complex matrices as [[a, b], [c, d]] of { re, im }).

const mat = (a, b, c, d) => [[toComplex(a), toComplex(b)], [toComplex(c), toComplex(d)]];
const det = (m) => csub(cmul(m[0][0], m[1][1]), cmul(m[0][1], m[1][0]));
export function matMul(p, q) {
  return [[cadd(cmul(p[0][0], q[0][0]), cmul(p[0][1], q[1][0])), cadd(cmul(p[0][0], q[0][1]), cmul(p[0][1], q[1][1]))], [cadd(cmul(p[1][0], q[0][0]), cmul(p[1][1], q[1][0])), cadd(cmul(p[1][0], q[0][1]), cmul(p[1][1], q[1][1]))]];
}

/** S (reference Z0, real) → ABCD (Pozar table 4.2). */
export function sToAbcd(s, z0 = 50) {
  const [[s11, s12], [s21, s22]] = s, p = cmul(s12, s21), den = cscale(s21, 2);
  const a = cdiv(cadd(cmul(cadd(ONE, s11), csub(ONE, s22)), p), den);
  const b = cscale(cdiv(csub(cmul(cadd(ONE, s11), cadd(ONE, s22)), p), den), z0);
  const c = cscale(cdiv(csub(cmul(csub(ONE, s11), csub(ONE, s22)), p), den), 1 / z0);
  const d = cdiv(cadd(cmul(csub(ONE, s11), cadd(ONE, s22)), p), den);
  return [[a, b], [c, d]];
}

/** ABCD → S (reference Z0, real). */
export function abcdToS(m, z0 = 50) {
  const [[a, b], [c, d]] = m, bz = cscale(b, 1 / z0), cz = cscale(c, z0);
  const den = cadd(cadd(a, bz), cadd(cz, d));
  return [[cdiv(csub(cadd(a, bz), cadd(cz, d)), den), cdiv(cscale(det(m), 2), den)], [cdiv(complex(2), den), cdiv(csub(cadd(bz, d), cadd(a, cz)), den)]];
}

/** S → Z and Z → S for a two-port with reference Z0. */
export function sToZ(s, z0 = 50) {
  const [[s11, s12], [s21, s22]] = s, den = det([[csub(ONE, s11), cneg(s12)], [cneg(s21), csub(ONE, s22)]]);
  const z11 = cdiv(cadd(cmul(cadd(ONE, s11), csub(ONE, s22)), cmul(s12, s21)), den);
  const z22 = cdiv(cadd(cmul(csub(ONE, s11), cadd(ONE, s22)), cmul(s12, s21)), den);
  return [[cscale(z11, z0), cscale(cdiv(cscale(s12, 2), den), z0)], [cscale(cdiv(cscale(s21, 2), den), z0), cscale(z22, z0)]];
}
export function zToS(z, z0 = 50) {
  const n = [[cscale(z[0][0], 1 / z0), cscale(z[0][1], 1 / z0)], [cscale(z[1][0], 1 / z0), cscale(z[1][1], 1 / z0)]];
  const den = det([[cadd(n[0][0], ONE), n[0][1]], [n[1][0], cadd(n[1][1], ONE)]]);
  const s11 = cdiv(csub(cmul(csub(n[0][0], ONE), cadd(n[1][1], ONE)), cmul(n[0][1], n[1][0])), den);
  const s22 = cdiv(csub(cmul(cadd(n[0][0], ONE), csub(n[1][1], ONE)), cmul(n[0][1], n[1][0])), den);
  return [[s11, cdiv(cscale(n[0][1], 2), den)], [cdiv(cscale(n[1][0], 2), den), s22]];
}

export const TWO_PORT_ELEMENTS = Object.freeze({
  'series-r': { label: 'Series R', unit: 'Ω' }, 'series-l': { label: 'Series L', unit: 'H' }, 'series-c': { label: 'Series C', unit: 'F' },
  'shunt-r': { label: 'Shunt R', unit: 'Ω' }, 'shunt-l': { label: 'Shunt L', unit: 'H' }, 'shunt-c': { label: 'Shunt C', unit: 'F' },
  line: { label: 'Line (Zc Ω, length m, velocity factor)', unit: '' }, 'open-stub': { label: 'Shunt open stub (Zc, length m, vf)', unit: '' }, 'short-stub': { label: 'Shunt shorted stub (Zc, length m, vf)', unit: '' },
  attenuator: { label: 'Matched attenuator', unit: 'dB' },
});

/** ABCD matrix of one element at a frequency. */
export function elementAbcd(element, frequency, z0 = 50) {
  const omega = 2 * Math.PI * frequency, value = Number(element.value);
  const lineBeta = () => omega / (C0 * (element.vf ?? 1)) * element.length;
  switch (element.type) {
    case 'series-r': return mat(1, value, 0, 1);
    case 'series-l': return mat(1, complex(0, omega * value), 0, 1);
    case 'series-c': return mat(1, complex(0, -1 / (omega * value)), 0, 1);
    case 'shunt-r': return mat(1, 0, 1 / value, 1);
    case 'shunt-l': return mat(1, 0, complex(0, -1 / (omega * value)), 1);
    case 'shunt-c': return mat(1, 0, complex(0, omega * value), 1);
    case 'line': {
      const gl = complex((element.lossDbPerMetre ?? 0) * Math.LN10 / 20 * element.length, lineBeta()), zc = element.z0 ?? z0;
      return [[cosh(gl), cscale(sinh(gl), zc)], [cscale(sinh(gl), 1 / zc), cosh(gl)]];
    }
    case 'open-stub': case 'short-stub': {
      const t = Math.tan(lineBeta()), zc = element.z0 ?? z0;
      const y = element.type === 'open-stub' ? complex(0, t / zc) : complex(0, -1 / (zc * t));
      return mat(1, 0, y, 1);
    }
    case 'attenuator': {
      const k = 10 ** (-value / 20);
      return sToAbcd(mat(0, k, k, 0), z0);
    }
    default: throw new RangeError(`Unknown two-port element "${element.type}".`);
  }
}

/** Cascade elements (ABCD product) and return S, Z (when it exists) and the usual figures of merit. */
export function cascade(elements, frequency, z0 = 50) {
  const abcd = elements.reduce((product, element) => matMul(product, elementAbcd(element, frequency, z0)), mat(1, 0, 0, 1));
  const s = abcdToS(abcd, z0);
  return { abcd, s, ...sParameterFigures(s) };
}

/** Return loss, insertion loss, VSWR, reciprocity and losslessness of an S-matrix. */
export function sParameterFigures(s) {
  const s11 = cabs(s[0][0]), s21 = cabs(s[1][0]), s12 = cabs(s[0][1]), s22 = cabs(s[1][1]);
  return {
    s11Db: db20(s11), s21Db: db20(s21), s12Db: db20(s12), s22Db: db20(s22),
    returnLoss: -db20(s11), insertionLoss: -db20(s21), vswr: s11 < 1 ? (1 + s11) / (1 - s11) : Infinity,
    reciprocal: cabs(csub(s[0][1], s[1][0])) < 1e-9 * Math.max(1, s21),
    // Unitary S ⇔ lossless network: columns orthonormal.
    lossless: Math.abs(s11 ** 2 + s21 ** 2 - 1) < 1e-9 && Math.abs(s12 ** 2 + s22 ** 2 - 1) < 1e-9 && cabs(cadd(cmul(cconj(s[0][0]), s[0][1]), cmul(cconj(s[1][0]), s[1][1]))) < 1e-9,
  };
}

/** Sweep a cascade over frequency. */
export function sweepCascade(elements, { start, stop, points = 201, z0 = 50 } = {}) {
  const frequencies = Array.from({ length: points }, (_, k) => start + (stop - start) * k / (points - 1));
  const results = frequencies.map((frequency) => cascade(elements, frequency, z0));
  return { frequencies, s: results.map((r) => r.s), s11Db: results.map((r) => r.s11Db), s21Db: results.map((r) => r.s21Db), s22Db: results.map((r) => r.s22Db) };
}

/** Rollett stability, maximum gain and stability circles of an active two-port (Pozar §12.3). */
export function amplifierStability(s) {
  const [[s11, s12], [s21, s22]] = s;
  const delta = det(s), dm = cabs(delta);
  const k = (1 - cabs(s11) ** 2 - cabs(s22) ** 2 + dm ** 2) / (2 * cabs(cmul(s12, s21)));
  const mu = (1 - cabs(s11) ** 2) / (cabs(csub(s22, cmul(delta, cconj(s11)))) + cabs(cmul(s12, s21)));
  const unconditional = k > 1 && dm < 1;
  const ratio = cabs(s21) / cabs(s12);
  const maxGain = unconditional ? ratio * (k - Math.sqrt(k * k - 1)) : null;
  const circle = (sa, sb) => {
    const den = cabs(sa) ** 2 - dm ** 2;
    const center = cscale(cconj(csub(sa, cmul(delta, cconj(sb)))), 1 / den);
    return { center, radius: Math.abs(cabs(cmul(s12, s21)) / den), stableInside: cabs(sb) < 1 ? den < 0 : den > 0 };
  };
  // Simultaneous conjugate match (when unconditionally stable).
  let match = null;
  if (unconditional) {
    const b1 = 1 + cabs(s11) ** 2 - cabs(s22) ** 2 - dm ** 2, b2 = 1 + cabs(s22) ** 2 - cabs(s11) ** 2 - dm ** 2;
    const c1 = csub(s11, cmul(delta, cconj(s22))), c2 = csub(s22, cmul(delta, cconj(s11)));
    const root = (b, c) => { const m = cabs(c); const r = (b - Math.sign(b) * Math.sqrt(b * b - 4 * m * m)) / (2 * m); return cscale(cconj(c), r / m); };
    match = { gammaS: root(b1, c1), gammaL: root(b2, c2) };
  }
  return { k, delta, deltaMagnitude: dm, mu, unconditional, maxGain, maxGainDb: maxGain === null ? null : 10 * Math.log10(maxGain), maxStableGain: ratio, maxStableGainDb: 10 * Math.log10(ratio), unilateralGainDb: 10 * Math.log10(cabs(s21) ** 2 / ((1 - cabs(s11) ** 2) * (1 - cabs(s22) ** 2))), input: circle(s11, s22), output: circle(s22, s11), match };
}

/** Γin of a two-port terminated in ΓL. */
export const inputReflection = (s, gammaL) => cadd(s[0][0], cdiv(cmul(cmul(s[0][1], s[1][0]), gammaL), csub(ONE, cmul(s[1][1], gammaL))));
export const fromPolar = (magnitude, degrees) => complex(magnitude * Math.cos(degrees * Math.PI / 180), magnitude * Math.sin(degrees * Math.PI / 180));
export { ZERO, J };
