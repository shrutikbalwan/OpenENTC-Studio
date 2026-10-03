// Neural networks from scratch: 2-D toy datasets, a multilayer perceptron with backpropagation
// (tanh/ReLU/sigmoid, softmax cross-entropy or mean-squared error, SGD with momentum or Adam,
// L2 regularisation), gradient checking, decision-boundary maps, and the single-layer perceptron
// learning rule.

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gaussianFrom(random) { return () => { let u = 0; while (u === 0) u = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random()); }; }

// ---------------------------------------------------------------------------
// Datasets: points in [−1, 1]², labels 0/1 (classification) or y values (regression).

export const DATASETS = Object.freeze({ circle: 'Circle inside ring', xor: 'XOR quadrants', spiral: 'Two spirals', blobs: 'Two Gaussian blobs', moons: 'Two moons', sine: 'Sine curve (regression)' });

export function makeDataset(name = 'circle', { count = 200, noise = 0.1, seed = 1, testFraction = 0.25 } = {}) {
  const random = mulberry32(seed), g = gaussianFrom(random), points = [];
  for (let i = 0; i < count; i += 1) {
    const label = i % 2;
    let x, y;
    if (name === 'circle') { const r = label ? 0.75 + 0.15 * random() : 0.4 * random(), a = 2 * Math.PI * random(); x = r * Math.cos(a); y = r * Math.sin(a); }
    else if (name === 'xor') { x = 2 * random() - 1; y = 2 * random() - 1; if (Math.abs(x) < 0.05) x += 0.1 * Math.sign(x || 1); if (Math.abs(y) < 0.05) y += 0.1 * Math.sign(y || 1); points.push({ x: x + noise * g() * 0.5, y: y + noise * g() * 0.5, label: x * y > 0 ? 1 : 0 }); continue; }
    else if (name === 'spiral') { const t = 0.15 + 0.85 * (Math.floor(i / 2) / (count / 2)), a = 3.5 * Math.PI * t + label * Math.PI; x = 0.9 * t * Math.cos(a); y = 0.9 * t * Math.sin(a); }
    else if (name === 'blobs') { x = (label ? 0.45 : -0.45) + 0.25 * g(); y = (label ? 0.35 : -0.35) + 0.25 * g(); }
    else if (name === 'moons') { const a = Math.PI * random(); x = label ? 0.5 - 0.6 * Math.cos(a) : -0.5 + 0.6 * Math.cos(a) + 0.5; y = label ? 0.15 - 0.6 * Math.sin(a) + 0.3 : -0.15 + 0.6 * Math.sin(a) - 0.3; x -= 0.25; }
    else if (name === 'sine') { x = 2 * random() - 1; y = 0.8 * Math.sin(Math.PI * 1.5 * x) + noise * g(); points.push({ x, y: 0, target: y }); continue; }
    else throw new RangeError(`Unknown dataset "${name}".`);
    points.push({ x: x + noise * g() * 0.5, y: y + noise * g() * 0.5, label });
  }
  // Deterministic shuffle, then split.
  for (let i = points.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [points[i], points[j]] = [points[j], points[i]]; }
  const testCount = Math.round(points.length * testFraction);
  return { name, regression: name === 'sine', train: points.slice(testCount), test: points.slice(0, testCount) };
}

// ---------------------------------------------------------------------------
// Multilayer perceptron.

export const ACTIVATIONS = Object.freeze({
  tanh: { f: Math.tanh, d: (y) => 1 - y * y },
  relu: { f: (x) => (x > 0 ? x : 0), d: (y) => (y > 0 ? 1 : 0) },
  sigmoid: { f: (x) => 1 / (1 + Math.exp(-x)), d: (y) => y * (1 - y) },
  linear: { f: (x) => x, d: () => 1 },
});

/** Layers [inputs, hidden…, outputs]; Xavier (tanh/sigmoid) or He (ReLU) initialisation. */
export function createNetwork(sizes, { activation = 'tanh', seed = 1 } = {}) {
  const random = mulberry32(seed), g = gaussianFrom(random);
  const layers = [];
  for (let l = 1; l < sizes.length; l += 1) {
    const fanIn = sizes[l - 1], scale = activation === 'relu' ? Math.sqrt(2 / fanIn) : Math.sqrt(1 / fanIn);
    layers.push({ w: Array.from({ length: sizes[l] }, () => Array.from({ length: fanIn }, () => g() * scale)), b: new Array(sizes[l]).fill(0) });
  }
  return { sizes: [...sizes], activation, layers };
}

