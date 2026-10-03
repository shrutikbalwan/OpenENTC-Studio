import { modules, componentPalette } from './data/modules.js';
import { esc, formatAssistantText, safeUrl } from './shared/escaping.js';
import { forgetApiKey, loadAssistantSettings, redactSecrets, saveAssistantSettings as storeAssistantSettings } from './core/credentials.js';
import { engines } from './core/engine-registry.js';
import { createProject } from './core/project.js';
import { createPackagedProjectExport, importProjectFile } from './core/project-file.js';
import { getState, setState, updateProject, recordExperiment, subscribe, notify, replaceProject, synchronizeOpenProject, undoProject, redoProject, canUndoProject, canRedoProject, recordLearningAttempt, saveProject } from './core/store.js';
import { simulateDC, simulateTransient, simulateAC, sampleWaveform } from './engines/circuit-engine.js';
import { exampleCircuits } from './data/example-circuits.js';
import { circuitTraces, decimate, niceRange, decadeTicks, stepMetrics, waveformMetrics, bodeMetrics, circuitResultCsv } from './core/circuit-plot.js';
import { checkElectricalRules, locateElectricalRuleDiagnostic } from '../packages/schematic/src/erc.mjs';
import { normalizeNode } from '../packages/schematic/src/index.mjs';
import { nodeFields, pinName as componentPinName } from '../packages/schematic/src/components.mjs';
import { connectNodes, disconnectNodes, pruneWires, setWireRoute } from './core/wires.js';
import { moveComponents, pasteComponents, rotateComponents } from './core/circuit-editing.js';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';
import { buildWireSegments, defaultWireRoute, orthogonalPath, wireRouteHandle, wireRouteHandles, wireRouteInsertionPoint } from '../packages/schematic/src/geometry.mjs';
import { componentsInRect } from '../packages/schematic/src/selection.mjs';
import { fitCanvasView, screenToCanvas, snapCanvasPoint, zoomCanvasView } from './core/canvas.js';
import { parseEngineeringValue, formatEngineeringValue } from '../packages/schematic/src/units.mjs';
import { applyWindow, fft, filterFir, generateSine } from '../packages/numerics/src/index.mjs';
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate } from '../packages/communications/src/index.mjs';
import { parseTouchstone } from '../packages/rf/src/index.mjs';
import { firstOrderStability, firstOrderStep } from '../packages/control/src/index.mjs';
import { AVR_EXAMPLES } from '../packages/mcu/src/index.mjs';
import { phaseDifference } from '../packages/instruments/src/index.mjs';
import { buildLabRecord } from '../packages/report/src/index.mjs';
import { chat as assistantChat, LANGUAGES, MODES, PROVIDERS, validateBaseUrl } from '../packages/assistant/src/index.mjs';
import { lessonIndex, TRACKS } from '../packages/learning/src/courseware.mjs';
import { parsePcap, parsePcapNg } from '../packages/packets/src/index.mjs';
import { topologyMetrics } from '../packages/topology/src/index.mjs';
import { parseVcd } from '../packages/hdl/src/index.mjs';
import { analyzeSketchSource } from '../packages/firmware/src/index.mjs';
import { annotateReferences, componentReferencePrefixes } from '../packages/schematic/src/annotation.mjs';
import { evaluateLesson } from '../packages/learning/src/index.mjs';
import { getLesson } from '../packages/learning/src/catalog.mjs';
import { createDevicePermissionPolicy, createSerialSession } from '../packages/device-bridge/src/index.mjs';
import { desktopBridge } from './core/desktop-bridge.js';
import { createDesktopEngineRunner } from './core/desktop-engine-runner.js';
import { createNgspiceAdapter, parseNgspiceDiagnostics, parseNgspiceVersion } from '../packages/engine-sdk/src/ngspice.mjs';
import { createArduinoCliAdapter } from '../packages/engine-sdk/src/arduino-cli.mjs';
import { createVerilatorAdapter, parseVerilatorDiagnostics } from '../packages/engine-sdk/src/verilator.mjs';
import { createYosysAdapter } from '../packages/engine-sdk/src/yosys.mjs';
import { createNextpnrAdapter } from '../packages/engine-sdk/src/nextpnr.mjs';
import { createGhdlAdapter, parseGhdlDiagnostics } from '../packages/engine-sdk/src/ghdl.mjs';
import { createDesktopProcessAdapterRunner, joinDesktopProjectPath } from './core/desktop-process-adapter-runner.js';
import { measureNgspiceCursors, normalizeNgspiceView, serializeNgspiceCsv, transformNgspiceWindowView } from './core/ngspice-view.js';
import { designBandpass, designBias, designLm317, designOscillator, designPll, designSallenKey, designSchmitt, designZener, networkSweep, OSCILLATORS } from '../packages/analogdesign/src/index.mjs';
import { normalizeDigitalWaveformView, serializeDigitalCsv, transformDigitalWaveformView } from './core/digital-waveform-view.js';
import { capitalize, decibels, eng, fmt, lines } from './shared/formatting.js';
import { readout, simpleTable } from './components/tables.js';
import { linePlot, PLOT_COLORS, renderPlotFrame } from './components/plots.js';
import { groupField, labSelect } from './components/forms.js';
import { labCard, pageHeader } from './components/layout.js';
import { bindLabControls, makeLab } from './controllers/lab-controls.js';
import { bindLogicEvents, renderLogic } from './workspaces/digital/logic.js';
import { bindPowerEvents, renderPower } from './workspaces/electrical/power.js';
import { bindAdcEvents, renderAdcLab } from './workspaces/electrical/adc.js';
import { bindSensorEvents, renderEv, renderSensors } from './workspaces/electrical/sensors-ev.js';
import { bindMachinesEvents, renderMachines } from './workspaces/electrical/machines.js';
import { bindProductEvents, renderProduct } from './workspaces/electrical/product.js';
import { bindMeasurementEvents, renderMeasurement } from './workspaces/electrical/measure.js';
import { bindNetworkTheoryEvents, renderNetworkTheory } from './workspaces/circuit/theory.js';
import { bindFaultHuntEvents, renderFaultHunt } from './workspaces/circuit/faulthunt.js';
import { bindVlsiEvents, renderRtos, renderVlsi } from './workspaces/digital/vlsi-rtos.js';
import { bindVerilogEvents, renderDigital } from './workspaces/digital/fpga.js';
import { bindSigsysEvents, renderSigsys } from './workspaces/signals/sigsys.js';
import { bindDspLabEvents, renderDsp } from './workspaces/signals/dsp.js';
import { bindSpeechEvents, renderSpeech } from './workspaces/signals/speech.js';
import { bindDipEvents, renderDip } from './workspaces/signals/dip.js';
import { bindBioEvents, renderBio } from './workspaces/signals/biomed.js';
import { bindControlLabEvents, renderControl } from './workspaces/control/control.js';
import { bindPlcEvents, renderPlc } from './workspaces/control/plc.js';
import { bindCommLabEvents, bindReceiverEvents, renderCommunication } from './workspaces/communication/communication.js';
import { bindInfoEvents, renderInfo } from './workspaces/communication/info.js';
import { bindNetprotoEvents, renderNetwork } from './workspaces/communication/network.js';
import { bindCellularEvents, renderCellular } from './workspaces/communication/cellular.js';
import { bindWsnEvents, renderWsn } from './workspaces/communication/wsn.js';
import { bindSdrEvents, renderSdr } from './workspaces/communication/sdr.js';
import { bindCryptoEvents, renderCrypto } from './workspaces/communication/crypto.js';
import { bindRfLabEvents, renderRf } from './workspaces/rf/rf.js';
import { bindEmEvents, renderEm } from './workspaces/rf/em.js';
import { bindRadarEvents, renderRadar } from './workspaces/rf/radar.js';
import { rerender, setRenderer } from './services/render.js';
import { bindTwinEvents, renderTwin } from './workspaces/embedded/twin.js';
import { bindPcbEvents, renderPcb } from './workspaces/pcb/pcb.js';
import { bindCalculatorEvents, renderCalculators } from './workspaces/tools/calculators.js';
import { bindNnEvents, renderNn } from './workspaces/learning/neural.js';
import { bindConsoleEvents, renderConsole } from './workspaces/learning/console.js';
import { bindLearningHubEvents, renderLearningHub } from './workspaces/learning/learning-hub.js';
import { circuitEditor } from './state/circuit-editor.js';
import { nativeSessions } from './state/native-sessions.js';
import { isDcResult } from './shared/simulation.js';
import { showModal } from './components/dialogs.js';
import { EXPERIMENT_MODULES } from './shared/experiments.js';
import { bindMcuEvents, mcuConfiguration, mcuRuntime, renderMcu, unoRuntime } from './workspaces/embedded/mcu.js';
import { benchCompute, benchConfiguration, benchScope, bindBenchEvents, renderBench } from './workspaces/circuit/bench.js';

const app = document.querySelector('#app');
const importInput = document.querySelector('#project-import');
const browserDevicePolicy = createDevicePermissionPolicy({ environment: 'browser' });

function render() {
  const state = getState();
  const active = modules.find((item) => item.id === state.activeModule) || modules[0];
  document.documentElement.dataset.theme = state.project.settings.theme;
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="brand" data-action="home" aria-label="Open Mission control">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span><b>OpenENTC</b><small>STUDIO / ALPHA 01</small></span>
        </button>
        <div class="project-title">
          <span class="status-dot"></span>
          <input data-field="project-name" value="${esc(state.project.name)}" aria-label="Project name">
          <span class="saved ${state.persistence?.status === 'error' ? 'error' : ''}" title="${esc(state.persistence?.error || (state.persistence?.status === 'recovered' ? 'A migration backup was retained.' : 'Project is stored locally.'))}">${state.persistence?.status === 'error' ? 'Save failed' : state.persistence?.status === 'recovered' ? 'Recovered locally' : state.persistence?.status === 'unsaved' ? 'Not saved yet' : 'Saved locally'}</span>
        </div>
        <div class="top-actions">
          <button class="icon-button" data-action="command" title="Command palette (Ctrl+K)" aria-label="Open command palette">⌘</button>
          <button class="icon-button" data-action="theme" title="Change theme" aria-label="Change color theme">${state.project.settings.theme === 'dark' ? '☼' : '☾'}</button>
          <button class="button ghost" data-action="import">Import</button>
          <button class="button ghost" data-action="save-local" title="Save the current project in browser storage">Save locally</button>
          <button class="button ghost" data-action="desktop-open" ${desktopBridge.available ? '' : 'disabled'} title="${desktopBridge.available ? 'Open a project directory in the desktop shell' : 'Unavailable in browser preview'}">Open desktop</button>
          <button class="button ghost" data-action="desktop-save" ${desktopBridge.available ? '' : 'disabled'} title="${desktopBridge.available ? 'Save the current project to the opened desktop directory' : 'Unavailable in browser preview'}">Save desktop</button>
          <button class="button primary" data-action="export">Export project</button>
        </div>
      </header>
      <aside class="sidebar">
        <nav aria-label="Engineering modules">
          ${modules.map((item) => `<button class="nav-item ${item.id === state.activeModule ? 'active' : ''}" data-module="${item.id}" style="--module:${item.color}" title="${item.name}"><span>${item.icon}</span><small>${item.short}</small></button>`).join('')}
        </nav>
        <button class="nav-item" data-action="help" title="About and shortcuts"><span>?</span><small>Help</small></button>
      </aside>
      <main class="workspace" style="--active-color:${active.color}">
        ${renderWorkspace(state, active)}
      </main>
      ${renderAssistant(state)}
      ${state.toast ? `<div class="toast ${state.toast.tone}" role="${state.toast.tone === 'error' ? 'alert' : 'status'}" aria-live="${state.toast.tone === 'error' ? 'assertive' : 'polite'}"><span>${state.toast.tone === 'success' ? '✓' : state.toast.tone === 'error' ? '!' : 'i'}</span>${esc(state.toast.message)}</div>` : ''}
      <div class="modal-layer" hidden></div>
    </div>`;
  bindEvents();
}

function renderWorkspace(state, active) {
  if (state.activeModule === 'toolchains') return renderToolchains(state);
  if (active.id === 'home') return renderHome(state);
  if (active.id === 'circuit') {
    const circuitCompatible = isDcResult(state.simulation) || ['ngspice', 'ngspice-error', 'circuit-transient', 'circuit-ac'].includes(state.simulation?.kind);
    const circuitState = circuitCompatible ? state : { ...state, simulation: null };
    return renderCircuit(circuitState);
  }
  if (active.id === 'dsp') return renderDsp(state);
  if (active.id === 'communication') return renderCommunication(state);
  if (active.id === 'rf') return renderRf(state);
  if (active.id === 'calc') return renderCalculators(state);
  if (active.id === 'pcb') return renderPcb(state);
  if (active.id === 'mcu') return renderMcu(state);
  if (active.id === 'bench') return renderBench(state);
  if (active.id === 'record') return renderRecords(state);
  if (active.id === 'power') return renderPower(state);
  if (active.id === 'adc') return renderAdcLab(state);
  if (active.id === 'sensors') return renderSensors(state);
  if (active.id === 'ev') return renderEv(state);
  if (active.id === 'vlsi') return renderVlsi(state);
  if (active.id === 'rtos') return renderRtos(state);
  if (active.id === 'theory') return renderNetworkTheory(state);
  if (active.id === 'sigsys') return renderSigsys(state);
  if (active.id === 'em') return renderEm(state);
  if (active.id === 'twin') return renderTwin(state);
  if (active.id === 'faulthunt') return renderFaultHunt(state);
  if (active.id === 'machines') return renderMachines(state);
  if (active.id === 'product') return renderProduct(state);
  if (active.id === 'plc') return renderPlc(state);
  if (active.id === 'speech') return renderSpeech(state);
  if (active.id === 'radar') return renderRadar(state);
  if (active.id === 'measure') return renderMeasurement(state);
  if (active.id === 'analog') return renderAnalog(state);
  if (active.id === 'info') return renderInfo(state);
  if (active.id === 'cellular') return renderCellular(state);
  if (active.id === 'crypto') return renderCrypto(state);
  if (active.id === 'wsn') return renderWsn(state);
  if (active.id === 'sdr') return renderSdr(state);
  if (active.id === 'dip') return renderDip(state);
  if (active.id === 'biomed') return renderBio(state);
  if (active.id === 'neural') return renderNn(state);
  if (active.id === 'console') return renderConsole(state);
  if (active.id === 'iot') return renderControl(state);
  if (active.id === 'network') return renderNetwork(state);
  if (active.id === 'fpga') return renderDigital(state);
  if (active.id === 'logic') return renderLogic(state);
  if (active.id === 'embedded') return renderEmbedded(state);
  if (active.id === 'learn') return renderLearningHub(state);
  return renderEngineeringModule(active);
}

function renderHome(state) {
  const ready = engines.filter((engine) => ['built-in', 'integrated', 'interoperable'].includes(engine.status)).length;
  return `<div class="page scroll-page">
    ${pageHeader(modules[0], 'ONE WORKSPACE · EVERY DISCIPLINE', '<button class="button primary" data-module="circuit">Open Circuit Lab →</button>')}
    <section class="hero-card">
      <div class="hero-copy"><span class="pill live"><i></i> Local-first engineering</span><h2>Build the signal.<br><em>Understand the system.</em></h2><p>Move from a circuit idea to firmware, board design, digital logic and communication analysis without losing your project context.</p><div class="hero-actions"><button class="button bright" data-action="new-project">New engineering project</button><button class="button subtle" data-action="load-demo">Load voltage-divider demo</button></div></div>
      <div class="hero-visual" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="core-chip"><span>OE</span><small>UNIFIED<br>LAB CORE</small></div><span class="satellite s1">RF</span><span class="satellite s2">PCB</span><span class="satellite s3">DSP</span><span class="satellite s4">MCU</span></div>
    </section>
    <section class="metric-row">
      <div class="metric"><span>PROJECT</span><strong>${esc(state.project.name)}</strong><small>Updated ${new Date(state.project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
      <div class="metric"><span>MODULES</span><strong>${modules.length - 1}</strong><small>Unified ENTC workspaces</small></div>
      <div class="metric"><span>ENGINE STATUS</span><strong>${ready} available · ${engines.length - ready} unavailable</strong><small>Evidence-backed capability states</small></div>
      <div class="metric"><span>PRIVACY</span><strong>Local by default</strong><small>This browser alpha has no upload feature</small></div>
    </section>
    <div class="section-title"><div><span class="eyebrow">AUTHORED EXPERIMENTS</span><h2>Saved configurations</h2></div><span>${state.project.experiments.length} persisted</span></div>
    <section class="engine-table experiment-list">${state.project.experiments.length ? state.project.experiments.slice(-6).reverse().map((experiment) => `<div class="engine-row"><span class="engine-logo">EX</span><div><b>${esc(experiment.id)}</b><small>${esc(experiment.kind || 'experiment')} · ${esc(experiment.operation || 'configuration')}</small></div><span>Authored</span><span>Project manifest</span><span class="engine-status built-in">● Restored</span></div>`).join('') : '<div class="empty-state">Run a built-in experiment to save its authored configuration here.</div>'}</section>
    <div class="section-title"><div><span class="eyebrow">WORKBENCH</span><h2>Choose a discipline</h2></div><span>${modules.length - 2} specialist labs</span></div>
    <section class="module-grid">
      ${modules.slice(1, -1).map((item, index) => `<button class="module-card" data-module="${item.id}" style="--card:${item.color}"><span class="module-index">${String(index + 1).padStart(2, '0')}</span><span class="module-icon">${item.icon}</span><h3>${item.name}</h3><p>${item.description}</p><span class="open-label">Open workspace <b>↗</b></span></button>`).join('')}
    </section>
    <div class="section-title"><div><span class="eyebrow">ENGINE ROOM</span><h2>Open-source capabilities</h2></div><div><button class="text-button" data-action="open-toolchains">Toolchains</button><button class="text-button" data-action="engine-info">How connectors work</button></div></div>
    <section class="engine-table">
      ${engines.map((engine) => `<div class="engine-row"><span class="engine-logo">${engine.name.slice(0, 2).toUpperCase()}</span><div><b>${engine.name}</b><small>${engine.capability}</small></div><span>${engine.area}</span><span>${engine.license}</span><span class="engine-status ${engine.status}">${engine.status === 'built-in' ? '● Built in' : engine.status === 'unsupported' ? '⊘ Unsupported' : '○ Unavailable'}</span></div>`).join('')}
    </section>
  </div>`;
}

function circuitSymbol(part) {
  if (part.type === 'resistor') return '<svg viewBox="0 0 90 38"><path d="M2 19h12l7-12 11 24L43 7l11 24L65 7l8 12h15"/></svg>';
  if (part.type === 'voltage') return '<svg viewBox="0 0 90 46"><path d="M1 23h20m48 0h20M21 23a24 24 0 1 0 48 0 24 24 0 1 0-48 0m18-8h12m-6-6v12m-6 12h12"/></svg>';
  if (part.type === 'current') return '<svg viewBox="0 0 90 46"><path d="M1 23h20m48 0h20M21 23a24 24 0 1 0 48 0 24 24 0 1 0-48 0m24-12v24m-6-8 6 8 6-8"/></svg>';
  if (part.type === 'ground') return '<svg viewBox="0 0 90 46"><path d="M45 2v21M27 23h36M33 30h24M39 37h12"/></svg>';
  if (part.type === 'capacitor') return '<svg viewBox="0 0 90 38"><path d="M2 19h36m0-15v30m14-30v30m0-15h36"/></svg>';
  if (part.type === 'inductor') return '<svg viewBox="0 0 90 38"><path d="M2 21h12c0-20 16-20 16 0 0-20 16-20 16 0 0-20 16-20 16 0h26"/></svg>';
  if (part.type === 'switch') return '<svg viewBox="0 0 90 38"><path d="M2 19h25m36 0h25M27 19 58 7"/></svg>';
  if (part.type === 'npn') return '<svg viewBox="0 0 90 46"><path d="M2 23h28M30 10v26M30 17l22-11h36M30 29l22 11h36M44 33.5l8 6.5-10 1"/></svg>';
  if (part.type === 'pnp') return '<svg viewBox="0 0 90 46"><path d="M2 23h28M30 10v26M30 17l22-11h36M30 29l22 11h36M38 37l-8-8 11-1"/></svg>';
  if (part.type === 'nmos' || part.type === 'pmos') return `<svg viewBox="0 0 90 46"><path d="M2 23h20M22 11v24M29 8v8M29 19v8M29 30v8M29 12h23V6h36M29 34h23v6h36M29 23h23v17${part.type === 'nmos' ? 'M35 19l-6 4 6 4' : 'M44 19l6 4-6 4'}"/></svg>`;
  if (part.type === 'opamp') return '<svg viewBox="0 0 90 46"><path d="M22 3v40l46-20zM2 13h20M2 33h20M68 23h20M26 13h7M29.5 9.5v7M26 33h7"/></svg>';
  return `<span class="simple-symbol">${part.type === 'led' ? '↗|▷' : '|▷'}</span>`;
}

function renderWires(parts, wires = [], netLabels = [], junctions = []) {
  const lines = [];
  const nodesOf = (part) => nodeFields(part).map((field) => part[field]).filter(Boolean).map((node) => normalizeNode(node));
  const nodes = [...new Set(parts.flatMap(nodesOf).filter((node) => node !== '0'))];
  for (const node of nodes) {
    const connected = parts.filter((part) => nodesOf(part).includes(node));
    for (let i = 0; i < connected.length - 1; i += 1) {
      const a = connected[i], b = connected[i + 1];
      lines.push(`<path d="${orthogonalPath({ x: a.x + 45, y: a.y + 25 }, { x: b.x + 45, y: b.y + 25 })}"/><circle cx="${b.x + 45}" cy="${b.y + 25}" r="3"/>`);
    }
  }
  for (const segment of buildWireSegments(parts, wires)) {
    const selected = circuitEditor.selectedWire?.from === segment.fromNode && circuitEditor.selectedWire?.to === segment.toNode;
    const route = segment.route || defaultWireRoute(segment.from, segment.to);
    lines.push(`<path class="authored-wire${selected ? ' selected' : ''}" data-wire-route-from="${esc(segment.fromNode)}" data-wire-route-to="${esc(segment.toNode)}" role="button" tabindex="0" aria-label="Wire ${esc(segment.fromNode)} to ${esc(segment.toNode)}" aria-keyshortcuts="Enter Space Insert + R 0 Delete" d="${orthogonalPath(segment.from, segment.to, route)}"/><circle cx="${segment.to.x}" cy="${segment.to.y}" r="3"/>`);
    if (selected) {
      for (const handle of wireRouteHandles(segment.from, segment.to, route)) {
        const pointIndex = handle.axis === 'point' ? ` data-wire-point-index="${handle.index}"` : '';
        const label = handle.axis === 'point' ? `Move wire bend ${handle.index + 1}` : `Move ${handle.axis === 'x' ? 'vertical' : 'horizontal'} wire segment`;
        lines.push(`<circle class="wire-route-handle" data-wire-handle-from="${esc(segment.fromNode)}" data-wire-handle-to="${esc(segment.toNode)}" data-wire-axis="${handle.axis}"${pointIndex} data-from-x="${segment.from.x}" data-from-y="${segment.from.y}" data-to-x="${segment.to.x}" data-to-y="${segment.to.y}" role="button" tabindex="0" aria-label="${label}" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Delete" cx="${handle.x}" cy="${handle.y}" r="7"/>`);
      }
    }
  }
  for (const label of netLabels) {
    if (!Number.isFinite(label?.x) || !Number.isFinite(label?.y) || typeof label?.text !== 'string') continue;
    lines.push(`<g class="net-label" data-net-label-id="${esc(label.id)}" data-marker-x="${label.x}" data-marker-y="${label.y}" role="button" tabindex="0" aria-label="Net label ${esc(label.text)}"><circle cx="${label.x}" cy="${label.y}" r="4"/><text x="${label.x + 8}" y="${label.y - 8}">${esc(label.text)}</text></g>`);
  }
  for (const junction of junctions) {
    if (!Number.isFinite(junction?.x) || !Number.isFinite(junction?.y)) continue;
    lines.push(`<circle class="junction-marker" data-junction-id="${esc(junction.id)}" data-marker-x="${junction.x}" data-marker-y="${junction.y}" role="button" tabindex="0" aria-label="Junction ${esc(junction.node)}" cx="${junction.x}" cy="${junction.y}" r="5"/>`);
  }
  return `<svg class="wire-layer">${lines.join('')}</svg>`;
}

function buildErcCanvasIssues(parts, wires, netLabels, diagnostics) {
  const issues = new Map();
  const targets = diagnostics.map((diagnostic) => locateElectricalRuleDiagnostic(parts, wires, netLabels, diagnostic));
  diagnostics.forEach((diagnostic, index) => {
    for (const target of targets[index]) {
      const issue = issues.get(target.componentId) || { codes: new Set(), pins: new Map() };
      issue.codes.add(diagnostic.code);
      if (target.pin) {
        const pinCodes = issue.pins.get(target.pin) || new Set();
        pinCodes.add(diagnostic.code);
        issue.pins.set(target.pin, pinCodes);
      }
      issues.set(target.componentId, issue);
    }
  });
  return { issues, targets };
}

function renderCircuitPart(part, selectedIds, issues) {
  const issue = issues.get(part.id);
  const codes = issue ? [...issue.codes].sort().join(', ') : '';
  const pin = (name, label) => {
    const pinCodes = issue?.pins.get(name);
    const error = pinCodes?.size ? `, ERC: ${[...pinCodes].sort().join(', ')}` : '';
    return `<span class="canvas-pin pin-${name}${pinCodes?.size ? ' erc-error' : ''}" role="button" tabindex="0" data-canvas-node="${esc(part.id)}:${name}" aria-label="${esc(part.label)} ${label} terminal${esc(error)}"${pinCodes?.size ? ` aria-invalid="true" title="${esc([...pinCodes].sort().join(', '))}"` : ''}></span>`;
  };
  const fields = nodeFields(part);
  const threePin = fields.length === 3;
  const pinClass = threePin ? (part.type === 'opamp' ? ' pins-opamp' : ' pins-transistor') : '';
  const pins = threePin ? fields.map((field) => pin(field, componentPinName(part, field))).join('') : `${pin('n1', 'positive')}${pin('n2', 'negative')}`;
  const nodeText = threePin ? fields.map((field) => esc(part[field] || '—')).join(' · ') : `${esc(part.n1)} → ${esc(part.n2)}`;
  return `<div class="circuit-part${pinClass} ${selectedIds.includes(part.id) ? 'selected' : ''}${issue ? ' erc-error' : ''}" role="button" tabindex="0" data-component-id="${esc(part.id)}" style="left:${part.x}px;top:${part.y}px;--part-rotation:${Number(part.rotation) || 0}deg" aria-label="${esc(part.label)}${issue ? `, ERC: ${esc(codes)}` : ''}" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"${issue ? ` aria-invalid="true" title="${esc(codes)}"` : ''}>${circuitSymbol(part)}<b>${esc(part.label)}</b><small>${fmt(part.value, 6)} ${part.unit}</small><i>${nodeText}</i>${pins}</div>`;
}

