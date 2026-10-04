import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDiagnostic, diagnosticFromError } from '../packages/diagnostics/src/index.mjs';
import { createNgspiceAdapter, parseNgspiceDiagnostics, parseNgspiceMeasurements, parseNgspiceOutput, parseNgspiceVersion, probeExecutable, validateEngineManifest } from '../packages/engine-sdk/src/index.mjs';
import { createArduinoCliAdapter, parseArduinoCliVersion, parseArduinoDiagnostics, parseArduinoInventory } from '../packages/engine-sdk/src/index.mjs';
import { createKiCadAdapter, parseKiCadReport } from '../packages/engine-sdk/src/index.mjs';
import { createVerilatorAdapter, parseVerilatorDiagnostics } from '../packages/engine-sdk/src/index.mjs';
import { createGhdlAdapter, parseGhdlDiagnostics } from '../packages/engine-sdk/src/index.mjs';
import { createYosysAdapter, parseYosysReport } from '../packages/engine-sdk/src/index.mjs';
import { createNextpnrAdapter, parseNextpnrReport } from '../packages/engine-sdk/src/index.mjs';
import { createQucsatorRfAdapter, parseQucsatorRfReport } from '../packages/engine-sdk/src/index.mjs';
import { createTsharkAdapter, parseTsharkDiagnostics, parseTsharkJson } from '../packages/engine-sdk/src/index.mjs';
import { createPlatformIoAdapter, parsePlatformIoDiagnostics } from '../packages/engine-sdk/src/index.mjs';
import { createRenodeAdapter, parseRenodeDiagnostics } from '../packages/engine-sdk/src/index.mjs';
import { createDevicePermissionPolicy, createSerialSession } from '../packages/device-bridge/src/index.mjs';
import { constellationResult, createResult, digitalTraceResult, scalarResult, tableResult, waveformResult, MAX_RESULT_PAYLOAD_BYTES, MAX_RESULT_PROVENANCE_INPUT_BYTES } from '../packages/results/src/index.mjs';
import { completeCancellation, createAdapter, createJob, executeAdapterJob, failJob, requestCancel, transitionJob } from '../packages/engine-sdk/src/index.mjs';

test('diagnostics have stable codes, locations, and bounded fields', () => {
  const diagnostic = createDiagnostic({ code: 'NETLIST_INVALID', message: 'Missing ground.', source: 'design/schematic.json', line: 4, column: 2, fix: 'Add a ground node.' });
  assert.deepEqual(diagnostic, { severity: 'error', code: 'NETLIST_INVALID', message: 'Missing ground.', source: 'design/schematic.json', line: 4, column: 2, fix: 'Add a ground node.' });
  assert.throws(() => createDiagnostic({ code: 'bad', message: 'x' }));
  assert.equal(diagnosticFromError(new Error('timeout')).code, 'ENGINE_FAILURE');
  assert.throws(() => createDiagnostic({ code: 'X'.repeat(101), message: 'bad' }), /stable uppercase|limit/);
  assert.throws(() => createDiagnostic({ code: 'OUTPUT', message: 'x'.repeat(1_000_001) }), /bounded/);
  assert.throws(() => createDiagnostic({ code: 'OUTPUT', message: 'bad', source: `runs/${'x'.repeat(4096)}` }), /source/);
});

test('results preserve provenance, units, and sampling metadata', () => {
  const provenance = { engine: 'OpenENTC-DC', inputs: ['project.json'] };
  assert.equal(scalarResult(6, 'V', provenance).kind, 'scalar');
  const waveform = waveformResult([{ t: 0, v: 1 }, { t: 0.001, v: 2 }], { sampleRate: 1000, provenance });
  assert.equal(waveform.sampleRate, 1000);
  assert.throws(() => createResult({ kind: 'scalar', provenance: { engine: '', inputs: [] } }), /provenance/);
  assert.throws(() => createResult({ kind: 'scalar', provenance, units: '' }), /units/);
  assert.throws(() => waveformResult(Array.from({ length: 1_000_001 }, (_, index) => ({ t: index, v: 0 })), { sampleRate: 1, provenance }), /bounded/);
  assert.throws(() => waveformResult([{ t: 1, v: 0 }, { t: 0, v: 0 }], { sampleRate: 1, provenance }), /non-decreasing/);
  const points = [{ t: 0, v: 1 }]; const immutable = waveformResult(points, { sampleRate: 1, provenance }); points[0].v = 99; assert.equal(immutable.data[0].v, 1);
  assert.throws(() => createResult({ kind: 'waveform', provenance, sampleRate: 0 }));
  assert.throws(() => createResult({ kind: 'report', provenance, data: 'x'.repeat(MAX_RESULT_PAYLOAD_BYTES + 1) }), /bounded payload/);
  assert.throws(() => createResult({ kind: 'report', provenance, data: 1n }), /JSON-serializable/);
  assert.throws(() => createResult({ kind: 'report', provenance: { engine: 'fixture', inputs: ['€'.repeat(MAX_RESULT_PROVENANCE_INPUT_BYTES)] } }), /bounded/);
  const artifact = { path: 'runs/report.json', sha256: 'a'.repeat(64), size: 12, mediaType: 'application/json' };
  assert.deepEqual(createResult({ kind: 'report', provenance, artifacts: [artifact] }).artifacts, [artifact]);
  assert.throws(() => createResult({ kind: 'report', provenance, artifacts: [{ ...artifact, path: '../escape' }] }), /safe references/);
  assert.throws(() => createResult({ kind: 'report', provenance, artifacts: [{ ...artifact, size: 268435457 }] }), /safe references/);
});

test('common result constructors validate richer engineering data', () => {
  const provenance = { engine: 'fixture', inputs: ['x'] };
  assert.equal(tableResult([[1, 2]], { columns: ['f', 'v'], provenance }).kind, 'table');
  assert.equal(digitalTraceResult([{ name: 'clk', samples: [{ time: 0, value: '0' }] }], { timescale: '1 ns', provenance }).kind, 'digital-trace');
  assert.equal(constellationResult([{ i: 1, q: -1 }], { modulation: 'QPSK', provenance }).kind, 'constellation');
  assert.throws(() => tableResult([[Infinity]], { provenance }), /finite/);
});

