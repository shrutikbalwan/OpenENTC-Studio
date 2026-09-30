import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactManifest } from '../packages/artifact-store/src/index.mjs';

const record = (path, digit) => ({ path, sha256: digit.repeat(64), size: 4, mediaType: 'application/octet-stream' });

test('artifact manifests are bounded, deterministic, and sorted by path', () => {
  const manifest = createArtifactManifest([record('z.bin', 'a'), record('a.bin', 'b')], { tool: 'kicad', version: '9.0.0' });
  assert.deepEqual(manifest.artifacts.map((artifact) => artifact.path), ['a.bin', 'z.bin']);
  assert.equal(manifest.format, 'openentc-artifact-manifest');
  assert.equal(manifest.generatedAt, null);
  assert.throws(() => createArtifactManifest([record('a.bin', 'a'), record('a.bin', 'b')]), /duplicate/);
  assert.throws(() => createArtifactManifest([record('../escape.bin', 'a')]), /safe bounded relative path/);
  assert.throws(() => createArtifactManifest([record('/absolute.bin', 'a')]), /safe bounded relative path/);
  assert.throws(() => createArtifactManifest([record('dir\\..\\escape.bin', 'a')]), /safe bounded relative path/);
  assert.throws(() => createArtifactManifest([record('safe.bin', 'a')], { tool: 'ki\ncad' }), /tool metadata/);
});
