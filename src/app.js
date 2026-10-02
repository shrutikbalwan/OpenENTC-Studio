import { modules, componentPalette, learningTracks } from './data/modules.js';
import { engines } from './core/engine-registry.js';
import { createProject } from './core/project.js';
import { createPackagedProjectExport, importProjectFile } from './core/project-file.js';
import { getState, setState, updateProject, recordExperiment, subscribe, notify, replaceProject, synchronizeOpenProject, undoProject, redoProject, canUndoProject, canRedoProject, recordLearningAttempt, saveProject } from './core/store.js';
import { simulateDC, simulateTransient, simulateAC, sampleWaveform } from './engines/circuit-engine.js';
import { exampleCircuits } from './data/example-circuits.js';
import { circuitNodes, createCoSimulation } from './engines/cosim.js';
import { circuitTraces, decimate, niceRange, decadeTicks, linePath, stepMetrics, waveformMetrics, bodeMetrics, circuitResultCsv } from './core/circuit-plot.js';
import { checkElectricalRules, locateElectricalRuleDiagnostic } from '../packages/schematic/src/erc.mjs';
import { normalizeNode } from '../packages/schematic/src/index.mjs';
import { nodeFields, pinName as componentPinName } from '../packages/schematic/src/components.mjs';
import { connectNodes, disconnectNodes, pruneWires, setWireRoute } from './core/wires.js';
import { duplicateComponent, moveComponents, pasteComponents, rotateComponents } from './core/circuit-editing.js';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';
import { buildWireSegments, defaultWireRoute, orthogonalPath, wireRouteHandle, wireRouteHandles, wireRouteInsertionPoint } from '../packages/schematic/src/geometry.mjs';
import { componentsInRect } from '../packages/schematic/src/selection.mjs';
import { fitCanvasView, screenToCanvas, snapCanvasPoint, zoomCanvasView } from './core/canvas.js';
import { parseEngineeringValue, formatEngineeringValue } from '../packages/schematic/src/units.mjs';
import { applyWindow, cabs, cdiv, cexp, complex, convolutionSteps, cscale, designFir, designIir, FILTER_TYPES, FIR_WINDOWS, fft, filterFir, frequencyResponseDigital, generateSine, impulseResponse, lfilter, poleZero, polyadd, polyRoots, polyval } from '../packages/numerics/src/index.mjs';
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate, ANALOG_SCHEMES, berCurve, CRC_POLYNOMIALS, convolutionalEncode, crcCheck, crcDivide, DIGITAL_SCHEMES, eyeDiagram, hammingDecode, hammingEncode, LINE_CODES, lineCode, samplingDemo, simulateAnalogModulation, simulateDigitalLink, viterbiDecode } from '../packages/communications/src/index.mjs';
import { coaxImpedance, ELEMENT_PATTERNS, freeSpacePathLossDb, linearArray, linkBudget, lMatch, microstrip, microstripWidth, parseTouchstone, quarterWaveMatch, reflection, singleStubMatch, SPEED_OF_LIGHT, transmissionLine, twinLeadImpedance } from '../packages/rf/src/index.mjs';
import { analyzeSystem, classifyStability, firstOrderStability, firstOrderStep, formatPolynomial, makeTransferFunction, pidController, pidLoop, rootLocus, routhArray, timeResponse, zieglerNichols } from '../packages/control/src/index.mjs';
import { adcResolution, COLOR_BANDS, convertLevel, dbToRatio, decodeCapacitorCode, decodeResistorBands, decodeSmdResistor, design555Astable, E_SERIES, encodeResistorBands, ledResistor, nearestPreferred, OPAMP_CONFIGS, opampStage, POWER_UNITS, ratioToDb, rcFilter, reactance, rlcResonance, seriesParallel, solveOhm, timer555Astable, timer555Monostable, voltageDivider } from '../packages/calculators/src/index.mjs';
import { autoPlace, autoroute, billOfMaterials, buildBoard, createZip, extractNetlist, fabricationFiles, normalizeRules, ratsnest, runDrc, silkscreen, traceWidthForCurrent } from '../packages/pcb/src/index.mjs';
import { assemble, AVR_EXAMPLES, Cpu8051, disassemble, EXAMPLES_8051, parseIntelHex, toImage, toIntelHex, TrainerBoard, UnoBoard, unoPin, PIN_LABELS, decodeI2c, decodeSpi, decodeUart, estimateBaud, fromVcd, sliceChannel, toVcd } from '../packages/mcu/src/index.mjs';
import { applyGenerator, applySupplies, diodeTest, dmmDisplay, findTrigger, GENERATOR_SHAPES, measure, measureResistance, phaseDifference, screenTrace, valueAt } from '../packages/instruments/src/index.mjs';
import { buildLabRecord } from '../packages/report/src/index.mjs';
import { adcCode, adcThresholds, dualSlope, dynamicTest, flashConvert, integratingRejection, linearity, r2rDac, sarConvert, sigmaDelta, weightedDac } from '../packages/converters/src/index.mjs';
import { coldJunction, INAMPS, measurementChain, ntcResistance, rtdResistance, rtdTemperature, seebeck, steinhartHart, steinhartTemperature, strainBridge, lvdt, THERMOCOUPLE_COEFFICIENTS, THERMOCOUPLE_TYPES, thermocoupleEmf } from '../packages/sensors/src/index.mjs';
import { accelerationRun, baseSpeedRpm, batteryPack, CELLS, constantSpeedRange, designPack, gearRatioForTopSpeed, motorTorque, chargingTime } from '../packages/ev/src/index.mjs';
import { CONVERTERS, INVERTERS, RECTIFIERS, simulateAcController, simulateConverter, simulateInverter, simulateRectifier } from '../packages/power/src/index.mjs';
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
import { analyzeCombinational, analyzeFunction, convertNumber, LOGIC_TEMPLATES, parseNetlist, parseNumber, simulateNetlist, truthTable } from '../packages/logic/src/index.mjs';
import { GROUP_COLORS, parseMintermNotation, renderGateDiagram, renderKarnaugh, renderTimingDiagram } from './core/logic-view.js';
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
  if (active.id === 'iot') return renderControl(state);
  if (active.id === 'network') return renderNetwork(state);
  if (active.id === 'fpga') return renderDigital(state);
  if (active.id === 'logic') return renderLogic(state);
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

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
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
    <div class="wire-connect"><span class="panel-label">WIRE ALIASES</span><p>${wireSource ? `Source selected: <code>${esc(wireSource.node)}</code>. Choose another terminal.` : 'Choose a terminal, then another terminal to connect their node names.'}</p><div class="wire-endpoints">${nodeFields(part).length === 3 ? nodeFields(part).map((field) => `<button class="tool ${wireSource?.partId === part.id && wireSource?.field === field ? 'active' : ''}" data-wire-node="${esc(part.id)}:${field}">${esc(componentPinName(part, field).slice(0, 3))} ${esc(part[field] || '')}</button>`).join('') : `<button class="tool ${wireSource?.partId === part.id && wireSource?.field === 'n1' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n1">+ ${esc(part.n1)}</button><button class="tool ${wireSource?.partId === part.id && wireSource?.field === 'n2' ? 'active' : ''}" data-wire-node="${esc(part.id)}:n2">− ${esc(part.n2)}</button>`}</div>${connectedWires.length ? `<div class="wire-list" aria-label="Connected wires">${connectedWires.map((wire) => `<div class="wire-row"><code>${esc(wire.from)} ↔ ${esc(wire.to)}</code><button class="tool" data-wire-remove-from="${esc(wire.from)}" data-wire-remove-to="${esc(wire.to)}" aria-label="Disconnect ${esc(wire.from)} from ${esc(wire.to)}">Remove</button></div>`).join('')}</div>` : ''}<div class="wire-endpoints"><button class="tool" data-action="add-net-label">Add net label</button><button class="tool" data-action="add-junction">Add junction</button></div></div>
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
const PLOT_COLORS = ['#5eead4', '#60a5fa', '#f59e0b', '#fb7185', '#a78bfa', '#4ade80', '#f97316', '#22d3ee'];
const eng = (value, unit = '') => formatEngineeringValue(Math.abs(value) < 1e-15 ? 0 : value, unit, { digits: 4 }).trim();
const decibels = (value) => `${fmt(Math.abs(value) < 0.005 ? 0 : value, 2)} dB`;
const isDcResult = (simulation) => Boolean(simulation?.nodes && simulation?.currents && !simulation.kind);

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

function renderPlotFrame({ title, series, xMin, xMax, logX = false, xTicks, yRange, formatY }) {
  const width = 600, height = 150;
  const yPosition = (value) => (1 - (value - yRange.min) / (yRange.max - yRange.min || 1));
  const grid = yRange.ticks.map((tick) => `<line x1="0" x2="${width}" y1="${(yPosition(tick) * height).toFixed(2)}" y2="${(yPosition(tick) * height).toFixed(2)}"/>`).join('')
    + xTicks.map((tick) => `<line y1="0" y2="${height}" x1="${(tick.position * width).toFixed(2)}" x2="${(tick.position * width).toFixed(2)}"/>`).join('');
  const stemPath = (entry) => {
    const zero = Math.min(1, Math.max(0, yPosition(0))) * height;
    return entry.xs.map((x, index) => { const px = ((x - xMin) / (xMax - xMin || 1) * width).toFixed(2); return Number.isFinite(entry.ys[index]) ? `M${px} ${zero.toFixed(2)}V${(yPosition(entry.ys[index]) * height).toFixed(2)}` : ''; }).join('');
  };
  const paths = [...series].reverse().map((entry) => entry.stem
    ? `<path class="plot-stem" stroke="${entry.color}" d="${stemPath(entry)}"/><path class="plot-stem-head" stroke="${entry.color}" d="${entry.xs.map((x, index) => Number.isFinite(entry.ys[index]) ? `M${((x - xMin) / (xMax - xMin || 1) * width).toFixed(2)} ${(yPosition(entry.ys[index]) * height).toFixed(2)}h0` : '').join('')}"/>`
    : `<path class="plot-trace${entry.primary ? ' primary' : ''}${entry.dashed ? ' dashed' : ''}" stroke="${entry.color}" d="${linePath(entry.xs, entry.ys, { width, height, xMin, xMax, yMin: yRange.min, yMax: yRange.max, logX })}"/>`).join('');
  const xLabel = (tick) => `<span style="left:${(tick.position * 100).toFixed(2)}%;transform:translateX(${tick.position <= 0.001 ? '0' : tick.position >= 0.999 ? '-100%' : '-50%'})">${esc(tick.text)}</span>`;
  return `<div class="circuit-plot"><span class="plot-title">${esc(title)}</span><div class="plot-body"><div class="plot-y">${yRange.ticks.map((tick) => `<span style="top:${(yPosition(tick) * 100).toFixed(2)}%">${esc(formatY(tick))}</span>`).join('')}</div><div class="plot-area"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}"><g class="plot-grid">${grid}</g>${paths}</svg><div class="plot-x">${xTicks.map(xLabel).join('')}</div></div></div></div>`;
}

const readout = (label, value) => `<div class="result-value"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

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

function renderLogic(state) {
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

function bindLogicEvents() {
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

function renderEngineeringModule(module) {
  const detail = moduleDetails[module.id];
  return `<div class="page scroll-page specialist-page">
    ${pageHeader(module, detail.label, '<button class="button ghost" disabled>Save unavailable</button><button class="button run" disabled>Engine unavailable</button>')}
    <section class="specialist-hero"><div class="specialist-visual">${moduleGraphic(detail.visual)}<span class="engine-chip">PLANNED ENGINE · ${detail.engine}</span></div><div class="experiment-panel"><span class="panel-label">WORKFLOW PREVIEW</span><h2>${module.name} starter</h2><p>This screen is a non-executable preview. Its specialist engine is not detected or integrated.</p><ol>${detail.steps.map((step, index) => `<li><span>${index + 1}</span>${step}<i>${index === 0 ? 'PLANNED' : ''}</i></li>`).join('')}</ol><button class="button primary wide" disabled>Unavailable in this alpha</button></div></section>
    <section class="stat-grid">${detail.stats.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong><small>Project default</small></div>`).join('')}<div><span>Connector</span><strong>${detail.engine}</strong><small>External engine boundary</small></div></section>
    <section class="module-info-grid"><article><span class="eyebrow">TARGET ARCHITECTURE</span><h3>One project, shared context</h3><p>Future design data, configuration and notes will share the OpenENTC project. Exchange adapters will isolate third-party formats and licences.</p></article><article><span class="eyebrow">CURRENT STATUS</span><h3>Unavailable</h3><p>This phase records the intended workflow only. No specialist operation can run from this screen.</p></article></section>
  </div>`;
}

const DSP_DEFAULTS = Object.freeze({
  tab: 'fft', method: 'butterworth', filterType: 'lowpass', order: 4, taps: 31, window: 'hamming', beta: 6, rippleDb: 1,
  cutoff: 1000, cutoffHigh: 2000, sampleRate: 8000, toneLow: 300, toneHigh: 2500, convX: '1 2 3 1', convH: '1 1 0.5', convN: 2,
});
const DSP_TABS = [['fft', 'Signal & FFT'], ['filter', 'Filter designer'], ['convolution', 'Convolution']];
const FILTER_METHODS = [['butterworth', 'Butterworth IIR'], ['chebyshev1', 'Chebyshev type I IIR'], ['fir', 'FIR (windowed sinc)']];
const FILTER_TYPE_LABELS = { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', bandstop: 'Band-stop' };

function dspConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'dsp-lab')?.inputs || {};
  return { ...DSP_DEFAULTS, ...saved };
}

function persistDsp(patch) {
  recordExperiment({ id: 'dsp-lab', kind: 'dsp', operation: 'dsp-lab', inputs: { ...dspConfiguration(getState()), ...patch } });
}