function renderCircuit(state) {
  const parts = state.project.circuit.components;
  const erc = checkElectricalRules(parts, state.project.circuit.wires, state.project.circuit.netLabels);
  const ercCanvas = buildErcCanvasIssues(parts, state.project.circuit.wires, state.project.circuit.netLabels, erc);
  const selected = parts.find((part) => part.id === state.selectedComponentId);
  const selectedIds = state.selectedComponentIds?.length ? state.selectedComponentIds : (selected ? [selected.id] : []);
  const ngspice = state.toolchainDetection?.ngspice;
  const ngspiceConfig = ngspiceConfiguration(state);
  const ngspiceReady = desktopBridge.available && state.desktopProject?.project_id && ngspice?.state === 'detected' && ngspice.path && state.processPermissionGranted && state.artifactPermissionGranted;
  const ngspiceReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject ? 'Open a desktop project' : ngspice?.state !== 'detected' ? 'Detect ngspice in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : `Run native ngspice ${ngspiceConfig.operation}`;
  const builtin = builtinConfiguration(state);
  const plotted = ['circuit-transient', 'circuit-ac'].includes(state.simulation?.kind);
  return `<div class="lab-layout${plotted ? ' with-plot' : ''}">
    <div class="lab-toolbar">
      <div><span class="eyebrow">ANALOG + DIGITAL</span><h1>Circuit Lab</h1></div>
      <div class="toolbar-group"><button class="tool active" data-capability-state="built-in">Select <kbd>V</kbd></button><button class="tool" data-action="toggle-grid" data-capability-state="built-in">Grid ${state.project.settings.gridSize || 20}px</button><button class="tool" data-action="fit-canvas" data-capability-state="built-in">Fit</button><button class="tool history-button" data-action="undo" ${canUndoProject() ? '' : 'disabled'} title="Undo (Ctrl/Cmd+Z)">Undo</button><button class="tool history-button" data-action="redo" ${canRedoProject() ? '' : 'disabled'} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button></div>
      <div class="toolbar-group"><button class="button ghost" data-action="clear-circuit">Clear</button><button class="button ghost" data-action="annotate-components">Annotate</button><button class="button ghost" data-action="export-spice">Export SPICE</button><button class="button ghost" data-module="bench" title="Measure this circuit with an oscilloscope, generator, supply and multimeter">Lab bench</button><button class="button run" data-action="simulate">▶ Run ${esc(BUILTIN_ANALYSES[builtin.analysis].button)}</button><button class="button run" data-action="run-ngspice" ${ngspiceReady ? '' : 'disabled'} title="${esc(ngspiceReason)}">Run ngspice · ${esc(ngspiceConfig.operation)}</button></div>
    </div>
    <aside class="component-panel">
      <label class="search"><span>⌕</span><input placeholder="Search components" data-field="component-search"></label>
      <span class="panel-label">BASIC COMPONENTS</span>
      <div class="component-list">${componentPalette.map((part) => `<button data-add-component="${part.type}"><span>${part.symbol}</span><div><b>${part.label}</b><small>${part.defaultValue} ${part.unit}</small></div><i>+</i></button>`).join('')}</div>
      <span class="panel-label example-label">EXAMPLE CIRCUITS</span>
      <div class="example-list">${exampleCircuits.map((example) => `<button data-load-example="${example.id}"><b>${esc(example.name)}</b><small>${esc(example.summary)}</small></button>`).join('')}</div>
      <div class="palette-note"><b>Built-in simulator</b><p>DC operating point, transient and AC analyses for resistors, capacitors, inductors, diodes, LEDs, switches and independent sources. Modified nodal analysis with Newton-Raphson and trapezoidal integration.</p></div>
    </aside>
    <section class="circuit-stage ${state.project.settings.grid ? 'show-grid' : ''}" id="circuit-stage">
      <div class="canvas-badge"><span class="status-dot"></span> SCHEMATIC / MAIN</div>
      <div class="canvas-content" style="transform:translate(${state.canvasView?.x || 0}px,${state.canvasView?.y || 0}px) scale(${state.canvasView?.scale || 1})">
        ${renderWires(parts, state.project.circuit.wires, state.project.circuit.netLabels, state.project.circuit.junctions)}
      ${parts.map((part) => renderCircuitPart(part, selectedIds, ercCanvas.issues)).join('')}
      ${parts.length ? '' : '<div class="empty-canvas"><span>⌁</span><h3>Your canvas is ready</h3><p>Add components from the left panel to begin.</p></div>'}
      <div class="canvas-zoom" aria-label="Canvas zoom controls"><button data-action="zoom-out" aria-label="Zoom out">−</button><span>${Math.round((state.canvasView?.scale || 1) * 100)}%</span><button data-action="zoom-in" aria-label="Zoom in">+</button></div>
      </div>
    </section>
    <aside class="inspector-panel">${selected ? renderInspector(selected) : renderInstrumentPanel(state)}</aside>
    ${renderBottomPanel(state, erc, ercCanvas.targets)}
  </div>`;
}

const DEVICE_HELP = Object.freeze({
  npn: 'Value is the current gain β. Ebers-Moll model, Is = 10 fA, Cje = 8 pF, Cjc = 4 pF, τF = 0.3 ns.',
  pnp: 'Value is the current gain β. Ebers-Moll model, Is = 10 fA, Cje = 8 pF, Cjc = 4 pF, τF = 0.3 ns.',
  nmos: 'Value is the threshold voltage. Level-1 square law, body tied to source, Cgs = 10 pF, Cgd = 2 pF.',
  pmos: 'Value is the threshold magnitude |Vth|. Level-1 square law, body tied to source, Cgs = 10 pF, Cgd = 2 pF.',
  opamp: 'Value is the supply rail ±Vsat. Open-loop gain 200k, 1 MHz gain-bandwidth.',
});

function renderInspector(part) {
  const partNodes = nodeFields(part).map((field) => part[field]);
  const connectedWires = getState().project.circuit.wires.filter((wire) => partNodes.includes(wire.from) || partNodes.includes(wire.to));
  return `<div class="inspector-head"><div><span class="panel-label">INSPECTOR</span><h3>${esc(part.label)}</h3></div><button data-action="deselect">×</button></div>
    <div class="symbol-preview">${circuitSymbol(part)}</div>
    <label>Reference<input data-part-field="label" value="${esc(part.label)}"></label>
    <label>Value<input type="text" inputmode="decimal" data-part-field="value" value="${fmt(part.value, 8)}" aria-describedby="engineering-value-help"><span>${part.unit}</span></label><small id="engineering-value-help" class="field-help">Use SI suffixes such as 1k, 4.7k or 220n.</small>
    ${nodeFields(part).length === 3
    ? `<div class="field-pair three">${nodeFields(part).map((field) => `<label>${esc(capitalize(componentPinName(part, field)))}<input data-part-field="${field}" value="${esc(part[field] || '')}"></label>`).join('')}</div>${['nmos', 'pmos'].includes(part.type) ? `<label>Transconductance K<input type="text" inputmode="decimal" data-part-field="kp" value="${fmt(part.kp ?? 0.02, 8)}"><span>A/V²</span></label>` : ''}<small class="field-help">${esc(DEVICE_HELP[part.type] || '')}</small>`
    : `<div class="field-pair"><label>Positive node<input data-part-field="n1" value="${esc(part.n1)}"></label><label>Negative node<input data-part-field="n2" value="${esc(part.n2)}"></label></div>`}
    <div class="wire-connect"><span class="panel-label">WIRE ALIASES</span><p>${circuitEditor.wireSource ? `Source selected: <code>${esc(circuitEditor.wireSource.node)}</code>. Choose another terminal.` : 'Choose a terminal, then another terminal to connect their node names.'}</p><div class="wire-endpoints">${nodeFields(part).length === 3 ? nodeFields(part).map((field) => `<button class="tool ${circuitEditor.wireSource?.partId === part.id && circuitEditor.wireSource?.field === field ? 'active' : ''}" data-wire-node="${esc(part.id)}:${field}">${esc(componentPinName(part, field).slice(0, 3))} ${esc(part[field] || '')}</button>`).join('') : `<button class="tool ${circuitEditor.wireSource?.partId === part.id && circuitEditor.wireSource?.field === 'n1' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n1">+ ${esc(part.n1)}</button><button class="tool ${circuitEditor.wireSource?.partId === part.id && circuitEditor.wireSource?.field === 'n2' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n2">− ${esc(part.n2)}</button>`}</div>${connectedWires.length ? `<div class="wire-list" aria-label="Connected wires">${connectedWires.map((wire) => `<div class="wire-row"><code>${esc(wire.from)} ↔ ${esc(wire.to)}</code><button class="tool" data-wire-remove-from="${esc(wire.from)}" data-wire-remove-to="${esc(wire.to)}" aria-label="Disconnect ${esc(wire.from)} from ${esc(wire.to)}">Remove</button></div>`).join('')}</div>` : ''}<div class="wire-endpoints"><button class="tool" data-action="add-net-label">Add net label</button><button class="tool" data-action="add-junction">Add junction</button></div></div>
    <div class="inspector-tip"><b>Node convention</b><p>Use <code>0</code> for ground. Components sharing a node name are electrically connected.</p></div>
    <div class="inspector-actions"><button class="button ghost" data-action="rotate-component">Rotate 90°</button><button class="button danger" data-action="delete-component">Delete component</button></div>`;
}

function waveformPath(signal) {
  const points = sampleWaveform(signal);
  const values = points.map((point) => point.v);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return points.map((point, index) => `${index ? 'L' : 'M'} ${(index / (points.length - 1) * 280).toFixed(1)} ${(68 - (point.v - min) / span * 56).toFixed(1)}`).join(' ');
}

const NGSPICE_OPERATIONS = ['operating-point', 'dc-sweep', 'ac-analysis', 'transient'];

function ngspiceConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'circuit-ngspice-analysis')?.inputs || {};
  const operation = NGSPICE_OPERATIONS.includes(saved.operation) ? saved.operation : 'operating-point';
  const sources = state.project.circuit.components.filter((component) => ['voltage', 'current'].includes(component.type));
  const source = sources.some((component) => component.id === saved.source) ? saved.source : (sources[0]?.id || '');
  return {
    operation,
    source,
    start: Number.isFinite(saved.start) ? saved.start : 0,
    stop: Number.isFinite(saved.stop) ? saved.stop : 5,
    step: Number.isFinite(saved.step) && saved.step !== 0 ? saved.step : 0.1,
    points: Number.isInteger(saved.points) ? saved.points : 20,
    startHz: Number.isFinite(saved.startHz) ? saved.startHz : 1,
    stopHz: Number.isFinite(saved.stopHz) ? saved.stopHz : 1_000_000,
    stepTime: Number.isFinite(saved.stepTime) ? saved.stepTime : 0.000001,
    stopTime: Number.isFinite(saved.stopTime) ? saved.stopTime : 0.001,
  };
}

function renderNgspiceConfiguration(state) {
  const config = ngspiceConfiguration(state);
  const sources = state.project.circuit.components.filter((component) => ['voltage', 'current'].includes(component.type));
  const operationFields = config.operation === 'dc-sweep'
    ? `<label>Source<select data-ngspice-field="source">${sources.length ? sources.map((component) => `<option value="${esc(component.id)}" ${component.id === config.source ? 'selected' : ''}>${esc(component.label)} · ${esc(component.id)}</option>`).join('') : '<option value="">No source</option>'}</select></label><label>Start<input type="number" step="any" data-ngspice-field="start" value="${config.start}"></label><label>Stop<input type="number" step="any" data-ngspice-field="stop" value="${config.stop}"></label><label>Step<input type="number" step="any" data-ngspice-field="step" value="${config.step}"></label>`
    : config.operation === 'ac-analysis'
      ? `<label>Excitation source<select data-ngspice-field="source">${sources.length ? sources.map((component) => `<option value="${esc(component.id)}" ${component.id === config.source ? 'selected' : ''}>${esc(component.label)} · ${esc(component.id)}</option>`).join('') : '<option value="">No source</option>'}</select></label><label>Points/decade<input type="number" min="1" max="100000" step="1" data-ngspice-field="points" value="${config.points}"></label><label>Start<input type="number" min="0" step="any" data-ngspice-field="startHz" value="${config.startHz}"><span>Hz</span></label><label>Stop<input type="number" min="0" step="any" data-ngspice-field="stopHz" value="${config.stopHz}"><span>Hz</span></label>`
      : config.operation === 'transient'
        ? `<label>Time step<input type="number" min="0" step="any" data-ngspice-field="stepTime" value="${config.stepTime}"><span>s</span></label><label>Stop time<input type="number" min="0" step="any" data-ngspice-field="stopTime" value="${config.stopTime}"><span>s</span></label>`
        : '<p class="field-help">Calculates the static node voltages and branch currents.</p>';
  return `<div class="signal-controls"><span class="panel-label">NGSPICE JOB</span><label>Analysis<select data-ngspice-field="operation"><option value="operating-point" ${config.operation === 'operating-point' ? 'selected' : ''}>Operating point</option><option value="dc-sweep" ${config.operation === 'dc-sweep' ? 'selected' : ''}>DC sweep</option><option value="ac-analysis" ${config.operation === 'ac-analysis' ? 'selected' : ''}>AC analysis</option><option value="transient" ${config.operation === 'transient' ? 'selected' : ''}>Transient</option></select></label>${operationFields}<small class="field-help">Configuration is authored project data. Results remain generated run evidence.</small></div>`;
}

const BUILTIN_ANALYSES = Object.freeze({
  dc: { label: 'DC operating point', button: 'DC analysis' },
  transient: { label: 'Transient', button: 'transient' },
  ac: { label: 'AC sweep', button: 'AC sweep' },
});
const BUILTIN_STIMULI = Object.freeze({ step: 'Step', sine: 'Sine', pulse: 'Square pulse', dc: 'Constant (DC)' });

function builtinConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'circuit-builtin-analysis')?.inputs || {};
  const sources = state.project.circuit.components.filter((component) => ['voltage', 'current'].includes(component.type));
  const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    analysis: Object.hasOwn(BUILTIN_ANALYSES, saved.analysis) ? saved.analysis : 'dc',
    source: sources.some((component) => component.id === saved.source) ? saved.source : (sources[0]?.id || ''),
    shape: Object.hasOwn(BUILTIN_STIMULI, saved.shape) ? saved.shape : 'step',
    stopTime: positive(saved.stopTime, 0.005),
    timeStep: positive(saved.timeStep, 0.000005),
    frequency: positive(saved.frequency, 1000),
    amplitude: Number.isFinite(saved.amplitude) ? saved.amplitude : null,
    startHz: positive(saved.startHz, 10),
    stopHz: positive(saved.stopHz, 1_000_000),
    pointsPerDecade: Number.isInteger(saved.pointsPerDecade) && saved.pointsPerDecade >= 1 && saved.pointsPerDecade <= 200 ? saved.pointsPerDecade : 20,
  };
}

