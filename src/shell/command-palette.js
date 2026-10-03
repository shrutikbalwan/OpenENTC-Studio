// Command palette (Ctrl+K), help and engine-information dialogs.
import { modules } from '../data/modules.js';
import { setState } from '../core/store.js';
import { showModal } from '../components/dialogs.js';

export function showHelp() { showModal('A unified ENTC workspace', '<p>OpenENTC Studio keeps circuit, firmware, board and communication work in one local project.</p><div class="shortcut-list"><span>Command palette</span><kbd>Ctrl K</kbd><span>Run circuit analysis</span><kbd>Circuit → Run</kbd><span>Move component</span><kbd>Drag</kbd><span>Edit component</span><kbd>Select</kbd></div>'); }
export function showEngineInfo() { showModal('How engine connectors work', '<p>OpenENTC owns the project experience and limited built-in circuit tools. Specialist open-source applications remain independent processes with their own licences.</p><p>The planned desktop bridge will detect installed tools, translate project data, execute them safely and return results to this interface.</p>'); }
export function showCommandPalette() {
  showModal('Command palette', `<div class="command-list">${modules.map((item) => `<button data-command-module="${item.id}"><span>${item.icon}</span>${item.name}<kbd>OPEN</kbd></button>`).join('')}</div>`);
  document.querySelectorAll('[data-command-module]').forEach((button) => button.addEventListener('click', () => setState({ activeModule: button.dataset.commandModule })));
}
