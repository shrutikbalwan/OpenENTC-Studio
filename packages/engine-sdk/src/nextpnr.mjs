import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';

const TARGETS = Object.freeze({ ice40: Object.freeze({ flag: '--hx8k', packages: Object.freeze(['ct256']) }) });
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const MAX_PATH_BYTES = 32 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

function path(value, label) {
  if (typeof value !== 'string' || !ABSOLUTE.test(value) || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`${label} must be a bounded absolute path.`);
  return value;
}

export function parseNextpnrReport(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('nextpnr output is missing or exceeds the parser limit.');
  const timing = text.match(/Max frequency:\s*([0-9.]+)\s*MHz/i);
  const utilisation = text.match(/([0-9]+)\s+BELs?\s+used/i);
  const target = text.match(/device:\s*([^\s]+)/i)?.[1] || null;
  if (!target && !timing && !utilisation) throw new TypeError('nextpnr output does not contain an implementation report.');
  return Object.freeze({ kind: 'report', target, timingMHz: timing ? Number(timing[1]) : null, belsUsed: utilisation ? Number(utilisation[1]) : null });
}

function validateJob(job) {
  if (!job || typeof job.target !== 'string' || !Object.hasOwn(TARGETS, job.target)) throw new TypeError(`nextpnr target is unsupported: ${job?.target || 'missing'}.`);
  if (typeof job.package !== 'string' || !TARGETS[job.target].packages.includes(job.package)) throw new TypeError(`nextpnr package is unsupported for ${job.target}: ${job?.package || 'missing'}.`);
  path(job.netlistPath, 'nextpnr JSON netlist'); path(job.constraintsPath, 'nextpnr constraints'); path(job.outputPath, 'nextpnr output');
  return true;
}

export function createNextpnrAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'nextpnr-ice40', name: 'nextpnr (ice40)', license: 'ISC', integration: 'process', sourceUrl: 'https://github.com/YosysHQ/nextpnr' }),
    detect: async () => probeExecutable({ id: 'nextpnr-ice40', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'unsupported-target-guard', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => ['place-route'],
    validate: validateJob,
    prepare: async (job) => { validateJob(job); const target = TARGETS[job.target]; prepared = { arguments: [target.flag, '--package', job.package, '--json', job.netlistPath, '--pcf', job.constraintsPath, '--asc', job.outputPath] }; return prepared; },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('nextpnr-ice40 is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('nextpnr-ice40 adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running', target: 'ice40' });
      try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); }
      catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('nextpnr job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; }
      finally { controller = null; running = false; }
      if (cancelled) throw Object.assign(new Error('nextpnr job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'nextpnr failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async () => parseNextpnrReport(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
