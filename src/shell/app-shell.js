// Application frame: top bar with project name and save status, module navigation, the active
// workspace, the assistant panel, toasts and the modal layer. render() replaces the page and then
// re-binds events (see shell-events.js).
import { modules } from '../data/modules.js';
import { esc } from '../shared/escaping.js';
import { getState } from '../core/store.js';
import { desktopBridge } from '../core/desktop-bridge.js';
import { renderAssistant } from './assistant.js';
import { bindEvents } from './shell-events.js';
import { renderWorkspace } from './navigation.js';

const app = document.querySelector('#app');

export function render() {
  const state = getState();
  const active = modules.find((item) => item.id === state.activeModule) || modules[0];
  document.documentElement.dataset.theme = state.project.settings.theme;
  app.innerHTML = `
    <div class="app-shell">
      <button class="skip-link" data-action="skip-to-main">Skip to the lab</button>
      <header class="topbar">
        <button class="brand" data-action="home" aria-label="Open Mission control">
          <span class="brand-mark"><i></i><i></i><i></i></span>
          <span><b>OpenENTC</b><small>STUDIO / ALPHA 01</small></span>
        </button>
        <div class="project-title">
          <span class="status-dot"></span>
          <input data-field="project-name" value="${esc(state.project.name)}" aria-label="Project name">
          <span class="saved ${state.persistence?.status === 'error' ? 'error' : ''}" title="${esc(state.persistence?.error || (state.persistence?.status === 'recovered' ? 'A migration backup was retained.' : 'Project is stored locally.'))}">${state.persistence?.status === 'error' ? 'Save failed' : state.persistence?.status === 'recovered' ? 'Recovered locally' : state.persistence?.status === 'unsaved' ? 'Not saved yet' : 'Saved locally'}</span>
        </div>
        <div class="top-actions">
          <button class="icon-button" data-action="command" title="Command palette (Ctrl+K)" aria-label="Open command palette">⌘</button>
          <button class="icon-button" data-action="theme" title="Change theme" aria-label="Change color theme">${state.project.settings.theme === 'dark' ? '☼' : '☾'}</button>
          <button class="button ghost" data-action="import">Import</button>
          <button class="button ghost" data-action="save-local" title="Save the current project in browser storage">Save locally</button>
          <button class="button ghost" data-action="desktop-open" ${desktopBridge.available ? '' : 'disabled'} title="${desktopBridge.available ? 'Open a project directory in the desktop shell' : 'Unavailable in browser preview'}">Open desktop</button>
          <button class="button ghost" data-action="desktop-save" ${desktopBridge.available ? '' : 'disabled'} title="${desktopBridge.available ? 'Save the current project to the opened desktop directory' : 'Unavailable in browser preview'}">Save desktop</button>
          <button class="button primary" data-action="export">Export project</button>
        </div>
      </header>
      <aside class="sidebar">
        <nav aria-label="Engineering modules">
          ${modules.map((item) => `<button class="nav-item ${item.id === state.activeModule ? 'active' : ''}" data-module="${item.id}" style="--module:${item.color}" title="${item.name}"><span>${item.icon}</span><small>${item.short}</small></button>`).join('')}
        </nav>
        <button class="nav-item" data-action="help" title="About and shortcuts"><span>?</span><small>Help</small></button>
      </aside>
      <main class="workspace" id="main-content" tabindex="-1" style="--active-color:${active.color}">
        ${renderWorkspace(state, active)}
      </main>
      ${renderAssistant(state)}
      ${state.toast ? `<div class="toast ${state.toast.tone}" role="${state.toast.tone === 'error' ? 'alert' : 'status'}" aria-live="${state.toast.tone === 'error' ? 'assertive' : 'polite'}"><span>${state.toast.tone === 'success' ? '✓' : state.toast.tone === 'error' ? '!' : 'i'}</span>${esc(state.toast.message)}</div>` : ''}
      <div class="modal-layer" hidden></div>
    </div>`;
  bindEvents();
}
