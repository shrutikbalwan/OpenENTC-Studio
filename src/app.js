import { modules, componentPalette, learningTracks } from './data/modules.js';
import { engines } from './core/engine-registry.js';
import { createProject } from './core/project.js';
import { createPackagedProjectExport, importProjectFile } from './core/project-file.js';
import { getState, setState, updateProject, recordExperiment, subscribe, notify, replaceProject, synchronizeOpenProject, undoProject, redoProject, canUndoProject, canRedoProject, recordLearningAttempt, saveProject } from './core/store.js';
import { simulateDC, sampleWaveform } from './engines/circuit-engine.js';
import { checkElectricalRules, locateElectricalRuleDiagnostic } from '../packages/schematic/src/erc.mjs';
import { normalizeNode } from '../packages/schematic/src/index.mjs';
import { connectNodes, disconnectNodes, pruneWires, setWireRoute } from './core/wires.js';
import { duplicateComponent, moveComponents, pasteComponents, rotateComponents } from './core/circuit-editing.js';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';
import { buildWireSegments, defaultWireRoute, orthogonalPath, wireRouteHandle, wireRouteHandles, wireRouteInsertionPoint } from '../packages/schematic/src/geometry.mjs';
import { componentsInRect } from '../packages/schematic/src/selection.mjs';
import { fitCanvasView, screenToCanvas, snapCanvasPoint, zoomCanvasView } from './core/canvas.js';
import { parseEngineeringValue } from '../packages/schematic/src/units.mjs';
import { applyWindow, fft, filterFir, generateSine } from '../packages/numerics/src/index.mjs';
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate } from '../packages/communications/src/index.mjs';
import { parseTouchstone } from '../packages/rf/src/index.mjs';
import { firstOrderStability, firstOrderStep } from '../packages/control/src/index.mjs';
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
import { digitalSignalGroups, filterDigitalSignals, measureDigitalCursors, normalizeDigitalWaveformView, sampleDigitalSignal, serializeDigitalCsv, transformDigitalWaveformView } from './core/digital-waveform-view.js';

const app = document.querySelector('#app');
const importInput = document.querySelector('#project-import');
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const fmt = (value, digits = 3) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
let wireSource = null;
let selectedWire = null;
let clipboardParts = [];
let clipboardWires = [];
let activeSerialSession = null;
let activeSerialNative = null;
let serialPollTimer = null;
let activeArduinoUpload = null;
let activeHdlJob = null;
const browserDevicePolicy = createDevicePermissionPolicy({ environment: 'browser' });
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
      ${state.toast ? `<div class="toast ${state.toast.tone}" role="${state.toast.tone === 'error' ? 'alert' : 'status'}" aria-live="${state.toast.tone === 'error' ? 'assertive' : 'polite'}"><span>${state.toast.tone === 'success' ? '✓' : state.toast.tone === 'error' ? '!' : 'i'}</span>${esc(state.toast.message)}</div>` : ''}
      <div class="modal-layer" hidden></div>
    </div>`;
  bindEvents();
}

function renderWorkspace(state, active) {
  if (state.activeModule === 'toolchains') return renderToolchains(state);
  if (active.id === 'home') return renderHome(state);
  if (active.id === 'circuit') {
    const circuitCompatible = Boolean(state.simulation?.nodes && state.simulation?.currents) || ['ngspice', 'ngspice-error'].includes(state.simulation?.kind);
    const circuitState = circuitCompatible ? state : { ...state, simulation: null };
    return renderCircuit(circuitState);
  }
  if (active.id === 'dsp') return renderDsp(state);
  if (active.id === 'communication') return renderCommunication(state);
  if (active.id === 'rf') return renderRf(state);
  if (active.id === 'iot') return renderControl(state);
  if (active.id === 'network') return renderNetwork(state);
  if (active.id === 'fpga') return renderDigital(state);
  if (active.id === 'embedded') return renderEmbedded(state);
  if (active.id === 'learn') return renderVerifiedLearning();
  return renderEngineeringModule(active);
}

function pageHeader(module, eyebrow, actions = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${module.name}</h1><p>${module.description}</p></div><div class="heading-actions">${actions}</div></div>`;
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
      <div class="metric"><span>MODULES</span><strong>10</strong><small>Unified ENTC workspaces</small></div>
      <div class="metric"><span>ENGINE STATUS</span><strong>${ready} available · ${engines.length - ready} unavailable</strong><small>Evidence-backed capability states</small></div>
      <div class="metric"><span>PRIVACY</span><strong>Local by default</strong><small>This browser alpha has no upload feature</small></div>
    </section>
    <div class="section-title"><div><span class="eyebrow">AUTHORED EXPERIMENTS</span><h2>Saved configurations</h2></div><span>${state.project.experiments.length} persisted</span></div>
    <section class="engine-table experiment-list">${state.project.experiments.length ? state.project.experiments.slice(-6).reverse().map((experiment) => `<div class="engine-row"><span class="engine-logo">EX</span><div><b>${esc(experiment.id)}</b><small>${esc(experiment.kind || 'experiment')} · ${esc(experiment.operation || 'configuration')}</small></div><span>Authored</span><span>Project manifest</span><span class="engine-status built-in">● Restored</span></div>`).join('') : '<div class="empty-state">Run a built-in experiment to save its authored configuration here.</div>'}</section>
    <div class="section-title"><div><span class="eyebrow">WORKBENCH</span><h2>Choose a discipline</h2></div><span>${modules.length - 2} specialist labs</span></div>
    <section class="module-grid">
      ${modules.slice(1, -1).map((item, index) => `<button class="module-card" data-module="${item.id}" style="--card:${item.color}"><span class="module-index">0${index + 1}</span><span class="module-icon">${item.icon}</span><h3>${item.name}</h3><p>${item.description}</p><span class="open-label">Open workspace <b>↗</b></span></button>`).join('')}
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
  return `<span class="simple-symbol">${part.type === 'led' ? '↗|▷' : '|▷'}</span>`;
}

