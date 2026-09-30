import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPluginTrust, authorizePluginPermission, declaredPermissions, validatePluginManifest } from '../packages/plugin-sdk/src/index.mjs';

const fixture = { id: 'example.lesson', name: 'Example lesson', version: '1.0.0', license: 'MIT', sourceUrl: 'https://example.invalid/source', apiVersion: 1, permissions: ['filesystem.project'], entrypoint: 'dist/index.js' };

test('plugin manifests validate API, provenance, licence and declared permissions', () => {
  const manifest = validatePluginManifest(fixture);
  assert.deepEqual([...declaredPermissions(manifest)], ['filesystem.project']);
  assert.equal(manifest.id, 'example.lesson');
});

test('plugin manifests reject incompatible APIs, undeclared permissions and traversal', () => {
  assert.throws(() => validatePluginManifest({ ...fixture, apiVersion: 2 }), /incompatible/);
  assert.throws(() => validatePluginManifest({ ...fixture, permissions: ['process.shell'] }), /undeclared/);
  assert.throws(() => validatePluginManifest({ ...fixture, entrypoint: '../run.js' }), /safe relative/);
});

test('plugin trust requires an explicit host policy and never trusts self-declared metadata', () => {
  assert.deepEqual(assessPluginTrust(fixture), { level: 'untrusted', loadable: false, reason: 'Unsigned or unreviewed plugins are not loadable by default.' });
  assert.equal(assessPluginTrust(fixture, { builtInIds: ['example.lesson'] }).loadable, true);
  assert.equal(assessPluginTrust(fixture, { reviewedSourceUrls: [fixture.sourceUrl] }).level, 'reviewed');
});

test('plugin permissions require both declaration and a host grant', () => {
  assert.equal(authorizePluginPermission(fixture, 'filesystem.project', ['filesystem.project']), true);
  assert.throws(() => authorizePluginPermission(fixture, 'filesystem.project'), /not granted/);
  assert.throws(() => authorizePluginPermission(fixture, 'process.engine', ['process.engine']), /not declared/);
});
