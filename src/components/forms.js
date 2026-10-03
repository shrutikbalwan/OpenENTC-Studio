// @ts-check
// Form controls for laboratory panels. Field values are escaped; attribute names come from code.
import { esc } from '../shared/escaping.js';
import { numericText } from '../shared/formatting.js';

/** @typedef {string | number} Scalar */
/**
 * @param {string} attribute data attribute name (from code) @param {string} name @param {string} label trusted label HTML
 * @param {Scalar} value @param {[Scalar, string][]} options
 */
export const labSelect = (attribute, name, label, value, options) => `<label>${label}<select ${attribute}="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
/** @param {[string, string][]} tabs [id, trusted label] @param {string} active @param {string} attribute */
export const labTabs = (tabs, active, attribute) => `<div class="logic-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${active === id}" class="${active === id ? 'active' : ''}" ${attribute}="${id}">${label}</button>`).join('')}</div>`;
/** @param {string} attribute @returns {(path: string, label: string, value: number, unit?: string) => string} */
export const groupField = (attribute) => (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" ${attribute}="${path}" value="${esc(numericText(value))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
/** @param {string} prefix @returns {(path: string, label: string, value: string, rows?: number) => string} */
export const labText = (prefix) => (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-${prefix}-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-${prefix}-text="${path}" value="${esc(value)}"></label>`);

/**
 * @param {string} attribute @param {string} name @param {string} label trusted label HTML @param {Scalar} value
 * @param {string} [unit] @param {string} [attributes] extra input attributes (from code)
 */
export const labField = (attribute, name, label, value, unit = '', attributes = 'type="number" step="any"') => `<label>${label}<input ${attributes} ${attribute}="${name}" value="${esc(value)}">${unit ? `<span>${unit}</span>` : ''}</label>`;
