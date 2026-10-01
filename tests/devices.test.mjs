import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateAC, simulateDC, simulateTransient, opampLimit, OPAMP_GAIN_BANDWIDTH, OPAMP_OPEN_LOOP_GAIN } from '../src/engines/circuit-engine.js';
import { buildIntermediateNetlist } from '../packages/schematic/src/index.mjs';
import { checkElectricalRules, locateElectricalRuleDiagnostic } from '../packages/schematic/src/erc.mjs';
import { getComponentDefinition, nodeFields, pinName } from '../packages/schematic/src/components.mjs';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';
import { annotateReferences } from '../packages/schematic/src/annotation.mjs';
import { pasteComponents } from '../src/core/circuit-editing.js';
import { createProject, validateProject } from '../src/core/project.js';

const part = (id, type, value, n1, n2, n3, extra = {}) => ({ id, type, label: id, value, unit: '', n1, n2, ...(n3 === undefined ? {} : { n3 }), ...extra });
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const VT = 0.025865;

test('three-terminal definitions expose ordered pins and the n3 node field', () => {
  assert.deepEqual(getComponentDefinition('npn').pins, ['collector', 'base', 'emitter']);
  assert.deepEqual(getComponentDefinition('nmos').pins, ['drain', 'gate', 'source']);
  assert.deepEqual(getComponentDefinition('opamp').pins, ['non-inverting', 'inverting', 'output']);
  assert.deepEqual(nodeFields({ type: 'pnp' }), ['n1', 'n2', 'n3']);
  assert.deepEqual(nodeFields({ type: 'resistor' }), ['n1', 'n2']);
  assert.equal(pinName({ type: 'npn' }, 'n2'), 'base');
  assert.equal(pinName({ type: 'opamp' }, 'n3'), 'output');
  assert.deepEqual(annotateReferences([part('a', 'npn', 1, 'c', 'b', 'e'), part('b', 'nmos', 2, 'd', 'g', 's'), part('c', 'opamp', 15, 'p', 'n', 'o')]).components.map((component) => component.id), ['Q1', 'M1', 'U1']);
});

test('netlist, ERC and paste include the third terminal', () => {
  const parts = [part('V1', 'voltage', 5, 'vcc', '0'), part('R1', 'resistor', 1e3, 'vcc', 'c'), part('Q1', 'npn', 100, 'c', 'b', '0'), part('RB', 'resistor', 1e5, 'vcc', 'b')];
  assert.deepEqual(buildIntermediateNetlist(parts).elements.find((element) => element.id === 'Q1').nodes, ['c', 'b', '0']);
  assert.deepEqual(checkElectricalRules(parts), []);
  const floating = checkElectricalRules([...parts.slice(0, 3), part('RB', 'resistor', 1e5, 'vcc', 'x')]);
  assert.ok(floating.some((diagnostic) => diagnostic.code === 'ERC_FLOATING_NODE' && diagnostic.source === 'b'));
  const missing = checkElectricalRules([part('V1', 'voltage', 5, 'a', '0'), part('Q1', 'npn', 100, 'a', 'a', '')]);
  const unconnected = missing.find((diagnostic) => diagnostic.source === 'Q1:n3');
  assert.ok(unconnected, 'missing emitter is reported');
  assert.deepEqual(locateElectricalRuleDiagnostic(parts, [], [], { source: 'Q1:n3' }), [{ componentId: 'Q1', pin: 'n3' }]);
  const pasted = pasteComponents(parts, [parts[2]], { x: 0, y: 0 });
  const copy = pasted.components.at(-1);
  assert.notEqual(copy.n1, 'c');
  assert.notEqual(copy.n2, 'b');
  assert.equal(copy.n3, '0');
});

test('project validation accepts the optional n3 and kp fields and rejects bad ones', () => {
  const project = createProject('Transistors');
  project.circuit.components.push({ ...part('M1', 'nmos', 2, 'd', 'g', '0', { kp: 0.05 }), x: 10, y: 10 });
  assert.equal(validateProject(project).circuit.components.at(-1).n3, '0');
  project.circuit.components.at(-1).n3 = 5;
  assert.throws(() => validateProject(project), /invalid n3/);
  project.circuit.components.at(-1).n3 = '0';
  project.circuit.components.at(-1).kp = Number.NaN;
  assert.throws(() => validateProject(project), /kp/);
});

