import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDC, simulateTransient } from '../src/engines/circuit-engine.js';
import {
  applyGenerator, applySupplies, autoScale, crossings, diodeTest, dmmDisplay, findTrigger, measure, measureResistance,
  oneTwoFive, phaseDifference, screenTrace, valueAt,
} from '../packages/instruments/src/index.mjs';

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
const sampled = (f, n, duration) => { const time = Array.from({ length: n }, (_, k) => k * duration / (n - 1)); return { time, values: time.map(f) }; };

test('measurements of ideal waveforms match their analytic values', () => {
  const sine = sampled((t) => 1 + 2 * Math.sin(2 * Math.PI * 1000 * t), 4001, 5.3e-3);
  const m = measure(sine.time, sine.values);
  close(m.frequency, 1000, 0.01, 'f'); close(m.pp, 4, 1e-3, 'Vpp'); close(m.mean, 1, 1e-4, 'mean');
  close(m.acRms, Math.SQRT2, 1e-4, 'AC rms'); close(m.rms, Math.sqrt(1 + 2), 1e-4, 'rms'); close(m.duty, 0.5, 1e-3, 'duty');
  const square = sampled((t) => ((t * 2000) % 1 < 0.25 ? 5 : 0), 20001, 4.1e-3);
  const s = measure(square.time, square.values);
  close(s.frequency, 2000, 0.1, 'square f'); close(s.duty, 0.25, 2e-3, 'square duty'); close(s.mean, 1.25, 0.01, 'square mean'); close(s.rms, 5 * Math.sqrt(0.25), 0.02, 'square rms');
  const triangle = sampled((t) => { const u = (t * 500) % 1; return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; }, 8001, 8.2e-3);
  close(measure(triangle.time, triangle.values).acRms, 1 / Math.sqrt(3), 1e-3, 'triangle rms');
  const flat = measure([0, 1, 2], [3, 3, 3]);
  assert.equal(flat.frequency, null); assert.equal(flat.mean, 3); assert.equal(flat.pp, 0);
});

test('phase, trigger, crossings and screen traces', () => {
  const { time, values: a } = sampled((t) => Math.sin(2 * Math.PI * 100 * t), 5001, 0.05);
  const b = time.map((t) => Math.sin(2 * Math.PI * 100 * t - Math.PI / 3)); // lags by 60°
  close(phaseDifference(time, a, b), -60, 0.2, 'phase');
  close(phaseDifference(time, b, a), 60, 0.2, 'phase reversed');
  close(findTrigger(time, a, { level: 0.5, slope: 'rising', from: 0.012 }), 0.02 + Math.asin(0.5) / (2 * Math.PI * 100), 1e-6, 'trigger rising');
  close(findTrigger(time, a, { level: 0, slope: 'falling' }), 0.005, 1e-6, 'trigger falling');
  assert.equal(findTrigger(time, a, { level: 2 }), null);
  assert.deepEqual(crossings(time.slice(0, 4900), a.slice(0, 4900), 0, 0.1).rising.map((t) => Math.round(t * 1000)), [10, 20, 30, 40]);
  close(valueAt(time, a, 0.0025), 1, 1e-4, 'interp');
  const trace = screenTrace(time, a, 0.01, 0.01, 100);
  assert.equal(trace[0].t, 0.01); assert.equal(trace.at(-1).t, 0.02);
  assert.ok(trace.length <= 2 * 100 + 2);
  close(Math.max(...trace.map((p) => p.v)), 1, 1e-3, 'peak kept');
  assert.deepEqual(oneTwoFive(1e-3, 10), [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]);
  assert.equal(autoScale(7, 8), 1); assert.equal(autoScale(0.3, 10), 0.05);
});

test('scope on an RC low-pass at its corner frequency: gain 0.707, phase −45°, square rise time 2.2 RC', () => {
  const R = 1000, C = 1 / (2 * Math.PI * 1000 * R);
  const circuit = [part('V1', 'voltage', 0, 'in', '0'), part('R1', 'resistor', R, 'in', 'out'), part('C1', 'capacitor', C, 'out', '0')];
  const { components, stimulus } = applyGenerator(circuit, { sourceId: 'V1', shape: 'sine', frequency: 1000, vpp: 2 });
  const run = simulateTransient(components, [], [], { stopTime: 0.012, timeStep: 1e-6, stimulus });
  const start = run.time.findIndex((t) => t >= 0.006);
  const time = run.time.slice(start), vin = run.nodes.in.slice(start), vout = run.nodes.out.slice(start);
  close(measure(time, vout).pp / measure(time, vin).pp, Math.SQRT1_2, 2e-3, 'gain');
  close(phaseDifference(time, vin, vout), -45, 0.3, 'phase');
  const square = applyGenerator(circuit, { sourceId: 'V1', shape: 'square', frequency: 50, vpp: 5, offset: 2.5 });
  const step = simulateTransient(square.components, [], [], { stopTime: 0.02, timeStep: 2e-6, stimulus: square.stimulus });
  close(measure(step.time, step.nodes.out).riseTime, Math.log(9) * R * C, 3e-6, 'rise time');
});