function renderWires(parts, wires = [], netLabels = [], junctions = []) {
  const lines = [];
  const nodes = [...new Set(parts.flatMap((part) => [part.n1, part.n2]).filter(Boolean).map((node) => normalizeNode(node)).filter((node) => node !== '0'))];
  for (const node of nodes) {
    const connected = parts.filter((part) => normalizeNode(part.n1) === node || normalizeNode(part.n2) === node);
    for (let i = 0; i < connected.length - 1; i += 1) {
      const a = connected[i], b = connected[i + 1];
      lines.push(`<path d="${orthogonalPath({ x: a.x + 45, y: a.y + 25 }, { x: b.x + 45, y: b.y + 25 })}"/><circle cx="${b.x + 45}" cy="${b.y + 25}" r="3"/>`);
    }
  }
  for (const segment of buildWireSegments(parts, wires)) {
    const selected = selectedWire?.from === segment.fromNode && selectedWire?.to === segment.toNode;
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
  return `<div class="circuit-part ${selectedIds.includes(part.id) ? 'selected' : ''}${issue ? ' erc-error' : ''}" role="button" tabindex="0" data-component-id="${esc(part.id)}" style="left:${part.x}px;top:${part.y}px;--part-rotation:${Number(part.rotation) || 0}deg" aria-label="${esc(part.label)}${issue ? `, ERC: ${esc(codes)}` : ''}" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"${issue ? ` aria-invalid="true" title="${esc(codes)}"` : ''}>${pin('n1', 'positive')}${circuitSymbol(part)}<b>${esc(part.label)}</b><small>${fmt(part.value, 6)} ${part.unit}</small><i>${esc(part.n1)} → ${esc(part.n2)}</i>${pin('n2', 'negative')}</div>`;
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
  return `<div class="lab-layout">
    <div class="lab-toolbar">
      <div><span class="eyebrow">ANALOG + DIGITAL</span><h1>Circuit Lab</h1></div>
      <div class="toolbar-group"><button class="tool active" data-capability-state="built-in">Select <kbd>V</kbd></button><button class="tool" data-action="toggle-grid" data-capability-state="built-in">Grid ${state.project.settings.gridSize || 20}px</button><button class="tool" data-action="fit-canvas" data-capability-state="built-in">Fit</button><button class="tool history-button" data-action="undo" ${canUndoProject() ? '' : 'disabled'} title="Undo (Ctrl/Cmd+Z)">Undo</button><button class="tool history-button" data-action="redo" ${canRedoProject() ? '' : 'disabled'} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button></div>
      <div class="toolbar-group"><button class="button ghost" data-action="clear-circuit">Clear</button><button class="button ghost" data-action="annotate-components">Annotate</button><button class="button ghost" data-action="export-spice">Export SPICE</button><button class="button run" data-action="simulate">▶ Run DC analysis</button><button class="button run" data-action="run-ngspice" ${ngspiceReady ? '' : 'disabled'} title="${esc(ngspiceReason)}">Run ngspice · ${esc(ngspiceConfig.operation)}</button></div>
    </div>
    <aside class="component-panel">
      <label class="search"><span>⌕</span><input placeholder="Search components" data-field="component-search"></label>
      <span class="panel-label">BASIC COMPONENTS</span>
      <div class="component-list">${componentPalette.map((part) => `<button data-add-component="${part.type}"><span>${part.symbol}</span><div><b>${part.label}</b><small>${part.defaultValue} ${part.unit}</small></div><i>+</i></button>`).join('')}</div>
      <div class="palette-note"><b>Built-in solver</b><p>DC analysis currently solves resistors and independent voltage/current sources using modified nodal analysis. Other parts remain visible with warnings.</p></div>
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

function renderInspector(part) {
  const connectedWires = getState().project.circuit.wires.filter((wire) => [part.n1, part.n2].includes(wire.from) || [part.n1, part.n2].includes(wire.to));
  return `<div class="inspector-head"><div><span class="panel-label">INSPECTOR</span><h3>${esc(part.label)}</h3></div><button data-action="deselect">×</button></div>
    <div class="symbol-preview">${circuitSymbol(part)}</div>
    <label>Reference<input data-part-field="label" value="${esc(part.label)}"></label>
    <label>Value<input type="text" inputmode="decimal" data-part-field="value" value="${fmt(part.value, 8)}" aria-describedby="engineering-value-help"><span>${part.unit}</span></label><small id="engineering-value-help" class="field-help">Use SI suffixes such as 1k, 4.7k or 220n.</small>
    <div class="field-pair"><label>Positive node<input data-part-field="n1" value="${esc(part.n1)}"></label><label>Negative node<input data-part-field="n2" value="${esc(part.n2)}"></label></div>
    <div class="wire-connect"><span class="panel-label">WIRE ALIASES</span><p>${wireSource ? `Source selected: <code>${esc(wireSource.node)}</code>. Choose another terminal.` : 'Choose a terminal, then another terminal to connect their node names.'}</p><div class="wire-endpoints"><button class="tool ${wireSource?.partId === part.id && wireSource?.field === 'n1' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n1">+ ${esc(part.n1)}</button><button class="tool ${wireSource?.partId === part.id && wireSource?.field === 'n2' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n2">− ${esc(part.n2)}</button></div>${connectedWires.length ? `<div class="wire-list" aria-label="Connected wires">${connectedWires.map((wire) => `<div class="wire-row"><code>${esc(wire.from)} ↔ ${esc(wire.to)}</code><button class="tool" data-wire-remove-from="${esc(wire.from)}" data-wire-remove-to="${esc(wire.to)}" aria-label="Disconnect ${esc(wire.from)} from ${esc(wire.to)}">Remove</button></div>`).join('')}</div>` : ''}<div class="wire-endpoints"><button class="tool" data-action="add-net-label">Add net label</button><button class="tool" data-action="add-junction">Add junction</button></div></div>
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

function renderInstrumentPanel(state) {
  const signal = state.project.circuit.signal;
  const dcResult = state.simulation?.nodes && state.simulation?.currents ? state.simulation : null;
  return `<span class="panel-label">LIMITED BUILT-IN PREVIEW</span><h3>Result previews</h3>
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
  const result = state.simulation?.nodes && state.simulation?.currents ? state.simulation : null;
  const nativeResult = state.simulation?.kind === 'ngspice' ? state.simulation.result : null;
  const engineDiagnostics = state.simulation?.kind === 'ngspice-error' ? state.simulation.diagnostics : [];
  const problemCount = erc.length + engineDiagnostics.length;
  const engine = nativeResult || engineDiagnostics.length ? `NGSPICE${state.simulation.engineVersion ? ` · ${state.simulation.engineVersion}` : ''}` : 'OPENENTC-DC';
  return `<section class="bottom-panel"><div class="bottom-tabs"><button class="active" disabled>Simulation results</button><button ${problemCount ? '' : 'disabled'} title="Electrical-rule and engine diagnostics">Problems <i>${problemCount}</i></button><span></span><small>ENGINE: ${esc(engine)}</small></div><div class="results">
    ${erc.length ? `<div class="diagnostic-list">${erc.map((diagnostic, index) => renderErcDiagnostic(diagnostic, ercTargets[index])).join('')}</div>` : ''}
    ${engineDiagnostics.length ? `<div class="diagnostic-list">${engineDiagnostics.map((diagnostic) => renderErcDiagnostic(diagnostic, locateNgspiceDiagnostic(state.project, diagnostic))).join('')}</div>` : ''}
    ${nativeResult ? renderNgspiceResult(nativeResult, state) : result ? `<div class="result-summary"><span>✓</span><div><b>Analysis completed</b><small>${Object.keys(result.nodes).length} nodes · ${Object.keys(result.currents).length} branches</small></div></div>${Object.entries(result.nodes).map(([node, value]) => `<div class="result-value"><span>V(${esc(node)})</span><b>${fmt(value, 6)} V</b></div>`).join('')}<div class="result-value"><span>Load power</span><b>${fmt(result.totalPower * 1000, 4)} mW</b></div>` : '<div class="console-empty"><span>›_</span><p>Ready. Run DC analysis to inspect node voltages and branch currents.</p></div>'}
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

function renderDsp(state) {
  const result = state.simulation?.kind === 'dsp' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'signals-fft')?.inputs || {};
  const signal = result?.signal;
  const values = signal ? Array.from(signal.data) : [];
  const min = values.length ? Math.min(...values) : -1; const max = values.length ? Math.max(...values) : 1; const span = max - min || 1;
  const path = values.length > 1 ? values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 560).toFixed(1)} ${(150 - ((value - min) / span) * 130).toFixed(1)}`).join(' ') : '';
  const peak = result ? Math.max(...result.spectrum.real.map((real, index) => Math.hypot(real, result.spectrum.imaginary[index]))) : null;
  const magnitudes = result ? Array.from(result.spectrum.real, (real, index) => Math.hypot(real, result.spectrum.imaginary[index])) : [];
  const magnitudeMax = Math.max(1e-12, ...magnitudes);
  const spectrumPath = magnitudes.length > 1 ? magnitudes.map((value, index) => `${index ? 'L' : 'M'} ${(index / (magnitudes.length - 1) * 560).toFixed(1)} ${(150 - (value / magnitudeMax) * 130).toFixed(1)}`).join(' ') : '';
  return `<div class="page scroll-page dsp-page">${pageHeader(modules.find((item) => item.id === 'dsp'), 'BUILT-IN NUMERICAL LAB', '<span class="pill live"><i></i> LOCAL COMPUTATION</span>')}
    <section class="dsp-card"><div class="dsp-controls"><label>Frequency<input type="number" min="0.1" step="0.1" data-dsp-field="frequency" value="${esc(config.frequency ?? 1000)}"><span>Hz</span></label><label>Sample rate<input type="number" min="10" step="10" data-dsp-field="sampleRate" value="${esc(config.sampleRate ?? 48000)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-dsp-field="length" value="${esc(config.length ?? 256)}"></label><label>FIR taps<input type="number" min="1" max="64" step="1" data-dsp-field="taps" value="${esc(config.taps ?? 1)}"></label><label>Window<select data-dsp-field="window"><option value="rectangular" ${config.window === 'rectangular' ? 'selected' : ''}>Rectangular</option><option value="hann" ${!config.window || config.window === 'hann' ? 'selected' : ''}>Hann</option><option value="hamming" ${config.window === 'hamming' ? 'selected' : ''}>Hamming</option></select></label><button class="button run" data-action="run-dsp">Generate + FFT</button><button class="button ghost" data-action="export-dsp">Export samples</button><button class="button ghost" data-action="export-spectrum">Export spectrum</button></div>
    <div class="dsp-plot"><span class="panel-label">TIME SERIES</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div><div class="dsp-plot"><span class="panel-label">FFT MAGNITUDE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace spectrum-trace" d="${spectrumPath}"/></svg></div>
    <div class="stat-grid"><div><span>Samples</span><strong>${signal?.data.length || '—'}</strong><small>bounded local array</small></div><div><span>Sample rate</span><strong>${signal ? fmt(signal.sampleRate) : '—'}</strong><small>Hz</small></div><div><span>FFT peak</span><strong>${peak === null ? '—' : fmt(peak, 3)}</strong><small>magnitude</small></div></div>
    <p class="module-footnote">This built-in experiment uses deterministic local math. It does not execute imported Python or claim SciPy/NumPy availability.</p></section></div>`;
}

function renderCommunication(state) {
  const result = state.simulation?.kind === 'communication' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'qpsk-ber')?.inputs || {};
  const points = result?.channel?.symbols || [];
  const plot = points.map((point) => `<circle cx="${150 + point.i * 100}" cy="${150 - point.q * 100}" r="4"/>`).join('');
  return `<div class="page scroll-page communication-page">${pageHeader(modules.find((item) => item.id === 'communication'), 'BUILT-IN LINK LAB', '<span class="pill live"><i></i> OFFLINE EXPERIMENT</span>')}
    <section class="dsp-card"><div class="dsp-controls"><label>Bits<input data-comm-field="bits" value="${esc(config.bits ?? '00110110')}" maxlength="256" aria-label="Bit sequence"></label><label>Noise σ<input type="number" min="0" max="2" step="0.01" data-comm-field="sigma" value="${esc(config.sigma ?? 0.15)}"></label><button class="button run" data-action="run-communication">Run QPSK + BER</button></div>
    <div class="constellation"><span class="panel-label">CONSTELLATION</span><svg viewBox="0 0 300 300"><path d="M150 10V290M10 150H290"/>${plot}</svg></div>
    <div class="stat-grid"><div><span>Symbols</span><strong>${result?.channel?.symbols.length || '—'}</strong><small>QPSK</small></div><div><span>Errors</span><strong>${result?.ber?.errors ?? '—'}</strong><small>bit errors</small></div><div><span>BER</span><strong>${result ? fmt(result.ber.rate, 4) : '—'}</strong><small>measured</small></div></div>
    <p class="module-footnote">Seeded offline channel model. No GNU Radio flowgraph or SDR hardware is accessed.</p></section></div>`;
}

function renderRf(state) {
  const result = state.simulation?.kind === 'rf' ? state.simulation.data : null;
  const s11 = result?.points?.map((point) => point.values[0]).filter(Boolean) || [];
  const smithPoints = s11.map((value) => `<circle cx="${(150 + Math.max(-1, Math.min(1, value.real)) * 120).toFixed(1)}" cy="${(150 - Math.max(-1, Math.min(1, value.imaginary)) * 120).toFixed(1)}" r="3"/>`).join('');
  const first = s11[0];
  return `<div class="page scroll-page rf-page">${pageHeader(modules.find((item) => item.id === 'rf'), 'BUILT-IN TOUCHSTONE LAB', '<span class="pill live"><i></i> LOCAL FILE ANALYSIS</span>')}
    <section class="dsp-card"><div class="dsp-controls"><label>Ports<input type="number" min="1" max="8" step="1" data-rf-field="ports" value="2"></label><button class="button run" data-action="parse-rf">Parse Touchstone</button></div><label class="rf-input-label">Touchstone text<textarea data-rf-field="text" rows="8" spellcheck="false" placeholder="# MHz S RI R 50\n1 1 0 0 0 0 0 0 0"></textarea></label>
    <div class="rf-result-grid"><div class="smith-chart"><span class="panel-label">S11 SMITH VIEW</span><svg viewBox="0 0 300 300"><path d="M150 10V290M10 150H290"/>${smithPoints}</svg></div><div><div class="stat-grid"><div><span>Ports</span><strong>${result?.ports ?? '—'}</strong><small>S-parameters</small></div><div><span>Reference</span><strong>${result ? fmt(result.referenceImpedance, 3) : '—'}</strong><small>Ω</small></div><div><span>Points</span><strong>${result?.points.length ?? '—'}</strong><small>${result?.frequencyUnit || 'frequency'}</small></div><div><span>S11 magnitude</span><strong>${first ? fmt(Math.hypot(first.real, first.imaginary), 3) : '—'}</strong><small>linear</small></div><div><span>S11 phase</span><strong>${first ? fmt(Math.atan2(first.imaginary, first.real) * 180 / Math.PI, 2) : '—'}</strong><small>degrees</small></div></div></div></div><p class="module-footnote">Parsed locally with bounded RI/MA/DB conversion. The chart uses only imported S11 points; no QucsatorRF, openEMS or network hardware is invoked.</p></section></div>`;
}

function renderControl(state) {
  const result = state.simulation?.kind === 'control' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'control-step')?.inputs || {};
  const values = result?.response?.data ? Array.from(result.response.data) : [];
  const max = Math.max(1, ...(values.length ? values : [1]));
  const path = values.length > 1 ? values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 560).toFixed(1)} ${(150 - (value / max) * 130).toFixed(1)}`).join(' ') : '';
  return `<div class="page scroll-page control-page">${pageHeader(modules.find((item) => item.id === 'iot'), 'BUILT-IN CONTROL LAB', '<span class="pill live"><i></i> LOCAL MODEL</span>')}
    <section class="dsp-card"><div class="dsp-controls"><label>Gain<input type="number" step="0.1" data-control-field="gain" value="${esc(config.gain ?? 1)}"></label><label>Time constant<input type="number" min="0.001" step="0.001" data-control-field="tau" value="${esc(config.tau ?? 0.1)}"><span>s</span></label><label>Sample rate<input type="number" min="1" step="1" data-control-field="sampleRate" value="${esc(config.sampleRate ?? 100)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-control-field="length" value="${esc(config.length ?? 256)}"></label><button class="button run" data-action="run-control">Run step response</button><button class="button ghost" data-action="export-control">Export response</button></div>
    <div class="dsp-plot"><span class="panel-label">STEP RESPONSE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div>
    <div class="stat-grid"><div><span>Stability</span><strong>${result ? (result.stability.stable ? 'Stable' : 'Unstable') : '—'}</strong><small>first-order pole</small></div><div><span>Final value</span><strong>${result ? fmt(values.at(-1), 3) : '—'}</strong><small>output units</small></div><div><span>Samples</span><strong>${values.length || '—'}</strong><small>bounded local array</small></div></div>
    <p class="module-footnote">This built-in experiment uses a deterministic first-order model. It does not claim python-control, Scilab or hardware-in-the-loop availability.</p></section></div>`;
}

