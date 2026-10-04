// @ts-check
// Error architecture shared by the engines, project model, native boundary and UI.
//
// Every error has: a stable machine-readable `code`; a `message` that is safe to show the user;
// optionally a `location` (file/line/column or a component id); a `recovery` hint (what the user can
// do next); and a `context` object that is redacted when it is created, so it can go into logs and
// diagnostic exports. Subclasses keep the built-in base class that older code checks for
// (ValidationError and TimeoutError are RangeErrors), so existing `instanceof` checks keep working.

/** @typedef {{ file?: string, line?: number, column?: number, component?: string }} ErrorLocation */
/** @typedef {{ location?: ErrorLocation, recovery?: string, context?: Record<string, unknown>, cause?: unknown }} ErrorOptions */
/** @typedef {{ code: string, message: string, recovery?: string, location?: ErrorLocation }} UserFacingError */

/** @type {[RegExp, string][]} */
const SECRET_PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],
  [/\b(sk|gsk|pk|rk)-[A-Za-z0-9_-]{12,}\b/g, '[redacted]'],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[redacted]'],
  [/\b(api[_-]?key|token|password|secret)(["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi, '$1$2[redacted]'],
];
// Absolute paths that reveal a user name or private directory layout, and e-mail addresses.
/** @type {[RegExp, string][]} */
const PATH_PATTERNS = [
  [/(?:[A-Za-z]:)?[\\/](?:Users|home|Documents and Settings)[\\/][^\\/\s"'<>:]+((?:[\\/][^\s"'<>]*)?)/g, '<home>$1'],
  [/\/(?:root|private\/var|var\/folders|tmp)\/[^\s"'<>]+/g, '<private-path>'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>'],
];
// Only real stack frames: "at fn (file:line:col)" or "at file:line:col".
const STACK_LINE = /^\s*at\s+(?:.+\(.+:\d+:\d+\)|\S+:\d+:\d+)\s*$/gm;

/**
 * Remove secrets, private absolute paths and stack-trace lines from text.
 * @param {unknown} text
 * @param {string[]} [secrets] exact values to remove (for example the current API key)
 */
export function redactText(text, secrets = []) {
  let out = String(text ?? '');
  for (const secret of secrets) if (secret && String(secret).length >= 4) out = out.split(String(secret)).join('[redacted]');
  for (const [pattern, replacement] of [...SECRET_PATTERNS, ...PATH_PATTERNS]) out = out.replace(pattern, replacement);
  return out.replace(STACK_LINE, '').replace(/\n{2,}/g, '\n').trim();
}

/**
 * Deep-copy a diagnostic value with every string redacted, keys that name secrets dropped, and
 * depth/size bounded so a diagnostic can never carry a whole project.
 * @param {unknown} value
 * @param {{ secrets?: string[], depth?: number, maxString?: number }} [options]
 * @returns {unknown}
 */
export function redactDiagnostic(value, { secrets = [], depth = 4, maxString = 2000 } = {}) {
  if (typeof value === 'string') { const text = redactText(value, secrets); return text.length > maxString ? `${text.slice(0, maxString)}…` : text; }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return undefined;
  if (depth <= 0) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactDiagnostic(item, { secrets, depth: depth - 1, maxString }));
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    if (/^(api[_-]?key|apikey|authorization|token|password|secret|stack)$/i.test(key)) continue;
    out[key] = redactDiagnostic(item, { secrets, depth: depth - 1, maxString });
  }
  return out;
}

const DEFAULT_RECOVERY = {
  OPENENTC_VALIDATION: 'Check the highlighted value and try again.',
  OPENENTC_PROJECT_FORMAT: 'Open a project exported by OpenENTC Studio, or restore a backup.',
  OPENENTC_NUMERICAL: 'Check the input values and units.',
  OPENENTC_CONVERGENCE: 'Check device orientation, bias and source values, or simplify the circuit.',
  OPENENTC_PERMISSION: 'Review the permission in Toolchains, or open the project in the desktop app.',
  OPENENTC_NATIVE_TOOL: 'Check that the tool is installed and detected in Toolchains.',
  OPENENTC_TIMEOUT: 'Try a smaller problem or a longer time limit.',
  OPENENTC_STORAGE: 'Export your project as a file, then free browser storage or try another browser.',
};

/** Base class. */
export class OpenEntcError extends Error {
  /**
   * @param {string} code
   * @param {string} message safe, user-facing text (no secrets, no stack, no private paths)
   * @param {ErrorOptions} [options]
   */
  constructor(code, message, { location, recovery, context, cause } = {}) {
    super(redactText(message), cause === undefined ? undefined : { cause });
    this.name = 'OpenEntcError';
    this.code = code;
    this.location = location;
    this.recovery = recovery ?? DEFAULT_RECOVERY[/** @type {keyof typeof DEFAULT_RECOVERY} */ (code)];
    this.context = context ? /** @type {Record<string, unknown>} */ (redactDiagnostic(context)) : undefined;
  }
}

/** @param {string} defaultCode @param {string} name @param {ErrorConstructor | RangeErrorConstructor} [Base] */
function defineError(defaultCode, name, Base = Error) {
  // A class per kind that also inherits the OpenEntcError fields. ValidationError and TimeoutError
  // keep RangeError in their prototype chain for older callers.
  const Kind = class extends Base {
    /** @param {string} message @param {ErrorOptions & { code?: string }} [options] */
    constructor(message, options = {}) {
      super(redactText(message), options.cause === undefined ? undefined : { cause: options.cause });
      const shaped = new OpenEntcError(options.code ?? defaultCode, message, options);
      this.name = name;
      /** @type {string} */ this.code = shaped.code;
      /** @type {ErrorLocation | undefined} */ this.location = shaped.location;
      /** @type {string | undefined} */ this.recovery = shaped.recovery;
      /** @type {Record<string, unknown> | undefined} */ this.context = shaped.context;
    }
  };
  Object.defineProperty(Kind, 'name', { value: name });
  return Kind;
}

export const ValidationError = defineError('OPENENTC_VALIDATION', 'ValidationError', RangeError);
export const ProjectFormatError = defineError('OPENENTC_PROJECT_FORMAT', 'ProjectFormatError');
export const NumericalError = defineError('OPENENTC_NUMERICAL', 'NumericalError');
export const ConvergenceError = defineError('OPENENTC_CONVERGENCE', 'ConvergenceError');
export const PermissionError = defineError('OPENENTC_PERMISSION', 'PermissionError');
export const NativeToolError = defineError('OPENENTC_NATIVE_TOOL', 'NativeToolError');
export const TimeoutError = defineError('OPENENTC_TIMEOUT', 'TimeoutError', RangeError);
export const StorageError = defineError('OPENENTC_STORAGE', 'StorageError');

/** Codes raised by older modules mapped to a recovery hint. */
const LEGACY_RECOVERY = {
  PROJECT_INVALID_JSON: DEFAULT_RECOVERY.OPENENTC_PROJECT_FORMAT,
  PROJECT_INVALID_SHAPE: DEFAULT_RECOVERY.OPENENTC_PROJECT_FORMAT,
  PROJECT_UNSUPPORTED_VERSION: 'This project was saved by a newer OpenENTC Studio. Update the app to open it.',
  PROJECT_TOO_LARGE: 'Remove unused parts or generated data, or split the project.',
  PROJECT_PATH_ESCAPE: 'The project refers to a file outside its folder; it was not opened.',
  PROJECT_MIGRATION_FAILED: 'The original file was left unchanged. Report the problem with the file attached privately.',
  DESKTOP_UNAVAILABLE: 'Use the desktop app for native tools; the browser preview cannot run them.',
};

/**
 * Convert any thrown value into what the UI may show: a safe message, a stable code, an optional
 * recovery hint and location. Never includes a stack trace, secret or private path.
 * @param {unknown} error
 * @param {{ secrets?: string[], fallback?: string }} [options]
 * @returns {UserFacingError}
 */
export function toUserFacing(error, { secrets = [], fallback = 'Something went wrong.' } = {}) {
  const value = /** @type {any} */ (error);
  const raw = value instanceof Error || (value && typeof value.message === 'string') ? value.message : typeof value === 'string' ? value : '';
  const message = redactText(raw, secrets) || fallback;
  const code = typeof value?.code === 'string' && value.code ? value.code : value instanceof RangeError || value instanceof TypeError ? 'OPENENTC_VALIDATION' : 'OPENENTC_UNEXPECTED';
  const recovery = typeof value?.recovery === 'string' ? redactText(value.recovery, secrets) : LEGACY_RECOVERY[/** @type {keyof typeof LEGACY_RECOVERY} */ (code)];
  const location = value?.location && typeof value.location === 'object' ? /** @type {ErrorLocation} */ (redactDiagnostic(value.location)) : undefined;
  return { code, message, ...(recovery ? { recovery } : {}), ...(location ? { location } : {}) };
}

/**
 * Build a diagnostic report that is safe to attach to a public issue. Only allow-listed fields are
 * copied: counts instead of project content, tool ids and versions instead of paths, a boolean
 * instead of the API key. Everything is then redacted again (secrets, private paths, e-mail
 * addresses, stack lines), so a careless caller cannot leak more than the allow list.
 * @param {{
 *   app?: { version?: string, build?: string },
 *   environment?: { userAgent?: string, platform?: string, language?: string, online?: boolean, desktop?: boolean, serviceWorker?: string },
 *   project?: any,
 *   persistence?: { status?: string, error?: string },
 *   errors?: { at?: string, code?: string, message?: string, recovery?: string }[],
 *   toolchains?: { id?: string, detected?: boolean, version?: string }[],
 *   assistant?: { provider?: string, apiKey?: string, consented?: boolean },
 *   secrets?: string[],
 *   now?: () => Date,
 * }} input
 */
export function createDiagnosticReport({ app = {}, environment = {}, project = null, persistence = {}, errors = [], toolchains = [], assistant = {}, secrets = [], now = () => new Date() } = {}) {
  /** @param {unknown} value @param {number} [max] */
  const text = (value, max = 200) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  /** @param {unknown} value */
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  const allSecrets = [...secrets, ...(assistant.apiKey ? [assistant.apiKey] : [])];
  const report = {
    format: 'openentc-diagnostics',
    version: 1,
    generatedAt: now().toISOString(),
    app: { version: text(app.version, 40), build: text(app.build, 80) },
    environment: {
      userAgent: text(environment.userAgent, 300), platform: text(environment.platform, 60), language: text(environment.language, 20),
      online: typeof environment.online === 'boolean' ? environment.online : undefined,
      desktop: Boolean(environment.desktop), serviceWorker: text(environment.serviceWorker, 40),
    },
    project: project && typeof project === 'object' ? {
      format: text(project.format, 40), version: Number.isInteger(project.version) ? project.version : undefined,
      components: count(project.circuit?.components), wires: count(project.circuit?.wires), experiments: count(project.experiments),
      notes: count(project.notes), artifacts: count(project.artifacts),
    } : null,
    persistence: { status: text(persistence.status, 20), error: text(persistence.error, 300) },
    recentErrors: (Array.isArray(errors) ? errors : []).slice(-20).map((entry) => ({ at: text(entry?.at, 40), code: text(entry?.code, 60), message: text(entry?.message, 500), recovery: text(entry?.recovery, 300) })),
    toolchains: (Array.isArray(toolchains) ? toolchains : []).slice(0, 30).map((tool) => ({ id: text(tool?.id, 40), detected: Boolean(tool?.detected), version: text(tool?.version, 80) })),
    assistant: { provider: text(assistant.provider, 30), apiKeySet: Boolean(assistant.apiKey), consented: Boolean(assistant.consented) },
  };
  return /** @type {Record<string, unknown>} */ (redactDiagnostic(JSON.parse(JSON.stringify(report)), { secrets: allSecrets, depth: 6 }));
}
