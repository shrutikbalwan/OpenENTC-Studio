import { ProjectError, PROJECT_ERROR_CODES } from './errors.mjs';
import { MAX_EXPERIMENT_DEFINITION_BYTES, MAX_EXPERIMENT_DEFINITIONS, upsertExperiment } from './experiments.mjs';

export { MAX_EXPERIMENT_DEFINITION_BYTES, MAX_EXPERIMENT_DEFINITIONS, upsertExperiment };

export const PROJECT_FORMAT = 'openentc-project';
export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
const utf8ByteLength = (value) => new TextEncoder().encode(value).byteLength;
const boundedLimit = (value, maximum, field) => { const limit = value ?? maximum; if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `${field} limit is outside the allowed range.`); return limit; };
const MAX_ARTIFACT_PATH_BYTES = 4096;
const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_MEDIA_TYPE_BYTES = 200;
const clone = (value) => structuredClone(value);
function assertObject(value, code = PROJECT_ERROR_CODES.INVALID_SHAPE) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectError(code, 'Project must be a JSON object.'); }
function assertFinite(value, field) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `invalid ${field.split(' ').at(-1)} (${field}); must be a finite number.`); }
function assertTimestamp(value, field) { if (typeof value !== 'string' || !value.trim() || value.length > 64 || Number.isNaN(Date.parse(value))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Project ${field} timestamp is invalid.`); }
function validWireRoute(route) { if (!route || typeof route !== 'object' || Array.isArray(route)) return false; if (Array.isArray(route.points)) return Object.keys(route).length === 1 && route.points.length >= 1 && route.points.length <= 64 && route.points.every((point) => point && typeof point === 'object' && !Array.isArray(point) && Object.keys(point).length === 2 && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000); return Object.keys(route).length === 2 && ['x', 'y'].includes(route.axis) && Number.isFinite(route.coordinate) && Math.abs(route.coordinate) <= 1_000_000; }
function isSafeArtifactPath(path) { if (typeof path !== 'string' || !path || path.length > MAX_ARTIFACT_PATH_BYTES || path.includes('\0') || [...path].some((character) => character < ' ' || character === '\u007f') || path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) return false; return path.split(/[\\/]/).every((segment) => segment && segment !== '.' && segment !== '..'); }
function assertSchemaParity(value) {
  const signal = value.circuit.signal;
  if (![signal.frequency, signal.amplitude, signal.offset].every(Number.isFinite)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Signal values must be finite numbers.');
  if (!value.embedded || typeof value.embedded.board !== 'string' || value.embedded.board.length > 200 || typeof value.embedded.language !== 'string' || value.embedded.language.length > 50) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Embedded metadata is invalid.');
  if (!value.units || Array.isArray(value.units)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project units are invalid.');
  if (!value.provenance || Array.isArray(value.provenance) || typeof value.provenance.createdBy !== 'string' || !value.provenance.createdBy.trim() || value.provenance.createdBy.length > 200 || [...value.provenance.createdBy].some((character) => character < ' ' || character === '\u007f') || !value.provenance.engineVersions || typeof value.provenance.engineVersions !== 'object' || Array.isArray(value.provenance.engineVersions) || Object.keys(value.provenance.engineVersions).length > 1000 || Object.entries(value.provenance.engineVersions).some(([key, version]) => !key || key.length > 200 || [...key].some((character) => character < ' ' || character === '\u007f') || typeof version !== 'string' || !version.trim() || version.length > 200 || [...version].some((character) => character < ' ' || character === '\u007f'))) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project provenance is invalid.');
  if (!Array.isArray(value.notes) || value.notes.length > 1000) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project notes are invalid.');
  if (value.artifacts.some((artifact) => typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim())) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project artifacts are invalid.');
  for (const [index, part] of value.circuit.components.entries()) if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(part.id) || part.type.length > 50 || part.label.length > 100 || part.unit.length > 20 || part.n1.length > 100 || part.n2.length > 100) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Component ${index} has an invalid schema field.`);
}

