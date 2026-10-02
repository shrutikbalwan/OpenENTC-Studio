import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abcdToS, amplifierStability, BESSEL_ZEROS, cascade, chargeField, circularWaveguide, fieldMap, fresnel, fromPolar, gaussFlux, inputReflection, normalIncidence, planeWave, polarization, rectangularModePattern, rectangularWaveguide, sToAbcd, sToZ, skinDepth, sweepCascade, zToS } from '../packages/em/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// scikit-rf 2.1.0 on the same networks (tests/fixtures/em/skrf-reference.json).
const reference = JSON.parse(readFileSync(new URL('./fixtures/em/skrf-reference.json', import.meta.url), 'utf8'));
const toMatrix = (m) => m.map((row) => row.map(([re, im]) => ({ re, im })));
const CHAIN = [{ type: 'series-l', value: 5e-9 }, { type: 'shunt-c', value: 2e-12 }, { type: 'line', z0: 35, length: 0.03, vf: 0.7 }, { type: 'open-stub', z0: 50, length: 0.02, vf: 1 }, { type: 'series-r', value: 10 }, { type: 'short-stub', z0: 70, length: 0.015, vf: 0.8 }, { type: 'attenuator', value: 3 }];
const matrixClose = (actual, expected, tolerance, label) => { for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) near(Math.hypot(actual[i][j].re - expected[i][j].re, actual[i][j].im - expected[i][j].im), 0, tolerance * Math.max(1, Math.hypot(expected[i][j].re, expected[i][j].im)), `${label}[${i}${j}]`); };

test('cascaded two-port S, Z and ABCD equal scikit-rf', () => {
  reference.f.forEach((frequency, k) => {
    const result = cascade(CHAIN, frequency);
    matrixClose(result.s, toMatrix(reference.s[k]), 1e-12, `S @ ${frequency}`);
    matrixClose(result.abcd, toMatrix(reference.a[k]), 1e-12, `ABCD @ ${frequency}`);
    matrixClose(sToZ(result.s), toMatrix(reference.z[k]), 1e-9, `Z @ ${frequency}`);
    matrixClose(zToS(sToZ(result.s)), result.s, 1e-10, 'S→Z→S');
    matrixClose(abcdToS(sToAbcd(result.s)), result.s, 1e-12, 'S→ABCD→S');
  });
  const sweep = sweepCascade(CHAIN, { start: 0.5e9, stop: 3e9, points: 6 });
  near(sweep.s21Db[2], 20 * Math.log10(Math.hypot(...reference.s[2][1][0])), 1e-9, 'sweep');
});

test('lossless and reciprocal networks are recognised', () => {
  const lossless = cascade([{ type: 'series-l', value: 10e-9 }, { type: 'shunt-c', value: 4e-12 }, { type: 'line', z0: 75, length: 0.1, vf: 0.66 }], 1e9);
  assert.equal(lossless.lossless, true);
  assert.equal(lossless.reciprocal, true);
  assert.equal(cascade([{ type: 'series-r', value: 25 }], 1e9).lossless, false);
  // A quarter-wave 70.71 Ω line ending in the 50 Ω port looks like 5000/50 = 100 Ω: Γ = 1/3.
  const quarter = cascade([{ type: 'line', z0: Math.sqrt(5000), length: 299792458 / 4e9, vf: 1 }], 1e9);
  const s11 = quarter.s[0][0], d = (1 - s11.re) ** 2 + s11.im ** 2;
  near(50 * ((1 + s11.re) * (1 - s11.re) - s11.im ** 2) / d, 100, 1e-9, 'Zin = Z0²/ZL');
  const s = quarter.s, gin = inputReflection(s, { re: 0, im: 0 });
  near(Math.hypot(gin.re, gin.im), 1 / 3, 1e-12, 'Γin with matched load = S11');
});

test('amplifier stability and maximum gain equal scikit-rf (Pozar example 12.x device)', () => {
  const s = [[fromPolar(0.61, -170), fromPolar(0.05, 16)], [fromPolar(2.24, 32), fromPolar(0.51, -67)]];
  const result = amplifierStability(s);
  near(result.k, reference.amp.k, 1e-12, 'K');
  near(result.maxGain, reference.amp.mag, 1e-9, 'MAG');
  near(result.maxStableGain, reference.amp.msg, 1e-9, 'MSG');
  assert.equal(result.unconditional, true);
  // Conjugate match: Γin(ΓL) = ΓS* when both ports are matched.
  const gin = inputReflection(s, result.match.gammaL);
  near(gin.re, result.match.gammaS.re, 1e-9, 'Γin re'); near(gin.im, -result.match.gammaS.im, 1e-9, 'Γin im');
});

