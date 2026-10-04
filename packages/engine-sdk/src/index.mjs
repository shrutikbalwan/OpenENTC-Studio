// External-engine adapter SDK: job state machine, cancellation, manifests, discovery, and adapters
// for ngspice, Arduino CLI, GHDL, Verilator, Yosys, nextpnr, KiCad, PlatformIO, Renode, qucsator-
// rf and TShark. Adapters build argument arrays only and never invoke a shell.
import { createDiagnostic, DIAGNOSTIC_CODES } from '../../diagnostics/src/index.mjs';

export const JOB_STATES = Object.freeze(['queued', 'preparing', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled']);
export const TERMINAL_JOB_STATES = Object.freeze(['succeeded', 'failed', 'cancelled']);
export const ADAPTER_METHODS = Object.freeze(['metadata', 'detect', 'selfTest', 'capabilities', 'validate', 'prepare', 'run', 'parse', 'cancel', 'clean']);
const MAX_JOB_LOGS = 10_000;
const MAX_JOB_EVENT_BYTES = 64 * 1024;
const MAX_RESOURCE_POLICY_BYTES = 64 * 1024;
const MAX_JOB_TEXT = 200;
const MAX_JOB_PATH = 1_000_000;
const MAX_JOB_ARGUMENT_BYTES = 64 * 1024;
const MAX_JOB_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_JOB_ARTIFACT_PATH_BYTES = 4096;

function utf8ByteLength(value) {
  const text = String(value);
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
  return unescape(encodeURIComponent(text)).length;
}

function validateJobArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > 100_000 || artifacts.some((artifact) => !artifact || typeof artifact.path !== 'string' || !artifact.path || artifact.path.length > MAX_JOB_ARTIFACT_PATH_BYTES || artifact.path.startsWith('/') || artifact.path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(artifact.path) || artifact.path.split(/[\\/]/).some((segment) => !segment || segment === '.' || segment === '..') || [...artifact.path].some((character) => character < ' ' || character === '\u007f') || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isInteger(artifact.size) || artifact.size < 0 || artifact.size > MAX_JOB_ARTIFACT_BYTES || typeof artifact.mediaType !== 'string' || !artifact.mediaType.trim() || artifact.mediaType.length > 200)) throw new TypeError('Job artifacts must contain bounded safe references.');
  return artifacts.map((artifact) => ({ ...artifact }));
}

function cloneResourcePolicy(resourcePolicy) {
  if (!resourcePolicy || typeof resourcePolicy !== 'object' || Array.isArray(resourcePolicy)) throw new TypeError('Job resourcePolicy must be an object.');
  let cloned;
  try { cloned = structuredClone(resourcePolicy); } catch { throw new TypeError('Job resourcePolicy must be cloneable.'); }
  let serialized;
  try { serialized = JSON.stringify(cloned); } catch { throw new TypeError('Job resourcePolicy must be JSON-serializable.'); }
  if (typeof serialized !== 'string' || utf8ByteLength(serialized) > MAX_RESOURCE_POLICY_BYTES) throw new TypeError('Job resourcePolicy is oversized.');
  return cloned;
}

export function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Engine adapter must be an object.');
  for (const method of ADAPTER_METHODS) if (typeof adapter[method] !== 'function') throw new TypeError(`Engine adapter is missing ${method}().`);
  return adapter;
}

export function createAdapter(adapter) {
  return assertAdapter(adapter);
}

export async function executeAdapterJob(adapter, initialJob, eventSink = () => {}, { signal } = {}) {
  assertAdapter(adapter);
  if (signal?.aborted) return completeCancellation(requestCancel(initialJob));
  const metadata = adapter.metadata();
  let job = transitionJob({
    ...initialJob,
    adapter: initialJob.adapter ?? (typeof metadata?.id === 'string' ? metadata.id : null),
    engineVersion: initialJob.engineVersion ?? (typeof metadata?.version === 'string' ? metadata.version : null)
  }, 'preparing');
  try {
    await adapter.validate(job);
    const prepared = await adapter.prepare(job);
    if (Array.isArray(prepared?.arguments) && prepared.arguments.every((argument) => typeof argument === 'string')) job = { ...job, arguments: [...prepared.arguments] };
    job = transitionJob(job, 'running');
    let removeAbort = () => {};
    const abort = signal ? new Promise((resolve) => {
      const onAbort = () => resolve({ cancelled: true });
      if (signal.aborted) onAbort(); else { signal.addEventListener('abort', onAbort, { once: true }); removeAbort = () => signal.removeEventListener('abort', onAbort); }
    }) : new Promise(() => {});
    const emit = (event) => {
      if (job.logs.length < MAX_JOB_LOGS) {
        let entry;
        try { entry = structuredClone(event); } catch { entry = { message: String(event) }; }
        try {
          if (utf8ByteLength(JSON.stringify(entry)) > MAX_JOB_EVENT_BYTES) entry = { message: 'Engine event exceeded the retained log-entry limit.', truncated: true };
        } catch { entry = { message: 'Engine event was not JSON-serializable.', truncated: true }; }
        job = { ...job, logs: [...job.logs, entry], updatedAt: new Date().toISOString() };
      }
      eventSink(event);
    };
    const run = adapter.run(job, emit).then(() => ({ cancelled: false })).catch((error) => ({ cancelled: false, error }));
    const outcome = await Promise.race([run, abort]);
    removeAbort();
    if (outcome.cancelled) {
      job = requestCancel(job);
      await adapter.cancel(job);
      await adapter.clean(job);
      return completeCancellation(job);
    }
    if (outcome.error) throw outcome.error;
    const result = await adapter.parse(job);
    await adapter.clean(job);
    return { ...transitionJob(job, 'succeeded'), result };
  } catch (error) {
    const failed = failJob(job, error);
    try { await adapter.clean(failed); } catch { /* preserve the original job failure */ }
    return failed;
  }
}

