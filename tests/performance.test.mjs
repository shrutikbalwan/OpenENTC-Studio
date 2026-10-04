// Performance budgets for the engines (Node, single thread). Budgets are about 20× the times
// measured on 2026-10-04 in the reference container, so slower CI runners stay green while a real
// regression (for example an O(n²) algorithm replacing an O(n log n) one) still fails.
// See docs/PERFORMANCE-BUDGETS.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { simulateAC, simulateDC, simulateTransient } from '../src/engines/circuit-engine.js';
import { fft } from '../packages/numerics/src/index.mjs';
import { createProject, validateProject } from '../packages/project-model/src/index.mjs';
import { BUNDLE_BUDGET, checkBundleBudget } from '../scripts/bundle-budget.mjs';

const p = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
const ladder = (sections) => [p('V1', 'voltage', 10, 'n0', '0'), ...Array.from({ length: sections }, (_, i) => [p(`R${i}a`, 'resistor', 1000, `n${i}`, `n${i + 1}`), p(`R${i}b`, 'resistor', 2000, `n${i + 1}`, '0')]).flat()];
/** Median of a few runs, after one warm-up. */
function median(fn, runs = 5) {
  fn();
  const times = Array.from({ length: runs }, () => { const start = performance.now(); fn(); return performance.now() - start; });
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

const BUDGETS = [
  ['DC: 400-resistor ladder', () => simulateDC(ladder(200)), 200], // measured ≈ 10 ms
  ['DC: 20 diode branches (Newton)', () => simulateDC([p('V1', 'voltage', 5, 'a', '0'), ...Array.from({ length: 20 }, (_, i) => [p(`R${i}`, 'resistor', 1000, 'a', `d${i}`), p(`D${i}`, 'diode', 0.7, `d${i}`, '0')]).flat()]), 60], // ≈ 2 ms
  ['transient: RC, 10 000 steps', () => simulateTransient([p('V1', 'voltage', 5, 'in', '0'), p('R1', 'resistor', 1000, 'in', 'out'), p('C1', 'capacitor', 1e-6, 'out', '0')], [], [], { stopTime: 0.01, timeStep: 1e-6 }), 1000], // ≈ 45 ms
  ['AC: RC, 210 frequencies', () => simulateAC([p('V1', 'voltage', 5, 'in', '0'), p('R1', 'resistor', 1000, 'in', 'out'), p('C1', 'capacitor', 1e-6, 'out', '0')], [], [], { startFrequency: 1, stopFrequency: 1e7, pointsPerDecade: 30 }), 80], // ≈ 3 ms
  ['FFT: 4096 samples', () => fft(Array.from({ length: 4096 }, (_, i) => Math.sin(i))), 40], // ≈ 2 ms (was ≈ 500 ms as a direct DFT)
  ['project validation: 1001 components', (() => { const project = createProject('big'); project.circuit.components = ladder(500).map((c, i) => ({ ...c, unit: '', x: (i % 50) * 20, y: Math.floor(i / 50) * 20, rotation: 0 })); const text = JSON.stringify(project); return () => validateProject(JSON.parse(text)); })(), 150], // ≈ 5 ms
];

for (const [name, fn, budgetMs] of BUDGETS) {
  test(`performance budget — ${name} within ${budgetMs} ms`, () => {
    const ms = median(fn);
    assert.ok(ms <= budgetMs, `${name} took ${ms.toFixed(1)} ms; budget ${budgetMs} ms`);
  });
}

test('FFT: the radix-2 and table paths agree with a direct DFT', () => {
  const dft = (x) => x.map((_, k) => x.reduce(([re, im], v, n) => [re + v * Math.cos(-2 * Math.PI * k * n / x.length), im + v * Math.sin(-2 * Math.PI * k * n / x.length)], [0, 0]));
  for (const n of [1, 2, 3, 4, 5, 7, 8, 12, 16, 31, 64, 100, 128, 256]) {
    const x = Array.from({ length: n }, (_, i) => Math.sin(1.3 * i) + 0.5 * Math.cos(0.4 * i * i));
    const fast = fft(x); const slow = dft(x);
    for (let k = 0; k < n; k += 1) {
      assert.ok(Math.abs(fast.real[k] - slow[k][0]) < 1e-9 * Math.max(1, n), `n=${n} re[${k}]`);
      assert.ok(Math.abs(fast.imaginary[k] - slow[k][1]) < 1e-9 * Math.max(1, n), `n=${n} im[${k}]`);
    }
  }
  assert.throws(() => fft([1, Number.NaN]), /sample/);
});

test('bundle budget: totals and the largest file are checked', () => {
  assert.deepEqual(checkBundleBudget([{ path: 'a.js', bytes: 10 }]).problems, []);
  const over = checkBundleBudget([{ path: 'a.js', bytes: BUNDLE_BUDGET.largestFileBytes + 1 }, { path: 'b.js', bytes: BUNDLE_BUDGET.totalBytes }]);
  assert.equal(over.problems.length, 2);
  assert.match(over.problems[0], /total \d+ bytes, over/);
  assert.match(over.problems[1], /b\.js is \d+ bytes/);
});
