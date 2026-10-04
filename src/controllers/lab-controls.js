// @ts-check
// Laboratory state and event wiring: makeLab() keeps a lab's inputs in the project's experiment
// records; bindLabControls()/bindLabText() connect the data-<prefix>-* controls to it.
import { getState, recordExperiment } from '../core/store.js';
import { engineeringInput } from '../shared/parsing.js';
import { reportError } from '../services/errors.js';

/** @typedef {Record<string, any> & { tab: string }} LabConfig */
/** @typedef {{ configuration: (state: any) => LabConfig, persist: (update: (config: LabConfig) => void) => void, defaults: LabConfig }} Lab */

/**
 * @param {string} id experiment id stored in the project
 * @param {LabConfig} defaults example inputs per tab, plus the initial tab
 * @returns {Lab}
 */
export function makeLab(id, defaults) {
  /** @param {any} state */
  const configuration = (state) => {
    /** @type {Record<string, any>} */
    const saved = state.project.experiments.find((/** @type {any} */ experiment) => experiment?.id === id)?.inputs || {};
    const merged = structuredClone(defaults);
    if (saved.tab) merged.tab = saved.tab;
    for (const key of Object.keys(defaults)) if (key !== 'tab') Object.assign(merged[key], saved[key] || {});
    return merged;
  };
  /** @param {(config: LabConfig) => void} update */
  const persist = (update) => { const config = configuration(getState()); update(config); recordExperiment({ id, kind: 'calculator', operation: id, inputs: config }); };
  return { configuration, persist, defaults };
}
/** @param {string} prefix @param {Lab} lab @param {string[]} [stringKeys] select keys kept as strings */
export function bindLabControls(prefix, lab, stringKeys = []) {
  /** @param {string} selector */
  const all = (selector) => /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(selector));
  all(`[data-${prefix}-reset]`).forEach((button) => button.addEventListener('click', () => lab.persist((config) => { config[config.tab] = structuredClone(lab.defaults[config.tab]); })));
  all(`[data-${prefix}-tab]`).forEach((button) => button.addEventListener('click', () => lab.persist((config) => { config.tab = String(button.dataset[`${prefix}Tab`]); })));
  all(`[data-${prefix}-field]`).forEach((input) => input.addEventListener('change', () => {
    const [group, key] = String(input.dataset[`${prefix}Field`]).split('.');
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); } catch (error) { reportError(error); return; }
    lab.persist((config) => { config[group][key] = value; });
  }));
  all(`[data-${prefix}-select]`).forEach((select) => select.addEventListener('change', () => {
    const [group, key] = String(select.dataset[`${prefix}Select`]).split('.');
    lab.persist((config) => { config[group][key] = stringKeys.includes(key) || Number.isNaN(Number(select.value)) ? select.value : Number(select.value); });
  }));
}
/**
 * @param {string} prefix @param {Lab} lab
 * @param {((config: LabConfig, group: string, key: string) => void) | null} [after]
 */
export function bindLabText(prefix, lab, after = null) {
  /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(`[data-${prefix}-text]`)).forEach((input) => input.addEventListener('change', () => {
    const [group, key] = String(input.dataset[`${prefix}Text`]).split('.');
    lab.persist((config) => { config[group][key] = input.value; after?.(config, group, key); });
  }));
}
