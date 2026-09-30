import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlowgraph, executeFlowgraph, topologicalOrder, validateFlowgraph } from '../packages/flowgraph/src/index.mjs';

const fixture = { format: 'openentc-flowgraph', version: 1, name: 'QPSK chain', blocks: [
  { id: 'source', kind: 'bit-source', ports: [{ id: 'out', direction: 'output', type: 'bits', rate: 1000 }] },
  { id: 'mod', kind: 'qpsk-modulator', ports: [{ id: 'in', direction: 'input', type: 'bits', rate: 1000 }, { id: 'out', direction: 'output', type: 'complex', rate: 500 }] },
  { id: 'sink', kind: 'constellation-sink', ports: [{ id: 'in', direction: 'input', type: 'complex', rate: 500 }] }
], connections: [{ from: 'source:out', to: 'mod:in' }, { from: 'mod:out', to: 'sink:in' }] };

test('flowgraph validation preserves typed ports and deterministic topological order', () => {
  const graph = validateFlowgraph({ ...fixture, metadata: { keep: true } });
  assert.equal(graph.metadata.keep, true);
  assert.deepEqual(topologicalOrder(graph), ['source', 'mod', 'sink']);
  assert.equal(createFlowgraph().blocks.length, 0);
});

test('flowgraph validation rejects incompatible edges, duplicate ids and cycles', () => {
  assert.throws(() => validateFlowgraph({ ...fixture, connections: [{ from: 'source:out', to: 'sink:in' }] }), /incompatible/);
  assert.throws(() => validateFlowgraph({ ...fixture, blocks: [...fixture.blocks, fixture.blocks[0]] }), /unique/);
  assert.throws(() => validateFlowgraph({ ...fixture, connections: [...fixture.connections, { from: 'sink:in', to: 'source:out' }] }), /direction/);
  const cycle = { ...fixture, blocks: fixture.blocks.map((block) => ({ ...block, ports: block.ports.map((port) => ({ ...port })) })), connections: [...fixture.connections, { from: 'mod:out', to: 'source:out' }] };
  assert.throws(() => validateFlowgraph(cycle), /direction|cycle/);
});

test('offline executor runs the declared QPSK modulation/demodulation path', () => {
  const graph = validateFlowgraph({ format: 'openentc-flowgraph', version: 1, name: 'QPSK offline', blocks: [
    { id: 'source', kind: 'bit-source', data: [0, 1, 1, 0], ports: [{ id: 'out', direction: 'output', type: 'bits', rate: 1000 }] },
    { id: 'mod', kind: 'qpsk-modulator', ports: [{ id: 'in', direction: 'input', type: 'bits', rate: 1000 }, { id: 'out', direction: 'output', type: 'complex', rate: 500 }] },
    { id: 'demod', kind: 'qpsk-demodulator', ports: [{ id: 'in', direction: 'input', type: 'complex', rate: 500 }, { id: 'out', direction: 'output', type: 'bits', rate: 1000 }] },
    { id: 'ber', kind: 'ber', parameters: { expected: [0, 1, 1, 0] }, ports: [{ id: 'in', direction: 'input', type: 'bits', rate: 1000 }] }
  ], connections: [{ from: 'source:out', to: 'mod:in' }, { from: 'mod:out', to: 'demod:in' }, { from: 'demod:out', to: 'ber:in' }] });
  const run = executeFlowgraph(graph);
  assert.equal(run.outputs.ber.rate, 0);
  assert.equal(run.outputs.mod.symbols.length, 2);
});