export function createProject(name = 'Untitled ENTC project', now = new Date().toISOString()) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, name: String(name).trim().slice(0, 200) || 'Untitled ENTC project', createdAt: now, updatedAt: now, documents: [], targets: [], toolchainConstraints: [], experiments: [],
    circuit: { wires: [], junctions: [], netLabels: [], components: [
      { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: '0', x: 100, y: 150 },
      { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: 'out', x: 290, y: 90 },
      { id: 'R2', type: 'resistor', label: 'R2', value: 2000, unit: 'Ω', n1: 'out', n2: '0', x: 470, y: 150 },
      { id: 'G1', type: 'ground', label: 'GND', value: 0, unit: 'V', n1: '0', n2: '0', x: 290, y: 270 }
    ], signal: { shape: 'sine', frequency: 1000, amplitude: 5, offset: 0 } },
    embedded: { board: 'Arduino Uno', language: 'C++', code: 'void setup() {}\n\nvoid loop() {}' }, artifacts: [], units: { voltage: 'V', current: 'A', resistance: 'Ω', time: 's', frequency: 'Hz' }, provenance: { createdBy: 'OpenENTC Studio', engineVersions: {} }, notes: [], settings: { theme: 'dark', grid: true, gridSize: 20 } };
}
export function migrateProject(input) { assertObject(input); const value = clone(input); if (value.version === undefined || value.version === 0) { value.version = PROJECT_VERSION; value.format ||= PROJECT_FORMAT; } if (value.version !== PROJECT_VERSION) throw new ProjectError(PROJECT_ERROR_CODES.UNSUPPORTED_VERSION, `Project version ${value.version} is not supported.`); if (value.circuit && value.circuit.wires === undefined) value.circuit.wires = []; if (value.circuit && value.circuit.junctions === undefined) value.circuit.junctions = []; if (value.circuit && value.circuit.netLabels === undefined) value.circuit.netLabels = []; if (value.artifacts === undefined) value.artifacts = []; if (value.units === undefined) value.units = { voltage: 'V', current: 'A', resistance: 'Ω', time: 's', frequency: 'Hz' }; if (value.provenance === undefined) value.provenance = { createdBy: 'OpenENTC Studio', engineVersions: {} }; if (value.settings && value.settings.gridSize === undefined) value.settings.gridSize = 20; return value; }
export function validateProject(input, { maxBytes = MAX_PROJECT_BYTES } = {}) {
  maxBytes = boundedLimit(maxBytes, MAX_PROJECT_BYTES, 'Project byte'); assertObject(input); let encoded; try { encoded = JSON.stringify(input); } catch (error) { throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project contains values that cannot be serialized.', { cause: error?.message ?? String(error) }); } if (typeof encoded !== 'string') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project contains values that cannot be serialized.'); if (utf8ByteLength(encoded) > maxBytes) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project exceeds the allowed size.', { maxBytes }); const value = migrateProject(input); for (const field of ['documents', 'targets', 'toolchainConstraints', 'experiments']) if (value[field] === undefined) value[field] = [];
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
  for (const [index, part] of value.circuit.components.entries()) { assertObject(part); for (const field of ['id', 'type', 'label', 'unit', 'n1', 'n2']) if (typeof part[field] !== 'string' || part[field].length > 200) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Component ${index} has an invalid ${field}.`); if (part.n3 !== undefined && (typeof part.n3 !== 'string' || part.n3.length > 100)) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, `Component ${index} has an invalid n3.`); if (part.kp !== undefined) assertFinite(part.kp, `Component ${part.id} kp`); assertFinite(part.value, `Component ${part.id} value`); assertFinite(part.x, `Component ${part.id} x`); assertFinite(part.y, `Component ${part.id} y`); if (part.rotation !== undefined) assertFinite(part.rotation, `Component ${part.id} rotation`); }
  assertSchemaParity(value);
  return value;
}
export function serializeProject(project) { return `${JSON.stringify(validateProject(project), null, 2)}\n`; }
export function exportProject(project) { return serializeProject(project); }
export function importProject(text, options) { if (typeof text !== 'string') throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project input must be text.'); if (utf8ByteLength(text) > (options?.maxBytes ?? MAX_PROJECT_BYTES)) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project input exceeds the allowed size.'); let parsed; try { parsed = JSON.parse(text); } catch (error) { throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project JSON is invalid.', { cause: error.message }); } return validateProject(parsed, options); }

const rawMigrateProject = migrateProject;
migrateProject = function migrateProjectWithRegistries(input) {
  const value = rawMigrateProject(input);
  for (const field of ['documents', 'targets', 'toolchainConstraints', 'experiments']) if (value[field] === undefined) value[field] = [];
  return value;
};

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
