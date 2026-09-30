import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const MAX_PATH_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;
const validPath = (value, name) => {
  if (typeof value !== 'string' || value.length === 0 || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value) || !ABSOLUTE.test(value)) throw new TypeError(`QucsatorRF jobs require a bounded absolute ${name} path.`);
  return value;
};

export function parseQucsatorRfReport(text, datasetPath = null) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('QucsatorRF output is missing or exceeds the parser limit.');
  const diagnostics = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*\[(error|warning|info)\]\s*(.+)$/i);
    if (match) diagnostics.push(createDiagnostic({ severity: match[1].toLowerCase(), code: `QUCSATOR_RF_${match[1].toUpperCase()}`, message: match[2].trim() }));
  }
  const trimmed = text.trim();
  return Object.freeze({ kind: 'rf-report', dataset: trimmed.startsWith('<QucsDataset') || trimmed.startsWith('<?xml'), datasetPath, diagnostics: Object.freeze(diagnostics), outputBytes: utf8Bytes(text) });
}

export function createQucsatorRfAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'qucsator-rf', name: 'QucsatorRF', license: 'GPL-2.0-only', integration: 'process', sourceUrl: 'https://github.com/ra3xdh/qucsator_rf' }),
    detect: async () => probeExecutable({ id: 'qucsator-rf', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'adapter-report-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => ['simulate'],
    validate: (job) => { if (!job || job.operation !== 'simulate') throw new TypeError(`QucsatorRF operation is unsupported: ${job?.operation || 'missing'}.`); validPath(job.netlistPath, 'netlist'); validPath(job.outputPath, 'output'); return true; },
    prepare: async (job) => { if (!job || job.operation !== 'simulate') throw new TypeError('QucsatorRF operation is unsupported.'); validPath(job.netlistPath, 'netlist'); validPath(job.outputPath, 'output'); prepared = { arguments: ['-i', job.netlistPath, '-o', job.outputPath], outputPath: job.outputPath }; return prepared; },
    run: async (_job, eventSink = () => {}) => { if (!runner || !executable) throw new Error('QucsatorRF is unavailable: configure an absolute executable path before running.'); assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('QucsatorRF adapter is already running a job.'), { code: 'ENGINE_BUSY' }); running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' }); try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); } catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('QucsatorRF job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; } finally { controller = null; running = false; } if (cancelled) throw Object.assign(new Error('QucsatorRF job cancelled.'), { code: 'PROCESS_CANCELLED' }); if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'QucsatorRF failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' }); return lastRun; },
    parse: async () => parseQucsatorRfReport(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`, prepared?.outputPath || null),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
