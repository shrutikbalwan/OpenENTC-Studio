import test from 'node:test';
import assert from 'node:assert/strict';
import { ammeterShunt, armImpedance, ayrtonShunt, bridgeDetector, combineErrors, fullScaleToReading, lissajous, phaseFromEllipse, qMeter, rationalApprox, readingStatistics, seriesOhmmeter, solveBridge, voltmeterLoading, voltmeterMultiplier } from '../packages/measurement/src/index.mjs';

const rel = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance + 1e-15, `${label}: ${actual} vs ${expected}`);

test('the general complex balance reproduces every textbook bridge formula', () => {
  const m = solveBridge('maxwell', { R1: 470e3, C1: 0.5e-6, R2: 1000, R3: 1000 }, 1000);
  rel(m.unknown.l, m.closed.l, 1e-12, 'Maxwell L'); rel(m.unknown.r, m.closed.r, 1e-12, 'Maxwell R'); rel(m.unknown.q, m.closed.q, 1e-12, 'Maxwell Q');
  rel(m.closed.l, 0.5, 1e-12, 'Maxwell 0.5 H');
  const h = solveBridge('hay', { R1: 100, C1: 0.1e-6, R2: 1000, R3: 1000 }, 1000);
  rel(h.unknown.l, h.closed.l, 1e-12, 'Hay L'); rel(h.unknown.r, h.closed.r, 1e-12, 'Hay R');
  const o = solveBridge('owen', { R2: 500, C2: 1e-6, R3: 1000, C4: 0.2e-6 }, 1000);
  rel(o.unknown.l, o.closed.l, 1e-12, 'Owen L'); rel(o.unknown.r, o.closed.r, 1e-12, 'Owen R');
  const s = solveBridge('schering', { C2: 100e-12, R3: 1000, R4: 2000, C4: 50e-9 }, 50);
  rel(s.unknown.c, s.closed.c, 1e-12, 'Schering C'); rel(s.unknown.r, s.closed.r, 1e-12, 'Schering R'); rel(s.unknown.d, s.closed.d, 1e-9, 'Schering D');
  rel(solveBridge('desauty', { C2: 1e-6, R3: 1000, R4: 470 }).unknown.c, 0.47e-6, 1e-12, 'De Sauty');
  const w = solveBridge('wien', { R1: 10e3, R2: 10e3, C1: 10e-9, C2: 10e-9, R4: 1000 });
  rel(w.frequency, 1 / (2 * Math.PI * 10e3 * 10e-9), 1e-12, 'Wien f');
  rel(w.ratio, 2, 1e-12, 'Wien ratio');
  assert.ok(w.detector < 1e-12);
  // Off balance the detector is not zero.
  const z1 = armImpedance({ r: 2000, l: 0.6 }, 1000);
  assert.ok(Math.hypot(...Object.values(bridgeDetector(z1, { re: 1000, im: 0 }, { re: 1000, im: 0 }, armImpedance({ r: 470e3, cap: 0.5e-6, form: 'parallel' }, 1000)))) > 1e-3);
});

test('Lissajous ratio and ellipse phase', () => {
  assert.equal(lissajous({ fx: 1000, fy: 3000 }).ratio, '3:1');
  assert.equal(lissajous({ fx: 300, fy: 200 }).ratio, '2:3');
  for (const phase of [0, 30, 45, 60, 90]) {
    const fig = lissajous({ fx: 50, fy: 50, phase, ay: 2 });
    rel(fig.ellipse.phaseFromIntercept, phase, 1e-9, `phase ${phase}`);
    rel(phaseFromEllipse(2 * Math.sin(phase * Math.PI / 180), 2) + 1e-12, phase + 1e-12, 1e-9, 'helper');
  }
  assert.deepEqual([rationalApprox(1.5).p, rationalApprox(1.5).q], [3, 2]);
});

test('reading statistics match Python statistics and error rules', () => {
  const s = readingStatistics([101.2, 101.4, 101.7, 101.3, 101.3, 101.2, 101.0, 101.3, 101.5, 101.1]);
  rel(s.mean, 101.3, 1e-12, 'mean'); // statistics.mean
  rel(s.sd, 0.2, 1e-10, 'stdev'); // statistics.stdev = 0.20000000000000126
  rel(s.probableError, 0.6745 * 0.2, 1e-10, 'probable error');
  rel(s.median, 101.3, 1e-12, 'median');
  const power = combineErrors('product', [{ value: 10, error: 0.01, power: 2 }, { value: 100, error: 0.02, power: 1 }]); // P = I²R
  rel(power.worst, 0.04, 1e-12, 'I²R worst'); rel(power.rss, Math.sqrt(0.02 ** 2 + 0.02 ** 2), 1e-12, 'I²R rss'); rel(power.value, 10000, 1e-12, 'P');
  rel(combineErrors('sum', [{ value: 100, error: 1 }, { value: 50, error: 0.5 }]).worst, 1.5, 1e-12, 'sum');
  rel(fullScaleToReading(1, 150, 75), 2, 1e-12, '±1 % FSD at half scale is ±2 % of reading');
  const load = voltmeterLoading({ vs: 10, ra: 100e3, rb: 100e3, sensitivity: 20e3, range: 10 });
  rel(load.reading, 10 * (100e3 * 200e3 / 300e3) / (100e3 + 100e3 * 200e3 / 300e3), 1e-12, 'loaded reading');
  assert.ok(load.errorPercent < -10);
});

test('meter design and Q-meter', () => {
  rel(ammeterShunt({ im: 1e-3, rm: 100, range: 1 }).shunt, 100 / 999, 1e-12, 'shunt');
  const a = ayrtonShunt({ im: 1e-3, rm: 100, ranges: [0.01, 0.1, 1] });
  rel(a.totalShunt, 100 / 9, 1e-12, 'Ayrton Rsh');
  // Each tap must give full-scale deflection at its range.
  a.taps.forEach((rk, k) => rel(1e-3 * (100 + a.totalShunt - rk) / rk + 1e-3, a.ranges[k], 1e-12, `range ${a.ranges[k]}`));
  rel(a.sections.reduce((x, y) => x + y, 0), a.totalShunt, 1e-12, 'sections sum');
  rel(voltmeterMultiplier({ im: 50e-6, rm: 2000, range: 10 }).multiplier, 198000, 1e-12, 'multiplier');
  const ohm = seriesOhmmeter({ battery: 3, im: 1e-3, rm: 50, halfScale: 1500 });
  rel(ohm.deflection(1500), 0.5, 1e-12, 'half scale');
  // With R1, R2 and the meter, the total resistance seen by Rx equals Rh and Rx = 0 gives full scale.
  const rpar = ohm.r2 * 50 / (ohm.r2 + 50);
  rel(ohm.r1 + rpar, 1500, 1e-9, 'internal resistance');
  rel(3 / 1500 * ohm.r2 / (ohm.r2 + 50), 1e-3, 1e-9, 'full-scale current');
  const q = qMeter({ f1: 1e6, c1: 400e-12, c2: 95e-12, indicatedQ: 120 });
  rel(q.distributedC, 20e-12 / 3, 1e-12, 'Cd');
  rel(q.trueQ, 120 * (1 + q.distributedC / 400e-12), 1e-12, 'true Q');
  rel(1 / (2 * Math.PI * Math.sqrt(q.inductance * (95e-12 + q.distributedC))), 2e6, 1e-12, 'resonates at 2 f1 with C2');
});
