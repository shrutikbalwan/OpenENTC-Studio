import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDC, simulateTransient, simulateAC, stimulusWaveform, logFrequencies, sampleWaveform, MAX_TRANSIENT_POINTS } from '../src/engines/circuit-engine.js';
import { createProject, validateProject, serializeProject } from '../src/core/project.js';

test('solves a 9 V voltage divider', () => {
  const result = simulateDC(createProject().circuit.components);
  assert.ok(Math.abs(result.nodes.vcc - 9) < 1e-9);
  assert.ok(Math.abs(result.nodes.out - 6) < 1e-9);
  assert.ok(Math.abs(result.currents.R1 - 0.003) < 1e-9);
  assert.ok(Math.abs(result.totalPower - 0.027) < 1e-9);
});

test('DC solver resolves explicit wire aliases', () => {
  const project = createProject();
  project.circuit.components.find((part) => part.id === 'R2').n1 = 'sense';
  project.circuit.wires.push({ from: 'sense', to: 'out' });
  const result = simulateDC(project.circuit.components, project.circuit.wires);
  assert.ok(Math.abs(result.nodes.out - 6) < 1e-9);
});

test('rejects circuits without a source', () => {
  assert.throws(() => simulateDC([{ id: 'R1', type: 'resistor', label: 'R1', value: 1000, n1: 'a', n2: '0' }]), /voltage source/);
});

test('solves an oriented current source through a resistor', () => {
  const result = simulateDC([
    { id: 'I1', type: 'current', label: 'I1', value: 0.001, unit: 'A', n1: 'sense', n2: '0' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'sense', n2: '0' }
  ]);
  assert.ok(Math.abs(result.nodes.sense + 1) < 1e-9);
  assert.equal(result.currents.I1, 0.001);
  assert.ok(result.warnings.length === 0);
});

test('DC solver models closed switches as shorts and open switches as open circuits', () => {
  const circuit = (state) => [
    { id: 'V1', type: 'voltage', label: 'V1', value: 5, unit: 'V', n1: 'vcc', n2: '0' },
    { id: 'S1', type: 'switch', label: 'S1', value: state, unit: 'state', n1: 'vcc', n2: 'out' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'out', n2: '0' }
  ];
  const closed = simulateDC(circuit(1));
  assert.ok(Math.abs(closed.nodes.out - 5) < 1e-9);
  assert.ok(Math.abs(closed.currents.S1 - 0.005) < 1e-9);
  assert.deepEqual(closed.warnings, []);
  const open = simulateDC(circuit(0));
  assert.equal(open.nodes.out, 0);
  assert.equal(open.currents.S1, 0);
});

const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, unit: '', n1, n2 });
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test('DC solver finds a diode operating point consistent with its rated forward voltage', () => {
  const forward = simulateDC([part('V1', 'voltage', 5, 'vcc', '0'), part('R1', 'resistor', 430, 'vcc', 'a'), part('D1', 'diode', 0.7, 'a', '0')]);
  near(forward.currents.D1, 0.01, 2e-4, 'diode near its 10 mA rating');
  near(forward.nodes.a, 0.7, 0.002, 'forward drop');
  near(forward.currents.D1, forward.currents.R1, 1e-12, 'KCL at the anode');
  const reverse = simulateDC([part('V1', 'voltage', 5, 'vcc', '0'), part('R1', 'resistor', 330, 'vcc', 'a'), part('D1', 'diode', 0.7, '0', 'a')]);
  near(reverse.nodes.a, 5, 1e-6, 'reverse-biased diode blocks');
  const led = simulateDC([part('V1', 'voltage', 5, 'vcc', '0'), part('R1', 'resistor', 300, 'vcc', 'a'), part('D1', 'led', 2, 'a', '0')]);
  near(led.nodes.a, 2, 0.01, 'LED drop');
  assert.ok(led.totalPower > 0);
});

test('DC solver treats capacitors as open and inductors as shorts', () => {
  const result = simulateDC([part('V1', 'voltage', 10, 'in', '0'), part('L1', 'inductor', 0.01, 'in', 'mid'), part('R1', 'resistor', 1000, 'mid', 'out'), part('C1', 'capacitor', 1e-6, 'out', '0'), part('R2', 'resistor', 1000, 'mid', '0')]);
  near(result.nodes.mid, 10, 1e-9, 'inductor short');
  near(result.nodes.out, 10, 1e-6, 'no current through the capacitor branch');
  near(result.currents.L1, 0.01, 1e-9, 'inductor carries the R2 current');
  assert.equal(result.currents.C1, 0);
});

test('DC solver rejects invalid reactive and diode values', () => {
  assert.throws(() => simulateDC([part('V1', 'voltage', 5, 'a', '0'), part('C1', 'capacitor', 0, 'a', '0')]), /capacitance greater than zero/);
  assert.throws(() => simulateDC([part('V1', 'voltage', 5, 'a', '0'), part('L1', 'inductor', -1, 'a', 'b'), part('R1', 'resistor', 1, 'b', '0')]), /inductance greater than zero/);
  assert.throws(() => simulateDC([part('V1', 'voltage', 5, 'a', '0'), part('D1', 'diode', 0, 'a', '0')]), /forward voltage/);
});