test('jobs enforce lifecycle transitions and retain failure diagnostics', () => {
  let job = createJob({ id: 'job-1', projectId: 'project-1', operation: 'simulate', inputs: ['design/schematic.json'], arguments: ['--safe'], createdAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(job.createdAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(job.reproducibility, { inputs: ['design/schematic.json'], arguments: ['--safe'] });
  assert.equal(job.startedAt, null);
  job = transitionJob(job, 'preparing');
  job = transitionJob(job, 'running');
  assert.ok(job.startedAt && job.updatedAt >= job.startedAt);
  job = failJob(job, Object.assign(new Error('engine failed'), { code: 'ENGINE_FAILED' }));
  assert.equal(job.state, 'failed');
  assert.ok(job.finishedAt && job.updatedAt >= job.finishedAt);
  assert.equal(job.diagnostics[0].code, 'ENGINE_FAILED');
  assert.throws(() => transitionJob(job, 'running'), /Invalid job transition/);
  assert.throws(() => createJob({ id: 'bad-inputs', projectId: 'p', operation: 'check', inputs: 'not-an-array' }), /inputs/);
  assert.throws(() => createJob({ id: 'bad-outputs', projectId: 'p', operation: 'check', outputs: [''] }), /outputs/);
  assert.throws(() => createJob({ id: 'bad-args', projectId: 'p', operation: 'check', arguments: ['x'.repeat(1_000_001)] }), /bounded/);
  assert.throws(() => createJob({ id: 'bad-arg-control', projectId: 'p', operation: 'check', arguments: ['ok\u0000bad'] }), /control/);
  assert.throws(() => createJob({ id: 'bad-policy', projectId: 'p', operation: 'check', resourcePolicy: { note: 'x'.repeat(65 * 1024) } }), /oversized/);
  assert.throws(() => createJob({ id: 'bad-policy-shape', projectId: 'p', operation: 'check', resourcePolicy: [] }), /object/);
  assert.throws(() => createJob({ id: 'x'.repeat(201), projectId: 'p', operation: 'check' }), /bounded/);
  assert.throws(() => createJob({ id: 'bad-input-path', projectId: 'p', operation: 'check', inputs: ['x'.repeat(1_000_001)] }), /bounded/);
  const artifact = { path: 'runs/output.json', sha256: 'b'.repeat(64), size: 9, mediaType: 'application/json' };
  assert.deepEqual(createJob({ id: 'artifact-job', projectId: 'p', operation: 'export', artifacts: [artifact] }).artifacts, [artifact]);
  assert.throws(() => createJob({ id: 'bad-artifact', projectId: 'p', operation: 'export', artifacts: [{ ...artifact, path: '../escape' }] }), /safe references/);
  assert.throws(() => createJob({ id: 'bad-artifact-size', projectId: 'p', operation: 'export', artifacts: [{ ...artifact, size: 268435457 }] }), /safe references/);
});

test('job cancellation is explicit and terminal', () => {
  let queued = createJob({ id: 'job-queued', projectId: 'project-1', operation: 'check' });
  queued = requestCancel(queued);
  assert.equal(queued.state, 'cancelled');
  let running = createJob({ id: 'job-running', projectId: 'project-1', operation: 'simulate' });
  running = transitionJob(running, 'preparing');
  running = transitionJob(running, 'running');
  running = requestCancel(running);
  assert.equal(running.state, 'cancelling');
  assert.equal(transitionJob(running, 'succeeded').state, 'succeeded');
  assert.equal(completeCancellation(running).state, 'cancelled');
});

test('ngspice parser preserves scalar measurements and rejects oversized output', () => {
  const result = parseNgspiceMeasurements('V(out) = 6\nI(R1) = -3e-3\nignored text');
  assert.deepEqual(result.measurements, { 'V(out)': 6, 'I(R1)': -0.003 });
  assert.throws(() => parseNgspiceMeasurements('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
  assert.throws(() => parseNgspiceMeasurements('€'.repeat(2 * 1024 * 1024)), /exceeds/);
});

test('ngspice parser converts bounded ASCII tables into common result rows', () => {
  const result = parseNgspiceOutput('Index time v(out)\n------------------------\n0 0 0\n1 1e-3 4.5\n2 2e-3 6');
  assert.deepEqual(result, { kind: 'table', columns: ['time', 'v(out)'], rows: [[0, 0], [0.001, 4.5], [0.002, 6]], units: 'SI' });
  assert.throws(() => parseNgspiceOutput('Index time v(out)\n0 0 not-a-number'), /malformed row/);
});

test('ngspice version parser retains the exact bounded engine version', () => {
  assert.equal(parseNgspiceVersion('ngspice-45 : Circuit level simulation program'), '45');
  assert.equal(parseNgspiceVersion('***** ngspice 44.2.1 shared'), '44.2.1');
  assert.throws(() => parseNgspiceVersion('unknown simulator'), /not recognized/);
});

test('ngspice failure parser emits bounded source-linked diagnostics', () => {
  const diagnostics = parseNgspiceDiagnostics('Warning: singular matrix: check node out\ndoAnalyses: TRAN: Timestep too small; trouble with r1-instance');
  assert.equal(diagnostics[0].code, 'NGSPICE_SINGULAR_MATRIX');
  assert.equal(diagnostics[1].code, 'NGSPICE_TIMESTEP');
  assert.equal(diagnostics[1].source, 'r1');
  assert.equal(parseNgspiceDiagnostics('unclassified native failure')[0].code, 'NGSPICE_ENGINE_FAILURE');
  assert.throws(() => parseNgspiceDiagnostics('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('ngspice adapter prepares deterministic netlists and uses injected runner only', async () => {
  const calls = [];
  const adapter = createNgspiceAdapter({ executable: 'C:\\tools\\ngspice.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: 'V(out) = 6\n' }; } });
  const job = createJob({ id: 'job-ng', projectId: 'p1', operation: 'operating-point' });
  Object.assign(job, { components: [{ id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: '0' }, { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: '0' }], wires: [] });
  await adapter.validate(job);
  const prepared = await adapter.prepare(job);
  assert.match(prepared.netlist, /V1 vcc 0 9/);
  assert.match(prepared.netlist, /\.op\n\.control\nrun\nprint v\(vcc\)\n\.endc\n\.end/);
  await adapter.run(job);
  assert.deepEqual((await adapter.parse(job)).measurements, { 'V(out)': 6 });
  assert.deepEqual(calls[0].args, ['-b']);
  assert.match(calls[0].netlist, /R1 vcc 0 1000/);
});

test('ngspice adapter emits bounded deterministic analysis directives', async () => {
  const components = [{ id: 'V1', type: 'voltage', label: 'V1', value: 5, unit: 'V', n1: 'in', n2: '0' }];
  const adapter = createNgspiceAdapter();
  assert.match((await adapter.prepare({ operation: 'transient', components, stepTime: 1e-5, stopTime: 1e-2 })).netlist, /\.tran 0\.00001 0\.01\n\.print tran v\(in\)/);
  const ac = (await adapter.prepare({ operation: 'ac-analysis', components, source: 'V1', points: 10, startHz: 10, stopHz: 100000 })).netlist;
  assert.match(ac, /^V1 in 0 5 AC 1$/m);
  assert.match(ac, /\.ac dec 10 10 100000\n\.print ac vm\(in\) vp\(in\)/);
  assert.match((await adapter.prepare({ operation: 'dc-sweep', components, source: 'V1', start: 0, stop: 5, step: 0.5 })).netlist, /\.dc V1 0 5 0\.5\n\.print dc v\(in\)/);
  await assert.rejects(adapter.prepare({ operation: 'transient', components, stepTime: 1, stopTime: 0.5 }), /transient parameters/);
  await assert.rejects(adapter.prepare({ operation: 'ac-analysis', components, startHz: 100, stopHz: 10 }), /AC sweep/);
  await assert.rejects(adapter.prepare({ operation: 'dc-sweep', components: [] }), /source reference/);
  assert.match((await adapter.prepare({ operation: 'dc-sweep', components: [{ ...components[0], id: 'source1' }], source: 'source1' })).netlist, /\.dc Vsource1 0 5 0\.1/);
});

test('ngspice operating-point parser accepts the engine lowercase vector spelling', () => {
  assert.deepEqual(parseNgspiceMeasurements('v(out) = 6.25\n').measurements, { 'v(out)': 6.25 });
});

test('ngspice adapter forwards cancellation to an injected runner', async () => {
  let aborted = false;
  const adapter = createNgspiceAdapter({ executable: 'C:\\tools\\ngspice.exe', runner: ({ signal }) => new Promise((resolve) => {
    signal.addEventListener('abort', () => { aborted = true; resolve({ ok: false, error: 'PROCESS_CANCELLED' }); }, { once: true });
  }) });
  const job = createJob({ id: 'job-ng-cancel', projectId: 'p1', operation: 'transient' });
  Object.assign(job, { components: [], wires: [] });
  await adapter.prepare(job);
  const pending = adapter.run(job);
  await adapter.cancel(job);
  await assert.rejects(pending, /cancelled|failed/);
  assert.equal(aborted, true);
});

test('ngspice adapter normalizes runner rejection after cancellation and releases the controller', async () => {
  let aborted = false;
  const adapter = createNgspiceAdapter({ executable: 'C:\\tools\\ngspice.exe', runner: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('runner aborted')); }, { once: true });
  }) });
  await adapter.prepare({ operation: 'transient', components: [], wires: [] });
  const pending = adapter.run({ operation: 'transient' });
  await adapter.cancel({ operation: 'transient' });
  await assert.rejects(pending, (error) => error?.code === 'PROCESS_CANCELLED');
  assert.equal(aborted, true);
  await adapter.cancel({ operation: 'transient' });
});

test('ngspice adapter rejects overlapping runs instead of sharing mutable run state', async () => {
  let release;
  const adapter = createNgspiceAdapter({ executable: 'C:\\tools\\ngspice.exe', runner: () => new Promise((resolve) => { release = () => resolve({ ok: true, stdout: 'V(out) = 6\\n' }); }) });
  await adapter.prepare({ operation: 'operating-point', components: [], wires: [] });
  const first = adapter.run({ operation: 'operating-point' });
  await assert.rejects(() => adapter.run({ operation: 'operating-point' }), (error) => error?.code === 'ENGINE_BUSY');
  release();
  await first;
});

test('engine adapters reject relative executable paths before invoking runners', async () => {
  const runner = async () => ({ ok: true, stdout: '' });
  const ngspice = createNgspiceAdapter({ executable: 'ngspice', runner });
  await ngspice.prepare({ operation: 'operating-point', components: [], wires: [] });
  await assert.rejects(() => ngspice.run({ operation: 'operating-point' }), /absolute/);
  const arduino = createArduinoCliAdapter({ executable: 'arduino-cli', runner });
  await arduino.prepare({ operation: 'version' });
  await assert.rejects(() => arduino.run({ operation: 'version' }), /absolute/);
  const kicad = createKiCadAdapter({ executable: 'kicad-cli', runner });
  await kicad.prepare({ operation: 'pcb-check', projectPath: 'C:\\projects\\board.kicad_pcb' });
  await assert.rejects(() => kicad.run({ operation: 'pcb-check' }), /absolute/);
});

test('Arduino CLI parser links compiler diagnostics and memory usage', () => {
  const result = parseArduinoDiagnostics('src/main.ino:7:3: error: expected \'｝\'\nSketch uses 1234 bytes (4%) of program storage space. Maximum is 30720 bytes.\nGlobal variables use 42 bytes (2%) of dynamic memory, leaving 2006 bytes for local variables. Maximum is 2048 bytes.');
  assert.equal(result.diagnostics[0].source, 'src/main.ino');
  assert.equal(result.diagnostics[0].line, 7);
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.deepEqual(result.memory.flash, { used: 1234, capacity: 30720 });
  assert.deepEqual(result.memory.ram, { used: 42, capacity: 2048 });
});

test('Arduino CLI parses bounded local board, core, library and version inventory', () => {
  assert.deepEqual(parseArduinoInventory('{"boards":[{"name":"Arduino Uno","fqbn":"arduino:avr:uno"}]}', 'boards').items, [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }]);
  assert.deepEqual(parseArduinoInventory('{"platforms":[{"id":"arduino:avr","name":"Arduino AVR Boards","installed_version":"1.8.6","latest_version":"1.8.6"}]}', 'cores').items[0], { id: 'arduino:avr', name: 'Arduino AVR Boards', installedVersion: '1.8.6', latestVersion: '1.8.6' });
  assert.deepEqual(parseArduinoInventory('{"installed_libraries":[{"library":{"name":"Servo","version":"1.2.2","location":"C:/Arduino/libraries/Servo"}}]}', 'libraries').items[0], { name: 'Servo', version: '1.2.2', location: 'C:/Arduino/libraries/Servo' });
  assert.equal(parseArduinoCliVersion('arduino-cli Version: 1.3.1 Commit: abc'), '1.3.1');
  assert.throws(() => parseArduinoInventory('{"boards":[{"name":"bad","fqbn":"not-a-fqbn"}]}', 'boards'), /invalid board/);
  assert.throws(() => parseArduinoInventory('not json', 'boards'), /valid JSON/);
});

test('Arduino CLI local inventory avoids attached-device discovery and mutation commands', async () => {
  const adapter = createArduinoCliAdapter();
  assert.deepEqual((await adapter.prepare({ operation: 'board-inventory' })).arguments, ['board', 'listall', '--json']);
  assert.deepEqual((await adapter.prepare({ operation: 'core-inventory' })).arguments, ['core', 'list', '--json']);
  assert.deepEqual((await adapter.prepare({ operation: 'library-inventory' })).arguments, ['lib', 'list', '--json']);
  assert.equal(adapter.capabilities().includes('board-list'), false);
  assert.equal(adapter.capabilities().some((operation) => operation.includes('install')), false);
});

test('Arduino CLI adapter requires explicit target identity and uses safe argument arrays', async () => {
  const calls = [];
  const adapter = createArduinoCliAdapter({ executable: 'C:\\tools\\arduino-cli.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: 'Sketch uses 10 bytes. Maximum is 20 bytes.' }; } });
  const job = createJob({ id: 'job-arduino', projectId: 'p1', operation: 'compile' });
  Object.assign(job, { board: 'arduino:avr:uno', sketchPath: 'C:\\projects\\blink' });
  await adapter.prepare(job);
  await adapter.run(job);
  assert.deepEqual(calls[0].args, ['compile', '--fqbn', 'arduino:avr:uno', 'C:\\projects\\blink']);
  await assert.rejects(adapter.prepare({ operation: 'upload', port: 'COM4', sketchPath: 'C:\\projects\\blink' }), /explicit board FQBN/);
  await assert.rejects(adapter.prepare({ operation: 'upload', board: 'arduino:avr:uno', sketchPath: 'C:\\projects\\blink' }), /explicit port/);
});

test('Arduino CLI compile confines explicit build output through a separate argument', async () => {
  const adapter = createArduinoCliAdapter();
  const prepared = await adapter.prepare({ operation: 'compile', board: 'arduino:avr:uno', sketchPath: 'C:\\project\\runs\\one\\sketch', buildPath: 'C:\\project\\runs\\one\\build' });
  assert.deepEqual(prepared.arguments, ['compile', '--fqbn', 'arduino:avr:uno', '--build-path', 'C:\\project\\runs\\one\\build', 'C:\\project\\runs\\one\\sketch']);
  await assert.rejects(adapter.prepare({ operation: 'compile', board: 'arduino:avr:uno', sketchPath: 'C:\\project\\sketch', buildPath: 'relative' }), /build output/);
});

test('engineering adapters reject oversized or control-character job inputs before preparation', async () => {
  const arduino = createArduinoCliAdapter();
  await assert.rejects(arduino.prepare({ operation: 'compile', board: 'x'.repeat(201), sketchPath: 'C:\\projects\\blink' }), /bounded board/);
  await assert.rejects(arduino.prepare({ operation: 'monitor', port: 'COM4', baud: 0 }), /baud/);
  const kicad = createKiCadAdapter();
  await assert.rejects(kicad.prepare({ operation: 'pcb-check', projectPath: `C:\\${'x'.repeat(32 * 1024)}` }), /bounded absolute/);
  const ngspice = createNgspiceAdapter();
  await assert.rejects(ngspice.prepare({ operation: 'operating-point', title: 'x'.repeat(201), components: [], wires: [] }), /title/);
  await assert.rejects(ngspice.prepare({ operation: 'operating-point', components: Array.from({ length: 10001 }, () => ({})), wires: [] }), /bounded canonical/);
});

test('adapter self-tests do not claim configured engines when executable runners are absent', async () => {
  const ngspice = await createNgspiceAdapter().selfTest();
  const arduino = await createArduinoCliAdapter().selfTest();
  const kicad = await createKiCadAdapter().selfTest();
  for (const result of [ngspice, arduino, kicad]) {
    assert.equal(result.ok, false);
    assert.equal(result.available, false);
    assert.equal(result.reason, 'engine-not-configured');
    assert.equal(typeof result.evidence, 'string');
  }
  const configured = await createNgspiceAdapter({ executable: 'C:\\tools\\ngspice.exe', runner: async () => ({ ok: true, stdout: '' }) }).selfTest();
  assert.equal(configured.ok, true);
  assert.equal(configured.available, true);
});

test('Arduino CLI adapter normalizes cancellation and rejects overlapping runs', async () => {
  let release;
  let aborted = false;
  const adapter = createArduinoCliAdapter({ executable: 'C:\\tools\\arduino-cli.exe', runner: ({ signal }) => new Promise((resolve, reject) => {
    release = () => resolve({ ok: true, stdout: '' });
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('runner aborted')); }, { once: true });
  }) });
  await adapter.prepare({ operation: 'version' });
  const first = adapter.run({ operation: 'version' });
  await assert.rejects(() => adapter.run({ operation: 'version' }), (error) => error?.code === 'ENGINE_BUSY');
  await adapter.cancel({ operation: 'version' });
  await assert.rejects(first, (error) => error?.code === 'PROCESS_CANCELLED');
  assert.equal(aborted, true);
  release = null;
});

test('Arduino hardware operations require distinct explicit permission grants', async () => {
  const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['programmer', 'serial'] });
  const adapter = createArduinoCliAdapter({ executable: 'C:\\tools\\arduino-cli.exe', permissionPolicy: policy, runner: async () => ({ ok: true, stdout: '' }) });
  const upload = { operation: 'upload', board: 'arduino:avr:uno', port: 'COM4', sketchPath: 'C:\\projects\\blink', buildPath: 'C:\\projects\\build' };
  await assert.rejects(adapter.prepare(upload), /required/);
  policy.selectTarget('programmer', 'COM4');
  assert.deepEqual(await adapter.prepare(upload), { arguments: ['upload', '-p', 'COM4', '--fqbn', 'arduino:avr:uno', '--input-dir', 'C:\\projects\\build', 'C:\\projects\\blink'] });
  const monitor = { operation: 'monitor', port: 'COM4', baud: 115200 };
  await assert.rejects(adapter.prepare(monitor), /required/);
  policy.selectTarget('serial', 'COM4');
  await adapter.prepare(monitor);
});

