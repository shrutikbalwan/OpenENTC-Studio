// ADC & DAC Lab workspace. Entry points: renderAdcLab(state); bindAdcEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment } from '../../core/store.js';
import { decimate, niceRange } from '../../core/circuit-plot.js';
import { adcCode, adcThresholds, dualSlope, dynamicTest, flashConvert, integratingRejection, linearity, r2rDac, sarConvert, sigmaDelta, weightedDac } from '../../../packages/converters/src/index.mjs';
import { binary, eng, fmt } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { comparisonRow, comparisonTable, readout } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const ADC_TABS = [['quantise', 'Transfer, DNL/INL & SNR'], ['sar', 'SAR'], ['flash', 'Flash'], ['dual', 'Dual-slope'], ['sigma', 'Sigma-delta'], ['dac', 'DAC']];
const ADC_DEFAULTS = Object.freeze({
  tab: 'quantise',
  quantise: { bits: 8, vref: 5, offsetLsb: 0, gainErrorPercent: 0, bowLsb: 0, mismatchLsb: 0, noiseLsb: 0, seed: 1 },
  sar: { bits: 8, vref: 5, vin: 3.3 }, flash: { bits: 3, vref: 5, vin: 3.3 },
  dual: { bits: 12, vref: 2, vin: 1.234, clock: 204_800, r: 100e3, c: 1e-6 },
  sigma: { order: 2, osr: 64, amplitude: 0.5 },
  dac: { kind: 'r2r', bits: 8, vref: 5, tolerancePercent: 1, seed: 4, code: 128 },
});
let adcCache = { key: null, value: null };
function adcConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'adc-lab')?.inputs || {};
  const merged = structuredClone(ADC_DEFAULTS);
  if (saved.tab) merged.tab = saved.tab;
  for (const key of Object.keys(ADC_DEFAULTS)) if (key !== 'tab') Object.assign(merged[key], saved[key] || {});
  return merged;
}
function persistAdc(update) { const config = adcConfiguration(getState()); update(config); recordExperiment({ id: 'adc-lab', kind: 'converter', operation: 'adc-lab', inputs: config }); }
const adcField = (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" data-adc-field="${path}" value="${esc(String(Number(Number(value).toPrecision(6))))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const adcSelect = (path, label, value, options) => labSelect('data-adc-select', path, label, value, options);
const indexTicks5 = (last) => Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: String(Math.round(last * k / 5)) }));
const adcPlot = (title, xs, ys, { color = PLOT_COLORS[0], stem = false, unit = '', xMin = xs[0], xMax = xs.at(-1), xTicks = indexTicks5(xMax), extra = [], yMin = null, yMax = null } = {}) => {
  const series = [{ ...(stem ? { xs, ys } : decimate(xs, ys, 1600)), color, primary: true, stem }, ...extra.map((entry) => ({ ...decimate(entry.xs, entry.ys, 1600), color: entry.color, dashed: entry.dashed }))];
  const values = series.flatMap((entry) => entry.ys).filter(Number.isFinite);
  return renderPlotFrame({ title, series, xMin, xMax, xTicks, yRange: niceRange(yMin ?? Math.min(...values), yMax ?? Math.max(...values)), formatY: (value) => (unit ? eng(value, unit) : fmt(value, 3)) });
};
function renderAdcQuantise(c) {
  const adc = adcThresholds(c);
  const lin = linearity(adc);
  const dyn = dynamicTest(adc, { n: 8192, noiseLsb: c.noiseLsb });
  const levels = 2 ** c.bits;
  const shown = Math.min(levels, 64);
  const xs = [], ys = [];
  for (let k = 0; k <= shown * 8; k += 1) { const v = k / (shown * 8) * shown * adc.lsb; xs.push(v); ys.push(adcCode(adc, v)); }
  const codes = lin.dnl.map((_, k) => k + 1);
  const bins = dyn.spectrumDbfs.map((_, k) => k / 8192);
  const controls = `${adcField('quantise.bits', 'Resolution', c.bits, 'bit')}${adcField('quantise.vref', 'Reference', c.vref, 'V')}${adcField('quantise.offsetLsb', 'Offset', c.offsetLsb, 'LSB')}${adcField('quantise.gainErrorPercent', 'Gain error', c.gainErrorPercent, '%')}${adcField('quantise.bowLsb', 'Bow INL', c.bowLsb, 'LSB')}${adcField('quantise.mismatchLsb', 'Comparator mismatch σ', c.mismatchLsb, 'LSB')}${adcField('quantise.noiseLsb', 'Input noise σ', c.noiseLsb, 'LSB')}${adcField('quantise.seed', 'Random seed', c.seed)}`;
  const table = comparisonTable([
    comparisonRow('LSB size', adc.lsb, c.vref / levels, 'V'), comparisonRow('SNR', dyn.snr, dyn.idealSnr, ''), comparisonRow('SINAD', dyn.sinad, dyn.idealSnr, ''), comparisonRow('ENOB (bits)', dyn.enob, c.bits, ''),
    comparisonRow('SFDR (dBc)', dyn.sfdr, null, ''), comparisonRow('THD (dBc)', dyn.thd, null, ''), comparisonRow('Offset error (LSB)', lin.offsetLsb, null, ''), comparisonRow('Gain error (%)', lin.gainErrorPercent, null, ''),
    comparisonRow('Max |DNL| (LSB)', lin.maxDnl, 0, ''), comparisonRow('Max |INL| (LSB)', lin.maxInl, 0, ''), `<tr><td>Missing codes</td><td>${lin.missingCodes.length ? esc(lin.missingCodes.slice(0, 8).join(', ')) + (lin.missingCodes.length > 8 ? '…' : '') : 'none'}</td><td>none</td><td></td></tr>`,
  ], `Formula column: an ideal ADC, SNR = 6.02·N + 1.76 dB for a full-scale sine. Dynamic test: ${dyn.cycles} cycles of a 99.9 % full-scale sine coherently sampled in 8192 points. DNL/INL by the end-point method.`);
  return { controls, body: `<div class="power-grid"><div>${adcPlot(`Transfer function (first ${shown} codes)`, xs, ys, { unit: '', xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(shown * adc.lsb * k / 5, 'V') })) })}${adcPlot('DNL (LSB)', codes, lin.dnl, { stem: codes.length <= 256, color: PLOT_COLORS[3] })}${adcPlot('INL (LSB, end-point)', lin.inl.map((_, k) => k + 1), lin.inl, { color: PLOT_COLORS[4] })}</div><div>${table}${adcPlot('Output spectrum (dBFS) vs frequency / fs', bins, dyn.spectrumDbfs, { color: PLOT_COLORS[2], xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(k / 10, 2) })), yMin: Math.max(-160, Math.min(...dyn.spectrumDbfs)), yMax: 0 })}</div></div>` };
}
function renderAdcSar(c) {
  const result = sarConvert(c.vin, c);
  const controls = `${adcField('sar.vin', 'Input voltage', c.vin, 'V')}${adcField('sar.bits', 'Resolution', c.bits, 'bit')}${adcField('sar.vref', 'Reference', c.vref, 'V')}`;
  const rows = result.steps.map((step, index) => `<tr><td>${index + 1}</td><td>D${step.bit}</td><td>${binary(step.trial, c.bits)}</td><td>${esc(eng(step.dac, 'V'))}</td><td>${step.keep ? 'Vin ≥ DAC → keep 1' : 'Vin < DAC → clear to 0'}</td><td>${binary(step.code, c.bits)}</td></tr>`).join('');
  const xs = result.steps.flatMap((_, k) => [k, k + 1]), ys = result.steps.flatMap((step) => [step.dac, step.dac]);
  return { controls, body: `<div class="power-grid"><div>${adcPlot('DAC trial voltage at each clock (dashed: Vin)', xs, ys, { unit: 'V', xMin: 0, xMax: c.bits, xTicks: Array.from({ length: c.bits + 1 }, (_, k) => ({ position: k / c.bits, text: String(k) })), extra: [{ xs: [0, c.bits], ys: [c.vin, c.vin], color: '#94a3b8', dashed: true }], yMin: 0, yMax: c.vref })}</div><div><table class="truth-table comm-table power-table"><thead><tr><th>Clock</th><th>Bit tried</th><th>Trial code</th><th>DAC voltage</th><th>Comparator</th><th>Register</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="analysis-readouts">${readout('Result', `${result.code} = ${binary(result.code, c.bits)}₂ = ${result.code.toString(16).toUpperCase()}h`)}${readout('DAC value of result', eng(result.voltage, 'V'))}${readout('Conversion time', `${result.clocks} clocks`)}${readout('Quantisation error', eng(c.vin - result.voltage, 'V'))}</div><p class="field-help">The SAR tries each bit from the MSB down: the bit stays 1 if the input is at least the DAC voltage. An N-bit conversion always takes N comparisons.</p></div></div>` };
}
function renderAdcFlash(c) {
  const bits = Math.min(6, Math.max(1, Math.round(c.bits)));
  const result = flashConvert(c.vin, { bits, vref: c.vref });
  const controls = `${adcField('flash.vin', 'Input voltage', c.vin, 'V')}${adcField('flash.bits', 'Resolution (≤ 6 shown)', bits, 'bit')}${adcField('flash.vref', 'Reference', c.vref, 'V')}`;
  const rows = result.references.map((reference, k) => ({ k, reference, out: result.thermometer[k] })).reverse().map(({ k, reference, out }) => `<tr class="${out ? 'on' : ''}"><td>C${k + 1}</td><td>${esc(eng(reference, 'V'))}</td><td>${out}</td></tr>`).join('');
  return { controls, body: `<div class="power-grid"><div><table class="truth-table comm-table power-table flash-table"><thead><tr><th>Comparator</th><th>Reference (ladder tap)</th><th>Output</th></tr></thead><tbody>${rows}</tbody></table></div><div class="analysis-readouts">${readout('Thermometer code', result.thermometer.slice().reverse().join(''))}${readout('Binary output', `${result.code} = ${binary(result.code, bits)}₂`)}${readout('Comparators', String(result.comparators))}${readout('Ladder resistors', String(result.resistors))}${readout('Conversion', 'one clock (all comparators in parallel)')}<p class="field-help">The ladder (R/2 at the bottom) puts the comparator thresholds at (k − ½)·LSB, so the flash ADC rounds to the nearest code. Comparators grow as 2ᴺ − 1: 255 for 8 bits.</p></div></div>` };
}
function renderAdcDual(c) {
  const result = dualSlope(Math.min(c.vref, Math.max(0, c.vin)), c);
  const controls = `${adcField('dual.vin', 'Input voltage', c.vin, 'V')}${adcField('dual.vref', 'Reference', c.vref, 'V')}${adcField('dual.bits', 'Counter', c.bits, 'bit')}${adcField('dual.clock', 'Clock', c.clock, 'Hz')}${adcField('dual.r', 'Integrator R', c.r, 'Ω')}${adcField('dual.c', 'Integrator C', c.c, 'F')}`;
  const frequencies = Array.from({ length: 401 }, (_, k) => k * 0.5);
  const rejection = frequencies.map((f) => 20 * Math.log10(Math.max(1e-6, integratingRejection(f, result.t1))));
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Integrator output', result.waveform.map(([t]) => t), result.waveform.map(([, v]) => v), { unit: 'V', xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(result.conversionTime * k / 5, 's') })) })}${adcPlot('Normal-mode rejection (dB) vs frequency (Hz)', frequencies, rejection, { color: PLOT_COLORS[3], xTicks: Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: String(k * 50) })), yMin: -60, yMax: 0 })}</div><div class="analysis-readouts">${readout('T1 (fixed, 2ᴺ clocks)', eng(result.t1, 's'))}${readout('Integrator peak', eng(result.peak, 'V'))}${readout('T2 (de-integrate)', eng(result.t2, 's'))}${readout('Count', `${result.count} of ${result.n1}`)}${readout('Result', eng(result.resultVoltage, 'V'))}${readout('Conversion time', eng(result.conversionTime, 's'))}<p class="field-help">Count = 2ᴺ·Vin/Vref: R, C and the clock frequency cancel out. With T1 = 20 ms, 50 Hz mains hum (and its harmonics) integrates to zero — the reason DMMs use integrating ADCs.</p></div></div>` };
}
function renderAdcSigma(c) {
  const result = sigmaDelta({ order: Number(c.order), osr: c.osr, amplitude: c.amplitude });
  const controls = `${adcSelect('sigma.order', 'Modulator order', c.order, [[1, 'First order'], [2, 'Second order']])}${adcField('sigma.osr', 'Oversampling ratio', c.osr)}${adcField('sigma.amplitude', 'Input amplitude', c.amplitude, '× FS')}`;
  const shown = 256, start = 0;
  const idx = Array.from({ length: shown }, (_, k) => start + k);
  const input = idx.map((k) => c.amplitude * Math.sin(2 * Math.PI * result.cycles * k / result.bitstream.length));
  const half = result.spectrumDb.length;
  const xs = result.spectrumDb.map((_, k) => k / (2 * (half - 1)));
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Bitstream (first 256 samples) and input', idx, idx.map((k) => result.bitstream[k]), { color: PLOT_COLORS[0], extra: [{ xs: idx, ys: input, color: PLOT_COLORS[2] }], yMin: -1.2, yMax: 1.2 })}${adcPlot('Decimated output (sinc filter, ÷ OSR)', result.decimated.map((s) => s.index), result.decimated.map((s) => s.value), { color: PLOT_COLORS[1], yMin: -1, yMax: 1 })}</div><div>${comparisonTable([comparisonRow('In-band SQNR (dB)', result.sqnr, result.theorySqnrFullScale + 20 * Math.log10(c.amplitude), ''), comparisonRow('Density of ones', result.ones, 0.5, ''), comparisonRow('Signal bin / band edge', result.cycles, result.bandEdgeBin, '')], `Formula: linear noise model (${c.order === 2 || Number(c.order) === 2 ? 'SQNR = 6.02 + 1.76 − 12.9 + 50·log OSR' : 'SQNR = 6.02 + 1.76 − 5.17 + 30·log OSR'}) for this input level; a real 1-bit loop falls a few dB short because the quantiser gain is not 1.`)}${adcPlot('Bitstream spectrum (dB) vs f / fs — noise is pushed out of band', xs, result.spectrumDb, { color: PLOT_COLORS[2], xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(k / 10, 2) })), extra: [{ xs: [0.5 / c.osr, 0.5 / c.osr], ys: [-180, 0], color: '#f97316', dashed: true }], yMin: -160, yMax: 0 })}</div></div>` };
}
function renderAdcDac(c) {
  const result = (c.kind === 'weighted' ? weightedDac : r2rDac)(c);
  const levels = result.levels.length;
  const code = Math.max(0, Math.min(levels - 1, Math.round(c.code)));
  const controls = `${adcSelect('dac.kind', 'Architecture', c.kind, [['r2r', 'R-2R ladder'], ['weighted', 'Binary-weighted resistors']])}${adcField('dac.bits', 'Resolution', c.bits, 'bit')}${adcField('dac.vref', 'Reference', c.vref, 'V')}${adcField('dac.tolerancePercent', 'Resistor tolerance', c.tolerancePercent, '%')}${adcField('dac.seed', 'Random seed', c.seed)}${adcField('dac.code', 'Digital input', code)}`;
  const codes = result.levels.map((_, k) => k);
  const xs = codes.flatMap((k) => [k, k + 1]), ys = result.levels.flatMap((v) => [v, v]);
  return { controls, body: `<div class="power-grid"><div>${adcPlot('Output voltage for every code', xs, ys, { unit: 'V', xMin: 0, xMax: levels })}${adcPlot('DNL (LSB)', codes.slice(1), result.dnl, { stem: levels <= 256, color: PLOT_COLORS[3] })}${adcPlot('INL (LSB)', codes, result.inl, { color: PLOT_COLORS[4] })}</div><div>${comparisonTable([comparisonRow(`Output for ${code} (${binary(code, c.bits)}₂)`, result.levels[code], code * c.vref / levels, 'V'), comparisonRow('Full-scale output', result.fullScale, (levels - 1) * c.vref / levels, 'V'), comparisonRow('LSB step', result.lsb, result.idealLsb, 'V'), comparisonRow('Max |DNL| (LSB)', result.maxDnl, 0, ''), comparisonRow('Max |INL| (LSB)', result.maxInl, 0, '')], `${result.kind}: ${result.resistorCount} resistors, value spread ${result.resistorSpread}:1. ${result.monotonic ? 'Monotonic.' : 'Not monotonic!'} Worst step at code ${result.worstStep} (a major carry). Vout = Vref·D / 2ᴺ when the resistors are exact.`)}</div></div>` };
}
export function renderAdcLab(state) {
  const config = adcConfiguration(state);
  const key = JSON.stringify([config.tab, config[config.tab]]);
  let view;
  if (adcCache.key === key) view = adcCache.value;
  else {
    try { const c = config[config.tab]; view = config.tab === 'sar' ? renderAdcSar(c) : config.tab === 'flash' ? renderAdcFlash(c) : config.tab === 'dual' ? renderAdcDual(c) : config.tab === 'sigma' ? renderAdcSigma(c) : config.tab === 'dac' ? renderAdcDac(c) : renderAdcQuantise(c); }
    catch (error) { view = { controls: '', body: `<div class="diagnostic error"><b>Converter</b><span>${esc(error.message)}</span><button class="button" data-adc-reset>Reset this tab to its example</button></div>` }; }
    adcCache = { key, value: view };
  }
  return `<div class="page scroll-page power-page adc-page">${pageHeader(modules.find((item) => item.id === 'adc'), 'DATA CONVERTERS', '<span class="pill live"><i></i> BIT-ACCURATE</span>')}
    ${labTabs(ADC_TABS, config.tab, 'data-adc-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
const ADC_INTEGER_FIELDS = new Set(['quantise.bits', 'quantise.seed', 'sar.bits', 'flash.bits', 'dual.bits', 'sigma.osr', 'dac.bits', 'dac.seed', 'dac.code']);
export function bindAdcEvents() {
  document.querySelectorAll('[data-adc-tab]').forEach((button) => button.addEventListener('click', () => persistAdc((config) => { config.tab = button.dataset.adcTab; })));
  document.querySelectorAll('[data-adc-reset]').forEach((button) => button.addEventListener('click', () => persistAdc((config) => { config[config.tab] = structuredClone(ADC_DEFAULTS[config.tab]); })));
  document.querySelectorAll('[data-adc-field]').forEach((input) => input.addEventListener('change', () => {
    const path = input.dataset.adcField;
    const [group, key] = path.split('.');
    let value;
    try { value = engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); } catch (error) { notify(error.message, 'error'); return; }
    if (ADC_INTEGER_FIELDS.has(path)) value = Math.round(value);
    if (path.endsWith('bits')) value = Math.min(path.startsWith('flash') ? 6 : path.startsWith('dual') ? 20 : path.startsWith('dac') ? 14 : 16, Math.max(1, value));
    if (path === 'sigma.osr') value = Math.min(512, Math.max(4, value));
    persistAdc((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll('[data-adc-select]').forEach((select) => select.addEventListener('change', () => { const [group, key] = select.dataset.adcSelect.split('.'); persistAdc((config) => { config[group][key] = key === 'order' ? Number(select.value) : select.value; }); }));
}
