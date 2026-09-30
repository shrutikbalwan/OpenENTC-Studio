import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_TEXT_BYTES = 4096;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;
const text = (value, name) => { if (typeof value !== 'string' || !value || bytes(value) > MAX_TEXT_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`Renode ${name} is invalid.`); return value; };
const path = (value) => { if (typeof value !== 'string' || !value || bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value) || !ABSOLUTE.test(value)) throw new TypeError('Renode jobs require a bounded absolute approved script path.'); return value; };

export function parseRenodeDiagnostics(output) {
  if (typeof output !== 'string' || bytes(output) > MAX_OUTPUT_BYTES) throw new TypeError('Renode output is missing or exceeds the parser limit.');
  const diagnostics = []; for (const line of output.split(/\r?\n/)) { const match = line.match(/^\s*\[(ERROR|WARNING|INFO)\]\s*(.+)$/i); if (match) diagnostics.push(createDiagnostic({ severity: match[1].toLowerCase(), code: `RENODE_${match[1].toUpperCase()}`, message: match[2].trim() })); }
  return Object.freeze({ kind: 'emulation-report', diagnostics: Object.freeze(diagnostics) });
}

export function createRenodeAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'renode', name: 'Renode', license: 'MIT', integration: 'process', sourceUrl: 'https://github.com/renode/renode' }),
    detect: async () => probeExecutable({ id: 'renode', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'emulation-diagnostic-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => ['simulate'],
    validate: (job) => { if (!job || job.operation !== 'simulate') throw new TypeError(`Renode operation is unsupported: ${job?.operation || 'missing'}.`); path(job.scriptPath); text(job.machine, 'machine'); return true; },
    prepare: async (job) => { if (!job || job.operation !== 'simulate') throw new TypeError('Renode operation is unsupported.'); prepared = { arguments: ['--console', '--disable-xwt', path(job.scriptPath)], machine: text(job.machine, 'machine') }; return prepared; },
    run: async (_job, eventSink = () => {}) => { if (!runner || !executable) throw new Error('Renode is unavailable: configure an absolute executable path before running.'); assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('Renode adapter is already running a job.'), { code: 'ENGINE_BUSY' }); running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running', machine: prepared?.machine || null }); try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); } catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('Renode job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; } finally { controller = null; running = false; } if (cancelled) throw Object.assign(new Error('Renode job cancelled.'), { code: 'PROCESS_CANCELLED' }); if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'Renode failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' }); return lastRun; },
    parse: async () => parseRenodeDiagnostics(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
