/**
 * Optional Tauri bridge. The browser preview never fabricates native access:
 * when the Tauri global invoke function is absent, every native operation
 * returns a stable unavailable error.
 */
export const DESKTOP_UNAVAILABLE_CODE = 'DESKTOP_UNAVAILABLE';

function resolveInvoke() {
  return globalThis.__TAURI__?.core?.invoke;
}

function unavailable() {
  const error = new Error('Native desktop services are unavailable in the browser preview.');
  error.code = DESKTOP_UNAVAILABLE_CODE;
  return Promise.reject(error);
}

export function createDesktopBridge(invoke = resolveInvoke()) {
  const callable = typeof invoke === 'function' ? invoke : null;
  const call = (command, args) => callable ? callable(command, args) : unavailable();
  return Object.freeze({
    available: Boolean(callable),
    pickProjectDirectory: () => call('pick_project_directory'),
    openProject: (root) => call('open_project', { root }),
    detectEngines: (probes) => call('detect_engines', { probes }),
    readOpenProject: () => call('read_open_project'),
    saveOpenProject: (manifest) => call('save_open_project', { manifest }),
    closeProject: () => call('close_project'),
    enqueueJob: (request) => call('enqueue_job', { request }),
    getJob: (project_id, id) => call('get_job', { project_id, id }),
    listJobs: (project_id) => call('list_jobs', { project_id }),
    transitionJob: (project_id, id, next, error) => call('transition_job', { project_id, id, next, error }),
    drainEvents: (project_id) => call('drain_events', { project_id }),
    storeArtifact: (project_id, path, bytes, media_type) => call('store_artifact', { project_id, path, bytes: bytes instanceof Uint8Array ? [...bytes] : bytes, media_type }),
    verifyArtifact: (project_id, reference) => call('verify_artifact', { project_id, reference }),
    registerArtifact: (project_id, reference) => call('register_artifact', { project_id, reference }),
    registerGeneratedArtifact: (project_id, path, media_type) => call('register_generated_artifact', { project_id, path, media_type }),
    readArtifact: (project_id, reference, max_bytes = 16 * 1024 * 1024) => call('read_artifact', { project_id, reference, max_bytes }),
    grantProcessExecution: (requested_project_id, acknowledge = false) => call('grant_process_execution', { requested_project_id, acknowledge }),
    grantArtifactWrite: (requested_project_id, acknowledge = false) => call('grant_artifact_write', { requested_project_id, acknowledge }),
    grantDeviceTarget: (requested_project_id, permission, target, acknowledge = false) => call('grant_device_target', { requested_project_id, permission, target, acknowledge }),
    revokeDeviceTarget: (requested_project_id, permission, target) => call('revoke_device_target', { requested_project_id, permission, target }),
    revokeProcessExecution: (project_id) => call('revoke_process_execution', { project_id }),
    revokeArtifactWrite: (project_id) => call('revoke_artifact_write', { project_id }),
    startProcess: (project_id, id, request) => call('start_process', { project_id, id, request }),
    startDeviceProcess: (project_id, id, permission, target, request) => call('start_device_process', { project_id, id, permission, target, request }),
    cancelProcess: (project_id, id) => call('cancel_process', { project_id, id }),
    pollProcess: (project_id, id) => call('poll_process', { project_id, id }),
    startSerial: (project_id, id, target, baud, max_buffer_bytes = 64 * 1024) => call('start_serial', { project_id, id, target, baud, max_buffer_bytes }),
    pollSerial: (project_id, id, max_bytes = 64 * 1024) => call('poll_serial', { project_id, id, max_bytes }),
    writeSerial: (project_id, id, bytes) => call('write_serial', { project_id, id, bytes: bytes instanceof Uint8Array ? [...bytes] : bytes }),
    closeSerial: (project_id, id) => call('close_serial', { project_id, id })
  });
}

export const desktopBridge = createDesktopBridge();
