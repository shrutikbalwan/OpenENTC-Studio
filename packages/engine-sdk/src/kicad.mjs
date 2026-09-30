import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = Object.freeze(['schematic-check', 'pcb-check', 'bom', 'gerber', 'drill', 'position']);
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const MAX_ENGINE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_PATH_BYTES = 32 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

export function parseKiCadReport(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_ENGINE_OUTPUT_BYTES) throw new TypeError('KiCad report is missing or exceeds the parser limit.');
  const diagnostics = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*\[(error|warning|info)\]\s*(.+)$/i);
    if (match) diagnostics.push(createDiagnostic({ severity: match[1].toLowerCase(), code: `KICAD_${match[1].toUpperCase()}`, message: match[2].trim() }));
  }
  return Object.freeze({ kind: 'report', diagnostics });
}

export function createKiCadAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'kicad', name: 'KiCad CLI', license: 'GPL-3.0-or-later', integration: 'process', sourceUrl: 'https://www.kicad.org/learn/licensing/' }),
    detect: async () => probeExecutable({ id: 'kicad', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'adapter-report-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: (job) => { if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`KiCad operation is unsupported: ${job?.operation || 'missing'}.`); if (typeof job.projectPath !== 'string' || job.projectPath.length > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(job.projectPath) || !ABSOLUTE.test(job.projectPath)) throw new TypeError('KiCad jobs require a bounded absolute approved project path.'); return true; },
    prepare: async (job) => { if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError('KiCad operation is unsupported.'); if (typeof job.projectPath !== 'string' || job.projectPath.length > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(job.projectPath) || !ABSOLUTE.test(job.projectPath)) throw new TypeError('KiCad jobs require a bounded absolute approved project path.'); const command = job.operation === 'schematic-check' ? ['sch', 'erc'] : job.operation === 'pcb-check' ? ['pcb', 'drc'] : ['export', job.operation]; prepared = { arguments: [...command, job.projectPath] }; return prepared; },
    run: async (_job, eventSink = () => {}) => { if (!runner || !executable) throw new Error('KiCad is unavailable: configure an absolute executable path before running.'); assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('KiCad adapter is already running a job.'), { code: 'ENGINE_BUSY' }); running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' }); try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); } catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('KiCad job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; } finally { controller = null; running = false; } if (cancelled) throw Object.assign(new Error('KiCad job cancelled.'), { code: 'PROCESS_CANCELLED' }); if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'KiCad failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' }); return lastRun; },
    parse: async () => parseKiCadReport(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
