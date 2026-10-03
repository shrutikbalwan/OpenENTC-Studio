import test from 'node:test';
import assert from 'node:assert/strict';
import { bode, classifyStability, closedLoop, formatPolynomial, makeTransferFunction, parsePolynomial, pidController, pidLoop, rootLocus, routhArray, stepInfo, timeResponse, zieglerNichols, analyzeSystem } from '../packages/control/src/index.mjs';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test('polynomials parse from coefficient lists and expressions in s', () => {
  assert.deepEqual(parsePolynomial('1 2 1'), [1, 2, 1]);
  assert.deepEqual(parsePolynomial('[1, -3, 2]'), [1, -3, 2]);
  assert.deepEqual(parsePolynomial('(s+1)(s+2)'), [1, 3, 2]);
  assert.deepEqual(parsePolynomial('-s^2 + 2*s'), [-1, 2, 0]);
  assert.deepEqual(parsePolynomial('s(s+1)^2'), [1, 2, 1, 0]);
  assert.deepEqual(parsePolynomial('5'), [5]);
  assert.equal(formatPolynomial([1, -2.5, 0, 1]), 's³ − 2.5s² + 1');
  assert.throws(() => parsePolynomial('s^x'), SyntaxError);
  assert.throws(() => parsePolynomial('(s+1'), SyntaxError);
  assert.throws(() => parsePolynomial('s^30'), /20/);
});

// Step samples from scipy.signal.step.
test('exact step and impulse responses match scipy.signal', () => {
  const g = makeTransferFunction('1', 's^2 + 0.6s + 1');
  const step = timeResponse(g, { duration: 10, points: 11 });
  [0, 0.38141653828792843, 1.0186307301607032, 1.3554539903044769, 1.2944308432181673, 1.0572760678634303, 0.8875035987716834, 0.8721468312223625, 0.9521578255428501, 1.0291623187835264, 1.0512510364468202]
    .forEach((value, k) => near(step.output[k], value, 1e-12, `step[${k}]`));
  const zeroed = timeResponse(makeTransferFunction('2s + 3', '(s+1)(s+2)(s+4)'), { duration: 4, points: 5 });
  [0, 0.2223554569021857, 0.32537921724642527, 0.357785902544119, 0.36881094482494103].forEach((value, k) => near(zeroed.output[k], value, 1e-12, `zero[${k}]`));
  // ζ = 0.3, ωn = 1: overshoot e^(−πζ/√(1−ζ²)) = 37.23 %, peak at π/ωd.
  const info = stepInfo(timeResponse(g, { duration: 30, points: 3001 }), 1);
  near(info.overshoot, 100 * Math.exp(-Math.PI * 0.3 / Math.sqrt(1 - 0.09)), 0.01, 'overshoot');
  near(info.peakTime, Math.PI / Math.sqrt(1 - 0.09), 0.01, 'peak time');
  assert.ok(info.settlingTime > 10 && info.settlingTime < 14);
  const impulse = timeResponse(makeTransferFunction('1', 's + 2'), { input: 'impulse', duration: 1, points: 3 });
  near(impulse.output[2], Math.exp(-2), 1e-12, 'impulse');
  assert.throws(() => timeResponse(makeTransferFunction('s^2', 's + 1')), /proper/);
});

test('Bode margins, Nyquist-ready closed loop and stability classification', () => {
  const loop = makeTransferFunction('10', 's(s+1)(s+5)');
  const { margins, phase } = bode(loop);
  near(phase[0], -90, 1, 'integrator phase');
  near(margins.gainMarginDb, 20 * Math.log10(3), 1e-6, 'gain margin');
  near(margins.phaseCrossover, Math.sqrt(5), 1e-9, 'phase crossover');
  near(margins.phaseMarginDeg, 25.3898, 1e-3, 'phase margin');
  const closed = closedLoop(loop);
  assert.deepEqual(closed.denominator, [1, 6, 5, 10]);
  assert.equal(classifyStability(closed.poles).status, 'stable');
  assert.equal(classifyStability(closedLoop(makeTransferFunction('40', 's(s+1)(s+5)')).poles).status, 'unstable');
  assert.equal(classifyStability(makeTransferFunction('1', 's^2 + 4').poles).status, 'marginal');
  const analysis = analyzeSystem('10', 's(s+1)(s+5)', { feedback: true });
  near(analysis.dcGain, 1, 1e-12, 'type-1 loop has unit DC gain');
  near(analysis.info.steadyStateError, 0, 1e-12, 'zero step error');
  assert.ok(analysis.nyquist.real.length > 100 && analysis.routh.stable);
});

test('Routh-Hurwitz counts right-half-plane roots including special cases', () => {
  const unstable = routhArray('s^4 + 2s^3 + 3s^2 + 4s + 5');
  assert.equal(unstable.signChanges, 2);
  assert.equal(unstable.stable, false);
  assert.deepEqual(unstable.rows.map((row) => row.values[0]), [1, 2, 1, -6, 5]);
  const zeroRow = routhArray('s^5 + 2s^4 + 24s^3 + 48s^2 - 25s - 50');
  assert.equal(zeroRow.signChanges, 1);
  assert.match(zeroRow.notes[0], /auxiliary/);
  assert.equal(routhArray('s^3 + 6s^2 + 11s + 6').stable, true);
  const marginal = routhArray('s^2 + 4');
  assert.equal(marginal.stable, false);
  assert.match(marginal.verdict, /marginally/);
  assert.match(routhArray('s^3 + s^2 + 2s + 8').verdict, /2 roots/);
});

test('root locus finds the jω-axis crossing and asymptotes', () => {
  const locus = rootLocus(makeTransferFunction('1', 's(s+2)(s+4)'));
  assert.equal(locus.branches.length, 3);
  near(locus.centroid, -2, 1e-9, 'centroid');
  assert.deepEqual(locus.asymptoteAngles, [60, 180, 300]);
  near(locus.crossings[0].gain, 48, 1e-6, 'critical gain');
  near(locus.crossings[0].omega, Math.sqrt(8), 1e-6, 'crossing frequency');
  locus.branches.forEach((branch) => near(branch[0].gain, 0, 0, 'starts at K = 0'));
});

test('PID controller and Ziegler-Nichols tuning of a third-order plant', () => {
  const pid = pidController({ kp: 2, ki: 1, kd: 0.5, tf: 0.01 });
  assert.deepEqual(pid.denominator.map((c) => Number(c.toFixed(9))), [1, 100, 0]);
  const plant = makeTransferFunction('1', '(s+1)^3');
  const tuning = zieglerNichols(plant);
  near(tuning.ultimateGain, 8, 1e-9, 'Ku');
  near(tuning.ultimatePeriod, 2 * Math.PI / Math.sqrt(3), 1e-9, 'Tu');
  const rule = tuning.rules.find((entry) => entry.name === 'PID');
  near(rule.kp, 4.8, 1e-9, 'Kp');
  const loop = pidLoop(plant, rule);
  assert.equal(loop.stability.status, 'stable');
  near(loop.info.steadyStateError, 0, 1e-9, 'integral action removes the step error');
  const proportional = pidLoop(plant, { kp: 2 });
  near(proportional.info.finalValue, 2 / 3, 1e-9, 'P-only final value');
  assert.equal(pidLoop(plant, { kp: 9 }).stability.status, 'unstable');
  assert.equal(zieglerNichols(makeTransferFunction('1', 's + 1')).ultimateGain, null);
});
