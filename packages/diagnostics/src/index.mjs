export const SEVERITIES = Object.freeze(['info', 'warning', 'error']);
export const DIAGNOSTIC_CODES = Object.freeze({
  INVALID_INPUT: 'INPUT_INVALID',
  UNSUPPORTED_OPERATION: 'OPERATION_UNSUPPORTED',
  ENGINE_UNAVAILABLE: 'ENGINE_UNAVAILABLE',
  ENGINE_FAILURE: 'ENGINE_FAILURE',
  JOB_CANCELLED: 'JOB_CANCELLED',
  JOB_TIMEOUT: 'JOB_TIMEOUT',
  PROJECT_INVALID: 'PROJECT_INVALID'
});
export const MAX_DIAGNOSTIC_CODE_LENGTH = 100;
export const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 1_000_000;
export const MAX_DIAGNOSTIC_LOCATION_LENGTH = 4_096;

function boundedText(value, field, maxLength) {
  if (value === null) return value;
  if (typeof value !== 'string' || value.length > maxLength || [...value].some((character) => character < ' ' || character === '\u007f')) throw new TypeError(`Diagnostic ${field} is invalid or exceeds its limit.`);
  return value;
}

export function createDiagnostic({ severity = 'error', code, message, source = null, line = null, column = null, fix = null }) {
  if (!SEVERITIES.includes(severity)) throw new TypeError(`Unknown diagnostic severity: ${severity}`);
  if (typeof code !== 'string' || code.length > MAX_DIAGNOSTIC_CODE_LENGTH || !/^[A-Z][A-Z0-9_.-]+$/.test(code)) throw new TypeError('Diagnostic code must be stable uppercase text.');
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH || [...message].some((character) => character === '\0')) throw new TypeError('Diagnostic message is required and bounded.');
  boundedText(source, 'source', MAX_DIAGNOSTIC_LOCATION_LENGTH);
  boundedText(fix, 'fix', MAX_DIAGNOSTIC_LOCATION_LENGTH);
  if (line !== null && (!Number.isInteger(line) || line < 1)) throw new TypeError('Diagnostic line must be a positive integer or null.');
  if (column !== null && (!Number.isInteger(column) || column < 1)) throw new TypeError('Diagnostic column must be a positive integer or null.');
  return Object.freeze({ severity, code, message, source, line, column, fix });
}

export function diagnosticFromError(error, fallbackCode = DIAGNOSTIC_CODES.ENGINE_FAILURE) {
  return createDiagnostic({ code: error?.code && /^[A-Z][A-Z0-9_.-]+$/.test(error.code) ? error.code : fallbackCode, message: error?.message || String(error) });
}
