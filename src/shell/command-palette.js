// Command palette (Ctrl+K), help and engine-information dialogs.
import { modules } from '../data/modules.js';
import { setState } from '../core/store.js';
import { showModal } from '../components/dialogs.js';
import { showDiagnostics } from './diagnostics.js';

export function showHelp() {
  showModal('A unified ENTC workspace', `<p>OpenENTC Studio keeps circuit, firmware, board and communication work in one local project.</p>
    <h3>Know the limits</h3>
    <ul class="help-limits"><li>This is <b>alpha</b> software. Results come from simplified <b>educational models</b>; check design-critical values with a professional tool or a measurement.</li><li>Each engine is compared with references such as ngspice and SciPy, but none has been independently reviewed yet.</li><li>Projects are saved in this browser only. Export a project file to keep a copy.</li><li>The browser version cannot reach hardware or run native tools; the desktop app can, with your permission.</li></ul>
    <h3>Shortcuts</h3>
    <div class="shortcut-list"><span>Command palette</span><kbd>Ctrl K</kbd><span>Run circuit analysis</span><kbd>Circuit → Run</kbd><span>Move component</span><kbd>Drag or arrow keys</kbd><span>Undo / redo</span><kbd>Ctrl Z / Ctrl Y</kbd></div>
    <p><button class="button" data-help-diagnostics>Diagnostics and feedback</button></p>`);
  document.querySelector('[data-help-diagnostics]')?.addEventListener('click', showDiagnostics);
}
export function showEngineInfo() { showModal('How engine connectors work', '<p>OpenENTC owns the project experience and limited built-in circuit tools. Specialist open-source applications remain independent processes with their own licences.</p><p>The planned desktop bridge will detect installed tools, translate project data, execute them safely and return results to this interface.</p>'); }
export function showCommandPalette() {
  showModal('Command palette', `<div class="command-list">${modules.map((item) => `<button data-command-module="${item.id}"><span>${item.icon}</span>${item.name}<kbd>OPEN</kbd></button>`).join('')}<button data-command-diagnostics><span>⚕</span>Diagnostics and feedback<kbd>OPEN</kbd></button></div>`);
  document.querySelector('[data-command-diagnostics]')?.addEventListener('click', showDiagnostics);
  document.querySelectorAll('[data-command-module]').forEach((button) => button.addEventListener('click', () => setState({ activeModule: button.dataset.commandModule })));
}
