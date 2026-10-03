// FPGA & Digital HDL toolchain panel (desktop only, permission-gated): digital waveform viewer,
// Verilator lint, GHDL simulation, Yosys synthesis and nextpnr place-and-route jobs.
// Entry points: bindDigitalEvents(), cancelHdlJob() (also used by the shell when a project closes).
import { getState, notify, recordExperiment, setState, synchronizeOpenProject } from '../../core/store.js';
import { parseVcd } from '../../../packages/hdl/src/index.mjs';
import { desktopBridge } from '../../core/desktop-bridge.js';
import { createVerilatorAdapter, parseVerilatorDiagnostics } from '../../../packages/engine-sdk/src/verilator.mjs';
import { createYosysAdapter } from '../../../packages/engine-sdk/src/yosys.mjs';
import { createNextpnrAdapter } from '../../../packages/engine-sdk/src/nextpnr.mjs';
import { createGhdlAdapter, parseGhdlDiagnostics } from '../../../packages/engine-sdk/src/ghdl.mjs';
import { createDesktopProcessAdapterRunner, joinDesktopProjectPath } from '../../core/desktop-process-adapter-runner.js';
import { normalizeDigitalWaveformView, serializeDigitalCsv, transformDigitalWaveformView } from '../../core/digital-waveform-view.js';
import { bindVerilogEvents } from './fpga.js';
import { nativeSessions } from '../../state/native-sessions.js';

