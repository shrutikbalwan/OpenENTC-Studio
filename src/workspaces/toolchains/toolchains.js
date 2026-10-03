// Toolchains workspace: reviewed external-engine catalogue, desktop detection results and the
// device/process/artifact permission panel. Entry points: renderToolchains(state), refreshEngineDetection().
import { esc } from '../../shared/escaping.js';
import { engines } from '../../core/engine-registry.js';
import { notify, setState } from '../../core/store.js';
import { createDevicePermissionPolicy } from '../../../packages/device-bridge/src/index.mjs';
import { desktopBridge } from '../../core/desktop-bridge.js';
import { pageHeader } from '../../components/layout.js';

const browserDevicePolicy = createDevicePermissionPolicy({ environment: 'browser' });
export function renderToolchains(state) {
  const toolchainModule = { name: 'Toolchains', description: 'Detected tools, licences and capabilities.', color: '#94a3b8' };
  const deviceScopes = browserDevicePolicy.inspect();
  const detection = state.toolchainDetection || {};
  const statusLabel = (engine) => engine.status === 'built-in' ? 'Built in' : engine.disabled ? 'Disabled' : detection[engine.id]?.state === 'detected' ? 'Detected' : detection[engine.id]?.state === 'invalid' ? 'Incompatible' : detection[engine.id]?.state === 'missing' ? 'Missing' : engine.status === 'unsupported' ? 'Unsupported' : 'Unavailable';
  const statusClass = (engine) => engine.status === 'built-in' ? 'built-in' : engine.disabled ? 'disabled' : detection[engine.id]?.state === 'detected' ? 'ready' : detection[engine.id]?.state === 'invalid' ? 'incompatible' : engine.status === 'unsupported' ? 'unsupported' : 'unavailable';
  const refresh = desktopBridge.available ? '<button class="button ghost" data-action="refresh-detection">Refresh detection</button>' : '<button class="button ghost" disabled title="Native detection is unavailable in browser preview">Refresh unavailable</button>';
  const environment = desktopBridge.available ? 'DESKTOP BRIDGE' : 'BROWSER PREVIEW';
  const processAction = desktopBridge.available && state.desktopProject?.project_id
    ? `<button class="button ghost" data-action="${state.processPermissionGranted ? 'revoke-process' : 'grant-process'}">${state.processPermissionGranted ? 'Revoke process permission' : 'Review process permission'}</button>`
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before granting process execution">Process permission unavailable</button>';
  const artifactAction = desktopBridge.available && state.desktopProject?.project_id
    ? `<button class="button ghost" data-action="${state.artifactPermissionGranted ? 'revoke-artifact' : 'grant-artifact'}">${state.artifactPermissionGranted ? 'Revoke artifact permission' : 'Review artifact-write permission'}</button>`
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before granting artifact writes">Artifact permission unavailable</button>';
  const jobsAction = desktopBridge.available && state.desktopProject?.project_id
    ? '<button class="button ghost" data-action="refresh-jobs">Refresh jobs</button>'
    : '<button class="button ghost" disabled title="Open a project in the desktop shell before listing jobs">Jobs unavailable</button>';
  const jobs = state.desktopJobs || [];
  const events = state.desktopEvents || [];
  const jobRows = jobs.length ? jobs.map((job) => { const active = ['queued', 'preparing', 'running', 'cancelling'].includes(job.state); const cancel = active && job.operation === 'process' ? `<button class="button ghost compact" data-action="cancel-job" data-job-id="${esc(job.id)}">Cancel</button>` : ''; const error = job.error ? ` · ${esc(job.error)}` : ''; return `<div class="engine-row" role="listitem"><span class="engine-logo">JOB</span><div><b>${esc(job.id)}</b><small>${esc(job.operation)} · ${esc(job.adapter)} · ${(job.arguments || []).length} args · ${(job.artifacts || []).length} artifacts${error}</small></div><span>${esc(job.state)}</span><span>${esc(job.engine_version || 'version pending')}</span><span class="engine-status ${['succeeded', 'failed', 'cancelled'].includes(job.state) ? (job.state === 'succeeded' ? 'ready' : 'incompatible') : 'unavailable'}">${job.state === 'succeeded' ? 'Succeeded' : job.state === 'failed' ? 'Failed' : job.state === 'cancelled' ? 'Cancelled' : 'Active'}</span>${cancel}</div>`; }).join('') : `<div class="empty-state">${desktopBridge.available && state.desktopProject?.project_id ? 'No native jobs loaded for this project.' : 'Open a desktop project to view native jobs.'}</div>`;
  const eventRows = events.length ? events.slice(-12).reverse().map((event) => { const data = event.data || {}; const subject = data.id || data.job_id || data.path || data.code || 'project event'; const detail = data.state || data.code || (data.message ? data.message.slice(0, 160) : ''); return `<div class="permission-row" role="listitem"><span>${esc(event.kind || 'event')}</span><small>${esc(subject)}${detail ? ` · ${esc(detail)}` : ''}</small></div>`; }).join('') : '<div class="empty-state">Refresh jobs to load lifecycle events for this project.</div>';
  return `<div class="page scroll-page toolchains-page">
    ${pageHeader(toolchainModule, 'NATIVE CAPABILITY CATALOG', refresh)}
    <section class="toolchain-notice"><span class="pill"><i></i> ${environment}</span><h2>Native tools are never assumed installed.</h2><p>${desktopBridge.available ? 'Detection reads fixed candidate paths without executing or installing tools.' : 'The desktop bridge will probe fixed executable paths without installing or mutating the system. This preview shows reviewed catalogue states only.'}</p></section>
    <section class="engine-table">${engines.map((engine) => `<div class="engine-row"><span class="engine-logo">${esc(engine.name.slice(0, 2).toUpperCase())}</span><div><b>${esc(engine.name)}</b><small>${esc(engine.capability)}</small></div><span>${esc(engine.area)}</span><span>${esc(engine.license)}</span><span class="engine-status ${statusClass(engine)}">${statusLabel(engine)}</span></div>`).join('')}</section>
    <div class="section-title"><div><span class="eyebrow">PROJECT JOBS</span><h2>Native lifecycle records</h2></div><div class="heading-actions">${jobsAction}</div></div>
    <section class="engine-table job-table" role="list" aria-label="Native lifecycle jobs">${jobRows}</section>
    <section class="permission-card"><div class="section-title"><div><span class="eyebrow">RECENT NATIVE EVENTS</span><h2 id="native-events-heading">Lifecycle notifications</h2></div><span class="pill">${events.length ? `${events.length} loaded` : 'NONE LOADED'}</span></div><div class="permission-grid" role="list" aria-labelledby="native-events-heading">${eventRows}</div></section>
    <section class="module-info-grid"><article><span class="eyebrow">SECURITY BOUNDARY</span><h3>Read-only discovery</h3><p>Detection uses fixed absolute candidates and filesystem metadata only. Missing tools remain unavailable until the user configures them.</p></article><article><span class="eyebrow">LICENCE POLICY</span><h3>Upstream terms stay visible</h3><p>Each adapter records an SPDX expression, upstream source and installation mode. OpenENTC does not relicense connected tools.</p></article></section>
    <section class="permission-card"><div class="section-title"><div><span class="eyebrow">DEVICE, PROCESS AND ARTIFACT PERMISSIONS</span><h2>Explicit target scopes</h2></div><span class="pill">${desktopBridge.available ? 'PROJECT-BOUND' : 'BROWSER DENIED'}</span></div><p class="muted">Serial, USB, debug, capture, SDR, programmer, process execution and generated-artifact writes are separate permissions. No scope is granted automatically.</p><div class="permission-grid">${deviceScopes.map((scope) => `<div class="permission-row"><span>${esc(scope.permission)}</span><span class="engine-status unavailable">${scope.allowed ? 'Available' : 'Unavailable'}</span><small>${scope.grantedTargets.length ? esc(scope.grantedTargets.join(', ')) : 'No target selected'}</small></div>`).join('')}<div class="permission-row"><span>Process execution</span><span class="engine-status ${state.processPermissionGranted ? 'available' : 'unavailable'}">${state.processPermissionGranted ? 'Granted' : 'Unavailable'}</span><small>${state.processPermissionGranted ? 'Granted only for the currently opened project.' : 'Requires an explicit project-scoped desktop grant; browser preview never exposes it.'}</small></div><div class="permission-row"><span>Generated artifact writes</span><span class="engine-status ${state.artifactPermissionGranted ? 'available' : 'unavailable'}">${state.artifactPermissionGranted ? 'Granted' : 'Unavailable'}</span><small>${state.artifactPermissionGranted ? 'Limited to generated runs/ and build/ paths for the current project.' : 'Requires an explicit project-scoped desktop grant; browser preview never exposes it.'}</small></div></div><div class="heading-actions">${processAction}${artifactAction}</div></section>
  </div>`;
}
export async function refreshEngineDetection() {
  if (!desktopBridge.available) { notify('Native detection is unavailable in the browser preview', 'error'); return; }
  const probes = engines.filter((engine) => Array.isArray(engine.candidates)).map((engine) => ({ id: engine.id, candidates: engine.candidates }));
  try {
    const results = await desktopBridge.detectEngines(probes);
    const detection = Object.fromEntries(results.map((result) => [result.id, result]));
    setState({ toolchainDetection: detection, ...(detection['arduino-cli']?.state === 'detected' ? {} : { arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null }) });
    notify('Toolchain paths checked without executing them', 'success');
  } catch (error) {
    notify(error?.message || 'Toolchain detection failed', 'error');
  }
}
