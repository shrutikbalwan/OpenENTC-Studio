import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runProcess, PROCESS_ERROR_CODES, MAX_PROCESS_OUTPUT_BYTES, MAX_PROCESS_ARGS, MAX_PROCESS_ARG_BYTES, MAX_PROCESS_TIMEOUT_MS } from '../packages/process-runner/src/index.mjs';
import { EventEmitter } from 'node:events';

const node = process.execPath;

const processTestsEnabled = process.env.OPENENTC_PROCESS_TESTS === '1';

function fakeSpawn(_executable, args) {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {}; child.stderr.setEncoding = () => {};
  child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); };
  if (args.includes('hang')) return child;
  queueMicrotask(() => {
    if (args.includes('emit-output')) child.stdout.emit('data', 'x'.repeat(100));
    else child.stdout.emit('data', 'space value');
    child.emit('close', 0, null);
  });
  return child;
}

test('process runner owns a process group and uses a fixed Windows tree terminator', async () => {
  const source = await readFile(resolve(import.meta.dirname, '../packages/process-runner/src/index.mjs'), 'utf8');
  assert.match(source, /detached: process\.platform !== 'win32'/);
  assert.match(source, /C:\\\\Windows\\\\System32\\\\taskkill\.exe/);
  assert.ok(source.includes("'/PID'"));
  assert.ok(source.includes("'/T'"));
});

test('process runner uses argument arrays and captures bounded output', { skip: !processTestsEnabled }, async () => {
  const result = await runProcess({ executable: node, args: ['-e', 'process.stdout.write(process.argv[1])', 'space value'], maxOutputBytes: 1000 });
  assert.equal(result.ok, true);
  assert.equal(result.stdout, 'space value');
});

test('process runner rejects relative executables and shell-like arguments are inert', async () => {
  assert.throws(() => runProcess({ executable: 'node', args: ['-e', 'process.exit(0)'] }), /absolute bounded path/);
  if (processTestsEnabled) {
    const result = await runProcess({ executable: node, args: ['-e', 'process.stdout.write(process.argv[1])', '$(not executed)'] });
    assert.equal(result.stdout, '$(not executed)');
  }
});

test('process runner rejects unbounded output-limit requests', () => {
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', maxOutputBytes: MAX_PROCESS_OUTPUT_BYTES + 1 }), /between 1/);
});

test('process runner bounds argument vectors, argument bytes, paths, and timeouts', () => {
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', args: Array.from({ length: MAX_PROCESS_ARGS + 1 }, () => 'x') }), /bounded array/);
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', args: ['x'.repeat(MAX_PROCESS_ARG_BYTES + 1)] }), /bounded array/);
  assert.throws(() => runProcess({ executable: `C:\\${'x'.repeat(32_768)}\\tool.exe` }), /bounded path/);
  assert.throws(() => runProcess({ executable: `C:\\${'界'.repeat(12_000)}\\tool.exe` }), /bounded path/);
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', timeoutMs: MAX_PROCESS_TIMEOUT_MS + 1 }), /bounded integer/);
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', args: ['bad\u0000arg'] }), /bounded array/);
  assert.throws(() => runProcess({ executable: 'C:\\fake\\tool.exe', args: ['界'.repeat(32_769)] }), /bounded array/);
});

test('process runner reports timeout and cancellation', { skip: !processTestsEnabled }, async () => {
  const timed = await runProcess({ executable: node, args: ['-e', 'setTimeout(() => {}, 1000)'], timeoutMs: 20 });
  assert.equal(timed.error, PROCESS_ERROR_CODES.TIMEOUT);
  const controller = new AbortController();
  const pending = runProcess({ executable: node, args: ['-e', 'setTimeout(() => {}, 1000)'] }, { signal: controller.signal });
  controller.abort();
  const cancelled = await pending;
  assert.equal(cancelled.error, PROCESS_ERROR_CODES.CANCELLED);
});

test('process runner cancellation terminates grandchildren in the owned process group', { skip: !processTestsEnabled || process.platform === 'win32' }, async () => {
  const marker = resolve(tmpdir(), `openentc-grandchild-${process.pid}`);
  await rm(marker, { force: true });
  const leaf = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'survived'), 800)`;
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(leaf)}], { stdio: 'ignore' }); setTimeout(() => {}, 5000)`;
  const controller = new AbortController();
  const pending = runProcess({ executable: node, args: ['-e', parent] }, { signal: controller.signal });
  await new Promise((done) => setTimeout(done, 300));
  controller.abort();
  assert.equal((await pending).error, PROCESS_ERROR_CODES.CANCELLED);
  await new Promise((done) => setTimeout(done, 1200));
  await assert.rejects(access(marker), 'owned grandchild survived process-group cancellation');
});

test('process runner enforces an output limit', { skip: !processTestsEnabled }, async () => {
  const result = await runProcess({ executable: node, args: ['-e', 'process.stdout.write("x".repeat(1000))'], maxOutputBytes: 32 });
  assert.equal(result.error, PROCESS_ERROR_CODES.OUTPUT_LIMIT);
  assert.equal(result.ok, false);
});

test('process runner fake-child contract covers output, timeout, cancellation, and inert arguments', async () => {
  const result = await runProcess({ executable: 'C:\\fake\\tool.exe', args: ['space value'] }, { spawnImpl: fakeSpawn });
  assert.equal(result.ok, true);
  assert.equal(result.stdout, 'space value');
  const limited = await runProcess({ executable: 'C:\\fake\\tool.exe', args: ['emit-output'], maxOutputBytes: 32 }, { spawnImpl: fakeSpawn });
  assert.equal(limited.error, PROCESS_ERROR_CODES.OUTPUT_LIMIT);
  assert.ok(Buffer.byteLength(limited.stdout) <= 32);
  const timed = await runProcess({ executable: 'C:\\fake\\tool.exe', args: ['hang'], timeoutMs: 5 }, { spawnImpl: fakeSpawn });
  assert.equal(timed.error, PROCESS_ERROR_CODES.TIMEOUT);
  const controller = new AbortController();
  const pending = runProcess({ executable: 'C:\\fake\\tool.exe', args: ['space value'], timeoutMs: 1000 }, { signal: controller.signal, spawnImpl: (exe, args, options) => {
    const child = fakeSpawn(exe, args, options);
    child.stdout.removeAllListeners(); child.stderr.removeAllListeners();
    return child;
  } });
  controller.abort();
  assert.equal((await pending).error, PROCESS_ERROR_CODES.CANCELLED);
});

test('process runner does not spawn an already-cancelled job', async () => {
  const controller = new AbortController();
  controller.abort();
  let spawned = false;
  const result = await runProcess({ executable: 'C:\\fake\\tool.exe' }, { signal: controller.signal, spawnImpl: () => { spawned = true; return fakeSpawn('C:\\fake\\tool.exe', []); } });
  assert.equal(result.error, PROCESS_ERROR_CODES.CANCELLED);
  assert.equal(spawned, false);
});
