const INTEGRATIONS = new Set(['process', 'shared-library', 'interoperable']);
const INSTALL_MODES = new Set(['bundled', 'system', 'user-configured', 'downloaded', 'none']);
const PLATFORMS = new Set(['windows', 'linux', 'macos']);
const MAX_MANIFEST_ID_BYTES = 100;
const MAX_MANIFEST_LIST_ITEMS = 128;
const MAX_MANIFEST_STRING_BYTES = 4096;

export function validateEngineManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('Engine manifest must be an object.');
  for (const field of ['id', 'name', 'license', 'sourceUrl']) if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw new TypeError(`Engine manifest ${field} is required.`);
  if (manifest.id.length > MAX_MANIFEST_ID_BYTES || manifest.name.length > MAX_MANIFEST_STRING_BYTES || manifest.license.length > 200 || manifest.sourceUrl.length > MAX_MANIFEST_STRING_BYTES) throw new TypeError('Engine manifest metadata exceeds bounds.');
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(manifest.id)) throw new TypeError('Engine manifest id is invalid.');
  if (!/^https?:\/\//.test(manifest.sourceUrl)) throw new TypeError('Engine manifest sourceUrl must be HTTPS or HTTP.');
  if (!INTEGRATIONS.has(manifest.integration)) throw new TypeError('Engine manifest integration is invalid.');
  if (manifest.installMode !== undefined && !INSTALL_MODES.has(manifest.installMode)) throw new TypeError('Engine manifest installMode is invalid.');
  if (!Array.isArray(manifest.operations) || manifest.operations.length === 0 || manifest.operations.length > MAX_MANIFEST_LIST_ITEMS || manifest.operations.some((operation) => typeof operation !== 'string' || !operation.trim() || operation.length > 200)) throw new TypeError('Engine manifest operations are required and bounded.');
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0 || manifest.platforms.length > MAX_MANIFEST_LIST_ITEMS || manifest.platforms.some((platform) => !PLATFORMS.has(platform))) throw new TypeError('Engine manifest platforms are invalid.');
  if (manifest.executableCandidates !== undefined && (!Array.isArray(manifest.executableCandidates) || manifest.executableCandidates.length > MAX_MANIFEST_LIST_ITEMS || manifest.executableCandidates.some((candidate) => typeof candidate !== 'string' || candidate.length > MAX_MANIFEST_STRING_BYTES || !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(candidate)))) throw new TypeError('Engine manifest executableCandidates must be bounded absolute paths.');
  return structuredClone(manifest);
}