export function createJob({ id, projectId, operation, adapter = null, engineVersion = null, inputs = [], outputs = [], arguments: args = [], resourcePolicy = {}, artifacts = [], createdAt = new Date().toISOString() }) {
  if ([id, projectId, operation].some((value) => typeof value !== 'string' || !value.trim() || value.length > MAX_JOB_TEXT)) throw new TypeError('Job id, projectId, and operation must be bounded non-empty strings.');
  if (!Array.isArray(inputs) || inputs.length > 100_000 || inputs.some((input) => typeof input !== 'string' || !input.trim() || input.length > MAX_JOB_PATH)) throw new TypeError('Job inputs must be bounded non-empty strings.');
  if (!Array.isArray(outputs) || outputs.length > 100_000 || outputs.some((output) => typeof output !== 'string' || !output.trim() || output.length > MAX_JOB_PATH)) throw new TypeError('Job outputs must be bounded non-empty strings.');
  if (!Array.isArray(args) || args.length > 100_000 || args.some((arg) => typeof arg !== 'string' || utf8ByteLength(arg) > MAX_JOB_ARGUMENT_BYTES || /[\u0000-\u001f\u007f]/.test(arg))) throw new TypeError('Job arguments must be bounded strings without control characters.');
  if (typeof createdAt !== 'string' || !createdAt.trim() || Number.isNaN(Date.parse(createdAt))) throw new TypeError('Job createdAt must be a valid timestamp.');
  return { id, projectId, operation, adapter, engineVersion, state: 'queued', createdAt, updatedAt: createdAt, startedAt: null, finishedAt: null, inputs: [...inputs], outputs: [...outputs], arguments: [...args], resourcePolicy: cloneResourcePolicy(resourcePolicy), reproducibility: { inputs: [...inputs], arguments: [...args] }, diagnostics: [], artifacts: validateJobArtifacts(artifacts), logs: [] };
}

export function transitionJob(job, nextState) {
  if (!JOB_STATES.includes(nextState)) throw new TypeError(`Unknown job state: ${nextState}`);
  const allowed = {
    queued: ['preparing', 'cancelling', 'cancelled'],
    preparing: ['running', 'cancelling', 'failed', 'cancelled'],
    running: ['succeeded', 'failed', 'cancelling'],
    cancelling: ['cancelled', 'succeeded', 'failed'],
    succeeded: [], failed: [], cancelled: []
  };
  if (!allowed[job.state].includes(nextState)) throw new Error(`Invalid job transition ${job.state} → ${nextState}.`);
  const timestamp = new Date().toISOString();
  return { ...job, state: nextState, updatedAt: timestamp, startedAt: nextState === 'running' ? (job.startedAt ?? timestamp) : (job.startedAt ?? null), finishedAt: TERMINAL_JOB_STATES.includes(nextState) ? (job.finishedAt ?? timestamp) : (job.finishedAt ?? null) };
}

export function failJob(job, error) {
  const failed = transitionJob(job.state === 'running' || job.state === 'preparing' ? job : transitionJob(job, 'cancelling'), 'failed');
  return { ...failed, diagnostics: [...failed.diagnostics, createDiagnostic({ code: error?.code || DIAGNOSTIC_CODES.ENGINE_FAILURE, message: error?.message || String(error) })] };
}

export function requestCancel(job) {
  if (TERMINAL_JOB_STATES.includes(job.state)) return job;
  if (job.state === 'running') return transitionJob(job, 'cancelling');
  return transitionJob(job, 'cancelled');
}

export function completeCancellation(job) {
  if (job.state === 'cancelled') return job;
  return transitionJob(job, 'cancelled');
}

// The concrete adapter is re-exported from the stable SDK entry point while
// retaining its own subpath for consumers that want to tree-shake it.
export { createNgspiceAdapter, parseNgspiceDiagnostics, parseNgspiceMeasurements, parseNgspiceOutput, parseNgspiceVersion } from './ngspice.mjs';
export { createArduinoCliAdapter, parseArduinoCliVersion, parseArduinoDiagnostics, parseArduinoInventory } from './arduino-cli.mjs';
export { createKiCadAdapter, parseKiCadReport } from './kicad.mjs';
export { createVerilatorAdapter, parseVerilatorDiagnostics } from './verilator.mjs';
export { createGhdlAdapter, parseGhdlDiagnostics } from './ghdl.mjs';
export { createYosysAdapter, parseYosysReport } from './yosys.mjs';
export { createNextpnrAdapter, parseNextpnrReport } from './nextpnr.mjs';
export { createQucsatorRfAdapter, parseQucsatorRfReport } from './qucsator-rf.mjs';
export { createTsharkAdapter, parseTsharkDiagnostics, parseTsharkJson } from './tshark.mjs';
export { createPlatformIoAdapter, parsePlatformIoDiagnostics } from './platformio.mjs';
export { createRenodeAdapter, parseRenodeDiagnostics } from './renode.mjs';
export { assertAbsoluteExecutable, probeExecutable, probeEngineManifest, loadAndProbeManifest } from './discovery.mjs';
export { validateEngineManifest } from './manifest.mjs';