function renderBuiltinConfiguration(state) {
  const config = builtinConfiguration(state);
  const sources = state.project.circuit.components.filter((component) => ['voltage', 'current'].includes(component.type));
  const sourceOptions = sources.length ? sources.map((component) => `<option value="${esc(component.id)}" ${component.id === config.source ? 'selected' : ''}>${esc(component.label)} · ${esc(component.id)}</option>`).join('') : '<option value="">No source</option>';
  const field = (name, label, value, unit, placeholder = '') => `<label>${label}<input type="text" inputmode="decimal" data-builtin-field="${name}" value="${value === null ? '' : esc(eng(value))}" placeholder="${esc(placeholder)}"><span>${unit}</span></label>`;
  const driven = sources.find((component) => component.id === config.source);
  let fields = '<p class="field-help">Solves node voltages and branch currents. Capacitors are open, inductors are shorts and diodes use an exponential model.</p>';
  if (config.analysis === 'transient') {
    const points = Math.ceil(config.stopTime / config.timeStep) + 1;
    fields = `<div class="field-pair">${field('stopTime', 'Stop time', config.stopTime, 's')}${field('timeStep', 'Time step', config.timeStep, 's')}</div>
      <label>Driven source<select data-builtin-field="source">${sourceOptions}</select></label>
      <label>Waveform<select data-builtin-field="shape">${Object.entries(BUILTIN_STIMULI).map(([value, label]) => `<option value="${value}" ${value === config.shape ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <div class="field-pair">${['sine', 'pulse'].includes(config.shape) ? field('frequency', 'Frequency', config.frequency, 'Hz') : ''}${field('amplitude', 'Amplitude', config.amplitude, driven?.type === 'current' ? 'A' : 'V', driven ? `${eng(Number(driven.value))} (source)` : '')}</div>
      <p class="field-help ${points > 20000 ? 'field-error' : ''}">${points.toLocaleString()} time points${points > 20000 ? ' — limit is 20,000; increase the time step' : ''}. Values accept SI suffixes such as 5m or 10u.</p>`;
  } else if (config.analysis === 'ac') {
    fields = `<label>Input source (1 V AC)<select data-builtin-field="source">${sourceOptions}</select></label>
      <div class="field-pair">${field('startHz', 'Start', config.startHz, 'Hz')}${field('stopHz', 'Stop', config.stopHz, 'Hz')}</div>
      <label>Points per decade<input type="number" min="1" max="200" step="1" data-builtin-field="pointsPerDecade" value="${config.pointsPerDecade}"></label>
      <p class="field-help">Linearized at the DC operating point; every node voltage is the transfer function from the input.</p>`;
  }
  return `<div class="signal-controls"><span class="panel-label">BUILT-IN SIMULATOR</span><label>Analysis<select data-builtin-field="analysis">${Object.entries(BUILTIN_ANALYSES).map(([value, { label }]) => `<option value="${value}" ${value === config.analysis ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${fields}</div>`;
}

function renderTransientResult(result, state) {
  const traces = circuitTraces(result);
  const selected = traces.find((trace) => trace.key === state.circuitPlotTrace) || traces.find((trace) => trace.key === 'V(out)') || traces[0];
  const plotted = selected.unit === 'V' ? [selected, ...traces.filter((trace) => trace.unit === 'V' && trace !== selected)].slice(0, PLOT_COLORS.length) : [selected];
  const series = plotted.map((trace, index) => ({ ...decimate(result.time, trace.values), color: PLOT_COLORS[index], primary: index === 0 }));
  const values = series.flatMap((entry) => entry.ys);
  const stop = result.time.at(-1);
  const xTicks = Array.from({ length: 6 }, (_, index) => ({ position: index / 5, text: eng(stop * index / 5, 's') }));
  const metrics = stepMetrics(result.time, selected.values);
  const periodic = waveformMetrics(selected.values);
  const unit = selected.unit;
  const plot = renderPlotFrame({ title: `${selected.label} vs time`, series, xMin: 0, xMax: stop, xTicks, yRange: niceRange(Math.min(...values), Math.max(...values)), formatY: (value) => eng(value, unit) });
  return `<div class="analysis-view"><div class="analysis-side">
    <div class="result-summary"><span>✓</span><div><b>Transient analysis completed</b><small>${result.time.length.toLocaleString()} points · ${esc(eng(stop, 's'))} · ${esc(BUILTIN_STIMULI[result.stimulus.shape] || result.stimulus.shape)} on ${esc(result.stimulus.sourceId)}</small></div></div>
    <div class="waveform-controls"><label>Trace<select data-circuit-plot="trace">${traces.map((trace) => `<option value="${esc(trace.key)}" ${trace.key === selected.key ? 'selected' : ''}>${esc(trace.label)}</option>`).join('')}</select></label><button class="tool" data-action="export-circuit-csv">Export CSV</button></div>
    <div class="plot-legend">${plotted.map((trace, index) => `<span class="legend-chip" style="--chip:${PLOT_COLORS[index]}">${esc(trace.label)}</span>`).join('')}</div>
    <div class="analysis-readouts">${readout('Final', eng(metrics.final, unit))}${readout('Peak', eng(metrics.peak, unit))}${readout('Minimum', eng(metrics.minimum, unit))}${result.stimulus.shape === 'step' ? `${metrics.riseTime === null ? '' : readout('Rise time 10–90 %', eng(metrics.riseTime, 's'))}${metrics.overshootPercent === null ? '' : readout('Overshoot', `${fmt(metrics.overshootPercent, 2)} %`)}` : `${readout('Peak-to-peak', eng(periodic.peakToPeak, unit))}${readout('Average', eng(periodic.average, unit))}${readout('RMS', eng(periodic.rms, unit))}`}</div>
  </div><div class="analysis-plots">${plot}</div></div>`;
}

function renderAcResult(result, state) {
  const traces = circuitTraces(result);
  const selected = traces.find((trace) => trace.key === state.circuitPlotTrace) || traces.find((trace) => trace.key === 'V(out)') || traces.at(-1);
  const data = result.nodes[selected.node];
  const metrics = bodeMetrics(result.frequency, data.magnitude, data.phase);
  const first = result.frequency[0], last = result.frequency.at(-1);
  const xTicks = decadeTicks(first, last).map((frequency) => ({ position: (Math.log10(frequency) - Math.log10(first)) / (Math.log10(last) - Math.log10(first) || 1), text: eng(frequency, 'Hz') }));
  const xs = result.frequency;
  const magnitude = renderPlotFrame({ title: `${selected.label} magnitude (dB)`, series: [{ xs, ys: metrics.decibels, color: PLOT_COLORS[0], primary: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...metrics.decibels), Math.max(...metrics.decibels)), formatY: (value) => `${fmt(value, 1)} dB` });
  const phase = renderPlotFrame({ title: `${selected.label} phase (°)`, series: [{ xs, ys: metrics.phase, color: PLOT_COLORS[1], primary: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...metrics.phase), Math.max(...metrics.phase)), formatY: (value) => `${fmt(value, 1)}°` });
  return `<div class="analysis-view"><div class="analysis-side">
    <div class="result-summary"><span>✓</span><div><b>AC sweep completed</b><small>${result.frequency.length} points · ${esc(eng(first, 'Hz'))} – ${esc(eng(last, 'Hz'))} · input ${esc(result.inputSourceId)}</small></div></div>
    <div class="waveform-controls"><label>Node<select data-circuit-plot="trace">${traces.map((trace) => `<option value="${esc(trace.key)}" ${trace.key === selected.key ? 'selected' : ''}>${esc(trace.label)}</option>`).join('')}</select></label><button class="tool" data-action="export-circuit-csv">Export CSV</button></div>
    <div class="analysis-readouts">${readout('Peak gain', decibels(metrics.peakDb))}${readout('Peak at', eng(metrics.peakFrequency, 'Hz'))}${readout('Lower −3 dB', metrics.lowerCutoff === null ? '—' : eng(metrics.lowerCutoff, 'Hz'))}${readout('Upper −3 dB', metrics.upperCutoff === null ? '—' : eng(metrics.upperCutoff, 'Hz'))}</div>
  </div><div class="analysis-plots">${magnitude}${phase}</div></div>`;
}

function renderInstrumentPanel(state) {
  const signal = state.project.circuit.signal;
  const dcResult = isDcResult(state.simulation) ? state.simulation : null;
  return `<span class="panel-label">SIMULATION</span><h3>Analysis & instruments</h3>
    ${renderBuiltinConfiguration(state)}
    <div class="instrument scope"><div class="instrument-title"><span>SIGNAL PREVIEW</span><i>GENERATED</i></div><svg viewBox="0 0 280 80" preserveAspectRatio="none"><defs><pattern id="scopeGrid" width="28" height="20" patternUnits="userSpaceOnUse"><path d="M28 0H0V20"/></pattern></defs><rect width="280" height="80" fill="url(#scopeGrid)"/><path class="wave" d="${waveformPath(signal)}"/></svg><div class="scope-readout"><span>${fmt(signal.amplitude)} V amplitude</span><span>${fmt(signal.frequency)} Hz</span></div></div>
    <div class="instrument meter"><div class="instrument-title"><span>MULTIMETER</span><i>DC V</i></div><strong>${dcResult ? fmt(Object.values(dcResult.nodes).at(-1), 4) : '— — —'}<small> V</small></strong><p>${dcResult ? 'Latest solved node voltage' : 'Run analysis to measure'}</p></div>
    ${renderNgspiceConfiguration(state)}
    <div class="signal-controls"><span class="panel-label">SIGNAL GENERATOR</span><label>Waveform<select data-signal-field="shape"><option ${signal.shape === 'sine' ? 'selected' : ''}>sine</option><option ${signal.shape === 'square' ? 'selected' : ''}>square</option><option ${signal.shape === 'triangle' ? 'selected' : ''}>triangle</option></select></label><label>Frequency<input type="number" data-signal-field="frequency" value="${signal.frequency}"><span>Hz</span></label><label>Amplitude<input type="number" data-signal-field="amplitude" value="${signal.amplitude}"><span>V</span></label></div>`;
}

function renderErcDiagnostic(diagnostic, targets = []) {
  const target = targets[0];
  const location = `${diagnostic.source || ''}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}`;
  const source = !diagnostic.source ? '' : target
    ? `<button class="diagnostic-source" data-diagnostic-component="${esc(target.componentId)}"${target.pin ? ` data-diagnostic-pin="${esc(target.pin)}"` : ''}>Source: ${esc(location)}</button>`
    : `<span class="diagnostic-origin">Source: ${esc(location)}</span>`;
  return `<div class="diagnostic ${diagnostic.severity}"><b>${esc(diagnostic.code)}</b><span>${esc(diagnostic.message)}</span>${source}${diagnostic.fix ? `<small>Fix: ${esc(diagnostic.fix)}</small>` : ''}</div>`;
}

function locateNgspiceDiagnostic(project, diagnostic) {
  if (!diagnostic.source) return [];
  const source = diagnostic.source.toLowerCase();
  const component = project.circuit.components.find((candidate) => {
    const prefix = candidate.type === 'voltage' ? 'v' : candidate.type === 'current' ? 'i' : candidate.type === 'resistor' ? 'r' : candidate.type === 'capacitor' ? 'c' : candidate.type === 'inductor' ? 'l' : candidate.type === 'diode' || candidate.type === 'led' ? 'd' : '';
    const spiceReference = candidate.id.toLowerCase().startsWith(prefix) ? candidate.id : `${prefix}${candidate.id}`;
    return [candidate.id, candidate.label, spiceReference].some((value) => value.toLowerCase() === source);
  });
  return component ? [{ componentId: component.id }] : [];
}

function renderNgspiceResult(result, state) {
  if (result.kind === 'scalar-table') {
    const entries = Object.entries(result.measurements || {});
    return `<div class="result-summary"><span>✓</span><div><b>ngspice operating point completed</b><small>${entries.length} measured value${entries.length === 1 ? '' : 's'} · SI units</small></div></div>${entries.map(([name, value]) => `<div class="result-value"><span>${esc(name)}</span><b>${fmt(value, 8)}</b></div>`).join('')}`;
  }
  if (result.kind === 'table' && result.rows?.length && result.columns?.length) {
    const view = normalizeNgspiceView(result, state.ngspiceView || {});
    const xIndex = 0; const yIndex = view.traceIndex;
    const visibleRows = result.rows.slice(view.startIndex, view.endIndex + 1);
    const values = visibleRows.map((row) => row[yIndex]).filter(Number.isFinite);
    const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
    const xValues = visibleRows.map((row) => row[xIndex]); const xMin = Math.min(...xValues); const xMax = Math.max(...xValues); const xSpan = xMax - xMin || 1;
    const path = visibleRows.map((row, index) => `${index ? 'L' : 'M'} ${((row[xIndex] - xMin) / xSpan * 280).toFixed(2)} ${(72 - (row[yIndex] - min) / span * 64).toFixed(2)}`).join(' ');
    const last = result.rows.at(-1);
    const measurement = measureNgspiceCursors(result, view);
    return `<div class="result-summary"><span>✓</span><div><b>ngspice sweep completed</b><small>${result.rows.length} rows · ${result.columns.length} columns · SI units</small></div></div><div class="waveform-controls"><label>Trace<select data-ngspice-view="traceIndex">${result.columns.map((column, index) => index ? `<option value="${index}" ${index === yIndex ? 'selected' : ''}>${esc(column)}</option>` : '').join('')}</select></label><button class="tool" data-action="ngspice-zoom-in">Zoom in</button><button class="tool" data-action="ngspice-zoom-out">Zoom out</button><button class="tool" data-action="ngspice-pan-left">Pan left</button><button class="tool" data-action="ngspice-pan-right">Pan right</button><button class="tool" data-action="export-ngspice-csv">Export CSV</button></div><div class="instrument scope"><div class="instrument-title"><span>${esc(result.columns[yIndex])}</span><i>${esc(result.columns[xIndex])}</i></div><svg viewBox="0 0 280 80" preserveAspectRatio="none" aria-label="ngspice waveform ${esc(result.columns[yIndex])}"><path class="wave" d="${path}"/></svg><div class="scope-readout"><span>Window ${view.startIndex + 1}–${view.endIndex + 1}</span><span>${fmt(min, 6)}…${fmt(max, 6)}</span></div></div><div class="waveform-cursors"><label>Cursor A<input type="range" min="${view.startIndex}" max="${view.endIndex}" value="${view.cursorA}" data-ngspice-view="cursorA"></label><label>Cursor B<input type="range" min="${view.startIndex}" max="${view.endIndex}" value="${view.cursorB}" data-ngspice-view="cursorB"></label><div class="result-value"><span>A · ${esc(result.columns[xIndex])}</span><b>${fmt(measurement.xA, 8)}</b></div><div class="result-value"><span>A · ${esc(result.columns[yIndex])}</span><b>${fmt(measurement.yA, 8)}</b></div><div class="result-value"><span>Δ${esc(result.columns[xIndex])}</span><b>${fmt(measurement.deltaX, 8)}</b></div><div class="result-value"><span>Δ${esc(result.columns[yIndex])}</span><b>${fmt(measurement.deltaY, 8)}</b></div></div>${result.columns.map((column, index) => `<div class="result-value"><span>${esc(column)}</span><b>${fmt(last[index], 8)}</b></div>`).join('')}`;
  }
  return '<div class="console-empty"><span>›_</span><p>ngspice completed without parseable measurement rows.</p></div>';
}

function renderBottomPanel(state, erc = [], ercTargets = []) {
  const result = isDcResult(state.simulation) ? state.simulation : null;
  const builtinPlot = state.simulation?.kind === 'circuit-transient' ? renderTransientResult(state.simulation, state) : state.simulation?.kind === 'circuit-ac' ? renderAcResult(state.simulation, state) : '';
  const nativeResult = state.simulation?.kind === 'ngspice' ? state.simulation.result : null;
  const engineDiagnostics = state.simulation?.kind === 'ngspice-error' ? state.simulation.diagnostics : [];
  const problemCount = erc.length + engineDiagnostics.length;
  const engine = nativeResult || engineDiagnostics.length ? `NGSPICE${state.simulation.engineVersion ? ` · ${state.simulation.engineVersion}` : ''}` : 'OPENENTC-MNA';
  return `<section class="bottom-panel"><div class="bottom-tabs"><button class="active" disabled>Simulation results</button><button ${problemCount ? '' : 'disabled'} title="Electrical-rule and engine diagnostics">Problems <i>${problemCount}</i></button><span></span><small>ENGINE: ${esc(engine)}</small></div><div class="results">
    ${erc.length ? `<div class="diagnostic-list">${erc.map((diagnostic, index) => renderErcDiagnostic(diagnostic, ercTargets[index])).join('')}</div>` : ''}
    ${engineDiagnostics.length ? `<div class="diagnostic-list">${engineDiagnostics.map((diagnostic) => renderErcDiagnostic(diagnostic, locateNgspiceDiagnostic(state.project, diagnostic))).join('')}</div>` : ''}
    ${nativeResult ? renderNgspiceResult(nativeResult, state) : builtinPlot ? builtinPlot : result ? `<div class="result-summary"><span>✓</span><div><b>Analysis completed</b><small>${Object.keys(result.nodes).length} nodes · ${Object.keys(result.currents).length} branches</small></div></div>${Object.entries(result.nodes).map(([node, value]) => `<div class="result-value"><span>V(${esc(node)})</span><b>${fmt(value, 6)} V</b></div>`).join('')}${Object.entries(result.currents).map(([id, value]) => `<div class="result-value"><span>I(${esc(id)})</span><b>${esc(eng(value, 'A'))}</b></div>`).join('')}<div class="result-value"><span>Load power</span><b>${fmt(result.totalPower * 1000, 4)} mW</b></div>${result.warnings?.length ? `<div class="result-value"><span>Warnings</span><b>${esc(result.warnings.join(' · '))}</b></div>` : ''}` : '<div class="console-empty"><span>›_</span><p>Ready. Choose DC, transient or AC in the Built-in simulator panel, then run the analysis.</p></div>'}
  </div></section>`;
}

function selectedArduinoTarget(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'firmware-arduino-target')?.inputs || {};
  const board = state.arduinoInventory?.boards?.find((candidate) => candidate.fqbn === saved.fqbn);
  return board ? { name: board.name, fqbn: board.fqbn } : null;
}

function selectedArduinoPort(state) {
  const port = state.project.experiments.find((experiment) => experiment?.id === 'firmware-arduino-port')?.inputs?.port;
  return typeof port === 'string' && port.trim() && port.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(port) ? port.trim() : '';
}

function renderEmbedded(state) {
  const embedded = state.project.embedded;
  const firmwareReport = state.simulation?.kind === 'firmware' ? state.simulation.report : null;
  const arduinoReport = state.simulation?.kind === 'arduino' ? state.simulation.report : null;
  const arduino = state.toolchainDetection?.['arduino-cli'];
  const inventoryReady = desktopBridge.available && state.desktopProject?.project_id && arduino?.state === 'detected' && arduino.path && state.processPermissionGranted && state.artifactPermissionGranted;
  const target = selectedArduinoTarget(state);
  const port = selectedArduinoPort(state);
  const programmerGranted = Boolean(port && state.arduinoDeviceGrant?.projectId === state.desktopProject?.project_id && state.arduinoDeviceGrant?.permission === 'device-programmer' && state.arduinoDeviceGrant?.target === port);
  const serialGranted = Boolean(port && state.arduinoSerialGrant?.projectId === state.desktopProject?.project_id && state.arduinoSerialGrant?.target === port);
  const serialConfig = state.project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
  const serialBaud = [9600, 19200, 38400, 57600, 115200, 230400].includes(Number(serialConfig.baud)) ? Number(serialConfig.baud) : 115200;
  const serialEncoding = ['utf-8', 'ascii'].includes(serialConfig.encoding) ? serialConfig.encoding : 'utf-8';
  const serialLineEnding = ['none', 'lf', 'cr', 'crlf'].includes(serialConfig.lineEnding) ? serialConfig.lineEnding : 'lf';
  const serialTimestamps = serialConfig.timestamps !== false;
  const serialState = state.arduinoSerial?.state || 'disconnected';
  const serialConnected = serialState === 'connected';
  const arduinoReady = inventoryReady && target;
  const uploadReady = arduinoReady && programmerGranted;
  const uploadState = state.arduinoUpload;
  const arduinoReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : arduino?.state !== 'detected' || !arduino.path ? 'Detect Arduino CLI in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : !state.arduinoInventory ? 'Refresh local Arduino inventory' : !target ? 'Select an installed board target' : `Compile for ${target.name} with project-scoped outputs`;
  const structureOutput = firmwareReport ? (firmwareReport.diagnostics.length ? firmwareReport.diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)} · line ${diagnostic.line}: ${esc(diagnostic.message)}</span>`).join('\n') : '<span class="ok">● Structure looks valid</span>') : '<span class="ok">● Editor ready</span>';
  const compileOutput = arduinoReport ? `${arduinoReport.diagnostics.length ? arduinoReport.diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)}${diagnostic.source ? ` · ${esc(diagnostic.source)}` : ''}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}: ${esc(diagnostic.message)}</span>`).join('\n') : '<span class="ok">● Arduino CLI compile completed</span>'}${arduinoReport.memory.flash ? `\n<span class="muted">Flash: ${fmt(arduinoReport.memory.flash.used)} / ${fmt(arduinoReport.memory.flash.capacity)} bytes</span>` : ''}${arduinoReport.memory.ram ? `\n<span class="muted">RAM: ${fmt(arduinoReport.memory.ram.used)} / ${fmt(arduinoReport.memory.ram.capacity)} bytes</span>` : ''}` : null;
  return `<div class="page embedded-page">
    ${pageHeader(modules[2], 'FIRMWARE WORKBENCH', `<button class="button ghost" data-action="validate-code">✓ Structure check</button><button class="button ghost" data-action="refresh-arduino-inventory" ${inventoryReady ? '' : 'disabled'} title="${esc(inventoryReady ? 'Read installed boards, cores and libraries without installing anything' : arduinoReason)}">Refresh inventory</button><button class="button run" data-action="build-arduino" ${arduinoReady ? '' : 'disabled'} title="${esc(arduinoReason)}">Build with Arduino CLI</button>`)}
    <div class="embedded-layout">
      <aside class="project-tree"><span class="panel-label">PROJECT</span><h3>${esc(state.project.name)}</h3><button class="tree-item open" disabled>⌄ <span>src</span></button><button class="tree-item file" disabled>&nbsp;&nbsp;C++ <span>main.ino</span></button><button class="tree-item" disabled>› <span>libraries ${state.arduinoInventory ? `(${state.arduinoInventory.libraries.length})` : ''}</span></button><button class="tree-item" disabled>› <span>cores ${state.arduinoInventory ? `(${state.arduinoInventory.cores.length})` : ''}</span></button><div class="board-card"><span>EXPLICIT BUILD TARGET</span>${state.arduinoInventory?.boards?.length ? `<select data-field="arduino-board" aria-label="Arduino build target"><option value="">Select board…</option>${state.arduinoInventory.boards.map((board) => `<option value="${esc(board.fqbn)}" ${target?.fqbn === board.fqbn ? 'selected' : ''}>${esc(board.name)} · ${esc(board.fqbn)}</option>`).join('')}</select>` : `<b>◈ ${esc(embedded.board)}</b><button disabled>${state.arduinoInventory ? 'No installed boards found' : 'Refresh inventory to select'}</button>`}</div></aside>
      <section class="code-workspace"><div class="editor-tabs"><button class="active" disabled>main.ino <i>●</i></button><span></span><small>C++ · UTF-8</small></div><div class="code-editor"><div class="line-numbers">${embedded.code.split('\n').map((_, index) => `<span>${index + 1}</span>`).join('')}</div><textarea spellcheck="false" data-field="embedded-code">${esc(embedded.code)}</textarea></div><div class="terminal serial-terminal"><div><span class="panel-label">SERIAL TERMINAL · ${esc(serialState.toUpperCase())}</span><span><button data-action="pause-arduino-serial" ${serialConnected ? '' : 'disabled'}>${state.arduinoSerial?.paused ? 'Resume' : 'Pause'}</button><button data-action="clear-arduino-serial" ${state.arduinoSerial?.text ? '' : 'disabled'}>Clear</button><button data-action="export-arduino-serial" ${state.arduinoSerial?.text ? '' : 'disabled'}>Export</button></span></div><pre aria-live="polite">${state.arduinoSerial?.text ? esc(state.arduinoSerial.text.slice(-32768)) : `<span class="muted">${state.arduinoSerial?.nativeError ? esc(state.arduinoSerial.nativeError) : compileOutput || structureOutput}</span>`}</pre><div class="serial-send"><input data-field="serial-transmit" maxlength="16384" placeholder="Transmit text" ${serialConnected ? '' : 'disabled'}><button data-action="send-arduino-serial" ${serialConnected ? '' : 'disabled'}>Send</button></div></div></section>
      <aside class="device-panel"><span class="panel-label">EXPLICIT DEVICE TARGET</span><div class="board-visual"><div class="usb"></div><div class="board-chip">MCU<br><small>TARGET</small></div><i class="pin p1"></i><i class="pin p2"></i><i class="pin p3"></i></div><h3>${esc(target?.name || 'No board selected')}</h3><p>${esc(target?.fqbn || 'Refresh local inventory and choose an installed board')}</p><label class="device-port-label">Port identifier<input data-field="arduino-port" maxlength="4096" value="${esc(port)}" placeholder="COM4 or /dev/ttyUSB0" ${arduinoReady && !serialConnected && !uploadState ? '' : 'disabled'}></label><div class="serial-config"><label>Baud<select data-serial-config="baud" ${serialConnected ? 'disabled' : ''}>${[9600, 19200, 38400, 57600, 115200, 230400].map((value) => `<option value="${value}" ${serialBaud === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Encoding<select data-serial-config="encoding" ${serialConnected ? 'disabled' : ''}><option value="utf-8" ${serialEncoding === 'utf-8' ? 'selected' : ''}>UTF-8</option><option value="ascii" ${serialEncoding === 'ascii' ? 'selected' : ''}>ASCII</option></select></label><label>Line ending<select data-serial-config="lineEnding" ${serialConnected ? 'disabled' : ''}><option value="none" ${serialLineEnding === 'none' ? 'selected' : ''}>None</option><option value="lf" ${serialLineEnding === 'lf' ? 'selected' : ''}>LF</option><option value="cr" ${serialLineEnding === 'cr' ? 'selected' : ''}>CR</option><option value="crlf" ${serialLineEnding === 'crlf' ? 'selected' : ''}>CRLF</option></select></label><label class="serial-check"><input type="checkbox" data-serial-config="timestamps" ${serialTimestamps ? 'checked' : ''} ${serialConnected ? 'disabled' : ''}> Timestamps</label></div><div class="device-status"><span>Programmer grant</span><b class="${programmerGranted ? '' : 'amber'}">${programmerGranted ? 'Granted' : 'Not granted'}</b><span>Serial grant</span><b class="${serialGranted ? '' : 'amber'}">${serialGranted ? 'Granted' : 'Not granted'}</b><span>Toolchain</span><b class="${arduino?.state === 'detected' ? '' : 'amber'}">${state.arduinoInventory?.version ? `v${esc(state.arduinoInventory.version)}` : arduino?.state === 'detected' ? 'Detected' : 'Not detected'}</b></div><button class="button ghost wide" data-action="${programmerGranted ? 'revoke-arduino-programmer' : 'grant-arduino-programmer'}" ${!uploadState && (programmerGranted || (arduinoReady && port)) ? '' : 'disabled'}>${programmerGranted ? `Revoke programmer access for ${esc(port)}` : 'Review programmer access'}</button>${uploadState ? `<button class="button ghost wide" data-action="cancel-arduino-upload" ${uploadState.phase === 'cancelling' ? 'disabled' : ''}>${uploadState.phase === 'cancelling' ? 'Cancelling…' : `Cancel ${uploadState.phase}`}</button>` : `<button class="button primary wide" data-action="upload-arduino" ${uploadReady ? '' : 'disabled'}>Compile + Upload</button>`}<button class="button ghost wide" data-action="${serialGranted ? 'revoke-arduino-serial' : 'grant-arduino-serial'}" ${!uploadState && (serialGranted || (arduinoReady && port)) ? '' : 'disabled'}>${serialGranted ? `Revoke serial access for ${esc(port)}` : 'Review serial access'}</button><button class="button primary wide" data-action="${serialConnected ? 'disconnect-arduino-serial' : serialState === 'reconnecting' ? 'reconnect-arduino-serial' : 'connect-arduino-serial'}" ${serialGranted && !uploadState ? '' : 'disabled'}>${serialConnected ? 'Disconnect terminal' : serialState === 'reconnecting' ? 'Reconnect terminal' : 'Connect terminal'}</button><div class="inspector-tip"><b>${uploadState ? `Arduino job ${uploadState.phase}` : desktopBridge.available ? 'Desktop safety boundary' : 'Browser preview'}</b><p>${uploadState ? `Target ${esc(uploadState.port)} · ${esc(uploadState.runId)}` : desktopBridge.available ? 'The port is entered manually; no connected-device scan runs. Upload and serial use separate, revocable target grants.' : 'Native compilation and hardware access are unavailable in the browser preview.'}</p></div></aside>
    </div>
  </div>`;
}

const moduleDetails = {
  pcb: { label: 'BOARD DESIGN', stats: [['Layers', '2'], ['Design rules', 'Default'], ['Nets', '3']], steps: ['Capture schematic', 'Assign footprints', 'Route board', 'Run design checks', 'Export fabrication files'], engine: 'KiCad', visual: 'board' },
  fpga: { label: 'RTL PIPELINE', stats: [['Top module', 'counter'], ['Target', 'Generic'], ['Clock', '50 MHz']], steps: ['Write Verilog/VHDL', 'Simulate testbench', 'Synthesize with Yosys', 'Place and route', 'Program target'], engine: 'Yosys + nextpnr', visual: 'logic' },
  dsp: { label: 'SIGNAL NOTEBOOK', stats: [['Samples', '2048'], ['Rate', '48 kHz'], ['Window', 'Hann']], steps: ['Generate signal', 'Add channel model', 'Apply filter', 'Inspect FFT', 'Export results'], engine: 'Octave / SciPy', visual: 'signal' },
  communication: { label: 'LINK LAB', stats: [['Modulation', 'QPSK'], ['SNR', '18 dB'], ['Rate', '1 Mbps']], steps: ['Create source', 'Encode bits', 'Modulate carrier', 'Pass through channel', 'Measure BER'], engine: 'GNU Radio', visual: 'blocks' },
  rf: { label: 'RF WORKBENCH', stats: [['Frequency', '2.4 GHz'], ['Impedance', '50 Ω'], ['VSWR', '1.00']], steps: ['Define source/load', 'Plot Smith chart', 'Create match', 'Sweep frequency', 'Export network'], engine: 'OpenENTC calculators', visual: 'smith' },
  iot: { label: 'CONNECTED SYSTEMS', stats: [['Devices', '3'], ['Broker', 'Local'], ['Messages', '0']], steps: ['Add sensors', 'Configure controller', 'Create data flow', 'Connect MQTT', 'Build dashboard'], engine: 'Open protocols', visual: 'nodes' },
  network: { label: 'PACKET LAB', stats: [['Nodes', '4'], ['Links', '3'], ['Packets', '0']], steps: ['Create topology', 'Set addresses', 'Configure routes', 'Generate traffic', 'Inspect packets'], engine: 'Wireshark connector', visual: 'network' }
};

function moduleGraphic(type) {
  if (type === 'signal') return '<svg class="feature-svg" viewBox="0 0 700 260"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="var(--active-color)" stop-opacity=".45"/><stop offset="1" stop-color="var(--active-color)" stop-opacity="0"/></linearGradient></defs><path class="area" d="M0 160 C50 20 90 240 140 120 S230 30 280 150 S370 240 430 90 S520 15 570 145 S650 235 700 95 V260H0Z"/><path class="trace" d="M0 160 C50 20 90 240 140 120 S230 30 280 150 S370 240 430 90 S520 15 570 145 S650 235 700 95"/></svg>';
  if (type === 'smith') return '<div class="smith-chart"><i></i><i></i><i></i><i></i><span>50 Ω</span></div>';
  if (type === 'board') return '<div class="pcb-art"><span class="chip c1">U1</span><span class="chip c2">U2</span><span class="pad a"></span><span class="pad b"></span><span class="pad c"></span><i></i><i></i><i></i></div>';
  if (type === 'logic') return '<div class="logic-art"><span>CLK</span><i></i><span>COUNTER</span><i></i><span>LED[3:0]</span></div>';
  if (type === 'blocks') return '<div class="block-art"><span>DATA</span><i>→</i><span>QPSK</span><i>→</i><span>AWGN</span><i>→</i><span>BER</span></div>';
  return '<div class="node-art"><span>01</span><span>02</span><span>03</span><span>04</span><i></i><i></i><i></i></div>';
}


function renderEngineeringModule(module) {
  const detail = moduleDetails[module.id];
  return `<div class="page scroll-page specialist-page">
    ${pageHeader(module, detail.label, '<button class="button ghost" disabled>Save unavailable</button><button class="button run" disabled>Engine unavailable</button>')}
    <section class="specialist-hero"><div class="specialist-visual">${moduleGraphic(detail.visual)}<span class="engine-chip">PLANNED ENGINE · ${detail.engine}</span></div><div class="experiment-panel"><span class="panel-label">WORKFLOW PREVIEW</span><h2>${module.name} starter</h2><p>This screen is a non-executable preview. Its specialist engine is not detected or integrated.</p><ol>${detail.steps.map((step, index) => `<li><span>${index + 1}</span>${step}<i>${index === 0 ? 'PLANNED' : ''}</i></li>`).join('')}</ol><button class="button primary wide" disabled>Unavailable in this alpha</button></div></section>
    <section class="stat-grid">${detail.stats.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong><small>Project default</small></div>`).join('')}<div><span>Connector</span><strong>${detail.engine}</strong><small>External engine boundary</small></div></section>
    <section class="module-info-grid"><article><span class="eyebrow">TARGET ARCHITECTURE</span><h3>One project, shared context</h3><p>Future design data, configuration and notes will share the OpenENTC project. Exchange adapters will isolate third-party formats and licences.</p></article><article><span class="eyebrow">CURRENT STATUS</span><h3>Unavailable</h3><p>This phase records the intended workflow only. No specialist operation can run from this screen.</p></article></section>
  </div>`;
}













// ---------------------------------------------------------------------------
// Microcontroller Lab: 8051 trainer (assembler, simulator, board, serial terminal).



// ---------------------------------------------------------------------------
// Lab Bench: function generator, bench supply, oscilloscope and multimeter on the Circuit Lab schematic.




// ---------------------------------------------------------------------------
// Lab records: a practical-journal PDF built from the project's circuit, bench captures,
// simulations and programs.

const RECORD_TEMPLATES = Object.freeze({
  blank: { name: 'Blank record', title: '', aim: '', apparatus: '', theory: '', procedure: '', conclusion: '' },
  'rc-lowpass': {
    name: 'RC low-pass filter', title: 'Frequency response of a first-order RC low-pass filter',
    aim: 'To study the frequency response of a first-order RC low-pass filter and to find its cut-off frequency.',
    apparatus: 'Function generator\nDual-trace oscilloscope\nResistor 1 kΩ, capacitor 1 µF\nBreadboard and connecting wires',
    theory: 'A series resistor R followed by a shunt capacitor C passes low frequencies and attenuates high ones. The transfer function is H(jω) = 1 / (1 + jωRC), so |H| = 1 / √(1 + (f/fc)²) and the phase is −tan⁻¹(f/fc), where the cut-off frequency is fc = 1 / (2πRC). At fc the output is 0.707 times the input (−3 dB) and lags it by 45°. Above fc the gain falls by 20 dB per decade.',
    procedure: 'Connect the circuit as shown.\nSet the function generator to a 2 Vpp sine wave.\nConnect CH1 of the oscilloscope to the input and CH2 to the output.\nVary the frequency and note the output amplitude and the phase difference.\nCalculate the gain in dB and plot it against frequency on a log scale.\nFind the frequency at which the gain is −3 dB.',
    conclusion: 'The measured cut-off frequency agrees with fc = 1/(2πRC); the output lags the input by 45° at fc.',
  },
  'half-wave-rectifier': {
    name: 'Half-wave rectifier with capacitor filter', title: 'Half-wave rectifier with capacitor filter',
    aim: 'To study a half-wave rectifier with a capacitor filter and to measure its DC output voltage and ripple.',
    apparatus: 'Function generator (or step-down transformer)\nOscilloscope and digital multimeter\nDiode 1N4007, capacitor 100 µF, resistor 1 kΩ',
    theory: 'The diode conducts only during the positive half-cycle, so the load receives a pulsating DC. A capacitor across the load charges to nearly the peak voltage Vm − Vγ and discharges through the load while the diode is off. The peak-to-peak ripple is approximately Vr = Vdc / (f·R·C) and the ripple factor is γ = 1 / (2√3·f·R·C) for a half-wave rectifier.',
    procedure: 'Connect the circuit as shown.\nApply a 50 Hz sine wave of 20 Vpp.\nObserve the input on CH1 and the output on CH2.\nMeasure the DC output voltage with the multimeter.\nMeasure the peak-to-peak ripple using AC coupling on the oscilloscope.\nCalculate the ripple factor.',
    conclusion: 'The capacitor filter raises the DC output close to the peak value and the measured ripple agrees with Vr ≈ Vdc/(fRC).',
  },
  'inverting-opamp': {
    name: 'Inverting amplifier (op-amp)', title: 'Inverting amplifier using an op-amp',
    aim: 'To design an inverting amplifier of gain −10 and to verify its gain and phase.',
    apparatus: 'Op-amp IC 741 with ±12 V supply\nResistors 1 kΩ and 10 kΩ\nFunction generator, oscilloscope',
    theory: 'With negative feedback the inverting input is a virtual ground, so the input current Vin/R1 flows through Rf and Vout = −(Rf/R1)·Vin. The output is 180° out of phase with the input. The closed-loop bandwidth is the gain-bandwidth product divided by the noise gain (1 + Rf/R1).',
    procedure: 'Connect the circuit with R1 = 1 kΩ and Rf = 10 kΩ.\nApply a 1 kHz sine wave of 1 Vpp.\nObserve input and output on the two channels.\nMeasure the output amplitude and the phase difference.\nCalculate the gain and compare it with −Rf/R1.',
    conclusion: 'The measured gain is close to −Rf/R1 = −10 and the output is inverted (180° phase shift).',
  },
  'rlc-step': {
    name: 'Series RLC transient response', title: 'Transient response of a series RLC circuit',
    aim: 'To observe the step response of a series RLC circuit and to measure its damped frequency.',
    apparatus: 'Function generator (square wave)\nOscilloscope\nResistor 20 Ω, inductor 10 mH, capacitor 1 µF',
    theory: 'For a series RLC circuit the natural frequency is ωn = 1/√(LC) and the damping ratio is ζ = (R/2)·√(C/L). When ζ < 1 the capacitor voltage rings at the damped frequency ωd = ωn·√(1 − ζ²) while the oscillation decays with time constant 2L/R.',
    procedure: 'Connect the circuit as shown.\nApply a 100 Hz square wave of 5 Vpp with 2.5 V offset.\nObserve the capacitor voltage on CH2.\nMeasure the period of the ringing and the overshoot.\nCompare with the calculated damped frequency.',
    conclusion: 'The circuit is under-damped and the measured ringing frequency agrees with ωd = ωn√(1 − ζ²).',
  },
  'ce-amplifier': {
    name: 'BJT common-emitter amplifier', title: 'Single-stage BJT common-emitter amplifier',
    aim: 'To measure the voltage gain of a voltage-divider biased common-emitter amplifier.',
    apparatus: 'NPN transistor (β = 100)\nResistors 47 kΩ, 10 kΩ, 2.2 kΩ, 470 Ω, 1 kΩ\nCapacitors 10 µF, 100 µF\nDC power supply 12 V, function generator, oscilloscope, multimeter',
    theory: 'The voltage divider fixes the base voltage, setting the Q-point. With the emitter resistor bypassed, the mid-band voltage gain is Av = −gm·RC = −(IC/VT)·RC, and the output is 180° out of phase with the input. Coupling and bypass capacitors set the lower cut-off frequency.',
    procedure: 'Connect the circuit and switch on the 12 V supply.\nMeasure the DC collector current and voltages (Q-point).\nApply a 1 kHz sine wave of 20 mVpp at the input.\nObserve input and output and measure the output amplitude.\nCalculate the voltage gain in dB.',
    conclusion: 'The amplifier gives a mid-band gain of about 40 dB with a 180° phase shift, as predicted by Av = −gm·RC.',
  },
  'mcu-8051': {
    name: '8051 assembly program', title: '8051 assembly language program',
    aim: 'To write, assemble and execute an 8051 assembly language program and verify its output.',
    apparatus: 'OpenENTC 8051 simulator (or an 8051 trainer kit)\nPC with assembler',
    theory: 'The 8051 is an 8-bit microcontroller with 4 KB on-chip ROM, 128 bytes of RAM, four 8-bit I/O ports, two 16-bit timers and a full-duplex UART. Programs are written in assembly, converted to machine code by the assembler and executed from address 0000H.',
    procedure: 'Write the program in the editor.\nAssemble it and correct any errors.\nRun the program (or single-step it) and observe registers, ports and peripherals.\nNote the results.',
    conclusion: 'The program was executed successfully and produced the expected output.',
  },
  'mcu-arduino': {
    name: 'Arduino sketch', title: 'Interfacing with Arduino Uno (ATmega328P)',
    aim: 'To write an Arduino sketch, run it on the ATmega328P and verify its output.',
    apparatus: 'Arduino Uno (or the OpenENTC Uno simulator)\nArduino IDE / CLI\nLEDs, resistors, push buttons as required',
    theory: 'The Arduino Uno uses the 8-bit AVR ATmega328P running at 16 MHz with 32 KB flash, 2 KB SRAM, 14 digital I/O pins (6 with PWM) and 6 analogue inputs. A sketch has setup(), which runs once, and loop(), which runs repeatedly.',
    procedure: 'Write the sketch.\nCompile it and upload the HEX file.\nRun it and observe the pins, LEDs and serial monitor.\nNote the results.',
    conclusion: 'The sketch ran as expected on the ATmega328P.',
  },
});
const RECORD_DEFAULTS = Object.freeze({
  template: 'blank', institute: '', department: 'Department of Electronics & Telecommunication Engineering', course: '',
  name: '', roll: '', className: '', batch: '', number: '', date: '', title: '', aim: '', apparatus: '', theory: '', procedure: '',
  observations: '', calculations: '', result: '', conclusion: '',
  include: { circuit: true, bench: true, simulation: true, program8051: false, sketch: false, assessment: true },
});

function recordConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'lab-record')?.inputs || {};
  return { ...structuredClone(RECORD_DEFAULTS), ...saved, include: { ...RECORD_DEFAULTS.include, ...(saved.include || {}) } };
}

function persistRecord(patch) {
  const next = { ...recordConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The record text is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'lab-record', kind: 'report', operation: 'lab-record', inputs: next });
}

const PART_UNITS = { voltage: 'V', current: 'A', resistor: 'Ω', capacitor: 'F', inductor: 'H' };

/** Parse the observation text: first line is the header, cells split by | , or tab. */
function parseObservationTable(text) {
  const rows = lines(text).map((line) => line.split(/\s*[|\t]\s*|\s*,\s*/).map((cell) => cell.trim()));
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map((row) => row.length));
  return { columns: rows[0].concat(Array(width - rows[0].length).fill('')), rows: rows.slice(1).map((row) => row.concat(Array(width - row.length).fill(''))) };
}

