// FPGA & Digital (Verilog simulator and HDL toolchain) workspace. Entry points: renderDigital(state); bindVerilogEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { parseVcd } from '../../../packages/hdl/src/index.mjs';
import { resultToVcd, simulate as simulateVerilog, VERILOG_EXAMPLES } from '../../../packages/verilog/src/index.mjs';
import { desktopBridge } from '../../core/desktop-bridge.js';
import { digitalSignalGroups, filterDigitalSignals, measureDigitalCursors, normalizeDigitalWaveformView, sampleDigitalSignal } from '../../core/digital-waveform-view.js';
import { readout } from '../../components/tables.js';
import { labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const HDL_COUNTER_EXAMPLE = `module counter (
  input logic clk,
  input logic reset_n,
  output logic [3:0] count
);
  always_ff @(posedge clk or negedge reset_n) begin
    if (!reset_n) count <= 4'b0000;
    else count <= count + 4'b0001;
  end
endmodule
`;
const HDL_VHDL_COUNTER_EXAMPLE = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter_tb is end entity;

architecture test of counter_tb is
  signal clk : std_logic := '0';
  signal reset_n : std_logic := '0';
  signal count : unsigned(3 downto 0) := (others => '0');
  signal count0, count1, count2, count3 : std_logic;
begin
  clk <= not clk after 5 ns;
  count0 <= count(0); count1 <= count(1);
  count2 <= count(2); count3 <= count(3);
  process(clk, reset_n) begin
    if reset_n = '0' then count <= (others => '0');
    elsif rising_edge(clk) then count <= count + 1;
    end if;
  end process;
  process begin
    wait for 12 ns; reset_n <= '1';
    wait for 80 ns; wait;
  end process;
end architecture;
`;
function renderDigitalWaveform(trace, requested, source, hasGenerated, hasImported, hasBuiltin = false) {
  const view = normalizeDigitalWaveformView(trace, requested || {});
  const groups = digitalSignalGroups(trace);
  const matchingSignals = filterDigitalSignals(trace, view);
  const visibleSignals = matchingSignals.slice(0, 32);
  const measurement = measureDigitalCursors(trace, view);
  const values = new Map(measurement.values.map((value) => [value.fullName, value]));
  const plotLeft = 220; const plotWidth = 780; const rowHeight = 38; const height = Math.max(76, visibleSignals.length * rowHeight + 28);
  const span = Math.max(1, view.endTime - view.startTime);
  const x = (time) => plotLeft + ((time - view.startTime) / span) * plotWidth;
  const windowSamples = (signal) => {
    let low = 0; let high = signal.samples.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (signal.samples[middle].time < view.startTime) low = middle + 1; else high = middle; }
    return signal.samples.slice(Math.max(0, low - 1), Math.min(signal.samples.length, low + 2049));
  };
  const rows = visibleSignals.map((signal, index) => {
    const top = 20 + index * rowHeight; const mid = top + 16; const samples = windowSamples(signal);
    let wave = '';
    if (signal.width === 1) {
      let previous = sampleDigitalSignal(signal, view.startTime); let previousX = plotLeft;
      const yFor = (value) => value === '1' ? top + 5 : value === '0' ? top + 26 : mid;
      wave = `M ${previousX} ${yFor(previous)}`;
      for (const sample of samples) { if (sample.time < view.startTime || sample.time > view.endTime) continue; const nextX = x(sample.time); wave += ` H ${nextX} V ${yFor(sample.value)}`; previousX = nextX; previous = sample.value; }
      wave += ` H ${plotLeft + plotWidth}`;
    } else {
      wave = `M ${plotLeft} ${mid} H ${plotLeft + plotWidth}`;
    }
    const vectorLabels = signal.width > 1 ? samples.filter((sample) => sample.time >= view.startTime && sample.time <= view.endTime).slice(0, 40).map((sample) => `<text x="${Math.min(plotLeft + plotWidth - 45, Math.max(plotLeft + 3, x(sample.time) + 3)).toFixed(1)}" y="${top + 12}" class="digital-vector-value">${esc(sample.value)}</text>`).join('') : '';
    const cursor = values.get(signal.fullName || signal.name) || { a: '—', b: '—' };
    return `<g><line class="digital-row-line" x1="${plotLeft}" y1="${top + 31}" x2="${plotLeft + plotWidth}" y2="${top + 31}"/><text x="8" y="${top + 13}" class="digital-signal-name">${esc(signal.fullName || signal.name)}</text><text x="8" y="${top + 27}" class="digital-signal-meta">${signal.width} bit · A ${esc(cursor.a)} · B ${esc(cursor.b)}</text><path class="digital-wave" d="${wave}"/>${vectorLabels}</g>`;
  }).join('');
  const sourceOptions = `${hasBuiltin ? `<option value="builtin" ${source === 'builtin' ? 'selected' : ''}>Built-in Verilog simulation</option>` : ''}${hasGenerated ? `<option value="generated" ${source === 'generated' ? 'selected' : ''}>Generated GHDL VCD</option>` : ''}${hasImported ? `<option value="imported" ${source === 'imported' ? 'selected' : ''}>Imported VCD</option>` : ''}`;
  const clipped = matchingSignals.length > visibleSignals.length ? `<span class="field-help">Showing the first 32 of ${matchingSignals.length} matching signals.</span>` : '';
  return `<section class="dsp-card digital-waveform-card"><div class="dsp-controls"><span class="panel-label">DIGITAL WAVEFORM</span><label>Source<select data-digital-view="source">${sourceOptions}</select></label><label>Scope<select data-digital-view="group"><option value="all">All scopes</option>${groups.map((group) => `<option value="${esc(group)}" ${view.group === group ? 'selected' : ''}>${esc(group)}</option>`).join('')}</select></label><label>Signal filter<input data-digital-view="query" maxlength="100" value="${esc(view.query)}" placeholder="name or hierarchy"></label><button class="tool" data-action="digital-zoom-in">Zoom in</button><button class="tool" data-action="digital-zoom-out">Zoom out</button><button class="tool" data-action="digital-pan-left">Pan left</button><button class="tool" data-action="digital-pan-right">Pan right</button><button class="tool" data-action="export-digital-csv">Export CSV</button>${clipped}</div><div class="digital-waveform-scroll"><svg class="digital-waveform" viewBox="0 0 1000 ${height}" role="img" aria-label="Digital waveform with ${visibleSignals.length} visible signals"><rect class="digital-plot-bg" x="${plotLeft}" y="0" width="${plotWidth}" height="${height}"/><line class="digital-cursor cursor-a" x1="${x(view.cursorA)}" y1="0" x2="${x(view.cursorA)}" y2="${height}"/><line class="digital-cursor cursor-b" x1="${x(view.cursorB)}" y1="0" x2="${x(view.cursorB)}" y2="${height}"/>${rows || `<text x="500" y="38" text-anchor="middle" class="digital-empty">No signals match this scope and filter.</text>`}</svg></div><div class="waveform-cursors"><label>Cursor A · ${esc(trace.timescale)}<input type="range" min="${view.startTime}" max="${view.endTime}" value="${view.cursorA}" data-digital-view="cursorA"></label><label>Cursor B · ${esc(trace.timescale)}<input type="range" min="${view.startTime}" max="${view.endTime}" value="${view.cursorB}" data-digital-view="cursorB"></label><div class="result-value"><span>Visible window</span><b>${view.startTime}–${view.endTime}</b></div><div class="result-value"><span>Cursor Δ</span><b>${measurement.deltaTime} · ${esc(trace.timescale)}</b></div></div><p class="module-footnote">Values are sampled at or before each cursor. Rendering is bounded to 32 signals, 2,048 transitions per row and 40 vector labels; CSV export is bounded to 128 signals and 8 MiB.</p></section>`;
}
const verilogRuntime = { result: null, trace: null, key: null };
function verilogConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'verilog-sim')?.inputs || {};
  const example = VERILOG_EXAMPLES[0];
  return { exampleId: saved.exampleId ?? example.id, source: typeof saved.source === 'string' ? saved.source : example.source, maxTime: Number.isFinite(saved.maxTime) ? saved.maxTime : 100_000 };
}
function persistVerilog(patch) {
  const next = { ...verilogConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The Verilog source is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'verilog-sim', kind: 'hdl', operation: 'verilog-sim', inputs: next });
}
function runVerilog() {
  const config = verilogConfiguration(getState());
  const source = document.querySelector('[data-verilog-source]')?.value ?? config.source;
  if (source !== config.source) persistVerilog({ source });
  let result;
  try { result = simulateVerilog(source, { maxTime: config.maxTime }); }
  catch (error) { result = { output: '', error: error.message, signals: [], time: 0, finishReason: 'error', steps: 0 }; }
  verilogRuntime.result = result;
  verilogRuntime.trace = result.signals.length ? parseVcd(resultToVcd(result)) : null;
  setState({ digitalView: { source: 'builtin' } });
  notify(result.error ? `Simulation stopped: ${result.error}` : `Simulation finished at time ${result.time} (${result.finishReason})`, result.error ? 'error' : 'success');
}
function renderVerilogSimulator(state) {
  const config = verilogConfiguration(state);
  const result = verilogRuntime.result;
  const status = result ? `<div class="analysis-readouts verilog-status">${readout('Status', result.error ? 'Error' : 'Finished')}${readout('Simulated time', `${result.time} ns`)}${readout('Ended by', result.finishReason ?? '—')}${readout('Statements executed', (result.steps ?? 0).toLocaleString())}${readout('Signals recorded', String(result.signals?.length ?? 0))}</div>` : '';
  return `<section class="dsp-card verilog-card"><div class="dsp-controls"><span class="panel-label">BUILT-IN VERILOG SIMULATOR</span>${labSelect('data-verilog-example', 'example', 'Example', config.exampleId, VERILOG_EXAMPLES.map((example) => [example.id, example.name]))}<label>Time limit<input type="number" min="1" max="100000000" step="1" data-verilog-field="maxTime" value="${config.maxTime}"><span>ns</span></label><button class="button run" data-action="verilog-run">▶ Simulate</button><button class="tool" data-action="verilog-vcd" ${result?.signals?.length ? '' : 'disabled'}>Download VCD</button></div>
    <div class="verilog-layout"><label class="rf-input-label">design.v (design + testbench)<textarea data-verilog-source rows="22" spellcheck="false" maxlength="49152">${esc(config.source)}</textarea></label><div><span class="panel-label">CONSOLE ($display / $monitor)</span><pre class="mcu-terminal verilog-console">${result ? esc(result.output || '(no output)') + (result.error ? `\n<span class="verilog-error">${esc(result.error)}</span>` : '') : 'Press Simulate to run the testbench.'}</pre>${status}</div></div>
    <p class="module-footnote">Event-driven Verilog-2001 subset: modules, parameters, hierarchy, wire/reg/integer, vectors and memories, assign, always/initial, blocking and non-blocking assignments, # delays, @(posedge/negedge/*), if/case/casez/casex/for/while/repeat/forever, functions and tasks, four-state x/z logic and $display/$write/$monitor/$strobe/$random/$finish. Output and waveforms match Icarus Verilog 12 on the test designs. One time unit = 1 ns.</p></section>`;
}
export function bindVerilogEvents() {
  document.querySelector('[data-verilog-example]')?.addEventListener('change', (event) => { const example = VERILOG_EXAMPLES.find((entry) => entry.id === event.target.value); if (example) { verilogRuntime.result = null; verilogRuntime.trace = null; persistVerilog({ exampleId: example.id, source: example.source }); } });
  document.querySelector('[data-verilog-source]')?.addEventListener('change', (event) => persistVerilog({ source: event.target.value }));
  document.querySelector('[data-verilog-field="maxTime"]')?.addEventListener('change', (event) => { const value = Math.round(Number(event.target.value)); if (value >= 1) persistVerilog({ maxTime: value }); });
  // Keep focus in the editor on mouse-down so its change event (which re-renders) cannot swallow the click.
  document.querySelector('[data-action="verilog-run"]')?.addEventListener('mousedown', (event) => event.preventDefault());
  document.querySelector('[data-action="verilog-run"]')?.addEventListener('click', runVerilog);
  document.querySelector('[data-action="verilog-vcd"]')?.addEventListener('click', () => {
    if (!verilogRuntime.result?.signals?.length) return;
    const blob = new Blob([resultToVcd(verilogRuntime.result)], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'simulation.vcd'; link.click(); URL.revokeObjectURL(link.href);
  });
}
export function renderDigital(state) {
  const trace = state.simulation?.kind === 'digital' ? state.simulation.trace : null;
  const lintReport = state.hdlResults?.lint?.report || null;
  const synthesisReport = state.hdlResults?.synthesis?.report || null;
  const placeRouteReport = state.hdlResults?.placeRoute?.report || null;
  const generatedTrace = state.hdlResults?.simulation?.trace || null;
  const requestedSource = state.digitalView?.source;
  const builtinTrace = verilogRuntime.trace;
  const waveformSource = requestedSource === 'builtin' && builtinTrace ? 'builtin' : requestedSource === 'imported' && trace ? 'imported' : requestedSource === 'generated' && generatedTrace ? 'generated' : builtinTrace ? 'builtin' : generatedTrace ? 'generated' : trace ? 'imported' : null;
  const waveformTrace = waveformSource === 'builtin' ? builtinTrace : waveformSource === 'generated' ? generatedTrace : waveformSource === 'imported' ? trace : null;
  const waveformMarkup = waveformTrace ? renderDigitalWaveform(waveformTrace, state.digitalView, waveformSource, Boolean(generatedTrace), Boolean(trace), Boolean(builtinTrace)) : '';
  const savedVcd = state.project.experiments.find((experiment) => experiment?.id === 'vcd-import')?.inputs?.text || '';
  const hdl = state.project.experiments.find((experiment) => experiment?.id === 'hdl-systemverilog-counter')?.inputs || {};
  const source = typeof hdl.source === 'string' ? hdl.source : HDL_COUNTER_EXAMPLE;
  const topUnit = typeof hdl.topUnit === 'string' ? hdl.topUnit : 'counter';
  const vhdl = state.project.experiments.find((experiment) => experiment?.id === 'hdl-vhdl-counter')?.inputs || {};
  const vhdlSource = typeof vhdl.source === 'string' ? vhdl.source : HDL_VHDL_COUNTER_EXAMPLE;
  const vhdlTop = typeof vhdl.topUnit === 'string' ? vhdl.topUnit : 'counter_tb';
  const stopTimeNs = Number.isInteger(vhdl.stopTimeNs) && vhdl.stopTimeNs >= 1 && vhdl.stopTimeNs <= 1_000_000_000 ? vhdl.stopTimeNs : 100;
  const verilator = state.toolchainDetection?.verilator;
  const lintReady = Boolean(desktopBridge.available && state.desktopProject?.project_id && state.processPermissionGranted && state.artifactPermissionGranted && verilator?.state === 'detected' && verilator.path);
  const lintReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : verilator?.state !== 'detected' || !verilator.path ? 'Detect Verilator in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : 'Run project-scoped Verilator lint';
  const yosys = state.toolchainDetection?.yosys;
  const synthesisReady = Boolean(desktopBridge.available && state.desktopProject?.project_id && state.processPermissionGranted && state.artifactPermissionGranted && yosys?.state === 'detected' && yosys.path);
  const synthesisReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : yosys?.state !== 'detected' || !yosys.path ? 'Detect Yosys in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : 'Run independent project-scoped Yosys synthesis';
  const targetConfig = state.project.experiments.find((experiment) => experiment?.id === 'hdl-ice40-hx8k-ct256')?.inputs || {};
  const constraints = typeof targetConfig.constraints === 'string' ? targetConfig.constraints : '';
  const nextpnr = state.toolchainDetection?.['nextpnr-ice40'];
  const netlistReady = typeof state.hdlResults?.synthesis?.netlistPath === 'string';
  const placeRouteReady = Boolean(desktopBridge.available && state.desktopProject?.project_id && state.processPermissionGranted && state.artifactPermissionGranted && nextpnr?.state === 'detected' && nextpnr.path && netlistReady && constraints.trim());
  const placeRouteReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : nextpnr?.state !== 'detected' || !nextpnr.path ? 'Detect nextpnr-ice40 in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : !netlistReady ? 'Run Yosys synthesis to produce a registered JSON netlist' : !constraints.trim() ? 'Enter complete board-specific PCF constraints' : 'Implement the explicit iCE40 HX8K / CT256 target';
  const ghdl = state.toolchainDetection?.ghdl;
  const simulationReady = Boolean(desktopBridge.available && state.desktopProject?.project_id && state.processPermissionGranted && state.artifactPermissionGranted && ghdl?.state === 'detected' && ghdl.path);
  const simulationReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : ghdl?.state !== 'detected' || !ghdl.path ? 'Detect GHDL in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : 'Analyze, elaborate and simulate in an isolated project run';
  const rows = trace?.signals?.map((signal) => `<tr><td>${esc(signal.name)}</td><td>${signal.samples.length}</td><td>${signal.samples.slice(0, 8).map((sample) => `${sample.time}:${sample.value}`).join(' · ')}</td></tr>`).join('') || '';
  const diagnostics = lintReport?.diagnostics || [];
  return `<div class="page scroll-page digital-page">${pageHeader(modules.find((item) => item.id === 'fpga'), 'HDL & DIGITAL WAVEFORMS', state.hdlJob ? `<button class="button ghost" data-action="cancel-hdl-job" ${state.hdlJob.phase === 'cancelling' ? 'disabled' : ''}>${state.hdlJob.phase === 'cancelling' ? 'Cancelling…' : `Cancel ${esc(state.hdlJob.operation)}`}</button>` : `<button class="button ghost" data-action="lint-verilator" ${lintReady ? '' : 'disabled'} title="${esc(lintReason)}">Lint with Verilator</button><button class="button ghost" data-action="synthesize-yosys" ${synthesisReady ? '' : 'disabled'} title="${esc(synthesisReason)}">Synthesize with Yosys</button><button class="button run" data-action="place-route-nextpnr" ${placeRouteReady ? '' : 'disabled'} title="${esc(placeRouteReason)}">Place & route</button>`)}
    ${renderVerilogSimulator(state)}${waveformSource === 'builtin' ? waveformMarkup : ''}
    <section class="dsp-card"><div class="dsp-controls"><label>Language<select disabled><option>SystemVerilog</option></select></label><label>Top unit<input data-hdl-field="topUnit" maxlength="200" value="${esc(topUnit)}"></label><span class="field-help">${esc(lintReason)}</span></div><label class="rf-input-label">src/counter.sv<textarea data-hdl-field="source" rows="14" maxlength="49152" spellcheck="false">${esc(source)}</textarea></label>${lintReport ? `<div class="diagnostic-list">${diagnostics.length ? diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)}${diagnostic.line ? ` · line ${diagnostic.line}` : ''}: ${esc(diagnostic.message)}</span>`).join('') : '<span class="ok">● Verilator lint completed without diagnostics</span>'}</div>` : ''}<p class="module-footnote">Lint is a separate source-quality job. It does not claim simulation, timing closure, synthesis success or hardware readiness.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><label>Language<select disabled><option>VHDL 2008</option></select></label><label>Top entity<input data-hdl-field="vhdlTop" maxlength="200" value="${esc(vhdlTop)}"></label><label>Stop time<input type="number" data-hdl-field="stopTimeNs" min="1" max="1000000000" value="${stopTimeNs}"><span>ns</span></label><button class="button run" data-action="simulate-ghdl" ${simulationReady ? '' : 'disabled'} title="${esc(simulationReason)}">Simulate with GHDL</button></div><label class="rf-input-label">src/counter_tb.vhd<textarea data-hdl-field="vhdlSource" rows="16" maxlength="49152" spellcheck="false">${esc(vhdlSource)}</textarea></label>${generatedTrace ? `<div class="stat-grid"><div><span>Timescale</span><strong>${esc(generatedTrace.timescale)}</strong><small>generated VCD</small></div><div><span>Signals</span><strong>${generatedTrace.signals.length}</strong><small>scalar and vector</small></div><div><span>Transitions</span><strong>${generatedTrace.signals.reduce((sum, signal) => sum + signal.samples.length, 0)}</strong><small>bounded import</small></div><div><span>Status</span><strong>Simulated</strong><small>not synthesized</small></div></div>` : `<div class="empty-state">${esc(simulationReason)}</div>`}<p class="module-footnote">GHDL analysis, elaboration and simulation are separate native jobs. The resulting VCD is registered and parsed locally; simulation does not imply synthesis or hardware readiness.</p></section>
    ${waveformSource === 'builtin' ? '' : waveformMarkup}
    <section class="dsp-card"><div class="dsp-controls"><span class="panel-label">SYNTHESIS REPORT · ${synthesisReport ? 'YOSYS' : 'NO RUN'}</span><span class="field-help">${esc(synthesisReason)}</span></div>${synthesisReport ? `<div class="stat-grid"><div><span>Wires</span><strong>${synthesisReport.metrics.wires ?? '—'}</strong><small>Yosys stat</small></div><div><span>Wire bits</span><strong>${synthesisReport.metrics.wireBits ?? '—'}</strong><small>Yosys stat</small></div><div><span>Memories</span><strong>${synthesisReport.metrics.memories ?? '—'}</strong><small>Yosys stat</small></div><div><span>Cells</span><strong>${synthesisReport.metrics.cells ?? '—'}</strong><small>Yosys stat</small></div></div>` : '<div class="empty-state">Run Yosys independently to produce bounded utilization evidence.</div>'}<p class="module-footnote">A synthesis report is not simulation evidence, timing closure, a placed design, a bitstream, or hardware readiness.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><span class="panel-label">IMPLEMENTATION TARGET · ICE40 HX8K / CT256</span><span class="field-help">${esc(placeRouteReason)}</span></div><label class="rf-input-label">Board-specific PCF constraints<textarea data-hdl-field="constraints" rows="6" maxlength="65536" spellcheck="false" placeholder="set_io clk &lt;board-pin&gt;">${esc(constraints)}</textarea></label>${placeRouteReport ? `<div class="stat-grid"><div><span>Device</span><strong>${esc(placeRouteReport.target || 'hx8k')}</strong><small>nextpnr report</small></div><div><span>Max frequency</span><strong>${placeRouteReport.timingMHz ?? '—'} MHz</strong><small>reported estimate</small></div><div><span>BELs used</span><strong>${placeRouteReport.belsUsed ?? '—'}</strong><small>placed resources</small></div><div><span>Output</span><strong>ASC</strong><small>registered artifact</small></div></div>` : '<div class="empty-state">A registered Yosys JSON netlist and complete PCF constraints are required.</div>'}<p class="module-footnote">This target produces place/route evidence only. Bitstream generation and device programming are not configured, and no hardware-ready claim is made.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="parse-vcd">Parse VCD</button><span class="field-help">Scalar VCD import is local and remains separate from lint and simulation.</span></div><label class="rf-input-label">VCD text<textarea data-vcd-field="text" rows="10" spellcheck="false" placeholder="$timescale 1 ns $end">${esc(savedVcd)}</textarea></label>${trace ? `<div class="stat-grid"><div><span>Timescale</span><strong>${esc(trace.timescale)}</strong><small>VCD header</small></div><div><span>Signals</span><strong>${trace.signals.length}</strong><small>scalar</small></div><div><span>Transitions</span><strong>${trace.signals.reduce((sum, signal) => sum + signal.samples.length, 0)}</strong><small>bounded</small></div></div><div class="packet-table"><table><thead><tr><th>Signal</th><th>Transitions</th><th>Samples (time:value)</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="module-footnote">GHDL and compiled simulation, generated-waveform ingestion, timing and FPGA implementation remain separate capability gates.</p></section></div>`;
}
