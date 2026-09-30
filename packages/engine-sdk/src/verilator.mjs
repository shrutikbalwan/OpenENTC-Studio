import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = Object.freeze(['lint', 'simulate']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const TOKEN = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const MAX_SOURCES = 512;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

function validatePath(value, label) {
  if (typeof value !== 'string' || !ABSOLUTE.test(value) || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`${label} must be a bounded absolute path.`);
  return value;
}

export function parseVerilatorDiagnostics(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('Verilator output is missing or exceeds the parser limit.');
  const diagnostics = [];
  for (const line of text.split(/\r?\n/)) {
    const standard = line.match(/^\s*%(Error|Warning|Info)(?:-([A-Za-z0-9_-]+))?:\s*(.+)$/i);
    const legacy = standard ? null : line.match(/^\s*(.*?)\s*%(Error|Warning|Info)(?:-([A-Za-z0-9_-]+))?:\s*(.+)$/i);
    if (!standard && !legacy) continue;
    const severityName = (standard?.[1] || legacy[2]).toLowerCase();
    const severity = severityName === 'error' ? 'error' : severityName === 'warning' ? 'warning' : 'info';
    const code = standard?.[2] || legacy?.[3] || severityName;
    let source = null;
    let lineNumber = null;
    let column = null;
    let message = legacy?.[4] || standard[3];
    if (legacy?.[1]) {
      const location = legacy[1].trim().replace(/:\s*$/, '');
      const located = location.match(/^(.+):(\d+):(\d+)$/) || location.match(/^(.+):(\d+)$/);
      if (located) { source = located[1]; lineNumber = located[2]; if (located.length === 4) column = located[3]; }
    }
    if (standard) {
      const located = standard[3].match(/^(.+):(\d+):(\d+):\s*(.+)$/) || standard[3].match(/^(.+):(\d+):\s*(.+)$/);
      if (located) {
        source = located[1]; lineNumber = located[2];
        if (located.length === 5) { column = located[3]; message = located[4]; } else message = located[3];
      }
    }
    diagnostics.push(createDiagnostic({ severity, code: `VERILATOR_${code.toUpperCase().replace(/[^A-Z0-9_.-]/g, '_')}`, message: message.trim(), source, line: lineNumber ? Number(lineNumber) : null, column: column ? Number(column) : null }));
  }
  return Object.freeze({ kind: 'report', diagnostics: Object.freeze(diagnostics) });
}

function validateJob(job) {
  if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`Verilator operation is unsupported: ${job?.operation || 'missing'}.`);
  if (!Array.isArray(job.sources) || !job.sources.length || job.sources.length > MAX_SOURCES) throw new TypeError('Verilator jobs require a bounded non-empty source set.');
  job.sources.forEach((source) => validatePath(source, 'HDL source'));
  if (typeof job.topUnit !== 'string' || !TOKEN.test(job.topUnit) || job.topUnit.length > 200) throw new TypeError('Verilator jobs require a safe top unit.');
  return true;
}

export function createVerilatorAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'verilator', name: 'Verilator', license: 'LGPL-3.0-or-later', integration: 'process', sourceUrl: 'https://verilator.org/' }),
    detect: async () => probeExecutable({ id: 'verilator', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'diagnostic-parser-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: validateJob,
    prepare: async (job) => { validateJob(job); const common = ['--top-module', job.topUnit]; prepared = { arguments: job.operation === 'lint' ? ['--lint-only', ...common, ...job.sources] : ['--binary', '--trace', ...common, ...job.sources] }; return prepared; },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('Verilator is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable);
      if (running) throw Object.assign(new Error('Verilator adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' });
      try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); }
      catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('Verilator job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; }
      finally { controller = null; running = false; }
      if (cancelled) throw Object.assign(new Error('Verilator job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'Verilator failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async () => parseVerilatorDiagnostics(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