const labField = (attribute, name, label, value, unit = '', attributes = 'type="number" step="any"') => `<label>${label}<input ${attributes} ${attribute}="${name}" value="${esc(value)}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const labSelect = (attribute, name, label, value, options) => `<label>${label}<select ${attribute}="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
const dspField = (...args) => labField('data-dsp-lab-field', ...args);
const dspSelect = (...args) => labSelect('data-dsp-lab-field', ...args);
const labTabs = (tabs, active, attribute) => `<div class="logic-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${active === id}" class="${active === id ? 'active' : ''}" ${attribute}="${id}">${label}</button>`).join('')}</div>`;
const complexText = (value) => (Math.abs(value.im) < 1e-12 ? fmt(value.re, 4) : `${fmt(value.re, 4)} ${value.im < 0 ? '−' : '+'} j${fmt(Math.abs(value.im), 4)}`);
const indexTicks = (first, last) => { const span = Math.max(1, last - first); const step = Math.max(1, Math.ceil(span / 8)); const ticks = []; for (let n = first; n <= last; n += step) ticks.push({ position: (n - first) / span, text: String(n) }); return ticks; };

/** s- or z-plane plot: optional unit circle, curves, poles (×), zeros (○) and highlighted points. */
function renderComplexPlane({ label, extent, unitCircle = false, curves = [], poles = [], zeros = [], marks = [], criticalPoint = false }) {
  const size = 300, centre = size / 2, scale = 130 / extent;
  const x = (re) => Math.max(-5e3, Math.min(5e3, centre + re * scale)).toFixed(2);
  const y = (im) => Math.max(-5e3, Math.min(5e3, centre - im * scale)).toFixed(2);
  const group = (points) => points.reduce((list, point) => { const same = list.find((entry) => Math.hypot(entry.re - point.re, entry.im - point.im) < extent * 1e-3); if (same) same.count += 1; else list.push({ ...point, count: 1 }); return list; }, []);
  const multiplicity = (point) => (point.count > 1 ? `<text class="pz-count" x="${(Number(x(point.re)) + 7).toFixed(1)}" y="${(Number(y(point.im)) - 7).toFixed(1)}">${point.count}</text>` : '');
  const tick = Number((extent / 2).toPrecision(1));
  const axisLabels = `<text class="pz-axis-label" x="${x(tick)}" y="${centre + 12}">${fmt(tick, 3)}</text><text class="pz-axis-label" x="${centre + 4}" y="${y(tick)}">j${fmt(tick, 3)}</text>`;
  const curvePaths = curves.map((curve) => `<path class="pz-curve${curve.dashed ? ' dashed' : ''}" stroke="${curve.color}" d="${curve.points.map((point, index) => `${index ? 'L' : 'M'}${x(point.re)} ${y(point.im)}`).join('')}"/>`).join('');
  return `<svg class="pz-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><path class="axis" d="M${centre} 4V${size - 4}M4 ${centre}H${size - 4}"/>${unitCircle ? `<circle class="unit-circle" cx="${centre}" cy="${centre}" r="${scale}"/>` : ''}${axisLabels}${curvePaths}
    ${criticalPoint ? `<circle class="pz-critical" cx="${x(-1)}" cy="${y(0)}" r="4"/><text class="pz-axis-label" x="${Number(x(-1)) - 14}" y="${centre - 8}">−1</text>` : ''}
    ${group(zeros).map((zero) => `<circle class="pz-zero" cx="${x(zero.re)}" cy="${y(zero.im)}" r="5"/>${multiplicity(zero)}`).join('')}
    ${group(poles).map((pole) => `<path class="pz-pole" d="M${Number(x(pole.re)) - 5} ${Number(y(pole.im)) - 5}l10 10m0 -10l-10 10"/>${multiplicity(pole)}`).join('')}
    ${marks.map((mark) => `<rect class="pz-mark" x="${Number(x(mark.re)) - 3.5}" y="${Number(y(mark.im)) - 3.5}" width="7" height="7"/>`).join('')}</svg>`;
}

const planeExtent = (points, minimum = 1) => { const values = points.flatMap((point) => [Math.abs(point.re), Math.abs(point.im)]).filter(Number.isFinite); return Math.max(minimum, ...values) * 1.25; };

function designFromConfig(config) {
  const band = config.filterType === 'bandpass' || config.filterType === 'bandstop';
  const cutoff = band ? [Number(config.cutoff), Number(config.cutoffHigh)] : Number(config.cutoff);
  const common = { type: config.filterType, cutoff, sampleRate: Number(config.sampleRate) };
  return config.method === 'fir'
    ? designFir({ ...common, taps: Number(config.taps), window: config.window, beta: Number(config.beta) })
    : designIir({ ...common, family: config.method, order: Number(config.order), rippleDb: Number(config.rippleDb) });
}

function renderFilterTab(config) {
  const band = config.filterType === 'bandpass' || config.filterType === 'bandstop';
  const fir = config.method === 'fir';
  const controls = `<div class="dsp-controls">${dspSelect('method', 'Design method', config.method, FILTER_METHODS)}${dspSelect('filterType', 'Response', config.filterType, FILTER_TYPES.map((type) => [type, FILTER_TYPE_LABELS[type]]))}${dspField('sampleRate', 'Sample rate', config.sampleRate, 'Hz')}${dspField('cutoff', band ? 'Lower edge' : 'Cutoff', config.cutoff, 'Hz')}${band ? dspField('cutoffHigh', 'Upper edge', config.cutoffHigh, 'Hz') : ''}
    ${fir ? `${dspField('taps', 'Taps', config.taps, '', 'type="number" min="3" max="513" step="1"')}${dspSelect('window', 'Window', config.window, FIR_WINDOWS.map((name) => [name, name[0].toUpperCase() + name.slice(1)]))}${config.window === 'kaiser' ? dspField('beta', 'Kaiser β', config.beta, '', 'type="number" min="0" max="20" step="0.5"') : ''}` : `${dspField('order', 'Order', config.order, '', 'type="number" min="1" max="12" step="1"')}${config.method === 'chebyshev1' ? dspField('rippleDb', 'Passband ripple', config.rippleDb, 'dB', 'type="number" min="0.01" max="10" step="0.1"') : ''}`}</div>`;
  let design;
  try { design = designFromConfig(config); } catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Filter design</b><span>${esc(error.message)}</span></div></section>`; }
  const fs = design.sampleRate, nyquist = fs / 2;
  const response = frequencyResponseDigital(design.b, design.a, fs, 801);
  const floor = Math.max(-140, Math.min(...response.decibels));
  const xTicks = linearTicks(0, nyquist, 'Hz');
  const magnitude = renderPlotFrame({ title: 'Magnitude response (dB)', series: [{ xs: response.frequency, ys: response.decibels.map((value) => Math.max(value, floor)), color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(floor, Math.max(1, ...response.decibels)), formatY: (value) => `${fmt(value, 0)} dB` });
  const phaseDegrees = response.phase.map((value) => value * 180 / Math.PI);
  const phase = renderPlotFrame({ title: 'Phase response (°, unwrapped)', series: [{ xs: response.frequency, ys: phaseDegrees, color: PLOT_COLORS[1], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(Math.min(...phaseDegrees), Math.max(...phaseDegrees)), formatY: (value) => `${fmt(value, 0)}°` });
  const delays = response.groupDelay.filter((value, index) => response.decibels[index] > -40 && Number.isFinite(value));
  const groupDelay = renderPlotFrame({ title: 'Group delay (samples)', series: [{ xs: response.frequency, ys: response.groupDelay.map((value, index) => (response.decibels[index] > -40 ? value : NaN)), color: PLOT_COLORS[2], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(Math.min(0, ...delays), Math.max(1, ...delays)), formatY: (value) => fmt(value, 1) });
  const impulse = impulseResponse(design.b, design.a, fir ? design.taps : 64);
  const indices = impulse.map((_, n) => n);
  const impulsePlot = renderPlotFrame({ title: 'Impulse response h[n]', series: [{ xs: indices, ys: impulse, color: PLOT_COLORS[4], stem: true }], xMin: 0, xMax: impulse.length - 1, xTicks: indexTicks(0, impulse.length - 1), yRange: niceRange(Math.min(0, ...impulse), Math.max(0, ...impulse)), formatY: (value) => fmt(value, 3) });
  let pz = null;
  if (!fir || design.taps <= 129) pz = poleZero(design);
  const pzPlot = pz ? renderComplexPlane({ label: 'Pole-zero plot in the z-plane', extent: planeExtent([...pz.poles, ...pz.zeros, { re: 1, im: 1 }]), unitCircle: true, poles: pz.poles, zeros: pz.zeros }) : '<p class="module-footnote">Pole-zero plot is shown for FIR filters up to 129 taps.</p>';
  // Demonstration: two tones through the filter.
  const tones = [Number(config.toneLow), Number(config.toneHigh)];
  const demoLength = 400;
  const input = Array.from({ length: demoLength }, (_, n) => tones.reduce((sum, tone) => sum + Math.sin(2 * Math.PI * tone * n / fs), 0));
  const output = lfilter(design.b, design.a, input);
  const times = input.map((_, n) => n / fs);
  const demoValues = [...input, ...output];
  const demo = renderPlotFrame({ title: 'Two-tone input (blue) and filtered output (teal)', series: [{ xs: times, ys: output, color: PLOT_COLORS[0], primary: true }, { xs: times, ys: input, color: PLOT_COLORS[1] }], xMin: 0, xMax: times.at(-1), xTicks: linearTicks(0, times.at(-1), 's'), yRange: niceRange(Math.min(...demoValues), Math.max(...demoValues)), formatY: (value) => fmt(value, 1) });
  const gainAt = (frequency) => { const zInverse = cexp(complex(0, -2 * Math.PI * frequency / fs)); return 20 * Math.log10(Math.max(1e-12, cabs(cdiv(polyval([...design.b].reverse(), zInverse), polyval([...design.a].reverse(), zInverse))))); };
  const edgeGains = design.cutoff.map((frequency) => `${eng(frequency, 'Hz')}: ${decibels(gainAt(frequency))}`).join(' · ');
  const coefficientText = `b = [${design.b.map((value) => Number(value.toPrecision(10))).join(', ')}]\na = [${design.a.map((value) => Number(value.toPrecision(10))).join(', ')}]`;
  return `<section class="dsp-card">${controls}
    <div class="analysis-readouts comm-readouts">${readout('Filter', `${FILTER_TYPE_LABELS[design.type]} ${fir ? `FIR, ${design.taps} taps, ${design.window}` : `${design.family === 'butterworth' ? 'Butterworth' : 'Chebyshev I'}, order ${design.order}`}`)}${readout('Stability', fir || design.stable ? 'stable (all poles inside |z| = 1)' : 'UNSTABLE')}${readout('Gain at band edge', edgeGains)}${readout(fir ? 'Delay (linear phase)' : 'Phase', fir ? `${fmt(design.delay, 1)} samples = ${eng(design.delay / fs, 's')}` : 'non-linear (IIR)')}${readout('Coefficients', `${design.b.length} b, ${design.a.length} a`)}</div>
    <div class="analysis-plots comm-plots">${magnitude}${phase}${groupDelay}${impulsePlot}</div>
    <div class="filter-lower"><div><span class="panel-label">POLE-ZERO PLOT (z-plane)</span>${pzPlot}</div>
    <div class="comm-side"><span class="panel-label">FILTERING DEMO</span><div class="dsp-controls">${dspField('toneLow', 'Tone 1', config.toneLow, 'Hz')}${dspField('toneHigh', 'Tone 2', config.toneHigh, 'Hz')}</div>
    <div class="analysis-readouts comm-readouts">${tones.map((tone) => readout(`Gain at ${eng(tone, 'Hz')}`, decibels(gainAt(tone)))).join('')}</div>${demo}
    <span class="panel-label">COEFFICIENTS (scipy.signal / MATLAB order)</span><pre class="crc-steps">${esc(coefficientText)}</pre></div></div>
    <p class="module-footnote">IIR filters use analog prototypes with the prewarped bilinear transform, the same method as scipy.signal.butter / cheby1. FIR filters use the windowed-sinc method of scipy.signal.firwin.</p></section>`;
}

function parseSequence(text, label) {
  const values = String(text).trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new SyntaxError(`${label} must be a list of numbers separated by spaces or commas.`);
  return values;
}

function renderConvolutionTab(config) {
  const controls = `<div class="dsp-controls">${dspField('convX', 'Input x[n]', config.convX, '', 'type="text" spellcheck="false"')}${dspField('convH', 'Impulse response h[n]', config.convH, '', 'type="text" spellcheck="false"')}</div>`;
  let x, h, steps;
  try { x = parseSequence(config.convX, 'x[n]'); h = parseSequence(config.convH, 'h[n]'); steps = convolutionSteps(x, h); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Convolution</b><span>${esc(error.message)}</span></div></section>`; }
  const y = steps.map((step) => step.value);
  const selected = Math.min(steps.length - 1, Math.max(0, Math.trunc(Number(config.convN) || 0)));
  const last = steps.length - 1;
  const all = [...x, ...h, ...y];
  const yRange = niceRange(Math.min(0, ...all), Math.max(0, ...all));
  const stem = (title, values, color) => renderPlotFrame({ title, series: [{ xs: values.map((_, n) => n), ys: values, color, stem: true }], xMin: 0, xMax: last, xTicks: indexTicks(0, last), yRange, formatY: (value) => fmt(value, 2) });
  const shifted = Array.from({ length: steps.length }, (_, k) => { const index = selected - k; return index >= 0 && index < h.length ? h[index] : NaN; });
  const step = steps[selected];
  const rows = step.terms.map((term) => `<tr><td>${term.k}</td><td>${fmt(term.x, 4)}</td><td>${fmt(term.h, 4)}</td><td>${fmt(term.product, 4)}</td></tr>`).join('');
  const formula = `y[${selected}] = ${step.terms.map((term) => `x[${term.k}]·h[${selected - term.k}]`).join(' + ')} = ${step.terms.map((term) => `${fmt(term.x, 3)}×${fmt(term.h, 3)}`).join(' + ')} = ${fmt(step.value, 4)}`;
  return `<section class="dsp-card">${controls}
    <div class="analysis-plots comm-plots">${stem('Input x[n]', x, PLOT_COLORS[1])}${stem('Impulse response h[n]', h, PLOT_COLORS[4])}${stem(`Flipped and shifted h[${selected} − k]`, shifted, PLOT_COLORS[2])}${stem('Output y[n] = x[n] * h[n]', y, PLOT_COLORS[0])}</div>
    <span class="panel-label">STEP THROUGH THE SUM — choose n</span><div class="bit-row conv-steps">${steps.map((entry) => `<button class="bit${entry.n === selected ? ' flipped' : ''}" data-dsp-conv-n="${entry.n}">${entry.n}</button>`).join('')}</div>
    <div class="conv-detail"><table class="truth-table comm-table"><thead><tr><th>k</th><th>x[k]</th><th>h[n−k]</th><th>product</th></tr></thead><tbody>${rows}</tbody></table><div><pre class="crc-steps">${esc(formula)}</pre><div class="analysis-readouts comm-readouts">${readout('Output length', `${x.length} + ${h.length} − 1 = ${y.length}`)}${readout('y[n]', y.map((value) => fmt(value, 3)).join(', '))}</div></div></div>
    <p class="module-footnote">Linear convolution y[n] = Σ x[k]·h[n−k]. The same sum describes any LTI system: the output is the input weighted by the shifted impulse response.</p></section>`;
}

function renderFftTab(state) {
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
  return `<section class="dsp-card"><div class="dsp-controls"><label>Frequency<input type="number" min="0.1" step="0.1" data-dsp-field="frequency" value="${esc(config.frequency ?? 1000)}"><span>Hz</span></label><label>Sample rate<input type="number" min="10" step="10" data-dsp-field="sampleRate" value="${esc(config.sampleRate ?? 48000)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-dsp-field="length" value="${esc(config.length ?? 256)}"></label><label>FIR taps<input type="number" min="1" max="64" step="1" data-dsp-field="taps" value="${esc(config.taps ?? 1)}"></label><label>Window<select data-dsp-field="window"><option value="rectangular" ${config.window === 'rectangular' ? 'selected' : ''}>Rectangular</option><option value="hann" ${!config.window || config.window === 'hann' ? 'selected' : ''}>Hann</option><option value="hamming" ${config.window === 'hamming' ? 'selected' : ''}>Hamming</option></select></label><button class="button run" data-action="run-dsp">Generate + FFT</button><button class="button ghost" data-action="export-dsp">Export samples</button><button class="button ghost" data-action="export-spectrum">Export spectrum</button></div>
    <div class="dsp-plot"><span class="panel-label">TIME SERIES</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div><div class="dsp-plot"><span class="panel-label">FFT MAGNITUDE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace spectrum-trace" d="${spectrumPath}"/></svg></div>
    <div class="stat-grid"><div><span>Samples</span><strong>${signal?.data.length || '—'}</strong><small>bounded local array</small></div><div><span>Sample rate</span><strong>${signal ? fmt(signal.sampleRate) : '—'}</strong><small>Hz</small></div><div><span>FFT peak</span><strong>${peak === null ? '—' : fmt(peak, 3)}</strong><small>magnitude</small></div></div>
    <p class="module-footnote">This built-in experiment uses deterministic local math. It does not execute imported Python or claim SciPy/NumPy availability.</p></section>`;
}

function renderDsp(state) {
  const config = dspConfiguration(state);
  const body = config.tab === 'filter' ? renderFilterTab(config) : config.tab === 'convolution' ? renderConvolutionTab(config) : renderFftTab(state);
  return `<div class="page scroll-page dsp-page">${pageHeader(modules.find((item) => item.id === 'dsp'), 'BUILT-IN NUMERICAL LAB', '<span class="pill live"><i></i> LOCAL COMPUTATION</span>')}
    ${labTabs(DSP_TABS, config.tab, 'data-dsp-tab')}${body}</div>`;
}

function renderQpskLink(state) {
  const result = state.simulation?.kind === 'communication' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'qpsk-ber')?.inputs || {};
  const points = result?.channel?.symbols || [];
  const plot = points.map((point) => `<circle cx="${150 + point.i * 100}" cy="${150 - point.q * 100}" r="4"/>`).join('');
  return `<section class="dsp-card"><div class="dsp-controls"><label>Bits<input data-comm-field="bits" value="${esc(config.bits ?? '00110110')}" maxlength="256" aria-label="Bit sequence"></label><label>Noise σ<input type="number" min="0" max="2" step="0.01" data-comm-field="sigma" value="${esc(config.sigma ?? 0.15)}"></label><button class="button run" data-action="run-communication">Run QPSK + BER</button></div>
    <div class="constellation"><span class="panel-label">CONSTELLATION</span><svg viewBox="0 0 300 300"><path d="M150 10V290M10 150H290"/>${plot}</svg></div>
    <div class="stat-grid"><div><span>Symbols</span><strong>${result?.channel?.symbols.length || '—'}</strong><small>QPSK</small></div><div><span>Errors</span><strong>${result?.ber?.errors ?? '—'}</strong><small>bit errors</small></div><div><span>BER</span><strong>${result ? fmt(result.ber.rate, 4) : '—'}</strong><small>measured</small></div></div>
    <p class="module-footnote">Seeded offline channel model. No GNU Radio flowgraph or SDR hardware is accessed.</p></section>`;
}

const COMM_DEFAULTS = Object.freeze({
  tab: 'link', scheme: 'am', carrierFrequency: 10000, messageFrequency: 1000, index: 0.5, deviation: 2405,
  digitalScheme: 'qpsk', ebN0dB: 6, bits: 20000, eyeAlpha: 0.35, eyePulse: 'raised-cosine', eyeEbN0dB: 20,
  signalFrequency: 1000, sampleRate: 8000, quantBits: 4, law: 'uniform', amplitude: 1, lineBits: '1011000110',
  hammingData: '1011', hammingFlips: [], crcMessage: '11010011101100', crcPolynomial: '1011', convData: '1011', convFlips: [],
});
const COMM_TABS = [['link', 'QPSK link'], ['analog', 'Analog modulation'], ['digital', 'Digital modulation & BER'], ['pcm', 'Sampling, PCM & line codes'], ['coding', 'Error-control coding']];
let analogCache = { key: null, value: null };

function commConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'comm-lab')?.inputs || {};
  return { ...COMM_DEFAULTS, ...saved };
}

function persistComm(patch) {
  recordExperiment({ id: 'comm-lab', kind: 'communication', operation: 'comm-lab', inputs: { ...commConfiguration(getState()), ...patch } });
}

const commField = (name, label, value, unit = '', attributes = 'type="number" step="any"') => `<label>${label}<input ${attributes} data-comm-lab-field="${name}" value="${esc(value)}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const commSelect = (name, label, value, options) => `<label>${label}<select data-comm-lab-field="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
const linearTicks = (min, max, unit) => Array.from({ length: 6 }, (_, index) => ({ position: index / 5, text: eng(min + (max - min) * index / 5, unit) }));

function commPlot(title, xs, seriesList, unitX, formatY) {
  const values = seriesList.flatMap((series) => series.ys);
  const xMin = xs[0], xMax = xs.at(-1);
  return renderPlotFrame({ title, series: seriesList.map((series, index) => ({ xs, ys: series.ys, color: series.color || PLOT_COLORS[index], primary: index === 0 })), xMin, xMax, xTicks: linearTicks(xMin, xMax, unitX), yRange: niceRange(Math.min(...values), Math.max(...values)), formatY });
}

function renderAnalogTab(config) {
  const key = JSON.stringify([config.scheme, config.carrierFrequency, config.messageFrequency, config.index, config.deviation]);
  if (analogCache.key !== key) { try { analogCache = { key, value: simulateAnalogModulation({ scheme: config.scheme, carrierFrequency: Number(config.carrierFrequency), messageFrequency: Number(config.messageFrequency), index: Number(config.index), deviation: Number(config.deviation) }) }; } catch (error) { analogCache = { key, value: { error: error.message } }; } }
  const result = analogCache.value;
  const controls = `<div class="dsp-controls">${commSelect('scheme', 'Scheme', config.scheme, [['am', 'AM (DSB with carrier)'], ['dsb-sc', 'DSB-SC'], ['fm', 'FM'], ['pm', 'PM']])}${commField('carrierFrequency', 'Carrier fc', config.carrierFrequency, 'Hz')}${commField('messageFrequency', 'Message fm', config.messageFrequency, 'Hz')}${config.scheme === 'fm' ? commField('deviation', 'Peak deviation Δf', config.deviation, 'Hz') : config.scheme === 'dsb-sc' ? '' : commField('index', config.scheme === 'pm' ? 'Phase deviation kp' : 'Modulation index μ', config.index, config.scheme === 'pm' ? 'rad' : '')}</div>`;
  if (result.error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(result.error)}</span></div></section>`;
  const time = commPlot('Modulated signal and message', result.time, [{ ys: result.modulated }, { ys: result.message, color: PLOT_COLORS[1] }], 's', (value) => fmt(value, 2));
  const demodUnit = config.scheme === 'fm' ? 'Hz' : config.scheme === 'pm' ? 'rad' : 'V';
  const demod = commPlot(`Demodulated output (${config.scheme === 'am' ? 'envelope detector' : config.scheme === 'dsb-sc' ? 'coherent detector' : config.scheme === 'fm' ? 'frequency discriminator' : 'phase detector'})`, result.time, [{ ys: result.demodulated, color: PLOT_COLORS[2] }], 's', (value) => eng(value, demodUnit));
  const span = config.scheme === 'fm' || config.scheme === 'pm' ? result.metrics.carsonBandwidth * 1.3 : 6 * result.messageFrequency;
  const low = Math.max(0, result.carrierFrequency - span / 2), high = result.carrierFrequency + span / 2;
  const indices = result.spectrum.frequency.map((frequency, index) => frequency >= low && frequency <= high ? index : -1).filter((index) => index >= 0);
  const spectrum = commPlot('Spectrum (amplitude)', indices.map((index) => result.spectrum.frequency[index] / 1e3), [{ ys: indices.map((index) => result.spectrum.amplitude[index]), color: PLOT_COLORS[3] }], 'kHz', (value) => fmt(value, 3));
  const metrics = result.metrics;
  const readouts = config.scheme === 'fm' || config.scheme === 'pm'
    ? `${readout('Modulation index β', fmt(metrics.beta, 3))}${readout('Peak deviation', eng(metrics.peakDeviation, 'Hz'))}${readout('Carson bandwidth', eng(metrics.carsonBandwidth, 'Hz'))}`
    : `${readout('Bandwidth', eng(metrics.bandwidth, 'Hz'))}${readout('Sidebands', metrics.sidebands.map((value) => eng(value, 'Hz')).join(' · '))}${readout('Power efficiency η', `${fmt(metrics.efficiency * 100, 2)} %`)}${config.scheme === 'am' ? readout('Carrier / sideband power', `${fmt(metrics.carrierPower, 3)} / ${fmt(metrics.sidebandPower, 4)} W (1 Ω)`) : ''}`;
  const bessel = metrics.bessel ? `<table class="truth-table comm-table"><thead><tr><th>Line</th><th>Frequency</th><th>|J<sub>n</sub>(β)|</th></tr></thead><tbody>${metrics.bessel.map((line) => `<tr><td>${line.order ? `fc ± ${line.order}·fm` : 'carrier'}</td><td>${esc(eng(line.frequency, 'Hz'))}</td><td>${fmt(line.amplitude, 4)}</td></tr>`).join('')}</tbody></table>` : '';
  return `<section class="dsp-card">${controls}${result.warnings.map((warning) => `<div class="diagnostic warning"><b>Warning</b><span>${esc(warning)}</span></div>`).join('')}
    <div class="analysis-readouts comm-readouts">${readouts}</div><div class="analysis-plots comm-plots">${time}${spectrum}${demod}</div>${bessel}
    <p class="module-footnote">Ideal receivers built on the analytic signal; the spectrum uses a flat-top window so line amplitudes read directly.</p></section>`;
}

function renderConstellation(result) {
  const scale = 110, size = 300, centre = size / 2;
  const limit = Math.max(1.2, ...result.reference.map((point) => Math.max(Math.abs(point.i), Math.abs(point.q)) * 1.25));
  const position = (value) => centre + value / limit * scale;
  const received = result.received.map((point) => `<circle class="${point.error ? 'symbol-error' : 'symbol-ok'}" cx="${position(point.i).toFixed(1)}" cy="${(size - position(point.q)).toFixed(1)}" r="1.6"/>`).join('');
  const reference = result.reference.map((point) => `<circle class="symbol-reference" cx="${position(point.i).toFixed(1)}" cy="${(size - position(point.q)).toFixed(1)}" r="4"/><text class="symbol-label" x="${(position(point.i) + 6).toFixed(1)}" y="${(size - position(point.q) - 6).toFixed(1)}">${point.bits}</text>`).join('');
  return `<svg class="constellation-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="Received constellation"><path class="axis" d="M${centre} 8V${size - 8}M8 ${centre}H${size - 8}"/>${received}${reference}</svg>`;
}

function renderBerCurve(curve) {
  if (!curve) return '<p class="field-help">Press “Plot BER curve” to sweep Eb/N0 from 0 to 12 dB (100,000 bits per point).</p>';
  const width = 600, height = 220, left = 56, bottom = 24;
  const floor = -6;
  const x = (snr) => left + (snr - curve.points[0].ebN0dB) / (curve.points.at(-1).ebN0dB - curve.points[0].ebN0dB) * (width - left - 10);
  const y = (ber) => 8 + (Math.min(0, Math.max(floor, Math.log10(ber))) / floor) * (height - bottom - 8);
  const theoryPath = curve.points.map((point, index) => `${index ? 'L' : 'M'}${x(point.ebN0dB).toFixed(1)} ${y(point.theory).toFixed(1)}`).join('');
  const simulated = curve.points.filter((point) => point.simulated).map((point) => `<circle class="ber-point" cx="${x(point.ebN0dB).toFixed(1)}" cy="${y(point.simulated).toFixed(1)}" r="3.5"><title>${point.ebN0dB} dB: ${point.simulated.toExponential(2)} (${point.errors} errors)</title></circle>`).join('');
  const grid = Array.from({ length: -floor + 1 }, (_, k) => `<line class="ber-grid" x1="${left}" x2="${width - 10}" y1="${y(10 ** -k)}" y2="${y(10 ** -k)}"/><text class="ber-axis" x="${left - 6}" y="${y(10 ** -k) + 3}" text-anchor="end">${k ? `1e-${k}` : '1'}</text>`).join('');
  const xTicks = curve.points.map((point) => `<text class="ber-axis" x="${x(point.ebN0dB)}" y="${height - 6}" text-anchor="middle">${point.ebN0dB}</text>`).join('');
  return `<svg class="ber-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="BER versus Eb/N0">${grid}${xTicks}<path class="ber-theory" d="${theoryPath}"/>${simulated}<text class="ber-axis" x="${width - 12}" y="18" text-anchor="end">x: Eb/N0 (dB) · y: BER</text></svg><div class="plot-legend"><span class="legend-chip" style="--chip:#60a5fa">theory</span><span class="legend-chip" style="--chip:#f59e0b">simulated</span></div>`;
}

function renderEye(eye) {
  const width = 600, height = 200, samples = eye.traces[0].length;
  const extent = Math.max(1.6, ...eye.traces.flat().map(Math.abs));
  const x = (index) => 10 + index / (samples - 1) * (width - 20);
  const y = (value) => height / 2 - value / extent * (height / 2 - 10);
  const paths = eye.traces.map((trace) => `<path d="${trace.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join('')}"/>`).join('');
  return `<svg class="eye-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Eye diagram"><line class="ber-grid" x1="${x((samples - 1) / 2)}" x2="${x((samples - 1) / 2)}" y1="4" y2="${height - 4}"/><g class="eye-traces">${paths}</g></svg>`;
}

function renderDigitalTab(config, state) {
  let result, eye, error = '';
  try {
    result = simulateDigitalLink({ scheme: config.digitalScheme, ebN0dB: Number(config.ebN0dB), bits: Number(config.bits), seed: 11 });
    eye = eyeDiagram({ alpha: Number(config.eyeAlpha), pulse: config.eyePulse, ebN0dB: Number(config.eyeEbN0dB) });
  } catch (caught) { error = caught.message; }
  const controls = `<div class="dsp-controls">${commSelect('digitalScheme', 'Scheme', config.digitalScheme, Object.keys(DIGITAL_SCHEMES).map((key) => [key, { bpsk: 'BPSK', qpsk: 'QPSK', '8psk': '8-PSK', '16qam': '16-QAM' }[key]]))}${commField('ebN0dB', 'Eb/N0', config.ebN0dB, 'dB')}${commField('bits', 'Bits', config.bits, '', 'type="number" min="100" max="400000" step="100"')}<button class="button ghost" data-action="comm-ber-curve">Plot BER curve</button></div>`;
  if (error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(error)}</span></div></section>`;
  const curve = state.commBerCurve?.scheme === config.digitalScheme ? state.commBerCurve : null;
  return `<section class="dsp-card">${controls}
    <div class="comm-digital-layout"><div><span class="panel-label">RECEIVED CONSTELLATION (errors in red)</span>${renderConstellation(result)}</div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Measured BER', result.bitErrors ? result.ber.toExponential(3) : `0 (< ${(1 / result.bits).toExponential(1)})`)}${readout('Theoretical BER', result.theory.toExponential(3))}${readout('Bit errors', `${result.bitErrors} / ${result.bits.toLocaleString()}`)}${readout('Symbol error rate', result.ser.toExponential(3))}${readout('Noise σ per axis', fmt(result.sigma, 4))}</div>
    <span class="panel-label">BER VS EB/N0</span>${renderBerCurve(curve)}</div></div>
    <span class="panel-label">EYE DIAGRAM (POLAR BASEBAND)</span><div class="dsp-controls">${commSelect('eyePulse', 'Pulse', config.eyePulse, [['raised-cosine', 'Raised cosine'], ['rectangular', 'Rectangular']])}${config.eyePulse === 'raised-cosine' ? commField('eyeAlpha', 'Roll-off α', config.eyeAlpha, '', 'type="number" min="0" max="1" step="0.05"') : ''}${commField('eyeEbN0dB', 'Eb/N0', config.eyeEbN0dB, 'dB')}<div class="result-value"><span>Eye opening</span><b>${fmt(eye.opening * 100, 1)} %</b></div></div>${renderEye(eye)}</section>`;
}

function renderLineCodes(bits) {
  const codes = Object.keys(LINE_CODES).map((code) => lineCode(bits, code));
  const left = 150, width = 600, row = 46, height = codes.length * row + 30;
  const x = (position) => left + position / bits.length * width;
  const rows = codes.map((result, index) => {
    const mid = 22 + index * row, y = (level) => mid - level * 14;
    const path = result.segments.map((segment, k) => `${k ? `V${y(segment.level)}` : `M${x(segment.start)} ${y(segment.level)}`}H${x(segment.end)}`).join('');
    return `<text class="timing-name" x="${left - 10}" y="${mid + 4}">${esc(result.name)}</text><line class="timing-row" x1="${left}" x2="${left + width}" y1="${mid}" y2="${mid}"/><path class="timing-wave" d="${path}"/><text class="timing-time" x="${left + width + 30}" y="${mid + 4}">DC ${fmt(result.dcLevel, 2)}</text>`;
  }).join('');
  const bitLabels = [...bits].map((bit, index) => `<line class="timing-tick" x1="${x(index)}" x2="${x(index)}" y1="4" y2="${height - 20}"/><text class="timing-time" x="${x(index + 0.5)}" y="${height - 6}">${bit}</text>`).join('');
  return `<svg class="timing-diagram" viewBox="0 0 ${left + width + 70} ${height}" role="img" aria-label="Line code waveforms">${bitLabels}${rows}</svg>`;
}

function renderPcmTab(config) {
  let result, codes = '', error = '';
  try {
    result = samplingDemo({ signalFrequency: Number(config.signalFrequency), sampleRate: Number(config.sampleRate), bits: Number(config.quantBits), law: config.law, amplitude: Number(config.amplitude) });
    codes = renderLineCodes(String(config.lineBits));
  } catch (caught) { error = caught.message; }
  const controls = `<div class="dsp-controls">${commField('signalFrequency', 'Signal f', config.signalFrequency, 'Hz')}${commField('sampleRate', 'Sample rate fs', config.sampleRate, 'Hz')}${commField('quantBits', 'Bits n', config.quantBits, '', 'type="number" min="1" max="16" step="1"')}${commSelect('law', 'Quantizer', config.law, [['uniform', 'Uniform'], ['mu-law', 'μ-law (μ = 255)']])}${commField('amplitude', 'Amplitude', config.amplitude, '× full scale', 'type="number" min="0.001" max="1" step="0.01"')}</div>`;
  if (error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(error)}</span></div></section>`;
  const width = 600, height = 200;
  const duration = result.analog.at(-1).t;
  const x = (t) => 10 + t / duration * (width - 20), y = (value) => height / 2 - value * (height / 2 - 12);
  const analog = result.analog.map((point, index) => `${index ? 'L' : 'M'}${x(point.t).toFixed(1)} ${y(point.value).toFixed(1)}`).join('');
  const stairs = result.samples.map((point, index) => `${index ? `V${y(point.quantized).toFixed(1)}` : `M${x(point.t).toFixed(1)} ${y(point.quantized).toFixed(1)}`}H${x(Math.min(duration, result.samples[index + 1]?.t ?? duration)).toFixed(1)}`).join('');
  const stems = result.samples.length <= 200 ? result.samples.map((point) => `<line class="pcm-stem" x1="${x(point.t).toFixed(1)}" x2="${x(point.t).toFixed(1)}" y1="${y(0)}" y2="${y(point.value).toFixed(1)}"/><circle class="pcm-sample" cx="${x(point.t).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="2.6"/>`).join('') : '';
  const plot = `<svg class="pcm-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sampling and quantization"><line class="ber-grid" x1="10" x2="${width - 10}" y1="${y(0)}" y2="${y(0)}"/><path class="pcm-analog" d="${analog}"/><path class="pcm-stairs" d="${stairs}"/>${stems}</svg><div class="plot-legend"><span class="legend-chip" style="--chip:#5eead4">analog signal</span><span class="legend-chip" style="--chip:#f59e0b">samples</span><span class="legend-chip" style="--chip:#a78bfa">quantized (zero-order hold)</span></div>`;
  return `<section class="dsp-card">${controls}${result.aliased ? `<div class="diagnostic warning"><b>Aliasing</b><span>fs = ${esc(eng(result.sampleRate, 'Hz'))} is below the Nyquist rate ${esc(eng(result.nyquistRate, 'Hz'))}: the samples look like a ${esc(eng(result.apparentFrequency, 'Hz'))} tone.</span></div>` : ''}
    <div class="analysis-readouts comm-readouts">${readout('Nyquist rate 2f', eng(result.nyquistRate, 'Hz'))}${readout('Apparent frequency', eng(result.apparentFrequency, 'Hz'))}${readout('PCM bit rate n·fs', eng(result.bitRate, 'bit/s'))}${readout('Measured SQNR', `${fmt(result.sqnr, 2)} dB`)}${readout(result.law === 'uniform' ? 'Theory 6.02n + 1.76 + 20log(A)' : 'Uniform-law theory (reference)', `${fmt(result.sqnrTheory, 2)} dB`)}</div>${plot}
    <span class="panel-label">LINE CODES</span><div class="dsp-controls">${commField('lineBits', 'Bits', config.lineBits, '', 'type="text" maxlength="64" spellcheck="false"')}</div>${codes}</section>`;
}

function renderBits(text, flips, kind, highlight = []) {
  return `<div class="bit-row">${[...text].map((bit, index) => `<button class="bit${flips.includes(index) ? ' flipped' : ''}${highlight.includes(index) ? ' parity' : ''}" data-comm-flip="${kind}:${index}" aria-label="Bit ${index + 1} is ${bit}${flips.includes(index) ? ', flipped by the channel' : ''}; click to flip">${bit}</button>`).join('')}</div>`;
}

function renderCodingTab(config) {
  const blocks = [];
  try {
    const encoded = hammingEncode(String(config.hammingData));
    const received = [...encoded.codeword].map((bit, index) => config.hammingFlips.includes(index) ? (bit === '1' ? '0' : '1') : bit).join('');
    const decoded = hammingDecode(received);
    blocks.push(`<div class="coding-block"><span class="panel-label">HAMMING (${encoded.n}, ${encoded.k}) — SINGLE-ERROR CORRECTION</span><div class="dsp-controls">${commField('hammingData', 'Data bits', config.hammingData, '', 'type="text" maxlength="26" spellcheck="false"')}</div>
      <div class="coding-line"><span>Codeword (parity at ${encoded.parityPositions.join(', ')})</span>${renderBits(encoded.codeword, [], 'none', encoded.parityPositions.map((position) => position - 1))}</div>
      <div class="coding-line"><span>Received — click bits to inject errors</span>${renderBits(received, config.hammingFlips, 'hamming')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Syndrome', `${decoded.syndrome} (${decoded.syndrome.toString(2).padStart(encoded.parityPositions.length, '0')})`)}${readout('Error position', decoded.errorPosition ?? 'none')}${readout('Decoded data', decoded.data)}${readout('Result', decoded.data === String(config.hammingData) ? 'correct' : 'wrong (more than one error)')}</div></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>Hamming</b><span>${esc(error.message)}</span></div>`); }
  try {
    const crc = crcDivide(String(config.crcMessage), String(config.crcPolynomial));
    const named = Object.entries(CRC_POLYNOMIALS);
    blocks.push(`<div class="coding-block"><span class="panel-label">CYCLIC REDUNDANCY CHECK</span><div class="dsp-controls">${commField('crcMessage', 'Message bits', config.crcMessage, '', 'type="text" maxlength="256" spellcheck="false"')}${commField('crcPolynomial', 'Generator (bits)', config.crcPolynomial, '', 'type="text" maxlength="33" spellcheck="false"')}<label>Standard<select data-comm-crc-preset><option value="">Choose…</option>${named.map(([name, bits]) => `<option value="${bits}">${esc(name)}</option>`).join('')}</select></label></div>
      <div class="analysis-readouts comm-readouts">${readout('Remainder (CRC)', crc.remainder)}${readout('Transmitted frame', crc.frame)}${readout('Receiver check', crcCheck(crc.frame, String(config.crcPolynomial)).valid ? 'remainder 0 — valid' : 'invalid')}</div>
      <pre class="crc-steps">${esc([`${config.crcMessage}${'0'.repeat(crc.degree)}   ← message + ${crc.degree} zeros`, ...crc.steps.map((step) => `${step.value}   XOR ${config.crcPolynomial} at bit ${step.shift}`)].join('\n'))}</pre></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>CRC</b><span>${esc(error.message)}</span></div>`); }
  try {
    const encoded = convolutionalEncode(String(config.convData));
    const received = [...encoded.encoded].map((bit, index) => config.convFlips.includes(index) ? (bit === '1' ? '0' : '1') : bit).join('');
    const decoded = viterbiDecode(received);
    blocks.push(`<div class="coding-block"><span class="panel-label">CONVOLUTIONAL CODE (RATE 1/2, K = 3, GENERATORS 7, 5) + VITERBI</span><div class="dsp-controls">${commField('convData', 'Data bits', config.convData, '', 'type="text" maxlength="32" spellcheck="false"')}</div>
      <div class="coding-line"><span>Encoded (with 2 tail bits)</span>${renderBits(encoded.encoded, [], 'none')}</div>
      <div class="coding-line"><span>Received — click bits to inject errors</span>${renderBits(received, config.convFlips, 'conv')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Viterbi output', decoded.decoded)}${readout('Path metric (bit differences)', decoded.pathMetric)}${readout('Result', decoded.decoded === String(config.convData) ? 'correct' : 'decoding error')}</div></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>Convolutional code</b><span>${esc(error.message)}</span></div>`); }
  return `<section class="dsp-card coding-card">${blocks.join('')}</section>`;
}

function renderCommunication(state) {
  const config = commConfiguration(state);
  const body = config.tab === 'analog' ? renderAnalogTab(config) : config.tab === 'digital' ? renderDigitalTab(config, state) : config.tab === 'pcm' ? renderPcmTab(config) : config.tab === 'coding' ? renderCodingTab(config) : renderQpskLink(state);
  return `<div class="page scroll-page communication-page">${pageHeader(modules.find((item) => item.id === 'communication'), 'BUILT-IN COMMUNICATION LAB', '<span class="pill live"><i></i> OFFLINE EXPERIMENT</span>')}
    <div class="logic-tabs" role="tablist">${COMM_TABS.map(([id, label]) => `<button role="tab" aria-selected="${config.tab === id}" class="${config.tab === id ? 'active' : ''}" data-comm-tab="${id}">${label}</button>`).join('')}</div>${body}</div>`;
}

const RF_DEFAULTS = Object.freeze({
  tab: 'touchstone', loadRe: 100, loadIm: 50, z0: 50, frequency: '100M', lineLength: 0.3, lineLoss: 0, velocityFactor: 0.66,
  msHeight: 1.6, msEr: 4.4, msZ0: 50, msWidth: 3, coaxInner: 0.9, coaxOuter: 2.95, coaxEr: 2.25, twinSpacing: 10, twinDiameter: 1,
  elements: 8, spacing: 0.5, steer: 90, element: 'isotropic',
  linkFrequency: '2.4G', linkDistance: '1k', txPower: 20, txGain: 2, rxGain: 2, txLoss: 1, rxLoss: 1, otherLoss: 0, linkBandwidth: '1M', noiseFigure: 6, requiredSnr: 10,
});
const RF_TABS = [['touchstone', 'Touchstone S-parameters'], ['smith', 'Smith chart & matching'], ['line', 'Transmission lines'], ['antenna', 'Antenna arrays'], ['link', 'Link budget']];
const RF_TEXT_FIELDS = ['frequency', 'element', 'linkFrequency', 'linkDistance', 'linkBandwidth'];

function rfConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'rf-lab')?.inputs || {};
  return { ...RF_DEFAULTS, ...saved };
}

function persistRf(patch) {
  recordExperiment({ id: 'rf-lab', kind: 'rf', operation: 'rf-lab', inputs: { ...rfConfiguration(getState()), ...patch } });
}

const rfField = (...args) => labField('data-rf-lab-field', ...args);
const engText = 'type="text" spellcheck="false" maxlength="24"';
const finiteEng = (value, unit = '') => (Number.isFinite(value) ? eng(value, unit) : '∞');
const impedanceText = (z) => `${fmt(z.re, 4)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im), 4)} Ω`;

function engineeringInput(value, label) {
  try { const number = parseEngineeringValue(String(value)); if (!Number.isFinite(number)) throw new Error(); return number; }
  catch { throw new RangeError(`${label}: enter a number such as 100M, 2.4G or 4.7k.`); }
}

/** Smith chart: constant-resistance circles and constant-reactance arcs in the Γ plane. */
function renderSmithChart({ label, points = [], traces = [] }) {
  const size = 320, c = size / 2, radius = 140;
  const px = (re) => (c + re * radius).toFixed(2), py = (im) => (c - im * radius).toFixed(2);
  const resistances = [0.2, 0.5, 1, 2, 5];
  const reactances = [0.2, 0.5, 1, 2, 5];
  const circles = resistances.map((r) => `<circle cx="${px(r / (1 + r))}" cy="${c}" r="${(radius / (1 + r)).toFixed(2)}"/>`).join('');
  const arcs = reactances.flatMap((x) => [x, -x]).map((x) => `<circle cx="${px(1)}" cy="${py(1 / x)}" r="${(radius / Math.abs(x)).toFixed(2)}"/>`).join('');
  const labels = resistances.map((r) => `<text x="${(Number(px((r - 1) / (r + 1))) + 2).toFixed(1)}" y="${c - 3}">${r}</text>`).join('')
    + reactances.flatMap((x) => [x, -x]).map((x) => { const gamma = cdiv(complex(-1, x), complex(1, x)); const scale = 1.06; return `<text x="${(c - 6 + gamma.re * radius * scale).toFixed(1)}" y="${(c + 3 - gamma.im * radius * scale).toFixed(1)}">${x > 0 ? '+' : '−'}j${Math.abs(x)}</text>`; }).join('');
  const traceSvg = traces.map((trace) => `<path class="smith-trace" stroke="${trace.color}" d="${trace.points.map((g, index) => `${index ? 'L' : 'M'}${px(g.re)} ${py(g.im)}`).join('')}"/>`).join('');
  const pointSvg = points.map((point) => `<circle class="smith-point" cx="${px(point.gamma.re)}" cy="${py(point.gamma.im)}" r="${point.radius || 4.5}" fill="${point.color}"/>${point.text ? `<text class="smith-point-label" x="${(Number(px(point.gamma.re)) + 7).toFixed(1)}" y="${(Number(py(point.gamma.im)) - 6).toFixed(1)}">${esc(point.text)}</text>` : ''}`).join('');
  return `<svg class="smith-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><defs><clipPath id="smith-clip"><circle cx="${c}" cy="${c}" r="${radius}"/></clipPath></defs>
    <g class="smith-grid" clip-path="url(#smith-clip)">${circles}${arcs}<line x1="${c - radius}" y1="${c}" x2="${c + radius}" y2="${c}"/></g><circle class="smith-outline" cx="${c}" cy="${c}" r="${radius}"/><g class="smith-labels">${labels}</g>${traceSvg}${pointSvg}</svg>`;
}

function renderTouchstoneTab(state) {
  const result = state.simulation?.kind === 'rf' ? state.simulation.data : null;
  const s11 = result?.points?.map((point) => point.values[0]).filter(Boolean) || [];
  const gammas = s11.map((value) => complex(value.real, value.imaginary));
  const first = s11[0];
  return `<section class="dsp-card"><div class="dsp-controls"><label>Ports<input type="number" min="1" max="8" step="1" data-rf-field="ports" value="2"></label><button class="button run" data-action="parse-rf">Parse Touchstone</button></div><label class="rf-input-label">Touchstone text<textarea data-rf-field="text" rows="8" spellcheck="false" placeholder="# MHz S RI R 50\n1 1 0 0 0 0 0 0 0"></textarea></label>
    <div class="rf-result-grid"><div><span class="panel-label">S11 SMITH VIEW</span>${renderSmithChart({ label: 'S11 Smith chart', traces: gammas.length > 1 ? [{ points: gammas, color: PLOT_COLORS[0] }] : [], points: gammas.map((gamma, index) => ({ gamma, color: index === 0 ? '#f59e0b' : PLOT_COLORS[0], radius: index === 0 ? 4.5 : 2.5 })) })}</div><div><div class="stat-grid"><div><span>Ports</span><strong>${result?.ports ?? '—'}</strong><small>S-parameters</small></div><div><span>Reference</span><strong>${result ? fmt(result.referenceImpedance, 3) : '—'}</strong><small>Ω</small></div><div><span>Points</span><strong>${result?.points.length ?? '—'}</strong><small>${result?.frequencyUnit || 'frequency'}</small></div><div><span>S11 magnitude</span><strong>${first ? fmt(Math.hypot(first.real, first.imaginary), 3) : '—'}</strong><small>linear</small></div><div><span>S11 phase</span><strong>${first ? fmt(Math.atan2(first.imaginary, first.real) * 180 / Math.PI, 2) : '—'}</strong><small>degrees</small></div></div></div></div><p class="module-footnote">Parsed locally with bounded RI/MA/DB conversion. The first point is highlighted; no QucsatorRF, openEMS or network hardware is invoked.</p></section>`;
}

const elementText = (element) => (element.kind === 'none' ? 'none' : `${element.kind} ${eng(element.value, element.unit)}`);
const loadControls = (config) => `${rfField('loadRe', 'Load R', config.loadRe, 'Ω')}${rfField('loadIm', 'Load X', config.loadIm, 'Ω')}${rfField('z0', 'Z0', config.z0, 'Ω')}`;

function renderSmithTab(config) {
  const controls = `<div class="dsp-controls">${loadControls(config)}${rfField('frequency', 'Frequency', config.frequency, 'Hz (e.g. 100M)', engText)}</div>`;
  let body;
  try {
    const load = complex(Number(config.loadRe), Number(config.loadIm));
    const z0 = Number(config.z0);
    const frequency = engineeringInput(config.frequency, 'Frequency');
    const r = reflection(load, z0);
    const admittance = cdiv(complex(1), load);
    let lBlock, stubBlock, quarterBlock;
    try {
      const match = lMatch(load, z0, frequency);
      lBlock = `<table class="truth-table comm-table"><thead><tr><th>#</th><th>Topology (load → source)</th><th>Next to load</th><th>Toward source</th><th>Check Zin</th></tr></thead><tbody>${match.solutions.map((solution, index) => `<tr><td>${index + 1}</td><td>${solution.topology === 'shunt-at-load' ? 'shunt then series' : 'series then shunt'}</td><td>${solution.topology === 'shunt-at-load' ? `shunt ${elementText(solution.shunt)}` : `series ${elementText(solution.series)}`}</td><td>${solution.topology === 'shunt-at-load' ? `series ${elementText(solution.series)}` : `shunt ${elementText(solution.shunt)}`}</td><td>${impedanceText(solution.inputImpedance)}</td></tr>`).join('')}</tbody></table>`;
      stubBlock = `<table class="truth-table comm-table"><thead><tr><th>#</th><th>Stub position d from load</th><th>Open-stub length</th><th>Short-stub length</th></tr></thead><tbody>${singleStubMatch(load, z0).map((stub, index) => `<tr><td>${index + 1}</td><td>${fmt(stub.distance, 4)} λ</td><td>${fmt(stub.openStub, 4)} λ</td><td>${fmt(stub.shortStub, 4)} λ</td></tr>`).join('')}</tbody></table>`;
      const qw = quarterWaveMatch(load, z0);
      quarterBlock = `<div class="analysis-readouts comm-readouts">${readout('Line before transformer', `${fmt(qw.offset, 4)} λ`)}${readout('Impedance there', `${fmt(qw.realImpedance, 4)} Ω`)}${readout('Quarter-wave section Z1', `${fmt(qw.transformerImpedance, 4)} Ω`)}</div>`;
    } catch (error) { lBlock = `<div class="diagnostic warning"><b>Matching</b><span>${esc(error.message)}</span></div>`; stubBlock = ''; quarterBlock = ''; }
    const wavelength = SPEED_OF_LIGHT / frequency;
    body = `<div class="filter-lower"><div><span class="panel-label">SMITH CHART (normalised to Z0)</span>${renderSmithChart({ label: 'Smith chart with load', points: [{ gamma: r.gamma, color: '#f59e0b', text: 'ZL' }], traces: [{ points: Array.from({ length: 121 }, (_, k) => cscale(cexp(complex(0, 2 * Math.PI * k / 120)), r.magnitude)), color: '#94a3b855' }] })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Normalised z', `${fmt(r.normalized.re, 4)} ${r.normalized.im < 0 ? '−' : '+'} j${fmt(Math.abs(r.normalized.im), 4)}`)}${readout('Admittance Y', `${eng(admittance.re, 'S')} ${admittance.im < 0 ? '−' : '+'} j${eng(Math.abs(admittance.im), 'S')}`)}${readout('Γ', `${fmt(r.magnitude, 4)} ∠ ${fmt(r.angle, 2)}°`)}${readout('VSWR', Number.isFinite(r.vswr) ? fmt(r.vswr, 4) : '∞')}${readout('Return loss', Number.isFinite(r.returnLossDb) ? `${fmt(r.returnLossDb, 2)} dB` : '∞')}${readout('Mismatch loss', Number.isFinite(r.mismatchLossDb) ? `${fmt(r.mismatchLossDb, 3)} dB` : '∞')}${readout('Power delivered', `${fmt(r.powerDelivered * 100, 2)} %`)}${readout('Wavelength (free space)', eng(wavelength, 'm'))}</div>
      <span class="panel-label">LUMPED L-NETWORK MATCH AT ${esc(eng(frequency, 'Hz'))}</span>${lBlock}
      <span class="panel-label">SINGLE SHUNT-STUB MATCH</span>${stubBlock}
      <span class="panel-label">QUARTER-WAVE TRANSFORMER</span>${quarterBlock}</div></div>
      <p class="module-footnote">Matching follows Pozar, Microwave Engineering, §5.1–5.4; every L-network solution is checked by computing its input impedance. The faint circle is the constant-VSWR circle.</p>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Smith chart</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}</section>`;
}

function renderLineTab(config) {
  const controls = `<div class="dsp-controls">${loadControls(config)}${rfField('lineLength', 'Length', config.lineLength, 'wavelengths')}${rfField('lineLoss', 'Loss', config.lineLoss, 'dB per λ')}${rfField('frequency', 'Frequency', config.frequency, 'Hz', engText)}${rfField('velocityFactor', 'Velocity factor', config.velocityFactor, '', 'type="number" min="0.05" max="1" step="0.01"')}</div>`;
  let body;
  try {
    const line = transmissionLine({ load: { re: Number(config.loadRe), im: Number(config.loadIm) }, z0: Number(config.z0), length: Number(config.lineLength), lossDbPerWavelength: Number(config.lineLoss) });
    const frequency = engineeringInput(config.frequency, 'Frequency');
    const guided = SPEED_OF_LIGHT * bounded01(config.velocityFactor) / frequency;
    const distances = line.trace.map((point) => point.d);
    const voltages = line.trace.map((point) => point.voltage);
    const standing = renderPlotFrame({ title: '|V| along the line (load at 0 λ)', series: [{ xs: distances, ys: voltages, color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: Math.max(distances.at(-1), 1e-9), xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: `${fmt(distances.at(-1) * k / 5, 3)} λ` })), yRange: niceRange(0, Math.max(...voltages)), formatY: (value) => fmt(value, 2) });
    body = `<div class="filter-lower"><div><span class="panel-label">Γ FROM LOAD (●) TO INPUT (■)</span>${renderSmithChart({ label: 'Line on the Smith chart', traces: [{ points: line.trace.map((point) => point.gamma), color: PLOT_COLORS[0] }], points: [{ gamma: line.reflection.gamma, color: '#f59e0b', text: 'ZL' }, { gamma: line.trace.at(-1).gamma, color: '#fb7185', text: 'Zin' }] })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Input impedance Zin', impedanceText(line.inputImpedance))}${readout('VSWR at the load', Number.isFinite(line.reflection.vswr) ? fmt(line.reflection.vswr, 4) : '∞')}${readout('First voltage maximum', line.firstMaximum === null ? 'flat line (matched)' : `${fmt(line.firstMaximum, 4)} λ from load`)}${readout('First voltage minimum', line.firstMinimum === null ? '—' : `${fmt(line.firstMinimum, 4)} λ from load`)}${readout('Guided wavelength', eng(guided, 'm'))}${readout('Physical length', eng(guided * line.length, 'm'))}</div>${standing}</div></div>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Transmission line</b><span>${esc(error.message)}</span></div>`; }
  let calculators;
  try {
    const analysis = microstrip({ width: Number(config.msWidth), height: Number(config.msHeight), permittivity: Number(config.msEr) });
    const synthesis = microstripWidth({ impedance: Number(config.msZ0), height: Number(config.msHeight), permittivity: Number(config.msEr) });
    const coax = coaxImpedance({ inner: Number(config.coaxInner), outer: Number(config.coaxOuter), permittivity: Number(config.coaxEr) });
    const twin = twinLeadImpedance({ spacing: Number(config.twinSpacing), diameter: Number(config.twinDiameter) });
    calculators = `<div class="calc-grid"><div class="coding-block"><span class="panel-label">MICROSTRIP</span><div class="dsp-controls">${rfField('msHeight', 'Substrate h', config.msHeight, 'mm')}${rfField('msEr', 'εr', config.msEr)}${rfField('msWidth', 'Trace width W', config.msWidth, 'mm')}${rfField('msZ0', 'Target Z0', config.msZ0, 'Ω')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0 for this width', `${fmt(analysis.impedance, 4)} Ω`)}${readout('Effective εr', fmt(analysis.effectivePermittivity, 4))}${readout(`Width for ${fmt(Number(config.msZ0), 4)} Ω`, `${fmt(synthesis.width, 4)} mm`)}${readout('Velocity factor', fmt(analysis.velocityFactor, 4))}</div></div>
      <div class="coding-block"><span class="panel-label">COAXIAL LINE</span><div class="dsp-controls">${rfField('coaxInner', 'Inner d', config.coaxInner, 'mm')}${rfField('coaxOuter', 'Outer D', config.coaxOuter, 'mm')}${rfField('coaxEr', 'εr', config.coaxEr)}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0', `${fmt(coax.impedance, 4)} Ω`)}${readout('Velocity factor', fmt(coax.velocityFactor, 4))}${readout('TE11 cutoff (approx.)', eng(coax.cutoffFrequency, 'Hz'))}</div></div>
      <div class="coding-block"><span class="panel-label">TWIN-LEAD (AIR)</span><div class="dsp-controls">${rfField('twinSpacing', 'Spacing', config.twinSpacing, 'mm')}${rfField('twinDiameter', 'Wire diameter', config.twinDiameter, 'mm')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0', `${fmt(twin.impedance, 4)} Ω`)}</div></div></div>`;
  } catch (error) { calculators = `<div class="diagnostic error"><b>Line calculators</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}${calculators}<p class="module-footnote">Microstrip uses the Hammerstad-Jensen closed form (thin, lossless strip, quasi-static); coax and twin-lead use the ideal TEM formulas.</p></section>`;
}

function bounded01(value) { const number = Number(value); if (!(number > 0 && number <= 1)) throw new RangeError('Velocity factor must be between 0 and 1.'); return number; }

function renderPolarPattern(result) {
  const size = 320, c = size / 2, radius = 140, floor = -40;
  const rOf = (db) => Math.max(0, (db - floor) / -floor) * radius;
  const rings = [0, -10, -20, -30].map((db) => `<circle cx="${c}" cy="${c}" r="${rOf(db).toFixed(1)}"/><text x="${c + 3}" y="${(c - rOf(db) + 10).toFixed(1)}">${db} dB</text>`).join('');
  const spokes = Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return `<line x1="${c}" y1="${c}" x2="${(c + radius * Math.sin(a)).toFixed(1)}" y2="${(c - radius * Math.cos(a)).toFixed(1)}"/>`; }).join('');
  const labels = [0, 30, 60, 90, 120, 150, 180].map((deg) => { const a = deg * Math.PI / 180; return `<text x="${(c + (radius + 10) * Math.sin(a) - 8).toFixed(1)}" y="${(c - (radius + 10) * Math.cos(a) + 3).toFixed(1)}">${deg}°</text>`; }).join('');
  const half = (sign) => result.theta.map((deg, k) => { const a = deg * Math.PI / 180, r = rOf(result.decibels[k]); return `${k ? 'L' : 'M'}${(c + sign * r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`; }).join('');
  return `<svg class="pz-plot polar-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radiation pattern"><g class="polar-grid">${rings}${spokes}</g><g class="pz-axis-label">${labels}</g><path class="polar-trace" d="${half(1)}"/><path class="polar-trace" d="${half(-1)}"/><line class="array-axis" x1="${c}" y1="${c - radius - 4}" x2="${c}" y2="${c + radius + 4}"/></svg>`;
}

function renderAntennaTab(config) {
  const controls = `<div class="dsp-controls">${rfField('elements', 'Elements N', config.elements, '', 'type="number" min="1" max="64" step="1"')}${rfField('spacing', 'Spacing d', config.spacing, 'wavelengths', 'type="number" min="0.05" max="5" step="0.05"')}${rfField('steer', 'Beam direction', config.steer, '° from array axis (90 = broadside)', 'type="number" min="0" max="180" step="5"')}${labSelect('data-rf-lab-field', 'element', 'Element', config.element, Object.entries(ELEMENT_PATTERNS))}</div>`;
  let result;
  try { result = linearArray({ elements: Number(config.elements), spacing: Number(config.spacing), steer: Number(config.steer), element: config.element }); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Antenna array</b><span>${esc(error.message)}</span></div></section>`; }
  const rectangular = renderPlotFrame({ title: 'Normalised pattern (dB) vs θ', series: [{ xs: result.theta, ys: result.decibels.map((value) => Math.max(value, -50)), color: PLOT_COLORS[0], primary: true }, { xs: [0, 180], ys: [-3, -3], color: '#94a3b8', dashed: true }], xMin: 0, xMax: 180, xTicks: Array.from({ length: 7 }, (_, k) => ({ position: k / 6, text: `${k * 30}°` })), yRange: niceRange(-50, 0), formatY: (value) => `${fmt(value, 0)} dB` });
  return `<section class="dsp-card">${controls}
    <div class="filter-lower"><div><span class="panel-label">POLAR PATTERN (array axis vertical, rotationally symmetric)</span>${renderPolarPattern(result)}</div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Directivity', `${fmt(result.directivity, 4)} (${fmt(result.directivityDbi, 2)} dBi)`)}${readout('Main beam', `${fmt(result.mainBeam, 1)}°`)}${readout('Half-power beamwidth', result.beamwidth === null ? '—' : `${fmt(result.beamwidth, 2)}°`)}${readout('Highest sidelobe', result.sidelobeDb === null ? 'none' : `${fmt(result.sidelobeDb, 2)} dB`)}${readout('Progressive phase β', `${fmt(Math.abs(result.progressivePhase) < 1e-9 ? 0 : result.progressivePhase, 2)}°`)}${readout('Array length', `${fmt((result.elements - 1) * result.spacing, 3)} λ`)}${result.radiationResistance ? readout('Element radiation resistance', `${fmt(result.radiationResistance, 4)} Ω`) : ''}</div>
    ${result.gratingLobes ? '<div class="diagnostic warning"><b>Grating lobes</b><span>The spacing is large enough for extra full-strength beams; keep d &lt; λ / (1 + |cos θ0|).</span></div>' : ''}${rectangular}</div></div>
    <p class="module-footnote">Uniform amplitude array factor × element pattern for collinear elements along the axis; mutual coupling is ignored. Directivity is integrated numerically over the sphere.</p></section>`;
}

function renderLinkTab(config) {
  const controls = `<div class="dsp-controls">${rfField('linkFrequency', 'Frequency', config.linkFrequency, 'Hz', engText)}${rfField('linkDistance', 'Distance', config.linkDistance, 'm', engText)}${rfField('txPower', 'Tx power', config.txPower, 'dBm')}${rfField('txGain', 'Tx antenna gain', config.txGain, 'dBi')}${rfField('rxGain', 'Rx antenna gain', config.rxGain, 'dBi')}${rfField('txLoss', 'Tx cable loss', config.txLoss, 'dB')}${rfField('rxLoss', 'Rx cable loss', config.rxLoss, 'dB')}${rfField('otherLoss', 'Other losses / fade', config.otherLoss, 'dB')}${rfField('linkBandwidth', 'Bandwidth', config.linkBandwidth, 'Hz', engText)}${rfField('noiseFigure', 'Rx noise figure', config.noiseFigure, 'dB')}${rfField('requiredSnr', 'Required SNR', config.requiredSnr, 'dB')}</div>`;
  let budget, options;
  try {
    options = { frequency: engineeringInput(config.linkFrequency, 'Frequency'), distance: engineeringInput(config.linkDistance, 'Distance'), txPowerDbm: Number(config.txPower), txGainDbi: Number(config.txGain), rxGainDbi: Number(config.rxGain), txLossDb: Number(config.txLoss), rxLossDb: Number(config.rxLoss), otherLossDb: Number(config.otherLoss), bandwidth: engineeringInput(config.linkBandwidth, 'Bandwidth'), noiseFigureDb: Number(config.noiseFigure), requiredSnrDb: Number(config.requiredSnr) };
    budget = linkBudget(options);
  } catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Link budget</b><span>${esc(error.message)}</span></div></section>`; }
  const first = budget.distance / 100, last = budget.distance * 100;
  const distances = Array.from({ length: 200 }, (_, k) => first * (last / first) ** (k / 199));
  const received = distances.map((d) => budget.receivedDbm - (freeSpacePathLossDb(d, budget.frequency) - budget.fspl));
  const xTicks = decadeTicks(first, last).map((d) => ({ position: (Math.log10(d) - Math.log10(first)) / (Math.log10(last) - Math.log10(first)), text: eng(d, 'm') }));
  const plot = renderPlotFrame({ title: 'Received power (teal) vs distance; sensitivity (grey)', series: [{ xs: distances, ys: received, color: PLOT_COLORS[0], primary: true }, { xs: [first, last], ys: [budget.sensitivityDbm, budget.sensitivityDbm], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...received, budget.sensitivityDbm), Math.max(...received)), formatY: (value) => `${fmt(value, 0)} dBm` });
  const rows = [['Transmitter power', options.txPowerDbm], ['Tx cable loss', -options.txLossDb], ['Tx antenna gain', options.txGainDbi], ['= EIRP', budget.eirpDbm], ['Free-space path loss', -budget.fspl], ['Other losses / fade', -options.otherLossDb], ['Rx antenna gain', options.rxGainDbi], ['Rx cable loss', -options.rxLossDb], ['= Received power', budget.receivedDbm]];
  return `<section class="dsp-card">${controls}
    <div class="filter-lower"><div><span class="panel-label">BUDGET</span><table class="truth-table comm-table budget-table"><tbody>${rows.map(([name, value]) => `<tr class="${name.startsWith('=') ? 'budget-total' : ''}"><td>${name}</td><td>${Math.abs(value) < 1e-12 ? '0' : `${value > 0 && !name.startsWith('=') ? '+' : ''}${fmt(value, 2)}`} ${name.startsWith('=') || name === 'Transmitter power' ? 'dBm' : 'dB'}</td></tr>`).join('')}</tbody></table></div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Received power', `${fmt(budget.receivedDbm, 2)} dBm (${eng(budget.receivedWatts, 'W')})`)}${readout('Noise floor kTB + NF', `${fmt(budget.noiseFloorDbm, 2)} dBm`)}${readout('SNR', `${fmt(budget.snrDb, 2)} dB`)}${readout('Sensitivity', `${fmt(budget.sensitivityDbm, 2)} dBm`)}${readout('Link margin', `${fmt(budget.marginDb, 2)} dB${budget.marginDb < 0 ? ' — link fails' : ''}`)}${readout('Range at 0 dB margin', finiteEng(budget.maxRange, 'm'))}${readout('Wavelength', eng(budget.wavelength, 'm'))}${readout('1st Fresnel zone radius (mid-path)', eng(budget.fresnelRadius, 'm'))}${readout('Shannon capacity', `${eng(budget.shannonCapacity, 'bit/s')}`)}</div>${plot}</div></div>
    <p class="module-footnote">Free-space Friis propagation with thermal noise at 290 K. Real links also need terrain, multipath and rain-fade allowances — put them in "Other losses".</p></section>`;
}

function renderRf(state) {
  const config = rfConfiguration(state);
  const body = config.tab === 'smith' ? renderSmithTab(config) : config.tab === 'line' ? renderLineTab(config) : config.tab === 'antenna' ? renderAntennaTab(config) : config.tab === 'link' ? renderLinkTab(config) : renderTouchstoneTab(state);
  return `<div class="page scroll-page rf-page">${pageHeader(modules.find((item) => item.id === 'rf'), 'BUILT-IN RF LAB', '<span class="pill live"><i></i> LOCAL COMPUTATION</span>')}
    ${labTabs(RF_TABS, config.tab, 'data-rf-tab')}${body}</div>`;
}

const CALC_DEFAULTS = Object.freeze({
  tab: 'resistor', bandCount: 4, bands: ['yellow', 'violet', 'red', 'gold', 'brown', 'brown'], encodeValue: '4.7k', series: 'E24', smdCode: '472', capCode: '104K',
  timerMode: 'astable', r1: '1k', r2: '10k', timerC: '10n', monoR: '100k', monoC: '10u', designF: '1k', designDuty: 0.6, designC: '10n',
  opampConfig: 'inverting', opR1: '10k', opR2: '100k', gbw: '1M', slew: '0.5M', vinPeak: 0.5, supply: 12,
  levelValue: 0, levelUnit: 'dBm', levelImpedance: 50, ratioValue: 2, dbValue: 3,
  ohmV: '12', ohmI: '', ohmR: '4', ohmP: '', spValues: '100 220 470', divVin: 12, divR1: '10k', divR2: '4.7k', divLoad: '',
  rlcR: '10', rlcL: '1m', rlcC: '1u', rcR: '1k', rcC: '100n', ledSupply: 5, ledVf: 2, ledI: '20m', adcBits: 10, adcRef: 5,
});
const CALC_TABS = [['resistor', 'Resistor & component codes'], ['timer', '555 timer'], ['opamp', 'Op-amp'], ['decibel', 'dB & power'], ['formulas', 'Circuit formulas']];
const CALC_NUMBER_FIELDS = ['bandCount', 'designDuty', 'vinPeak', 'supply', 'levelValue', 'levelImpedance', 'ratioValue', 'dbValue', 'divVin', 'ledSupply', 'ledVf', 'adcBits', 'adcRef'];

function calcConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'calc-lab')?.inputs || {};
  return { ...CALC_DEFAULTS, ...saved };
}

function persistCalc(patch) {
  recordExperiment({ id: 'calc-lab', kind: 'calculator', operation: 'calc-lab', inputs: { ...calcConfiguration(getState()), ...patch } });
}

const calcField = (name, label, value, unit = '', attributes = 'type="text" spellcheck="false" maxlength="24"') => labField('data-calc-field', name, label, value, unit, attributes);
const calcNumber = (name, label, value, unit = '', extra = 'step="any"') => labField('data-calc-field', name, label, value, unit, `type="number" ${extra}`);
const calcSelect = (...args) => labSelect('data-calc-field', ...args);
const calcBlock = (title, controls, render) => {
  let content;
  try { content = render(); } catch (error) { content = `<div class="diagnostic error"><b>${esc(title)}</b><span>${esc(error.message)}</span></div>`; }
  return `<div class="coding-block"><span class="panel-label">${esc(title.toUpperCase())}</span><div class="dsp-controls">${controls}</div>${content}</div>`;
};
const ohms = (value) => (Number.isFinite(value) ? eng(value, 'Ω') : '∞');
const blankOr = (value, label) => (String(value).trim() === '' ? null : engineeringInput(value, label));

function renderResistorSvg(names) {
  const bodyStart = 70, bodyEnd = 290;
  const positions = names.length <= 4 ? [100, 128, 156, 240] : names.length === 5 ? [96, 120, 144, 168, 240] : [96, 118, 140, 162, 232, 258];
  return `<svg class="resistor-svg" viewBox="0 0 360 90" role="img" aria-label="Resistor colour bands"><line x1="10" y1="45" x2="350" y2="45" class="resistor-lead"/><rect x="${bodyStart}" y="20" width="${bodyEnd - bodyStart}" height="50" rx="22" class="resistor-body"/>${names.map((name, index) => { const entry = COLOR_BANDS.find((band) => band.name === name); return name === 'none' ? '' : `<rect x="${positions[index]}" y="20" width="12" height="50" fill="${entry.hex}" stroke="#0006"/>`; }).join('')}</svg>`;
}

function renderResistorTab(config) {
  const count = [3, 4, 5, 6].includes(Number(config.bandCount)) ? Number(config.bandCount) : 4;
  const digitCount = count >= 5 ? 3 : 2;
  const names = Array.from({ length: count }, (_, index) => config.bands[index] || 'brown');
  const roleOf = (index) => (index < digitCount ? 'digit' : index === digitCount ? 'multiplier' : index === digitCount + 1 ? 'tolerance' : 'tempco');
  const roleLabel = { digit: 'Digit', multiplier: 'Multiplier', tolerance: 'Tolerance', tempco: 'Temp. coeff.' };
  const optionsFor = (role) => COLOR_BANDS.filter((entry) => (role === 'digit' ? entry.digit !== null : role === 'multiplier' ? entry.multiplier !== null : role === 'tolerance' ? entry.tolerance !== null && entry.name !== 'none' : entry.tempco !== null)).map((entry) => [entry.name, entry.name]);
  const bandSelects = names.map((name, index) => `<label>${roleLabel[roleOf(index)]} ${index + 1}<select data-calc-band="${index}">${optionsFor(roleOf(index)).map(([key]) => `<option value="${key}" ${key === name ? 'selected' : ''}>${key}</option>`).join('')}</select></label>`).join('');
  const decode = calcBlock('Colour bands → value', `${calcSelect('bandCount', 'Bands', count, [[3, '3 bands'], [4, '4 bands'], [5, '5 bands'], [6, '6 bands']])}${bandSelects}`, () => {
    const result = decodeResistorBands(names);
    return `${renderResistorSvg(names)}<div class="analysis-readouts comm-readouts">${readout('Resistance', ohms(result.value))}${readout('Tolerance', `±${result.tolerance} %`)}${readout('Range', `${ohms(result.minimum)} … ${ohms(result.maximum)}`)}${result.tempco === null ? '' : readout('Temperature coefficient', `${result.tempco} ppm/K`)}</div>`;
  });
  const encode = calcBlock('Value → colour bands', `${calcField('encodeValue', 'Resistance', config.encodeValue, 'Ω (e.g. 4.7k)')}${calcSelect('series', 'Preferred series', config.series, Object.keys(E_SERIES).map((key) => [key, key]))}`, () => {
    const value = engineeringInput(config.encodeValue, 'Resistance');
    const four = encodeResistorBands(value, { bands: 4 }), five = encodeResistorBands(value, { bands: 5 });
    const preferred = nearestPreferred(value, config.series);
    return `<div class="band-pair"><div>${renderResistorSvg(four.bands)}<small>4-band: ${four.bands.join(' · ')}${four.roundingError ? ` (codes ${ohms(four.value)})` : ''}</small></div><div>${renderResistorSvg(five.bands)}<small>5-band: ${five.bands.join(' · ')}${five.roundingError ? ` (codes ${ohms(five.value)})` : ''}</small></div></div>
      <div class="analysis-readouts comm-readouts">${readout(`Nearest ${config.series}`, `${ohms(preferred.value)} (${fmt(preferred.error * 100, 2)} %)`)}${readout(`${config.series} neighbours`, `${ohms(preferred.below)} / ${ohms(preferred.above)}`)}</div>`;
  });
  const markings = calcBlock('SMD resistor and capacitor markings', `${calcField('smdCode', 'SMD resistor code', config.smdCode, '472, 1002, 4R7, 01C')}${calcField('capCode', 'Capacitor code', config.capCode, '104K, 223J, 471')}`, () => {
    let smd, cap;
    try { const result = decodeSmdResistor(config.smdCode); smd = `${ohms(result.value)} — ${result.system}`; } catch (error) { smd = error.message; }
    try { const result = decodeCapacitorCode(config.capCode); cap = `${eng(result.farads, 'F')}${result.tolerance ? ` ${result.tolerance}` : ''} (${fmt(result.picofarads, 6)} pF)`; } catch (error) { cap = error.message; }
    return `<div class="analysis-readouts comm-readouts">${readout('SMD resistor', smd)}${readout('Capacitor', cap)}</div>`;
  });
  return `<section class="dsp-card coding-card">${decode}${encode}${markings}</section>`;
}

function renderTimerTab(config) {
  const mode = config.timerMode === 'monostable' ? 'monostable' : 'astable';
  const modeSelect = calcSelect('timerMode', 'Mode', mode, [['astable', 'Astable (oscillator)'], ['monostable', 'Monostable (one-shot)']]);
  const analysis = mode === 'astable'
    ? calcBlock('Astable analysis', `${modeSelect}${calcField('r1', 'R1', config.r1, 'Ω')}${calcField('r2', 'R2', config.r2, 'Ω')}${calcField('timerC', 'C', config.timerC, 'F')}`, () => {
      const result = timer555Astable({ r1: engineeringInput(config.r1, 'R1'), r2: engineeringInput(config.r2, 'R2'), c: engineeringInput(config.timerC, 'C') });
      // Two periods of output and capacitor voltage (Vcc = 1): charge 1/3→2/3 through R1+R2, discharge through R2.
      const xs = [], output = [], capacitor = [];
      for (let k = 0; k <= 400; k += 1) {
        const t = 2 * result.period * k / 400, phase = t % result.period;
        xs.push(t);
        const high = phase < result.high;
        output.push(high ? 1 : 0);
        capacitor.push(high ? 1 - (2 / 3) * 2 ** (-phase / result.high) : (2 / 3) * 2 ** (-(phase - result.high) / result.low));
      }
      const plot = renderPlotFrame({ title: 'Output (teal) and capacitor voltage (blue), Vcc = 1', series: [{ xs, ys: output, color: PLOT_COLORS[0], primary: true }, { xs, ys: capacitor, color: PLOT_COLORS[1] }], xMin: 0, xMax: xs.at(-1), xTicks: linearTicks(0, xs.at(-1), 's'), yRange: niceRange(0, 1), formatY: (value) => fmt(value, 2) });
      return `<div class="analysis-readouts comm-readouts">${readout('Frequency', eng(result.frequency, 'Hz'))}${readout('Period', eng(result.period, 's'))}${readout('High time', eng(result.high, 's'))}${readout('Low time', eng(result.low, 's'))}${readout('Duty cycle', `${fmt(result.duty * 100, 2)} %`)}</div>${plot}`;
    })
    : calcBlock('Monostable analysis', `${modeSelect}${calcField('monoR', 'R', config.monoR, 'Ω')}${calcField('monoC', 'C', config.monoC, 'F')}`, () => {
      const result = timer555Monostable({ r: engineeringInput(config.monoR, 'R'), c: engineeringInput(config.monoC, 'C') });
      return `<div class="analysis-readouts comm-readouts">${readout('Pulse width t = ln3·RC ≈ 1.1RC', eng(result.width, 's'))}</div>`;
    });
  const design = calcBlock('Astable design', `${calcField('designF', 'Target frequency', config.designF, 'Hz')}${calcNumber('designDuty', 'Duty cycle', config.designDuty, '0.5 – 1', 'min="0.5" max="0.99" step="0.01"')}${calcField('designC', 'Timing capacitor', config.designC, 'F')}`, () => {
    const result = design555Astable({ frequency: engineeringInput(config.designF, 'Frequency'), duty: Number(config.designDuty), c: engineeringInput(config.designC, 'C') });
    return `<div class="analysis-readouts comm-readouts">${readout('Exact R1', ohms(result.r1))}${readout('Exact R2', ohms(result.r2))}${readout('E24 build', `R1 = ${ohms(result.standard.r1)}, R2 = ${ohms(result.standard.r2)}`)}${readout('E24 result', `${eng(result.standard.frequency, 'Hz')}, ${fmt(result.standard.duty * 100, 1)} % duty`)}</div>${result.warnings.map((warning) => `<p class="module-footnote">${esc(warning)}</p>`).join('')}`;
  });
  return `<section class="dsp-card coding-card">${analysis}${design}<p class="module-footnote">Ideal NE555 thresholds at 1/3 and 2/3 Vcc; real parts add discharge-transistor and threshold-current errors of a few per cent.</p></section>`;
}

function renderOpampTab(config) {
  const controls = `${calcSelect('opampConfig', 'Configuration', config.opampConfig, Object.entries(OPAMP_CONFIGS))}${config.opampConfig === 'follower' ? '' : `${calcField('opR1', config.opampConfig === 'non-inverting' ? 'Rg (to ground)' : 'R1 (input)', config.opR1, 'Ω')}${calcField('opR2', 'R2 (feedback)', config.opR2, 'Ω')}`}${calcField('gbw', 'Gain-bandwidth', config.gbw, 'Hz')}${calcField('slew', 'Slew rate', config.slew, 'V/s')}${calcNumber('vinPeak', 'Input peak', config.vinPeak, 'V')}${calcNumber('supply', 'Supply ±', config.supply, 'V')}`;
  return `<section class="dsp-card coding-card">${calcBlock('Op-amp stage', controls, () => {
    const result = opampStage({ config: config.opampConfig, r1: engineeringInput(config.opR1, 'R1'), r2: engineeringInput(config.opR2, 'R2'), gbw: engineeringInput(config.gbw, 'Gain-bandwidth'), slewRate: engineeringInput(config.slew, 'Slew rate'), inputPeak: Number(config.vinPeak), supply: Number(config.supply) });
    const rail = Number(config.supply);
    const xs = Array.from({ length: 241 }, (_, k) => k / 240);
    const input = xs.map((x) => Number(config.vinPeak) * Math.sin(2 * Math.PI * x));
    const output = input.map((value) => Math.max(-rail, Math.min(rail, result.gain * value)));
    const values = [...input, ...output];
    const plot = renderPlotFrame({ title: 'One period: input (blue) and output (teal), clipped at the rails', series: [{ xs, ys: output, color: PLOT_COLORS[0], primary: true }, { xs, ys: input, color: PLOT_COLORS[1] }], xMin: 0, xMax: 1, xTicks: Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: `${k * 90}°` })), yRange: niceRange(Math.min(...values), Math.max(...values)), formatY: (value) => `${fmt(value, 2)} V` });
    return `<div class="analysis-readouts comm-readouts">${readout('Voltage gain', `${fmt(result.gain, 4)} (${fmt(result.gainDb, 2)} dB)`)}${readout('Noise gain', fmt(result.noiseGain, 4))}${readout('Closed-loop bandwidth', eng(result.bandwidth, 'Hz'))}${readout('Input impedance', ohms(result.inputImpedance))}${readout('Output peak', `${fmt(result.outputPeak, 4)} V${result.clipping ? ' — CLIPS at the rails' : ''}`)}${readout('Full-power bandwidth', finiteEng(result.fullPowerBandwidth, 'Hz'))}</div>${plot}`;
  })}<p class="module-footnote">Ideal op-amp with a single-pole gain-bandwidth limit: bandwidth = GBW / noise gain. Rails are treated as reachable (rail-to-rail output).</p></section>`;
}

function renderDecibelTab(config) {
  const level = calcBlock('Power and voltage levels', `${calcNumber('levelValue', 'Level', config.levelValue)}${calcSelect('levelUnit', 'Unit', config.levelUnit, Object.keys(POWER_UNITS).map((key) => [key, POWER_UNITS[key]]))}${calcNumber('levelImpedance', 'Impedance', config.levelImpedance, 'Ω', 'min="0.001" step="any"')}`, () => {
    const result = convertLevel(Number(config.levelValue), config.levelUnit, Number(config.levelImpedance));
    return `<div class="analysis-readouts comm-readouts">${readout('Power', eng(result.W, 'W'))}${readout('dBm', fmt(result.dBm, 4))}${readout('dBW', fmt(result.dBW, 4))}${readout('V rms', eng(result.Vrms, 'V'))}${readout('V peak', eng(result.Vpeak, 'V'))}${readout('V peak-to-peak', eng(result.Vpp, 'V'))}${readout('dBµV', fmt(result.dBuV, 4))}${readout('dBV', fmt(result.dBV, 4))}</div>`;
  });
  const ratios = calcBlock('Ratios and decibels', `${calcNumber('ratioValue', 'Ratio', config.ratioValue, '×', 'min="0" step="any"')}${calcNumber('dbValue', 'Decibels', config.dbValue, 'dB')}`, () => `<div class="analysis-readouts comm-readouts">${readout(`Power ratio ${fmt(Number(config.ratioValue), 6)}×`, `${fmt(ratioToDb(Number(config.ratioValue), 'power'), 4)} dB`)}${readout(`Voltage ratio ${fmt(Number(config.ratioValue), 6)}×`, `${fmt(ratioToDb(Number(config.ratioValue), 'voltage'), 4)} dB`)}${readout(`${fmt(Number(config.dbValue), 4)} dB as power ratio`, `${fmt(dbToRatio(Number(config.dbValue), 'power'), 6)}×`)}${readout(`${fmt(Number(config.dbValue), 4)} dB as voltage ratio`, `${fmt(dbToRatio(Number(config.dbValue), 'voltage'), 6)}×`)}</div>`);
  return `<section class="dsp-card coding-card">${level}${ratios}<p class="module-footnote">Power dB = 10·log10(P2/P1); voltage dB = 20·log10(V2/V1), valid when both voltages appear across the same impedance.</p></section>`;
}

function renderFormulasTab(config) {
  const ohm = calcBlock("Ohm's law — fill any two", `${calcField('ohmV', 'Voltage V', config.ohmV, 'V')}${calcField('ohmI', 'Current I', config.ohmI, 'A')}${calcField('ohmR', 'Resistance R', config.ohmR, 'Ω')}${calcField('ohmP', 'Power P', config.ohmP, 'W')}`, () => {
    const result = solveOhm({ V: blankOr(config.ohmV, 'V'), I: blankOr(config.ohmI, 'I'), R: blankOr(config.ohmR, 'R'), P: blankOr(config.ohmP, 'P') });
    return `<div class="analysis-readouts comm-readouts">${readout('V', eng(result.V, 'V'))}${readout('I', eng(result.I, 'A'))}${readout('R', ohms(result.R))}${readout('P', eng(result.P, 'W'))}</div>`;
  });
  const sp = calcBlock('Series and parallel', calcField('spValues', 'Values (R, L, or 1/C)', config.spValues, 'separate with spaces', 'type="text" spellcheck="false" maxlength="200"'), () => {
    const result = seriesParallel(String(config.spValues).trim().split(/[\s,;]+/).filter(Boolean).map((text) => engineeringInput(text, 'Value')));
    return `<div class="analysis-readouts comm-readouts">${readout('Series sum', eng(result.series, ''))}${readout('Parallel combination', eng(result.parallel, ''))}</div>`;
  });
  const divider = calcBlock('Voltage divider', `${calcNumber('divVin', 'Vin', config.divVin, 'V')}${calcField('divR1', 'R1 (top)', config.divR1, 'Ω')}${calcField('divR2', 'R2 (bottom)', config.divR2, 'Ω')}${calcField('divLoad', 'Load (blank = none)', config.divLoad, 'Ω')}`, () => {
    const result = voltageDivider({ vin: Number(config.divVin), r1: engineeringInput(config.divR1, 'R1'), r2: engineeringInput(config.divR2, 'R2'), load: blankOr(config.divLoad, 'Load') });
    return `<div class="analysis-readouts comm-readouts">${readout('Vout', eng(result.vout, 'V'))}${readout('Vout unloaded', eng(result.unloaded, 'V'))}${readout('Divider current', eng(result.current, 'A'))}${readout('Thevenin resistance', ohms(result.theveninResistance))}</div>`;
  });
  const rlc = calcBlock('RLC resonance', `${calcField('rlcR', 'R', config.rlcR, 'Ω')}${calcField('rlcL', 'L', config.rlcL, 'H')}${calcField('rlcC', 'C', config.rlcC, 'F')}`, () => {
    const result = rlcResonance({ resistance: engineeringInput(config.rlcR, 'R'), inductance: engineeringInput(config.rlcL, 'L'), capacitance: engineeringInput(config.rlcC, 'C') });
    const x = reactance({ frequency: result.resonance, capacitance: engineeringInput(config.rlcC, 'C'), inductance: engineeringInput(config.rlcL, 'L') });
    return `<div class="analysis-readouts comm-readouts">${readout('Resonant frequency', eng(result.resonance, 'Hz'))}${readout('Series Q', fmt(result.q, 4))}${readout('Bandwidth', eng(result.bandwidth, 'Hz'))}${readout('XL = XC at f0', ohms(x.inductive))}${readout('Damping ratio ζ', fmt(result.damping, 4))}</div>`;
  });
  const rc = calcBlock('RC time constant and cutoff', `${calcField('rcR', 'R', config.rcR, 'Ω')}${calcField('rcC', 'C', config.rcC, 'F')}`, () => {
    const result = rcFilter({ resistance: engineeringInput(config.rcR, 'R'), capacitance: engineeringInput(config.rcC, 'C') });
    return `<div class="analysis-readouts comm-readouts">${readout('τ = RC', eng(result.tau, 's'))}${readout('−3 dB cutoff', eng(result.cutoff, 'Hz'))}${readout('Rise time 10–90 %', eng(result.riseTime, 's'))}${readout('Settles (5τ)', eng(result.settle5Tau, 's'))}</div>`;
  });
  const led = calcBlock('LED series resistor', `${calcNumber('ledSupply', 'Supply', config.ledSupply, 'V')}${calcNumber('ledVf', 'LED forward voltage', config.ledVf, 'V')}${calcField('ledI', 'LED current', config.ledI, 'A')}`, () => {
    const result = ledResistor({ supply: Number(config.ledSupply), forwardVoltage: Number(config.ledVf), current: engineeringInput(config.ledI, 'Current') });
    return `<div class="analysis-readouts comm-readouts">${readout('Exact resistor', ohms(result.resistance))}${readout('Next E12 value up', ohms(result.standard))}${readout('Actual current', eng(result.actualCurrent, 'A'))}${readout('Resistor dissipation', eng(result.resistorPower, 'W'))}</div>`;
  });
  const adc = calcBlock('ADC resolution', `${calcNumber('adcBits', 'Bits', config.adcBits, '', 'min="1" max="32" step="1"')}${calcNumber('adcRef', 'Reference', config.adcRef, 'V')}`, () => {
    const result = adcResolution({ bits: Number(config.adcBits), reference: Number(config.adcRef) });
    return `<div class="analysis-readouts comm-readouts">${readout('Levels', result.levels.toLocaleString())}${readout('LSB size', eng(result.lsb, 'V'))}${readout('Ideal SNR (full-scale sine)', `${fmt(result.snrDb, 2)} dB`)}${readout('Dynamic range', `${fmt(result.dynamicRangeDb, 2)} dB`)}</div>`;
  });
  return `<section class="dsp-card coding-card"><div class="calc-grid">${ohm}${sp}${divider}${rlc}${rc}${led}${adc}</div><p class="module-footnote">Values accept engineering prefixes: p, n, u/µ, m, k, M, G (for example 4.7k, 100n, 2.2u).</p></section>`;
}

function renderCalculators(state) {
  const config = calcConfiguration(state);
  const body = config.tab === 'timer' ? renderTimerTab(config) : config.tab === 'opamp' ? renderOpampTab(config) : config.tab === 'decibel' ? renderDecibelTab(config) : config.tab === 'formulas' ? renderFormulasTab(config) : renderResistorTab(config);
  return `<div class="page scroll-page calc-page">${pageHeader(modules.find((item) => item.id === 'calc'), 'ENGINEERING CALCULATORS', '<span class="pill live"><i></i> INSTANT RESULTS</span>')}
    ${labTabs(CALC_TABS, config.tab, 'data-calc-tab')}${body}</div>`;
}

function bindCalculatorEvents() {
  document.querySelectorAll('[data-calc-tab]').forEach((button) => button.addEventListener('click', () => persistCalc({ tab: button.dataset.calcTab })));
  document.querySelectorAll('[data-calc-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.calcField;
    const number = CALC_NUMBER_FIELDS.includes(name);
    const value = number ? Number(field.value) : field.value.trim();
    if (number && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistCalc({ [name]: value });
  }));
  document.querySelectorAll('[data-calc-band]').forEach((select) => select.addEventListener('change', () => {
    const bands = [...calcConfiguration(getState()).bands];
    bands[Number(select.dataset.calcBand)] = select.value;
    persistCalc({ bands });
  }));
}

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

function renderPcb(state) {
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

function bindPcbEvents() {
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

// ---------------------------------------------------------------------------
// Microcontroller Lab: 8051 trainer (assembler, simulator, board, serial terminal).

const MCU_SPEEDS = [['0.01', 'Slow motion (1 %)'], ['0.1', '10 %'], ['1', 'Real time'], ['10', '10×'], ['max', 'As fast as possible']];
const mcuRuntime = { cpu: null, board: null, assembly: null, key: null, running: false, frame: 0, last: 0, breakpoints: new Set(), terminal: '', loadedHex: null, error: null };

function mcuConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'mcu-lab')?.inputs || {};
  const example = EXAMPLES_8051[0];
  return { tab: '8051', source: example.source, exampleId: example.id, wiring: example.wiring, clockMHz: 11.0592, speed: '1', avrExampleId: 'blink', avrSpeed: '1', avrBoard: null, ...saved };
}

function persistMcu(patch) {
  const next = { ...mcuConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The program is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'mcu-lab', kind: 'mcu', operation: 'mcu-lab', inputs: next });
}