function renderNetwork(state) {
  const result = state.simulation?.kind === 'network' ? state.simulation.trace : null;
  const metrics = state.simulation?.kind === 'topology' ? state.simulation.metrics : null;
  const rows = result?.packets?.slice(0, 100).map((packet) => `<tr><td>${packet.index}</td><td>${fmt(packet.timestamp, 6)}</td><td>${packet.capturedLength}</td><td>${packet.originalLength}</td><td>${Array.from(packet.data.slice(0, 8)).map((value) => value.toString(16).padStart(2, '0')).join(' ')}</td></tr>`).join('') || '';
  return `<div class="page scroll-page network-page">${pageHeader(modules.find((item) => item.id === 'network'), 'BUILT-IN PACKET LAB', '<span class="pill live"><i></i> SAVED CAPTURE ONLY</span>')}
    <section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="parse-pcap">Parse saved capture</button><label>Format<select data-pcap-field="format"><option value="pcap">PCAP</option><option value="pcapng">PCAPNG</option></select></label><span class="field-help">Saved capture bytes as hex; live capture is unavailable.</span></div><label class="rf-input-label">PCAP/PCAPNG hex<textarea data-pcap-field="hex" rows="7" spellcheck="false" placeholder="d4c3b2a1 ..."></textarea></label>
    <div class="stat-grid"><div><span>Link type</span><strong>${result?.linkType ?? '—'}</strong><small>PCAP header</small></div><div><span>Snap length</span><strong>${result?.snaplen ?? '—'}</strong><small>bytes</small></div><div><span>Packets</span><strong>${result?.packets.length ?? '—'}</strong><small>bounded reader</small></div></div>${result ? `<div class="packet-table"><table><thead><tr><th>#</th><th>Timestamp</th><th>Captured</th><th>Original</th><th>Prefix</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="module-footnote">Saved PCAP parsing is local and unprivileged. TShark, display filters and live interfaces remain separate unavailable capabilities.</p></section><section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="run-topology">Run topology metrics</button><span class="field-help">Deterministic reachability; no broker or live network access.</span></div><label class="rf-input-label">Topology JSON<textarea data-topology-field="json" rows="5" spellcheck="false">${esc(JSON.stringify({ id: 'demo-network', nodes: [{ id: 'sensor' }, { id: 'gateway' }, { id: 'server' }], links: [{ from: 'sensor', to: 'gateway' }, { from: 'gateway', to: 'server' }] }, null, 2))}</textarea></label>${metrics ? `<div class="stat-grid"><div><span>Nodes</span><strong>${metrics.nodes}</strong><small>validated</small></div><div><span>Links</span><strong>${metrics.links}</strong><small>undirected</small></div><div><span>Reachable</span><strong>${metrics.reachable}</strong><small>from source</small></div></div>` : ''}</section></div>`;
}

