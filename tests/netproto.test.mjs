import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arqUtilisation, compressIpv6, csmaCdEfficiency, nonPersistentCsma, onePersistentCsma, dijkstra, distanceVector, expandIpv6, formatIpv4, ipv6Info, linkChange, parseGraph, prefixFromMask, pureAloha, simulateArq, slottedAloha, splitSubnet, subnetInfo, summarize, vlsm } from '../packages/netproto/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// Python 3 ipaddress and scipy.sparse.csgraph.dijkstra on random cases.
const reference = JSON.parse(readFileSync(new URL('./fixtures/netproto/python-reference.json', import.meta.url), 'utf8'));

test('IPv4 subnet facts equal Python ipaddress', () => {
  for (const entry of reference.ipv4) {
    const info = subnetInfo(entry.cidr);
    assert.equal(formatIpv4(info.network), entry.network, entry.cidr);
    assert.equal(formatIpv4(info.broadcast), entry.broadcast, entry.cidr);
    assert.equal(formatIpv4(info.mask), entry.mask, entry.cidr);
    assert.equal(info.size, entry.size, entry.cidr);
  }
  const host = subnetInfo('192.168.10.77/26');
  assert.equal(host.cidr, '192.168.10.64/26'); assert.equal(formatIpv4(host.firstHost), '192.168.10.65'); assert.equal(host.usable, 62);
  assert.equal(subnetInfo('10.1.2.3 255.255.240.0').cidr, '10.1.0.0/20');
  assert.equal(prefixFromMask(0xffffff00), 24);
  assert.throws(() => subnetInfo('10.0.0.1 255.0.255.0'), /contiguous/);
  assert.equal(subnetInfo('8.8.8.8/32').scope, 'public'); assert.equal(subnetInfo('172.20.1.1/16').scope, 'private (RFC 1918)');
});

test('subnetting, VLSM and summarisation', () => {
  const split = splitSubnet('192.168.1.0/24', { count: 6 });
  assert.equal(split.prefix, 27); assert.equal(split.total, 8); assert.equal(split.subnets[5].cidr, '192.168.1.160/27');
  const plan = vlsm('192.168.1.0/24', [{ name: 'A', hosts: 50 }, { name: 'B', hosts: 20 }, { name: 'C', hosts: 100 }, { name: 'D', hosts: 2 }]);
  assert.deepEqual(plan.allocations.map((entry) => `${entry.name} ${entry.cidr}`), ['C 192.168.1.0/25', 'A 192.168.1.128/26', 'B 192.168.1.192/27', 'D 192.168.1.224/30']);
  assert.equal(plan.free, 256 - 128 - 64 - 32 - 4);
  assert.throws(() => vlsm('10.0.0.0/28', [{ name: 'big', hosts: 30 }]), /Not enough space/);
  for (const entry of reference.summaries) assert.equal(summarize(entry.nets).summary.cidr, entry.summary, entry.nets.join(' '));
  assert.equal(summarize(['10.0.0.0/24', '10.0.2.0/24']).exact, false);
});

test('IPv6 compression follows RFC 5952 (Python ipaddress)', () => {
  for (const entry of reference.ipv6) assert.equal(compressIpv6(entry.full), entry.compressed, entry.full);
  assert.equal(expandIpv6('::1').join(':'), '0000:0000:0000:0000:0000:0000:0000:0001');
  assert.equal(compressIpv6('2001:db8:0:0:1:0:0:1'), '2001:db8::1:0:0:1');
  assert.equal(compressIpv6('::ffff:192.0.2.1'), '::ffff:c000:201');
  assert.equal(ipv6Info('2001:db8:abcd:12::1/48').network, '2001:db8:abcd::/48');
  assert.equal(ipv6Info('fe80::1/64').type, 'link-local');
  assert.throws(() => expandIpv6('1::2::3'), /Only one/);
});

test('Dijkstra matches scipy and the Kurose–Ross example', () => {
  for (const graphEntry of reference.graphs) {
    const graph = parseGraph(graphEntry.edges.join('\n'));
    graphEntry.names.forEach((source, i) => {
      const result = dijkstra(graph, source);
      graphEntry.names.forEach((target, j) => assert.equal(result.distance[target], graphEntry.distances[i][j], `${source}→${target}`));
    });
  }
  const kurose = parseGraph('u v 2\nu w 5\nu x 1\nv x 2\nv w 3\nx w 3\nx y 1\nw y 1\nw z 5\ny z 2');
  const result = dijkstra(kurose, 'u');
  // v and y tie at 2 (Kurose picks y); ties go alphabetically here.
  assert.deepEqual(result.steps.map((step) => step.added).join(''), 'uxvywz');
  assert.deepEqual(result.distance, { u: 0, v: 2, w: 3, x: 1, y: 2, z: 4 });
  assert.equal(result.forwarding.find((entry) => entry.destination === 'z').path.join(''), 'uxyz');
});

