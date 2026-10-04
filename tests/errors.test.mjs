import test from 'node:test';
import assert from 'node:assert/strict';
import { ConvergenceError, NativeToolError, NumericalError, OpenEntcError, PermissionError, ProjectFormatError, StorageError, TimeoutError, ValidationError, redactDiagnostic, redactText, toUserFacing, createDiagnosticReport } from '../packages/errors/src/index.mjs';

test('every error kind has a stable code, a recovery hint and keeps its legacy base class', () => {
  const kinds = [[ValidationError, 'OPENENTC_VALIDATION', RangeError], [ProjectFormatError, 'OPENENTC_PROJECT_FORMAT', Error], [NumericalError, 'OPENENTC_NUMERICAL', Error], [ConvergenceError, 'OPENENTC_CONVERGENCE', Error], [PermissionError, 'OPENENTC_PERMISSION', Error], [NativeToolError, 'OPENENTC_NATIVE_TOOL', Error], [TimeoutError, 'OPENENTC_TIMEOUT', RangeError], [StorageError, 'OPENENTC_STORAGE', Error]];
  for (const [Kind, code, Base] of kinds) {
    const error = new Kind('Something failed.');
    assert.ok(error instanceof Base, Kind.name);
    assert.equal(error.name, Kind.name);
    assert.equal(error.code, code);
    assert.equal(error.message, 'Something failed.');
    assert.ok(error.recovery && error.recovery.length > 10, `${Kind.name} has a recovery hint`);
  }
  const custom = new NativeToolError('ngspice exited with code 1.', { code: 'ENGINE_EXIT', location: { file: 'circuit.cir', line: 4 }, recovery: 'Fix line 4.' });
  assert.equal(custom.code, 'ENGINE_EXIT');
  assert.deepEqual(custom.location, { file: 'circuit.cir', line: 4 });
  assert.equal(custom.recovery, 'Fix line 4.');
  assert.ok(new OpenEntcError('X', 'y') instanceof Error);
});

test('messages and context are redacted when the error is created', () => {
  const error = new StorageError('Write failed for /home/alice/projects/a.json with key sk-ABCDEFGHIJKLMNOPQRSTU', { context: { apiKey: 'sk-ABCDEFGHIJKLMNOPQRSTU', path: 'C:\\Users\\bob\\x.entcproj', nested: { token: 'abc12345', note: 'Bearer abcdefghijklmnop' } } });
  assert.doesNotMatch(error.message, /alice|sk-ABC/);
  assert.match(error.message, /<home>\/projects\/a\.json/);
  assert.equal(error.context.apiKey, undefined);
  assert.doesNotMatch(JSON.stringify(error.context), /bob|abc12345|abcdefghijklmnop/);
});

test('redactText removes secrets, private paths and stack frames but keeps normal prose', () => {
  const text = 'Failed: api_key=supersecretvalue\nError: boom\n    at run (/home/u/app/src/x.js:10:5)\n    at file:///tmp/a.mjs:1:2\nat least one source is needed\nghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  const out = redactText(text, ['boom']);
  assert.doesNotMatch(out, /supersecretvalue|x\.js:10|a\.mjs|ghp_|boom/);
  assert.match(out, /at least one source is needed/, 'a sentence starting with "at" is not a stack frame');
});

test('redactDiagnostic bounds depth, array length and string size', () => {
  const deep = { a: { b: { c: { d: { e: 1 } } } } };
  assert.equal(redactDiagnostic(deep, { depth: 3 }).a.b.c, '[truncated]');
  assert.equal(redactDiagnostic(Array.from({ length: 100 }, (_, i) => i)).length, 50);
  assert.ok(redactDiagnostic('x'.repeat(5000)).length <= 2001);
  assert.equal(redactDiagnostic(() => 1), undefined);
});