test('KiCad adapter maps supported operations to safe arguments and parses reports', async () => {
  const calls = [];
  const adapter = createKiCadAdapter({ executable: 'C:\\tools\\kicad-cli.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: '[warning] missing footprint' }; } });
  const job = createJob({ id: 'job-kicad', projectId: 'p1', operation: 'pcb-check' }); Object.assign(job, { projectPath: 'C:\\projects\\board.kicad_pcb' });
  await adapter.prepare(job); await adapter.run(job); assert.deepEqual(calls[0].args, ['pcb', 'drc', 'C:\\projects\\board.kicad_pcb']); assert.equal((await adapter.parse(job)).diagnostics[0].severity, 'warning');
  await assert.rejects(adapter.prepare({ operation: 'bom', projectPath: '..\\board' }), /absolute/);
  assert.throws(() => parseKiCadReport('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('KiCad adapter converts runner aborts into stable cancellation errors', async () => {
  let signal;
  const adapter = createKiCadAdapter({ executable: 'C:\\tools\\kicad-cli.exe', runner: async (spec) => {
    signal = spec.signal;
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    return { ok: false };
  } });
  await adapter.prepare({ operation: 'pcb-check', projectPath: 'C:\\projects\\board.kicad_pcb' });
  const running = adapter.run({ operation: 'pcb-check' });
  await new Promise((resolve) => setImmediate(resolve));
  await adapter.cancel({ operation: 'pcb-check' });
  await assert.rejects(running, (error) => error?.code === 'PROCESS_CANCELLED');
  assert.equal(signal.aborted, true);
});

test('KiCad adapter rejects overlapping runs and releases its busy state', async () => {
  let release;
  const adapter = createKiCadAdapter({ executable: 'C:\\tools\\kicad-cli.exe', runner: () => new Promise((resolve) => { release = () => resolve({ ok: true, stdout: '' }); }) });
  await adapter.prepare({ operation: 'pcb-check', projectPath: 'C:\\projects\\board.kicad_pcb' });
  const first = adapter.run({ operation: 'pcb-check' });
  await assert.rejects(() => adapter.run({ operation: 'pcb-check' }), (error) => error?.code === 'ENGINE_BUSY');
  release();
  await first;
  const second = adapter.run({ operation: 'pcb-check' });
  release();
  await second;
  release = null;
});

test('Verilator adapter validates HDL sources, prepares deterministic arguments, and parses diagnostics', async () => {
  const calls = [];
  const adapter = createVerilatorAdapter({ executable: 'C:\\tools\\verilator.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: 'src/top.sv:12:4: %Warning-WIDTH: width mismatch' }; } });
  const job = createJob({ id: 'job-verilator', projectId: 'p1', operation: 'lint' });
  Object.assign(job, { sources: ['C:\\projects\\top.sv'], topUnit: 'top' });
  await adapter.prepare(job); await adapter.run(job);
  assert.deepEqual(calls[0].args, ['--lint-only', '--top-module', 'top', 'C:\\projects\\top.sv']);
  const report = await adapter.parse(job);
  assert.equal(report.diagnostics[0].severity, 'warning');
  assert.equal(report.diagnostics[0].source, 'src/top.sv');
  assert.equal(report.diagnostics[0].line, 12);
  await assert.rejects(adapter.prepare({ operation: 'lint', sources: ['relative.sv'], topUnit: 'top' }), /absolute/);
  await assert.rejects(adapter.prepare({ operation: 'lint', sources: ['C:\\projects\\top.sv'], topUnit: 'bad-unit!' }), /top unit/);
  assert.throws(() => parseVerilatorDiagnostics('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('Verilator parser accepts engine-first diagnostics with source locations', () => {
  const report = parseVerilatorDiagnostics('%Error-PINMISSING: C:\\projects\\counter.sv:12:4: Cell has missing pin\n%Warning: src/top.sv:8:2: unused signal');
  assert.deepEqual(report.diagnostics[0], { severity: 'error', code: 'VERILATOR_PINMISSING', message: 'Cell has missing pin', source: 'C:\\projects\\counter.sv', line: 12, column: 4, fix: null });
  assert.equal(report.diagnostics[1].code, 'VERILATOR_WARNING');
  assert.equal(report.diagnostics[1].source, 'src/top.sv');
});

test('Verilator adapter self-test and cancellation remain honest', async () => {
  const missing = await createVerilatorAdapter().selfTest();
  assert.equal(missing.ok, false);
  let signal;
  const adapter = createVerilatorAdapter({ executable: 'C:\\tools\\verilator.exe', runner: async (spec) => { signal = spec.signal; await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); return { ok: false }; } });
  await adapter.prepare({ operation: 'simulate', sources: ['C:\\projects\\top.sv'], topUnit: 'top' });
  const running = adapter.run({ operation: 'simulate' });
  await new Promise((resolve) => setImmediate(resolve));
  await adapter.cancel({ operation: 'simulate' });
  await assert.rejects(running, (error) => error?.code === 'PROCESS_CANCELLED');
  assert.equal(signal.aborted, true);
});

test('GHDL adapter prepares safe VHDL operations and parses source diagnostics', async () => {
  const calls = [];
  const adapter = createGhdlAdapter({ executable: 'C:\\tools\\ghdl.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stderr: 'src/top.vhd:8:2:error: missing semicolon' }; } });
  const job = createJob({ id: 'job-ghdl', projectId: 'p1', operation: 'analyze' });
  Object.assign(job, { sources: ['C:\\projects\\top.vhd'], topEntity: 'top' });
  await adapter.prepare(job); await adapter.run(job);
  assert.deepEqual(calls[0].args, ['-a', '--std=08', 'C:\\projects\\top.vhd']);
  const report = await adapter.parse(job);
  assert.equal(report.diagnostics[0].severity, 'error');
  assert.equal(report.diagnostics[0].source, 'src/top.vhd');
  assert.equal(report.diagnostics[0].line, 8);
  await adapter.prepare({ operation: 'elaborate', sources: ['C:\\projects\\top.vhd'], topEntity: 'top' });
  assert.deepEqual((await adapter.prepare({ operation: 'simulate', sources: ['C:\\projects\\top.vhd'], topEntity: 'top', waveformPath: 'C:\\projects\\top.vcd', stopTimeNs: 500 })).arguments, ['-r', '--std=08', 'top', '--vcd=C:\\projects\\top.vcd', '--stop-time=500ns']);
  await assert.rejects(adapter.prepare({ operation: 'simulate', sources: ['C:\\projects\\top.vhd'], topEntity: 'top', stopTimeNs: 0 }), /stop time/);
  await assert.rejects(adapter.prepare({ operation: 'analyze', sources: ['relative.vhd'], topEntity: 'top' }), /absolute/);
  assert.throws(() => parseGhdlDiagnostics('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('GHDL adapter does not claim an unavailable engine', async () => {
  const result = await createGhdlAdapter().selfTest();
  assert.deepEqual({ ok: result.ok, available: result.available, reason: result.reason }, { ok: false, available: false, reason: 'engine-not-configured' });
});

test('Yosys adapter builds fixed synthesis scripts from validated paths and parses utilization', async () => {
  const calls = [];
  const adapter = createYosysAdapter({ executable: 'C:\\tools\\yosys.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: 'Number of wires: 12\nNumber of wire bits: 18\nNumber of cells: 4' }; } });
  const job = createJob({ id: 'job-yosys', projectId: 'p1', operation: 'synthesis' });
  Object.assign(job, { sources: ['C:\\projects\\top.sv'], topModule: 'top', netlistPath: 'C:\\projects\\top.json' });
  await adapter.prepare(job); await adapter.run(job);
  assert.equal(calls[0].args[0], '-p');
  assert.match(calls[0].args[1], /read_verilog -sv/);
  assert.match(calls[0].args[1], /hierarchy -top top/);
  assert.match(calls[0].args[1], /write_json "C:\\\\projects\\\\top\.json"/);
  assert.deepEqual((await adapter.parse(job)).metrics, { wires: 12, wireBits: 18, cells: 4 });
  assert.throws(() => parseYosysReport('synthesis completed without stat output'), /utilization report/);
  await assert.rejects(adapter.prepare({ operation: 'report', sources: ['relative.sv'], topModule: 'top' }), /absolute/);
  await assert.rejects(adapter.prepare({ operation: 'report', sources: Array.from({ length: 3 }, () => `C:\\${'x'.repeat(24 * 1024)}`), topModule: 'top' }), /script exceeds/);
  assert.throws(() => parseYosysReport('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('Yosys adapter self-test remains unavailable without configuration', async () => {
  const result = await createYosysAdapter().selfTest();
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'engine-not-configured');
});

test('nextpnr adapter blocks unsupported targets before preparing place-route arguments', async () => {
  const calls = [];
  const adapter = createNextpnrAdapter({ executable: 'C:\\tools\\nextpnr-ice40.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: 'device: hx8k\nMax frequency: 48.2 MHz\n12 BELs used' }; } });
  const job = { operation: 'place-route', target: 'ice40', package: 'ct256', netlistPath: 'C:\\runs\\design.json', constraintsPath: 'C:\\runs\\design.pcf', outputPath: 'C:\\runs\\design.asc' };
  const prepared = await adapter.prepare(job); await adapter.run(job);
  assert.deepEqual(prepared.arguments, ['--hx8k', '--package', 'ct256', '--json', job.netlistPath, '--pcf', job.constraintsPath, '--asc', job.outputPath]);
  assert.deepEqual(calls[0].args, prepared.arguments);
  assert.deepEqual(await adapter.parse(job), { kind: 'report', target: 'hx8k', timingMHz: 48.2, belsUsed: 12 });
  await assert.rejects(adapter.prepare({ ...job, target: 'ecp5' }), /unsupported/);
  await assert.rejects(adapter.prepare({ ...job, package: 'tq144' }), /package is unsupported/);
  assert.throws(() => parseNextpnrReport('completed without report data'), /implementation report/);
  assert.throws(() => parseNextpnrReport('x'.repeat(2 * 1024 * 1024 + 1)), /exceeds/);
});

test('nextpnr adapter self-test remains unavailable without configuration', async () => {
  const result = await createNextpnrAdapter().selfTest();
  assert.equal(result.ok, false);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'engine-not-configured');
});

test('QucsatorRF adapter prepares bounded RF jobs and parses dataset reports', async () => {
  const calls = [];
  const adapter = createQucsatorRfAdapter({ executable: 'C:\\tools\\qucsator_rf.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: '<?xml version="1.0"?><QucsDataset/>\n[warning] fixture warning' }; } });
  await adapter.validate({ operation: 'simulate', netlistPath: 'C:\\projects\\rf.net', outputPath: 'C:\\projects\\rf.dat' });
  const prepared = await adapter.prepare({ operation: 'simulate', netlistPath: 'C:\\projects\\rf.net', outputPath: 'C:\\projects\\rf.dat' });
  assert.deepEqual(prepared.arguments, ['-i', 'C:\\projects\\rf.net', '-o', 'C:\\projects\\rf.dat']);
  await adapter.run({ operation: 'simulate' });
  const report = await adapter.parse();
  assert.equal(report.dataset, true);
  assert.equal(report.diagnostics[0].severity, 'warning');
  assert.equal(calls[0].shell, false);
  assert.equal((await adapter.selfTest()).available, true);
});

test('QucsatorRF adapter stays unavailable without configuration and rejects unsafe paths', async () => {
  const adapter = createQucsatorRfAdapter();
  assert.equal((await adapter.selfTest()).reason, 'engine-not-configured');
  assert.throws(() => adapter.validate({ operation: 'simulate', netlistPath: '../rf.net', outputPath: 'C:\\out.dat' }), /absolute netlist/);
  assert.throws(() => parseQucsatorRfReport('x'.repeat(8 * 1024 * 1024 + 1)), /exceeds/);
});

test('TShark adapter decodes only explicitly selected saved captures with bounded filters', async () => {
  const calls = [];
  const adapter = createTsharkAdapter({ executable: 'C:\\tools\\tshark.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: '[{"_source":{"layers":{"frame":{"frame.number":"1"}}}}]', stderr: 'warning: fixture warning' }; } });
  const job = { operation: 'decode-saved', capturePath: 'C:\\captures\\sample.pcapng', displayFilter: 'tcp.port == 80', maxPackets: 10 };
  await adapter.validate(job);
  assert.deepEqual((await adapter.prepare(job)).arguments, ['-r', 'C:\\captures\\sample.pcapng', '-Y', 'tcp.port == 80', '-T', 'json', '-c', '10']);
  await adapter.run(job);
  const parsed = await adapter.parse(job);
  assert.equal(parsed.result.packets.length, 1);
  assert.equal(parsed.diagnostics[0].severity, 'warning');
  assert.equal(calls[0].shell, false);
});

test('TShark adapter rejects live-interface-shaped or oversized requests', async () => {
  const adapter = createTsharkAdapter();
  assert.equal((await adapter.selfTest()).available, false);
  assert.throws(() => adapter.validate({ operation: 'capture-live', capturePath: 'C:\\captures\\x.pcap' }), /unsupported/);
  await assert.rejects(adapter.prepare({ operation: 'decode-saved', capturePath: 'relative.pcap', displayFilter: '' }), /absolute/);
  assert.throws(() => parseTsharkJson('[]' + 'x'.repeat(32 * 1024 * 1024)), /exceeds|malformed/);
  assert.throws(() => parseTsharkDiagnostics('warning: ' + 'x'.repeat(32 * 1024 * 1024)), /oversized/);
});

test('PlatformIO adapter prepares compile-only jobs and parses source diagnostics', async () => {
  const calls = [];
  const adapter = createPlatformIoAdapter({ executable: 'C:\\tools\\pio.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stderr: 'src/main.cpp:7:3: error: missing semicolon' }; } });
  const job = { operation: 'compile', projectPath: 'C:\\projects\\blink', environment: 'uno' };
  await adapter.validate(job);
  assert.deepEqual((await adapter.prepare(job)).arguments, ['run', '--project-dir', 'C:\\projects\\blink', '--environment', 'uno']);
  await adapter.run(job);
  assert.equal((await adapter.parse()).diagnostics[0].source, 'src/main.cpp');
  assert.equal(calls[0].shell, false);
  assert.deepEqual((await adapter.prepare({ operation: 'version' })).arguments, ['--version']);
});

test('PlatformIO adapter stays unavailable and rejects upload-shaped operations', async () => {
  const adapter = createPlatformIoAdapter();
  assert.equal((await adapter.selfTest()).reason, 'engine-not-configured');
  assert.throws(() => adapter.validate({ operation: 'upload', projectPath: 'C:\\projects\\x', environment: 'uno' }), /unsupported/);
  await assert.rejects(adapter.prepare({ operation: 'compile', projectPath: 'relative', environment: 'uno' }), /absolute/);
  assert.throws(() => parsePlatformIoDiagnostics('x'.repeat(4 * 1024 * 1024 + 1)), /exceeds/);
});

test('Renode adapter prepares explicit simulation scripts and parses diagnostics', async () => {
  const calls = [];
  const adapter = createRenodeAdapter({ executable: 'C:\\tools\\renode.exe', runner: async (spec) => { calls.push(spec); return { ok: true, stdout: '[INFO] emulation started\n[WARNING] fixture warning' }; } });
  const job = { operation: 'simulate', scriptPath: 'C:\\projects\\board.resc', machine: 'demo-machine' };
  await adapter.validate(job);
  assert.deepEqual((await adapter.prepare(job)).arguments, ['--console', '--disable-xwt', 'C:\\projects\\board.resc']);
  await adapter.run(job);
  assert.equal((await adapter.parse()).diagnostics[0].severity, 'info');
  assert.equal(calls[0].shell, false);
});

test('Renode adapter rejects unsupported operations and unsafe scripts', async () => {
  const adapter = createRenodeAdapter();
  assert.equal((await adapter.selfTest()).available, false);
  assert.throws(() => adapter.validate({ operation: 'upload', scriptPath: 'C:\\x.resc', machine: 'm' }), /unsupported/);
  await assert.rejects(adapter.prepare({ operation: 'simulate', scriptPath: 'relative.resc', machine: 'm' }), /absolute/);
  assert.throws(() => parseRenodeDiagnostics('x'.repeat(4 * 1024 * 1024 + 1)), /exceeds/);
});

test('device permission policy keeps scopes separate and denies browser hardware access', () => {
  const browser = createDevicePermissionPolicy({ environment: 'browser' });
  assert.throws(() => browser.selectTarget('serial', 'COM4'), /unavailable/);
  const desktop = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['serial', 'capture'] });
  desktop.selectTarget('serial', 'COM4');
  desktop.selectTarget('capture', 'COM4');
  assert.throws(() => desktop.assertGranted('usb', 'COM4'), /required/);
  assert.equal(desktop.assertGranted('serial', 'COM4'), true);
  assert.equal(desktop.assertGranted('capture', 'COM4'), true);
  desktop.revokeTarget('COM4');
  assert.throws(() => desktop.assertGranted('serial', 'COM4'), /required/);
  assert.equal(desktop.inspect().find((entry) => entry.permission === 'debug').allowed, false);
});

test('serial sessions require an explicit grant and bound retained terminal data', () => {
  const browser = createDevicePermissionPolicy({ environment: 'browser' });
  const denied = createSerialSession({ permissionPolicy: browser, target: 'COM4' });
  assert.throws(() => denied.connect(), (error) => error.code === 'DEVICE_PERMISSION_REQUIRED');

  const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['serial'] });
  policy.selectTarget('serial', 'COM4');
  const session = createSerialSession({ permissionPolicy: policy, target: 'COM4', maxBufferBytes: 1024, now: () => '2026-09-28T00:00:00.000Z' });
  assert.equal(session.connect().state, 'connected');
  session.ingest('a'.repeat(700));
  const bounded = session.ingest('b'.repeat(700));
  assert.equal(bounded.frames.length, 1);
  assert.equal(bounded.bufferBytes, 700);
  assert.equal(bounded.droppedBytes, 700);
  assert.match(session.exportText(), /^\[2026-09-28T00:00:00\.000Z\] b/);
  assert.equal(session.formatTransmit('status'), 'status\n');
  assert.throws(() => session.ingest('x'.repeat(16 * 1024 + 1)), /16 KiB/);
  assert.equal(session.setPaused(true).paused, true);
  assert.equal(session.close().state, 'closed');
  assert.throws(() => session.connect(), (error) => error.code === 'SERIAL_CLOSED');
});

test('serial reconnect state is explicit and bounded', () => {
  const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['serial'] });
  policy.selectTarget('serial', 'ttyUSB0');
  const session = createSerialSession({ permissionPolicy: policy, target: 'ttyUSB0', maxReconnectAttempts: 2 });
  session.connect();
  assert.equal(session.disconnect({ unexpected: true }).state, 'reconnecting');
  assert.equal(session.reconnect().reconnectAttempts, 1);
  assert.equal(session.markReconnectFailed().state, 'reconnecting');
  assert.equal(session.reconnect().reconnectAttempts, 2);
  assert.equal(session.markReconnectFailed().state, 'disconnected');
  assert.throws(() => session.reconnect(), (error) => error.code === 'SERIAL_NOT_RECONNECTING');
});

test('engine adapter contract requires every lifecycle method', () => {
  const methods = ['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'];
  const adapter = Object.fromEntries(methods.map((method) => [method, () => ({})]));
  assert.equal(createAdapter(adapter), adapter);
  assert.throws(() => createAdapter({ ...adapter, parse: undefined }), /missing parse/);
});

test('browser-loaded adapter discovery has no eager Node filesystem dependency', async () => {
  const source = await readFile(new URL('../packages/engine-sdk/src/discovery.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import .*node:fs/m);
  assert.match(source, /import\('node:fs\/promises'\)/);
  assert.match(source, /NATIVE_DISCOVERY_UNAVAILABLE/);
});

test('stable engine SDK entry point exposes discovery and manifest validation', async () => {
  assert.equal((await probeExecutable({ id: 'fixture', candidates: ['relative-tool'] })).status, 'missing');
  assert.equal(validateEngineManifest({ id: 'fixture', name: 'Fixture', license: 'MIT', sourceUrl: 'https://example.test', integration: 'process', operations: ['check'], platforms: ['windows'] }).id, 'fixture');
});

test('adapter job orchestration records successful parsed results', async () => {
  const calls = [];
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => { calls.push(method); return method === 'parse' ? { value: 6, units: 'V' } : {}; }])));
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-success', projectId: 'p', operation: 'measure' }));
  assert.equal(job.state, 'succeeded');
  assert.deepEqual(job.result, { value: 6, units: 'V' });
  assert.deepEqual(calls, ['metadata', 'validate', 'prepare', 'run', 'parse', 'clean']);
});

test('adapter job orchestration retains bounded structured run events', async () => {
  const observed = [];
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.run = async (_job, emit) => { emit({ phase: 'running', progress: 0.5 }); emit('unstructured-event'); };
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-logs', projectId: 'p', operation: 'measure' }), (event) => observed.push(event));
  assert.deepEqual(observed, [{ phase: 'running', progress: 0.5 }, 'unstructured-event']);
  assert.deepEqual(job.logs, [{ phase: 'running', progress: 0.5 }, 'unstructured-event']);
});

test('adapter job orchestration bounds individual retained event size', async () => {
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.run = async (_job, emit) => emit({ payload: 'x'.repeat(70 * 1024) });
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-large-event', projectId: 'p', operation: 'measure' }));
  assert.deepEqual(job.logs, [{ message: 'Engine event exceeded the retained log-entry limit.', truncated: true }]);
});

test('adapter job orchestration measures retained Unicode events by UTF-8 bytes', async () => {
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.run = async (_job, emit) => emit({ payload: '€'.repeat(30_000) });
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-unicode-event', projectId: 'p', operation: 'measure' }));
  assert.deepEqual(job.logs, [{ message: 'Engine event exceeded the retained log-entry limit.', truncated: true }]);
});

test('adapter orchestration persists adapter identity and prepared argument provenance', async () => {
  const adapter = createAdapter({
    metadata: () => ({ id: 'fixture-engine', version: '1.2.3' }),
    detect: async () => ({}), selfTest: async () => ({}), capabilities: () => [],
    validate: async () => true,
    prepare: async () => ({ arguments: ['--input', 'project.json'] }),
    run: async () => ({}), parse: async () => ({ kind: 'report' }), cancel: async () => {}, clean: async () => {}
  });
  const result = await executeAdapterJob(adapter, createJob({ id: 'job-provenance', projectId: 'p', operation: 'check' }));
  assert.equal(result.adapter, 'fixture-engine');
  assert.equal(result.engineVersion, '1.2.3');
  assert.deepEqual(result.arguments, ['--input', 'project.json']);
});

test('adapter job orchestration preserves structured failure and cleans up', async () => {
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.validate = async () => { throw Object.assign(new Error('invalid job'), { code: 'INPUT_INVALID' }); };
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-fail', projectId: 'p', operation: 'measure' }));
  assert.equal(job.state, 'failed');
  assert.equal(job.diagnostics[0].code, 'INPUT_INVALID');
});

test('adapter cleanup failure becomes a structured failed job', async () => {
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.clean = async () => { throw Object.assign(new Error('cleanup failed'), { code: 'CLEANUP_FAILED' }); };
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-clean-fail', projectId: 'p', operation: 'measure' }));
  assert.equal(job.state, 'failed');
  assert.equal(job.diagnostics[0].code, 'CLEANUP_FAILED');
});

test('adapter job orchestration cancels through the adapter boundary', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => ({})])));
  adapter.run = () => new Promise(() => {});
  adapter.cancel = async () => { cancelled = true; };
  const pending = executeAdapterJob(adapter, createJob({ id: 'job-cancel', projectId: 'p', operation: 'measure' }), () => {}, { signal: controller.signal });
  controller.abort();
  const job = await pending;
  assert.equal(job.state, 'cancelled');
  assert.equal(cancelled, true);
});

test('adapter orchestration does not prepare an already-cancelled job', async () => {
  const calls = [];
  const adapter = createAdapter(Object.fromEntries(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean'].map((method) => [method, async () => { calls.push(method); return {}; }])));
  const controller = new AbortController();
  controller.abort();
  const job = await executeAdapterJob(adapter, createJob({ id: 'job-pre-cancel', projectId: 'p', operation: 'measure' }), () => {}, { signal: controller.signal });
  assert.equal(job.state, 'cancelled');
  assert.deepEqual(calls, []);
});

test('a browser policy reports and grants no device scope even when given an allowed list', () => {
  const browser = createDevicePermissionPolicy({ environment: 'browser', allowed: ['serial', 'usb', 'programmer'] });
  for (const entry of browser.inspect()) assert.equal(entry.allowed, false, `${entry.permission} is never available in the browser`);
  for (const permission of ['serial', 'usb', 'programmer']) assert.throws(() => browser.selectTarget(permission, 'COM4'), /unavailable in browser preview/);
});