test('NPN and PNP follow the Ebers-Moll forward-active relations', () => {
  const npn = simulateDC([part('VCC', 'voltage', 12, 'vcc', '0'), part('VB', 'voltage', 5, 'in', '0'), part('RB', 'resistor', 100e3, 'in', 'b'), part('RC', 'resistor', 1e3, 'vcc', 'c'), part('Q1', 'npn', 100, 'c', 'b', '0')]);
  near(npn.currents.Q1 / npn.currents['Q1.base'], 100, 1e-3, 'collector/base current ratio is beta in forward active');
  near(npn.nodes.b, VT * Math.log(npn.currents.Q1 / 1e-14), 1e-4, 'Vbe = Vt ln(Ic/Is)');
  near(npn.nodes.c, 12 - 1e3 * npn.currents.Q1, 1e-9, 'collector KVL');
  const saturated = simulateDC([part('VCC', 'voltage', 12, 'vcc', '0'), part('VB', 'voltage', 5, 'in', '0'), part('RB', 'resistor', 1e3, 'in', 'b'), part('RC', 'resistor', 1e3, 'vcc', 'c'), part('Q1', 'npn', 100, 'c', 'b', '0')]);
  assert.ok(saturated.nodes.c < 0.2, 'heavily driven switch saturates');
  const pnp = simulateDC([part('VCC', 'voltage', 12, 'vcc', '0'), part('RB', 'resistor', 220e3, 'b', '0'), part('RC', 'resistor', 1e3, 'c', '0'), part('Q1', 'pnp', 50, 'c', 'b', 'vcc')]);
  near(pnp.currents.Q1 / pnp.currents['Q1.base'], 50, 1e-3, 'PNP beta');
  assert.ok(pnp.currents.Q1 < 0, 'PNP collector current flows out of the collector');
  near(pnp.nodes.c, -1e3 * pnp.currents.Q1, 1e-9, 'PNP collector load');
  const mirror = simulateDC([part('VCC', 'voltage', 10, 'vcc', '0'), part('RREF', 'resistor', 9.3e3, 'vcc', 'ref'), part('Q1', 'npn', 100, 'ref', 'ref', '0'), part('Q2', 'npn', 100, 'out', 'ref', '0'), part('RL', 'resistor', 2e3, 'vcc', 'out')]);
  near(mirror.currents.Q2, (10 - mirror.nodes.ref) / 9.3e3 * 100 / 102, 1e-9, 'current mirror Iout = Iref beta/(beta+2)');
});

test('MOSFETs follow the level-1 square law in saturation and triode', () => {
  const saturation = simulateDC([part('VDD', 'voltage', 10, 'vdd', '0'), part('VG', 'voltage', 3, 'g', '0'), part('RD', 'resistor', 500, 'vdd', 'd'), part('M1', 'nmos', 2, 'd', 'g', '0')]);
  near(saturation.currents.M1, 0.02 / 2 * (3 - 2) ** 2 * (1 + 0.01 * saturation.nodes.d), 1e-10, 'saturation current');
  const triode = simulateDC([part('VDD', 'voltage', 10, 'vdd', '0'), part('VG', 'voltage', 10, 'g', '0'), part('RD', 'resistor', 1e3, 'vdd', 'd'), part('M1', 'nmos', 2, 'd', 'g', '0', { kp: 0.05 })]);
  const vds = triode.nodes.d;
  near(triode.currents.M1, 0.05 * ((10 - 2) * vds - vds * vds / 2) * (1 + 0.01 * vds), 1e-10, 'triode current with authored kp');
  const off = simulateDC([part('VDD', 'voltage', 10, 'vdd', '0'), part('VG', 'voltage', 1, 'g', '0'), part('RD', 'resistor', 1e3, 'vdd', 'd'), part('M1', 'nmos', 2, 'd', 'g', '0')]);
  near(off.nodes.d, 10, 1e-6, 'below threshold the MOSFET is off');
  const inverter = (vin) => simulateDC([part('VDD', 'voltage', 5, 'vdd', '0'), part('VI', 'voltage', vin, 'in', '0'), part('MP', 'pmos', 1, 'out', 'in', 'vdd'), part('MN', 'nmos', 1, 'out', 'in', '0'), part('RL', 'resistor', 1e6, 'out', '0')]).nodes.out;
  assert.ok(inverter(0) > 4.99 && inverter(5) < 0.01, 'CMOS inverter swings rail to rail');
  near(inverter(2.5), 2.5, 0.05, 'symmetric CMOS inverter switches at VDD/2');
  assert.throws(() => simulateDC([part('V', 'voltage', 1, 'a', '0'), part('M1', 'nmos', 0, 'a', 'a', '0')]), /threshold voltage/);
});

