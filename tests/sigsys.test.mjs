import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dftSteps, differenceEquation, fftButterflies, fourierSeries, inverseLaplace, inverseZ, limitTheorems, longDivision, numericCoefficients, partialFractions, partialFractionsZ, polyDivide, WAVEFORMS } from '../packages/sigsys/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// scipy.signal.residue / residuez (SciPy 1.17) on the same polynomials.
const reference = JSON.parse(readFileSync(new URL('./fixtures/sigsys/scipy-residue.json', import.meta.url), 'utf8'));
const key = (re, im) => `${re.toFixed(7)},${im.toFixed(7)}`;
const ours = (terms) => terms.map((term) => `${key(term.pole.re, term.pole.im)}:${key(term.residue.re, term.residue.im)}`).sort();
const theirs = (entry) => entry.p.map((pole, i) => `${key(pole[0], pole[1])}:${key(entry.r[i][0], entry.r[i][1])}`).sort();

test('Fourier coefficients of every waveform equal numerical integration', () => {
  for (const type of Object.keys(WAVEFORMS)) {
    const series = fourierSeries(type, { amplitude: 2, duty: 0.3, harmonics: 15 });
    const numeric = numericCoefficients((u) => WAVEFORMS[type].value(u, 2, 0.3), 15, 8192);
    near(series.a0, numeric.a0, 5e-4, `${type} a0`); // midpoint sampling of a jump is good to ~1/8192
    for (const c of series.coefficients) { near(c.an, numeric.an[c.n], 1e-3, `${type} a${c.n}`); near(c.bn, numeric.bn[c.n], 1e-3, `${type} b${c.n}`); }
  }
  const square = fourierSeries('square', { amplitude: 1, harmonics: 199, points: 20001 });
  near(square.overshoot, 0.0895, 0.002, 'Gibbs overshoot ≈ 8.95 % of the jump');
  near(fourierSeries('square', { harmonics: 1 }).powerFraction, 8 / Math.PI ** 2, 1e-4, 'fundamental carries 8/π² of the power');
  near(fourierSeries('triangle', { amplitude: 3 }).rms, 3 / Math.sqrt(3), 1e-6, 'triangle RMS = A/√3');
});

test('Laplace partial fractions match scipy.signal.residue (simple, repeated and complex poles)', () => {
  for (const entry of reference.s) {
    const result = partialFractions(entry.b, entry.a);
    assert.deepEqual(ours(result.terms), theirs(entry), `${JSON.stringify(entry.b)} / ${JSON.stringify(entry.a)}`);
    assert.deepEqual(result.direct.map((c) => c.toFixed(9)), entry.k.filter((c) => c !== 0 || entry.k.length > 1).map((c) => c.toFixed(9)));
  }
});

test('inverse Laplace, limit theorems and polynomial division', () => {
  const f = inverseLaplace([10], [1, 2, 10]); // (10/3)·e^−t·sin 3t
  for (const t of [0, 0.3, 1, 2.5]) near(f.evaluate(t), 10 / 3 * Math.exp(-t) * Math.sin(3 * t), 1e-12, `f(${t})`);
  const step = inverseLaplace([1], [1, 3, 2, 0]); // 1/(s(s+1)(s+2)) → ½ − e^−t + ½e^−2t
  for (const t of [0.1, 1, 4]) near(step.evaluate(t), 0.5 - Math.exp(-t) + 0.5 * Math.exp(-2 * t), 1e-12, `step(${t})`);
  const repeated = inverseLaplace([1], [1, 2, 1]); // t·e^−t
  near(repeated.evaluate(2), 2 * Math.exp(-2), 1e-12, 't·e^−t');
  assert.deepEqual(limitTheorems([1, 3], [1, 3, 2, 0]), { initial: 0, final: 1.5, finalExists: true });
  assert.equal(limitTheorems([1], [1, 0, 1, 0]).finalExists, false, 'poles on the jω axis');
  assert.deepEqual(polyDivide([1, 0, 0, -1], [1, -1]), { quotient: [1, 1, 1], remainder: [0] });
});

test('z-transform partial fractions match scipy.signal.residuez; inverse equals the difference equation', () => {
  for (const entry of reference.z) {
    const result = partialFractionsZ(entry.b, entry.a);
    assert.deepEqual(ours(result.terms), theirs(entry), `${JSON.stringify(entry.b)} / ${JSON.stringify(entry.a)}`);
    result.direct.forEach((c, i) => near(c, entry.k[i], 1e-12, 'direct term'));
    const inverse = inverseZ(entry.b, entry.a, 25);
    const recursion = longDivision(entry.b, entry.a, 25);
    inverse.h.forEach((value, n) => near(value, recursion[n], 1e-9, `h[${n}]`));
  }
  const unstable = inverseZ([1], [1, -1.2]);
  assert.equal(unstable.stable, false); near(unstable.rocRadius, 1.2, 1e-12, 'ROC |z| > 1.2');
  assert.deepEqual(differenceEquation([1], [1, -0.5], [1, 0, 0, 0]), [1, 0.5, 0.25, 0.125]);
});

test('DFT term by term equals the FFT butterflies', () => {
  const x = [1, 2, 3, 4, 0, -1, 0.5, 2];
  const dft = dftSteps(x), fft = fftButterflies(x);
  dft.rows.forEach((row, k) => { near(row.value.re, fft.output[k].re, 1e-12, `Re X[${k}]`); near(row.value.im, fft.output[k].im, 1e-12, `Im X[${k}]`); });
  assert.deepEqual(fft.bitReversedOrder, [0, 4, 2, 6, 1, 5, 3, 7]);
  assert.equal(fft.stages.length, 3); assert.equal(fft.operations.multiplications, 12); assert.equal(dft.operations.multiplications, 64);
  near(dftSteps([1, 2, 3, 4]).rows[1].value.re, -2, 1e-12, 'X[1] of 1 2 3 4'); near(dftSteps([1, 2, 3, 4]).rows[1].value.im, 2, 1e-12, 'Im X[1]');
  assert.throws(() => fftButterflies([1, 2, 3]), /2, 4, 8/);
});
