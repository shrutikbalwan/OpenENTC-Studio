// PCB Studio workspace. Entry points: renderPcb(state); bindPcbEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { autoPlace, autoroute, billOfMaterials, buildBoard, createZip, extractNetlist, fabricationFiles, normalizeRules, ratsnest, runDrc, silkscreen, traceWidthForCurrent } from '../../../packages/pcb/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { labField, labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const PCB_DEFAULTS = Object.freeze({ style: 'tht', rules: {}, placement: {}, tracks: [], vias: [], show: { top: true, bottom: true, silk: true, ratsnest: true, drc: true }, selected: null, current: 1, tempRise: 10, copperOz: 1 });
const PCB_RULE_FIELDS = [['trackWidth', 'Track width'], ['clearance', 'Clearance'], ['viaDiameter', 'Via diameter'], ['viaDrill', 'Via drill'], ['edgeClearance', 'Edge clearance'], ['margin', 'Board margin'], ['grid', 'Router grid']];
const PCB_LAYER_LABELS = { top: 'Top copper', bottom: 'Bottom copper', silk: 'Silkscreen', ratsnest: 'Ratsnest', drc: 'DRC markers' };
function pcbConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'pcb-board')?.inputs || {};
  return { ...PCB_DEFAULTS, ...saved, show: { ...PCB_DEFAULTS.show, ...(saved.show || {}) } };
}
function persistPcb(patch) {
  const next = { ...pcbConfiguration(getState()), ...patch };
  const size = new TextEncoder().encode(JSON.stringify(next)).length;
  if (size > 60_000) { notify('This board has too many tracks to save in the project; routes kept for this session only.', 'error'); setState({ pcbSession: next }); return; }
  recordExperiment({ id: 'pcb-board', kind: 'pcb', operation: 'pcb-board', inputs: next });
}
const roundMm = (value) => Math.round(value * 1e4) / 1e4;
const compactTracks = (tracks) => tracks.map((t) => ({ net: t.net, layer: t.layer, x1: roundMm(t.x1), y1: roundMm(t.y1), x2: roundMm(t.x2), y2: roundMm(t.y2), width: t.width }));
const compactVias = (vias) => vias.map((v) => ({ net: v.net, x: roundMm(v.x), y: roundMm(v.y), diameter: v.diameter, drill: v.drill }));
function pcbBoardState(state) {
  const config = state.pcbSession || pcbConfiguration(state);
  const board = buildBoard(state.project.circuit, { style: config.style, placement: config.placement, rules: config.rules });
  // Keep only copper whose net still exists on this board.
  const nets = new Set(board.nets);
  return { config, board, tracks: (config.tracks || []).filter((t) => nets.has(t.net)), vias: (config.vias || []).filter((v) => nets.has(v.net)) };
}
function renderPcbSvg(board, tracks, vias, config, drc) {
  const pad = 2;
  const { x1, y1, x2, y2 } = board.outline;
  const show = config.show;
  const line = (cls, a, b, c, d, extra = '') => `<line class="${cls}" x1="${a.toFixed(3)}" y1="${b.toFixed(3)}" x2="${c.toFixed(3)}" y2="${d.toFixed(3)}" ${extra}/>`;
  const padSvg = (p) => {
    const cls = p.drill ? 'pcb-pad tht' : 'pcb-pad smd';
    const copper = p.shape.kind === 'circle' ? `<circle class="${cls}" cx="${p.x}" cy="${p.y}" r="${p.shape.r}"/>` : `<rect class="${cls}" x="${p.x - p.w / 2}" y="${p.y - p.h / 2}" width="${p.w}" height="${p.h}"/>`;
    return `${copper}${p.drill ? `<circle class="pcb-drill" cx="${p.x}" cy="${p.y}" r="${p.drill / 2}"/>` : ''}<title>${esc(`${p.reference} pad ${p.number} · ${p.net || 'no net'}`)}</title>`;
  };
  const parts = board.parts.map((part) => {
    const b = part.bounds;
    const selected = config.selected === part.id;
    return `<g class="pcb-part${selected ? ' selected' : ''}" data-pcb-part="${esc(part.id)}"><rect class="pcb-courtyard" x="${b.x1}" y="${b.y1}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}"/>${part.pads.map(padSvg).join('')}</g>`;
  }).join('');
  const trackSvg = (layer) => tracks.filter((t) => t.layer === layer).map((t) => line(`pcb-track ${layer}`, t.x1, t.y1, t.x2, t.y2, `stroke-width="${t.width}"`)).join('');
  const viaSvg = vias.map((v) => `<circle class="pcb-via" cx="${v.x}" cy="${v.y}" r="${v.diameter / 2}"/><circle class="pcb-drill" cx="${v.x}" cy="${v.y}" r="${v.drill / 2}"/>`).join('');
  const silk = show.silk ? silkscreen(board).map(([a, b, c, d]) => line('pcb-silk', a, b, c, d)).join('') : '';
  const rats = show.ratsnest ? ratsnest(board, tracks, vias).map((r) => line('pcb-rats', r.x1, r.y1, r.x2, r.y2)).join('') : '';
  const markers = show.drc && drc ? drc.violations.map((v) => `<circle class="pcb-marker ${v.severity}" cx="${v.x}" cy="${v.y}" r="0.9"><title>${esc(v.message)}</title></circle>`).join('') : '';
  return `<svg class="pcb-board" viewBox="${x1 - pad} ${y1 - pad} ${x2 - x1 + 2 * pad} ${y2 - y1 + 2 * pad}" role="img" aria-label="PCB layout"><rect class="pcb-substrate" x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="0.6"/>
    ${show.bottom ? `<g class="pcb-layer-bottom">${trackSvg('bottom')}</g>` : ''}${show.top ? `<g class="pcb-layer-top">${trackSvg('top')}</g>` : ''}<g>${parts}</g>${viaSvg}<g class="pcb-silk-layer">${silk}</g><g>${rats}</g><g>${markers}</g></svg>`;
}
export function renderPcb(state) {
  const module = modules.find((item) => item.id === 'pcb');
  let model;
  try { model = pcbBoardState(state); }
  catch (error) { return `<div class="page scroll-page pcb-page">${pageHeader(module, 'BUILT-IN PCB DESIGNER', '')}<div class="diagnostic error"><b>PCB</b><span>${esc(error.message)}</span></div></div>`; }
  const { config, board, tracks, vias } = model;
  if (!board.parts.length) {
    return `<div class="page scroll-page pcb-page">${pageHeader(module, 'BUILT-IN PCB DESIGNER', '')}<section class="dsp-card"><h3>No parts to lay out</h3><p class="module-footnote">Draw a circuit in Circuit Lab (or load an example there), then come back: PCB Studio turns every component into a footprint and every net into connections to route.</p><button class="button primary" data-module="circuit">Open Circuit Lab</button></section></div>`;
  }
  const drc = state.pcbDrc && state.pcbDrc.signature === pcbSignature(config, board) ? state.pcbDrc.result : null;
  const open = ratsnest(board, tracks, vias);
  const total = ratsnest(board).length;
  const trackLength = tracks.reduce((sum, t) => sum + Math.hypot(t.x2 - t.x1, t.y2 - t.y1), 0);
  const selected = board.parts.find((part) => part.id === config.selected);
  const rules = board.rules;
  const actions = `<button class="button ghost" data-action="pcb-autoplace">Auto-place</button><button class="button ghost" data-action="pcb-clear">Clear routes</button><button class="button run" data-action="pcb-autoroute">Auto-route</button><button class="button ghost" data-action="pcb-drc">Run DRC</button><button class="button primary" data-action="pcb-export">Download fabrication ZIP</button>`;
  let widthText;
  try { const result = traceWidthForCurrent({ current: Number(config.current), temperatureRise: Number(config.tempRise), copperOz: Number(config.copperOz) }); widthText = `${fmt(result.widthMm, 3)} mm (${fmt(result.widthMil, 1)} mil)`; } catch (error) { widthText = error.message; }
  const bom = billOfMaterials(board);
  return `<div class="page scroll-page pcb-page">${pageHeader(module, 'BUILT-IN PCB DESIGNER', actions)}
    <div class="pcb-layout">
      <aside class="dsp-card pcb-side">
        <span class="panel-label">FOOTPRINTS</span>
        <div class="dsp-controls">${labSelect('data-pcb-field', 'style', 'Style', config.style, [['tht', 'Through-hole (hand soldering)'], ['smd', 'Surface mount (SMD)']])}</div>
        <span class="panel-label">DESIGN RULES (mm)</span>
        <div class="dsp-controls pcb-rules">${PCB_RULE_FIELDS.map(([key, label]) => labField('data-pcb-rule', key, label, rules[key], '', 'type="number" step="0.05" min="0"')).join('')}</div>
        <span class="panel-label">LAYERS</span>
        <div class="pcb-toggles">${Object.entries(PCB_LAYER_LABELS).map(([key, label]) => `<label class="check-label"><input type="checkbox" data-pcb-show="${key}" ${config.show[key] ? 'checked' : ''}> <i class="swatch ${key}"></i>${label}</label>`).join('')}</div>
        <span class="panel-label">SELECTED PART</span>
        ${selected ? `<div class="analysis-readouts comm-readouts">${readout('Reference', selected.reference)}${readout('Footprint', selected.footprint.name)}${readout('Position', `${fmt(selected.placement.x, 2)}, ${fmt(selected.placement.y, 2)} mm`)}${readout('Rotation', `${selected.placement.rotation}°`)}</div><div class="dsp-controls"><button class="button ghost" data-action="pcb-rotate">Rotate 90°</button></div>` : '<p class="module-footnote">Click a part on the board to select it; drag to move it. Moving a part removes the tracks of its nets.</p>'}
        <span class="panel-label">TRACE WIDTH (IPC-2221, outer layer)</span>
        <div class="dsp-controls">${labField('data-pcb-field', 'current', 'Current', config.current, 'A', 'type="number" step="0.1" min="0.01"')}${labField('data-pcb-field', 'tempRise', 'Temp. rise', config.tempRise, '°C', 'type="number" step="1" min="1"')}${labField('data-pcb-field', 'copperOz', 'Copper', config.copperOz, 'oz', 'type="number" step="0.5" min="0.5"')}</div>
        <div class="analysis-readouts comm-readouts">${readout('Minimum width', widthText)}</div>
      </aside>
      <section class="pcb-main">
        <div class="analysis-readouts comm-readouts pcb-stats">${readout('Board', `${fmt(board.width, 3)} × ${fmt(board.height, 3)} mm`)}${readout('Parts / nets', `${board.parts.length} / ${board.nets.length}`)}${readout('Routed', `${total - open.length} / ${total} connections`)}${readout('Tracks', `${tracks.length} · ${fmt(trackLength, 4)} mm`)}${readout('Vias', vias.length)}${readout('DRC', drc ? (drc.passed ? `passed (${drc.warnings} warnings)` : `${drc.errors} errors, ${drc.warnings} warnings`) : 'not run')}</div>
        <div class="pcb-canvas">${renderPcbSvg(board, tracks, vias, config, drc)}</div>
        ${board.warnings.map((warning) => `<div class="diagnostic warning"><b>Note</b><span>${esc(warning)}</span></div>`).join('')}
        ${drc ? `<span class="panel-label">DESIGN RULE CHECK</span>${drc.violations.length ? `<ul class="pcb-drc">${drc.violations.slice(0, 60).map((v) => `<li class="${v.severity}"><b>${esc(v.type)}</b> ${esc(v.message)}</li>`).join('')}</ul>` : '<p class="module-footnote">No violations: clearances, widths, drills, board edge and connectivity all pass.</p>'}` : ''}
        <span class="panel-label">BILL OF MATERIALS</span>
        <table class="truth-table comm-table"><thead><tr><th>Designator</th><th>Qty</th><th>Type</th><th>Value</th><th>Footprint</th></tr></thead><tbody>${bom.rows.map((row) => `<tr><td>${esc(row.references.join(' '))}</td><td>${row.references.length}</td><td>${esc(row.type)}</td><td>${esc(row.value)}</td><td>${esc(row.footprint)}</td></tr>`).join('')}</tbody></table>
        <p class="module-footnote">The ZIP holds Gerber X2 layers (top/bottom copper, solder mask, silkscreen, board outline), an Excellon drill file, the BOM and a pick-and-place file — the set most PCB fabs accept. Check it in a Gerber viewer before ordering.</p>
      </section>
    </div></div>`;
}
const pcbSignature = (config, board) => JSON.stringify([config.style, config.rules, board.placement, config.tracks?.length, config.vias?.length, board.nets]);
export function bindPcbEvents() {
  const svg = document.querySelector('.pcb-board');
  const current = () => pcbBoardState(getState());
  const save = (patch) => { setState({ pcbSession: null }); persistPcb(patch); };
  document.querySelector('[data-action="pcb-autoplace"]')?.addEventListener('click', () => {
    try { const { board } = current(); const netlist = extractNetlist(getState().project.circuit, board.style); save({ placement: autoPlace(netlist), tracks: [], vias: [], selected: null }); notify('Parts auto-placed; routes cleared', 'success'); } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="pcb-clear"]')?.addEventListener('click', () => save({ tracks: [], vias: [] }));
  document.querySelector('[data-action="pcb-autoroute"]')?.addEventListener('click', () => {
    try {
      const { board, tracks, vias } = current();
      const result = autoroute(board, { tracks, vias });
      save({ placement: board.placement, tracks: compactTracks(result.tracks), vias: compactVias(result.vias) });
      notify(result.remaining ? `Routed with ${result.remaining} connection(s) left — move parts apart or relax the rules, then route again.` : 'All connections routed', result.remaining ? 'error' : 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="pcb-drc"]')?.addEventListener('click', () => {
    try { const { config, board, tracks, vias } = current(); const result = runDrc(board, { tracks, vias }); setState({ pcbDrc: { signature: pcbSignature(config, board), result } }); notify(result.passed ? 'DRC passed' : `DRC: ${result.errors} error(s)`, result.passed ? 'success' : 'error'); } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="pcb-export"]')?.addEventListener('click', () => {
    try {
      const { board, tracks, vias } = current();
      const name = getState().project.name || 'board';
      const zip = createZip(fabricationFiles(board, { tracks, vias, name }));
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' })); link.download = `${name.replace(/[^A-Za-z0-9_-]+/g, '_') || 'board'}-fabrication.zip`; link.click(); URL.revokeObjectURL(link.href);
      const open = ratsnest(board, tracks, vias).length;
      notify(open ? `Fabrication ZIP exported — warning: ${open} connection(s) are not routed yet` : 'Fabrication ZIP exported', open ? 'error' : 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="pcb-rotate"]')?.addEventListener('click', () => {
    const { config, board, tracks, vias } = current();
    const part = board.parts.find((entry) => entry.id === config.selected);
    if (!part) return;
    const nets = new Set(Object.values(part.pinNets));
    save({ placement: { ...board.placement, [part.id]: { ...part.placement, rotation: (part.placement.rotation + 90) % 360 } }, tracks: tracks.filter((t) => !nets.has(t.net)), vias: vias.filter((v) => !nets.has(v.net)) });
  });
  document.querySelector('[data-pcb-field="style"]')?.addEventListener('change', (event) => save({ style: event.target.value, placement: {}, tracks: [], vias: [], selected: null }));
  document.querySelectorAll('[data-pcb-field]:not([data-pcb-field="style"])').forEach((field) => field.addEventListener('change', () => { const value = Number(field.value); if (Number.isFinite(value)) save({ [field.dataset.pcbField]: value }); }));
  document.querySelectorAll('[data-pcb-rule]').forEach((field) => field.addEventListener('change', () => {
    const { config } = current();
    const rules = { ...config.rules, [field.dataset.pcbRule]: Number(field.value) };
    try { normalizeRules(rules); save({ rules, tracks: [], vias: [] }); notify('Rules updated; routes cleared', 'success'); } catch (error) { notify(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-pcb-show]').forEach((box) => box.addEventListener('change', () => { const { config } = current(); save({ show: { ...config.show, [box.dataset.pcbShow]: box.checked } }); }));
  if (!svg) return;
  // Drag parts: move the SVG group live, commit the snapped position on release.
  let drag = null;
  const toBoard = (event) => { const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.querySelectorAll('[data-pcb-part]').forEach((group) => group.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const start = toBoard(event);
    drag = { id: group.dataset.pcbPart, group, start, dx: 0, dy: 0 };
    group.setPointerCapture?.(event.pointerId);
  }));
  svg.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = toBoard(event);
    drag.dx = point.x - drag.start.x; drag.dy = point.y - drag.start.y;
    drag.group.setAttribute('transform', `translate(${drag.dx} ${drag.dy})`);
  });
  const finish = () => {
    if (!drag) return;
    const { id, dx, dy } = drag;
    drag = null;
    const { board, tracks, vias } = current();
    if (Math.hypot(dx, dy) < 0.3) { save({ selected: id }); return; }
    const part = board.parts.find((entry) => entry.id === id);
    const snap = (value) => Math.round(value / 0.25) * 0.25;
    const nets = new Set(Object.values(part.pinNets));
    save({ selected: id, placement: { ...board.placement, [id]: { ...part.placement, x: snap(part.placement.x + dx), y: snap(part.placement.y + dy) } }, tracks: tracks.filter((t) => !nets.has(t.net)), vias: vias.filter((v) => !nets.has(v.net)) });
  };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
}
