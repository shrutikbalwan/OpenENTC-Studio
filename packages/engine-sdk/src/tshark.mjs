import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const MAX_PATH_BYTES = 32 * 1024;
const MAX_FILTER_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_PACKETS = 100_000;
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;
function validPath(value) { if (typeof value !== 'string' || !value || utf8Bytes(value) > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(value) || !ABSOLUTE.test(value)) throw new TypeError('TShark jobs require a bounded absolute saved-capture path.'); return value; }
function validFilter(value) { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string' || utf8Bytes(value) > MAX_FILTER_BYTES || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError('TShark display filter is invalid or oversized.'); return value; }

export function parseTsharkJson(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('TShark output is missing or exceeds the parser limit.');
  let parsed; try { parsed = JSON.parse(text); } catch { throw new TypeError('TShark JSON output is malformed.'); }
  if (!Array.isArray(parsed) || parsed.length > MAX_PACKETS) throw new TypeError('TShark JSON packet output is invalid or oversized.');
  return Object.freeze({ kind: 'packet-trace', packets: Object.freeze(parsed.map((packet) => { if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new TypeError('TShark packet entry is invalid.'); const serialized = JSON.stringify(packet); if (utf8Bytes(serialized) > 256 * 1024) throw new RangeError('TShark packet entry is oversized.'); return Object.freeze(packet); })) });
}

export function parseTsharkDiagnostics(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_OUTPUT_BYTES) throw new TypeError('TShark diagnostics are missing or oversized.');
  const diagnostics = []; for (const line of text.split(/\r?\n/)) { const match = line.match(/^\s*(warning|error)\s*:\s*(.+)$/i); if (match) diagnostics.push(createDiagnostic({ severity: match[1].toLowerCase(), code: `TSHARK_${match[1].toUpperCase()}`, message: match[2].trim() })); }
  return Object.freeze(diagnostics);
}

export function createTsharkAdapter({ executable = null, runner = null } = {}) {
  let prepared = null; let lastRun = null; let controller = null; let cancelled = false; let running = false;
  return {
    metadata: () => ({ id: 'tshark', name: 'TShark', license: 'GPL-2.0-or-later', integration: 'process', sourceUrl: 'https://www.wireshark.org/' }),
    detect: async () => probeExecutable({ id: 'tshark', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'saved-capture-json-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => ['saved-capture-decode'],
    validate: (job) => { if (!job || job.operation !== 'decode-saved') throw new TypeError(`TShark operation is unsupported: ${job?.operation || 'missing'}.`); validPath(job.capturePath); validFilter(job.displayFilter); if (job.maxPackets !== undefined && (!Number.isInteger(job.maxPackets) || job.maxPackets < 1 || job.maxPackets > MAX_PACKETS)) throw new RangeError('TShark packet limit is invalid.'); return true; },
    prepare: async (job) => { if (!job || job.operation !== 'decode-saved') throw new TypeError('TShark operation is unsupported.'); validPath(job.capturePath); const filter = validFilter(job.displayFilter); const maxPackets = job.maxPackets === undefined ? MAX_PACKETS : job.maxPackets; if (!Number.isInteger(maxPackets) || maxPackets < 1 || maxPackets > MAX_PACKETS) throw new RangeError('TShark packet limit is invalid.'); prepared = { arguments: ['-r', job.capturePath, ...(filter ? ['-Y', filter] : []), '-T', 'json', '-c', String(maxPackets)] }; return prepared; },
    run: async (_job, eventSink = () => {}) => { if (!runner || !executable) throw new Error('TShark is unavailable: configure an absolute executable path before running.'); assertAbsoluteExecutable(executable); if (running) throw Object.assign(new Error('TShark adapter is already running a job.'), { code: 'ENGINE_BUSY' }); running = true; cancelled = false; controller = new AbortController(); eventSink({ phase: 'running' }); try { lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: controller.signal }); } catch (error) { if (cancelled || controller.signal.aborted) throw Object.assign(new Error('TShark job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error }); throw error; } finally { controller = null; running = false; } if (cancelled) throw Object.assign(new Error('TShark job cancelled.'), { code: 'PROCESS_CANCELLED' }); if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'TShark failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' }); return lastRun; },
    parse: async () => ({ result: parseTsharkJson(lastRun?.stdout || '[]'), diagnostics: parseTsharkDiagnostics(lastRun?.stderr || '') }),
    cancel: async () => { cancelled = true; controller?.abort(); },
    clean: async () => { prepared = null; lastRun = null; controller = null; }
  };
}
