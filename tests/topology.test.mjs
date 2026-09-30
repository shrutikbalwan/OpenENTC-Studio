import test from 'node:test';
import assert from 'node:assert/strict';
import { topologyMetrics, validateTopology } from '../packages/topology/src/index.mjs';

const topology = { id: 'lan', nodes: [{ id: 'gateway' }, { id: 'sensor' }, { id: 'actuator' }], links: [{ from: 'gateway', to: 'sensor' }, { from: 'sensor', to: 'actuator' }] };

test('topology validation and deterministic reachability metrics', () => {
  assert.equal(validateTopology(topology).nodes.length, 3);
  assert.deepEqual(topologyMetrics(topology, 'gateway').distances, { gateway: 0, sensor: 1, actuator: 2 });
  assert.equal(topologyMetrics(topology, 'gateway').reachable, 3);
});

test('topology rejects duplicate or unknown link endpoints', () => {
  assert.throws(() => validateTopology({ ...topology, links: [{ from: 'gateway', to: 'missing' }] }), /known nodes/);
  assert.throws(() => validateTopology({ ...topology, nodes: [{ id: 'gateway' }, { id: 'gateway' }], links: [] }), /known nodes/);
});
