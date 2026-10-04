// Cellular Planning workspace. Entry points: renderCellular(state); bindCellularEvents().
import { modules } from '../../data/modules.js';
import { cellRadius, channelsForGos, clusterForSir, clusterSizes, ENVIRONMENTS, erlangB, erlangC, fadeMargin, freeSpaceLoss, hataLoss, hataMobileCorrection, hexLayout, idealHandoffPoint, logDistanceLoss, maxAllowedLoss, offeredTraffic, reusePlan, SECTORING, simulateHandoff, trafficForGos } from '../../../packages/cellular/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const CELL_TABS = [['traffic', 'Traffic & Erlang'], ['reuse', 'Frequency reuse'], ['pathloss', 'Path loss & cell size'], ['handoff', 'Handoff']];
const cellLab = makeLab('cell-lab', {
  tab: 'traffic',
  traffic: { users: 1000, callsPerHour: 1.5, holding: 120, channels: 60, gos: 0.02, waitLimit: 20 },
  reuse: { cluster: 7, exponent: 4, sectoring: 'omni', totalChannels: 416, cells: 32, requiredSir: 18 },
  pathloss: { frequency: 900, baseHeight: 30, mobileHeight: 1.5, environment: 'urban-medium', eirp: 55, sensitivity: -102, rxGain: 0, otherLoss: 3, sigma: 8, coverage: 0.9, exponent: 3.5 },
  handoff: { separation: 2, txPower: 43, exponent: 3.5, sigma: 6, decorrelation: 50, hysteresis: 3, ttt: 0, threshold: -95, seed: 1 },
});
const cellField = (...args) => groupField('data-cell-field')(...args);
const HEX_COLORS = ['#38bdf8', '#f97316', '#a3e635', '#e879f9', '#facc15', '#2dd4bf', '#f87171', '#818cf8', '#fb923c', '#4ade80', '#c084fc', '#fbbf24', '#22d3ee', '#fda4af', '#93c5fd', '#bef264', '#fcd34d', '#67e8f9', '#f0abfc', '#86efac', '#fdba74', '#a5b4fc', '#5eead4', '#fca5a5', '#d9f99d', '#e9d5ff', '#99f6e4', '#fed7aa'];
function renderHexLayout(plan) {
  const layout = hexLayout({ i: plan.i, j: plan.j, rings: Math.min(7, Math.max(3, Math.ceil(plan.q) + 1)) });
  const size = 14, scale = size;
  const xs = layout.cells.map((cell) => cell.x * scale), ys = layout.cells.map((cell) => cell.y * scale);
  const pad = size * 1.2, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, width = Math.max(...xs) - minX + pad, height = Math.max(...ys) - minY + pad;
  const corners = Array.from({ length: 6 }, (_, k) => [size * Math.cos(Math.PI / 6 + k * Math.PI / 3), size * Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
  const centreGroup = layout.cells.find((cell) => cell.q === 0 && cell.r === 0).group;
  const firstTier = layout.cells.filter((cell) => cell.group === centreGroup && Math.abs(Math.hypot(cell.x, cell.y) - plan.q) < 1e-6);
  const hexes = layout.cells.map((cell) => {
    const cx = cell.x * scale, cy = cell.y * scale;
    const isCo = cell.group === centreGroup;
    return `<polygon points="${corners.map(([dx, dy]) => `${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}`).join(' ')}" fill="${HEX_COLORS[cell.group % HEX_COLORS.length]}" fill-opacity="${isCo ? 0.85 : 0.28}" class="hex-cell"/><text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" class="hex-label">${String.fromCharCode(65 + (cell.group % 26))}${cell.group >= 26 ? cell.group : ''}</text>`;
  }).join('');
  const lines = firstTier.map((cell) => `<line class="hex-d" x1="0" y1="0" x2="${(cell.x * scale).toFixed(1)}" y2="${(cell.y * scale).toFixed(1)}"/>`).join('');
  return `<svg class="hex-map" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}" role="img" aria-label="Hexagonal reuse pattern">${hexes}${lines}<circle cx="0" cy="0" r="3" class="hex-centre"/></svg>`;
}
function renderCellularTab(config) {
  const c = config[config.tab];
  if (config.tab === 'traffic') {
    const traffic = offeredTraffic({ users: c.users, callsPerHour: c.callsPerHour, holdingSeconds: c.holding });
    const channels = Math.max(1, Math.round(c.channels));
    const blocking = erlangB(traffic, channels), needed = channelsForGos(Math.max(traffic, 1e-9), c.gos);
    const wait = erlangC(traffic, channels, c.holding, c.waitLimit);
    const aMax = Math.max(traffic * 1.6, channels * 1.2);
    const as = Array.from({ length: 200 }, (_, k) => aMax * (k + 1) / 200);
    const ns = [...new Set([Math.max(1, channels - 10), channels, channels + 10])];
    const gosRows = [0.005, 0.01, 0.02, 0.05, 0.1].map((g) => `<tr><td>${fmt(g * 100, 3)} %</td><td>${fmt(trafficForGos(channels, g), 5)} E</td><td>${fmt(trafficForGos(channels, g) * (1 - g) / channels * 100, 4)} %</td><td>${Math.floor(trafficForGos(channels, g) * 3600 / (c.callsPerHour * c.holding))}</td></tr>`).join('');
    const controls = `${cellField('traffic.users', 'Subscribers', c.users)}${cellField('traffic.callsPerHour', 'Calls per user per hour', c.callsPerHour)}${cellField('traffic.holding', 'Mean holding time', c.holding, 's')}${cellField('traffic.channels', 'Channels (trunks)', channels)}${cellField('traffic.gos', 'Target blocking (GoS)', c.gos)}${cellField('traffic.waitLimit', 'Erlang-C wait limit', c.waitLimit, 's')}`;
    const body = `<div class="power-grid"><div>${renderPlotFrame({ title: 'Erlang-B blocking probability against offered traffic (erlangs), log scale', series: ns.map((n, index) => ({ xs: as, ys: as.map((a) => Math.log10(Math.max(erlangB(a, n), 1e-6))), color: PLOT_COLORS[index], primary: n === channels })), xMin: as[0], xMax: aMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(as[0] + (aMax - as[0]) * k / 5, 3) })), yRange: { min: -6, max: 0, ticks: [-6, -5, -4, -3, -2, -1, 0] }, formatY: (value) => { const percent = 10 ** value * 100; return `${percent >= 0.01 ? fmt(percent, 3) : percent.toPrecision(1)} %`; } })}<div class="plot-legend">${ns.map((n, index) => `<span class="legend-chip" style="--chip:${PLOT_COLORS[index]}">N = ${n}</span>`).join('')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>GoS</th><th>Traffic for N = ${channels}</th><th>Trunk efficiency (carried/N)</th><th>Users supported</th></tr></thead><tbody>${gosRows}</tbody></table></div>
      <div class="analysis-readouts">${readout('Traffic per user', `${fmt(c.callsPerHour * c.holding / 3600 * 1000, 4)} mE`)}${readout('Offered traffic A = U·λ·H', `${fmt(traffic, 5)} erlangs`)}${readout(`Blocking with ${channels} channels (Erlang B)`, `${fmt(blocking * 100, 5)} %`)}${readout('Carried traffic', `${fmt(traffic * (1 - blocking), 5)} E (${fmt(traffic * (1 - blocking) / channels * 100, 4)} % occupancy)`)}${readout(`Channels needed for ${fmt(c.gos * 100, 3)} % blocking`, needed)}${readout('Erlang C (calls queued): P(wait)', wait.stable ? `${fmt(wait.probabilityWait * 100, 5)} %` : 'unstable (A ≥ N)')}${wait.stable ? readout('Mean delay of all calls', `${fmt(wait.meanWait, 4)} s`) : ''}${wait.stable ? readout(`P(wait > ${c.waitLimit} s)`, `${fmt(wait.probabilityWaitLonger * 100, 5)} %`) : ''}<p class="field-help">Erlang B (blocked calls cleared) uses the recursion B(n) = A·B(n−1)/(n + A·B(n−1)), which is exact and stable for thousands of channels; values match the published Erlang-B tables.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'reuse') {
    const plan = reusePlan({ cluster: c.cluster, pathLossExponent: c.exponent, sectoring: c.sectoring, totalChannels: c.totalChannels, cells: c.cells });
    const needed = clusterForSir(c.requiredSir, c.exponent, c.sectoring);
    const rows = clusterSizes(28).map(({ n, i, j }) => { const p = reusePlan({ cluster: n, pathLossExponent: c.exponent, sectoring: c.sectoring, totalChannels: c.totalChannels }); return `<tr class="${n === c.cluster ? 'active' : ''}"><td>${n}</td><td>(${i}, ${j})</td><td>${fmt(p.q, 4)}</td><td>${fmt(p.sirDb, 4)}</td><td>${p.channelsPerCell}</td></tr>`; }).join('');
    const controls = `${labSelect('data-cell-select', 'reuse.cluster', 'Cluster size N', c.cluster, clusterSizes(28).map(({ n, i, j }) => [n, `${n}  (i = ${i}, j = ${j})`]))}${cellField('reuse.exponent', 'Path-loss exponent n', c.exponent)}${labSelect('data-cell-select', 'reuse.sectoring', 'Antennas', c.sectoring, Object.entries(SECTORING).map(([id, s]) => [id, s.label]))}${cellField('reuse.totalChannels', 'Total duplex channels', c.totalChannels)}${cellField('reuse.cells', 'Cells in the area', c.cells)}${cellField('reuse.requiredSir', 'Required S/I', c.requiredSir, 'dB')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">CHANNEL GROUPS (LETTERS); CO-CHANNEL CELLS OF THE CENTRE ARE SOLID, FIRST TIER JOINED</span>${renderHexLayout(plan)}</div>
      <div><div class="analysis-readouts">${readout('Shift parameters (i, j)', `(${plan.i}, ${plan.j}): move i cells, turn 60°, move j cells`)}${readout('Co-channel reuse ratio Q = D/R = √(3N)', fmt(plan.q, 5))}${readout('S/I = Qⁿ / i₀', `${fmt(plan.sirDb, 4)} dB (i₀ = ${SECTORING[c.sectoring].interferers})`)}${plan.worstSirDb !== null ? readout('Worst case at the cell edge (Rappaport 3.9)', `${fmt(plan.worstSirDb, 4)} dB`) : ''}${readout('Channels per cell', `${plan.channelsPerCell}${SECTORING[c.sectoring].sectors > 1 ? ` (${plan.channelsPerSector} per sector)` : ''}`)}${readout('System capacity', `${plan.capacity} channels in ${c.cells} cells`)}${readout(`Smallest N for ${c.requiredSir} dB`, needed ?? 'none up to 400')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>N</th><th>(i, j)</th><th>Q</th><th>S/I dB</th><th>Ch/cell</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'pathloss') {
    const hata = { frequencyMHz: c.frequency, baseHeight: c.baseHeight, mobileHeight: c.mobileHeight, environment: c.environment };
    const margin = fadeMargin(c.sigma, c.coverage);
    const allowed = maxAllowedLoss({ eirpDbm: c.eirp, rxSensitivityDbm: c.sensitivity, rxGainDb: c.rxGain, otherLossDb: c.otherLoss, fadeMarginDb: margin });
    const radius = cellRadius({ ...hata, maxLossDb: allowed });
    const dMax = Math.max(2 * radius, 1);
    const ds = Array.from({ length: 200 }, (_, k) => 0.2 + (dMax - 0.2) * k / 199);
    const controls = `${cellField('pathloss.frequency', 'Frequency', c.frequency, 'MHz')}${cellField('pathloss.baseHeight', 'Base antenna height', c.baseHeight, 'm')}${cellField('pathloss.mobileHeight', 'Mobile height', c.mobileHeight, 'm')}${labSelect('data-cell-select', 'pathloss.environment', 'Environment', c.environment, Object.entries(ENVIRONMENTS))}${cellField('pathloss.eirp', 'Base EIRP', c.eirp, 'dBm')}${cellField('pathloss.sensitivity', 'Mobile sensitivity', c.sensitivity, 'dBm')}${cellField('pathloss.rxGain', 'Mobile antenna gain', c.rxGain, 'dBi')}${cellField('pathloss.otherLoss', 'Body/cable loss', c.otherLoss, 'dB')}${cellField('pathloss.sigma', 'Shadowing σ', c.sigma, 'dB')}${cellField('pathloss.coverage', 'Edge coverage probability', c.coverage)}${cellField('pathloss.exponent', 'Log-distance n', c.exponent)}`;
    const body = `<div class="power-grid"><div>${linePlot('Path loss (dB) against distance (km)', ds, [{ name: `${c.frequency > 1500 ? 'COST-231' : 'Okumura'}–Hata`, values: ds.map((d) => hataLoss({ ...hata, distanceKm: d })) }, { name: 'free space', values: ds.map((d) => freeSpaceLoss(c.frequency, d)) }, { name: `log-distance n = ${c.exponent}`, values: ds.map((d) => logDistanceLoss({ frequencyMHz: c.frequency, distanceKm: d, exponent: c.exponent })) }, { name: 'maximum allowed', values: ds.map(() => allowed), color: '#ef4444', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}</div>
      <div class="analysis-readouts">${readout('Model', c.frequency > 1500 ? 'COST-231 Hata (1500–2000 MHz)' : 'Okumura–Hata (150–1500 MHz)')}${readout('Mobile antenna correction a(hm)', `${fmt(hataMobileCorrection(c.frequency, c.mobileHeight, c.environment === 'urban-large' ? 'large' : 'medium'), 4)} dB`)}${readout('Loss at 1 km', `${fmt(hataLoss({ ...hata, distanceKm: 1 }), 5)} dB`)}${readout('Slope', `${fmt(44.9 - 6.55 * Math.log10(c.baseHeight), 4)} dB/decade`)}${readout(`Fade margin for ${fmt(c.coverage * 100, 3)} % at the edge`, `${fmt(margin, 4)} dB`)}${readout('Maximum allowed path loss', `${fmt(allowed, 5)} dB`)}${readout('Cell radius', `${fmt(radius, 4)} km`)}${readout('Cell area (hexagon 2.6 R²)', `${fmt(2.598 * radius * radius, 4)} km²`)}<p class="field-help">Validity: f 150–2000 MHz, base 30–200 m, mobile 1–10 m, d 1–20 km. ${c.frequency < 150 || c.frequency > 2000 ? '<b>Frequency outside the model range.</b>' : ''}</p></div></div>`;
    return { controls, body };
  }
  const sim = simulateHandoff({ separation: c.separation, txPowerDbm: c.txPower, exponent: c.exponent, sigmaDb: c.sigma, decorrelationM: c.decorrelation, hysteresisDb: c.hysteresis, timeToTriggerM: c.ttt, thresholdDbm: c.threshold, seed: Math.round(c.seed) });
  const serving = sim.serving.map((s, k) => (s === 'A' ? sim.powerA[k] : sim.powerB[k]));
  const controls = `${cellField('handoff.separation', 'Distance between base stations', c.separation, 'km')}${cellField('handoff.txPower', 'Base transmit power', c.txPower, 'dBm')}${cellField('handoff.exponent', 'Path-loss exponent', c.exponent)}${cellField('handoff.sigma', 'Shadowing σ', c.sigma, 'dB')}${cellField('handoff.decorrelation', 'Decorrelation distance', c.decorrelation, 'm')}${cellField('handoff.hysteresis', 'Hysteresis margin', c.hysteresis, 'dB')}${cellField('handoff.ttt', 'Time-to-trigger distance', c.ttt, 'm')}${cellField('handoff.threshold', 'Minimum usable level', c.threshold, 'dBm')}${cellField('handoff.seed', 'Random seed', c.seed)}`;
  const body = `<div class="power-grid"><div>${linePlot('Received power (dBm) along the road (km)', sim.positions, [{ name: 'from BS A', values: sim.powerA }, { name: 'from BS B', values: sim.powerB }, { name: 'serving cell', values: serving, color: '#facc15' }, { name: 'minimum level', values: sim.positions.map(() => c.threshold), color: '#ef4444', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}</div>
    <div class="analysis-readouts">${readout('Handoffs', sim.handoffs)}${readout('Ping-pong handoffs (back within 200 m)', sim.pingPong)}${readout('Handoff points', sim.events.map((event) => `${fmt(event.position, 4)} km → ${event.to}`).join(', ') || 'none')}${readout('Without shadowing the handoff happens at', `${fmt(idealHandoffPoint({ separation: c.separation, exponent: c.exponent, hysteresisDb: c.hysteresis }), 4)} km`)}${readout('Below the minimum level', `${fmt(sim.outageFraction * 100, 4)} % of the route`)}<p class="field-help">Shadowing is log-normal with Gudmundson's exponential correlation. Raise the hysteresis or the time-to-trigger and watch ping-pong handoffs disappear — at the price of staying longer on the weaker cell.</p></div></div>`;
  return { controls, body };
}
export function renderCellular(state) {
  const config = cellLab.configuration(state);
  let view;
  try { view = renderCellularTab(config); } catch (error) { view = { controls: '', body: labError('cell', 'Cellular planning', error) }; }
  return `<div class="page scroll-page power-page sigsys-page cellular-page">${pageHeader(modules.find((item) => item.id === 'cellular'), 'CELLULAR NETWORK PLANNING', '')}${labTabs(CELL_TABS, config.tab, 'data-cell-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindCellularEvents() { bindLabControls('cell', cellLab, ['sectoring', 'environment']); }
