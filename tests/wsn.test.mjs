import test from 'node:test';
import assert from 'node:assert/strict';
import { connectivity, coverage, crossover, deploy, RADIO_DEFAULTS, rxEnergy, simulateLifetime, txEnergy } from '../packages/wsn/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('first-order radio model (Heinzelman 2002 constants)', () => {
  near(crossover(), Math.sqrt(10 / 0.0013), 1e-9, 'd0 ≈ 87.7 m');
  near(txEnergy(4000, 50), 4000 * 50e-9 + 4000 * 10e-12 * 2500, 1e-18, 'free space');
  near(txEnergy(4000, 120), 4000 * 50e-9 + 4000 * 0.0013e-12 * 120 ** 4, 1e-18, 'multipath');
  near(rxEnergy(4000), 2e-4, 1e-18, 'receive');
  // Continuous at d0.
  const d0 = crossover();
  near(txEnergy(1, d0 - 1e-9) / txEnergy(1, d0 + 1e-9), 1, 1e-9, 'continuity');
  assert.equal(RADIO_DEFAULTS.packetBits, 4000);
});

test('deployment, connectivity and coverage', () => {
  const field = deploy({ nodes: 200, seed: 5 });
  assert.equal(field.nodes.length, 200);
  assert.deepEqual(deploy({ nodes: 10, seed: 5 }).nodes, deploy({ nodes: 10, seed: 5 }).nodes, 'seeded');
  const sparse = connectivity(field, 5), dense = connectivity(field, 20);
  assert.ok(dense.connectedFraction > sparse.connectedFraction);
  assert.equal(dense.connectedFraction, 1);
  assert.ok(dense.averageDegree > 15);
  const grid = deploy({ nodes: 100, layout: 'grid' });
  const cov = coverage(grid, Math.SQRT2 * 5 + 0.01);
  near(cov.fraction, 1, 1e-12, 'a 10 m grid is covered by r = 5√2');
  const random = coverage(deploy({ nodes: 300, seed: 2 }), 6);
  near(random.fraction, random.expected, 0.05, 'Poisson coverage 1 − e^(−λπr²)');
});

test('LEACH elects every node exactly once per epoch of 1/p rounds', () => {
  const field = deploy({ nodes: 60, seed: 9, sink: { x: 50, y: 175 } });
  const result = simulateLifetime(field, { protocol: 'leach', chProbability: 0.1, initialEnergy: 100, maxRounds: 30 });
  for (let epoch = 0; epoch < 3; epoch += 1) {
    const heads = result.history.headIds.slice(10 * epoch, 10 * epoch + 10).flat().sort((a, b) => a - b);
    assert.deepEqual(heads, Array.from({ length: 60 }, (_, i) => i), `epoch ${epoch}`);
  }
  near(result.history.heads.slice(0, 30).reduce((s, v) => s + v, 0) / 30, 6, 1e-12, 'p·N heads per round on average');
});

test('lifetime: LEACH outlives direct transmission when the sink is far (Heinzelman et al.)', () => {
  const field = deploy({ nodes: 100, seed: 3, sink: { x: 50, y: 175 } });
  const direct = simulateLifetime(field, { protocol: 'direct' });
  const leach = simulateLifetime(field, { protocol: 'leach' });
  const mte = simulateLifetime(field, { protocol: 'mte' });
  assert.ok(leach.firstDeath > 4 * direct.firstDeath, `${leach.firstDeath} vs ${direct.firstDeath}`);
  assert.ok(mte.firstDeath < direct.firstDeath, 'MTE drains the nodes next to the sink first');
  assert.ok(leach.delivered > direct.delivered);
  // Direct transmission: the farthest node from the sink dies first.
  const far = simulateLifetime(field, { protocol: 'direct', recordRound: direct.firstDeath - 1 });
  const dead = far.snapshot.energy.map((e, i) => (e <= 0 ? i : -1)).filter((i) => i >= 0);
  const farthest = field.nodes.reduce((best, node) => (Math.hypot(node.x - 50, node.y - 175) > Math.hypot(best.x - 50, best.y - 175) ? node : best));
  assert.ok(dead.includes(farthest.id));
  // With the sink inside a small field every distance is below d0 and relaying never pays.
  const centre = deploy({ nodes: 100, seed: 3 });
  assert.equal(simulateLifetime(centre, { protocol: 'mte' }).firstDeath, simulateLifetime(centre, { protocol: 'direct' }).firstDeath);
});
