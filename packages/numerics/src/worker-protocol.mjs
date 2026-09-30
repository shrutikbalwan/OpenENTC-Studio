const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const OPERATIONS = Object.freeze(['generate_sine', 'convolve', 'fft', 'window', 'correlate', 'resample', 'fir_filter']);
const byteLength = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : value.length;

export function encodeWorkerRequest(request) {
  if (!request || typeof request !== 'object' || typeof request.id !== 'string' || !request.id || request.id.length > 200 || /[\u0000-\u001f\u007f]/.test(request.id)) throw new TypeError('Worker request id is invalid or oversized.');
  if (!OPERATIONS.includes(request.operation)) throw new TypeError(`Worker operation is unsupported: ${request.operation}.`);
  let encoded;
  try { encoded = `${JSON.stringify({ id: request.id, operation: request.operation, args: request.args || {} })}\n`; } catch { throw new TypeError('Worker request arguments must be JSON-serializable.'); }
  if (byteLength(encoded) > MAX_REQUEST_BYTES) throw new RangeError('Worker request exceeds the byte limit.');
  return encoded;
}

export function decodeWorkerResponse(line) {
  if (typeof line !== 'string' || byteLength(line) > MAX_REQUEST_BYTES) throw new TypeError('Worker response is missing or exceeds the byte limit.');
  let response;
  try { response = JSON.parse(line); } catch (error) { throw new TypeError(`Worker response is invalid JSON: ${error.message}`); }
  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') throw new TypeError('Worker response envelope is invalid.');
  if (!response.ok && (!response.error || typeof response.error.code !== 'string' || typeof response.error.message !== 'string')) throw new TypeError('Worker error envelope is invalid.');
  return response;
}

export const WORKER_OPERATIONS = OPERATIONS;