test('function generator 50 Ω output halves the amplitude into a 50 Ω load', () => {
  const circuit = [part('V1', 'voltage', 0, 'in', '0'), part('RL', 'resistor', 50, 'in', '0')];
  for (const [impedance, expected] of [['high-z', 4], ['50', 2]]) {
    const { components, stimulus } = applyGenerator(circuit, { sourceId: 'V1', shape: 'square', frequency: 1000, vpp: 4, impedance });
    const run = simulateTransient(components, [], [], { stopTime: 0.003, timeStep: 1e-6, stimulus });
    close(measure(run.time, run.nodes.in).pp, expected, 1e-6, impedance);
  }
  assert.throws(() => applyGenerator(circuit, { sourceId: 'RL' }), /voltage source/);
});

test('multimeter: autoranging display, resistance, diode test', () => {
  assert.equal(dmmDisplay(4.99873, 'V').text, '4.999 V');
  assert.equal(dmmDisplay(0.0123, 'V').text, '12.3 mV');
  assert.equal(dmmDisplay(0, 'Ω').text, '0.0 Ω');
  assert.equal(dmmDisplay(1500, 'V').text, 'OL');
  assert.equal(dmmDisplay(-230.04, 'V').text, '-230.0 V');
  assert.equal(dmmDisplay(2000, 'Ω').text, '2.000 kΩ');
  assert.equal(dmmDisplay(null, 'Ω').text, 'OL');
  assert.equal(dmmDisplay(0, 'A').text, '0.0 µA');
  assert.equal(dmmDisplay(7e6, 'Ω').text, '7.00 MΩ');
  assert.equal(dmmDisplay(2e9, 'Ω').text, 'OL');
  const circuit = [part('V1', 'voltage', 9, 'a', '0'), part('R1', 'resistor', 1000, 'a', 'b'), part('R2', 'resistor', 2000, 'b', '0'), part('R3', 'resistor', 2000, 'b', '0'), part('D1', 'diode', 0.7, 'b', 'c'), part('C1', 'capacitor', 1e-6, 'c', '0')];
  // With V1 off (0 V short) a–0 is a short and b–0 is 1k ‖ 2k ‖ 2k = 500 Ω.
  close(measureResistance(simulateDC, circuit, [], [], 'b', '0').ohms, 500, 1e-6, 'R(b,0)');
  close(measureResistance(simulateDC, circuit.filter((p) => p.id !== 'V1'), [], [], 'a', '0').ohms, 2000, 1e-6, 'R(a,0)');
  assert.equal(measureResistance(simulateDC, circuit, [], [], 'c', '0').ohms, null); // capacitor: open
  const forward = diodeTest(simulateDC, [part('D1', 'diode', 0.7, 'p', 'n'), part('R0', 'resistor', 1e9, 'p', '0'), part('V0', 'voltage', 0, 'n', '0')], [], [], 'p', 'n');
  assert.ok(forward > 0.5 && forward < 0.8, `diode drop ${forward}`);
});

test('bench supply: constant voltage until the current limit, then constant current', () => {
  const circuit = [part('V1', 'voltage', 0, 'p', '0'), part('RL', 'resistor', 100, 'p', '0')];
  const cv = applySupplies(simulateDC, circuit, [], [], [{ sourceId: 'V1', voltage: 5, currentLimit: 0.1 }]);
  assert.equal(cv.status[0].mode, 'CV'); close(cv.status[0].volts, 5, 1e-9, 'CV volts'); close(cv.status[0].amps, 0.05, 1e-9, 'CV amps');
  const cc = applySupplies(simulateDC, circuit, [], [], [{ sourceId: 'V1', voltage: 5, currentLimit: 0.01 }]);
  assert.equal(cc.status[0].mode, 'CC'); close(cc.status[0].volts, 1, 1e-9, 'CC volts'); close(cc.status[0].amps, 0.01, 1e-12, 'CC amps');
  close(simulateDC(cc.components).nodes.p, 1, 1e-9, 'circuit in CC');
  const off = applySupplies(simulateDC, circuit, [], [], [{ sourceId: 'V1', voltage: 5, currentLimit: 1, enabled: false }]);
  assert.equal(off.status[0].mode, 'off'); close(off.status[0].volts, 0, 1e-12, 'off');
});
