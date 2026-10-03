// Laboratory state and event wiring: makeLab() keeps a lab's inputs in the project's experiment
// records; bindLabControls()/bindLabText() connect the data-<prefix>-* controls to it.
import { getState, notify, recordExperiment } from '../core/store.js';
import { engineeringInput } from '../shared/parsing.js';

export function makeLab(id, defaults) {
  const configuration = (state) => {
    const saved = state.project.experiments.find((experiment) => experiment?.id === id)?.inputs || {};
    const merged = structuredClone(defaults);
    if (saved.tab) merged.tab = saved.tab;
    for (const key of Object.keys(defaults)) if (key !== 'tab') Object.assign(merged[key], saved[key] || {});
    return merged;
  };
  const persist = (update) => { const config = configuration(getState()); update(config); recordExperiment({ id, kind: 'calculator', operation: id, inputs: config }); };
  return { configuration, persist, defaults };
}
export function bindLabControls(prefix, lab, stringKeys = []) {
  document.querySelectorAll(`[data-${prefix}-reset]`).forEach((button) => button.addEventListener('click', () => lab.persist((config) => { config[config.tab] = structuredClone(lab.defaults[config.tab]); })));
  document.querySelectorAll(`[data-${prefix}-tab]`).forEach((button) => button.addEventListener('click', () => lab.persist((config) => { config.tab = button.dataset[`${prefix}Tab`]; })));
  document.querySelectorAll(`[data-${prefix}-field]`).forEach((input) => input.addEventListener('change', () => {
    const [group, key] = input.dataset[`${prefix}Field`].split('.');
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); } catch (error) { notify(error.message, 'error'); return; }
    lab.persist((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll(`[data-${prefix}-select]`).forEach((select) => select.addEventListener('change', () => {
    const [group, key] = select.dataset[`${prefix}Select`].split('.');
    lab.persist((config) => { config[group][key] = stringKeys.includes(key) || Number.isNaN(Number(select.value)) ? select.value : Number(select.value); });
  }));
}
export function bindLabText(prefix, lab, after = null) {
  document.querySelectorAll(`[data-${prefix}-text]`).forEach((input) => input.addEventListener('change', () => {
    const [group, key] = input.dataset[`${prefix}Text`].split('.');
    lab.persist((config) => { config[group][key] = input.value; after?.(config, group, key); });
  }));
}
