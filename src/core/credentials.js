// Assistant settings and the provider API key. Non-secret settings persist in localStorage; the
// key never does. It lives in memory, or in sessionStorage (cleared when the tab closes) only if
// the user asks to keep it for the tab. Older versions stored the key in localStorage: loading
// removes it from there without reading it into any log or message.

export const SETTINGS_KEY = 'openentc.assistant.v1';
export const SESSION_KEY = 'openentc.assistant.key.v1';
export const ASSISTANT_DEFAULTS = Object.freeze({ provider: 'openai', baseUrl: '', model: '', mode: 'explain', language: 'en', shareLab: true, consented: false, rememberKey: false });
const SETTING_FIELDS = Object.keys(ASSISTANT_DEFAULTS);

let memoryKey = '';

const readJson = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || '{}') ?? {}; } catch { return {}; } };
const pick = (object) => Object.fromEntries(SETTING_FIELDS.filter((field) => object[field] !== undefined).map((field) => [field, object[field]]));

/**
 * Load settings. Returns { settings, apiKey, removedLegacyKey }. If an old localStorage entry
 * still holds an apiKey, it is deleted (the rest of the entry is kept) and removedLegacyKey is true.
 */
export function loadAssistantSettings(local, session) {
  const stored = readJson(local, SETTINGS_KEY);
  let removedLegacyKey = false;
  if (Object.prototype.hasOwnProperty.call(stored, 'apiKey')) {
    removedLegacyKey = Boolean(stored.apiKey);
    try { local.setItem(SETTINGS_KEY, JSON.stringify(pick(stored))); } catch { /* storage unavailable: nothing persisted either way */ }
  }
  const settings = { ...ASSISTANT_DEFAULTS, ...pick(stored) };
  let apiKey = memoryKey;
  if (!apiKey && settings.rememberKey) { try { apiKey = session?.getItem(SESSION_KEY) || ''; } catch { apiKey = ''; } memoryKey = apiKey; }
  return { settings, apiKey, removedLegacyKey };
}

/** Save a patch. apiKey goes to memory (and sessionStorage only when rememberKey is on); the rest to localStorage. */
export function saveAssistantSettings(local, session, patch) {
  const { settings: current } = loadAssistantSettings(local, session);
  const next = { ...current, ...pick(patch) };
  if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) memoryKey = String(patch.apiKey ?? '');
  local.setItem(SETTINGS_KEY, JSON.stringify(next));
  try {
    if (next.rememberKey && memoryKey) session?.setItem(SESSION_KEY, memoryKey);
    else session?.removeItem(SESSION_KEY);
  } catch { /* sessionStorage unavailable: the key stays in memory only */ }
  return { settings: next, apiKey: memoryKey };
}

/** Forget the key everywhere (memory and sessionStorage). */
export function forgetApiKey(session) {
  memoryKey = '';
  try { session?.removeItem(SESSION_KEY); } catch { /* nothing stored */ }
}

/** Redaction is shared with the assistant package so both layers mask the same patterns. */
export { redactSecrets } from '../../packages/assistant/src/index.mjs';

/** Test hook: reset the in-memory key. */
export function resetCredentialMemory() { memoryKey = ''; }