/** The data each section of the record can draw on, with a short description for the checklist. */
function recordSources(state) {
  const parts = state.project.circuit.components.filter((part) => part.type !== 'ground');
  const sources = {};
  if (parts.length) sources.circuit = { label: `Circuit diagram data · ${parts.length} components`, blocks: () => [{ type: 'heading', text: 'Circuit components' }, { type: 'table', caption: 'Component list (from Circuit Lab)', columns: ['Ref.', 'Component', 'Value', 'Connections'], rows: parts.map((part) => [part.label, componentPalette.find((entry) => entry.type === part.type)?.label ?? part.type, PART_UNITS[part.type] ? formatEngineeringValue(Number(part.value), PART_UNITS[part.type], { digits: 4 }).trim() : `${fmt(Number(part.value), 4)} ${part.unit ?? ''}`.trim(), nodeFields(part).map((field) => `${componentPinName(part, field)}: ${part[field]}`).join(', ')]) }] };
  const benchConfig = benchConfiguration(state);
  const hasSource = state.project.circuit.components.some((part) => part.type === 'voltage' || part.type === 'current');
  if (hasSource) {
    const result = benchCompute(state, benchConfig);
    if (result.run) {
      const scope = benchScope(benchConfig, result);
      const used = scope.channels.map((channel, index) => ({ channel, index, values: scope.traceValues[index], m: scope.measurements[index] })).filter((entry) => entry.values);
      if (used.length) sources.bench = { label: `Lab Bench oscilloscope capture · ${used.map((entry) => `CH${entry.index + 1} ${entry.channel.node}`).join(', ')}`, blocks: () => {
        const g = benchConfig.generator;
        const pairs = [];
        if (g.enabled && g.sourceId) pairs.push(['Function generator', `${capitalize(g.shape)}, ${eng(g.frequency, 'Hz')}, ${eng(g.vpp, g.shape === 'pulse' ? 'V' : 'Vpp')}${g.offset ? `, offset ${eng(g.offset, 'V')}` : ''} on ${g.sourceId} (${g.impedance === '50' ? '50 Ω' : 'High-Z'} output)`]);
        (result.status || []).forEach((status) => pairs.push([`Power supply on ${status.sourceId}`, `${fmt(status.volts, 4)} V, ${eng(status.amps, 'A')} (${status.mode})`]));
        pairs.push(['Oscilloscope', `${eng(benchConfig.scope.tdiv, 's')}/div; ${used.map((entry) => `CH${entry.index + 1} = V(${entry.channel.node}) at ${eng(entry.channel.vdiv, 'V')}/div ${entry.channel.coupling.toUpperCase()}`).join('; ')}`]);
        const time = result.run.time;
        const series = used.map((entry) => { const xs = [], ys = []; for (let k = 0; k < time.length; k += 1) if (time[k] >= scope.start && time[k] <= scope.start + result.span) { xs.push((time[k] - scope.start) * 1000); ys.push(entry.values[k]); } return { name: `CH${entry.index + 1}: V(${entry.channel.node})`, xs, ys }; });
        const quantity = (label, pick) => [label, ...used.map((entry) => (entry.m ? pick(entry.m) : '—'))];
        const rows = [quantity('Peak-to-peak', (m) => eng(m.pp, 'V')), quantity('Maximum', (m) => eng(m.max, 'V')), quantity('Minimum', (m) => eng(m.min, 'V')), quantity('Mean (DC)', (m) => eng(Math.abs(m.mean) < m.pp * 1e-6 ? 0 : m.mean, 'V')), quantity('RMS of AC part', (m) => eng(m.acRms, 'V')), quantity('Frequency', (m) => (m.frequency ? eng(m.frequency, 'Hz') : '—')), quantity('Duty cycle', (m) => (m.duty === null ? '—' : `${fmt(m.duty * 100, 3)} %`))];
        const blocks = [{ type: 'heading', text: 'Observations (oscilloscope)' }, { type: 'keyvalue', pairs }, { type: 'plot', title: 'Oscilloscope capture', xLabel: 'Time (ms)', yLabel: 'Voltage (V)', series }, { type: 'table', caption: 'Automatic measurements', columns: ['Quantity', ...used.map((entry) => `CH${entry.index + 1}: V(${entry.channel.node})`)], rows, align: ['left', 'right', 'right'] }];
        if (used.length === 2 && used[0].m && used[1].m) {
          const gain = used[1].m.pp / used[0].m.pp;
          const phase = phaseDifference(used[0].m.window.time, used[0].m.window.v, used[1].m.window.v);
          blocks.push({ type: 'keyvalue', pairs: [['Gain (CH2 / CH1)', `${fmt(gain, 4)} = ${fmt(20 * Math.log10(gain), 2)} dB`], ['Phase of CH2 relative to CH1', phase === null ? '—' : `${fmt(phase, 1)}°`]] });
        }
        return blocks;
      } };
    }
  }
  const simulation = state.simulation;
  if (simulation?.kind === 'circuit-transient') {
    const traces = circuitTraces(simulation).filter((trace) => trace.unit === 'V').slice(0, 4);
    sources.simulation = { label: `Circuit Lab transient analysis · ${traces.map((trace) => trace.label).join(', ')}`, blocks: () => [{ type: 'heading', text: 'Simulation (transient)' }, { type: 'plot', title: 'Transient response', xLabel: 'Time (ms)', yLabel: 'Voltage (V)', series: traces.map((trace) => ({ name: trace.label, xs: simulation.time.map((t) => t * 1000), ys: trace.values })) }] };
  } else if (simulation?.kind === 'circuit-ac') {
    const nodes = Object.keys(simulation.nodes).filter((name) => name !== '0').slice(0, 4);
    sources.simulation = { label: `Circuit Lab AC sweep · ${nodes.map((name) => `V(${name})`).join(', ')}`, blocks: () => [{ type: 'heading', text: 'Simulation (frequency response)' }, { type: 'plot', title: 'Magnitude response', xLabel: 'Frequency (Hz)', yLabel: 'Gain (dB)', logX: true, series: nodes.map((name) => ({ name: `V(${name})`, xs: simulation.frequency, ys: simulation.nodes[name].magnitude.map((value) => 20 * Math.log10(Math.max(value, 1e-12))) })) }, { type: 'plot', title: 'Phase response', xLabel: 'Frequency (Hz)', yLabel: 'Phase (°)', logX: true, series: nodes.map((name) => ({ name: `V(${name})`, xs: simulation.frequency, ys: simulation.nodes[name].phase })) }] };
  } else if (isDcResult(simulation)) {
    sources.simulation = { label: `Circuit Lab DC operating point · ${Object.keys(simulation.nodes).length} nodes`, blocks: () => [{ type: 'heading', text: 'Simulation (DC operating point)' }, { type: 'table', caption: 'Node voltages and branch currents', columns: ['Quantity', 'Value'], align: ['left', 'right'], rows: [...Object.entries(simulation.nodes).map(([node, value]) => [`V(${node})`, `${fmt(value, 6)} V`]), ...Object.entries(simulation.currents).map(([id, value]) => [`I(${id})`, eng(value, 'A')])] }] };
  }
  const mcu = mcuConfiguration(state);
  sources.program8051 = { label: '8051 program from the Microcontroller Lab', blocks: () => {
    const output = mcuRuntime?.cpu?.serialOutput?.length ? String.fromCharCode(...mcuRuntime.cpu.serialOutput.slice(-2000)) : '';
    return [{ type: 'heading', text: 'Program (8051 assembly)' }, { type: 'code', text: mcu.source }, ...(output ? [{ type: 'code', title: 'Serial output', text: output }] : [])];
  } };
  const sketch = AVR_EXAMPLES.find((example) => example.id === mcu.avrExampleId);
  if (sketch) sources.sketch = { label: `Arduino sketch “${sketch.name}”`, blocks: () => {
    const output = unoRuntime?.board?.mcu?.usart?.output?.length ? String.fromCharCode(...unoRuntime.board.mcu.usart.output.slice(-2000)) : '';
    return [{ type: 'heading', text: 'Program (Arduino sketch)' }, { type: 'code', title: `${sketch.id}.ino`, text: sketch.source }, ...(output ? [{ type: 'code', title: 'Serial monitor', text: output }] : [])];
  } };
  return sources;
}

function buildRecordDocument(state) {
  const config = recordConfiguration(state);
  const sources = recordSources(state);
  const blocks = [];
  const text = (heading, value) => { if (String(value || '').trim()) blocks.push({ type: 'heading', text: heading }, { type: 'paragraph', text: value }); };
  const items = (heading, value, ordered) => { const entries = lines(value); if (entries.length) blocks.push({ type: 'heading', text: heading }, { type: 'list', items: entries, ordered }); };
  text('Aim', config.aim);
  items('Apparatus / software', config.apparatus, false);
  text('Theory', config.theory);
  if (config.include.circuit && sources.circuit) blocks.push(...sources.circuit.blocks());
  items('Procedure', config.procedure, true);
  const table = parseObservationTable(config.observations);
  if (table) blocks.push({ type: 'heading', text: 'Observation table' }, { type: 'table', ...table });
  for (const key of ['bench', 'simulation', 'program8051', 'sketch']) if (config.include[key] && sources[key]) blocks.push(...sources[key].blocks());
  text('Calculations', config.calculations);
  text('Result', config.result);
  text('Conclusion', config.conclusion);
  return buildLabRecord({ institute: config.institute, department: config.department, course: config.course, student: { name: config.name, roll: config.roll, className: config.className, batch: config.batch }, experiment: { number: config.number, title: config.title || 'Untitled experiment', date: config.date }, blocks, assessment: config.include.assessment });
}

/** Suggested result sentence from the bench measurements. */
function suggestedResult(state) {
  const config = benchConfiguration(state);
  const result = benchCompute(state, config);
  if (!result.run) return '';
  const scope = benchScope(config, result);
  const [a, b] = scope.measurements;
  if (a && b) {
    const gain = b.pp / a.pp;
    const phase = phaseDifference(a.window.time, a.window.v, b.window.v);
    return `At ${a.frequency ? eng(a.frequency, 'Hz') : 'the applied frequency'} the measured gain V(${scope.channels[1].node})/V(${scope.channels[0].node}) is ${fmt(gain, 4)} (${fmt(20 * Math.log10(gain), 2)} dB)${phase === null ? '' : ` with a phase shift of ${fmt(phase, 1)}°`}. The output has a DC level of ${eng(Math.abs(b.mean) < b.pp * 1e-6 ? 0 : b.mean, 'V')} and ${eng(b.pp, 'V')} peak to peak.`;
  }
  const m = a || b;
  return m ? `The measured signal is ${eng(m.pp, 'V')} peak to peak with a mean of ${eng(m.mean, 'V')}${m.frequency ? ` at ${eng(m.frequency, 'Hz')}` : ''}.` : '';
}

function renderRecords(state) {
  const config = recordConfiguration(state);
  const sources = recordSources(state);
  const field = (name, label, attributes = '') => `<label>${label}<input type="text" data-record-field="${name}" value="${esc(config[name])}" ${attributes}></label>`;
  const area = (name, label, rows = 4, placeholder = '') => `<label class="record-area">${label}<textarea rows="${rows}" data-record-field="${name}" placeholder="${esc(placeholder)}">${esc(config[name])}</textarea></label>`;
  const include = [['circuit', 'Circuit component list'], ['bench', 'Lab Bench oscilloscope capture and measurements'], ['simulation', 'Circuit Lab simulation result'], ['program8051', '8051 program listing'], ['sketch', 'Arduino sketch listing'], ['assessment', 'Marks and signature block']]
    .map(([key, label]) => { const available = key === 'assessment' || sources[key]; return `<label class="record-check ${available ? '' : 'unavailable'}"><input type="checkbox" data-record-include="${key}" ${config.include[key] && available ? 'checked' : ''} ${available ? '' : 'disabled'}><span><b>${esc(label)}</b><small>${esc(available ? (sources[key]?.label ?? 'Assessment table and signature lines') : 'Nothing to include yet')}</small></span></label>`; }).join('');
  return `<div class="page scroll-page record-page">${pageHeader(modules.find((item) => item.id === 'record'), 'PRACTICAL JOURNAL', '<button class="button primary" data-action="record-download">Download PDF</button>')}
    <div class="record-layout"><div class="record-form">
      <div class="coding-block"><span class="panel-label">START FROM A TEMPLATE</span><div class="dsp-controls">${labSelect('data-record-template', 'template', 'Experiment template', config.template, Object.entries(RECORD_TEMPLATES).map(([id, template]) => [id, template.name]))}<button class="button ghost" data-action="record-apply-template">Fill aim, theory and procedure</button><button class="button ghost" data-action="record-suggest-result">Write result from bench readings</button></div></div>
      <div class="coding-block"><span class="panel-label">INSTITUTE & STUDENT</span><div class="record-grid">${field('institute', 'College / institute')}${field('department', 'Department')}${field('course', 'Course / laboratory')}${field('name', 'Student name')}${field('roll', 'Roll no.')}${field('className', 'Class / division')}${field('batch', 'Batch')}${field('number', 'Experiment no.')}${field('date', 'Date', 'placeholder="dd/mm/yyyy"')}</div>${field('title', 'Title of experiment')}</div>
      <div class="coding-block"><span class="panel-label">WRITE-UP</span>${area('aim', 'Aim', 2)}${area('apparatus', 'Apparatus / software (one per line)', 4)}${area('theory', 'Theory', 6)}${area('procedure', 'Procedure (one step per line)', 6)}${area('observations', 'Observation table (first line = column headings; separate cells with | )', 6, 'f (Hz) | Vin (Vpp) | Vout (Vpp)\n100 | 2 | 1.7')}${area('calculations', 'Calculations', 4)}${area('result', 'Result', 3)}${area('conclusion', 'Conclusion', 3)}</div>
    </div><aside class="record-side"><div class="coding-block"><span class="panel-label">INCLUDE FROM THIS PROJECT</span>${include}</div><div class="coding-block"><span class="panel-label">PREVIEW</span><button class="button ghost" data-action="record-preview">Show PDF preview</button><div class="record-preview" data-record-preview></div><p class="field-help">The PDF uses the standard Helvetica, Courier and Symbol fonts, so Greek letters such as Ω, µ and θ print correctly. Graphs are vector drawings.</p></div></aside></div></div>`;
}

let recordPreviewUrl = null;
function recordPdfBlob() {
  const doc = buildRecordDocument(getState());
  return new Blob([doc.toBytes()], { type: 'application/pdf' });
}

function bindRecordEvents() {
  document.querySelectorAll('[data-record-field]').forEach((input) => input.addEventListener('change', () => persistRecord({ [input.dataset.recordField]: input.value })));
  document.querySelectorAll('[data-record-include]').forEach((input) => input.addEventListener('change', () => { const config = recordConfiguration(getState()); persistRecord({ include: { ...config.include, [input.dataset.recordInclude]: input.checked } }); }));
  document.querySelector('[data-record-template]')?.addEventListener('change', (event) => persistRecord({ template: event.target.value }));
  document.querySelector('[data-action="record-apply-template"]')?.addEventListener('click', () => {
    const config = recordConfiguration(getState());
    const template = RECORD_TEMPLATES[config.template] ?? RECORD_TEMPLATES.blank;
    const patch = Object.fromEntries(['title', 'aim', 'apparatus', 'theory', 'procedure', 'conclusion'].map((key) => [key, template[key]]));
    if (config.template.startsWith('mcu-')) patch.include = { ...config.include, program8051: config.template === 'mcu-8051', sketch: config.template === 'mcu-arduino', bench: false };
    persistRecord(patch);
    notify(`${template.name} template filled in. Edit any section before downloading.`, 'success');
  });
  document.querySelector('[data-action="record-suggest-result"]')?.addEventListener('click', () => {
    const text = suggestedResult(getState());
    if (!text) { notify('Put a circuit on the Lab Bench and probe it first.', 'error'); return; }
    persistRecord({ result: text });
  });
  document.querySelector('[data-action="record-download"]')?.addEventListener('click', () => {
    let blob;
    try { blob = recordPdfBlob(); } catch (error) { notify(error.message, 'error'); return; }
    const config = recordConfiguration(getState());
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `${['experiment', config.number, config.title].filter(Boolean).join('-').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'lab-record'}.pdf`;
    link.click(); URL.revokeObjectURL(link.href);
    notify('Lab record PDF downloaded', 'success');
  });
  document.querySelector('[data-action="record-preview"]')?.addEventListener('click', () => {
    let blob;
    try { blob = recordPdfBlob(); } catch (error) { notify(error.message, 'error'); return; }
    if (recordPreviewUrl) URL.revokeObjectURL(recordPreviewUrl);
    recordPreviewUrl = URL.createObjectURL(blob);
    const target = document.querySelector('[data-record-preview]');
    if (target) { const url = esc(safeUrl(recordPreviewUrl, { schemes: ['blob:'] })); target.innerHTML = `<iframe title="Lab record preview" src="${url}"></iframe><a href="${url}" target="_blank" rel="noopener">Open in a new tab</a>`; }
  });
}

// ---------------------------------------------------------------------------
// Power electronics lab.





// ---------------------------------------------------------------------------
// ADC & DAC lab.



// ---------------------------------------------------------------------------
// Sensors & instrumentation and EV engineering.




// ---------------------------------------------------------------------------
// VLSI lab (CMOS inverter) and RTOS scheduler.




// ---------------------------------------------------------------------------
// Signals & systems explorer.


// ---------------------------------------------------------------------------
// Electromagnetics & microwave lab.




// ---------------------------------------------------------------------------
// Analog Design Studio: design to a specification, then check with the simulators.

const ANALOG_TABS = [['bias', 'BJT bias & CE amplifier'], ['oscillator', 'Oscillators'], ['filter', 'Active filters'], ['regulator', 'Regulators'], ['schmitt', 'Schmitt trigger'], ['pll', 'PLL (565)']];
const SERIES_OPTIONS = [['E12', 'E12 (10 %)'], ['E24', 'E24 (5 %)'], ['E96', 'E96 (1 %)'], ['exact', 'Exact (no rounding)']];
const analogLab = makeLab('analog-lab', {
  tab: 'bias',
  bias: { vcc: 12, ic: 2e-3, beta: 100, reFraction: 0.1, vceFraction: 0.5, stiffness: 10, rl: 10e3, fLow: 100, series: 'E24', bypass: 'yes' },
  oscillator: { type: 'wien', frequency: 1000, c: 10e-9, l: 100e-6, ratio: 0.1, series: 'E24' },
  filter: { kind: 'lowpass', order: 4, fc: 1000, f0: 1000, q: 5, gain: 2, c: 10e-9, series: 'E96' },
  regulator: { kind: 'zener', vinMin: 12, vinMax: 15, vz: 5.1, izMin: 5e-3, ilMax: 20e-3, vout: 9, vin: 15, iload: 0.5, r1: 240, series: 'E24' },
  schmitt: { kind: 'inverting', vut: 2, vlt: -1, vsat: 13, r2: 10e3, series: 'E24' },
  pll: { rt: 10e3, ct: 10e-9, c2: 10e-6, vcc: 12, fin: 3500 },
});
const analogField = groupField('data-analog-field');
const analogSelect = (path, label, value, options) => labSelect('data-analog-select', path, label, value, options);
const partsTable = (values, units = {}) => simpleTable(['Part', 'Value'], Object.entries(values).map(([name, value]) => [name, eng(value, units[name] ?? (name.startsWith('C') ? 'F' : name.startsWith('L') ? 'H' : 'Ω'))]));
const sweepPlot = (title, sweep) => renderPlotFrame({ title, series: [{ xs: sweep.frequencies, ys: sweep.magnitudeDb, color: PLOT_COLORS[0], primary: true }], xMin: sweep.frequencies[0], xMax: sweep.frequencies.at(-1), logX: true, xTicks: logTicks(sweep.frequencies[0], sweep.frequencies.at(-1)), yRange: niceRange(Math.max(-80, Math.min(...sweep.magnitudeDb)), Math.max(...sweep.magnitudeDb) + 1), formatY: (value) => `${fmt(value, 3)} dB` });
function logTicks(start, stop) {
  const a = Math.log10(start), b = Math.log10(stop);
  return Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: eng(10 ** (a + (b - a) * k / 4), 'Hz') }));
}