/** (Re)build the simulated system when the program, wiring or clock changes. */
function mcuEnsure(config) {
  const key = JSON.stringify([config.source, config.wiring, config.clockMHz, mcuRuntime.loadedHex?.name]);
  if (mcuRuntime.key === key && mcuRuntime.cpu) return;
  mcuStop();
  mcuRuntime.key = key;
  mcuRuntime.terminal = '';
  mcuRuntime.error = null;
  const cpu = new Cpu8051({ clock: Number(config.clockMHz) * 1e6 || 11_059_200 });
  if (mcuRuntime.loadedHex) { mcuRuntime.assembly = null; cpu.load(mcuRuntime.loadedHex.image); }
  else {
    const assembly = assemble(config.source);
    mcuRuntime.assembly = assembly;
    if (!assembly.errors.length) cpu.load(toImage(assembly.bytes));
  }
  mcuRuntime.cpu = cpu;
  mcuRuntime.board = new TrainerBoard(cpu, config.wiring);
}

function mcuStop() { mcuRuntime.running = false; if (mcuRuntime.frame) cancelAnimationFrame(mcuRuntime.frame); mcuRuntime.frame = 0; }

function mcuStart() {
  const { cpu, assembly } = mcuRuntime;
  if (!cpu || assembly?.errors.length) { notify('Fix the assembly errors first.', 'error'); return; }
  if (cpu.halted) { notify(cpu.haltReason || 'The CPU has halted; press Reset.', 'error'); return; }
  mcuRuntime.running = true;
  mcuRuntime.last = performance.now();
  const tick = (now) => {
    if (!mcuRuntime.running) return;
    if (!document.querySelector('[data-mcu-root]')) { mcuStop(); return; }
    const config = mcuConfiguration(getState());
    const elapsed = Math.min(0.1, (now - mcuRuntime.last) / 1000);
    mcuRuntime.last = now;
    const budget = config.speed === 'max' ? 2_000_000 : Math.max(1, Math.round(cpu.clock / 12 * Number(config.speed) * elapsed));
    const result = cpu.run(budget, mcuRuntime.breakpoints);
    mcuDrainSerial();
    paintMcu();
    if (result.reason !== 'cycles') { mcuStop(); paintMcu(); notify(result.reason === 'breakpoint' ? `Breakpoint at ${hex4(result.pc)}` : cpu.haltReason || 'CPU halted', result.reason === 'breakpoint' ? 'success' : 'error'); return; }
    mcuRuntime.frame = requestAnimationFrame(tick);
  };
  mcuRuntime.frame = requestAnimationFrame(tick);
  paintMcu();
}

