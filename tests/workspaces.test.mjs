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
];

for (const workspace of WORKSPACES) {
  test(`workspace ${workspace.module}: renders its page and exposes a binder`, async () => {
    const mod = await import(workspace.path);
    assert.equal(typeof mod[workspace.render], 'function');
    assert.equal(typeof mod[workspace.bind], 'function');
    const html = mod[workspace.render](store.getState());
    assert.match(html, /class="page-heading"/);
    for (const pattern of workspace.expect) assert.match(html, pattern);
    assert.doesNotMatch(html, /\bundefined\b/);
    // The binder only queries the DOM; with no matching elements it must do nothing.
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
    try { mod[workspace.bind](); } finally { delete globalThis.document; }
  });
}
