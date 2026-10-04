import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createHistory,
  cleanGeneratedDirectories,
  createProject,
  exportProject,
  importProject,
  initializeProjectDirectory,
  saveProjectDirectory,
  migrateProjectDirectory,
  openProjectDirectory,
  registerArtifact,
  registerArtifactManifest,
  removeArtifact,
  validateArchiveEntries,
  serializeProject,
  validateProject,
  ProjectError
} from '../packages/project-model/src/index.mjs';

test('archive metadata validation rejects traversal, links, duplicates, and oversized payloads', () => {
  assert.deepEqual(validateArchiveEntries([
    { path: 'design/main.json', size: 10, type: 'file' },
    { path: 'notes', size: 0, type: 'directory' }
  ]), [
    { path: 'design/main.json', size: 10, type: 'file' },
    { path: 'notes', size: 0, type: 'directory' }
  ]);
  for (const entry of [
    { path: '../escape.txt', size: 1 },
    { path: 'C:/escape.txt', size: 1 },
    { path: 'link', size: 0, type: 'symlink' },
    { path: 'a/', size: 0, type: 'directory' }
  ]) assert.throws(() => validateArchiveEntries([entry]));
  assert.throws(() => validateArchiveEntries([{ path: 'a', size: 1 }, { path: 'A', size: 1 }]));
  assert.throws(() => validateArchiveEntries([{ path: 'big.bin', size: 5 }], { maxBytes: 4 }));
  assert.throws(() => validateArchiveEntries([], { maxEntries: 100_001 }));
  assert.throws(() => validateArchiveEntries([], { maxBytes: 512 * 1024 * 1024 + 1 }));
});
import { MAX_EXPERIMENT_DEFINITION_BYTES, upsertExperiment } from '../packages/project-model/src/experiments.mjs';
import { createProject as createBrowserProject, validateProject as validateBrowserProject, migrateProject as migrateBrowserProject, serializeProject as serializeBrowserProject, exportProject as exportBrowserProject, importProject as importBrowserProject, registerArtifact as registerBrowserArtifact, registerArtifactManifest as registerBrowserArtifactManifest } from '../packages/project-model/src/browser.mjs';
import { MAX_EXPERIMENT_DEFINITION_BYTES as browserExperimentLimit, upsertExperiment as browserUpsertExperiment } from '../packages/project-model/src/browser.mjs';
import { exportProject as exportBrowserAppProject, migrateProject as migrateBrowserAppProject, registerArtifactManifest as registerBrowserAppArtifactManifest } from '../src/core/project.js';