export function bindDigitalEvents() {
  bindVerilogEvents();
  const savedVcd = getState().project.experiments.find((experiment) => experiment?.id === 'vcd-import')?.inputs?.text;
  const vcdField = document.querySelector('[data-vcd-field="text"]');
  if (savedVcd && vcdField) vcdField.value = savedVcd;
  document.querySelector('[data-action="parse-vcd"]')?.addEventListener('click', () => {
    try {
      const text = document.querySelector('[data-vcd-field="text"]')?.value || '';
      recordExperiment({ id: 'vcd-import', kind: 'hdl', operation: 'vcd-parse', inputs: { text } });
      setState({ simulation: { kind: 'digital', trace: parseVcd(text) }, digitalView: { source: 'imported' } });
      notify('VCD waveform parsed', 'success');
    } catch (error) { notify(error.message || 'VCD input is invalid', 'error'); }
  });
  document.querySelector('[data-action="lint-verilator"]')?.addEventListener('click', runNativeVerilatorLint);
  document.querySelector('[data-action="synthesize-yosys"]')?.addEventListener('click', runNativeYosysSynthesis);
  document.querySelector('[data-action="place-route-nextpnr"]')?.addEventListener('click', runNativeNextpnrPlaceRoute);
  document.querySelector('[data-action="simulate-ghdl"]')?.addEventListener('click', runNativeGhdlSimulation);
  document.querySelector('[data-action="cancel-hdl-job"]')?.addEventListener('click', cancelHdlJob);
  document.querySelectorAll('[data-digital-view]').forEach((field) => field.addEventListener('change', () => updateDigitalViewField(field.dataset.digitalView, field.value)));
  document.querySelector('[data-action="digital-zoom-in"]')?.addEventListener('click', () => transformDigitalWindow('zoom-in'));
  document.querySelector('[data-action="digital-zoom-out"]')?.addEventListener('click', () => transformDigitalWindow('zoom-out'));
  document.querySelector('[data-action="digital-pan-left"]')?.addEventListener('click', () => transformDigitalWindow('pan-left'));
  document.querySelector('[data-action="digital-pan-right"]')?.addEventListener('click', () => transformDigitalWindow('pan-right'));
  document.querySelector('[data-action="export-digital-csv"]')?.addEventListener('click', exportDigitalCsv);
  document.querySelectorAll('[data-hdl-field]').forEach((field) => field.addEventListener('change', () => {
    if (field.dataset.hdlField === 'constraints') {
      const constraints = field.value || '';
      try { if (new TextEncoder().encode(constraints).byteLength > 64 * 1024) throw new TypeError('PCF constraints exceed 64 KiB.'); recordExperiment({ id: 'hdl-ice40-hx8k-ct256', kind: 'hdl', operation: 'target-constraints', inputs: { target: 'ice40-hx8k-ct256', family: 'ice40', device: 'hx8k', package: 'ct256', constraintsFormat: 'pcf', constraints } }); }
      catch (error) { notify(error?.message || 'FPGA constraints are invalid', 'error'); }
      return;
    }
    if (['vhdlSource', 'vhdlTop', 'stopTimeNs'].includes(field.dataset.hdlField)) {
      const source = document.querySelector('[data-hdl-field="vhdlSource"]')?.value || '';
      const topUnit = document.querySelector('[data-hdl-field="vhdlTop"]')?.value || '';
      const stopTimeNs = Number(document.querySelector('[data-hdl-field="stopTimeNs"]')?.value);
      try {
        if (!source.trim() || new TextEncoder().encode(source).byteLength > 48 * 1024) throw new TypeError('VHDL source must contain 1 through 49152 UTF-8 bytes.');
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(topUnit)) throw new TypeError('VHDL top entity must be a safe identifier.');
        if (!Number.isInteger(stopTimeNs) || stopTimeNs < 1 || stopTimeNs > 1_000_000_000) throw new TypeError('VHDL stop time must be 1 through 1000000000 ns.');
        recordExperiment({ id: 'hdl-vhdl-counter', kind: 'hdl', operation: 'author-source', inputs: { language: 'vhdl', path: 'src/counter_tb.vhd', topUnit, stopTimeNs, source } });
      } catch (error) { notify(error?.message || 'VHDL source configuration is invalid', 'error'); }
      return;
    }
    const source = document.querySelector('[data-hdl-field="source"]')?.value || '';
    const topUnit = document.querySelector('[data-hdl-field="topUnit"]')?.value || '';
    try {
      if (new TextEncoder().encode(source).byteLength > 48 * 1024) throw new TypeError('HDL source exceeds the 48 KiB authored limit.');
      if (!/^[A-Za-z_][A-Za-z0-9_$]{0,199}$/.test(topUnit)) throw new TypeError('HDL top unit must be a safe identifier.');
      recordExperiment({ id: 'hdl-systemverilog-counter', kind: 'hdl', operation: 'author-source', inputs: { language: 'systemverilog', path: 'src/counter.sv', topUnit, source } });
    } catch (error) { notify(error?.message || 'HDL source configuration is invalid', 'error'); }
  }));
}
function activeDigitalTrace(state = getState()) {
  const imported = state.simulation?.kind === 'digital' ? state.simulation.trace : null;
  const generated = state.hdlResults?.simulation?.trace || null;
  if (state.digitalView?.source === 'imported' && imported) return imported;
  if (state.digitalView?.source === 'generated' && generated) return generated;
  return generated || imported;
}
function updateDigitalViewField(field, rawValue) {
  const state = getState(); const trace = activeDigitalTrace(state);
  if (!trace) return;
  if (field === 'source') { setState({ digitalView: { source: rawValue } }); return; }
  const value = ['startTime', 'endTime', 'cursorA', 'cursorB'].includes(field) ? Number(rawValue) : rawValue;
  setState({ digitalView: { ...state.digitalView, ...normalizeDigitalWaveformView(trace, { ...state.digitalView, [field]: value }) } });
}
function transformDigitalWindow(command) {
  const state = getState(); const trace = activeDigitalTrace(state);
  if (!trace) return;
  setState({ digitalView: { ...state.digitalView, ...transformDigitalWaveformView(trace, state.digitalView || {}, command) } });
}
function exportDigitalCsv() {
  const state = getState(); const trace = activeDigitalTrace(state);
  if (!trace) return;
  try {
    const csv = serializeDigitalCsv(trace, state.digitalView || {});
    const blob = new Blob([csv], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-digital-waveform.csv'; link.click(); URL.revokeObjectURL(link.href); notify('Digital waveform CSV exported', 'success');
  } catch (error) { notify(error?.message || 'Digital waveform export failed', 'error'); }
}
async function runNativeVerilatorLint() {
  const source = document.querySelector('[data-hdl-field="source"]')?.value || '';
  const topUnit = document.querySelector('[data-hdl-field="topUnit"]')?.value || '';
  const bytes = new TextEncoder().encode(source);
  if (!source.trim() || bytes.byteLength > 48 * 1024) { notify('SystemVerilog source must contain 1 through 49152 UTF-8 bytes', 'error'); return; }
  if (!/^[A-Za-z_][A-Za-z0-9_$]{0,199}$/.test(topUnit)) { notify('HDL top unit must be a safe identifier', 'error'); return; }
  recordExperiment({ id: 'hdl-systemverilog-counter', kind: 'hdl', operation: 'author-source', inputs: { language: 'systemverilog', path: 'src/counter.sv', topUnit, source } });
  const state = getState(); const project = state.desktopProject; const detection = state.toolchainDetection?.verilator;
  if (!desktopBridge.available || !project?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Verilator and open a desktop project before linting', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before linting', 'error'); return; }
  if (nativeSessions.activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
  const runId = `verilator-lint-${Date.now().toString(36)}`;
  const sourcePath = joinDesktopProjectPath(project.root, 'runs', runId, 'src', 'counter.sv');
  const artifacts = []; let adapter = null;
  try {
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(project.project_id, `runs/${runId}/src/counter.sv`, bytes, 'text/x-systemverilog'));
    adapter = createVerilatorAdapter({
      executable: detection.path,
      runner: createDesktopProcessAdapterRunner({ bridge: desktopBridge, project, runId, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(project.project_id) }), onArtifact: (artifact) => artifacts.push(artifact) })
    });
    nativeSessions.activeHdlJob = { runId, adapter, engine: 'verilator', operation: 'lint' };
    setState({ hdlJob: { runId, engine: 'verilator', operation: 'lint', phase: 'running' } });
    const job = { operation: 'lint', sources: [sourcePath], topUnit };
    await adapter.prepare(job); await adapter.run(job); const report = await adapter.parse(job);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(project.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'hdl-verilator-lint', kind: 'hdl', operation: 'lint', inputs: { language: 'systemverilog', source: 'src/counter.sv', topUnit, engine: 'verilator' } });
    await desktopBridge.saveOpenProject(getState().project);
    setState({ hdlResults: { ...getState().hdlResults, lint: { report, runId, engine: 'verilator', state: 'succeeded' } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) });
    notify(report.diagnostics.length ? `Verilator lint completed with ${report.diagnostics.length} diagnostic(s)` : 'Verilator lint completed without diagnostics', report.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 'error' : 'success');
  } catch (error) {
    const report = parseVerilatorDiagnostics(error?.message || '');
    try { setState({ hdlResults: { ...getState().hdlResults, lint: { report, runId, engine: 'verilator', state: error?.code === 'PROCESS_CANCELLED' ? 'cancelled' : 'failed' } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) }); } catch { /* retain the engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'Verilator lint cancelled' : error?.message || 'Verilator lint failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally { nativeSessions.activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
}
async function runNativeGhdlSimulation() {
  const source = document.querySelector('[data-hdl-field="vhdlSource"]')?.value || '';
  const topEntity = document.querySelector('[data-hdl-field="vhdlTop"]')?.value || '';
  const stopTimeNs = Number(document.querySelector('[data-hdl-field="stopTimeNs"]')?.value);
  const sourceBytes = new TextEncoder().encode(source);
  if (!source.trim() || sourceBytes.byteLength > 48 * 1024) { notify('VHDL source must contain 1 through 49152 UTF-8 bytes', 'error'); return; }
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(topEntity)) { notify('VHDL top entity must be a safe identifier', 'error'); return; }
  if (!Number.isInteger(stopTimeNs) || stopTimeNs < 1 || stopTimeNs > 1_000_000_000) { notify('VHDL stop time must be 1 through 1000000000 ns', 'error'); return; }
  const state = getState(); const project = state.desktopProject; const detection = state.toolchainDetection?.ghdl;
  if (!desktopBridge.available || !project?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect GHDL and open a desktop project before simulation', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before simulation', 'error'); return; }
  if (nativeSessions.activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
  recordExperiment({ id: 'hdl-vhdl-counter', kind: 'hdl', operation: 'author-source', inputs: { language: 'vhdl', path: 'src/counter_tb.vhd', topUnit: topEntity, stopTimeNs, source } });
  const baseId = `ghdl-simulation-${Date.now().toString(36)}`;
  const sourceRelative = `runs/${baseId}/vhdl/counter_tb.vhd`;
  const waveformRelative = `runs/${baseId}/vhdl/counter.vcd`;
  const workingDirectory = joinDesktopProjectPath(project.root, 'runs', baseId, 'vhdl');
  const sourcePath = joinDesktopProjectPath(project.root, 'runs', baseId, 'vhdl', 'counter_tb.vhd');
  const waveformPath = joinDesktopProjectPath(project.root, 'runs', baseId, 'vhdl', 'counter.vcd');
  const artifacts = []; const adapters = [];
  try {
    await desktopBridge.saveOpenProject(getState().project);
    artifacts.push(await desktopBridge.storeArtifact(project.project_id, sourceRelative, sourceBytes, 'text/x-vhdl'));
    const reports = [];
    for (const operation of ['analyze', 'elaborate', 'simulate']) {
      const runId = `${baseId}-${operation}`;
      const adapter = createGhdlAdapter({
        executable: detection.path,
        runner: createDesktopProcessAdapterRunner({ bridge: desktopBridge, project: { ...project, root: workingDirectory }, runId, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(project.project_id) }), onArtifact: (artifact) => artifacts.push(artifact) })
      });
      adapters.push(adapter); nativeSessions.activeHdlJob = { runId, adapter, engine: 'ghdl', operation };
      setState({ hdlJob: { runId, engine: 'ghdl', operation, phase: 'running' } });
      const job = { operation, sources: [sourcePath], topEntity, ...(operation === 'simulate' ? { waveformPath, stopTimeNs } : {}) };
      await adapter.prepare(job); await adapter.run(job); reports.push(await adapter.parse(job)); await adapter.clean();
    }
    const waveform = await desktopBridge.registerGeneratedArtifact(project.project_id, waveformRelative, 'text/x-vcd');
    artifacts.push(waveform);
    const waveformBytes = await desktopBridge.readArtifact(project.project_id, waveform, 16 * 1024 * 1024);
    const trace = parseVcd(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(waveformBytes)));
    for (const artifact of artifacts) await desktopBridge.registerArtifact(project.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'hdl-ghdl-simulation', kind: 'hdl', operation: 'simulate', inputs: { language: 'vhdl', source: 'src/counter_tb.vhd', topUnit: topEntity, stopTimeNs, engine: 'ghdl', waveform: waveformRelative } });
    await desktopBridge.saveOpenProject(getState().project);
    const diagnostics = reports.flatMap((report) => report.diagnostics);
    setState({ hdlResults: { ...getState().hdlResults, simulation: { report: { kind: 'report', diagnostics }, trace, runId: baseId, engine: 'ghdl', state: 'succeeded', waveformPath: waveformRelative } }, digitalView: { source: 'generated' }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) });
    notify(`GHDL simulation completed with ${trace.signals.length} waveform signal(s)`, 'success');
  } catch (error) {
    const report = parseGhdlDiagnostics(error?.message || '');
    try { setState({ hdlResults: { ...getState().hdlResults, simulation: { report, runId: baseId, engine: 'ghdl', state: error?.code === 'PROCESS_CANCELLED' ? 'cancelled' : 'failed', error: error?.message || 'GHDL simulation failed' } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) }); } catch { /* retain the engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'GHDL simulation cancelled' : error?.message || 'GHDL simulation failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally { nativeSessions.activeHdlJob = null; setState({ hdlJob: null }); for (const adapter of adapters) await adapter.clean().catch(() => {}); }
}
async function runNativeYosysSynthesis() {
  const source = document.querySelector('[data-hdl-field="source"]')?.value || '';
  const topUnit = document.querySelector('[data-hdl-field="topUnit"]')?.value || '';
  const bytes = new TextEncoder().encode(source);
  if (!source.trim() || bytes.byteLength > 48 * 1024) { notify('SystemVerilog source must contain 1 through 49152 UTF-8 bytes', 'error'); return; }
  if (!/^[A-Za-z_][A-Za-z0-9_$]{0,199}$/.test(topUnit)) { notify('HDL top unit must be a safe identifier', 'error'); return; }
  recordExperiment({ id: 'hdl-systemverilog-counter', kind: 'hdl', operation: 'author-source', inputs: { language: 'systemverilog', path: 'src/counter.sv', topUnit, source } });
  const state = getState(); const project = state.desktopProject; const detection = state.toolchainDetection?.yosys;
  if (!desktopBridge.available || !project?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Yosys and open a desktop project before synthesis', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before synthesis', 'error'); return; }
  if (nativeSessions.activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
  const runId = `yosys-synthesis-${Date.now().toString(36)}`;
  const sourcePath = joinDesktopProjectPath(project.root, 'runs', runId, 'src', 'counter.sv');
  const netlistRelative = `runs/${runId}/src/counter.json`;
  const netlistPath = joinDesktopProjectPath(project.root, 'runs', runId, 'src', 'counter.json');
  const artifacts = []; let adapter = null;
  try {
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(project.project_id, `runs/${runId}/src/counter.sv`, bytes, 'text/x-systemverilog'));
    adapter = createYosysAdapter({
      executable: detection.path,
      runner: createDesktopProcessAdapterRunner({ bridge: desktopBridge, project, runId, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(project.project_id) }), onArtifact: (artifact) => artifacts.push(artifact) })
    });
    nativeSessions.activeHdlJob = { runId, adapter, engine: 'yosys', operation: 'synthesis' };
    setState({ hdlJob: { runId, engine: 'yosys', operation: 'synthesis', phase: 'running' } });
    const job = { operation: 'synthesis', sources: [sourcePath], topModule: topUnit, netlistPath };
    await adapter.prepare(job); await adapter.run(job); const report = await adapter.parse(job);
    artifacts.push(await desktopBridge.registerGeneratedArtifact(project.project_id, netlistRelative, 'application/json'));
    for (const artifact of artifacts) await desktopBridge.registerArtifact(project.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'hdl-yosys-synthesis', kind: 'hdl', operation: 'synthesis', inputs: { language: 'systemverilog', source: 'src/counter.sv', topUnit, engine: 'yosys' } });
    await desktopBridge.saveOpenProject(getState().project);
    setState({ hdlResults: { ...getState().hdlResults, synthesis: { report, runId, engine: 'yosys', state: 'succeeded', netlistPath: netlistRelative } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) });
    notify('Yosys synthesis completed with an independent utilization report', 'success');
  } catch (error) {
    try { setState({ hdlResults: { ...getState().hdlResults, synthesis: { runId, engine: 'yosys', state: error?.code === 'PROCESS_CANCELLED' ? 'cancelled' : 'failed', error: error?.message || 'Yosys synthesis failed' } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) }); } catch { /* retain the engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'Yosys synthesis cancelled' : error?.message || 'Yosys synthesis failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally { nativeSessions.activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
}
async function runNativeNextpnrPlaceRoute() {
  const constraints = document.querySelector('[data-hdl-field="constraints"]')?.value || '';
  const constraintBytes = new TextEncoder().encode(constraints);
  if (!constraints.trim() || constraintBytes.byteLength > 64 * 1024 || constraints.includes('\0')) { notify('Complete PCF constraints must contain 1 through 65536 UTF-8 bytes', 'error'); return; }
  const state = getState(); const project = state.desktopProject; const detection = state.toolchainDetection?.['nextpnr-ice40'];
  const netlistRelative = state.hdlResults?.synthesis?.netlistPath;
  if (typeof netlistRelative !== 'string' || !/^runs\/[A-Za-z0-9_-]+\/src\/counter\.json$/.test(netlistRelative)) { notify('Run Yosys synthesis to produce a registered JSON netlist first', 'error'); return; }
  if (!desktopBridge.available || !project?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect nextpnr-ice40 and open a desktop project before place/route', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before place/route', 'error'); return; }
  if (nativeSessions.activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
  recordExperiment({ id: 'hdl-ice40-hx8k-ct256', kind: 'hdl', operation: 'target-constraints', inputs: { target: 'ice40-hx8k-ct256', family: 'ice40', device: 'hx8k', package: 'ct256', constraintsFormat: 'pcf', constraints } });
  const runId = `nextpnr-ice40-${Date.now().toString(36)}`;
  const constraintsRelative = `runs/${runId}/implementation/design.pcf`;
  const outputRelative = `runs/${runId}/implementation/design.asc`;
  const netlistPath = joinDesktopProjectPath(project.root, ...netlistRelative.split('/'));
  const constraintsPath = joinDesktopProjectPath(project.root, 'runs', runId, 'implementation', 'design.pcf');
  const outputPath = joinDesktopProjectPath(project.root, 'runs', runId, 'implementation', 'design.asc');
  const artifacts = []; let adapter = null;
  try {
    await desktopBridge.saveOpenProject(getState().project);
    artifacts.push(await desktopBridge.storeArtifact(project.project_id, constraintsRelative, constraintBytes, 'text/x-pcf'));
    adapter = createNextpnrAdapter({
      executable: detection.path,
      runner: createDesktopProcessAdapterRunner({ bridge: desktopBridge, project, runId, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(project.project_id) }), onArtifact: (artifact) => artifacts.push(artifact) })
    });
    nativeSessions.activeHdlJob = { runId, adapter, engine: 'nextpnr-ice40', operation: 'place-route' };
    setState({ hdlJob: { runId, engine: 'nextpnr-ice40', operation: 'place-route', phase: 'running' } });
    const job = { operation: 'place-route', target: 'ice40', package: 'ct256', netlistPath, constraintsPath, outputPath };
    await adapter.prepare(job); await adapter.run(job); const report = await adapter.parse(job);
    artifacts.push(await desktopBridge.registerGeneratedArtifact(project.project_id, outputRelative, 'application/vnd.nextpnr.asc'));
    for (const artifact of artifacts) await desktopBridge.registerArtifact(project.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'hdl-nextpnr-implementation', kind: 'hdl', operation: 'place-route', inputs: { target: 'ice40-hx8k-ct256', netlist: netlistRelative, constraints: 'implementation/design.pcf', engine: 'nextpnr-ice40' } });
    await desktopBridge.saveOpenProject(getState().project);
    setState({ hdlResults: { ...getState().hdlResults, placeRoute: { report, runId, engine: 'nextpnr-ice40', state: 'succeeded', outputPath: outputRelative } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) });
    notify('nextpnr place/route completed; no bitstream or hardware-ready claim was made', 'success');
  } catch (error) {
    try { setState({ hdlResults: { ...getState().hdlResults, placeRoute: { runId, engine: 'nextpnr-ice40', state: error?.code === 'PROCESS_CANCELLED' ? 'cancelled' : 'failed', error: error?.message || 'nextpnr place/route failed' } }, desktopJobs: await desktopBridge.listJobs(project.project_id), desktopEvents: await desktopBridge.drainEvents(project.project_id) }); } catch { /* retain the engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'nextpnr place/route cancelled' : error?.message || 'nextpnr place/route failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally { nativeSessions.activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
}
export async function cancelHdlJob(silent = false) {
  const active = nativeSessions.activeHdlJob;
  if (!active) return;
  setState({ hdlJob: { runId: active.runId, engine: active.engine, operation: active.operation, phase: 'cancelling' } });
  try { await active.adapter.cancel(); if (!silent) notify(`Cancelling ${active.engine} ${active.operation}`, 'success'); }
  catch (error) { if (!silent) notify(error?.message || 'HDL job cancellation failed', 'error'); }
}
