// Wireless Sensor Networks workspace. Entry points: renderWsn(state); bindWsnEvents().
import { modules } from '../../data/modules.js';
import { niceRange } from '../../core/circuit-plot.js';
import { connectivity, coverage, crossover, deploy, RADIO_DEFAULTS, simulateLifetime, txEnergy } from '../../../packages/wsn/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { indexTicks, linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const WSN_TABS = [['deploy', 'Deployment, connectivity & coverage'], ['lifetime', 'Energy & lifetime (LEACH)']];
const wsnLab = makeLab('wsn-lab', {
  tab: 'deploy',
  deploy: { nodes: 100, width: 100, height: 100, layout: 'random', seed: 3, range: 20, sensing: 10, sinkX: 50, sinkY: 50, k: 2 },
  lifetime: { nodes: 100, width: 100, height: 100, seed: 3, sinkX: 50, sinkY: 175, energy: 0.5, p: 0.05, packet: 4000, round: 100 },
});
const wsnField = (...args) => groupField('data-wsn-field')(...args);
let wsnCache = { key: null, value: null };
function wsnMap(field, { links = [], heads = [], members = null, next = null, coverageCells = null, sensing = 0, energy = null, initial = 1 }) {
  const size = 420, scale = size / Math.max(field.width, field.height, field.sink.y + 5, field.sink.x + 5), w = Math.max(field.width, field.sink.x + 5) * scale, h = Math.max(field.height, field.sink.y + 5) * scale;
  const X = (x) => (x * scale).toFixed(1), Y = (y) => (h - y * scale).toFixed(1);
  const parts = [`<rect class="wsn-field" x="0" y="${(h - field.height * scale).toFixed(1)}" width="${(field.width * scale).toFixed(1)}" height="${(field.height * scale).toFixed(1)}"/>`];
  if (coverageCells) {
    const n = coverageCells.resolution, cw = field.width * scale / n, ch = field.height * scale / n;
    coverageCells.cells.forEach((count, index) => { if (!count) parts.push(`<rect class="wsn-hole" x="${(Math.floor(index / n) * cw).toFixed(1)}" y="${(h - (index % n + 1) * ch).toFixed(1)}" width="${(cw + 0.3).toFixed(1)}" height="${(ch + 0.3).toFixed(1)}"/>`); });
  }
  if (sensing) for (const node of field.nodes) parts.push(`<circle class="wsn-sense" cx="${X(node.x)}" cy="${Y(node.y)}" r="${(sensing * scale).toFixed(1)}"/>`);
  for (const [a, b] of links) parts.push(`<line class="wsn-link" x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}"/>`);
  if (members) for (const [head, list] of Object.entries(members)) for (const m of list) parts.push(`<line class="wsn-member" x1="${X(field.nodes[m].x)}" y1="${Y(field.nodes[m].y)}" x2="${X(field.nodes[head].x)}" y2="${Y(field.nodes[head].y)}"/>`);
  if (members) for (const head of Object.keys(members)) parts.push(`<line class="wsn-uplink" x1="${X(field.nodes[head].x)}" y1="${Y(field.nodes[head].y)}" x2="${X(field.sink.x)}" y2="${Y(field.sink.y)}"/>`);
  if (next) next.forEach((hop, i) => { if (hop >= 0 && (!energy || energy[i] > 0)) parts.push(`<line class="wsn-member" x1="${X(field.nodes[i].x)}" y1="${Y(field.nodes[i].y)}" x2="${X(field.nodes[hop].x)}" y2="${Y(field.nodes[hop].y)}"/>`); });
  for (const node of field.nodes) {
    const dead = energy && energy[node.id] <= 0, level = energy ? Math.max(0, energy[node.id]) / initial : 1;
    parts.push(`<circle class="wsn-node${heads.includes(node.id) ? ' head' : ''}${dead ? ' dead' : ''}" cx="${X(node.x)}" cy="${Y(node.y)}" r="${heads.includes(node.id) ? 5 : 3.2}" style="fill-opacity:${dead ? 1 : (0.35 + 0.65 * level).toFixed(2)}"/>`);
  }
  parts.push(`<rect class="wsn-sink" x="${(Number(X(field.sink.x)) - 6).toFixed(1)}" y="${(Number(Y(field.sink.y)) - 6).toFixed(1)}" width="12" height="12"/><text class="wsn-label" x="${(Number(X(field.sink.x)) + 9).toFixed(1)}" y="${(Number(Y(field.sink.y)) + 4).toFixed(1)}">sink</text>`);
  return `<svg class="wsn-map" viewBox="-8 -8 ${(w + 16).toFixed(0)} ${(h + 16).toFixed(0)}" role="img" aria-label="Sensor field">${parts.join('')}</svg>`;
}
function renderWsnTab(config) {
  const c = config[config.tab];
  if (config.tab === 'deploy') {
    const field = deploy({ nodes: Math.min(500, Math.max(2, Math.round(c.nodes))), width: c.width, height: c.height, seed: Math.round(c.seed), layout: c.layout, sink: { x: c.sinkX, y: c.sinkY } });
    const conn = connectivity(field, c.range), cov = coverage(field, c.sensing, { k: Math.max(1, Math.round(c.k)), resolution: 60 });
    const links = [];
    conn.neighbours.forEach((list, i) => list.forEach((j) => { if (j > i) links.push([field.nodes[i], field.nodes[j]]); }));
    const hopCounts = conn.hops.filter(Number.isFinite);
    const histogram = Array.from({ length: Math.max(1, conn.maxHops) }, (_, k) => hopCounts.filter((hop) => hop === k + 1).length);
    const controls = `${wsnField('deploy.nodes', 'Nodes', c.nodes)}${wsnField('deploy.width', 'Field width', c.width, 'm')}${wsnField('deploy.height', 'Field height', c.height, 'm')}${labSelect('data-wsn-select', 'deploy.layout', 'Placement', c.layout, [['random', 'Random (uniform)'], ['grid', 'Grid']])}${wsnField('deploy.seed', 'Seed', c.seed)}${wsnField('deploy.range', 'Radio range', c.range, 'm')}${wsnField('deploy.sensing', 'Sensing range', c.sensing, 'm')}${wsnField('deploy.k', 'k for k-coverage', c.k)}${wsnField('deploy.sinkX', 'Sink x', c.sinkX, 'm')}${wsnField('deploy.sinkY', 'Sink y', c.sinkY, 'm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">RADIO LINKS, SENSING DISCS AND UNCOVERED SPOTS (RED)</span>${wsnMap(field, { links, coverageCells: cov, sensing: c.sensing })}</div>
      <div><div class="analysis-readouts">${readout('Nodes reaching the sink (multi-hop)', `${conn.reachable} of ${field.nodes.length} (${fmt(conn.connectedFraction * 100, 4)} %)`)}${readout('Average node degree', fmt(conn.averageDegree, 4))}${readout('Isolated nodes', conn.isolated)}${readout('Longest route', `${conn.maxHops} hops`)}${readout('Area covered (1-coverage)', `${fmt(cov.fraction * 100, 4)} %`)}${readout(`Area ${Math.round(c.k)}-covered`, `${fmt(cov.kFraction * 100, 4)} %`)}${readout('Poisson estimate 1 − e^(−λπr²)', `${fmt(cov.expected * 100, 4)} % (ignores the edges)`)}${readout('Connectivity rule of thumb', c.range >= 2 * c.sensing ? 'Rc ≥ 2Rs: full coverage implies connectivity' : 'Rc < 2Rs: coverage does not guarantee connectivity')}</div>
      ${renderPlotFrame({ title: 'Hops to the sink', series: [{ xs: histogram.map((_, k) => k + 1), ys: histogram, color: PLOT_COLORS[0], stem: true }], xMin: 0, xMax: Math.max(2, conn.maxHops + 1), xTicks: indexTicks(0, Math.max(2, conn.maxHops + 1)), yRange: niceRange(0, Math.max(1, ...histogram)), formatY: (v) => fmt(v, 3) })}</div></div>`;
    return { controls, body };
  }
  const field = deploy({ nodes: Math.min(300, Math.max(2, Math.round(c.nodes))), width: c.width, height: c.height, seed: Math.round(c.seed), sink: { x: c.sinkX, y: c.sinkY } });
  const key = JSON.stringify(c);
  if (wsnCache.key !== key) {
    const radio = { ...RADIO_DEFAULTS, packetBits: Math.round(c.packet) };
    const options = { initialEnergy: c.energy, chProbability: c.p, radio, recordRound: Math.max(0, Math.round(c.round) - 1) };
    wsnCache = { key, value: ['direct', 'mte', 'leach'].map((protocol) => simulateLifetime(field, { ...options, protocol })) };
  }
  const results = wsnCache.value, leach = results[2];
  const maxRounds = Math.max(...results.map((r) => r.rounds));
  const rounds = Array.from({ length: maxRounds }, (_, k) => k + 1);
  const pad = (list) => rounds.map((_, k) => list[k] ?? 0);
  const names = { direct: 'Direct to sink', mte: 'Minimum-energy multi-hop', leach: 'LEACH' };
  const controls = `${wsnField('lifetime.nodes', 'Nodes', c.nodes)}${wsnField('lifetime.width', 'Field width', c.width, 'm')}${wsnField('lifetime.height', 'Field height', c.height, 'm')}${wsnField('lifetime.seed', 'Seed', c.seed)}${wsnField('lifetime.sinkX', 'Sink x', c.sinkX, 'm')}${wsnField('lifetime.sinkY', 'Sink y', c.sinkY, 'm')}${wsnField('lifetime.energy', 'Initial energy', c.energy, 'J')}${wsnField('lifetime.p', 'Cluster-head fraction p', c.p)}${wsnField('lifetime.packet', 'Packet size', c.packet, 'bits')}${wsnField('lifetime.round', 'Show round', c.round)}`;
  const snap = leach.snapshot;
  const body = `<div class="power-grid"><div>${linePlot('Nodes alive against round', rounds, results.map((r) => ({ name: names[r.protocol], values: pad(r.history.alive) })), { xLabel: (x) => fmt(x, 4) })}${linePlot('Total residual energy (J)', rounds, results.map((r) => ({ name: names[r.protocol], values: pad(r.history.energy) })), { xLabel: (x) => fmt(x, 4) })}
    <table class="truth-table comm-table power-table"><thead><tr><th>Protocol</th><th>First node dies</th><th>Half dead</th><th>Last node dies</th><th>Packets at sink</th></tr></thead><tbody>${results.map((r) => `<tr><td>${names[r.protocol]}</td><td>${r.firstDeath ?? '—'}</td><td>${r.halfDeath ?? '—'}</td><td>${r.lastDeath ?? '—'}</td><td>${r.delivered}</td></tr>`).join('')}</tbody></table></div>
    <div><span class="panel-label">LEACH CLUSTERS IN ROUND ${Math.round(c.round)} (LARGE = CLUSTER HEAD, FADED = LOW ENERGY, RED = DEAD)</span>${snap ? wsnMap(field, { heads: snap.heads, members: snap.members ?? {}, energy: snap.energy, initial: c.energy }) : '<p class="field-help">The network died before this round.</p>'}
    <div class="analysis-readouts">${readout('Radio model', `E_elec = 50 nJ/bit, ε_fs = 10 pJ/bit/m², ε_mp = 0.0013 pJ/bit/m⁴, d₀ = ${fmt(crossover(), 4)} m`)}${readout(`Energy to send ${c.packet} bits 50 m / 150 m`, `${eng(txEnergy(c.packet, 50), 'J')} / ${eng(txEnergy(c.packet, 150), 'J')}`)}${snap ? readout('Cluster heads this round', `${snap.heads.length} (expected p·N = ${fmt(c.p * c.nodes, 3)})`) : ''}</div><p class="field-help">LEACH rotates the costly long-haul transmission: in each epoch of 1/p rounds every node is cluster head once (threshold T(n) = p/(1 − p·(r mod 1/p))), heads fuse their members' data and send one packet. It pays off when the sink is far; with the sink inside a small field direct transmission can win.</p></div></div>`;
  return { controls, body };
}
export function renderWsn(state) {
  const config = wsnLab.configuration(state);
  let view;
  try { view = renderWsnTab(config); } catch (error) { view = { controls: '', body: labError('wsn', 'Sensor network', error) }; }
  return `<div class="page scroll-page power-page sigsys-page wsn-page">${pageHeader(modules.find((item) => item.id === 'wsn'), 'WIRELESS SENSOR NETWORKS', '')}${labTabs(WSN_TABS, config.tab, 'data-wsn-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindWsnEvents() { bindLabControls('wsn', wsnLab, ['layout']); }
