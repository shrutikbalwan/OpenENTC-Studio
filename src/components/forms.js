// Form controls for laboratory panels. Field values are escaped; attribute names come from code.
import { esc } from '../shared/escaping.js';
import { numericText } from '../shared/formatting.js';

export const labSelect = (attribute, name, label, value, options) => `<label>${label}<select ${attribute}="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
export const labTabs = (tabs, active, attribute) => `<div class="logic-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${active === id}" class="${active === id ? 'active' : ''}" ${attribute}="${id}">${label}</button>`).join('')}</div>`;
export const groupField = (attribute) => (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" ${attribute}="${path}" value="${esc(numericText(value))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
export const labText = (prefix) => (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-${prefix}-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-${prefix}-text="${path}" value="${esc(value)}"></label>`);
