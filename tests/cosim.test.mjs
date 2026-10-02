import test from 'node:test';
import assert from 'node:assert/strict';
import { circuitNodes, createCoSimulation } from '../src/engines/cosim.js';
import { createTransientSession, simulateTransient } from '../src/engines/circuit-engine.js';
import { AVR_EXAMPLES, UnoBoard } from '../packages/mcu/src/index.mjs';

const R = (id, value, n1, n2) => ({ id, type: 'resistor', label: id, value, n1, n2 });
const C = (id, value, n1, n2) => ({ id, type: 'capacitor', label: id, value, n1, n2 });
const V = (id, value, n1, n2) => ({ id, type: 'voltage', label: id, value, n1, n2 });
const boardFor = (id) => { const example = AVR_EXAMPLES.find((entry) => entry.id === id); return new UnoBoard(example.hex, example.board, { capture: false }); };
const serial = (board) => Buffer.from(board.mcu.usart.output).toString();

test('step-by-step transient session matches the batch solver and handles value changes', () => {
  const circuit = [V('V1', 0, 'in', '0'), R('R1', 1000, 'in', 'out'), C('C1', 1e-6, 'out', '0')];
  const session = createTransientSession(circuit);
  session.setValue('V1', 2);
  for (let k = 0; k < 2000; k += 1) session.step(1e-6);
  const batch = simulateTransient([V('V1', 2, 'in', '0'), R('R1', 1000, 'in', 'out'), C('C1', 1e-6, 'out', '0')], [], [], { stopTime: 0.002, timeStep: 1e-6, stimulus: { shape: 'step' } });
  assert.ok(Math.abs(session.voltage('out') - batch.nodes.out.at(-1)) < 1e-4);
  assert.ok(Math.abs(session.voltage('out') - 2 * (1 - Math.exp(-2))) < 1e-4);
  session.setValue('R1', 1e9); // disconnect: the capacitor holds its charge
  const held = session.voltage('out');
  for (let k = 0; k < 100; k += 1) session.step(1e-5);
  assert.ok(Math.abs(session.voltage('out') - held) < 1e-3);
  assert.equal(session.voltage('nowhere'), Number.NaN);
  assert.throws(() => session.setValue('X9', 1), /not part/);
});

// Expected values: RC filter of PWM gives duty × 5 V; τ = (10 kΩ + 25 Ω pin) × 10 µF = 100.25 ms;
// the divider gives 5 × 4.7 / 14.7 = 1.599 V → ADC 327.
test('PWM DAC: Arduino PWM on D9 through an RC filter is read back on A0', () => {
  const board = boardFor('pwm_dac');
  const cosim = createCoSimulation(board, { components: [R('R1', 10e3, 'pwm', 'out'), C('C1', 10e-6, 'out', '0')], connections: [{ pin: 'D9', node: 'pwm' }, { pin: 'A0', node: 'out' }], maxStep: 50e-6 });
  cosim.advance(0.8);
  assert.match(serial(board), /PWM 64\/255 {2}expected 1\.25 V {2}measured 1\.2[56] V/);
  // Ripple of the filtered PWM (490 Hz) ≈ 5·D(1−D)·T/τ.
  const { time, nodes } = cosim.history;
  const values = nodes.out.filter((_, k) => time[k] > 0.6 && time[k] < 0.69); // before the duty cycle changes
  const ripple = Math.max(...values) - Math.min(...values);
  assert.ok(Math.abs(ripple - 5 * (64 / 255) * (191 / 255) / 490.196 / 0.10025) < 0.002, `ripple ${ripple}`);
});

test('RC time-constant meter measures τ = RC through digital output and ADC', () => {
  const board = boardFor('rc_timer');
  const cosim = createCoSimulation(board, { components: [R('R1', 10e3, 'drive', 'cap'), C('C1', 10e-6, 'cap', '0')], connections: [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }] });
  cosim.advance(0.75);
  const tau = Number(serial(board).match(/tau = ([\d.]+) ms/)[1]);
  assert.ok(Math.abs(tau - 100.25) < 0.4, `tau ${tau}`);
});

test('voltage divider on A0 and a transistor LED driver on D13', () => {
  const divider = boardFor('analog_read');
  createCoSimulation(divider, { components: [V('V1', 5, 'vcc', '0'), R('R1', 10e3, 'vcc', 'a0'), R('R2', 4.7e3, 'a0', '0')], connections: [{ pin: 'A0', node: 'a0' }] }).advance(0.1);
  assert.match(serial(divider), /A0 = 327 {2}\(1\.60 V\)/);
  const blink = boardFor('blink');
  const cosim = createCoSimulation(blink, { components: [V('V1', 5, 'vcc', '0'), R('RL', 220, 'vcc', 'a'), { id: 'D1', type: 'led', label: 'D1', value: 2, n1: 'a', n2: 'c' }, { id: 'Q1', type: 'npn', label: 'Q1', value: 100, n1: 'c', n2: 'b', n3: '0' }, R('RB', 1000, 'd13', 'b')], connections: [{ pin: 'D13', node: 'd13' }], probes: ['c'], maxStep: 200e-6 });
  cosim.advance(0.25);
  assert.ok(cosim.voltage('c') < 0.3, 'transistor saturated while D13 is high');
  cosim.advance(0.5);
  assert.ok(cosim.voltage('c') > 2.5 && cosim.voltage('c') < 5, 'LED off while D13 is low (collector held below the supply by the LED)');
  assert.ok(Math.min(...cosim.history.nodes.c) < 0.3 && Math.max(...cosim.history.nodes.c) > 2.5);
});

test('digital input pins see circuit voltages through the Schmitt trigger', () => {
  const board = boardFor('blink');
  const cosim = createCoSimulation(board, { components: [V('V1', 0, 'src', '0'), R('R1', 1000, 'src', 'in')], connections: [{ pin: 'D2', node: 'in' }] });
  const level = () => board.level(2);
  cosim.session.setValue('V1', 2.0); cosim.advance(0.001); assert.equal(level(), 0); // between VIL and VIH: keeps 0
  cosim.session.setValue('V1', 3.5); cosim.advance(0.001); assert.equal(level(), 1);
  cosim.session.setValue('V1', 2.0); cosim.advance(0.001); assert.equal(level(), 1); // hysteresis
  cosim.session.setValue('V1', 1.0); cosim.advance(0.001); assert.equal(level(), 0);
  assert.throws(() => createCoSimulation(boardFor('blink'), { components: [V('V1', 1, 'a', '0')], connections: [{ pin: 'D2', node: 'zz' }] }), /not in the circuit/);
  assert.throws(() => createCoSimulation(boardFor('blink'), { components: [V('V1', 1, 'a', '0')], connections: [] }), /at least one/);
  assert.deepEqual(circuitNodes([V('V1', 1, 'n10', '0'), R('R1', 1, 'n10', 'n2'), R('R2', 1, 'n2', 'out')], [{ from: 'out', to: 'n2' }]), ['0', 'n2', 'n10']);
});
