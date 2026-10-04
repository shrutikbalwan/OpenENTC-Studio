// @ts-check
// Error presentation: one panel used by every laboratory. It shows the safe message, the recovery
// hint when the error has one, and an optional reset button. Messages are redacted and escaped.
import { toUserFacing } from '../../packages/errors/src/index.mjs';
import { esc } from '../shared/escaping.js';

/**
 * @param {unknown} error
 * @param {{ title: string, resetAttribute?: string, resetLabel?: string }} options
 */
export function renderErrorPanel(error, { title, resetAttribute = '', resetLabel = 'Reset this tab to its example' }) {
  const shown = toUserFacing(error);
  const recovery = /** @type {any} */ (error)?.recovery ? `<small class="error-recovery">${esc(shown.recovery)}</small>` : '';
  const reset = resetAttribute ? `<button class="button" ${resetAttribute}>${esc(resetLabel)}</button>` : '';
  return `<div class="diagnostic error"><b>${title}</b><span>${esc(shown.message)}</span>${recovery}${reset}</div>`;
}
