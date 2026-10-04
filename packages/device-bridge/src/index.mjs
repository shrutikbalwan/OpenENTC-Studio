// Physical-device permission policy (serial, USB, debug, capture, SDR, programmer) and a bounded
// serial session; browsers are always denied native device scopes.
const PERMISSIONS = Object.freeze(['serial', 'usb', 'debug', 'capture', 'sdr', 'programmer']);
const TARGET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SERIAL_ENCODINGS = Object.freeze(['utf-8', 'ascii']);
const SERIAL_LINE_ENDINGS = Object.freeze(['none', 'lf', 'cr', 'crlf']);
const encoder = new TextEncoder();

export const DEVICE_PERMISSIONS = PERMISSIONS;

function assertPermission(permission) {
  if (!PERMISSIONS.includes(permission)) throw new TypeError(`Unsupported device permission: ${String(permission)}.`);
}

function assertTarget(target) {
  if (typeof target !== 'string' || !TARGET_PATTERN.test(target)) throw new TypeError('Device target must be a bounded identifier.');
}

// Grants are per (permission, target) and expire: a session must be re-approved after grantTtlMs
// (default one hour). revokeAll() is called when a project closes so no grant outlives its project.
export const DEFAULT_GRANT_TTL_MS = 60 * 60 * 1000;

export function createDevicePermissionPolicy({ environment = 'desktop', allowed = PERMISSIONS, grantTtlMs = DEFAULT_GRANT_TTL_MS, now = () => Date.now() } = {}) {
  if (environment !== 'desktop' && environment !== 'browser') throw new TypeError('Device environment must be desktop or browser.');
  if (!Array.isArray(allowed) || allowed.some((permission) => !PERMISSIONS.includes(permission))) throw new TypeError('Allowed device permissions are invalid.');
  if (!Number.isFinite(grantTtlMs) || grantTtlMs <= 0) throw new TypeError('Grant lifetime must be a positive number of milliseconds.');
  if (typeof now !== 'function') throw new TypeError('Clock must be a function.');
  const allowedSet = new Set(allowed);
  // Keyed by permission, then by target, so a target containing ':' can never match another grant.
  const grants = new Map(PERMISSIONS.map((permission) => [permission, new Map()]));
  const live = (permission) => {
    const targets = grants.get(permission);
    for (const [target, expiresAt] of targets) if (now() >= expiresAt) targets.delete(target);
    return targets;
  };
  return Object.freeze({
    environment,
    permissions: [...PERMISSIONS],
    inspect: () => Object.freeze(PERMISSIONS.map((permission) => Object.freeze({
      permission,
      allowed: environment === 'desktop' && allowedSet.has(permission),
      grantedTargets: [...live(permission).keys()]
    }))),
    selectTarget: (permission, target) => {
      assertPermission(permission); assertTarget(target);
      if (environment !== 'desktop' || !allowedSet.has(permission)) throw Object.assign(new Error(`Device permission '${permission}' is unavailable in ${environment} preview.`), { code: 'DEVICE_PERMISSION_UNAVAILABLE' });
      const expiresAt = now() + grantTtlMs;
      grants.get(permission).set(target, expiresAt);
      return Object.freeze({ permission, target, granted: true, expiresAt });
    },
    revokeTarget: (target) => { assertTarget(target); for (const targets of grants.values()) targets.delete(target); },
    revokePermission: (permission) => { assertPermission(permission); grants.get(permission).clear(); },
    revokeAll: () => { for (const targets of grants.values()) targets.clear(); },
    assertGranted: (permission, target) => {
      assertPermission(permission); assertTarget(target);
      if (!live(permission).has(target)) throw Object.assign(new Error(`Explicit '${permission}' permission is required for target '${target}'.`), { code: 'DEVICE_PERMISSION_REQUIRED' });
      return true;
    }
  });
}

function assertBoundedInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}.`);
}

function normalizeSerialText(value, encoding) {
  if (typeof value !== 'string') throw new TypeError('Serial data must be text.');
  if (encoder.encode(value).byteLength > 16 * 1024) throw new RangeError('A serial data chunk cannot exceed 16 KiB.');
  if (encoding === 'ascii' && /[^\x00-\x7f]/u.test(value)) throw new TypeError('ASCII serial data cannot contain non-ASCII characters.');
  return value;
}

export function createSerialSession({ permissionPolicy, target, baud = 115200, encoding = 'utf-8', lineEnding = 'lf', timestamps = true, maxBufferBytes = 64 * 1024, maxReconnectAttempts = 3, now = () => new Date().toISOString() } = {}) {
  if (!permissionPolicy || typeof permissionPolicy.assertGranted !== 'function') throw new TypeError('A device permission policy is required.');
  assertTarget(target);
  assertBoundedInteger(baud, 'Serial baud rate', 300, 4_000_000);
  if (!SERIAL_ENCODINGS.includes(encoding)) throw new TypeError('Serial encoding must be utf-8 or ascii.');
  if (!SERIAL_LINE_ENDINGS.includes(lineEnding)) throw new TypeError('Serial line ending is invalid.');
  assertBoundedInteger(maxBufferBytes, 'Serial buffer size', 1024, 1024 * 1024);
  assertBoundedInteger(maxReconnectAttempts, 'Serial reconnect limit', 0, 20);
  if (typeof now !== 'function') throw new TypeError('Serial clock must be a function.');

  let state = 'disconnected';
  let paused = false;
  let reconnectAttempts = 0;
  let droppedBytes = 0;
  let bufferBytes = 0;
  const frames = [];
  const snapshot = () => Object.freeze({ state, paused, target, baud, encoding, lineEnding, timestamps, reconnectAttempts, maxReconnectAttempts, bufferBytes, maxBufferBytes, droppedBytes, frames: Object.freeze(frames.map((frame) => Object.freeze({ ...frame }))) });
  const requireOpen = () => {
    if (state !== 'connected') throw Object.assign(new Error('Serial session is not connected.'), { code: 'SERIAL_NOT_CONNECTED' });
  };
  return Object.freeze({
    inspect: snapshot,
    connect: () => {
      if (state === 'closed') throw Object.assign(new Error('Closed serial sessions cannot reconnect.'), { code: 'SERIAL_CLOSED' });
      permissionPolicy.assertGranted('serial', target);
      state = 'connected'; reconnectAttempts = 0;
      return snapshot();
    },
    disconnect: ({ unexpected = false } = {}) => {
      if (state === 'closed') return snapshot();
      state = unexpected && maxReconnectAttempts > 0 ? 'reconnecting' : 'disconnected';
      return snapshot();
    },
    reconnect: () => {
      if (state !== 'reconnecting') throw Object.assign(new Error('Serial session is not waiting to reconnect.'), { code: 'SERIAL_NOT_RECONNECTING' });
      permissionPolicy.assertGranted('serial', target);
      reconnectAttempts += 1;
      if (reconnectAttempts > maxReconnectAttempts) { state = 'disconnected'; throw Object.assign(new Error('Serial reconnect limit reached.'), { code: 'SERIAL_RECONNECT_EXHAUSTED' }); }
      state = 'connected';
      return snapshot();
    },
    markReconnectFailed: () => {
      if (state !== 'connected' || reconnectAttempts === 0) throw Object.assign(new Error('No serial reconnect attempt is active.'), { code: 'SERIAL_RECONNECT_INACTIVE' });
      state = reconnectAttempts >= maxReconnectAttempts ? 'disconnected' : 'reconnecting';
      return snapshot();
    },
    setPaused: (value) => { paused = Boolean(value); return snapshot(); },
    ingest: (value) => {
      requireOpen();
      const text = normalizeSerialText(value, encoding);
      const bytes = encoder.encode(text).byteLength;
      frames.push({ timestamp: now(), text, bytes }); bufferBytes += bytes;
      while (bufferBytes > maxBufferBytes && frames.length) { const removed = frames.shift(); bufferBytes -= removed.bytes; droppedBytes += removed.bytes; }
      return snapshot();
    },
    formatTransmit: (value) => {
      requireOpen();
      const suffix = { none: '', lf: '\n', cr: '\r', crlf: '\r\n' }[lineEnding];
      return normalizeSerialText(`${value}${suffix}`, encoding);
    },
    exportText: () => frames.map((frame) => `${timestamps ? `[${frame.timestamp}] ` : ''}${frame.text}`).join(''),
    clear: () => { frames.length = 0; bufferBytes = 0; droppedBytes = 0; return snapshot(); },
    close: () => { state = 'closed'; paused = false; return snapshot(); }
  });
}