test('distance vector converges to Dijkstra, counts to infinity, and poisoned reverse helps', () => {
  for (const graphEntry of reference.graphs.slice(0, 5)) {
    const graph = parseGraph(graphEntry.edges.join('\n'));
    const dv = distanceVector(graph);
    assert.equal(dv.converged, true);
    graphEntry.names.forEach((x, i) => graphEntry.names.forEach((y, j) => assert.equal(dv.table[x][y].cost, graphEntry.distances[i][j])));
  }
  // Kurose–Ross: x–y 4, y–z 1, x–z 50; the x–y link rises to 60.
  const graph = parseGraph('x y 4\ny z 1\nx z 50');
  const plain = linkChange(graph, { from: 'x', to: 'y', cost: 60 });
  assert.equal(plain.after.table.z.x.cost, 50); assert.equal(plain.after.table.y.x.cost, 51);
  assert.ok(plain.after.roundsToConverge > 20, `count to infinity: ${plain.after.roundsToConverge} rounds`);
  const poisoned = linkChange(graph, { from: 'x', to: 'y', cost: 60 }, { poisonedReverse: true });
  assert.equal(poisoned.after.table.y.x.cost, 51);
  assert.ok(poisoned.after.roundsToConverge < 4);
  // RIP: a failed link with infinity = 16.
  const rip = linkChange(parseGraph('A B 1\nB C 1'), { from: 'A', to: 'B', cost: Infinity }, { infinity: 16 });
  assert.equal(rip.after.table.C.A.cost, Infinity);
});

test('sliding-window ARQ: losses, retransmissions and utilisation', () => {
  const run = (protocol, extra = {}) => simulateArq({ protocol, frames: 8, window: 4, propagation: 2, ...extra });
  for (const protocol of ['stop-and-wait', 'gbn', 'sr']) {
    const clean = run(protocol);
    assert.equal(clean.retransmissions, 0); assert.deepEqual(clean.deliveries.map((d) => d.seq), [0, 1, 2, 3, 4, 5, 6, 7]);
    const lossy = run(protocol, { lostFrames: [3] });
    assert.deepEqual(lossy.deliveries.map((d) => d.seq), [0, 1, 2, 3, 4, 5, 6, 7], protocol);
  }
  assert.equal(run('gbn', { lostFrames: [3] }).retransmissions, 4, 'GBN resends the window from the lost frame');
  assert.equal(run('sr', { lostFrames: [3] }).retransmissions, 1, 'SR resends only the lost frame');
  assert.equal(run('gbn', { lostAcks: [2] }).retransmissions, 0, 'cumulative ACK covers a lost ACK');
  // Stop-and-wait period 1 + 2a: with a = 2, 8 frames take 8 × 5 = 40 units.
  near(run('stop-and-wait').finish, 40, 1e-12, 'S&W time');
  const util = arqUtilisation({ a: 2, window: 4, p: 0 });
  near(util.stopAndWait, 1 / 5, 1e-15, 'S&W'); near(util.goBackN, 4 / 5, 1e-15, 'GBN W < 1+2a');
  near(arqUtilisation({ a: 2, window: 7, p: 0.1 }).selectiveRepeat, 0.9, 1e-15, 'SR full window');
  near(arqUtilisation({ a: 2, window: 7, p: 0.1 }).goBackN, 0.9 / 1.4, 1e-15, 'GBN (1−p)/(1+2ap)');
  // Steady-state GBN with W ≥ 1 + 2a fills the link: long runs approach 100 %.
  near(simulateArq({ protocol: 'gbn', frames: 200, window: 7, propagation: 3 }).efficiency, 200 / 206, 1e-12, 'full pipe');
});

test('ALOHA and CSMA/CD throughput peaks', () => {
  near(pureAloha(0.5), 1 / (2 * Math.E), 1e-15, 'pure ALOHA max');
  near(slottedAloha(1), 1 / Math.E, 1e-15, 'slotted ALOHA max');
  near(csmaCdEfficiency(0.1), 1 / 1.5, 1e-15, 'CSMA/CD');
  // With a = 0: non-persistent G/(1 + G), 1-persistent G(1 + G)e^−G / (G + e^−G).
  near(nonPersistentCsma(1, 0), 0.5, 1e-15, 'non-persistent');
  near(onePersistentCsma(0.5, 0), 0.5 * 1.5 * Math.exp(-0.5) / (0.5 + Math.exp(-0.5)), 1e-15, '1-persistent');
});
