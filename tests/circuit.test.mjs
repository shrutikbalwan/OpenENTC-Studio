import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateDC, sampleWaveform } from '../src/engines/circuit-engine.js';
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

test('limited DC solver reports authored switches as unsupported instead of simulating a fake state', () => {
  const result = simulateDC([
    { id: 'V1', type: 'voltage', label: 'V1', value: 5, unit: 'V', n1: 'vcc', n2: '0' },
    { id: 'S1', type: 'switch', label: 'S1', value: 1, unit: 'state', n1: 'vcc', n2: 'out' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'out', n2: '0' }
  ]);
  assert.ok(result.warnings.some((warning) => warning.includes('S1 is ignored')));
  assert.equal(result.nodes.out, 0);
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