const softmax = (z) => { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, v) => a + v, 0); return e.map((v) => v / s); };

/** Forward pass: hidden activations and the output (softmax probabilities or linear values). */
export function forward(net, input, output = 'softmax') {
  const act = ACTIVATIONS[net.activation];
  const values = [input];
  net.layers.forEach((layer, l) => {
    const last = l === net.layers.length - 1, prev = values.at(-1);
    const z = layer.w.map((row, j) => row.reduce((s, w, k) => s + w * prev[k], layer.b[j]));
    values.push(last ? (output === 'softmax' ? softmax(z) : z) : z.map(act.f));
  });
  return values;
}

/** Loss and gradients for one example (cross-entropy with softmax, or ½·MSE with a linear output). */
export function backward(net, input, target, output = 'softmax') {
  const act = ACTIVATIONS[net.activation], values = forward(net, input, output), out = values.at(-1);
  let loss, delta;
  if (output === 'softmax') { loss = -Math.log(Math.max(1e-12, out[target])); delta = out.map((p, j) => p - (j === target ? 1 : 0)); }
  else { const t = Array.isArray(target) ? target : [target]; loss = 0.5 * out.reduce((s, v, j) => s + (v - t[j]) ** 2, 0); delta = out.map((v, j) => v - t[j]); }
  const grads = net.layers.map((layer) => ({ w: layer.w.map((row) => row.map(() => 0)), b: layer.b.map(() => 0) }));
  for (let l = net.layers.length - 1; l >= 0; l -= 1) {
    const prev = values[l];
    grads[l].b = [...delta];
    grads[l].w = delta.map((d) => prev.map((p) => d * p));
    if (l > 0) delta = prev.map((p, k) => act.d(p) * net.layers[l].w.reduce((s, row, j) => s + row[k] * delta[j], 0));
  }
  return { loss, grads, output: out };
}

/** Finite-difference gradient check: max relative error between backprop and numerical gradients. */
export function gradientCheck(net, input, target, output = 'softmax', h = 1e-5) {
  const { grads } = backward(net, input, target, output);
  let worst = 0;
  net.layers.forEach((layer, l) => {
    const check = (get, set, analytic) => { const original = get(); set(original + h); const plus = backward(net, input, target, output).loss; set(original - h); const minus = backward(net, input, target, output).loss; set(original); const numeric = (plus - minus) / (2 * h); worst = Math.max(worst, Math.abs(numeric - analytic) / Math.max(1e-8, Math.abs(numeric) + Math.abs(analytic))); };
    layer.w.forEach((row, j) => row.forEach((_, k) => check(() => layer.w[j][k], (v) => { layer.w[j][k] = v; }, grads[l].w[j][k])));
    layer.b.forEach((_, j) => check(() => layer.b[j], (v) => { layer.b[j] = v; }, grads[l].b[j]));
  });
  return worst;
}

