// Neural Networks workspace. Entry points: renderNn(state); bindNnEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { createNetwork, DATASETS, LOGIC_SETS, makeDataset, perceptron, train } from '../../../packages/neural/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const NN_TABS = [['playground', 'MLP playground'], ['perceptron', 'Perceptron learning rule']];
const nnLab = makeLab('nn-lab', {
  tab: 'playground',
  playground: { dataset: 'circle', count: 200, noise: 0.1, hidden: '8, 8', activation: 'tanh', optimizer: 'adam', rate: 0.03, epochs: 150, batch: 16, l2: 0, seed: 1, frame: 99 },
  perceptron: { gate: 'and', rate: 0.1, w1: 0, w2: 0, bias: 0, epochs: 20 },
});
const nnField = (...args) => groupField('data-nn-field')(...args);
let nnCache = { key: null, value: null };
function nnRun(c) {
  const key = JSON.stringify({ ...c, frame: 0 });
  if (nnCache.key !== key) {
    const hidden = String(c.hidden).split(/[\s,]+/).filter(Boolean).map(Number);
    if (hidden.some((h) => !Number.isInteger(h) || h < 1 || h > 32) || hidden.length > 4) throw new RangeError('Hidden layers: up to four sizes from 1 to 32, e.g. "8, 8".');
    const data = makeDataset(c.dataset, { count: Math.min(400, Math.max(20, Math.round(c.count))), noise: c.noise, seed: Math.round(c.seed) });
    const net = createNetwork(data.regression ? [1, ...hidden, 1] : [2, ...hidden, 2], { activation: c.activation, seed: Math.round(c.seed) });
    const result = train(net, data, { epochs: Math.min(1000, Math.max(1, Math.round(c.epochs))), learningRate: c.rate, batchSize: Math.max(1, Math.round(c.batch)), optimizer: c.optimizer, l2: c.l2, seed: Math.round(c.seed), snapshots: 8, grid: 36 });
    nnCache = { key, value: { data, net, result } };
  }
  return nnCache.value;
}
function nnMapSvg(data, frame) {
  const size = 300, s = size / 2.4, X = (x) => ((x + 1.2) * s).toFixed(1), Y = (y) => ((1.2 - y) * s).toFixed(1);
  const parts = [];
  if (data.regression) {
    parts.push(`<path class="nn-curve" d="${frame.map.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)} ${Y(y)}`).join('')}"/>`);
    for (const p of data.train) parts.push(`<circle class="nn-point train" cx="${X(p.x)}" cy="${Y(p.target)}" r="3"/>`);
    for (const p of data.test) parts.push(`<circle class="nn-point test" cx="${X(p.x)}" cy="${Y(p.target)}" r="3"/>`);
  } else {
    const n = frame.map.length, cell = size / n;
    frame.map.forEach((row, r) => row.forEach((p, c) => parts.push(`<rect x="${(c * cell).toFixed(1)}" y="${(r * cell).toFixed(1)}" width="${(cell + 0.4).toFixed(1)}" height="${(cell + 0.4).toFixed(1)}" fill="${p > 0.5 ? '#f97316' : '#38bdf8'}" fill-opacity="${(Math.abs(p - 0.5) * 1.3).toFixed(2)}"/>`)));
    for (const p of data.train) parts.push(`<circle class="nn-point c${p.label}" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2"/>`);
    for (const p of data.test) parts.push(`<circle class="nn-point c${p.label} test" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2"/>`);
  }
  return `<svg class="nn-map" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${parts.join('')}</svg>`;
}
function nnDiagram(net) {
  const width = 460, height = 220, columns = net.sizes.length, maxN = Math.max(...net.sizes);
  const pos = (l, j) => [30 + (width - 60) * l / (columns - 1), height / 2 + (j - (net.sizes[l] - 1) / 2) * Math.min(24, (height - 30) / maxN)];
  const maxW = Math.max(1e-9, ...net.layers.flatMap((layer) => layer.w.flat().map(Math.abs)));
  const lines = net.layers.flatMap((layer, l) => layer.w.flatMap((row, j) => row.map((w, k) => { const [x1, y1] = pos(l, k), [x2, y2] = pos(l + 1, j); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${w > 0 ? '#f97316' : '#38bdf8'}" stroke-width="${(0.3 + 3 * Math.abs(w) / maxW).toFixed(2)}" stroke-opacity="0.75"/>`; })));
  const nodes = net.sizes.flatMap((n, l) => Array.from({ length: n }, (_, j) => { const [x, y] = pos(l, j); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="nn-node"/>`; }));
  return `<svg class="nn-net" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines.join('')}${nodes.join('')}</svg>`;
}
function renderNnTab(config) {
  const c = config[config.tab];
  if (config.tab === 'playground') {
    const { data, net, result } = nnRun(c);
    const frame = result.frames[Math.min(result.frames.length - 1, Math.max(0, Math.round(c.frame)))];
    const epochs = result.history.map((h) => h.epoch);
    const controls = `${labSelect('data-nn-select', 'playground.dataset', 'Dataset', c.dataset, Object.entries(DATASETS))}${nnField('playground.count', 'Points', c.count)}${nnField('playground.noise', 'Noise', c.noise)}<label>Hidden layers<input type="text" spellcheck="false" data-nn-text="playground.hidden" value="${esc(c.hidden)}"></label>${labSelect('data-nn-select', 'playground.activation', 'Activation', c.activation, [['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', 'sigmoid']])}${labSelect('data-nn-select', 'playground.optimizer', 'Optimiser', c.optimizer, [['adam', 'Adam'], ['sgd', 'SGD + momentum']])}${nnField('playground.rate', 'Learning rate', c.rate)}${nnField('playground.epochs', 'Epochs', c.epochs)}${nnField('playground.batch', 'Batch size', c.batch)}${nnField('playground.l2', 'L2 regularisation', c.l2)}${nnField('playground.seed', 'Seed', c.seed)}<label>Show epoch ${frame.epoch}<input type="range" min="0" max="${result.frames.length - 1}" step="1" data-nn-range="playground.frame" value="${Math.min(result.frames.length - 1, Math.round(c.frame))}"></label>`;
    const final = result.final;
    const body = `<div class="power-grid"><div><span class="panel-label">${data.regression ? 'FITTED CURVE' : 'DECISION REGIONS'} AT EPOCH ${frame.epoch} (HOLLOW = TEST POINTS)</span>${nnMapSvg(data, frame)}<span class="panel-label">NETWORK ${net.sizes.join(' → ')} (ORANGE = POSITIVE WEIGHT, WIDTH = SIZE)</span>${nnDiagram(net)}</div>
      <div>${linePlot('Loss against epoch', epochs, [{ name: 'training', values: result.history.map((h) => h.trainLoss) }, { name: 'test', values: result.history.map((h) => h.testLoss) }], { xLabel: (v) => fmt(v, 4), yMin: 0 })}${data.regression ? '' : linePlot('Accuracy against epoch', epochs, [{ name: 'training', values: result.history.map((h) => h.trainAccuracy) }, { name: 'test', values: result.history.map((h) => h.testAccuracy) }], { xLabel: (v) => fmt(v, 4), yMin: 0, yMax: 1 })}
      <div class="analysis-readouts">${readout('Parameters', net.layers.reduce((s, l) => s + l.w.flat().length + l.b.length, 0))}${readout('Final training loss', fmt(final.trainLoss, 5))}${readout('Final test loss', fmt(final.testLoss, 5))}${data.regression ? '' : readout('Accuracy (train / test)', `${fmt(final.trainAccuracy * 100, 4)} % / ${fmt(final.testAccuracy * 100, 4)} %`)}</div><p class="field-help">Backpropagation is written out and checked against finite differences. A gap between training and test loss is overfitting — try fewer neurons, more points or L2. Remove all hidden layers ("") to see that a linear model cannot separate XOR or the circle.</p></div></div>`;
    return { controls, body };
  }
  const result = perceptron(LOGIC_SETS[c.gate], { rate: c.rate, weights: [c.w1, c.w2], bias: c.bias, maxEpochs: Math.max(1, Math.round(c.epochs)) });
  const size = 240, X = (x) => (30 + x * (size - 60)).toFixed(1), Y = (y) => (size - 30 - y * (size - 60)).toFixed(1);
  const [w1, w2] = result.weights, b = result.bias;
  let line = '';
  if (Math.abs(w2) > 1e-12) { const y0 = (-b - w1 * -0.2) / w2, y1 = (-b - w1 * 1.2) / w2; line = `<line class="nn-boundary" x1="${X(-0.2)}" y1="${Y(y0)}" x2="${X(1.2)}" y2="${Y(y1)}"/>`; }
  else if (Math.abs(w1) > 1e-12) { const x0 = -b / w1; line = `<line class="nn-boundary" x1="${X(x0)}" y1="${Y(-0.2)}" x2="${X(x0)}" y2="${Y(1.2)}"/>`; }
  const plot = `<svg class="nn-map" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" fill="none"/>${line}${LOGIC_SETS[c.gate].map(([x1, x2, t]) => `<circle class="nn-point c${t}" cx="${X(x1)}" cy="${Y(x2)}" r="8"/><text class="nn-label" x="${(Number(X(x1)) + 11).toFixed(1)}" y="${(Number(Y(x2)) + 4).toFixed(1)}">(${x1},${x2})→${t}</text>`).join('')}</svg>`;
  const controls = `${labSelect('data-nn-select', 'perceptron.gate', 'Function', c.gate, [['and', 'AND'], ['or', 'OR'], ['nand', 'NAND'], ['xor', 'XOR']])}${nnField('perceptron.rate', 'Learning rate η', c.rate)}${nnField('perceptron.w1', 'Initial w₁', c.w1)}${nnField('perceptron.w2', 'Initial w₂', c.w2)}${nnField('perceptron.bias', 'Initial bias', c.bias)}${nnField('perceptron.epochs', 'Max epochs', c.epochs)}`;
  const body = `<div class="power-grid"><div>${plot}<div class="analysis-readouts">${readout('Result', result.converged ? `converged after ${result.epochs} epoch${result.epochs > 1 ? 's' : ''}` : `not converged in ${result.epochs} epochs`)}${readout('Weights and bias', `w₁ = ${fmt(w1, 4)}, w₂ = ${fmt(w2, 4)}, b = ${fmt(b, 4)}`)}${readout('Decision line', `${fmt(w1, 4)}·x₁ ${w2 < 0 ? '−' : '+'} ${fmt(Math.abs(w2), 4)}·x₂ ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 4)} = 0`)}</div><p class="field-help">${c.gate === 'xor' ? 'XOR is not linearly separable: no single straight line splits the two classes, so the perceptron rule keeps cycling. A hidden layer fixes this (see the MLP playground).' : 'The perceptron convergence theorem guarantees a solution in finitely many updates for linearly separable data.'}</p></div>
    <div><table class="truth-table comm-table power-table"><thead><tr><th>Epoch</th><th>x₁ x₂</th><th>t</th><th>net = w·x + b</th><th>y</th><th>e = t − y</th><th>w₁, w₂ (after)</th><th>b</th></tr></thead><tbody>${result.steps.slice(0, 48).map((s) => `<tr class="${s.error ? 'active' : ''}"><td>${s.epoch}</td><td>${s.x.join(' ')}</td><td>${s.target}</td><td>${fmt(s.net, 4)}</td><td>${s.output}</td><td>${s.error}</td><td>${fmt(s.w[0], 4)}, ${fmt(s.w[1], 4)}</td><td>${fmt(s.b, 4)}</td></tr>`).join('')}</tbody></table><p class="field-help">Rule: w ← w + η(t − y)x, b ← b + η(t − y); highlighted rows changed the weights.</p></div></div>`;
  return { controls, body };
}
export function renderNn(state) {
  const config = nnLab.configuration(state);
  let view;
  try { view = renderNnTab(config); } catch (error) { view = { controls: '', body: labError('nn', 'Neural network', error) }; }
  return `<div class="page scroll-page power-page sigsys-page nn-page">${pageHeader(modules.find((item) => item.id === 'neural'), 'NEURAL NETWORKS', '')}${labTabs(NN_TABS, config.tab, 'data-nn-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindNnEvents() {
  bindLabControls('nn', nnLab, ['dataset', 'activation', 'optimizer', 'gate']);
  document.querySelectorAll('[data-nn-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.nnText.split('.'); nnLab.persist((config) => { config[group][key] = input.value; }); }));
  document.querySelectorAll('[data-nn-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.nnRange.split('.'); nnLab.persist((config) => { config[group][key] = Number(input.value); }); }));
}