function mcuDrainSerial() {
  const output = mcuRuntime.cpu.serialOutput;
  if (!output.length) return;
  for (const byte of output) mcuRuntime.terminal += byte === 13 ? '' : byte === 10 || (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`;
  output.length = 0;
  if (mcuRuntime.terminal.length > 8000) mcuRuntime.terminal = mcuRuntime.terminal.slice(-6000);
}

const hex2 = (value) => value.toString(16).toUpperCase().padStart(2, '0');
const hex4 = (value) => `${value.toString(16).toUpperCase().padStart(4, '0')}H`;
const portBits = (value) => Array.from({ length: 8 }, (_, k) => `<i class="${(value >> (7 - k)) & 1 ? 'on' : ''}">${(value >> (7 - k)) & 1}</i>`).join('');

function mcuRegistersHtml(cpu) {
  const s = cpu.snapshot();
  const flags = [['CY', 7], ['AC', 6], ['F0', 5], ['RS1', 4], ['RS0', 3], ['OV', 2], ['P', 0]].map(([name, bit]) => `<span class="${(s.psw >> bit) & 1 ? 'on' : ''}">${name}</span>`).join('');
  const regs = s.registers.map((value, n) => `<div><span>R${n}</span><b>${hex2(value)}</b></div>`).join('');
  return `<div class="mcu-regs"><div><span>PC</span><b>${hex4(s.pc)}</b></div><div><span>A</span><b>${hex2(s.a)}</b></div><div><span>B</span><b>${hex2(s.b)}</b></div><div><span>SP</span><b>${hex2(s.sp)}</b></div><div><span>DPTR</span><b>${hex4(s.dptr)}</b></div><div><span>Bank</span><b>${s.bank}</b></div>${regs}</div>
    <div class="mcu-flags">${flags}</div>
    <div class="mcu-ports">${['P0', 'P1', 'P2', 'P3'].map((name, port) => `<div><span>${name}</span><code>${portBits(s.pins[port])}</code><b>${hex2(s.pins[port])}</b></div>`).join('')}</div>
    <div class="mcu-regs small"><div><span>TMOD</span><b>${hex2(s.tmod)}</b></div><div><span>TCON</span><b>${hex2(s.tcon)}</b></div><div><span>T0</span><b>${hex4(s.timer0)}</b></div><div><span>T1</span><b>${hex4(s.timer1)}</b></div><div><span>SCON</span><b>${hex2(s.scon)}</b></div><div><span>IE</span><b>${hex2(s.ie)}</b></div><div><span>IP</span><b>${hex2(s.ip)}</b></div></div>
    <p class="mcu-status">${s.instructions.toLocaleString()} instructions · ${s.cycles.toLocaleString()} machine cycles · ${eng(s.timeSeconds, 's')} at ${fmt(cpu.clock / 1e6, 6)} MHz${cpu.lastInterrupt ? ` · last interrupt: ${esc(cpu.lastInterrupt)}` : ''}</p>`;
}

function mcuRamHtml(cpu) {
  const rows = [];
  for (let base = 0; base < 0x80; base += 16) rows.push(`<div><span>${hex2(base)}</span>${Array.from({ length: 16 }, (_, k) => `<i class="${cpu.iram[base + k] ? 'nz' : ''}">${hex2(cpu.iram[base + k])}</i>`).join('')}</div>`);
  return rows.join('');
}

function mcuListingHtml() {
  const { cpu, assembly } = mcuRuntime;
  if (!assembly) {
    const lines = [];
    let address = cpu.pc;
    for (let k = 0; k < 18; k += 1) { const d = disassemble((a) => cpu.code[a], address); lines.push(`<div class="${address === cpu.pc ? 'current' : ''}${mcuRuntime.breakpoints.has(address) ? ' bp' : ''}" data-mcu-bp="${address}"><span>${hex4(address)}</span><code>${d.bytes.map(hex2).join(' ')}</code><b>${esc(d.text)}</b></div>`); address = (address + d.size) & 0xffff; }
    return lines.join('');
  }
  return assembly.listing.map((line) => {
    const current = line.address !== null && line.bytes.length && cpu.pc >= line.address && cpu.pc < line.address + line.bytes.length;
    const executable = line.address !== null && line.bytes.length;
    return `<div class="${current ? 'current' : ''}${executable && mcuRuntime.breakpoints.has(line.address) ? ' bp' : ''}${line.error ? ' err' : ''}" ${executable ? `data-mcu-bp="${line.address}"` : ''}><span>${line.address === null ? '' : hex4(line.address)}</span><code>${line.bytes.slice(0, 4).map(hex2).join(' ')}${line.bytes.length > 4 ? '…' : ''}</code><b>${esc(line.source.replace(/\t/g, '    '))}</b></div>`;
  }).join('');
}

function sevenSegmentSvg(segments) {
  const on = (bit) => (segments !== null && (segments >> bit) & 1 ? 'on' : '');
  return `<svg viewBox="0 0 60 100" class="mcu-seg"><polygon class="${on(0)}" points="12,6 48,6 42,13 18,13"/><polygon class="${on(1)}" points="50,8 50,46 43,42 43,15"/><polygon class="${on(2)}" points="50,54 50,92 43,85 43,58"/><polygon class="${on(3)}" points="12,94 48,94 42,87 18,87"/><polygon class="${on(4)}" points="10,54 10,92 17,85 17,58"/><polygon class="${on(5)}" points="10,8 10,46 17,42 17,15"/><polygon class="${on(6)}" points="12,50 18,46 42,46 48,50 42,54 18,54"/><circle class="${on(7)}" cx="55" cy="93" r="3.5"/></svg>`;
}

function mcuBoardHtml(config) {
  const { board } = mcuRuntime;
  const view = board.view();
  const wiring = config.wiring;
  const parts = [];
  if (wiring.leds.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">LEDS · P${wiring.leds.port}</span><div class="mcu-leds">${view.leds.map((lit, bit) => `<div><i class="${lit ? 'lit' : ''}"></i><small>${bit}</small></div>`).reverse().join('')}</div></div>`);
  if (wiring.sevenSegment.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">7-SEGMENT · P${wiring.sevenSegment.port}</span>${sevenSegmentSvg(view.segments)}</div>`);
  if (wiring.lcd.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">LCD 16×2 · DATA P${wiring.lcd.dataPort}</span><div class="mcu-lcd ${view.lcd.on ? 'on' : ''}">${view.lcd.lines.map((line) => `<div>${esc(line).replaceAll(' ', '&nbsp;')}</div>`).join('')}</div></div>`);
  if (wiring.switches.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">DIP SWITCHES · P${wiring.switches.port} (down = closed = 0)</span><div class="mcu-switches">${Array.from({ length: 8 }, (_, k) => 7 - k).map((bit) => `<button class="${(board.switches >> bit) & 1 ? '' : 'closed'}" data-mcu-switch="${bit}"><i></i><small>${bit}</small></button>`).join('')}</div></div>`);
  if (wiring.buttons.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">PUSH BUTTONS (hold to press)</span><div class="mcu-buttons">${wiring.buttons.pins.map((pin, index) => `<button data-mcu-button="${index}" class="${board.buttons[index] ? 'pressed' : ''}">${esc(pin)}${pin === 'P3.2' ? ' · INT0' : pin === 'P3.3' ? ' · INT1' : ''}</button>`).join('')}</div></div>`);
  if (wiring.keypad.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">4×4 KEYPAD · P${wiring.keypad.port} (rows 0–3, columns 4–7)</span><div class="mcu-keypad">${Array.from({ length: 16 }, (_, k) => `<button data-mcu-key="${Math.floor(k / 4)},${k % 4}" class="${board.keys.has(`${Math.floor(k / 4)},${k % 4}`) ? 'pressed' : ''}">${'0123456789ABCDEF'[k]}</button>`).join('')}</div></div>`);
  return parts.join('') || '<p class="module-footnote">No peripherals connected — enable some under Board wiring.</p>';
}

function paintMcu() {
  const root = document.querySelector('[data-mcu-root]');
  if (!root || !mcuRuntime.cpu) return;
  const config = mcuConfiguration(getState());
  const set = (selector, html) => { const element = root.querySelector(selector); if (element && element.innerHTML !== html) element.innerHTML = html; };
  set('[data-mcu-regs]', mcuRegistersHtml(mcuRuntime.cpu));
  set('[data-mcu-ram]', mcuRamHtml(mcuRuntime.cpu));
  set('[data-mcu-board]', mcuBoardHtml(config));
  const listing = root.querySelector('[data-mcu-listing]');
  if (listing) {
    const html = mcuListingHtml();
    if (listing.innerHTML !== html) { listing.innerHTML = html; listing.querySelector('.current')?.scrollIntoView({ block: 'nearest' }); }
  }
  const terminal = root.querySelector('[data-mcu-terminal]');
  if (terminal && terminal.textContent !== mcuRuntime.terminal) { terminal.textContent = mcuRuntime.terminal; terminal.scrollTop = terminal.scrollHeight; }
  const run = root.querySelector('[data-action="mcu-run"]');
  if (run) run.textContent = mcuRuntime.running ? 'Pause' : 'Run';
  paintAnalyzer('i8051', !mcuRuntime.running);
}

function renderMcuWiring(config) {
  const w = config.wiring;
  const portSelect = (path, value) => `<select data-mcu-wire="${path}">${[0, 1, 2, 3].map((port) => `<option value="${port}" ${port === value ? 'selected' : ''}>P${port}</option>`).join('')}</select>`;
  const check = (path, value, label) => `<label class="check-label"><input type="checkbox" data-mcu-wire="${path}" ${value ? 'checked' : ''}> ${label}</label>`;
  return `<details class="mcu-wiring"><summary>Board wiring</summary><div class="mcu-wiring-grid">
    <div>${check('leds.enabled', w.leds.enabled, 'LEDs on')}${portSelect('leds.port', w.leds.port)}${check('leds.activeLow', w.leds.activeLow, 'active low')}</div>
    <div>${check('switches.enabled', w.switches.enabled, 'DIP switches on')}${portSelect('switches.port', w.switches.port)}</div>
    <div>${check('buttons.enabled', w.buttons.enabled, 'Buttons on P3.2 / P3.3')}</div>
    <div>${check('sevenSegment.enabled', w.sevenSegment.enabled, '7-segment on')}${portSelect('sevenSegment.port', w.sevenSegment.port)}${check('sevenSegment.commonAnode', w.sevenSegment.commonAnode, 'common anode')}</div>
    <div>${check('lcd.enabled', w.lcd.enabled, 'LCD data on')}${portSelect('lcd.dataPort', w.lcd.dataPort)}<label>RS<input data-mcu-wire="lcd.rs" value="${esc(w.lcd.rs)}" size="4"></label><label>RW<input data-mcu-wire="lcd.rw" value="${esc(w.lcd.rw)}" size="4"></label><label>E<input data-mcu-wire="lcd.enable" value="${esc(w.lcd.enable)}" size="4"></label></div>
    <div>${check('keypad.enabled', w.keypad.enabled, '4×4 keypad on')}${portSelect('keypad.port', w.keypad.port)}</div>
  </div></details>`;
}

const MCU_TABS = [['8051', '8051 trainer'], ['arduino', 'Arduino Uno (ATmega328P)']];

// ---------------------------------------------------------------------------
// Lab Bench: function generator, bench supply, oscilloscope and multimeter on the Circuit Lab schematic.

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

function benchConfiguration(state) {
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
function benchCompute(state, config) {
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
function benchScope(config, result) {
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

function renderBench(state) {
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
function bindBenchEvents() {
  document.querySelector('[data-bench-example]')?.addEventListener('change', (event) => { if (event.target.value) loadBenchExample(event.target.value); });
  document.querySelectorAll('[data-bench-field]').forEach((input) => input.addEventListener('change', () => {
    const path = input.dataset.benchField;
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); }
    catch (error) { notify(error.message, 'error'); return; }
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
const RECORD_TEXT_FIELDS = ['institute', 'department', 'course', 'name', 'roll', 'className', 'batch', 'number', 'date', 'title', 'aim', 'apparatus', 'theory', 'procedure', 'observations', 'calculations', 'result', 'conclusion'];

function recordConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'lab-record')?.inputs || {};
  return { ...structuredClone(RECORD_DEFAULTS), ...saved, include: { ...RECORD_DEFAULTS.include, ...(saved.include || {}) } };
}

function persistRecord(patch) {
  const next = { ...recordConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The record text is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'lab-record', kind: 'report', operation: 'lab-record', inputs: next });
}

const lines = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
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
    if (target) target.innerHTML = `<iframe title="Lab record preview" src="${recordPreviewUrl}"></iframe><a href="${recordPreviewUrl}" target="_blank" rel="noopener">Open in a new tab</a>`;
  });
}

// ---------------------------------------------------------------------------
// Power electronics lab.

const POWER_TABS = [['rectifier', 'Rectifiers'], ['dcdc', 'DC-DC converters'], ['inverter', 'Inverters'], ['ac', 'AC voltage controller']];
const POWER_DEFAULTS = Object.freeze({
  tab: 'rectifier',
  rectifier: { type: 'full-bridge', controlled: 'scr', alpha: 30, vrms: 230, frequency: 50, r: 10, l: 0.1, e: 0, c: 0 },
  dcdc: { type: 'buck', vin: 24, duty: 0.5, frequency: 50e3, l: 100e-6, c: 100e-6, r: 10 },
  inverter: { mode: 'spwm-bipolar', vdc: 400, frequency: 50, ma: 0.8, mf: 21, width: 120, r: 10, l: 0.02 },
  ac: { vrms: 230, frequency: 50, alpha: 60, r: 10, l: 0 },
});
let powerCache = { key: null, value: null };

function powerConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'power-lab')?.inputs || {};
  const merged = structuredClone(POWER_DEFAULTS);
  if (saved.tab) merged.tab = saved.tab;
  for (const key of ['rectifier', 'dcdc', 'inverter', 'ac']) Object.assign(merged[key], saved[key] || {});
  return merged;
}
function persistPower(update) { const config = powerConfiguration(getState()); update(config); recordExperiment({ id: 'power-lab', kind: 'power', operation: 'power-lab', inputs: config }); }

function powerCompute(config) {
  const key = JSON.stringify([config.tab, config[config.tab]]);
  if (powerCache.key === key) return powerCache.value;
  let value;
  try {
    const c = config[config.tab];
    if (config.tab === 'rectifier') value = simulateRectifier({ type: c.type, controlled: c.controlled === 'scr', alpha: c.alpha, vm: c.vrms * Math.SQRT2, frequency: c.frequency, r: c.r, l: c.l, e: c.e, c: c.c });
    else if (config.tab === 'dcdc') value = simulateConverter(c);
    else if (config.tab === 'inverter') value = simulateInverter(c);
    else value = simulateAcController({ vm: c.vrms * Math.SQRT2, frequency: c.frequency, alpha: c.alpha, r: c.r, l: c.l });
  } catch (error) { value = { error: error.message }; }
  powerCache = { key, value };
  return value;
}

const powerField = (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" data-power-field="${path}" value="${esc(unit && unit !== '°' ? formatEngineeringValue(Number(value), '', { digits: 4 }).trim() : String(Number(Number(value).toPrecision(6))))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const powerSelect = (path, label, value, options) => labSelect('data-power-select', path, label, value, options);
const degreeTicks = () => Array.from({ length: 9 }, (_, k) => ({ position: k / 8, text: `${k * 45}°` }));
const timeTicks = (stop) => Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(stop * k / 5, 's') }));
const comparisonRow = (label, simulated, theory, unit, digits = 4) => `<tr><td>${esc(label)}</td><td>${simulated === null || simulated === undefined || !Number.isFinite(simulated) ? '—' : esc(unit === '%' ? `${fmt(simulated * 100, 2)} %` : unit ? eng(simulated, unit) : fmt(simulated, digits))}</td><td>${theory === null || theory === undefined || !Number.isFinite(theory) ? '—' : esc(unit === '%' ? `${fmt(theory * 100, 2)} %` : unit ? eng(theory, unit) : fmt(theory, digits))}</td><td>${Number.isFinite(simulated) && Number.isFinite(theory) && Math.abs(theory) > 1e-12 ? `${fmt((simulated - theory) / Math.abs(theory) * 100, 2)} %` : ''}</td></tr>`;
const comparisonTable = (rows, note) => `<table class="truth-table comm-table power-table"><thead><tr><th>Quantity</th><th>Simulated</th><th>Formula</th><th>Difference</th></tr></thead><tbody>${rows.join('')}</tbody></table>${note ? `<p class="field-help">${esc(note)}</p>` : ''}`;
const powerPlot = (title, xs, series, { xMin, xMax, xTicks, unit = 'V' }) => {
  const prepared = series.map((entry, index) => ({ ...decimate(xs, entry.values, 1600), color: entry.color ?? PLOT_COLORS[index], primary: index === 0, dashed: entry.dashed }));
  const values = prepared.flatMap((entry) => entry.ys);
  return `${renderPlotFrame({ title, series: prepared, xMin, xMax, xTicks, yRange: niceRange(Math.min(0, ...values), Math.max(0, ...values)), formatY: (value) => eng(value, unit) })}<div class="plot-legend">${series.map((entry, index) => `<span class="legend-chip" style="--chip:${entry.color ?? PLOT_COLORS[index]}">${esc(entry.name)}</span>`).join('')}</div>`;
};
const spectrumPlot = (title, list, unit) => {
  const xs = list.map((h) => h.order), ys = list.map((h) => h.amplitude);
  const last = xs.at(-1);
  return renderPlotFrame({ title, series: [{ xs, ys, color: PLOT_COLORS[2], stem: true }], xMin: 0, xMax: last, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: String(Math.round(last * k / 5)) })), yRange: niceRange(0, Math.max(...ys)), formatY: (value) => eng(value, unit) });
};

