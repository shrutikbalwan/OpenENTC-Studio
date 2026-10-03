// @ts-check
// Central error reporting for the UI. reportError() shows a safe, redacted message in the toast and
// keeps a bounded list of recent errors (code, message, recovery, time) for the diagnostics view.
// Nothing is sent anywhere; the list lives in memory and never holds stack traces or secrets.
import { toUserFacing } from '../../packages/errors/src/index.mjs';
import { notify } from '../core/store.js';

const MAX_RECENT = 20;
/** @type {{ at: string, code: string, message: string, recovery?: string }[]} */
const recent = [];

/**
 * Show an error to the user and remember it (redacted) for diagnostics.
 * @param {unknown} error
 * @param {{ prefix?: string, secrets?: string[], fallback?: string }} [options] prefix is prepended as
 *   "prefix: message"; fallback is shown when the error has no message
 * @returns {import('../../packages/errors/src/index.mjs').UserFacingError}
 */
export function reportError(error, { prefix = '', secrets = [], fallback } = {}) {
  const shown = toUserFacing(error, { secrets, ...(fallback ? { fallback } : {}) });
  recent.push({ at: new Date().toISOString(), code: shown.code, message: shown.message, ...(shown.recovery ? { recovery: shown.recovery } : {}) });
  if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
  notify(prefix ? `${prefix}: ${shown.message}` : shown.message, 'error');
  return shown;
}

/** Recent errors, newest last (copies). */
export function recentErrors() {
  return recent.map((entry) => ({ ...entry }));
}

/** Forget recent errors (for example after a diagnostic export). */
export function clearRecentErrors() {
  recent.length = 0;
}