function renderAnalogDesignTab(config) {
  const c = config[config.tab];
  if (config.tab === 'bias') {
    const d = designBias({ vcc: c.vcc, ic: c.ic, beta: c.beta, reFraction: c.reFraction, vceFraction: c.vceFraction, stiffness: c.stiffness, rl: c.rl, fLow: c.fLow, series: c.series, bypass: c.bypass === 'yes' });
    let sim = null;
    try { const dc = simulateDC(d.components); sim = { ic: (dc.nodes.vcc - dc.nodes.c) / d.chosen.rc, vce: dc.nodes.c - dc.nodes.e, vbe: dc.nodes.b - dc.nodes.e }; } catch { sim = null; }
    const vces = [0, d.loadLine.vceCut];
    const controls = `${analogField('bias.vcc', 'VCC', c.vcc, 'V')}${analogField('bias.ic', 'Target IC', c.ic, 'A')}${analogField('bias.beta', 'β (hFE)', c.beta)}${analogField('bias.reFraction', 'VE / VCC', c.reFraction)}${analogField('bias.vceFraction', 'VCE / VCC', c.vceFraction)}${analogField('bias.stiffness', 'Divider current / IB', c.stiffness)}${analogField('bias.rl', 'Load RL', c.rl, 'Ω')}${analogField('bias.fLow', 'Lower cut-off', c.fLow, 'Hz')}${analogSelect('bias.bypass', 'Emitter bypass', c.bypass, [['yes', 'With CE (high gain)'], ['no', 'No CE (stable gain)']])}${analogSelect('bias.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    const body = `<div class="power-grid"><div>${renderPlotFrame({ title: 'DC load line and Q-point (IC against VCE); the stem marks the Q-point', series: [{ xs: vces, ys: [d.loadLine.icSat, 0], color: PLOT_COLORS[0], primary: true }, { xs: [d.q.vce], ys: [d.q.ic], color: '#f59e0b', stem: true }], xMin: 0, xMax: d.loadLine.vceCut, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(d.loadLine.vceCut * k / 5, 'V') })), yRange: niceRange(0, d.loadLine.icSat), formatY: (value) => eng(value, 'A') })}
      <span class="panel-label">CHOSEN PARTS (IDEAL VALUE → STANDARD VALUE)</span>${simpleTable(['Part', 'Ideal', 'Chosen'], [['R1', eng(d.ideal.r1, 'Ω'), eng(d.chosen.r1, 'Ω')], ['R2', eng(d.ideal.r2, 'Ω'), eng(d.chosen.r2, 'Ω')], ['RC', eng(d.ideal.rc, 'Ω'), eng(d.chosen.rc, 'Ω')], ['RE', eng(d.ideal.re, 'Ω'), eng(d.chosen.re, 'Ω')], ['CIN', '', eng(d.capacitors.cin, 'F')], ['COUT', '', eng(d.capacitors.cout, 'F')], ...(d.capacitors.ce ? [['CE', '', eng(d.capacitors.ce, 'F')]] : [])])}
      <button class="button primary" data-analog-open>Open this amplifier in Circuit Lab →</button></div>
      <div class="analysis-readouts">${readout('Q-point (hand analysis, VBE 0.7 V)', `IC = ${eng(d.q.ic, 'A')}, VCE = ${eng(d.q.vce, 'V')}${d.q.saturated ? ' — SATURATED' : ''}`)}${sim ? readout('Q-point (circuit simulator)', `IC = ${eng(sim.ic, 'A')}, VCE = ${eng(sim.vce, 'V')}, VBE = ${eng(sim.vbe, 'V')}`) : ''}${readout('VB, VE, VC', `${eng(d.q.vb, 'V')}, ${eng(d.q.ve, 'V')}, ${eng(d.q.vc, 'V')}`)}${readout('Thévenin VTH, RTH', `${eng(d.vth, 'V')}, ${eng(d.rth, 'Ω')}`)}${readout('Stability factor S', fmt(d.stability, 4))}${readout('re = VT/IE, rπ, gm', `${eng(d.smallSignal.re, 'Ω')}, ${eng(d.smallSignal.rpi, 'Ω')}, ${eng(d.smallSignal.gm, 'S')}`)}${readout('Input resistance', eng(d.smallSignal.rin, 'Ω'))}${readout('Voltage gain Av', `${fmt(d.smallSignal.gain, 4)} (${fmt(d.smallSignal.gainDb, 4)} dB)`)}${readout('Load line', `IC(sat) = ${eng(d.loadLine.icSat, 'A')}, VCE(cut-off) = ${eng(d.loadLine.vceCut, 'V')}`)}<p class="field-help">Design rules: VE = 0.1·VCC for thermal stability, VCE = VCC/2 for maximum symmetrical swing, divider current about 10·IB so β changes barely move the Q-point. The tool rounds to standard values, then finds the exact Q-point of those parts; the simulator line uses the full diode law for VBE, which is why it differs by a few per cent.</p></div></div>`;
    return { controls, body, design: d };
  }
  if (config.tab === 'oscillator') {
    const lc = ['colpitts', 'hartley'].includes(c.type);
    const d = designOscillator({ type: c.type, frequency: c.frequency, c: c.c, l: c.l, ratio: c.ratio, series: c.series });
    const controls = `${analogSelect('oscillator.type', 'Type', c.type, Object.entries(OSCILLATORS))}${c.type === 'crystal' ? '' : analogField('oscillator.frequency', 'Wanted frequency', c.frequency, 'Hz')}${['wien', 'phase'].includes(c.type) ? analogField('oscillator.c', 'Chosen C', c.c, 'F') : ''}${lc ? analogField('oscillator.l', c.type === 'hartley' ? 'Total L (L1 + L2)' : 'Chosen L', c.l, 'H') : ''}${c.type === 'hartley' ? analogField('oscillator.ratio', 'L2 / (L1 + L2)', c.ratio) : ''}${c.type === 'crystal' ? '' : analogSelect('oscillator.series', 'Part series', c.series, SERIES_OPTIONS)}`;
    let plot = '';
    if (d.netlist) {
      const sweep = networkSweep(d.netlist, { start: d.actual / 20, stop: d.actual * 20, points: 241 });
      plot = `${sweepPlot('Feedback network |β(f)| in dB', sweep)}${linePlot('Feedback network phase (degrees)', sweep.frequencies.map((f) => Math.log10(f)), [{ name: 'phase', values: sweep.phase }], { xLabel: (x) => eng(10 ** x, 'Hz') })}`;
    }
    const body = `<div class="power-grid"><div>${partsTable(d.values)}${plot}</div>
      <div class="analysis-readouts">${readout('Formula', d.formula)}${readout('Frequency with these parts', eng(d.actual, 'Hz'))}${d.parallel ? readout('Parallel resonance fp', eng(d.parallel, 'Hz')) : ''}${d.q ? readout('Crystal Q', fmt(d.q, 5)) : ''}${readout('Barkhausen: required amplifier gain', `${fmt(d.requiredGain, 4)} — ${d.condition}`)}${d.feedback ? readout('Feedback β at f (phasor solver)', `${fmt(d.feedback.magnitude, 6)} ∠ ${fmt(d.feedback.phase, 4)}° (theory ${fmt(d.feedback.expected, 6)})`) : ''}<p class="field-help">An oscillator needs loop gain Aβ = 1 at 0° (or 360°). For RC types the tool builds the feedback network and solves it at the design frequency, so you can see β = 1/3 for the Wien bridge and 1/29 at 180° for the three-section phase-shift network. Make the gain slightly larger in practice so oscillation starts.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'filter') {
    const bp = c.kind === 'bandpass';
    const controls = `${analogSelect('filter.kind', 'Filter', c.kind, [['lowpass', 'Sallen–Key low-pass (Butterworth)'], ['highpass', 'Sallen–Key high-pass (Butterworth)'], ['bandpass', 'MFB band-pass']])}${bp ? `${analogField('filter.f0', 'Centre frequency', c.f0, 'Hz')}${analogField('filter.q', 'Q', c.q)}${analogField('filter.gain', 'Centre gain', c.gain)}` : `${analogField('filter.order', 'Order', c.order)}${analogField('filter.fc', 'Cut-off frequency', c.fc, 'Hz')}`}${analogField('filter.c', 'Base capacitor', c.c, 'F')}${analogSelect('filter.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    if (bp) {
      const d = designBandpass({ f0: c.f0, q: c.q, gain: c.gain, c: c.c, series: c.series });
      return { controls, body: `<div class="power-grid"><div>${sweepPlot('Magnitude response (phasor solver with ideal op-amp)', d.sweep)}${partsTable(d.values)}</div><div class="analysis-readouts">${readout('Centre frequency', eng(d.f0, 'Hz'))}${readout('Q', fmt(d.q, 5))}${readout('Bandwidth f0/Q', eng(d.bandwidth, 'Hz'))}${readout('Centre gain (formula)', fmt(d.gain, 5))}${readout('Centre gain (solver)', `${fmt(d.centre.magnitude, 5)} ∠ ${fmt(d.centre.phase, 4)}°`)}<p class="field-help">MFB (Delyiannis–Friend) band-pass: R1 = Q/(G·ω0C), R2 = Q/((2Q² − G)ω0C), R3 = 2Q/(ω0C). The response is computed by solving the full circuit, so rounding errors in the parts show up in the curve.</p></div></div>` };
    }
    const d = designSallenKey({ kind: c.kind, order: c.order, fc: c.fc, c: c.c, series: c.series });
    const rows = d.stages.map((stage, k) => [String(k + 1), stage.firstOrder ? '1st order' : `Q ${fmt(stage.q, 4)} → ${fmt(stage.actualQ, 4)}`, eng(stage.R1, 'Ω'), stage.R2 ? eng(stage.R2, 'Ω') : '—', eng(stage.C1, 'F'), stage.C2 ? eng(stage.C2, 'F') : '—', eng(stage.f0, 'Hz')]);
    return { controls, body: `<div class="power-grid"><div>${sweepPlot('Magnitude response of the whole cascade (phasor solver)', d.sweep)}${simpleTable(['Stage', 'Q wanted → got', 'R1', 'R2', 'C1', 'C2', 'f0'], rows)}</div><div class="analysis-readouts">${readout('Gain at fc', `${fmt(d.atCutoffDb, 4)} dB (ideal −3.01 dB)`)}${readout('Roll-off', `${20 * d.order} dB/decade`)}${readout('Stages', `${Math.floor(d.order / 2)} second-order${d.order % 2 ? ' + 1 first-order' : ''}`)}<p class="field-help">A Butterworth filter of order n is a cascade of second-order sections with Q = 1/(2 sin((2k − 1)π/2n)). Low-pass sections fix C2 and pick C1 ≥ 4Q²·C2, then solve for R1 and R2; high-pass sections use equal capacitors. Choose E96 or Exact to see how part tolerance moves the −3 dB point.</p></div></div>` };
  }
  if (config.tab === 'regulator') {
    const controls = `${analogSelect('regulator.kind', 'Regulator', c.kind, [['zener', 'Zener shunt'], ['lm317', 'LM317 adjustable']])}${c.kind === 'zener' ? `${analogField('regulator.vinMin', 'Vin min', c.vinMin, 'V')}${analogField('regulator.vinMax', 'Vin max', c.vinMax, 'V')}${analogField('regulator.vz', 'Zener voltage', c.vz, 'V')}${analogField('regulator.izMin', 'Iz min (knee)', c.izMin, 'A')}${analogField('regulator.ilMax', 'Load current max', c.ilMax, 'A')}` : `${analogField('regulator.vout', 'Wanted Vout', c.vout, 'V')}${analogField('regulator.vin', 'Vin', c.vin, 'V')}${analogField('regulator.iload', 'Load current', c.iload, 'A')}${analogField('regulator.r1', 'R1', c.r1, 'Ω')}`}${analogSelect('regulator.series', 'Resistor series', c.series, SERIES_OPTIONS.filter(([id]) => id !== 'exact' || c.kind === 'lm317'))}`;
    if (c.kind === 'zener') {
      const z = designZener({ vinMin: c.vinMin, vinMax: c.vinMax, vz: c.vz, izMin: c.izMin, ilMax: c.ilMax, series: c.series });
      return { controls, body: `<div class="analysis-readouts">${readout('Series resistor Rs (rounded down)', `${eng(z.rs, 'Ω')} (ideal ${eng(z.ideal, 'Ω')})`)}${readout('Iz at Vin min, full load', `${eng(z.izAtMin, 'A')} ${z.ok ? '≥ Iz min ✓' : '< Iz min ✗'}`)}${readout('Iz max (Vin max, no load)', eng(z.izMax, 'A'))}${readout('Zener dissipation (worst)', eng(z.pz, 'W'))}${readout('Resistor dissipation (worst)', eng(z.pr, 'W'))}${readout('Suggested ratings (2× margin)', `Zener ${eng(z.ratings.zenerW, 'W')}, resistor ${eng(z.ratings.resistorW, 'W')}`)}<p class="field-help">Rs = (Vin,min − Vz)/(Iz,min + IL,max) keeps the Zener in breakdown at the worst case; rounding Rs down only adds current. The Zener must survive the other worst case: highest input with the load removed.</p></div>` };
    }
    const r = designLm317({ vout: c.vout, vin: c.vin, iload: c.iload, r1: c.r1, series: c.series });
    return { controls, body: `<div class="analysis-readouts">${readout('R2', `${eng(r.r2, 'Ω')} (ideal ${eng(r.ideal, 'Ω')})`)}${readout('Actual Vout = 1.25(1 + R2/R1) + IADJ·R2', eng(r.vout, 'V'))}${readout('Dissipation (Vin − Vout)·I', eng(r.dissipation, 'W'))}${readout('Headroom', `${eng(r.headroom, 'V')} ${r.dropoutOk ? '≥ 3 V dropout ✓' : '< 3 V — will drop out ✗'}`)}${readout('Minimum load through R1', eng(r.minLoad, 'A'))}<p class="field-help">The LM317 keeps 1.25 V between OUT and ADJ, so R1 sets a fixed current and R2 lifts the output. Above about 1 W it needs a heat sink — see the thermal calculator in Product Design.</p></div>` };
  }
  if (config.tab === 'schmitt') {
    const s = designSchmitt({ vut: c.vut, vlt: c.vlt, vsat: c.vsat, kind: c.kind, r2: c.r2, series: c.series });
    const span = Math.max(Math.abs(s.vut), Math.abs(s.vlt)) * 2 + 1;
    const vin = Array.from({ length: 201 }, (_, k) => -span + 2 * span * k / 200);
    const inv = s.kind === 'inverting';
    const up = vin.map((v) => (inv ? (v < s.vut ? c.vsat : -c.vsat) : (v < s.vut ? -c.vsat : c.vsat)));
    const down = vin.map((v) => (inv ? (v > s.vlt ? -c.vsat : c.vsat) : (v > s.vlt ? c.vsat : -c.vsat)));
    const controls = `${analogSelect('schmitt.kind', 'Type', c.kind, [['inverting', 'Inverting'], ['noninverting', 'Non-inverting']])}${analogField('schmitt.vut', 'Upper threshold VUT', c.vut, 'V')}${analogField('schmitt.vlt', 'Lower threshold VLT', c.vlt, 'V')}${analogField('schmitt.vsat', '±Vsat', c.vsat, 'V')}${analogField('schmitt.r2', 'R2', c.r2, 'Ω')}${analogSelect('schmitt.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    return { controls, body: `<div class="power-grid"><div>${linePlot('Transfer characteristic: Vout against Vin (rising, falling)', vin, [{ name: 'Vin rising', values: up }, { name: 'Vin falling', values: down, color: '#f97316', dashed: true }], { xLabel: (x) => eng(x, 'V') })}</div><div class="analysis-readouts">${readout('R1, R2', `${eng(s.r1, 'Ω')}, ${eng(s.r2, 'Ω')}`)}${readout('Reference voltage', eng(s.vref, 'V'))}${readout('Thresholds with these parts', `VUT = ${eng(s.vut, 'V')}, VLT = ${eng(s.vlt, 'V')}`)}${readout('Hysteresis', eng(s.hysteresis, 'V'))}<p class="field-help">${inv ? 'Inverting: the input goes to the − pin and R1/R2 feed back a fraction β = R2/(R1 + R2) of the output to the + pin.' : 'Non-inverting: the input goes through R1 to the + pin and R2 feeds the output back.'} Positive feedback makes the switching points depend on the output state, which ignores noise smaller than the hysteresis.</p></div></div>` };
  }
  const p = designPll({ rt: c.rt, ct: c.ct, c2: c.c2, vcc: c.vcc });
  const locked = Math.abs(c.fin - p.f0) <= p.lockRange, capturable = Math.abs(c.fin - p.f0) <= p.captureRange;
  const controls = `${analogField('pll.rt', 'Timing R1', c.rt, 'Ω')}${analogField('pll.ct', 'Timing C1', c.ct, 'F')}${analogField('pll.c2', 'Loop-filter C2', c.c2, 'F')}${analogField('pll.vcc', 'Total supply (+V − −V)', c.vcc, 'V')}${analogField('pll.fin', 'Input frequency', c.fin, 'Hz')}`;
  return { controls, body: `<div class="analysis-readouts">${readout('Free-running f0 = 0.3/(R1C1)', eng(p.f0, 'Hz'))}${readout('Lock range ±fL = ±8f0/V', `±${eng(p.lockRange, 'Hz')} → ${eng(p.lockBand[0], 'Hz')} to ${eng(p.lockBand[1], 'Hz')}`)}${readout('Capture range ±fC', `±${eng(p.captureRange, 'Hz')} → ${eng(p.captureBand[0], 'Hz')} to ${eng(p.captureBand[1], 'Hz')}`)}${readout(`Input at ${eng(c.fin, 'Hz')}`, capturable ? 'inside the capture range — the loop acquires lock' : locked ? 'inside the lock range — holds lock if already locked, will not acquire from unlocked' : 'outside the lock range — no lock')}<p class="field-help">The capture range is always narrower than the lock range: a bigger loop-filter capacitor gives a cleaner VCO control voltage but a narrower capture range. Formulas from the NE565 data sheet.</p></div>` };
}

function renderAnalog(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'analog'), 'ANALOG DESIGN STUDIO — DESIGN TO A SPECIFICATION', '')}${labCard('analog', 'Analog design', ANALOG_TABS, analogLab.configuration(state), renderAnalogDesignTab)}</div>`;
}

function bindAnalogEvents() {
  bindLabControls('analog', analogLab, ['series', 'bypass', 'type', 'kind']);
  document.querySelectorAll('[data-analog-open]').forEach((button) => button.addEventListener('click', () => {
    const view = renderAnalogDesignTab(analogLab.configuration(getState()));
    if (!view.design) return;
    loadDesignedCircuit(view.design.components, view.design.analysis, view.design.trace, 'Designed CE amplifier');
  }));
}

/** Put a generated circuit into Circuit Lab and open it. */
function loadDesignedCircuit(components, analysis, trace, name) {
  circuitEditor.wireSource = null; circuitEditor.selectedWire = null;
  updateProject((project) => { project.circuit.components = structuredClone(components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'builtin-analysis', inputs: { ...builtinConfiguration(getState()), source: 'V1', ...analysis } });
  setState({ simulation: null, selectedComponentId: null, selectedComponentIds: [], circuitPlotTrace: trace, activeModule: 'circuit' });
  notify(`${name} loaded. Press Run to simulate.`, 'success');
}

// ---------------------------------------------------------------------------
// Electronic Measurements: AC bridges, Lissajous, errors, meter design and the Q-meter.


// ---------------------------------------------------------------------------
// Radar, satellite, antennas and microwave tubes.




// ---------------------------------------------------------------------------
// Real + Virtual Bench: one firmware on a real Arduino (Web Serial) and on the simulated Uno.





// ---------------------------------------------------------------------------
// Neural-network playground.


// ---------------------------------------------------------------------------
// Math console.


// ---------------------------------------------------------------------------
// Learning Hub: tracks and lessons, quizzes, viva practice and verified lab checkpoints.


// ---------------------------------------------------------------------------
// AI lab partner (OpenAI-compatible). Non-secret settings live in localStorage; the API key is
// kept in memory, or in sessionStorage for this tab only if the user asks (src/core/credentials.js).
// Neither is ever written to the project file.

const assistant = { open: false, view: 'chat', draft: '', history: [], shown: [], busy: false, status: '', error: '', controller: null, focus: false };
const assistantStartup = (() => { try { return loadAssistantSettings(localStorage, sessionStorage); } catch { return { removedLegacyKey: false }; } })();
function assistantSettings() {
  try { const { settings, apiKey } = loadAssistantSettings(localStorage, sessionStorage); return { ...settings, apiKey }; } catch { return { provider: 'openai', baseUrl: '', model: '', apiKey: '', mode: 'explain', language: 'en', shareLab: true, consented: false, rememberKey: false }; }
}
function saveAssistantSettings(patch) {
  try { const { settings, apiKey } = storeAssistantSettings(localStorage, sessionStorage, patch); return { ...settings, apiKey }; } catch { notify('Could not save assistant settings in this browser.', 'error'); return assistantSettings(); }
}

function assistantLabContext(state) {
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  const context = { lab: active.name, labPurpose: active.description, savedInputs: state.project.experiments.filter((e) => EXPERIMENT_MODULES[e?.id] === active.id).map((e) => ({ experiment: e.id, inputs: e.inputs })) };
  if (['circuit', 'bench', 'record'].includes(active.id) && state.project.circuit.components.length) {
    try { context.circuitSpiceNetlist = buildSpiceNetlist(state.project.circuit.components, state.project.circuit.wires, { title: state.project.name, netLabels: state.project.circuit.netLabels }); } catch (error) { context.circuitProblem = error.message; }
  }
  if (state.simulation?.kind) {
    const text = JSON.stringify(state.simulation, (key, value) => (Array.isArray(value) && value.length > 40 ? `[${value.length} values]` : value));
    context.lastSimulation = text.length > 3000 ? `${text.slice(0, 3000)}…` : text;
  }
  return context;
}

/** Minimal, escape-first formatting: code blocks, inline code, bold, bullets and line breaks. */
function renderAssistant(state) {
  const settings = assistantSettings();
  if (!assistant.open) return `<button class="ai-fab" data-ai-open title="Ask the AI lab partner">✦ Ask AI</button>`;
  const provider = PROVIDERS[settings.provider] ?? PROVIDERS.custom;
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  const ready = settings.consented && (!provider.needsKey || settings.apiKey);
  const settingsView = `<div class="ai-settings">
      <label>Provider<select data-ai-setting="provider">${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === settings.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>
      <label>API base URL<input type="text" spellcheck="false" data-ai-setting="baseUrl" value="${esc(settings.baseUrl)}" placeholder="${esc(provider.baseUrl || 'https://your-server/v1')}"></label>
      <label>Model<input type="text" spellcheck="false" data-ai-setting="model" value="${esc(settings.model)}" placeholder="${esc(provider.model || 'model name')}"></label>
      <label>API key${provider.needsKey ? '' : ' (optional)'}<input type="password" autocomplete="off" data-ai-setting="apiKey" value="${esc(settings.apiKey)}" placeholder="${provider.needsKey ? 'sk-…' : 'not needed'}"></label>
      <label>How should it help?<select data-ai-setting="mode">${Object.entries(MODES).map(([id, label]) => `<option value="${id}" ${id === settings.mode ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label>Reply language<select data-ai-setting="language">${Object.entries(LANGUAGES).map(([id, label]) => `<option value="${id}" ${id === settings.language ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="shareLab" ${settings.shareLab ? 'checked' : ''}> Let the AI read my current lab's inputs and results</label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="consented" ${settings.consented ? 'checked' : ''}> I understand my questions${settings.shareLab ? ' and lab inputs' : ''} are sent to ${esc(provider.label)}</label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="rememberKey" ${settings.rememberKey ? 'checked' : ''}> Keep the key until this tab closes (sessionStorage); otherwise it is forgotten on reload</label>${settings.apiKey ? '<button class="button subtle" data-ai-forget>Forget the key now</button>' : ''}
      ${assistantStartup.removedLegacyKey ? '<p class="field-help ai-notice">An API key saved by an older version of OpenENTC was deleted from this browser\'s storage. Enter it again; it is no longer saved permanently.</p>' : ''}
      <p class="field-help">The API key is never saved permanently and never goes into your project file or exports; it is sent only to the provider above. Free option: install Ollama, run <code>OLLAMA_ORIGINS=* ollama serve</code> and pull a model such as llama3.1. Every number the AI states is meant to come from OpenENTC's own tested engines — open "Checked with" under a reply to see the calculations.</p>
      <button class="button primary" data-ai-view="chat">Done</button></div>`;
  const messages = assistant.shown.map((m) => `<div class="ai-msg ${m.role}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : formatAssistantText(m.text)}${m.trace?.length ? `<details class="ai-trace"><summary>Checked with ${m.trace.length} tool call${m.trace.length > 1 ? 's' : ''}</summary>${m.trace.map((t) => `<div><b>${esc(t.tool)}</b><pre>${esc(t.args.code ?? t.args.netlist ?? t.args.query ?? JSON.stringify(t.args))}</pre><pre class="out">${esc(t.output)}</pre></div>`).join('')}</details>` : ''}</div>`).join('');
  const suggestions = [`Explain what this ${active.name} page does`, 'Why is my result like this?', settings.mode === 'viva' ? 'Start my viva' : 'Quiz me on this topic'];
  const chatView = `<div class="ai-messages" data-ai-messages>${messages || `<div class="ai-empty"><b>Hi! I am your lab partner.</b><p>Ask about ${esc(active.name)} or any ENTC topic. I calculate with OpenENTC's simulators before I answer.</p></div>`}${assistant.busy ? `<div class="ai-msg assistant busy">${esc(assistant.status || 'Thinking…')}</div>` : ''}${assistant.error ? `<div class="ai-msg error">${esc(assistant.error)}</div>` : ''}</div>
    ${ready ? '' : `<div class="ai-setup">${settings.consented ? `Add your ${esc(provider.label)} API key` : 'Set up a provider'} to start. <button class="button subtle" data-ai-view="settings">Open settings</button></div>`}
    <div class="ai-suggestions">${suggestions.map((s) => `<button data-ai-suggest="${esc(s)}" ${assistant.busy || !ready ? 'disabled' : ''}>${esc(s)}</button>`).join('')}</div>
    <div class="ai-input"><textarea rows="2" placeholder="Ask anything… (Enter to send, Shift+Enter for a new line)" data-ai-draft ${assistant.busy || !ready ? 'disabled' : ''}>${esc(assistant.draft)}</textarea>${assistant.busy ? '<button class="button" data-ai-stop>Stop</button>' : `<button class="button primary" data-ai-send ${ready ? '' : 'disabled'}>Send</button>`}</div>`;
  return `<aside class="ai-panel" aria-label="AI lab partner"><header><b>✦ AI lab partner</b><span>${esc(provider.label)} · ${esc(MODES[settings.mode] ?? '')}</span><div><button class="icon-button" data-ai-view="${assistant.view === 'settings' ? 'chat' : 'settings'}" title="Settings">⚙</button><button class="icon-button" data-ai-clear title="New conversation">⟲</button><button class="icon-button" data-ai-close title="Close">✕</button></div></header>${assistant.view === 'settings' ? settingsView : chatView}</aside>`;
}

async function sendToAssistant(text) {
  const question = String(text).trim();
  if (!question || assistant.busy) return;
  const settings = assistantSettings(), state = getState();
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  assistant.draft = ''; assistant.error = ''; assistant.busy = true; assistant.status = 'Thinking…';
  assistant.shown.push({ role: 'user', text: question });
  assistant.history.push({ role: 'user', content: question });
  assistant.controller = new AbortController();
  rerender();
  const vivaBank = TRACKS.flatMap((track) => track.viva);
  try {
    const result = await assistantChat({ settings, messages: assistant.history, signal: assistant.controller.signal, context: { labName: active.name, lab: () => (settings.shareLab ? assistantLabContext(getState()) : { note: 'The student chose not to share lab inputs.' }), lessons: lessonIndex(), viva: vivaBank } });
    // Keep the history compact: user/assistant text turns only (tool steps are re-derived each time).
    assistant.history.push({ role: 'assistant', content: result.reply });
    if (assistant.history.length > 24) assistant.history = assistant.history.slice(-24);
    assistant.shown.push({ role: 'assistant', text: result.reply, trace: result.trace });
  } catch (error) {
    assistant.history.pop();
    assistant.error = assistant.controller?.signal.aborted ? 'Stopped.' : redactSecrets(error.message, [settings.apiKey]);
  } finally {
    assistant.busy = false; assistant.status = ''; assistant.controller = null; assistant.focus = true;
    rerender();
  }
}

function bindAssistantEvents() {
  document.querySelector('[data-ai-open]')?.addEventListener('click', () => { assistant.open = true; assistant.focus = true; if (!assistantSettings().consented) assistant.view = 'settings'; rerender(); });
  document.querySelector('[data-ai-close]')?.addEventListener('click', () => { assistant.open = false; rerender(); });
  document.querySelector('[data-ai-clear]')?.addEventListener('click', () => { assistant.history = []; assistant.shown = []; assistant.error = ''; rerender(); });
  document.querySelectorAll('[data-ai-view]').forEach((b) => b.addEventListener('click', () => { assistant.view = b.dataset.aiView; rerender(); }));
  document.querySelector('[data-ai-forget]')?.addEventListener('click', () => { forgetApiKey(sessionStorage); notify('API key forgotten.', 'success'); rerender(); });
  document.querySelectorAll('[data-ai-setting]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.aiSetting;
    const value = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (key === 'baseUrl' && value) { try { validateBaseUrl(value); } catch (error) { notify(error.message, 'error'); return; } }
    saveAssistantSettings(key === 'provider' ? { provider: value, baseUrl: '', model: '' } : { [key]: value });
    rerender();
  }));
  const draft = document.querySelector('[data-ai-draft]');
  draft?.addEventListener('input', () => { assistant.draft = draft.value; });
  draft?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendToAssistant(draft.value); } });
  document.querySelector('[data-ai-send]')?.addEventListener('click', () => sendToAssistant(draft?.value ?? assistant.draft));
  document.querySelector('[data-ai-stop]')?.addEventListener('click', () => assistant.controller?.abort());
  document.querySelectorAll('[data-ai-suggest]').forEach((b) => b.addEventListener('click', () => sendToAssistant(b.dataset.aiSuggest)));
  const list = document.querySelector('[data-ai-messages]');
  if (list) list.scrollTop = list.scrollHeight;
  if (assistant.focus && assistant.view === 'chat' && !assistant.busy && draft) { assistant.focus = false; draft.focus({ preventScroll: true }); }
}

// ---------------------------------------------------------------------------
// Microcontroller Lab: Arduino Uno (ATmega328P) simulator running compiled HEX files.




// ---------------------------------------------------------------------------
// Logic analyser panel (shared by the 8051 and Arduino simulators).




// ---------------------------------------------------------------------------
// Built-in Verilog simulator (FPGA & Digital module).


function renderToolchains(state) {
  const toolchainModule = { name: 'Toolchains', description: 'Detected tools, licences and capabilities.', color: '#94a3b8' };
  const deviceScopes = browserDevicePolicy.inspect();
  const detection = state.toolchainDetection || {};
  const statusLabel = (engine) => engine.status === 'built-in' ? 'Built in' : engine.disabled ? 'Disabled' : detection[engine.id]?.state === 'detected' ? 'Detected' : detection[engine.id]?.state === 'invalid' ? 'Incompatible' : detection[engine.id]?.state === 'missing' ? 'Missing' : engine.status === 'unsupported' ? 'Unsupported' : 'Unavailable';
  const statusClass = (engine) => engine.status === 'built-in' ? 'built-in' : engine.disabled ? 'disabled' : detection[engine.id]?.state === 'detected' ? 'ready' : detection[engine.id]?.state === 'invalid' ? 'incompatible' : engine.status === 'unsupported' ? 'unsupported' : 'unavailable';
  const refresh = desktopBridge.available ? '<button class="button ghost" data-action="refresh-detection">Refresh detection</button>' : '<button class="button ghost" disabled title="Native detection is unavailable in browser preview">Refresh unavailable</button>';
  const environment = desktopBridge.available ? 'DESKTOP BRIDGE' : 'BROWSER PREVIEW';
  const processAction = desktopBridge.available && state.desktopProject?.project_id
    ? `<button class="button ghost" data-action="${state.processPermissionGranted ? 'revoke-process' : 'grant-process'}">${state.processPermissionGranted ? 'Revoke process permission' : 'Review process permission'}</button>`
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before granting process execution">Process permission unavailable</button>';
  const artifactAction = desktopBridge.available && state.desktopProject?.project_id
    ? `<button class="button ghost" data-action="${state.artifactPermissionGranted ? 'revoke-artifact' : 'grant-artifact'}">${state.artifactPermissionGranted ? 'Revoke artifact permission' : 'Review artifact-write permission'}</button>`
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before granting artifact writes">Artifact permission unavailable</button>';
  const jobsAction = desktopBridge.available && state.desktopProject?.project_id
    ? '<button class="button ghost" data-action="refresh-jobs">Refresh jobs</button>'
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before listing jobs">Jobs unavailable</button>';
  const jobs = state.desktopJobs || [];
  const events = state.desktopEvents || [];
  const jobRows = jobs.length ? jobs.map((job) => { const active = ['queued', 'preparing', 'running', 'cancelling'].includes(job.state); const cancel = active && job.operation === 'process' ? `<button class="button ghost compact" data-action="cancel-job" data-job-id="${esc(job.id)}">Cancel</button>` : ''; const error = job.error ? ` · ${esc(job.error)}` : ''; return `<div class="engine-row" role="listitem"><span class="engine-logo">JOB</span><div><b>${esc(job.id)}</b><small>${esc(job.operation)} · ${esc(job.adapter)} · ${(job.arguments || []).length} args · ${(job.artifacts || []).length} artifacts${error}</small></div><span>${esc(job.state)}</span><span>${esc(job.engine_version || 'version pending')}</span><span class="engine-status ${['succeeded', 'failed', 'cancelled'].includes(job.state) ? (job.state === 'succeeded' ? 'ready' : 'incompatible') : 'unavailable'}">${job.state === 'succeeded' ? 'Succeeded' : job.state === 'failed' ? 'Failed' : job.state === 'cancelled' ? 'Cancelled' : 'Active'}</span>${cancel}</div>`; }).join('') : `<div class="empty-state">${desktopBridge.available && state.desktopProject?.project_id ? 'No native jobs loaded for this project.' : 'Open a desktop project to view native jobs.'}</div>`;
  const eventRows = events.length ? events.slice(-12).reverse().map((event) => { const data = event.data || {}; const subject = data.id || data.job_id || data.path || data.code || 'project event'; const detail = data.state || data.code || (data.message ? data.message.slice(0, 160) : ''); return `<div class="permission-row" role="listitem"><span>${esc(event.kind || 'event')}</span><small>${esc(subject)}${detail ? ` · ${esc(detail)}` : ''}</small></div>`; }).join('') : '<div class="empty-state">Refresh jobs to load lifecycle events for this project.</div>';
  return `<div class="page scroll-page toolchains-page">
    ${pageHeader(toolchainModule, 'NATIVE CAPABILITY CATALOG', refresh)}
    <section class="toolchain-notice"><span class="pill"><i></i> ${environment}</span><h2>Native tools are never assumed installed.</h2><p>${desktopBridge.available ? 'Detection reads fixed candidate paths without executing or installing tools.' : 'The desktop bridge will probe fixed executable paths without installing or mutating the system. This preview shows reviewed catalogue states only.'}</p></section>
    <section class="engine-table">${engines.map((engine) => `<div class="engine-row"><span class="engine-logo">${esc(engine.name.slice(0, 2).toUpperCase())}</span><div><b>${esc(engine.name)}</b><small>${esc(engine.capability)}</small></div><span>${esc(engine.area)}</span><span>${esc(engine.license)}</span><span class="engine-status ${statusClass(engine)}">${statusLabel(engine)}</span></div>`).join('')}</section>
    <div class="section-title"><div><span class="eyebrow">PROJECT JOBS</span><h2>Native lifecycle records</h2></div><div class="heading-actions">${jobsAction}</div></div>
    <section class="engine-table job-table" role="list" aria-label="Native lifecycle jobs">${jobRows}</section>
    <section class="permission-card"><div class="section-title"><div><span class="eyebrow">RECENT NATIVE EVENTS</span><h2 id="native-events-heading">Lifecycle notifications</h2></div><span class="pill">${events.length ? `${events.length} loaded` : 'NONE LOADED'}</span></div><div class="permission-grid" role="list" aria-labelledby="native-events-heading">${eventRows}</div></section>
    <section class="module-info-grid"><article><span class="eyebrow">SECURITY BOUNDARY</span><h3>Read-only discovery</h3><p>Detection uses fixed absolute candidates and filesystem metadata only. Missing tools remain unavailable until the user configures them.</p></article><article><span class="eyebrow">LICENCE POLICY</span><h3>Upstream terms stay visible</h3><p>Each adapter records an SPDX expression, upstream source and installation mode. OpenENTC does not relicense connected tools.</p></article></section>
    <section class="permission-card"><div class="section-title"><div><span class="eyebrow">DEVICE, PROCESS AND ARTIFACT PERMISSIONS</span><h2>Explicit target scopes</h2></div><span class="pill">${desktopBridge.available ? 'PROJECT-BOUND' : 'BROWSER DENIED'}</span></div><p class="muted">Serial, USB, debug, capture, SDR, programmer, process execution and generated-artifact writes are separate permissions. No scope is granted automatically.</p><div class="permission-grid">${deviceScopes.map((scope) => `<div class="permission-row"><span>${esc(scope.permission)}</span><span class="engine-status unavailable">${scope.allowed ? 'Available' : 'Unavailable'}</span><small>${scope.grantedTargets.length ? esc(scope.grantedTargets.join(', ')) : 'No target selected'}</small></div>`).join('')}<div class="permission-row"><span>Process execution</span><span class="engine-status ${state.processPermissionGranted ? 'available' : 'unavailable'}">${state.processPermissionGranted ? 'Granted' : 'Unavailable'}</span><small>${state.processPermissionGranted ? 'Granted only for the currently opened project.' : 'Requires an explicit project-scoped desktop grant; browser preview never exposes it.'}</small></div><div class="permission-row"><span>Generated artifact writes</span><span class="engine-status ${state.artifactPermissionGranted ? 'available' : 'unavailable'}">${state.artifactPermissionGranted ? 'Granted' : 'Unavailable'}</span><small>${state.artifactPermissionGranted ? 'Limited to generated runs/ and build/ paths for the current project.' : 'Requires an explicit project-scoped desktop grant; browser preview never exposes it.'}</small></div></div><div class="heading-actions">${processAction}${artifactAction}</div></section>
  </div>`;
}

function bindEvents() {
  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => { circuitEditor.wireSource = null; circuitEditor.selectedWire = null; setState({ activeModule: button.dataset.module, selectedComponentId: null }); }));
  document.querySelector('[data-action="home"]')?.addEventListener('click', () => setState({ activeModule: 'home' }));
  document.querySelector('[data-field="project-name"]')?.addEventListener('change', (event) => updateProject((project) => { project.name = event.target.value.trim() || 'Untitled ENTC project'; }));
  document.querySelector('[data-action="theme"]')?.addEventListener('click', () => updateProject((project) => { project.settings.theme = project.settings.theme === 'dark' ? 'light' : 'dark'; }));
  document.querySelector('[data-action="export"]')?.addEventListener('click', exportProject);
  document.querySelector('[data-action="import"]')?.addEventListener('click', () => importInput.click());
  document.querySelector('[data-action="save-local"]')?.addEventListener('click', saveBrowserProject);
  document.querySelector('[data-action="desktop-open"]')?.addEventListener('click', openDesktopProject);
  document.querySelector('[data-action="desktop-save"]')?.addEventListener('click', saveDesktopProject);
  document.querySelector('[data-action="new-project"]')?.addEventListener('click', async () => { if (await closeNativeSessionForBrowserProject()) { replaceProject(createProject('Untitled ENTC project')); notify('New project created', 'success'); } });
  document.querySelector('[data-action="load-demo"]')?.addEventListener('click', async () => { if (await closeNativeSessionForBrowserProject()) { replaceProject(createProject('Voltage divider demonstration')); setState({ activeModule: 'circuit' }); notify('Demo loaded', 'success'); } });
  document.querySelector('[data-action="help"]')?.addEventListener('click', showHelp);
  document.querySelector('[data-action="command"]')?.addEventListener('click', showCommandPalette);
  document.querySelector('[data-action="engine-info"]')?.addEventListener('click', showEngineInfo);
  const experimentModules = EXPERIMENT_MODULES;
  document.querySelectorAll('.experiment-list .engine-row').forEach((row) => {
    const id = row.querySelector('b')?.textContent?.trim();
    const module = experimentModules[id];
    if (!module) return;
    row.tabIndex = 0;
    row.setAttribute('role', 'link');
    row.setAttribute('aria-label', `Open ${id} experiment`);
    const open = () => setState({ activeModule: module });
    row.addEventListener('click', open);
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
  document.querySelector('[data-action="open-toolchains"]')?.addEventListener('click', () => setState({ activeModule: 'toolchains' }));
  document.querySelector('[data-action="refresh-detection"]')?.addEventListener('click', refreshEngineDetection);
  document.querySelector('[data-action="refresh-jobs"]')?.addEventListener('click', refreshDesktopJobs);
  document.querySelectorAll('[data-action="cancel-job"]').forEach((button) => button.addEventListener('click', () => cancelDesktopJob(button.dataset.jobId)));
  document.querySelector('[data-action="grant-process"]')?.addEventListener('click', reviewProcessGrant);
  document.querySelector('[data-action="grant-artifact"]')?.addEventListener('click', reviewArtifactGrant);
  document.querySelector('[data-action="revoke-process"]')?.addEventListener('click', revokeProcessGrant);
  document.querySelector('[data-action="revoke-artifact"]')?.addEventListener('click', revokeArtifactGrant);
  document.querySelector('[data-action="open-lesson-circuit"]')?.addEventListener('click', () => setState({ activeModule: 'circuit' }));
  document.querySelector('[data-action="check-lesson"]')?.addEventListener('click', () => {
    const simulation = getState().simulation;
    if (!simulation?.nodes || !Number.isFinite(simulation.nodes.out)) { notify('Run the voltage-divider DC analysis first.', 'error'); return; }
    const lesson = getLesson('voltage-divider');
    const evaluation = evaluateLesson(lesson, { output: { kind: 'scalar', data: simulation.nodes.out } });
    recordLearningAttempt('voltage-divider', evaluation.passed);
    setState({ lessonEvaluation: evaluation });
    notify(evaluation.passed ? 'Checkpoint passed' : 'Checkpoint not yet passed', evaluation.passed ? 'success' : 'error');
  });
  document.querySelector('[data-action="check-dsp-lesson"]')?.addEventListener('click', () => {
    const simulation = getState().simulation;
    const lesson = getLesson('dsp-window');
    const evaluation = evaluateLesson(lesson, { samples: simulation?.kind === 'dsp' ? { kind: 'scalar', data: simulation.signal.data.length } : null });
    recordLearningAttempt('dsp-window', evaluation.passed); notify(evaluation.passed ? 'DSP checkpoint passed' : 'Run the Signals experiment first.', evaluation.passed ? 'success' : 'error');
  });
  document.querySelector('[data-action="check-comm-lesson"]')?.addEventListener('click', () => {
    const simulation = getState().simulation;
    const lesson = getLesson('qpsk-ber');
    const evaluation = evaluateLesson(lesson, { ber: simulation?.kind === 'communication' ? { kind: 'report', data: { kind: 'ber', rate: simulation.ber.rate } } : null });
    recordLearningAttempt('qpsk-ber', evaluation.passed); notify(evaluation.passed ? 'BER checkpoint passed' : 'Run the Link Lab experiment first.', evaluation.passed ? 'success' : 'error');
  });
  bindCircuitEvents();
  bindDspEvents();
  bindCommunicationEvents();
  bindRfEvents();
  bindCalculatorEvents();
  bindPcbEvents();
  bindMcuEvents();
  bindBenchEvents();
  bindRecordEvents();
  bindPowerEvents();
  bindAdcEvents();
  bindSensorEvents();
  bindVlsiEvents();
  bindNetworkTheoryEvents();
  bindSigsysEvents();
  bindEmEvents();
  bindTwinEvents();
  bindFaultHuntEvents();
  bindMachinesEvents();
  bindProductEvents();
  bindPlcEvents();
  bindSpeechEvents();
  bindRadarEvents();
  bindMeasurementEvents();
  bindAnalogEvents();
  bindInfoEvents();
  bindReceiverEvents();
  bindCellularEvents();
  bindNetprotoEvents();
  bindCryptoEvents();
  bindWsnEvents();
  bindSdrEvents();
  bindDipEvents();
  bindBioEvents();
  bindNnEvents();
  bindConsoleEvents();
  bindLearningHubEvents();
  bindAssistantEvents();
  bindControlEvents();
  bindNetworkEvents();
  bindDigitalEvents();
  bindLogicEvents();
  bindEmbeddedEvents();
}

async function refreshEngineDetection() {
  if (!desktopBridge.available) { notify('Native detection is unavailable in the browser preview', 'error'); return; }
  const probes = engines.filter((engine) => Array.isArray(engine.candidates)).map((engine) => ({ id: engine.id, candidates: engine.candidates }));
  try {
    const results = await desktopBridge.detectEngines(probes);
    const detection = Object.fromEntries(results.map((result) => [result.id, result]));
    setState({ toolchainDetection: detection, ...(detection['arduino-cli']?.state === 'detected' ? {} : { arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null }) });
    notify('Toolchain paths checked without executing them', 'success');
  } catch (error) {
    notify(error?.message || 'Toolchain detection failed', 'error');
  }
}

async function refreshDesktopJobs() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Native jobs are unavailable in the browser preview', 'error'); return; }
  try {
    const jobs = await desktopBridge.listJobs(project.project_id);
    const events = await desktopBridge.drainEvents(project.project_id);
    setState({ desktopJobs: Array.isArray(jobs) ? jobs : [], desktopEvents: Array.isArray(events) ? events : [] });
    notify('Native job records refreshed', 'success');
  } catch (error) { notify(error?.message || 'Native jobs could not be listed', 'error'); }
}

async function cancelDesktopJob(id) {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id || !id) { notify('Native job cancellation is unavailable in the browser preview', 'error'); return; }
  try {
    await desktopBridge.cancelProcess(project.project_id, id);
    let terminal = null;
    for (let attempt = 0; attempt < 20 && !terminal; attempt += 1) {
      terminal = await desktopBridge.pollProcess(project.project_id, id);
      if (!terminal) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await refreshDesktopJobs();
    notify(terminal ? `Cancellation completed for ${id}` : `Cancellation requested for ${id}`, 'success');
  } catch (error) { notify(error?.message || 'Native job cancellation failed', 'error'); }
}

async function openDesktopProject() {
  if (!desktopBridge.available) { notify('Desktop project access is unavailable in the browser preview', 'error'); return; }
  let nativeOpened = false;
  try {
    if (nativeSessions.activeArduinoUpload) await cancelArduinoUpload(true);
    if (nativeSessions.activeHdlJob) await cancelHdlJob(true);
    const root = await desktopBridge.pickProjectDirectory();
    if (!root) return;
    const summary = await desktopBridge.openProject(root);
    nativeOpened = true;
    const project = await desktopBridge.readOpenProject();
    replaceProject(project);
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    setState({ desktopProject: summary, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify('Desktop project opened and validated', 'success');
  } catch (error) {
    if (nativeOpened) await desktopBridge.closeProject().catch(() => {});
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    setState({ desktopProject: null, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify(error?.message || 'Desktop project could not be opened', 'error');
  }
}

async function closeNativeSessionForBrowserProject() {
  if (!desktopBridge.available || !getState().desktopProject) return true;
  try {
    if (nativeSessions.activeArduinoUpload) await cancelArduinoUpload(true);
    if (nativeSessions.activeHdlJob) await cancelHdlJob(true);
    await desktopBridge.closeProject();
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    return true;
  } catch (error) {
    notify(error?.message || 'The native project session could not be closed', 'error');
    return false;
  }
}

function reviewProcessGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Open a desktop project before granting process execution', 'error'); return; }
  showModal('Review process permission', `<p>This grants external-process execution only to the currently opened project.</p><p>The grant is project-bound, is not a shell, and does not install tools or access hardware.</p><button class="button primary wide" data-action="confirm-process-grant">Grant for ${esc(project.name)}</button>`);
  document.querySelector('[data-action="confirm-process-grant"]')?.addEventListener('click', async () => {
    try {
      await desktopBridge.grantProcessExecution(project.project_id, true);
      setState({ processPermissionGranted: true });
      document.querySelector('.modal-done')?.click();
      notify('Process execution granted for this project', 'success');
    } catch (error) { notify(error?.message || 'Process permission was not granted', 'error'); }
  });
}

function reviewArtifactGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Open a desktop project before granting artifact writes', 'error'); return; }
  showModal('Review artifact-write permission', `<p>This grants generated-artifact writes only to the currently opened project.</p><p>Writes are confined to runs/ and build/, are content-addressed, and do not grant source, process or hardware access.</p><button class="button primary wide" data-action="confirm-artifact-grant">Grant for ${esc(project.name)}</button>`);
  document.querySelector('[data-action="confirm-artifact-grant"]')?.addEventListener('click', async () => {
    try {
      await desktopBridge.grantArtifactWrite(project.project_id, true);
      setState({ artifactPermissionGranted: true });
      document.querySelector('.modal-done')?.click();
      notify('Artifact writes granted for this project', 'success');
    } catch (error) { notify(error?.message || 'Artifact-write permission was not granted', 'error'); }
  });
}

async function revokeProcessGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) return;
  try { await desktopBridge.revokeProcessExecution(project.project_id); setState({ processPermissionGranted: false }); notify('Process execution revoked and owned jobs cancelled', 'success'); }
  catch (error) { notify(error?.message || 'Process permission could not be revoked', 'error'); }
}

async function revokeArtifactGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) return;
  try { await desktopBridge.revokeArtifactWrite(project.project_id); setState({ artifactPermissionGranted: false }); notify('Artifact-write permission revoked', 'success'); }
  catch (error) { notify(error?.message || 'Artifact permission could not be revoked', 'error'); }
}

async function saveDesktopProject() {
  if (!desktopBridge.available) { notify('Desktop project access is unavailable in the browser preview', 'error'); return; }
  try {
    await desktopBridge.saveOpenProject(getState().project);
    notify('Project saved to the desktop directory', 'success');
  } catch (error) {
    notify(error?.message || 'Desktop project could not be saved', 'error');
  }
}

function saveBrowserProject() {
  try { saveProject(); notify('Project saved locally', 'success'); }
  catch (error) { notify(error?.message || 'Project could not be saved', 'error'); }
}

function bindControlEvents() {
  bindControlLabEvents();
  document.querySelector('[data-action="run-control"]')?.addEventListener('click', () => {
    const read = (name, fallback) => { const value = Number(document.querySelector(`[data-control-field="${name}"]`)?.value); return Number.isFinite(value) ? value : fallback; };
    try {
      const gain = read('gain', 1); const tau = Math.max(0.001, read('tau', 0.1)); const sampleRate = Math.max(1, read('sampleRate', 100)); const length = Math.min(4096, Math.max(8, Math.trunc(read('length', 256))));
      recordExperiment({ id: 'control-step', kind: 'control', operation: 'step-response', inputs: { gain, tau, sampleRate, length } });
      setState({ simulation: { kind: 'control', response: firstOrderStep({ gain, tau, sampleRate, length }), stability: firstOrderStability(tau) } });
      notify('Control step response computed', 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="export-control"]')?.addEventListener('click', () => {
    const result = getState().simulation;
    const response = result?.kind === 'control' ? result.response : null;
    if (!response?.data?.length) { notify('Run the control experiment before exporting.', 'error'); return; }
    const rows = ['time_s,value', ...Array.from(response.data, (value, index) => `${(index / response.sampleRate).toFixed(9)},${Number(value).toPrecision(12)}`)];
    const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-step-response.csv'; link.click(); URL.revokeObjectURL(link.href); notify('Step response CSV exported', 'success');
  });
}

function bindNetworkEvents() {
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
    } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="run-topology"]')?.addEventListener('click', () => {
    try {
      const topology = JSON.parse(document.querySelector('[data-topology-field="json"]')?.value || '');
      recordExperiment({ id: 'topology-metrics', kind: 'network', operation: 'topology-metrics', inputs: { topology } });
      setState({ simulation: { kind: 'topology', metrics: topologyMetrics(topology, topology.nodes?.[0]?.id || null) } });
      notify('Topology metrics computed', 'success');
    } catch (error) { notify(error.message || 'Topology is invalid', 'error'); }
  });
}

function bindDigitalEvents() {
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

async function cancelHdlJob(silent = false) {
  const active = nativeSessions.activeHdlJob;
  if (!active) return;
  setState({ hdlJob: { runId: active.runId, engine: active.engine, operation: active.operation, phase: 'cancelling' } });
  try { await active.adapter.cancel(); if (!silent) notify(`Cancelling ${active.engine} ${active.operation}`, 'success'); }
  catch (error) { if (!silent) notify(error?.message || 'HDL job cancellation failed', 'error'); }
}

function bindDspEvents() {
  bindDspLabEvents();
  document.querySelector('[data-action="run-dsp"]')?.addEventListener('click', () => {
    const read = (name, fallback) => { const value = Number(document.querySelector(`[data-dsp-field="${name}"]`)?.value); return Number.isFinite(value) ? value : fallback; };
    try {
      const signal = generateSine({ frequency: read('frequency', 1000), sampleRate: read('sampleRate', 48000), length: Math.min(4096, Math.max(8, Math.trunc(read('length', 256)))), amplitude: 1 });
      const taps = Math.min(64, Math.max(1, Math.trunc(read('taps', 1))));
      const filtered = filterFir(signal, Array.from({ length: taps }, () => 1 / taps));
      const window = document.querySelector('[data-dsp-field="window"]')?.value || 'hann';
      const windowed = applyWindow(filtered, { window });
      recordExperiment({ id: 'signals-fft', kind: 'dsp', operation: 'fft', inputs: { frequency: signal.frequency, sampleRate: signal.sampleRate, length: signal.data.length, taps, window } });
      setState({ simulation: { kind: 'dsp', signal: windowed, taps, window, spectrum: fft(windowed) } });
      notify(`Signal filtered (${taps} FIR tap${taps === 1 ? '' : 's'}) and FFT computed`, 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
  document.querySelector('[data-action="export-dsp"]')?.addEventListener('click', () => {
    const result = getState().simulation;
    if (result?.kind !== 'dsp' || !result.signal?.data?.length) { notify('Run the Signals experiment before exporting.', 'error'); return; }
    const rows = ['time_s,value'];
    for (let index = 0; index < result.signal.data.length; index += 1) rows.push(`${index / result.signal.sampleRate},${result.signal.data[index]}`);
    const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-signal.csv'; link.click(); URL.revokeObjectURL(link.href); notify('Signal CSV exported', 'success');
  });
  document.querySelector('[data-action="export-spectrum"]')?.addEventListener('click', () => {
    const result = getState().simulation;
    if (result?.kind !== 'dsp' || !result.spectrum?.real?.length) { notify('Run the Signals experiment before exporting the spectrum.', 'error'); return; }
    const rows = ['frequency_hz,real,imaginary,magnitude'];
    for (let index = 0; index < result.spectrum.real.length; index += 1) { const real = result.spectrum.real[index]; const imaginary = result.spectrum.imaginary[index]; rows.push(`${result.spectrum.frequencies[index]},${real},${imaginary},${Math.hypot(real, imaginary)}`); }
    const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-spectrum.csv'; link.click(); URL.revokeObjectURL(link.href); notify('Spectrum CSV exported', 'success');
  });
}

function bindCommunicationEvents() {
  bindCommLabEvents();
  document.querySelector('[data-action="run-communication"]')?.addEventListener('click', () => {
    const bitsText = document.querySelector('[data-comm-field="bits"]')?.value?.trim() || '';
    const sigma = Number(document.querySelector('[data-comm-field="sigma"]')?.value);
    try {
      if (!/^[01]+$/.test(bitsText) || bitsText.length % 2 || bitsText.length > 256) throw new Error('Enter an even bit sequence containing only 0 and 1 (max 256 bits).');
      const bits = [...bitsText].map(Number); const source = qpskModulate(bits); const channel = addAwgn(source, { sigma: Number.isFinite(sigma) ? sigma : 0, seed: 7 });
      recordExperiment({ id: 'qpsk-ber', kind: 'communication', operation: 'qpsk-ber', inputs: { bits: bitsText, sigma: Number.isFinite(sigma) ? sigma : 0, seed: 7 } });
      setState({ simulation: { kind: 'communication', channel, ber: bitErrorRate(bits, qpskDemodulate(channel)) } });
      notify('QPSK experiment completed', 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
}

function bindRfEvents() {
  bindRfLabEvents();
  const saved = getState().project.experiments.find((experiment) => experiment?.id === 'rf-touchstone')?.inputs || {};
  const rfText = document.querySelector('[data-rf-field="text"]');
  const rfPorts = document.querySelector('[data-rf-field="ports"]');
  if (saved.text && rfText) rfText.value = saved.text;
  if (Number.isInteger(saved.ports) && rfPorts) rfPorts.value = String(saved.ports);
  document.querySelector('[data-action="parse-rf"]')?.addEventListener('click', () => {
    const text = document.querySelector('[data-rf-field="text"]')?.value || ''; const ports = Number(document.querySelector('[data-rf-field="ports"]')?.value);
    try { const normalizedPorts = Number.isInteger(ports) ? ports : 2; const data = parseTouchstone(text, { ports: normalizedPorts }); recordExperiment({ id: 'rf-touchstone', kind: 'rf', operation: 'touchstone-parse', inputs: { text, ports: normalizedPorts } }); setState({ simulation: { kind: 'rf', data } }); notify('Touchstone data parsed', 'success'); }
    catch (error) { notify(error.message, 'error'); }
  });
}

function bindCircuitEvents() {
  document.querySelectorAll('[data-add-component]').forEach((button) => button.addEventListener('click', () => addComponent(button.dataset.addComponent)));
  document.querySelectorAll('[data-component-id]').forEach((part) => {
    part.addEventListener('click', (event) => selectComponent(part.dataset.componentId, event.shiftKey));
    part.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectComponent(part.dataset.componentId, event.shiftKey); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        selectComponent(part.dataset.componentId, event.shiftKey);
        const step = getState().project.settings.grid ? getState().project.settings.gridSize : 10;
        moveSelected(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
      }
    });
    part.addEventListener('pointerdown', beginDrag);
  });
  bindCanvasSelection();
  document.querySelectorAll('[data-part-field]').forEach((input) => input.addEventListener('change', () => {
    circuitEditor.wireSource = null;
    if (input.dataset.partField === 'kp') {
      try {
        const kp = parseEngineeringValue(input.value);
        if (!(kp > 0)) throw new RangeError('Transconductance K must be greater than zero.');
        updateProject((project) => { const part = project.circuit.components.find((item) => item.id === getState().selectedComponentId); if (part) part.kp = kp; });
      } catch (error) { notify(error.message, 'error'); }
      return;
    }
    if (input.dataset.partField === 'value') {
      const selected = getState().project.circuit.components.find((item) => item.id === getState().selectedComponentId);
      try {
        const value = parseEngineeringValue(input.value, { unit: selected?.unit || null });
        updateProject((project) => { const part = project.circuit.components.find((item) => item.id === getState().selectedComponentId); if (part) part.value = value; });
      } catch (error) { notify(error.message, 'error'); }
      return;
    }
    updateProject((project) => { const part = project.circuit.components.find((item) => item.id === getState().selectedComponentId); if (part) part[input.dataset.partField] = input.value; });
  }));
  document.querySelectorAll('[data-signal-field]').forEach((input) => input.addEventListener('change', () => updateProject((project) => { project.circuit.signal[input.dataset.signalField] = input.type === 'number' ? Number(input.value) : input.value; })));
  document.querySelectorAll('[data-ngspice-field]').forEach((input) => input.addEventListener('change', () => persistNgspiceConfiguration(input.dataset.ngspiceField, input.value, input.type === 'number')));
  document.querySelectorAll('[data-ngspice-view]').forEach((input) => input.addEventListener('change', () => updateNgspiceViewField(input.dataset.ngspiceView, Number(input.value))));
  document.querySelector('[data-action="ngspice-zoom-in"]')?.addEventListener('click', () => transformNgspiceWindow('zoom-in'));
  document.querySelector('[data-action="ngspice-zoom-out"]')?.addEventListener('click', () => transformNgspiceWindow('zoom-out'));
  document.querySelector('[data-action="ngspice-pan-left"]')?.addEventListener('click', () => transformNgspiceWindow('pan-left'));
  document.querySelector('[data-action="ngspice-pan-right"]')?.addEventListener('click', () => transformNgspiceWindow('pan-right'));
  document.querySelector('[data-action="export-ngspice-csv"]')?.addEventListener('click', exportNgspiceCsv);
  document.querySelector('[data-action="simulate"]')?.addEventListener('click', runSimulation);
  document.querySelectorAll('[data-builtin-field]').forEach((input) => input.addEventListener('change', () => persistBuiltinConfiguration(input.dataset.builtinField, input.value)));
  document.querySelector('[data-circuit-plot="trace"]')?.addEventListener('change', (event) => setState({ circuitPlotTrace: event.target.value }));
  document.querySelector('[data-action="export-circuit-csv"]')?.addEventListener('click', exportCircuitCsv);
  document.querySelectorAll('[data-load-example]').forEach((button) => button.addEventListener('click', () => loadExampleCircuit(button.dataset.loadExample)));
  document.querySelector('[data-action="run-ngspice"]')?.addEventListener('click', runNativeNgspice);
  document.querySelector('[data-action="export-spice"]')?.addEventListener('click', exportSpiceNetlist);
  document.querySelector('[data-action="deselect"]')?.addEventListener('click', () => setState({ selectedComponentId: null, selectedComponentIds: [] }));
  document.querySelector('[data-action="delete-component"]')?.addEventListener('click', deleteSelected);
  document.querySelector('[data-action="rotate-component"]')?.addEventListener('click', rotateSelected);
  document.querySelector('[data-action="add-net-label"]')?.addEventListener('click', addNetLabel);
  document.querySelector('[data-action="add-junction"]')?.addEventListener('click', addJunction);
  document.querySelectorAll('[data-wire-node]').forEach((button) => button.addEventListener('click', () => chooseWireNode(button.dataset.wireNode)));
  document.querySelectorAll('[data-wire-remove-from]').forEach((button) => button.addEventListener('click', () => {
    const from = button.dataset.wireRemoveFrom;
    const to = button.dataset.wireRemoveTo;
    updateProject((project) => { project.circuit.wires = disconnectNodes(project.circuit.wires, from, to); });
    notify(`Disconnected ${from} from ${to}`, 'success');
  }));
  document.querySelectorAll('[data-diagnostic-component]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.diagnosticComponent;
    if (!getState().project.circuit.components.some((component) => component.id === id)) return;
    const pinName = button.dataset.diagnosticPin;
    selectComponent(id);
    if (pinName) {
      const endpoint = `${id}:${pinName}`;
      requestAnimationFrame(() => [...document.querySelectorAll('[data-canvas-node]')].find((pin) => pin.dataset.canvasNode === endpoint)?.focus());
    }
  }));
  document.querySelectorAll('[data-canvas-node]').forEach((pin) => {
    pin.addEventListener('pointerdown', (event) => event.stopPropagation());
    pin.addEventListener('click', (event) => { event.stopPropagation(); chooseWireNode(pin.dataset.canvasNode); });
    pin.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); chooseWireNode(pin.dataset.canvasNode); } });
  });
  bindCanvasViewport();
  bindWireRouteEvents();
  bindAuthoredMarkerEvents();
  document.querySelector('[data-action="toggle-grid"]')?.addEventListener('click', () => updateProject((project) => { const sizes = [10, 20, 40]; if (!project.settings.grid) project.settings.grid = true; else { const index = sizes.indexOf(project.settings.gridSize); if (index === sizes.length - 1) project.settings.grid = false; else project.settings.gridSize = sizes[index < 0 ? 1 : index + 1]; } }));
  document.querySelector('[data-action="undo"]')?.addEventListener('click', () => { if (undoProject()) notify('Project change undone', 'info'); });
  document.querySelector('[data-action="redo"]')?.addEventListener('click', () => { if (redoProject()) notify('Project change redone', 'info'); });
  document.querySelector('[data-action="clear-circuit"]')?.addEventListener('click', () => { circuitEditor.wireSource = null; circuitEditor.selectedWire = null; updateProject((project) => { project.circuit.components = []; project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; }); setState({ selectedComponentId: null, simulation: null }); });
  document.querySelector('[data-action="annotate-components"]')?.addEventListener('click', annotateCircuitComponents);
  document.querySelector('[data-field="component-search"]')?.addEventListener('input', (event) => {
    document.querySelectorAll('.component-list button').forEach((button) => { button.hidden = !button.textContent.toLowerCase().includes(event.target.value.toLowerCase()); });
  });
}

function bindEmbeddedEvents() {
  const editor = document.querySelector('[data-field="embedded-code"]');
  editor?.addEventListener('input', () => updateProject((project) => { project.embedded.code = editor.value; }));
  document.querySelector('[data-action="validate-code"]')?.addEventListener('click', validateCode);
  document.querySelector('[data-action="refresh-arduino-inventory"]')?.addEventListener('click', refreshArduinoInventory);
  document.querySelector('[data-field="arduino-board"]')?.addEventListener('change', async (event) => {
    const before = getState(); const previous = before.arduinoDeviceGrant;
    const board = before.arduinoInventory?.boards.find((candidate) => candidate.fqbn === event.target.value);
    if (previous && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previous.permission, previous.target).catch(() => {});
    recordExperiment({ id: 'firmware-arduino-target', kind: 'firmware', operation: 'arduino-target', inputs: board ? { name: board.name, fqbn: board.fqbn } : {} });
    setState({ arduinoDeviceGrant: null });
  });
  document.querySelector('[data-field="arduino-port"]')?.addEventListener('change', async (event) => {
    const before = getState(); const previous = before.arduinoDeviceGrant; const previousSerial = before.arduinoSerialGrant;
    const port = String(event.target.value || '').trim();
    if (/[\u0000-\u001f\u007f]/.test(port)) { notify('Port identifier contains invalid control characters', 'error'); return; }
    if (nativeSessions.activeSerialNative) await disconnectArduinoSerial();
    if (previous && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previous.permission, previous.target).catch(() => {});
    if (previousSerial && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previousSerial.permission, previousSerial.target).catch(() => {});
    recordExperiment({ id: 'firmware-arduino-port', kind: 'firmware', operation: 'arduino-port', inputs: port ? { port } : {} });
    setState({ arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null });
  });
  document.querySelectorAll('[data-serial-config]').forEach((input) => input.addEventListener('change', () => {
    const current = getState().project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
    const field = input.dataset.serialConfig; const value = field === 'baud' ? Number(input.value) : field === 'timestamps' ? input.checked : input.value;
    recordExperiment({ id: 'firmware-serial-config', kind: 'firmware', operation: 'serial-terminal', inputs: { ...current, [field]: value } });
  }));
  document.querySelector('[data-action="build-arduino"]')?.addEventListener('click', runNativeArduinoCompile);
  document.querySelector('[data-action="grant-arduino-programmer"]')?.addEventListener('click', reviewArduinoProgrammerGrant);
  document.querySelector('[data-action="revoke-arduino-programmer"]')?.addEventListener('click', revokeArduinoProgrammerGrant);
  document.querySelector('[data-action="upload-arduino"]')?.addEventListener('click', runNativeArduinoUpload);
  document.querySelector('[data-action="cancel-arduino-upload"]')?.addEventListener('click', cancelArduinoUpload);
  document.querySelector('[data-action="grant-arduino-serial"]')?.addEventListener('click', reviewArduinoSerialGrant);
  document.querySelector('[data-action="revoke-arduino-serial"]')?.addEventListener('click', revokeArduinoSerialGrant);
  document.querySelector('[data-action="connect-arduino-serial"]')?.addEventListener('click', connectArduinoSerial);
  document.querySelector('[data-action="reconnect-arduino-serial"]')?.addEventListener('click', reconnectArduinoSerial);
  document.querySelector('[data-action="disconnect-arduino-serial"]')?.addEventListener('click', disconnectArduinoSerial);
  document.querySelector('[data-action="pause-arduino-serial"]')?.addEventListener('click', toggleArduinoSerialPause);
  document.querySelector('[data-action="clear-arduino-serial"]')?.addEventListener('click', clearArduinoSerial);
  document.querySelector('[data-action="export-arduino-serial"]')?.addEventListener('click', exportArduinoSerial);
  document.querySelector('[data-action="send-arduino-serial"]')?.addEventListener('click', sendArduinoSerial);
}

function selectComponent(id, additive = false) {
  const current = getState().selectedComponentIds || [];
  const next = additive ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id];
  setState({ selectedComponentId: next.at(-1) || null, selectedComponentIds: next });
}

function bindCanvasSelection() {
  const stage = document.querySelector('#circuit-stage');
  if (!stage) return;
  let start = null;
  let startScreen = null;
  let box = null;
  stage.addEventListener('pointerdown', (event) => {
    if ((event.target !== stage && !event.target.classList.contains('canvas-content')) || event.button !== 0) return;
    const bounds = stage.getBoundingClientRect();
    startScreen = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    start = screenToCanvas(startScreen, getState().canvasView || { x: 0, y: 0, scale: 1 });
    box = document.createElement('div');
    box.className = 'selection-box';
    stage.append(box);
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!start || !box) return;
    const bounds = stage.getBoundingClientRect();
    const currentScreen = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    box.style.left = `${Math.min(startScreen.x, currentScreen.x)}px`;
    box.style.top = `${Math.min(startScreen.y, currentScreen.y)}px`;
    box.style.width = `${Math.abs(currentScreen.x - startScreen.x)}px`;
    box.style.height = `${Math.abs(currentScreen.y - startScreen.y)}px`;
  });
  stage.addEventListener('pointerup', (event) => {
    if (!start) return;
    const bounds = stage.getBoundingClientRect();
    const end = screenToCanvas({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, getState().canvasView || { x: 0, y: 0, scale: 1 });
    const rect = { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y };
    const ids = componentsInRect(getState().project.circuit.components, rect);
    if (box) box.remove();
    start = null; startScreen = null; box = null;
    setState({ selectedComponentId: ids.at(-1) || null, selectedComponentIds: ids });
  });
}

function bindCanvasViewport() {
  const stage = document.querySelector('#circuit-stage');
  const controls = stage?.querySelector('.canvas-zoom');
  if (!stage || !controls) return;
  controls.querySelectorAll('button').forEach((button) => button.disabled = false);
  controls.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => updateCanvasZoom(0.8));
  controls.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => updateCanvasZoom(1.25));
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    const bounds = stage.getBoundingClientRect();
    const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    updateCanvasZoom(event.deltaY < 0 ? 1.1 : 0.9, anchor);
  }, { passive: false });
  bindCanvasPan(stage);
  document.querySelector('[data-action="fit-canvas"]')?.addEventListener('click', () => {
    const bounds = stage.getBoundingClientRect();
    setState({ canvasView: fitCanvasView(getState().project.circuit.components, { width: bounds.width, height: bounds.height }) });
  });
}

function bindCanvasPan(stage) {
  let pan = null;
  const content = () => stage.querySelector('.canvas-content');
  stage.addEventListener('pointerdown', (event) => {
    if ((!event.altKey && event.button !== 1) || !content()) return;
    event.preventDefault();
    event.stopPropagation();
    const view = getState().canvasView || { x: 0, y: 0, scale: 1 };
    pan = { startX: event.clientX, startY: event.clientY, view: { ...view } };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!pan) return;
    const next = { ...pan.view, x: pan.view.x + event.clientX - pan.startX, y: pan.view.y + event.clientY - pan.startY };
    const target = content();
    if (target) target.style.transform = `translate(${next.x}px,${next.y}px) scale(${next.scale})`;
  });
  stage.addEventListener('pointerup', (event) => {
    if (!pan) return;
    setState({ canvasView: { ...pan.view, x: pan.view.x + event.clientX - pan.startX, y: pan.view.y + event.clientY - pan.startY } });
    pan = null;
  });
}

function updateCanvasZoom(factor, anchor = { x: 0, y: 0 }) {
  setState({ canvasView: zoomCanvasView(getState().canvasView || { x: 0, y: 0, scale: 1 }, factor, anchor) });
}

function addComponent(type) {
  const template = componentPalette.find((item) => item.type === type);
  updateProject((project) => {
    const prefix = componentReferencePrefixes[type] || 'X';
    const used = new Set(project.circuit.components.map((part) => part.id));
    let count = 1;
    while (used.has(`${prefix}${count}`)) count += 1;
    const id = `${prefix}${count}`;
    // Spread new parts by total part count so different types never land on the same spot.
    const slot = project.circuit.components.length + 1;
    const raw = { x: 130 + (slot * 47) % 420, y: 90 + (slot * 71) % 260 };
    const point = project.settings.grid ? snapCanvasPoint(raw, project.settings.gridSize) : raw;
    const base = id.toLowerCase();
    const terminals = type === 'opamp' ? { n1: '0', n2: `${base}_in`, n3: `${base}_out` }
      : nodeFields({ type }).length === 3 ? { n1: `${base}_${type.endsWith('mos') ? 'd' : 'c'}`, n2: `${base}_${type.endsWith('mos') ? 'g' : 'b'}`, n3: '0' }
        : { n1: type === 'ground' ? '0' : `n${count}`, n2: '0' };
    project.circuit.components.push({ id, type, label: type === 'ground' ? 'GND' : id, value: template.defaultValue, unit: template.unit, ...terminals, x: point.x, y: point.y });
    setTimeout(() => setState({ selectedComponentId: id, selectedComponentIds: [id] }), 0);
  });
}

function annotateCircuitComponents() {
  const result = annotateReferences(getState().project.circuit.components);
  updateProject((project) => { project.circuit.components = result.components; });
  setState({ selectedComponentId: null, selectedComponentIds: [], simulation: null });
  notify(result.renames.size ? `Annotated ${result.components.length} component${result.components.length === 1 ? '' : 's'}` : 'Reference designators already normalized', 'success');
}

function beginDrag(event) {
  if (event.button !== 0 || event.altKey) return;
  const element = event.currentTarget;
  const id = element.dataset.componentId;
  const selectedIds = getState().selectedComponentIds?.includes(id) ? [...getState().selectedComponentIds] : [id];
  const scale = getState().canvasView?.scale || 1;
  const startX = event.clientX, startY = event.clientY;
  const initialLeft = parseFloat(element.style.left), initialTop = parseFloat(element.style.top);
  let moved = false;
  element.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 2) moved = true;
    element.style.left = `${Math.max(12, initialLeft + (moveEvent.clientX - startX) / scale)}px`;
    element.style.top = `${Math.max(42, initialTop + (moveEvent.clientY - startY) / scale)}px`;
  };
  const end = () => {
    element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end);
    if (!moved) return;
    const dx = parseFloat(element.style.left) - initialLeft;
    const dy = parseFloat(element.style.top) - initialTop;
    updateProject((project) => { project.circuit.components.forEach((part) => { if (selectedIds.includes(part.id)) { if (part.id === id) { const point = project.settings.grid ? snapCanvasPoint({ x: parseFloat(element.style.left), y: parseFloat(element.style.top) }, project.settings.gridSize) : { x: parseFloat(element.style.left), y: parseFloat(element.style.top) }; part.x = point.x; part.y = point.y; element.style.left = `${point.x}px`; element.style.top = `${point.y}px`; } else { const point = project.settings.grid ? snapCanvasPoint({ x: part.x + dx, y: part.y + dy }, project.settings.gridSize) : { x: part.x + dx, y: part.y + dy }; part.x = point.x; part.y = point.y; } } }); });
  };
  element.addEventListener('pointermove', move); element.addEventListener('pointerup', end);
}

function deleteSelected() {
  const id = getState().selectedComponentId;
  const selectedIds = getState().selectedComponentIds?.length ? getState().selectedComponentIds : (id ? [id] : []);
  circuitEditor.wireSource = null;
  if (!selectedIds.length) return;
  updateProject((project) => {
    project.circuit.components = project.circuit.components.filter((part) => !selectedIds.includes(part.id));
    const retainedNodes = [
      ...project.circuit.components.flatMap((part) => nodeFields(part).map((field) => part[field])),
      ...project.circuit.netLabels.map((label) => label.node),
      ...project.circuit.junctions.map((junction) => junction.node),
    ];
    project.circuit.wires = pruneWires(project.circuit.wires, retainedNodes);
  });
  setState({ selectedComponentId: null, selectedComponentIds: [], simulation: null });
  notify(`${selectedIds.length} component${selectedIds.length === 1 ? '' : 's'} deleted`, 'success');
}

function rotateSelected() {
  const id = getState().selectedComponentId;
  if (!id) return;
  const selectedIds = getState().selectedComponentIds?.length ? getState().selectedComponentIds : [id];
  updateProject((project) => { project.circuit.components = rotateComponents(project.circuit.components, selectedIds); });
  notify('Component rotated 90°', 'success');
}

function moveSelected(dx, dy) {
  const ids = getState().selectedComponentIds?.length ? getState().selectedComponentIds : [getState().selectedComponentId];
  const selectedIds = ids.filter(Boolean);
  if (!selectedIds.length) return;
  updateProject((project) => { project.circuit.components = moveComponents(project.circuit.components, selectedIds, { x: dx, y: dy }); });
}

function copySelected() {
  const state = getState();
  const ids = state.selectedComponentIds?.length ? state.selectedComponentIds : (state.selectedComponentId ? [state.selectedComponentId] : []);
  circuitEditor.clipboardParts = state.project.circuit.components.filter((part) => ids.includes(part.id)).map((part) => structuredClone(part));
  const nodes = new Set(circuitEditor.clipboardParts.flatMap((part) => nodeFields(part).map((field) => part[field])).filter((node) => typeof node === 'string'));
  circuitEditor.clipboardWires = state.project.circuit.wires.filter((wire) => nodes.has(wire.from) && nodes.has(wire.to)).map((wire) => structuredClone(wire));
  if (!circuitEditor.clipboardParts.length) return false;
  notify(`${circuitEditor.clipboardParts.length} component${circuitEditor.clipboardParts.length === 1 ? '' : 's'} copied`, 'info');
  return true;
}

function pasteCopied() {
  if (!circuitEditor.clipboardParts.length) return false;
  let nextIds = [];
  updateProject((project) => {
    const pasteOffset = { x: 28, y: 28 };
    const result = pasteComponents(project.circuit.components, circuitEditor.clipboardParts, pasteOffset);
    project.circuit.components = result.components;
    project.circuit.wires = circuitEditor.clipboardWires.reduce((wires, wire) => {
      const from = result.nodeMap[wire.from] || wire.from;
      const to = result.nodeMap[wire.to] || wire.to;
      const connected = connectNodes(wires, from, to);
      if (!wire.route) return connected;
      const route = Array.isArray(wire.route.points)
        ? { points: wire.route.points.map((point) => ({ x: point.x + pasteOffset.x, y: point.y + pasteOffset.y })) }
        : { axis: wire.route.axis, coordinate: wire.route.coordinate + pasteOffset[wire.route.axis] };
      return setWireRoute(connected, from, to, route);
    }, project.circuit.wires);
    nextIds = result.ids;
  });
  setState({ selectedComponentId: nextIds.at(-1) || null, selectedComponentIds: nextIds, simulation: null });
  notify(`${nextIds.length} component${nextIds.length === 1 ? '' : 's'} pasted`, 'success');
  return true;
}

function chooseWireNode(endpoint) {
  const [partId, field] = endpoint.split(':');
  const part = getState().project.circuit.components.find((item) => item.id === partId);
  if (!part || !nodeFields(part).includes(field)) return;
  const node = part[field];
  if (!circuitEditor.wireSource) {
    circuitEditor.wireSource = { partId, field, node };
  setState({ selectedComponentId: partId, selectedComponentIds: [partId] });
    notify(`Wire source selected: ${node}`, 'info');
    return;
  }
  if (circuitEditor.wireSource.partId === partId && circuitEditor.wireSource.field === field) {
    circuitEditor.wireSource = null;
    notify('Wire source cleared', 'info');
    setState({ selectedComponentId: partId, selectedComponentIds: [partId] });
    return;
  }
  const source = circuitEditor.wireSource;
  circuitEditor.wireSource = null;
  updateProject((project) => { project.circuit.wires = connectNodes(project.circuit.wires, source.node, node); });
  setState({ selectedComponentId: partId, simulation: null });
  notify(`Connected ${source.node} to ${node}`, 'success');
}

function addNetLabel() {
  const selected = getState().project.circuit.components.find((part) => part.id === getState().selectedComponentId);
  if (!selected) return;
  const text = window.prompt('Net label text', selected.n1);
  if (!text?.trim()) return;
  const value = text.trim().slice(0, 100);
  updateProject((project) => {
    const next = project.circuit.netLabels.length + 1;
    project.circuit.netLabels.push({ id: `N${next}`, text: value, node: selected.n1, x: selected.x + 45, y: selected.y + 25 });
  });
  notify(`Net label ${value} added`, 'success');
}

function addJunction() {
  const selected = getState().project.circuit.components.find((part) => part.id === getState().selectedComponentId);
  if (!selected) return;
  updateProject((project) => {
    const next = project.circuit.junctions.length + 1;
    project.circuit.junctions.push({ id: `J${next}`, node: selected.n1, x: selected.x + 45, y: selected.y + 25 });
  });
  notify('Junction added to the selected node', 'success');
}

function findWireSegment(from, to) {
  return buildWireSegments(getState().project.circuit.components, getState().project.circuit.wires)
    .find((segment) => segment.fromNode === from && segment.toNode === to);
}

function updateWireRoute(from, to, route) {
  updateProject((project) => { project.circuit.wires = setWireRoute(project.circuit.wires, from, to, route); });
}

function routeWithAddedPoint(segment, point) {
  const existing = Array.isArray(segment.route?.points) ? segment.route.points.map((entry) => ({ ...entry })) : [];
  if (existing.length >= 64) return null;
  const anchors = [segment.from, ...existing, segment.to];
  let insertAt = 0; let bestCost = Infinity;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const a = anchors[index]; const b = anchors[index + 1];
    const cost = Math.abs(point.x - a.x) + Math.abs(point.y - a.y) + Math.abs(b.x - point.x) + Math.abs(b.y - point.y) - Math.abs(b.x - a.x) - Math.abs(b.y - a.y);
    if (cost < bestCost) { bestCost = cost; insertAt = index; }
  }
  existing.splice(insertAt, 0, { x: point.x, y: point.y });
  return { points: existing };
}

function addWireRoutePoint(from, to, point) {
  const segment = findWireSegment(from, to); if (!segment) return;
  const route = routeWithAddedPoint(segment, point);
  if (!route) { notify('A wire can contain at most 64 bends', 'error'); return; }
  updateWireRoute(from, to, route);
}

function bindWireRouteEvents() {
  document.querySelectorAll('[data-wire-route-from]').forEach((path) => {
    const select = () => {
      circuitEditor.selectedWire = { from: path.dataset.wireRouteFrom, to: path.dataset.wireRouteTo };
      setState({ selectedComponentId: null, selectedComponentIds: [] });
    };
    path.addEventListener('click', (event) => { event.stopPropagation(); select(); });
    path.addEventListener('dblclick', (event) => {
      event.preventDefault(); event.stopPropagation(); select();
      const stage = document.querySelector('#circuit-stage'); if (!stage) return;
      const bounds = stage.getBoundingClientRect();
      let point = screenToCanvas({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, getState().canvasView || { x: 0, y: 0, scale: 1 });
      if (getState().project.settings.grid) point = snapCanvasPoint(point, getState().project.settings.gridSize);
      addWireRoutePoint(path.dataset.wireRouteFrom, path.dataset.wireRouteTo, point);
    });
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); return; }
      const from = path.dataset.wireRouteFrom; const to = path.dataset.wireRouteTo;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); circuitEditor.selectedWire = null;
        updateProject((project) => { project.circuit.wires = disconnectNodes(project.circuit.wires, from, to); });
        notify(`Disconnected ${from} from ${to}`, 'success');
      } else if (event.key === 'Insert' || event.key === '+') {
        event.preventDefault();
        const segment = findWireSegment(from, to); if (!segment) return;
        addWireRoutePoint(from, to, wireRouteInsertionPoint(segment.from, segment.to, segment.route));
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        const segment = findWireSegment(from, to); if (!segment) return;
        const current = segment.route || defaultWireRoute(segment.from, segment.to);
        if (Array.isArray(current.points)) return;
        const route = current.axis === 'x' ? { axis: 'y', coordinate: (segment.from.y + segment.to.y) / 2 } : { axis: 'x', coordinate: (segment.from.x + segment.to.x) / 2 };
        updateWireRoute(from, to, route);
      } else if (event.key === '0') {
        event.preventDefault(); updateWireRoute(from, to, undefined);
      }
    });
  });
  document.querySelectorAll('[data-wire-handle-from]').forEach((handle) => {
    handle.addEventListener('pointerdown', beginWireRouteDrag);
    handle.addEventListener('keydown', (event) => {
      const axis = handle.dataset.wireAxis;
      const pointIndex = Number(handle.dataset.wirePointIndex);
      const segment = findWireSegment(handle.dataset.wireHandleFrom, handle.dataset.wireHandleTo); if (!segment) return;
      if (axis === 'point' && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); event.stopPropagation();
        const points = segment.route.points.filter((_, index) => index !== pointIndex);
        updateWireRoute(segment.fromNode, segment.toNode, points.length ? { points } : undefined);
        return;
      }
      if (axis === 'point') {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!(event.key in directions)) return;
        event.preventDefault(); event.stopPropagation();
        const step = (getState().project.settings.grid ? getState().project.settings.gridSize : 10) * (event.shiftKey ? 5 : 1);
        const points = segment.route.points.map((point, index) => index === pointIndex ? { x: point.x + directions[event.key][0] * step, y: point.y + directions[event.key][1] * step } : { ...point });
        updateWireRoute(segment.fromNode, segment.toNode, { points });
        return;
      }
      const directions = axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
      if (!(event.key in directions)) return;
      event.preventDefault(); event.stopPropagation();
      const current = segment.route || defaultWireRoute(segment.from, segment.to);
      const step = (getState().project.settings.grid ? getState().project.settings.gridSize : 10) * (event.shiftKey ? 5 : 1);
      updateWireRoute(segment.fromNode, segment.toNode, { axis, coordinate: current.coordinate + directions[event.key] * step });
    });
  });
}

function beginWireRouteDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault(); event.stopPropagation();
  const handle = event.currentTarget;
  const stage = document.querySelector('#circuit-stage');
  const segment = findWireSegment(handle.dataset.wireHandleFrom, handle.dataset.wireHandleTo);
  if (!stage || !segment) return;
  const axis = handle.dataset.wireAxis;
  const pointIndex = Number(handle.dataset.wirePointIndex);
  const path = [...document.querySelectorAll('[data-wire-route-from]')].find((entry) => entry.dataset.wireRouteFrom === segment.fromNode && entry.dataset.wireRouteTo === segment.toNode);
  let coordinate = (segment.route || defaultWireRoute(segment.from, segment.to)).coordinate;
  let points = Array.isArray(segment.route?.points) ? segment.route.points.map((point) => ({ ...point })) : null;
  let moved = false;
  handle.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    const bounds = stage.getBoundingClientRect();
    let point = screenToCanvas({ x: moveEvent.clientX - bounds.left, y: moveEvent.clientY - bounds.top }, getState().canvasView || { x: 0, y: 0, scale: 1 });
    if (getState().project.settings.grid) point = snapCanvasPoint(point, getState().project.settings.gridSize);
    moved = true;
    let route; let visual;
    if (axis === 'point') {
      points[pointIndex] = { x: point.x, y: point.y };
      route = { points };
      visual = wireRouteHandles(segment.from, segment.to, route)[pointIndex];
    } else {
      coordinate = axis === 'x' ? point.x : point.y;
      route = { axis, coordinate };
      visual = wireRouteHandle(segment.from, segment.to, route);
    }
    handle.setAttribute('cx', String(visual.x)); handle.setAttribute('cy', String(visual.y));
    path?.setAttribute('d', orthogonalPath(segment.from, segment.to, route));
  };
  const end = () => {
    handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end);
    if (moved) updateWireRoute(segment.fromNode, segment.toNode, axis === 'point' ? { points } : { axis, coordinate });
  };
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}

function bindAuthoredMarkerEvents() {
  document.querySelectorAll('[data-net-label-id]').forEach((marker) => {
    const edit = () => editNetLabel(marker.dataset.netLabelId);
    marker.addEventListener('dblclick', edit);
    marker.addEventListener('pointerdown', (event) => beginMarkerDrag(event, 'netLabels', marker.dataset.netLabelId));
    marker.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edit(); } else if (event.key === 'Delete' || event.key === 'Backspace') removeNetLabel(marker.dataset.netLabelId); else moveMarkerWithKeyboard(event, 'netLabels', marker.dataset.netLabelId); });
  });
  document.querySelectorAll('[data-junction-id]').forEach((marker) => {
    const edit = () => editJunction(marker.dataset.junctionId);
    marker.addEventListener('dblclick', edit);
    marker.addEventListener('pointerdown', (event) => beginMarkerDrag(event, 'junctions', marker.dataset.junctionId));
    marker.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edit(); } else if (event.key === 'Delete' || event.key === 'Backspace') removeJunction(marker.dataset.junctionId); else moveMarkerWithKeyboard(event, 'junctions', marker.dataset.junctionId); });
  });
}

function moveMarkerWithKeyboard(event, collection, id) {
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!(event.key in directions)) return;
  event.preventDefault(); event.stopPropagation();
  const step = (getState().project.settings.grid ? getState().project.settings.gridSize : 10) * (event.shiftKey ? 5 : 1);
  const [dx, dy] = directions[event.key];
  updateProject((project) => { const marker = project.circuit[collection].find((entry) => entry.id === id); if (marker) { marker.x += dx * step; marker.y += dy * step; } });
}

function beginMarkerDrag(event, collection, id) {
  if (event.button !== 0) return;
  event.preventDefault(); event.stopPropagation();
  const marker = event.currentTarget;
  const stage = document.querySelector('#circuit-stage');
  if (!stage) return;
  let point = null;
  marker.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    const bounds = stage.getBoundingClientRect();
    point = screenToCanvas({ x: moveEvent.clientX - bounds.left, y: moveEvent.clientY - bounds.top }, getState().canvasView || { x: 0, y: 0, scale: 1 });
    if (getState().project.settings.grid) point = snapCanvasPoint(point, getState().project.settings.gridSize);
    if (marker.tagName.toLowerCase() === 'g') marker.setAttribute('transform', `translate(${point.x - Number(marker.dataset.markerX)},${point.y - Number(marker.dataset.markerY)})`);
    else { marker.setAttribute('cx', String(point.x)); marker.setAttribute('cy', String(point.y)); }
  };
  const end = () => {
    marker.removeEventListener('pointermove', move); marker.removeEventListener('pointerup', end); marker.removeEventListener('pointercancel', end);
    if (point) updateProject((project) => { const entry = project.circuit[collection].find((item) => item.id === id); if (entry) { entry.x = point.x; entry.y = point.y; } });
  };
  marker.addEventListener('pointermove', move); marker.addEventListener('pointerup', end); marker.addEventListener('pointercancel', end);
}

function editNetLabel(id) {
  const current = getState().project.circuit.netLabels.find((label) => label.id === id);
  if (!current) return;
  const text = window.prompt('Net label text', current.text);
  if (!text?.trim()) return;
  updateProject((project) => { const label = project.circuit.netLabels.find((entry) => entry.id === id); if (label) label.text = text.trim().slice(0, 100); });
  notify('Net label updated', 'success');
}

function editJunction(id) {
  const current = getState().project.circuit.junctions.find((junction) => junction.id === id);
  if (!current) return;
  const node = window.prompt('Junction node', current.node);
  if (!node?.trim()) return;
  updateProject((project) => { const junction = project.circuit.junctions.find((entry) => entry.id === id); if (junction) junction.node = node.trim().slice(0, 100); });
  notify('Junction updated', 'success');
}

function removeNetLabel(id) {
  updateProject((project) => { project.circuit.netLabels = project.circuit.netLabels.filter((label) => label.id !== id); });
  notify('Net label removed', 'success');
}

function removeJunction(id) {
  updateProject((project) => { project.circuit.junctions = project.circuit.junctions.filter((junction) => junction.id !== id); });
  notify('Junction removed', 'success');
}

function persistNgspiceConfiguration(field, rawValue, numeric) {
  const allowed = new Set(['operation', 'source', 'start', 'stop', 'step', 'points', 'startHz', 'stopHz', 'stepTime', 'stopTime']);
  if (!allowed.has(field)) return;
  const current = ngspiceConfiguration(getState());
  const value = numeric ? Number(rawValue) : rawValue;
  if (numeric && !Number.isFinite(value)) { notify('ngspice configuration requires a finite number', 'error'); return; }
  if (field === 'operation' && !NGSPICE_OPERATIONS.includes(value)) { notify('Unsupported ngspice analysis', 'error'); return; }
  const next = { ...current, [field]: field === 'points' ? Math.trunc(value) : value };
  recordExperiment({ id: 'circuit-ngspice-analysis', kind: 'circuit', operation: 'ngspice-analysis', inputs: next });
}

function updateNgspiceViewField(field, value) {
  const simulation = getState().simulation;
  if (simulation?.kind !== 'ngspice' || simulation.result?.kind !== 'table' || !Number.isInteger(value)) return;
  const view = normalizeNgspiceView(simulation.result, getState().ngspiceView || {});
  setState({ ngspiceView: { ...view, [field]: value } });
}

function transformNgspiceWindow(command) {
  const state = getState();
  const result = state.simulation?.kind === 'ngspice' && state.simulation.result?.kind === 'table' ? state.simulation.result : null;
  if (!result?.rows?.length) return;
  setState({ ngspiceView: transformNgspiceWindowView(result, state.ngspiceView || {}, command) });
}

function exportNgspiceCsv() {
  const simulation = getState().simulation;
  const result = simulation?.kind === 'ngspice' && simulation.result?.kind === 'table' ? simulation.result : null;
  if (!result?.rows?.length) { notify('Run a sweep analysis before exporting CSV', 'error'); return; }
  const blob = new Blob([serializeNgspiceCsv(result)], { type: 'text/csv' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `openentc-ngspice-${simulation.operation || 'analysis'}.csv`; link.click(); URL.revokeObjectURL(link.href);
  notify('ngspice result CSV exported', 'success');
}

function runSimulation() {
  try {
    const state = getState();
    const project = state.project;
    const { components, wires, netLabels } = project.circuit;
    const erc = checkElectricalRules(components, wires, netLabels);
    if (erc.some((diagnostic) => diagnostic.severity === 'error')) { notify(`Fix ${erc.length} electrical rule issue${erc.length === 1 ? '' : 's'} before analysis`, 'error'); return; }
    const config = builtinConfiguration(state);
    let result;
    if (config.analysis === 'transient') {
      result = simulateTransient(components, wires, netLabels, { stopTime: config.stopTime, timeStep: config.timeStep, stimulus: { sourceId: config.source || undefined, shape: config.shape, frequency: config.frequency, ...(config.amplitude === null ? {} : { amplitude: config.amplitude }) } });
      recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'transient-analysis', inputs: config });
    } else if (config.analysis === 'ac') {
      result = simulateAC(components, wires, netLabels, { startFrequency: config.startHz, stopFrequency: config.stopHz, pointsPerDecade: config.pointsPerDecade, inputSourceId: config.source || undefined });
      recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'ac-analysis', inputs: config });
    } else {
      result = simulateDC(components, wires, netLabels);
      recordExperiment({ id: 'circuit-dc', kind: 'circuit', operation: 'dc-analysis', inputs: { componentCount: components.length, wireCount: wires.length, netLabelCount: netLabels.length } });
    }
    setState({ simulation: result, selectedComponentId: null, selectedComponentIds: [] });
    const warnings = result.warnings?.length ? ` with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}` : '';
    notify(`${{ dc: 'DC analysis', transient: 'Transient analysis', ac: 'AC sweep' }[config.analysis]} completed${warnings}`, 'success');
  } catch (error) { notify(error.message, 'error'); }
}

function persistBuiltinConfiguration(field, rawValue) {
  const engineering = new Set(['stopTime', 'timeStep', 'frequency', 'amplitude', 'startHz', 'stopHz']);
  if (!['analysis', 'source', 'shape', 'pointsPerDecade', ...engineering].includes(field)) return;
  const current = builtinConfiguration(getState());
  let value = rawValue;
  if (field === 'analysis' && !Object.hasOwn(BUILTIN_ANALYSES, value)) { notify('Unsupported built-in analysis', 'error'); return; }
  if (field === 'shape' && !Object.hasOwn(BUILTIN_STIMULI, value)) { notify('Unsupported stimulus waveform', 'error'); return; }
  if (engineering.has(field)) {
    if (field === 'amplitude' && !String(rawValue).trim()) value = null;
    else {
      try { value = parseEngineeringValue(String(rawValue)); } catch { notify('Enter a number such as 5m, 10u or 2.2k', 'error'); return; }
      if (field !== 'amplitude' && !(value > 0)) { notify('Value must be greater than zero', 'error'); return; }
    }
  }
  if (field === 'pointsPerDecade') { value = Math.trunc(Number(rawValue)); if (!(value >= 1 && value <= 200)) { notify('Points per decade must be between 1 and 200', 'error'); return; } }
  recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'builtin-analysis', inputs: { ...current, [field]: value } });
}

function loadExampleCircuit(id) {
  const example = exampleCircuits.find((candidate) => candidate.id === id);
  if (!example) return;
  circuitEditor.wireSource = null; circuitEditor.selectedWire = null;
  updateProject((project) => { project.circuit.components = structuredClone(example.components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'builtin-analysis', inputs: { ...builtinConfiguration(getState()), source: 'V1', ...example.analysis } });
  setState({ simulation: null, selectedComponentId: null, selectedComponentIds: [], circuitPlotTrace: example.trace });
  notify(`${example.name} loaded. Press Run to simulate.`, 'success');
}

function exportCircuitCsv() {
  const result = getState().simulation;
  let csv;
  try { csv = circuitResultCsv(result); } catch (error) { notify(error.message, 'error'); return; }
  const blob = new Blob([csv], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `openentc-${result.kind === 'circuit-ac' ? 'ac-sweep' : 'transient'}.csv`; link.click(); URL.revokeObjectURL(link.href);
  notify('Simulation CSV exported', 'success');
}

async function runNativeNgspice() {
  const state = getState();
  const desktopProject = state.desktopProject;
  const detection = state.toolchainDetection?.ngspice;
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect ngspice and open a desktop project before running it', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before running ngspice', 'error'); return; }
  const diagnostics = checkElectricalRules(state.project.circuit.components, state.project.circuit.wires, state.project.circuit.netLabels);
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) { notify(`Fix ${diagnostics.length} electrical rule issue${diagnostics.length === 1 ? '' : 's'} before ngspice`, 'error'); return; }
  const config = ngspiceConfiguration(state);
  const runId = `ngspice-${Date.now().toString(36)}`;
  let artifacts = [];
  let adapter = null;
  let engineVersion = null;
  try {
    await desktopBridge.saveOpenProject(state.project);
    const versionRunner = createDesktopProcessAdapterRunner({
      bridge: desktopBridge,
      project: desktopProject,
      runId: `${runId}-version`,
      onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
      onArtifact: (artifact) => { artifacts.push(artifact); },
    });
    const versionResult = await versionRunner({ executable: detection.path, args: ['-v'], shell: false, timeout_ms: 10_000, max_output_bytes: 64 * 1024 });
    if (!versionResult.ok) throw Object.assign(new Error(versionResult.stderr || 'ngspice version self-test failed.'), { code: versionResult.error || 'ENGINE_SELF_TEST_FAILED' });
    engineVersion = parseNgspiceVersion(`${versionResult.stdout || ''}\n${versionResult.stderr || ''}`);
    const runner = createDesktopEngineRunner({
      bridge: desktopBridge,
      project: desktopProject,
      runId,
      onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
      onArtifacts: (created) => { artifacts = [...artifacts, ...created]; },
    });
    adapter = createNgspiceAdapter({ executable: detection.path, runner });
    const job = { ...config, title: state.project.name, components: state.project.circuit.components, wires: state.project.circuit.wires };
    await adapter.prepare(job);
    await adapter.run(job);
    const result = await adapter.parse(job);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    updateProject((project) => { project.provenance.engineVersions.ngspice = engineVersion; });
    recordExperiment({ id: 'circuit-ngspice-analysis', kind: 'circuit', operation: 'ngspice-analysis', inputs: config });
    await desktopBridge.saveOpenProject(getState().project);
    const jobs = await desktopBridge.listJobs(desktopProject.project_id);
    const events = await desktopBridge.drainEvents(desktopProject.project_id);
    setState({ simulation: { kind: 'ngspice', result, runId, operation: config.operation, engineVersion }, ngspiceView: null, selectedComponentId: null, selectedComponentIds: [], desktopJobs: jobs, desktopEvents: events });
    notify(`Native ngspice ${config.operation} completed`, 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the original engine error */ }
    const engineDiagnostics = parseNgspiceDiagnostics(error?.message || String(error));
    setState({ simulation: { kind: 'ngspice-error', diagnostics: engineDiagnostics, operation: config.operation, engineVersion } });
    notify(error?.message || 'Native ngspice analysis failed', 'error');
  } finally {
    await adapter?.clean().catch(() => {});
  }
}

function exportSpiceNetlist() {
  try {
    const project = getState().project;
    const text = buildSpiceNetlist(project.circuit.components, project.circuit.wires, { title: project.name, netLabels: project.circuit.netLabels });
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}.cir`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify('SPICE netlist exported', 'success');
  } catch (error) { notify(error.message || 'Could not export SPICE netlist', 'error'); }
}

function validateCode() {
  const code = getState().project.embedded.code;
  const report = analyzeSketchSource(code);
  setState({ simulation: { kind: 'firmware', report } });
  notify(report.diagnostics.length ? `${report.diagnostics.length} structure issue(s)` : 'Source structure looks valid', report.diagnostics.length ? 'error' : 'success');
}

async function refreshArduinoInventory() {
  const state = getState();
  const desktopProject = state.desktopProject;
  const detection = state.toolchainDetection?.['arduino-cli'];
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before reading inventory', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions before reading Arduino inventory', 'error'); return; }
  const baseId = `arduino-inventory-${Date.now().toString(36)}`;
  const artifacts = [];
  const results = {};
  try {
    await desktopBridge.saveOpenProject(state.project);
    for (const [index, operation] of ['version', 'board-inventory', 'core-inventory', 'library-inventory'].entries()) {
      const runner = createDesktopProcessAdapterRunner({
        bridge: desktopBridge,
        project: desktopProject,
        runId: `${baseId}-${index}`,
        onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
        onArtifact: (artifact) => { artifacts.push(artifact); },
      });
      const adapter = createArduinoCliAdapter({ executable: detection.path, runner });
      const job = { operation };
      try { await adapter.prepare(job); await adapter.run(job); results[operation] = await adapter.parse(job); }
      finally { await adapter.clean().catch(() => {}); }
    }
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    const version = results.version.version;
    updateProject((project) => { project.provenance.engineVersions['arduino-cli'] = version; });
    await desktopBridge.saveOpenProject(getState().project);
    const jobs = await desktopBridge.listJobs(desktopProject.project_id);
    const events = await desktopBridge.drainEvents(desktopProject.project_id);
    setState({ arduinoInventory: { version, boards: results['board-inventory'].items, cores: results['core-inventory'].items, libraries: results['library-inventory'].items, refreshedAt: new Date().toISOString() }, desktopJobs: jobs, desktopEvents: events });
    notify(`Arduino inventory loaded: ${results['board-inventory'].items.length} boards, ${results['core-inventory'].items.length} cores, ${results['library-inventory'].items.length} libraries`, 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the inventory error */ }
    notify(error?.message || 'Arduino inventory failed', 'error');
  }
}