function renderPowerRectifier(c, result) {
  const three = RECTIFIERS[c.type]?.phases === 3;
  const controls = `${powerSelect('rectifier.type', 'Circuit', c.type, Object.entries(RECTIFIERS).map(([id, spec]) => [id, spec.label]))}${powerSelect('rectifier.controlled', 'Devices', c.controlled, [['scr', 'Thyristors (SCR)'], ['diode', 'Diodes']])}${c.controlled === 'scr' ? powerField('rectifier.alpha', 'Firing angle α', c.alpha, '°') : ''}${powerField('rectifier.vrms', three ? 'Phase voltage (RMS)' : 'Supply voltage (RMS)', c.vrms, 'V')}${powerField('rectifier.frequency', 'Frequency', c.frequency, 'Hz')}${powerField('rectifier.r', 'Load R', c.r, 'Ω')}${powerField('rectifier.l', 'Load L', c.l, 'H')}${powerField('rectifier.e', 'Back EMF E', c.e, 'V')}${c.controlled === 'diode' && !three ? powerField('rectifier.c', 'Filter C', c.c, 'F') : ''}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Rectifier</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, xs = w.theta.map((theta) => theta * 180 / Math.PI);
  const sources = three ? [0, 1, 2].map((p) => ({ name: `v${'abc'[p]}`, values: w.phases.map((v) => v[p]), color: ['#64748b', '#94a3b8', '#cbd5e1'][p], dashed: true })) : [{ name: 'vs', values: w.vs, color: '#64748b', dashed: true }];
  const voltagePlot = powerPlot('Output voltage', xs, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }, ...sources], { xMin: 0, xMax: 360, xTicks: degreeTicks() });
  const currentPlot = powerPlot('Currents', xs, [{ name: 'io (load)', values: w.io, color: PLOT_COLORS[1] }, { name: three ? 'ia (supply)' : 'is (supply)', values: w.is, color: PLOT_COLORS[3] }], { xMin: 0, xMax: 360, xTicks: degreeTicks(), unit: 'A' });
  const devicePlot = powerPlot('Voltage across T1 / D1', xs, [{ name: 'vT1', values: w.vt, color: PLOT_COLORS[4] }], { xMin: 0, xMax: 360, xTicks: degreeTicks() });
  const t = result.theory;
  const table = comparisonTable([
    comparisonRow('Average output voltage Vdc', result.vdc, t.vdc, 'V'), comparisonRow('RMS output voltage', result.vrms, t.vrms, 'V'), comparisonRow('Output ripple (peak-peak)', result.ripple, t.ripple, 'V'),
    comparisonRow('Average load current', result.idc, null, 'A'), comparisonRow('RMS load current', result.irms, null, 'A'), comparisonRow('Form factor', result.formFactor, null, ''), comparisonRow('Ripple factor', result.rippleFactor, null, ''),
    comparisonRow('Load power', result.loadPower, null, 'W'), comparisonRow('Input power factor', result.inputPowerFactor, null, ''), comparisonRow('Displacement factor cos φ1', result.displacementFactor, null, ''), comparisonRow('Supply-current THD', result.currentThd, null, '%'),
  ], `${t.note ?? ''}${result.continuous === false ? ' Load current is discontinuous.' : result.continuous ? ' Load current is continuous.' : ''}`);
  return { controls, body: `<div class="power-grid"><div>${voltagePlot}${currentPlot}${devicePlot}</div><div>${table}${spectrumPlot(`Supply-current harmonics (peak, ${three ? 'phase a' : 'line'})`, result.sourceHarmonics, 'A')}</div></div>` };
}

function renderPowerConverter(c, result) {
  const controls = `${powerSelect('dcdc.type', 'Converter', c.type, Object.entries(CONVERTERS))}${powerField('dcdc.vin', 'Input voltage', c.vin, 'V')}${powerField('dcdc.duty', 'Duty cycle D', c.duty)}${powerField('dcdc.frequency', 'Switching frequency', c.frequency, 'Hz')}${powerField('dcdc.l', 'Inductor L', c.l, 'H')}${powerField('dcdc.c', 'Capacitor C', c.c, 'F')}${powerField('dcdc.r', 'Load R', c.r, 'Ω')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Converter</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, stop = w.t.at(-1);
  const t = result.theory;
  const table = comparisonTable([
    `<tr><td>Conduction mode</td><td>${result.mode}</td><td>${t.ccm ? 'CCM' : 'DCM'} (L${t.ccm ? ' ≥ ' : ' < '}Lcrit = ${esc(eng(t.criticalL, 'H'))})</td><td></td></tr>`,
    comparisonRow('Output voltage Vo', result.vo, t.vo, 'V'), comparisonRow('Voltage ratio Vo/Vin', result.ratio, t.ratio, ''), comparisonRow('Inductor current ripple ΔiL', result.rippleI, t.rippleI, 'A'), comparisonRow('Output voltage ripple ΔVo', result.rippleV, t.rippleV, 'V'),
    comparisonRow('Average inductor current', result.ilAverage, t.il, 'A'), comparisonRow('Peak inductor / switch current', result.ilMax, null, 'A'), comparisonRow('Output power', result.outputPower, null, 'W'),
  ], 'Ideal switch and diode. Formulas: buck Vo = D·Vin, boost Vo = Vin/(1 − D), buck-boost Vo = −D·Vin/(1 − D) in CCM; DCM uses K = 2Lf/R.');
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Gate signal and switch voltage', w.t, [{ name: 'vsw (switch)', values: w.vsw, color: PLOT_COLORS[4] }, { name: 'gate × Vin', values: w.gate.map((g) => g * c.vin), color: '#64748b', dashed: true }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}${powerPlot('Inductor, switch and diode current', w.t, [{ name: 'iL', values: w.il, color: PLOT_COLORS[1] }, { name: 'i switch', values: w.isw, color: PLOT_COLORS[3], dashed: true }, { name: 'i diode', values: w.idiode, color: PLOT_COLORS[5], dashed: true }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop), unit: 'A' })}${powerPlot('Output voltage', w.t, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}</div><div>${table}</div></div>` };
}

function renderPowerInverter(c, result) {
  const spwm = c.mode.includes('spwm');
  const controls = `${powerSelect('inverter.mode', 'Inverter', c.mode, Object.entries(INVERTERS))}${powerField('inverter.vdc', 'DC link voltage', c.vdc, 'V')}${powerField('inverter.frequency', 'Output frequency', c.frequency, 'Hz')}${spwm ? `${powerField('inverter.ma', 'Modulation index ma', c.ma)}${powerField('inverter.mf', 'Frequency ratio mf', c.mf)}` : ''}${c.mode === 'quasi-square' ? powerField('inverter.width', 'Pulse width', c.width, '°') : ''}${powerField('inverter.r', 'Load R', c.r, 'Ω')}${powerField('inverter.l', 'Load L', c.l, 'H')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Inverter</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, stop = 1 / c.frequency;
  const three = c.mode.startsWith('three');
  const t = result.theory;
  const count = Math.min(result.spectrum.length, spwm ? Math.max(25, Math.ceil(c.mf * 2.5)) : 25);
  const table = comparisonTable([
    comparisonRow(three ? 'Fundamental line voltage (peak)' : 'Fundamental output voltage (peak)', result.fundamentalPeak, t.fundamentalPeak, 'V'), comparisonRow('Fundamental (RMS)', result.fundamentalRms, t.fundamentalPeak ? t.fundamentalPeak / Math.SQRT2 : null, 'V'),
    comparisonRow('RMS output voltage', result.vrms, t.vrms, 'V'), comparisonRow('Voltage THD', result.voltageThd, t.thd, '%'), comparisonRow('Load-current THD', result.currentThd, null, '%'), comparisonRow(three ? 'Load power (per phase)' : 'Load power', result.loadPower, null, 'W'),
  ], `${t.note ?? ''} Load current computed as the steady-state response of R + jωL to every harmonic.`);
  const voltages = [{ name: three ? 'vab (line)' : 'vo', values: w.vo, color: PLOT_COLORS[0] }, ...(w.vphase ? [{ name: 'van (phase, star load)', values: w.vphase, color: PLOT_COLORS[2] }] : [])];
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Output voltage', w.t, voltages, { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}${powerPlot('Load current', w.t, [{ name: 'io', values: w.io, color: PLOT_COLORS[1] }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop), unit: 'A' })}</div><div>${table}${spectrumPlot(`${three ? 'Line-voltage' : 'Output-voltage'} harmonics (peak) up to order ${count}`, result.spectrum.slice(0, count), 'V')}</div></div>` };
}

function renderPowerAc(c, result) {
  const controls = `${powerField('ac.vrms', 'Supply voltage (RMS)', c.vrms, 'V')}${powerField('ac.frequency', 'Frequency', c.frequency, 'Hz')}${powerField('ac.alpha', 'Firing angle α', c.alpha, '°')}${powerField('ac.r', 'Load R', c.r, 'Ω')}${powerField('ac.l', 'Load L', c.l, 'H')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>AC controller</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, xs = w.theta.map((theta) => theta * 180 / Math.PI);
  const table = comparisonTable([comparisonRow('RMS output voltage', result.vrms, result.theory.vrms, 'V'), comparisonRow('RMS current', result.irms, null, 'A'), comparisonRow('Load power', result.power, null, 'W'), comparisonRow('Input power factor', result.powerFactor, null, ''), comparisonRow('Current THD', result.currentThd, null, '%')], result.theory.note);
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Output voltage', xs, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }, { name: 'vs', values: w.vs, color: '#64748b', dashed: true }], { xMin: 0, xMax: 360, xTicks: degreeTicks() })}${powerPlot('Load current', xs, [{ name: 'io', values: w.io, color: PLOT_COLORS[1] }], { xMin: 0, xMax: 360, xTicks: degreeTicks(), unit: 'A' })}</div><div>${table}${spectrumPlot('Current harmonics (peak)', result.harmonics, 'A')}</div></div>` };
}

function renderPower(state) {
  const config = powerConfiguration(state);
  const result = powerCompute(config);
  const view = config.tab === 'dcdc' ? renderPowerConverter(config.dcdc, result) : config.tab === 'inverter' ? renderPowerInverter(config.inverter, result) : config.tab === 'ac' ? renderPowerAc(config.ac, result) : renderPowerRectifier(config.rectifier, result);
  return `<div class="page scroll-page power-page">${pageHeader(modules.find((item) => item.id === 'power'), 'POWER ELECTRONICS', '<span class="pill live"><i></i> IDEAL-SWITCH SIMULATION</span>')}
    ${labTabs(POWER_TABS, config.tab, 'data-power-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>
    <p class="module-footnote">Ideal switches and diodes (no forward drop, instant turn-off) and no source inductance, so commutation is instantaneous — the same assumptions as the textbook formulas shown beside every result. A DCM buck converter matches ngspice to 0.02 %.</p></div>`;
}

