// Page and card layout shared by the workspaces, including the per-tab error panel.
import { esc } from '../shared/escaping.js';
import { labTabs } from './forms.js';

export function pageHeader(module, eyebrow, actions = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${module.name}</h1><p>${module.description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
/** Error panel with a button that restores the current tab's example inputs. */
export const labError = (prefix, title, error) => `<div class="diagnostic error"><b>${title}</b><span>${esc(error.message)}</span><button class="button" data-${prefix}-reset>Reset this tab to its example</button></div>`;
export const labCard = (prefix, title, tabs, config, renderTab) => {
  let view;
  try { view = renderTab(config); } catch (error) { view = { controls: '', body: labError(prefix, title, error) }; }
  return `${labTabs(tabs, config.tab, `data-${prefix}-tab`)}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>`;
};