function reviewArduinoProgrammerGrant() {
  const state = getState(); const project = state.desktopProject; const target = selectedArduinoTarget(state); const port = selectedArduinoPort(state);
  if (!desktopBridge.available || !project?.project_id || !target || !port) { notify('Open a desktop project, select an installed board and enter a port first', 'error'); return; }
  showModal('Review programmer permission', `<p>This permits one project to invoke the detected Arduino CLI for programmer access to exactly <b>${esc(port)}</b>.</p><p>No connected-device scan runs. Changing the board, port or project clears the in-app grant.</p><button class="button primary wide" data-action="confirm-programmer-grant">Grant programmer access to ${esc(port)}</button>`);
  document.querySelector('[data-action="confirm-programmer-grant"]')?.addEventListener('click', async () => {
    try {
      const current = getState();
      if (current.desktopProject?.project_id !== project.project_id || selectedArduinoPort(current) !== port || selectedArduinoTarget(current)?.fqbn !== target.fqbn) throw new Error('The selected project, board or port changed; review permission again.');
      await desktopBridge.grantDeviceTarget(project.project_id, 'device-programmer', port, true);
      setState({ arduinoDeviceGrant: { projectId: project.project_id, permission: 'device-programmer', target: port } });
      document.querySelector('.modal-done')?.click();
      notify(`Programmer access granted for ${port}`, 'success');
    } catch (error) { notify(error?.message || 'Programmer permission was not granted', 'error'); }
  });
}