const POWER_DEGREE_FIELDS = new Set(['rectifier.alpha', 'ac.alpha', 'inverter.width']);
function bindPowerEvents() {
  document.querySelectorAll('[data-power-tab]').forEach((button) => button.addEventListener('click', () => persistPower((config) => { config.tab = button.dataset.powerTab; })));
  document.querySelectorAll('[data-power-field]').forEach((input) => input.addEventListener('change', () => {
    const [group, key] = input.dataset.powerField.split('.');
    let value;
    try { value = POWER_DEGREE_FIELDS.has(input.dataset.powerField) ? Number(input.value) : engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); if (!Number.isFinite(value)) throw new RangeError('Enter a number.'); }
    catch (error) { notify(error.message, 'error'); return; }
    persistPower((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll('[data-power-select]').forEach((select) => select.addEventListener('change', () => {
    const [group, key] = select.dataset.powerSelect.split('.');
    persistPower((config) => { config[group][key] = select.value; if (group === 'rectifier' && (key === 'controlled' || key === 'type')) { if (config.rectifier.controlled === 'scr' || RECTIFIERS[config.rectifier.type].phases === 3) config.rectifier.c = 0; } });
  }));
}

// ---------------------------------------------------------------------------
// ADC & DAC lab.

const ADC_TABS = [['quantise', 'Transfer, DNL/INL & SNR'], ['sar', 'SAR'], ['flash', 'Flash'], ['dual', 'Dual-slope'], ['sigma', 'Sigma-delta'], ['dac', 'DAC']];
const ADC_DEFAULTS = Object.freeze({
  tab: 'quantise',
  quantise: { bits: 8, vref: 5, offsetLsb: 0, gainErrorPercent: 0, bowLsb: 0, mismatchLsb: 0, noiseLsb: 0, seed: 1 },
  sar: { bits: 8, vref: 5, vin: 3.3 }, flash: { bits: 3, vref: 5, vin: 3.3 },
  dual: { bits: 12, vref: 2, vin: 1.234, clock: 204_800, r: 100e3, c: 1e-6 },
  sigma: { order: 2, osr: 64, amplitude: 0.5 },
  dac: { kind: 'r2r', bits: 8, vref: 5, tolerancePercent: 1, seed: 4, code: 128 },
});
let adcCache = { key: null, value: null };
function adcConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'adc-lab')?.inputs || {};
  const merged = structuredClone(ADC_DEFAULTS);
  if (saved.tab) merged.tab = saved.tab;
  for (const key of Object.keys(ADC_DEFAULTS)) if (key !== 'tab') Object.assign(merged[key], saved[key] || {});
  return merged;
}
function persistAdc(update) { const config = adcConfiguration(getState()); update(config); recordExperiment({ id: 'adc-lab', kind: 'converter', operation: 'adc-lab', inputs: config }); }
const adcField = (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" data-adc-field="${path}" value="${esc(String(Number(Number(value).toPrecision(6))))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const adcSelect = (path, label, value, options) => labSelect('data-adc-select', path, label, value, options);
const binary = (value, bits) => value.toString(2).padStart(bits, '0');
const indexTicks5 = (last) => Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: String(Math.round(last * k / 5)) }));
const adcPlot = (title, xs, ys, { color = PLOT_COLORS[0], stem = false, unit = '', xMin = xs[0], xMax = xs.at(-1), xTicks = indexTicks5(xMax), extra = [], yMin = null, yMax = null } = {}) => {
  const series = [{ ...(stem ? { xs, ys } : decimate(xs, ys, 1600)), color, primary: true, stem }, ...extra.map((entry) => ({ ...decimate(entry.xs, entry.ys, 1600), color: entry.color, dashed: entry.dashed }))];
  const values = series.flatMap((entry) => entry.ys).filter(Number.isFinite);
  return renderPlotFrame({ title, series, xMin, xMax, xTicks, yRange: niceRange(yMin ?? Math.min(...values), yMax ?? Math.max(...values)), formatY: (value) => (unit ? eng(value, unit) : fmt(value, 3)) });
};

function renderAdcQuantise(c) {
  const adc = adcThresholds(c);
  const lin = linearity(adc);
  const dyn = dynamicTest(adc, { n: 8192, noiseLsb: c.noiseLsb });
  const levels = 2 ** c.bits;
  const shown = Math.min(levels, 64);
  const xs = [], ys = [];
  for (let k = 0; k <= shown * 8; k += 1) { const v = k / (shown * 8) * shown * adc.lsb; xs.push(v); ys.push(adcCode(adc, v)); }
  const codes = lin.dnl.map((_, k) => k + 1);
  const bins = dyn.spectrumDbfs.map((_, k) => k / 8192);
  const controls = `${adcField('quantise.bits', 'Resolution', c.bits, 'bit')}${adcField('quantise.vref', 'Reference', c.vref, 'V')}${adcField('quantise.offsetLsb', 'Offset', c.offsetLsb, 'LSB')}${adcField('quantise.gainErrorPercent', 'Gain error', c.gainErrorPercent, '%')}${adcField('quantise.bowLsb', 'Bow INL', c.bowLsb, 'LSB')}${adcField('quantise.mismatchLsb', 'Comparator mismatch σ', c.mismatchLsb, 'LSB')}${adcField('quantise.noiseLsb', 'Input noise σ', c.noiseLsb, 'LSB')}${adcField('quantise.seed', 'Random seed', c.seed)}`;
  const table = comparisonTable([
    comparisonRow('LSB size', adc.lsb, c.vref / levels, 'V'), comparisonRow('SNR', dyn.snr, dyn.idealSnr, ''), comparisonRow('SINAD', dyn.sinad, dyn.idealSnr, ''), comparisonRow('ENOB (bits)', dyn.enob, c.bits, ''),
    comparisonRow('SFDR (dBc)', dyn.sfdr, null, ''), comparisonRow('THD (dBc)', dyn.thd, null, ''), comparisonRow('Offset error (LSB)', lin.offsetLsb, null, ''), comparisonRow('Gain error (%)', lin.gainErrorPercent, null, ''),
    comparisonRow('Max |DNL| (LSB)', lin.maxDnl, 0, ''), comparisonRow('Max |INL| (LSB)', lin.maxInl, 0, ''), `<tr><td>Missing codes</td><td>${lin.missingCodes.length ? esc(lin.missingCodes.slice(0, 8).join(', ')) + (lin.missingCodes.length > 8 ? '…' : '') : 'none'}</td><td>none</td><td></td></tr>`,
  ], `Formula column: an ideal ADC, SNR = 6.02·N + 1.76 dB for a full-scale sine. Dynamic test: ${dyn.cycles} cycles of a 99.9 % full-scale sine coherently sampled in 8192 points. DNL/INL by the end-point method.`);
  return { controls, body: `<div class="power-grid"><div>${adcPlot(`Transfer function (first ${shown} codes)`, xs, ys, { unit: '', xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(shown * adc.lsb * k / 5, 'V') })) })}${adcPlot('DNL (LSB)', codes, lin.dnl, { stem: codes.length <= 256, color: PLOT_COLORS[3] })}${adcPlot('INL (LSB, end-point)', lin.inl.map((_, k) => k + 1), lin.inl, { color: PLOT_COLORS[4] })}</div><div>${table}${adcPlot('Output spectrum (dBFS) vs frequency / fs', bins, dyn.spectrumDbfs, { color: PLOT_COLORS[2], xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(k / 10, 2) })), yMin: Math.max(-160, Math.min(...dyn.spectrumDbfs)), yMax: 0 })}</div></div>` };
}

function renderAdcSar(c) {
  const result = sarConvert(c.vin, c);
  const controls = `${adcField('sar.vin', 'Input voltage', c.vin, 'V')}${adcField('sar.bits', 'Resolution', c.bits, 'bit')}${adcField('sar.vref', 'Reference', c.vref, 'V')}`;
  const rows = result.steps.map((step, index) => `<tr><td>${index + 1}</td><td>D${step.bit}</td><td>${binary(step.trial, c.bits)}</td><td>${esc(eng(step.dac, 'V'))}</td><td>${step.keep ? 'Vin ≥ DAC → keep 1' : 'Vin < DAC → clear to 0'}</td><td>${binary(step.code, c.bits)}</td></tr>`).join('');
  const xs = result.steps.flatMap((_, k) => [k, k + 1]), ys = result.steps.flatMap((step) => [step.dac, step.dac]);
  return { controls, body: `<div class="power-grid"><div>${adcPlot('DAC trial voltage at each clock (dashed: Vin)', xs, ys, { unit: 'V', xMin: 0, xMax: c.bits, xTicks: Array.from({ length: c.bits + 1 }, (_, k) => ({ position: k / c.bits, text: String(k) })), extra: [{ xs: [0, c.bits], ys: [c.vin, c.vin], color: '#94a3b8', dashed: true }], yMin: 0, yMax: c.vref })}</div><div><table class="truth-table comm-table power-table"><thead><tr><th>Clock</th><th>Bit tried</th><th>Trial code</th><th>DAC voltage</th><th>Comparator</th><th>Register</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="analysis-readouts">${readout('Result', `${result.code} = ${binary(result.code, c.bits)}₂ = ${result.code.toString(16).toUpperCase()}h`)}${readout('DAC value of result', eng(result.voltage, 'V'))}${readout('Conversion time', `${result.clocks} clocks`)}${readout('Quantisation error', eng(c.vin - result.voltage, 'V'))}</div><p class="field-help">The SAR tries each bit from the MSB down: the bit stays 1 if the input is at least the DAC voltage. An N-bit conversion always takes N comparisons.</p></div></div>` };
}

function renderAdcFlash(c) {
  const bits = Math.min(6, Math.max(1, Math.round(c.bits)));
  const result = flashConvert(c.vin, { bits, vref: c.vref });
  const controls = `${adcField('flash.vin', 'Input voltage', c.vin, 'V')}${adcField('flash.bits', 'Resolution (≤ 6 shown)', bits, 'bit')}${adcField('flash.vref', 'Reference', c.vref, 'V')}`;
  const rows = result.references.map((reference, k) => ({ k, reference, out: result.thermometer[k] })).reverse().map(({ k, reference, out }) => `<tr class="${out ? 'on' : ''}"><td>C${k + 1}</td><td>${esc(eng(reference, 'V'))}</td><td>${out}</td></tr>`).join('');
  return { controls, body: `<div class="power-grid"><div><table class="truth-table comm-table power-table flash-table"><thead><tr><th>Comparator</th><th>Reference (ladder tap)</th><th>Output</th></tr></thead><tbody>${rows}</tbody></table></div><div class="analysis-readouts">${readout('Thermometer code', result.thermometer.slice().reverse().join(''))}${readout('Binary output', `${result.code} = ${binary(result.code, bits)}₂`)}${readout('Comparators', String(result.comparators))}${readout('Ladder resistors', String(result.resistors))}${readout('Conversion', 'one clock (all comparators in parallel)')}<p class="field-help">The ladder (R/2 at the bottom) puts the comparator thresholds at (k − ½)·LSB, so the flash ADC rounds to the nearest code. Comparators grow as 2ᴺ − 1: 255 for 8 bits.</p></div></div>` };
}

function renderAdcDual(c) {
  const result = dualSlope(Math.min(c.vref, Math.max(0, c.vin)), c);
  const controls = `${adcField('dual.vin', 'Input voltage', c.vin, 'V')}${adcField('dual.vref', 'Reference', c.vref, 'V')}${adcField('dual.bits', 'Counter', c.bits, 'bit')}${adcField('dual.clock', 'Clock', c.clock, 'Hz')}${adcField('dual.r', 'Integrator R', c.r, 'Ω')}${adcField('dual.c', 'Integrator C', c.c, 'F')}`;
  const frequencies = Array.from({ length: 401 }, (_, k) => k * 0.5);
  const rejection = frequencies.map((f) => 20 * Math.log10(Math.max(1e-6, integratingRejection(f, result.t1))));
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Integrator output', result.waveform.map(([t]) => t), result.waveform.map(([, v]) => v), { unit: 'V', xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(result.conversionTime * k / 5, 's') })) })}${adcPlot('Normal-mode rejection (dB) vs frequency (Hz)', frequencies, rejection, { color: PLOT_COLORS[3], xTicks: Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: String(k * 50) })), yMin: -60, yMax: 0 })}</div><div class="analysis-readouts">${readout('T1 (fixed, 2ᴺ clocks)', eng(result.t1, 's'))}${readout('Integrator peak', eng(result.peak, 'V'))}${readout('T2 (de-integrate)', eng(result.t2, 's'))}${readout('Count', `${result.count} of ${result.n1}`)}${readout('Result', eng(result.resultVoltage, 'V'))}${readout('Conversion time', eng(result.conversionTime, 's'))}<p class="field-help">Count = 2ᴺ·Vin/Vref: R, C and the clock frequency cancel out. With T1 = 20 ms, 50 Hz mains hum (and its harmonics) integrates to zero — the reason DMMs use integrating ADCs.</p></div></div>` };
}

function renderAdcSigma(c) {
  const result = sigmaDelta({ order: Number(c.order), osr: c.osr, amplitude: c.amplitude });
  const controls = `${adcSelect('sigma.order', 'Modulator order', c.order, [[1, 'First order'], [2, 'Second order']])}${adcField('sigma.osr', 'Oversampling ratio', c.osr)}${adcField('sigma.amplitude', 'Input amplitude', c.amplitude, '× FS')}`;
  const shown = 256, start = 0;
  const idx = Array.from({ length: shown }, (_, k) => start + k);
  const input = idx.map((k) => c.amplitude * Math.sin(2 * Math.PI * result.cycles * k / result.bitstream.length));
  const half = result.spectrumDb.length;
  const xs = result.spectrumDb.map((_, k) => k / (2 * (half - 1)));
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Bitstream (first 256 samples) and input', idx, idx.map((k) => result.bitstream[k]), { color: PLOT_COLORS[0], extra: [{ xs: idx, ys: input, color: PLOT_COLORS[2] }], yMin: -1.2, yMax: 1.2 })}${adcPlot('Decimated output (sinc filter, ÷ OSR)', result.decimated.map((s) => s.index), result.decimated.map((s) => s.value), { color: PLOT_COLORS[1], yMin: -1, yMax: 1 })}</div><div>${comparisonTable([comparisonRow('In-band SQNR (dB)', result.sqnr, result.theorySqnrFullScale + 20 * Math.log10(c.amplitude), ''), comparisonRow('Density of ones', result.ones, 0.5, ''), comparisonRow('Signal bin / band edge', result.cycles, result.bandEdgeBin, '')], `Formula: linear noise model (${c.order === 2 || Number(c.order) === 2 ? 'SQNR = 6.02 + 1.76 − 12.9 + 50·log OSR' : 'SQNR = 6.02 + 1.76 − 5.17 + 30·log OSR'}) for this input level; a real 1-bit loop falls a few dB short because the quantiser gain is not 1.`)}${adcPlot('Bitstream spectrum (dB) vs f / fs — noise is pushed out of band', xs, result.spectrumDb, { color: PLOT_COLORS[2], xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(k / 10, 2) })), extra: [{ xs: [0.5 / c.osr, 0.5 / c.osr], ys: [-180, 0], color: '#f97316', dashed: true }], yMin: -160, yMax: 0 })}</div></div>` };
}

function renderAdcDac(c) {
  const result = (c.kind === 'weighted' ? weightedDac : r2rDac)(c);
  const levels = result.levels.length;
  const code = Math.max(0, Math.min(levels - 1, Math.round(c.code)));
  const controls = `${adcSelect('dac.kind', 'Architecture', c.kind, [['r2r', 'R-2R ladder'], ['weighted', 'Binary-weighted resistors']])}${adcField('dac.bits', 'Resolution', c.bits, 'bit')}${adcField('dac.vref', 'Reference', c.vref, 'V')}${adcField('dac.tolerancePercent', 'Resistor tolerance', c.tolerancePercent, '%')}${adcField('dac.seed', 'Random seed', c.seed)}${adcField('dac.code', 'Digital input', code)}`;
  const codes = result.levels.map((_, k) => k);
  const xs = codes.flatMap((k) => [k, k + 1]), ys = result.levels.flatMap((v) => [v, v]);
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Output voltage for every code', xs, ys, { unit: 'V', xMin: 0, xMax: levels })}${adcPlot('DNL (LSB)', codes.slice(1), result.dnl, { stem: levels <= 256, color: PLOT_COLORS[3] })}${adcPlot('INL (LSB)', codes, result.inl, { color: PLOT_COLORS[4] })}</div><div>${comparisonTable([comparisonRow(`Output for ${code} (${binary(code, c.bits)}₂)`, result.levels[code], code * c.vref / levels, 'V'), comparisonRow('Full-scale output', result.fullScale, (levels - 1) * c.vref / levels, 'V'), comparisonRow('LSB step', result.lsb, result.idealLsb, 'V'), comparisonRow('Max |DNL| (LSB)', result.maxDnl, 0, ''), comparisonRow('Max |INL| (LSB)', result.maxInl, 0, '')], `${result.kind}: ${result.resistorCount} resistors, value spread ${result.resistorSpread}:1. ${result.monotonic ? 'Monotonic.' : 'Not monotonic!'} Worst step at code ${result.worstStep} (a major carry). Vout = Vref·D / 2ᴺ when the resistors are exact.`)}</div></div>` };
}

function renderAdcLab(state) {
  const config = adcConfiguration(state);
  const key = JSON.stringify([config.tab, config[config.tab]]);
  let view;
  if (adcCache.key === key) view = adcCache.value;
  else {
    try { const c = config[config.tab]; view = config.tab === 'sar' ? renderAdcSar(c) : config.tab === 'flash' ? renderAdcFlash(c) : config.tab === 'dual' ? renderAdcDual(c) : config.tab === 'sigma' ? renderAdcSigma(c) : config.tab === 'dac' ? renderAdcDac(c) : renderAdcQuantise(c); }
    catch (error) { view = { controls: '', body: `<div class="diagnostic error"><b>Converter</b><span>${esc(error.message)}</span></div>` }; }
    adcCache = { key, value: view };
  }
  return `<div class="page scroll-page power-page adc-page">${pageHeader(modules.find((item) => item.id === 'adc'), 'DATA CONVERTERS', '<span class="pill live"><i></i> BIT-ACCURATE</span>')}
    ${labTabs(ADC_TABS, config.tab, 'data-adc-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

const ADC_INTEGER_FIELDS = new Set(['quantise.bits', 'quantise.seed', 'sar.bits', 'flash.bits', 'dual.bits', 'sigma.osr', 'dac.bits', 'dac.seed', 'dac.code']);
function bindAdcEvents() {
  document.querySelectorAll('[data-adc-tab]').forEach((button) => button.addEventListener('click', () => persistAdc((config) => { config.tab = button.dataset.adcTab; })));
  document.querySelectorAll('[data-adc-field]').forEach((input) => input.addEventListener('change', () => {
    const path = input.dataset.adcField;
    const [group, key] = path.split('.');
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); } catch (error) { notify(error.message, 'error'); return; }
    if (ADC_INTEGER_FIELDS.has(path)) value = Math.round(value);
    if (path.endsWith('bits')) value = Math.min(path.startsWith('flash') ? 6 : path.startsWith('dual') ? 20 : path.startsWith('dac') ? 14 : 16, Math.max(1, value));
    if (path === 'sigma.osr') value = Math.min(512, Math.max(4, value));
    persistAdc((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll('[data-adc-select]').forEach((select) => select.addEventListener('change', () => { const [group, key] = select.dataset.adcSelect.split('.'); persistAdc((config) => { config[group][key] = key === 'order' ? Number(select.value) : select.value; }); }));
}

// ---------------------------------------------------------------------------
// Sensors & instrumentation and EV engineering.

const numericText = (value) => String(Number(Number(value).toPrecision(6)));
const groupField = (attribute) => (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" ${attribute}="${path}" value="${esc(numericText(value))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const linePlot = (title, xs, series, { xLabel = (value) => fmt(value, 3), unit = '', yMin = null, yMax = null } = {}) => {
  const prepared = series.map((entry, index) => ({ ...decimate(xs, entry.values, 1200), color: entry.color ?? PLOT_COLORS[index], primary: index === 0, dashed: entry.dashed }));
  const values = prepared.flatMap((entry) => entry.ys).filter(Number.isFinite);
  const xMin = xs[0], xMax = xs.at(-1);
  return `${renderPlotFrame({ title, series: prepared, xMin, xMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: xLabel(xMin + (xMax - xMin) * k / 5) })), yRange: niceRange(yMin ?? Math.min(...values), yMax ?? Math.max(...values)), formatY: (value) => (unit ? eng(value, unit) : fmt(value, 3)) })}${series.length > 1 ? `<div class="plot-legend">${series.map((entry, index) => `<span class="legend-chip" style="--chip:${entry.color ?? PLOT_COLORS[index]}">${esc(entry.name)}</span>`).join('')}</div>` : ''}`;
};
function makeLab(id, defaults) {
  const configuration = (state) => {
    const saved = state.project.experiments.find((experiment) => experiment?.id === id)?.inputs || {};
    const merged = structuredClone(defaults);
    if (saved.tab) merged.tab = saved.tab;
    for (const key of Object.keys(defaults)) if (key !== 'tab') Object.assign(merged[key], saved[key] || {});
    return merged;
  };
  const persist = (update) => { const config = configuration(getState()); update(config); recordExperiment({ id, kind: 'calculator', operation: id, inputs: config }); };
  return { configuration, persist };
}
function bindLabControls(prefix, lab, stringKeys = []) {
  document.querySelectorAll(`[data-${prefix}-tab]`).forEach((button) => button.addEventListener('click', () => lab.persist((config) => { config.tab = button.dataset[`${prefix}Tab`]; })));
  document.querySelectorAll(`[data-${prefix}-field]`).forEach((input) => input.addEventListener('change', () => {
    const [group, key] = input.dataset[`${prefix}Field`].split('.');
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); } catch (error) { notify(error.message, 'error'); return; }
    lab.persist((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll(`[data-${prefix}-select]`).forEach((select) => select.addEventListener('change', () => {
    const [group, key] = select.dataset[`${prefix}Select`].split('.');
    lab.persist((config) => { config[group][key] = stringKeys.includes(key) || Number.isNaN(Number(select.value)) ? select.value : Number(select.value); });
  }));
}

const SENSOR_TABS = [['thermocouple', 'Thermocouples'], ['resistive', 'RTD & thermistor'], ['bridge', 'Bridges & LVDT'], ['chain', 'Measurement chain']];
const sensorLab = makeLab('sensor-lab', {
  tab: 'thermocouple',
  thermocouple: { type: 'K', hot: 300, cold: 25, measuredMv: 11.208 },
  resistive: { r0: 100, temperature: 100, ohms: 138.5055, r25: 10_000, beta: 3950, t1: 0, r1: 32_650, t2: 25, r2: 10_000, t3: 50, r3: 3_603 },
  bridge: { config: 'quarter', vex: 5, gaugeFactor: 2, strain: 1e-3, r: 350, lvdtMm: 1.5, lvdtSensitivity: 50, lvdtVex: 3 },
  chain: { sensor: 'pt100', tMin: 0, tMax: 200, adcBits: 12, vref: 5, inamp: 'ad620', linearize: 'exact', excitation: 1e-3 },
});
const sensorField = groupField('data-sensor-field');
const sensorSelect = (path, label, value, options) => labSelect('data-sensor-select', path, label, value, options);

function renderSensorTab(config) {
  const c = config[config.tab];
  if (config.tab === 'thermocouple') {
    const emf = thermocoupleEmf(c.type, c.hot), cold = thermocoupleEmf(c.type, c.cold);
    const cj = coldJunction({ type: c.type, measuredMv: c.measuredMv, coldC: c.cold });
    const [low, high] = [THERMOCOUPLE_COEFFICIENTS[c.type][0][0], THERMOCOUPLE_COEFFICIENTS[c.type].at(-1)[1]];
    const ts = Array.from({ length: 241 }, (_, k) => low + (high - low) * k / 240);
    const controls = `${sensorSelect('thermocouple.type', 'Type', c.type, Object.entries(THERMOCOUPLE_TYPES))}${sensorField('thermocouple.hot', 'Hot junction', c.hot, '°C')}${sensorField('thermocouple.cold', 'Cold (reference) junction', c.cold, '°C')}${sensorField('thermocouple.measuredMv', 'Measured voltage', c.measuredMv, 'mV')}`;
    const body = `<div class="power-grid"><div>${linePlot(`Type ${c.type} EMF (mV) vs temperature (°C), reference 0 °C`, ts, [{ name: 'E(T)', values: ts.map((t) => thermocoupleEmf(c.type, t)) }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('Seebeck coefficient (µV/°C)', ts, [{ name: 'S(T)', values: ts.map((t) => seebeck(c.type, t)) }], { xLabel: (v) => `${Math.round(v)}` })}</div>
      <div class="analysis-readouts">${readout(`E(${c.hot} °C), reference 0 °C`, `${fmt(emf, 5)} mV`)}${readout(`E(${c.cold} °C) of the cold junction`, `${fmt(cold, 5)} mV`)}${readout('Voltmeter reading E(hot) − E(cold)', `${fmt(emf - cold, 5)} mV`)}${readout('Seebeck coefficient at the hot junction', `${fmt(seebeck(c.type, c.hot), 4)} µV/°C`)}
      <span class="panel-label">FROM A MEASURED VOLTAGE</span>${readout('Compensated temperature', `${fmt(cj.hotC, 4)} °C`)}${readout('Without cold-junction compensation', `${fmt(cj.uncompensatedC, 4)} °C`)}${readout('Straight line (Seebeck at 0 °C)', `${fmt(cj.linearC, 4)} °C`)}<p class="field-help">NIST ITS-90 reference functions (NIST SRD 60). The voltmeter sees E(T_hot) − E(T_cold), so the cold-junction EMF is added back before inverting the table.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'resistive') {
    const sh = steinhartHart([[c.t1, c.r1], [c.t2, c.r2], [c.t3, c.r3]]);
    const ts = Array.from({ length: 201 }, (_, k) => -50 + k);
    const controls = `${sensorSelect('resistive.r0', 'Platinum RTD', c.r0, [[100, 'Pt100'], [1000, 'Pt1000']])}${sensorField('resistive.temperature', 'Temperature', c.temperature, '°C')}${sensorField('resistive.ohms', 'Measured RTD resistance', c.ohms, 'Ω')}${sensorField('resistive.r25', 'NTC R25', c.r25, 'Ω')}${sensorField('resistive.beta', 'NTC β', c.beta, 'K')}${sensorField('resistive.t1', 'SH point 1', c.t1, '°C')}${sensorField('resistive.r1', 'R at point 1', c.r1, 'Ω')}${sensorField('resistive.t2', 'SH point 2', c.t2, '°C')}${sensorField('resistive.r2', 'R at point 2', c.r2, 'Ω')}${sensorField('resistive.t3', 'SH point 3', c.t3, '°C')}${sensorField('resistive.r3', 'R at point 3', c.r3, 'Ω')}`;
    const ntcAt = ntcResistance(c.temperature, c);
    const body = `<div class="power-grid"><div>${linePlot(`Pt${c.r0} resistance (Ω) vs temperature (°C)`, ts, [{ name: 'RTD', values: ts.map((t) => rtdResistance(t, { r0: c.r0 })) }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('NTC resistance (Ω, β model) vs temperature (°C)', ts, [{ name: 'NTC', values: ts.map((t) => ntcResistance(t, c)) }], { xLabel: (v) => `${Math.round(v)}` })}</div>
      <div class="analysis-readouts">${readout(`Pt${c.r0} at ${c.temperature} °C`, `${fmt(rtdResistance(c.temperature, { r0: c.r0 }), 6)} Ω`)}${readout(`Temperature for ${c.ohms} Ω`, `${fmt(rtdTemperature(c.ohms, { r0: c.r0 }), 5)} °C`)}${readout('Mean sensitivity 0–100 °C', `${fmt((rtdResistance(100, { r0: c.r0 }) - c.r0) / 100, 5)} Ω/°C (α = ${fmt((rtdResistance(100) - 100) / 10000, 6)})`)}${readout(`NTC at ${c.temperature} °C (β)`, `${eng(ntcAt, 'Ω')}`)}${readout('Steinhart–Hart A, B, C', `${sh.a.toExponential(5)}, ${sh.b.toExponential(5)}, ${sh.c.toExponential(5)}`)}${readout(`SH temperature at ${eng(ntcAt, 'Ω')}`, `${fmt(steinhartTemperature(ntcAt, sh), 4)} °C`)}<p class="field-help">IEC 60751 Callendar–Van Dusen: R = R0[1 + A·T + B·T² + C(T − 100)T³] (C only below 0 °C). Steinhart–Hart: 1/T = A + B·ln R + C·(ln R)³ through your three calibration points.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'bridge') {
    const bridge = strainBridge(c);
    const sensor = lvdt({ displacementMm: c.lvdtMm, sensitivity: c.lvdtSensitivity, vex: c.lvdtVex });
    const strains = Array.from({ length: 101 }, (_, k) => -5e-3 + k * 1e-4);
    const controls = `${sensorSelect('bridge.config', 'Bridge', c.config, [['quarter', 'Quarter bridge (1 gauge)'], ['half', 'Half bridge (2 gauges, bending)'], ['full', 'Full bridge (4 gauges)']])}${sensorField('bridge.vex', 'Excitation', c.vex, 'V')}${sensorField('bridge.gaugeFactor', 'Gauge factor', c.gaugeFactor)}${sensorField('bridge.strain', 'Strain', c.strain, 'ε')}${sensorField('bridge.r', 'Gauge resistance', c.r, 'Ω')}${sensorField('bridge.lvdtMm', 'LVDT core position', c.lvdtMm, 'mm')}${sensorField('bridge.lvdtSensitivity', 'LVDT sensitivity', c.lvdtSensitivity, 'mV/V/mm')}${sensorField('bridge.lvdtVex', 'LVDT excitation', c.lvdtVex, 'V')}`;
    const body = `<div class="power-grid"><div>${linePlot('Bridge output (V) vs strain (µε)', strains.map((s) => s * 1e6), ['quarter', 'half', 'full'].map((config, index) => ({ name: config, values: strains.map((strain) => strainBridge({ ...c, strain, config }).vout), color: PLOT_COLORS[index] })), { xLabel: (v) => `${Math.round(v)}`, unit: 'V' })}</div>
      <div class="analysis-readouts">${readout('ΔR of an active gauge', eng(bridge.deltaR, 'Ω'))}${readout('Bridge output (exact)', eng(bridge.vout, 'V'))}${readout('Small-strain formula', eng(bridge.linear, 'V'))}${readout('Non-linearity', `${fmt(bridge.nonlinearityPercent, 4)} %`)}${readout('Sensitivity', `${fmt(bridge.sensitivity * 1000, 5)} mV/V per unit strain`)}<span class="panel-label">LVDT</span>${readout('Output amplitude', `${fmt(sensor.amplitudeMv, 4)} mV`)}${readout('Phase vs excitation', `${sensor.phaseDeg}°`)}<p class="field-help">Quarter bridge: Vout = Vex·(ΔR/R)/(4 + 2ΔR/R) — slightly non-linear. Half (bending) and full bridges are linear and 2× / 4× as sensitive, and cancel temperature drift.</p></div></div>`;
    return { controls, body };
  }
  const chain = measurementChain(c);
  const ts = chain.rows.map((row) => row.t);
  const controls = `${sensorSelect('chain.sensor', 'Sensor', c.sensor, [['pt100', 'Pt100 (1 mA excitation)'], ['pt1000', 'Pt1000 (1 mA excitation)'], ['k-type', 'Type K thermocouple'], ['ntc', 'NTC 10 k in a divider'], ['lm35', 'LM35 (10 mV/°C)']])}${sensorField('chain.tMin', 'From', c.tMin, '°C')}${sensorField('chain.tMax', 'To', c.tMax, '°C')}${sensorSelect('chain.inamp', 'Amplifier', c.inamp, Object.entries(INAMPS).map(([id, spec]) => [id, spec.label]))}${sensorField('chain.adcBits', 'ADC bits', c.adcBits, 'bit')}${sensorField('chain.vref', 'ADC reference', c.vref, 'V')}${sensorSelect('chain.linearize', 'Conversion to °C', c.linearize, [['exact', 'Exact sensor law'], ['linear', 'Straight line between end points']])}`;
  const body = `<div class="power-grid"><div>${linePlot('Reading error (°C) across the range', ts, [{ name: 'exact law', values: chain.rows.map((row) => row.exactError) }, { name: 'straight line', values: chain.rows.map((row) => row.linearError), color: PLOT_COLORS[3] }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('Amplifier output (V) into the ADC', ts, [{ name: 'Vout', values: chain.rows.map((row) => row.ampV) }], { xLabel: (v) => `${Math.round(v)}`, unit: 'V', yMin: 0, yMax: c.vref })}</div>
    <div class="analysis-readouts">${readout('Sensor output span', `${eng(chain.sensorSpan[0], 'V')} … ${eng(chain.sensorSpan[1], 'V')}`)}${readout('Required gain', fmt(chain.amp.targetGain, 5))}${readout('RG (E96)', `${eng(chain.amp.rg, 'Ω')} (ideal ${eng(chain.amp.rgIdeal, 'Ω')})`)}${readout('Actual gain', fmt(chain.amp.gain, 5))}${readout('Output reference (level shift)', eng(chain.amp.reference, 'V'))}${readout('ADC range used', `${eng(chain.amp.outMin, 'V')} … ${eng(chain.amp.outMax, 'V')}`)}${readout('Resolution', `${fmt(chain.resolution, 4)} °C per LSB`)}${readout('Worst error (selected conversion)', `${fmt(chain.maxError, 4)} °C`)}${readout('Worst error with a straight line', `${fmt(chain.maxLinearError, 4)} °C`)}<p class="field-help">The gain maps the sensor span onto 90 % of the ADC range (5 % margin each side); the reference pin shifts the level. Converting with the exact sensor law leaves only quantisation error.</p></div></div>`;
  return { controls, body };
}

function renderSensors(state) {
  const config = sensorLab.configuration(state);
  let view;
  try { view = renderSensorTab(config); } catch (error) { view = { controls: '', body: `<div class="diagnostic error"><b>Sensors</b><span>${esc(error.message)}</span></div>` }; }
  return `<div class="page scroll-page power-page sensor-page">${pageHeader(modules.find((item) => item.id === 'sensors'), 'SENSORS & SIGNAL CONDITIONING', '<span class="pill live"><i></i> NIST / IEC REFERENCE DATA</span>')}${labTabs(SENSOR_TABS, config.tab, 'data-sensor-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

const EV_TABS = [['pack', 'Battery pack'], ['drive', 'Road load & range'], ['performance', 'Motor & acceleration'], ['charging', 'Charging']];
const evLab = makeLab('ev-lab', {
  tab: 'pack',
  pack: { cell: 'nmc21700', targetVoltage: 400, targetKwh: 60, current: 200 },
  vehicle: { massKg: 1600, crr: 0.01, cd: 0.28, area: 2.3, speedKmh: 80, gradePercent: 0, drivetrainEfficiency: 0.9, auxKw: 0.5, usableKwh: 55, wheelRadius: 0.31, gearRatio: 9 },
  motor: { peakTorque: 300, peakPowerKw: 150, maxRpm: 12_000, mu: 0.9, drivenAxleShare: 0.5 },
  charging: { capacityKwh: 60, fromSoc: 20, toSoc: 80, chargerKw: 50, efficiency: 0.92, taperSoc: 80 },
});
const evField = groupField('data-ev-field');

function renderEvTab(config) {
  const v = config.vehicle;
  if (config.tab === 'pack') {
    const c = config.pack;
    const cell = CELLS[c.cell];
    const pack = designPack({ cell, targetVoltage: c.targetVoltage, targetKwh: c.targetKwh });
    const loaded = batteryPack({ cell, series: pack.series, parallel: pack.parallel, current: c.current });
    const controls = `${labSelect('data-ev-select', 'pack.cell', 'Cell', c.cell, Object.entries(CELLS).map(([id, item]) => [id, item.label]))}${evField('pack.targetVoltage', 'Target pack voltage', c.targetVoltage, 'V')}${evField('pack.targetKwh', 'Target energy', c.targetKwh, 'kWh')}${evField('pack.current', 'Load current', c.current, 'A')}`;
    const body = `<div class="analysis-readouts ev-readouts">${readout('Configuration', `${pack.series}S ${pack.parallel}P = ${pack.cells} cells`)}${readout('Nominal / max / min voltage', `${fmt(pack.nominalVoltage, 4)} / ${fmt(pack.maxVoltage, 4)} / ${fmt(pack.minVoltage, 4)} V`)}${readout('Capacity', `${fmt(pack.capacityAh, 4)} Ah`)}${readout('Energy', `${fmt(pack.energyKwh, 4)} kWh`)}${readout('Internal resistance', eng(pack.resistance, 'Ω'))}${readout(`At ${c.current} A: voltage sag / heat`, `${fmt(loaded.sag, 4)} V / ${eng(loaded.loss, 'W')}`)}${readout('C-rate', fmt(loaded.cRate, 3))}${readout('Cell mass / pack mass (×1.35 packaging)', `${fmt(pack.cellMassKg, 4)} kg / ${fmt(pack.packMassKg, 4)} kg`)}${readout('Pack specific energy', `${fmt(pack.specificEnergy, 4)} Wh/kg`)}<p class="field-help">Series cells set the voltage (S = Vpack / Vcell), parallel strings set the capacity (P = E / (S·Vcell·Ah)). Pack resistance = Rcell·S/P.</p></div>`;
    return { controls, body };
  }
  const vehicleControls = `${evField('vehicle.massKg', 'Mass', v.massKg, 'kg')}${evField('vehicle.crr', 'Rolling resistance Crr', v.crr)}${evField('vehicle.cd', 'Drag coefficient Cd', v.cd)}${evField('vehicle.area', 'Frontal area', v.area, 'm²')}${evField('vehicle.drivetrainEfficiency', 'Drivetrain efficiency', v.drivetrainEfficiency)}${evField('vehicle.wheelRadius', 'Wheel radius', v.wheelRadius, 'm')}${evField('vehicle.gearRatio', 'Gear ratio', v.gearRatio)}`;
  if (config.tab === 'drive') {
    const load = constantSpeedRange({ ...v });
    const speeds = Array.from({ length: 29 }, (_, k) => 20 + k * 5);
    const ranges = speeds.map((speedKmh) => constantSpeedRange({ ...v, speedKmh, gradePercent: 0 }));
    const controls = `${vehicleControls}${evField('vehicle.speedKmh', 'Speed', v.speedKmh, 'km/h')}${evField('vehicle.gradePercent', 'Road grade', v.gradePercent, '%')}${evField('vehicle.auxKw', 'Auxiliary load (AC, lights)', v.auxKw, 'kW')}${evField('vehicle.usableKwh', 'Usable battery energy', v.usableKwh, 'kWh')}`;
    const body = `<div class="power-grid"><div>${linePlot('Range (km) at constant speed (km/h), flat road', speeds, [{ name: 'range', values: ranges.map((r) => r.rangeKm) }], { xLabel: (x) => `${Math.round(x)}` })}${linePlot('Consumption (Wh/km) vs speed', speeds, [{ name: 'Wh/km', values: ranges.map((r) => r.consumptionWhKm) }], { xLabel: (x) => `${Math.round(x)}` })}</div>
      <div class="analysis-readouts">${readout('Rolling resistance', eng(load.forces.rolling, 'N'))}${readout('Aerodynamic drag', eng(load.forces.aero, 'N'))}${readout('Grade force', eng(load.forces.grade, 'N'))}${readout('Total tractive force', eng(load.forces.total, 'N'))}${readout('Power at the wheels', eng(load.wheelPower, 'W'))}${readout('Battery power (incl. losses and auxiliaries)', eng(load.batteryPower, 'W'))}${readout('Motor speed / torque', `${Math.round(load.motorRpm).toLocaleString()} rpm / ${fmt(load.motorTorque, 4)} N·m`)}${readout('Consumption', `${fmt(load.consumptionWhKm, 4)} Wh/km`)}${readout('Range', Number.isFinite(load.rangeKm) ? `${fmt(load.rangeKm, 4)} km` : '— (regenerating)')}<p class="field-help">F = Crr·m·g·cos θ + ½ρ·Cd·A·v² + m·g·sin θ. Battery power = F·v/η + auxiliaries; range = usable energy / consumption.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'performance') {
    const m = config.motor;
    const motor = { peakTorque: m.peakTorque, peakPowerKw: m.peakPowerKw, maxRpm: m.maxRpm };
    const run = accelerationRun({ ...v, motor, mu: m.mu, drivenAxleShare: m.drivenAxleShare });
    const rpms = Array.from({ length: 121 }, (_, k) => k * m.maxRpm / 120);
    const controls = `${vehicleControls}${evField('motor.peakTorque', 'Peak torque', m.peakTorque, 'N·m')}${evField('motor.peakPowerKw', 'Peak power', m.peakPowerKw, 'kW')}${evField('motor.maxRpm', 'Max speed', m.maxRpm, 'rpm')}${evField('motor.mu', 'Tyre grip μ', m.mu)}${evField('motor.drivenAxleShare', 'Weight on driven axle', m.drivenAxleShare)}`;
    const body = `<div class="power-grid"><div>${linePlot('Motor torque (N·m) and power (kW) vs rpm', rpms, [{ name: 'torque', values: rpms.map((rpm) => motorTorque(rpm, motor)) }, { name: 'power', values: rpms.map((rpm) => motorTorque(rpm, motor) * rpm * 2 * Math.PI / 60 / 1000), color: PLOT_COLORS[3] }], { xLabel: (x) => `${Math.round(x)}` })}${linePlot('Speed (km/h) vs time (s), full throttle', run.curve.map(([t]) => t), [{ name: 'speed', values: run.curve.map(([, speed]) => speed) }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div class="analysis-readouts">${readout('Base speed', `${Math.round(baseSpeedRpm(motor)).toLocaleString()} rpm`)}${readout('0–100 km/h', run.zeroToTarget === null ? 'not reached' : `${fmt(run.zeroToTarget, 3)} s`)}${readout('Top speed', `${fmt(run.topSpeedKmh, 4)} km/h`)}${readout('Top speed if limited only by motor rpm', `${fmt(run.rpmLimitedTopSpeedKmh, 4)} km/h`)}${readout('Grip-limited traction', eng(run.gripLimitedForce, 'N'))}${readout('Gear ratio for 150 km/h at max rpm', fmt(gearRatioForTopSpeed({ topSpeedKmh: 150, maxRpm: m.maxRpm, wheelRadius: v.wheelRadius }), 4))}<p class="field-help">Constant torque up to base speed (P/T), then constant power. Traction = min(μ·m·g·share, T·G·η/r); integrated every 10 ms against rolling and aerodynamic drag.</p></div></div>`;
    return { controls, body };
  }
  const c = config.charging;
  const result = chargingTime({ capacityKwh: c.capacityKwh, fromSoc: c.fromSoc / 100, toSoc: c.toSoc / 100, chargerKw: c.chargerKw, efficiency: c.efficiency, taperSoc: c.taperSoc / 100 });
  const controls = `${evField('charging.capacityKwh', 'Battery capacity', c.capacityKwh, 'kWh')}${evField('charging.fromSoc', 'From', c.fromSoc, '%')}${evField('charging.toSoc', 'To', c.toSoc, '%')}${evField('charging.chargerKw', 'Charger power', c.chargerKw, 'kW')}${evField('charging.efficiency', 'Charging efficiency', c.efficiency)}${evField('charging.taperSoc', 'CV taper starts at', c.taperSoc, '%')}`;
  const body = `<div class="power-grid"><div>${linePlot('State of charge (%) vs time (min)', result.curve.map(([t]) => t), [{ name: 'SoC', values: result.curve.map(([, soc]) => soc) }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Charger power (kW) vs time (min)', result.curve.map(([t]) => t), [{ name: 'power', values: result.curve.map(([, , p]) => p), color: PLOT_COLORS[3] }], { xLabel: (x) => fmt(x, 3), yMin: 0 })}</div>
    <div class="analysis-readouts">${readout('Charging time', `${fmt(result.minutes, 4)} min (${fmt(result.minutes / 60, 3)} h)`)}${readout('Energy into the battery', `${fmt(result.energyKwh, 4)} kWh`)}${readout('Energy from the grid', `${fmt(result.gridKwh, 4)} kWh`)}<p class="field-help">Constant power (CC) to the taper point, then the power falls linearly to 10 % at full charge (CV phase) — why the last 20 % is slow.</p></div></div>`;
  return { controls, body };
}

function renderEv(state) {
  const config = evLab.configuration(state);
  let view;
  try { view = renderEvTab(config); } catch (error) { view = { controls: '', body: `<div class="diagnostic error"><b>EV</b><span>${esc(error.message)}</span></div>` }; }
  return `<div class="page scroll-page power-page ev-page">${pageHeader(modules.find((item) => item.id === 'ev'), 'ELECTRIC VEHICLES', '')}${labTabs(EV_TABS, config.tab, 'data-ev-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindSensorEvents() { bindLabControls('sensor', sensorLab, ['type', 'config', 'sensor', 'inamp', 'linearize']); bindLabControls('ev', evLab, ['cell']); }

function renderMcu(state) {
  const module = modules.find((item) => item.id === 'mcu');
  const config = mcuConfiguration(state);
  const arduino = config.tab === 'arduino';
  return `<div class="page scroll-page mcu-page">${pageHeader(module, arduino ? 'BUILT-IN ARDUINO UNO SIMULATOR' : 'BUILT-IN 8051 SIMULATOR', '<span class="pill live"><i></i> LOCAL SIMULATION</span>')}
    ${labTabs(MCU_TABS, config.tab, 'data-mcu-tab')}${arduino ? renderUnoTab(config) : render8051Tab(config)}</div>`;
}

function render8051Tab(config) {
  mcuEnsure(config);
  const { assembly } = mcuRuntime;
  const errors = assembly?.errors || [];
  return `<div data-mcu-root>
    <div class="mcu-toolbar dsp-controls">
      ${labSelect('data-mcu-field', 'exampleId', 'Example program', config.exampleId, [...EXAMPLES_8051.map((example) => [example.id, example.name]), ['custom', 'My program']])}
      ${labSelect('data-mcu-field', 'speed', 'Speed', config.speed, MCU_SPEEDS)}
      ${labField('data-mcu-field', 'clockMHz', 'Crystal', config.clockMHz, 'MHz', 'type="number" step="0.0001" min="1" max="40"')}
      <label>Program file<input type="file" accept=".hex,.ihx,.asm,.a51,.txt" data-mcu-file></label>
      <button class="button primary" data-action="mcu-assemble">Assemble &amp; load</button><button class="button run" data-action="mcu-run">${mcuRuntime.running ? 'Pause' : 'Run'}</button><button class="button ghost" data-action="mcu-step">Step</button><button class="button ghost" data-action="mcu-reset">Reset</button><button class="button ghost" data-action="mcu-download-hex">Download HEX</button>
    </div>
    ${mcuRuntime.loadedHex ? `<div class="diagnostic warning"><b>HEX loaded</b><span>Running ${esc(mcuRuntime.loadedHex.name)} (${mcuRuntime.loadedHex.bytes} bytes). Edit the source and press “Assemble &amp; load” to go back to the assembler.</span></div>` : ''}
    <div class="mcu-layout">
      <section class="dsp-card mcu-editor"><span class="panel-label">ASSEMBLY SOURCE (A51 syntax)</span>
        <textarea data-mcu-source spellcheck="false" rows="28">${esc(config.source)}</textarea>
        ${errors.length ? `<ul class="pcb-drc">${errors.slice(0, 12).map((error) => `<li class="error"><b>error</b> ${esc(error.message)}</li>`).join('')}</ul>` : `<p class="module-footnote">${assembly ? `${assembly.size} bytes of code · ${Object.keys(assembly.symbols).length} symbols` : ''}</p>`}
      </section>
      <section class="mcu-middle">
        <div class="dsp-card"><span class="panel-label">TRAINER BOARD</span><div class="mcu-board" data-mcu-board></div>${renderMcuWiring(config)}</div>
        <div class="dsp-card"><span class="panel-label">SERIAL TERMINAL (UART · TXD P3.1 / RXD P3.0)</span><pre class="mcu-terminal" data-mcu-terminal></pre>
          <div class="mcu-send"><input data-mcu-input placeholder="Type text and press Enter to send to RXD"><button class="button ghost" data-action="mcu-send">Send</button><button class="button ghost" data-action="mcu-clear-terminal">Clear</button></div></div>
      </section>
      <section class="mcu-right">
        <div class="dsp-card"><span class="panel-label">CPU</span><div data-mcu-regs></div></div>
        <div class="dsp-card"><span class="panel-label">LISTING (click a line for a breakpoint)</span><div class="mcu-listing" data-mcu-listing></div></div>
        <div class="dsp-card"><span class="panel-label">INTERNAL RAM 00–7F</span><div class="mcu-ram" data-mcu-ram></div></div>
      </section>
    </div>
    ${renderAnalyzerPanel('i8051')}
    <p class="module-footnote">Cycle-accurate MCS-51 core (12 clocks per machine cycle) with timers, UART and interrupts; validated against SDCC's assembler and the ucsim simulator. The LCD model ignores controller busy time.</p></div>`;
}

function bindMcuEvents() {
  document.querySelectorAll('[data-mcu-tab]').forEach((button) => button.addEventListener('click', () => { mcuStop(); unoStop(); persistMcu({ tab: button.dataset.mcuTab }); }));
  document.querySelectorAll('[data-uno-root] [data-mcu-field]').forEach((field) => field.addEventListener('change', () => {
    if (field.dataset.mcuField === 'avrExampleId') { const example = AVR_EXAMPLES.find((entry) => entry.id === field.value); unoRuntime.hex = null; if (example) persistMcu({ avrExampleId: example.id, avrBoard: structuredClone(example.board) }); }
    else persistMcu({ [field.dataset.mcuField]: field.value });
  }));
  bindUnoEvents();
  const root = document.querySelector('[data-mcu-root]');
  if (!root) return;
  bindAnalyzerEvents('i8051');
  paintMcu();
  const config = () => mcuConfiguration(getState());
  const source = root.querySelector('[data-mcu-source]');
  source?.addEventListener('change', () => { if (source.value !== config().source) persistMcu({ source: source.value, exampleId: 'custom' }); });
  source?.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const { selectionStart: start, selectionEnd: end } = source; source.value = `${source.value.slice(0, start)}\t${source.value.slice(end)}`; source.selectionStart = source.selectionEnd = start + 1; } });
  root.querySelector('[data-action="mcu-assemble"]')?.addEventListener('click', () => {
    mcuRuntime.loadedHex = null; mcuRuntime.key = null;
    const text = source?.value ?? config().source;
    persistMcu({ source: text, exampleId: text === config().source ? config().exampleId : 'custom' });
    const errors = mcuRuntime.assembly?.errors.length;
    notify(errors ? `${errors} assembly error(s)` : 'Assembled and loaded', errors ? 'error' : 'success');
  });
  root.querySelector('[data-action="mcu-run"]')?.addEventListener('click', () => { if (mcuRuntime.running) { mcuStop(); paintMcu(); } else mcuStart(); });
  root.querySelector('[data-action="mcu-step"]')?.addEventListener('click', () => { mcuStop(); if (mcuRuntime.cpu && !mcuRuntime.assembly?.errors.length) { mcuRuntime.cpu.step(); mcuDrainSerial(); paintMcu(); } });
  root.querySelector('[data-action="mcu-reset"]')?.addEventListener('click', () => { mcuStop(); mcuRuntime.cpu?.reset(); mcuRuntime.board?.lcd.reset(); mcuRuntime.board?.update(); mcuRuntime.terminal = ''; paintMcu(); });
  root.querySelectorAll('[data-mcu-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.mcuField;
    if (name === 'exampleId') {
      const example = EXAMPLES_8051.find((entry) => entry.id === field.value);
      if (example) { mcuRuntime.loadedHex = null; mcuRuntime.breakpoints.clear(); persistMcu({ exampleId: example.id, source: example.source, wiring: structuredClone(example.wiring) }); }
      return;
    }
    persistMcu({ [name]: name === 'clockMHz' ? Math.min(40, Math.max(1, Number(field.value) || 11.0592)) : field.value });
  }));
  root.querySelector('[data-mcu-file]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) { notify('That file is too large.', 'error'); return; }
    const text = await file.text();
    if (/\.(hex|ihx)$/i.test(file.name)) {
      try { const parsed = parseIntelHex(text); mcuRuntime.loadedHex = { name: file.name, image: parsed.image, bytes: parsed.bytes }; mcuRuntime.key = null; render(); notify(`Loaded ${parsed.bytes} bytes from ${file.name}`, 'success'); }
      catch (error) { notify(error.message, 'error'); }
    } else { mcuRuntime.loadedHex = null; persistMcu({ source: text, exampleId: 'custom' }); }
  });
  root.querySelector('[data-action="mcu-download-hex"]')?.addEventListener('click', () => {
    const { assembly } = mcuRuntime;
    if (!assembly || assembly.errors.length) { notify('Assemble the program without errors first.', 'error'); return; }
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([toIntelHex(assembly.bytes)], { type: 'text/plain' })); link.download = 'program.hex'; link.click(); URL.revokeObjectURL(link.href);
  });
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-mcu-switch],[data-mcu-bp]');
    if (!target) return;
    if (target.dataset.mcuSwitch !== undefined) { const bit = Number(target.dataset.mcuSwitch); mcuRuntime.board.setSwitches(mcuRuntime.board.switches ^ (1 << bit)); paintMcu(); }
    else { const address = Number(target.dataset.mcuBp); if (mcuRuntime.breakpoints.has(address)) mcuRuntime.breakpoints.delete(address); else mcuRuntime.breakpoints.add(address); paintMcu(); }
  });
  const press = (event, down) => {
    const button = event.target.closest('[data-mcu-button],[data-mcu-key]');
    if (!button) return;
    if (button.dataset.mcuButton !== undefined) mcuRuntime.board.setButton(Number(button.dataset.mcuButton), down);
    else { const [row, column] = button.dataset.mcuKey.split(',').map(Number); mcuRuntime.board.setKey(row, column, down); }
    paintMcu();
  };
  root.addEventListener('pointerdown', (event) => press(event, true));
  root.addEventListener('pointerup', (event) => press(event, false));
  root.addEventListener('pointerleave', () => { mcuRuntime.board?.buttons.forEach((_, index) => mcuRuntime.board.setButton(index, false)); mcuRuntime.board?.keys.clear(); mcuRuntime.board?.update(); }, true);
  const input = root.querySelector('[data-mcu-input]');
  const send = () => { if (!input?.value) return; mcuRuntime.cpu.receive([...input.value].map((character) => character.charCodeAt(0) & 0xff)); input.value = ''; };
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); send(); } });
  root.querySelector('[data-action="mcu-send"]')?.addEventListener('click', send);
  root.querySelector('[data-action="mcu-clear-terminal"]')?.addEventListener('click', () => { mcuRuntime.terminal = ''; paintMcu(); });
  root.querySelectorAll('[data-mcu-wire]').forEach((field) => field.addEventListener('change', () => {
    const wiring = structuredClone(config().wiring);
    const [group, key] = field.dataset.mcuWire.split('.');
    wiring[group][key] = field.type === 'checkbox' ? field.checked : key === 'port' || key === 'dataPort' ? Number(field.value) : field.value.trim().toUpperCase();
    try { new TrainerBoard(new Cpu8051(), wiring); persistMcu({ wiring }); } catch (error) { notify(error.message, 'error'); }
  }));
  if (mcuRuntime.running && !mcuRuntime.frame) mcuStart();
}

// ---------------------------------------------------------------------------
// Microcontroller Lab: Arduino Uno (ATmega328P) simulator running compiled HEX files.

const unoRuntime = { board: null, key: null, running: false, frame: 0, last: 0, terminal: '', hex: null, speedHistory: [] };
const UNO_SPEEDS = [['1', 'Real time'], ['0.1', '10 %'], ['max', 'As fast as possible']];

function unoExample(config) { return AVR_EXAMPLES.find((entry) => entry.id === config.avrExampleId) || AVR_EXAMPLES[0]; }

function unoEnsure(config) {
  const example = unoExample(config);
  const hex = unoRuntime.hex?.text || example.hex;
  const cosim = cosimConfiguration(config);
  const circuit = getState().project.circuit;
  const key = JSON.stringify([hex.length, unoRuntime.hex?.name, example.id, config.avrBoard, cosim.enabled ? [cosim.connections, cosim.probes, cosim.maxStep, circuit.components, circuit.wires, circuit.netLabels] : null]);
  if (unoRuntime.key === key && unoRuntime.board) return;
  unoStop();
  unoRuntime.key = key;
  unoRuntime.terminal = '';
  unoRuntime.board = new UnoBoard(hex, config.avrBoard || example.board);
  unoRuntime.cosim = null; unoRuntime.cosimError = null;
  if (cosim.enabled) {
    try { unoRuntime.cosim = createCoSimulation(unoRuntime.board, { components: circuit.components, wires: circuit.wires, netLabels: circuit.netLabels, connections: cosim.connections, probes: cosim.probes, maxStep: cosim.maxStep, historyLimit: 40_000 }); }
    catch (error) { unoRuntime.cosimError = error.message; }
  }
}

function unoStop() { unoRuntime.running = false; if (unoRuntime.frame) cancelAnimationFrame(unoRuntime.frame); unoRuntime.frame = 0; }

function unoStart() {
  const { board } = unoRuntime;
  if (!board) return;
  if (board.cpu.halted) { notify(board.cpu.haltReason || 'The CPU stopped; press Reset.', 'error'); return; }
  unoRuntime.running = true;
  unoRuntime.last = performance.now();
  const tick = (now) => {
    if (!unoRuntime.running) return;
    if (!document.querySelector('[data-uno-root]')) { unoStop(); return; }
    const config = mcuConfiguration(getState());
    const elapsed = Math.min(0.1, (now - unoRuntime.last) / 1000);
    unoRuntime.last = now;
    const target = config.avrSpeed === 'max' ? Infinity : board.cpu.clock * Number(config.avrSpeed || 1) * elapsed;
    // Run in slices but never spend more than ~14 ms of a frame simulating.
    const started = performance.now(), cyclesBefore = board.cpu.cycles;
    const cosim = unoRuntime.cosim;
    while (board.cpu.cycles - cyclesBefore < target && performance.now() - started < 14 && !board.cpu.halted) {
      const chunk = Math.min(20_000, Math.max(1, target - (board.cpu.cycles - cyclesBefore)));
      if (cosim) cosim.advance(chunk / board.cpu.clock); else board.cpu.run(chunk);
    }
    const ran = board.cpu.cycles - cyclesBefore;
    unoRuntime.speedHistory.push(elapsed ? ran / board.cpu.clock / elapsed : 0);
    if (unoRuntime.speedHistory.length > 30) unoRuntime.speedHistory.shift();
    unoDrainSerial();
    paintUno();
    if (board.cpu.halted) { unoStop(); paintUno(); notify(board.cpu.haltReason || 'CPU stopped', 'error'); return; }
    unoRuntime.frame = requestAnimationFrame(tick);
  };
  unoRuntime.frame = requestAnimationFrame(tick);
  paintUno();
}

function unoDrainSerial() {
  const output = unoRuntime.board.mcu.usart.output;
  if (!output.length) return;
  for (const byte of output) unoRuntime.terminal += byte === 13 ? '' : byte === 10 || (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '·';
  output.length = 0;
  if (unoRuntime.terminal.length > 12_000) unoRuntime.terminal = unoRuntime.terminal.slice(-9000);
}

function unoBoardHtml() {
  const { board } = unoRuntime;
  const view = board.view();
  const pinCell = (pin) => `<div class="uno-pin ${pin.output ? 'out' : 'in'} ${pin.level ? 'high' : 'low'}" title="${pin.label}: ${pin.output ? 'OUTPUT' : pin.pullUp ? 'INPUT_PULLUP' : 'INPUT'} · ${pin.level ? 'HIGH' : 'LOW'}"><b>${pin.label}</b><i style="--glow:${pin.output ? pin.brightness : 0}"></i><small>${pin.output ? 'OUT' : pin.pullUp ? 'PU' : 'IN'}</small></div>`;
  const leds = view.leds.map((led) => `<div class="uno-led"><i style="--glow:${led.brightness.toFixed(3)}"></i><small>${esc(String(led.pin))}${led.brightness > 0 && led.brightness < 1 ? ` · ${Math.round(led.brightness * 100)} %` : ''}</small></div>`).join('');
  const buttons = board.board.buttons.map((button) => `<button class="${board.pressed.has(String(button.pin)) ? 'pressed' : ''}" data-uno-button="${esc(String(button.pin))}">Button · pin ${esc(String(button.pin))} → ${button.to}</button>`).join('');
  const pots = board.board.pots.map((pot) => `<label class="uno-pot">${esc(pot.label || `Potentiometer ${pot.pin}`)} <input type="range" min="0" max="5" step="0.01" value="${pot.volts}" data-uno-pot="${esc(pot.pin)}"><b>${fmt(pot.volts, 3)} V</b></label>`).join('');
  return `<div class="uno-header"><span class="panel-label">ARDUINO UNO PINS</span><div class="uno-pins">${view.pins.map(pinCell).join('')}</div></div>
    ${leds ? `<div class="mcu-part"><span class="panel-label">LEDS</span><div class="uno-leds">${leds}</div></div>` : ''}
    ${buttons ? `<div class="mcu-part"><span class="panel-label">BUTTONS (hold to press)</span><div class="mcu-buttons">${buttons}</div></div>` : ''}
    ${pots ? `<div class="mcu-part"><span class="panel-label">ANALOG INPUTS</span>${pots}</div>` : ''}
    ${view.lcd ? `<div class="mcu-part"><span class="panel-label">LCD 16×2 (LiquidCrystal)</span><div class="mcu-lcd ${view.lcd.on ? 'on' : ''}">${view.lcd.lines.map((line) => `<div>${esc(line).replaceAll(' ', '&nbsp;')}</div>`).join('')}</div></div>` : ''}`;
}

function unoCpuHtml() {
  const { cpu } = unoRuntime.board;
  const sreg = cpu.sreg;
  const flags = ['C', 'Z', 'N', 'V', 'S', 'H', 'T', 'I'].map((name, bit) => `<span class="${(sreg >> bit) & 1 ? 'on' : ''}">${name}</span>`).reverse().join('');
  const regs = Array.from({ length: 32 }, (_, n) => `<div><span>R${n}</span><b>${hex2(cpu.data[n])}</b></div>`).join('');
  const speed = unoRuntime.speedHistory.length ? unoRuntime.speedHistory.reduce((a, b) => a + b, 0) / unoRuntime.speedHistory.length : 0;
  return `<div class="mcu-regs"><div><span>PC</span><b>${(cpu.pc * 2).toString(16).toUpperCase().padStart(4, '0')}</b></div><div><span>SP</span><b>${cpu.sp.toString(16).toUpperCase().padStart(4, '0')}</b></div>${regs}</div>
    <div class="mcu-flags">${flags}</div>
    <p class="mcu-status">${cpu.instructions.toLocaleString()} instructions · ${cpu.cycles.toLocaleString()} cycles · ${eng(cpu.cycles / cpu.clock, 's')} simulated${unoRuntime.running ? ` · running at ${Math.round(speed * 100)} % of real time` : ''} · UART ${Math.round(unoRuntime.board.mcu.usart.baud())} baud</p>`;
}

// Arduino + circuit co-simulation panel.
const cosimPart = (id, type, value, unit, n1, n2, x, y, rotation = 0) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation });
const COSIM_EXAMPLES = Object.freeze([
  { id: 'pwm-dac', name: 'PWM DAC: D9 → RC filter → A0', sketch: 'pwm_dac', maxStep: 50e-6, window: 0.01, connections: [{ pin: 'D9', node: 'pwm' }, { pin: 'A0', node: 'out' }], probes: [],
    components: [cosimPart('R1', 'resistor', 10_000, 'Ω', 'pwm', 'out', 300, 120), cosimPart('C1', 'capacitor', 10e-6, 'F', 'out', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 460, 300)] },
  { id: 'rc-timer', name: 'RC time constant: D8 charges C, A0 times it', sketch: 'rc_timer', maxStep: 50e-6, window: 0.5, connections: [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }], probes: [],
    components: [cosimPart('R1', 'resistor', 10_000, 'Ω', 'drive', 'cap', 300, 120), cosimPart('C1', 'capacitor', 10e-6, 'F', 'cap', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 460, 300)] },
  { id: 'divider', name: 'Voltage divider into A0 (analogRead)', sketch: 'analog_read', maxStep: 200e-6, window: 0.05, connections: [{ pin: 'A0', node: 'a0' }], probes: ['vcc'],
    components: [cosimPart('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 200), cosimPart('R1', 'resistor', 10_000, 'Ω', 'vcc', 'a0', 300, 120), cosimPart('R2', 'resistor', 4700, 'Ω', 'a0', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 300, 300)] },
  { id: 'transistor-led', name: 'Transistor switch: D13 → NPN drives an LED', sketch: 'blink', maxStep: 200e-6, window: 2, connections: [{ pin: 'D13', node: 'd13' }], probes: ['b', 'c'],
    components: [cosimPart('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 200), cosimPart('RL', 'resistor', 220, 'Ω', 'vcc', 'a', 300, 80), cosimPart('D1', 'led', 2, 'Vf', 'a', 'c', 460, 80), { id: 'Q1', type: 'npn', label: 'Q1', value: 100, unit: 'β', n1: 'c', n2: 'b', n3: '0', x: 600, y: 200, rotation: 0 }, cosimPart('RB', 'resistor', 1000, 'Ω', 'd13', 'b', 460, 260), cosimPart('GND', 'ground', 0, 'V', '0', '0', 600, 320)] },
]);
const COSIM_STEPS = [[10e-6, '10 µs'], [20e-6, '20 µs'], [50e-6, '50 µs'], [100e-6, '100 µs'], [200e-6, '200 µs']];
const COSIM_WINDOWS = [[0.005, '5 ms'], [0.01, '10 ms'], [0.05, '50 ms'], [0.2, '200 ms'], [0.5, '500 ms'], [2, '2 s']];
const COSIM_DEFAULTS = Object.freeze({ enabled: false, connections: [{ pin: 'D9', node: '' }], probes: [], maxStep: 50e-6, window: 0.01 });

function cosimConfiguration(config) { return { ...structuredClone(COSIM_DEFAULTS), ...(config.avrCosim || {}) }; }
function persistCosim(patch) { const config = mcuConfiguration(getState()); persistMcu({ avrCosim: { ...cosimConfiguration(config), ...patch } }); }

function loadCosimExample(id) {
  const example = COSIM_EXAMPLES.find((entry) => entry.id === id);
  const sketch = AVR_EXAMPLES.find((entry) => entry.id === example?.sketch);
  if (!example || !sketch) return;
  updateProject((project) => { project.circuit.components = structuredClone(example.components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  unoRuntime.hex = null;
  persistMcu({ avrExampleId: sketch.id, avrBoard: structuredClone(sketch.board), avrCosim: { enabled: true, connections: structuredClone(example.connections), probes: [...example.probes], maxStep: example.maxStep, window: example.window } });
  notify(`${example.name}: circuit loaded into Circuit Lab. Press Run.`, 'success');
}

function cosimPlotHtml() {
  const cosim = unoRuntime.cosim;
  if (!cosim) return '';
  const config = cosimConfiguration(mcuConfiguration(getState()));
  const { time, nodes } = cosim.history;
  if (time.length < 2) return '<p class="field-help">Press Run to start both simulators.</p>';
  const end = time.at(-1), start = Math.max(0, end - config.window);
  let first = time.length - 1;
  while (first > 0 && time[first - 1] >= start) first -= 1;
  const xs = time.slice(first);
  const series = Object.entries(nodes).map(([node, values], index) => ({ ...decimate(xs, values.slice(first)), color: PLOT_COLORS[index % PLOT_COLORS.length], primary: index === 0, node }));
  const all = series.flatMap((entry) => entry.ys);
  const range = niceRange(Math.min(0, ...all), Math.max(5, ...all));
  const span = Math.max(config.window, end - start);
  const xTicks = Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(start + span * k / 5, 's') }));
  return `${renderPlotFrame({ title: 'Circuit node voltages', series, xMin: start, xMax: start + span, xTicks, yRange: range, formatY: (value) => eng(value, 'V') })}<div class="plot-legend">${series.map((entry) => `<span class="legend-chip" style="--chip:${entry.color}">V(${esc(entry.node)})</span>`).join('')}</div>`;
}

function cosimReadoutHtml() {
  const cosim = unoRuntime.cosim;
  if (!cosim) return '';
  const D = unoRuntime.board.cpu.data;
  return cosim.pins.map((pin) => {
    const output = (D[pin.port.ddr] >> pin.bit) & 1, pull = (D[pin.port.port] >> pin.bit) & 1;
    const mode = output ? `OUTPUT ${(pin.port.levels() >> pin.bit) & 1 ? 'HIGH' : 'LOW'}${pin.port.override[pin.bit] !== null ? ' (PWM)' : ''}` : pull ? 'INPUT_PULLUP' : 'INPUT';
    return readout(`${pin.label} ↔ ${pin.node} · ${mode}`, eng(Math.abs(pin.volts ?? 0) < 1e-4 ? 0 : pin.volts, 'V'));
  }).join('');
}

function renderCosimPanel(config) {
  const cosim = cosimConfiguration(config);
  const { components, wires, netLabels } = getState().project.circuit;
  let nodes = [];
  try { nodes = circuitNodes(components, wires, netLabels); } catch { nodes = []; }
  const nodeOptions = [['', '— not connected —'], ...nodes.map((node) => [node, node === '0' ? '0 (ground)' : node])];
  const rows = cosim.connections.map((connection, index) => `<div class="cosim-row">${labSelect('data-cosim-pin', index, 'Arduino pin', connection.pin, PIN_LABELS.map((label) => [label, label]))}${labSelect('data-cosim-node', index, 'Circuit node', connection.node, nodeOptions)}<button class="tool" data-cosim-remove="${index}" aria-label="Remove connection">Remove</button></div>`).join('');
  const probes = nodes.filter((node) => node !== '0').map((node) => `<label class="check-label"><input type="checkbox" data-cosim-probe="${esc(node)}" ${cosim.probes.includes(node) ? 'checked' : ''}> ${esc(node)}</label>`).join('');
  return `<div class="dsp-card cosim-card"><span class="panel-label">CIRCUIT CO-SIMULATION · ARDUINO PINS ↔ CIRCUIT LAB</span>
    <div class="dsp-controls"><label class="check-label"><input type="checkbox" data-cosim-enabled ${cosim.enabled ? 'checked' : ''}> Connect the board to the Circuit Lab circuit</label>
      <label>Ready experiment<select data-cosim-example><option value="">Choose…</option>${COSIM_EXAMPLES.map((example) => `<option value="${example.id}">${esc(example.name)}</option>`).join('')}</select></label>
      ${labSelect('data-cosim-field', 'maxStep', 'Circuit time step', cosim.maxStep, COSIM_STEPS)}${labSelect('data-cosim-field', 'window', 'Plot window', cosim.window, COSIM_WINDOWS)}<button class="button ghost" data-module="circuit">Edit circuit</button></div>
    ${cosim.enabled ? `${unoRuntime.cosimError ? `<div class="diagnostic error"><b>Co-simulation</b><span>${esc(unoRuntime.cosimError)}</span></div>` : ''}
    <div class="cosim-layout"><div><span class="panel-label">CONNECTIONS</span>${rows}<button class="tool" data-action="cosim-add">+ Connect another pin</button>${probes ? `<div class="cosim-probes"><span class="panel-label">ALSO PLOT</span>${probes}</div>` : ''}<div class="cosim-readout" data-uno-cosim-readout></div></div>
    <div data-uno-cosim-plot></div></div>
    <p class="field-help">The CPU runs until a connected pin changes, then the circuit solver catches up to that instant, so PWM and digital edges reach the circuit at their exact time. Outputs drive through 25 Ω, INPUT_PULLUP is 35 kΩ to 5 V, and inputs switch at 1.5 V / 3.0 V (Schmitt trigger). Analog pins feed the ADC.</p>` : '<p class="field-help">Wire Arduino pins to nodes of the Circuit Lab circuit (for example a PWM pin into an RC filter read back on A0) and run both simulators together.</p>'}</div>`;
}

function bindCosimEvents() {
  const root = document.querySelector('[data-uno-root]');
  if (!root) return;
  const config = () => cosimConfiguration(mcuConfiguration(getState()));
  root.querySelector('[data-cosim-enabled]')?.addEventListener('change', (event) => persistCosim({ enabled: event.target.checked }));
  root.querySelector('[data-cosim-example]')?.addEventListener('change', (event) => { if (event.target.value) loadCosimExample(event.target.value); });
  root.querySelectorAll('[data-cosim-field]').forEach((select) => select.addEventListener('change', () => persistCosim({ [select.dataset.cosimField]: Number(select.value) })));
  const editConnection = (index, patch) => { const connections = config().connections.map((entry, k) => (k === index ? { ...entry, ...patch } : entry)); persistCosim({ connections }); };
  root.querySelectorAll('[data-cosim-pin]').forEach((select) => select.addEventListener('change', () => editConnection(Number(select.dataset.cosimPin), { pin: select.value })));
  root.querySelectorAll('[data-cosim-node]').forEach((select) => select.addEventListener('change', () => editConnection(Number(select.dataset.cosimNode), { node: select.value })));
  root.querySelectorAll('[data-cosim-remove]').forEach((button) => button.addEventListener('click', () => persistCosim({ connections: config().connections.filter((_, k) => k !== Number(button.dataset.cosimRemove)) })));
  root.querySelector('[data-action="cosim-add"]')?.addEventListener('click', () => { const used = new Set(config().connections.map((entry) => entry.pin)); persistCosim({ connections: [...config().connections, { pin: PIN_LABELS.find((label) => !used.has(label)) ?? 'D2', node: '' }] }); });
  root.querySelectorAll('[data-cosim-probe]').forEach((input) => input.addEventListener('change', () => { const probes = new Set(config().probes); if (input.checked) probes.add(input.dataset.cosimProbe); else probes.delete(input.dataset.cosimProbe); persistCosim({ probes: [...probes] }); }));
}

function paintUno() {
  const root = document.querySelector('[data-uno-root]');
  if (!root || !unoRuntime.board) return;
  const set = (selector, html) => { const element = root.querySelector(selector); if (element && element.innerHTML !== html) element.innerHTML = html; };
  set('[data-uno-board]', unoBoardHtml());
  set('[data-uno-cpu]', unoCpuHtml());
  const terminal = root.querySelector('[data-uno-terminal]');
  if (terminal && terminal.textContent !== unoRuntime.terminal) { terminal.textContent = unoRuntime.terminal; terminal.scrollTop = terminal.scrollHeight; }
  const run = root.querySelector('[data-action="uno-run"]');
  if (run) run.textContent = unoRuntime.running ? 'Pause' : 'Run';
  paintAnalyzer('uno', !unoRuntime.running);
  if (unoRuntime.cosim) {
    set('[data-uno-cosim-readout]', cosimReadoutHtml());
    const now = performance.now();
    if (!unoRuntime.running || now - (unoRuntime.cosimPainted || 0) > 150) { unoRuntime.cosimPainted = now; set('[data-uno-cosim-plot]', cosimPlotHtml()); }
  }
}

function renderUnoTab(config) {
  unoEnsure(config);
  const example = unoExample(config);
  const board = config.avrBoard || example.board;
  const pinsText = (list) => list.map((entry) => (typeof entry === 'object' ? entry.pin : entry)).join(', ');
  return `<div data-uno-root>
    <div class="mcu-toolbar dsp-controls">
      ${labSelect('data-mcu-field', 'avrExampleId', 'Arduino example', config.avrExampleId, AVR_EXAMPLES.map((entry) => [entry.id, entry.name]))}
      ${labSelect('data-mcu-field', 'avrSpeed', 'Speed', config.avrSpeed, UNO_SPEEDS)}
      <label>Compiled sketch (.hex)<input type="file" accept=".hex,.ihx" data-uno-file></label>
      <button class="button run" data-action="uno-run">${unoRuntime.running ? 'Pause' : 'Run'}</button><button class="button ghost" data-action="uno-reset">Reset</button>
    </div>
    ${unoRuntime.hex ? `<div class="diagnostic warning"><b>Your sketch</b><span>Running ${esc(unoRuntime.hex.name)} (${unoRuntime.hex.bytes} bytes). Pick an example to go back to the built-in sketches.</span></div>` : ''}
    <div class="mcu-layout">
      <section class="dsp-card mcu-editor"><span class="panel-label">${unoRuntime.hex ? 'YOUR SKETCH (compiled HEX loaded)' : `SKETCH · ${esc(example.id)}.ino (${example.flashBytes} bytes of flash)`}</span>
        <textarea readonly spellcheck="false" rows="22">${esc(unoRuntime.hex ? '// Source is not available for an uploaded HEX file.' : example.source)}</textarea>
        <p class="module-footnote">To run your own sketch: in the Arduino IDE choose Sketch → Export Compiled Binary (or run <code>arduino-cli compile --output-dir . </code>) and load the <code>.hex</code> file above — the board must be Arduino Uno. The built-in examples were compiled with the official Arduino AVR core.</p>
      </section>
      <section class="mcu-middle">
        <div class="dsp-card"><div class="mcu-board" data-uno-board></div>
          <details class="mcu-wiring"><summary>Board wiring</summary><div class="mcu-wiring-grid">
            <label>LED pins<input data-uno-wire="leds" value="${esc(pinsText(board.leds))}" placeholder="13, 9"></label>
            <label>Buttons to GND<input data-uno-wire="buttons" value="${esc(pinsText(board.buttons))}" placeholder="2, 3"></label>
            <label>Potentiometers<input data-uno-wire="pots" value="${esc(pinsText(board.pots))}" placeholder="A0, A1"></label>
            <label class="check-label"><input type="checkbox" data-uno-wire="lcd" ${board.lcd ? 'checked' : ''}> LCD on 12, 11, 5, 4, 3, 2</label>
          </div></details></div>
        <div class="dsp-card"><span class="panel-label">SERIAL MONITOR</span><pre class="mcu-terminal" data-uno-terminal></pre>
          <div class="mcu-send"><input data-uno-input placeholder="Send text (newline added)"><button class="button ghost" data-action="uno-send">Send</button><button class="button ghost" data-action="uno-clear">Clear</button></div></div>
      </section>
      <section class="mcu-right"><div class="dsp-card"><span class="panel-label">ATMEGA328P · 16 MHz</span><div data-uno-cpu></div></div></section>
    </div>
    ${renderCosimPanel(config)}
    ${renderAnalyzerPanel('uno')}
    <p class="module-footnote">Instruction-level ATmega328P model (timers with PWM on the OCnx pins, USART, ADC, external and pin-change interrupts, EEPROM, SPI, TWI with an I²C LCD backpack and DS1307 RTC); register results and cycle counts match simavr on 190 test programs, and interrupt and PWM timing follow the datasheet.</p></div>`;
}

function bindUnoEvents() {
  const root = document.querySelector('[data-uno-root]');
  if (!root) return;
  bindAnalyzerEvents('uno');
  paintUno();
  root.querySelector('[data-action="uno-run"]')?.addEventListener('click', () => { if (unoRuntime.running) { unoStop(); paintUno(); } else unoStart(); });
  root.querySelector('[data-action="uno-reset"]')?.addEventListener('click', () => { unoStop(); if (unoRuntime.cosim) { unoRuntime.key = null; render(); return; } unoRuntime.board.reset(); unoRuntime.terminal = ''; paintUno(); });
  bindCosimEvents();
  root.querySelector('[data-uno-file]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) { notify('That file is too large for an ATmega328P.', 'error'); return; }
    try { const text = await file.text(); const parsed = parseIntelHex(text); if (parsed.size > 32_768) throw new RangeError('The program is larger than 32 KB of flash.'); unoRuntime.hex = { name: file.name, text, bytes: parsed.bytes }; unoRuntime.key = null; render(); notify(`Loaded ${file.name}`, 'success'); }
    catch (error) { notify(error.message, 'error'); }
  });
  const input = root.querySelector('[data-uno-input]');
  const send = () => { if (!input) return; unoRuntime.board.mcu.usart.receive([...`${input.value}\n`].map((character) => character.charCodeAt(0) & 0xff)); input.value = ''; };
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); send(); } });
  root.querySelector('[data-action="uno-send"]')?.addEventListener('click', send);
  root.querySelector('[data-action="uno-clear"]')?.addEventListener('click', () => { unoRuntime.terminal = ''; paintUno(); });
  root.addEventListener('pointerdown', (event) => { const button = event.target.closest('[data-uno-button]'); if (button) { unoRuntime.board.press(button.dataset.unoButton, true); paintUno(); } });
  root.addEventListener('pointerup', (event) => { const button = event.target.closest('[data-uno-button]'); if (button) { unoRuntime.board.press(button.dataset.unoButton, false); paintUno(); } });
  root.addEventListener('input', (event) => { const pot = event.target.closest('[data-uno-pot]'); if (pot) { unoRuntime.board.setPot(pot.dataset.unoPot, Number(pot.value)); paintUno(); } });
  root.querySelectorAll('[data-uno-wire]').forEach((field) => field.addEventListener('change', () => {
    const config = mcuConfiguration(getState());
    const board = structuredClone(config.avrBoard || unoExample(config).board);
    const list = field.value.split(/[\s,;]+/).filter(Boolean);
    try {
      list.forEach((pin) => unoPin(/^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase()));
      const kind = field.dataset.unoWire;
      if (kind === 'leds') board.leds = list.map((pin) => (/^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase()));
      else if (kind === 'buttons') board.buttons = list.map((pin) => ({ pin: /^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase(), to: 'GND' }));
      else if (kind === 'pots') board.pots = list.map((pin) => ({ pin: pin.toUpperCase(), volts: board.pots.find((pot) => pot.pin === pin.toUpperCase())?.volts ?? 2.5 }));
      else board.lcd = field.checked ? { rs: 12, enable: 11, d4: 5, d5: 4, d6: 3, d7: 2 } : null;
      persistMcu({ avrBoard: board });
    } catch (error) { notify(error.message, 'error'); }
  }));
  if (unoRuntime.running && !unoRuntime.frame) unoStart();
}

// ---------------------------------------------------------------------------
// Logic analyser panel (shared by the 8051 and Arduino simulators).

const LA_WINDOWS = [['0.5', '0.5 ms'], ['2', '2 ms'], ['10', '10 ms'], ['50', '50 ms'], ['200', '200 ms'], ['1000', '1 s'], ['5000', '5 s']];
const LA_DEFAULTS = {
  uno: { windowMs: '10', channels: ['D1', 'D2', 'D9', 'D10', 'D11', 'D13', 'A4', 'A5'], decoders: [{ type: 'uart', rx: 'D1', baud: 'auto', parity: 'none' }, { type: 'spi', sck: 'D13', mosi: 'D11', miso: 'D12', cs: 'D10', mode: 0 }, { type: 'i2c', scl: 'A5', sda: 'A4' }] },
  i8051: { windowMs: '50', channels: ['P1.0', 'P1.1', 'P1.2', 'P1.3', 'P3.1', 'P3.2'], decoders: [{ type: 'uart', rx: 'P3.1', baud: 'auto', parity: 'none' }] },
};
const laState = { frozen: { uno: false, i8051: false }, offset: { uno: 0, i8051: 0 }, imported: { uno: null, i8051: null }, lastPaint: 0 };

function laConfig(target) {
  const config = mcuConfiguration(getState());
  return { ...LA_DEFAULTS[target], ...(config.analyzer?.[target] || {}) };
}
function persistLa(target, patch) {
  const config = mcuConfiguration(getState());
  persistMcu({ analyzer: { ...(config.analyzer || {}), [target]: { ...laConfig(target), ...patch } } });
}
function laSource(target) {
  if (laState.imported[target]) return { channels: laState.imported[target].channels, end: laState.imported[target].end, imported: true };
  const recorder = target === 'uno' ? unoRuntime.board?.recorder : mcuRuntime.board?.recorder;
  if (!recorder) return null;
  // The view ends at the most recent activity, so bursts stay on screen after the line goes idle.
  const now = target === 'uno' ? unoRuntime.board.cpu.cycles / unoRuntime.board.cpu.clock : mcuRuntime.cpu.cycles * 12 / mcuRuntime.cpu.clock;
  return { channels: recorder.list(), end: recorder.end > 0 ? recorder.end + 0.05 * Number(laConfig(target).windowMs) / 1000 : now, imported: false };
}

function laDecode(decoder, byName, from, to) {
  const ch = (name) => byName.get(name);
  const margin = 0.02 * (to - from) + 2e-3;
  if (decoder.type === 'uart') {
    const rx = ch(decoder.rx);
    if (!rx) return [];
    const baud = decoder.baud === 'auto' ? estimateBaud(sliceChannel(rx, from - 0.2, to)) || 9600 : Number(decoder.baud);
    return decodeUart(sliceChannel(rx, from - margin, to), { baud, parity: decoder.parity || 'none' })
      .filter((frame) => frame.end >= from && frame.start <= to)
      .map((frame) => ({ start: frame.start, end: frame.end, text: frame.value >= 32 && frame.value < 127 ? `'${String.fromCharCode(frame.value)}'` : `${hex2(frame.value)}h`, detail: `${hex2(frame.value)}h${frame.framingError ? ' framing error' : ''}${frame.parityOk ? '' : ' parity error'}`, error: frame.framingError || !frame.parityOk, label: `UART ${decoder.rx} @ ${baud}` }));
  }
  if (decoder.type === 'spi') {
    if (!ch(decoder.sck) || !ch(decoder.mosi)) return [];
    const slice = (name) => (ch(name) ? sliceChannel(ch(name), from - margin, to) : null);
    return decodeSpi({ sck: slice(decoder.sck), mosi: slice(decoder.mosi), miso: slice(decoder.miso), cs: slice(decoder.cs) }, { mode: Number(decoder.mode) || 0 })
      .map((word) => ({ start: word.start, end: word.end, text: `${hex2(word.mosi)}h`, detail: `MOSI ${hex2(word.mosi)}h${word.miso !== null ? ` · MISO ${hex2(word.miso)}h` : ''}`, label: `SPI mode ${decoder.mode}` }));
  }
  if (decoder.type === 'i2c') {
    if (!ch(decoder.scl) || !ch(decoder.sda)) return [];
    return decodeI2c({ scl: sliceChannel(ch(decoder.scl), from - margin, to), sda: sliceChannel(ch(decoder.sda), from - margin, to) })
      .map((event) => ({ start: event.t, end: event.end ?? event.t, text: event.type === 'address' ? `${hex2(event.address)}h ${event.read ? 'R' : 'W'}${event.ack ? '' : ' NACK'}` : event.type === 'data' ? `${hex2(event.value)}h${event.ack ? '' : ' N'}` : event.type === 'start' ? 'S' : event.type === 'stop' ? 'P' : 'Sr', detail: event.type, error: event.ack === false && event.type === 'address', label: 'I²C' }));
  }
  return [];
}

function laSvg(target, pixelWidth = 1000) {
  const config = laConfig(target);
  const source = laSource(target);
  if (!source) return '<p class="module-footnote">Run a program to capture signals.</p>';
  const windowSeconds = Number(config.windowMs) / 1000;
  const to = source.end - (laState.offset[target] || 0) * windowSeconds;
  const from = Math.max(0, to - windowSeconds);
  const byName = new Map(source.channels.map((channel) => [channel.name, channel]));
  const channels = source.imported ? source.channels.slice(0, 16) : config.channels.map((name) => byName.get(name)).filter(Boolean);
  const decoders = config.decoders.map((decoder) => ({ decoder, items: laDecode(decoder, byName, from, to) })).filter((entry) => entry.items.length || !source.imported);
  const width = Math.max(400, Math.round(pixelWidth)), labelWidth = 70, rowHeight = 26, decoderHeight = 24;
  const x = (t) => labelWidth + ((t - from) / (to - from || 1)) * (width - labelWidth);
  const rows = [];
  let y = 18;
  channels.forEach((channel) => {
    const slice = sliceChannel(channel, from, to);
    const top = y + 4, bottom = y + rowHeight - 6;
    const level = (v) => (v ? top : bottom);
    let path = `M${labelWidth} ${level(slice.initial)}`;
    const dense = slice.edges.length > 1500;
    if (dense) path += `L${width} ${level(slice.initial)}`;
    else { let current = slice.initial; for (const edge of slice.edges) { const px = x(edge.t).toFixed(1); path += `L${px} ${level(current)}L${px} ${level(edge.v)}`; current = edge.v; } path += `L${width} ${level(current)}`; }
    rows.push(`<text class="la-name" x="4" y="${y + 16}">${esc(channel.name)}</text>${dense ? `<rect class="la-busy" x="${labelWidth}" y="${top}" width="${width - labelWidth}" height="${bottom - top}"/><text class="la-note" x="${labelWidth + 6}" y="${y + 16}">${slice.edges.length} edges — zoom in</text>` : `<path class="la-wave" d="${path}"/>`}`);
    y += rowHeight;
  });
  decoders.forEach(({ decoder, items }) => {
    rows.push(`<text class="la-name decoder" x="4" y="${y + 15}">${esc(decoder.type.toUpperCase())}</text>`);
    for (const item of items.slice(0, 400)) {
      const x1 = Math.max(labelWidth, x(item.start)), x2 = Math.min(width, Math.max(x(item.end), x1 + 3));
      rows.push(`<g><title>${esc(`${item.label}: ${item.detail}`)}</title><rect class="la-frame${item.error ? ' error' : ''}" x="${x1.toFixed(1)}" y="${y + 3}" width="${(x2 - x1).toFixed(1)}" height="${decoderHeight - 6}" rx="3"/>${x2 - x1 > 22 ? `<text class="la-frame-text" x="${((x1 + x2) / 2).toFixed(1)}" y="${y + 16}">${esc(item.text)}</text>` : ''}</g>`);
    }
    y += decoderHeight;
  });
  const ticks = Array.from({ length: 6 }, (_, k) => { const t = from + (to - from) * k / 5; return `<line class="la-grid" x1="${x(t)}" x2="${x(t)}" y1="12" y2="${y}"/><text class="la-time" x="${x(t)}" y="10">${esc(eng(t, 's'))}</text>`; }).join('');
  return `<svg class="la-svg" viewBox="0 0 ${width} ${y + 4}" width="${width}" height="${y + 4}">${ticks}${rows.join('')}</svg>`;
}

function renderAnalyzerPanel(target) {
  const config = laConfig(target);
  const names = target === 'uno' ? PIN_LABELS : [0, 1, 2, 3].flatMap((port) => Array.from({ length: 8 }, (_, bit) => `P${port}.${bit}`));
  const decoderRow = (decoder, index) => {
    const select = (key, value) => `<select data-la-decoder="${index}" data-la-key="${key}">${['', ...names].map((name) => `<option value="${name}" ${name === value ? 'selected' : ''}>${name || '—'}</option>`).join('')}</select>`;
    if (decoder.type === 'uart') return `<div class="la-decoder"><b>UART</b> RX ${select('rx', decoder.rx)} baud <select data-la-decoder="${index}" data-la-key="baud">${['auto', 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((rate) => `<option value="${rate}" ${String(rate) === String(decoder.baud) ? 'selected' : ''}>${rate}</option>`).join('')}</select> parity <select data-la-decoder="${index}" data-la-key="parity">${['none', 'even', 'odd'].map((p) => `<option ${p === decoder.parity ? 'selected' : ''}>${p}</option>`).join('')}</select><button class="tool" data-la-remove="${index}">✕</button></div>`;
    if (decoder.type === 'spi') return `<div class="la-decoder"><b>SPI</b> SCK ${select('sck', decoder.sck)} MOSI ${select('mosi', decoder.mosi)} MISO ${select('miso', decoder.miso)} CS ${select('cs', decoder.cs)} mode <select data-la-decoder="${index}" data-la-key="mode">${[0, 1, 2, 3].map((m) => `<option ${m === Number(decoder.mode) ? 'selected' : ''}>${m}</option>`).join('')}</select><button class="tool" data-la-remove="${index}">✕</button></div>`;
    return `<div class="la-decoder"><b>I²C</b> SCL ${select('scl', decoder.scl)} SDA ${select('sda', decoder.sda)}<button class="tool" data-la-remove="${index}">✕</button></div>`;
  };
  return `<details class="dsp-card la-panel" data-la-target="${target}" ${config.open === false ? '' : 'open'}><summary><span class="panel-label">LOGIC ANALYSER</span></summary>
    <div class="la-controls dsp-controls">
      ${labSelect('data-la-field', 'windowMs', 'Time window', config.windowMs, LA_WINDOWS)}
      <label>Scroll back<input type="range" min="0" max="20" step="0.25" value="${laState.offset[target] || 0}" data-la-offset></label>
      <button class="button ghost" data-la-action="freeze">${laState.frozen[target] ? 'Live' : 'Freeze'}</button>
      <button class="button ghost" data-la-action="export">Export VCD</button>
      <label>Import VCD<input type="file" accept=".vcd" data-la-import></label>
      ${laState.imported[target] ? '<button class="button ghost" data-la-action="live">Back to simulator</button>' : ''}
      <button class="button ghost" data-la-action="add-uart">+ UART</button><button class="button ghost" data-la-action="add-spi">+ SPI</button><button class="button ghost" data-la-action="add-i2c">+ I²C</button>
    </div>
    <details class="la-channels"><summary>Channels (${config.channels.length})</summary><div>${names.map((name) => `<label class="check-label"><input type="checkbox" data-la-channel="${name}" ${config.channels.includes(name) ? 'checked' : ''}> ${name}</label>`).join('')}</div></details>
    <div class="la-decoders">${config.decoders.map(decoderRow).join('')}</div>
    <div class="la-view" data-la-view>${laSvg(target)}</div>
    <p class="module-footnote">Captures every pin with exact simulated timestamps; the USART, SPI and TWI hardware draw their real waveforms on TXD, SCK/MOSI/MISO and SCL/SDA. UART, SPI and I²C decoding match sigrok's decoders. Exported VCD files open in GTKWave, PulseView and sigrok.</p></details>`;
}

function paintAnalyzer(target, force = false) {
  const now = performance.now();
  if (!force && now - laState.lastPaint < 200) return;
  laState.lastPaint = now;
  if (laState.frozen[target] && !force) return;
  const view = document.querySelector(`[data-la-target="${target}"] [data-la-view]`);
  if (view && view.closest('details')?.open) view.innerHTML = laSvg(target, view.clientWidth || 1000);
}

function bindAnalyzerEvents(target) {
  const panel = document.querySelector(`[data-la-target="${target}"]`);
  if (!panel) return;
  const config = () => laConfig(target);
  panel.addEventListener('toggle', (event) => { if (event.target === panel && panel.open !== (config().open !== false)) persistLa(target, { open: panel.open }); });
  panel.querySelectorAll('[data-la-field]').forEach((field) => field.addEventListener('change', () => persistLa(target, { [field.dataset.laField]: field.value })));
  panel.querySelector('[data-la-offset]')?.addEventListener('input', (event) => { laState.offset[target] = Number(event.target.value); paintAnalyzer(target, true); });
  panel.querySelectorAll('[data-la-channel]').forEach((box) => box.addEventListener('change', () => {
    const channels = new Set(config().channels);
    if (box.checked) channels.add(box.dataset.laChannel); else channels.delete(box.dataset.laChannel);
    const order = target === 'uno' ? PIN_LABELS : [0, 1, 2, 3].flatMap((port) => Array.from({ length: 8 }, (_, bit) => `P${port}.${bit}`));
    persistLa(target, { channels: order.filter((name) => channels.has(name)) });
  }));
  panel.querySelectorAll('[data-la-decoder]').forEach((field) => field.addEventListener('change', () => {
    const decoders = structuredClone(config().decoders);
    decoders[Number(field.dataset.laDecoder)][field.dataset.laKey] = field.dataset.laKey === 'mode' ? Number(field.value) : field.value;
    persistLa(target, { decoders });
  }));
  panel.querySelectorAll('[data-la-remove]').forEach((button) => button.addEventListener('click', () => { const decoders = structuredClone(config().decoders); decoders.splice(Number(button.dataset.laRemove), 1); persistLa(target, { decoders }); }));
  panel.querySelectorAll('[data-la-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.laAction;
    const uno = target === 'uno';
    if (action === 'freeze') { laState.frozen[target] = !laState.frozen[target]; button.textContent = laState.frozen[target] ? 'Live' : 'Freeze'; paintAnalyzer(target, true); }
    else if (action === 'live') { laState.imported[target] = null; render(); }
    else if (action.startsWith('add-')) {
      const type = action.slice(4);
      const fresh = type === 'uart' ? { type, rx: uno ? 'D1' : 'P3.1', baud: 'auto', parity: 'none' } : type === 'spi' ? { type, sck: uno ? 'D13' : 'P1.0', mosi: uno ? 'D11' : 'P1.1', miso: uno ? 'D12' : '', cs: uno ? 'D10' : '', mode: 0 } : { type, scl: uno ? 'A5' : 'P1.6', sda: uno ? 'A4' : 'P1.7' };
      persistLa(target, { decoders: [...config().decoders, fresh] });
    } else if (action === 'export') {
      const source = laSource(target);
      if (!source) { notify('Nothing captured yet.', 'error'); return; }
      const selected = source.imported ? source.channels : config().channels.map((name) => source.channels.find((channel) => channel.name === name)).filter(Boolean);
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([toVcd(selected, { endTime: source.end })], { type: 'text/plain' })); link.download = `${uno ? 'arduino' : '8051'}-capture.vcd`; link.click(); URL.revokeObjectURL(link.href);
    }
  }));
  panel.querySelector('[data-la-import]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20_000_000) { notify('VCD file is too large (20 MB limit).', 'error'); return; }
    try {
      const channels = fromVcd(await file.text());
      if (!channels.length) throw new Error('No 1-bit signals found in that VCD file.');
      const end = Math.max(...channels.map((channel) => (channel.edges.length ? channel.edges[channel.edges.length - 1].t : 0)));
      laState.imported[target] = { channels, end, name: file.name };
      persistLa(target, { windowMs: String(Math.max(0.5, Math.round(end * 1000))) });
      notify(`Imported ${channels.length} signals from ${file.name}`, 'success');
    } catch (error) { notify(error.message, 'error'); }
  });
}

