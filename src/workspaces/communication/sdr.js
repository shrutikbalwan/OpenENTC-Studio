// SDR Flowgraph Editor workspace. Entry points: renderSdr(state); bindSdrEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify } from '../../core/store.js';
import { blockParams, BLOCKS, exampleGraph, runFlowgraph, SDR_EXAMPLES } from '../../../packages/sdr/src/index.mjs';
import { eng, fmt, numericText } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { pageHeader } from '../../components/layout.js';
import { makeLab } from '../../controllers/lab-controls.js';

const sdrLab = makeLab('sdr-lab', { tab: 'editor', editor: { graph: exampleGraph('fm'), example: 'fm', selected: null } });
const SDR_BLOCK_WIDTH = 150;
const sdrBlockHeight = (def) => 34 + 18 * Math.max(1, def.inputs.length, def.outputs.length);
const sdrPortY = (index) => 34 + 18 * index;
let sdrCache = { key: null, value: null };
let sdrPending = null;
function sdrRun(graph) {
  const key = JSON.stringify(graph);
  if (sdrCache.key !== key) {
    let value;
    try { value = runFlowgraph(graph, { sampleRate: graph.sampleRate ?? 48_000, samples: graph.samples ?? 8192 }); } catch (error) { value = { fatal: error.message, sinks: {}, errors: {}, rates: {} }; }
    sdrCache = { key, value };
  }
  return sdrCache.value;
}
function renderSdrCanvas(graph, run, selected) {
  const blocks = graph.blocks;
  const width = Math.max(1100, ...blocks.map((b) => b.x + SDR_BLOCK_WIDTH + 40)), height = Math.max(380, ...blocks.map((b) => b.y + sdrBlockHeight(BLOCKS[b.type]) + 30));
  const portPosition = (id, port, output) => {
    const b = blocks.find((x) => x.id === id), def = BLOCKS[b.type], index = (output ? def.outputs : def.inputs).indexOf(port);
    return [b.x + (output ? SDR_BLOCK_WIDTH : 0), b.y + sdrPortY(index)];
  };
  const wires = graph.connections.map((c, index) => {
    const [x1, y1] = portPosition(...c.from.split(':'), true), [x2, y2] = portPosition(...c.to.split(':'), false), dx = Math.max(40, Math.abs(x2 - x1) / 2);
    const d = `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    const rate = run.rates[c.from.split(':')[0]]?.[BLOCKS[blocks.find((b) => b.id === c.from.split(':')[0]).type].outputs.indexOf(c.from.split(':')[1])];
    return `<g class="sdr-wire${rate?.complex ? ' complex' : ''}${selected === `wire:${index}` ? ' selected' : ''}"><path d="${d}"/><path class="hit" d="${d}" data-sdr-wire="${index}"><title>${rate ? `${eng(rate.rate, 'S/s')}, ${rate.length} samples, ${rate.complex ? 'complex' : 'real'} — click to select` : ''}</title></path></g>`;
  }).join('');
  const nodes = blocks.map((b) => {
    const def = BLOCKS[b.type], h = sdrBlockHeight(def), error = run.errors[b.id], params = blockParams(b);
    const summary = def.params.slice(0, 2).map((param) => `${param.label.split(' ')[0]} ${typeof params[param.key] === 'number' ? fmt(params[param.key], 4) : params[param.key]}`).join(' · ');
    return `<g class="sdr-block cat-${def.category.toLowerCase()}${selected === b.id ? ' selected' : ''}${error ? ' error' : ''}" transform="translate(${b.x} ${b.y})" data-sdr-block="${esc(b.id)}">
      <rect class="body" width="${SDR_BLOCK_WIDTH}" height="${h}" rx="6"/><text class="title" x="8" y="15">${esc(def.label)}</text><text class="sub" x="8" y="27">${esc(summary.slice(0, 30))}</text>
      ${def.inputs.map((port, i) => `<circle class="port in" cx="0" cy="${sdrPortY(i)}" r="6" data-sdr-in="${esc(b.id)}:${port}"/><text class="port-label" x="9" y="${sdrPortY(i) + 3}">${port}</text>`).join('')}
      ${def.outputs.map((port, i) => `<circle class="port out" cx="${SDR_BLOCK_WIDTH}" cy="${sdrPortY(i)}" r="6" data-sdr-out="${esc(b.id)}:${port}"/><text class="port-label" x="${SDR_BLOCK_WIDTH - 9}" y="${sdrPortY(i) + 3}" text-anchor="end">${port}</text>`).join('')}
      ${error ? `<title>${esc(error)}</title>` : ''}</g>`;
  }).join('');
  return `<div class="sdr-canvas-wrap"><svg class="sdr-canvas" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-sdr-canvas>${wires}${nodes}</svg></div>`;
}
function renderSdrSink(id, block, sink) {
  const title = `${BLOCKS[block.type].label} — ${block.id}`;
  if (sink.kind === 'time') return linePlot(title, sink.t, [{ name: 'real', values: sink.re }, ...(sink.im ? [{ name: 'imag', values: sink.im }] : [])], { xLabel: (x) => eng(x, 's') });
  if (sink.kind === 'spectrum') return linePlot(`${title} (dB)`, sink.frequency, [{ name: 'power', values: sink.db.map((v) => Math.max(v, -120)) }], { xLabel: (x) => eng(x, 'Hz') });
  if (sink.kind === 'constellation') {
    const size = 220, extent = Math.max(1.5, ...sink.re.map(Math.abs), ...sink.im.map(Math.abs)) * 1.1, s = size / 2 / extent;
    return `<div class="sdr-const"><span class="panel-label">${esc(title)}</span><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><path class="axis" d="M${size / 2} 0V${size}M0 ${size / 2}H${size}"/>${sink.re.map((x, i) => `<circle cx="${(size / 2 + x * s).toFixed(1)}" cy="${(size / 2 - sink.im[i] * s).toFixed(1)}" r="1.6"/>`).join('')}</svg></div>`;
  }
  if (sink.kind === 'numbers') return `<div class="analysis-readouts sdr-numbers"><span class="panel-label">${esc(title)}</span>${readout('Mean', sink.meanIm === null ? fmt(sink.mean, 5) : `${fmt(sink.mean, 5)} ${sink.meanIm < 0 ? '−' : '+'} j${fmt(Math.abs(sink.meanIm), 5)}`)}${readout('RMS', fmt(sink.rms, 5))}${readout('Power', `${fmt(sink.powerDb, 4)} dB`)}${readout('Peak', fmt(sink.peak, 5))}${readout('Rate', `${eng(sink.rate, 'S/s')}, ${sink.samples} samples`)}</div>`;
  return `<div class="analysis-readouts sdr-numbers"><span class="panel-label">${esc(title)}</span>${readout('Symbol errors', `${sink.errors} of ${sink.compared} (SER ${sink.ser.toExponential(3)})`)}${readout('Bit errors (Gray map)', `${sink.bitErrors} (BER ${sink.ber.toExponential(3)})`)}${readout('Alignment delay found', `${sink.lag} symbols`)}</div>`;
}
export function renderSdr(state) {
  const config = sdrLab.configuration(state).editor;
  const graph = config.graph, run = sdrRun(graph);
  const selectedBlock = graph.blocks.find((b) => b.id === config.selected);
  const categories = [...new Set(Object.values(BLOCKS).map((def) => def.category))];
  const palette = `<label>Add block<select data-sdr-add><option value="">choose…</option>${categories.map((cat) => `<optgroup label="${cat}">${Object.entries(BLOCKS).filter(([, def]) => def.category === cat).map(([type, def]) => `<option value="${type}">${esc(def.label)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  const controls = `<label>Example<select data-sdr-example>${Object.entries(SDR_EXAMPLES).map(([id, ex]) => `<option value="${id}" ${config.example === id ? 'selected' : ''}>${esc(ex.label)}</option>`).join('')}<option value="custom" ${config.example === 'custom' ? 'selected' : ''}>Custom (your edits)</option></select></label>${palette}<label>Sample rate<input type="text" data-sdr-setting="sampleRate" value="${esc(numericText(graph.sampleRate ?? 48000))}"><span>S/s</span></label><label>Samples<input type="text" data-sdr-setting="samples" value="${esc(numericText(graph.samples ?? 8192))}"></label>${config.selected ? '<button class="button" data-sdr-delete>Delete selected</button>' : ''}`;
  const paramPanel = selectedBlock ? (() => {
    const def = BLOCKS[selectedBlock.type], params = blockParams(selectedBlock), rates = run.rates[selectedBlock.id];
    return `<div class="sdr-params"><span class="panel-label">${esc(def.label.toUpperCase())} — ${esc(selectedBlock.id)}</span><div class="dsp-controls">${def.params.map((param) => param.options ? `<label>${esc(param.label)}<select data-sdr-param="${param.key}">${param.options.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(params[param.key]) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>` : `<label>${esc(param.label)}<input type="text" data-sdr-param="${param.key}" value="${esc(numericText(params[param.key]))}">${param.unit ? `<span>${param.unit}</span>` : ''}</label>`).join('') || '<p class="field-help">This block has no parameters.</p>'}</div>${run.errors[selectedBlock.id] ? `<div class="diagnostic error"><b>${esc(selectedBlock.id)}</b><span>${esc(run.errors[selectedBlock.id])}</span></div>` : ''}${rates ? `<p class="field-help">Output: ${rates.map((r) => `${eng(r.rate, 'S/s')}, ${r.length} ${r.complex ? 'complex' : 'real'} samples`).join('; ')}</p>` : ''}</div>`;
  })() : '<p class="field-help">Click a block to edit its parameters. Drag blocks by their body. To connect, click an output port (right) and then an input port (left); click a wire and press Delete selected to remove it. Blue wires carry complex (I/Q) samples.</p>';
  const sinks = graph.blocks.filter((b) => run.sinks[b.id]).map((b) => `<div class="sdr-sink">${renderSdrSink(b.id, b, run.sinks[b.id])}</div>`).join('');
  const errorCount = Object.keys(run.errors).length;
  return `<div class="page scroll-page power-page sigsys-page sdr-page">${pageHeader(modules.find((item) => item.id === 'sdr'), 'SDR FLOWGRAPH', `<span class="pill ${errorCount || run.fatal ? '' : 'live'}"><i></i> ${run.fatal ? 'NOT RUNNABLE' : errorCount ? `${errorCount} BLOCK ERROR${errorCount > 1 ? 'S' : ''}` : 'RUNS OFFLINE'}</span>`)}
    <div class="dsp-card"><div class="dsp-controls">${controls}</div>${run.fatal ? `<div class="diagnostic error"><b>Flowgraph</b><span>${esc(run.fatal)}</span></div>` : ''}${renderSdrCanvas(graph, run, config.selected)}${paramPanel}</div>
    <div class="sdr-sinks">${sinks || '<p class="field-help">Add a sink block (scope, FFT, constellation, measurement or error counter) to see results.</p>'}</div></div>`;
}
export function bindSdrEvents() {
  const svg = document.querySelector('[data-sdr-canvas]');
  if (!svg) return;
  const update = (fn) => sdrLab.persist((config) => { fn(config.editor); });
  const edit = (fn) => update((editor) => { fn(editor.graph); editor.example = 'custom'; });
  const toSvg = (event) => { const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform(svg.getScreenCTM().inverse()); };
  document.querySelector('[data-sdr-example]')?.addEventListener('change', (event) => { if (event.target.value !== 'custom') update((editor) => { editor.graph = exampleGraph(event.target.value); editor.example = event.target.value; editor.selected = null; }); });
  document.querySelector('[data-sdr-add]')?.addEventListener('change', (event) => {
    const type = event.target.value; if (!type) return;
    update((editor) => {
      const graph = editor.graph, prefix = type.split('-')[0];
      let k = 1; while (graph.blocks.some((b) => b.id === `${prefix}${k}`)) k += 1;
      const bottom = Math.max(0, ...graph.blocks.map((b) => b.y + sdrBlockHeight(BLOCKS[b.type])));
      graph.blocks.push({ id: `${prefix}${k}`, type, x: 20, y: bottom + 30, params: {} });
      editor.selected = `${prefix}${k}`; editor.example = 'custom';
    });
  });
  document.querySelector('[data-sdr-delete]')?.addEventListener('click', () => update((editor) => {
    const selected = editor.selected;
    if (selected?.startsWith('wire:')) editor.graph.connections.splice(Number(selected.slice(5)), 1);
    else if (selected) { editor.graph.blocks = editor.graph.blocks.filter((b) => b.id !== selected); editor.graph.connections = editor.graph.connections.filter((c) => c.from.split(':')[0] !== selected && c.to.split(':')[0] !== selected); }
    editor.selected = null; editor.example = 'custom';
  }));
  document.querySelectorAll('[data-sdr-param]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.sdrParam;
    let value = input.value;
    if (input.tagName === 'INPUT') { try { value = engineeringInput(input.value, 'Value'); } catch (error) { notify(error.message, 'error'); return; } }
    else if (value !== '' && !Number.isNaN(Number(value))) value = Number(value);
    edit((graph) => { const block = graph.blocks.find((b) => b.id === sdrLab.configuration(getState()).editor.selected); if (block) block.params = { ...block.params, [key]: value }; });
  }));
  document.querySelectorAll('[data-sdr-wire]').forEach((path) => path.addEventListener('click', () => update((editor) => { editor.selected = `wire:${path.dataset.sdrWire}`; })));
  document.querySelectorAll('[data-sdr-out]').forEach((port) => port.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    sdrPending = port.dataset.sdrOut;
    document.querySelectorAll('.port.out.pending').forEach((p) => p.classList.remove('pending'));
    port.classList.add('pending');
  }));
  document.querySelectorAll('[data-sdr-in]').forEach((port) => port.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    if (!sdrPending) { notify('Click an output port first, then this input.', 'info'); return; }
    const from = sdrPending, to = port.dataset.sdrIn;
    sdrPending = null;
    if (from.split(':')[0] === to.split(':')[0]) return;
    edit((graph) => { graph.connections = graph.connections.filter((c) => c.to !== to); graph.connections.push({ from, to }); });
  }));
  document.querySelectorAll('[data-sdr-block]').forEach((group) => group.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.port')) return;
    const id = group.dataset.sdrBlock, start = toSvg(event), block = sdrLab.configuration(getState()).editor.graph.blocks.find((b) => b.id === id);
    const origin = { x: block.x, y: block.y };
    let moved = false;
    group.setPointerCapture(event.pointerId);
    const move = (e) => { const p = toSvg(e), dx = p.x - start.x, dy = p.y - start.y; if (Math.hypot(dx, dy) > 3) moved = true; group.setAttribute('transform', `translate(${Math.max(0, origin.x + dx)} ${Math.max(0, origin.y + dy)})`); };
    const up = (e) => {
      group.removeEventListener('pointermove', move); group.removeEventListener('pointerup', up);
      const p = toSvg(e);
      if (moved) update((editor) => { const b = editor.graph.blocks.find((x) => x.id === id); b.x = Math.round(Math.max(0, origin.x + p.x - start.x)); b.y = Math.round(Math.max(0, origin.y + p.y - start.y)); editor.selected = id; });
      else update((editor) => { editor.selected = id; });
    };
    group.addEventListener('pointermove', move); group.addEventListener('pointerup', up);
  }));
}

// ---------------------------------------------------------------------------
// Digital image processing.


// ---------------------------------------------------------------------------
// Biomedical signal processing.