function serialConfiguration(state = getState()) {
  const config = state.project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
  return {
    baud: [9600, 19200, 38400, 57600, 115200, 230400].includes(Number(config.baud)) ? Number(config.baud) : 115200,
    encoding: ['utf-8', 'ascii'].includes(config.encoding) ? config.encoding : 'utf-8',
    lineEnding: ['none', 'lf', 'cr', 'crlf'].includes(config.lineEnding) ? config.lineEnding : 'lf',
    timestamps: config.timestamps !== false,
  };
}

function publishArduinoSerial(nativeError = null) {
  if (!nativeSessions.activeSerialSession) return;
  setState({ arduinoSerial: { ...nativeSessions.activeSerialSession.inspect(), text: nativeSessions.activeSerialSession.exportText(), nativeError } });
}

function decodeSerialBytes(bytes, encoding, decoder) {
  if (encoding === 'ascii') return bytes.map((value) => value <= 0x7f ? String.fromCharCode(value) : '�').join('');
  return decoder.decode(Uint8Array.from(bytes), { stream: true });
}

async function pollArduinoSerial() {
  const native = nativeSessions.activeSerialNative;
  if (!native || !nativeSessions.activeSerialSession) return;
  try {
    const result = await desktopBridge.pollSerial(native.projectId, native.id, 8192);
    if (nativeSessions.activeSerialNative !== native) return;
    if (result.bytes.length) nativeSessions.activeSerialSession.ingest(decodeSerialBytes(result.bytes, native.encoding, native.decoder));
    if (!nativeSessions.activeSerialSession.inspect().paused) publishArduinoSerial(result.error);
    if (!result.open || result.error) {
      nativeSessions.activeSerialSession.disconnect({ unexpected: true });
      await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
      publishArduinoSerial(result.error || 'Serial port closed unexpectedly.');
      nativeSessions.serialPollTimer = null;
      return;
    }
    nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 150);
  } catch (error) {
    if (nativeSessions.activeSerialNative !== native || !nativeSessions.activeSerialSession) return;
    nativeSessions.activeSerialSession.disconnect({ unexpected: true });
    publishArduinoSerial(error?.message || 'Serial polling failed.');
    nativeSessions.serialPollTimer = null;
  }
}