test('transient RC step response follows 1 - exp(-t/RC)', () => {
  const result = simulateTransient([part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'out'), part('C1', 'capacitor', 1e-6, 'out', '0')], [], [], { stopTime: 5e-3, timeStep: 1e-6 });
  assert.equal(result.kind, 'circuit-transient');
  assert.equal(result.time.length, 5001);
  assert.equal(result.nodes.out[0], 0);
  for (const t of [0.5e-3, 1e-3, 3e-3]) near(result.nodes.out[Math.round(t / 1e-6)], 5 * (1 - Math.exp(-t / 1e-3)), 1e-4, `v(${t})`);
  near(result.currents.C1[1000], 5e-3 * Math.exp(-1), 1e-6, 'capacitor current at one time constant');
});

test('transient RL current and LC ringing match closed-form results', () => {
  const rl = simulateTransient([part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'x'), part('L1', 'inductor', 1, 'x', '0')], [], [], { stopTime: 3e-3, timeStep: 1e-6 });
  near(rl.currents.L1[1000], 5e-3 * (1 - Math.exp(-1)), 1e-7, 'inductor current at one time constant');
  const lc = simulateTransient([part('V1', 'voltage', 1, 'in', '0'), part('L1', 'inductor', 1e-3, 'in', 'y'), part('C1', 'capacitor', 1e-6, 'y', '0')], [], [], { stopTime: 1e-3, timeStep: 1e-7 });
  const period = 2 * Math.PI * Math.sqrt(1e-3 * 1e-6);
  near(lc.nodes.y[Math.round(period / 2 / 1e-7)], 2, 1e-3, 'undamped LC peaks at twice the step');
  near(Math.min(...lc.nodes.y.slice(1)), 0, 1e-3, 'trapezoidal integration does not add damping');
});

test('transient stimulus drives sine and pulse waveforms through the selected source', () => {
  const sine = simulateTransient([part('V1', 'voltage', 2, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'out'), part('C1', 'capacitor', 1e-6, 'out', '0')], [], [], { stopTime: 0.05, timeStep: 1e-5, stimulus: { shape: 'sine', frequency: 1 / (2 * Math.PI * 1e-3) } });
  near(Math.max(...sine.nodes.out.slice(-700)), 2 / Math.SQRT2, 2e-3, 'RC attenuates by 1/sqrt(2) at the corner frequency');
  const pulse = stimulusWaveform({ shape: 'pulse', frequency: 1000, amplitude: 3 });
  assert.deepEqual([0, 0.2e-3, 0.5e-3, 0.7e-3, 1.2e-3].map(pulse), [0, 3, 3, 0, 3]);
  assert.equal(stimulusWaveform({ shape: 'step', offset: 1 }, 4)(1e-9), 5);
  const square = stimulusWaveform({ shape: 'square', frequency: 1000, amplitude: 2, offset: 1, duty: 0.25 });
  assert.deepEqual([0.1e-3, 0.3e-3, 0.9e-3, 1.2e-3].map(square), [3, -1, -1, 3]);
  const triangle = stimulusWaveform({ shape: 'triangle', frequency: 1000, amplitude: 2 });
  assert.deepEqual([0, 0.25e-3, 0.5e-3, 0.75e-3].map((t) => Math.round(triangle(t) * 1e9) / 1e9), [0, 2, 0, -2]);
  const saw = stimulusWaveform({ shape: 'sawtooth', frequency: 1000, amplitude: 1 });
  assert.deepEqual([0, 0.25e-3, 0.5e-3].map((t) => Math.round(saw(t) * 1e9) / 1e9), [-1, -0.5, 0]);
  assert.throws(() => stimulusWaveform({ shape: 'pulse', duty: 1.5 }), /Duty cycle/);
  assert.throws(() => stimulusWaveform({ shape: 'saw' }), /Stimulus shape/);
  assert.throws(() => simulateTransient([part('V1', 'voltage', 1, 'a', '0'), part('R1', 'resistor', 1, 'a', '0')], [], [], { stopTime: 1, timeStep: 1e-6 }), new RegExp(String(MAX_TRANSIENT_POINTS)));
  assert.throws(() => simulateTransient([part('V1', 'voltage', 1, 'a', '0'), part('R1', 'resistor', 1, 'a', '0')], [], [], { stopTime: 1e-3, timeStep: 1e-5, stimulus: { sourceId: 'V9' } }), /not an independent source/);
});

test('AC analysis returns the RC low-pass corner, slope and phase', () => {
  const corner = 1 / (2 * Math.PI * 1e-3);
  const result = simulateAC([part('V1', 'voltage', 0, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'out'), part('C1', 'capacitor', 1e-6, 'out', '0')], [], [], { startFrequency: corner, stopFrequency: corner * 100, pointsPerDecade: 1 });
  assert.equal(result.kind, 'circuit-ac');
  assert.deepEqual(result.frequency.length, 3);
  near(20 * Math.log10(result.nodes.out.magnitude[0]), -3.0103, 1e-3, 'magnitude at the corner');
  near(result.nodes.out.phase[0], -45, 1e-6, 'phase at the corner');
  near(20 * Math.log10(result.nodes.out.magnitude[2] / result.nodes.out.magnitude[1]), -20, 0.05, 'roll-off per decade');
  near(result.nodes.in.magnitude[1], 1, 1e-12, 'input node carries the 1 V stimulus');
});

