import { constants } from 'node:fs';
import { access, copyFile, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { ProjectError, PROJECT_ERROR_CODES } from './errors.mjs';

export { createHistory } from './history.mjs';
export { MAX_EXPERIMENT_DEFINITION_BYTES, MAX_EXPERIMENT_DEFINITIONS, upsertExperiment } from './experiments.mjs';
export { createProjectArchive, importProjectArchive, PROJECT_ARCHIVE_ENTRY, PROJECT_ARCHIVE_EXTENSION, PROJECT_ARCHIVE_MEDIA_TYPE } from './archive.mjs';
export { ProjectError, PROJECT_ERROR_CODES } from './errors.mjs';

export const PROJECT_FORMAT = 'openentc-project';
export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
export const AUTHORED_DIRECTORIES = Object.freeze(['design', 'firmware', 'hdl', 'models', 'experiments', 'data', 'notes']);
export const GENERATED_DIRECTORIES = Object.freeze(['runs', 'build']);
const MAX_ARTIFACT_PATH_BYTES = 4096;
const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_MEDIA_TYPE_BYTES = 200;
export const MAX_ARCHIVE_ENTRIES = 100_000;
export const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;

const clone = (value) => structuredClone(value);
const utf8ByteLength = (value) => new TextEncoder().encode(value).byteLength;

function boundedLimit(value, maximum, field) {
  const limit = value ?? maximum;
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `${field} limit is outside the allowed range.`);
  return limit;
}

function assertObject(value, code = PROJECT_ERROR_CODES.INVALID_SHAPE) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectError(code, 'Project must be a JSON object.');
}

function assertFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `invalid ${field.split(' ').at(-1)} (${field}); must be a finite number.`);
}

function assertTimestamp(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 64 || Number.isNaN(Date.parse(value))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Project ${field} timestamp is invalid.`);
}

function validWireRoute(route) {
  if (!route || typeof route !== 'object' || Array.isArray(route)) return false;
  if (Array.isArray(route.points)) return Object.keys(route).length === 1 && route.points.length >= 1 && route.points.length <= 64 && route.points.every((point) => point && typeof point === 'object' && !Array.isArray(point) && Object.keys(point).length === 2 && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000);
  return Object.keys(route).length === 2 && ['x', 'y'].includes(route.axis) && Number.isFinite(route.coordinate) && Math.abs(route.coordinate) <= 1_000_000;
}

function isSafeArtifactPath(path) {
  if (typeof path !== 'string' || !path || path.length > MAX_ARTIFACT_PATH_BYTES || path.includes('\0') || [...path].some((character) => character < ' ' || character === '\u007f') || path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) return false;
  return path.split(/[\\/]/).every((segment) => segment && segment !== '.' && segment !== '..');
}

/**
 * Validate archive metadata before any extraction is attempted. This is a
 * pure boundary: it never opens, creates, or deletes files. Callers must use
 * the returned normalized entries and still extract into an approved root.
 */
export function validateArchiveEntries(entries, { maxEntries = MAX_ARCHIVE_ENTRIES, maxBytes = MAX_ARCHIVE_BYTES } = {}) {
  maxEntries = boundedLimit(maxEntries, MAX_ARCHIVE_ENTRIES, 'Archive entry count');
  maxBytes = boundedLimit(maxBytes, MAX_ARCHIVE_BYTES, 'Archive byte');
  if (!Array.isArray(entries) || entries.length > maxEntries) {
    throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Archive contains too many entries.', { maxEntries });
  }
  let totalBytes = 0;
  const seen = new Set();
  const normalized = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.path !== 'string') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Archive entry ${index} is invalid.`);
    const path = entry.path.replaceAll('\\', '/');
    const type = entry.type ?? 'file';
    if (!['file', 'directory'].includes(type) || !isSafeArtifactPath(path) || path.endsWith('/')) {
      throw new ProjectError(PROJECT_ERROR_CODES.PATH_ESCAPE, `Archive entry ${index} has an unsafe path or type.`);
    }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_ARTIFACT_BYTES || type === 'directory' && entry.size !== 0) {
      throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Archive entry ${index} has an invalid size.`);
    }
    const key = path.toLocaleLowerCase('en-US');
    if (seen.has(key)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Archive contains a duplicate path: ${path}.`);
    seen.add(key);
    totalBytes += entry.size;
    if (totalBytes > maxBytes) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Archive exceeds the allowed uncompressed size.', { maxBytes });
    return { path, size: entry.size, type };
  });
  return normalized.sort((left, right) => left.path.localeCompare(right.path));
}

