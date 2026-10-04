import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bodeMetrics, circuitResultCsv, circuitTraces, decadeTicks, decimate, linePath, niceRange, stepMetrics, unwrapPhase, waveformMetrics, MAX_PLOT_POINTS } from '../src/core/circuit-plot.js';
import { simulateAC, simulateDC, simulateTransient } from '../src/engines/circuit-engine.js';
import { exampleCircuits } from '../src/data/example-circuits.js';
import { createProject, validateProject } from '../src/core/project.js';
import { readUiSource } from './helpers/ui-source.mjs';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, unit: '', n1, n2 });
const rc = [part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'out'), part('C1', 'capacitor', 1e-6, 'out', '0')];

test('decimation bounds plot size and keeps the extremes and end point', () => {
  const xs = Array.from({ length: 20001 }, (_, index) => index);
  const ys = xs.map((x) => Math.sin(x / 300) + (x === 7777 ? 5 : 0));
  const reduced = decimate(xs, ys);
  assert.ok(reduced.xs.length <= MAX_PLOT_POINTS + 1);
  assert.ok(reduced.ys.includes(Math.max(...ys)), 'spike survives decimation');
  assert.equal(reduced.xs.at(-1), 20000);
  assert.deepEqual(reduced.xs, [...reduced.xs].sort((a, b) => a - b));
  assert.deepEqual(decimate([0, 1], [2, 3]), { xs: [0, 1], ys: [2, 3] });
});

test('axis helpers produce rounded linear ranges and decade ticks', () => {
  assert.deepEqual(niceRange(0, 4.97), { min: 0, max: 6, ticks: [0, 2, 4, 6] });
  assert.deepEqual(niceRange(-7.7, 7), { min: -10, max: 10, ticks: [-10, -5, 0, 5, 10] });
  const flat = niceRange(2, 2);
  assert.ok(flat.min < 2 && flat.max > 2);
  assert.deepEqual(decadeTicks(3, 20000), [10, 100, 1000, 10000]);
  assert.equal(linePath([1, 10, 100], [0, 1, Number.NaN], { width: 100, height: 10, xMin: 1, xMax: 100, yMin: 0, yMax: 1, logX: true }), 'M0.00 10.00L50.00 0.00');
});

test('step and periodic measurements match an ideal first-order response', () => {
  const time = Array.from({ length: 20001 }, (_, index) => index * 1e-6);
  const values = time.map((t) => 1 - Math.exp(-t / 1e-3));
  const metrics = stepMetrics(time, values);
  near(metrics.riseTime, 1e-3 * Math.log(9), 2e-6, '10-90 % rise time is tau ln 9');
  near(metrics.overshootPercent, 0, 1e-9, 'first-order response does not overshoot');
  const flat = stepMetrics([0, 1], [3, 3]);
  assert.equal(flat.riseTime, null);
  const sine = waveformMetrics(Array.from({ length: 1000 }, (_, index) => 2 * Math.sin(2 * Math.PI * index / 1000)));
  near(sine.rms, Math.SQRT2, 1e-9, 'sine RMS');
  near(sine.peakToPeak, 4, 1e-4, 'sine peak-to-peak');
  near(sine.average, 0, 1e-12, 'sine mean');
});

test('Bode measurements locate the RC corner and unwrap phase', () => {
  const result = simulateAC(rc, [], [], { startFrequency: 1, stopFrequency: 1e5, pointsPerDecade: 50 });
  const metrics = bodeMetrics(result.frequency, result.nodes.out.magnitude, result.nodes.out.phase);
  near(metrics.upperCutoff, 1 / (2 * Math.PI * 1e-3), 0.5, 'upper -3 dB frequency');
  assert.equal(metrics.lowerCutoff, null);
  assert.deepEqual(unwrapPhase([170, -170, -150]), [170, 190, 210]);
});

test('traces and CSV export cover node voltages and component currents', () => {
  const transient = simulateTransient(rc, [], [], { stopTime: 1e-4, timeStep: 1e-5 });
  assert.deepEqual(circuitTraces(transient).map((trace) => trace.key), ['V(in)', 'V(out)', 'I(V1)', 'I(R1)', 'I(C1)']);
  const csv = circuitResultCsv(transient).trim().split('\n');
  assert.equal(csv[0], 'time_s,V(in)_V,V(out)_V,I(V1)_A,I(R1)_A,I(C1)_A');
  assert.equal(csv.length, 12);
  const ac = circuitResultCsv(simulateAC(rc, [], [], { startFrequency: 10, stopFrequency: 100, pointsPerDecade: 1 })).trim().split('\n');
  assert.equal(ac[0], 'frequency_hz,V(in)_dB,V(in)_phase_deg,V(out)_dB,V(out)_phase_deg');
  assert.throws(() => circuitResultCsv(simulateDC(rc)), /Only built-in transient and AC/);
  assert.deepEqual(circuitTraces(null), []);
});

test('every example circuit is a valid project circuit that its configured analysis solves', () => {
  for (const example of exampleCircuits) {
    const project = createProject(example.name);
    project.circuit.components = structuredClone(example.components);
    validateProject(project);
    const config = example.analysis;
    if (config.analysis === 'ac') {
      const result = simulateAC(example.components, [], [], { startFrequency: config.startHz, stopFrequency: config.stopHz, pointsPerDecade: config.pointsPerDecade, inputSourceId: config.source ?? 'V1' });
      assert.ok(result.nodes[example.trace.slice(2, -1)], `${example.id} trace exists`);
    } else if (config.analysis === 'transient') {
      const result = simulateTransient(example.components, [], [], { stopTime: config.stopTime, timeStep: config.timeStep, stimulus: { sourceId: config.source ?? 'V1', shape: config.shape, frequency: config.frequency } });
      assert.ok(circuitTraces(result).some((trace) => trace.key === example.trace), `${example.id} trace exists`);
    } else {
      assert.ok(Number.isFinite(simulateDC(example.components).nodes[example.trace.slice(2, -1)]), `${example.id} trace exists`);
    }
  }
});

test('Circuit Lab offers built-in DC, transient and AC analyses with plots and examples', async () => {
  const app = readUiSource();
  assert.match(app, /data-builtin-field="analysis"/);
  assert.match(app, /simulateTransient\(components, wires, netLabels/);
  assert.match(app, /simulateAC\(components, wires, netLabels/);
  assert.match(app, /data-action="export-circuit-csv"/);
  assert.match(app, /data-load-example=/);
});