function reviewArduinoSerialGrant() {
  const state = getState(); const project = state.desktopProject; const port = selectedArduinoPort(state);
  if (!desktopBridge.available || !project?.project_id || !selectedArduinoTarget(state) || !port) { notify('Open a desktop project, select a board and enter a port first', 'error'); return; }
  showModal('Review serial permission', `<p>This permits this project to open exactly <b>${esc(port)}</b> for an interactive serial terminal.</p><p>No port enumeration or background connection occurs. Revocation closes the active session.</p><button class="button primary wide" data-action="confirm-serial-grant">Grant serial access to ${esc(port)}</button>`);
  document.querySelector('[data-action="confirm-serial-grant"]')?.addEventListener('click', async () => {
    try {
      const current = getState();
      if (current.desktopProject?.project_id !== project.project_id || selectedArduinoPort(current) !== port) throw new Error('The selected project or port changed; review permission again.');
      await desktopBridge.grantDeviceTarget(project.project_id, 'device-serial', port, true);
      setState({ arduinoSerialGrant: { projectId: project.project_id, permission: 'device-serial', target: port } });
      document.querySelector('.modal-done')?.click(); notify(`Serial access granted for ${port}`, 'success');
    } catch (error) { notify(error?.message || 'Serial permission was not granted', 'error'); }
  });
}

async function revokeArduinoSerialGrant() {
  const state = getState(); const grant = state.arduinoSerialGrant; const projectId = state.desktopProject?.project_id;
  if (!grant || !projectId) return;
  try {
    if (nativeSessions.activeSerialNative) await disconnectArduinoSerial();
    await desktopBridge.revokeDeviceTarget(projectId, grant.permission, grant.target);
    setState({ arduinoSerialGrant: null, arduinoSerial: null });
    notify(`Serial access revoked for ${grant.target}`, 'success');
  } catch (error) { notify(error?.message || 'Serial permission could not be revoked', 'error'); }
}

async function connectArduinoSerial() {
  const state = getState(); const project = state.desktopProject; const port = selectedArduinoPort(state); const config = serialConfiguration(state);
  const granted = port && state.arduinoSerialGrant?.projectId === project?.project_id && state.arduinoSerialGrant?.target === port;
  if (!desktopBridge.available || !project?.project_id || !granted) { notify('Grant serial access for the selected desktop project and port first', 'error'); return; }
  const id = `serial-${Date.now().toString(36)}`;
  try {
    await desktopBridge.startSerial(project.project_id, id, port, config.baud, 64 * 1024);
    const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['serial'] }); policy.selectTarget('serial', port);
    nativeSessions.activeSerialSession = createSerialSession({ permissionPolicy: policy, target: port, ...config, maxBufferBytes: 64 * 1024, maxReconnectAttempts: 3 });
    nativeSessions.activeSerialSession.connect();
    nativeSessions.activeSerialNative = { projectId: project.project_id, id, target: port, baud: config.baud, encoding: config.encoding, decoder: new TextDecoder('utf-8') };
    publishArduinoSerial(); nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal connected to ${port}`, 'success');
  } catch (error) { notify(error?.message || 'Serial port could not be opened', 'error'); }
}

async function reconnectArduinoSerial() {
  const native = nativeSessions.activeSerialNative;
  if (!native || !nativeSessions.activeSerialSession || nativeSessions.activeSerialSession.inspect().state !== 'reconnecting') { notify('No interrupted serial session is available to reconnect', 'error'); return; }
  try {
    await desktopBridge.startSerial(native.projectId, native.id, native.target, native.baud, 64 * 1024);
    nativeSessions.activeSerialSession.reconnect(); native.decoder = new TextDecoder('utf-8'); publishArduinoSerial(); nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal reconnected to ${native.target}`, 'success');
  } catch (error) {
    try { nativeSessions.activeSerialSession.reconnect(); nativeSessions.activeSerialSession.markReconnectFailed(); } catch { /* state already exhausted */ }
    publishArduinoSerial(error?.message || 'Serial reconnect failed'); notify(error?.message || 'Serial reconnect failed', 'error');
  }
}

async function disconnectArduinoSerial() {
  if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
  const native = nativeSessions.activeSerialNative; const session = nativeSessions.activeSerialSession;
  nativeSessions.activeSerialNative = null; nativeSessions.activeSerialSession = null;
  if (native) await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
  if (session) { session.close(); setState({ arduinoSerial: { ...session.inspect(), text: session.exportText(), nativeError: null } }); }
}

function toggleArduinoSerialPause() {
  if (!nativeSessions.activeSerialSession) return; nativeSessions.activeSerialSession.setPaused(!nativeSessions.activeSerialSession.inspect().paused); publishArduinoSerial();
}

function clearArduinoSerial() {
  if (nativeSessions.activeSerialSession) { nativeSessions.activeSerialSession.clear(); publishArduinoSerial(); } else setState({ arduinoSerial: null });
}

function exportArduinoSerial() {
  const text = nativeSessions.activeSerialSession?.exportText() || getState().arduinoSerial?.text || '';
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `openentc-serial-${Date.now()}.txt`; link.click(); URL.revokeObjectURL(link.href); notify('Serial transcript exported', 'success');
}

async function sendArduinoSerial() {
  const input = document.querySelector('[data-field="serial-transmit"]'); const native = nativeSessions.activeSerialNative;
  if (!input || !native || !nativeSessions.activeSerialSession) return;
  try {
    const text = nativeSessions.activeSerialSession.formatTransmit(input.value); await desktopBridge.writeSerial(native.projectId, native.id, new TextEncoder().encode(text)); input.value = '';
  } catch (error) { notify(error?.message || 'Serial write failed', 'error'); }
}

async function revokeArduinoProgrammerGrant() {
  const state = getState(); const grant = state.arduinoDeviceGrant; const projectId = state.desktopProject?.project_id;
  if (!grant || !projectId) return;
  try {
    await desktopBridge.revokeDeviceTarget(projectId, grant.permission, grant.target);
    setState({ arduinoDeviceGrant: null });
    notify(`Programmer access revoked for ${grant.target}`, 'success');
  } catch (error) { notify(error?.message || 'Programmer permission could not be revoked', 'error'); }
}

async function cancelArduinoUpload(silent = false) {
  const upload = nativeSessions.activeArduinoUpload;
  if (!upload) return;
  setState({ arduinoUpload: { runId: upload.runId, phase: 'cancelling', port: upload.port } });
  try {
    await upload.adapter?.cancel();
    if (!silent) notify(`Cancelling Arduino job for ${upload.port}`, 'success');
  } catch (error) {
    if (!silent) notify(error?.message || 'Arduino upload cancellation failed', 'error');
  }
}

async function runNativeArduinoUpload() {
  const state = getState(); const desktopProject = state.desktopProject; const detection = state.toolchainDetection?.['arduino-cli'];
  const target = selectedArduinoTarget(state); const port = selectedArduinoPort(state);
  const granted = port && state.arduinoDeviceGrant?.projectId === desktopProject?.project_id && state.arduinoDeviceGrant?.permission === 'device-programmer' && state.arduinoDeviceGrant?.target === port;
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before uploading', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions before uploading', 'error'); return; }
  if (!target || !port) { notify('Select an installed board and enter the exact port before uploading', 'error'); return; }
  if (!granted) { notify(`Review and grant programmer access for ${port} before uploading`, 'error'); return; }
  if (nativeSessions.activeArduinoUpload) { notify('An Arduino upload is already active', 'error'); return; }
  const structure = analyzeSketchSource(state.project.embedded.code);
  if (structure.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) { setState({ simulation: { kind: 'firmware', report: structure } }); notify('Fix source structure errors before uploading', 'error'); return; }
  const baseId = `arduino-upload-${Date.now().toString(36)}`;
  const sketchPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'sketch');
  const buildPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'build');
  const sketchBytes = new TextEncoder().encode(state.project.embedded.code); const artifacts = []; let compileAdapter = null; let uploadAdapter = null;
  const runnerOptions = { bridge: desktopBridge, project: desktopProject, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id) }), onArtifact: (artifact) => { artifacts.push(artifact); } };
  try {
    nativeSessions.activeArduinoUpload = { runId: baseId, port, adapter: null };
    setState({ arduinoUpload: { runId: baseId, phase: 'compiling', port } });
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(desktopProject.project_id, `runs/${baseId}/sketch/sketch.ino`, sketchBytes, 'text/x-arduino'));
    compileAdapter = createArduinoCliAdapter({ executable: detection.path, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-compile` }) });
    nativeSessions.activeArduinoUpload.adapter = compileAdapter;
    const compileJob = { operation: 'compile', board: target.fqbn, sketchPath, buildPath };
    await compileAdapter.prepare(compileJob); await compileAdapter.run(compileJob); const report = await compileAdapter.parse(compileJob);
    const permissionPolicy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['programmer'] }); permissionPolicy.selectTarget('programmer', port);
    uploadAdapter = createArduinoCliAdapter({ executable: detection.path, permissionPolicy, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-device`, deviceAuthorization: { permission: 'device-programmer', target: port } }) });
    nativeSessions.activeArduinoUpload.adapter = uploadAdapter;
    setState({ arduinoUpload: { runId: baseId, phase: 'uploading', port } });
    const uploadJob = { operation: 'upload', board: target.fqbn, port, sketchPath, buildPath };
    await uploadAdapter.prepare(uploadJob); await uploadAdapter.run(uploadJob); await uploadAdapter.parse(uploadJob);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'firmware-arduino-upload', kind: 'firmware', operation: 'arduino-upload', inputs: { board: target.fqbn, boardName: target.name, port, sourceBytes: sketchBytes.byteLength, engine: 'arduino-cli', explicitlyAuthorized: true } });
    await desktopBridge.saveOpenProject(getState().project);
    setState({ simulation: { kind: 'arduino', report, runId: baseId, uploaded: true, port }, desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) });
    notify(`Arduino upload completed for ${port}`, 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the original engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'Arduino upload cancelled' : error?.message || 'Arduino upload failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally {
    nativeSessions.activeArduinoUpload = null;
    setState({ arduinoUpload: null });
    await compileAdapter?.clean().catch(() => {}); await uploadAdapter?.clean().catch(() => {});
  }
}

async function runNativeArduinoCompile() {
  const state = getState();
  const desktopProject = state.desktopProject;
  const detection = state.toolchainDetection?.['arduino-cli'];
  const target = selectedArduinoTarget(state);
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before compiling', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before compiling', 'error'); return; }
  if (!target) { notify('Refresh Arduino inventory and explicitly select an installed board before compiling', 'error'); return; }
  const code = state.project.embedded.code;
  const structure = analyzeSketchSource(code);
  if (structure.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    setState({ simulation: { kind: 'firmware', report: structure } });
    notify('Fix source structure errors before compiling', 'error');
    return;
  }
  const runId = `arduino-${Date.now().toString(36)}`;
  const sketchPath = joinDesktopProjectPath(desktopProject.root, 'runs', runId, 'sketch');
  const buildPath = joinDesktopProjectPath(desktopProject.root, 'runs', runId, 'build');
  const sketchBytes = new TextEncoder().encode(code);
  let adapter = null;
  let artifacts = [];
  try {
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(desktopProject.project_id, `runs/${runId}/sketch/sketch.ino`, sketchBytes, 'text/x-arduino'));
    const runner = createDesktopProcessAdapterRunner({
      bridge: desktopBridge,
      project: desktopProject,
      runId,
      onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
      onArtifact: (artifact) => { artifacts.push(artifact); },
    });
    adapter = createArduinoCliAdapter({ executable: detection.path, runner });
    const job = { operation: 'compile', board: target.fqbn, sketchPath, buildPath };
    await adapter.prepare(job);
    await adapter.run(job);
    const report = await adapter.parse(job);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'firmware-arduino-compile', kind: 'firmware', operation: 'arduino-compile', inputs: { board: job.board, boardName: target.name, sourceBytes: sketchBytes.byteLength, engine: 'arduino-cli' } });
    await desktopBridge.saveOpenProject(getState().project);
    const jobs = await desktopBridge.listJobs(desktopProject.project_id);
    const events = await desktopBridge.drainEvents(desktopProject.project_id);
    setState({ simulation: { kind: 'arduino', report, runId }, desktopJobs: jobs, desktopEvents: events });
    notify('Arduino CLI compile completed', 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the original engine error */ }
    notify(error?.message || 'Arduino CLI compile failed', 'error');
  } finally {
    await adapter?.clean().catch(() => {});
  }
}

function exportProject() {
  const exported = createPackagedProjectExport(getState().project);
  const blob = new Blob([exported.data], { type: exported.mediaType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = exported.fileName;
  link.click(); URL.revokeObjectURL(link.href); notify('Project exported', 'success');
}

importInput.addEventListener('change', async () => {
  try {
    const file = importInput.files[0];
    if (!file) return;
    const imported = await importProjectFile(file);
    if (!await closeNativeSessionForBrowserProject()) return;
    replaceProject(imported);
    notify('Project imported', 'success');
  }
  catch (error) { notify(error.message || 'Could not import project', 'error'); }
  importInput.value = '';
});

function showHelp() { showModal('A unified ENTC workspace', '<p>OpenENTC Studio keeps circuit, firmware, board and communication work in one local project.</p><div class="shortcut-list"><span>Command palette</span><kbd>Ctrl K</kbd><span>Run circuit analysis</span><kbd>Circuit → Run</kbd><span>Move component</span><kbd>Drag</kbd><span>Edit component</span><kbd>Select</kbd></div>'); }
function showEngineInfo() { showModal('How engine connectors work', '<p>OpenENTC owns the project experience and limited built-in circuit tools. Specialist open-source applications remain independent processes with their own licences.</p><p>The planned desktop bridge will detect installed tools, translate project data, execute them safely and return results to this interface.</p>'); }

function showCommandPalette() {
  showModal('Command palette', `<div class="command-list">${modules.map((item) => `<button data-command-module="${item.id}"><span>${item.icon}</span>${item.name}<kbd>OPEN</kbd></button>`).join('')}</div>`);
  document.querySelectorAll('[data-command-module]').forEach((button) => button.addEventListener('click', () => setState({ activeModule: button.dataset.commandModule })));
}

window.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const current = getState();
  if (current.activeModule === 'circuit' && current.selectedComponentId && !typing) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) { event.preventDefault(); const step = current.project.settings.grid ? current.project.settings.gridSize : 10; moveSelected(key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0); return; }
    if (key === 'r' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); rotateSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'c') { event.preventDefault(); copySelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'v') { event.preventDefault(); pasteCopied(); return; }
    if (key === 'delete' || key === 'backspace') { event.preventDefault(); deleteSelected(); return; }
  }
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'k') { event.preventDefault(); showCommandPalette(); }
    if (key === 'z') { event.preventDefault(); if (event.shiftKey ? redoProject() : undoProject()) notify(event.shiftKey ? 'Project change redone' : 'Project change undone', 'info'); }
    if (key === 'y') { event.preventDefault(); if (redoProject()) notify('Project change redone', 'info'); }
  }
});

setRenderer(render);
subscribe(render);
rerender();
if (assistantStartup.removedLegacyKey) notify('An AI API key saved by an older version was removed from browser storage. Enter it again when you use the assistant.', 'info');

// Offline support: register the service worker in a normal browser (not in the desktop shell,
// which already has every file locally). The first visit caches the studio for offline use.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !globalThis.__TAURI__) {
  window.addEventListener('load', () => {
    const firstInstall = !navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      if (!firstInstall) return;
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'activated') notify('OpenENTC Studio is saved on this device and now works offline.', 'success'); });
      });
    }).catch(() => {});
  });
  window.addEventListener('offline', () => notify('You are offline — everything keeps working from the saved copy.', 'info'));
}
