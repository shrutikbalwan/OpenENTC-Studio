import test from 'node:test';
import assert from 'node:assert/strict';
import { cellRadius, channelsForGos, clusterForSir, clusterSizes, erlangB, erlangC, fadeMargin, freeSpaceLoss, hataLoss, hexLayout, idealHandoffPoint, inverseNormal, maxAllowedLoss, offeredTraffic, reusePlan, simulateHandoff, trafficForGos } from '../packages/cellular/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('Erlang-B matches the published traffic tables', () => {
  // Erlang-B table (offered traffic for a blocking probability).
  for (const [channels, gos, traffic] of [[10, 0.01, 4.461], [20, 0.01, 12.031], [50, 0.01, 37.901], [10, 0.02, 5.084], [100, 0.01, 84.064], [5, 0.005, 1.132]]) near(trafficForGos(channels, gos), traffic, 1e-3, `A(${channels}, ${gos})`);
  near(erlangB(1, 1), 0.5, 1e-15, 'B(1,1)');
  near(erlangB(2, 2), 0.4, 1e-15, 'B(2,2) = (2²/2)/(1 + 2 + 2)');
  assert.equal(channelsForGos(12.03, 0.01), 20);
  assert.equal(channelsForGos(12.04, 0.01), 21);
  near(offeredTraffic({ users: 2000, callsPerHour: 2, holdingSeconds: 180 }), 200, 1e-12, 'A = UλH');
});

test('Erlang-C waiting probability and delay', () => {
  // M/M/2 with A = 1: C = 1/3 (closed form 2B/(2 − A(1 − B)) with B = 0.2).
  const c = erlangC(1, 2, 120, 60);
  near(c.probabilityWait, 1 / 3, 1e-15, 'C(1, 2)');
  near(c.meanWait, (1 / 3) * 120 / 1, 1e-12, 'mean wait');
  near(c.probabilityWaitLonger, (1 / 3) * Math.exp(-60 / 120), 1e-15, 'P(W > t)');
  assert.equal(erlangC(5, 5).stable, false);
});

test('cluster sizes, reuse ratio and co-channel interference (Rappaport)', () => {
  assert.deepEqual(clusterSizes(21).map((entry) => entry.n), [1, 3, 4, 7, 9, 12, 13, 16, 19, 21]);
  const seven = reusePlan({ cluster: 7, pathLossExponent: 4, totalChannels: 395, cells: 100 });
  near(seven.q, Math.sqrt(21), 1e-15, 'Q = √3N'); near(seven.sirDb, 18.66, 0.005, 'S/I simple'); near(seven.worstSirDb, 17.27, 0.005, 'worst case');
  assert.equal(seven.channelsPerCell, 56); assert.equal(seven.capacity, 5600);
  // Rappaport example 3.3: 15 dB needs N = 7 for n = 4 and N = 12 for n = 3.
  assert.equal(clusterForSir(15, 4), 7); assert.equal(clusterForSir(15, 3), 12);
  // 120° sectoring: 2 interferers → +4.77 dB.
  near(reusePlan({ cluster: 7, sectoring: '120' }).sirDb - seven.sirDb, 10 * Math.log10(3), 1e-12, 'sectoring gain');
  assert.throws(() => reusePlan({ cluster: 5 }), /not a valid cluster/);
});

test('hexagonal layout: N groups, distinct neighbours and co-channel distance √(3N)·R', () => {
  for (const [i, j] of [[1, 1], [2, 0], [2, 1], [3, 0], [2, 2], [3, 1]]) {
    const n = i * i + i * j + j * j;
    const layout = hexLayout({ i, j, rings: 6 });
    assert.equal(new Set(layout.cells.map((cell) => cell.group)).size, n, `groups for N = ${n}`);
    for (const cell of layout.cells.filter((c) => Math.hypot(c.x, c.y) < 6)) {
      const same = layout.cells.filter((other) => other !== cell && other.group === cell.group).map((other) => Math.hypot(other.x - cell.x, other.y - cell.y));
      near(Math.min(...same), Math.sqrt(3 * n), 1e-9, `D for N = ${n}`);
    }
  }
});

test('propagation: free space, Okumura–Hata, COST-231 and cell radius', () => {
  near(freeSpaceLoss(900, 1), 91.525, 0.001, 'FSPL');
  near(hataLoss({ frequencyMHz: 900, baseHeight: 50, mobileHeight: 1.5, distanceKm: 10 }), 157.11, 0.01, 'Hata urban');
  const urban = hataLoss({ frequencyMHz: 900, baseHeight: 30, mobileHeight: 1.5, distanceKm: 5 });
  near(urban - hataLoss({ frequencyMHz: 900, baseHeight: 30, mobileHeight: 1.5, distanceKm: 5, environment: 'suburban' }), 2 * Math.log10(900 / 28) ** 2 + 5.4, 1e-12, 'suburban correction');
  near(hataLoss({ frequencyMHz: 1800, baseHeight: 30, mobileHeight: 1.5, distanceKm: 1, environment: 'urban-large' }) - hataLoss({ frequencyMHz: 1800, baseHeight: 30, mobileHeight: 1.5, distanceKm: 1, environment: 'urban-medium' }), 3 + (1.1 * Math.log10(1800) - 0.7) * 1.5 - (1.56 * Math.log10(1800) - 0.8) - (3.2 * Math.log10(11.75 * 1.5) ** 2 - 4.97), 1e-12, 'COST-231 Cm');
  const options = { frequencyMHz: 900, baseHeight: 30, mobileHeight: 1.5, environment: 'urban-medium' };
  const radius = cellRadius({ ...options, maxLossDb: 140 });
  near(hataLoss({ ...options, distanceKm: radius }), 140, 1e-9, 'radius inverts the loss');
  near(maxAllowedLoss({ eirpDbm: 50, rxSensitivityDbm: -102, rxGainDb: 0, otherLossDb: 3, fadeMarginDb: 8 }), 141, 1e-12, 'allowed loss');
  near(inverseNormal(0.9), 1.2815515655, 1e-7, 'z(0.9)'); near(inverseNormal(0.975), 1.9599639845, 1e-7, 'z(0.975)');
  near(fadeMargin(8, 0.9), 8 * 1.2815515655, 1e-6, 'fade margin');
});

test('handoff: hysteresis point without shadowing, ping-pong with it', () => {
  const ideal = simulateHandoff({ sigmaDb: 0, hysteresisDb: 3, separation: 2, stepM: 1 });
  assert.equal(ideal.handoffs, 1);
  near(ideal.events[0].position, idealHandoffPoint({ separation: 2, exponent: 3.5, hysteresisDb: 3 }), 0.0015, 'handoff point');
  const noisy = simulateHandoff({ sigmaDb: 8, hysteresisDb: 0, seed: 3 });
  const damped = simulateHandoff({ sigmaDb: 8, hysteresisDb: 8, timeToTriggerM: 50, seed: 3 });
  assert.ok(noisy.handoffs > damped.handoffs, `${noisy.handoffs} > ${damped.handoffs}`);
  assert.deepEqual(simulateHandoff({ seed: 9 }).powerA, simulateHandoff({ seed: 9 }).powerA, 'seeded');
});
