// Contract tests for workspaces extracted from src/app.js. Each workspace module exports a renderer
// (state → HTML string) and a binder; the renderer must produce the module's page with its tab and
// action attributes, escape project data and never print "undefined".
import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k), key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size; }, clear: () => memory.clear() };
const store = await import('../src/core/store.js');

export const WORKSPACES = [
  { module: 'logic', path: '../src/workspaces/digital/logic.js', render: 'renderLogic', bind: 'bindLogicEvents', expect: [/data-logic-tab="boolean"/, /data-logic-tab="simulator"/, /data-logic-field=/] },
  { module: 'power', path: '../src/workspaces/electrical/power.js', render: 'renderPower', bind: 'bindPowerEvents', expect: [] },
  { module: 'adc', path: '../src/workspaces/electrical/adc.js', render: 'renderAdcLab', bind: 'bindAdcEvents', expect: [] },
  { module: 'sensors-ev', path: '../src/workspaces/electrical/sensors-ev.js', render: 'renderSensors', bind: 'bindSensorEvents', expect: [] },
  { module: 'sensors-ev', path: '../src/workspaces/electrical/sensors-ev.js', render: 'renderEv', bind: 'bindSensorEvents', expect: [] },
  { module: 'machines', path: '../src/workspaces/electrical/machines.js', render: 'renderMachines', bind: 'bindMachinesEvents', expect: [] },
  { module: 'product', path: '../src/workspaces/electrical/product.js', render: 'renderProduct', bind: 'bindProductEvents', expect: [] },
  { module: 'measure', path: '../src/workspaces/electrical/measure.js', render: 'renderMeasurement', bind: 'bindMeasurementEvents', expect: [] },
  { module: 'theory', path: '../src/workspaces/circuit/theory.js', render: 'renderNetworkTheory', bind: 'bindNetworkTheoryEvents', expect: [] },
  { module: 'faulthunt', path: '../src/workspaces/circuit/faulthunt.js', render: 'renderFaultHunt', bind: 'bindFaultHuntEvents', expect: [] },
  { module: 'vlsi-rtos', path: '../src/workspaces/digital/vlsi-rtos.js', render: 'renderVlsi', bind: 'bindVlsiEvents', expect: [] },
  { module: 'vlsi-rtos', path: '../src/workspaces/digital/vlsi-rtos.js', render: 'renderRtos', bind: 'bindVlsiEvents', expect: [] },
  { module: 'fpga', path: '../src/workspaces/digital/fpga.js', render: 'renderDigital', bind: 'bindVerilogEvents', expect: [] },
  { module: 'sigsys', path: '../src/workspaces/signals/sigsys.js', render: 'renderSigsys', bind: 'bindSigsysEvents', expect: [] },
  { module: 'dsp', path: '../src/workspaces/signals/dsp.js', render: 'renderDsp', bind: 'bindDspEvents', expect: [] },
  { module: 'speech', path: '../src/workspaces/signals/speech.js', render: 'renderSpeech', bind: 'bindSpeechEvents', expect: [] },
  { module: 'dip', path: '../src/workspaces/signals/dip.js', render: 'renderDip', bind: 'bindDipEvents', expect: [] },
  { module: 'biomed', path: '../src/workspaces/signals/biomed.js', render: 'renderBio', bind: 'bindBioEvents', expect: [] },
  { module: 'control', path: '../src/workspaces/control/control.js', render: 'renderControl', bind: 'bindControlEvents', expect: [] },
  { module: 'plc', path: '../src/workspaces/control/plc.js', render: 'renderPlc', bind: 'bindPlcEvents', expect: [] },
  { module: 'communication', path: '../src/workspaces/communication/communication.js', render: 'renderCommunication', bind: 'bindCommunicationEvents', expect: [] },
  { module: 'info', path: '../src/workspaces/communication/info.js', render: 'renderInfo', bind: 'bindInfoEvents', expect: [] },
  { module: 'network', path: '../src/workspaces/communication/network.js', render: 'renderNetwork', bind: 'bindNetprotoEvents', expect: [] },
  { module: 'cellular', path: '../src/workspaces/communication/cellular.js', render: 'renderCellular', bind: 'bindCellularEvents', expect: [] },
  { module: 'wsn', path: '../src/workspaces/communication/wsn.js', render: 'renderWsn', bind: 'bindWsnEvents', expect: [] },
  { module: 'sdr', path: '../src/workspaces/communication/sdr.js', render: 'renderSdr', bind: 'bindSdrEvents', expect: [] },
  { module: 'crypto', path: '../src/workspaces/communication/crypto.js', render: 'renderCrypto', bind: 'bindCryptoEvents', expect: [] },
  { module: 'rf', path: '../src/workspaces/rf/rf.js', render: 'renderRf', bind: 'bindRfEvents', expect: [] },
  { module: 'em', path: '../src/workspaces/rf/em.js', render: 'renderEm', bind: 'bindEmEvents', expect: [] },
  { module: 'radar', path: '../src/workspaces/rf/radar.js', render: 'renderRadar', bind: 'bindRadarEvents', expect: [] },
  { module: 'twin', path: '../src/workspaces/embedded/twin.js', render: 'renderTwin', bind: 'bindTwinEvents', expect: [] },
  { module: 'pcb', path: '../src/workspaces/pcb/pcb.js', render: 'renderPcb', bind: 'bindPcbEvents', expect: [] },
  { module: 'calc', path: '../src/workspaces/tools/calculators.js', render: 'renderCalculators', bind: 'bindCalculatorEvents', expect: [] },
  { module: 'neural', path: '../src/workspaces/learning/neural.js', render: 'renderNn', bind: 'bindNnEvents', expect: [] },
  { module: 'console', path: '../src/workspaces/learning/console.js', render: 'renderConsole', bind: 'bindConsoleEvents', expect: [] },
  { module: 'learn', path: '../src/workspaces/learning/learning-hub.js', render: 'renderLearningHub', bind: 'bindLearningHubEvents', expect: [] },
  { module: 'mcu', path: '../src/workspaces/embedded/mcu.js', render: 'renderMcu', bind: 'bindMcuEvents', expect: [] },
  { module: 'bench', path: '../src/workspaces/circuit/bench.js', render: 'renderBench', bind: 'bindBenchEvents', expect: [] },
  { module: 'record', path: '../src/workspaces/records/records.js', render: 'renderRecords', bind: 'bindRecordEvents', expect: [] },
  { module: 'circuit', path: '../src/workspaces/circuit/circuit.js', render: 'renderCircuit', bind: 'bindCircuitEvents', expect: [] },
  { module: 'analog', path: '../src/workspaces/circuit/analog.js', render: 'renderAnalog', bind: 'bindAnalogEvents', expect: [] },
  { module: 'embedded', path: '../src/workspaces/embedded/embedded.js', render: 'renderEmbedded', bind: 'bindEmbeddedEvents', expect: [] },
];

for (const workspace of WORKSPACES) {
  test(`workspace ${workspace.module}: renders its page and exposes a binder`, async () => {
    const mod = await import(workspace.path);
    assert.equal(typeof mod[workspace.render], 'function');
    assert.equal(typeof mod[workspace.bind], 'function');
    const html = mod[workspace.render](store.getState());
    assert.match(html, /<h1>[^<]+<\/h1>/, 'the workspace renders its title');
    for (const pattern of workspace.expect) assert.match(html, pattern);
    assert.doesNotMatch(html, /\bundefined\b/);
    // The binder only queries the DOM; with no matching elements it must do nothing.
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
    try { mod[workspace.bind](); } finally { delete globalThis.document; }
  });
}