test('rectangular waveguide: WR-90 cut-off, mode order, TE10 copper loss (scikit-rf)', () => {
  const wg = rectangularWaveguide({ a: 22.86e-3, b: 10.16e-3, frequency: 10e9, sigma: 5.8e7 });
  near(wg.dominant.cutoff, reference.wg.fc, 1, 'fc');
  assert.equal(wg.dominant.name, 'TE10');
  assert.deepEqual(wg.modes.slice(0, 4).map((mode) => mode.name), ['TE10', 'TE20', 'TE01', 'TE11']);
  near(wg.conductorLoss.alpha, reference.wg.alpha, 1e-9, 'αc');
  near(wg.singleModeBand[1], 2 * wg.dominant.cutoff, 1, 'TE20 = 2 fc10');
  const te10 = wg.dominant, ratio = te10.cutoff / 10e9;
  near(te10.guideWavelength, 0.0299792458 / Math.sqrt(1 - ratio ** 2), 1e-12, 'λg');
  near(te10.phaseVelocity * te10.groupVelocity, 299792458 ** 2, 1e3, 'vp·vg = c²');
  const evanescent = wg.modes.find((mode) => !mode.propagating);
  assert.ok(evanescent.attenuation > 0);
  const pattern = rectangularModePattern({ kind: 'TE', m: 1, n: 0 }, 1, 0.5, 20, 4);
  assert.ok(pattern.every((cell) => Math.abs(cell.ex) < 1e-12));
  near(Math.max(...pattern.map((cell) => cell.magnitude)), 1, 1e-12, 'peak');
});

test('circular waveguide uses the Bessel zeros: TE11 dominant then TM01', () => {
  const guide = circularWaveguide({ radius: 0.01, frequency: 10e9 });
  assert.deepEqual(guide.modes.slice(0, 3).map((mode) => mode.name), ['TE11', 'TM01', 'TE21']);
  near(guide.dominant.cutoff, 299792458 * 1.8411837813406595 / (2 * Math.PI * 0.01), 1e-3, 'TE11');
  // TE0m and TM1m share zeros (J0' = −J1).
  near(BESSEL_ZEROS.TE[0][0], BESSEL_ZEROS.TM[1][0], 0, 'J0′ = −J1');
});

test('plane waves: free space, copper skin depth, seawater', () => {
  const air = planeWave({ frequency: 1e9 });
  near(air.etaMagnitude, 376.730313, 1e-5, 'η0');
  near(air.wavelength, 0.299792458, 1e-12, 'λ');
  near(planeWave({ frequency: 1e6, sigma: 5.8e7 }).skinDepth, skinDepth(1e6, 5.8e7), 1e-12, 'δ');
  near(skinDepth(1e6, 5.8e7) * 1e6, 66.085, 0.01, 'copper δ at 1 MHz');
  const sea = planeWave({ frequency: 1e3, epsR: 81, sigma: 4 });
  assert.equal(sea.regime, 'good conductor');
  near(sea.etaAngle, 45, 0.01, 'conductor η angle');
});

test('Fresnel: Brewster, total internal reflection and energy conservation', () => {
  near(fresnel({ n1: 1, n2: 1.5, angle: Math.atan(1.5) * 180 / Math.PI }).Rp, 0, 1e-25, 'Rp at Brewster');
  for (const angle of [0, 20, 40, 60, 80]) {
    const r = fresnel({ n1: 1, n2: 1.5, angle });
    near(r.Rs + r.Ts, 1, 1e-12, `s @ ${angle}`); near(r.Rp + r.Tp, 1, 1e-12, `p @ ${angle}`);
  }
  near(fresnel({ n1: 1, n2: 1.5, angle: 0 }).Rs, 0.04, 1e-12, 'normal incidence');
  const tir = fresnel({ n1: 1.5, n2: 1, angle: 60 });
  assert.equal(tir.tir, true); near(tir.Rs, 1, 1e-12, 'TIR'); near(tir.critical, 41.8103149, 1e-6, 'θc');
  const normal = normalIncidence(377, 50);
  near(normal.gamma.re, -327 / 427, 1e-12, 'Γ'); near(normal.reflectance + normal.transmittance, 1, 1e-12, 'R+T');
});

test('polarisation: linear, circular sense (IEEE) and ellipse geometry', () => {
  assert.equal(polarization({ ex: 1, ey: 0.5, phase: 0 }).kind, 'linear');
  assert.equal(polarization({ ex: 1, ey: 1, phase: -90 }).sense, 'right-hand');
  assert.equal(polarization({ ex: 1, ey: 1, phase: 90 }).sense, 'left-hand');
  const ellipse = polarization({ ex: 1, ey: 2, phase: 30 });
  const radii = ellipse.trace.map(([x, y]) => Math.hypot(x, y));
  near(Math.max(...radii) / Math.min(...radii), ellipse.axialRatio, 0.01, 'axial ratio from the traced ellipse');
});

test('point charges: superposition, potential and Gauss\'s law', () => {
  const field = chargeField([{ q: 1e-9, x: 0, y: 0 }], 1, 0);
  near(field.ex, 8.98755, 1e-4, 'kq/r²'); near(field.v, 8.98755, 1e-4, 'kq/r');
  const dipole = [{ q: 1e-9, x: -0.5, y: 0 }, { q: -1e-9, x: 0.5, y: 0 }];
  near(chargeField(dipole, 0, 1).v, 0, 1e-12, 'dipole bisector');
  const charges = [{ q: 1e-9, x: 0, y: 0 }, { q: -3e-9, x: 0.5, y: 0 }, { q: 2e-9, x: 3, y: 0 }];
  const gauss = gaussFlux(charges, { radius: 1 });
  near(gauss.flux / gauss.expected, 1, 1e-4, 'flux = Q/ε0');
  const map = fieldMap(dipole, { xMin: -2, xMax: 2, yMin: -1.5, yMax: 1.5, columns: 10, rows: 8, linesPerCharge: 6 });
  assert.equal(map.potential.length, 8); assert.equal(map.lines.length, 6);
  assert.ok(map.lines.some((line) => Math.hypot(line.at(-1)[0] - 0.5, line.at(-1)[1]) < 0.05), 'a line ends on the negative charge');
});