test('toUserFacing turns any thrown value into a safe message with code and recovery', () => {
  const legacy = Object.assign(new Error('Project version 9 is not supported.'), { code: 'PROJECT_UNSUPPORTED_VERSION' });
  assert.deepEqual(toUserFacing(legacy), { code: 'PROJECT_UNSUPPORTED_VERSION', message: 'Project version 9 is not supported.', recovery: 'This project was saved by a newer OpenENTC Studio. Update the app to open it.' });
  assert.equal(toUserFacing(new RangeError('R must be positive.')).code, 'OPENENTC_VALIDATION');
  assert.equal(toUserFacing(new Error('x')).code, 'OPENENTC_UNEXPECTED');
  assert.equal(toUserFacing(null).message, 'Something went wrong.');
  assert.equal(toUserFacing('plain text').message, 'plain text');
  const withStack = new Error('Bad thing at /home/carol/x');
  const shown = toUserFacing(withStack, { secrets: ['carol'] });
  assert.doesNotMatch(JSON.stringify(shown), /carol|stack|\n\s+at /);
  assert.deepEqual(toUserFacing(new ConvergenceError('Did not converge.', { location: { component: 'Q1' } })).location, { component: 'Q1' });
});

test('diagnostic reports copy only allow-listed fields and redact everything else', () => {
  const key = 'sk-live-abcdefghijklmnop1234';
  const project = { format: 'openentc-project', version: 1, name: 'Priya private project', circuit: { components: [{ id: 'R1' }, { id: 'R2' }], wires: [] }, experiments: [{}], notes: [{ text: 'personal note' }], artifacts: [] };
  const report = createDiagnosticReport({
    app: { version: '0.1.0' },
    environment: { userAgent: 'Mozilla/5.0 test', platform: 'Linux', language: 'en', online: true },
    project,
    persistence: { status: 'error', error: 'Could not write C:\\Users\\priya\\Documents\\lab.json' },
    errors: [{ at: '2026-10-04T00:00:00Z', code: 'OPENENTC_STORAGE', message: `failed for priya@example.edu with ${key}\n    at save (file:///home/priya/app.js:1:2)` }],
    toolchains: [{ id: 'ngspice', detected: true, version: '42', path: '/home/priya/bin/ngspice' }],
    assistant: { provider: 'openai', apiKey: key, consented: true, baseUrl: 'https://private.example/v1' },
    now: () => new Date('2026-10-04T00:00:00Z'),
  });
  const text = JSON.stringify(report);
  for (const leaked of [key, 'priya', 'Priya', 'personal note', 'private.example', 'app.js:1:2', '/bin/ngspice']) assert.ok(!text.includes(leaked), `report must not contain ${leaked}`);
  assert.deepEqual(report.project, { format: 'openentc-project', version: 1, components: 2, wires: 0, experiments: 1, notes: 1, artifacts: 0 });
  assert.deepEqual(report.assistant, { provider: 'openai', apiKeySet: true, consented: true });
  assert.deepEqual(report.toolchains, [{ id: 'ngspice', detected: true, version: '42' }]);
  assert.match(report.recentErrors[0].message, /<email>/);
  assert.equal(report.format, 'openentc-diagnostics');
  assert.equal(report.generatedAt, '2026-10-04T00:00:00.000Z');
  assert.equal(createDiagnosticReport().project, null, 'works with no input');
});

test('diagnostic reports drop malformed fields instead of copying them', () => {
  const report = createDiagnosticReport({
    app: { version: 7, build: { nested: true } },
    environment: { userAgent: 'x'.repeat(1000), online: 'yes', desktop: 1 },
    project: { format: 'openentc-project', version: '1', circuit: null, experiments: 'many' },
    persistence: {},
    errors: 'not a list',
    toolchains: { id: 'ngspice' },
    assistant: {},
    secrets: ['classroom-secret'],
  });
  assert.equal(report.app.version, undefined);
  assert.equal(report.app.build, undefined);
  assert.equal(report.environment.userAgent.length, 300);
  assert.equal(report.environment.online, undefined);
  assert.equal(report.environment.desktop, true);
  assert.deepEqual(report.project, { format: 'openentc-project', components: 0, wires: 0, experiments: 0, notes: 0, artifacts: 0 });
  assert.deepEqual(report.recentErrors, []);
  assert.deepEqual(report.toolchains, []);
  assert.deepEqual(report.assistant, { apiKeySet: false, consented: false });
  const many = createDiagnosticReport({ errors: Array.from({ length: 30 }, (_, i) => ({ code: `E${i}`, message: 'classroom-secret leaked' })), toolchains: [null], secrets: ['classroom-secret'] });
  assert.equal(many.recentErrors.length, 20, 'only the last 20 errors');
  assert.equal(many.recentErrors[0].code, 'E10');
  assert.equal(many.recentErrors[0].message, '[redacted] leaked');
  assert.deepEqual(many.toolchains, [{ detected: false }]);
});
