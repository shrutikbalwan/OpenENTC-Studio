import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopProcessAdapterRunner, joinDesktopProjectPath } from '../src/core/desktop-process-adapter-runner.js';

test('desktop adapter runner preserves prepared arguments and stores terminal evidence', async () => {
  const calls = []; let polls = 0; let artifact = null;
  const bridge = {
    available: true,
    startProcess: async (...args) => { calls.push(['start', ...args]); },
    pollProcess: async () => (++polls < 2 ? null : { ok: true, code: 0, stdout: 'compiled', stderr: '', error: null }),
    cancelProcess: async (...args) => { calls.push(['cancel', ...args]); },
    storeArtifact: async (_projectId, path, bytes, mediaType) => ({ path, sha256: 'a'.repeat(64), size: bytes.length, mediaType }),
  };
  const runner = createDesktopProcessAdapterRunner({ bridge, project: { project_id: 'p1', root: 'C:\\project' }, runId: 'arduino-1', pollIntervalMs: 1, sleep: async () => {}, onArtifact: (value) => { artifact = value; } });
  const result = await runner({ executable: 'C:\\Program Files\\Arduino CLI\\arduino-cli.exe', args: ['compile', '--fqbn', 'arduino:avr:uno', 'C:\\project\\runs\\arduino-1\\sketch'] });
  assert.equal(result.stdout, 'compiled');
  assert.equal(artifact.path, 'runs/arduino-1/process-result.json');
  assert.deepEqual(calls[0], ['start', 'p1', 'arduino-1', { executable: 'C:\\Program Files\\Arduino CLI\\arduino-cli.exe', args: ['compile', '--fqbn', 'arduino:avr:uno', 'C:\\project\\runs\\arduino-1\\sketch'], cwd: 'C:\\project', timeout_ms: 120000, max_output_bytes: 2097152 }]);
});

test('desktop adapter runner cancellation reaches the owned native process', async () => {
  const controller = new AbortController(); const calls = [];
  const bridge = { available: true, startProcess: async () => {}, pollProcess: async () => ({ ok: false, code: null, stdout: '', stderr: '', error: 'PROCESS_CANCELLED' }), cancelProcess: async (...args) => { calls.push(args); }, storeArtifact: async (_p, path, bytes, mediaType) => ({ path, sha256: 'a'.repeat(64), size: bytes.length, mediaType }) };
  const runner = createDesktopProcessAdapterRunner({ bridge, project: { project_id: 'p1', root: '/project' }, runId: 'cancel-1', onStarted: () => controller.abort() });
  const result = await runner({ executable: '/usr/bin/tool', args: [], signal: controller.signal });
  assert.equal(result.error, 'PROCESS_CANCELLED');
  assert.deepEqual(calls, [['p1', 'cancel-1']]);
});

test('desktop adapter runner routes hardware jobs through exact device authorization', async () => {
  const calls = [];
  const bridge = {
    available: true,
    startProcess: async () => { throw new Error('generic start must not be used'); },
    startDeviceProcess: async (...args) => { calls.push(args); },
    pollProcess: async () => ({ ok: true, code: 0, stdout: 'uploaded', stderr: '', error: null }),
    cancelProcess: async () => {},
    storeArtifact: async (_p, path, bytes, mediaType) => ({ path, sha256: 'a'.repeat(64), size: bytes.length, mediaType }),
  };
  const runner = createDesktopProcessAdapterRunner({ bridge, project: { project_id: 'p1', root: 'C:\\project' }, runId: 'upload-1', deviceAuthorization: { permission: 'device-programmer', target: 'COM4' } });
  await runner({ executable: 'C:\\tools\\arduino-cli.exe', args: ['upload', '-p', 'COM4'] });
  assert.deepEqual(calls[0].slice(0, 4), ['p1', 'upload-1', 'device-programmer', 'COM4']);
  assert.throws(() => createDesktopProcessAdapterRunner({ bridge, project: { project_id: 'p1', root: 'C:\\project' }, runId: 'bad-device', deviceAuthorization: { permission: 'process-execute', target: 'COM4' } }), /authorization/);
});

test('desktop project path joining is platform-aware and traversal-safe', () => {
  assert.equal(joinDesktopProjectPath('C:\\project', 'runs', 'one', 'sketch'), 'C:\\project\\runs\\one\\sketch');
  assert.equal(joinDesktopProjectPath('/project', 'runs', 'one'), '/project/runs/one');
  assert.throws(() => joinDesktopProjectPath('/project', '..'), /invalid/);
  assert.throws(() => joinDesktopProjectPath('/project', 'nested/path'), /invalid/);
});
