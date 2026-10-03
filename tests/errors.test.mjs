import test from 'node:test';
import assert from 'node:assert/strict';
import { ConvergenceError, NativeToolError, NumericalError, OpenEntcError, PermissionError, ProjectFormatError, StorageError, TimeoutError, ValidationError, redactDiagnostic, redactText, toUserFacing } from '../packages/errors/src/index.mjs';

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
