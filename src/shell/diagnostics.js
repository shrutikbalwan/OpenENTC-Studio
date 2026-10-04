// Diagnostics centre: what the app knows about its own health (storage, offline cache, recent
// errors, external tools) and a redacted report the user can read before copying or downloading
// it. Nothing is sent anywhere; "Report a problem" only opens the issue page.
import { createDiagnosticReport } from '../../packages/errors/src/index.mjs';
import { APP_CHANNEL, APP_VERSION, ISSUES_URL } from '../data/app-info.js';
import { engines } from '../core/engine-registry.js';
import { getState, notify } from '../core/store.js';
import { desktopBridge } from '../core/desktop-bridge.js';
import { esc, safeUrl } from '../shared/escaping.js';
import { clearRecentErrors, recentErrors, reportError } from '../services/errors.js';
import { showModal } from '../components/dialogs.js';
import { loadAssistantSettings } from '../core/credentials.js';

function assistantSummary() {
  try { const { settings, apiKey } = loadAssistantSettings(localStorage, sessionStorage); return { provider: settings.provider, apiKey, consented: settings.consented }; } catch { return {}; }
}

/** Build the redacted report from the current state. */
function buildDiagnostics() {
  const state = getState();
  return createDiagnosticReport({
    app: { version: APP_VERSION, build: APP_CHANNEL },
    environment: {
      userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, online: navigator.onLine,
      desktop: desktopBridge.available,
      serviceWorker: !('serviceWorker' in navigator) ? 'unsupported' : navigator.serviceWorker.controller ? 'controlling' : 'not controlling',
    },
    project: state.project,
    persistence: state.persistence,
    errors: recentErrors(),
    toolchains: engines.map((engine) => ({ id: engine.id, detected: ['built-in', 'integrated', 'interoperable'].includes(engine.status), version: engine.version })),
    assistant: assistantSummary(),
  });
}

const row = (label, value) => `<div class="diag-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

export function showDiagnostics() {
  const report = /** @type {any} */ (buildDiagnostics());
  const errors = report.recentErrors.length
    ? `<ol class="diag-errors">${report.recentErrors.slice().reverse().map((entry) => `<li><code>${esc(entry.code)}</code> ${esc(entry.message)}${entry.recovery ? `<small>What to try: ${esc(entry.recovery)}</small>` : ''}</li>`).join('')}</ol>`
    : '<p class="diag-empty">No errors in this session.</p>';
  const json = JSON.stringify(report, null, 2);
  showModal('Diagnostics and feedback', `<div class="diagnostics" data-diagnostics>
    <section aria-labelledby="diag-health"><h3 id="diag-health">Health</h3>
      ${row('Version', `${report.app.version} (${report.app.build})`)}
      ${row('Project storage', report.persistence.status === 'error' ? `Error: ${report.persistence.error}` : report.persistence.status || 'unknown')}
      ${row('Offline cache', report.environment.serviceWorker)}
      ${row('Network', report.environment.online ? 'online' : 'offline')}
      ${row('Desktop features', report.environment.desktop ? 'available' : 'browser preview (no native tools)')}
      ${row('External tools detected', `${report.toolchains.filter((tool) => tool.detected).length} of ${report.toolchains.length}`)}
    </section>
    <section aria-labelledby="diag-errors"><h3 id="diag-errors">Recent errors</h3>${errors}</section>
    <section aria-labelledby="diag-report"><h3 id="diag-report">Diagnostic report</h3>
      <p>This is everything the report contains. Keys, passwords, file paths, e-mail addresses and project content are removed. Read it before you share it.</p>
      <pre class="diag-json" tabindex="0" aria-label="Diagnostic report preview" data-diag-json>${esc(json)}</pre>
      <div class="diag-actions"><button class="button" data-diag="copy">Copy report</button><button class="button" data-diag="download">Download report</button><button class="button ghost" data-diag="clear">Clear recent errors</button><a class="button ghost" href="${safeUrl(ISSUES_URL)}" target="_blank" rel="noopener noreferrer">Report a problem ↗</a></div>
    </section>
  </div>`);
  document.querySelector('[data-diag="copy"]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(json); notify('Diagnostic report copied', 'success'); } catch (error) { reportError(error, { fallback: 'Could not copy the report; select the text and copy it instead' }); }
  });
  document.querySelector('[data-diag="download"]')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = `openentc-diagnostics-${report.generatedAt.slice(0, 10)}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  });
  document.querySelector('[data-diag="clear"]')?.addEventListener('click', () => { clearRecentErrors(); showDiagnostics(); });
}
