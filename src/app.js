import { modules, componentPalette } from './data/modules.js';
import { esc, formatAssistantText, safeUrl } from './shared/escaping.js';
import { forgetApiKey, loadAssistantSettings, redactSecrets, saveAssistantSettings as storeAssistantSettings } from './core/credentials.js';
import { engines } from './core/engine-registry.js';
import { createProject } from './core/project.js';
import { createPackagedProjectExport, importProjectFile } from './core/project-file.js';
import { getState, setState, updateProject, recordExperiment, subscribe, notify, replaceProject, synchronizeOpenProject, undoProject, redoProject, canUndoProject, canRedoProject, recordLearningAttempt, saveProject } from './core/store.js';
import { simulateDC, simulateTransient, simulateAC, sampleWaveform } from './engines/circuit-engine.js';
import { exampleCircuits } from './data/example-circuits.js';
import { circuitNodes, createCoSimulation } from './engines/cosim.js';
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
import { applyWindow, cdiv, cexp, complex, cscale, fft, filterFir, generateSine } from '../packages/numerics/src/index.mjs';
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate, berCurve, CRC_POLYNOMIALS, convolutionalEncode, crcCheck, crcDivide, DIGITAL_SCHEMES, eyeDiagram, hammingDecode, hammingEncode, LINE_CODES, lineCode, samplingDemo, simulateAnalogModulation, simulateDigitalLink, viterbiDecode } from '../packages/communications/src/index.mjs';
import { coaxImpedance, ELEMENT_PATTERNS, freeSpacePathLossDb, linearArray, linkBudget, lMatch, microstrip, microstripWidth, parseTouchstone, quarterWaveMatch, reflection, singleStubMatch, SPEED_OF_LIGHT, transmissionLine, twinLeadImpedance } from '../packages/rf/src/index.mjs';
import { firstOrderStability, firstOrderStep } from '../packages/control/src/index.mjs';
import { adcResolution, COLOR_BANDS, convertLevel, dbToRatio, decodeCapacitorCode, decodeResistorBands, decodeSmdResistor, design555Astable, E_SERIES, encodeResistorBands, ledResistor, nearestPreferred, OPAMP_CONFIGS, opampStage, POWER_UNITS, ratioToDb, rcFilter, reactance, rlcResonance, seriesParallel, solveOhm, timer555Astable, timer555Monostable, voltageDivider } from '../packages/calculators/src/index.mjs';
import { autoPlace, autoroute, billOfMaterials, buildBoard, createZip, extractNetlist, fabricationFiles, normalizeRules, ratsnest, runDrc, silkscreen, traceWidthForCurrent } from '../packages/pcb/src/index.mjs';
import { assemble, AVR_EXAMPLES, Cpu8051, disassemble, EXAMPLES_8051, parseIntelHex, toImage, toIntelHex, TrainerBoard, UnoBoard, unoPin, PIN_LABELS, decodeI2c, decodeSpi, decodeUart, estimateBaud, fromVcd, sliceChannel, toVcd } from '../packages/mcu/src/index.mjs';
import { applyGenerator, applySupplies, diodeTest, dmmDisplay, findTrigger, GENERATOR_SHAPES, measure, measureResistance, phaseDifference, screenTrace, valueAt } from '../packages/instruments/src/index.mjs';
import { buildLabRecord } from '../packages/report/src/index.mjs';
import { amplifierStability, cascade, chargeField, circularWaveguide, fieldMap, fresnel, fresnelCurve, fromPolar, gaussFlux, planeWave, polarization, rectangularModePattern, rectangularWaveguide, sToZ, sweepCascade, TWO_PORT_ELEMENTS } from '../packages/em/src/index.mjs';
import { aesDecryptBlock, aesEncryptBlock, blocksToText, bytesToHex, caesar, crackCaesar, crackVigenere, crt, desBlock, diffieHellman, discreteLog, ENGLISH_FREQUENCIES, extendedEuclid, generateRsa, hexToBytes, hill, hmacSha256, indexOfCoincidence, letterCounts, lettersOnly, millerRabin, modInverse, modPow, playfair, railFence, rsaDecrypt, rsaEncrypt, rsaKey, sha256, textToBlocks, toBig, vigenere } from '../packages/cryptolab/src/index.mjs';
import { chat as assistantChat, LANGUAGES, MODES, PROVIDERS, validateBaseUrl } from '../packages/assistant/src/index.mjs';
import { findLesson, lessonIndex, TRACKS } from '../packages/learning/src/courseware.mjs';
import { instantiate, scoreQuiz } from '../packages/learning/src/quiz.mjs';
import { createSession as createConsoleSession, describe as describeConsole, format as formatConsole, run as runConsole } from '../packages/mathconsole/src/index.mjs';
import { createNetwork, DATASETS, LOGIC_SETS, makeDataset, perceptron, train } from '../packages/neural/src/index.mjs';
import { BLOCKS, blockParams, exampleGraph, runFlowgraph, SDR_EXAMPLES } from '../packages/sdr/src/index.mjs';
import { connectivity, coverage, crossover, deploy, RADIO_DEFAULTS, simulateLifetime, txEnergy } from '../packages/wsn/src/index.mjs';
import { arqUtilisation, binaryIpv4, csmaCdEfficiency, dijkstra, formatIpv4, ipv6Info, linkChange, nonPersistentCsma, onePersistentCsma, parseGraph, pureAloha, simulateArq, slottedAloha, splitSubnet, subnetInfo, summarize, vlsm } from '../packages/netproto/src/index.mjs';
import { cellRadius, channelsForGos, clusterForSir, clusterSizes, ENVIRONMENTS, erlangB, erlangC, fadeMargin, freeSpaceLoss, hataLoss, hataMobileCorrection, hexLayout, idealHandoffPoint, logDistanceLoss, maxAllowedLoss, offeredTraffic, reusePlan, SECTORING, simulateHandoff, trafficForGos } from '../packages/cellular/src/index.mjs';
import { fibreParameters, powerBudget, receiverChain, riseTimeBudget, superhet, tuningRange } from '../packages/commsys/src/index.mjs';
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
import { awgnCapacity, channelCapacity, dsss, encodeWithCode, fhss, GOLD_PAIRS, goldCodes, huffman, lfsr, lzwDecode, lzwEncode, minimumEbN0Db, mutualInformation, ofdmLink, periodicCorrelation, PRIMITIVE_TAPS, sequenceProperties, shannonFano, textSource } from '../packages/infotheory/src/index.mjs';
import { designBandpass, designBias, designLm317, designOscillator, designPll, designSallenKey, designSchmitt, designZener, networkSweep, OSCILLATORS } from '../packages/analogdesign/src/index.mjs';
import { apertureAntenna, combineCn, dipolePattern, directionalCoupler, directivity, doppler, fmcw, friisLink, gOverT, halfPowerBeamwidth, lookAngles, magnetron, orbit, orbitTrace, pulseRadar, R_EARTH, radarRange, reflexKlystron, satelliteLink, vswrMeasurement } from '../packages/radarsat/src/index.mjs';
import { createPlc, LADDER_EXAMPLES, layoutCondition, operands, parseInputScript, parseLadder, runLadder, scan } from '../packages/plc/src/index.mjs';
import { adcToVolts, compareDivider, compareRc, explainDifference, parseTwinOutput, rcCharge, TWIN_BANNER, TWIN_BAUD } from '../packages/twin/src/index.mjs';
import { normalizeDigitalWaveformView, serializeDigitalCsv, transformDigitalWaveformView } from './core/digital-waveform-view.js';
import { capitalize, complexText, decibels, eng, finiteEng, fmt, hex2, lines, numericText, ohms } from './shared/formatting.js';
import { engineeringInput, parseNumberList } from './shared/parsing.js';
import { readout, simpleTable } from './components/tables.js';
import { indexTicks, linearTicks, linePlot, PLOT_COLORS, renderComplexPlane, renderPlotFrame, scatterPlane, stemPlot } from './components/plots.js';
import { groupField, labField, labSelect, labTabs, labText } from './components/forms.js';
import { labCard, labError, pageHeader } from './components/layout.js';
import { bindLabControls, bindLabText, makeLab } from './controllers/lab-controls.js';
import { bindLogicEvents, renderLogic } from './workspaces/digital/logic.js';
import { renderSmithChart } from './components/smith-chart.js';
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

const app = document.querySelector('#app');
const importInput = document.querySelector('#project-import');
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
const COMM_TABS = [['link', 'QPSK link'], ['analog', 'Analog modulation'], ['digital', 'Digital modulation & BER'], ['pcm', 'Sampling, PCM & line codes'], ['coding', 'Error-control coding'], ['receiver', 'Receiver & noise'], ['fibre', 'Optical fibre link']];
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

// Receiver planning and optical-fibre link design (Communication tabs).
const rxLab = makeLab('rx-lab', {
  receiver: { signal: 1e6, intermediate: 455e3, side: 'above', q: 100, bandLow: 540e3, bandHigh: 1650e3, stages: 'LNA 20 1.5 5\nBand-pass filter -2 2 100\nMixer -7 7 10\nIF amplifier 40 6 20', bandwidth: 10e3, snr: 10 },
  fibre: { n1: 1.48, n2: 1.46, core: 50, wavelength: 850, profile: 'graded', length: 2, attenuation: 3, splices: 1, spliceLoss: 0.3, connectors: 2, connectorLoss: 0.5, margin: 6, txPower: -10, rxSensitivity: -30, txRise: 1, rxRise: 2, dispersion: 100, spectralWidth: 40 },
});
const rxField = (...args) => groupField('data-rx-field')(...args);

function parseStages(text) {
  const stages = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const tokens = line.split(/\s+/);
    const numbers = [];
    while (tokens.length && Number.isFinite(Number(tokens.at(-1))) && numbers.length < 3) numbers.unshift(Number(tokens.pop()));
    if (numbers.length < 2) throw new RangeError(`Stage ${index + 1}: enter "name gain(dB) NF(dB) [IIP3 dBm]".`);
    const [gainDb, nfDb, iip3Dbm] = numbers.length === 3 ? numbers : [...numbers, Infinity];
    return { name: tokens.join(' ') || `Stage ${index + 1}`, gainDb, nfDb, iip3Dbm };
  });
  if (!stages.length) throw new RangeError('Add at least one receiver stage.');
  return stages;
}

function renderReceiverTab(state) {
  const c = rxLab.configuration(state).receiver;
  let content;
  try {
    const plan = superhet({ signal: c.signal, intermediate: c.intermediate, loAbove: c.side === 'above', q: c.q });
    const band = tuningRange({ low: c.bandLow, high: c.bandHigh, intermediate: c.intermediate, loAbove: c.side === 'above' });
    const chain = receiverChain({ stages: parseStages(c.stages), bandwidth: c.bandwidth, snrDb: c.snr });
    const freqs = [c.intermediate, plan.lo, c.signal, plan.image];
    const fMax = Math.max(...freqs) * 1.15;
    const fs = Array.from({ length: 400 }, (_, k) => fMax * (k + 1) / 400);
    const preselector = fs.map((f) => { const rho = f / c.signal - c.signal / f; return -10 * Math.log10(1 + (c.q * rho) ** 2); });
    const lines = [['IF', c.intermediate, PLOT_COLORS[3]], ['LO', plan.lo, '#f59e0b'], ['Signal', c.signal, PLOT_COLORS[0]], ['Image', plan.image, '#ef4444']];
    const range = niceRange(Math.max(-60, Math.min(...preselector)), 0);
    const spectrum = renderPlotFrame({ title: 'Frequency plan and the preselector response (dB)', series: [{ xs: fs, ys: preselector, color: '#64748b', primary: true }, ...lines.map(([, f, color]) => ({ xs: [f], ys: [range.min], color, stem: true }))], xMin: 0, xMax: fMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(fMax * k / 5, 'Hz') })), yRange: range, formatY: (value) => `${fmt(value, 3)} dB` });
    const rows = chain.noise.rows.map((row, index) => `<tr><td>${esc(row.name)}</td><td>${fmt(row.gainDb, 4)}</td><td>${fmt(row.nfDb, 4)}</td><td>${fmt(row.noiseTemperature, 4)} K</td><td>${fmt(row.contribution - (index === 0 ? 1 : 0), 4)}</td><td>${fmt(row.cumulativeNfDb, 4)}</td><td>${fmt(row.cumulativeGainDb, 4)}</td><td>${Number.isFinite(chain.linearity.rows[index].cumulativeIip3Dbm) ? fmt(chain.linearity.rows[index].cumulativeIip3Dbm, 4) : '∞'}</td></tr>`).join('');
    const share = chain.noise.rows.map((row, index) => [row.name, row.contribution - (index === 0 ? 1 : 0)]);
    const shareTotal = share.reduce((sum, [, value]) => sum + value, 0) || 1;
    content = `<div class="power-grid"><div>${spectrum}<div class="plot-legend">${lines.map(([name, f, color]) => `<span class="legend-chip" style="--chip:${color}">${name} ${eng(f, 'Hz')}</span>`).join('')}</div>
      <span class="panel-label">WHO ADDS THE NOISE (SHARE OF F − 1)</span><div class="rx-bars">${share.map(([name, value]) => `<div><span>${esc(name)}</span><i style="width:${(100 * value / shareTotal).toFixed(1)}%"></i><b>${fmt(100 * value / shareTotal, 3)} %</b></div>`).join('')}</div></div>
      <div><div class="analysis-readouts">${readout('Local oscillator', eng(plan.lo, 'Hz'))}${readout('Image frequency fs ± 2·IF', eng(plan.image, 'Hz'))}${readout('Image rejection √(1 + Q²ρ²)', `${fmt(plan.rejection, 5)} (${fmt(plan.rejectionDb, 4)} dB)`)}${readout('LO range for the band', `${eng(band.loLow, 'Hz')} – ${eng(band.loHigh, 'Hz')} (C ratio ${fmt(band.loCapacitanceRatio, 4)} vs ${fmt(band.signalCapacitanceRatio, 4)} for the RF stage)`)}${readout('Cascade noise figure (Friis)', `${fmt(chain.noise.nfDb, 4)} dB, Te = ${fmt(chain.noise.temperature, 5)} K`)}${readout('Total gain', `${fmt(chain.noise.gainDb, 4)} dB`)}${readout('Noise floor kTB·F', `${fmt(chain.sensitivity.noiseFloorDbm, 5)} dBm`)}${readout('Sensitivity (at the SNR above)', `${fmt(chain.sensitivity.sensitivityDbm, 5)} dBm = ${fmt(chain.sensitivity.sensitivityMicrovolts50, 4)} µV in 50 Ω`)}${readout('Cascade IIP3 / OIP3', Number.isFinite(chain.linearity.iip3Dbm) ? `${fmt(chain.linearity.iip3Dbm, 4)} / ${fmt(chain.linearity.oip3Dbm, 4)} dBm` : '∞')}${readout('Spurious-free dynamic range', Number.isFinite(chain.sfdrDb) ? `${fmt(chain.sfdrDb, 4)} dB` : '—')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Stage</th><th>G dB</th><th>NF dB</th><th>Te</th><th>Adds to F</th><th>NF so far</th><th>G so far</th><th>IIP3 so far</th></tr></thead><tbody>${rows}</tbody></table><p class="field-help">F = F₁ + (F₂ − 1)/G₁ + (F₃ − 1)/(G₁G₂) + …: a lossy filter or mixer before the LNA ruins the noise figure; after enough gain, later stages hardly matter. Image rejection uses the single-tuned preselector of Kennedy's textbook.</p></div></div>`;
  } catch (error) { content = `<div class="diagnostic error"><b>Receiver</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${rxField('receiver.signal', 'Signal fs', c.signal, 'Hz')}${rxField('receiver.intermediate', 'IF', c.intermediate, 'Hz')}${labSelect('data-rx-select', 'receiver.side', 'LO injection', c.side, [['above', 'High side (fLO = fs + IF)'], ['below', 'Low side (fLO = fs − IF)']])}${rxField('receiver.q', 'Preselector Q', c.q)}${rxField('receiver.bandLow', 'Band from', c.bandLow, 'Hz')}${rxField('receiver.bandHigh', 'to', c.bandHigh, 'Hz')}<label class="em-text">Stages: name, gain dB, NF dB, IIP3 dBm<textarea rows="5" spellcheck="false" data-rx-text="receiver.stages">${esc(c.stages)}</textarea></label>${rxField('receiver.bandwidth', 'Bandwidth', c.bandwidth, 'Hz')}${rxField('receiver.snr', 'Required SNR', c.snr, 'dB')}`;
  return `<div class="power-page sigsys-page"><section class="dsp-card"><div class="dsp-controls">${controls}</div>${content}</section></div>`;
}

