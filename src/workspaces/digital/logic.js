// Digital Logic Lab workspace: Boolean algebra (truth tables, K-maps, minimisation), number codes
// and the event-driven gate simulator. Entry points: renderLogic(state) and bindLogicEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../core/html.js';
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { analyzeCombinational, analyzeFunction, convertNumber, LOGIC_TEMPLATES, parseNetlist, parseNumber, simulateNetlist, truthTable } from '../../../packages/logic/src/index.mjs';
import { GROUP_COLORS, parseMintermNotation, renderGateDiagram, renderKarnaugh, renderTimingDiagram } from '../../core/logic-view.js';
import { pageHeader } from '../../components/layout.js';

const LOGIC_DEFAULTS = Object.freeze({ tab: 'boolean', booleanMode: 'expression', expression: "AB + A'C + BC", tableVariables: 3, tableOutputs: '00010111', template: 'full-adder', netlist: LOGIC_TEMPLATES.find((item) => item.id === 'full-adder').text, stopTime: 160, inputValues: {}, codeText: '42', codeBase: 'decimal', codeBits: 8 });
const LOGIC_EXAMPLES = ["AB + A'C + BC", "A ^ B ^ C", "Σm(1,3,7,11,15) + d(0,2,5)", "(A + B)(A' + C)(B + C')", "A'B'C'D' + A'BC'D + ABCD + AB'CD'"];
let logicAnalysisCache = { key: null, value: null };
function logicConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'logic-lab')?.inputs || {};
  return { ...LOGIC_DEFAULTS, ...saved };
}
function persistLogic(patch) {
  recordExperiment({ id: 'logic-lab', kind: 'logic', operation: 'logic-lab', inputs: { ...logicConfiguration(getState()), ...patch } });
}
function booleanAnalysis(config) {
  const key = JSON.stringify([config.booleanMode, config.expression, config.tableVariables, config.tableOutputs]);
  if (logicAnalysisCache.key === key) return logicAnalysisCache.value;
  let value;
  try {
    if (config.booleanMode === 'table') {
      const count = Math.min(6, Math.max(2, Number(config.tableVariables) || 3));
      const outputs = String(config.tableOutputs || '').padEnd(2 ** count, '0').slice(0, 2 ** count);
      const variables = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, count);
      value = { analysis: analyzeFunction(variables, [...outputs].flatMap((bit, index) => bit === '1' ? [index] : []), [...outputs].flatMap((bit, index) => bit === 'x' ? [index] : [])), outputs };
    } else {
      const notation = parseMintermNotation(config.expression);
      if (notation) value = { analysis: analyzeFunction(notation.variables, notation.minterms, notation.dontCares) };
      else { const table = truthTable(config.expression); value = { analysis: analyzeFunction(table.variables, table.minterms) }; }
    }
  } catch (error) { value = { error: error.message }; }
  logicAnalysisCache = { key, value };
  return value;
}
function renderTruthTable(analysis, editable, outputs) {
  const count = analysis.variables.length;
  if (count > 6) return `<p class="field-help">Truth table hidden for ${count} variables (${2 ** count} rows); the minimized forms are exact.</p>`;
  const ones = new Set(analysis.minterms), free = new Set(analysis.dontCares);
  const rows = Array.from({ length: 2 ** count }, (_, index) => {
    const value = ones.has(index) ? '1' : free.has(index) ? 'X' : '0';
    const cell = editable ? `<button class="truth-cell v${value}" data-logic-cell="${index}" aria-label="Row ${index} output ${value}; click to change">${value}</button>` : `<span class="truth-cell v${value}">${value}</span>`;
    return `<tr><td class="muted">${index}</td>${index.toString(2).padStart(count, '0').split('').map((bit) => `<td>${bit}</td>`).join('')}<td>${cell}</td></tr>`;
  }).join('');
  return `<table class="truth-table"><thead><tr><th>#</th>${analysis.variables.map((name) => `<th>${esc(name)}</th>`).join('')}<th>F</th></tr></thead><tbody>${rows}</tbody></table>${editable ? '<small class="field-help">Click an output to cycle 0 → 1 → X (don\'t care).</small>' : ''}`;
}
function renderBooleanTab(config) {
  const result = booleanAnalysis(config);
  const inputs = config.booleanMode === 'table'
    ? `<label>Variables<select data-logic-field="tableVariables">${[2, 3, 4, 5, 6].map((count) => `<option ${count === Number(config.tableVariables) ? 'selected' : ''}>${count}</option>`).join('')}</select></label>`
    : `<label class="logic-expression">Expression or minterms<input data-logic-field="expression" value="${esc(config.expression)}" spellcheck="false" aria-describedby="logic-syntax"></label><div class="logic-examples">${LOGIC_EXAMPLES.map((example) => `<button class="tool" data-logic-example="${esc(example)}">${esc(example)}</button>`).join('')}</div><small id="logic-syntax" class="field-help">NOT: A' or !A · AND: AB, A·B, A&B · OR: A + B · XOR: A ^ B · or minterms: Σm(1,3,7) + d(0,2)</small>`;
  const modeSwitch = `<div class="segmented"><button class="${config.booleanMode === 'expression' ? 'active' : ''}" data-logic-field-value="booleanMode:expression">Expression</button><button class="${config.booleanMode === 'table' ? 'active' : ''}" data-logic-field-value="booleanMode:table">Truth table</button></div>`;
  if (result.error) return `<section class="dsp-card logic-card"><div class="logic-input">${modeSwitch}${inputs}</div><div class="diagnostic error"><b>Expression error</b><span>${esc(result.error)}</span></div></section>`;
  const analysis = result.analysis;
  const forms = [
    ['Canonical SOP', analysis.canonicalSop],
    ['Minimal SOP', `F = ${analysis.sop}`],
    ['Minimal POS', `F = ${analysis.pos}`],
    ['NAND-only', analysis.universal.nand ? `F = ${analysis.universal.nand.expression} · ${analysis.universal.nand.gates} gate${analysis.universal.nand.gates === 1 ? '' : 's'}` : 'constant'],
    ['NOR-only', analysis.universal.nor ? `F = ${analysis.universal.nor.expression} · ${analysis.universal.nor.gates} gate${analysis.universal.nor.gates === 1 ? '' : 's'}` : 'constant'],
    ['AND-OR gates', `${analysis.gates.and} AND · ${analysis.gates.or} OR · ${analysis.gates.inverters} NOT · ${analysis.gates.literals} literals`],
  ];
  return `<section class="dsp-card logic-card"><div class="logic-input">${modeSwitch}${inputs}</div>
    <div class="logic-results">
      <div class="logic-forms">${forms.map(([label, value]) => `<div class="logic-form"><span>${label}</span><code>${esc(value)}</code></div>`).join('')}${analysis.exact ? '' : '<p class="field-help">Large function: the cover is near-minimal (greedy) rather than proven minimal.</p>'}
        ${analysis.sopImplicants.length ? `<div class="logic-groups">${analysis.sopImplicants.map((pattern, index) => `<span class="legend-chip" style="--chip:${GROUP_COLORS[index % GROUP_COLORS.length]}">${esc(analysis.sop.split(' + ')[index] || pattern)}</span>`).join('')}</div>` : ''}
        ${renderGateDiagram(analysis.sopImplicants, analysis.variables)}</div>
      <div class="logic-maps"><span class="panel-label">K-MAP</span>${renderKarnaugh(analysis)}<span class="panel-label">TRUTH TABLE</span>${renderTruthTable(analysis, config.booleanMode === 'table', result.outputs)}</div>
    </div></section>`;
}
function logicNetlist(config) {
  try { return { netlist: parseNetlist(config.netlist) }; } catch (error) { return { error: error.message }; }
}
function renderSimulatorTab(config, state) {
  const parsed = logicNetlist(config);
  const result = state.logicSimulation?.netlist === config.netlist ? state.logicSimulation : null;
  const netlist = parsed.netlist;
  const combinational = netlist && !netlist.clocks.length && !netlist.elements.some((element) => element.sequential);
  const toggles = netlist ? netlist.inputs.filter((input) => !input.pattern).map((input) => { const value = config.inputValues[input.name] ?? input.value; return `<button class="logic-toggle ${value ? 'on' : ''}" data-logic-toggle="${esc(input.name)}" aria-pressed="${value ? 'true' : 'false'}"><i></i>${esc(input.name)} = ${value}</button>`; }).join('') : '';
  const leds = result?.trace && netlist ? (netlist.outputs.length ? netlist.outputs : netlist.elements.map((element) => element.outputs[0]).slice(0, 8)).map((name) => { const value = result.trace.final[name]; return `<span class="logic-led v${value}"><i></i>${esc(name)} = ${value}</span>`; }).join('') : '';
  const watched = result?.trace ? [...new Set([...netlist.clocks.map((clock) => clock.name), ...netlist.inputs.map((input) => input.name), ...netlist.outputs, ...netlist.signals])].slice(0, 16) : [];
  const combinationalTable = result?.analysis ? `<div class="logic-combinational"><span class="panel-label">TRUTH TABLE FROM THE CIRCUIT</span><table class="truth-table"><thead><tr>${result.analysis.variables.map((name) => `<th>${esc(name)}</th>`).join('')}${result.analysis.outputs.map((name) => `<th>${esc(name)}</th>`).join('')}</tr></thead><tbody>${result.analysis.rows.map((row) => `<tr>${row.inputs.map((bit) => `<td>${bit}</td>`).join('')}${row.outputs.map((value) => `<td class="v${value}">${value}</td>`).join('')}</tr>`).join('')}</tbody></table>${result.analysis.outputs.map((name) => { const minimized = analyzeFunction(result.analysis.variables, result.analysis.minterms[name]); return `<div class="logic-form"><span>${esc(name)}</span><code>${esc(name)} = ${esc(minimized.sop)}</code></div>`; }).join('')}</div>` : '';
  return `<section class="dsp-card logic-card"><div class="logic-sim-layout">
    <div class="logic-editor">
      <div class="dsp-controls"><label>Template<select data-logic-field="template">${LOGIC_TEMPLATES.map((item) => `<option value="${item.id}" ${item.id === config.template ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}<option value="custom" ${config.template === 'custom' ? 'selected' : ''}>Custom</option></select></label><label>Stop time<input type="number" min="1" max="100000" step="1" data-logic-field="stopTime" value="${Number(config.stopTime)}"><span>ns</span></label></div>
      <textarea class="logic-netlist" data-logic-field="netlist" rows="14" spellcheck="false" aria-label="Logic netlist">${esc(config.netlist)}</textarea>
      <small class="field-help">input A B · clock CLK period=20 · output Y · and|or|nand|nor|xor|xnor Y = A B · not Y = A · mux Y = S I0 I1 · dff Q [QN] = D CLK [RST] · tff · jkff Q = J K CLK. Gates and flip-flops have a 1 ns delay.</small>
      <div class="logic-actions"><button class="button run" data-action="logic-run">▶ Simulate</button><button class="button ghost" data-action="logic-analyze" ${combinational ? '' : 'disabled title="Needs a combinational circuit"'}>Truth table + minimize</button></div>
      ${parsed.error ? `<div class="diagnostic error"><b>Netlist error</b><span>${esc(parsed.error)}</span></div>` : ''}
    </div>
    <div class="logic-io">${toggles ? `<span class="panel-label">INPUTS</span><div class="logic-toggles">${toggles}</div>` : ''}${leds ? `<span class="panel-label">OUTPUTS AT ${result.trace.stopTime} ns</span><div class="logic-leds">${leds}</div>` : '<p class="field-help">Press Simulate to see outputs and the timing diagram.</p>'}${result?.trace?.warnings.length ? `<div class="diagnostic warning"><b>Warning</b><span>${esc(result.trace.warnings.join(' '))}</span></div>` : ''}${result?.error ? `<div class="diagnostic error"><b>Simulation error</b><span>${esc(result.error)}</span></div>` : ''}</div>
  </div>
  ${result?.trace ? `<span class="panel-label">TIMING DIAGRAM</span>${renderTimingDiagram(result.trace, watched)}` : ''}
  ${combinationalTable}</section>`;
}
function renderCodesTab(config) {
  let rows = '', error = '';
  try {
    const value = parseNumber(config.codeText, config.codeBase);
    const codes = convertNumber(value, Number(config.codeBits));
    rows = [['Decimal', codes.decimal], ['Binary', codes.binary], ['Octal', codes.octal], ['Hexadecimal', codes.hex], ['Signed (two\'s complement)', codes.signedDecimal], ['One\'s complement', codes.onesComplement], ['Two\'s complement (negation)', codes.twosComplementOfValue], ['Gray code', codes.gray], ['BCD (8421)', codes.bcd], ['Excess-3', codes.excess3], ['Number of 1s / even-parity bit', `${codes.onesCount} / ${codes.evenParityBit}`]].map(([label, text]) => `<div class="logic-form"><span>${label}</span><code>${esc(text)}</code></div>`).join('');
  } catch (caught) { error = caught.message; }
  return `<section class="dsp-card logic-card"><div class="dsp-controls"><label>Value<input data-logic-field="codeText" value="${esc(config.codeText)}" spellcheck="false"></label><label>Written in<select data-logic-field="codeBase">${['decimal', 'binary', 'octal', 'hex'].map((base) => `<option ${base === config.codeBase ? 'selected' : ''}>${base}</option>`).join('')}</select></label><label>Register width<select data-logic-field="codeBits">${[4, 8, 12, 16, 24, 32].map((bits) => `<option ${bits === Number(config.codeBits) ? 'selected' : ''}>${bits}</option>`).join('')}</select></label></div>${error ? `<div class="diagnostic error"><b>Value error</b><span>${esc(error)}</span></div>` : `<div class="logic-forms codes">${rows}</div>`}</section>`;
}
export function renderLogic(state) {
  const module = modules.find((item) => item.id === 'logic');
  const config = logicConfiguration(state);
  const tabs = [['boolean', 'Boolean & K-map'], ['simulator', 'Logic simulator'], ['codes', 'Number codes']];
  const body = config.tab === 'simulator' ? renderSimulatorTab(config, state) : config.tab === 'codes' ? renderCodesTab(config) : renderBooleanTab(config);
  return `<div class="page scroll-page">${pageHeader(module, 'BUILT-IN DIGITAL LAB', '<span class="pill live"><i></i> Runs in the browser</span>')}
    <div class="logic-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${config.tab === id}" class="${config.tab === id ? 'active' : ''}" data-logic-tab="${id}">${label}</button>`).join('')}</div>${body}</div>`;
}
function runLogicSimulation(analyze = false) {
  const config = logicConfiguration(getState());
  try {
    const netlist = parseNetlist(config.netlist);
    const trace = simulateNetlist(netlist, { stopTime: Number(config.stopTime), values: config.inputValues });
    const analysis = analyze ? analyzeCombinational(netlist) : null;
    setState({ logicSimulation: { netlist: config.netlist, trace, analysis } });
    notify(analyze ? 'Truth table extracted from the circuit' : `Simulated ${trace.stopTime} ns`, trace.warnings.length ? 'info' : 'success');
  } catch (error) {
    setState({ logicSimulation: { netlist: config.netlist, error: error.message } });
    notify(error.message, 'error');
  }
}
export function bindLogicEvents() {
  document.querySelectorAll('[data-logic-tab]').forEach((button) => button.addEventListener('click', () => persistLogic({ tab: button.dataset.logicTab })));
  document.querySelectorAll('[data-logic-field-value]').forEach((button) => button.addEventListener('click', () => { const [field, value] = button.dataset.logicFieldValue.split(':'); persistLogic({ [field]: value }); }));
  document.querySelectorAll('[data-logic-example]').forEach((button) => button.addEventListener('click', () => persistLogic({ expression: button.dataset.logicExample, booleanMode: 'expression' })));
  document.querySelectorAll('[data-logic-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.logicField;
    if (name === 'template') {
      const template = LOGIC_TEMPLATES.find((item) => item.id === field.value);
      if (template) { persistLogic({ template: template.id, netlist: template.text, inputValues: {} }); runLogicSimulation(); }
      return;
    }
    if (name === 'tableVariables') { const count = Number(field.value); persistLogic({ tableVariables: count, tableOutputs: '0'.repeat(2 ** count) }); return; }
    if (name === 'netlist') { persistLogic({ netlist: field.value, template: 'custom', inputValues: {} }); return; }
    if (name === 'stopTime') { const value = Math.trunc(Number(field.value)); if (!(value >= 1 && value <= 100000)) { notify('Stop time must be 1 to 100000 ns', 'error'); return; } persistLogic({ stopTime: value }); return; }
    persistLogic({ [name]: field.value });
  }));
  document.querySelectorAll('[data-logic-cell]').forEach((button) => button.addEventListener('click', () => {
    const config = logicConfiguration(getState());
    const count = Number(config.tableVariables);
    const outputs = [...String(config.tableOutputs).padEnd(2 ** count, '0').slice(0, 2 ** count)];
    const index = Number(button.dataset.logicCell);
    outputs[index] = { 0: '1', 1: 'x', x: '0' }[outputs[index]];
    persistLogic({ tableOutputs: outputs.join('') });
  }));
  document.querySelectorAll('[data-logic-toggle]').forEach((button) => button.addEventListener('click', () => {
    const config = logicConfiguration(getState());
    const netlist = parseNetlist(config.netlist);
    const name = button.dataset.logicToggle;
    const current = config.inputValues[name] ?? netlist.inputs.find((input) => input.name === name)?.value ?? 0;
    persistLogic({ inputValues: { ...config.inputValues, [name]: current ? 0 : 1 } });
    runLogicSimulation(Boolean(getState().logicSimulation?.analysis));
  }));
  document.querySelector('[data-action="logic-run"]')?.addEventListener('click', () => runLogicSimulation(false));
  document.querySelector('[data-action="logic-analyze"]')?.addEventListener('click', () => runLogicSimulation(true));
}