test('published schema documents are JSON Schema 2020-12 contracts', async () => {
  const names = ['project', 'engine-manifest', 'job', 'diagnostic', 'result', 'lesson', 'component-definition', 'artifact-manifest', 'hdl-project', 'flowgraph', 'fabrication-manifest'];
  for (const name of names) {
    const schema = JSON.parse(await readFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0);
  }
  const projectSchema = JSON.parse(await readFile(new URL('../schemas/project.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(projectSchema.properties.circuit.required, ['components', 'wires', 'signal', 'junctions', 'netLabels']);
  const resultSchema = JSON.parse(await readFile(new URL('../schemas/result.schema.json', import.meta.url), 'utf8'));
  assert.equal(resultSchema.properties.provenance.properties.engine.minLength, 1);
  assert.equal(resultSchema.properties.sampleRate.exclusiveMinimum, 0);
  const jobSchema = JSON.parse(await readFile(new URL('../schemas/job.schema.json', import.meta.url), 'utf8'));
  for (const field of ['diagnostics', 'artifacts', 'logs']) assert.ok(jobSchema.required.includes(field));
  assert.equal(jobSchema.properties.inputs.items.minLength, 1);
  assert.equal(jobSchema.properties.artifacts.items.properties.size.maximum, 268435456);
  assert.equal(resultSchema.properties.artifacts.items.properties.mediaType.maxLength, 200);
  assert.match(jobSchema.properties.artifacts.items.properties.path.pattern, /(?:\^\|\/)/);
  assert.equal(resultSchema.properties.artifacts.items.properties.path.pattern, jobSchema.properties.artifacts.items.properties.path.pattern);
});

test('strict project model guard enforces artifact reference invariants', async () => {
  const source = await readFile(new URL('../packages/project-model/src/model.ts', import.meta.url), 'utf8');
  assert.match(source, /project\.artifacts\.every/);
  assert.match(source, /268435456/);
  assert.match(source, /artifact\.sha256/);
});

test('project model preserves unknown fields through serialization and import', () => {
  const project = createProject('Unknown field fixture');
  project.futureFeature = { keep: true };
  project.circuit.components.push({ id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'a', n2: '0', x: 1, y: 2, custom: 'preserve' });
  const reopened = importProject(serializeProject(project));
  assert.deepEqual(reopened.futureFeature, { keep: true });
  assert.equal(reopened.circuit.components.find((component) => component.custom)?.custom, 'preserve');
});

test('native and browser export APIs round-trip through import without semantic drift', () => {
  const native = createProject('Export API');
  const browser = createBrowserProject('Export API');
  assert.deepEqual(importProject(exportProject(native)), native);
  assert.deepEqual(validateBrowserProject(JSON.parse(exportBrowserProject(browser))), browser);
  assert.equal(exportBrowserAppProject(browser), exportBrowserProject(browser));
});

test('project manifest carries bounded documents, targets, toolchain constraints, and experiments', () => {
  const project = createProject('Registry fixture');
  project.documents.push({ id: 'schematic', path: 'design/schematic.json', kind: 'schematic' });
  project.targets.push({ id: 'uno', kind: 'board', identity: 'arduino:avr:uno' });
  project.toolchainConstraints.push({ engine: 'ngspice', range: '>=40' });
  project.experiments.push({ id: 'divider', operation: 'dc', inputs: ['design/schematic.json'] });
  const reopened = importProject(serializeProject(project));
  assert.equal(reopened.documents[0].path, 'design/schematic.json');
  assert.equal(reopened.targets[0].identity, 'arduino:avr:uno');
  assert.equal(reopened.toolchainConstraints[0].engine, 'ngspice');
  assert.equal(reopened.experiments[0].operation, 'dc');
  assert.throws(() => validateProject({ ...project, experiments: Array.from({ length: 10001 }, () => ({})) }), /experiments are invalid/);
});

test('schematic junctions and net labels migrate, round-trip, and stay bounded', () => {
  const project = createProject('Connectivity metadata');
  project.circuit.junctions.push({ id: 'J1', node: 'out', x: 120, y: 80 });
  project.circuit.netLabels.push({ id: 'N1', text: 'sense', node: 'out', x: 140, y: 80 });
  const reopened = importProject(serializeProject(project));
  assert.deepEqual(reopened.circuit.junctions, project.circuit.junctions);
  assert.deepEqual(reopened.circuit.netLabels, project.circuit.netLabels);
  const legacy = createProject('Legacy connectivity');
  delete legacy.circuit.junctions; delete legacy.circuit.netLabels;
  const migrated = validateProject(legacy);
  assert.deepEqual(migrated.circuit.junctions, []);
  assert.deepEqual(migrated.circuit.netLabels, []);
  assert.throws(() => validateProject({ ...project, circuit: { ...project.circuit, netLabels: [{ id: 'bad', text: 'x', node: 'x', x: Number.NaN, y: 0 }] } }), /netLabels are invalid/);
});

test('schematic wire and marker fields reject empty or oversized identifiers in both models', () => {
  const native = createProject('Wire bounds');
  assert.throws(() => validateProject({ ...native, circuit: { ...native.circuit, wires: [{ from: '', to: 'out' }] } }), /wires are invalid/);
  assert.throws(() => validateProject({ ...native, circuit: { ...native.circuit, netLabels: [{ id: 'N1', text: ' ', node: 'out', x: 0, y: 0 }] } }), /netLabels are invalid/);
  const browser = createBrowserProject('Wire bounds');
  assert.throws(() => validateBrowserProject({ ...browser, circuit: { ...browser.circuit, wires: [{ from: 'a'.repeat(101), to: 'b' }] } }), /wires are invalid/);
  assert.throws(() => validateBrowserProject({ ...browser, circuit: { ...browser.circuit, junctions: [{ id: '', node: 'out', x: 0, y: 0 }] } }), /junctions are invalid/);
});

test('authored wire routes round-trip with bounded orthogonal coordinates', () => {
  const project = createProject('Routed wire');
  project.circuit.wires = [{ from: 'out', to: 'vcc', route: { axis: 'x', coordinate: 240 } }];
  const validated = validateProject(project);
  assert.deepEqual(validated.circuit.wires[0].route, { axis: 'x', coordinate: 240 });
  assert.deepEqual(importProject(exportProject(validated)).circuit.wires, validated.circuit.wires);
  assert.throws(() => validateProject({ ...project, circuit: { ...project.circuit, wires: [{ from: 'out', to: 'vcc', route: { axis: 'diagonal', coordinate: 1 } }] } }), /wires are invalid/);
  assert.throws(() => validateProject({ ...project, circuit: { ...project.circuit, wires: [{ from: 'out', to: 'vcc', route: { axis: 'x', coordinate: 1_000_001 } }] } }), /wires are invalid/);
  project.circuit.wires = [{ from: 'out', to: 'vcc', route: { points: [{ x: 10, y: 20 }, { x: 40, y: 50 }] } }];
  assert.deepEqual(importProject(exportProject(validateProject(project))).circuit.wires, project.circuit.wires);
  for (const points of [[], Array.from({ length: 65 }, (_, x) => ({ x, y: 0 })), [{ x: 1_000_001, y: 0 }], [{ x: Number.NaN, y: 0 }], [{ x: 0, y: 0, extra: true }]]) {
    assert.throws(() => validateProject({ ...project, circuit: { ...project.circuit, wires: [{ from: 'out', to: 'vcc', route: { points } }] } }), /wires are invalid/);
  }
});

test('project identity fields enforce version and timestamp contracts in both models', () => {
  const native = createProject('Identity bounds');
  assert.throws(() => validateProject({ ...native, version: -1 }), /not supported|version is invalid/);
  assert.throws(() => validateProject({ ...native, updatedAt: 'not-a-date' }), /timestamp is invalid/);
  const browser = createBrowserProject('Identity bounds');
  assert.throws(() => validateBrowserProject({ ...browser, createdAt: '' }), /timestamp is invalid/);
  assert.throws(() => validateBrowserProject({ ...browser, version: -1 }), /not supported|version is invalid/);
});

test('runtime project validation matches schema numeric, metadata, and identifier bounds', () => {
  const native = createProject('Schema parity');
  const browser = createBrowserProject('Schema parity');
  for (const validate of [validateProject, validateBrowserProject]) {
    assert.throws(() => validate({ ...native, circuit: { ...native.circuit, signal: { ...native.circuit.signal, amplitude: Infinity } } }), /Signal values must be finite/);
    assert.throws(() => validate({ ...native, embedded: { ...native.embedded, language: 'x'.repeat(51) } }), /Embedded metadata is invalid/);
    assert.throws(() => validate({ ...native, artifacts: [{ path: 'runs/x', sha256: 'a'.repeat(64), size: 1, mediaType: ' ' }] }), /artifacts are invalid/);
    assert.throws(() => validate({ ...native, provenance: { ...native.provenance, engineVersions: { ngspice: '1\n2' } } }), /provenance is invalid/);
    assert.throws(() => validate({ ...native, provenance: { ...native.provenance, createdBy: 'OpenENTC\nStudio' } }), /provenance is invalid/);
    assert.throws(() => validate({ ...native, provenance: { ...native.provenance, engineVersions: Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`tool-${index}`, '1'])) } }), /provenance is invalid/);
    assert.throws(() => validate({ ...native, artifacts: [{ path: 'runs/x', sha256: 'a'.repeat(64), size: 268435457, mediaType: 'application/octet-stream' }] }), /artifacts are invalid/);
    assert.throws(() => validate({ ...native, artifacts: [{ path: 'runs/\u0007x', sha256: 'a'.repeat(64), size: 1, mediaType: 'application/octet-stream' }] }), /artifacts are invalid/);
    assert.throws(() => validate({ ...native, circuit: { ...native.circuit, components: [{ ...native.circuit.components[0], id: '1not-a-reference' }] } }), /schema field/);
    assert.throws(() => validate({ ...native, notes: Array.from({ length: 1001 }, () => 'note') }), /notes are invalid/);
  }
  assert.deepEqual(validateBrowserProject(browser), browser);
});

