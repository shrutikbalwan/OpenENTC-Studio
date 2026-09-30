export const RESULT_KINDS = Object.freeze(['scalar', 'table', 'waveform', 'spectrum', 'digital-trace', 'constellation', 'network', 'packet-trace', 'field-reference', 'artifact', 'report']);
export const MAX_RESULT_POINTS = 1_000_000;
export const MAX_RESULT_PAYLOAD_BYTES = 64 * 1024 * 1024;
export const MAX_RESULT_PROVENANCE_INPUT_BYTES = 1_000_000;
const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_ARTIFACT_PATH_BYTES = 4096;
const MAX_MEDIA_TYPE_BYTES = 200;

function utf8ByteLength(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
  return unescape(encodeURIComponent(value)).length;
}

function cloneBounded(value) {
  let cloned;
  try { cloned = structuredClone(value); } catch { throw new TypeError('Result data must be cloneable.'); }
  try {
    const serialized = JSON.stringify(cloned);
    if (typeof serialized !== 'string') throw new TypeError('Result data must be JSON-serializable.');
    const bytes = utf8ByteLength(serialized);
    if (bytes > MAX_RESULT_PAYLOAD_BYTES) throw new TypeError('Result data exceeds the bounded payload limit.');
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('bounded payload')) throw error;
    throw new TypeError('Result data must be JSON-serializable.');
  }
  return cloned;
}

function isSafeArtifactPath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= MAX_ARTIFACT_PATH_BYTES && !path.startsWith('/') && !path.startsWith('\\') && !/^[A-Za-z]:[\\/]/.test(path) && ![...path].some((character) => character < ' ' || character === '\u007f') && path.split(/[\\/]/).every((segment) => segment && segment !== '.' && segment !== '..');
}

function validateArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > 100_000 || artifacts.some((artifact) => !artifact || !isSafeArtifactPath(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isInteger(artifact.size) || artifact.size < 0 || artifact.size > MAX_ARTIFACT_BYTES || typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim() || artifact.mediaType.length > MAX_MEDIA_TYPE_BYTES)) throw new TypeError('Result artifacts must contain bounded safe references.');
}

export function createResult({ kind, provenance, data = null, units = null, sampleRate = null, artifacts = [] }) {
  if (!RESULT_KINDS.includes(kind)) throw new TypeError(`Unsupported result kind: ${kind}`);
  if (!provenance || typeof provenance.engine !== 'string' || !provenance.engine.trim() || !Array.isArray(provenance.inputs) || provenance.inputs.length > 100_000 || provenance.inputs.some((input) => typeof input !== 'string' || !input.trim() || utf8ByteLength(input) > MAX_RESULT_PROVENANCE_INPUT_BYTES)) throw new TypeError('Result provenance must include bounded engine and input identifiers.');
  if (units !== null && (typeof units !== 'string' || !units.trim() || units.length > 64)) throw new TypeError('Result units must be text or null.');
  if (sampleRate !== null && (!(typeof sampleRate === 'number') || !Number.isFinite(sampleRate) || sampleRate <= 0)) throw new TypeError('Sample rate must be positive or null.');
  validateArtifacts(artifacts);
  return Object.freeze({ kind, provenance: cloneBounded(provenance), data: cloneBounded(data), units, sampleRate, artifacts: cloneBounded(artifacts) });
}

export function scalarResult(value, units, provenance) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Scalar result must be finite.');
  return createResult({ kind: 'scalar', data: value, units, provenance });
}

export function waveformResult(points, { units = null, sampleRate, provenance }) {
  if (!Array.isArray(points) || points.length > MAX_RESULT_POINTS || points.some((point) => !point || !Number.isFinite(point.t) || !Number.isFinite(point.v))) throw new TypeError('Waveform points must be bounded and contain finite t and v values.');
  for (let index = 1; index < points.length; index += 1) if (points[index].t < points[index - 1].t) throw new TypeError('Waveform timestamps must be non-decreasing.');
  return createResult({ kind: 'waveform', data: points, units, sampleRate, provenance });
}

export function tableResult(rows, { columns = [], units = null, provenance }) {
  if (!Array.isArray(rows) || rows.length > 100_000 || rows.some((row) => !Array.isArray(row) || row.length > 256 || row.some((value) => typeof value !== 'number' || !Number.isFinite(value)))) throw new TypeError('Table rows must be bounded finite numeric arrays.');
  if (!Array.isArray(columns) || columns.some((column) => typeof column !== 'string')) throw new TypeError('Table columns must be strings.');
  return createResult({ kind: 'table', data: { columns: [...columns], rows: rows.map((row) => [...row]) }, units, provenance });
}

export function digitalTraceResult(signals, { timescale, provenance }) {
  if (!Array.isArray(signals) || signals.length > 4096 || signals.some((signal) => !signal || typeof signal.name !== 'string' || !Array.isArray(signal.samples) || signal.samples.length > 1_000_000 || signal.samples.some((sample) => !Number.isInteger(sample.time) || sample.time < 0 || !['0', '1', 'x', 'z'].includes(sample.value)))) throw new TypeError('Digital trace signals are invalid or exceed limits.');
  if (typeof timescale !== 'string' || !timescale.trim()) throw new TypeError('Digital trace timescale is required.');
  return createResult({ kind: 'digital-trace', data: { timescale, signals: structuredClone(signals) }, provenance });
}

export function constellationResult(symbols, { modulation, provenance }) {
  if (!Array.isArray(symbols) || symbols.length > 1_000_000 || symbols.some((symbol) => !symbol || !Number.isFinite(symbol.i) || !Number.isFinite(symbol.q))) throw new TypeError('Constellation symbols are invalid or exceed limits.');
  if (typeof modulation !== 'string' || !modulation.trim()) throw new TypeError('Constellation modulation is required.');
  return createResult({ kind: 'constellation', data: { modulation, symbols: symbols.map((symbol) => ({ i: symbol.i, q: symbol.q })) }, units: 'normalized', provenance });
}
