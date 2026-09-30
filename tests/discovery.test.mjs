import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertAbsoluteExecutable, loadAndProbeManifest, probeEngineManifest, probeExecutable } from '../packages/engine-sdk/src/discovery.mjs';

test('discovery is read-only and reports missing candidates honestly', async () => {
  const result = await probeExecutable({ id: 'ngspice', candidates: ['relative-ngspice', 'C:/definitely/missing/ngspice'] });
  assert.deepEqual(result, { id: 'ngspice', status: 'missing', path: null, evidence: 'no-candidate-found' });
});

test('discovery detects an existing fixed path without executing it', async () => {
  const result = await probeEngineManifest({ id: 'node-runtime', displayName: 'Node runtime', executableCandidates: [process.execPath], operations: ['contract-test'] });
  assert.equal(result.status, 'detected');
  assert.equal(result.path, process.execPath);
  assert.deepEqual(result.supportedOperations, ['contract-test']);
});

test('discovery rejects malformed manifests and candidates', async () => {
  await assert.rejects(() => probeEngineManifest({}), /id/);
  await assert.rejects(() => probeExecutable({ id: 'x', candidates: [42] }), /candidates/);
});

test('discovery bounds identifiers, candidate lists, and executable paths before filesystem probes', async () => {
  assert.throws(() => assertAbsoluteExecutable(`C:/${'x'.repeat(4096)}`), /bounded/);
  await assert.rejects(() => probeExecutable({ id: 'x'.repeat(101), candidates: [] }), /bounded/);
  await assert.rejects(() => probeExecutable({ id: 'x', candidates: Array.from({ length: 65 }, () => 'C:/missing/tool') }), /bounded/);
  await assert.rejects(() => probeExecutable({ id: 'x', candidates: ['C:/missing/\u0001tool'] }), /absolute bounded/);
});

test('manifest loading validates before probing and requires an absolute path', async () => {
  const result = await loadAndProbeManifest(fileURLToPath(new URL('../toolchains/manifests/ngspice.json', import.meta.url)));
  assert.equal(result.id, 'ngspice');
  await assert.rejects(() => loadAndProbeManifest('toolchains/manifests/ngspice.json'), /absolute/);
});
