import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';

const OPERATIONS = Object.freeze(['synthesis', 'report']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const TOKEN = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const MAX_SOURCES = 512;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 64 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

function validatePath(value) {
  if (typeof value !== 'string' || !ABSOLUTE.test(value) || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError('Yosys source must be a bounded absolute path.');
  return value;
}

function quoteScriptPath(value) {
  return `"${value.replace(/(["\\])/g, '\\$1')}"`;
}

export function parseYosysReport(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('Yosys output is missing or exceeds the parser limit.');
  const metrics = {};
  const patterns = [['wires', /Number of wires:\s+(\d+)/i], ['wireBits', /Number of wire bits:\s+(\d+)/i], ['memories', /Number of memories:\s+(\d+)/i], ['cells', /Number of cells:\s+(\d+)/i]];
  for (const [key, pattern] of patterns) { const match = text.match(pattern); if (match) metrics[key] = Number(match[1]); }
  if (!Object.keys(metrics).length) throw new TypeError('Yosys output does not contain a utilization report.');
  return Object.freeze({ kind: 'report', metrics: Object.freeze(metrics), textBytes: utf8Bytes(text) });
}

function validateJob(job) {
  if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`Yosys operation is unsupported: ${job?.operation || 'missing'}.`);
  if (!Array.isArray(job.sources) || !job.sources.length || job.sources.length > MAX_SOURCES) throw new TypeError('Yosys jobs require a bounded non-empty source set.');
  job.sources.forEach(validatePath);
  if (typeof job.topModule !== 'string' || !TOKEN.test(job.topModule) || job.topModule.length > 200) throw new TypeError('Yosys jobs require a safe top module.');
  if (job.netlistPath !== undefined) validatePath(job.netlistPath);
  return true;
}

export function createYosysAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'yosys', name: 'Yosys', license: 'ISC', integration: 'process', sourceUrl: 'https://yosyshq.net/yosys/' }),
    detect: async () => probeExecutable({ id: 'yosys', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'report-parser-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: validateJob,
    prepare: async (job) => { validateJob(job); const reads = job.sources.map((source) => `read_verilog -sv ${quoteScriptPath(source)}`).join('; '); const output = job.netlistPath ? `; write_json ${quoteScriptPath(job.netlistPath)}` : ''; const script = `${reads}; hierarchy -top ${job.topModule}; proc; opt; ${job.operation === 'synthesis' ? 'techmap; opt; ' : ''}stat${output}`; if (utf8Bytes(script) > MAX_SCRIPT_BYTES) throw new TypeError('Yosys synthesis script exceeds the bounded argument limit.'); prepared = { arguments: ['-p', script] }; return prepared; },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('Yosys is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable);
      if (running) throw Object.assign(new Error('Yosys adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' });
      try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); }
      catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('Yosys job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; }
      finally { controller = null; running = false; }
      if (cancelled) throw Object.assign(new Error('Yosys job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'Yosys failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async () => parseYosysReport(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
