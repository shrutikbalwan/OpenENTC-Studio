// Embedded Lab workspace: Arduino sketch analysis, Arduino CLI compile/upload and the serial
// terminal (desktop only, permission-gated). Entry points: renderEmbedded(state), bindEmbeddedEvents().
// cancelArduinoUpload is exported so the shell can stop an upload when a project closes.
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, setState, synchronizeOpenProject, updateProject } from '../../core/store.js';
import { analyzeSketchSource } from '../../../packages/firmware/src/index.mjs';
import { createDevicePermissionPolicy, createSerialSession } from '../../../packages/device-bridge/src/index.mjs';
import { desktopBridge } from '../../core/desktop-bridge.js';
import { createArduinoCliAdapter } from '../../../packages/engine-sdk/src/arduino-cli.mjs';
import { createDesktopProcessAdapterRunner, joinDesktopProjectPath } from '../../core/desktop-process-adapter-runner.js';
import { fmt } from '../../shared/formatting.js';
import { pageHeader } from '../../components/layout.js';
import { nativeSessions } from '../../state/native-sessions.js';
import { showModal } from '../../components/dialogs.js';
import { reportError } from '../../services/errors.js';

function selectedArduinoTarget(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'firmware-arduino-target')?.inputs || {};
  const board = state.arduinoInventory?.boards?.find((candidate) => candidate.fqbn === saved.fqbn);
  return board ? { name: board.name, fqbn: board.fqbn } : null;
}
function selectedArduinoPort(state) {
  const port = state.project.experiments.find((experiment) => experiment?.id === 'firmware-arduino-port')?.inputs?.port;
  return typeof port === 'string' && port.trim() && port.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(port) ? port.trim() : '';
}
export function renderEmbedded(state) {
  const embedded = state.project.embedded;
  const firmwareReport = state.simulation?.kind === 'firmware' ? state.simulation.report : null;
  const arduinoReport = state.simulation?.kind === 'arduino' ? state.simulation.report : null;
  const arduino = state.toolchainDetection?.['arduino-cli'];
  const inventoryReady = desktopBridge.available && state.desktopProject?.project_id && arduino?.state === 'detected' && arduino.path && state.processPermissionGranted && state.artifactPermissionGranted;
  const target = selectedArduinoTarget(state);
  const port = selectedArduinoPort(state);
  const programmerGranted = Boolean(port && state.arduinoDeviceGrant?.projectId === state.desktopProject?.project_id && state.arduinoDeviceGrant?.permission === 'device-programmer' && state.arduinoDeviceGrant?.target === port);
  const serialGranted = Boolean(port && state.arduinoSerialGrant?.projectId === state.desktopProject?.project_id && state.arduinoSerialGrant?.target === port);
  const serialConfig = state.project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
  const serialBaud = [9600, 19200, 38400, 57600, 115200, 230400].includes(Number(serialConfig.baud)) ? Number(serialConfig.baud) : 115200;
  const serialEncoding = ['utf-8', 'ascii'].includes(serialConfig.encoding) ? serialConfig.encoding : 'utf-8';
  const serialLineEnding = ['none', 'lf', 'cr', 'crlf'].includes(serialConfig.lineEnding) ? serialConfig.lineEnding : 'lf';
  const serialTimestamps = serialConfig.timestamps !== false;
  const serialState = state.arduinoSerial?.state || 'disconnected';
  const serialConnected = serialState === 'connected';
  const arduinoReady = inventoryReady && target;
  const uploadReady = arduinoReady && programmerGranted;
  const uploadState = state.arduinoUpload;
  const arduinoReason = !desktopBridge.available ? 'Desktop shell required' : !state.desktopProject?.project_id ? 'Open a desktop project' : arduino?.state !== 'detected' || !arduino.path ? 'Detect Arduino CLI in Toolchains' : !state.processPermissionGranted || !state.artifactPermissionGranted ? 'Grant process and artifact permissions in Toolchains' : !state.arduinoInventory ? 'Refresh local Arduino inventory' : !target ? 'Select an installed board target' : `Compile for ${target.name} with project-scoped outputs`;
  const structureOutput = firmwareReport ? (firmwareReport.diagnostics.length ? firmwareReport.diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)} · line ${diagnostic.line}: ${esc(diagnostic.message)}</span>`).join('\n') : '<span class="ok">● Structure looks valid</span>') : '<span class="ok">● Editor ready</span>';
  const compileOutput = arduinoReport ? `${arduinoReport.diagnostics.length ? arduinoReport.diagnostics.map((diagnostic) => `<span class="${diagnostic.severity === 'error' ? 'error' : 'muted'}">${esc(diagnostic.severity.toUpperCase())} ${esc(diagnostic.code)}${diagnostic.source ? ` · ${esc(diagnostic.source)}` : ''}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}: ${esc(diagnostic.message)}</span>`).join('\n') : '<span class="ok">● Arduino CLI compile completed</span>'}${arduinoReport.memory.flash ? `\n<span class="muted">Flash: ${fmt(arduinoReport.memory.flash.used)} / ${fmt(arduinoReport.memory.flash.capacity)} bytes</span>` : ''}${arduinoReport.memory.ram ? `\n<span class="muted">RAM: ${fmt(arduinoReport.memory.ram.used)} / ${fmt(arduinoReport.memory.ram.capacity)} bytes</span>` : ''}` : null;
  return `<div class="page embedded-page">
    ${pageHeader(modules[2], 'FIRMWARE WORKBENCH', `<button class="button ghost" data-action="validate-code">✓ Structure check</button><button class="button ghost" data-action="refresh-arduino-inventory" ${inventoryReady ? '' : 'disabled'} title="${esc(inventoryReady ? 'Read installed boards, cores and libraries without installing anything' : arduinoReason)}">Refresh inventory</button><button class="button run" data-action="build-arduino" ${arduinoReady ? '' : 'disabled'} title="${esc(arduinoReason)}">Build with Arduino CLI</button>`)}
    <div class="embedded-layout">
      <aside class="project-tree"><span class="panel-label">PROJECT</span><h3>${esc(state.project.name)}</h3><button class="tree-item open" disabled>⌄ <span>src</span></button><button class="tree-item file" disabled>&nbsp;&nbsp;C++ <span>main.ino</span></button><button class="tree-item" disabled>› <span>libraries ${state.arduinoInventory ? `(${state.arduinoInventory.libraries.length})` : ''}</span></button><button class="tree-item" disabled>› <span>cores ${state.arduinoInventory ? `(${state.arduinoInventory.cores.length})` : ''}</span></button><div class="board-card"><span>EXPLICIT BUILD TARGET</span>${state.arduinoInventory?.boards?.length ? `<select data-field="arduino-board" aria-label="Arduino build target"><option value="">Select board…</option>${state.arduinoInventory.boards.map((board) => `<option value="${esc(board.fqbn)}" ${target?.fqbn === board.fqbn ? 'selected' : ''}>${esc(board.name)} · ${esc(board.fqbn)}</option>`).join('')}</select>` : `<b>◈ ${esc(embedded.board)}</b><button disabled>${state.arduinoInventory ? 'No installed boards found' : 'Refresh inventory to select'}</button>`}</div></aside>
      <section class="code-workspace"><div class="editor-tabs"><button class="active" disabled>main.ino <i>●</i></button><span></span><small>C++ · UTF-8</small></div><div class="code-editor"><div class="line-numbers">${embedded.code.split('\n').map((_, index) => `<span>${index + 1}</span>`).join('')}</div><textarea spellcheck="false" data-field="embedded-code" aria-label="Arduino sketch source (main.ino)">${esc(embedded.code)}</textarea></div><div class="terminal serial-terminal"><div><span class="panel-label">SERIAL TERMINAL · ${esc(serialState.toUpperCase())}</span><span><button data-action="pause-arduino-serial" ${serialConnected ? '' : 'disabled'}>${state.arduinoSerial?.paused ? 'Resume' : 'Pause'}</button><button data-action="clear-arduino-serial" ${state.arduinoSerial?.text ? '' : 'disabled'}>Clear</button><button data-action="export-arduino-serial" ${state.arduinoSerial?.text ? '' : 'disabled'}>Export</button></span></div><pre aria-live="polite">${state.arduinoSerial?.text ? esc(state.arduinoSerial.text.slice(-32768)) : `<span class="muted">${state.arduinoSerial?.nativeError ? esc(state.arduinoSerial.nativeError) : compileOutput || structureOutput}</span>`}</pre><div class="serial-send"><input data-field="serial-transmit" maxlength="16384" placeholder="Transmit text" ${serialConnected ? '' : 'disabled'}><button data-action="send-arduino-serial" ${serialConnected ? '' : 'disabled'}>Send</button></div></div></section>
      <aside class="device-panel"><span class="panel-label">EXPLICIT DEVICE TARGET</span><div class="board-visual"><div class="usb"></div><div class="board-chip">MCU<br><small>TARGET</small></div><i class="pin p1"></i><i class="pin p2"></i><i class="pin p3"></i></div><h3>${esc(target?.name || 'No board selected')}</h3><p>${esc(target?.fqbn || 'Refresh local inventory and choose an installed board')}</p><label class="device-port-label">Port identifier<input data-field="arduino-port" maxlength="4096" value="${esc(port)}" placeholder="COM4 or /dev/ttyUSB0" ${arduinoReady && !serialConnected && !uploadState ? '' : 'disabled'}></label><div class="serial-config"><label>Baud<select data-serial-config="baud" ${serialConnected ? 'disabled' : ''}>${[9600, 19200, 38400, 57600, 115200, 230400].map((value) => `<option value="${value}" ${serialBaud === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Encoding<select data-serial-config="encoding" ${serialConnected ? 'disabled' : ''}><option value="utf-8" ${serialEncoding === 'utf-8' ? 'selected' : ''}>UTF-8</option><option value="ascii" ${serialEncoding === 'ascii' ? 'selected' : ''}>ASCII</option></select></label><label>Line ending<select data-serial-config="lineEnding" ${serialConnected ? 'disabled' : ''}><option value="none" ${serialLineEnding === 'none' ? 'selected' : ''}>None</option><option value="lf" ${serialLineEnding === 'lf' ? 'selected' : ''}>LF</option><option value="cr" ${serialLineEnding === 'cr' ? 'selected' : ''}>CR</option><option value="crlf" ${serialLineEnding === 'crlf' ? 'selected' : ''}>CRLF</option></select></label><label class="serial-check"><input type="checkbox" data-serial-config="timestamps" ${serialTimestamps ? 'checked' : ''} ${serialConnected ? 'disabled' : ''}> Timestamps</label></div><div class="device-status"><span>Programmer grant</span><b class="${programmerGranted ? '' : 'amber'}">${programmerGranted ? 'Granted' : 'Not granted'}</b><span>Serial grant</span><b class="${serialGranted ? '' : 'amber'}">${serialGranted ? 'Granted' : 'Not granted'}</b><span>Toolchain</span><b class="${arduino?.state === 'detected' ? '' : 'amber'}">${state.arduinoInventory?.version ? `v${esc(state.arduinoInventory.version)}` : arduino?.state === 'detected' ? 'Detected' : 'Not detected'}</b></div><button class="button ghost wide" data-action="${programmerGranted ? 'revoke-arduino-programmer' : 'grant-arduino-programmer'}" ${!uploadState && (programmerGranted || (arduinoReady && port)) ? '' : 'disabled'}>${programmerGranted ? `Revoke programmer access for ${esc(port)}` : 'Review programmer access'}</button>${uploadState ? `<button class="button ghost wide" data-action="cancel-arduino-upload" ${uploadState.phase === 'cancelling' ? 'disabled' : ''}>${uploadState.phase === 'cancelling' ? 'Cancelling…' : `Cancel ${uploadState.phase}`}</button>` : `<button class="button primary wide" data-action="upload-arduino" ${uploadReady ? '' : 'disabled'}>Compile + Upload</button>`}<button class="button ghost wide" data-action="${serialGranted ? 'revoke-arduino-serial' : 'grant-arduino-serial'}" ${!uploadState && (serialGranted || (arduinoReady && port)) ? '' : 'disabled'}>${serialGranted ? `Revoke serial access for ${esc(port)}` : 'Review serial access'}</button><button class="button primary wide" data-action="${serialConnected ? 'disconnect-arduino-serial' : serialState === 'reconnecting' ? 'reconnect-arduino-serial' : 'connect-arduino-serial'}" ${serialGranted && !uploadState ? '' : 'disabled'}>${serialConnected ? 'Disconnect terminal' : serialState === 'reconnecting' ? 'Reconnect terminal' : 'Connect terminal'}</button><div class="inspector-tip"><b>${uploadState ? `Arduino job ${uploadState.phase}` : desktopBridge.available ? 'Desktop safety boundary' : 'Browser preview'}</b><p>${uploadState ? `Target ${esc(uploadState.port)} · ${esc(uploadState.runId)}` : desktopBridge.available ? 'The port is entered manually; no connected-device scan runs. Upload and serial use separate, revocable target grants.' : 'Native compilation and hardware access are unavailable in the browser preview.'}</p></div></aside>
    </div>
  </div>`;
}
export function bindEmbeddedEvents() {
  const editor = document.querySelector('[data-field="embedded-code"]');
  editor?.addEventListener('input', () => updateProject((project) => { project.embedded.code = editor.value; }));
  document.querySelector('[data-action="validate-code"]')?.addEventListener('click', validateCode);
  document.querySelector('[data-action="refresh-arduino-inventory"]')?.addEventListener('click', refreshArduinoInventory);
  document.querySelector('[data-field="arduino-board"]')?.addEventListener('change', async (event) => {
    const before = getState(); const previous = before.arduinoDeviceGrant;
    const board = before.arduinoInventory?.boards.find((candidate) => candidate.fqbn === event.target.value);
    if (previous && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previous.permission, previous.target).catch(() => {});
    recordExperiment({ id: 'firmware-arduino-target', kind: 'firmware', operation: 'arduino-target', inputs: board ? { name: board.name, fqbn: board.fqbn } : {} });
    setState({ arduinoDeviceGrant: null });
  });
  document.querySelector('[data-field="arduino-port"]')?.addEventListener('change', async (event) => {
    const before = getState(); const previous = before.arduinoDeviceGrant; const previousSerial = before.arduinoSerialGrant;
    const port = String(event.target.value || '').trim();
    if (/[\u0000-\u001f\u007f]/.test(port)) { notify('Port identifier contains invalid control characters', 'error'); return; }
    if (nativeSessions.activeSerialNative) await disconnectArduinoSerial();
    if (previous && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previous.permission, previous.target).catch(() => {});
    if (previousSerial && before.desktopProject?.project_id) await desktopBridge.revokeDeviceTarget(before.desktopProject.project_id, previousSerial.permission, previousSerial.target).catch(() => {});
    recordExperiment({ id: 'firmware-arduino-port', kind: 'firmware', operation: 'arduino-port', inputs: port ? { port } : {} });
    setState({ arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null });
  });
  document.querySelectorAll('[data-serial-config]').forEach((input) => input.addEventListener('change', () => {
    const current = getState().project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
    const field = input.dataset.serialConfig; const value = field === 'baud' ? Number(input.value) : field === 'timestamps' ? input.checked : input.value;
    recordExperiment({ id: 'firmware-serial-config', kind: 'firmware', operation: 'serial-terminal', inputs: { ...current, [field]: value } });
  }));
  document.querySelector('[data-action="build-arduino"]')?.addEventListener('click', runNativeArduinoCompile);
  document.querySelector('[data-action="grant-arduino-programmer"]')?.addEventListener('click', reviewArduinoProgrammerGrant);
  document.querySelector('[data-action="revoke-arduino-programmer"]')?.addEventListener('click', revokeArduinoProgrammerGrant);
  document.querySelector('[data-action="upload-arduino"]')?.addEventListener('click', runNativeArduinoUpload);
  document.querySelector('[data-action="cancel-arduino-upload"]')?.addEventListener('click', cancelArduinoUpload);
  document.querySelector('[data-action="grant-arduino-serial"]')?.addEventListener('click', reviewArduinoSerialGrant);
  document.querySelector('[data-action="revoke-arduino-serial"]')?.addEventListener('click', revokeArduinoSerialGrant);
  document.querySelector('[data-action="connect-arduino-serial"]')?.addEventListener('click', connectArduinoSerial);
  document.querySelector('[data-action="reconnect-arduino-serial"]')?.addEventListener('click', reconnectArduinoSerial);
  document.querySelector('[data-action="disconnect-arduino-serial"]')?.addEventListener('click', disconnectArduinoSerial);
  document.querySelector('[data-action="pause-arduino-serial"]')?.addEventListener('click', toggleArduinoSerialPause);
  document.querySelector('[data-action="clear-arduino-serial"]')?.addEventListener('click', clearArduinoSerial);
  document.querySelector('[data-action="export-arduino-serial"]')?.addEventListener('click', exportArduinoSerial);
  document.querySelector('[data-action="send-arduino-serial"]')?.addEventListener('click', sendArduinoSerial);
}
function validateCode() {
  const code = getState().project.embedded.code;
  const report = analyzeSketchSource(code);
  setState({ simulation: { kind: 'firmware', report } });
  notify(report.diagnostics.length ? `${report.diagnostics.length} structure issue(s)` : 'Source structure looks valid', report.diagnostics.length ? 'error' : 'success');
}
async function refreshArduinoInventory() {
  const state = getState();
  const desktopProject = state.desktopProject;
  const detection = state.toolchainDetection?.['arduino-cli'];
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before reading inventory', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions before reading Arduino inventory', 'error'); return; }
  const baseId = `arduino-inventory-${Date.now().toString(36)}`;
  const artifacts = [];
  const results = {};
  try {
    await desktopBridge.saveOpenProject(state.project);
    for (const [index, operation] of ['version', 'board-inventory', 'core-inventory', 'library-inventory'].entries()) {
      const runner = createDesktopProcessAdapterRunner({
        bridge: desktopBridge,
        project: desktopProject,
        runId: `${baseId}-${index}`,
        onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
        onArtifact: (artifact) => { artifacts.push(artifact); },
      });
      const adapter = createArduinoCliAdapter({ executable: detection.path, runner });
      const job = { operation };
      try { await adapter.prepare(job); await adapter.run(job); results[operation] = await adapter.parse(job); }
      finally { await adapter.clean().catch(() => {}); }
    }
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    const version = results.version.version;
    updateProject((project) => { project.provenance.engineVersions['arduino-cli'] = version; });
    await desktopBridge.saveOpenProject(getState().project);
    const jobs = await desktopBridge.listJobs(desktopProject.project_id);
    const events = await desktopBridge.drainEvents(desktopProject.project_id);
    setState({ arduinoInventory: { version, boards: results['board-inventory'].items, cores: results['core-inventory'].items, libraries: results['library-inventory'].items, refreshedAt: new Date().toISOString() }, desktopJobs: jobs, desktopEvents: events });
    notify(`Arduino inventory loaded: ${results['board-inventory'].items.length} boards, ${results['core-inventory'].items.length} cores, ${results['library-inventory'].items.length} libraries`, 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the inventory error */ }
    reportError(error, { fallback: 'Arduino inventory failed' });
  }
}
function reviewArduinoProgrammerGrant() {
  const state = getState(); const project = state.desktopProject; const target = selectedArduinoTarget(state); const port = selectedArduinoPort(state);
  if (!desktopBridge.available || !project?.project_id || !target || !port) { notify('Open a desktop project, select an installed board and enter a port first', 'error'); return; }
  showModal('Review programmer permission', `<p>This permits one project to invoke the detected Arduino CLI for programmer access to exactly <b>${esc(port)}</b>.</p><p>No connected-device scan runs. Changing the board, port or project clears the in-app grant.</p><button class="button primary wide" data-action="confirm-programmer-grant">Grant programmer access to ${esc(port)}</button>`);
  document.querySelector('[data-action="confirm-programmer-grant"]')?.addEventListener('click', async () => {
    try {
      const current = getState();
      if (current.desktopProject?.project_id !== project.project_id || selectedArduinoPort(current) !== port || selectedArduinoTarget(current)?.fqbn !== target.fqbn) throw new Error('The selected project, board or port changed; review permission again.');
      await desktopBridge.grantDeviceTarget(project.project_id, 'device-programmer', port, true);
      setState({ arduinoDeviceGrant: { projectId: project.project_id, permission: 'device-programmer', target: port } });
      document.querySelector('.modal-done')?.click();
      notify(`Programmer access granted for ${port}`, 'success');
    } catch (error) { reportError(error, { fallback: 'Programmer permission was not granted' }); }
  });
}
function serialConfiguration(state = getState()) {
  const config = state.project.experiments.find((experiment) => experiment?.id === 'firmware-serial-config')?.inputs || {};
  return {
    baud: [9600, 19200, 38400, 57600, 115200, 230400].includes(Number(config.baud)) ? Number(config.baud) : 115200,
    encoding: ['utf-8', 'ascii'].includes(config.encoding) ? config.encoding : 'utf-8',
    lineEnding: ['none', 'lf', 'cr', 'crlf'].includes(config.lineEnding) ? config.lineEnding : 'lf',
    timestamps: config.timestamps !== false,
  };
}
function publishArduinoSerial(nativeError = null) {
  if (!nativeSessions.activeSerialSession) return;
  setState({ arduinoSerial: { ...nativeSessions.activeSerialSession.inspect(), text: nativeSessions.activeSerialSession.exportText(), nativeError } });
}
function decodeSerialBytes(bytes, encoding, decoder) {
  if (encoding === 'ascii') return bytes.map((value) => value <= 0x7f ? String.fromCharCode(value) : '�').join('');
  return decoder.decode(Uint8Array.from(bytes), { stream: true });
}
async function pollArduinoSerial() {
  const native = nativeSessions.activeSerialNative;
  if (!native || !nativeSessions.activeSerialSession) return;
  try {
    const result = await desktopBridge.pollSerial(native.projectId, native.id, 8192);
    if (nativeSessions.activeSerialNative !== native) return;
    if (result.bytes.length) nativeSessions.activeSerialSession.ingest(decodeSerialBytes(result.bytes, native.encoding, native.decoder));
    if (!nativeSessions.activeSerialSession.inspect().paused) publishArduinoSerial(result.error);
    if (!result.open || result.error) {
      nativeSessions.activeSerialSession.disconnect({ unexpected: true });
      await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
      publishArduinoSerial(result.error || 'Serial port closed unexpectedly.');
      nativeSessions.serialPollTimer = null;
      return;
    }
    nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 150);
  } catch (error) {
    if (nativeSessions.activeSerialNative !== native || !nativeSessions.activeSerialSession) return;
    nativeSessions.activeSerialSession.disconnect({ unexpected: true });
    publishArduinoSerial(error?.message || 'Serial polling failed.');
    nativeSessions.serialPollTimer = null;
  }
}
function reviewArduinoSerialGrant() {
  const state = getState(); const project = state.desktopProject; const port = selectedArduinoPort(state);
  if (!desktopBridge.available || !project?.project_id || !selectedArduinoTarget(state) || !port) { notify('Open a desktop project, select a board and enter a port first', 'error'); return; }
  showModal('Review serial permission', `<p>This permits this project to open exactly <b>${esc(port)}</b> for an interactive serial terminal.</p><p>No port enumeration or background connection occurs. Revocation closes the active session.</p><button class="button primary wide" data-action="confirm-serial-grant">Grant serial access to ${esc(port)}</button>`);
  document.querySelector('[data-action="confirm-serial-grant"]')?.addEventListener('click', async () => {
    try {
      const current = getState();
      if (current.desktopProject?.project_id !== project.project_id || selectedArduinoPort(current) !== port) throw new Error('The selected project or port changed; review permission again.');
      await desktopBridge.grantDeviceTarget(project.project_id, 'device-serial', port, true);
      setState({ arduinoSerialGrant: { projectId: project.project_id, permission: 'device-serial', target: port } });
      document.querySelector('.modal-done')?.click(); notify(`Serial access granted for ${port}`, 'success');
    } catch (error) { reportError(error, { fallback: 'Serial permission was not granted' }); }
  });
}
async function revokeArduinoSerialGrant() {
  const state = getState(); const grant = state.arduinoSerialGrant; const projectId = state.desktopProject?.project_id;
  if (!grant || !projectId) return;
  try {
    if (nativeSessions.activeSerialNative) await disconnectArduinoSerial();
    await desktopBridge.revokeDeviceTarget(projectId, grant.permission, grant.target);
    setState({ arduinoSerialGrant: null, arduinoSerial: null });
    notify(`Serial access revoked for ${grant.target}`, 'success');
  } catch (error) { reportError(error, { fallback: 'Serial permission could not be revoked' }); }
}
async function connectArduinoSerial() {
  const state = getState(); const project = state.desktopProject; const port = selectedArduinoPort(state); const config = serialConfiguration(state);
  const granted = port && state.arduinoSerialGrant?.projectId === project?.project_id && state.arduinoSerialGrant?.target === port;
  if (!desktopBridge.available || !project?.project_id || !granted) { notify('Grant serial access for the selected desktop project and port first', 'error'); return; }
  const id = `serial-${Date.now().toString(36)}`;
  try {
    await desktopBridge.startSerial(project.project_id, id, port, config.baud, 64 * 1024);
    const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['serial'] }); policy.selectTarget('serial', port);
    nativeSessions.activeSerialSession = createSerialSession({ permissionPolicy: policy, target: port, ...config, maxBufferBytes: 64 * 1024, maxReconnectAttempts: 3 });
    nativeSessions.activeSerialSession.connect();
    nativeSessions.activeSerialNative = { projectId: project.project_id, id, target: port, baud: config.baud, encoding: config.encoding, decoder: new TextDecoder('utf-8') };
    publishArduinoSerial(); nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal connected to ${port}`, 'success');
  } catch (error) { reportError(error, { fallback: 'Serial port could not be opened' }); }
}
async function reconnectArduinoSerial() {
  const native = nativeSessions.activeSerialNative;
  if (!native || !nativeSessions.activeSerialSession || nativeSessions.activeSerialSession.inspect().state !== 'reconnecting') { notify('No interrupted serial session is available to reconnect', 'error'); return; }
  try {
    await desktopBridge.startSerial(native.projectId, native.id, native.target, native.baud, 64 * 1024);
    nativeSessions.activeSerialSession.reconnect(); native.decoder = new TextDecoder('utf-8'); publishArduinoSerial(); nativeSessions.serialPollTimer = setTimeout(pollArduinoSerial, 0); notify(`Serial terminal reconnected to ${native.target}`, 'success');
  } catch (error) {
    try { nativeSessions.activeSerialSession.reconnect(); nativeSessions.activeSerialSession.markReconnectFailed(); } catch { /* state already exhausted */ }
    publishArduinoSerial(error?.message || 'Serial reconnect failed'); reportError(error, { fallback: 'Serial reconnect failed' });
  }
}
async function disconnectArduinoSerial() {
  if (nativeSessions.serialPollTimer) clearTimeout(nativeSessions.serialPollTimer); nativeSessions.serialPollTimer = null;
  const native = nativeSessions.activeSerialNative; const session = nativeSessions.activeSerialSession;
  nativeSessions.activeSerialNative = null; nativeSessions.activeSerialSession = null;
  if (native) await desktopBridge.closeSerial(native.projectId, native.id).catch(() => {});
  if (session) { session.close(); setState({ arduinoSerial: { ...session.inspect(), text: session.exportText(), nativeError: null } }); }
}
function toggleArduinoSerialPause() {
  if (!nativeSessions.activeSerialSession) return; nativeSessions.activeSerialSession.setPaused(!nativeSessions.activeSerialSession.inspect().paused); publishArduinoSerial();
}
function clearArduinoSerial() {
  if (nativeSessions.activeSerialSession) { nativeSessions.activeSerialSession.clear(); publishArduinoSerial(); } else setState({ arduinoSerial: null });
}
function exportArduinoSerial() {
  const text = nativeSessions.activeSerialSession?.exportText() || getState().arduinoSerial?.text || '';
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `openentc-serial-${Date.now()}.txt`; link.click(); URL.revokeObjectURL(link.href); notify('Serial transcript exported', 'success');
}
async function sendArduinoSerial() {
  const input = document.querySelector('[data-field="serial-transmit"]'); const native = nativeSessions.activeSerialNative;
  if (!input || !native || !nativeSessions.activeSerialSession) return;
  try {
    const text = nativeSessions.activeSerialSession.formatTransmit(input.value); await desktopBridge.writeSerial(native.projectId, native.id, new TextEncoder().encode(text)); input.value = '';
  } catch (error) { reportError(error, { fallback: 'Serial write failed' }); }
}
async function revokeArduinoProgrammerGrant() {
  const state = getState(); const grant = state.arduinoDeviceGrant; const projectId = state.desktopProject?.project_id;
  if (!grant || !projectId) return;
  try {
    await desktopBridge.revokeDeviceTarget(projectId, grant.permission, grant.target);
    setState({ arduinoDeviceGrant: null });
    notify(`Programmer access revoked for ${grant.target}`, 'success');
  } catch (error) { reportError(error, { fallback: 'Programmer permission could not be revoked' }); }
}
export async function cancelArduinoUpload(silent = false) {
  const upload = nativeSessions.activeArduinoUpload;
  if (!upload) return;
  setState({ arduinoUpload: { runId: upload.runId, phase: 'cancelling', port: upload.port } });
  try {
    await upload.adapter?.cancel();
    if (!silent) notify(`Cancelling Arduino job for ${upload.port}`, 'success');
  } catch (error) {
    if (!silent) reportError(error, { fallback: 'Arduino upload cancellation failed' });
  }
}
async function runNativeArduinoUpload() {
  const state = getState(); const desktopProject = state.desktopProject; const detection = state.toolchainDetection?.['arduino-cli'];
  const target = selectedArduinoTarget(state); const port = selectedArduinoPort(state);
  const granted = port && state.arduinoDeviceGrant?.projectId === desktopProject?.project_id && state.arduinoDeviceGrant?.permission === 'device-programmer' && state.arduinoDeviceGrant?.target === port;
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before uploading', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions before uploading', 'error'); return; }
  if (!target || !port) { notify('Select an installed board and enter the exact port before uploading', 'error'); return; }
  if (!granted) { notify(`Review and grant programmer access for ${port} before uploading`, 'error'); return; }
  if (nativeSessions.activeArduinoUpload) { notify('An Arduino upload is already active', 'error'); return; }
  const structure = analyzeSketchSource(state.project.embedded.code);
  if (structure.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) { setState({ simulation: { kind: 'firmware', report: structure } }); notify('Fix source structure errors before uploading', 'error'); return; }
  const baseId = `arduino-upload-${Date.now().toString(36)}`;
  const sketchPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'sketch');
  const buildPath = joinDesktopProjectPath(desktopProject.root, 'runs', baseId, 'build');
  const sketchBytes = new TextEncoder().encode(state.project.embedded.code); const artifacts = []; let compileAdapter = null; let uploadAdapter = null;
  const runnerOptions = { bridge: desktopBridge, project: desktopProject, onStarted: async () => setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id) }), onArtifact: (artifact) => { artifacts.push(artifact); } };
  try {
    nativeSessions.activeArduinoUpload = { runId: baseId, port, adapter: null };
    setState({ arduinoUpload: { runId: baseId, phase: 'compiling', port } });
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(desktopProject.project_id, `runs/${baseId}/sketch/sketch.ino`, sketchBytes, 'text/x-arduino'));
    compileAdapter = createArduinoCliAdapter({ executable: detection.path, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-compile` }) });
    nativeSessions.activeArduinoUpload.adapter = compileAdapter;
    const compileJob = { operation: 'compile', board: target.fqbn, sketchPath, buildPath };
    await compileAdapter.prepare(compileJob); await compileAdapter.run(compileJob); const report = await compileAdapter.parse(compileJob);
    const permissionPolicy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['programmer'] }); permissionPolicy.selectTarget('programmer', port);
    uploadAdapter = createArduinoCliAdapter({ executable: detection.path, permissionPolicy, runner: createDesktopProcessAdapterRunner({ ...runnerOptions, runId: `${baseId}-device`, deviceAuthorization: { permission: 'device-programmer', target: port } }) });
    nativeSessions.activeArduinoUpload.adapter = uploadAdapter;
    setState({ arduinoUpload: { runId: baseId, phase: 'uploading', port } });
    const uploadJob = { operation: 'upload', board: target.fqbn, port, sketchPath, buildPath };
    await uploadAdapter.prepare(uploadJob); await uploadAdapter.run(uploadJob); await uploadAdapter.parse(uploadJob);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'firmware-arduino-upload', kind: 'firmware', operation: 'arduino-upload', inputs: { board: target.fqbn, boardName: target.name, port, sourceBytes: sketchBytes.byteLength, engine: 'arduino-cli', explicitlyAuthorized: true } });
    await desktopBridge.saveOpenProject(getState().project);
    setState({ simulation: { kind: 'arduino', report, runId: baseId, uploaded: true, port }, desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) });
    notify(`Arduino upload completed for ${port}`, 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the original engine error */ }
    notify(error?.code === 'PROCESS_CANCELLED' ? 'Arduino upload cancelled' : error?.message || 'Arduino upload failed', error?.code === 'PROCESS_CANCELLED' ? 'success' : 'error');
  } finally {
    nativeSessions.activeArduinoUpload = null;
    setState({ arduinoUpload: null });
    await compileAdapter?.clean().catch(() => {}); await uploadAdapter?.clean().catch(() => {});
  }
}
async function runNativeArduinoCompile() {
  const state = getState();
  const desktopProject = state.desktopProject;
  const detection = state.toolchainDetection?.['arduino-cli'];
  const target = selectedArduinoTarget(state);
  if (!desktopBridge.available || !desktopProject?.project_id || detection?.state !== 'detected' || !detection.path) { notify('Detect Arduino CLI and open a desktop project before compiling', 'error'); return; }
  if (!state.processPermissionGranted || !state.artifactPermissionGranted) { notify('Grant process and artifact permissions in Toolchains before compiling', 'error'); return; }
  if (!target) { notify('Refresh Arduino inventory and explicitly select an installed board before compiling', 'error'); return; }
  const code = state.project.embedded.code;
  const structure = analyzeSketchSource(code);
  if (structure.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    setState({ simulation: { kind: 'firmware', report: structure } });
    notify('Fix source structure errors before compiling', 'error');
    return;
  }
  const runId = `arduino-${Date.now().toString(36)}`;
  const sketchPath = joinDesktopProjectPath(desktopProject.root, 'runs', runId, 'sketch');
  const buildPath = joinDesktopProjectPath(desktopProject.root, 'runs', runId, 'build');
  const sketchBytes = new TextEncoder().encode(code);
  let adapter = null;
  let artifacts = [];
  try {
    await desktopBridge.saveOpenProject(state.project);
    artifacts.push(await desktopBridge.storeArtifact(desktopProject.project_id, `runs/${runId}/sketch/sketch.ino`, sketchBytes, 'text/x-arduino'));
    const runner = createDesktopProcessAdapterRunner({
      bridge: desktopBridge,
      project: desktopProject,
      runId,
      onStarted: async () => { const jobs = await desktopBridge.listJobs(desktopProject.project_id); setState({ desktopJobs: jobs }); },
      onArtifact: (artifact) => { artifacts.push(artifact); },
    });
    adapter = createArduinoCliAdapter({ executable: detection.path, runner });
    const job = { operation: 'compile', board: target.fqbn, sketchPath, buildPath };
    await adapter.prepare(job);
    await adapter.run(job);
    const report = await adapter.parse(job);
    for (const artifact of artifacts) await desktopBridge.registerArtifact(desktopProject.project_id, artifact);
    synchronizeOpenProject(await desktopBridge.readOpenProject());
    recordExperiment({ id: 'firmware-arduino-compile', kind: 'firmware', operation: 'arduino-compile', inputs: { board: job.board, boardName: target.name, sourceBytes: sketchBytes.byteLength, engine: 'arduino-cli' } });
    await desktopBridge.saveOpenProject(getState().project);
    const jobs = await desktopBridge.listJobs(desktopProject.project_id);
    const events = await desktopBridge.drainEvents(desktopProject.project_id);
    setState({ simulation: { kind: 'arduino', report, runId }, desktopJobs: jobs, desktopEvents: events });
    notify('Arduino CLI compile completed', 'success');
  } catch (error) {
    try { setState({ desktopJobs: await desktopBridge.listJobs(desktopProject.project_id), desktopEvents: await desktopBridge.drainEvents(desktopProject.project_id) }); } catch { /* retain the original engine error */ }
    reportError(error, { fallback: 'Arduino CLI compile failed' });
  } finally {
    await adapter?.clean().catch(() => {});
  }
}