test('native and browser validators normalize non-serializable in-memory input', () => {
  for (const validate of [validateProject, validateBrowserProject]) {
    const circular = createProject('Circular project');
    circular.self = circular;
    assert.throws(() => validate(circular), (error) => error instanceof ProjectError && error.code === 'PROJECT_INVALID_SHAPE' && /cannot be serialized/.test(error.message));
    const bigint = createProject('BigInt project');
    bigint.futureCount = 1n;
    assert.throws(() => validate(bigint), (error) => error instanceof ProjectError && error.code === 'PROJECT_INVALID_SHAPE' && /cannot be serialized/.test(error.message));
    const omitted = createProject('Undefined JSON project');
    omitted.toJSON = () => undefined;
    assert.throws(() => validate(omitted), (error) => error instanceof ProjectError && error.code === 'PROJECT_INVALID_SHAPE' && /cannot be serialized/.test(error.message));
  }
});

test('artifact references register idempotently and remove by path', () => {
  const project = createProject('Artifact references');
  const artifact = { path: 'runs/result.csv', sha256: 'a'.repeat(64), size: 12, mediaType: 'text/csv' };
  const once = registerArtifact(project, artifact);
  const twice = registerArtifact(once, artifact);
  assert.equal(twice.artifacts.length, 1);
  assert.equal(removeArtifact(twice, artifact.path).artifacts.length, 0);
});