function renderFibreTab(state) {
  const c = rxLab.configuration(state).fibre;
  let content;
  try {
    const fibre = fibreParameters({ n1: c.n1, n2: c.n2, coreDiameter: c.core * 1e-6, wavelength: c.wavelength * 1e-9 });
    const budget = powerBudget({ txPowerDbm: c.txPower, rxSensitivityDbm: c.rxSensitivity, length: c.length, attenuation: c.attenuation, splices: c.splices, spliceLoss: c.spliceLoss, connectors: c.connectors, connectorLoss: c.connectorLoss, margin: c.margin });
    const rise = riseTimeBudget({ txRise: c.txRise * 1e-9, rxRise: c.rxRise * 1e-9, length: c.length, n1: c.n1, n2: c.n2, profile: c.profile, dispersion: c.dispersion, spectralWidth: c.spectralWidth, singleMode: fibre.singleMode });
    const xs = Array.from({ length: 201 }, (_, k) => c.length * k / 200);
    const splicesAt = Array.from({ length: Math.max(0, Math.round(c.splices)) }, (_, k) => c.length * (k + 1) / (Math.round(c.splices) + 1));
    const level = xs.map((x) => c.txPower - (c.connectors > 0 ? c.connectorLoss : 0) - c.attenuation * x - c.spliceLoss * splicesAt.filter((at) => at <= x).length - (x >= c.length ? Math.max(0, c.connectors - 1) * c.connectorLoss : 0));
    content = `<div class="power-grid"><div>${linePlot('Optical power along the link (dBm against km)', xs, [{ name: 'power', values: level }, { name: 'receiver sensitivity', values: xs.map(() => c.rxSensitivity), color: '#ef4444', dashed: true }, { name: 'sensitivity + margin', values: xs.map(() => c.rxSensitivity + c.margin), color: '#f59e0b', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}
      <span class="panel-label">RISE-TIME BUDGET</span><div class="rx-bars">${rise.items.map(([name, value]) => `<div><span>${name}</span><i style="width:${(100 * value / rise.system).toFixed(1)}%"></i><b>${eng(value, 's')}</b></div>`).join('')}</div></div>
      <div><div class="analysis-readouts">${readout('Numerical aperture', `${fmt(fibre.na, 5)} (acceptance ±${fmt(fibre.acceptanceAngle, 4)}°)`)}${readout('Relative index difference Δ', `${fmt(fibre.delta * 100, 4)} %`)}${readout('V-number', `${fmt(fibre.v, 5)} → ${fibre.singleMode ? 'single-mode' : `about ${fibre.modes} modes (V²/2)`}`)}${readout('Single-mode cut-off wavelength', eng(fibre.cutoffWavelength, 'm'))}${readout('Total loss incl. margin', `${fmt(budget.totalLoss, 4)} dB of ${fmt(budget.available, 4)} dB available`)}${readout('Received power', `${fmt(budget.receivedDbm, 4)} dBm`)}${readout('Power budget', budget.feasible ? `OK, ${fmt(budget.excess, 4)} dB spare` : `short by ${fmt(-budget.excess, 4)} dB`)}${readout('Loss-limited length', `${fmt(budget.maxLength, 4)} km`)}${readout(`Modal spread (${fibre.singleMode ? 'single-mode: none' : c.profile === 'graded' ? 'graded index Ln₁Δ²/8c' : 'step index Ln₁Δ/c'})`, eng(rise.modal, 's'))}${readout('Chromatic spread D·Δλ·L', eng(rise.chromatic, 's'))}${readout('System rise time', eng(rise.system, 's'))}${readout('Maximum bit rate', `NRZ ${eng(rise.maxNrzRate, 'b/s')}, RZ ${eng(rise.maxRzRate, 'b/s')}`)}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Loss item</th><th>dB</th></tr></thead><tbody>${budget.items.map((item) => `<tr><td>${esc(item.name)}</td><td>${fmt(item.loss, 4)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } catch (error) { content = `<div class="diagnostic error"><b>Fibre link</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${rxField('fibre.n1', 'Core n₁', c.n1)}${rxField('fibre.n2', 'Cladding n₂', c.n2)}${rxField('fibre.core', 'Core diameter', c.core, 'µm')}${rxField('fibre.wavelength', 'Wavelength', c.wavelength, 'nm')}${labSelect('data-rx-select', 'fibre.profile', 'Index profile', c.profile, [['step', 'Step index'], ['graded', 'Graded (parabolic)']])}${rxField('fibre.length', 'Length', c.length, 'km')}${rxField('fibre.attenuation', 'Attenuation', c.attenuation, 'dB/km')}${rxField('fibre.splices', 'Splices', c.splices)}${rxField('fibre.spliceLoss', 'per splice', c.spliceLoss, 'dB')}${rxField('fibre.connectors', 'Connectors', c.connectors)}${rxField('fibre.connectorLoss', 'per connector', c.connectorLoss, 'dB')}${rxField('fibre.margin', 'Margin', c.margin, 'dB')}${rxField('fibre.txPower', 'Source power', c.txPower, 'dBm')}${rxField('fibre.rxSensitivity', 'Receiver sensitivity', c.rxSensitivity, 'dBm')}${rxField('fibre.txRise', 'Source rise time', c.txRise, 'ns')}${rxField('fibre.rxRise', 'Detector rise time', c.rxRise, 'ns')}${rxField('fibre.dispersion', 'Chromatic dispersion D', c.dispersion, 'ps/nm·km')}${rxField('fibre.spectralWidth', 'Source spectral width', c.spectralWidth, 'nm')}`;
  return `<div class="power-page sigsys-page"><section class="dsp-card"><div class="dsp-controls">${controls}</div>${content}</section></div>`;
}

function bindReceiverEvents() {
  bindLabControls('rx', rxLab, ['side', 'profile']);
  document.querySelectorAll('[data-rx-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.rxText.split('.'); rxLab.persist((config) => { config[group][key] = input.value; }); }));
}

function renderCommunication(state) {
  const config = commConfiguration(state);
  const body = config.tab === 'analog' ? renderAnalogTab(config) : config.tab === 'digital' ? renderDigitalTab(config, state) : config.tab === 'pcm' ? renderPcmTab(config) : config.tab === 'coding' ? renderCodingTab(config) : config.tab === 'receiver' ? renderReceiverTab(state) : config.tab === 'fibre' ? renderFibreTab(state) : renderQpskLink(state);
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
const impedanceText = (z) => `${fmt(z.re, 4)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im), 4)} Ω`;

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

const EM_TABS = [['charges', 'Charges & fields'], ['wave', 'Plane waves & skin depth'], ['interface', 'Reflection & polarisation'], ['waveguide', 'Waveguides'], ['sparams', 'S-parameter networks'], ['amplifier', 'Amplifier stability']];
const EM_MEDIA = { free: ['Free space', 1, 1, 0], copper: ['Copper', 1, 1, 5.8e7], aluminium: ['Aluminium', 1, 1, 3.5e7], seawater: ['Sea water', 81, 1, 4], soil: ['Dry soil', 3, 1, 1e-4], fr4: ['FR-4 (tan δ ≈ 0.02 at 1 GHz)', 4.4, 1, 4.9e-3], custom: ['Custom', null, null, null] };
const EM_NETWORKS = {
  lowpass: ['3rd-order Butterworth low-pass, 1 GHz', 'series-l 7.958n\nshunt-c 6.366p\nseries-l 7.958n', 0.1e9, 3e9, 1e9],
  bandpass: ['Shorted λ/4-stub band-pass, 1 GHz', 'short-stub 50 74.95m 1\nline 50 74.95m 1\nshort-stub 50 74.95m 1', 0.2e9, 1.8e9, 1e9],
  quarter: ['Quarter-wave line 70.7 Ω (100 Ω seen at port 1)', 'line 70.71 74.95m 1', 0.2e9, 2e9, 1e9],
  pad: ['6 dB attenuator + 50 Ω line', 'attenuator 6\nline 50 100m 0.66', 0.1e9, 2e9, 1e9],
};
const emLab = makeLab('em-lab', {
  tab: 'charges',
  charges: { list: '3 -3 0\n-2 3 1\n1 1 -4', probeX: 0, probeY: 2, gaussRadius: 4 },
  wave: { medium: 'copper', frequency: 1e6, epsR: 1, muR: 1, sigma: 5.8e7 },
  interface: { n1: 1, n2: 1.5, angle: 45, ex: 1, ey: 1, phase: -90 },
  waveguide: { shape: 'rect', a: 22.86, b: 10.16, radius: 10, epsR: 1, frequency: 10e9, sigma: 5.8e7, mode: 'TE10' },
  sparams: { preset: 'lowpass', z0: 50, elements: EM_NETWORKS.lowpass[1], start: 0.1e9, stop: 3e9, frequency: 1e9 },
  amplifier: { s11m: 0.61, s11a: -170, s12m: 0.05, s12a: 16, s21m: 2.24, s21a: 32, s22m: 0.51, s22a: -67 },
});
const emField = groupField('data-em-field');
const emText = (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-em-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-em-text="${path}" value="${esc(value)}"></label>`);
const angleText = (value) => `${fmt(value, 4)}°`;
const polarText = (z) => `${fmt(Math.hypot(z.re, z.im), 4)} ∠ ${fmt(Math.atan2(z.im, z.re) * 180 / Math.PI, 4)}°`;
const matrixTable = (title, m, format = polarText) => `<table class="truth-table comm-table power-table em-matrix"><thead><tr><th colspan="2">${title}</th></tr></thead><tbody>${m.map((row) => `<tr>${row.map((value) => `<td>${esc(format(value))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const circlePoints = (center, radius, count = 120) => Array.from({ length: count + 1 }, (_, k) => ({ re: center.re + radius * Math.cos(2 * Math.PI * k / count), im: center.im + radius * Math.sin(2 * Math.PI * k / count) }));

function parseCharges(text) {
  const charges = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const values = line.split(/[\s,]+/).map(Number);
    if (values.length < 3 || values.some((value) => !Number.isFinite(value))) throw new RangeError(`Charge line ${index + 1}: enter "q(nC) x(cm) y(cm)".`);
    return { q: values[0] * 1e-9, x: values[1] / 100, y: values[2] / 100 };
  });
  if (!charges.length || charges.length > 8) throw new RangeError('Enter 1 to 8 charges.');
  return charges;
}

function renderChargeMap(charges, c) {
  const xMin = -0.1, xMax = 0.1, yMin = -0.075, yMax = 0.075, columns = 64, rows = 48, width = 480, height = 360;
  const map = fieldMap(charges, { xMin, xMax, yMin, yMax, columns, rows, linesPerCharge: 14 });
  const sx = (x) => ((x - xMin) / (xMax - xMin) * width).toFixed(1), sy = (y) => ((yMax - y) / (yMax - yMin) * height).toFixed(1);
  const values = map.potential.flat().map(Math.abs).filter(Number.isFinite).sort((p, q) => p - q);
  const scale = values[Math.floor(values.length * 0.9)] || 1;
  const cells = map.potential.flatMap((row, r) => row.map((v, col) => {
    const t = Math.tanh(v / scale), alpha = Math.min(0.85, Math.abs(t));
    return `<rect x="${(col * width / columns).toFixed(1)}" y="${(r * height / rows).toFixed(1)}" width="${(width / columns + 0.5).toFixed(1)}" height="${(height / rows + 0.5).toFixed(1)}" fill="${t >= 0 ? '#ef4444' : '#3b82f6'}" fill-opacity="${alpha.toFixed(2)}"/>`;
  })).join('');
  const lines = map.lines.map((line) => `<path class="em-line" d="${line.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(y)}`).join('')}"/>`).join('');
  const marks = charges.map((q) => `<circle class="em-charge ${q.q >= 0 ? 'pos' : 'neg'}" cx="${sx(q.x)}" cy="${sy(q.y)}" r="9"/><text class="em-charge-label" x="${sx(q.x)}" y="${(Number(sy(q.y)) + 4).toFixed(1)}" text-anchor="middle">${q.q >= 0 ? '+' : '−'}</text>`).join('');
  const probe = `<circle class="em-probe" cx="${sx(c.probeX / 100)}" cy="${sy(c.probeY / 100)}" r="4"/>`;
  const gauss = `<circle class="em-gauss" cx="${sx(0)}" cy="${sy(0)}" r="${(c.gaussRadius / 100 / (xMax - xMin) * width).toFixed(1)}"/>`;
  return `<svg class="em-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Potential map and field lines">${cells}${lines}${gauss}${marks}${probe}</svg>`;
}

function renderEmTab(config) {
  const c = config[config.tab];
  if (config.tab === 'charges') {
    const charges = parseCharges(c.list);
    const probe = chargeField(charges, c.probeX / 100, c.probeY / 100);
    const gauss = gaussFlux(charges, { radius: c.gaussRadius / 100 });
    const controls = `${emText('charges.list', 'Charges: q (nC), x (cm), y (cm) per line', c.list, 4)}${emField('charges.probeX', 'Probe x', c.probeX, 'cm')}${emField('charges.probeY', 'Probe y', c.probeY, 'cm')}${emField('charges.gaussRadius', 'Gauss sphere radius', c.gaussRadius, 'cm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">POTENTIAL (RED +, BLUE −) AND FIELD LINES IN THE z = 0 PLANE, 20 cm × 15 cm</span>${renderChargeMap(charges, c)}</div>
      <div class="analysis-readouts">${readout('|E| at the probe', eng(probe.magnitude, 'V/m'))}${readout('E direction', angleText(Math.atan2(probe.ey, probe.ex) * 180 / Math.PI))}${readout('Ex, Ey', `${eng(probe.ex, 'V/m')}, ${eng(probe.ey, 'V/m')}`)}${readout('Potential V at the probe', eng(probe.v, 'V'))}${readout('Charge inside the Gauss sphere', eng(gauss.enclosed, 'C'))}${readout('Flux ∮E·dA (4000-point quadrature)', `${fmt(gauss.flux, 6)} V·m`)}${readout('Q_enc / ε₀', `${fmt(gauss.expected, 6)} V·m`)}<p class="field-help">E and V are the superposition of kq/r² and kq/r from every charge (k = 1/4πε₀). The dashed circle is the Gauss sphere centred at the origin: the numerically integrated flux equals the enclosed charge divided by ε₀, whatever the charges outside do.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'wave') {
    const wave = planeWave({ frequency: c.frequency, epsR: c.epsR, muR: c.muR, sigma: c.sigma });
    const depth = Number.isFinite(wave.skinDepth) ? Math.min(4 * wave.skinDepth, 3 * wave.wavelength) : 3 * wave.wavelength;
    const zs = Array.from({ length: 600 }, (_, k) => depth * k / 599);
    const envelope = zs.map((z) => Math.exp(-wave.alpha * z));
    const frequencies = Array.from({ length: 121 }, (_, k) => 10 ** (1 + k * 0.075));
    const logDepth = frequencies.map((f) => Math.log10(planeWave({ frequency: f, epsR: c.epsR, muR: c.muR, sigma: c.sigma }).skinDepth));
    const controls = `${labSelect('data-em-select', 'wave.medium', 'Medium', c.medium, Object.entries(EM_MEDIA).map(([id, entry]) => [id, entry[0]]))}${emField('wave.frequency', 'Frequency', c.frequency, 'Hz')}${emField('wave.epsR', 'εr', c.epsR)}${emField('wave.muR', 'μr', c.muR)}${emField('wave.sigma', 'σ', c.sigma, 'S/m')}`;
    const body = `<div class="power-grid"><div>${linePlot('E(z) at t = 0 and its envelope e^(−αz) (z in metres)', zs, [{ name: 'E(z, 0)', values: zs.map((z, k) => envelope[k] * Math.cos(wave.beta * z)) }, { name: 'envelope', values: envelope, color: '#64748b', dashed: true }], { xLabel: (x) => eng(x, 'm') })}${c.sigma > 0 ? renderPlotFrame({ title: 'Skin depth δ against frequency (log–log)', series: [{ xs: frequencies, ys: logDepth, color: PLOT_COLORS[2], primary: true }], xMin: 10, xMax: frequencies.at(-1), logX: true, xTicks: [1, 3, 5, 7, 9].map((p) => ({ position: (p - 1) / 9, text: eng(10 ** p, 'Hz') })), yRange: niceRange(Math.min(...logDepth), Math.max(...logDepth)), formatY: (value) => eng(10 ** value, 'm') }) : ''}</div>
      <div class="analysis-readouts">${readout('Regime (σ/ωε)', `${wave.regime}, loss tangent ${fmt(wave.lossTangent, 4)}`)}${readout('Attenuation α', `${fmt(wave.alpha, 5)} Np/m = ${fmt(wave.alphaDbPerMetre, 5)} dB/m`)}${readout('Phase constant β', `${fmt(wave.beta, 5)} rad/m`)}${readout('Intrinsic impedance η', `${fmt(wave.etaMagnitude, 5)} ∠ ${fmt(wave.etaAngle, 4)}° Ω`)}${readout('Wavelength in the medium', eng(wave.wavelength, 'm'))}${readout('Phase velocity', eng(wave.phaseVelocity, 'm/s'))}${readout('Skin depth δ = 1/α', Number.isFinite(wave.skinDepth) ? eng(wave.skinDepth, 'm') : '∞ (lossless)')}${wave.surfaceResistance ? readout('Surface resistance Rs', eng(wave.surfaceResistance, 'Ω')) : ''}<p class="field-help">γ = √(jωμ(σ + jωε)) = α + jβ and η = √(jωμ/(σ + jωε)) with no approximation, so the same numbers hold for a perfect dielectric, a good conductor (η at 45°, δ = 1/√(πfμσ)) and anything in between.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'interface') {
    const r = fresnel({ n1: c.n1, n2: c.n2, angle: c.angle });
    const curve = fresnelCurve(c.n1, c.n2, 181);
    const pol = polarization({ ex: c.ex, ey: c.ey, phase: c.phase });
    const peak = Math.max(Math.abs(c.ex), Math.abs(c.ey), 1e-9);
    const controls = `${emField('interface.n1', 'n₁ (incident side)', c.n1)}${emField('interface.n2', 'n₂', c.n2)}${emField('interface.angle', 'Angle of incidence', c.angle, '°')}${emField('interface.ex', 'Polarisation Ex', c.ex)}${emField('interface.ey', 'Ey', c.ey)}${emField('interface.phase', 'Phase of Ey relative to Ex', c.phase, '°')}`;
    const body = `<div class="power-grid"><div>${linePlot('Reflectance against angle of incidence (degrees)', curve.angles, [{ name: 'Rs (TE, ⊥)', values: curve.Rs }, { name: 'Rp (TM, ∥)', values: curve.Rp }], { xLabel: (x) => `${fmt(x, 3)}°`, yMin: 0, yMax: 1 })}
      <span class="panel-label">POLARISATION ELLIPSE (WAVE COMING TOWARD YOU, +z)</span>${renderComplexPlane({ label: 'Polarisation ellipse', extent: peak * 1.2, curves: [{ points: pol.trace.map(([x, y]) => ({ re: x, im: y })), color: PLOT_COLORS[0] }], marks: [{ re: pol.trace[0][0], im: pol.trace[0][1] }, { re: pol.trace[8][0], im: pol.trace[8][1] }] })}</div>
      <div class="analysis-readouts">${readout('Transmitted angle (Snell)', r.tir ? 'none — total internal reflection' : angleText(r.transmittedAngle))}${readout('rs, rp', `${polarText(r.rs)}, ${polarText(r.rp)}`)}${readout('Rs, Rp (power)', `${fmt(r.Rs, 5)}, ${fmt(r.Rp, 5)}`)}${readout('Ts, Tp (power)', `${fmt(r.Ts, 5)}, ${fmt(r.Tp, 5)}`)}${readout('Brewster angle (Rp = 0)', angleText(r.brewster))}${readout('Critical angle', r.critical === null ? 'none (n₁ ≤ n₂)' : angleText(r.critical))}${readout('Polarisation', `${pol.kind}${pol.sense ? `, ${pol.sense} (IEEE)` : ''}`)}${readout('Axial ratio', Number.isFinite(pol.axialRatio) ? `${fmt(pol.axialRatio, 4)} (${fmt(pol.axialRatioDb, 4)} dB)` : '∞ (linear)')}${readout('Tilt of the major axis', angleText(pol.tilt))}<p class="field-help">Rs + Ts = 1 and Rp + Tp = 1 at every angle. The squares on the ellipse mark the field at ωt = 0 and a moment later, so you can see the rotation sense.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'waveguide') {
    const rect = c.shape === 'rect';
    const guide = rect ? rectangularWaveguide({ a: c.a / 1000, b: c.b / 1000, epsR: c.epsR, frequency: c.frequency, sigma: c.sigma || null }) : circularWaveguide({ radius: c.radius / 1000, epsR: c.epsR, frequency: c.frequency });
    const modes = guide.modes.slice(0, 10);
    const selected = modes.find((mode) => mode.name === c.mode) ?? guide.dominant;
    const fMax = Math.max(c.frequency * 1.5, modes[4].cutoff * 1.2);
    const fs = Array.from({ length: 300 }, (_, k) => fMax * k / 299);
    const v = 299792458 / Math.sqrt(c.epsR);
    const dispersion = modes.slice(0, 5).map((mode) => ({ name: mode.name, values: fs.map((f) => (f > mode.cutoff ? 2 * Math.PI * f / v * Math.sqrt(1 - (mode.cutoff / f) ** 2) : 0)) }));
    let pattern = '';
    if (rect) {
      const cols = 24, rowsCount = Math.max(4, Math.round(24 * c.b / c.a)), w = 480, h = Math.round(480 * c.b / c.a);
      const cells = rectangularModePattern(selected, c.a, c.b, cols, rowsCount);
      const cw = w / cols, ch = h / rowsCount;
      pattern = `<span class="panel-label">TRANSVERSE E FIELD OF ${selected.name} (COLOUR |E|, ARROWS DIRECTION)</span><svg class="em-map" viewBox="-4 -4 ${w + 8} ${h + 8}">${cells.map((cell, i) => { const x = (i % cols) * cw, y = h - (Math.floor(i / cols) + 1) * ch; const len = 0.45 * Math.min(cw, ch) * cell.magnitude, angle = Math.atan2(-cell.ey, cell.ex); const cx = x + cw / 2, cy = y + ch / 2; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cw + 0.5).toFixed(1)}" height="${(ch + 0.5).toFixed(1)}" fill="#f97316" fill-opacity="${(0.85 * cell.magnitude).toFixed(2)}"/>${len > 1 ? `<path class="em-arrow" d="M${(cx - len * Math.cos(angle)).toFixed(1)} ${(cy - len * Math.sin(angle)).toFixed(1)}L${(cx + len * Math.cos(angle)).toFixed(1)} ${(cy + len * Math.sin(angle)).toFixed(1)}"/>` : ''}`; }).join('')}<rect class="em-wall" x="0" y="0" width="${w}" height="${h}"/></svg>`;
    }
    const rows = modes.map((mode) => `<tr class="${mode.name === selected.name ? 'active' : ''}"><td>${mode.name}</td><td>${eng(mode.cutoff, 'Hz')}</td><td>${mode.propagating ? 'yes' : 'no'}</td><td>${mode.propagating ? eng(mode.guideWavelength, 'm') : '—'}</td><td>${mode.propagating ? eng(mode.impedance, 'Ω') : '—'}</td><td>${mode.propagating ? '0' : fmt(mode.attenuationDbPerMetre, 4)}</td></tr>`).join('');
    const controls = `${labSelect('data-em-select', 'waveguide.shape', 'Cross-section', c.shape, [['rect', 'Rectangular'], ['circ', 'Circular']])}${rect ? `${emField('waveguide.a', 'Width a', c.a, 'mm')}${emField('waveguide.b', 'Height b', c.b, 'mm')}` : emField('waveguide.radius', 'Radius', c.radius, 'mm')}${emField('waveguide.epsR', 'Filling εr', c.epsR)}${emField('waveguide.frequency', 'Frequency', c.frequency, 'Hz')}${rect ? emField('waveguide.sigma', 'Wall σ (0 = perfect)', c.sigma, 'S/m') : ''}${labSelect('data-em-select', 'waveguide.mode', 'Show mode', selected.name, modes.map((mode) => [mode.name, mode.name]))}`;
    const body = `<div class="power-grid"><div>${linePlot('Phase constant β (rad/m) against frequency — the dispersion diagram', fs, dispersion, { xLabel: (x) => eng(x, 'Hz') })}${pattern}</div>
      <div><div class="analysis-readouts">${readout('Dominant mode', `${guide.dominant.name}, cut-off ${eng(guide.dominant.cutoff, 'Hz')}`)}${readout('Single-mode band', `${eng(guide.singleModeBand[0], 'Hz')} – ${eng(guide.singleModeBand[1], 'Hz')}`)}${readout(`${selected.name} at ${eng(c.frequency, 'Hz')}`, selected.propagating ? `λg = ${eng(selected.guideWavelength, 'm')}, vp = ${eng(selected.phaseVelocity, 'm/s')}, vg = ${eng(selected.groupVelocity, 'm/s')}` : `evanescent, α = ${fmt(selected.attenuationDbPerMetre, 4)} dB/m`)}${selected.propagating ? readout(`Wave impedance Z_${selected.kind}`, eng(selected.impedance, 'Ω')) : ''}${guide.conductorLoss ? readout('TE10 wall loss (Pozar 3.96)', `${fmt(guide.conductorLoss.dbPerMetre, 4)} dB/m (Rs = ${eng(guide.conductorLoss.surfaceResistance, 'Ω')})`) : ''}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Mode</th><th>Cut-off</th><th>Propagates</th><th>λg</th><th>Z</th><th>α dB/m</th></tr></thead><tbody>${rows}</tbody></table><p class="field-help">${rect ? 'fc = (c/2√εr)·√((m/a)² + (n/b)²); TE needs m or n > 0, TM needs both.' : 'fc = c·x/(2πa√εr) with x a zero of Jn (TM) or Jn′ (TE); TE11 is dominant.'} The conductor loss agrees with scikit-rf.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'sparams') {
    const elements = parseTwoPortElements(c.elements);
    const sweep = sweepCascade(elements, { start: c.start, stop: c.stop, points: 241, z0: c.z0 });
    const at = cascade(elements, c.frequency, c.z0);
    let z = null;
    try { z = sToZ(at.s, c.z0); if (z.flat().some((value) => !Number.isFinite(value.re))) z = null; } catch { z = null; }
    const controls = `${labSelect('data-em-select', 'sparams.preset', 'Example', c.preset, [...Object.entries(EM_NETWORKS).map(([id, entry]) => [id, entry[0]]), ['custom', 'Custom']])}${emText('sparams.elements', 'Elements, port 1 → port 2', c.elements, 6)}${emField('sparams.z0', 'Reference Z0', c.z0, 'Ω')}${emField('sparams.start', 'Sweep from', c.start, 'Hz')}${emField('sparams.stop', 'to', c.stop, 'Hz')}${emField('sparams.frequency', 'Spot frequency', c.frequency, 'Hz')}`;
    const floor = Math.max(-80, Math.min(...sweep.s11Db, ...sweep.s21Db));
    const body = `<div class="power-grid"><div>${linePlot('|S11| and |S21| in dB', sweep.frequencies, [{ name: '|S11|', values: sweep.s11Db.map((value) => Math.max(value, floor)) }, { name: '|S21|', values: sweep.s21Db.map((value) => Math.max(value, floor)) }], { xLabel: (x) => eng(x, 'Hz'), yMax: 0.5 })}<span class="panel-label">S11 ON THE SMITH CHART (DOT = SPOT FREQUENCY)</span>${renderSmithChart({ label: 'S11', traces: [{ points: sweep.s.map((s) => s[0][0]), color: PLOT_COLORS[0] }], points: [{ gamma: at.s[0][0], color: '#f59e0b', text: eng(c.frequency, 'Hz') }] })}</div>
      <div><div class="analysis-readouts">${readout('Return loss', `${fmt(at.returnLoss, 4)} dB (VSWR ${Number.isFinite(at.vswr) ? fmt(at.vswr, 4) : '∞'})`)}${readout('Insertion loss', `${fmt(at.insertionLoss, 4)} dB`)}${readout('Reciprocal (S12 = S21)', at.reciprocal ? 'yes' : 'no')}${readout('Lossless (S unitary)', at.lossless ? 'yes' : 'no')}</div>${matrixTable('S (mag ∠ deg)', at.s)}${matrixTable('ABCD', at.abcd, complexText)}${z ? matrixTable('Z (Ω)', z, complexText) : '<p class="field-help">Z does not exist for this network (e.g. a bare series element).</p>'}
      <p class="field-help">One element per line: <code>series-r|series-l|series-c value</code>, <code>shunt-r|shunt-l|shunt-c value</code>, <code>line Zc length vf [dB/m]</code>, <code>open-stub|short-stub Zc length vf</code>, <code>attenuator dB</code>. Values take k, m, µ/u, n, p. The chain is multiplied as ABCD matrices and converted to S; cascades, conversions and stub/line models agree with scikit-rf.</p></div></div>`;
    return { controls, body };
  }
  const s = [[fromPolar(c.s11m, c.s11a), fromPolar(c.s12m, c.s12a)], [fromPolar(c.s21m, c.s21a), fromPolar(c.s22m, c.s22a)]];
  const st = amplifierStability(s);
  const controls = ['11', '12', '21', '22'].map((ij) => `${emField(`amplifier.s${ij}m`, `|S${ij}|`, c[`s${ij}m`])}${emField(`amplifier.s${ij}a`, `∠S${ij}`, c[`s${ij}a`], '°')}`).join('');
  const smithPoints = st.match ? [{ gamma: st.match.gammaS, color: '#22c55e', text: 'ΓS' }, { gamma: st.match.gammaL, color: '#f59e0b', text: 'ΓL' }] : [];
  const body = `<div class="power-grid"><div><span class="panel-label">STABILITY CIRCLES: INPUT (BLUE, ΓS PLANE) AND OUTPUT (ORANGE, ΓL PLANE)</span>${renderSmithChart({ label: 'Stability circles', traces: [{ points: circlePoints(st.input.center, st.input.radius), color: PLOT_COLORS[0] }, { points: circlePoints(st.output.center, st.output.radius), color: '#f97316' }], points: smithPoints })}</div>
    <div class="analysis-readouts">${readout('Rollett K', fmt(st.k, 5))}${readout('|Δ| = |S11S22 − S12S21|', fmt(st.deltaMagnitude, 5))}${readout('μ (Edwards–Sinsky)', fmt(st.mu, 5))}${readout('Stability', st.unconditional ? 'unconditionally stable (K > 1, |Δ| < 1)' : 'potentially unstable — keep ΓS, ΓL in the stable regions')}${readout('Maximum available gain', st.maxGainDb === null ? '— (needs K > 1)' : `${fmt(st.maxGainDb, 4)} dB`)}${readout('Maximum stable gain |S21/S12|', `${fmt(st.maxStableGainDb, 4)} dB`)}${readout('Unilateral transducer gain (max)', `${fmt(st.unilateralGainDb, 4)} dB`)}${readout('Input circle', `centre ${polarText(st.input.center)}, r = ${fmt(st.input.radius, 4)}, stable ${st.input.stableInside ? 'inside' : 'outside'}`)}${readout('Output circle', `centre ${polarText(st.output.center)}, r = ${fmt(st.output.radius, 4)}, stable ${st.output.stableInside ? 'inside' : 'outside'}`)}${st.match ? readout('Simultaneous conjugate match', `ΓS = ${polarText(st.match.gammaS)}, ΓL = ${polarText(st.match.gammaL)}`) : ''}<p class="field-help">K, MAG and MSG agree with scikit-rf. With the conjugate-match ΓL, Γin equals ΓS* — the definition of the match.</p></div></div>`;
  return { controls, body };
}

function parseTwoPortElements(text) {
  const elements = String(text).split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line, index) => {
    const [type, ...rest] = line.split(/\s+/);
    if (!TWO_PORT_ELEMENTS[type]) throw new RangeError(`Line ${index + 1}: unknown element "${type}".`);
    const numbers = rest.map((token) => engineeringInput(token, `Line ${index + 1}`));
    if (type === 'line' || type.endsWith('stub')) {
      if (numbers.length < 2) throw new RangeError(`Line ${index + 1}: ${type} needs Zc and length.`);
      return { type, z0: numbers[0], length: numbers[1], vf: numbers[2] ?? 1, lossDbPerMetre: numbers[3] ?? 0 };
    }
    if (numbers.length !== 1) throw new RangeError(`Line ${index + 1}: ${type} needs one value.`);
    return { type, value: numbers[0] };
  }).filter((element) => !(element.type === 'shunt-c' && element.value === 0));
  if (!elements.length) throw new RangeError('Add at least one element.');
  return elements;
}

function renderEm(state) {
  const config = emLab.configuration(state);
  let view;
  try { view = renderEmTab(config); } catch (error) { view = { controls: '', body: labError('em', 'EM & microwave', error) }; }
  return `<div class="page scroll-page power-page sigsys-page em-page">${pageHeader(modules.find((item) => item.id === 'em'), 'ELECTROMAGNETICS & MICROWAVE', '')}${labTabs(EM_TABS, config.tab, 'data-em-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindEmEvents() {
  bindLabControls('em', emLab, ['medium', 'shape', 'mode', 'preset']);
  document.querySelectorAll('[data-em-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.emText.split('.'); emLab.persist((config) => { config[group][key] = input.value; if (group === 'sparams') config.sparams.preset = 'custom'; }); }));
  document.querySelectorAll('[data-em-select="wave.medium"]').forEach((select) => select.addEventListener('change', () => {
    const medium = EM_MEDIA[select.value];
    if (medium?.[1] !== null) emLab.persist((config) => { [config.wave.epsR, config.wave.muR, config.wave.sigma] = medium.slice(1); });
  }));
  document.querySelectorAll('[data-em-select="sparams.preset"]').forEach((select) => select.addEventListener('change', () => {
    const preset = EM_NETWORKS[select.value];
    if (preset) emLab.persist((config) => { config.sparams.elements = preset[1]; config.sparams.start = preset[2]; config.sparams.stop = preset[3]; config.sparams.frequency = preset[4]; });
  }));
  document.querySelectorAll('[data-em-field^="wave."]').forEach((input) => input.addEventListener('change', () => { if (input.dataset.emField !== 'wave.frequency') emLab.persist((config) => { config.wave.medium = 'custom'; }); }));
}

// ---------------------------------------------------------------------------
// Shared helpers for the Phase 9 labs.

// ---------------------------------------------------------------------------
// Information theory, source coding and spread spectrum.

const INFO_TABS = [['source', 'Source coding'], ['lzw', 'LZW'], ['channel', 'Channel capacity'], ['pn', 'PN & Gold codes'], ['dsss', 'DSSS & FHSS'], ['ofdm', 'OFDM']];
const INFO_CHANNELS = { bsc: ['Binary symmetric (p = 0.1)', '0.9 0.1\n0.1 0.9', '0.5 0.5'], bec: ['Binary erasure (ε = 0.2)', '0.8 0.2 0\n0 0.2 0.8', '0.5 0.5'], z: ['Z-channel (p = 0.3)', '1 0\n0.3 0.7', '0.5 0.5'], typewriter: ['Noisy typewriter (4 symbols)', '0.5 0.5 0 0\n0 0.5 0.5 0\n0 0 0.5 0.5\n0.5 0 0 0.5', '0.25 0.25 0.25 0.25'] };
const infoLab = makeLab('info-lab', {
  tab: 'source',
  source: { mode: 'probabilities', probabilities: 'A 0.4\nB 0.2\nC 0.2\nD 0.1\nE 0.1', text: 'ELECTRONICS AND TELECOMMUNICATION', method: 'huffman' },
  lzw: { text: 'TOBEORNOTTOBEORTOBEORNOT' },
  channel: { preset: 'bsc', matrix: INFO_CHANNELS.bsc[1], inputs: INFO_CHANNELS.bsc[2], bandwidth: 3100, snr: 30 },
  pn: { degree: 5, goldA: 2, goldB: 7 },
  dsss: { degree: 5, ebN0: 6, jsr: 10, jammerFrequency: 0.01, spread: 'yes', channelBits: 3, hops: 40 },
  ofdm: { subcarriers: 64, cp: 16, scheme: 'qpsk', channel: '1 0 0 0.6 0 0 0.45 0 0.3', snr: 25 },
});
const infoField = groupField('data-info-field');
const infoText = labText('info');

function parseSourceTable(text) {
  const symbols = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(/[\s,]+/);
    if (parts.length !== 2) throw new RangeError(`Line ${index + 1}: enter "symbol probability".`);
    return { symbol: parts[0], p: engineeringInput(parts[1], `Line ${index + 1}`) };
  });
  if (symbols.length > 40) throw new RangeError('Use at most 40 symbols.');
  return symbols;
}
const parseMatrix = (text) => String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => parseNumberList(line, `Row ${index + 1}`));
const showSymbol = (symbol) => (symbol === ' ' ? '␣' : symbol);

function renderInfoTab(config) {
  const c = config[config.tab];
  if (config.tab === 'source') {
    const symbols = c.mode === 'text' ? textSource(c.text).slice(0, 40) : parseSourceTable(c.probabilities);
    const huff = huffman(symbols), fano = shannonFano(symbols);
    const chosen = c.method === 'fano' ? fano : huff;
    const controls = `${labSelect('data-info-select', 'source.mode', 'Source', c.mode, [['probabilities', 'Symbol probabilities'], ['text', 'From a text message']])}${c.mode === 'text' ? infoText('source.text', 'Message', c.text, 3) : infoText('source.probabilities', 'Symbol and probability per line', c.probabilities, 6)}${labSelect('data-info-select', 'source.method', 'Code', c.method, [['huffman', 'Huffman (minimum variance)'], ['fano', 'Shannon–Fano']])}`;
    const rows = chosen.codes.map((entry) => [showSymbol(entry.symbol), fmt(entry.p, 4), entry.code, String(entry.code.length), fmt(-Math.log2(entry.p), 4)]);
    let encoded = '';
    if (c.mode === 'text') { const bits = encodeWithCode(c.text, chosen.codes); encoded = readout('Encoded message', `${bits.length} bits (${fmt(bits.length / [...c.text].length, 4)} bits/symbol) vs ${[...c.text].length * 8} bits in 8-bit ASCII`) + `<p class="field-help mono-wrap">${esc(bits.length > 400 ? `${bits.slice(0, 400)}…` : bits)}</p>`; }
    const steps = c.method === 'huffman' ? `<span class="panel-label">HUFFMAN REDUCTION (EACH COLUMN SORTED; THE TWO LOWEST ARE MERGED)</span>${simpleTable(huff.steps.map((_, k) => `Stage ${k + 1}`), Array.from({ length: symbols.length }, (_, row) => huff.steps.map((stage) => (stage[row] ? `${fmt(stage[row].p, 3)} ${stage[row].members.length > 1 ? '◆' : showSymbol(stage[row].members[0])}` : ''))))}` : `<span class="panel-label">SHANNON–FANO SPLITS</span>${simpleTable(['Level', 'Upper group (0)', 'Lower group (1)'], fano.splits.map((s) => [String(s.depth + 1), s.top.map(showSymbol).join(' '), s.bottom.map(showSymbol).join(' ')]))}`;
    const body = `<div class="power-grid"><div>${simpleTable(['Symbol', 'p', 'Code word', 'Length', 'Information −log₂p'], rows)}${steps}</div>
      <div class="analysis-readouts">${readout('Entropy H', `${fmt(chosen.entropy, 6)} bits/symbol`)}${readout('Average length L', `${fmt(chosen.averageLength, 6)} bits/symbol`)}${readout('Efficiency H/L', `${fmt(100 * chosen.efficiency, 5)} %`)}${readout('Redundancy 1 − H/L', `${fmt(100 * chosen.redundancy, 5)} %`)}${readout('Kraft sum Σ2^−l', fmt(chosen.kraft, 6))}${readout('Length variance', fmt(chosen.variance, 5))}${readout('Huffman vs Shannon–Fano', `L = ${fmt(huff.averageLength, 5)} vs ${fmt(fano.averageLength, 5)}`)}${encoded}<p class="field-help">Shannon's source-coding theorem: H ≤ L < H + 1 for the best prefix code. Huffman reaches the minimum L; with ties, the merged node is placed as high as possible, which gives the smallest variance of code lengths. ◆ marks a combined node.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'lzw') {
    const encoded = lzwEncode(c.text);
    const decoded = lzwDecode(encoded.codes, encoded.alphabet);
    const controls = infoText('lzw.text', 'Text to compress', c.text, 3);
    const steps = encoded.output.slice(0, 80).map((item, k) => [String(k + 1), showSymbol(item.phrase).replace(/ /g, '␣'), String(item.code), encoded.added[k] ? `${encoded.added[k].code} = ${encoded.added[k].phrase.replace(/ /g, '␣')}` : '—']);
    const body = `<div class="power-grid"><div>${simpleTable(['Step', 'Longest match w', 'Output code', 'New dictionary entry'], steps)}</div>
      <div class="analysis-readouts">${readout('Initial dictionary', encoded.alphabet.map((ch, i) => `${i}=${showSymbol(ch)}`).join(' '))}${readout('Codes sent', encoded.codes.join(' '))}${readout('Final dictionary size', String(encoded.dictionarySize))}${readout('Bits per code (fixed width)', String(encoded.bitsPerCode))}${readout('Compressed size', `${encoded.compressedBits} bits vs ${encoded.originalBits} bits uncompressed (${fmt(encoded.originalBits / encoded.compressedBits, 4)} : 1)`)}${readout('Decoder output matches', decoded === c.text ? 'yes — lossless' : 'NO')}<p class="field-help">LZW needs no probabilities: it builds the dictionary while it reads, and the decoder rebuilds the same dictionary from the codes alone. Long repeated text compresses well; short text can even grow.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'channel') {
    const matrix = parseMatrix(c.matrix);
    const inputs = parseNumberList(c.inputs, 'Input probabilities');
    const mi = mutualInformation(matrix, inputs);
    const cap = channelCapacity(matrix);
    const awgn = awgnCapacity(c.bandwidth, c.snr);
    const snrs = Array.from({ length: 81 }, (_, k) => -10 + k * 0.5);
    const etas = Array.from({ length: 80 }, (_, k) => 0.1 + k * 0.1);
    const controls = `${labSelect('data-info-select', 'channel.preset', 'Channel', c.preset, [...Object.entries(INFO_CHANNELS).map(([id, entry]) => [id, entry[0]]), ['custom', 'Custom']])}${infoText('channel.matrix', 'P(y|x): one row per input', c.matrix, 4)}${infoText('channel.inputs', 'Input probabilities P(x)', c.inputs)}${infoField('channel.bandwidth', 'AWGN bandwidth B', c.bandwidth, 'Hz')}${infoField('channel.snr', 'S/N', c.snr, 'dB')}`;
    const body = `<div class="power-grid"><div>${linePlot('Shannon–Hartley: C/B = log₂(1 + S/N) against S/N in dB', snrs, [{ name: 'C/B', values: snrs.map((s) => Math.log2(1 + 10 ** (s / 10))) }], { xLabel: (x) => `${fmt(x, 3)} dB` })}${linePlot('Minimum Eb/N0 (dB) against spectral efficiency η (bit/s/Hz)', etas, [{ name: 'Eb/N0 min', values: etas.map(minimumEbN0Db) }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div class="analysis-readouts">${readout('I(X;Y) for this input', `${fmt(mi.information, 6)} bits`)}${readout('H(X), H(Y)', `${fmt(mi.hx, 5)}, ${fmt(mi.hy, 5)} bits`)}${readout('H(X|Y) equivocation', `${fmt(mi.hxGivenY, 5)} bits`)}${readout('H(Y|X) noise entropy', `${fmt(mi.hyGivenX, 5)} bits`)}${readout('Output P(y)', mi.py.map((v) => fmt(v, 4)).join(', '))}${readout('Capacity C (Blahut–Arimoto)', `${fmt(cap.capacity, 8)} bits/use`)}${readout('Capacity-achieving P(x)', cap.inputDistribution.map((v) => fmt(v, 4)).join(', '))}${readout('AWGN capacity', `${eng(awgn.capacity, 'bit/s')} (${fmt(awgn.spectralEfficiency, 5)} bit/s/Hz)`)}${readout('Shannon limit (η → 0)', `${fmt(awgn.shannonLimitDb, 5)} dB`)}<p class="field-help">C = max over P(x) of I(X;Y). Blahut–Arimoto iterates until the upper and lower bounds agree to 10⁻¹²; it reproduces 1 − Hb(p) for the BSC and 1 − ε for the BEC.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'pn') {
    const degree = Math.round(c.degree);
    const taps = PRIMITIVE_TAPS[degree];
    if (!taps) throw new RangeError('Degree must be 2 to 10.');
    const run = lfsr(taps);
    const props = sequenceProperties(run.sequence);
    let gold = '';
    if (GOLD_PAIRS[degree]) {
      const family = goldCodes(degree);
      const a = Math.max(0, Math.min(family.family.length - 1, Math.round(c.goldA))), b = Math.max(0, Math.min(family.family.length - 1, Math.round(c.goldB)));
      const cross = periodicCorrelation(family.family[a], family.family[b]);
      gold = `${stemPlot(`Cross-correlation of Gold codes ${a} and ${b}`, cross, { color: PLOT_COLORS[1] })}${readout('Gold family', `${family.family.length} codes of length ${family.length}, preferred pair x^${family.pair[0].join('+x^')}+1 and x^${family.pair[1].join('+x^')}+1`)}${readout('Cross-correlation values', `${[...new Set(cross)].sort((p, q) => p - q).join(', ')} (allowed ${family.bound.join(', ')})`)}`;
    }
    const controls = `${labSelect('data-info-select', 'pn.degree', 'Register length n', degree, Object.keys(PRIMITIVE_TAPS).map((d) => [d, `${d} (length ${2 ** Number(d) - 1})`]))}${GOLD_PAIRS[degree] ? `${infoField('pn.goldA', 'Gold code A (index)', c.goldA)}${infoField('pn.goldB', 'Gold code B (index)', c.goldB)}` : ''}`;
    const runs = Object.entries(props.runs).map(([length, count]) => `${length}:${count}`).join('  ');
    const body = `<div class="power-grid"><div>${stemPlot('Periodic autocorrelation R(τ) of the m-sequence', props.correlation)}${gold}</div>
      <div class="analysis-readouts">${readout('Feedback polynomial', `x^${taps.join(' + x^')} + 1`)}${readout('First register states', run.states.slice(0, 8).join(' → '))}${readout('Sequence (one period)', run.sequence.slice(0, 127).join('') + (run.sequence.length > 127 ? '…' : ''))}${readout('Balance', `${props.ones} ones, ${props.zeros} zeros`)}${readout('Runs (length:count)', runs)}${readout('Off-peak autocorrelation', props.offPeak.join(', '))}<p class="field-help">The three PN properties: one more 1 than 0; half the runs have length 1, a quarter length 2, …; and the autocorrelation is N at τ = 0 and −1 everywhere else. Gold codes trade that perfect autocorrelation for a bounded cross-correlation, so many users can share a band (CDMA, GPS).</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'dsss') {
    const run = dsss({ degree: Math.round(c.degree), bits: 4000, ebN0Db: c.ebN0, jsrDb: c.jsr, jammerFrequency: c.jammerFrequency, spread: c.spread === 'yes' });
    const other = dsss({ degree: Math.round(c.degree), bits: 4000, ebN0Db: c.ebN0, jsrDb: c.jsr, jammerFrequency: c.jammerFrequency, spread: c.spread !== 'yes' });
    const hop = fhss({ degree: 5, channelBits: Math.max(1, Math.min(5, Math.round(c.channelBits))), hops: Math.max(4, Math.min(200, Math.round(c.hops))) });
    const xs = run.chips.map((_, k) => k).slice(0, 4 * run.chipsPerBit);
    const controls = `${labSelect('data-info-select', 'dsss.degree', 'PN length', Math.round(c.degree), [3, 4, 5, 6, 7, 8].map((d) => [d, `${2 ** d - 1} chips/bit`]))}${infoField('dsss.ebN0', 'Eb/N0', c.ebN0, 'dB')}${infoField('dsss.jsr', 'Jammer-to-signal J/S', c.jsr, 'dB')}${infoField('dsss.jammerFrequency', 'Jammer frequency (cycles/chip)', c.jammerFrequency)}${labSelect('data-info-select', 'dsss.spread', 'Spreading', c.spread, [['yes', 'On (DSSS)'], ['no', 'Off (plain BPSK)']])}${infoField('dsss.channelBits', 'FHSS channel bits', c.channelBits)}${infoField('dsss.hops', 'Hops shown', c.hops)}`;
    const body = `<div class="power-grid"><div>${linePlot('Transmitted chips and received samples (first 4 bits)', xs, [{ name: 'transmitted', values: run.chips.slice(0, xs.length) }, { name: 'received (noise + jammer)', values: run.received.slice(0, xs.length), color: '#64748b' }])}${stemPlot('Correlator output per bit (sign = decision)', run.despread.slice(0, 60), { color: PLOT_COLORS[2] })}${linePlot('FHSS hop pattern: channel against hop number', hop.pattern.map((p) => p.hop), [{ name: 'channel', values: hop.pattern.map((p) => p.channel), color: PLOT_COLORS[3] }])}</div>
      <div class="analysis-readouts">${readout('Processing gain Gp = 10 log N', `${fmt(run.processingGainDb, 4)} dB (${run.chipsPerBit} chips/bit)`)}${readout('BER now', `${fmt(run.ber, 4)} (${run.errors}/${run.bits})`)}${readout(c.spread === 'yes' ? 'BER without spreading' : 'BER with spreading', fmt(other.ber, 4))}${readout('Theory, AWGN only', fmt(run.theoryBer, 4))}${readout('Jamming margin ≈ Gp − (Eb/N0)req', `${fmt(run.processingGainDb - 9.6, 4)} dB for BER 10⁻⁵`)}${readout('FHSS', `${hop.channels} channels, ${eng(hop.bandwidth, 'Hz')} span, Gp = ${fmt(hop.processingGainDb, 4)} dB`)}${readout('Channel use', hop.use.join(' '))}<p class="field-help">The despreader multiplies by the same PN code: the wanted signal collapses back to the data rate while the jammer is spread over N chips, so only 1/N of its power lands in the decision. Spreading does not help against white noise — the BER with jammer off equals plain BPSK.</p></div></div>`;
    return { controls, body };
  }
  const channel = parseNumberList(c.channel, 'Channel taps');
  if (!channel.length || channel.length > 64) throw new RangeError('Enter 1 to 64 channel taps.');
  const run = ofdmLink({ subcarriers: Math.round(c.subcarriers), cp: Math.round(c.cp), scheme: c.scheme, channel, snrDb: c.snr, symbols: 30 });
  const ks = run.channelResponseDb.map((_, k) => k);
  const controls = `${labSelect('data-info-select', 'ofdm.subcarriers', 'Subcarriers N', Math.round(c.subcarriers), [16, 32, 64, 128, 256].map((n) => [n, String(n)]))}${infoField('ofdm.cp', 'Cyclic prefix', c.cp, 'samples')}${labSelect('data-info-select', 'ofdm.scheme', 'Mapping', c.scheme, [['qpsk', 'QPSK'], ['16qam', '16-QAM']])}${infoText('ofdm.channel', 'Multipath taps h[0], h[1], …', c.channel)}${infoField('ofdm.snr', 'Es/N0', c.snr, 'dB')}`;
  const body = `<div class="power-grid"><div><span class="panel-label">RECEIVED SUBCARRIERS BEFORE (LEFT) AND AFTER (RIGHT) THE ONE-TAP EQUALISER</span><div class="ofdm-pair">${scatterPlane('Raw constellation', run.raw, 2.5, '#64748b')}${scatterPlane('Equalised constellation', run.equalised, 1.6)}</div>${linePlot('Channel |H(k)|² in dB across subcarriers', ks, [{ name: '|H|²', values: run.channelResponseDb }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Transmitted OFDM signal (real part, three symbols with CP)', run.txPreview.map((_, k) => k), [{ name: 'Re x[n]', values: run.txPreview }])}</div>
    <div class="analysis-readouts">${readout('BER', `${fmt(run.ber, 4)} (${run.errors}/${run.bits} bits)`)}${readout('Channel delay spread', `${run.delaySpread} samples`)}${readout('CP covers the channel', run.cpCoversChannel ? 'yes — no inter-symbol interference' : 'NO — ISI and inter-carrier interference')}${readout('CP efficiency N/(N+CP)', `${fmt(100 * run.efficiency, 4)} %`)}<p class="field-help">The IFFT puts one QAM symbol on each subcarrier. When the cyclic prefix is at least as long as the channel, linear convolution becomes circular, so each subcarrier sees just a complex gain H(k) and a single division equalises it. Shorten the CP below the delay spread to watch the constellation smear.</p></div></div>`;
  return { controls, body };
}

function renderInfo(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'info'), 'INFORMATION THEORY & SPREAD SPECTRUM', '')}${labCard('info', 'Information theory', INFO_TABS, infoLab.configuration(state), renderInfoTab)}</div>`;
}

function bindInfoEvents() {
  bindLabControls('info', infoLab, ['mode', 'method', 'preset', 'spread', 'scheme']);
  bindLabText('info', infoLab, (config, group) => { if (group === 'channel') config.channel.preset = 'custom'; });
  document.querySelectorAll('[data-info-select="channel.preset"]').forEach((select) => select.addEventListener('change', () => {
    const preset = INFO_CHANNELS[select.value];
    if (preset) infoLab.persist((config) => { config.channel.matrix = preset[1]; config.channel.inputs = preset[2]; });
  }));
}

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
  wireSource = null; selectedWire = null;
  updateProject((project) => { project.circuit.components = structuredClone(components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'builtin-analysis', inputs: { ...builtinConfiguration(getState()), source: 'V1', ...analysis } });
  setState({ simulation: null, selectedComponentId: null, selectedComponentIds: [], circuitPlotTrace: trace, activeModule: 'circuit' });
  notify(`${name} loaded. Press Run to simulate.`, 'success');
}

// ---------------------------------------------------------------------------
// Electronic Measurements: AC bridges, Lissajous, errors, meter design and the Q-meter.


// ---------------------------------------------------------------------------
// Radar, satellite, antennas and microwave tubes.

const RADAR_TABS = [['radar', 'Radar range'], ['doppler', 'Doppler, MTI & FMCW'], ['orbit', 'Orbits & look angles'], ['link', 'Satellite link'], ['antenna', 'Antennas'], ['tubes', 'Microwave tubes & tests']];
const radarLab = makeLab('radar-lab', {
  tab: 'radar',
  radar: { pt: 1e6, gainDb: 40, frequency: 3e9, rcs: 1, bandwidth: 1e6, noiseFigureDb: 3, snrDb: 13, lossDb: 3, pulses: 1, prf: 1000, pulseWidth: 1e-6 },
  doppler: { frequency: 10e9, velocity: 30, prf: 1000, sweepBandwidth: 150e6, sweepTime: 1e-3, beat: 50e3 },
  orbit: { perigee: 35786e3, apogee: 35786e3, latitude: 18.52, longitude: 73.86, satelliteLongitude: 83 },
  link: { upEirp: 75, upFrequency: 6e9, satGt: -2, downEirp: 38, downFrequency: 4e9, esGain: 45, antennaNoise: 30, feedLoss: 0.3, lnaNoise: 50, distance: 38000e3, bandwidth: 36e6, otherLoss: 1 },
  antenna: { length: 0.5, frequency: 10e9, diameter: 1, efficiency: 0.55, ptDbm: 20, gt: 10, gr: 10, distance: 1000, linkFrequency: 2.4e9 },
  tubes: { v0: 300, frequency: 9e9, spacing: 1e-3, mv0: 26e3, b0: 0.336, a: 0.05, b: 0.1, p1: 1, p2: 0.89, p3: 0.01, p4: 1e-5, vmax: 2, vmin: 1 },
});
const radarField = groupField('data-radar-field');

function polarPattern(label, angles, field) {
  const size = 300, c0 = size / 2, r0 = 130;
  const full = [...angles.map((a, k) => [a, field[k]]), ...angles.slice(1).reverse().map((a, k) => [360 - a, field[angles.length - 2 - k]])];
  const path = full.map(([a, v], k) => { const t = a * Math.PI / 180; return `${k ? 'L' : 'M'}${(c0 + r0 * v * Math.sin(t)).toFixed(1)} ${(c0 - r0 * v * Math.cos(t)).toFixed(1)}`; }).join('') + 'Z';
  const rings = [0.25, 0.5, Math.SQRT1_2, 1].map((r) => `<circle class="unit-circle" cx="${c0}" cy="${c0}" r="${(r0 * r).toFixed(1)}"${r === Math.SQRT1_2 ? ' stroke-dasharray="3 3"' : ''}/>`).join('');
  return `<svg class="pz-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">${rings}<path class="axis" d="M${c0} 10V${size - 10}M10 ${c0}H${size - 10}"/><path class="pz-curve" stroke="${PLOT_COLORS[0]}" fill="${PLOT_COLORS[0]}" fill-opacity="0.15" d="${path}"/><text class="pz-axis-label" x="${c0 + 4}" y="18">θ = 0° (antenna axis)</text></svg>`;
}

function renderRadarTab(config) {
  const c = config[config.tab];
  if (config.tab === 'radar') {
    const r = radarRange(c), p = pulseRadar({ prf: c.prf, pulseWidth: c.pulseWidth, pt: c.pt });
    const ranges = Array.from({ length: 200 }, (_, k) => r.rmax * 0.1 + r.rmax * 1.9 * k / 199);
    const controls = `${radarField('radar.pt', 'Peak power Pt', c.pt, 'W')}${radarField('radar.gainDb', 'Antenna gain', c.gainDb, 'dB')}${radarField('radar.frequency', 'Frequency', c.frequency, 'Hz')}${radarField('radar.rcs', 'Target RCS σ', c.rcs, 'm²')}${radarField('radar.bandwidth', 'Receiver bandwidth', c.bandwidth, 'Hz')}${radarField('radar.noiseFigureDb', 'Noise figure', c.noiseFigureDb, 'dB')}${radarField('radar.snrDb', 'Required SNR', c.snrDb, 'dB')}${radarField('radar.lossDb', 'System losses', c.lossDb, 'dB')}${radarField('radar.pulses', 'Pulses integrated', c.pulses)}${radarField('radar.prf', 'PRF', c.prf, 'Hz')}${radarField('radar.pulseWidth', 'Pulse width', c.pulseWidth, 's')}`;
    const body = `<div class="power-grid"><div>${linePlot('Received SNR (dB) against target range — the line crosses the threshold at Rmax', ranges, [{ name: 'SNR', values: ranges.map(r.snrAt) }, { name: 'threshold', values: ranges.map(() => c.snrDb), color: '#f59e0b', dashed: true }], { xLabel: (x) => eng(x, 'm') })}</div>
      <div class="analysis-readouts">${readout('Maximum range Rmax', eng(r.rmax, 'm'))}${readout('Wavelength', eng(r.lambda, 'm'))}${readout('Noise power kT0BF', `${fmt(r.noisePowerDbm, 5)} dBm`)}${readout('Minimum detectable signal', `${fmt(r.sminDbm, 5)} dBm`)}${readout('Unambiguous range c/2PRF', eng(p.unambiguousRange, 'm'))}${readout('Range resolution cτ/2', eng(p.rangeResolution, 'm'))}${readout('Duty cycle, average power', `${fmt(100 * p.duty, 4)} %, ${eng(p.averagePower, 'W')}`)}${readout('Blind (minimum) range', eng(p.minimumRange, 'm'))}<p class="field-help">R⁴ law: doubling the range needs 16 × the power. Integrating n pulses coherently adds 10·log n dB of SNR. A target beyond c/2PRF returns after the next pulse and appears at a false, shorter range.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'doppler') {
    const d = doppler({ frequency: c.frequency, velocity: c.velocity, prf: c.prf });
    const f = fmcw({ bandwidth: c.sweepBandwidth, sweepTime: c.sweepTime, beat: c.beat, frequency: c.frequency });
    const vs = Array.from({ length: 400 }, (_, k) => 4 * d.firstBlind * k / 399);
    const controls = `${radarField('doppler.frequency', 'Carrier frequency', c.frequency, 'Hz')}${radarField('doppler.velocity', 'Radial velocity (+ approaching)', c.velocity, 'm/s')}${radarField('doppler.prf', 'PRF', c.prf, 'Hz')}${radarField('doppler.sweepBandwidth', 'FMCW sweep bandwidth', c.sweepBandwidth, 'Hz')}${radarField('doppler.sweepTime', 'Sweep time', c.sweepTime, 's')}${radarField('doppler.beat', 'Measured beat frequency', c.beat, 'Hz')}`;
    const body = `<div class="power-grid"><div>${linePlot('Single-delay MTI canceller response |H| = 2|sin(π fd/PRF)| against target speed', vs, [{ name: '|H|', values: vs.map((v) => doppler({ frequency: c.frequency, velocity: v, prf: c.prf }).cancellerGain) }], { xLabel: (x) => eng(x, 'm/s'), yMin: 0, yMax: 2 })}</div>
      <div class="analysis-readouts">${readout('Doppler shift fd = 2v/λ', eng(d.fd, 'Hz'))}${readout('Blind speeds n·λ·PRF/2', d.blindSpeeds.map((v) => eng(v, 'm/s')).join(', '))}${readout('Canceller gain at this speed', fmt(d.cancellerGain, 4))}${readout('FMCW slope B/T', eng(f.slope, 'Hz/s'))}${readout('FMCW range R = c·fb/(2·slope)', eng(f.range, 'm'))}${readout('FMCW range resolution c/2B', eng(f.rangeResolution, 'm'))}<p class="field-help">The MTI filter cancels fixed clutter (fd = 0) but also any target whose Doppler is a multiple of the PRF — the blind speeds. Staggered PRFs move the blind speeds apart.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'orbit') {
    const o = orbit({ perigeeAltitude: c.perigee, apogeeAltitude: c.apogee });
    const look = lookAngles({ latitude: c.latitude, longitude: c.longitude, satelliteLongitude: c.satelliteLongitude });
    const trace = orbitTrace(o, 240);
    const ext = Math.max(...trace.flat().map(Math.abs)) * 1.1;
    const earth = Array.from({ length: 73 }, (_, k) => ({ re: R_EARTH * Math.cos(k * Math.PI / 36), im: R_EARTH * Math.sin(k * Math.PI / 36) }));
    const controls = `${radarField('orbit.perigee', 'Perigee altitude', c.perigee, 'm')}${radarField('orbit.apogee', 'Apogee altitude', c.apogee, 'm')}${radarField('orbit.latitude', 'Earth-station latitude (N +)', c.latitude, '°')}${radarField('orbit.longitude', 'Earth-station longitude (E +)', c.longitude, '°')}${radarField('orbit.satelliteLongitude', 'GEO satellite longitude', c.satelliteLongitude, '°')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">ORBIT TO SCALE (EARTH SHADED)</span>${renderComplexPlane({ label: 'Orbit', extent: ext, curves: [{ points: earth, color: '#38bdf8' }, { points: trace.map(([x, y]) => ({ re: x, im: y })), color: PLOT_COLORS[0] }] })}</div>
      <div class="analysis-readouts">${readout('Semi-major axis a', eng(o.a, 'm'))}${readout('Eccentricity', fmt(o.e, 5))}${readout('Period T = 2π√(a³/μ)', `${fmt(o.period / 3600, 6)} h`)}${readout('Speed at perigee / apogee', `${eng(o.perigeeSpeed, 'm/s')} / ${eng(o.apogeeSpeed, 'm/s')}`)}${readout('Geostationary radius', eng(o.geostationaryRadius, 'm'))}${readout('Look angles to the GEO satellite', look.visible ? `azimuth ${fmt(look.azimuth, 5)}°, elevation ${fmt(look.elevation, 5)}°` : 'below the horizon — not visible')}${readout('Slant range', eng(look.slantRange, 'm'))}${readout('Central angle γ', `${fmt(look.centralAngle, 5)}°`)}<p class="field-help">Kepler's third law gives the period from a alone. A satellite at 35 786 km above the equator turns with the Earth (one sidereal day), so a dish can stay fixed. Azimuth is measured from true north; from India GEO satellites sit to the south.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'link') {
    const up = satelliteLink({ eirpDbw: c.upEirp, frequency: c.upFrequency, distance: c.distance, gtDb: c.satGt, otherLossDb: c.otherLoss, bandwidth: c.bandwidth });
    const gt = gOverT({ antennaGainDb: c.esGain, antennaNoise: c.antennaNoise, feedLossDb: c.feedLoss, lnaNoise: c.lnaNoise });
    const down = satelliteLink({ eirpDbw: c.downEirp, frequency: c.downFrequency, distance: c.distance, gtDb: gt.gtDb, otherLossDb: c.otherLoss, bandwidth: c.bandwidth });
    const total = combineCn(up.cn, down.cn);
    const controls = `${radarField('link.upEirp', 'Uplink EIRP', c.upEirp, 'dBW')}${radarField('link.upFrequency', 'Uplink frequency', c.upFrequency, 'Hz')}${radarField('link.satGt', 'Satellite G/T', c.satGt, 'dB/K')}${radarField('link.downEirp', 'Satellite EIRP', c.downEirp, 'dBW')}${radarField('link.downFrequency', 'Downlink frequency', c.downFrequency, 'Hz')}${radarField('link.esGain', 'Earth-station antenna gain', c.esGain, 'dB')}${radarField('link.antennaNoise', 'Antenna noise temperature', c.antennaNoise, 'K')}${radarField('link.feedLoss', 'Feed loss', c.feedLoss, 'dB')}${radarField('link.lnaNoise', 'LNA noise temperature', c.lnaNoise, 'K')}${radarField('link.distance', 'Slant range', c.distance, 'm')}${radarField('link.bandwidth', 'Transponder bandwidth', c.bandwidth, 'Hz')}${radarField('link.otherLoss', 'Atmospheric + pointing loss', c.otherLoss, 'dB')}`;
    const rows = [['EIRP', `${fmt(c.upEirp, 4)} dBW`, `${fmt(c.downEirp, 4)} dBW`], ['Free-space loss', `${fmt(up.fspl, 5)} dB`, `${fmt(down.fspl, 5)} dB`], ['Other losses', `${fmt(c.otherLoss, 3)} dB`, `${fmt(c.otherLoss, 3)} dB`], ['Receiver G/T', `${fmt(c.satGt, 4)} dB/K`, `${fmt(gt.gtDb, 4)} dB/K`], ['− Boltzmann', '228.6 dB', '228.6 dB'], ['C/N0', `${fmt(up.cn0, 5)} dBHz`, `${fmt(down.cn0, 5)} dBHz`], ['− 10 log B', `${fmt(10 * Math.log10(c.bandwidth), 5)} dB`, `${fmt(10 * Math.log10(c.bandwidth), 5)} dB`], ['C/N', `${fmt(up.cn, 5)} dB`, `${fmt(down.cn, 5)} dB`]];
    const body = `<div class="power-grid"><div>${simpleTable(['Item', 'Uplink', 'Downlink'], rows)}</div><div class="analysis-readouts">${readout('Earth-station Tsys', eng(gt.tsys, 'K'))}${readout('Earth-station G/T', `${fmt(gt.gtDb, 5)} dB/K`)}${readout('Overall C/N (1/C/N = 1/up + 1/down)', `${fmt(total, 5)} dB`)}<p class="field-help">C/N0 = EIRP − path loss + G/T − 10 log k. The weaker link dominates the overall C/N; the satellite's small antenna and limited power usually make the downlink the weak one.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'antenna') {
    const pattern = dipolePattern(c.length, 721);
    const d = directivity(pattern.field, pattern.angles), hp = halfPowerBeamwidth(pattern.field, pattern.angles);
    const ap = apertureAntenna({ frequency: c.frequency, diameter: c.diameter, efficiency: c.efficiency });
    const fr = friisLink({ ptDbm: c.ptDbm, gtDb: c.gt, grDb: c.gr, frequency: c.linkFrequency, distance: c.distance });
    const controls = `${radarField('antenna.length', 'Dipole length (wavelengths)', c.length)}${radarField('antenna.frequency', 'Dish frequency', c.frequency, 'Hz')}${radarField('antenna.diameter', 'Dish diameter', c.diameter, 'm')}${radarField('antenna.efficiency', 'Aperture efficiency', c.efficiency)}${radarField('antenna.ptDbm', 'Friis: Pt', c.ptDbm, 'dBm')}${radarField('antenna.gt', 'Gt', c.gt, 'dBi')}${radarField('antenna.gr', 'Gr', c.gr, 'dBi')}${radarField('antenna.linkFrequency', 'Link frequency', c.linkFrequency, 'Hz')}${radarField('antenna.distance', 'Distance', c.distance, 'm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">E-PLANE PATTERN OF THE DIPOLE (DASHED RING = HALF POWER)</span>${polarPattern('Dipole pattern', pattern.angles, pattern.field)}</div>
      <div class="analysis-readouts">${readout('Directivity (numerical integration)', `${fmt(d, 5)} = ${fmt(10 * Math.log10(d), 4)} dBi`)}${readout('Half-power beamwidth', hp === null ? '—' : `${fmt(hp, 4)}°`)}${readout('Dish gain η(πD/λ)²', `${fmt(ap.dishGainDb, 5)} dBi`)}${readout('Dish beamwidth ≈ 70λ/D', `${fmt(ap.dishBeamwidth, 4)}°`)}${readout('Effective aperture Gλ²/4π', `${fmt(ap.effectiveArea(ap.dishGain), 4)} m²`)}${readout('Far-field distance 2D²/λ', eng(ap.farField, 'm'))}${readout('Friis: path loss, received power', `${fmt(fr.fspl, 5)} dB, ${fmt(fr.prDbm, 5)} dBm`)}<p class="field-help">The pattern comes from E(θ) = [cos(πL cosθ) − cos(πL)]/sinθ and the directivity from integrating it over the sphere: 1.5 for a short dipole, 1.64 (2.15 dBi) at λ/2, 2.41 at λ. Longer than about 1.25λ the main lobe splits.</p></div></div>`;
    return { controls, body };
  }
  const rk = reflexKlystron({ v0: c.v0, frequency: c.frequency, spacing: c.spacing });
  const mg = magnetron({ v0: c.mv0, b0: c.b0, cathodeRadius: c.a, anodeRadius: c.b });
  const dc = directionalCoupler({ p1: c.p1, p2: c.p2, p3: c.p3, p4: c.p4 });
  const vs = vswrMeasurement({ vmax: c.vmax, vmin: c.vmin });
  const controls = `${radarField('tubes.v0', 'Klystron beam voltage V0', c.v0, 'V')}${radarField('tubes.frequency', 'Klystron frequency', c.frequency, 'Hz')}${radarField('tubes.spacing', 'Repeller spacing L', c.spacing, 'm')}${radarField('tubes.mv0', 'Magnetron anode voltage', c.mv0, 'V')}${radarField('tubes.b0', 'Magnetic flux density', c.b0, 'T')}${radarField('tubes.a', 'Cathode radius a', c.a, 'm')}${radarField('tubes.b', 'Anode radius b', c.b, 'm')}${radarField('tubes.p1', 'Coupler P1 (input)', c.p1, 'W')}${radarField('tubes.p2', 'P2 (through)', c.p2, 'W')}${radarField('tubes.p3', 'P3 (coupled)', c.p3, 'W')}${radarField('tubes.p4', 'P4 (isolated)', c.p4, 'W')}${radarField('tubes.vmax', 'Slotted line Vmax', c.vmax, 'V')}${radarField('tubes.vmin', 'Vmin', c.vmin, 'V')}`;
  const body = `<div class="power-grid"><div>${simpleTable(['Mode n', 'Transit (cycles)', 'Repeller voltage', 'Max efficiency'], rk.modes.map((m) => [String(m.n), `${m.cycles}`, m.possible ? eng(m.repeller, 'V') : 'not possible', `${fmt(100 * m.efficiency, 4)} %`]))}</div>
    <div class="analysis-readouts">${readout('Magnetron Hull cut-off field for V0', eng(mg.hullField, 'T'))}${readout('Hull cut-off voltage for B0', eng(mg.hullVoltage, 'V'))}${readout('Cyclotron frequency eB/2πm', eng(mg.cyclotron, 'Hz'))}${readout('Regime', mg.regime)}${readout('Coupler: coupling, directivity, isolation', `${fmt(dc.coupling, 4)} dB, ${fmt(dc.directivity, 4)} dB, ${fmt(dc.isolation, 4)} dB`)}${readout('Insertion loss', `${fmt(dc.insertionLoss, 4)} dB`)}${readout('VSWR, |Γ|, return loss', `${fmt(vs.vswr, 4)}, ${fmt(vs.gamma, 4)}, ${fmt(vs.returnLoss, 4)} dB`)}<p class="field-help">Reflex klystron modes need a transit time of n − ¼ cycles in the repeller space; higher modes need less repeller voltage but give less power. Isolation = coupling + directivity.</p></div></div>`;
  return { controls, body };
}

function renderRadar(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'radar'), 'RADAR, SATELLITE, ANTENNAS & MICROWAVE', '')}${labCard('radar', 'Radar & satellite', RADAR_TABS, radarLab.configuration(state), renderRadarTab)}</div>`;
}

function bindRadarEvents() { bindLabControls('radar', radarLab); }

// ---------------------------------------------------------------------------
// Speech processing.


// ---------------------------------------------------------------------------
// PLC ladder lab.

const PLC_TABS = [['program', 'Ladder & live run'], ['timing', 'Timing diagram']];
const plcLab = makeLab('plc-lab', {
  tab: 'program',
  program: { example: 'motor', text: LADDER_EXAMPLES.motor[1], script: LADDER_EXAMPLES.motor[2], duration: 10, scanMs: 10 },
  timing: {},
});
const plcText = labText('plc');
let plcLive = null;

const plcValue = (plc, name) => (/^T/.test(name) ? Boolean(plc?.timers[name]?.done) : /^C/.test(name) ? Boolean(plc?.counters[name]?.done) : Boolean(plc?.bits[name]));

function renderLadder(rungs, plc = null) {
  const CW = 92, RH = 46, left = 24;
  let svg = '', y = 14;
  const wire = (x1, y1, x2, y2, on) => `<path class="ladder-wire${on ? ' on' : ''}" d="M${x1} ${y1}L${x2} ${y2}"/>`;
  const contactState = (node) => (plc ? (node.negated ? !plcValue(plc, node.name) : plcValue(plc, node.name)) : false);
  const draw = (node, x, top) => {
    if (node.kind === 'always') return wire(x, top + RH / 2, x + CW, top + RH / 2, Boolean(plc));
    if (node.kind === 'contact') {
      const cy = top + RH / 2, on = contactState(node);
      return `${wire(x, cy, x + 32, cy, on)}${wire(x + 60, cy, x + CW, cy, on)}<path class="ladder-contact${on ? ' on' : ''}" d="M${x + 32} ${cy - 11}V${cy + 11}M${x + 60} ${cy - 11}V${cy + 11}${node.negated ? `M${x + 36} ${cy + 10}L${x + 56} ${cy - 10}` : ''}"/><text class="ladder-label" x="${x + 46}" y="${cy - 15}" text-anchor="middle">${node.edge ? '↑' : ''}${esc(node.name)}</text>`;
    }
    if (node.kind === 'and') { let out = '', cx = x; for (const item of node.items) { out += draw(item, cx, top); cx += item.w * CW; } return out; }
    let out = '', ty = top;
    const width = node.w * CW;
    for (const item of node.items) {
      out += draw(item, x, ty);
      if (item.w < node.w) out += wire(x + item.w * CW, ty + RH / 2, x + width, ty + RH / 2, false);
      ty += item.h * RH;
    }
    const lastMid = ty - node.items.at(-1).h * RH + RH / 2;
    return `${out}${wire(x, top + RH / 2, x, lastMid, false)}${wire(x + width, top + RH / 2, x + width, lastMid, false)}`;
  };
  const maxW = Math.max(...rungs.map((r) => layoutCondition(r.condition).w));
  const coilX = left + maxW * CW + 30, rail = coilX + 150;
  rungs.forEach((rung, index) => {
    const box = layoutCondition(rung.condition);
    const rows = Math.max(box.h, rung.outputs.length);
    svg += `<text class="ladder-rung-no" x="4" y="${y + RH / 2 + 4}">${index + 1}</text>`;
    svg += draw(box, left, y);
    const powered = plc ? plcLive?.powered?.[index] : false;
    svg += wire(left + box.w * CW, y + RH / 2, coilX, y + RH / 2, powered);
    rung.outputs.forEach((out, k) => {
      const cy = y + k * RH + RH / 2;
      if (k > 0) svg += wire(coilX, y + RH / 2, coilX, cy, powered);
      const label = { coil: '( )', set: '(S)', reset: '(R)', ton: 'TON', tof: 'TOF', tp: 'TP', ctu: 'CTU', ctd: 'CTD', res: 'RES' }[out.kind];
      const active = plc && plcValue(plc, out.name);
      const detail = out.preset !== undefined ? (out.kind.startsWith('ct') ? ` ${plc?.counters[out.name]?.count ?? 0}/${out.preset}` : ` ${fmt(plc?.timers[out.name]?.elapsed ?? 0, 3)}/${fmt(out.preset, 3)} s`) : '';
      svg += `${wire(coilX, cy, coilX + 30, cy, powered)}<rect class="ladder-coil${active ? ' on' : ''}" x="${coilX + 30}" y="${cy - 13}" width="64" height="26" rx="13"/><text class="ladder-label" x="${coilX + 62}" y="${cy + 4}" text-anchor="middle">${esc(label)}</text><text class="ladder-label" x="${coilX + 100}" y="${cy + 4}">${esc(out.name)}${esc(detail)}</text>${wire(coilX + 94, cy, coilX + 96, cy, false)}`;
    });
    y += rows * RH + 10;
  });
  const height = y + 4;
  return `<svg class="ladder-svg" style="max-width:${Math.round((rail + 60) * 1.25)}px" viewBox="0 0 ${rail + 60} ${height}" role="img" aria-label="Ladder diagram"><path class="ladder-rail" d="M${left} 4V${height - 4}M${rail + 50} 4V${height - 4}"/>${svg}</svg>`;
}

function renderPlcLivePanel(rungs) {
  const list = operands(rungs);
  const plc = plcLive?.plc;
  const lamp = (name) => `<span class="plc-lamp ${plcValue(plc, name) ? 'on' : ''}"><i></i>${esc(name)}</span>`;
  return `<div class="plc-io"><div><span class="panel-label">INPUTS (CLICK TO TOGGLE)</span><div class="plc-buttons">${list.inputs.map((name) => `<button class="plc-input ${plcLive?.inputs?.[name] ? 'on' : ''}" data-plc-input="${name}">${esc(name)}</button>`).join('') || '<small>no inputs</small>'}</div></div><div><span class="panel-label">OUTPUTS</span><div class="plc-buttons">${list.outputs.map(lamp).join('') || '<small>none</small>'}</div></div><div><span class="panel-label">MEMORY, TIMERS, COUNTERS</span><div class="plc-buttons">${[...list.memory, ...list.timers, ...list.counters].map(lamp).join('') || '<small>none</small>'}</div></div><small>${plcLive?.running ? `Running · ${fmt(plc.time, 4)} s · ${plc.scans} scans` : 'Stopped'}</small></div>${renderLadder(rungs, plc ?? null)}`;
}

function renderPlcTab(config) {
  const c = config.program;
  const rungs = parseLadder(c.text);
  const controls = `${labSelect('data-plc-select', 'program.example', 'Example', c.example, [...Object.entries(LADDER_EXAMPLES).map(([id, e]) => [id, e[0]]), ['custom', 'Custom']])}${plcText('program.text', 'Ladder program (one rung per line)', c.text, 7)}`;
  if (config.tab === 'program') {
    const body = `<div class="plc-actions"><button class="button run" data-plc-live="start">▶ Run live</button><button class="button" data-plc-live="stop">■ Stop</button><button class="button" data-plc-live="reset">Reset</button></div><div data-plc-panel>${renderPlcLivePanel(rungs)}</div><p class="field-help">Syntax: <code>(I0.0 | Q0.0) /I0.1 -&gt; Q0.0</code> — a space means series (AND), <code>|</code> means parallel (OR), <code>/</code> is a normally closed contact and <code>^</code> a rising-edge contact. Outputs: a coil (<code>Q0.0</code>, <code>M0.0</code>), <code>S</code>/<code>R</code> latch and unlatch, <code>TON</code>/<code>TOF</code>/<code>TP Tn 2s</code>, <code>CTU</code>/<code>CTD Cn 5</code> and <code>RES</code>. The PLC scans every 10 ms: it reads the inputs, solves the rungs top to bottom and writes the outputs, so rung order matters.</p>`;
    return { controls, body };
  }
  const result = runLadder(rungs, { events: parseInputScript(c.script), duration: c.duration, scanTime: c.scanMs / 1000 });
  const rowH = 26, w = 600, names = result.names, tMax = result.times.at(-1) || 1;
  const rows = names.map((name, k) => {
    const tr = result.traces[name];
    const y0 = k * rowH + 20;
    const path = tr.map((v, i) => `${i ? 'L' : 'M'}${(result.times[i] / tMax * w).toFixed(1)} ${(y0 - v * 14).toFixed(1)}`).join('');
    return `<text class="ladder-label" x="-6" y="${y0 - 3}" text-anchor="end">${esc(name)}</text><path class="timing-trace" d="${path}"/>`;
  }).join('');
  const ticks = Array.from({ length: 6 }, (_, k) => `<text class="ladder-label" x="${(k / 5 * w).toFixed(1)}" y="${names.length * rowH + 22}" text-anchor="middle">${fmt(tMax * k / 5, 3)} s</text><path class="timing-grid" d="M${(k / 5 * w).toFixed(1)} 0V${names.length * rowH + 8}"/>`).join('');
  const body = `<div class="power-grid"><div><span class="panel-label">TIMING DIAGRAM FROM THE INPUT SCRIPT</span><svg class="timing-svg" viewBox="-60 -4 ${w + 70} ${names.length * rowH + 30}">${ticks}${rows}</svg></div><div class="analysis-readouts">${readout('Scans simulated', String(result.plc.scans))}${readout('Final outputs', operands(rungs).outputs.map((n) => `${n}=${plcValue(result.plc, n) ? 1 : 0}`).join(' '))}<p class="field-help">The input script lists events as <code>time I0.0=1</code> separated by semicolons. Timers count in whole scans, so a 2 s TON at a 10 ms scan finishes exactly 200 scans after its input turns on.</p></div></div>`;
  return { controls: `${controls}${plcText('program.script', 'Input script (time input=0/1; …)', c.script, 3)}${groupField('data-plc-field')('program.duration', 'Run for', c.duration, 's')}${groupField('data-plc-field')('program.scanMs', 'Scan time', c.scanMs, 'ms')}`, body };
}

function renderPlc(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'plc'), 'PLC, LADDER LOGIC & AUTOMATION', '')}${labCard('plc', 'PLC ladder', PLC_TABS, plcLab.configuration(state), renderPlcTab)}</div>`;
}

function stopPlcLive() { if (plcLive?.timer) clearInterval(plcLive.timer); if (plcLive) { plcLive.running = false; plcLive.timer = null; } }

function bindPlcEvents() {
  bindLabControls('plc', plcLab, ['example']);
  bindLabText('plc', plcLab, (config, group, key) => { if (key === 'text') { config.program.example = 'custom'; stopPlcLive(); plcLive = null; } });
  document.querySelectorAll('[data-plc-select="program.example"]').forEach((select) => select.addEventListener('change', () => {
    const example = LADDER_EXAMPLES[select.value];
    if (example) { stopPlcLive(); plcLive = null; plcLab.persist((config) => { config.program.text = example[1]; config.program.script = example[2]; }); }
  }));
  const panel = document.querySelector('[data-plc-panel]');
  if (!panel) { stopPlcLive(); return; }
  let rungs;
  try { rungs = parseLadder(plcLab.configuration(getState()).program.text); } catch { return; }
  const refresh = () => { const target = document.querySelector('[data-plc-panel]'); if (!target) { stopPlcLive(); return; } target.innerHTML = renderPlcLivePanel(rungs); };
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-plc-input]');
    if (!button) return;
    plcLive ??= { plc: createPlc(), inputs: {}, running: false, timer: null, powered: [] };
    plcLive.inputs[button.dataset.plcInput] = !plcLive.inputs[button.dataset.plcInput];
    if (!plcLive.running) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0);
    refresh();
  });
  document.querySelectorAll('[data-plc-live]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.plcLive;
    if (action === 'reset') { stopPlcLive(); plcLive = null; refresh(); return; }
    if (action === 'stop') { stopPlcLive(); refresh(); return; }
    plcLive ??= { plc: createPlc(), inputs: {}, running: false, timer: null, powered: [] };
    if (plcLive.running) return;
    plcLive.running = true;
    plcLive.timer = setInterval(() => { for (let k = 0; k < 10; k += 1) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0.01); refresh(); }, 100);
    refresh();
  }));
  if (plcLive?.running) { stopPlcLive(); plcLive.running = true; plcLive.timer = setInterval(() => { for (let k = 0; k < 10; k += 1) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0.01); refresh(); }, 100); }
}

// ---------------------------------------------------------------------------
// Electrical machines and power devices.



// ---------------------------------------------------------------------------
// Electronic product design.



// ---------------------------------------------------------------------------
// Fault Hunt: find the hidden fault with a virtual multimeter.


// ---------------------------------------------------------------------------
// Real + Virtual Bench: one firmware on a real Arduino (Web Serial) and on the simulated Uno.

const twinLab = makeLab('twin-lab', {
  tab: 'bench',
  bench: { experiment: 'rc', r: 10e3, c: 1e-6, period: 200, rTop: 10e3, rBottom: 4.7e3, vs: 5 },
});
const twinField = groupField('data-twin-field');
// Runs and the serial connection live in memory only.
const twinState = { virtual: null, real: null, busy: '', port: null, reader: null, text: '', connected: false, ready: false };

function twinCommand(c) { return c.experiment === 'rc' ? `R${Math.round(c.period)}\n` : c.experiment === 'dc' ? 'D\n' : 'S\n'; }

function analyseTwin(c, text) {
  const parsed = parseTwinOutput(text);
  if (c.experiment === 'rc') { if (!parsed.rc || parsed.rc.samples.length < 8) throw new Error('No RC samples received.'); return { kind: 'rc', parsed, run: compareRc({ r: c.r, c: c.c, vs: c.vs, period: parsed.rc.period, raws: parsed.rc.samples }) }; }
  if (c.experiment === 'dc') { if (!parsed.dc) throw new Error('No DC reading received.'); return { kind: 'dc', parsed, run: compareDivider({ vs: c.vs, rTop: c.rTop, rBottom: c.rBottom, code: parsed.dc.a1 }), a0: parsed.dc.a0 }; }
  return { kind: 'stream', parsed };
}

function renderTwin(state) {
  const c = twinLab.configuration(state).bench;
  const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
  const serialOk = typeof navigator !== 'undefined' && 'serial' in navigator;
  const v = twinState.virtual?.kind === c.experiment ? twinState.virtual : null, r = twinState.real?.kind === c.experiment ? twinState.real : null;
  let plot = '', readouts = '';
  try {
    if (c.experiment === 'rc') {
      const base = v?.run ?? r?.run;
      const window = base ? base.times.at(-1) : 50 * c.r * c.c / 10;
      const ts = Array.from({ length: 200 }, (_, k) => window * k / 199);
      const series = [{ name: 'theory V(t) = Vs(1 − e^(−t/RC))', values: ts.map((t) => rcCharge(t, c.r, c.c, c.vs)), color: '#94a3b8', dashed: true }];
      const resample = (run) => ts.map((t) => run.volts[Math.min(run.volts.length - 1, Math.round(t / (run.times[1] - run.times[0])))]);
      if (v) series.push({ name: 'virtual Uno (simulator)', values: resample(v.run), color: PLOT_COLORS[0] });
      if (r) series.push({ name: 'real Arduino', values: resample(r.run), color: '#f59e0b' });
      plot = linePlot('Capacitor voltage after the step on D8', ts, series, { xLabel: (x) => eng(x, 's'), unit: 'V', yMin: 0, yMax: c.vs * 1.05 });
      const row = (label, run) => (run ? `${readout(`${label}: fitted τ`, `${eng(run.run.fit.tau, 's')} (${run.run.errorPercent >= 0 ? '+' : ''}${fmt(run.run.errorPercent, 3)} % vs R·C)`)}${readout(`${label}: implied C, final voltage`, `${eng(run.run.impliedC, 'F')}, ${fmt(run.run.fit.vFinal, 4)} V`)}` : '');
      readouts = `${readout('Theory τ = R·C', eng(c.r * c.c, 's'))}${row('Virtual', v)}${row('Real', r)}${v && r ? readout('Real vs virtual', explainDifference(100 * (r.run.fit.tau - v.run.fit.tau) / v.run.fit.tau)) : ''}`;
    } else if (c.experiment === 'dc') {
      const theory = c.vs * c.rBottom / (c.rTop + c.rBottom);
      readouts = `${readout('Theory V(A1)', `${fmt(theory, 5)} V`)}${v ? readout('Virtual Uno', `${fmt(v.run.measured, 5)} V (${fmt(v.run.errorPercent, 3)} %), A0 code ${fmt(v.a0, 5)}`) : ''}${r ? readout('Real Arduino', `${fmt(r.run.measured, 5)} V (${fmt(r.run.errorPercent, 3)} %), A0 code ${fmt(r.a0, 5)}`) : ''}${r ? readout('What it means', explainDifference(r.run.errorPercent)) : ''}`;
    } else {
      const s = (r ?? v)?.parsed.stream ?? [];
      if (s.length) plot = linePlot('Live stream: A0 and A1 (volts)', s.map((p) => p.ms / 1000), [{ name: 'A0', values: s.map((p) => adcToVolts(p.a0)) }, { name: 'A1', values: s.map((p) => adcToVolts(p.a1)), color: '#f59e0b' }], { xLabel: (x) => `${fmt(x, 4)} s`, unit: 'V' });
      readouts = readout('Samples', String(s.length));
    }
  } catch (error) { readouts = `<div class="diagnostic error"><b>Twin bench</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${labSelect('data-twin-select', 'bench.experiment', 'Experiment', c.experiment, [['rc', 'RC step response (D8 → R → A0 → C)'], ['dc', 'Voltage divider on A1'], ['stream', 'Live stream A0, A1']])}${c.experiment === 'rc' ? `${twinField('bench.r', 'R', c.r, 'Ω')}${twinField('bench.c', 'C', c.c, 'F')}${twinField('bench.period', 'Sample period', c.period, 'µs')}` : ''}${c.experiment === 'dc' ? `${twinField('bench.rTop', 'Top resistor (5 V → A1)', c.rTop, 'Ω')}${twinField('bench.rBottom', 'Bottom resistor (A1 → GND)', c.rBottom, 'Ω')}` : ''}${twinField('bench.vs', 'Supply (measure your USB 5 V)', c.vs, 'V')}`;
  const wiring = c.experiment === 'rc' ? 'D8 → R → A0 → C → GND (capacitor − to GND)' : c.experiment === 'dc' ? '5V → top resistor → A1 → bottom resistor → GND' : 'Any signals (0–5 V) on A0 and A1';
  const window = 250 * c.period * 1e-6;
  const hint = c.experiment === 'rc' && (window < 3 * c.r * c.c || window > 60 * c.r * c.c) ? `<p class="field-help">Tip: the 250-sample window is ${eng(window, 's')}; choose a sample period near ${Math.max(120, Math.round(c.r * c.c * 5 / 250 * 1e6))} µs so it covers about five time constants.</p>` : '';
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'twin'), 'REAL + VIRTUAL BENCH', '')}<div class="dsp-card"><div class="dsp-controls">${controls}</div>
    <div class="twin-actions"><button class="button run" data-twin-run="virtual" ${twinState.busy ? 'disabled' : ''}>▶ Run on the simulated Uno</button>${serialOk ? `<button class="button" data-twin-connect ${twinState.busy ? 'disabled' : ''}>${twinState.connected ? '✓ Arduino connected' : '🔌 Connect real Arduino'}</button><button class="button run" data-twin-run="real" ${twinState.connected && !twinState.busy ? '' : 'disabled'}>▶ Run on the real Arduino</button>` : '<span class="pill">Real hardware needs Chrome or Edge (Web Serial)</span>'}<button class="button" data-twin-download="ino">Download firmware (.ino)</button><button class="button" data-twin-download="hex">Download HEX</button></div>
    <p class="field-help twin-status">${esc(twinState.busy || 'Ready.')}</p>
    <div class="power-grid"><div>${plot || '<p class="field-help">Run the experiment on the simulated Uno, the real Arduino, or both — the results appear here on top of the theory.</p>'}</div><div class="analysis-readouts">${readout('Wiring', wiring)}${readouts}${hint}<p class="field-help">How it works: upload the OpenENTC Twin firmware (${firmware?.flashBytes ?? '—'} bytes) to an Arduino Uno with the Arduino IDE. The <b>exact same program</b> runs here on the simulated ATmega328P, wired to the same circuit through co-simulation. Differences between the two curves are real-world effects: component tolerance, supply voltage, ADC error and breadboard contacts.</p></div></div></div></div>`;
}

function runTwinVirtual() {
  const c = twinLab.configuration(getState()).bench;
  const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
  const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
  const board = new UnoBoard(firmware.hex, firmware.board);
  const components = c.experiment === 'rc' ? [part('R1', 'resistor', c.r, 'drive', 'cap'), part('C1', 'capacitor', c.c, 'cap', '0'), part('VUSB', 'voltage', c.vs, 'vcc', '0'), part('RA1', 'resistor', 1e6, 'vcc', 'a1')] : [part('VUSB', 'voltage', c.vs, 'vcc', '0'), part('R1', 'resistor', c.rTop, 'vcc', 'a1'), part('R2', 'resistor', c.rBottom, 'a1', '0'), part('RA0', 'resistor', 1e6, 'a0', '0')];
  const connections = c.experiment === 'rc' ? [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }, { pin: 'A1', node: 'a1' }] : [{ pin: 'A0', node: 'a0' }, { pin: 'A1', node: 'a1' }];
  let sim;
  try { sim = createCoSimulation(board, { components, connections, maxStep: Math.min(50e-6, c.period * 1e-6 / 2), historyLimit: 2000 }); } catch (error) { notify(error.message, 'error'); return; }
  const text = () => new TextDecoder().decode(new Uint8Array(board.mcu.usart.output));
  sim.advance(0.03);
  board.mcu.usart.receive([...new TextEncoder().encode(twinCommand(c))]);
  const limit = c.experiment === 'rc' ? 0.7 + 250 * c.period * 1e-6 + 0.6 : c.experiment === 'dc' ? 0.3 : 1.8;
  let simulated = 0;
  twinState.busy = 'Running the firmware on the simulated Uno…';
  render();
  const step = () => {
    try {
      for (let k = 0; k < 4; k += 1) { sim.advance(0.025); simulated += 0.025; }
      if (parseTwinOutput(text()).complete < 1 && simulated < limit) { const status = document.querySelector('.twin-status'); if (status) status.textContent = `Simulating… ${fmt(simulated, 3)} s of ${fmt(limit, 3)} s`; setTimeout(step, 0); return; }
      twinState.virtual = analyseTwin(c, text());
      twinState.busy = '';
      notify('Virtual run finished', 'success');
    } catch (error) { twinState.busy = ''; notify(`Virtual run failed: ${error.message}`, 'error'); }
    render();
  };
  setTimeout(step, 0);
}

async function connectTwinSerial() {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: TWIN_BAUD });
    twinState.port = port; twinState.connected = true; twinState.ready = false; twinState.text = '';
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable).catch(() => {});
    twinState.reader = decoder.readable.getReader();
    (async () => { try { for (;;) { const { value, done } = await twinState.reader.read(); if (done) break; twinState.text += value; if (twinState.text.includes(TWIN_BANNER)) twinState.ready = true; if (twinState.text.length > 200000) twinState.text = twinState.text.slice(-100000); } } catch { /* port closed */ } twinState.connected = false; render(); })();
    notify('Arduino connected — it restarts when the port opens, so wait a second before running.', 'success');
  } catch (error) { notify(`Could not open the serial port: ${error.message}`, 'error'); }
  render();
}