test('AC analysis finds series RLC resonance and linearizes diodes at the bias point', () => {
  const resonance = 1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-6));
  const rlc = simulateAC([part('V1', 'voltage', 0, 'in', '0'), part('L1', 'inductor', 1e-3, 'in', 'a'), part('C1', 'capacitor', 1e-6, 'a', 'out'), part('R1', 'resistor', 10, 'out', '0')], [], [], { startFrequency: resonance, stopFrequency: resonance * 10, pointsPerDecade: 1 });
  near(rlc.nodes.out.magnitude[0], 1, 1e-9, 'resistor sees the full input at resonance');
  const biased = simulateAC([part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'a'), part('D1', 'diode', 0.7, 'a', '0')], [], [], { startFrequency: 100, stopFrequency: 1000, pointsPerDecade: 1 });
  const bias = simulateDC([part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'a'), part('D1', 'diode', 0.7, 'a', '0')]);
  const rd = 0.025865 / bias.currents.D1;
  near(biased.nodes.a.magnitude[0], rd / (1000 + rd), 1e-4, 'small-signal divider uses the diode dynamic resistance');
  assert.throws(() => logFrequencies(10, 1e12, 200), /limited to 1000/);
  assert.throws(() => logFrequencies(0, 10, 10), /Start frequency/);
});

test('creates bounded waveform samples', () => {
  const wave = sampleWaveform({ shape: 'square', frequency: 1000, amplitude: 3, offset: 1 }, 20);
  assert.equal(wave.length, 20);
  assert.deepEqual([...new Set(wave.map((point) => point.v))].sort(), [-2, 4]);
});

test('round-trips a valid project', () => {
  const project = createProject('Test project');
  assert.equal(validateProject(JSON.parse(serializeProject(project))).name, 'Test project');
});

test('rejects malformed project component numbers', () => {
  const project = createProject('Invalid project');
  project.circuit.components[0].x = Number.NaN;
  assert.throws(() => validateProject(project), /invalid x/);
});

// Reference: ngspice 42 on the exported netlist (PULSE source, adaptive steps) gives V(c) = 3.8789 V
// 0.5 ms after the transistor switches off. Integrating trapezoidally straight across the edge
// rang up to ~5.4 V; backward Euler after each stimulus edge matches SPICE's breakpoint handling.
test('transient restarts with backward Euler at stimulus edges (BJT turn-off matches ngspice)', () => {
  const comps = [part('V1', 'voltage', 5, 'vcc', '0'), part('RL', 'resistor', 220, 'vcc', 'a'), part('D1', 'led', 2, 'a', 'c'), { id: 'Q1', type: 'npn', label: 'Q1', value: 100, n1: 'c', n2: 'b', n3: '0' }, part('RB', 'resistor', 1025, 'd13', 'b'), part('VG', 'voltage', 5, 'd13', '0')];
  const result = simulateTransient(comps, [], [], { stopTime: 0.01, timeStep: 5e-6, stimulus: { sourceId: 'VG', shape: 'pulse', frequency: 100, amplitude: 5 } });
  const at = (t) => result.nodes.c[result.time.findIndex((time) => time >= t)];
  near(at(0.004), 0.0435, 2e-3, 'saturated');
  near(at(0.0055), 3.8789, 5e-3, 'off, LED leakage');
  assert.ok(Math.max(...result.nodes.c) < 5, 'no overshoot above the supply');
});

test('DC results report the convergence aids used and warn about non-physical node voltages', () => {
  const p = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
  const diode = simulateDC([p('V1', 'voltage', 5, 'a', '0'), p('R1', 'resistor', 1000, 'a', 'b'), p('D1', 'diode', 0.7, 'b', '0')]);
  assert.ok(diode.solver.newtonIterations > 1, 'a diode needs Newton iterations');
  assert.equal(diode.solver.gminShunt, false);
  assert.equal(diode.solver.sourceStepping, false);
  assert.deepEqual(diode.warnings, []);
  const floating = simulateDC([p('V1', 'voltage', 5, 'a', '0'), p('C1', 'capacitor', 1e-6, 'a', 'b'), p('C2', 'capacitor', 1e-6, 'b', '0')]);
  assert.equal(floating.solver.gminShunt, true, 'the node between two capacitors needs the GMIN shunt in DC');
  assert.equal(floating.solver.newtonIterations, 0, 'a linear circuit is solved directly');
  const reverse = simulateDC([p('I1', 'current', 1, '0', 'a'), p('D1', 'diode', 0.7, '0', 'a')]);
  assert.ok(reverse.nodes.a > 1e6);
  assert.match(reverse.warnings.join('\n'), /Node a reaches 1\.00e\+12 V\. This is not physical/);
});
