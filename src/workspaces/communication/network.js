// Computer Networks workspace. Entry points: renderNetwork(state); bindNetprotoEvents().
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { parsePcap, parsePcapNg } from '../../../packages/packets/src/index.mjs';
import { topologyMetrics } from '../../../packages/topology/src/index.mjs';
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { arqUtilisation, binaryIpv4, csmaCdEfficiency, dijkstra, formatIpv4, ipv6Info, linkChange, nonPersistentCsma, onePersistentCsma, parseGraph, pureAloha, simulateArq, slottedAloha, splitSubnet, subnetInfo, summarize, vlsm } from '../../../packages/netproto/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';
import { reportError } from '../../services/errors.js';

function renderPacketCapture(state) {
  const result = state.simulation?.kind === 'network' ? state.simulation.trace : null;
  const metrics = state.simulation?.kind === 'topology' ? state.simulation.metrics : null;
  const rows = result?.packets?.slice(0, 100).map((packet) => `<tr><td>${packet.index}</td><td>${fmt(packet.timestamp, 6)}</td><td>${packet.capturedLength}</td><td>${packet.originalLength}</td><td>${Array.from(packet.data.slice(0, 8)).map((value) => value.toString(16).padStart(2, '0')).join(' ')}</td></tr>`).join('') || '';
  return `<section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="parse-pcap">Parse saved capture</button><label>Format<select data-pcap-field="format"><option value="pcap">PCAP</option><option value="pcapng">PCAPNG</option></select></label><span class="field-help">Saved capture bytes as hex; live capture is unavailable.</span></div><label class="rf-input-label">PCAP/PCAPNG hex<textarea data-pcap-field="hex" rows="7" spellcheck="false" placeholder="d4c3b2a1 ..."></textarea></label>
    <div class="stat-grid"><div><span>Link type</span><strong>${result?.linkType ?? '—'}</strong><small>PCAP header</small></div><div><span>Snap length</span><strong>${result?.snaplen ?? '—'}</strong><small>bytes</small></div><div><span>Packets</span><strong>${result?.packets.length ?? '—'}</strong><small>bounded reader</small></div></div>${result ? `<div class="packet-table"><table><thead><tr><th>#</th><th>Timestamp</th><th>Captured</th><th>Original</th><th>Prefix</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="module-footnote">Saved PCAP parsing is local and unprivileged. TShark, display filters and live interfaces remain separate unavailable capabilities.</p></section><section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="run-topology">Run topology metrics</button><span class="field-help">Deterministic reachability; no broker or live network access.</span></div><label class="rf-input-label">Topology JSON<textarea data-topology-field="json" rows="5" spellcheck="false">${esc(JSON.stringify({ id: 'demo-network', nodes: [{ id: 'sensor' }, { id: 'gateway' }, { id: 'server' }], links: [{ from: 'sensor', to: 'gateway' }, { from: 'gateway', to: 'server' }] }, null, 2))}</textarea></label>${metrics ? `<div class="stat-grid"><div><span>Nodes</span><strong>${metrics.nodes}</strong><small>validated</small></div><div><span>Links</span><strong>${metrics.links}</strong><small>undirected</small></div><div><span>Reachable</span><strong>${metrics.reachable}</strong><small>from source</small></div></div>` : ''}</section>`;
}
const NET_TABS = [['capture', 'Packet capture'], ['subnet', 'IP subnetting'], ['routing', 'Routing'], ['arq', 'Sliding window'], ['mac', 'Medium access']];
const netLab2 = makeLab('netproto-lab', {
  tab: 'subnet',
  subnet: { address: '192.168.10.77/26', count: 4, vlsmBase: '192.168.1.0/24', vlsmList: 'Sales 100\nEngineering 50\nHR 20\nWAN-1 2\nWAN-2 2', summary: '172.16.0.0/24 172.16.1.0/24 172.16.2.0/24 172.16.3.0/24', ipv6: '2001:0db8:0000:0000:0000:ff00:0042:8329/64' },
  routing: { graph: 'u v 2\nu w 5\nu x 1\nv x 2\nv w 3\nx w 3\nx y 1\nw y 1\nw z 5\ny z 2', source: 'u', changeFrom: 'x', changeTo: 'y', changeCost: 60, dvGraph: 'x y 4\ny z 1\nx z 50', poisoned: 'no', destination: 'x' },
  arq: { protocol: 'gbn', frames: 10, window: 4, propagation: 2, timeout: 0, lostFrames: '3', lostAcks: '', errorRate: 0.1 },
  mac: { bitrate: 10e6, frameBits: 12_000, distance: 2000, velocity: 2e8 },
});
const netField = (...args) => groupField('data-np-field')(...args);
const netText = (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-np-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-np-text="${path}" value="${esc(value)}"></label>`);
const indexList = (text) => String(text).split(/[\s,]+/).filter(Boolean).map(Number).filter((value) => Number.isInteger(value) && value > 0);
function binaryAddress(value, prefix) {
  const bits = binaryIpv4(value).replace(/\./g, '');
  return `<span class="ip-bits">${[...bits].map((bit, k) => `${k && k % 8 === 0 ? '<i>.</i>' : ''}<b class="${k < prefix ? 'net' : 'host'}">${bit}</b>`).join('')}</span>`;
}
function renderGraphSvg(graph, highlight = new Set(), source = null) {
  const n = graph.nodes.length, r = 110, cx = 150, cy = 135;
  const pos = Object.fromEntries(graph.nodes.map((node, k) => [node, [cx + r * Math.cos(2 * Math.PI * k / n - Math.PI / 2), cy + r * Math.sin(2 * Math.PI * k / n - Math.PI / 2)]]));
  const edges = graph.edges.map((edge) => {
    const [x1, y1] = pos[edge.from], [x2, y2] = pos[edge.to];
    const on = highlight.has(`${edge.from}-${edge.to}`) || highlight.has(`${edge.to}-${edge.from}`);
    return `<line class="graph-edge${on ? ' on' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><text class="graph-cost" x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 3).toFixed(1)}">${fmt(edge.cost, 4)}</text>`;
  }).join('');
  const nodes = graph.nodes.map((node) => `<circle class="graph-node${node === source ? ' source' : ''}" cx="${pos[node][0].toFixed(1)}" cy="${pos[node][1].toFixed(1)}" r="14"/><text class="graph-label" x="${pos[node][0].toFixed(1)}" y="${(pos[node][1] + 4).toFixed(1)}">${esc(node)}</text>`).join('');
  return `<svg class="graph-map" viewBox="0 0 300 270" role="img" aria-label="Network graph">${edges}${nodes}</svg>`;
}
function renderArqTimeline(result) {
  const finish = result.finish, height = Math.max(240, finish * 18 + 40), top = 20, scale = (height - 40) / finish;
  const left = 90, right = 430, y = (t) => (top + t * scale).toFixed(1);
  const parts = [`<line class="arq-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - 10}"/><line class="arq-axis" x1="${right}" y1="${top}" x2="${right}" y2="${height - 10}"/><text class="arq-head" x="${left}" y="12">Sender</text><text class="arq-head" x="${right}" y="12">Receiver</text>`];
  for (const event of result.events) {
    if (event.type === 'data') {
      const endX = event.lost ? left + (right - left) * 0.6 : right, endT = event.lost ? event.start + 0.6 * (event.end - event.start) : event.end;
      parts.push(`<path class="arq-data${event.retransmission ? ' re' : ''}${event.lost ? ' lost' : ''}" d="M${left} ${y(event.start)}L${left} ${y(event.start + 1)}L${endX} ${y(endT)}"/><text class="arq-label" x="${left - 6}" y="${(Number(y(event.start)) + 9).toFixed(1)}" text-anchor="end">F${event.seq}${event.retransmission ? '′' : ''}</text>${event.lost ? `<text class="arq-x" x="${endX}" y="${(Number(y(endT)) + 4).toFixed(1)}">✕</text>` : ''}`);
    } else if (event.type === 'ack') {
      const endX = event.lost ? right - (right - left) * 0.6 : left, endT = event.lost ? event.start + 0.6 * (event.end - event.start) : event.end;
      parts.push(`<path class="arq-ack${event.lost ? ' lost' : ''}" d="M${right} ${y(event.start)}L${endX} ${y(endT)}"/><text class="arq-label" x="${right + 6}" y="${(Number(y(event.start)) + 4).toFixed(1)}">ACK${event.ack}</text>${event.lost ? `<text class="arq-x" x="${endX}" y="${(Number(y(endT)) + 4).toFixed(1)}">✕</text>` : ''}`);
    } else parts.push(`<text class="arq-timeout" x="${left - 6}" y="${y(event.at)}" text-anchor="end">⏱ T/O F${event.seq}</text>`);
  }
  for (const delivery of result.deliveries) parts.push(`<circle class="arq-deliver" cx="${right}" cy="${y(delivery.at)}" r="3"/>`);
  return `<div class="gantt-scroll"><svg class="arq-timeline" role="img" aria-label="ARQ timeline of frames and acknowledgements" viewBox="0 0 520 ${height}" width="520" height="${height}">${parts.join('')}</svg></div>`;
}
function renderNetworkTab(config, state) {
  const c = config[config.tab];
  if (config.tab === 'subnet') {
    const info = subnetInfo(c.address);
    const split = splitSubnet(c.address, { count: Math.max(1, Math.round(c.count)) });
    const requirements = String(c.vlsmList).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => { const parts = line.split(/\s+/); const hosts = Number(parts.pop()); if (!(hosts >= 1) || !Number.isInteger(hosts)) throw new RangeError(`VLSM line ${index + 1}: end with the number of hosts.`); return { name: parts.join(' ') || `Net ${index + 1}`, hosts }; });
    const plan = vlsm(c.vlsmBase, requirements);
    const summary = summarize(String(c.summary).split(/[\s,]+/).filter(Boolean));
    const v6 = ipv6Info(c.ipv6);
    const controls = `${netText('subnet.address', 'Address / prefix or mask', c.address)}${netField('subnet.count', 'Split into subnets', c.count)}${netText('subnet.vlsmBase', 'VLSM block', c.vlsmBase)}${netText('subnet.vlsmList', 'VLSM needs: name hosts', c.vlsmList, 5)}${netText('subnet.summary', 'Networks to summarise', c.summary)}${netText('subnet.ipv6', 'IPv6 address', c.ipv6)}`;
    const body = `<div class="power-grid"><div><div class="analysis-readouts">${readout('Network', info.cidr)}${readout('Subnet mask', `${formatIpv4(info.mask)} (wildcard ${formatIpv4(info.wildcard)})`)}${readout('Broadcast', formatIpv4(info.broadcast))}${readout('Usable hosts', `${formatIpv4(info.firstHost)} – ${formatIpv4(info.lastHost)} (${info.usable})`)}${readout('Class / scope', `${info.class}, ${info.scope}`)}</div>
      <span class="panel-label">ADDRESS IN BINARY (NETWORK BITS / HOST BITS)</span><div class="ip-binary">${binaryAddress(info.address, info.prefix)}<small>address</small>${binaryAddress(info.mask, info.prefix)}<small>mask</small>${binaryAddress(info.network, info.prefix)}<small>network = address AND mask</small></div>
      <span class="panel-label">${split.total} × /${split.prefix} SUBNETS (${split.borrowedBits} BITS BORROWED)</span><table class="truth-table comm-table power-table"><thead><tr><th>#</th><th>Subnet</th><th>Hosts</th><th>Broadcast</th></tr></thead><tbody>${split.subnets.slice(0, 16).map((subnet, k) => `<tr><td>${k}</td><td>${subnet.cidr}</td><td>${formatIpv4(subnet.firstHost)} – ${formatIpv4(subnet.lastHost)}</td><td>${formatIpv4(subnet.broadcast)}</td></tr>`).join('')}</tbody></table></div>
      <div><span class="panel-label">VLSM PLAN FOR ${esc(plan.base.cidr)} (LARGEST FIRST)</span><table class="truth-table comm-table power-table"><thead><tr><th>Name</th><th>Needs</th><th>Subnet</th><th>Mask</th><th>Usable</th><th>Spare</th></tr></thead><tbody>${plan.allocations.map((entry) => `<tr><td>${esc(entry.name)}</td><td>${entry.hosts}</td><td>${entry.cidr}</td><td>${formatIpv4(entry.mask)}</td><td>${entry.usable}</td><td>${entry.wasted}</td></tr>`).join('')}</tbody></table><p class="field-help">${plan.used} of ${plan.base.size} addresses allocated, ${plan.free} free.</p>
      <div class="analysis-readouts">${readout('Summary route', `${summary.summary.cidr}${summary.exact ? ' (exact)' : ` (also covers ${summary.extraAddresses} other addresses)`}`)}${readout('IPv6 compressed (RFC 5952)', v6.compressed)}${readout('IPv6 expanded', v6.expanded)}${readout('IPv6 prefix', `${v6.network} — ${v6.type}`)}${readout('Addresses in the prefix', v6.prefix >= 64 ? `2^${128 - v6.prefix} = ${v6.addresses.toString()}` : `2^${128 - v6.prefix}`)}</div></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'routing') {
    const graph = parseGraph(c.graph);
    const source = graph.nodes.includes(c.source) ? c.source : graph.nodes[0];
    const result = dijkstra(graph, source);
    const tree = new Set(graph.nodes.filter((node) => result.previous[node]).map((node) => `${result.previous[node]}-${node}`));
    const dvGraph = parseGraph(c.dvGraph);
    const change = linkChange(dvGraph, { from: c.changeFrom, to: c.changeTo, cost: c.changeCost > 0 ? c.changeCost : Infinity }, { poisonedReverse: c.poisoned === 'yes' });
    const destination = dvGraph.nodes.includes(c.destination) ? c.destination : dvGraph.nodes[0];
    const rounds = change.after.rounds;
    const others = dvGraph.nodes.filter((node) => node !== destination);
    const finite = (value) => (Number.isFinite(value) ? value : NaN);
    const controls = `${netText('routing.graph', 'Links (link-state): A B cost', c.graph, 6)}${labSelect('data-np-select', 'routing.source', 'Source', source, graph.nodes.map((node) => [node, node]))}${netText('routing.dvGraph', 'Links (distance vector)', c.dvGraph, 4)}${netText('routing.changeFrom', 'Change link from', c.changeFrom)}${netText('routing.changeTo', 'to', c.changeTo)}${netField('routing.changeCost', 'New cost (0 = link down)', c.changeCost)}${labSelect('data-np-select', 'routing.poisoned', 'Poisoned reverse', c.poisoned, [['no', 'off'], ['yes', 'on']])}${labSelect('data-np-select', 'routing.destination', 'Watch routes to', destination, dvGraph.nodes.map((node) => [node, node]))}`;
    const stepRows = result.steps.map((step, k) => `<tr><td>${k}</td><td>${esc(step.visited.join(''))}</td>${graph.nodes.filter((node) => node !== source).map((node) => `<td class="${step.visited.includes(node) && step.added !== node ? 'done' : ''}">${Number.isFinite(step.distance[node]) ? `${fmt(step.distance[node], 4)}, ${step.previous[node]}` : '∞'}</td>`).join('')}</tr>`).join('');
    const finalTable = (table) => `<table class="truth-table comm-table power-table"><thead><tr><th>From \\ to</th>${dvGraph.nodes.map((node) => `<th>${esc(node)}</th>`).join('')}</tr></thead><tbody>${dvGraph.nodes.map((x) => `<tr><td>${esc(x)}</td>${dvGraph.nodes.map((y) => `<td>${Number.isFinite(table[x][y].cost) ? `${fmt(table[x][y].cost, 4)} via ${table[x][y].via}` : '∞'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const body = `<div class="power-grid"><div><span class="panel-label">LINK STATE: SHORTEST-PATH TREE FROM ${esc(source)}</span>${renderGraphSvg(graph, tree, source)}
      <table class="truth-table comm-table power-table"><thead><tr><th>Step</th><th>N′</th>${graph.nodes.filter((node) => node !== source).map((node) => `<th>D(${esc(node)}), p(${esc(node)})</th>`).join('')}</tr></thead><tbody>${stepRows}</tbody></table>
      <table class="truth-table comm-table power-table"><thead><tr><th>Destination</th><th>Next hop</th><th>Cost</th><th>Path</th></tr></thead><tbody>${result.forwarding.map((entry) => `<tr><td>${esc(entry.destination)}</td><td>${entry.nextHop ?? '—'}</td><td>${Number.isFinite(entry.cost) ? fmt(entry.cost, 4) : '∞'}</td><td>${esc(entry.path.join(' → '))}</td></tr>`).join('')}</tbody></table></div>
      <div><span class="panel-label">DISTANCE VECTOR: CONVERGED TABLES BEFORE THE CHANGE</span>${finalTable(change.before.table)}<span class="panel-label">AFTER ${esc(c.changeFrom)}–${esc(c.changeTo)} ${c.changeCost > 0 ? `BECOMES ${c.changeCost}` : 'FAILS'} (${change.after.converged ? `${change.after.roundsToConverge} ROUNDS` : 'NOT CONVERGED IN 100 ROUNDS'})</span>${finalTable(change.after.table)}
      ${linePlot(`Cost to ${destination} after each exchange round`, rounds.map((_, k) => k), others.map((node) => ({ name: node, values: rounds.map((table) => finite(table[node][destination].cost)) })), { xLabel: (x) => fmt(x, 3) })}<p class="field-help">Each round every router sends its vector to its neighbours and recomputes Dx(y) = min over neighbours v of c(x, v) + Dv(y). Good news travels fast; bad news “counts to infinity” as two routers keep pointing at each other. Poisoned reverse (advertise ∞ back to the next hop) breaks two-node loops.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'arq') {
    const result = simulateArq({ protocol: c.protocol, frames: Math.round(c.frames), window: Math.round(c.window), propagation: c.propagation, timeout: c.timeout > 0 ? c.timeout : null, lostFrames: indexList(c.lostFrames), lostAcks: indexList(c.lostAcks) });
    const util = arqUtilisation({ a: c.propagation, window: result.window, p: c.errorRate });
    const controls = `${labSelect('data-np-select', 'arq.protocol', 'Protocol', c.protocol, [['stop-and-wait', 'Stop-and-wait'], ['gbn', 'Go-Back-N'], ['sr', 'Selective Repeat']])}${netField('arq.frames', 'Frames to send', c.frames)}${c.protocol === 'stop-and-wait' ? '' : netField('arq.window', 'Window size W', c.window)}${netField('arq.propagation', 'Propagation a = Tp/Tt', c.propagation)}${netField('arq.timeout', 'Timeout (0 = auto)', c.timeout, 'Tt')}${netText('arq.lostFrames', 'Lose data transmissions #', c.lostFrames)}${netText('arq.lostAcks', 'Lose ACK transmissions #', c.lostAcks)}${netField('arq.errorRate', 'Frame-error rate p (formulas)', c.errorRate)}`;
    const body = `<div class="power-grid"><div><span class="panel-label">TIMELINE (TIME DOWNWARD, ONE UNIT = FRAME TRANSMISSION TIME)</span>${renderArqTimeline(result)}</div>
      <div class="analysis-readouts">${readout('Transmissions', `${result.transmissions} (${result.retransmissions} retransmissions)`)}${readout('Delivered in order', result.deliveries.map((d) => d.seq).join(', '))}${readout('Time to finish', `${fmt(result.finish, 4)} Tt (timeout ${fmt(result.timeout, 4)} Tt)`)}${readout('Measured efficiency', `${fmt(result.efficiency * 100, 4)} %`)}${readout('Window that fills the pipe 1 + 2a', fmt(util.windowToFill, 4))}${readout('Stop-and-wait U = (1 − p)/(1 + 2a)', `${fmt(util.stopAndWait * 100, 4)} %`)}${readout('Go-Back-N U', `${fmt(util.goBackN * 100, 4)} %`)}${readout('Selective Repeat U', `${fmt(util.selectiveRepeat * 100, 4)} %`)}${readout('Sequence-number bits', `GBN ≥ ${util.sequenceBitsGbn} (W ≤ 2ᵏ − 1), SR ≥ ${util.sequenceBitsSr} (W ≤ 2ᵏ⁻¹)`)}<p class="field-help">Transmission numbers count every frame (or ACK) the channel carries, retransmissions included — "3" loses the third data frame sent. Go-Back-N uses cumulative ACKs (ACKn = next frame expected) and resends the whole outstanding window on a timeout; Selective Repeat ACKs each frame, buffers out-of-order ones and resends only what timed out.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'mac') {
    const tFrame = c.frameBits / c.bitrate, tProp = c.distance / c.velocity, a = tProp / tFrame;
    const gs = Array.from({ length: 300 }, (_, k) => 0.01 + 4.99 * k / 299);
    const controls = `${netField('mac.bitrate', 'Bit rate', c.bitrate, 'b/s')}${netField('mac.frameBits', 'Frame length', c.frameBits, 'bits')}${netField('mac.distance', 'Cable length', c.distance, 'm')}${netField('mac.velocity', 'Signal speed', c.velocity, 'm/s')}`;
    const body = `<div class="power-grid"><div>${linePlot(`Throughput S against offered load G (a = ${fmt(a, 3)})`, gs, [{ name: 'pure ALOHA', values: gs.map(pureAloha) }, { name: 'slotted ALOHA', values: gs.map(slottedAloha) }, { name: 'non-persistent CSMA', values: gs.map((g) => nonPersistentCsma(g, a)) }, { name: '1-persistent CSMA', values: gs.map((g) => onePersistentCsma(g, a)) }], { xLabel: (x) => fmt(x, 3), yMin: 0, yMax: 1 })}</div>
      <div class="analysis-readouts">${readout('Frame time Tt', eng(tFrame, 's'))}${readout('Propagation time Tp', eng(tProp, 's'))}${readout('a = Tp/Tt', fmt(a, 5))}${readout('Pure ALOHA maximum', `${fmt(100 / (2 * Math.E), 4)} % at G = 0.5`)}${readout('Slotted ALOHA maximum', `${fmt(100 / Math.E, 4)} % at G = 1`)}${readout('CSMA/CD efficiency 1/(1 + 5a)', `${fmt(csmaCdEfficiency(a) * 100, 4)} %`)}${readout('Minimum frame for collision detection (2Tp)', `${fmt(2 * tProp * c.bitrate, 5)} bits`)}${readout('Stop-and-wait over this link', `${fmt(100 / (1 + 2 * a), 4)} %`)}<p class="field-help">ALOHA: S = G·e^(−2G) (vulnerable period 2 frames), slotted S = G·e^(−G). CSMA curves are Kleinrock and Tobagi's. Classic 10 Mb/s Ethernet's 512-bit minimum frame is 2Tp for a 2500 m network with repeaters.</p></div></div>`;
    return { controls, body };
  }
  return { controls: '', body: renderPacketCapture(state) };
}
export function renderNetwork(state) {
  const config = netLab2.configuration(state);
  let view;
  try { view = renderNetworkTab(config, state); } catch (error) { view = { controls: '', body: labError('np', 'Networks', error) }; }
  const capture = config.tab === 'capture';
  return `<div class="page scroll-page power-page sigsys-page network-page">${pageHeader(modules.find((item) => item.id === 'network'), 'COMPUTER NETWORKS', capture ? '<span class="pill live"><i></i> SAVED CAPTURE ONLY</span>' : '')}${labTabs(NET_TABS, config.tab, 'data-np-tab')}${capture ? view.body : `<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>`}</div>`;
}
export function bindNetprotoEvents() {
  bindLabControls('np', netLab2, ['source', 'poisoned', 'destination', 'protocol']);
  document.querySelectorAll('[data-np-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.npText.split('.'); netLab2.persist((config) => { config[group][key] = input.value; }); }));
}

export function bindNetworkEvents() {
  const savedTopology = getState().project.experiments.find((experiment) => experiment?.id === 'topology-metrics')?.inputs?.topology;
  const topologyField = document.querySelector('[data-topology-field="json"]');
  if (savedTopology && topologyField) topologyField.value = JSON.stringify(savedTopology, null, 2);
  document.querySelector('[data-action="parse-pcap"]')?.addEventListener('click', () => {
    const input = document.querySelector('[data-pcap-field="hex"]')?.value || '';
    try {
      const compact = input.replace(/\s+/g, '');
      if (!compact || compact.length > 2 * 256 * 1024 * 1024 || compact.length % 2 || !/^[0-9a-f]+$/i.test(compact)) throw new Error('Enter an even-length hexadecimal PCAP capture within the size limit.');
      const bytes = Uint8Array.from({ length: compact.length / 2 }, (_, index) => Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16));
      const format = document.querySelector('[data-pcap-field="format"]')?.value || 'pcap';
      setState({ simulation: { kind: 'network', trace: format === 'pcapng' ? parsePcapNg(bytes) : parsePcap(bytes) } });
      notify(`Saved ${format.toUpperCase()} parsed`, 'success');
    } catch (error) { reportError(error); }
  });
  document.querySelector('[data-action="run-topology"]')?.addEventListener('click', () => {
    try {
      const topology = JSON.parse(document.querySelector('[data-topology-field="json"]')?.value || '');
      recordExperiment({ id: 'topology-metrics', kind: 'network', operation: 'topology-metrics', inputs: { topology } });
      setState({ simulation: { kind: 'topology', metrics: topologyMetrics(topology, topology.nodes?.[0]?.id || null) } });
      notify('Topology metrics computed', 'success');
    } catch (error) { reportError(error, { fallback: 'Topology is invalid' }); }
  });
}
