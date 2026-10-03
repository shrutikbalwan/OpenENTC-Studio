// @ts-check
// Page and card layout shared by the workspaces, including the per-tab error panel.
import { labTabs } from './forms.js';
import { renderErrorPanel } from './errors.js';

/** @param {{ name: string, description: string }} module @param {string} eyebrow trusted HTML @param {string} [actions] trusted HTML */
export function pageHeader(module, eyebrow, actions = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${module.name}</h1><p>${module.description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
/** Error panel with a button that restores the current tab's example inputs. */
/** @param {string} prefix @param {string} title @param {unknown} error */
export const labError = (prefix, title, error) => renderErrorPanel(error, { title, resetAttribute: `data-${prefix}-reset` });
/**
 * @param {string} prefix @param {string} title @param {[string, string][]} tabs @param {{ tab: string }} config
 * @param {(config: any) => { controls: string, body: string }} renderTab
 */
export const labCard = (prefix, title, tabs, config, renderTab) => {
  let view;
  try { view = renderTab(config); } catch (error) { view = { controls: '', body: labError(prefix, title, error) }; }
  return `${labTabs(tabs, config.tab, `data-${prefix}-tab`)}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>`;
};