async function runTwinReal() {
  const c = twinLab.configuration(getState()).bench;
  if (!twinState.port) return;
  twinState.busy = 'Waiting for the real Arduino…';
  render();
  try {
    if (!twinState.ready) await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!twinState.ready) throw new Error('No reply from the OpenENTC Twin firmware — is it uploaded, and is the baud rate 115200?');
    twinState.text = '';
    const writer = twinState.port.writable.getWriter();
    await writer.write(new TextEncoder().encode(twinCommand(c)));
    writer.releaseLock();
    const deadline = Date.now() + 8000;
    while (parseTwinOutput(twinState.text).complete < 1 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    twinState.real = analyseTwin(c, twinState.text);
    notify('Real run finished', 'success');
  } catch (error) { notify(error.message, 'error'); }
  twinState.busy = '';
  render();
}

function bindTwinEvents() {
  bindLabControls('twin', twinLab, ['experiment']);
  document.querySelectorAll('[data-twin-run="virtual"]').forEach((button) => button.addEventListener('click', runTwinVirtual));
  document.querySelectorAll('[data-twin-run="real"]').forEach((button) => button.addEventListener('click', runTwinReal));
  document.querySelectorAll('[data-twin-connect]').forEach((button) => button.addEventListener('click', () => { if (!twinState.connected) connectTwinSerial(); }));
  document.querySelectorAll('[data-twin-download]').forEach((button) => button.addEventListener('click', () => {
    const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
    const ino = button.dataset.twinDownload === 'ino';
    const blob = new Blob([ino ? firmware.source : firmware.hex], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = ino ? 'openentc_twin.ino' : 'openentc_twin.hex'; link.click(); URL.revokeObjectURL(link.href);
  }));
}

// ---------------------------------------------------------------------------
// Cellular planning.

const CELL_TABS = [['traffic', 'Traffic & Erlang'], ['reuse', 'Frequency reuse'], ['pathloss', 'Path loss & cell size'], ['handoff', 'Handoff']];
const cellLab = makeLab('cell-lab', {
  tab: 'traffic',
  traffic: { users: 1000, callsPerHour: 1.5, holding: 120, channels: 60, gos: 0.02, waitLimit: 20 },
  reuse: { cluster: 7, exponent: 4, sectoring: 'omni', totalChannels: 416, cells: 32, requiredSir: 18 },
  pathloss: { frequency: 900, baseHeight: 30, mobileHeight: 1.5, environment: 'urban-medium', eirp: 55, sensitivity: -102, rxGain: 0, otherLoss: 3, sigma: 8, coverage: 0.9, exponent: 3.5 },
  handoff: { separation: 2, txPower: 43, exponent: 3.5, sigma: 6, decorrelation: 50, hysteresis: 3, ttt: 0, threshold: -95, seed: 1 },
});
const cellField = (...args) => groupField('data-cell-field')(...args);
const HEX_COLORS = ['#38bdf8', '#f97316', '#a3e635', '#e879f9', '#facc15', '#2dd4bf', '#f87171', '#818cf8', '#fb923c', '#4ade80', '#c084fc', '#fbbf24', '#22d3ee', '#fda4af', '#93c5fd', '#bef264', '#fcd34d', '#67e8f9', '#f0abfc', '#86efac', '#fdba74', '#a5b4fc', '#5eead4', '#fca5a5', '#d9f99d', '#e9d5ff', '#99f6e4', '#fed7aa'];

function renderHexLayout(plan) {
  const layout = hexLayout({ i: plan.i, j: plan.j, rings: Math.min(7, Math.max(3, Math.ceil(plan.q) + 1)) });
  const size = 14, scale = size;
  const xs = layout.cells.map((cell) => cell.x * scale), ys = layout.cells.map((cell) => cell.y * scale);
  const pad = size * 1.2, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, width = Math.max(...xs) - minX + pad, height = Math.max(...ys) - minY + pad;
  const corners = Array.from({ length: 6 }, (_, k) => [size * Math.cos(Math.PI / 6 + k * Math.PI / 3), size * Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
  const centreGroup = layout.cells.find((cell) => cell.q === 0 && cell.r === 0).group;
  const firstTier = layout.cells.filter((cell) => cell.group === centreGroup && Math.abs(Math.hypot(cell.x, cell.y) - plan.q) < 1e-6);
  const hexes = layout.cells.map((cell) => {
    const cx = cell.x * scale, cy = cell.y * scale;
    const isCo = cell.group === centreGroup;
    return `<polygon points="${corners.map(([dx, dy]) => `${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}`).join(' ')}" fill="${HEX_COLORS[cell.group % HEX_COLORS.length]}" fill-opacity="${isCo ? 0.85 : 0.28}" class="hex-cell"/><text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" class="hex-label">${String.fromCharCode(65 + (cell.group % 26))}${cell.group >= 26 ? cell.group : ''}</text>`;
  }).join('');
  const lines = firstTier.map((cell) => `<line class="hex-d" x1="0" y1="0" x2="${(cell.x * scale).toFixed(1)}" y2="${(cell.y * scale).toFixed(1)}"/>`).join('');
  return `<svg class="hex-map" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}" role="img" aria-label="Hexagonal reuse pattern">${hexes}${lines}<circle cx="0" cy="0" r="3" class="hex-centre"/></svg>`;
}

function renderCellularTab(config) {
  const c = config[config.tab];
  if (config.tab === 'traffic') {
    const traffic = offeredTraffic({ users: c.users, callsPerHour: c.callsPerHour, holdingSeconds: c.holding });
    const channels = Math.max(1, Math.round(c.channels));
    const blocking = erlangB(traffic, channels), needed = channelsForGos(Math.max(traffic, 1e-9), c.gos);
    const wait = erlangC(traffic, channels, c.holding, c.waitLimit);
    const aMax = Math.max(traffic * 1.6, channels * 1.2);
    const as = Array.from({ length: 200 }, (_, k) => aMax * (k + 1) / 200);
    const ns = [...new Set([Math.max(1, channels - 10), channels, channels + 10])];
    const gosRows = [0.005, 0.01, 0.02, 0.05, 0.1].map((g) => `<tr><td>${fmt(g * 100, 3)} %</td><td>${fmt(trafficForGos(channels, g), 5)} E</td><td>${fmt(trafficForGos(channels, g) * (1 - g) / channels * 100, 4)} %</td><td>${Math.floor(trafficForGos(channels, g) * 3600 / (c.callsPerHour * c.holding))}</td></tr>`).join('');
    const controls = `${cellField('traffic.users', 'Subscribers', c.users)}${cellField('traffic.callsPerHour', 'Calls per user per hour', c.callsPerHour)}${cellField('traffic.holding', 'Mean holding time', c.holding, 's')}${cellField('traffic.channels', 'Channels (trunks)', channels)}${cellField('traffic.gos', 'Target blocking (GoS)', c.gos)}${cellField('traffic.waitLimit', 'Erlang-C wait limit', c.waitLimit, 's')}`;
    const body = `<div class="power-grid"><div>${renderPlotFrame({ title: 'Erlang-B blocking probability against offered traffic (erlangs), log scale', series: ns.map((n, index) => ({ xs: as, ys: as.map((a) => Math.log10(Math.max(erlangB(a, n), 1e-6))), color: PLOT_COLORS[index], primary: n === channels })), xMin: as[0], xMax: aMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(as[0] + (aMax - as[0]) * k / 5, 3) })), yRange: { min: -6, max: 0, ticks: [-6, -5, -4, -3, -2, -1, 0] }, formatY: (value) => { const percent = 10 ** value * 100; return `${percent >= 0.01 ? fmt(percent, 3) : percent.toPrecision(1)} %`; } })}<div class="plot-legend">${ns.map((n, index) => `<span class="legend-chip" style="--chip:${PLOT_COLORS[index]}">N = ${n}</span>`).join('')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>GoS</th><th>Traffic for N = ${channels}</th><th>Trunk efficiency (carried/N)</th><th>Users supported</th></tr></thead><tbody>${gosRows}</tbody></table></div>
      <div class="analysis-readouts">${readout('Traffic per user', `${fmt(c.callsPerHour * c.holding / 3600 * 1000, 4)} mE`)}${readout('Offered traffic A = U·λ·H', `${fmt(traffic, 5)} erlangs`)}${readout(`Blocking with ${channels} channels (Erlang B)`, `${fmt(blocking * 100, 5)} %`)}${readout('Carried traffic', `${fmt(traffic * (1 - blocking), 5)} E (${fmt(traffic * (1 - blocking) / channels * 100, 4)} % occupancy)`)}${readout(`Channels needed for ${fmt(c.gos * 100, 3)} % blocking`, needed)}${readout('Erlang C (calls queued): P(wait)', wait.stable ? `${fmt(wait.probabilityWait * 100, 5)} %` : 'unstable (A ≥ N)')}${wait.stable ? readout('Mean delay of all calls', `${fmt(wait.meanWait, 4)} s`) : ''}${wait.stable ? readout(`P(wait > ${c.waitLimit} s)`, `${fmt(wait.probabilityWaitLonger * 100, 5)} %`) : ''}<p class="field-help">Erlang B (blocked calls cleared) uses the recursion B(n) = A·B(n−1)/(n + A·B(n−1)), which is exact and stable for thousands of channels; values match the published Erlang-B tables.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'reuse') {
    const plan = reusePlan({ cluster: c.cluster, pathLossExponent: c.exponent, sectoring: c.sectoring, totalChannels: c.totalChannels, cells: c.cells });
    const needed = clusterForSir(c.requiredSir, c.exponent, c.sectoring);
    const rows = clusterSizes(28).map(({ n, i, j }) => { const p = reusePlan({ cluster: n, pathLossExponent: c.exponent, sectoring: c.sectoring, totalChannels: c.totalChannels }); return `<tr class="${n === c.cluster ? 'active' : ''}"><td>${n}</td><td>(${i}, ${j})</td><td>${fmt(p.q, 4)}</td><td>${fmt(p.sirDb, 4)}</td><td>${p.channelsPerCell}</td></tr>`; }).join('');
    const controls = `${labSelect('data-cell-select', 'reuse.cluster', 'Cluster size N', c.cluster, clusterSizes(28).map(({ n, i, j }) => [n, `${n}  (i = ${i}, j = ${j})`]))}${cellField('reuse.exponent', 'Path-loss exponent n', c.exponent)}${labSelect('data-cell-select', 'reuse.sectoring', 'Antennas', c.sectoring, Object.entries(SECTORING).map(([id, s]) => [id, s.label]))}${cellField('reuse.totalChannels', 'Total duplex channels', c.totalChannels)}${cellField('reuse.cells', 'Cells in the area', c.cells)}${cellField('reuse.requiredSir', 'Required S/I', c.requiredSir, 'dB')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">CHANNEL GROUPS (LETTERS); CO-CHANNEL CELLS OF THE CENTRE ARE SOLID, FIRST TIER JOINED</span>${renderHexLayout(plan)}</div>
      <div><div class="analysis-readouts">${readout('Shift parameters (i, j)', `(${plan.i}, ${plan.j}): move i cells, turn 60°, move j cells`)}${readout('Co-channel reuse ratio Q = D/R = √(3N)', fmt(plan.q, 5))}${readout('S/I = Qⁿ / i₀', `${fmt(plan.sirDb, 4)} dB (i₀ = ${SECTORING[c.sectoring].interferers})`)}${plan.worstSirDb !== null ? readout('Worst case at the cell edge (Rappaport 3.9)', `${fmt(plan.worstSirDb, 4)} dB`) : ''}${readout('Channels per cell', `${plan.channelsPerCell}${SECTORING[c.sectoring].sectors > 1 ? ` (${plan.channelsPerSector} per sector)` : ''}`)}${readout('System capacity', `${plan.capacity} channels in ${c.cells} cells`)}${readout(`Smallest N for ${c.requiredSir} dB`, needed ?? 'none up to 400')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>N</th><th>(i, j)</th><th>Q</th><th>S/I dB</th><th>Ch/cell</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'pathloss') {
    const hata = { frequencyMHz: c.frequency, baseHeight: c.baseHeight, mobileHeight: c.mobileHeight, environment: c.environment };
    const margin = fadeMargin(c.sigma, c.coverage);
    const allowed = maxAllowedLoss({ eirpDbm: c.eirp, rxSensitivityDbm: c.sensitivity, rxGainDb: c.rxGain, otherLossDb: c.otherLoss, fadeMarginDb: margin });
    const radius = cellRadius({ ...hata, maxLossDb: allowed });
    const dMax = Math.max(2 * radius, 1);
    const ds = Array.from({ length: 200 }, (_, k) => 0.2 + (dMax - 0.2) * k / 199);
    const controls = `${cellField('pathloss.frequency', 'Frequency', c.frequency, 'MHz')}${cellField('pathloss.baseHeight', 'Base antenna height', c.baseHeight, 'm')}${cellField('pathloss.mobileHeight', 'Mobile height', c.mobileHeight, 'm')}${labSelect('data-cell-select', 'pathloss.environment', 'Environment', c.environment, Object.entries(ENVIRONMENTS))}${cellField('pathloss.eirp', 'Base EIRP', c.eirp, 'dBm')}${cellField('pathloss.sensitivity', 'Mobile sensitivity', c.sensitivity, 'dBm')}${cellField('pathloss.rxGain', 'Mobile antenna gain', c.rxGain, 'dBi')}${cellField('pathloss.otherLoss', 'Body/cable loss', c.otherLoss, 'dB')}${cellField('pathloss.sigma', 'Shadowing σ', c.sigma, 'dB')}${cellField('pathloss.coverage', 'Edge coverage probability', c.coverage)}${cellField('pathloss.exponent', 'Log-distance n', c.exponent)}`;
    const body = `<div class="power-grid"><div>${linePlot('Path loss (dB) against distance (km)', ds, [{ name: `${c.frequency > 1500 ? 'COST-231' : 'Okumura'}–Hata`, values: ds.map((d) => hataLoss({ ...hata, distanceKm: d })) }, { name: 'free space', values: ds.map((d) => freeSpaceLoss(c.frequency, d)) }, { name: `log-distance n = ${c.exponent}`, values: ds.map((d) => logDistanceLoss({ frequencyMHz: c.frequency, distanceKm: d, exponent: c.exponent })) }, { name: 'maximum allowed', values: ds.map(() => allowed), color: '#ef4444', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}</div>
      <div class="analysis-readouts">${readout('Model', c.frequency > 1500 ? 'COST-231 Hata (1500–2000 MHz)' : 'Okumura–Hata (150–1500 MHz)')}${readout('Mobile antenna correction a(hm)', `${fmt(hataMobileCorrection(c.frequency, c.mobileHeight, c.environment === 'urban-large' ? 'large' : 'medium'), 4)} dB`)}${readout('Loss at 1 km', `${fmt(hataLoss({ ...hata, distanceKm: 1 }), 5)} dB`)}${readout('Slope', `${fmt(44.9 - 6.55 * Math.log10(c.baseHeight), 4)} dB/decade`)}${readout(`Fade margin for ${fmt(c.coverage * 100, 3)} % at the edge`, `${fmt(margin, 4)} dB`)}${readout('Maximum allowed path loss', `${fmt(allowed, 5)} dB`)}${readout('Cell radius', `${fmt(radius, 4)} km`)}${readout('Cell area (hexagon 2.6 R²)', `${fmt(2.598 * radius * radius, 4)} km²`)}<p class="field-help">Validity: f 150–2000 MHz, base 30–200 m, mobile 1–10 m, d 1–20 km. ${c.frequency < 150 || c.frequency > 2000 ? '<b>Frequency outside the model range.</b>' : ''}</p></div></div>`;
    return { controls, body };
  }
  const sim = simulateHandoff({ separation: c.separation, txPowerDbm: c.txPower, exponent: c.exponent, sigmaDb: c.sigma, decorrelationM: c.decorrelation, hysteresisDb: c.hysteresis, timeToTriggerM: c.ttt, thresholdDbm: c.threshold, seed: Math.round(c.seed) });
  const serving = sim.serving.map((s, k) => (s === 'A' ? sim.powerA[k] : sim.powerB[k]));
  const controls = `${cellField('handoff.separation', 'Distance between base stations', c.separation, 'km')}${cellField('handoff.txPower', 'Base transmit power', c.txPower, 'dBm')}${cellField('handoff.exponent', 'Path-loss exponent', c.exponent)}${cellField('handoff.sigma', 'Shadowing σ', c.sigma, 'dB')}${cellField('handoff.decorrelation', 'Decorrelation distance', c.decorrelation, 'm')}${cellField('handoff.hysteresis', 'Hysteresis margin', c.hysteresis, 'dB')}${cellField('handoff.ttt', 'Time-to-trigger distance', c.ttt, 'm')}${cellField('handoff.threshold', 'Minimum usable level', c.threshold, 'dBm')}${cellField('handoff.seed', 'Random seed', c.seed)}`;
  const body = `<div class="power-grid"><div>${linePlot('Received power (dBm) along the road (km)', sim.positions, [{ name: 'from BS A', values: sim.powerA }, { name: 'from BS B', values: sim.powerB }, { name: 'serving cell', values: serving, color: '#facc15' }, { name: 'minimum level', values: sim.positions.map(() => c.threshold), color: '#ef4444', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}</div>
    <div class="analysis-readouts">${readout('Handoffs', sim.handoffs)}${readout('Ping-pong handoffs (back within 200 m)', sim.pingPong)}${readout('Handoff points', sim.events.map((event) => `${fmt(event.position, 4)} km → ${event.to}`).join(', ') || 'none')}${readout('Without shadowing the handoff happens at', `${fmt(idealHandoffPoint({ separation: c.separation, exponent: c.exponent, hysteresisDb: c.hysteresis }), 4)} km`)}${readout('Below the minimum level', `${fmt(sim.outageFraction * 100, 4)} % of the route`)}<p class="field-help">Shadowing is log-normal with Gudmundson's exponential correlation. Raise the hysteresis or the time-to-trigger and watch ping-pong handoffs disappear — at the price of staying longer on the weaker cell.</p></div></div>`;
  return { controls, body };
}

function renderCellular(state) {
  const config = cellLab.configuration(state);
  let view;
  try { view = renderCellularTab(config); } catch (error) { view = { controls: '', body: labError('cell', 'Cellular planning', error) }; }
  return `<div class="page scroll-page power-page sigsys-page cellular-page">${pageHeader(modules.find((item) => item.id === 'cellular'), 'CELLULAR NETWORK PLANNING', '')}${labTabs(CELL_TABS, config.tab, 'data-cell-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindCellularEvents() { bindLabControls('cell', cellLab, ['sectoring', 'environment']); }

// ---------------------------------------------------------------------------
// Cryptography lab.

const CRYPTO_TABS = [['classical', 'Classical ciphers'], ['numbers', 'Modular arithmetic'], ['rsa', 'RSA'], ['dh', 'Diffie–Hellman'], ['aes', 'AES'], ['des', 'DES'], ['sha', 'SHA-256 & HMAC']];
const cryptoLab = makeLab('crypto-lab', {
  tab: 'classical',
  classical: { cipher: 'playfair', mode: 'encrypt', text: 'hide the gold in the tree stump', key: 'playfair example', shift: 3, rails: 3, matrix: '3 3\n2 5', keyLength: 4 },
  numbers: { a: '240', b: '46', base: '4', exponent: '13', modulus: '497', prime: '561', remainders: '2 3 2', moduli: '3 5 7' },
  rsa: { source: 'manual', p: '61', q: '53', e: '17', bits: 512, seed: 1, message: 'HI ENTC', number: '65' },
  dh: { p: '23', g: '5', a: '6', b: '15', mitm: 'no', eveA: '3', eveB: '7' },
  aes: { key: '2b7e151628aed2a6abf7158809cf4f3c', block: '3243f6a8885a308d313198a2e0370734', round: 1 },
  des: { key: '133457799bbcdff1', block: '0123456789abcdef', round: 1, mode: 'encrypt' },
  sha: { message: 'abc', block: 0, hmacKey: 'key' },
});
const cryptoText = (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-cr-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-cr-text="${path}" value="${esc(value)}"></label>`);
const cryptoField = (...args) => groupField('data-cr-field')(...args);
const big = (value) => esc(value.toString());
const hexByte = (b) => b.toString(16).padStart(2, '0');
const stateGrid = (bytes, title) => `<div class="aes-state"><span>${title}</span><table>${[0, 1, 2, 3].map((r) => `<tr>${[0, 1, 2, 3].map((c) => `<td>${hexByte(bytes[r + 4 * c])}</td>`).join('')}</tr>`).join('')}</table></div>`;
const shortBig = (value) => { const text = value.toString(); return text.length > 60 ? `${text.slice(0, 28)}…${text.slice(-28)} (${text.length} digits)` : text; };
const euclidTable = (rows) => `<table class="truth-table comm-table power-table"><thead><tr><th>q</th><th>r</th><th>s</th><th>t</th></tr></thead><tbody>${rows.slice(0, 40).map((row) => `<tr><td>${row.q === null ? '' : big(row.q)}</td><td>${esc(shortBig(row.r))}</td><td>${esc(shortBig(row.s))}</td><td>${esc(shortBig(row.t))}</td></tr>`).join('')}</tbody></table>`;
const powerTable = (steps, base) => `<table class="truth-table comm-table power-table"><thead><tr><th>Bit</th><th>Square</th><th>× ${esc(shortBig(base))}?</th><th>Result</th></tr></thead><tbody>${steps.slice(0, 64).map((step) => `<tr><td>${step.bit}</td><td>${esc(shortBig(step.squared))}</td><td>${step.bit ? 'yes' : '—'}</td><td>${esc(shortBig(step.result))}</td></tr>`).join('')}</tbody></table>${steps.length > 64 ? `<p class="field-help">First 64 of ${steps.length} steps.</p>` : ''}`;

function renderClassical(c) {
  const decrypt = c.mode === 'decrypt';
  const common = `${labSelect('data-cr-select', 'classical.cipher', 'Cipher', c.cipher, [['caesar', 'Caesar'], ['vigenere', 'Vigenère'], ['playfair', 'Playfair'], ['hill', 'Hill'], ['rail', 'Rail fence']])}${labSelect('data-cr-select', 'classical.mode', 'Direction', c.mode, [['encrypt', 'Encrypt'], ['decrypt', 'Decrypt']])}${cryptoText('classical.text', 'Text', c.text, 3)}`;
  if (c.cipher === 'caesar') {
    const output = caesar(c.text, decrypt ? -c.shift : c.shift);
    const ranked = crackCaesar(decrypt ? c.text : output).slice(0, 5);
    const counts = letterCounts(output), total = counts.reduce((s, v) => s + v, 0) || 1;
    const letters = Array.from({ length: 26 }, (_, i) => i);
    return { controls: `${common}${cryptoField('classical.shift', 'Shift', c.shift)}`, body: `<div class="power-grid"><div>${readout('Output', output)}${renderPlotFrame({ title: 'Letter frequencies of the output (bars) against English (dots)', series: [{ xs: letters, ys: counts.map((v) => v / total), color: PLOT_COLORS[0], stem: true }, { xs: letters, ys: ENGLISH_FREQUENCIES, color: '#f59e0b', stem: true }], xMin: 0, xMax: 25, xTicks: [0, 5, 10, 15, 20, 25].map((i) => ({ position: i / 25, text: String.fromCharCode(65 + i) })), yRange: niceRange(0, 0.15), formatY: (v) => `${fmt(v * 100, 2)} %` })}</div>
      <div><span class="panel-label">BREAKING IT: ALL 26 SHIFTS RANKED BY χ² AGAINST ENGLISH</span><table class="truth-table comm-table power-table"><thead><tr><th>Key</th><th>χ²</th><th>Plaintext guess</th></tr></thead><tbody>${ranked.map((r) => `<tr><td>${r.key}</td><td>${fmt(r.score, 4)}</td><td>${esc(r.plain.slice(0, 60))}</td></tr>`).join('')}</tbody></table></div></div>` };
  }
  if (c.cipher === 'vigenere') {
    const result = vigenere(c.text, c.key, decrypt);
    const ciphertext = decrypt ? c.text : result.output, ioc = indexOfCoincidence(ciphertext);
    const crack = lettersOnly(ciphertext).length >= 4 * c.keyLength ? crackVigenere(ciphertext, Math.max(1, Math.round(c.keyLength))) : null;
    return { controls: `${common}${cryptoText('classical.key', 'Key', c.key)}${cryptoField('classical.keyLength', 'Key length to try when breaking', c.keyLength)}`, body: `<div class="power-grid"><div>${readout('Output', result.output)}<table class="truth-table comm-table power-table"><thead><tr><th>Input</th>${result.steps.slice(0, 24).map((s) => `<th>${s.input}</th>`).join('')}</tr></thead><tbody><tr><td>Key</td>${result.steps.slice(0, 24).map((s) => `<td>${s.key}</td>`).join('')}</tr><tr><td>Output</td>${result.steps.slice(0, 24).map((s) => `<td>${s.output}</td>`).join('')}</tr></tbody></table></div>
      <div class="analysis-readouts">${readout('Index of coincidence of the ciphertext', `${fmt(ioc.ic, 5)} (English ≈ 0.0667, random ≈ 0.0385)`)}${readout('Friedman key-length estimate', ioc.friedman === null ? '—' : fmt(ioc.friedman, 3))}${crack ? readout(`Key found for length ${c.keyLength} (column-wise χ²)`, crack.key) : ''}${crack ? readout('Plaintext with that key', crack.plain.slice(0, 120)) : ''}</div></div>` };
  }
  if (c.cipher === 'playfair') {
    const result = playfair(c.text, c.key, decrypt);
    return { controls: `${common}${cryptoText('classical.key', 'Keyword', c.key)}`, body: `<div class="power-grid"><div><span class="panel-label">KEY SQUARE (I = J)</span><table class="playfair-grid">${result.square.map((row) => `<tr>${row.map((ch) => `<td>${ch}</td>`).join('')}</tr>`).join('')}</table>${readout('Output', result.output)}</div>
      <div><table class="truth-table comm-table power-table"><thead><tr><th>Pair</th><th>Rule</th><th>Result</th></tr></thead><tbody>${result.steps.map((s) => `<tr><td>${s.pair}</td><td>${s.rule}</td><td>${s.out}</td></tr>`).join('')}</tbody></table><p class="field-help">Same row: take the letter to the ${decrypt ? 'left' : 'right'}; same column: the letter ${decrypt ? 'above' : 'below'}; otherwise the corners of the rectangle on the same rows. Doubled letters are split with X.</p></div></div>` };
  }
  if (c.cipher === 'hill') {
    const matrix = String(c.matrix).trim().split('\n').map((line) => line.trim().split(/[\s,]+/).map(Number));
    const result = hill(c.text, matrix, decrypt);
    const showMatrix = (m) => `<table class="playfair-grid">${m.map((row) => `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`;
    return { controls: `${common}${cryptoText('classical.matrix', 'Key matrix (rows)', c.matrix, 3)}`, body: `<div class="power-grid"><div><div class="hill-row"><div><span class="panel-label">KEY K</span>${showMatrix(matrix)}</div><div><span class="panel-label">K⁻¹ MOD 26</span>${showMatrix(result.inverse)}</div></div>${readout('det K mod 26', `${result.det} (inverse ${result.detInverse})`)}${readout('Output', result.output)}</div>
      <div><table class="truth-table comm-table power-table"><thead><tr><th>Block</th><th>Vector</th><th>${decrypt ? 'K⁻¹' : 'K'}·v</th><th>mod 26</th><th>Out</th></tr></thead><tbody>${result.blocks.slice(0, 30).map((b) => `<tr><td>${b.input}</td><td>(${b.vector.join(', ')})</td><td>(${b.product.join(', ')})</td><td>(${b.result.join(', ')})</td><td>${b.output}</td></tr>`).join('')}</tbody></table></div></div>` };
  }
  const result = railFence(c.text, Math.max(1, Math.round(c.rails)), decrypt);
  return { controls: `${common}${cryptoField('classical.rails', 'Rails', c.rails)}`, body: `<div>${readout('Output', result.output)}<div class="gantt-scroll"><table class="rail-grid">${result.grid.map((row) => `<tr>${row.map((ch) => `<td>${esc(ch)}</td>`).join('')}</tr>`).join('')}</table></div><p class="field-help">The text is written in a zig-zag across the rails and read off rail by rail.</p></div>` };
}

function renderCryptoTab(config) {
  const c = config[config.tab];
  if (config.tab === 'classical') return renderClassical(c);
  if (config.tab === 'numbers') {
    const euclid = extendedEuclid(c.a, c.b);
    let inverse = null; try { inverse = modInverse(c.a, c.b).inverse; } catch { inverse = null; }
    const power = modPow(c.base, c.exponent, c.modulus);
    const mr = millerRabin(c.prime);
    const remainders = String(c.remainders).trim().split(/[\s,]+/), moduli = String(c.moduli).trim().split(/[\s,]+/);
    let chinese; try { chinese = crt(remainders, moduli); } catch (error) { chinese = { error: error.message }; }
    const controls = `${cryptoText('numbers.a', 'a', c.a)}${cryptoText('numbers.b', 'b (modulus for the inverse)', c.b)}${cryptoText('numbers.base', 'Base', c.base)}${cryptoText('numbers.exponent', 'Exponent', c.exponent)}${cryptoText('numbers.modulus', 'Modulus', c.modulus)}${cryptoText('numbers.prime', 'Primality test n', c.prime)}${cryptoText('numbers.remainders', 'CRT remainders', c.remainders)}${cryptoText('numbers.moduli', 'CRT moduli', c.moduli)}`;
    const body = `<div class="power-grid"><div><span class="panel-label">EXTENDED EUCLID (s·a + t·b = r ON EVERY ROW)</span>${euclidTable(euclid.rows)}${readout('gcd(a, b)', big(euclid.gcd))}${readout('Bézout', `${shortBig(euclid.x)}·${shortBig(BigInt(c.a))} + ${shortBig(euclid.y)}·${shortBig(BigInt(c.b))} = ${big(euclid.gcd)}`)}${readout('a⁻¹ mod b', inverse === null ? 'none (gcd ≠ 1)' : big(inverse))}
      <span class="panel-label">SQUARE-AND-MULTIPLY: ${esc(c.base)}^${esc(c.exponent)} MOD ${esc(c.modulus)} (EXPONENT ${esc(power.bits ?? '')}₂)</span>${powerTable(power.steps, BigInt(c.base))}${readout('Result', big(power.result))}</div>
      <div><span class="panel-label">MILLER–RABIN ON ${esc(c.prime)}</span>${readout('Verdict', mr.prime ? `probably prime${mr.deterministic ? ' (deterministic for this size)' : ''}` : `composite — witness ${mr.witness}`)}<table class="truth-table comm-table power-table"><thead><tr><th>Base a</th><th>a^d, then squarings</th><th>Passes</th></tr></thead><tbody>${mr.trace.map((t) => `<tr><td>${big(t.base)}</td><td>${t.divides ? 'divides n' : esc(t.sequence.map(shortBig).join(' → '))}</td><td>${t.divides ? 'no' : t.passes ? 'yes' : 'no'}</td></tr>`).join('')}</tbody></table><p class="field-help">n − 1 = 2^s·d with d odd. n passes for base a if a^d ≡ 1 or some a^(2^r·d) ≡ −1 (mod n).</p>
      <span class="panel-label">CHINESE REMAINDER THEOREM</span>${chinese.error ? `<p class="field-help">${esc(chinese.error)}</p>` : `<table class="truth-table comm-table power-table"><thead><tr><th>mᵢ</th><th>Mᵢ = M/mᵢ</th><th>Mᵢ⁻¹ mod mᵢ</th><th>rᵢ·Mᵢ·Mᵢ⁻¹</th></tr></thead><tbody>${chinese.terms.map((t) => `<tr><td>${big(t.mi)}</td><td>${big(t.Mi)}</td><td>${big(t.inverse)}</td><td>${big(t.term)}</td></tr>`).join('')}</tbody></table>${readout('x', `${big(chinese.x)} (mod ${big(chinese.modulus)})`)}`}</div></div>`;
    return { controls, body };
  }
  if (config.tab === 'rsa') {
    const key = c.source === 'generate' ? generateRsa(Math.min(2048, Math.max(32, Math.round(c.bits))), Math.round(c.seed)) : rsaKey(c.p, c.q, c.e);
    const small = key.n < 256n;
    const blocks = small ? { blocks: [toBig(c.number)], blockBytes: 0, lastBytes: 0 } : textToBlocks(c.message, key.n);
    const cipher = blocks.blocks.map((m) => rsaEncrypt(m, key));
    const plain = cipher.map((block) => rsaDecrypt(block.result, key));
    const recovered = small ? plain[0].plain.toString() : blocksToText(plain.map((p) => p.crt.m), blocks.blockBytes, blocks.lastBytes);
    const digest = toBig(`0x${sha256(c.message, { record: false }).digest}`) % key.n;
    const signature = modPow(digest, key.d, key.n, { record: false }).result, check = modPow(signature, key.e, key.n, { record: false }).result;
    const controls = `${labSelect('data-cr-select', 'rsa.source', 'Key', c.source, [['manual', 'Choose p, q, e'], ['generate', 'Generate']])}${c.source === 'generate' ? `${cryptoField('rsa.bits', 'Modulus size', c.bits, 'bits')}${cryptoField('rsa.seed', 'Seed', c.seed)}` : `${cryptoText('rsa.p', 'p', c.p)}${cryptoText('rsa.q', 'q', c.q)}${cryptoText('rsa.e', 'e', c.e)}`}${small ? cryptoText('rsa.number', 'Message number m < n', c.number) : cryptoText('rsa.message', 'Message text', c.message)}`;
    const body = `<div class="power-grid"><div><div class="analysis-readouts">${readout('n = p·q', `${shortBig(key.n)} (${key.bits} bits)`)}${readout('φ(n) = (p − 1)(q − 1)', shortBig(key.phi))}${readout('Public key (e, n)', `e = ${shortBig(key.e)}`)}${readout('Private exponent d = e⁻¹ mod φ(n)', shortBig(key.d))}${readout('CRT values dp, dq, q⁻¹ mod p', `${shortBig(key.dp)}, ${shortBig(key.dq)}, ${shortBig(key.qInverse)}`)}</div><span class="panel-label">FINDING d WITH EXTENDED EUCLID ON (e, φ)</span>${euclidTable(key.euclid)}</div>
      <div><span class="panel-label">ENCRYPTING ${small ? 'm' : 'BLOCK 1'}: c = m^e MOD n</span>${powerTable(cipher[0].steps, blocks.blocks[0])}<div class="analysis-readouts">${readout(small ? 'm' : `Message as ${blocks.blocks.length} block(s) of ${blocks.blockBytes} bytes`, blocks.blocks.map(shortBig).join(', '))}${readout('Ciphertext', cipher.map((block) => shortBig(block.result)).join(', '))}${readout('CRT decryption of block 1', `m₁ = ${shortBig(plain[0].crt.m1)}, m₂ = ${shortBig(plain[0].crt.m2)}, h = ${shortBig(plain[0].crt.h)} → m = ${shortBig(plain[0].crt.m)}`)}${readout('Recovered', recovered)}${readout('Signature s = H(m)^d mod n (H = SHA-256 mod n)', shortBig(signature))}${readout('Verify s^e mod n = H(m)', check === digest ? 'valid ✓' : 'invalid')}</div><p class="field-help">Textbook RSA without padding, for learning; real systems use OAEP/PSS padding and 2048-bit or larger keys.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'dh') {
    const result = diffieHellman({ p: c.p, g: c.g, a: c.a, b: c.b, eveA: c.mitm === 'yes' ? c.eveA : null, eveB: c.mitm === 'yes' ? c.eveB : null });
    let attack = null;
    try { if (result.p < 10n ** 12n) attack = discreteLog(result.g, result.A, result.p); } catch { attack = null; }
    const controls = `${cryptoText('dh.p', 'Prime p', c.p)}${cryptoText('dh.g', 'Generator g', c.g)}${cryptoText('dh.a', 'Alice secret a', c.a)}${cryptoText('dh.b', 'Bob secret b', c.b)}${labSelect('data-cr-select', 'dh.mitm', 'Man in the middle', c.mitm, [['no', 'No'], ['yes', 'Eve intercepts']])}${c.mitm === 'yes' ? `${cryptoText('dh.eveA', 'Eve secret e₁ (to Bob)', c.eveA)}${cryptoText('dh.eveB', 'Eve secret e₂ (to Alice)', c.eveB)}` : ''}`;
    const body = `<div class="power-grid"><div><div class="dh-flow"><div><b>Alice</b><span>secret a = ${esc(c.a)}</span><span>A = g^a mod p = ${big(result.A)}</span><span>K = B^a = ${big(result.kAlice)}</span></div><div class="dh-wire"><span>p = ${esc(shortBig(result.p))}, g = ${esc(c.g)}</span><span>A → ${result.mitm ? `(Eve swaps for ${big(result.mitm.E1)})` : ''}</span><span>← B ${result.mitm ? `(Eve swaps for ${big(result.mitm.E2)})` : ''}</span></div><div><b>Bob</b><span>secret b = ${esc(c.b)}</span><span>B = g^b mod p = ${big(result.B)}</span><span>K = A^b = ${big(result.kBob)}</span></div></div>
      <span class="panel-label">ALICE COMPUTES A = g^a MOD p</span>${powerTable(result.aliceSteps, result.g)}</div>
      <div class="analysis-readouts">${readout('Shared secret', result.agree ? `${shortBig(result.kAlice)} — both sides agree` : 'mismatch')}${readout('Is g a primitive root mod p?', result.primitive === null ? 'p − 1 too large to factor here' : result.primitive ? 'yes — g generates all of 1 … p − 1' : 'no — g generates a smaller subgroup')}${result.mitm ? `${readout('With Eve: Alice\'s key', `${shortBig(result.mitm.aliceKey)} = Eve's key with Alice ${shortBig(result.mitm.eveWithAlice)}`)}${readout('With Eve: Bob\'s key', `${shortBig(result.mitm.bobKey)} = Eve's key with Bob ${shortBig(result.mitm.eveWithBob)}`)}${readout('Lesson', 'unauthenticated DH lets Eve read and re-encrypt everything — sign the exchange')}` : ''}${attack ? readout('Eve recovers a from A by baby-step giant-step', `a = ${big(attack.x)} after ${attack.operations} multiplications (√p work) — use a large p`) : readout('Discrete-log attack', 'p too large for baby-step giant-step here')}</div></div>`;
    return { controls, body };
  }
  if (config.tab === 'aes') {
    const key = hexToBytes(c.key), block = hexToBytes(c.block);
    const result = aesEncryptBlock(block, key);
    const nr = result.keySchedule.nr, round = Math.min(nr, Math.max(0, Math.round(c.round))), r = result.rounds[round];
    const steps = round === 0 ? `${stateGrid(r.input, 'Plaintext')}${stateGrid(r.roundKey, '⊕ Round key 0')}${stateGrid(r.end, '= State')}` : `${stateGrid(r.start, 'Start')}${stateGrid(r.afterSub, 'SubBytes')}${stateGrid(r.afterShift, 'ShiftRows')}${r.afterMix ? stateGrid(r.afterMix, 'MixColumns') : ''}${stateGrid(r.roundKey, `Round key ${round}`)}${stateGrid(r.end, 'AddRoundKey')}`;
    const words = result.keySchedule.words;
    const controls = `${cryptoText('aes.key', `Key (hex, ${key.length * 8} bits)`, c.key)}${cryptoText('aes.block', 'Plaintext block (16 bytes hex)', c.block)}<label>Round ${round} of ${nr}<input type="range" min="0" max="${nr}" step="1" data-cr-range="aes.round" value="${round}"></label>`;
    const body = `<div class="power-grid"><div><span class="panel-label">ROUND ${round}${round === nr ? ' (NO MIXCOLUMNS IN THE LAST ROUND)' : ''}</span><div class="aes-steps">${steps}</div>${readout('Ciphertext', bytesToHex(result.output))}${readout('Decrypts back to', bytesToHex(aesDecryptBlock(result.output, key).output))}</div>
      <div><span class="panel-label">KEY EXPANSION (${words.length} WORDS)</span><div class="gantt-scroll aes-words"><table class="truth-table comm-table power-table"><thead><tr><th>i</th><th>w[i]</th><th>Note</th></tr></thead><tbody>${words.map((w, i) => `<tr class="${Math.floor(i / 4) === round ? 'active' : ''}"><td>${i}</td><td>${bytesToHex(w)}</td><td>${result.keySchedule.notes.find((n) => n.index === i)?.note ?? (i < key.length / 4 ? 'key' : '')}</td></tr>`).join('')}</tbody></table></div><p class="field-help">The state is filled column by column. Values match FIPS 197 appendix B and node:crypto.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'des') {
    const result = desBlock(hexToBytes(c.block), hexToBytes(c.key), c.mode === 'decrypt');
    const round = Math.min(16, Math.max(1, Math.round(c.round))), r = result.rounds[round - 1];
    const controls = `${cryptoText('des.key', 'Key (8 bytes hex)', c.key)}${cryptoText('des.block', 'Block (8 bytes hex)', c.block)}${labSelect('data-cr-select', 'des.mode', 'Direction', c.mode, [['encrypt', 'Encrypt'], ['decrypt', 'Decrypt']])}<label>Show S-boxes of round ${round}<input type="range" min="1" max="16" step="1" data-cr-range="des.round" value="${round}"></label>`;
    const body = `<div class="power-grid"><div><table class="truth-table comm-table power-table"><thead><tr><th>Round</th><th>L</th><th>R</th><th>Subkey K</th><th>f(R, K)</th><th>L ⊕ f</th></tr></thead><tbody>${result.rounds.map((row) => `<tr class="${row.round === round ? 'active' : ''}"><td>${row.round}</td><td>${row.left}</td><td>${row.right}</td><td>${row.subkey}</td><td>${row.f}</td><td>${row.newRight}</td></tr>`).join('')}</tbody></table>${readout('After initial permutation', result.initialPermutation)}${readout('Output (after swap and IP⁻¹)', bytesToHex(result.output))}</div>
      <div><span class="panel-label">ROUND ${round}: E(R) = ${r.expanded} ⊕ K → EIGHT S-BOXES</span><table class="truth-table comm-table power-table"><thead><tr><th>S-box</th><th>6 input bits</th><th>Row (outer bits)</th><th>Column (middle 4)</th><th>Output</th></tr></thead><tbody>${r.sboxes.map((s) => `<tr><td>S${s.box}</td><td>${s.input}</td><td>${s.row}</td><td>${s.col}</td><td>${s.value} = ${s.value.toString(2).padStart(4, '0')}</td></tr>`).join('')}</tbody></table><p class="field-help">The 32 S-box output bits go through P to give f. Decryption runs the same network with the subkeys reversed. Results match the classic worked example and PyCryptodome.</p></div></div>`;
    return { controls, body };
  }
  const result = sha256(c.message);
  const blockIndex = Math.min(result.blocks.length - 1, Math.max(0, Math.round(c.block))), b = result.blocks[blockIndex];
  const word = (v) => (v >>> 0).toString(16).padStart(8, '0');
  const controls = `${cryptoText('sha.message', 'Message (UTF-8)', c.message, 3)}${result.blocks.length > 1 ? `<label>Block ${blockIndex + 1} of ${result.blocks.length}<input type="range" min="0" max="${result.blocks.length - 1}" step="1" data-cr-range="sha.block" value="${blockIndex}"></label>` : ''}${cryptoText('sha.hmacKey', 'HMAC key', c.hmacKey)}`;
  const body = `<div class="power-grid"><div><div class="analysis-readouts">${readout('SHA-256', result.digest)}${readout('Message length', `${result.bitLength} bits → padded to ${result.padded.length * 8} bits (${result.padded.length / 64} block${result.padded.length > 64 ? 's' : ''})`)}${readout('HMAC-SHA-256(key, message)', hmacSha256(c.hmacKey, c.message))}</div>
    <span class="panel-label">PADDED MESSAGE (1 BIT, ZEROS, 64-BIT LENGTH)</span><div class="hex-dump">${bytesToHex(result.padded.slice(0, 256)).match(/.{1,32}/g).join('<br>')}</div>
    <span class="panel-label">MESSAGE SCHEDULE W[0…63] OF BLOCK ${blockIndex + 1}</span><div class="hex-dump">${b.w.map(word).join(' ')}</div></div>
    <div><span class="panel-label">COMPRESSION ROUNDS (a … h AFTER EACH ROUND)</span><div class="gantt-scroll aes-words"><table class="truth-table comm-table power-table sha-rounds"><thead><tr><th>t</th>${'abcdefgh'.split('').map((ch) => `<th>${ch}</th>`).join('')}</tr></thead><tbody>${b.rounds.map((row, t) => `<tr><td>${t}</td>${row.map((v) => `<td>${word(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="field-help">K and the initial H are the fractional parts of cube and square roots of the first primes. Digests match node:crypto.</p></div></div>`;
  return { controls, body };
}

function renderCrypto(state) {
  const config = cryptoLab.configuration(state);
  let view;
  try { view = renderCryptoTab(config); } catch (error) { view = { controls: '', body: labError('cr', 'Cryptography', error) }; }
  return `<div class="page scroll-page power-page sigsys-page crypto-page">${pageHeader(modules.find((item) => item.id === 'crypto'), 'CRYPTOGRAPHY STEP BY STEP', '')}${labTabs(CRYPTO_TABS, config.tab, 'data-cr-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindCryptoEvents() {
  bindLabControls('cr', cryptoLab, ['cipher', 'mode', 'source', 'mitm']);
  document.querySelectorAll('[data-cr-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.crText.split('.'); cryptoLab.persist((config) => { config[group][key] = input.value; }); }));
  document.querySelectorAll('[data-cr-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.crRange.split('.'); cryptoLab.persist((config) => { config[group][key] = Number(input.value); }); }));
}

// ---------------------------------------------------------------------------
// Wireless sensor networks.

const WSN_TABS = [['deploy', 'Deployment, connectivity & coverage'], ['lifetime', 'Energy & lifetime (LEACH)']];
const wsnLab = makeLab('wsn-lab', {
  tab: 'deploy',
  deploy: { nodes: 100, width: 100, height: 100, layout: 'random', seed: 3, range: 20, sensing: 10, sinkX: 50, sinkY: 50, k: 2 },
  lifetime: { nodes: 100, width: 100, height: 100, seed: 3, sinkX: 50, sinkY: 175, energy: 0.5, p: 0.05, packet: 4000, round: 100 },
});
const wsnField = (...args) => groupField('data-wsn-field')(...args);
let wsnCache = { key: null, value: null };

function wsnMap(field, { links = [], heads = [], members = null, next = null, coverageCells = null, sensing = 0, energy = null, initial = 1 }) {
  const size = 420, scale = size / Math.max(field.width, field.height, field.sink.y + 5, field.sink.x + 5), w = Math.max(field.width, field.sink.x + 5) * scale, h = Math.max(field.height, field.sink.y + 5) * scale;
  const X = (x) => (x * scale).toFixed(1), Y = (y) => (h - y * scale).toFixed(1);
  const parts = [`<rect class="wsn-field" x="0" y="${(h - field.height * scale).toFixed(1)}" width="${(field.width * scale).toFixed(1)}" height="${(field.height * scale).toFixed(1)}"/>`];
  if (coverageCells) {
    const n = coverageCells.resolution, cw = field.width * scale / n, ch = field.height * scale / n;
    coverageCells.cells.forEach((count, index) => { if (!count) parts.push(`<rect class="wsn-hole" x="${(Math.floor(index / n) * cw).toFixed(1)}" y="${(h - (index % n + 1) * ch).toFixed(1)}" width="${(cw + 0.3).toFixed(1)}" height="${(ch + 0.3).toFixed(1)}"/>`); });
  }
  if (sensing) for (const node of field.nodes) parts.push(`<circle class="wsn-sense" cx="${X(node.x)}" cy="${Y(node.y)}" r="${(sensing * scale).toFixed(1)}"/>`);
  for (const [a, b] of links) parts.push(`<line class="wsn-link" x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(b.x)}" y2="${Y(b.y)}"/>`);
  if (members) for (const [head, list] of Object.entries(members)) for (const m of list) parts.push(`<line class="wsn-member" x1="${X(field.nodes[m].x)}" y1="${Y(field.nodes[m].y)}" x2="${X(field.nodes[head].x)}" y2="${Y(field.nodes[head].y)}"/>`);
  if (members) for (const head of Object.keys(members)) parts.push(`<line class="wsn-uplink" x1="${X(field.nodes[head].x)}" y1="${Y(field.nodes[head].y)}" x2="${X(field.sink.x)}" y2="${Y(field.sink.y)}"/>`);
  if (next) next.forEach((hop, i) => { if (hop >= 0 && (!energy || energy[i] > 0)) parts.push(`<line class="wsn-member" x1="${X(field.nodes[i].x)}" y1="${Y(field.nodes[i].y)}" x2="${X(field.nodes[hop].x)}" y2="${Y(field.nodes[hop].y)}"/>`); });
  for (const node of field.nodes) {
    const dead = energy && energy[node.id] <= 0, level = energy ? Math.max(0, energy[node.id]) / initial : 1;
    parts.push(`<circle class="wsn-node${heads.includes(node.id) ? ' head' : ''}${dead ? ' dead' : ''}" cx="${X(node.x)}" cy="${Y(node.y)}" r="${heads.includes(node.id) ? 5 : 3.2}" style="fill-opacity:${dead ? 1 : (0.35 + 0.65 * level).toFixed(2)}"/>`);
  }
  parts.push(`<rect class="wsn-sink" x="${(Number(X(field.sink.x)) - 6).toFixed(1)}" y="${(Number(Y(field.sink.y)) - 6).toFixed(1)}" width="12" height="12"/><text class="wsn-label" x="${(Number(X(field.sink.x)) + 9).toFixed(1)}" y="${(Number(Y(field.sink.y)) + 4).toFixed(1)}">sink</text>`);
  return `<svg class="wsn-map" viewBox="-8 -8 ${(w + 16).toFixed(0)} ${(h + 16).toFixed(0)}" role="img" aria-label="Sensor field">${parts.join('')}</svg>`;
}

function renderWsnTab(config) {
  const c = config[config.tab];
  if (config.tab === 'deploy') {
    const field = deploy({ nodes: Math.min(500, Math.max(2, Math.round(c.nodes))), width: c.width, height: c.height, seed: Math.round(c.seed), layout: c.layout, sink: { x: c.sinkX, y: c.sinkY } });
    const conn = connectivity(field, c.range), cov = coverage(field, c.sensing, { k: Math.max(1, Math.round(c.k)), resolution: 60 });
    const links = [];
    conn.neighbours.forEach((list, i) => list.forEach((j) => { if (j > i) links.push([field.nodes[i], field.nodes[j]]); }));
    const hopCounts = conn.hops.filter(Number.isFinite);
    const histogram = Array.from({ length: Math.max(1, conn.maxHops) }, (_, k) => hopCounts.filter((hop) => hop === k + 1).length);
    const controls = `${wsnField('deploy.nodes', 'Nodes', c.nodes)}${wsnField('deploy.width', 'Field width', c.width, 'm')}${wsnField('deploy.height', 'Field height', c.height, 'm')}${labSelect('data-wsn-select', 'deploy.layout', 'Placement', c.layout, [['random', 'Random (uniform)'], ['grid', 'Grid']])}${wsnField('deploy.seed', 'Seed', c.seed)}${wsnField('deploy.range', 'Radio range', c.range, 'm')}${wsnField('deploy.sensing', 'Sensing range', c.sensing, 'm')}${wsnField('deploy.k', 'k for k-coverage', c.k)}${wsnField('deploy.sinkX', 'Sink x', c.sinkX, 'm')}${wsnField('deploy.sinkY', 'Sink y', c.sinkY, 'm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">RADIO LINKS, SENSING DISCS AND UNCOVERED SPOTS (RED)</span>${wsnMap(field, { links, coverageCells: cov, sensing: c.sensing })}</div>
      <div><div class="analysis-readouts">${readout('Nodes reaching the sink (multi-hop)', `${conn.reachable} of ${field.nodes.length} (${fmt(conn.connectedFraction * 100, 4)} %)`)}${readout('Average node degree', fmt(conn.averageDegree, 4))}${readout('Isolated nodes', conn.isolated)}${readout('Longest route', `${conn.maxHops} hops`)}${readout('Area covered (1-coverage)', `${fmt(cov.fraction * 100, 4)} %`)}${readout(`Area ${Math.round(c.k)}-covered`, `${fmt(cov.kFraction * 100, 4)} %`)}${readout('Poisson estimate 1 − e^(−λπr²)', `${fmt(cov.expected * 100, 4)} % (ignores the edges)`)}${readout('Connectivity rule of thumb', c.range >= 2 * c.sensing ? 'Rc ≥ 2Rs: full coverage implies connectivity' : 'Rc < 2Rs: coverage does not guarantee connectivity')}</div>
      ${renderPlotFrame({ title: 'Hops to the sink', series: [{ xs: histogram.map((_, k) => k + 1), ys: histogram, color: PLOT_COLORS[0], stem: true }], xMin: 0, xMax: Math.max(2, conn.maxHops + 1), xTicks: indexTicks(0, Math.max(2, conn.maxHops + 1)), yRange: niceRange(0, Math.max(1, ...histogram)), formatY: (v) => fmt(v, 3) })}</div></div>`;
    return { controls, body };
  }
  const field = deploy({ nodes: Math.min(300, Math.max(2, Math.round(c.nodes))), width: c.width, height: c.height, seed: Math.round(c.seed), sink: { x: c.sinkX, y: c.sinkY } });
  const key = JSON.stringify(c);
  if (wsnCache.key !== key) {
    const radio = { ...RADIO_DEFAULTS, packetBits: Math.round(c.packet) };
    const options = { initialEnergy: c.energy, chProbability: c.p, radio, recordRound: Math.max(0, Math.round(c.round) - 1) };
    wsnCache = { key, value: ['direct', 'mte', 'leach'].map((protocol) => simulateLifetime(field, { ...options, protocol })) };
  }
  const results = wsnCache.value, leach = results[2];
  const maxRounds = Math.max(...results.map((r) => r.rounds));
  const rounds = Array.from({ length: maxRounds }, (_, k) => k + 1);
  const pad = (list) => rounds.map((_, k) => list[k] ?? 0);
  const names = { direct: 'Direct to sink', mte: 'Minimum-energy multi-hop', leach: 'LEACH' };
  const controls = `${wsnField('lifetime.nodes', 'Nodes', c.nodes)}${wsnField('lifetime.width', 'Field width', c.width, 'm')}${wsnField('lifetime.height', 'Field height', c.height, 'm')}${wsnField('lifetime.seed', 'Seed', c.seed)}${wsnField('lifetime.sinkX', 'Sink x', c.sinkX, 'm')}${wsnField('lifetime.sinkY', 'Sink y', c.sinkY, 'm')}${wsnField('lifetime.energy', 'Initial energy', c.energy, 'J')}${wsnField('lifetime.p', 'Cluster-head fraction p', c.p)}${wsnField('lifetime.packet', 'Packet size', c.packet, 'bits')}${wsnField('lifetime.round', 'Show round', c.round)}`;
  const snap = leach.snapshot;
  const body = `<div class="power-grid"><div>${linePlot('Nodes alive against round', rounds, results.map((r) => ({ name: names[r.protocol], values: pad(r.history.alive) })), { xLabel: (x) => fmt(x, 4) })}${linePlot('Total residual energy (J)', rounds, results.map((r) => ({ name: names[r.protocol], values: pad(r.history.energy) })), { xLabel: (x) => fmt(x, 4) })}
    <table class="truth-table comm-table power-table"><thead><tr><th>Protocol</th><th>First node dies</th><th>Half dead</th><th>Last node dies</th><th>Packets at sink</th></tr></thead><tbody>${results.map((r) => `<tr><td>${names[r.protocol]}</td><td>${r.firstDeath ?? '—'}</td><td>${r.halfDeath ?? '—'}</td><td>${r.lastDeath ?? '—'}</td><td>${r.delivered}</td></tr>`).join('')}</tbody></table></div>
    <div><span class="panel-label">LEACH CLUSTERS IN ROUND ${Math.round(c.round)} (LARGE = CLUSTER HEAD, FADED = LOW ENERGY, RED = DEAD)</span>${snap ? wsnMap(field, { heads: snap.heads, members: snap.members ?? {}, energy: snap.energy, initial: c.energy }) : '<p class="field-help">The network died before this round.</p>'}
    <div class="analysis-readouts">${readout('Radio model', `E_elec = 50 nJ/bit, ε_fs = 10 pJ/bit/m², ε_mp = 0.0013 pJ/bit/m⁴, d₀ = ${fmt(crossover(), 4)} m`)}${readout(`Energy to send ${c.packet} bits 50 m / 150 m`, `${eng(txEnergy(c.packet, 50), 'J')} / ${eng(txEnergy(c.packet, 150), 'J')}`)}${snap ? readout('Cluster heads this round', `${snap.heads.length} (expected p·N = ${fmt(c.p * c.nodes, 3)})`) : ''}</div><p class="field-help">LEACH rotates the costly long-haul transmission: in each epoch of 1/p rounds every node is cluster head once (threshold T(n) = p/(1 − p·(r mod 1/p))), heads fuse their members' data and send one packet. It pays off when the sink is far; with the sink inside a small field direct transmission can win.</p></div></div>`;
  return { controls, body };
}

function renderWsn(state) {
  const config = wsnLab.configuration(state);
  let view;
  try { view = renderWsnTab(config); } catch (error) { view = { controls: '', body: labError('wsn', 'Sensor network', error) }; }
  return `<div class="page scroll-page power-page sigsys-page wsn-page">${pageHeader(modules.find((item) => item.id === 'wsn'), 'WIRELESS SENSOR NETWORKS', '')}${labTabs(WSN_TABS, config.tab, 'data-wsn-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindWsnEvents() { bindLabControls('wsn', wsnLab, ['layout']); }

// ---------------------------------------------------------------------------
// SDR flowgraph editor.

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

function renderSdr(state) {
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

function bindSdrEvents() {
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


// ---------------------------------------------------------------------------
// Neural-network playground.

const NN_TABS = [['playground', 'MLP playground'], ['perceptron', 'Perceptron learning rule']];
const nnLab = makeLab('nn-lab', {
  tab: 'playground',
  playground: { dataset: 'circle', count: 200, noise: 0.1, hidden: '8, 8', activation: 'tanh', optimizer: 'adam', rate: 0.03, epochs: 150, batch: 16, l2: 0, seed: 1, frame: 99 },
  perceptron: { gate: 'and', rate: 0.1, w1: 0, w2: 0, bias: 0, epochs: 20 },
});
const nnField = (...args) => groupField('data-nn-field')(...args);
let nnCache = { key: null, value: null };

function nnRun(c) {
  const key = JSON.stringify({ ...c, frame: 0 });
  if (nnCache.key !== key) {
    const hidden = String(c.hidden).split(/[\s,]+/).filter(Boolean).map(Number);
    if (hidden.some((h) => !Number.isInteger(h) || h < 1 || h > 32) || hidden.length > 4) throw new RangeError('Hidden layers: up to four sizes from 1 to 32, e.g. "8, 8".');
    const data = makeDataset(c.dataset, { count: Math.min(400, Math.max(20, Math.round(c.count))), noise: c.noise, seed: Math.round(c.seed) });
    const net = createNetwork(data.regression ? [1, ...hidden, 1] : [2, ...hidden, 2], { activation: c.activation, seed: Math.round(c.seed) });
    const result = train(net, data, { epochs: Math.min(1000, Math.max(1, Math.round(c.epochs))), learningRate: c.rate, batchSize: Math.max(1, Math.round(c.batch)), optimizer: c.optimizer, l2: c.l2, seed: Math.round(c.seed), snapshots: 8, grid: 36 });
    nnCache = { key, value: { data, net, result } };
  }
  return nnCache.value;
}

function nnMapSvg(data, frame) {
  const size = 300, s = size / 2.4, X = (x) => ((x + 1.2) * s).toFixed(1), Y = (y) => ((1.2 - y) * s).toFixed(1);
  const parts = [];
  if (data.regression) {
    parts.push(`<path class="nn-curve" d="${frame.map.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)} ${Y(y)}`).join('')}"/>`);
    for (const p of data.train) parts.push(`<circle class="nn-point train" cx="${X(p.x)}" cy="${Y(p.target)}" r="3"/>`);
    for (const p of data.test) parts.push(`<circle class="nn-point test" cx="${X(p.x)}" cy="${Y(p.target)}" r="3"/>`);
  } else {
    const n = frame.map.length, cell = size / n;
    frame.map.forEach((row, r) => row.forEach((p, c) => parts.push(`<rect x="${(c * cell).toFixed(1)}" y="${(r * cell).toFixed(1)}" width="${(cell + 0.4).toFixed(1)}" height="${(cell + 0.4).toFixed(1)}" fill="${p > 0.5 ? '#f97316' : '#38bdf8'}" fill-opacity="${(Math.abs(p - 0.5) * 1.3).toFixed(2)}"/>`)));
    for (const p of data.train) parts.push(`<circle class="nn-point c${p.label}" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2"/>`);
    for (const p of data.test) parts.push(`<circle class="nn-point c${p.label} test" cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2"/>`);
  }
  return `<svg class="nn-map" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${parts.join('')}</svg>`;
}

function nnDiagram(net) {
  const width = 460, height = 220, columns = net.sizes.length, maxN = Math.max(...net.sizes);
  const pos = (l, j) => [30 + (width - 60) * l / (columns - 1), height / 2 + (j - (net.sizes[l] - 1) / 2) * Math.min(24, (height - 30) / maxN)];
  const maxW = Math.max(1e-9, ...net.layers.flatMap((layer) => layer.w.flat().map(Math.abs)));
  const lines = net.layers.flatMap((layer, l) => layer.w.flatMap((row, j) => row.map((w, k) => { const [x1, y1] = pos(l, k), [x2, y2] = pos(l + 1, j); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${w > 0 ? '#f97316' : '#38bdf8'}" stroke-width="${(0.3 + 3 * Math.abs(w) / maxW).toFixed(2)}" stroke-opacity="0.75"/>`; })));
  const nodes = net.sizes.flatMap((n, l) => Array.from({ length: n }, (_, j) => { const [x, y] = pos(l, j); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="nn-node"/>`; }));
  return `<svg class="nn-net" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines.join('')}${nodes.join('')}</svg>`;
}

function renderNnTab(config) {
  const c = config[config.tab];
  if (config.tab === 'playground') {
    const { data, net, result } = nnRun(c);
    const frame = result.frames[Math.min(result.frames.length - 1, Math.max(0, Math.round(c.frame)))];
    const epochs = result.history.map((h) => h.epoch);
    const controls = `${labSelect('data-nn-select', 'playground.dataset', 'Dataset', c.dataset, Object.entries(DATASETS))}${nnField('playground.count', 'Points', c.count)}${nnField('playground.noise', 'Noise', c.noise)}<label>Hidden layers<input type="text" spellcheck="false" data-nn-text="playground.hidden" value="${esc(c.hidden)}"></label>${labSelect('data-nn-select', 'playground.activation', 'Activation', c.activation, [['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', 'sigmoid']])}${labSelect('data-nn-select', 'playground.optimizer', 'Optimiser', c.optimizer, [['adam', 'Adam'], ['sgd', 'SGD + momentum']])}${nnField('playground.rate', 'Learning rate', c.rate)}${nnField('playground.epochs', 'Epochs', c.epochs)}${nnField('playground.batch', 'Batch size', c.batch)}${nnField('playground.l2', 'L2 regularisation', c.l2)}${nnField('playground.seed', 'Seed', c.seed)}<label>Show epoch ${frame.epoch}<input type="range" min="0" max="${result.frames.length - 1}" step="1" data-nn-range="playground.frame" value="${Math.min(result.frames.length - 1, Math.round(c.frame))}"></label>`;
    const final = result.final;
    const body = `<div class="power-grid"><div><span class="panel-label">${data.regression ? 'FITTED CURVE' : 'DECISION REGIONS'} AT EPOCH ${frame.epoch} (HOLLOW = TEST POINTS)</span>${nnMapSvg(data, frame)}<span class="panel-label">NETWORK ${net.sizes.join(' → ')} (ORANGE = POSITIVE WEIGHT, WIDTH = SIZE)</span>${nnDiagram(net)}</div>
      <div>${linePlot('Loss against epoch', epochs, [{ name: 'training', values: result.history.map((h) => h.trainLoss) }, { name: 'test', values: result.history.map((h) => h.testLoss) }], { xLabel: (v) => fmt(v, 4), yMin: 0 })}${data.regression ? '' : linePlot('Accuracy against epoch', epochs, [{ name: 'training', values: result.history.map((h) => h.trainAccuracy) }, { name: 'test', values: result.history.map((h) => h.testAccuracy) }], { xLabel: (v) => fmt(v, 4), yMin: 0, yMax: 1 })}
      <div class="analysis-readouts">${readout('Parameters', net.layers.reduce((s, l) => s + l.w.flat().length + l.b.length, 0))}${readout('Final training loss', fmt(final.trainLoss, 5))}${readout('Final test loss', fmt(final.testLoss, 5))}${data.regression ? '' : readout('Accuracy (train / test)', `${fmt(final.trainAccuracy * 100, 4)} % / ${fmt(final.testAccuracy * 100, 4)} %`)}</div><p class="field-help">Backpropagation is written out and checked against finite differences. A gap between training and test loss is overfitting — try fewer neurons, more points or L2. Remove all hidden layers ("") to see that a linear model cannot separate XOR or the circle.</p></div></div>`;
    return { controls, body };
  }
  const result = perceptron(LOGIC_SETS[c.gate], { rate: c.rate, weights: [c.w1, c.w2], bias: c.bias, maxEpochs: Math.max(1, Math.round(c.epochs)) });
  const size = 240, X = (x) => (30 + x * (size - 60)).toFixed(1), Y = (y) => (size - 30 - y * (size - 60)).toFixed(1);
  const [w1, w2] = result.weights, b = result.bias;
  let line = '';
  if (Math.abs(w2) > 1e-12) { const y0 = (-b - w1 * -0.2) / w2, y1 = (-b - w1 * 1.2) / w2; line = `<line class="nn-boundary" x1="${X(-0.2)}" y1="${Y(y0)}" x2="${X(1.2)}" y2="${Y(y1)}"/>`; }
  else if (Math.abs(w1) > 1e-12) { const x0 = -b / w1; line = `<line class="nn-boundary" x1="${X(x0)}" y1="${Y(-0.2)}" x2="${X(x0)}" y2="${Y(1.2)}"/>`; }
  const plot = `<svg class="nn-map" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" fill="none"/>${line}${LOGIC_SETS[c.gate].map(([x1, x2, t]) => `<circle class="nn-point c${t}" cx="${X(x1)}" cy="${Y(x2)}" r="8"/><text class="nn-label" x="${(Number(X(x1)) + 11).toFixed(1)}" y="${(Number(Y(x2)) + 4).toFixed(1)}">(${x1},${x2})→${t}</text>`).join('')}</svg>`;
  const controls = `${labSelect('data-nn-select', 'perceptron.gate', 'Function', c.gate, [['and', 'AND'], ['or', 'OR'], ['nand', 'NAND'], ['xor', 'XOR']])}${nnField('perceptron.rate', 'Learning rate η', c.rate)}${nnField('perceptron.w1', 'Initial w₁', c.w1)}${nnField('perceptron.w2', 'Initial w₂', c.w2)}${nnField('perceptron.bias', 'Initial bias', c.bias)}${nnField('perceptron.epochs', 'Max epochs', c.epochs)}`;
  const body = `<div class="power-grid"><div>${plot}<div class="analysis-readouts">${readout('Result', result.converged ? `converged after ${result.epochs} epoch${result.epochs > 1 ? 's' : ''}` : `not converged in ${result.epochs} epochs`)}${readout('Weights and bias', `w₁ = ${fmt(w1, 4)}, w₂ = ${fmt(w2, 4)}, b = ${fmt(b, 4)}`)}${readout('Decision line', `${fmt(w1, 4)}·x₁ ${w2 < 0 ? '−' : '+'} ${fmt(Math.abs(w2), 4)}·x₂ ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 4)} = 0`)}</div><p class="field-help">${c.gate === 'xor' ? 'XOR is not linearly separable: no single straight line splits the two classes, so the perceptron rule keeps cycling. A hidden layer fixes this (see the MLP playground).' : 'The perceptron convergence theorem guarantees a solution in finitely many updates for linearly separable data.'}</p></div>
    <div><table class="truth-table comm-table power-table"><thead><tr><th>Epoch</th><th>x₁ x₂</th><th>t</th><th>net = w·x + b</th><th>y</th><th>e = t − y</th><th>w₁, w₂ (after)</th><th>b</th></tr></thead><tbody>${result.steps.slice(0, 48).map((s) => `<tr class="${s.error ? 'active' : ''}"><td>${s.epoch}</td><td>${s.x.join(' ')}</td><td>${s.target}</td><td>${fmt(s.net, 4)}</td><td>${s.output}</td><td>${s.error}</td><td>${fmt(s.w[0], 4)}, ${fmt(s.w[1], 4)}</td><td>${fmt(s.b, 4)}</td></tr>`).join('')}</tbody></table><p class="field-help">Rule: w ← w + η(t − y)x, b ← b + η(t − y); highlighted rows changed the weights.</p></div></div>`;
  return { controls, body };
}

function renderNn(state) {
  const config = nnLab.configuration(state);
  let view;
  try { view = renderNnTab(config); } catch (error) { view = { controls: '', body: labError('nn', 'Neural network', error) }; }
  return `<div class="page scroll-page power-page sigsys-page nn-page">${pageHeader(modules.find((item) => item.id === 'neural'), 'NEURAL NETWORKS', '')}${labTabs(NN_TABS, config.tab, 'data-nn-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}

function bindNnEvents() {
  bindLabControls('nn', nnLab, ['dataset', 'activation', 'optimizer', 'gate']);
  document.querySelectorAll('[data-nn-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.nnText.split('.'); nnLab.persist((config) => { config[group][key] = input.value; }); }));
  document.querySelectorAll('[data-nn-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.nnRange.split('.'); nnLab.persist((config) => { config[group][key] = Number(input.value); }); }));
}

// ---------------------------------------------------------------------------
// Math console.

const CONSOLE_EXAMPLES = {
  circuits: ['Circuit calculations', `% Engineering suffixes: p n u m k M G
R1 = 4.7k; R2 = 10k; C = 100n;
Rp = parallel(R1, R2)
fc = 1 / (2*pi*Rp*C)          % RC cut-off in Hz
gain_dB = db(R2 / R1)
f0 = 1 / (2*pi*sqrt(10m * 1u)) % LC resonance`],
  mesh: ['Mesh analysis with matrices', `% Mesh equations R*I = V for a three-loop circuit
R = [15 -5 0; -5 20 -10; 0 -10 25];
V = [10; 0; -5];
I = R \\ V                      % solve with left division
P = I' * R * I                 % total power
det(R)`],
  phasors: ['AC phasors (complex numbers)', `f = 50; w = 2*pi*f;
Z = 10 + j*w*50m - j/(w*200u)  % series RLC impedance
abs(Z), deg(angle(Z))
I = polar(230, 0) / Z           % current phasor
S = 230 * conj(I)               % complex power
pf = cos(angle(Z))`],
  polynomials: ['Polynomials and roots', `p = [1 -6 11 -6];
roots(p)
q = poly([2 3])
conv(p, q)
polyval(p, 4)`],
  plot: ['Plot a frequency response', `% |H(f)| of a first-order RC low-pass
f = logspace(1, 5, 200);
fc = 1k;
H = 1 ./ sqrt(1 + (f / fc).^2);
plot(log10(f), db(H))
H(1), H(200)`],
};
const consoleLab = makeLab('console-lab', { tab: 'console', console: { script: CONSOLE_EXAMPLES.circuits[1], history: [], example: 'circuits' } });
let consoleCache = { key: null, value: null };
let consoleFocus = false;

function consoleRun(c) {
  const key = JSON.stringify([c.script, c.history]);
  if (consoleCache.key !== key) {
    const session = createConsoleSession();
    const script = runConsole(c.script, session);
    const commands = (c.history || []).map((input) => ({ input, ...runConsole(input, session) }));
    consoleCache = { key, value: { session, script, commands } };
  }
  return consoleCache.value;
}

function consoleOutputs(outputs) {
  return outputs.map((o) => {
    if (o.error) return `<pre class="console-error">error: ${esc(o.error)}</pre>`;
    if (o.plot) {
      const xs = o.plot[0].x;
      return `<div class="console-plot">${linePlot('plot()', xs, o.plot.map((s, i) => ({ name: `series ${i + 1}`, values: s.y })), { xLabel: (v) => fmt(v, 4) })}</div>`;
    }
    return `<pre class="console-value">${o.name ? `<b>${esc(o.name)}</b> =\n` : ''}${esc(o.text)}</pre>`;
  }).join('');
}

function renderConsole(state) {
  const c = consoleLab.configuration(state).console;
  const result = consoleRun(c);
  const variables = [...result.session.variables.entries()].filter(([name]) => name !== 'ans' || true);
  const functions = [...result.session.functions.values()];
  const transcript = `<div class="console-block"><span class="panel-label">SCRIPT OUTPUT</span>${consoleOutputs(result.script.outputs) || '<p class="field-help">The script printed nothing (end lines with ; to hide output).</p>'}</div>${result.commands.map((cmd) => `<div class="console-block"><pre class="console-input">&gt;&gt; ${esc(cmd.input)}</pre>${consoleOutputs(cmd.outputs)}</div>`).join('')}`;
  const help = 'Operators: + - * / \\ ^ (matrix) and .* ./ .^ (element-wise), \' transpose, a:b:c ranges, [1 2; 3 4] matrices, j or i for √−1. Define functions with f(x) = …. Functions: sin cos tan sind cosd atan2 sqrt exp log log10 abs angle real imag conj round mod deg rad db fromdb polar parallel sum mean std var rms min max cumsum diff sort length size zeros ones eye linspace logspace det inv trace rank dot cross norm roots poly polyval conv factorial nchoosek gcd lcm isprime plot. Constants: pi e c0 mu0 eps0 kB q h.';
  return `<div class="page scroll-page power-page sigsys-page console-page">${pageHeader(modules.find((item) => item.id === 'console'), 'MATH CONSOLE', '<span class="pill live"><i></i> NO EVAL — OWN INTERPRETER</span>')}
    <div class="console-layout"><div class="dsp-card"><div class="dsp-controls"><label>Example<select data-console-example>${Object.entries(CONSOLE_EXAMPLES).map(([id, [label]]) => `<option value="${id}" ${c.example === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}<option value="custom" ${c.example === 'custom' ? 'selected' : ''}>Your script</option></select></label><button class="button run" data-console-run>Run script</button><button class="button" data-console-clear>Clear history</button></div>
      <textarea class="console-script" rows="12" spellcheck="false" data-console-script>${esc(c.script)}</textarea>
      <div class="console-transcript">${transcript}</div>
      <label class="console-line"><span>&gt;&gt;</span><input type="text" spellcheck="false" autocomplete="off" placeholder="Type an expression and press Enter, e.g. sqrt(2)*230" data-console-command ${consoleFocus ? 'autofocus' : ''}></label><p class="field-help">${esc(help)}</p></div>
      <div class="dsp-card console-vars"><span class="panel-label">WORKSPACE</span><table class="truth-table comm-table power-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${variables.map(([name, value]) => `<tr><td>${esc(name)}</td><td title="${esc(describeConsole(value))}">${esc(formatConsole(value).split('\n').slice(0, 4).join(' ⏎ ').slice(0, 60))}</td></tr>`).join('') || '<tr><td colspan="2">empty</td></tr>'}${functions.map((fn) => `<tr><td>${esc(fn.name)}(${esc(fn.params.join(', '))})</td><td>function</td></tr>`).join('')}</tbody></table></div></div></div>`;
}

function bindConsoleEvents() {
  const script = document.querySelector('[data-console-script]');
  if (!script) return;
  const update = (fn) => consoleLab.persist((config) => { fn(config.console); });
  document.querySelector('[data-console-run]')?.addEventListener('mousedown', (event) => event.preventDefault());
  document.querySelector('[data-console-run]')?.addEventListener('click', () => { consoleFocus = false; update((c) => { c.script = script.value; c.example = 'custom'; }); });
  script.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); update((c) => { c.script = script.value; c.example = 'custom'; }); } });
  document.querySelector('[data-console-clear]')?.addEventListener('click', () => update((c) => { c.history = []; }));
  document.querySelector('[data-console-example]')?.addEventListener('change', (event) => { const example = CONSOLE_EXAMPLES[event.target.value]; if (example) update((c) => { c.script = example[1]; c.example = event.target.value; c.history = []; }); });
  const command = document.querySelector('[data-console-command]');
  command?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !command.value.trim()) return;
    consoleFocus = true;
    const input = command.value.trim();
    update((c) => { c.history = [...(c.history || []), input].slice(-50); });
  });
  if (consoleFocus) { const next = document.querySelector('[data-console-command]'); next?.focus(); const transcript = document.querySelector('.console-transcript'); if (transcript) transcript.scrollTop = transcript.scrollHeight; }
}

// ---------------------------------------------------------------------------
// Learning Hub: tracks and lessons, quizzes, viva practice and verified lab checkpoints.

const LEARN_TABS = [['tracks', 'Tracks & lessons'], ['quiz', 'Quiz'], ['viva', 'Viva practice'], ['verified', 'Verified lab checkpoints']];
const learnLab = makeLab('learn-lab', {
  tab: 'tracks',
  tracks: { track: 'circuits', lesson: '' },
  quiz: { lesson: 'ohm-kirchhoff', seed: 1, responses: {}, checked: false },
  viva: { track: 'circuits', index: 0, reveal: false },
  progress: { scores: {}, known: {} },
});
const lessonPassed = (progress, id) => (progress.scores[id] ?? 0) >= 66;
const trackProgress = (progress, track) => track.lessons.filter((lesson) => lessonPassed(progress, lesson.id)).length;

function renderLearnTracks(config) {
  const c = config.tracks, progress = config.progress;
  const track = TRACKS.find((t) => t.id === c.track) ?? TRACKS[0];
  const lesson = track.lessons.find((l) => l.id === c.lesson);
  const cards = `<section class="track-grid">${TRACKS.map((t, index) => { const done = trackProgress(progress, t); return `<article class="${t.id === track.id ? 'selected' : ''}" style="--track:${t.color}"><span class="track-number">${String(index + 1).padStart(2, '0')}</span><span class="track-level">${esc(t.level)}</span><h3>${esc(t.title)}</h3><p>${t.lessons.length} lessons · ${t.viva.length} viva questions</p><div class="progress"><i style="width:${(100 * done / t.lessons.length).toFixed(0)}%"></i></div><button class="button subtle" data-learn-track="${t.id}">${done ? `${done}/${t.lessons.length} passed — open` : 'Open track'}</button></article>`; }).join('')}</section>`;
  const list = `<div class="lesson-list"><span class="panel-label">${esc(track.title.toUpperCase())}</span>${track.lessons.map((l, index) => `<button class="lesson-row ${l.id === c.lesson ? 'active' : ''}" data-learn-lesson="${l.id}"><span>${index + 1}</span><b>${esc(l.title)}</b><small>${l.minutes} min · ${esc(l.lab.label)}</small><em>${lessonPassed(progress, l.id) ? `✓ ${Math.round(progress.scores[l.id])} %` : progress.scores[l.id] !== undefined ? `${Math.round(progress.scores[l.id])} %` : ''}</em></button>`).join('')}</div>`;
  const view = lesson ? `<article class="lesson-view"><span class="eyebrow">${esc(track.title)} · ${lesson.minutes} min</span><h2>${esc(lesson.title)}</h2>${lesson.summary.map((p) => `<p>${esc(p)}</p>`).join('')}<span class="panel-label">KEY FORMULAS</span><ul class="formula-list">${lesson.formulas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><div class="lesson-actions"><button class="button primary" data-module="${lesson.lab.module}">Try it: ${esc(lesson.lab.label)} →</button><button class="button run" data-learn-quiz="${lesson.id}">Take the quiz (${lesson.questions.length} questions)</button></div></article>` : '<p class="field-help">Choose a lesson. Each one explains an idea in a few paragraphs, lists the key formulas, links to the lab where you can try it, and ends with a short quiz. A lesson counts as passed at 66 % or more.</p>';
  return `${cards}<div class="lesson-layout">${list}${view}</div>`;
}

function renderLearnQuiz(config) {
  const c = config.quiz, lesson = findLesson(c.lesson) ?? lessonIndex()[0];
  const instances = lesson.questions.map((q, k) => instantiate(q, c.seed * 97 + k));
  const score = c.checked ? scoreQuiz(instances, c.responses || {}) : null;
  const options = TRACKS.map((t) => `<optgroup label="${esc(t.title)}">${t.lessons.map((l) => `<option value="${l.id}" ${l.id === lesson.id ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</optgroup>`).join('');
  const questions = instances.map((q, k) => {
    const result = score?.results[k], response = c.responses?.[q.id] ?? '';
    const input = q.kind === 'mcq'
      ? `<div class="quiz-options">${q.options.map((option, i) => `<label class="${result && i === q.answer ? 'right' : ''} ${result && String(i) === String(response) && !result.correct ? 'wrong' : ''}"><input type="radio" name="q-${q.id}" value="${i}" data-learn-answer="${q.id}" ${String(i) === String(response) ? 'checked' : ''} ${c.checked ? 'disabled' : ''}> ${esc(option)}</label>`).join('')}</div>`
      : `<label class="quiz-numeric">Answer${q.unit ? ` (${esc(q.unit)})` : ''}<input type="text" spellcheck="false" data-learn-answer="${q.id}" value="${esc(response)}" placeholder="e.g. 4.7k or 0.0047" ${c.checked ? 'disabled' : ''}></label>`;
    const feedback = result ? `<div class="quiz-feedback ${result.correct ? 'ok' : 'bad'}"><b>${result.correct ? 'Correct' : result.unanswered ? 'Not answered' : 'Not quite'}</b> — answer: ${esc(result.expected)}. ${esc(result.explanation)}</div>` : '';
    return `<div class="quiz-question"><span class="quiz-number">${k + 1}</span><div><p>${esc(q.prompt)}</p>${input}${feedback}</div></div>`;
  }).join('');
  const best = config.progress.scores[lesson.id];
  return `<div class="dsp-controls"><label>Lesson<select data-learn-quiz-lesson>${options}</select></label>${best !== undefined ? `<span class="pill ${best >= 66 ? 'live' : ''}"><i></i> BEST ${Math.round(best)} %</span>` : ''}</div>
    <div class="quiz">${questions}</div>
    <div class="lesson-actions">${c.checked ? `<div class="quiz-score">Score: ${score.correct} / ${score.total} (${Math.round(score.percent)} %)</div><button class="button run" data-learn-new>New numbers, try again</button>` : '<button class="button run" data-learn-check>Check answers</button>'}<button class="button" data-module="${lesson.lab.module}">Open ${esc(lesson.lab.label)}</button></div>
    <p class="field-help">Numeric answers accept engineering notation (4.7k, 220n, 2.2M) and units are ignored; within 2 % counts as correct unless the question needs an exact value. "New numbers" draws fresh values so you cannot just memorise the answer.</p>`;
}

function renderLearnViva(config) {
  const c = config.viva, track = TRACKS.find((t) => t.id === c.track) ?? TRACKS[0];
  const index = Math.min(track.viva.length - 1, Math.max(0, c.index)), [question, answer] = track.viva[index];
  const known = config.progress.known[track.id] ?? [];
  return `<div class="dsp-controls">${labSelect('data-learn-viva-track', 'viva.track', 'Track', track.id, TRACKS.map((t) => [t.id, t.title]))}<span class="pill"><i></i> ${known.length} / ${track.viva.length} MARKED AS KNOWN</span></div>
    <div class="viva-card"><span class="eyebrow">Question ${index + 1} of ${track.viva.length}${known.includes(index) ? ' · known' : ''}</span><h2>${esc(question)}</h2>${c.reveal ? `<p class="viva-answer">${esc(answer)}</p><div class="lesson-actions"><button class="button run" data-learn-viva-mark="known">I knew this</button><button class="button" data-learn-viva-mark="review">Review again</button></div>` : '<p class="field-help">Say your answer out loud first, as you would to an examiner, then reveal the model answer.</p><button class="button primary" data-learn-viva-reveal>Show the answer</button>'}</div>
    <div class="lesson-actions"><button class="button" data-learn-viva-step="-1" ${index === 0 ? 'disabled' : ''}>← Previous</button><button class="button" data-learn-viva-step="1" ${index === track.viva.length - 1 ? 'disabled' : ''}>Next →</button></div>
    <ol class="viva-list">${track.viva.map(([q], i) => `<li class="${known.includes(i) ? 'known' : ''} ${i === index ? 'current' : ''}"><button data-learn-viva-go="${i}">${esc(q)}</button></li>`).join('')}</ol>`;
}

function renderLearningHub(state) {
  const config = learnLab.configuration(state);
  if (config.tab === 'verified') return renderVerifiedLearning().replace('<div class="page scroll-page">', '<div class="page scroll-page learn-page">').replace('</div><section class="learning-hero">', `</div>${labTabs(LEARN_TABS, config.tab, 'data-learn-tab')}<section class="learning-hero">`);
  const passed = lessonIndex().filter((l) => lessonPassed(config.progress, l.id)).length, total = lessonIndex().length;
  let body;
  try { body = config.tab === 'quiz' ? renderLearnQuiz(config) : config.tab === 'viva' ? renderLearnViva(config) : renderLearnTracks(config); } catch (error) { body = `<div class="diagnostic error"><b>Learning Hub</b><span>${esc(error.message)}</span></div>`; }
  return `<div class="page scroll-page learn-page">${pageHeader(modules.find((item) => item.id === 'learn'), 'LEARN BY DOING', `<span class="pill live"><i></i> ${passed} / ${total} LESSONS PASSED</span>`)}${labTabs(LEARN_TABS, config.tab, 'data-learn-tab')}<div class="dsp-card">${body}</div></div>`;
}

function bindLearningHubEvents() {
  const update = (fn) => learnLab.persist((config) => fn(config));
  document.querySelectorAll('[data-learn-tab]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tab = b.dataset.learnTab; })));
  document.querySelectorAll('[data-learn-track]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tracks.track = b.dataset.learnTrack; c.tracks.lesson = TRACKS.find((t) => t.id === b.dataset.learnTrack).lessons[0].id; })));
  document.querySelectorAll('[data-learn-lesson]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tracks.lesson = b.dataset.learnLesson; })));
  const startQuiz = (id) => update((c) => { c.tab = 'quiz'; c.quiz = { lesson: id, seed: (c.quiz.seed || 1) + 1, responses: {}, checked: false }; });
  document.querySelectorAll('[data-learn-quiz]').forEach((b) => b.addEventListener('click', () => startQuiz(b.dataset.learnQuiz)));
  document.querySelector('[data-learn-quiz-lesson]')?.addEventListener('change', (event) => startQuiz(event.target.value));
  document.querySelectorAll('[data-learn-answer]').forEach((input) => input.addEventListener('change', () => update((c) => { c.quiz.responses = { ...c.quiz.responses, [input.dataset.learnAnswer]: input.value }; })));
  document.querySelector('[data-learn-check]')?.addEventListener('mousedown', (event) => event.preventDefault());
  document.querySelector('[data-learn-check]')?.addEventListener('click', () => {
    // Pick up a value still being typed (no change event yet).
    const pending = {}; document.querySelectorAll('input[type="text"][data-learn-answer]').forEach((input) => { pending[input.dataset.learnAnswer] = input.value; });
    update((c) => {
      c.quiz.responses = { ...c.quiz.responses, ...pending }; c.quiz.checked = true;
      const lesson = findLesson(c.quiz.lesson), instances = lesson.questions.map((q, k) => instantiate(q, c.quiz.seed * 97 + k));
      const percent = scoreQuiz(instances, c.quiz.responses).percent;
      c.progress.scores = { ...c.progress.scores, [lesson.id]: Math.max(c.progress.scores[lesson.id] ?? 0, percent) };
    });
  });
  document.querySelector('[data-learn-new]')?.addEventListener('click', () => update((c) => { c.quiz = { ...c.quiz, seed: c.quiz.seed + 1, responses: {}, checked: false }; }));
  document.querySelector('[data-learn-viva-track="viva.track"]')?.addEventListener('change', (event) => update((c) => { c.viva = { track: event.target.value, index: 0, reveal: false }; }));
  document.querySelector('[data-learn-viva-reveal]')?.addEventListener('click', () => update((c) => { c.viva.reveal = true; }));
  document.querySelectorAll('[data-learn-viva-step]').forEach((b) => b.addEventListener('click', () => update((c) => { c.viva.index += Number(b.dataset.learnVivaStep); c.viva.reveal = false; })));
  document.querySelectorAll('[data-learn-viva-go]').forEach((b) => b.addEventListener('click', () => update((c) => { c.viva.index = Number(b.dataset.learnVivaGo); c.viva.reveal = false; })));
  document.querySelectorAll('[data-learn-viva-mark]').forEach((b) => b.addEventListener('click', () => update((c) => {
    const track = TRACKS.find((t) => t.id === c.viva.track) ?? TRACKS[0], list = new Set(c.progress.known[track.id] ?? []);
    if (b.dataset.learnVivaMark === 'known') list.add(c.viva.index); else list.delete(c.viva.index);
    c.progress.known = { ...c.progress.known, [track.id]: [...list].sort((x, y) => x - y) };
    if (c.viva.index < track.viva.length - 1) c.viva.index += 1;
    c.viva.reveal = false;
  })));
}

// ---------------------------------------------------------------------------
// AI lab partner (OpenAI-compatible). Non-secret settings live in localStorage; the API key is
// kept in memory, or in sessionStorage for this tab only if the user asks (src/core/credentials.js).
// Neither is ever written to the project file.

const EXPERIMENT_MODULES = { 'signals-fft': 'dsp', 'dsp-lab': 'dsp', 'control-step': 'iot', 'control-lab': 'iot', 'comm-lab': 'communication', 'qpsk-ber': 'communication', 'rx-lab': 'communication', 'rf-touchstone': 'rf', 'rf-lab': 'rf', 'calc-lab': 'calc', 'pcb-board': 'pcb', 'mcu-lab': 'mcu', 'bench-lab': 'bench', 'lab-record': 'record', 'power-lab': 'power', 'adc-lab': 'adc', 'sensor-lab': 'sensors', 'ev-lab': 'ev', 'vlsi-lab': 'vlsi', 'rtos-lab': 'rtos', 'network-lab': 'theory', 'sigsys-lab': 'sigsys', 'em-lab': 'em', 'cell-lab': 'cellular', 'netproto-lab': 'network', 'crypto-lab': 'crypto', 'wsn-lab': 'wsn', 'sdr-lab': 'sdr', 'dip-lab': 'dip', 'bio-lab': 'biomed', 'nn-lab': 'neural', 'console-lab': 'console', 'learn-lab': 'learn', 'info-lab': 'info', 'analog-lab': 'analog', 'meas-lab': 'measure', 'radar-lab': 'radar', 'speech-lab': 'speech', 'plc-lab': 'plc', 'mach-lab': 'machines', 'product-lab': 'product', 'fault-lab': 'faulthunt', 'twin-lab': 'twin', 'topology-metrics': 'network', 'vcd-import': 'fpga' };
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
  render();
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
    render();
  }
}

function bindAssistantEvents() {
  document.querySelector('[data-ai-open]')?.addEventListener('click', () => { assistant.open = true; assistant.focus = true; if (!assistantSettings().consented) assistant.view = 'settings'; render(); });
  document.querySelector('[data-ai-close]')?.addEventListener('click', () => { assistant.open = false; render(); });
  document.querySelector('[data-ai-clear]')?.addEventListener('click', () => { assistant.history = []; assistant.shown = []; assistant.error = ''; render(); });
  document.querySelectorAll('[data-ai-view]').forEach((b) => b.addEventListener('click', () => { assistant.view = b.dataset.aiView; render(); }));
  document.querySelector('[data-ai-forget]')?.addEventListener('click', () => { forgetApiKey(sessionStorage); notify('API key forgotten.', 'success'); render(); });
  document.querySelectorAll('[data-ai-setting]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.aiSetting;
    const value = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (key === 'baseUrl' && value) { try { validateBaseUrl(value); } catch (error) { notify(error.message, 'error'); return; } }
    saveAssistantSettings(key === 'provider' ? { provider: value, baseUrl: '', model: '' } : { [key]: value });
    render();
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
  root.querySelector('[data-action="mcu-assemble"]')?.addEventListener('mousedown', (event) => event.preventDefault());
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



function renderPacketCapture(state) {
  const result = state.simulation?.kind === 'network' ? state.simulation.trace : null;
  const metrics = state.simulation?.kind === 'topology' ? state.simulation.metrics : null;
  const rows = result?.packets?.slice(0, 100).map((packet) => `<tr><td>${packet.index}</td><td>${fmt(packet.timestamp, 6)}</td><td>${packet.capturedLength}</td><td>${packet.originalLength}</td><td>${Array.from(packet.data.slice(0, 8)).map((value) => value.toString(16).padStart(2, '0')).join(' ')}</td></tr>`).join('') || '';
  return `<section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="parse-pcap">Parse saved capture</button><label>Format<select data-pcap-field="format"><option value="pcap">PCAP</option><option value="pcapng">PCAPNG</option></select></label><span class="field-help">Saved capture bytes as hex; live capture is unavailable.</span></div><label class="rf-input-label">PCAP/PCAPNG hex<textarea data-pcap-field="hex" rows="7" spellcheck="false" placeholder="d4c3b2a1 ..."></textarea></label>
    <div class="stat-grid"><div><span>Link type</span><strong>${result?.linkType ?? '—'}</strong><small>PCAP header</small></div><div><span>Snap length</span><strong>${result?.snaplen ?? '—'}</strong><small>bytes</small></div><div><span>Packets</span><strong>${result?.packets.length ?? '—'}</strong><small>bounded reader</small></div></div>${result ? `<div class="packet-table"><table><thead><tr><th>#</th><th>Timestamp</th><th>Captured</th><th>Original</th><th>Prefix</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="module-footnote">Saved PCAP parsing is local and unprivileged. TShark, display filters and live interfaces remain separate unavailable capabilities.</p></section><section class="dsp-card"><div class="dsp-controls"><button class="button run" data-action="run-topology">Run topology metrics</button><span class="field-help">Deterministic reachability; no broker or live network access.</span></div><label class="rf-input-label">Topology JSON<textarea data-topology-field="json" rows="5" spellcheck="false">${esc(JSON.stringify({ id: 'demo-network', nodes: [{ id: 'sensor' }, { id: 'gateway' }, { id: 'server' }], links: [{ from: 'sensor', to: 'gateway' }, { from: 'gateway', to: 'server' }] }, null, 2))}</textarea></label>${metrics ? `<div class="stat-grid"><div><span>Nodes</span><strong>${metrics.nodes}</strong><small>validated</small></div><div><span>Links</span><strong>${metrics.links}</strong><small>undirected</small></div><div><span>Reachable</span><strong>${metrics.reachable}</strong><small>from source</small></div></div>` : ''}</section>`;
}

// ---------------------------------------------------------------------------
// Networks: subnetting, routing, sliding window and MAC (plus the saved-capture reader).

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
  return `<div class="gantt-scroll"><svg class="arq-timeline" viewBox="0 0 520 ${height}" width="520" height="${height}">${parts.join('')}</svg></div>`;
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

function renderNetwork(state) {
  const config = netLab2.configuration(state);
  let view;
  try { view = renderNetworkTab(config, state); } catch (error) { view = { controls: '', body: labError('np', 'Networks', error) }; }
  const capture = config.tab === 'capture';
  return `<div class="page scroll-page power-page sigsys-page network-page">${pageHeader(modules.find((item) => item.id === 'network'), 'COMPUTER NETWORKS', capture ? '<span class="pill live"><i></i> SAVED CAPTURE ONLY</span>' : '')}${labTabs(NET_TABS, config.tab, 'data-np-tab')}${capture ? view.body : `<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>`}</div>`;
}

function bindNetprotoEvents() {
  bindLabControls('np', netLab2, ['source', 'poisoned', 'destination', 'protocol']);
  document.querySelectorAll('[data-np-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.npText.split('.'); netLab2.persist((config) => { config[group][key] = input.value; }); }));
}

// ---------------------------------------------------------------------------
// Built-in Verilog simulator (FPGA & Digital module).


function renderVerifiedLearning() {
  const state = getState(); const evaluation = state.lessonEvaluation || (state.learningProgress?.lessons['voltage-divider'] ? { passed: state.learningProgress.lessons['voltage-divider'].passed } : null); const dspPassed = state.learningProgress?.lessons['dsp-window']?.passed; const commPassed = state.learningProgress?.lessons['qpsk-ber']?.passed;
  return `<div class="page scroll-page">${pageHeader(modules.at(-1), 'LEARN BY BUILDING', '<button class="button primary" data-action="open-lesson-circuit">Open Circuit Lab</button>')}<section class="learning-hero"><div><span class="pill live"><i></i> VERIFIED CHECKPOINTS</span><h2>Build, measure, verify.</h2><p>Checkpoints consume real Circuit, Signals and Link Lab results with explicit tolerances.</p></div><div class="progress-ring"><strong>${[evaluation?.passed, dspPassed, commPassed].filter(Boolean).length}/3</strong><span>CHECKPOINT<br>PROGRESS</span></div></section><section class="track-grid"><article><span class="track-number">01</span><span class="track-level">FOUNDATION</span><h3>DC fundamentals</h3><p>Verify the output node is 6 V within ±0.01 V.</p><div class="progress"><i style="width:${evaluation?.passed ? '100%' : '0%'}"></i></div><span class="lesson-status">${evaluation ? (evaluation.passed ? 'Passed' : 'Not yet passed') : 'Not attempted'}</span></article><article><span class="track-number">02</span><span class="track-level">SIGNALS</span><h3>Windowed FFT</h3><p>Generate a real bounded signal and verify its sample count.</p><div class="progress"><i style="width:${dspPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-dsp-lesson">${dspPassed ? 'Passed' : 'Check DSP result'}</button></article><article><span class="track-number">03</span><span class="track-level">COMMS</span><h3>QPSK BER</h3><p>Verify offline BER stays below 20%.</p><div class="progress"><i style="width:${commPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-comm-lesson">${commPassed ? 'Passed' : 'Check BER result'}</button></article></section></div>`;
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
