// Desktop project lifecycle and permissions (Tauri shell only): open/save/close a native project,
// list and cancel jobs, and review or revoke the project-scoped process and artifact grants.
// Closing a project also stops serial sessions, uploads and HDL jobs.
import { esc } from '../shared/escaping.js';
import { getState, notify, replaceProject, setState } from '../core/store.js';
import { desktopBridge } from '../core/desktop-bridge.js';
import { nativeSessions } from '../state/native-sessions.js';
import { showModal } from '../components/dialogs.js';
import { cancelArduinoUpload } from '../workspaces/embedded/embedded.js';
import { cancelHdlJob } from '../workspaces/digital/hdl-toolchain.js';

export async function refreshDesktopJobs() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Native jobs are unavailable in the browser preview', 'error'); return; }
  try {
    const jobs = await desktopBridge.listJobs(project.project_id);
    const events = await desktopBridge.drainEvents(project.project_id);
    setState({ desktopJobs: Array.isArray(jobs) ? jobs : [], desktopEvents: Array.isArray(events) ? events : [] });
    notify('Native job records refreshed', 'success');
  } catch (error) { notify(error?.message || 'Native jobs could not be listed', 'error'); }
}
export async function cancelDesktopJob(id) {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id || !id) { notify('Native job cancellation is unavailable in the browser preview', 'error'); return; }
  try {
    await desktopBridge.cancelProcess(project.project_id, id);
    let terminal = null;
    for (let attempt = 0; attempt < 20 && !terminal; attempt += 1) {
      terminal = await desktopBridge.pollProcess(project.project_id, id);
      if (!terminal) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await refreshDesktopJobs();
    notify(terminal ? `Cancellation completed for ${id}` : `Cancellation requested for ${id}`, 'success');
  } catch (error) { notify(error?.message || 'Native job cancellation failed', 'error'); }
}
export async function openDesktopProject() {
  if (!desktopBridge.available) { notify('Desktop project access is unavailable in the browser preview', 'error'); return; }
  let nativeOpened = false;
  try {
    if (nativeSessions.activeArduinoUpload) await cancelArduinoUpload(true);
    if (nativeSessions.activeHdlJob) await cancelHdlJob(true);
    const root = await desktopBridge.pickProjectDirectory();
    if (!root) return;
    const summary = await desktopBridge.openProject(root);
    nativeOpened = true;
    const project = await desktopBridge.readOpenProject();
    replaceProject(project);
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    setState({ desktopProject: summary, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify('Desktop project opened and validated', 'success');
  } catch (error) {
    if (nativeOpened) await desktopBridge.closeProject().catch(() => {});
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    setState({ desktopProject: null, desktopJobs: [], desktopEvents: [], arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, digitalView: null, processPermissionGranted: false, artifactPermissionGranted: false });
    notify(error?.message || 'Desktop project could not be opened', 'error');
  }
}
export async function closeNativeSessionForBrowserProject() {
  if (!desktopBridge.available || !getState().desktopProject) return true;
  try {
    if (nativeSessions.activeArduinoUpload) await cancelArduinoUpload(true);
    if (nativeSessions.activeHdlJob) await cancelHdlJob(true);
    await desktopBridge.closeProject();
    nativeSessions.activeSerialSession = null; nativeSessions.activeSerialNative = null; if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
    return true;
  } catch (error) {
    notify(error?.message || 'The native project session could not be closed', 'error');
    return false;
  }
}
export function reviewProcessGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Open a desktop project before granting process execution', 'error'); return; }
  showModal('Review process permission', `<p>This grants external-process execution only to the currently opened project.</p><p>The grant is project-bound, is not a shell, and does not install tools or access hardware.</p><button class="button primary wide" data-action="confirm-process-grant">Grant for ${esc(project.name)}</button>`);
  document.querySelector('[data-action="confirm-process-grant"]')?.addEventListener('click', async () => {
    try {
      await desktopBridge.grantProcessExecution(project.project_id, true);
      setState({ processPermissionGranted: true });
      document.querySelector('.modal-done')?.click();
      notify('Process execution granted for this project', 'success');
    } catch (error) { notify(error?.message || 'Process permission was not granted', 'error'); }
  });
}
export function reviewArtifactGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) { notify('Open a desktop project before granting artifact writes', 'error'); return; }
  showModal('Review artifact-write permission', `<p>This grants generated-artifact writes only to the currently opened project.</p><p>Writes are confined to runs/ and build/, are content-addressed, and do not grant source, process or hardware access.</p><button class="button primary wide" data-action="confirm-artifact-grant">Grant for ${esc(project.name)}</button>`);
  document.querySelector('[data-action="confirm-artifact-grant"]')?.addEventListener('click', async () => {
    try {
      await desktopBridge.grantArtifactWrite(project.project_id, true);
      setState({ artifactPermissionGranted: true });
      document.querySelector('.modal-done')?.click();
      notify('Artifact writes granted for this project', 'success');
    } catch (error) { notify(error?.message || 'Artifact-write permission was not granted', 'error'); }
  });
}
export async function revokeProcessGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) return;
  try { await desktopBridge.revokeProcessExecution(project.project_id); setState({ processPermissionGranted: false }); notify('Process execution revoked and owned jobs cancelled', 'success'); }
  catch (error) { notify(error?.message || 'Process permission could not be revoked', 'error'); }
}
export async function revokeArtifactGrant() {
  const project = getState().desktopProject;
  if (!desktopBridge.available || !project?.project_id) return;
  try { await desktopBridge.revokeArtifactWrite(project.project_id); setState({ artifactPermissionGranted: false }); notify('Artifact-write permission revoked', 'success'); }
  catch (error) { notify(error?.message || 'Artifact permission could not be revoked', 'error'); }
}
export async function saveDesktopProject() {
  if (!desktopBridge.available) { notify('Desktop project access is unavailable in the browser preview', 'error'); return; }
  try {
    await desktopBridge.saveOpenProject(getState().project);
    notify('Project saved to the desktop directory', 'success');
  } catch (error) {
    notify(error?.message || 'Desktop project could not be saved', 'error');
  }
}
