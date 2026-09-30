import { spawn } from 'node:child_process';

export const PROCESS_ERROR_CODES = Object.freeze({
  INVALID_EXECUTABLE: 'PROCESS_INVALID_EXECUTABLE',
  INVALID_ARGUMENTS: 'PROCESS_INVALID_ARGUMENTS',
  OUTPUT_LIMIT: 'PROCESS_OUTPUT_LIMIT',
  TIMEOUT: 'PROCESS_TIMEOUT',
  CANCELLED: 'PROCESS_CANCELLED'
});

export const MAX_PROCESS_OUTPUT_BYTES = 16 * 1024 * 1024;
export const MAX_PROCESS_ARGS = 256;
export const MAX_PROCESS_ARG_BYTES = 64 * 1024;
export const MAX_PROCESS_PATH_BYTES = 32 * 1024;
export const MAX_PROCESS_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function utf8ByteLength(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
  return unescape(encodeURIComponent(value)).length;
}

function validateSpec({ executable, args = [], cwd = undefined, timeoutMs = 120_000, maxOutputBytes = 2 * 1024 * 1024 }) {
  const hasControl = (value) => [...value].some((character) => character < ' ' || character === '\u007f');
  if (typeof executable !== 'string' || !executable || utf8ByteLength(executable) > MAX_PROCESS_PATH_BYTES || hasControl(executable) || !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(executable)) throw new TypeError('Executable must be an absolute bounded path.');
  if (!Array.isArray(args) || args.length > MAX_PROCESS_ARGS || args.some((arg) => typeof arg !== 'string' || utf8ByteLength(arg) > MAX_PROCESS_ARG_BYTES || hasControl(arg))) throw new TypeError('Process arguments must be a bounded array of safe strings.');
  if (cwd !== undefined && (typeof cwd !== 'string' || !cwd || utf8ByteLength(cwd) > MAX_PROCESS_PATH_BYTES || hasControl(cwd) || !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(cwd))) throw new TypeError('Working directory must be an absolute bounded path.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_PROCESS_TIMEOUT_MS) throw new TypeError('Timeout must be a positive bounded integer.');
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > MAX_PROCESS_OUTPUT_BYTES) throw new TypeError(`Output limit must be an integer between 1 and ${MAX_PROCESS_OUTPUT_BYTES} bytes.`);
}

/** Terminate only the process tree owned by this runner invocation. */
function terminateOwnedTree(child, spawnTree = spawn) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    // Fixed system path and an argument vector avoid shell interpretation.
    if (spawnTree !== null) { try { spawnTree('C:\\Windows\\System32\\taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true }); } catch { try { child.kill(); } catch { /* already exited */ } } }
    else { try { child.kill(); } catch { /* already exited */ } }
    return;
  }
  try { child.kill(-child.pid); } catch { try { child.kill(); } catch { /* already exited */ } }
}

export function runProcess(spec, { signal, spawnImpl = spawn } = {}) {
  validateSpec(spec);
  const { executable, args = [], cwd, timeoutMs = 120_000, maxOutputBytes = 2 * 1024 * 1024 } = spec;
  if (signal?.aborted) return Promise.resolve({ ok: false, code: null, signal: null, stdout: '', stderr: '', error: PROCESS_ERROR_CODES.CANCELLED });
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    let outputLimited = false;
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let child;
    try { child = spawnImpl(executable, args, { cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32' }); }
    catch (error) { resolve({ ok: false, code: null, signal: null, stdout, stderr, error: error.code || error.message }); return; }
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); resolve(result); };
    const stop = (reason) => { if (settled) return; if (reason === 'timeout') timedOut = true; if (reason === 'cancel') cancelled = true; terminateOwnedTree(child, spawnImpl === spawn ? spawn : null); };
    const append = (target, chunk) => {
      const bytes = Buffer.from(String(chunk));
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      const accepted = bytes.subarray(0, remaining).toString('utf8');
      outputBytes += bytes.byteLength;
      if (bytes.byteLength > remaining) { outputLimited = true; stop('limit'); }
      return target + accepted;
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => finish({ ok: false, code: null, signal: null, stdout, stderr, error: error.code === 'ENOENT' ? PROCESS_ERROR_CODES.INVALID_EXECUTABLE : error.message }));
    child.on('close', (code, exitSignal) => finish({ ok: !timedOut && !cancelled && !outputLimited && code === 0, code, signal: exitSignal, stdout, stderr, error: timedOut ? PROCESS_ERROR_CODES.TIMEOUT : cancelled ? PROCESS_ERROR_CODES.CANCELLED : outputLimited ? PROCESS_ERROR_CODES.OUTPUT_LIMIT : null }));
    const cancel = () => stop('cancel');
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  });
}
