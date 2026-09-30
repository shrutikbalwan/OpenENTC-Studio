const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_BYTES = 2 * 1024 * 1024;
const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createDesktopProcessAdapterRunner({ bridge, project, runId, deviceAuthorization = null, pollIntervalMs = 50, sleep = defaultSleep, onStarted = () => {}, onArtifact = () => {} }) {
  if (!RUN_ID.test(runId)) throw new TypeError('Desktop adapter run id is invalid.');
  if (!bridge?.available || typeof bridge.startProcess !== 'function' || typeof bridge.pollProcess !== 'function' || typeof bridge.storeArtifact !== 'function') throw new Error('Native desktop adapter services are unavailable.');
  if (!project?.project_id || !project?.root) throw new TypeError('A validated desktop project is required.');
  if (deviceAuthorization && (!['device-serial', 'device-programmer'].includes(deviceAuthorization.permission) || typeof deviceAuthorization.target !== 'string' || !deviceAuthorization.target.trim() || typeof bridge.startDeviceProcess !== 'function')) throw new TypeError('Desktop device authorization is invalid.');
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 1_000) throw new TypeError('Desktop adapter polling interval is invalid.');
  return async (spec) => {
    if (!spec || typeof spec.executable !== 'string' || !spec.executable || !Array.isArray(spec.args) || spec.args.some((argument) => typeof argument !== 'string')) throw new TypeError('Desktop adapter process specification is invalid.');
    if (spec.signal?.aborted) throw Object.assign(new Error('Desktop adapter job was cancelled before start.'), { code: 'PROCESS_CANCELLED' });
    const timeout_ms = Number.isInteger(spec.timeout_ms) ? spec.timeout_ms : DEFAULT_TIMEOUT_MS;
    const max_output_bytes = Number.isInteger(spec.max_output_bytes) ? spec.max_output_bytes : DEFAULT_OUTPUT_BYTES;
    let started = false; let cancelled = false; let cancellation = null;
    const cancel = () => { cancelled = true; if (started) cancellation ||= bridge.cancelProcess(project.project_id, runId).catch(() => {}); };
    spec.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const request = { executable: spec.executable, args: [...spec.args], cwd: project.root, timeout_ms, max_output_bytes };
      if (deviceAuthorization) await bridge.startDeviceProcess(project.project_id, runId, deviceAuthorization.permission, deviceAuthorization.target, request);
      else await bridge.startProcess(project.project_id, runId, request);
      started = true;
      await onStarted(runId);
      if (spec.signal?.aborted) cancel();
      const attempts = Math.ceil((timeout_ms + 5_000) / pollIntervalMs);
      let result = null;
      for (let attempt = 0; attempt < attempts && !result; attempt += 1) {
        result = await bridge.pollProcess(project.project_id, runId);
        if (!result) await sleep(pollIntervalMs);
      }
      await cancellation;
      if (!result) throw Object.assign(new Error('Desktop adapter job did not publish a terminal result.'), { code: 'PROCESS_POLL_TIMEOUT' });
      const bytes = new TextEncoder().encode(JSON.stringify(result));
      const artifact = await bridge.storeArtifact(project.project_id, `runs/${runId}/process-result.json`, bytes, 'application/json');
      onArtifact(artifact);
      if (cancelled && result.error !== 'PROCESS_CANCELLED') throw Object.assign(new Error('Desktop adapter job cancelled.'), { code: 'PROCESS_CANCELLED' });
      return { ...result, artifacts: Object.freeze([artifact]) };
    } finally {
      spec.signal?.removeEventListener('abort', cancel);
    }
  };
}

export function joinDesktopProjectPath(root, ...segments) {
  if (typeof root !== 'string' || !root || segments.some((segment) => typeof segment !== 'string' || !segment || segment.includes('..') || /[\\/]/.test(segment))) throw new TypeError('Desktop project path segment is invalid.');
  const separator = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${separator}${segments.join(separator)}`;
}
