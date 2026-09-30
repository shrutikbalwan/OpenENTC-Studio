import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEngineManifest } from '../packages/engine-sdk/src/manifest.mjs';

test('toolchain manifests carry explicit detection, licence and operation metadata', async () => {
  for (const name of ['ngspice', 'arduino-cli', 'platformio', 'renode', 'kicad', 'verilator', 'ghdl', 'yosys', 'nextpnr-ice40', 'qucsator-rf', 'tshark', 'gnuradio']) {
    const manifest = JSON.parse(await readFile(new URL(`../toolchains/manifests/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(validateEngineManifest(manifest).id, name);
    assert.equal(manifest.id, name);
    assert.match(manifest.license, /^[A-Za-z0-9.+-]+$/);
    assert.match(manifest.sourceUrl, /^https?:\/\//);
    assert.equal(manifest.integration, 'process');
    assert.ok(manifest.executableCandidates.every((candidate) => /^(?:[A-Za-z]:[\\/]|[\\/])/.test(candidate)));
    assert.ok(manifest.operations.length > 0);
  }
});

test('published engine schema records the same bounded discovery contract as runtime validation', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/engine-manifest.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.id.maxLength, 100);
  assert.equal(schema.properties.operations.maxItems, 128);
  assert.equal(schema.properties.executableCandidates.maxItems, 128);
  assert.equal(schema.properties.platforms.minItems, 1);
});

test('published artifact manifest schema records the deterministic bounded artifact contract', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/artifact-manifest.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.format.const, 'openentc-artifact-manifest');
  assert.equal(schema.properties.artifacts.maxItems, 100000);
  assert.equal(schema.properties.artifacts.items.properties.size.maximum, 268435456);
  assert.equal(schema.properties.artifacts.items.properties.path.maxLength, 4096);
});

test('manifest validation rejects unsafe or incomplete metadata', () => {
  assert.throws(() => validateEngineManifest({ id: 'bad id', name: 'Bad', license: 'MIT', sourceUrl: 'https://example.test', integration: 'process', operations: ['run'], platforms: ['windows'] }), /id/);
  assert.throws(() => validateEngineManifest({ id: 'tool', name: 'Tool', license: 'MIT', sourceUrl: 'file:///local', integration: 'process', operations: ['run'], platforms: ['windows'] }), /sourceUrl/);
  assert.throws(() => validateEngineManifest({ id: 'tool', name: 'Tool', license: 'MIT', sourceUrl: 'https://example.test', integration: 'process', operations: ['run'], platforms: ['windows'], executableCandidates: ['ngspice'] }), /absolute/);
  assert.throws(() => validateEngineManifest({ id: 'tool', name: 'Tool', license: 'MIT', sourceUrl: 'https://example.test', integration: 'process', operations: Array.from({ length: 129 }, () => 'run'), platforms: ['windows'] }), /bounded/);
  assert.throws(() => validateEngineManifest({ id: 'tool', name: 'Tool', license: 'MIT', sourceUrl: 'https://example.test', integration: 'process', operations: ['x'.repeat(201)], platforms: ['windows'] }), /bounded/);
});
