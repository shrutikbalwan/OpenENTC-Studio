export const MAX_EXPERIMENT_DEFINITION_BYTES = 64 * 1024;
export const MAX_EXPERIMENT_DEFINITIONS = 10_000;

function utf8ByteLength(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
  return unescape(encodeURIComponent(value)).length;
}

/** Return a new bounded authored-experiment registry without mutating the caller. */
export function upsertExperiment(experiments, definition, now = new Date().toISOString()) {
  if (!Array.isArray(experiments)) throw new Error('Experiment registry must be an array.');
  if (!definition || typeof definition !== 'object' || Array.isArray(definition) || typeof definition.id !== 'string' || !definition.id.trim() || definition.id.length > 200 || [...definition.id].some((character) => character < ' ' || character === '\u007f')) throw new Error('Experiment definition id is invalid.');
  let encoded;
  try { encoded = JSON.stringify(definition); } catch { throw new Error('Experiment definition must be JSON-serializable.'); }
  if (utf8ByteLength(encoded) > MAX_EXPERIMENT_DEFINITION_BYTES) throw new Error('Experiment definition exceeds the 64 KiB limit.');
  const next = structuredClone(experiments);
  const value = { ...structuredClone(definition), updatedAt: now };
  const index = next.findIndex((experiment) => experiment?.id === value.id);
  if (index < 0) next.push(value);
  else next[index] = { ...next[index], ...value };
  return next.length > MAX_EXPERIMENT_DEFINITIONS ? next.slice(-MAX_EXPERIMENT_DEFINITIONS) : next;
}