const CONTROL_DEFAULTS = Object.freeze({
  tab: 'first-order', numerator: '10', denominator: 's(s+1)(s+5)', feedback: true, duration: '',
  locusNumerator: '1', locusDenominator: 's(s+2)(s+4)', locusGain: 20, routh: 's^4 + 2s^3 + 3s^2 + 4s + 5',
  plantNumerator: '1', plantDenominator: '(s+1)^3', kp: 2, ki: 1, kd: 0.5, tf: 0.01,
});
const CONTROL_TABS = [['first-order', 'First-order step'], ['analysis', 'Transfer function'], ['locus', 'Root locus & Routh'], ['pid', 'PID tuning']];
const CONTROL_TEXT_FIELDS = ['numerator', 'denominator', 'duration', 'locusNumerator', 'locusDenominator', 'routh', 'plantNumerator', 'plantDenominator'];

function controlConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'control-lab')?.inputs || {};
  return { ...CONTROL_DEFAULTS, ...saved };
}

function persistControl(patch) {
  recordExperiment({ id: 'control-lab', kind: 'control', operation: 'control-lab', inputs: { ...controlConfiguration(getState()), ...patch } });
}

const controlField = (...args) => labField('data-control-lab-field', ...args);
const textAttributes = 'type="text" spellcheck="false" maxlength="200"';
const fraction = (name, numerator, denominator) => `<div class="tf-display"><span>${esc(name)} =</span><div class="tf-fraction"><span>${esc(formatPolynomial(numerator))}</span><span>${esc(formatPolynomial(denominator))}</span></div></div>`;
const rootList = (roots) => (roots.length ? roots.map(complexText).join(', ') : 'none');
const timeOrDash = (value) => (value === null || !Number.isFinite(value) ? '—' : eng(value, 's'));
const marginText = (value, unit, crossover) => (Number.isFinite(value) ? `${fmt(value, 2)} ${unit}${crossover ? ` at ${fmt(crossover, 4)} rad/s` : ''}` : '∞ (no crossover)');
const STABILITY_TEXT = { stable: 'Stable — all poles in the left half-plane', marginal: 'Marginally stable — poles on the jω axis', unstable: 'Unstable — pole(s) in the right half-plane' };

