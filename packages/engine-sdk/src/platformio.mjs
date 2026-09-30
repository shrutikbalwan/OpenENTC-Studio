import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = Object.freeze(['version', 'compile']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_TEXT_BYTES = 4096;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;
const boundedText = (value, name) => { if (typeof value !== 'string' || !value || bytes(value) > MAX_TEXT_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`PlatformIO ${name} is invalid.`); return value; };
const projectPath = (value) => { if (typeof value !== 'string' || !value || bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value) || !ABSOLUTE.test(value)) throw new TypeError('PlatformIO jobs require a bounded absolute project path.'); return value; };

export function parsePlatformIoDiagnostics(text) {
  if (typeof text !== 'string' || bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('PlatformIO output is missing or exceeds the parser limit.');
  const diagnostics = []; for (const line of text.split(/\r?\n/)) { const match = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/i); if (match) diagnostics.push(createDiagnostic({ severity: match[4].toLowerCase(), code: match[4].toLowerCase() === 'error' ? 'FIRMWARE_COMPILE_ERROR' : 'FIRMWARE_COMPILE_WARNING', message: match[5].trim(), source: match[1], line: Number(match[2]), column: Number(match[3]) })); }
  return Object.freeze({ kind: 'firmware-build-report', diagnostics: Object.freeze(diagnostics) });
}

export function createPlatformIoAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'platformio', name: 'PlatformIO Core', license: 'Apache-2.0', integration: 'process', sourceUrl: 'https://github.com/platformio/platformio-core' }),
    detect: async () => probeExecutable({ id: 'platformio', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'compile-diagnostic-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: (job) => { if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`PlatformIO operation is unsupported: ${job?.operation || 'missing'}.`); if (job.operation === 'compile') { projectPath(job.projectPath); boundedText(job.environment, 'environment'); } return true; },
    prepare: async (job) => { if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError('PlatformIO operation is unsupported.'); const args = job.operation === 'compile' ? ['run', '--project-dir', projectPath(job.projectPath), '--environment', boundedText(job.environment, 'environment')] : ['--version']; prepared = { arguments: args }; return prepared; },
    run: async (_job, eventSink = () => {}) => { if (!runner || !executable) throw new Error('PlatformIO is unavailable: configure an absolute executable path before running.'); assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('PlatformIO adapter is already running a job.'), { code: 'ENGINE_BUSY' }); running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' }); try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); } catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('PlatformIO job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; } finally { controller = null; running = false; } if (cancelled) throw Object.assign(new Error('PlatformIO job cancelled.'), { code: 'PROCESS_CANCELLED' }); if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'PlatformIO failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' }); return lastRun; },
    parse: async () => parsePlatformIoDiagnostics(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
