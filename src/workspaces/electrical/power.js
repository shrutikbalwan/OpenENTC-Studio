// Power Electronics workspace. Entry points: renderPower(state); bindPowerEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment } from '../../core/store.js';
import { decimate, niceRange } from '../../core/circuit-plot.js';
import { formatEngineeringValue } from '../../../packages/schematic/src/units.mjs';
import { CONVERTERS, INVERTERS, RECTIFIERS, simulateAcController, simulateConverter, simulateInverter, simulateRectifier } from '../../../packages/power/src/index.mjs';
import { eng } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { comparisonRow, comparisonTable } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const POWER_TABS = [['rectifier', 'Rectifiers'], ['dcdc', 'DC-DC converters'], ['inverter', 'Inverters'], ['ac', 'AC voltage controller']];
const POWER_DEFAULTS = Object.freeze({
  tab: 'rectifier',
  rectifier: { type: 'full-bridge', controlled: 'scr', alpha: 30, vrms: 230, frequency: 50, r: 10, l: 0.1, e: 0, c: 0 },
  dcdc: { type: 'buck', vin: 24, duty: 0.5, frequency: 50e3, l: 100e-6, c: 100e-6, r: 10 },
  inverter: { mode: 'spwm-bipolar', vdc: 400, frequency: 50, ma: 0.8, mf: 21, width: 120, r: 10, l: 0.02 },
  ac: { vrms: 230, frequency: 50, alpha: 60, r: 10, l: 0 },
});
let powerCache = { key: null, value: null };
function powerConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'power-lab')?.inputs || {};
  const merged = structuredClone(POWER_DEFAULTS);
  if (saved.tab) merged.tab = saved.tab;
  for (const key of ['rectifier', 'dcdc', 'inverter', 'ac']) Object.assign(merged[key], saved[key] || {});
  return merged;
}
function persistPower(update) { const config = powerConfiguration(getState()); update(config); recordExperiment({ id: 'power-lab', kind: 'power', operation: 'power-lab', inputs: config }); }
function powerCompute(config) {
  const key = JSON.stringify([config.tab, config[config.tab]]);
  if (powerCache.key === key) return powerCache.value;
  let value;
  try {
    const c = config[config.tab];
    if (config.tab === 'rectifier') value = simulateRectifier({ type: c.type, controlled: c.controlled === 'scr', alpha: c.alpha, vm: c.vrms * Math.SQRT2, frequency: c.frequency, r: c.r, l: c.l, e: c.e, c: c.c });
    else if (config.tab === 'dcdc') value = simulateConverter(c);
    else if (config.tab === 'inverter') value = simulateInverter(c);
    else value = simulateAcController({ vm: c.vrms * Math.SQRT2, frequency: c.frequency, alpha: c.alpha, r: c.r, l: c.l });
  } catch (error) { value = { error: error.message }; }
  powerCache = { key, value };
  return value;
}
const powerField = (path, label, value, unit = '') => `<label>${label}<input type="text" spellcheck="false" data-power-field="${path}" value="${esc(unit && unit !== '°' ? formatEngineeringValue(Number(value), '', { digits: 4 }).trim() : String(Number(Number(value).toPrecision(6))))}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const powerSelect = (path, label, value, options) => labSelect('data-power-select', path, label, value, options);
const degreeTicks = () => Array.from({ length: 9 }, (_, k) => ({ position: k / 8, text: `${k * 45}°` }));
const timeTicks = (stop) => Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(stop * k / 5, 's') }));
const powerPlot = (title, xs, series, { xMin, xMax, xTicks, unit = 'V' }) => {
  const prepared = series.map((entry, index) => ({ ...decimate(xs, entry.values, 1600), color: entry.color ?? PLOT_COLORS[index], primary: index === 0, dashed: entry.dashed }));
  const values = prepared.flatMap((entry) => entry.ys);
  return `${renderPlotFrame({ title, series: prepared, xMin, xMax, xTicks, yRange: niceRange(Math.min(0, ...values), Math.max(0, ...values)), formatY: (value) => eng(value, unit) })}<div class="plot-legend">${series.map((entry, index) => `<span class="legend-chip" style="--chip:${entry.color ?? PLOT_COLORS[index]}">${esc(entry.name)}</span>`).join('')}</div>`;
};
const spectrumPlot = (title, list, unit) => {
  const xs = list.map((h) => h.order), ys = list.map((h) => h.amplitude);
  const last = xs.at(-1);
  return renderPlotFrame({ title, series: [{ xs, ys, color: PLOT_COLORS[2], stem: true }], xMin: 0, xMax: last, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: String(Math.round(last * k / 5)) })), yRange: niceRange(0, Math.max(...ys)), formatY: (value) => eng(value, unit) });
};
function renderPowerRectifier(c, result) {
  const three = RECTIFIERS[c.type]?.phases === 3;
  const controls = `${powerSelect('rectifier.type', 'Circuit', c.type, Object.entries(RECTIFIERS).map(([id, spec]) => [id, spec.label]))}${powerSelect('rectifier.controlled', 'Devices', c.controlled, [['scr', 'Thyristors (SCR)'], ['diode', 'Diodes']])}${c.controlled === 'scr' ? powerField('rectifier.alpha', 'Firing angle α', c.alpha, '°') : ''}${powerField('rectifier.vrms', three ? 'Phase voltage (RMS)' : 'Supply voltage (RMS)', c.vrms, 'V')}${powerField('rectifier.frequency', 'Frequency', c.frequency, 'Hz')}${powerField('rectifier.r', 'Load R', c.r, 'Ω')}${powerField('rectifier.l', 'Load L', c.l, 'H')}${powerField('rectifier.e', 'Back EMF E', c.e, 'V')}${c.controlled === 'diode' && !three ? powerField('rectifier.c', 'Filter C', c.c, 'F') : ''}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Rectifier</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, xs = w.theta.map((theta) => theta * 180 / Math.PI);
  const sources = three ? [0, 1, 2].map((p) => ({ name: `v${'abc'[p]}`, values: w.phases.map((v) => v[p]), color: ['#64748b', '#94a3b8', '#cbd5e1'][p], dashed: true })) : [{ name: 'vs', values: w.vs, color: '#64748b', dashed: true }];
  const voltagePlot = powerPlot('Output voltage', xs, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }, ...sources], { xMin: 0, xMax: 360, xTicks: degreeTicks() });
  const currentPlot = powerPlot('Currents', xs, [{ name: 'io (load)', values: w.io, color: PLOT_COLORS[1] }, { name: three ? 'ia (supply)' : 'is (supply)', values: w.is, color: PLOT_COLORS[3] }], { xMin: 0, xMax: 360, xTicks: degreeTicks(), unit: 'A' });
  const devicePlot = powerPlot('Voltage across T1 / D1', xs, [{ name: 'vT1', values: w.vt, color: PLOT_COLORS[4] }], { xMin: 0, xMax: 360, xTicks: degreeTicks() });
  const t = result.theory;
  const table = comparisonTable([
    comparisonRow('Average output voltage Vdc', result.vdc, t.vdc, 'V'), comparisonRow('RMS output voltage', result.vrms, t.vrms, 'V'), comparisonRow('Output ripple (peak-peak)', result.ripple, t.ripple, 'V'),
    comparisonRow('Average load current', result.idc, null, 'A'), comparisonRow('RMS load current', result.irms, null, 'A'), comparisonRow('Form factor', result.formFactor, null, ''), comparisonRow('Ripple factor', result.rippleFactor, null, ''),
    comparisonRow('Load power', result.loadPower, null, 'W'), comparisonRow('Input power factor', result.inputPowerFactor, null, ''), comparisonRow('Displacement factor cos φ1', result.displacementFactor, null, ''), comparisonRow('Supply-current THD', result.currentThd, null, '%'),
  ], `${t.note ?? ''}${result.continuous === false ? ' Load current is discontinuous.' : result.continuous ? ' Load current is continuous.' : ''}`);
  return { controls, body: `<div class="power-grid"><div>${voltagePlot}${currentPlot}${devicePlot}</div><div>${table}${spectrumPlot(`Supply-current harmonics (peak, ${three ? 'phase a' : 'line'})`, result.sourceHarmonics, 'A')}</div></div>` };
}
function renderPowerConverter(c, result) {
  const controls = `${powerSelect('dcdc.type', 'Converter', c.type, Object.entries(CONVERTERS))}${powerField('dcdc.vin', 'Input voltage', c.vin, 'V')}${powerField('dcdc.duty', 'Duty cycle D', c.duty)}${powerField('dcdc.frequency', 'Switching frequency', c.frequency, 'Hz')}${powerField('dcdc.l', 'Inductor L', c.l, 'H')}${powerField('dcdc.c', 'Capacitor C', c.c, 'F')}${powerField('dcdc.r', 'Load R', c.r, 'Ω')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Converter</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, stop = w.t.at(-1);
  const t = result.theory;
  const table = comparisonTable([
    `<tr><td>Conduction mode</td><td>${result.mode}</td><td>${t.ccm ? 'CCM' : 'DCM'} (L${t.ccm ? ' ≥ ' : ' < '}Lcrit = ${esc(eng(t.criticalL, 'H'))})</td><td></td></tr>`,
    comparisonRow('Output voltage Vo', result.vo, t.vo, 'V'), comparisonRow('Voltage ratio Vo/Vin', result.ratio, t.ratio, ''), comparisonRow('Inductor current ripple ΔiL', result.rippleI, t.rippleI, 'A'), comparisonRow('Output voltage ripple ΔVo', result.rippleV, t.rippleV, 'V'),
    comparisonRow('Average inductor current', result.ilAverage, t.il, 'A'), comparisonRow('Peak inductor / switch current', result.ilMax, null, 'A'), comparisonRow('Output power', result.outputPower, null, 'W'),
  ], 'Ideal switch and diode. Formulas: buck Vo = D·Vin, boost Vo = Vin/(1 − D), buck-boost Vo = −D·Vin/(1 − D) in CCM; DCM uses K = 2Lf/R.');
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Gate signal and switch voltage', w.t, [{ name: 'vsw (switch)', values: w.vsw, color: PLOT_COLORS[4] }, { name: 'gate × Vin', values: w.gate.map((g) => g * c.vin), color: '#64748b', dashed: true }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}${powerPlot('Inductor, switch and diode current', w.t, [{ name: 'iL', values: w.il, color: PLOT_COLORS[1] }, { name: 'i switch', values: w.isw, color: PLOT_COLORS[3], dashed: true }, { name: 'i diode', values: w.idiode, color: PLOT_COLORS[5], dashed: true }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop), unit: 'A' })}${powerPlot('Output voltage', w.t, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}</div><div>${table}</div></div>` };
}
function renderPowerInverter(c, result) {
  const spwm = c.mode.includes('spwm');
  const controls = `${powerSelect('inverter.mode', 'Inverter', c.mode, Object.entries(INVERTERS))}${powerField('inverter.vdc', 'DC link voltage', c.vdc, 'V')}${powerField('inverter.frequency', 'Output frequency', c.frequency, 'Hz')}${spwm ? `${powerField('inverter.ma', 'Modulation index ma', c.ma)}${powerField('inverter.mf', 'Frequency ratio mf', c.mf)}` : ''}${c.mode === 'quasi-square' ? powerField('inverter.width', 'Pulse width', c.width, '°') : ''}${powerField('inverter.r', 'Load R', c.r, 'Ω')}${powerField('inverter.l', 'Load L', c.l, 'H')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>Inverter</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, stop = 1 / c.frequency;
  const three = c.mode.startsWith('three');
  const t = result.theory;
  const count = Math.min(result.spectrum.length, spwm ? Math.max(25, Math.ceil(c.mf * 2.5)) : 25);
  const table = comparisonTable([
    comparisonRow(three ? 'Fundamental line voltage (peak)' : 'Fundamental output voltage (peak)', result.fundamentalPeak, t.fundamentalPeak, 'V'), comparisonRow('Fundamental (RMS)', result.fundamentalRms, t.fundamentalPeak ? t.fundamentalPeak / Math.SQRT2 : null, 'V'),
    comparisonRow('RMS output voltage', result.vrms, t.vrms, 'V'), comparisonRow('Voltage THD', result.voltageThd, t.thd, '%'), comparisonRow('Load-current THD', result.currentThd, null, '%'), comparisonRow(three ? 'Load power (per phase)' : 'Load power', result.loadPower, null, 'W'),
  ], `${t.note ?? ''} Load current computed as the steady-state response of R + jωL to every harmonic.`);
  const voltages = [{ name: three ? 'vab (line)' : 'vo', values: w.vo, color: PLOT_COLORS[0] }, ...(w.vphase ? [{ name: 'van (phase, star load)', values: w.vphase, color: PLOT_COLORS[2] }] : [])];
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Output voltage', w.t, voltages, { xMin: 0, xMax: stop, xTicks: timeTicks(stop) })}${powerPlot('Load current', w.t, [{ name: 'io', values: w.io, color: PLOT_COLORS[1] }], { xMin: 0, xMax: stop, xTicks: timeTicks(stop), unit: 'A' })}</div><div>${table}${spectrumPlot(`${three ? 'Line-voltage' : 'Output-voltage'} harmonics (peak) up to order ${count}`, result.spectrum.slice(0, count), 'V')}</div></div>` };
}
function renderPowerAc(c, result) {
  const controls = `${powerField('ac.vrms', 'Supply voltage (RMS)', c.vrms, 'V')}${powerField('ac.frequency', 'Frequency', c.frequency, 'Hz')}${powerField('ac.alpha', 'Firing angle α', c.alpha, '°')}${powerField('ac.r', 'Load R', c.r, 'Ω')}${powerField('ac.l', 'Load L', c.l, 'H')}`;
  if (result.error) return { controls, body: `<div class="diagnostic error"><b>AC controller</b><span>${esc(result.error)}</span></div>` };
  const w = result.waveform, xs = w.theta.map((theta) => theta * 180 / Math.PI);
  const table = comparisonTable([comparisonRow('RMS output voltage', result.vrms, result.theory.vrms, 'V'), comparisonRow('RMS current', result.irms, null, 'A'), comparisonRow('Load power', result.power, null, 'W'), comparisonRow('Input power factor', result.powerFactor, null, ''), comparisonRow('Current THD', result.currentThd, null, '%')], result.theory.note);
  return { controls, body: `<div class="power-grid"><div>${powerPlot('Output voltage', xs, [{ name: 'vo', values: w.vo, color: PLOT_COLORS[0] }, { name: 'vs', values: w.vs, color: '#64748b', dashed: true }], { xMin: 0, xMax: 360, xTicks: degreeTicks() })}${powerPlot('Load current', xs, [{ name: 'io', values: w.io, color: PLOT_COLORS[1] }], { xMin: 0, xMax: 360, xTicks: degreeTicks(), unit: 'A' })}</div><div>${table}${spectrumPlot('Current harmonics (peak)', result.harmonics, 'A')}</div></div>` };
}
export function renderPower(state) {
  const config = powerConfiguration(state);
  const result = powerCompute(config);
  const view = config.tab === 'dcdc' ? renderPowerConverter(config.dcdc, result) : config.tab === 'inverter' ? renderPowerInverter(config.inverter, result) : config.tab === 'ac' ? renderPowerAc(config.ac, result) : renderPowerRectifier(config.rectifier, result);
  return `<div class="page scroll-page power-page">${pageHeader(modules.find((item) => item.id === 'power'), 'POWER ELECTRONICS', '<span class="pill live"><i></i> IDEAL-SWITCH SIMULATION</span>')}
    ${labTabs(POWER_TABS, config.tab, 'data-power-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div>
    <p class="module-footnote">Ideal switches and diodes (no forward drop, instant turn-off) and no source inductance, so commutation is instantaneous — the same assumptions as the textbook formulas shown beside every result. A DCM buck converter matches ngspice to 0.02 %.</p></div>`;
}
const POWER_DEGREE_FIELDS = new Set(['rectifier.alpha', 'ac.alpha', 'inverter.width']);
export function bindPowerEvents() {
  document.querySelectorAll('[data-power-tab]').forEach((button) => button.addEventListener('click', () => persistPower((config) => { config.tab = button.dataset.powerTab; })));
  document.querySelectorAll('[data-power-field]').forEach((input) => input.addEventListener('change', () => {
    const [group, key] = input.dataset.powerField.split('.');
    let value;
    try { value = POWER_DEGREE_FIELDS.has(input.dataset.powerField) ? Number(input.value) : engineeringInput(input.value, input.closest('label')?.firstChild?.textContent || 'Value'); if (!Number.isFinite(value)) throw new RangeError('Enter a number.'); }
    catch (error) { notify(error.message, 'error'); return; }
    persistPower((config) => { config[group][key] = value; });
  }));
  document.querySelectorAll('[data-power-select]').forEach((select) => select.addEventListener('change', () => {
    const [group, key] = select.dataset.powerSelect.split('.');
    persistPower((config) => { config[group][key] = select.value; if (group === 'rectifier' && (key === 'controlled' || key === 'type')) { if (config.rectifier.controlled === 'scr' || RECTIFIERS[config.rectifier.type].phases === 3) config.rectifier.c = 0; } });
  }));
}