test('artifact manifests attach generated outputs and tool provenance immutably', () => {
  const project = createProject('Artifact manifest');
  const manifest = { format: 'openentc-artifact-manifest', version: 1, tool: 'kicad', toolVersion: '9.0.0', generatedAt: null, artifacts: [{ path: 'build/gerbers.zip', sha256: 'd'.repeat(64), size: 12, mediaType: 'application/zip' }] };
  const updated = registerArtifactManifest(project, manifest);
  assert.equal(project.artifacts.length, 0);
  assert.equal(updated.artifacts[0].path, 'build/gerbers.zip');
  assert.equal(updated.provenance.engineVersions.kicad, '9.0.0');
  assert.throws(() => registerArtifactManifest(project, { ...manifest, format: 'wrong' }), /manifest is invalid/);
  assert.throws(() => registerArtifactManifest(project, { ...manifest, generatedAt: 'not-a-date' }), /manifest is invalid/);
  assert.throws(() => registerArtifactManifest(project, { ...manifest, tool: 'x'.repeat(201) }), /manifest is invalid/);
  assert.throws(() => registerArtifactManifest(project, { ...manifest, toolVersion: '9\n0' }), /manifest is invalid/);
});

test('artifact registration rejects absolute and traversal paths without rejecting dotted filenames', () => {
  const project = createProject('Artifact path safety');
  const valid = { path: 'runs/result.v1.csv', sha256: 'b'.repeat(64), size: 1, mediaType: 'text/csv' };
  assert.equal(registerArtifact(project, valid).artifacts.length, 1);
  for (const path of ['../escape.bin', 'runs/../../escape.bin', '\\server\\share\\escape.bin', 'C:\\temp\\escape.bin', '/tmp/escape.bin']) {
    assert.throws(() => registerArtifact(project, { ...valid, path }), /Artifact reference is invalid/);
  }
});

test('browser artifact registration enforces the same path boundary', () => {
  const project = createBrowserProject('Browser artifact path safety');
  const artifact = { path: 'runs/result.v1.csv', sha256: 'c'.repeat(64), size: 1, mediaType: 'text/csv' };
  assert.equal(registerBrowserArtifact(project, artifact).artifacts.length, 1);
  assert.throws(() => registerBrowserArtifact(project, { ...artifact, path: 'runs/../../escape.bin' }), /Artifact reference is invalid/);
  const updated = registerBrowserArtifactManifest(project, { format: 'openentc-artifact-manifest', version: 1, tool: 'ngspice', toolVersion: '42', generatedAt: null, artifacts: [artifact] });
  assert.equal(updated.provenance.engineVersions.ngspice, '42');
});

