import { validateEngineManifest } from './manifest.mjs';

export const MAX_DISCOVERY_CANDIDATES = 64;
export const MAX_DISCOVERY_PATH_BYTES = 4096;
export const MAX_ENGINE_ID_BYTES = 100;
export const MAX_MANIFEST_BYTES = 256 * 1024;

async function loadNativeFilesystem() {
  try {
    const [promises, filesystem] = await Promise.all([import('node:fs/promises'), import('node:fs')]);
    return { access: promises.access, stat: promises.stat, readFile: promises.readFile, constants: filesystem.constants };
  } catch (error) {
    throw Object.assign(new Error('Native filesystem discovery is unavailable in this environment.', { cause: error }), { code: 'NATIVE_DISCOVERY_UNAVAILABLE' });
  }
}

export function assertAbsoluteExecutable(path) {
  if (typeof path !== 'string' || !path || path.length > MAX_DISCOVERY_PATH_BYTES || path.includes('\0') || [...path].some((character) => character < ' ' || character === '\u007f') || !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(path)) throw new TypeError('Executable path must be an absolute bounded path.');
  return path;
}

export async function probeExecutable({ id, candidates = [] }) {
  if (typeof id !== 'string' || !id.trim() || id.length > MAX_ENGINE_ID_BYTES || [...id].some((character) => character < ' ' || character === '\u007f')) throw new TypeError('Engine id is required and bounded.');
  if (!Array.isArray(candidates) || candidates.length > MAX_DISCOVERY_CANDIDATES || candidates.some((candidate) => typeof candidate !== 'string' || !candidate.trim())) throw new TypeError('Executable candidates must be a bounded list of non-empty paths.');
  const { access, constants } = await loadNativeFilesystem();
  for (const candidate of candidates) {
    if (!/^(?:[A-Za-z]:[\\/]|[\\/])/.test(candidate)) continue;
    assertAbsoluteExecutable(candidate);
    try { await access(candidate, constants.F_OK); return Object.freeze({ id, status: 'detected', path: candidate, evidence: 'filesystem-exists' }); } catch { /* continue read-only probe */ }
  }
  return Object.freeze({ id, status: 'missing', path: null, evidence: 'no-candidate-found' });
}

export async function probeEngineManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || typeof manifest.id !== 'string') throw new TypeError('Engine manifest must include an id.');
  const result = await probeExecutable({ id: manifest.id, candidates: manifest.executableCandidates ?? [] });
  return Object.freeze({ ...result, displayName: manifest.displayName ?? manifest.id, supportedOperations: [...(manifest.operations ?? [])] });
}

export async function loadAndProbeManifest(path) {
  assertAbsoluteExecutable(path);
  const { stat, readFile } = await loadNativeFilesystem();
  const metadata = await stat(path).catch((error) => { throw new Error(`Engine manifest could not be read: ${error.message}`, { cause: error }); });
  if (!metadata.isFile() || metadata.size > MAX_MANIFEST_BYTES) throw new Error('Engine manifest exceeds the bounded read limit.');
  let parsed;
  try { parsed = JSON.parse(await readFile(path, 'utf8')); } catch (error) { throw new Error(`Engine manifest could not be read: ${error.message}`, { cause: error }); }
  return probeEngineManifest(validateEngineManifest(parsed));
}
