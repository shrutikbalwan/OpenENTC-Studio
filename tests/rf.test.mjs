import test from 'node:test';
import assert from 'node:assert/strict';
import { cascadeAbcd, convertSParameters, parseTouchstone, reflectionCoefficient } from '../packages/rf/src/index.mjs';

test('Touchstone parser preserves ports, units and reference impedance', () => {
  const result = parseTouchstone('# MHz S RI R 50\n1 1 0 0 0 0 0 0 0\n2 0.5 0.5 0 0 0 0 0 0');
  assert.equal(result.kind, 's-parameters');
  assert.equal(result.ports, 2);
  assert.equal(result.referenceImpedance, 50);
  assert.equal(result.points[0].frequency, 1e6);
  assert.deepEqual(result.points[1].values[0], { real: 0.5, imaginary: 0.5 });
});

test('Touchstone MA and DB formats convert to complex values and reject malformed order', () => {
  const ma = parseTouchstone('# GHz S MA R 75\n1 1 0 0 0 0 0 0 0');
  assert.ok(Math.abs(ma.points[0].values[0].real - 1) < 1e-12);
  const db = parseTouchstone('# Hz S DB R 50\n1 -6 0 0 0 0 0 0 0');
  assert.ok(Math.abs(db.points[0].values[0].real - 0.501187) < 1e-5);
  assert.throws(() => parseTouchstone('# Hz S RI R 50\n2 1 0 0 0 0 0 0 0\n1 1 0 0 0 0 0 0 0'), /strictly increasing/);
});

test('two-port S-parameters convert to Z/Y/ABCD and preserve frequency metadata', () => {
  const result = parseTouchstone('# Hz S RI R 50\n1 0 0 0 0 1 0 0 0');
  const z = convertSParameters(result, 'Z');
  const y = convertSParameters(result, 'Y');
  const abcd = convertSParameters(result, 'ABCD');
  assert.equal(z.kind, 'z-parameters');
  assert.equal(y.kind, 'y-parameters');
  assert.equal(abcd.kind, 'abcd-parameters');
  assert.equal(z.points[0].frequency, 1);
  assert.ok(Number.isFinite(abcd.points[0].values[0].real));
  assert.deepEqual(cascadeAbcd(abcd, abcd).points[0].values.length, 4);
});

test('RF matching calculations reject incompatible data and compute a matched load', () => {
  assert.deepEqual(reflectionCoefficient({ real: 50, imaginary: 0 }), { real: 0, imaginary: 0 });
  const source = parseTouchstone('# Hz S RI R 50\n1 0 0 0 0 1 0 0 0');
  assert.throws(() => cascadeAbcd(convertSParameters(source, 'ABCD'), { kind: 'abcd-parameters', ports: 2, referenceImpedance: 50, points: [{ frequency: 2, values: [{ real: 1, imaginary: 0 }, { real: 0, imaginary: 0 }, { real: 0, imaginary: 0 }, { real: 1, imaginary: 0 }] }] }), /matching frequency/);
  assert.throws(() => reflectionCoefficient({ real: 1, imaginary: 0 }, 0), /invalid/);
});