test('experiment upsert is immutable, deduplicated, bounded, and JSON-safe', () => {
  const original = [{ id: 'existing', inputs: { value: 1 } }];
  const updated = upsertExperiment(original, { id: 'existing', inputs: { value: 2 } }, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(original, [{ id: 'existing', inputs: { value: 1 } }]);
  assert.deepEqual(updated[0], { id: 'existing', inputs: { value: 2 }, updatedAt: '2026-01-01T00:00:00.000Z' });
  assert.throws(() => upsertExperiment([], { id: 'large', value: 'x'.repeat(MAX_EXPERIMENT_DEFINITION_BYTES) }), /64 KiB/);
  const circular = { id: 'circular' }; circular.self = circular;
  assert.throws(() => upsertExperiment([], circular), /JSON-serializable/);
  assert.throws(() => upsertExperiment([], { id: `x${'a'.repeat(200)}` }), /id is invalid/);
  assert.throws(() => upsertExperiment([], { id: 'bad\nlabel' }), /id is invalid/);
  const bounded = upsertExperiment(Array.from({ length: 10_000 }, (_, index) => ({ id: `old-${index}` })), { id: 'newest' }, '2026-01-01T00:00:00.000Z');
  assert.equal(bounded.length, 10_000);
  assert.equal(bounded[0].id, 'old-1');
  assert.equal(bounded.at(-1).id, 'newest');
  assert.throws(() => upsertExperiment([], { id: 'unicode-large', value: '€'.repeat(30_000) }), /64 KiB/);
});

test('authored experiment definitions round-trip without generated result payloads', () => {
  const project = createProject('Experiment round-trip');
  project.experiments = upsertExperiment(project.experiments, { id: 'signals-fft', kind: 'dsp', inputs: { sampleRate: 48_000, length: 256 } }, '2026-01-01T00:00:00.000Z');
  const reopened = importProject(serializeProject(project));
  assert.deepEqual(reopened.experiments, project.experiments);
  assert.equal(Object.hasOwn(reopened.experiments[0], 'spectrum'), false);
  assert.equal(Object.hasOwn(reopened.experiments[0], 'waveform'), false);
});

test('browser project-model entry point exposes the bounded experiment helper', () => {
  assert.equal(browserExperimentLimit, MAX_EXPERIMENT_DEFINITION_BYTES);
  const value = browserUpsertExperiment([], { id: 'browser-fixture', inputs: { value: 1 } }, '2026-01-01T00:00:00.000Z');
  assert.equal(value[0].id, 'browser-fixture');
});

test('browser application facade exposes artifact manifest registration', () => {
  const project = createBrowserProject('Facade artifact');
  const updated = registerBrowserAppArtifactManifest(project, { format: 'openentc-artifact-manifest', version: 1, tool: 'tshark', toolVersion: '4.2.0', generatedAt: null, artifacts: [{ path: 'runs/packets.json', sha256: 'e'.repeat(64), size: 4, mediaType: 'application/json' }] });
  assert.equal(updated.artifacts[0].path, 'runs/packets.json');
  assert.equal(updated.provenance.engineVersions.tshark, '4.2.0');
});

test('browser facade and native project model share the same contract', () => {
  const browser = createBrowserProject('Shared contract');
  const native = createProject('Shared contract');
  assert.deepEqual(browser.circuit, native.circuit);
  assert.deepEqual(browser.documents, native.documents);
  assert.deepEqual(browser.targets, native.targets);
  assert.deepEqual(browser.toolchainConstraints, native.toolchainConstraints);
  assert.deepEqual(browser.experiments, native.experiments);
  assert.deepEqual(validateBrowserProject(JSON.parse(serializeBrowserProject(browser))), browser);
  assert.deepEqual(validateProject(JSON.parse(serializeProject(native))), native);
});

test('browser migration supplies manifest registries for older projects', () => {
  const legacy = createBrowserProject('Legacy registry fixture');
  delete legacy.documents;
  delete legacy.targets;
  delete legacy.toolchainConstraints;
  delete legacy.experiments;
  const migrated = validateBrowserProject(legacy);
  assert.deepEqual(migrated.documents, []);
  assert.deepEqual(migrated.targets, []);
  assert.deepEqual(migrated.toolchainConstraints, []);
  assert.deepEqual(migrated.experiments, []);
  const direct = migrateBrowserProject(legacy);
  assert.deepEqual(direct.documents, []);
  assert.deepEqual(direct.experiments, []);
  assert.throws(() => validateBrowserProject({ ...createBrowserProject(), experiments: [{ id: 'bad\nexperiment' }] }), /experiments contains an invalid id/);
});

test('browser application facade migrates legacy registry fields before UI use', () => {
  const legacy = createBrowserProject('Application facade fixture');
  delete legacy.documents;
  delete legacy.targets;
  delete legacy.toolchainConstraints;
  delete legacy.experiments;
  const migrated = migrateBrowserAppProject(legacy);
  assert.deepEqual(migrated.documents, []);
  assert.deepEqual(migrated.targets, []);
  assert.deepEqual(migrated.toolchainConstraints, []);
  assert.deepEqual(migrated.experiments, []);
});

test('project model rejects malformed, oversized, and unsupported input', () => {
  assert.throws(() => importProject('{'), (error) => error instanceof ProjectError && error.code === 'PROJECT_INVALID_JSON');
  assert.throws(() => validateProject({ format: 'openentc-project', version: 1 }), /invalid/);
  const oversized = `${JSON.stringify(createProject())}${'x'.repeat(11_000_000)}`;
  assert.throws(() => importProject(oversized), (error) => error.code === 'PROJECT_TOO_LARGE');
  assert.throws(() => validateProject({ ...createProject(), version: 99 }), (error) => error.code === 'PROJECT_UNSUPPORTED_VERSION');
  assert.throws(() => validateProject({ ...createProject(), circuit: { ...createProject().circuit, wires: [{ from: 'a' }] } }), /wires are invalid/);
  assert.throws(() => validateProject({ ...createProject(), artifacts: [{ path: '../escape', sha256: '0'.repeat(64), size: 1, mediaType: 'text/plain' }] }), /artifacts are invalid/);
  assert.throws(() => validateProject({ ...createProject(), units: { voltage: '' } }), /units are invalid/);
  assert.throws(() => validateProject({ ...createProject(), provenance: { createdBy: '', engineVersions: {} } }), /provenance is invalid/);
  assert.throws(() => validateProject({ ...createProject(), circuit: { ...createProject().circuit, components: [{ ...createProject().circuit.components[0], rotation: 'quarter-turn' }] } }), /invalid rotation/);
  assert.throws(() => validateProject({ ...createProject(), settings: { theme: 'dark', grid: true, gridSize: 0 } }), /grid size is invalid/);
  assert.throws(() => validateProject({ ...createProject(), experiments: [{ id: 'bad\nexperiment' }] }), /experiments contains an invalid id/);
});

test('project byte limits count UTF-8 bytes in browser and native models', () => {
  const project = createProject('Unicode size fixture');
  project.notes = ['😀'.repeat(120)];
  const text = JSON.stringify(project);
  const characterCount = text.length;
  const byteCount = new TextEncoder().encode(text).byteLength;
  assert.ok(byteCount > characterCount);
  assert.throws(() => validateProject(project, { maxBytes: characterCount }), (error) => error instanceof ProjectError && error.code === 'PROJECT_TOO_LARGE');
  assert.throws(() => validateBrowserProject(project, { maxBytes: characterCount }), /size/);
  assert.throws(() => importProject(text, { maxBytes: characterCount }), (error) => error instanceof ProjectError && error.code === 'PROJECT_TOO_LARGE');
  assert.throws(() => importBrowserProject(text, { maxBytes: characterCount }), /size/);
  assert.throws(() => validateProject(createProject(), { maxBytes: 10 * 1024 * 1024 + 1 }), /limit/);
  assert.throws(() => validateBrowserProject(createBrowserProject(), { maxBytes: 10 * 1024 * 1024 + 1 }), /limit/);
});

test('directory project writes authored and generated boundaries and reopens unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-project-'));
  try {
    const original = createProject('Directory fixture');
    original.future = { retained: 1 };
    await initializeProjectDirectory(root, original);
    const reopened = await openProjectDirectory(root);
    assert.equal(reopened.name, original.name);
    assert.deepEqual(reopened.future, original.future);
    const manifest = JSON.parse(await readFile(join(root, 'openentc.project.json'), 'utf8'));
    assert.equal(manifest.format, 'openentc-project');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('directory save API atomically persists validated project changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-save-'));
  try {
    const project = createProject('Save API');
    await initializeProjectDirectory(root, project);
    project.name = 'Saved update';
    assert.equal(await saveProjectDirectory(root, project), root);
    assert.equal((await openProjectDirectory(root)).name, 'Saved update');
    await assert.rejects(() => saveProjectDirectory(join(root, '..', 'missing'), project));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('generated cleanup removes only runs and build artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-clean-'));
  try {
    const project = createProject('Cleanup fixture');
    await initializeProjectDirectory(root, project);
    await writeFile(join(root, 'design-authored.txt'), 'keep', 'utf8');
    await writeFile(join(root, 'runs', 'old.log'), 'generated', 'utf8');
    await writeFile(join(root, 'build', 'old.bin'), 'generated', 'utf8');
    assert.deepEqual(await cleanGeneratedDirectories(root), ['runs', 'build']);
    await access(join(root, 'design-authored.txt'));
    await assert.rejects(() => access(join(root, 'runs', 'old.log')));
    await assert.rejects(() => access(join(root, 'build', 'old.bin')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('project initialization and generated cleanup reject symlinked generated directories', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-symlink-project-'));
  const outside = await mkdtemp(join(tmpdir(), 'openentc-symlink-outside-'));
  try {
    try { await symlink(outside, join(root, 'runs'), 'junction'); } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) { t.skip('symlink creation is unavailable in this environment'); return; }
      throw error;
    }
    await assert.rejects(() => initializeProjectDirectory(root, createProject('Symlink fixture')), /symbolic links/);
    await assert.rejects(() => cleanGeneratedDirectories(root), /symbolic links/);
    assert.equal((await readdir(outside)).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('directory project APIs reject a symlinked project root', async (t) => {
  const parent = await mkdtemp(join(tmpdir(), 'openentc-root-link-'));
  const target = await mkdtemp(join(tmpdir(), 'openentc-root-target-'));
  const linked = join(parent, 'linked-project');
  try {
    try { await symlink(target, linked, 'junction'); } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error?.code)) { t.skip('symlink creation is unavailable in this environment'); return; }
      throw error;
    }
    await assert.rejects(() => openProjectDirectory(linked), /symbolic links/);
    await assert.rejects(() => saveProjectDirectory(linked, createProject('Linked root')), /symbolic links/);
  } finally { await rm(parent, { recursive: true, force: true }); await rm(target, { recursive: true, force: true }); }
});

test('migration backs up the original manifest before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-migration-'));
  try {
    const legacy = { ...createProject('Legacy fixture'), version: 0, legacyField: { keep: true } };
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'openentc.project.json'), JSON.stringify(legacy), 'utf8');
    const migrated = await migrateProjectDirectory(root);
    assert.equal(migrated.version, 1);
    assert.deepEqual(migrated.legacyField, { keep: true });
    const backup = JSON.parse(await readFile(join(root, 'openentc.project.json.backup'), 'utf8'));
    assert.equal(backup.version, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed migrations leave the original manifest unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-failed-migration-'));
  try {
    const original = { ...createProject('Unsupported fixture'), version: 99 };
    const manifestPath = join(root, 'openentc.project.json');
    await writeFile(manifestPath, JSON.stringify(original), 'utf8');
    await assert.rejects(() => migrateProjectDirectory(root), /not supported/);
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), original);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backup failure leaves the original manifest unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-backup-failure-'));
  try {
    const original = { ...createProject('Backup failure fixture'), version: 0 };
    const manifestPath = join(root, 'openentc.project.json');
    await writeFile(manifestPath, JSON.stringify(original), 'utf8');
    await mkdir(join(root, 'openentc.project.json.backup'));
    await assert.rejects(() => migrateProjectDirectory(root));
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), original);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('migration never overwrites an existing manifest backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-backup-existing-'));
  try {
    const original = { ...createProject('Backup preservation fixture'), version: 0 };
    const manifestPath = join(root, 'openentc.project.json');
    const backupPath = `${manifestPath}.backup`;
    await writeFile(manifestPath, JSON.stringify(original), 'utf8');
    await writeFile(backupPath, 'previous-backup', 'utf8');
    await assert.rejects(() => migrateProjectDirectory(root), /EEXIST|already exists|file already exists/i);
    assert.equal(await readFile(backupPath, 'utf8'), 'previous-backup');
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), original);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed atomic project writes do not leave temporary manifests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-project-atomic-'));
  try {
    await mkdir(join(root, 'openentc.project.json'));
    await assert.rejects(() => initializeProjectDirectory(root, createProject('Atomic fixture')));
    const entries = await readdir(root);
    assert.equal(entries.some((entry) => entry.includes('.tmp-')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('atomic project writes flush the temporary file before rename', async () => {
  const source = await readFile(new URL('../packages/project-model/src/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /await handle\.writeFile\(content/);
  assert.match(source, /await handle\.sync\(\)/);
  assert.match(source, /await handle\.close\(\);\s*handle = undefined;\s*await rename\(temporary, path\)/);
  assert.match(source, /await rename\(temporary, path\)/);
});

test('history undo and redo restore immutable snapshots', () => {
  const history = createHistory({ value: 1 });
  history.commit({ value: 2 });
  const mutable = history.value;
  mutable.value = 99;
  assert.equal(history.value.value, 2);
  history.undo();
  assert.equal(history.value.value, 1);
  history.redo();
  assert.equal(history.value.value, 2);
});

test('history limit zero disables retention and invalid limits fail early', () => {
  const history = createHistory({ value: 1 }, 0);
  const snapshot = history.commit({ value: 2 });
  assert.deepEqual(snapshot, { past: [], present: { value: 2 }, future: [] });
  assert.equal(history.canUndo, false);
  assert.throws(() => createHistory({}, -1), /limit/);
  assert.throws(() => createHistory({}, 10_001), /limit/);
});

test('version-0 projects saved before the notes field existed migrate without data loss', () => {
  const legacy = { name: 'Old lab', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', circuit: { components: [{ id: 'R1', type: 'resistor', label: 'R1', value: 100, unit: 'Ω', n1: 'a', n2: '0', x: 0, y: 0 }], signal: { shape: 'sine', frequency: 1000, amplitude: 1, offset: 0 } }, embedded: { board: 'Arduino Uno', language: 'C++', code: '' }, settings: { theme: 'dark', grid: true } };
  const project = importProject(JSON.stringify(legacy));
  assert.equal(project.version, 1);
  assert.deepEqual(project.notes, []);
  assert.equal(project.circuit.components[0].id, 'R1');
  assert.equal(legacy.notes, undefined, 'the input object is not mutated');
});

test('browser and Node project models migrate legacy projects identically', async () => {
  const browser = await import('../packages/project-model/src/browser.mjs');
  const node = await import('../packages/project-model/src/index.mjs');
  const legacy = { name: 'Parity', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', circuit: { components: [], signal: { shape: 'sine', frequency: 1000, amplitude: 1, offset: 0 } }, embedded: { board: 'Arduino Uno', language: 'C++', code: '' }, settings: { theme: 'dark', grid: true } };
  const fromBrowser = browser.validateProject(browser.migrateProject(legacy));
  const fromNode = node.validateProject(node.migrateProject(legacy));
  assert.deepEqual(fromBrowser, fromNode);
  assert.deepEqual(fromBrowser.notes, []);
});
