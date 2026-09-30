export const PLUGIN_API_VERSION = 1;
export const PLUGIN_PERMISSIONS = Object.freeze(['filesystem.project', 'process.engine', 'network.local', 'device.serial', 'device.usb']);
export const PLUGIN_TRUST_LEVELS = Object.freeze(['builtin', 'reviewed', 'untrusted']);

export function validatePluginManifest(manifest, { apiVersion = PLUGIN_API_VERSION } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('Plugin manifest must be an object.');
  for (const field of ['id', 'name', 'version', 'license', 'sourceUrl']) if (typeof manifest[field] !== 'string' || !manifest[field].trim()) throw new TypeError(`Plugin manifest ${field} is required.`);
  if (!/^[a-z0-9][a-z0-9._-]{1,80}$/.test(manifest.id)) throw new TypeError('Plugin id is invalid.');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) throw new TypeError('Plugin version must be semver-like.');
  if (!/^[A-Z0-9][A-Z0-9.-]*(?:[-+][A-Za-z0-9.-]+)?$/.test(manifest.license)) throw new TypeError('Plugin license must be an SPDX-like identifier.');
  try { new URL(manifest.sourceUrl); } catch { throw new TypeError('Plugin sourceUrl must be an absolute URL.'); }
  if (manifest.apiVersion !== apiVersion) throw Object.assign(new Error(`Plugin API ${manifest.apiVersion} is incompatible with API ${apiVersion}.`), { code: 'PLUGIN_API_INCOMPATIBLE' });
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some((permission) => !PLUGIN_PERMISSIONS.includes(permission))) throw new TypeError('Plugin permissions contain an undeclared capability.');
  if (manifest.entrypoint !== undefined && (typeof manifest.entrypoint !== 'string' || manifest.entrypoint.startsWith('/') || manifest.entrypoint.includes('..'))) throw new TypeError('Plugin entrypoint must be a safe relative path.');
  return Object.freeze({ ...structuredClone(manifest), permissions: Object.freeze([...new Set(manifest.permissions)]) });
}

export function declaredPermissions(manifest) {
  return new Set(validatePluginManifest(manifest).permissions);
}

export function assessPluginTrust(manifest, { builtInIds = [], reviewedSourceUrls = [] } = {}) {
  const valid = validatePluginManifest(manifest);
  if (builtInIds.includes(valid.id)) return Object.freeze({ level: 'builtin', loadable: true, reason: 'Plugin id is allow-listed by the host.' });
  if (reviewedSourceUrls.includes(valid.sourceUrl)) return Object.freeze({ level: 'reviewed', loadable: true, reason: 'Plugin source is explicitly reviewed by the host policy.' });
  return Object.freeze({ level: 'untrusted', loadable: false, reason: 'Unsigned or unreviewed plugins are not loadable by default.' });
}

export function authorizePluginPermission(manifest, permission, grantedPermissions = []) {
  const valid = validatePluginManifest(manifest);
  if (!PLUGIN_PERMISSIONS.includes(permission) || !valid.permissions.includes(permission)) {
    throw Object.assign(new Error(`Plugin permission '${permission}' was not declared.`), { code: 'PLUGIN_PERMISSION_UNDECLARED' });
  }
  if (!(grantedPermissions instanceof Set ? grantedPermissions : new Set(grantedPermissions)).has(permission)) {
    throw Object.assign(new Error(`Plugin permission '${permission}' was not granted.`), { code: 'PLUGIN_PERMISSION_DENIED' });
  }
  return true;
}
