// Readouts and tables. Every interpolated value is escaped.
import { esc } from '../shared/escaping.js';
import { eng, fmt } from '../shared/formatting.js';

export const readout = (label, value) => `<div class="result-value"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
export const comparisonRow = (label, simulated, theory, unit, digits = 4) => `<tr><td>${esc(label)}</td><td>${simulated === null || simulated === undefined || !Number.isFinite(simulated) ? '—' : esc(unit === '%' ? `${fmt(simulated * 100, 2)} %` : unit ? eng(simulated, unit) : fmt(simulated, digits))}</td><td>${theory === null || theory === undefined || !Number.isFinite(theory) ? '—' : esc(unit === '%' ? `${fmt(theory * 100, 2)} %` : unit ? eng(theory, unit) : fmt(theory, digits))}</td><td>${Number.isFinite(simulated) && Number.isFinite(theory) && Math.abs(theory) > 1e-12 ? `${fmt((simulated - theory) / Math.abs(theory) * 100, 2)} %` : ''}</td></tr>`;
export const comparisonTable = (rows, note) => `<table class="truth-table comm-table power-table"><thead><tr><th>Quantity</th><th>Simulated</th><th>Formula</th><th>Difference</th></tr></thead><tbody>${rows.join('')}</tbody></table>${note ? `<p class="field-help">${esc(note)}</p>` : ''}`;
export const simpleTable = (headers, rows) => `<table class="truth-table comm-table power-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