function renderDigitalWaveform(trace, requested, source, hasGenerated, hasImported) {
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
  const sourceOptions = `${hasGenerated ? `<option value="generated" ${source === 'generated' ? 'selected' : ''}>Generated GHDL VCD</option>` : ''}${hasImported ? `<option value="imported" ${source === 'imported' ? 'selected' : ''}>Imported VCD</option>` : ''}`;
  const clipped = matchingSignals.length > visibleSignals.length ? `<span class="field-help">Showing the first 32 of ${matchingSignals.length} matching signals.</span>` : '';
  return `<section class="dsp-card digital-waveform-card"><div class="dsp-controls"><span class="panel-label">DIGITAL WAVEFORM</span><label>Source<select data-digital-view="source">${sourceOptions}</select></label><label>Scope<select data-digital-view="group"><option value="all">All scopes</option>${groups.map((group) => `<option value="${esc(group)}" ${view.group === group ? 'selected' : ''}>${esc(group)}</option>`).join('')}</select></label><label>Signal filter<input data-digital-view="query" maxlength="100" value="${esc(view.query)}" placeholder="name or hierarchy"></label><button class="tool" data-action="digital-zoom-in">Zoom in</button><button class="tool" data-action="digital-zoom-out">Zoom out</button><button class="tool" data-action="digital-pan-left">Pan left</button><button class="tool" data-action="digital-pan-right">Pan right</button><button class="tool" data-action="export-digital-csv">Export CSV</button>${clipped}</div><div class="digital-waveform-scroll"><svg class="digital-waveform" viewBox="0 0 1000 ${height}" aria-label="Digital waveform with ${visibleSignals.length} visible signals"><rect class="digital-plot-bg" x="${plotLeft}" y="0" width="${plotWidth}" height="${height}"/><line class="digital-cursor cursor-a" x1="${x(view.cursorA)}" y1="0" x2="${x(view.cursorA)}" y2="${height}"/><line class="digital-cursor cursor-b" x1="${x(view.cursorB)}" y1="0" x2="${x(view.cursorB)}" y2="${height}"/>${rows || `<text x="500" y="38" text-anchor="middle" class="digital-empty">No signals match this scope and filter.</text>`}</svg></div><div class="waveform-cursors"><label>Cursor A · ${esc(trace.timescale)}<input type="range" min="${view.startTime}" max="${view.endTime}" value="${view.cursorA}" data-digital-view="cursorA"></label><label>Cursor B · ${esc(trace.timescale)}<input type="range" min="${view.startTime}" max="${view.endTime}" value="${view.cursorB}" data-digital-view="cursorB"></label><div class="result-value"><span>Visible window</span><b>${view.startTime}–${view.endTime}</b></div><div class="result-value"><span>Cursor Δ</span><b>${measurement.deltaTime} · ${esc(trace.timescale)}</b></div></div><p class="module-footnote">Values are sampled at or before each cursor. Rendering is bounded to 32 signals, 2,048 transitions per row and 40 vector labels; CSV export is bounded to 128 signals and 8 MiB.</p></section>`;
}

