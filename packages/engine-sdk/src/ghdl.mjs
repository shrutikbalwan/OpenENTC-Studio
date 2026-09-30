import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = Object.freeze(['analyze', 'elaborate', 'simulate']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const TOKEN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_SOURCES = 512;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

function validatePath(value, label) {
  if (typeof value !== 'string' || !ABSOLUTE.test(value) || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`${label} must be a bounded absolute path.`);
  return value;
}

export function parseGhdlDiagnostics(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('GHDL output is missing or exceeds the parser limit.');
  const diagnostics = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:(.+?):(\d+)(?::(\d+))?:)?\s*(error|warning|note):\s*(.+)$/i);
    if (!match) continue;
    const severityName = match[4].toLowerCase();
    diagnostics.push(createDiagnostic({ severity: severityName === 'error' ? 'error' : severityName === 'warning' ? 'warning' : 'info', code: `GHDL_${severityName.toUpperCase()}`, message: match[5].trim(), source: match[1] || null, line: match[2] ? Number(match[2]) : null, column: match[3] ? Number(match[3]) : null }));
  }
  return Object.freeze({ kind: 'report', diagnostics: Object.freeze(diagnostics) });
}

function validateJob(job) {
  if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`GHDL operation is unsupported: ${job?.operation || 'missing'}.`);
  if (!Array.isArray(job.sources) || !job.sources.length || job.sources.length > MAX_SOURCES) throw new TypeError('GHDL jobs require a bounded non-empty source set.');
  job.sources.forEach((source) => validatePath(source, 'VHDL source'));
  if (typeof job.topEntity !== 'string' || !TOKEN.test(job.topEntity) || job.topEntity.length > 200) throw new TypeError('GHDL jobs require a safe top entity.');
  if (job.waveformPath !== undefined) validatePath(job.waveformPath, 'GHDL waveform output');
  if (job.stopTimeNs !== undefined && (!Number.isInteger(job.stopTimeNs) || job.stopTimeNs < 1 || job.stopTimeNs > 1_000_000_000)) throw new TypeError('GHDL stop time must be a bounded positive integer in nanoseconds.');
  return true;
}

export function createGhdlAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'ghdl', name: 'GHDL', license: 'GPL-2.0-or-later', integration: 'process', sourceUrl: 'https://ghdl.github.io/ghdl/' }),
    detect: async () => probeExecutable({ id: 'ghdl', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'diagnostic-parser-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: validateJob,
    prepare: async (job) => { validateJob(job); const common = ['--std=08']; const runOptions = [...(job.waveformPath ? [`--vcd=${job.waveformPath}`] : []), ...(job.stopTimeNs ? [`--stop-time=${job.stopTimeNs}ns`] : [])]; prepared = { arguments: job.operation === 'analyze' ? ['-a', ...common, ...job.sources] : job.operation === 'elaborate' ? ['-e', ...common, job.topEntity] : ['-r', ...common, job.topEntity, ...runOptions] }; return prepared; },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('GHDL is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable);
      if (running) throw Object.assign(new Error('GHDL adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' });
      try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); }
      catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('GHDL job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; }
      finally { controller = null; running = false; }
      if (cancelled) throw Object.assign(new Error('GHDL job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'GHDL failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async () => parseGhdlDiagnostics(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
