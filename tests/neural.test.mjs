import test from 'node:test';
import assert from 'node:assert/strict';
import { backward, createNetwork, DATASETS, decisionMap, forward, gradientCheck, LOGIC_SETS, makeDataset, perceptron, train } from '../packages/neural/src/index.mjs';

test('backpropagation equals finite differences for every activation and loss', () => {
  for (const activation of ['tanh', 'relu', 'sigmoid']) {
    const net = createNetwork([2, 5, 4, 2], { activation, seed: 7 });
    assert.ok(gradientCheck(net, [0.31, -0.62], 1) < 1e-6, activation);
  }
  assert.ok(gradientCheck(createNetwork([1, 6, 1], { seed: 5 }), [0.4], 0.7, 'linear') < 1e-6, 'MSE');
});

test('forward pass: softmax outputs are probabilities; cross-entropy matches −log p', () => {
  const net = createNetwork([2, 3, 2], { seed: 2 });
  const out = forward(net, [0.2, 0.9]).at(-1);
  assert.ok(Math.abs(out[0] + out[1] - 1) < 1e-15);
  assert.ok(Math.abs(backward(net, [0.2, 0.9], 1).loss + Math.log(out[1])) < 1e-12);
});

test('an MLP learns XOR and the circle; a network without hidden layers cannot learn XOR', () => {
  for (const name of ['xor', 'circle']) {
    const data = makeDataset(name, { count: 160, seed: 3 });
    const result = train(createNetwork([2, 8, 8, 2], { seed: 1 }), data, { epochs: 150, learningRate: 0.03 });
    assert.ok(result.final.trainAccuracy >= 0.97, `${name} train ${result.final.trainAccuracy}`);
    assert.ok(result.final.testAccuracy >= 0.9, `${name} test ${result.final.testAccuracy}`);
    assert.ok(result.history[0].trainLoss > 3 * result.final.trainLoss, 'loss falls');
  }
  const linear = train(createNetwork([2, 2], { seed: 1 }), makeDataset('xor', { count: 160, seed: 3 }), { epochs: 150, learningRate: 0.03 });
  assert.ok(linear.final.trainAccuracy < 0.75, `linear model on XOR: ${linear.final.trainAccuracy}`);
  const sine = train(createNetwork([1, 12, 1], { seed: 2 }), makeDataset('sine', { count: 120, noise: 0.05, seed: 4 }), { epochs: 200, learningRate: 0.02 });
  assert.ok(sine.final.testLoss < 0.02, `regression test loss ${sine.final.testLoss}`);
  assert.equal(decisionMap(createNetwork([2, 4, 2]), 10).length, 10);
  assert.equal(Object.keys(DATASETS).length, 6);
});

test('training is reproducible and SGD with momentum also converges', () => {
  const data = makeDataset('blobs', { seed: 9 });
  const a = train(createNetwork([2, 6, 2], { seed: 4 }), data, { epochs: 40 }), b = train(createNetwork([2, 6, 2], { seed: 4 }), data, { epochs: 40 });
  assert.deepEqual(a.history, b.history);
  const sgd = train(createNetwork([2, 6, 2], { seed: 4 }), data, { epochs: 80, optimizer: 'sgd', learningRate: 0.1 });
  assert.ok(sgd.final.testAccuracy >= 0.9);
});

test('the perceptron rule learns AND/OR/NAND but never XOR (not linearly separable)', () => {
  for (const name of ['and', 'or', 'nand']) {
    const p = perceptron(LOGIC_SETS[name]);
    assert.equal(p.converged, true, name);
    for (const [x1, x2, t] of LOGIC_SETS[name]) assert.equal(p.weights[0] * x1 + p.weights[1] * x2 + p.bias >= 0 ? 1 : 0, t, `${name}(${x1},${x2})`);
  }
  // First AND update: x = (0, 0), t = 0, net = 0 → y = 1, e = −1: only the bias moves to −0.1.
  const and = perceptron(LOGIC_SETS.and);
  assert.deepEqual(and.steps[0].w, [0, 0]); assert.ok(Math.abs(and.steps[0].b + 0.1) < 1e-15);
  assert.equal(perceptron(LOGIC_SETS.xor, { maxEpochs: 100 }).converged, false);
});
