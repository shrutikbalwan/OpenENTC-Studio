import test from 'node:test';
import assert from 'node:assert/strict';
import { C, connectTwoPorts, convertTwoPort, deltaToStar, loadedTwoPort, NETWORK_EXAMPLES, parseNetlist, parseValue, powerTransferCurve, solveNetwork, starToDelta, superposition, thevenin, twoPortAnalysis } from '../packages/network/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const nearC = (actual, [re, im], tolerance, label) => { near(actual[0], re, tolerance, `${label} re`); near(actual[1], im, tolerance, `${label} im`); };
const example = (id) => NETWORK_EXAMPLES.find((entry) => entry.id === id);

// Reference: ngspice 42 `.ac lin 1 1000 1000` on the same netlist (V1 AC 10∠30°, I1 AC 0.5∠−45°).
test('phasor MNA with every dependent source matches ngspice at 1 kHz', () => {
  const net = parseNetlist('V1 1 0 10 30\nI1 0 4 0.5 -45\nR1 1 2 100\nL1 2 3 10m\nC1 3 0 2u\nR2 3 4 220\nE1 5 0 3 0 2\nR3 5 6 47\nVx 6 7 0\nR4 7 0 150\nG1 4 0 2 3 0.01\nF1 8 0 Vx 1.5\nR5 8 0 330\nH1 9 0 Vx 25\nR6 9 4 68');
  const result = solveNetwork(net, { frequency: 1000 });
  const reference = { 2: [9.139986, -1.83442], 3: [16.97609, -1.19032], 4: [38.48507, -0.843468], 5: [33.95217, -1.19032], 7: [25.85191, -1.19032], 8: [85.31130, 1.951272], 9: [4.308651, -1.19032] };
  for (const [node, [magnitude, radians]] of Object.entries(reference)) {
    near(C.abs(result.voltages[node]), magnitude, magnitude * 1e-6, `|V(${node})|`);
    near(C.arg(result.voltages[node]) * Math.PI / 180, radians, 1e-5, `∠V(${node})`);
  }
});

test('Thévenin / Norton, including a dependent source and an AC network', () => {
  const bridge = thevenin(parseNetlist(example('thevenin-bridge').netlist), 'a', 'b');
  nearC(bridge.vth, [-1.8, 0], 1e-12, 'Vth'); nearC(bridge.zth, [4.65, 0], 1e-12, 'Rth');
  nearC(bridge.shortCircuit, bridge.norton, 1e-12, 'Isc = Vth/Rth'); near(bridge.maxPower, 1.8 ** 2 / (4 * 4.65), 1e-12, 'Pmax');
  const dependent = thevenin(parseNetlist(example('dependent').netlist), 'a', '0');
  nearC(dependent.vth, [10 * 3 / 6.5, 0], 1e-12, 'Vth with CCVS'); nearC(dependent.norton, [5, 0], 1e-12, 'IN');
  const ac = thevenin(parseNetlist(example('ac-thevenin').netlist), 'out', '0', { frequency: 50 });
  near(C.abs(ac.vth), 230, 0.01, '|Vth|'); near(C.arg(ac.vth), -90, 0.01, '∠Vth');
  nearC(ac.zth, [10, -10], 0.002, 'Zth'); nearC(ac.matchedLoad, [10, 10], 0.002, 'conjugate match');
});

test('superposition, maximum power transfer and star–delta', () => {
  const sup = superposition(parseNetlist(example('superposition').netlist), { a: 'm' });
  nearC(sup.parts[0].value, [40 / 3, 0], 1e-12, 'V1 alone'); nearC(sup.parts[1].value, [10, 0], 1e-12, 'I1 alone'); nearC(sup.sum, sup.total, 1e-12, 'sum = total');
  const curve = powerTransferCurve(12, 4, { points: 400, maxRatio: 4 });
  const best = curve.reduce((a, b) => (b.power > a.power ? b : a));
  near(best.rl, 4, 0.02, 'maximum at RL = Rth'); near(best.power, 9, 1e-3, 'Pmax = V²/4R');
  assert.deepEqual(starToDelta({ ra: 10, rb: 10, rc: 10 }), { rab: 30, rbc: 30, rca: 30 });
  const back = deltaToStar(starToDelta({ ra: 10, rb: 20, rc: 30 }));
  near(back.ra, 10, 1e-12, 'ra'); near(back.rb, 20, 1e-12, 'rb'); near(back.rc, 30, 1e-12, 'rc');
});

test('two-port parameters, conversions and interconnections', () => {
  const t = twoPortAnalysis(parseNetlist(example('two-port-t').netlist), { p1: '1', p2: '2' });
  nearC(t.z[0][0], [40, 0], 1e-9, 'z11'); nearC(t.z[0][1], [30, 0], 1e-9, 'z12'); nearC(t.z[1][1], [50, 0], 1e-9, 'z22');
  assert.equal(t.reciprocal, true); assert.equal(t.symmetric, false);
  nearC(t.abcd[0][0], [4 / 3, 0], 1e-9, 'A'); nearC(C.sub(C.mul(t.abcd[0][0], t.abcd[1][1]), C.mul(t.abcd[0][1], t.abcd[1][0])), [1, 0], 1e-9, 'AD − BC = 1 (reciprocal)');
  const amp = twoPortAnalysis(parseNetlist(example('two-port-amp').netlist), { p1: 'b', p2: 'c' });
  nearC(amp.h[0][0], [2500, 0], 1e-6, 'hie'); nearC(amp.h[1][0], [100, 0], 1e-9, 'hfe'); nearC(amp.h[1][1], [2e-5, 0], 1e-12, 'hoe'); assert.equal(amp.reciprocal, false);
  for (const set of ['z', 'y', 'h', 'g', 'abcd']) { const again = convertTwoPort(set, t[set]); nearC(again.z[0][1], [30, 0], 1e-9, `${set} round trip`); }
  const cascade = connectTwoPorts('cascade', t, t);
  const direct = twoPortAnalysis(parseNetlist('R1 1 m 10\nR2 m x 20\nR3 m 0 30\nR4 x n 10\nR5 n 2 20\nR6 n 0 30'), { p1: '1', p2: '2' });
  nearC(cascade.z[0][0], direct.z[0][0], 1e-9, 'cascade = two sections');
  nearC(connectTwoPorts('series', t, t).z[0][0], [80, 0], 1e-9, 'series adds Z');
  const loaded = loadedTwoPort(t.abcd, [100, 0]);
  nearC(loaded.zin, [40 - 900 / 150, 0], 1e-9, 'Zin = z11 − z12z21/(z22 + ZL)');
});

test('netlist parsing', () => {
  assert.equal(parseValue('4.7k'), 4700); assert.equal(parseValue('10m'), 0.01); assert.equal(parseValue('2meg'), 2e6); assert.equal(parseValue('1uF'), 1e-6);
  assert.throws(() => parseNetlist('R1 a b'), /line 1/); assert.throws(() => parseNetlist('Q1 a b c'), /unknown element/);
  assert.throws(() => parseNetlist('F1 a 0 Vz 2'), /not a voltage source/);
  assert.throws(() => solveNetwork(parseNetlist('V1 a 0 1\nV2 a 0 2')), /no unique solution/);
});
