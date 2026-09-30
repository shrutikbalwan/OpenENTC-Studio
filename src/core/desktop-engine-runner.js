const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_NETLIST_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_BYTES = 2 * 1024 * 1024;

function assertRunnerInputs(bridge, project, runId, spec) {
  if (!bridge?.available || typeof bridge.storeArtifact !== 'function' || typeof bridge.startProcess !== 'function' || typeof bridge.pollProcess !== 'function') throw new Error('Native desktop engine services are unavailable.');
  if (!project || typeof project.project_id !== 'string' || !project.project_id || typeof project.root !== 'string' || !project.root) throw new TypeError('A validated desktop project is required.');
  if (!RUN_ID.test(runId)) throw new TypeError('Desktop engine run id is invalid.');
  if (!spec || typeof spec.executable !== 'string' || !spec.executable || !Array.isArray(spec.args) || spec.args.some((arg) => typeof arg !== 'string')) throw new TypeError('Desktop engine process specification is invalid.');
  if (typeof spec.netlist !== 'string') throw new TypeError('Desktop engine input netlist is missing.');
  const bytes = new TextEncoder().encode(spec.netlist);
  if (!bytes.length || bytes.length > MAX_NETLIST_BYTES) throw new TypeError('Desktop engine input netlist is empty or oversized.');
  return bytes;
}

const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Adapt the project-scoped Tauri process boundary to the engine SDK runner
 * contract. The native side remains authoritative for grants, executable
 * allow-listing, project confinement, output limits and process ownership.
 */
export function createDesktopEngineRunner({ bridge, project, runId, pollIntervalMs = 50, sleep = defaultSleep, onStarted = () => {}, onArtifacts = () => {} }) {
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 1_000) throw new TypeError('Desktop engine polling interval is invalid.');
  return async (spec) => {
    const inputBytes = assertRunnerInputs(bridge, project, runId, spec);
    if (spec.signal?.aborted) throw Object.assign(new Error('Desktop engine job was cancelled before start.'), { code: 'PROCESS_CANCELLED' });
    const inputPath = `runs/${runId}/input.cir`;
    const resultPath = `runs/${runId}/process-result.json`;
    const artifacts = [await bridge.storeArtifact(project.project_id, inputPath, inputBytes, 'application/x-spice')];
    const timeout_ms = Number.isInteger(spec.timeout_ms) ? spec.timeout_ms : DEFAULT_TIMEOUT_MS;
    const max_output_bytes = Number.isInteger(spec.max_output_bytes) ? spec.max_output_bytes : DEFAULT_OUTPUT_BYTES;
    let cancelRequested = false;
    let cancelPromise = null;
    let started = false;
    const cancel = () => {
      cancelRequested = true;
      if (started) cancelPromise ||= bridge.cancelProcess(project.project_id, runId).catch(() => {});
    };
    spec.signal?.addEventListener('abort', cancel, { once: true });
    try {
      await bridge.startProcess(project.project_id, runId, {
        executable: spec.executable,
        args: [...spec.args, inputPath],
        cwd: project.root,
        timeout_ms,
        max_output_bytes,
      });
      started = true;
      await onStarted(runId);
      if (spec.signal?.aborted) cancel();
      const attempts = Math.ceil((timeout_ms + 5_000) / pollIntervalMs);
      let result = null;
      for (let attempt = 0; attempt < attempts && !result; attempt += 1) {
        result = await bridge.pollProcess(project.project_id, runId);
        if (!result) await sleep(pollIntervalMs);
      }
      await cancelPromise;
      if (!result) throw Object.assign(new Error('Desktop engine job did not publish a terminal result.'), { code: 'PROCESS_POLL_TIMEOUT' });
      const resultBytes = new TextEncoder().encode(JSON.stringify(result));
      artifacts.push(await bridge.storeArtifact(project.project_id, resultPath, resultBytes, 'application/json'));
      onArtifacts(Object.freeze([...artifacts]));
      if (cancelRequested && result.error !== 'PROCESS_CANCELLED') throw Object.assign(new Error('Desktop engine job cancelled.'), { code: 'PROCESS_CANCELLED' });
      return { ...result, artifacts: Object.freeze([...artifacts]) };
    } finally {
      spec.signal?.removeEventListener('abort', cancel);
    }
  };
}
