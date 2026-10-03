// OpenENTC Studio browser entry point (composition only).
// The shell (src/shell) renders the frame and routes to workspaces (src/workspaces/<area>/<module>.js);
// shared UI pieces live in src/components, src/controllers, src/shared, src/state and src/services.
// This file wires global listeners (project import, keyboard shortcuts), starts rendering and
// registers the service worker. See docs/architecture/ui-modules.md.
import { importProjectFile } from './core/project-file.js';
import { getState, subscribe, notify, replaceProject, undoProject, redoProject } from './core/store.js';
import { rerender, setRenderer } from './services/render.js';
import { copySelected, deleteSelected, moveSelected, pasteCopied, rotateSelected } from './workspaces/circuit/circuit.js';
import { closeNativeSessionForBrowserProject } from './services/desktop-project.js';
import { assistantStartup } from './shell/assistant.js';
import { showCommandPalette } from './shell/command-palette.js';
import { importInput } from './shell/shell-events.js';
import { render } from './shell/app-shell.js';
import { reportError } from './services/errors.js';

importInput.addEventListener('change', async () => {
  try {
    const file = importInput.files[0];
    if (!file) return;
    const imported = await importProjectFile(file);
    if (!await closeNativeSessionForBrowserProject()) return;
    replaceProject(imported);
    notify('Project imported', 'success');
  }
  catch (error) { reportError(error, { fallback: 'Could not import project' }); }
  importInput.value = '';
});

window.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const current = getState();
  if (current.activeModule === 'circuit' && current.selectedComponentId && !typing) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) { event.preventDefault(); const step = current.project.settings.grid ? current.project.settings.gridSize : 10; moveSelected(key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0); return; }
    if (key === 'r' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); rotateSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'c') { event.preventDefault(); copySelected(); return; }
    if ((event.ctrlKey || event.metaKey) && key === 'v') { event.preventDefault(); pasteCopied(); return; }
    if (key === 'delete' || key === 'backspace') { event.preventDefault(); deleteSelected(); return; }
  }
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'k') { event.preventDefault(); showCommandPalette(); }
    if (key === 'z') { event.preventDefault(); if (event.shiftKey ? redoProject() : undoProject()) notify(event.shiftKey ? 'Project change redone' : 'Project change undone', 'info'); }
    if (key === 'y') { event.preventDefault(); if (redoProject()) notify('Project change redone', 'info'); }
  }
});

setRenderer(render);
subscribe(render);
rerender();
if (assistantStartup.removedLegacyKey) notify('An AI API key saved by an older version was removed from browser storage. Enter it again when you use the assistant.', 'info');

// Offline support: register the service worker in a normal browser (not in the desktop shell,
// which already has every file locally). The first visit caches the studio for offline use.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !globalThis.__TAURI__) {
  window.addEventListener('load', () => {
    const firstInstall = !navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      if (!firstInstall) return;
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'activated') notify('OpenENTC Studio is saved on this device and now works offline.', 'success'); });
      });
    }).catch(() => {});
  });
  window.addEventListener('offline', () => notify('You are offline — everything keeps working from the saved copy.', 'info'));
}
