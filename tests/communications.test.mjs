import test from 'node:test';
import assert from 'node:assert/strict';
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate } from '../packages/communications/src/index.mjs';

test('QPSK known vector preserves Gray-sign mapping', () => {
  const constellation = qpskModulate([0, 0, 0, 1, 1, 1, 1, 0]);
  assert.equal(constellation.symbols.length, 4);
  assert.deepEqual(qpskDemodulate(constellation), [0, 0, 0, 1, 1, 1, 1, 0]);
  assert.equal(bitErrorRate([0, 0, 1, 1], [0, 0, 1, 0]).rate, 0.25);
});

test('seeded AWGN is deterministic and zero-noise demodulates exactly', () => {
  const source = qpskModulate([0, 1, 1, 0, 1, 1, 0, 0]);
  const noisyA = addAwgn(source, { sigma: 0.2, seed: 9 });
  const noisyB = addAwgn(source, { sigma: 0.2, seed: 9 });
  assert.deepEqual(noisyA.symbols, noisyB.symbols);
  assert.deepEqual(qpskDemodulate(addAwgn(source, { sigma: 0, seed: 9 })), [0, 1, 1, 0, 1, 1, 0, 0]);
});