/** Mini-batch training; records loss/accuracy per epoch and decision-boundary snapshots. */
export function train(net, dataset, { epochs = 300, learningRate = 0.05, batchSize = 16, optimizer = 'adam', momentum = 0.9, l2 = 0, seed = 1, snapshots = 6, grid = 40 } = {}) {
  const random = mulberry32(seed), regression = dataset.regression, output = regression ? 'linear' : 'softmax';
  const inputOf = (p) => (regression ? [p.x] : [p.x, p.y]), targetOf = (p) => (regression ? p.target : p.label);
  const state = net.layers.map((layer) => ({ mw: layer.w.map((r) => r.map(() => 0)), vw: layer.w.map((r) => r.map(() => 0)), mb: layer.b.map(() => 0), vb: layer.b.map(() => 0) }));
  const history = [], frames = [];
  let step = 0;
  const evaluate = (points) => {
    if (!points.length) return { loss: 0, accuracy: null };
    let loss = 0, correct = 0;
    for (const p of points) {
      const out = forward(net, inputOf(p), output).at(-1);
      if (regression) loss += 0.5 * (out[0] - p.target) ** 2;
      else { loss += -Math.log(Math.max(1e-12, out[p.label])); if ((out[1] > out[0] ? 1 : 0) === p.label) correct += 1; }
    }
    return { loss: loss / points.length, accuracy: regression ? null : correct / points.length };
  };
  const snapshotEvery = Math.max(1, Math.floor(epochs / Math.max(1, snapshots - 1)));
  const order = dataset.train.map((_, i) => i);
  for (let epoch = 0; epoch <= epochs; epoch += 1) {
    if (epoch > 0) {
      for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (let start = 0; start < order.length; start += batchSize) {
        const batch = order.slice(start, start + batchSize);
        const sum = net.layers.map((layer) => ({ w: layer.w.map((r) => r.map(() => 0)), b: layer.b.map(() => 0) }));
        for (const index of batch) {
          const p = dataset.train[index], { grads } = backward(net, inputOf(p), targetOf(p), output);
          grads.forEach((g, l) => { g.w.forEach((row, j) => row.forEach((v, k) => { sum[l].w[j][k] += v; })); g.b.forEach((v, j) => { sum[l].b[j] += v; }); });
        }
        step += 1;
        net.layers.forEach((layer, l) => {
          const s = state[l], n = batch.length;
          const update = (value, grad, m, v, key) => {
            if (optimizer === 'adam') { m[key] = 0.9 * m[key] + 0.1 * grad; v[key] = 0.999 * v[key] + 0.001 * grad * grad; const mh = m[key] / (1 - 0.9 ** step), vh = v[key] / (1 - 0.999 ** step); return value - learningRate * mh / (Math.sqrt(vh) + 1e-8); }
            m[key] = momentum * m[key] - learningRate * grad; return value + m[key];
          };
          layer.w.forEach((row, j) => row.forEach((w, k) => { row[k] = update(w, sum[l].w[j][k] / n + l2 * w, s.mw[j], s.vw[j], k); }));
          layer.b.forEach((b, j) => { layer.b[j] = update(b, sum[l].b[j] / n, s.mb, s.vb, j); });
        });
      }
    }
    const trainEval = evaluate(dataset.train), testEval = evaluate(dataset.test);
    history.push({ epoch, trainLoss: trainEval.loss, testLoss: testEval.loss, trainAccuracy: trainEval.accuracy, testAccuracy: testEval.accuracy });
    if (epoch % snapshotEvery === 0 || epoch === epochs) frames.push({ epoch, map: regression ? regressionCurve(net) : decisionMap(net, grid) });
  }
  return { history, frames, final: history.at(-1) };
}

/** P(class 1) on a grid over [−1.2, 1.2]² (rows from top). */
export function decisionMap(net, grid = 40) {
  return Array.from({ length: grid }, (_, r) => Array.from({ length: grid }, (_, c) => forward(net, [-1.2 + 2.4 * (c + 0.5) / grid, 1.2 - 2.4 * (r + 0.5) / grid]).at(-1)[1]));
}
export const regressionCurve = (net, points = 120) => Array.from({ length: points }, (_, i) => { const x = -1.2 + 2.4 * i / (points - 1); return [x, forward(net, [x], 'linear').at(-1)[0]]; });

// ---------------------------------------------------------------------------
// Rosenblatt perceptron.

export const LOGIC_SETS = Object.freeze({ and: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]], or: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]], nand: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]], xor: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]] });

/** w ← w + η(t − y)x with a step activation; stops after an error-free epoch or maxEpochs. */
export function perceptron(samples, { rate = 0.1, weights = [0, 0], bias = 0, maxEpochs = 20 } = {}) {
  let w = [...weights], b = bias;
  const steps = [];
  let converged = false, epoch = 0;
  for (epoch = 1; epoch <= maxEpochs; epoch += 1) {
    let errors = 0;
    for (const [x1, x2, t] of samples) {
      const net = w[0] * x1 + w[1] * x2 + b, y = net >= 0 ? 1 : 0, e = t - y;
      if (e) errors += 1;
      w = [w[0] + rate * e * x1, w[1] + rate * e * x2]; b += rate * e;
      steps.push({ epoch, x: [x1, x2], target: t, net, output: y, error: e, w: [...w], b });
    }
    if (!errors) { converged = true; break; }
  }
  return { weights: w, bias: b, converged, epochs: Math.min(epoch, maxEpochs), steps };
}
