// Lab Bench workspace: oscilloscope, function generator, bench supply and multimeter on the
// Circuit Lab circuit. Entry points: renderBench(state), bindBenchEvents(). benchCompute,
// benchConfiguration and benchScope are exported for Lab Records (captures and measurements).
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, setState, updateProject } from '../../core/store.js';
import { simulateDC, simulateTransient } from '../../engines/circuit-engine.js';
import { exampleCircuits } from '../../data/example-circuits.js';
import { formatEngineeringValue } from '../../../packages/schematic/src/units.mjs';
import { applyGenerator, applySupplies, diodeTest, dmmDisplay, findTrigger, GENERATOR_SHAPES, measure, measureResistance, phaseDifference, screenTrace, valueAt } from '../../../packages/instruments/src/index.mjs';
import { capitalize, eng, fmt } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { reportError } from '../../services/errors.js';

const BENCH_DEFAULTS = Object.freeze({
  generator: { enabled: true, sourceId: '', shape: 'sine', frequency: 1000, vpp: 2, offset: 0, duty: 0.5, impedance: 'high-z' },
  supplies: [{ sourceId: '', voltage: 5, currentLimit: 0.5, enabled: true }, { sourceId: '', voltage: 12, currentLimit: 0.5, enabled: true }],
  scope: { channels: [{ node: '', vdiv: 1, position: 0, coupling: 'dc', on: true }, { node: '', vdiv: 1, position: 0, coupling: 'dc', on: true }], tdiv: 0.0002, startAfter: 0, trigger: { source: 0, level: 0, slope: 'rising', mode: 'auto' }, cursors: { on: false, a: 25, b: 75 } },
  dmm: { mode: 'dcv', red: '', black: '0', part: '' },
});
const BENCH_EXAMPLES = Object.freeze([
  { id: 'rc-lowpass', name: 'RC low-pass at its corner (gain −3 dB, phase −45°)', bench: { generator: { sourceId: 'V1', shape: 'sine', frequency: 159.15, vpp: 2 }, channels: ['in', 'out'], vdiv: [0.5, 0.5], tdiv: 0.001, startAfter: 0.01, dmm: { mode: 'acv', red: 'out', black: '0' } } },
  { id: 'half-wave-rectifier', name: 'Half-wave rectifier with filter capacitor (ripple)', bench: { generator: { sourceId: 'V1', shape: 'sine', frequency: 50, vpp: 20 }, channels: ['in', 'out'], vdiv: [5, 5], tdiv: 0.005, startAfter: 0.04, dmm: { mode: 'dcv', red: 'out', black: '0' } } },
  { id: 'inverting-opamp', name: 'Inverting op-amp, gain −10 (180° phase shift)', bench: { generator: { sourceId: 'V1', shape: 'sine', frequency: 1000, vpp: 1 }, channels: ['in', 'out'], vdiv: [0.5, 5], tdiv: 0.0002, startAfter: 0, dmm: { mode: 'acv', red: 'out', black: '0' } } },
  { id: 'rlc-step', name: 'Series RLC: square-wave ringing', bench: { generator: { sourceId: 'V1', shape: 'square', frequency: 100, vpp: 5, offset: 2.5 }, channels: ['in', 'out'], vdiv: [2, 2], tdiv: 0.001, startAfter: 0, dmm: { mode: 'dcv', red: 'out', black: '0' } } },
  { id: 'ce-amplifier', name: 'BJT common-emitter amplifier (12 V supply)', bench: { generator: { sourceId: 'VS', shape: 'sine', frequency: 1000, vpp: 0.02 }, supply: { sourceId: 'VCC', voltage: 12, currentLimit: 0.1 }, channels: ['s', 'c'], vdiv: [0.01, 0.5], couplings: ['dc', 'ac'], tdiv: 0.0002, startAfter: 0, dmm: { mode: 'dca', part: 'RC' } } },
]);
const SCOPE_VDIV = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const SCOPE_TDIV = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
const DMM_MODES = [['dcv', 'V⎓ DC volts'], ['acv', 'V~ AC volts (true RMS)'], ['dca', 'A⎓ DC amps'], ['aca', 'A~ AC amps'], ['ohm', 'Ω resistance'], ['diode', '→|— diode test'], ['continuity', '•))) continuity']];
const SCOPE_COLORS = ['#facc15', '#22d3ee'];
let benchCache = { key: null, value: null };
export function benchConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'bench-lab')?.inputs || {};
  const merged = structuredClone(BENCH_DEFAULTS);
  if (saved.generator) Object.assign(merged.generator, saved.generator);
  if (Array.isArray(saved.supplies)) saved.supplies.slice(0, 2).forEach((entry, index) => Object.assign(merged.supplies[index], entry));
  if (saved.scope) {
    const { channels, trigger, cursors, ...rest } = saved.scope;
    Object.assign(merged.scope, rest);
    if (Array.isArray(channels)) channels.slice(0, 2).forEach((entry, index) => Object.assign(merged.scope.channels[index], entry));
    if (trigger) Object.assign(merged.scope.trigger, trigger);
    if (cursors) Object.assign(merged.scope.cursors, cursors);
  }
  if (saved.dmm) Object.assign(merged.dmm, saved.dmm);
  return merged;
}
function persistBench(update) {
  const config = benchConfiguration(getState());
  update(config);
  recordExperiment({ id: 'bench-lab', kind: 'instrument', operation: 'bench-lab', inputs: config });
}
/** Set a dotted path such as "scope.channels.1.vdiv" in the bench configuration. */
function setBenchPath(path, value) {
  persistBench((config) => {
    const keys = path.split('.');
    let target = config;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys.at(-1)] = value;
  });
}
function loadBenchExample(id) {
  const entry = BENCH_EXAMPLES.find((example) => example.id === id);
  const circuit = exampleCircuits.find((example) => example.id === id);
  if (!entry || !circuit) return;
  updateProject((project) => { project.circuit.components = structuredClone(circuit.components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  const { generator, supply, channels, vdiv, couplings = ['dc', 'dc'], tdiv, startAfter, dmm } = entry.bench;
  persistBench((config) => {
    config.generator = { ...BENCH_DEFAULTS.generator, enabled: true, offset: 0, ...generator };
    config.supplies = structuredClone(BENCH_DEFAULTS.supplies);
    if (supply) Object.assign(config.supplies[0], supply);
    config.scope.channels = channels.map((node, index) => ({ node, vdiv: vdiv[index], position: 0, coupling: couplings[index], on: true }));
    config.scope.tdiv = tdiv; config.scope.startAfter = startAfter;
    config.scope.trigger = { source: 0, level: generator.offset ?? 0, slope: 'rising', mode: 'auto' };
    config.dmm = { ...BENCH_DEFAULTS.dmm, ...dmm };
  });
  setState({ simulation: null });
  notify(`${circuit.name} is on the bench.`, 'success');
}
/** Run the bench: supplies (CV/CC), generator, one transient record and the DC operating point. */
export function benchCompute(state, config) {
  const { components, wires, netLabels } = state.project.circuit;
  const key = JSON.stringify([components, wires, netLabels, config.generator, config.supplies, config.scope.tdiv, config.scope.startAfter]);
  if (benchCache.key === key) return benchCache.value;
  let value;
  try {
    const voltageSources = components.filter((part) => part.type === 'voltage');
    const generator = config.generator;
    const generatorSource = voltageSources.find((part) => part.id === generator.sourceId);
    const channels = config.supplies.filter((channel) => channel.sourceId && channel.sourceId !== generator.sourceId && voltageSources.some((part) => part.id === channel.sourceId));
    const supplied = applySupplies(simulateDC, components, wires, netLabels, channels);
    let parts = supplied.components, stimulus;
    const driving = generatorSource && generator.enabled;
    if (driving) ({ components: parts, stimulus } = applyGenerator(parts, generator));
    else {
      if (generatorSource) parts = parts.map((part) => (part.id === generatorSource.id ? { ...part, value: 0 } : part)); // output off
      const first = parts.find((part) => part.type === 'voltage' || part.type === 'current');
      stimulus = { sourceId: first?.id, shape: 'dc' };
    }
    const span = 10 * config.scope.tdiv;
    const stop = config.scope.startAfter + 2 * span;
    const timeStep = Math.max(span / 1000, stop / 19_000);
    const run = simulateTransient(parts, wires, netLabels, { stopTime: stop, timeStep, stimulus });
    const dc = driving ? null : simulateDC(parts, wires, netLabels);
    value = { run, dc, status: supplied.status, driving, span, timeStep, parts };
  } catch (error) { value = { error: error.message }; }
  benchCache = { key, value };
  return value;
}
/** The record after the run-in time, as plain arrays (for measurements and the DMM). */
function benchRecord(run, startAfter, values) {
  const first = Math.max(0, run.time.findIndex((t) => t >= startAfter));
  return { time: run.time.slice(first), values: values.slice(first) };
}
function benchTrace(run, channel) {
  const values = run.nodes[channel.node];
  if (!values) return null;
  if (channel.coupling !== 'ac') return values;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.map((v) => v - mean);
}
const benchSi = (value) => formatEngineeringValue(value, '', { digits: 4 }).trim();
const benchField = (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" data-bench-field="${path}" value="${esc(benchSi(value))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const benchSelect = (path, label, value, options) => labSelect('data-bench-select', path, label, value, options);
const benchToggle = (path, label, on) => `<button class="tool ${on ? 'active' : ''}" data-bench-toggle="${path}" aria-pressed="${on}">${label}</button>`;
function renderScopeScreen(view) {
  const width = 500, height = 400, div = 50;
  const grid = [];
  for (let k = 0; k <= 10; k += 1) grid.push(`<line x1="${k * div}" x2="${k * div}" y1="0" y2="${height}"${k === 5 ? ' class="axis"' : ''}/>`);
  for (let k = 0; k <= 8; k += 1) grid.push(`<line y1="${k * div}" y2="${k * div}" x1="0" x2="${width}"${k === 4 ? ' class="axis"' : ''}/>`);
  const ticks = [];
  for (let k = 0; k <= 50; k += 1) ticks.push(`<line x1="${k * 10}" x2="${k * 10}" y1="${height / 2 - 3}" y2="${height / 2 + 3}"/>`);
  for (let k = 0; k <= 40; k += 1) ticks.push(`<line y1="${k * 10}" y2="${k * 10}" x1="${width / 2 - 3}" x2="${width / 2 + 3}"/>`);
  const yOf = (channel, v) => height / 2 - (v / channel.vdiv + Number(channel.position)) * div;
  const traces = view.traces.map((trace) => {
    if (!trace.points) return '';
    const d = trace.points.map((p, index) => `${index ? 'L' : 'M'}${((p.t - view.start) / view.span * width).toFixed(1)} ${Math.max(-20, Math.min(height + 20, yOf(trace.channel, p.v))).toFixed(1)}`).join('');
    const ground = Math.max(4, Math.min(height - 4, yOf(trace.channel, 0)));
    return `<path class="scope-trace" stroke="${trace.color}" d="${d}"/><path class="scope-marker" fill="${trace.color}" d="M0 ${ground - 6}L9 ${ground}L0 ${ground + 6}Z"/><text x="12" y="${ground + 4}" fill="${trace.color}" class="scope-marker-text">${trace.index + 1}</text>`;
  }).join('');
  const trig = view.triggerChannel ? `<path class="scope-marker" fill="${view.triggerColor}" d="M${width} ${yOf(view.triggerChannel, view.triggerLevel) - 6}L${width - 9} ${yOf(view.triggerChannel, view.triggerLevel)}L${width} ${yOf(view.triggerChannel, view.triggerLevel) + 6}Z"/>${view.triggered ? `<path class="scope-marker" fill="#f97316" d="M${((view.triggerTime - view.start) / view.span * width).toFixed(1)} 0l-6 -0l6 9l6 -9Z"/>` : ''}` : '';
  const cursors = view.cursors ? view.cursors.map((c, index) => `<line class="scope-cursor" x1="${c * width / 100}" x2="${c * width / 100}" y1="0" y2="${height}"/><text class="scope-cursor-text" x="${c * width / 100 + 3}" y="${12 + index * 12}">${index ? 'B' : 'A'}</text>`).join('') : '';
  return `<svg class="scope-screen" viewBox="0 0 ${width} ${height}" role="img" aria-label="Oscilloscope screen"><defs><clipPath id="scopeClip"><rect width="${width}" height="${height}"/></clipPath></defs><rect class="scope-bg" width="${width}" height="${height}"/><g class="scope-grid">${grid.join('')}${ticks.join('')}</g><g clip-path="url(#scopeClip)">${traces}${cursors}</g>${trig}</svg>`;
}
/** Trigger the captured record and measure both channels (shared by the bench and lab records). */
export function benchScope(config, result) {
  const { run, span } = result;
  const nodes = Object.keys(run.nodes).filter((name) => !name.startsWith('__'));
  const scope = config.scope;
  const channels = scope.channels.map((channel) => ({ ...channel, node: nodes.includes(channel.node) ? channel.node : '' }));
  const traceValues = channels.map((channel) => (channel.on && channel.node ? benchTrace(run, channel) : null));
  const trigger = scope.trigger;
  const triggerIndex = traceValues[trigger.source] ? trigger.source : traceValues.findIndex(Boolean);
  let start = scope.startAfter, triggered = false, triggerTime = null;
  if (triggerIndex >= 0) {
    const t = findTrigger(run.time, traceValues[triggerIndex], { level: Number(trigger.level), slope: trigger.slope, from: scope.startAfter + span / 2, hysteresis: channels[triggerIndex].vdiv * 0.05 });
    if (t !== null && t <= scope.startAfter + 1.5 * span) { triggered = true; triggerTime = t; start = t - span / 2; }
  }
  const showTraces = triggered || trigger.mode === 'auto';
  // Measured over the whole record after the run-in (two screens), so even a screen with less than
  // two periods gets a frequency, a whole-period mean/RMS and a phase.
  const measurements = traceValues.map((values) => { if (!values || !showTraces) return null; const r = benchRecord(run, scope.startAfter, values); return r.time.length > 2 ? { ...measure(r.time, r.values), window: { time: r.time, v: r.values } } : null; });
  return { nodes, channels, traceValues, trigger, triggerIndex, start, triggered, triggerTime, showTraces, measurements };
}
export function renderBench(state) {
  const config = benchConfiguration(state);
  const parts = state.project.circuit.components;
  const header = pageHeader(modules.find((item) => item.id === 'bench'), 'VIRTUAL LAB BENCH', `<label class="bench-example">Put an example on the bench<select data-bench-example><option value="">Choose…</option>${BENCH_EXAMPLES.map((example) => `<option value="${example.id}">${esc(example.name)}</option>`).join('')}</select></label><button class="button ghost" data-module="circuit">Edit circuit in Circuit Lab</button>`);
  const voltageSources = parts.filter((part) => part.type === 'voltage');
  if (!voltageSources.length && !parts.some((part) => part.type === 'current')) {
    return `<div class="page scroll-page bench-page">${header}<div class="console-empty"><span>⏚</span><p>The bench measures the circuit drawn in Circuit Lab. Draw one with at least one source, or put an example on the bench above.</p></div></div>`;
  }
  const result = benchCompute(state, config);
  const sourceOptions = [['', '— not connected —'], ...voltageSources.map((part) => [part.id, `${part.label} (${part.n1} → ${part.n2})`])];
  const g = config.generator;
  const generator = `<div class="coding-block bench-instrument"><span class="panel-label">FUNCTION GENERATOR</span>
    <div class="dsp-controls">${benchSelect('generator.sourceId', 'Output drives', g.sourceId, sourceOptions)}${benchSelect('generator.shape', 'Waveform', g.shape, GENERATOR_SHAPES.map((shape) => [shape, shape === 'dc' ? 'DC (offset only)' : capitalize(shape)]))}
    ${benchField('generator.frequency', 'Frequency', g.frequency, 'Hz')}${benchField('generator.vpp', g.shape === 'pulse' ? 'High level' : 'Amplitude', g.vpp, g.shape === 'pulse' ? 'V' : 'Vpp')}${benchField('generator.offset', 'Offset', g.offset, 'V')}${['square', 'pulse'].includes(g.shape) ? benchField('generator.duty', 'Duty', g.duty * 100, '%') : ''}
    ${benchSelect('generator.impedance', 'Output impedance', g.impedance, [['high-z', 'High-Z (ideal)'], ['50', '50 Ω']])}</div>
    <div class="bench-buttons">${benchToggle('generator.enabled', g.enabled ? 'Output ON' : 'Output OFF', g.enabled)}</div>
    <p class="field-help">Amplitude is peak-to-peak into an open circuit; with 50 Ω output the internal resistor is in series, so a 50 Ω load sees half.</p></div>`;
  const supplyRows = config.supplies.map((channel, index) => {
    const status = result.status?.find((entry) => entry.sourceId === channel.sourceId && channel.sourceId !== g.sourceId);
    const display = status ? `<div class="supply-display"><b>${esc(fmt(status.volts || 0, 3))}<small> V</small></b><b>${esc(fmt((status.amps * (Math.abs(status.amps) < 1 ? 1000 : 1)) || 0, 3))}<small> ${Math.abs(status.amps) < 1 ? 'mA' : 'A'}</small></b><i class="mode ${status.mode.toLowerCase()}">${status.mode}</i></div>` : '<div class="supply-display idle"><b>— — —</b></div>';
    return `<div class="supply-channel"><span class="panel-label">CH${index + 1}</span>${display}<div class="dsp-controls">${benchSelect(`supplies.${index}.sourceId`, 'Replaces source', channel.sourceId, sourceOptions)}${benchField(`supplies.${index}.voltage`, 'Set voltage', channel.voltage, 'V')}${benchField(`supplies.${index}.currentLimit`, 'Current limit', channel.currentLimit, 'A')}</div>${benchToggle(`supplies.${index}.enabled`, channel.enabled ? 'ON' : 'OFF', channel.enabled)}</div>`;
  }).join('');
  const supply = `<div class="coding-block bench-instrument"><span class="panel-label">DC POWER SUPPLY · CV/CC</span><div class="supply-grid">${supplyRows}</div><p class="field-help">A channel holds its set voltage (CV) until the load draws more than the limit, then holds the limit current (CC) and the voltage drops — as on a real bench supply.</p></div>`;
  if (result.error) return `<div class="page scroll-page bench-page">${header}<div class="bench-grid">${generator}${supply}</div><div class="diagnostic error"><b>Bench</b><span>${esc(result.error)}</span></div></div>`;

  // Oscilloscope.
  const { run, span } = result;
  const scope = config.scope;
  const { nodes, channels, traceValues, trigger, triggerIndex, start, triggered, triggerTime, showTraces, measurements } = benchScope(config, result);
  const view = {
    start, span, triggered, triggerTime,
    triggerChannel: triggerIndex >= 0 ? channels[triggerIndex] : null, triggerLevel: Number(trigger.level), triggerColor: SCOPE_COLORS[Math.max(0, triggerIndex)],
    traces: channels.map((channel, index) => ({ index, channel, color: SCOPE_COLORS[index], points: showTraces && traceValues[index] ? screenTrace(run.time, traceValues[index], start, span, 500) : null })),
    cursors: scope.cursors.on ? [Number(scope.cursors.a), Number(scope.cursors.b)] : null,
  };
  const channelReadouts = measurements.map((m, index) => (m ? `<div class="scope-measure" style="--chip:${SCOPE_COLORS[index]}"><b>CH${index + 1} · ${esc(channels[index].node)}</b>${readout('Vpp', eng(m.pp, 'V'))}${readout('Vmax / Vmin', `${eng(m.max, 'V')} / ${eng(m.min, 'V')}`)}${readout('Mean', eng(Math.abs(m.mean) < m.pp * 1e-6 ? 0 : m.mean, 'V'))}${readout('RMS (AC)', eng(m.acRms, 'V'))}${readout('Frequency', m.frequency ? eng(m.frequency, 'Hz') : '—')}${readout('Period', m.period ? eng(m.period, 's') : '—')}${readout('Duty', m.duty === null ? '—' : `${fmt(m.duty * 100, 3)} %`)}${readout('Rise 10–90 %', m.riseTime === null ? '—' : eng(m.riseTime, 's'))}</div>` : '')).join('');
  let comparison = '';
  if (measurements[0] && measurements[1]) {
    const phase = phaseDifference(measurements[0].window.time, measurements[0].window.v, measurements[1].window.v);
    const gain = measurements[0].pp > 0 ? measurements[1].pp / measurements[0].pp : null;
    comparison = `<div class="scope-measure" style="--chip:#a78bfa"><b>CH2 vs CH1</b>${readout('Gain Vpp2/Vpp1', gain === null ? '—' : `${fmt(gain, 4)} (${fmt(20 * Math.log10(gain), 3)} dB)`)}${readout('Phase', phase === null ? '—' : `${fmt(phase, 3)}°`)}</div>`;
  }
  let cursorReadout = '';
  if (view.cursors) {
    const [ta, tb] = view.cursors.map((c) => start + c / 100 * span);
    const dt = tb - ta;
    cursorReadout = `<div class="scope-measure" style="--chip:#f97316"><b>Cursors</b>${readout('ΔT', eng(dt, 's'))}${readout('1/ΔT', dt ? eng(1 / Math.abs(dt), 'Hz') : '—')}${traceValues.map((values, index) => (values ? readout(`CH${index + 1} at A / B`, `${eng(valueAt(run.time, values, ta), 'V')} / ${eng(valueAt(run.time, values, tb), 'V')}`) : '')).join('')}</div>`;
  }
  const nodeOptions = [['', '— off —'], ...nodes.filter((name) => name !== '0').map((name) => [name, name])];
  const channelControls = channels.map((channel, index) => `<div class="scope-channel" style="--chip:${SCOPE_COLORS[index]}"><span class="panel-label">CH${index + 1}</span><div class="dsp-controls">${benchSelect(`scope.channels.${index}.node`, 'Probe node', channel.node, nodeOptions)}${benchSelect(`scope.channels.${index}.vdiv`, 'Volts/div', channel.vdiv, SCOPE_VDIV.map((v) => [v, eng(v, 'V')]))}${benchField(`scope.channels.${index}.position`, 'Position', channel.position, 'div')}${benchSelect(`scope.channels.${index}.coupling`, 'Coupling', channel.coupling, [['dc', 'DC'], ['ac', 'AC']])}</div>${benchToggle(`scope.channels.${index}.on`, channel.on ? 'Shown' : 'Hidden', channel.on)}</div>`).join('');
  const status = triggered ? `<span class="pill live"><i></i> TRIG'D</span>` : trigger.mode === 'auto' ? '<span class="pill">AUTO · untriggered</span>' : '<span class="pill">WAITING FOR TRIGGER</span>';
  const scopeBlock = `<div class="coding-block bench-instrument scope-instrument"><span class="panel-label">OSCILLOSCOPE · 2 CHANNEL</span>
    <div class="scope-layout"><div class="scope-display"><div class="scope-status">${status}<span>${eng(scope.tdiv, 's')}/div</span>${channels.map((channel, index) => (channel.node && channel.on ? `<span style="color:${SCOPE_COLORS[index]}">CH${index + 1} ${eng(channel.vdiv, 'V')}/div ${channel.coupling.toUpperCase()}</span>` : '')).join('')}</div>${renderScopeScreen(view)}
    ${scope.cursors.on ? `<div class="scope-cursor-controls"><label>Cursor A<input type="range" min="0" max="100" step="0.5" value="${scope.cursors.a}" data-bench-range="scope.cursors.a"></label><label>Cursor B<input type="range" min="0" max="100" step="0.5" value="${scope.cursors.b}" data-bench-range="scope.cursors.b"></label></div>` : ''}</div>
    <div class="scope-controls">${channelControls}<div class="scope-channel"><span class="panel-label">HORIZONTAL & TRIGGER</span><div class="dsp-controls">${benchSelect('scope.tdiv', 'Time/div', scope.tdiv, SCOPE_TDIV.map((v) => [v, eng(v, 's')]))}${benchField('scope.startAfter', 'Run-in before capture', scope.startAfter, 's')}${benchSelect('scope.trigger.source', 'Trigger source', trigger.source, [[0, 'CH1'], [1, 'CH2']])}${benchField('scope.trigger.level', 'Trigger level', trigger.level, 'V')}${benchSelect('scope.trigger.slope', 'Slope', trigger.slope, [['rising', 'Rising ↑'], ['falling', 'Falling ↓']])}${benchSelect('scope.trigger.mode', 'Mode', trigger.mode, [['auto', 'Auto'], ['normal', 'Normal']])}</div>
    <div class="bench-buttons"><button class="button run" data-action="bench-autoset">Auto-set</button>${benchToggle('scope.cursors.on', 'Cursors', scope.cursors.on)}<button class="tool" data-action="bench-export-csv">Export CSV</button></div></div></div></div>
    <div class="scope-measurements">${channelReadouts}${comparison}${cursorReadout}</div>
    <p class="field-help">${run.time.length.toLocaleString()} solver points, step ${esc(eng(result.timeStep, 's'))}. The record starts after the run-in time so capacitors can reach steady state; the trigger point is the centre of the screen.</p></div>`;

  // Multimeter.
  const dmm = config.dmm;
  const red = nodes.includes(dmm.red) ? dmm.red : '', black = nodes.includes(dmm.black) ? dmm.black : '0';
  const partOptions = [['', '— choose —'], ...parts.filter((part) => part.type !== 'ground').map((part) => [part.id, `${part.label} (${part.type})`])];
  let reading = { text: '— — —' }, note = '';
  try {
    const record = (values) => benchRecord(run, scope.startAfter, values);
    if (['dcv', 'acv'].includes(dmm.mode)) {
      if (!red) note = 'Choose the red probe node.';
      else {
        const diff = run.nodes[red].map((v, k) => v - run.nodes[black][k]);
        const r = record(diff);
        const m = r.time.length > 2 ? measure(r.time, r.values) : null;
        const dcValue = result.dc ? (result.dc.nodes[red] ?? 0) - (result.dc.nodes[black] ?? 0) : m?.mean ?? 0;
        reading = dmmDisplay(dmm.mode === 'dcv' ? dcValue : result.dc ? 0 : m?.acRms ?? 0, 'V');
        note = `${dmm.mode === 'dcv' ? 'Average' : 'True-RMS of the AC part'} of V(${red}) − V(${black}).`;
      }
    } else if (['dca', 'aca'].includes(dmm.mode)) {
      const current = run.currents[dmm.part];
      if (!current) note = 'Choose the component the meter is in series with.';
      else {
        const r = record(current);
        const m = r.time.length > 2 ? measure(r.time, r.values) : null;
        const dcValue = result.dc ? result.dc.currents[dmm.part] : m?.mean ?? 0;
        reading = dmmDisplay(dmm.mode === 'dca' ? dcValue : result.dc ? 0 : m?.acRms ?? 0, 'A');
        note = `Current through ${dmm.part} (positive from its first to its second terminal).`;
      }
    } else if (!red) note = 'Choose the red probe node.';
    else {
      const { components, wires, netLabels } = state.project.circuit;
      if (dmm.mode === 'diode') { const volts = diodeTest(simulateDC, components, wires, netLabels, red, black); reading = volts === null ? { text: 'OL' } : dmmDisplay(volts, 'V', { ranges: [6] }); note = 'Forward voltage at 1 mA, red = anode. Sources are switched off.'; }
      else {
        const { ohms } = measureResistance(simulateDC, components, wires, netLabels, red, black);
        if (dmm.mode === 'continuity') { reading = ohms !== null && Math.abs(ohms) < 50 ? { text: `${fmt(Math.abs(ohms), 3)} Ω  •)))` } : { text: 'OPEN' }; note = 'Beeps below 50 Ω. Sources are switched off.'; }
        else { reading = dmmDisplay(ohms === null ? null : Math.abs(ohms), 'Ω'); note = 'Measured with a 1 mA test current with every source switched off, as you must on the bench.'; }
      }
    }
  } catch (error) { reading = { text: 'Err' }; note = error.message; }
  const meter = `<div class="coding-block bench-instrument"><span class="panel-label">DIGITAL MULTIMETER · 6000 COUNT</span><div class="dmm-display" aria-live="polite">${esc(reading.text)}</div>
    <div class="dsp-controls">${benchSelect('dmm.mode', 'Function', dmm.mode, DMM_MODES)}${['dca', 'aca'].includes(dmm.mode) ? benchSelect('dmm.part', 'In series with', dmm.part, partOptions) : `${benchSelect('dmm.red', 'Red probe (+)', red, [['', '— choose —'], ...nodes.map((name) => [name, name])])}${benchSelect('dmm.black', 'Black probe (COM)', black, nodes.map((name) => [name, name]))}`}</div>
    <p class="field-help">${esc(note)}</p></div>`;
  return `<div class="page scroll-page bench-page">${header}${scopeBlock}<div class="bench-grid">${generator}${supply}${meter}</div></div>`;
}
function benchAutoset() {
  const state = getState();
  const config = benchConfiguration(state);
  const result = benchCompute(state, config);
  if (!result.run) return;
  const record = (values) => benchRecord(result.run, config.scope.startAfter, values);
  persistBench((next) => {
    let frequency = null;
    next.scope.channels.forEach((channel) => {
      const values = result.run.nodes[channel.node];
      if (!values) return;
      const r = record(values);
      const m = measure(r.time, r.values);
      const ac = channel.coupling === 'ac';
      const span = ac ? m.pp : Math.max(Math.abs(m.max), Math.abs(m.min)) * 2;
      channel.vdiv = SCOPE_VDIV.find((v) => v * 6 >= span) ?? SCOPE_VDIV.at(-1);
      channel.position = 0;
      frequency ??= m.frequency;
    });
    if (frequency) next.scope.tdiv = SCOPE_TDIV.find((t) => t * 10 >= 2.5 / frequency) ?? SCOPE_TDIV.at(-1);
    const source = next.scope.channels[next.scope.trigger.source]?.node ? next.scope.trigger.source : 0;
    const values = result.run.nodes[next.scope.channels[source].node];
    if (values) { const r = record(values); const m = measure(r.time, r.values); next.scope.trigger.level = next.scope.channels[source].coupling === 'ac' ? 0 : Number(((m.max + m.min) / 2).toPrecision(3)); }
  });
}
function exportBenchCsv() {
  const state = getState();
  const config = benchConfiguration(state);
  const result = benchCompute(state, config);
  if (!result.run) return;
  const nodes = config.scope.channels.map((channel) => channel.node).filter((node) => result.run.nodes[node]);
  const rows = [['time_s', ...nodes.map((node) => `V(${node})`)].join(',')];
  result.run.time.forEach((t, k) => { if (t >= config.scope.startAfter) rows.push([t, ...nodes.map((node) => result.run.nodes[node][k])].join(',')); });
  const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-scope.csv'; link.click(); URL.revokeObjectURL(link.href);
}
const BENCH_PERCENT_FIELDS = ['generator.duty'];
export function bindBenchEvents() {
  document.querySelector('[data-bench-example]')?.addEventListener('change', (event) => { if (event.target.value) loadBenchExample(event.target.value); });
  document.querySelectorAll('[data-bench-field]').forEach((input) => input.addEventListener('change', () => {
    const path = input.dataset.benchField;
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); }
    catch (error) { reportError(error); return; }
    if (BENCH_PERCENT_FIELDS.includes(path)) value = Math.min(99.9, Math.max(0.1, value)) / 100;
    setBenchPath(path, value);
  }));
  document.querySelectorAll('[data-bench-select]').forEach((select) => select.addEventListener('change', () => {
    const path = select.dataset.benchSelect;
    const numeric = /vdiv|tdiv|trigger\.source/.test(path);
    setBenchPath(path, numeric ? Number(select.value) : select.value);
  }));
  document.querySelectorAll('[data-bench-toggle]').forEach((button) => button.addEventListener('click', () => {
    const path = button.dataset.benchToggle;
    setBenchPath(path, button.getAttribute('aria-pressed') !== 'true');
  }));
  document.querySelectorAll('[data-bench-range]').forEach((input) => input.addEventListener('change', () => setBenchPath(input.dataset.benchRange, Number(input.value))));
  document.querySelector('[data-action="bench-autoset"]')?.addEventListener('click', benchAutoset);
  document.querySelector('[data-action="bench-export-csv"]')?.addEventListener('click', exportBenchCsv);
}