function renderDigital(state) {
  const trace = state.simulation?.kind === 'digital' ? state.simulation.trace : null;
  const lintReport = state.hdlResults?.lint?.report || null;
  const synthesisReport = state.hdlResults?.synthesis?.report || null;
  const placeRouteReport = state.hdlResults?.placeRoute?.report || null;
  const generatedTrace = state.hdlResults?.simulation?.trace || null;
  const requestedSource = state.digitalView?.source;
  const waveformSource = requestedSource === 'imported' && trace ? 'imported' : requestedSource === 'generated' && generatedTrace ? 'generated' : generatedTrace ? 'generated' : trace ? 'imported' : null;
  const waveformTrace = waveformSource === 'generated' ? generatedTrace : waveformSource === 'imported' ? trace : null;
  const waveformMarkup = waveformTrace ? renderDigitalWaveform(waveformTrace, state.digitalView, waveformSource, Boolean(generatedTrace), Boolean(trace)) : '';
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
    <section class="dsp-card"><div class="dsp-controls"><label>Language<select disabled><option>SystemVerilog</option></select></label><label>Top unit<input data-hdl-field="topUnit" maxlength="200" value="${esc(topUnit)}"></label><span class="field-help">${esc(lintReason)}</span></div><label class="rf-input-label">src/counter.sv<textarea data-hdl-field="source" rows="14" maxlength="49152" spellcheck="false">${esc(source)}</textarea></label>${lintReport ? `<div class="diagnostic-list">${diagnostics.length ? diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)}${diagnostic.line ? ` · line ${diagnostic.line}` : ''}: ${esc(diagnostic.message)}</span>`).join('') : '<span class="ok">● Verilator lint completed without diagnostics</span>'}</div>` : ''}<p class="module-footnote">Lint is a separate source-quality job. It does not claim simulation, timing closure, synthesis success or hardware readiness.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><label>Language<select disabled><option>VHDL 2008</option></select></label><label>Top entity<input data-hdl-field="vhdlTop" maxlength="200" value="${esc(vhdlTop)}"></label><label>Stop time<input type="number" data-hdl-field="stopTimeNs" min="1" max="1000000000" value="${stopTimeNs}"><span>ns</span></label><button class="button run" data-action="simulate-ghdl" ${simulationReady ? '' : 'disabled'} title="${esc(simulationReason)}">Simulate with GHDL</button></div><label class="rf-input-label">src/counter_tb.vhd<textarea data-hdl-field="vhdlSource" rows="16" maxlength="49152" spellcheck="false">${esc(vhdlSource)}</textarea></label>${generatedTrace ? `<div class="stat-grid"><div><span>Timescale</span><strong>${esc(generatedTrace.timescale)}</strong><small>generated VCD</small></div><div><span>Signals</span><strong>${generatedTrace.signals.length}</strong><small>scalar and vector</small></div><div><span>Transitions</span><strong>${generatedTrace.signals.reduce((sum, signal) => sum + signal.samples.length, 0)}</strong><small>bounded import</small></div><div><span>Status</span><strong>Simulated</strong><small>not synthesized</small></div></div>` : `<div class="empty-state">${esc(simulationReason)}</div>`}<p class="module-footnote">GHDL analysis, elaboration and simulation are separate native jobs. The resulting VCD is registered and parsed locally; simulation does not imply synthesis or hardware readiness.</p></section>
    ${waveformMarkup}
    <section class="dsp-card"><div class="dsp-controls"><span class="panel-label">SYNTHESIS REPORT · ${synthesisReport ? 'YOSYS' : 'NO RUN'}</span><span class="field-help">${esc(synthesisReason)}</span></div>${synthesisReport ? `<div class="stat-grid"><div><span>Wires</span><strong>${synthesisReport.metrics.wires ?? '—'}</strong><small>Yosys stat</small></div><div><span>Wire bits</span><strong>${synthesisReport.metrics.wireBits ?? '—'}</strong><small>Yosys stat</small></div><div><span>Memories</span><strong>${synthesisReport.metrics.memories ?? '—'}</strong><small>Yosys stat</small></div><div><span>Cells</span><strong>${synthesisReport.metrics.cells ?? '—'}</strong><small>Yosys stat</small></div></div>` : '<div class="empty-state">Run Yosys independently to produce bounded utilization evidence.</div>'}<p class="module-footnote">A synthesis report is not simulation evidence, timing closure, a placed design, a bitstream, or hardware readiness.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><span class="panel-label">IMPLEMENTATION TARGET · ICE40 HX8K / CT256</span><span class="field-help">${esc(placeRouteReason)}</span></div><label class="rf-input-label">Board-specific PCF constraints<textarea data-hdl-field="constraints" rows="6" maxlength="65536" spellcheck="false" placeholder="set_io clk &lt;board-pin&gt;">${esc(constraints)}</textarea></label>${placeRouteReport ? `<div class="stat-grid"><div><span>Device</span><strong>${esc(placeRouteReport.target || 'hx8k')}</strong><small>nextpnr report</small></div><div><span>Max frequency</span><strong>${placeRouteReport.timingMHz ?? '—'} MHz</strong><small>reported estimate</small></div><div><span>BELs used</span><strong>${placeRouteReport.belsUsed ?? '—'}</strong><small>placed resources</small></div><div><span>Output</span><strong>ASC</strong><small>registered artifact</small></div></div>` : '<div class="empty-state">A registered Yosys JSON netlist and complete PCF constraints are required.</div>'}<p class="module-footnote">This target produces place/route evidence only. Bitstream generation and device programming are not configured, and no hardware-ready claim is made.</p></section>
    <section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="parse-vcd">Parse VCD</button><span class="field-help">Scalar VCD import is local and remains separate from lint and simulation.</span></div><label class="rf-input-label">VCD text<textarea data-vcd-field="text" rows="10" spellcheck="false" placeholder="$timescale 1 ns $end">${esc(savedVcd)}</textarea></label>${trace ? `<div class="stat-grid"><div><span>Timescale</span><strong>${esc(trace.timescale)}</strong><small>VCD header</small></div><div><span>Signals</span><strong>${trace.signals.length}</strong><small>scalar</small></div><div><span>Transitions</span><strong>${trace.signals.reduce((sum, signal) => sum + signal.samples.length, 0)}</strong><small>bounded</small></div></div><div class="packet-table"><table><thead><tr><th>Signal</th><th>Transitions</th><th>Samples (time:value)</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="module-footnote">GHDL and compiled simulation, generated-waveform ingestion, timing and FPGA implementation remain separate capability gates.</p></section></div>`;
}

function renderLearning() {
  return `<div class="page scroll-page">${pageHeader(modules.at(-1), 'LEARN BY BUILDING', '<button class="button primary" disabled>Lessons unavailable</button>')}
    <section class="learning-hero"><div><span class="pill live"><i></i> PROJECT-BASED CURRICULUM</span><h2>From Ohm’s law to wireless systems.</h2><p>Every track ends in a working engineering project and connects theory directly to the lab modules.</p></div><div class="progress-ring"><strong>12%</strong><span>OVERALL<br>PROGRESS</span></div></section>
    <section class="track-grid">${learningTracks.map(([name, lessons, level], index) => `<article><span class="track-number">${String(index + 1).padStart(2, '0')}</span><span class="track-level">${level}</span><h3>${name}</h3><p>Planned: ${lessons} lessons · ${Math.max(2, Math.round(lessons / 4))} practical labs</p><div class="progress"><i style="width:0%"></i></div><button disabled>Unavailable in this alpha</button></article>`).join('')}</section>
  </div>`;
}

function renderVerifiedLearningLegacy() {
  const state = getState(); const evaluation = state.lessonEvaluation || (state.learningProgress?.lessons['voltage-divider'] ? { passed: state.learningProgress.lessons['voltage-divider'].passed } : null);
  return `<div class="page scroll-page">${pageHeader(modules.at(-1), 'LEARN BY BUILDING', '<button class="button primary" data-action="open-lesson-circuit">Open Circuit Lab</button>')}<section class="learning-hero"><div><span class="pill live"><i></i> VERIFIED CHECKPOINT</span><h2>Voltage divider</h2><p>Run the real built-in DC solver and verify that the output node is 6 V within ±0.01 V.</p><button class="button run" data-action="check-lesson">${evaluation ? 'Check latest result' : 'Check checkpoint'}</button></div><div class="progress-ring"><strong>${evaluation?.passed ? '100%' : '0%'}</strong><span>CHECKPOINT<br>PROGRESS</span></div></section><section class="track-grid"><article><span class="track-number">01</span><span class="track-level">FOUNDATION</span><h3>DC fundamentals</h3><p>One real circuit, one measured result and one tolerance-based checkpoint.</p><div class="progress"><i style="width:${evaluation?.passed ? '100%' : '0%'}"></i></div><span class="lesson-status">${evaluation ? (evaluation.passed ? 'Passed' : 'Not yet passed') : 'Not attempted'}</span></article>${learningTracks.slice(1).map(([name, lessons, level], index) => `<article><span class="track-number">${String(index + 2).padStart(2, '0')}</span><span class="track-level">${level}</span><h3>${name}</h3><p>Planned: ${lessons} lessons · future phase</p><div class="progress"><i style="width:0%"></i></div><button disabled>Not implemented</button></article>`).join('')}</section></div>`;
}

function renderVerifiedLearning() {
  const state = getState(); const evaluation = state.lessonEvaluation || (state.learningProgress?.lessons['voltage-divider'] ? { passed: state.learningProgress.lessons['voltage-divider'].passed } : null); const dspPassed = state.learningProgress?.lessons['dsp-window']?.passed; const commPassed = state.learningProgress?.lessons['qpsk-ber']?.passed;
  return `<div class="page scroll-page">${pageHeader(modules.at(-1), 'LEARN BY BUILDING', '<button class="button primary" data-action="open-lesson-circuit">Open Circuit Lab</button>')}<section class="learning-hero"><div><span class="pill live"><i></i> VERIFIED CHECKPOINTS</span><h2>Build, measure, verify.</h2><p>Checkpoints consume real Circuit, Signals and Link Lab results with explicit tolerances.</p></div><div class="progress-ring"><strong>${[evaluation?.passed, dspPassed, commPassed].filter(Boolean).length}/3</strong><span>CHECKPOINT<br>PROGRESS</span></div></section><section class="track-grid"><article><span class="track-number">01</span><span class="track-level">FOUNDATION</span><h3>DC fundamentals</h3><p>Verify the output node is 6 V within ±0.01 V.</p><div class="progress"><i style="width:${evaluation?.passed ? '100%' : '0%'}"></i></div><span class="lesson-status">${evaluation ? (evaluation.passed ? 'Passed' : 'Not yet passed') : 'Not attempted'}</span></article><article><span class="track-number">02</span><span class="track-level">SIGNALS</span><h3>Windowed FFT</h3><p>Generate a real bounded signal and verify its sample count.</p><div class="progress"><i style="width:${dspPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-dsp-lesson">${dspPassed ? 'Passed' : 'Check DSP result'}</button></article><article><span class="track-number">03</span><span class="track-level">COMMS</span><h3>QPSK BER</h3><p>Verify offline BER stays below 20%.</p><div class="progress"><i style="width:${commPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-comm-lesson">${commPassed ? 'Passed' : 'Check BER result'}</button></article>${learningTracks.slice(1).map(([name, lessons, level], index) => `<article><span class="track-number">${String(index + 4).padStart(2, '0')}</span><span class="track-level">${level}</span><h3>${name}</h3><p>Planned: ${lessons} lessons · future phase</p><div class="progress"><i style="width:0%"></i></div><button disabled>Not implemented</button></article>`).join('')}</section></div>`;
}

function renderToolchainsLegacy(state) {
  const toolchainModule = { name: 'Toolchains', description: 'Detected tools, licences and capabilities.', color: '#94a3b8' };
  const deviceScopes = browserDevicePolicy.inspect();
  return `<div class="page scroll-page toolchains-page">
    ${pageHeader(toolchainModule, 'NATIVE CAPABILITY CATALOG', '<button class="button ghost" disabled title="Native detection is unavailable in browser preview">Refresh detection unavailable</button>')}
    <section class="toolchain-notice"><span class="pill"><i></i> BROWSER PREVIEW</span><h2>Native tools are never assumed installed.</h2><p>The desktop bridge will probe fixed executable paths without installing or mutating the system. This preview shows the reviewed catalogue and honest capability states only.</p></section>
    <section class="engine-table">${engines.map((engine) => `<div class="engine-row"><span class="engine-logo">${esc(engine.name.slice(0, 2).toUpperCase())}</span><div><b>${esc(engine.name)}</b><small>${esc(engine.capability)}</small></div><span>${esc(engine.area)}</span><span>${esc(engine.license)}</span><span class="engine-status ${engine.status}">${engine.status === 'built-in' ? 'â— Built in' : engine.status === 'unsupported' ? 'âŠ˜ Unsupported' : 'â—‹ Unavailable'}</span></div>`).join('')}</section>
    <section class="module-info-grid"><article><span class="eyebrow">SECURITY BOUNDARY</span><h3>Read-only discovery</h3><p>Tool detection will use allow-listed manifests, absolute paths and deterministic self-tests. Missing tools remain unavailable until the user configures them.</p></article><article><span class="eyebrow">LICENCE POLICY</span><h3>Upstream terms stay visible</h3><p>Each adapter records an SPDX expression, upstream source and installation mode. OpenENTC does not relicense connected tools.</p></article></section>
    <section class="permission-card"><div class="section-title"><div><span class="eyebrow">DEVICE PERMISSIONS + PROCESS</span><h2>Explicit target scopes</h2></div><span class="pill">${desktopBridge.available ? 'PROJECT-BOUND' : 'BROWSER DENIED'}</span></div><p class="muted">Serial, USB, debug, capture, SDR and programmer access, plus process execution, are separate permissions. No scope is granted automatically.</p><div class="permission-grid">${deviceScopes.map((scope) => `<div class="permission-row"><span>${esc(scope.permission)}</span><span class="engine-status unavailable">${scope.allowed ? 'Available' : 'Unavailable'}</span><small>${scope.grantedTargets.length ? esc(scope.grantedTargets.join(', ')) : 'No target selected'}</small></div>`).join('')}<div class="permission-row"><span>Process execution</span><span class="engine-status unavailable">Unavailable</span><small>Requires an explicit project-scoped desktop grant; browser preview never exposes it.</small></div></div></section>
  </div>`;
}

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
  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => { wireSource = null; selectedWire = null; setState({ activeModule: button.dataset.module, selectedComponentId: null }); }));
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
  const experimentModules = { 'signals-fft': 'dsp', 'control-step': 'iot', 'qpsk-ber': 'communication', 'rf-touchstone': 'rf', 'topology-metrics': 'network', 'vcd-import': 'fpga' };
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
  bindControlEvents();
  bindNetworkEvents();
  bindDigitalEvents();
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
    if (activeArduinoUpload) await cancelArduinoUpload(true);
    if (activeHdlJob) await cancelHdlJob(true);
    const root = await desktopBridge.pickProjectDirectory();
    if (!root) return;
    const summary = await desktopBridge.openProject(root);
    nativeOpened = true;
    const project = await desktopBridge.readOpenProject();
    replaceProject(project);
    activeSerialSession = null; activeSerialNative = null; if (serialPollTimer) clearTimeout(serialPollTimer); serialPollTimer = null;
    setState({ desktopProject: summary, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify('Desktop project opened and validated', 'success');
  } catch (error) {
    if (nativeOpened) await desktopBridge.closeProject().catch(() => {});
    activeSerialSession = null; activeSerialNative = null; if (serialPollTimer) clearTimeout(serialPollTimer); serialPollTimer = null;
    setState({ desktopProject: null, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify(error?.message || 'Desktop project could not be opened', 'error');
  }
}

async function closeNativeSessionForBrowserProject() {
  if (!desktopBridge.available || !getState().desktopProject) return true;
  try {
    if (activeArduinoUpload) await cancelArduinoUpload(true);
    if (activeHdlJob) await cancelHdlJob(true);
    await desktopBridge.closeProject();
    activeSerialSession = null; activeSerialNative = null; if (serialPollTimer) clearTimeout(serialPollTimer); serialPollTimer = null;
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
  if (activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
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
    activeHdlJob = { runId, adapter, engine: 'verilator', operation: 'lint' };
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
  } finally { activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
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
  if (activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
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
      adapters.push(adapter); activeHdlJob = { runId, adapter, engine: 'ghdl', operation };
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
  } finally { activeHdlJob = null; setState({ hdlJob: null }); for (const adapter of adapters) await adapter.clean().catch(() => {}); }
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
  if (activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
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
    activeHdlJob = { runId, adapter, engine: 'yosys', operation: 'synthesis' };
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
  } finally { activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
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
  if (activeHdlJob) { notify('An HDL job is already active', 'error'); return; }
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
    activeHdlJob = { runId, adapter, engine: 'nextpnr-ice40', operation: 'place-route' };
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
  } finally { activeHdlJob = null; setState({ hdlJob: null }); await adapter?.clean().catch(() => {}); }
}

async function cancelHdlJob(silent = false) {
  const active = activeHdlJob;
  if (!active) return;
  setState({ hdlJob: { runId: active.runId, engine: active.engine, operation: active.operation, phase: 'cancelling' } });
  try { await active.adapter.cancel(); if (!silent) notify(`Cancelling ${active.engine} ${active.operation}`, 'success'); }
  catch (error) { if (!silent) notify(error?.message || 'HDL job cancellation failed', 'error'); }
}

function bindDspEvents() {
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
    wireSource = null;
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
  document.querySelector('[data-action="clear-circuit"]')?.addEventListener('click', () => { wireSource = null; selectedWire = null; updateProject((project) => { project.circuit.components = []; project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; }); setState({ selectedComponentId: null, simulation: null }); });
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
    if (activeSerialNative) await disconnectArduinoSerial();
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
    const point = project.settings.grid ? snapCanvasPoint({ x: 130 + (count * 47) % 420, y: 90 + (count * 71) % 260 }, project.settings.gridSize) : { x: 130 + (count * 47) % 420, y: 90 + (count * 71) % 260 };
    project.circuit.components.push({ id, type, label: type === 'ground' ? 'GND' : id, value: template.defaultValue, unit: template.unit, n1: type === 'ground' ? '0' : `n${count}`, n2: '0', x: point.x, y: point.y });
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
  wireSource = null;
  if (!selectedIds.length) return;
  updateProject((project) => {
    project.circuit.components = project.circuit.components.filter((part) => !selectedIds.includes(part.id));
    const retainedNodes = [
      ...project.circuit.components.flatMap((part) => [part.n1, part.n2]),
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

function duplicateSelected() {
  const id = getState().selectedComponentId;
  if (!id) return false;
  let nextId = null;
  updateProject((project) => { const result = duplicateComponent(project.circuit.components, id); project.circuit.components = result.components; nextId = result.id; });
  if (!nextId) return false;
  setState({ selectedComponentId: nextId, simulation: null });
  notify('Component duplicated', 'success');
  return true;
}

function copySelected() {
  const state = getState();
  const ids = state.selectedComponentIds?.length ? state.selectedComponentIds : (state.selectedComponentId ? [state.selectedComponentId] : []);
  clipboardParts = state.project.circuit.components.filter((part) => ids.includes(part.id)).map((part) => structuredClone(part));
  const nodes = new Set(clipboardParts.flatMap((part) => [part.n1, part.n2]).filter((node) => typeof node === 'string'));
  clipboardWires = state.project.circuit.wires.filter((wire) => nodes.has(wire.from) && nodes.has(wire.to)).map((wire) => structuredClone(wire));
  if (!clipboardParts.length) return false;
  notify(`${clipboardParts.length} component${clipboardParts.length === 1 ? '' : 's'} copied`, 'info');
  return true;
}

function pasteCopied() {
  if (!clipboardParts.length) return false;
  let nextIds = [];
  updateProject((project) => {
    const pasteOffset = { x: 28, y: 28 };
    const result = pasteComponents(project.circuit.components, clipboardParts, pasteOffset);
    project.circuit.components = result.components;
    project.circuit.wires = clipboardWires.reduce((wires, wire) => {
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
  if (!part || !['n1', 'n2'].includes(field)) return;
  const node = part[field];
  if (!wireSource) {
    wireSource = { partId, field, node };
  setState({ selectedComponentId: partId, selectedComponentIds: [partId] });
    notify(`Wire source selected: ${node}`, 'info');
    return;
  }
  if (wireSource.partId === partId && wireSource.field === field) {
    wireSource = null;
    notify('Wire source cleared', 'info');
    setState({ selectedComponentId: partId, selectedComponentIds: [partId] });
    return;
  }
  const source = wireSource;
  wireSource = null;
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
      selectedWire = { from: path.dataset.wireRouteFrom, to: path.dataset.wireRouteTo };
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
        event.preventDefault(); selectedWire = null;
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
  try { const project = getState().project; const erc = checkElectricalRules(project.circuit.components, project.circuit.wires, project.circuit.netLabels); if (erc.some((diagnostic) => diagnostic.severity === 'error')) { notify(`Fix ${erc.length} electrical rule issue${erc.length === 1 ? '' : 's'} before analysis`, 'error'); return; } const result = simulateDC(project.circuit.components, project.circuit.wires, project.circuit.netLabels); recordExperiment({ id: 'circuit-dc', kind: 'circuit', operation: 'dc-analysis', inputs: { componentCount: project.circuit.components.length, wireCount: project.circuit.wires.length, netLabelCount: project.circuit.netLabels.length } }); setState({ simulation: result, selectedComponentId: null, selectedComponentIds: [] }); notify('DC analysis completed', 'success'); }
  catch (error) { notify(error.message, 'error'); }
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
  if (!activeSerialSession) return;
  setState({ arduinoSerial: { ...activeSerialSession.inspect(), text: activeSerialSession.exportText(), nativeError } });
}

function decodeSerialBytes(bytes, encoding, decoder) {
  if (encoding === 'ascii') return bytes.map((value) => value <= 0x7f ? String.fromCharCode(value) : '�').join('');
  return decoder.decode(Uint8Array.from(bytes), { stream: true });
}

async function pollArduinoSerial() {
  const native = activeSerialNative;
  if (!native || !activeSerialSession) return;
  try {
    const result = await desktopBridge.pollSerial(native.projectId, native.id, 8192);
    if (activeSerialNative !== native) return;
    if (result.bytes.length) activeSerialSession.ingest(decodeSerialBytes(result.bytes, native.encoding, native.decoder));
    if (!activeSerialSession.inspect().paused) publishArduinoSerial(result.error);
    if (!result.open || result.error) {
      activeSerialSession.disconnect({ unexpected: true });
      await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
      publishArduinoSerial(result.error || 'Serial port closed unexpectedly.');
      serialPollTimer = null;
      return;
    }
    serialPollTimer = setTimeout(pollArduinoSerial, 150);
  } catch (error) {
    if (activeSerialNative !== native || !activeSerialSession) return;
    activeSerialSession.disconnect({ unexpected: true });
    publishArduinoSerial(error?.message || 'Serial polling failed.');
    serialPollTimer = null;
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
    if (activeSerialNative) await disconnectArduinoSerial();
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
    activeSerialSession = createSerialSession({ permissionPolicy: policy, target: port, ...config, maxBufferBytes: 64 * 1024, maxReconnectAttempts: 3 });
    activeSerialSession.connect();
    activeSerialNative = { projectId: project.project_id, id, target: port, baud: config.baud, encoding: config.encoding, decoder: new TextDecoder('utf-8') };
    publishArduinoSerial(); serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal connected to ${port}`, 'success');
  } catch (error) { notify(error?.message || 'Serial port could not be opened', 'error'); }
}

