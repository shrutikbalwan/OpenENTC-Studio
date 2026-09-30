import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransferFunction, firstOrderStability, firstOrderStep, frequencyResponse } from '../packages/control/src/index.mjs';

test('first-order transfer function has expected DC gain and units', () => {
  const tf = createTransferFunction([1], [1, 1], { inputUnits: 'V', outputUnits: 'V' });
  const response = frequencyResponse(tf, [0, 1]);
  assert.equal(response.points[0].magnitude, 1);
  assert.equal(response.inputUnits, 'V');
  assert.equal(firstOrderStability(1).stable, true);
  assert.equal(firstOrderStability(-1).stable, false);
});

test('first-order step response is bounded and monotonic for positive time constant', () => {
  const step = firstOrderStep({ gain: 2, tau: 0.5, sampleRate: 10, length: 20 });
  assert.equal(step.data[0], 0);
  assert.ok(step.data.at(-1) < 2);
  assert.ok(step.data.every((value, index) => index === 0 || value >= step.data[index - 1]));
  assert.throws(() => createTransferFunction([1], [0, 1]), /leading/);
});
