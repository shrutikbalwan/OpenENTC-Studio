import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopEngineRunner } from '../src/core/desktop-engine-runner.js';

function fixtureBridge(results = [null, { ok: true, code: 0, stdout: 'V(out) = 6\n', stderr: '', error: null }]) {
  const calls = [];
  const queue = [...results];
  return {
    calls,
    bridge: {
      available: true,
      storeArtifact: async (projectId, path, bytes, mediaType) => {
        calls.push(['store', projectId, path, [...bytes], mediaType]);
        return { path, sha256: 'a'.repeat(64), size: bytes.length, mediaType };
      },
      startProcess: async (...args) => { calls.push(['start', ...args]); },
      pollProcess: async (...args) => { calls.push(['poll', ...args]); return queue.shift() ?? null; },
      cancelProcess: async (...args) => { calls.push(['cancel', ...args]); },
    },
  };
}

test('desktop engine runner materializes confined inputs, polls, and preserves terminal evidence', async () => {
  const { bridge, calls } = fixtureBridge();
  let evidence = null;
  const runner = createDesktopEngineRunner({ bridge, project: { project_id: 'p1', root: 'C:/project', name: 'demo', version: 1 }, runId: 'ngspice-1', pollIntervalMs: 1, sleep: async () => {}, onArtifacts: (artifacts) => { evidence = artifacts; } });
  const result = await runner({ executable: 'C:/Program Files/ngspice/bin/ngspice.exe', args: ['-b'], shell: false, netlist: '* demo\n.end\n' });
  assert.equal(result.stdout, 'V(out) = 6\n');
  assert.deepEqual(result.artifacts.map((artifact) => artifact.path), ['runs/ngspice-1/input.cir', 'runs/ngspice-1/process-result.json']);
  assert.deepEqual(evidence, result.artifacts);
  assert.deepEqual(calls.find((call) => call[0] === 'start'), ['start', 'p1', 'ngspice-1', { executable: 'C:/Program Files/ngspice/bin/ngspice.exe', args: ['-b', 'runs/ngspice-1/input.cir'], cwd: 'C:/project', timeout_ms: 120000, max_output_bytes: 2097152 }]);
});

test('desktop engine runner propagates abort through the owned native process', async () => {
  const controller = new AbortController();
  const { bridge, calls } = fixtureBridge([null, { ok: false, code: null, stdout: '', stderr: '', error: 'PROCESS_CANCELLED' }]);
  const runner = createDesktopEngineRunner({ bridge, project: { project_id: 'p1', root: 'C:/project', name: 'demo', version: 1 }, runId: 'ngspice-cancel', pollIntervalMs: 1, sleep: async () => { controller.abort(); } });
  const result = await runner({ executable: 'C:/Program Files/ngspice/bin/ngspice.exe', args: ['-b'], netlist: '* demo\n.end\n', signal: controller.signal });
  assert.equal(result.error, 'PROCESS_CANCELLED');
  assert.ok(calls.some((call) => call[0] === 'cancel'));
});

test('desktop engine runner rejects unavailable, unsafe, and oversized requests before launch', async () => {
  const { bridge, calls } = fixtureBridge();
  const project = { project_id: 'p1', root: 'C:/project', name: 'demo', version: 1 };
  await assert.rejects(createDesktopEngineRunner({ bridge, project, runId: '../escape' })({ executable: 'C:/tool.exe', args: [], netlist: '.end\n' }), /run id/);
  const runner = createDesktopEngineRunner({ bridge, project, runId: 'safe' });
  await assert.rejects(runner({ executable: '', args: [], netlist: '.end\n' }), /specification/);
  await assert.rejects(runner({ executable: 'C:/tool.exe', args: [], netlist: 'x'.repeat(2 * 1024 * 1024 + 1) }), /oversized/);
  assert.equal(calls.length, 0);
});