function assertSchemaParity(value) {
  const signal = value.circuit.signal;
  if (![signal.frequency, signal.amplitude, signal.offset].every(Number.isFinite)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Signal values must be finite numbers.');
  if (!value.embedded || typeof value.embedded.board !== 'string' || value.embedded.board.length > 200 || typeof value.embedded.language !== 'string' || value.embedded.language.length > 50) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Embedded metadata is invalid.');
  if (!value.units || Array.isArray(value.units)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project units are invalid.');
  if (!value.provenance || Array.isArray(value.provenance) || typeof value.provenance.createdBy !== 'string' || !value.provenance.createdBy.trim() || value.provenance.createdBy.length > 200 || [...value.provenance.createdBy].some((character) => character < ' ' || character === '\u007f') || !value.provenance.engineVersions || typeof value.provenance.engineVersions !== 'object' || Array.isArray(value.provenance.engineVersions) || Object.keys(value.provenance.engineVersions).length > 1000 || Object.entries(value.provenance.engineVersions).some(([key, version]) => !key || key.length > 200 || [...key].some((character) => character < ' ' || character === '\u007f') || typeof version !== 'string' || !version.trim() || version.length > 200 || [...version].some((character) => character < ' ' || character === '\u007f'))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project provenance is invalid.');
  if (!Array.isArray(value.notes) || value.notes.length > 1000) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project notes are invalid.');
  if (value.artifacts.some((artifact) => typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim())) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project artifacts are invalid.');
  for (const [index, part] of value.circuit.components.entries()) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(part.id) || part.type.length > 50 || part.label.length > 100 || part.unit.length > 20 || part.n1.length > 100 || part.n2.length > 100) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Component ${index} has an invalid schema field.`);
  }
}

export function createProject(name = 'Untitled ENTC project', now = new Date().toISOString()) {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: String(name).trim().slice(0, 200) || 'Untitled ENTC project',
    createdAt: now,
    updatedAt: now,
    circuit: {
      wires: [], junctions: [], netLabels: [],
      components: [
        { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: '0', x: 100, y: 150 },
        { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: 'out', x: 290, y: 90 },
        { id: 'R2', type: 'resistor', label: 'R2', value: 2000, unit: 'Ω', n1: 'out', n2: '0', x: 470, y: 150 },
        { id: 'G1', type: 'ground', label: 'GND', value: 0, unit: 'V', n1: '0', n2: '0', x: 290, y: 270 }
      ],
      signal: { shape: 'sine', frequency: 1000, amplitude: 5, offset: 0 }
    },
    embedded: { board: 'Arduino Uno', language: 'C++', code: 'void setup() {}\n\nvoid loop() {}' }, artifacts: [], units: { voltage: 'V', current: 'A', resistance: 'Ω', time: 's', frequency: 'Hz' }, provenance: { createdBy: 'OpenENTC Studio', engineVersions: {} },
    documents: [], targets: [], toolchainConstraints: [], experiments: [],
    notes: [],
    settings: { theme: 'dark', grid: true, gridSize: 20 }
  };
}

export function migrateProject(input) {
  assertObject(input);
  const value = clone(input);
  if (value.version === undefined || value.version === 0) {
    value.version = PROJECT_VERSION;
    value.format ||= PROJECT_FORMAT;
  }
  if (value.version !== PROJECT_VERSION) throw new ProjectError(PROJECT_ERROR_CODES.UNSUPPORTED_VERSION, `Project version ${value.version} is not supported.`);
  if (value.circuit && value.circuit.wires === undefined) value.circuit.wires = [];
  if (value.circuit && value.circuit.junctions === undefined) value.circuit.junctions = [];
  if (value.circuit && value.circuit.netLabels === undefined) value.circuit.netLabels = [];
  if (value.artifacts === undefined) value.artifacts = [];
  if (value.units === undefined) value.units = { voltage: 'V', current: 'A', resistance: 'Ω', time: 's', frequency: 'Hz' };
  if (value.provenance === undefined) value.provenance = { createdBy: 'OpenENTC Studio', engineVersions: {} };
  if (value.documents === undefined) value.documents = [];
  if (value.targets === undefined) value.targets = [];
  if (value.toolchainConstraints === undefined) value.toolchainConstraints = [];
  if (value.experiments === undefined) value.experiments = [];
  if (value.settings && value.settings.gridSize === undefined) value.settings.gridSize = 20;
  return value;
}

export function validateProject(input, { maxBytes = MAX_PROJECT_BYTES } = {}) {
  maxBytes = boundedLimit(maxBytes, MAX_PROJECT_BYTES, 'Project byte');
  assertObject(input);
  let encoded;
  try { encoded = JSON.stringify(input); }
  catch (error) { throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project contains values that cannot be serialized.', { cause: error?.message ?? String(error) }); }
  if (typeof encoded !== 'string') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project contains values that cannot be serialized.');
  if (utf8ByteLength(encoded) > maxBytes) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project exceeds the allowed size.', { maxBytes });
  const value = migrateProject(input);
  if (value.format !== PROJECT_FORMAT) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project format is invalid.');
  if (!Number.isInteger(value.version) || value.version < 1) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project version is invalid.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project name is invalid.');
  assertTimestamp(value.createdAt, 'createdAt'); assertTimestamp(value.updatedAt, 'updatedAt');
  if (!value.circuit || !Array.isArray(value.circuit.components) || value.circuit.components.length > 10000) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Circuit components are invalid.');
  if (value.circuit.wires !== undefined && (!Array.isArray(value.circuit.wires) || value.circuit.wires.length > 100000 || value.circuit.wires.some((wire) => !wire || typeof wire.from !== 'string' || !wire.from.trim() || wire.from.length > 100 || typeof wire.to !== 'string' || !wire.to.trim() || wire.to.length > 100 || (wire.route !== undefined && !validWireRoute(wire.route))))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Circuit wires are invalid.');
  for (const [field, limit] of [['junctions', 10000], ['netLabels', 10000]]) if (!Array.isArray(value.circuit[field]) || value.circuit[field].length > limit || value.circuit[field].some((entry) => !entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 100 || typeof entry.node !== 'string' || !entry.node.trim() || entry.node.length > 100 || !Number.isFinite(entry.x) || !Number.isFinite(entry.y) || (field === 'netLabels' && (typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 100)))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Circuit ${field} are invalid.`);
  if (!value.circuit.signal || !['sine', 'square', 'triangle'].includes(value.circuit.signal.shape)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Signal shape is invalid.');
  if (!(Number.isFinite(value.circuit.signal.frequency) && value.circuit.signal.frequency > 0)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Signal frequency must be positive.');
  if (!value.embedded || typeof value.embedded.code !== 'string' || value.embedded.code.length > 1_000_000) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Embedded source is invalid.');
  if (!Array.isArray(value.artifacts) || value.artifacts.length > 100000 || value.artifacts.some((artifact) => !artifact || !isSafeArtifactPath(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isInteger(artifact.size) || artifact.size < 0 || artifact.size > MAX_ARTIFACT_BYTES || typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim() || artifact.mediaType.length > MAX_MEDIA_TYPE_BYTES)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project artifacts are invalid.');
  if (!value.units || typeof value.units !== 'object' || Object.values(value.units).some((unit) => typeof unit !== 'string' || !unit.trim())) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project units are invalid.');
  if (!value.provenance || typeof value.provenance !== 'object' || typeof value.provenance.createdBy !== 'string' || !value.provenance.createdBy.trim() || !value.provenance.engineVersions || typeof value.provenance.engineVersions !== 'object') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project provenance is invalid.');
  for (const [field, limit] of [['documents', 1000], ['targets', 1000], ['toolchainConstraints', 1000], ['experiments', 10000]]) if (!Array.isArray(value[field]) || value[field].length > limit || value[field].some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Project ${field} are invalid.`);
  for (const field of ['documents', 'targets', 'toolchainConstraints', 'experiments']) for (const entry of value[field]) if (entry.id !== undefined && (typeof entry.id !== 'string' || entry.id.length > 200 || [...entry.id].some((character) => character < ' ' || character === '\u007f'))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Project ${field} contains an invalid id.`);
  if (!value.settings || !Number.isInteger(value.settings.gridSize) || value.settings.gridSize < 1 || value.settings.gridSize > 200) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project grid size is invalid.');
  for (const [index, part] of value.circuit.components.entries()) {
    assertObject(part);
    for (const field of ['id', 'type', 'label', 'unit', 'n1', 'n2']) if (typeof part[field] !== 'string' || part[field].length > 200) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Component ${index} has an invalid ${field}.`);
    assertFinite(part.value, `Component ${part.id} value`);
    assertFinite(part.x, `Component ${part.id} x`);
    assertFinite(part.y, `Component ${part.id} y`);
    if (part.rotation !== undefined) assertFinite(part.rotation, `Component ${part.id} rotation`);
  }
  assertSchemaParity(value);
  return value;
}

export function serializeProject(project) {
  return `${JSON.stringify(validateProject(project), null, 2)}\n`;
}

export function exportProject(project) {
  return serializeProject(project);
}

export function importProject(text, options) {
  if (typeof text !== 'string') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project input must be text.');
  if (utf8ByteLength(text) > (options?.maxBytes ?? MAX_PROJECT_BYTES)) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project input exceeds the allowed size.');
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project JSON is invalid.', { cause: error.message }); }
  return validateProject(parsed, options);
}

export function registerArtifact(project, artifact) {
  const value = validateProject(project);
  if (!artifact || !isSafeArtifactPath(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isInteger(artifact.size) || artifact.size < 0 || artifact.size > MAX_ARTIFACT_BYTES || typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim() || artifact.mediaType.length > MAX_MEDIA_TYPE_BYTES) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Artifact reference is invalid.');
  if (value.artifacts.some((existing) => existing.path === artifact.path || existing.sha256 === artifact.sha256)) return value;
  value.artifacts.push({ ...artifact });
  return value;
}

export function registerArtifactManifest(project, manifest) {
  const hasControl = (value) => [...value].some((character) => character < ' ' || character === '\u007f');
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || manifest.format !== 'openentc-artifact-manifest' || manifest.version !== 1 || typeof manifest.tool !== 'string' || !manifest.tool.trim() || manifest.tool.length > 200 || hasControl(manifest.tool) || typeof manifest.toolVersion !== 'string' || !manifest.toolVersion.trim() || manifest.toolVersion.length > 200 || hasControl(manifest.toolVersion) || (manifest.generatedAt !== null && (typeof manifest.generatedAt !== 'string' || Number.isNaN(Date.parse(manifest.generatedAt)))) || !Array.isArray(manifest.artifacts) || manifest.artifacts.length > 100000) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Artifact manifest is invalid.');
  let value = validateProject(project);
  for (const artifact of manifest.artifacts) value = registerArtifact(value, artifact);
  value.provenance = { ...value.provenance, engineVersions: { ...value.provenance.engineVersions, [manifest.tool]: manifest.toolVersion } };
  return value;
}

export function removeArtifact(project, path) {
  const value = validateProject(project);
  if (typeof path !== 'string' || !path) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Artifact path is required.');
  value.artifacts = value.artifacts.filter((artifact) => artifact.path !== path);
  return value;
}

function assertInside(root, target) {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  const rel = relative(rootPath, targetPath);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(rootPath, rel) !== targetPath) throw new ProjectError(PROJECT_ERROR_CODES.PATH_ESCAPE, 'Project path escapes its approved root.');
  return targetPath;
}

async function assertSafeDirectoryEntry(target) {
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new ProjectError(PROJECT_ERROR_CODES.PATH_ESCAPE, 'Generated project directories cannot be symbolic links.');
    if (!info.isDirectory()) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Generated project entries must be directories.');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

async function safeProjectRoot(root) {
  const projectRoot = resolve(root);
  try {
    const info = await lstat(projectRoot);
    if (info.isSymbolicLink()) throw new ProjectError(PROJECT_ERROR_CODES.PATH_ESCAPE, 'Project roots cannot be symbolic links.');
    if (!info.isDirectory()) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project root must be a directory.');
  } catch (error) {
    if (error?.code === 'ENOENT') return projectRoot;
    throw error;
  }
  return projectRoot;
}

export async function initializeProjectDirectory(root, project = createProject()) {
  const projectRoot = resolve(root);
  await mkdir(projectRoot, { recursive: true });
  await safeProjectRoot(projectRoot);
  for (const directory of [...AUTHORED_DIRECTORIES, ...GENERATED_DIRECTORIES]) {
    const target = assertInside(projectRoot, join(projectRoot, directory));
    await assertSafeDirectoryEntry(target);
    await mkdir(target, { recursive: true });
  }
  await atomicWrite(join(projectRoot, 'openentc.project.json'), serializeProject(project));
  return projectRoot;
}

export async function saveProjectDirectory(root, project) {
  const projectRoot = await safeProjectRoot(root);
  await access(projectRoot);
  await atomicWrite(assertInside(projectRoot, join(projectRoot, 'openentc.project.json')), serializeProject(project));
  return projectRoot;
}

export async function openProjectDirectory(root) {
  const projectRoot = await safeProjectRoot(root);
  const manifest = assertInside(projectRoot, join(projectRoot, 'openentc.project.json'));
  try { return importProject(await readFile(manifest, 'utf8')); }
  catch (error) { if (error instanceof ProjectError) throw error; throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project manifest could not be opened.', { cause: error.message }); }
}

export async function backupProjectManifest(root) {
  const projectRoot = await safeProjectRoot(root);
  const manifest = assertInside(projectRoot, join(projectRoot, 'openentc.project.json'));
  const backup = `${manifest}.backup`;
  await access(manifest);
  await copyFile(manifest, backup, constants.COPYFILE_EXCL);
  return backup;
}

export async function migrateProjectDirectory(root) {
  const projectRoot = await safeProjectRoot(root);
  const manifest = assertInside(projectRoot, join(projectRoot, 'openentc.project.json'));
  const original = await readFile(manifest, 'utf8');
  let migrated;
  try { migrated = importProject(original); }
  catch (error) { throw error instanceof ProjectError ? error : new ProjectError(PROJECT_ERROR_CODES.MIGRATION_FAILED, 'Project migration failed.', { cause: error.message }); }
  if (JSON.stringify(JSON.parse(original)) !== JSON.stringify(migrated)) {
    await backupProjectManifest(projectRoot);
    await atomicWrite(manifest, serializeProject(migrated));
  }
  return migrated;
}

export async function cleanGeneratedDirectories(root) {
  const projectRoot = await safeProjectRoot(root);
  const removed = [];
  for (const directory of GENERATED_DIRECTORIES) {
    const target = assertInside(projectRoot, join(projectRoot, directory));
    await assertSafeDirectoryEntry(target);
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    removed.push(directory);
  }
  return removed;
}

async function atomicWrite(path, content) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(content, { encoding: 'utf8' });
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, path);
  } finally {
    if (handle) { try { await handle.close(); } catch { /* preserve the original write error */ } }
    try { await rm(temporary, { force: true }); } catch { /* preserve the original write error */ }
  }
}