test('op-amp closes the loop, rolls off at GBW/noise-gain and clips at its rails', () => {
  const inverting = [part('V1', 'voltage', 0.5, 'in', '0'), part('R1', 'resistor', 1e3, 'in', 'm'), part('R2', 'resistor', 10e3, 'm', 'out'), part('U1', 'opamp', 15, '0', 'm', 'out')];
  near(simulateDC(inverting).nodes.out, -5 / (1 + 11 / OPAMP_OPEN_LOOP_GAIN), 1e-6, 'finite-gain inverting amplifier');
  const corner = OPAMP_GAIN_BANDWIDTH / 11;
  const response = simulateAC(inverting, [], [], { startFrequency: corner / 100, stopFrequency: corner, pointsPerDecade: 1 });
  near(20 * Math.log10(response.nodes.out.magnitude[0]), 20, 1e-3, 'midband gain 20 dB');
  near(20 * Math.log10(response.nodes.out.magnitude[2]), 20 - 3.0103, 0.01, '-3 dB at GBW / noise gain');
  const follower = simulateDC([part('V1', 'voltage', 3, 'in', '0'), part('U1', 'opamp', 12, 'in', 'out', 'out'), part('RL', 'resistor', 100, 'out', '0')]);
  near(follower.nodes.out, 3, 1e-4, 'voltage follower');
  near(follower.currents.U1, 0.03, 1e-6, 'op-amp sources the load current');
  const clipped = simulateTransient(inverting.map((component) => component.id === 'V1' ? { ...component, value: 2 } : component), [], [], { stopTime: 1e-3, timeStep: 2e-6, stimulus: { shape: 'sine', frequency: 1000 } });
  near(Math.max(...clipped.nodes.out), 15, 1e-3, 'positive clipping at the rail');
  near(Math.min(...clipped.nodes.out), -15, 1e-3, 'negative clipping at the rail');
  assert.ok(!Object.keys(clipped.nodes).some((node) => node.startsWith('#')), 'internal pole node is hidden');
  near(opampLimit(5, 15).slope, 1, 2e-4, 'limiter is linear well inside the rails');
  assert.ok(opampLimit(100, 15).value < 15.0001);
});

test('BJT common-emitter amplifier gain matches gm·RC', () => {
  const amplifier = [part('VCC', 'voltage', 12, 'vcc', '0'), part('VS', 'voltage', 0, 's', '0'), part('CIN', 'capacitor', 10e-6, 's', 'b'), part('R1', 'resistor', 47e3, 'vcc', 'b'), part('R2', 'resistor', 10e3, 'b', '0'), part('RC', 'resistor', 2.2e3, 'vcc', 'c'), part('RE', 'resistor', 470, 'e', '0'), part('CE', 'capacitor', 100e-6, 'e', '0'), part('Q1', 'npn', 100, 'c', 'b', 'e')];
  const bias = simulateDC(amplifier);
  const response = simulateAC(amplifier, [], [], { startFrequency: 1e4, stopFrequency: 1e5, pointsPerDecade: 1, inputSourceId: 'VS' });
  near(response.nodes.c.magnitude[0], bias.currents.Q1 / VT * 2.2e3, 0.5, 'midband gain');
  near(Math.abs(response.nodes.c.phase[0]), 180, 2, 'common emitter inverts (coupling capacitors add ~1°)');
});

test('SPICE export writes transistor, MOSFET, op-amp and per-part diode models', () => {
  const text = buildSpiceNetlist([part('V1', 'voltage', 5, 'vcc', '0'), part('Q1', 'npn', 150, 'c', 'b', '0'), part('M1', 'pmos', 1.5, 'd', 'g', 'vcc', { kp: 0.05 }), part('U1', 'opamp', 12, 'p', 'm', 'out'), part('D1', 'led', 2, 'a', '0')]);
  assert.match(text, /^Q1 c b 0 Q_Q1$/m);
  assert.match(text, /^\.model Q_Q1 NPN\(IS=1e-14 BF=150 BR=1\)$/m);
  assert.match(text, /^M1 d g vcc vcc M_M1 W=1u L=1u$/m);
  assert.match(text, /^\.model M_M1 PMOS\(LEVEL=1 VTO=-1\.5 KP=0\.05 LAMBDA=0\.01\)$/m);
  assert.match(text, /^XU1 p m out OPENENTC_OPAMP vsat=12$/m);
  assert.match(text, /^\.subckt OPENENTC_OPAMP inp inn out params: vsat=15$/m);
  assert.match(text, /^D1 a 0 D_D1$/m);
  assert.match(text, /^\.model D_D1 D\(Is=[0-9.e-]+ N=2\)$/m);
  assert.match(text, /\.end\n$/);
});