async function reconnectArduinoSerial() {
  const native = activeSerialNative;
  if (!native || !activeSerialSession || activeSerialSession.inspect().state !== 'reconnecting') { notify('No interrupted serial session is available to reconnect', 'error'); return; }
  try {
    await desktopBridge.startSerial(native.projectId, native.id, native.target, native.baud, 64 * 1024);
    activeSerialSession.reconnect(); native.decoder = new TextDecoder('utf-8'); publishArduinoSerial(); serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal reconnected to ${native.target}`, 'success');
  } catch (error) {
    try { activeSerialSession.reconnect(); activeSerialSession.markReconnectFailed(); } catch { /* state already exhausted */ }
    publishArduinoSerial(error?.message || 'Serial reconnect failed'); notify(error?.message || 'Serial reconnect failed', 'error');
  }
}

async function disconnectArduinoSerial() {
  if (serialPollTimer) clearTimeout(serialPollTimer); serialPollTimer = null;
  const native = activeSerialNative; const session = activeSerialSession;
  activeSerialNative = null; activeSerialSession = null;
  if (native) await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
  if (session) { session.close(); setState({ arduinoSerial: { ...session.inspect(), text: session.exportText(), nativeError: null } }); }
}

function toggleArduinoSerialPause() {
  if (!activeSerialSession) return; activeSerialSession.setPaused(!activeSerialSession.inspect().paused); publishArduinoSerial();
}

function clearArduinoSerial() {
  if (activeSerialSession) { activeSerialSession.clear(); publishArduinoSerial(); } else setState({ arduinoSerial: null });
}

function exportArduinoSerial() {
  const text = activeSerialSession?.exportText() || getState().arduinoSerial?.text || '';
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `openentc-serial-${Date.now()}.txt`; link.click(); URL.revokeObjectURL(link.href); notify('Serial transcript exported', 'success');
}

async function sendArduinoSerial() {
  const input = document.querySelector('[data-field="serial-transmit"]'); const native = activeSerialNative;
  if (!input || !native || !activeSerialSession) return;
  try {
    const text = activeSerialSession.formatTransmit(input.value); await desktopBridge.writeSerial(native.projectId, native.id, new TextEncoder().encode(text)); input.value = '';
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
  const upload = activeArduinoUpload;
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
  if (activeArduinoUpload) { notify('An Arduino upload is already active', 'error'); return; }
  const structure = analyzeSketchSource(state.project.embedded.code);
  if (structure.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) { setState({ simulation: { kind: 'firmware', report: structure } }); notify('Fix source structure errors before uploading', 'error'); return; }
  const baseId = `arduino-upload-${Date.now().toString(36)}`;
  const sketchPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'sketch');
  const buildPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'build');
  const sketchBytes = new TextEncoder().encode(state.project.embedded.code); const artifacts = []; let compileAdapter = null; let uploadAdapter = null;
  const runnerOptions = { bridge: desktopBridge, project: desktopProject, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id) }), onArtifact: (artifact) => { artifacts.push(artifact); } };
  try {
    activeArduinoUpload = { runId: baseId, port, adapter: null };
    setState({ arduinoUpload: { runId: baseId, phase: 'compiling', port } });
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(desktopProject.project_id, `runs/${baseId}/sketch/sketch.ino`, sketchBytes, 'text/x-arduino'));
    compileAdapter = createArduinoCliAdapter({ executable: detection.path, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-compile` }) });
    activeArduinoUpload.adapter = compileAdapter;
    const compileJob = { operation: 'compile', board: target.fqbn, sketchPath, buildPath };
    await compileAdapter.prepare(compileJob); await compileAdapter.run(compileJob); const report = await compileAdapter.parse(compileJob);
    const permissionPolicy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['programmer'] }); permissionPolicy.selectTarget('programmer', port);
    uploadAdapter = createArduinoCliAdapter({ executable: detection.path, permissionPolicy, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-device`, deviceAuthorization: { permission: 'device-programmer', target: port } }) });
    activeArduinoUpload.adapter = uploadAdapter;
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
    activeArduinoUpload = null;
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

function showModal(title, content) {
  const layer = document.querySelector('.modal-layer');
  const previousFocus = document.activeElement;
  layer.hidden = false;
  layer.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" aria-label="Close">×</button><span class="eyebrow">OPENENTC STUDIO</span><h2 id="modal-title">${title}</h2>${content}<button class="button primary wide modal-done">Got it</button></div>`;
  const modal = layer.querySelector('.modal');
  const focusable = () => [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled && element.offsetParent !== null);
  const close = () => { layer.hidden = true; layer.innerHTML = ''; layer.removeEventListener('click', onBackdrop); layer.removeEventListener('keydown', onKeyDown); if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); };
  const onBackdrop = (event) => { if (event.target === layer) close(); };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const elements = focusable(); if (!elements.length) return;
    const first = elements[0]; const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  layer.addEventListener('click', onBackdrop); layer.addEventListener('keydown', onKeyDown);
  layer.querySelector('.modal-close').addEventListener('click', close); layer.querySelector('.modal-done').addEventListener('click', close);
  layer.querySelector('.modal-close').focus();
}

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

subscribe(render);
render();