function timePlot(title, response, color, extra = []) {
  const series = [{ xs: response.time, ys: response.output, color, primary: true }, ...extra];
  const values = series.flatMap((entry) => entry.ys).filter(Number.isFinite);
  const stop = response.time.at(-1) || 1;
  return renderPlotFrame({ title, series, xMin: 0, xMax: stop, xTicks: linearTicks(0, stop, 's'), yRange: niceRange(Math.min(0, ...values), Math.max(0, ...values)), formatY: (value) => fmt(value, 2) });
}

function bodePlots(result) {
  const first = result.omega[0], last = result.omega.at(-1);
  const xTicks = decadeTicks(first, last).map((omega) => ({ position: (Math.log10(omega) - Math.log10(first)) / (Math.log10(last) - Math.log10(first) || 1), text: `${eng(omega, '')}` }));
  const magnitude = result.magnitudeDb.map((value) => Math.max(-200, Math.min(200, value)));
  return renderPlotFrame({ title: 'Bode magnitude (dB) vs ω (rad/s)', series: [{ xs: result.omega, ys: magnitude, color: PLOT_COLORS[0], primary: true }, { xs: [first, last], ys: [0, 0], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...magnitude), Math.max(...magnitude, 0)), formatY: (value) => `${fmt(value, 0)} dB` })
    + renderPlotFrame({ title: 'Bode phase (°) vs ω (rad/s)', series: [{ xs: result.omega, ys: result.phase, color: PLOT_COLORS[1], primary: true }, { xs: [first, last], ys: [-180, -180], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...result.phase, -180), Math.max(...result.phase)), formatY: (value) => `${fmt(value, 0)}°` });
}

function nyquistPlane(data) {
  const points = data.real.map((re, index) => ({ re, im: data.imaginary[index] })).filter((point) => Number.isFinite(point.re) && Number.isFinite(point.im));
  // Frame the region around −1 that decides stability; far-away branches run off the edge.
  const near = points.filter((point) => Math.hypot(point.re, point.im) <= 10);
  const extent = Math.max(1.5, ...near.map((point) => Math.max(Math.abs(point.re), Math.abs(point.im)))) * 1.15;
  return renderComplexPlane({ label: 'Nyquist plot', extent, criticalPoint: true, curves: [{ points, color: PLOT_COLORS[0] }, { points: points.map((point) => ({ re: point.re, im: -point.im })), color: PLOT_COLORS[1], dashed: true }] });
}

function renderControlAnalysisTab(config) {
  const controls = `<div class="dsp-controls">${controlField('numerator', 'Numerator N(s)', config.numerator, '', textAttributes)}${controlField('denominator', 'Denominator D(s)', config.denominator, '', textAttributes)}${controlField('duration', 'Time span (blank = auto)', config.duration, 's', textAttributes)}<label class="check-label"><input type="checkbox" data-control-lab-field="feedback" ${config.feedback ? 'checked' : ''}> Unity negative feedback</label></div>
    <p class="module-footnote">Type polynomials as "s^2 + 2s + 1", "(s+1)(s+3)", "s(s+2)^2" or coefficient lists like "1 2 1".</p>`;
  let analysis;
  try { analysis = analyzeSystem(config.numerator, config.denominator, { feedback: Boolean(config.feedback), duration: config.duration === '' ? undefined : Number(config.duration) }); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Transfer function</b><span>${esc(error.message)}</span></div></section>`; }
  const { open, system, info, bode: frequency } = analysis;
  const label = config.feedback ? 'T(s)' : 'G(s)';
  const plots = [];
  if (analysis.step) {
    const final = analysis.stability.status === 'stable' ? analysis.dcGain : null;
    plots.push(timePlot(`${label} unit-step response${analysis.step.diverged ? ' (diverging)' : ''}`, analysis.step, PLOT_COLORS[0], final === null ? [] : [{ xs: [0, analysis.step.time.at(-1)], ys: [final, final], color: '#94a3b8', dashed: true }]));
    plots.push(timePlot(`${label} impulse response`, analysis.impulse, PLOT_COLORS[4]));
  }
  plots.push(bodePlots(frequency));
  const pzPoints = [...system.poles, ...system.zeros];
  return `<section class="dsp-card">${controls}
    <div class="tf-row">${fraction('G(s)', open.numerator, open.denominator)}${config.feedback ? fraction('T(s) = G / (1 + G)', system.numerator, system.denominator) : ''}</div>
    ${analysis.step ? '' : '<div class="diagnostic warning"><b>Improper system</b><span>The numerator degree exceeds the denominator degree, so only frequency-domain results are shown.</span></div>'}
    <div class="analysis-readouts comm-readouts">${readout('Stability', STABILITY_TEXT[analysis.stability.status])}${readout(`Poles of ${label}`, rootList(system.poles))}${readout(`Zeros of ${label}`, rootList(system.zeros))}${readout('DC gain', Number.isFinite(analysis.dcGain) ? fmt(analysis.dcGain, 4) : '∞ (integrator)')}
    ${info && analysis.stability.status === 'stable' ? `${readout('Rise time (10–90 %)', timeOrDash(info.riseTime))}${readout('Overshoot', `${fmt(info.overshoot, 2)} %`)}${readout('Peak time', timeOrDash(info.peakTime))}${readout('Settling time (2 %)', timeOrDash(info.settlingTime))}${readout('Steady-state error (step)', fmt(info.steadyStateError, 4))}` : ''}
    ${readout('Gain margin of G', marginText(frequency.margins.gainMarginDb, 'dB', frequency.margins.phaseCrossover))}${readout('Phase margin of G', marginText(frequency.margins.phaseMarginDeg, '°', frequency.margins.gainCrossover))}</div>
    <div class="analysis-plots comm-plots">${plots.join('')}</div>
    <div class="filter-lower"><div><span class="panel-label">POLE-ZERO MAP OF ${label} (s-plane)</span>${renderComplexPlane({ label: 'Pole-zero map', extent: planeExtent(pzPoints), poles: system.poles, zeros: system.zeros })}</div>
    <div><span class="panel-label">NYQUIST PLOT OF G(jω) — solid ω &gt; 0, dashed ω &lt; 0, ● = −1</span>${nyquistPlane(analysis.nyquist)}</div></div>
    <p class="module-footnote">Time responses use exact matrix-exponential discretisation of the state-space model (matching scipy.signal.step). Margins are measured on the open loop G(s).</p></section>`;
}

function renderLocusTab(config) {
  const controls = `<div class="dsp-controls">${controlField('locusNumerator', 'Open-loop N(s)', config.locusNumerator, '', textAttributes)}${controlField('locusDenominator', 'Open-loop D(s)', config.locusDenominator, '', textAttributes)}${controlField('locusGain', 'Gain K', config.locusGain, '', 'type="number" min="0" step="any"')}</div>`;
  let body = '';
  try {
    const open = makeTransferFunction(config.locusNumerator, config.locusDenominator);
    const locus = rootLocus(open);
    const gain = Math.max(0, Number(config.locusGain) || 0);
    const characteristic = polyadd(open.denominator, open.numerator.map((value) => value * gain));
    const closedPoles = polyRoots(characteristic);
    const stability = classifyStability(closedPoles);
    const reference = [...locus.poles, ...locus.zeros, ...locus.crossings.map((crossing) => ({ re: 0, im: crossing.omega })), ...closedPoles];
    if (locus.centroid !== null) reference.push({ re: locus.centroid, im: 0 });
    const extent = planeExtent(reference);
    const curves = locus.branches.map((branch, index) => ({ points: branch, color: PLOT_COLORS[index % PLOT_COLORS.length] }));
    body = `${fraction('G(s)', open.numerator, open.denominator)}
      <div class="filter-lower"><div><span class="panel-label">ROOT LOCUS OF 1 + K·G(s) = 0 (■ = poles at K)</span>${renderComplexPlane({ label: 'Root locus', extent, curves, poles: locus.poles, zeros: locus.zeros, marks: closedPoles })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Open-loop poles', rootList(locus.poles))}${readout('Open-loop zeros', rootList(locus.zeros))}${readout('Asymptote centroid', locus.centroid === null ? '—' : fmt(locus.centroid, 4))}${readout('Asymptote angles', locus.asymptoteAngles.length ? locus.asymptoteAngles.map((angle) => `${fmt(angle, 1)}°`).join(', ') : 'none')}
      ${readout('jω-axis crossings', locus.crossings.length ? locus.crossings.map((crossing) => `K = ${fmt(crossing.gain, 4)} at ω = ${fmt(crossing.omega, 4)} rad/s`).join('; ') : 'none')}${readout(`Closed-loop poles at K = ${fmt(gain, 4)}`, rootList(closedPoles))}${readout('Closed loop at this K', STABILITY_TEXT[stability.status])}</div>
      <button class="button ghost" data-control-routh="${esc(characteristic.map((value) => Number(value.toPrecision(10))).join(' '))}">Send 1 + K·G(s) to Routh table</button></div></div>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Root locus</b><span>${esc(error.message)}</span></div>`; }
  let routhBlock;
  try {
    const routh = routhArray(config.routh);
    const width = Math.max(...routh.rows.map((row) => row.values.length));
    routhBlock = `<div class="analysis-readouts comm-readouts">${readout('Polynomial', formatPolynomial(routh.coefficients))}${readout('Sign changes in first column', routh.signChanges)}${readout('Verdict', routh.verdict)}</div>
      <table class="truth-table routh-table"><tbody>${routh.rows.map((row) => `<tr><th>s<sup>${row.power}</sup></th>${Array.from({ length: width }, (_, index) => `<td class="${index === 0 ? 'routh-first' : ''}">${row.values[index] === undefined ? '' : fmt(row.values[index], 4)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${routh.notes.map((note) => `<p class="module-footnote">${esc(note)}</p>`).join('')}`;
  } catch (error) { routhBlock = `<div class="diagnostic error"><b>Routh-Hurwitz</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}
    <div class="coding-block routh-block"><span class="panel-label">ROUTH-HURWITZ STABILITY TABLE</span><div class="dsp-controls">${controlField('routh', 'Characteristic polynomial', config.routh, '', textAttributes)}</div>${routhBlock}</div></section>`;
}

function renderPidTab(config) {
  const gains = { kp: Number(config.kp), ki: Number(config.ki), kd: Number(config.kd), tf: Number(config.tf) };
  const controls = `<div class="dsp-controls">${controlField('plantNumerator', 'Plant N(s)', config.plantNumerator, '', textAttributes)}${controlField('plantDenominator', 'Plant D(s)', config.plantDenominator, '', textAttributes)}${controlField('kp', 'Kp', config.kp)}${controlField('ki', 'Ki', config.ki)}${controlField('kd', 'Kd', config.kd)}${controlField('tf', 'Derivative filter Tf', config.tf, 's')}</div>`;
  let plant, loop, tuning;
  try { plant = makeTransferFunction(config.plantNumerator, config.plantDenominator); loop = pidLoop(plant, gains); tuning = zieglerNichols(plant); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>PID loop</b><span>${esc(error.message)}</span></div></section>`; }
  const stop = loop.response.time.at(-1);
  const plantStability = classifyStability(plant.poles).status;
  const extra = [];
  if (plantStability === 'stable' && plant.proper) {
    const openStep = timeResponse(plant, { duration: stop, points: loop.response.time.length });
    extra.push({ xs: openStep.time, ys: openStep.output, color: PLOT_COLORS[1] });
  }
  extra.push({ xs: [0, stop], ys: [1, 1], color: '#94a3b8', dashed: true });
  const plot = timePlot(`Closed-loop step: PID (teal)${extra.length > 1 ? ', plant alone (blue)' : ''}, set-point (grey)`, loop.response, PLOT_COLORS[0], extra);
  const info = loop.info;
  const stable = loop.stability.status === 'stable';
  const znTable = tuning.rules.length
    ? `<table class="truth-table comm-table"><thead><tr><th>Rule</th><th>Kp</th><th>Ti</th><th>Td</th><th>Ki</th><th>Kd</th><th></th></tr></thead><tbody>${tuning.rules.map((rule) => `<tr><td>${rule.name}</td><td>${fmt(rule.kp, 4)}</td><td>${rule.ti ? fmt(rule.ti, 4) : '∞'}</td><td>${fmt(rule.td, 4)}</td><td>${fmt(rule.ki, 4)}</td><td>${fmt(rule.kd, 4)}</td><td><button class="button ghost small" data-control-zn="${rule.name}">Apply</button></td></tr>`).join('')}</tbody></table>`
    : `<p class="module-footnote">${esc(tuning.note)}</p>`;
  return `<section class="dsp-card">${controls}
    <div class="tf-row">${fraction('G(s)', plant.numerator, plant.denominator)}${fraction('C(s)', pidController(gains).numerator, pidController(gains).denominator)}</div>
    <div class="analysis-readouts comm-readouts">${readout('Closed loop', STABILITY_TEXT[loop.stability.status])}${stable ? `${readout('Rise time (10–90 %)', timeOrDash(info.riseTime))}${readout('Overshoot', `${fmt(info.overshoot, 2)} %`)}${readout('Settling time (2 %)', timeOrDash(info.settlingTime))}${readout('Steady-state error', fmt(info.steadyStateError, 4))}` : ''}${readout('Gain margin of C·G', marginText(loop.margins.gainMarginDb, 'dB', loop.margins.phaseCrossover))}${readout('Phase margin of C·G', marginText(loop.margins.phaseMarginDeg, '°', loop.margins.gainCrossover))}</div>
    <div class="analysis-plots">${plot}</div>
    <span class="panel-label">ZIEGLER-NICHOLS (ULTIMATE-GAIN METHOD)</span>
    <div class="analysis-readouts comm-readouts">${readout('Ultimate gain Ku', tuning.ultimateGain === null ? '—' : fmt(tuning.ultimateGain, 4))}${readout('Ultimate period Tu', tuning.ultimatePeriod === null ? '—' : eng(tuning.ultimatePeriod, 's'))}</div>${znTable}
    <p class="module-footnote">C(s) = Kp + Ki/s + Kd·s/(Tf·s + 1). Ziegler-Nichols gains are a starting point and usually give about 25–60 % overshoot; reduce Kp or Kd to tame it.</p></section>`;
}

function renderFirstOrderTab(state) {
  const result = state.simulation?.kind === 'control' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'control-step')?.inputs || {};
  const values = result?.response?.data ? Array.from(result.response.data) : [];
  const max = Math.max(1, ...(values.length ? values : [1]));
  const path = values.length > 1 ? values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 560).toFixed(1)} ${(150 - (value / max) * 130).toFixed(1)}`).join(' ') : '';
  return `<section class="dsp-card"><div class="dsp-controls"><label>Gain<input type="number" step="0.1" data-control-field="gain" value="${esc(config.gain ?? 1)}"></label><label>Time constant<input type="number" min="0.001" step="0.001" data-control-field="tau" value="${esc(config.tau ?? 0.1)}"><span>s</span></label><label>Sample rate<input type="number" min="1" step="1" data-control-field="sampleRate" value="${esc(config.sampleRate ?? 100)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-control-field="length" value="${esc(config.length ?? 256)}"></label><button class="button run" data-action="run-control">Run step response</button><button class="button ghost" data-action="export-control">Export response</button></div>
    <div class="dsp-plot"><span class="panel-label">STEP RESPONSE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div>
    <div class="stat-grid"><div><span>Stability</span><strong>${result ? (result.stability.stable ? 'Stable' : 'Unstable') : '—'}</strong><small>first-order pole</small></div><div><span>Final value</span><strong>${result ? fmt(values.at(-1), 3) : '—'}</strong><small>output units</small></div><div><span>Samples</span><strong>${values.length || '—'}</strong><small>bounded local array</small></div></div>
    <p class="module-footnote">This built-in experiment uses a deterministic first-order model. It does not claim python-control, Scilab or hardware-in-the-loop availability.</p></section>`;
}

function renderControl(state) {
  const config = controlConfiguration(state);
  const body = config.tab === 'analysis' ? renderControlAnalysisTab(config) : config.tab === 'locus' ? renderLocusTab(config) : config.tab === 'pid' ? renderPidTab(config) : renderFirstOrderTab(state);
  return `<div class="page scroll-page control-page">${pageHeader(modules.find((item) => item.id === 'iot'), 'BUILT-IN CONTROL LAB', '<span class="pill live"><i></i> LOCAL MODEL</span>')}
    ${labTabs(CONTROL_TABS, config.tab, 'data-control-tab')}${body}</div>`;
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
  const experimentModules = { 'signals-fft': 'dsp', 'dsp-lab': 'dsp', 'control-step': 'iot', 'control-lab': 'iot', 'comm-lab': 'communication', 'qpsk-ber': 'communication', 'rf-touchstone': 'rf', 'rf-lab': 'rf', 'calc-lab': 'calc', 'pcb-board': 'pcb', 'mcu-lab': 'mcu', 'bench-lab': 'bench', 'lab-record': 'record', 'power-lab': 'power', 'adc-lab': 'adc', 'sensor-lab': 'sensors', 'ev-lab': 'ev', 'topology-metrics': 'network', 'vcd-import': 'fpga' };
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

function bindDspLabEvents() {
  document.querySelectorAll('[data-dsp-tab]').forEach((button) => button.addEventListener('click', () => persistDsp({ tab: button.dataset.dspTab })));
  document.querySelectorAll('[data-dsp-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.dspLabField;
    const text = ['method', 'filterType', 'window', 'convX', 'convH'].includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistDsp({ [name]: value });
  }));
  document.querySelectorAll('[data-dsp-conv-n]').forEach((button) => button.addEventListener('click', () => persistDsp({ convN: Number(button.dataset.dspConvN) })));
}

function bindControlLabEvents() {
  document.querySelectorAll('[data-control-tab]').forEach((button) => button.addEventListener('click', () => persistControl({ tab: button.dataset.controlTab })));
  document.querySelectorAll('[data-control-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.controlLabField;
    if (field.type === 'checkbox') { persistControl({ [name]: field.checked }); return; }
    const text = CONTROL_TEXT_FIELDS.includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistControl({ [name]: value });
  }));
  document.querySelector('[data-control-routh]')?.addEventListener('click', (event) => persistControl({ routh: event.currentTarget.dataset.controlRouth }));
  document.querySelectorAll('[data-control-zn]').forEach((button) => button.addEventListener('click', () => {
    const config = controlConfiguration(getState());
    try {
      const rule = zieglerNichols(makeTransferFunction(config.plantNumerator, config.plantDenominator)).rules.find((entry) => entry.name === button.dataset.controlZn);
      if (!rule) return;
      const round = (value) => Number(value.toPrecision(4));
      persistControl({ kp: round(rule.kp), ki: round(rule.ki), kd: round(rule.kd) });
      notify(`Ziegler-Nichols ${rule.name} gains applied`, 'success');
    } catch (error) { notify(error.message, 'error'); }
  }));
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

function bindCommLabEvents() {
  document.querySelectorAll('[data-comm-tab]').forEach((button) => button.addEventListener('click', () => persistComm({ tab: button.dataset.commTab })));
  document.querySelectorAll('[data-comm-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.commLabField;
    const text = ['scheme', 'digitalScheme', 'eyePulse', 'law', 'lineBits', 'hammingData', 'crcMessage', 'crcPolynomial', 'convData'].includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    const reset = name === 'hammingData' ? { hammingFlips: [] } : name === 'convData' ? { convFlips: [] } : {};
    persistComm({ [name]: value, ...reset });
  }));
  document.querySelector('[data-comm-crc-preset]')?.addEventListener('change', (event) => { if (event.target.value) persistComm({ crcPolynomial: event.target.value }); });
  document.querySelectorAll('[data-comm-flip]').forEach((button) => button.addEventListener('click', () => {
    const [kind, index] = button.dataset.commFlip.split(':');
    if (kind === 'none') return;
    const key = kind === 'hamming' ? 'hammingFlips' : 'convFlips';
    const flips = commConfiguration(getState())[key];
    const position = Number(index);
    persistComm({ [key]: flips.includes(position) ? flips.filter((value) => value !== position) : [...flips, position] });
  }));
  document.querySelector('[data-action="comm-ber-curve"]')?.addEventListener('click', () => {
    const config = commConfiguration(getState());
    try { setState({ commBerCurve: berCurve({ scheme: config.digitalScheme, from: 0, to: 12, step: 1, bitsPerPoint: 100_000 }) }); notify('BER curve computed', 'success'); }
    catch (error) { notify(error.message, 'error'); }
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

function bindRfLabEvents() {
  document.querySelectorAll('[data-rf-tab]').forEach((button) => button.addEventListener('click', () => persistRf({ tab: button.dataset.rfTab })));
  document.querySelectorAll('[data-rf-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.rfLabField;
    const text = RF_TEXT_FIELDS.includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistRf({ [name]: value });
  }));
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
    wireSource = null;
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
  wireSource = null;
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
  const nodes = new Set(clipboardParts.flatMap((part) => nodeFields(part).map((field) => part[field])).filter((node) => typeof node === 'string'));
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
  if (!part || !nodeFields(part).includes(field)) return;
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
  wireSource = null; selectedWire = null;
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
