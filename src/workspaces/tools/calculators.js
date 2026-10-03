// Engineering Calculators workspace. Entry points: renderCalculators(state); bindCalculatorEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment } from '../../core/store.js';
import { niceRange } from '../../core/circuit-plot.js';
import { adcResolution, COLOR_BANDS, convertLevel, dbToRatio, decodeCapacitorCode, decodeResistorBands, decodeSmdResistor, design555Astable, E_SERIES, encodeResistorBands, ledResistor, nearestPreferred, OPAMP_CONFIGS, opampStage, POWER_UNITS, ratioToDb, rcFilter, reactance, rlcResonance, seriesParallel, solveOhm, timer555Astable, timer555Monostable, voltageDivider } from '../../../packages/calculators/src/index.mjs';
import { eng, finiteEng, fmt, ohms } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { linearTicks, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { labField, labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const CALC_DEFAULTS = Object.freeze({
  tab: 'resistor', bandCount: 4, bands: ['yellow', 'violet', 'red', 'gold', 'brown', 'brown'], encodeValue: '4.7k', series: 'E24', smdCode: '472', capCode: '104K',
  timerMode: 'astable', r1: '1k', r2: '10k', timerC: '10n', monoR: '100k', monoC: '10u', designF: '1k', designDuty: 0.6, designC: '10n',
  opampConfig: 'inverting', opR1: '10k', opR2: '100k', gbw: '1M', slew: '0.5M', vinPeak: 0.5, supply: 12,
  levelValue: 0, levelUnit: 'dBm', levelImpedance: 50, ratioValue: 2, dbValue: 3,
  ohmV: '12', ohmI: '', ohmR: '4', ohmP: '', spValues: '100 220 470', divVin: 12, divR1: '10k', divR2: '4.7k', divLoad: '',
  rlcR: '10', rlcL: '1m', rlcC: '1u', rcR: '1k', rcC: '100n', ledSupply: 5, ledVf: 2, ledI: '20m', adcBits: 10, adcRef: 5,
});
const CALC_TABS = [['resistor', 'Resistor & component codes'], ['timer', '555 timer'], ['opamp', 'Op-amp'], ['decibel', 'dB & power'], ['formulas', 'Circuit formulas']];
const CALC_NUMBER_FIELDS = ['bandCount', 'designDuty', 'vinPeak', 'supply', 'levelValue', 'levelImpedance', 'ratioValue', 'dbValue', 'divVin', 'ledSupply', 'ledVf', 'adcBits', 'adcRef'];
function calcConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'calc-lab')?.inputs || {};
  return { ...CALC_DEFAULTS, ...saved };
}
function persistCalc(patch) {
  recordExperiment({ id: 'calc-lab', kind: 'calculator', operation: 'calc-lab', inputs: { ...calcConfiguration(getState()), ...patch } });
}
const calcField = (name, label, value, unit = '', attributes = 'type="text" spellcheck="false" maxlength="24"') => labField('data-calc-field', name, label, value, unit, attributes);
const calcNumber = (name, label, value, unit = '', extra = 'step="any"') => labField('data-calc-field', name, label, value, unit, `type="number" ${extra}`);
const calcSelect = (...args) => labSelect('data-calc-field', ...args);
const calcBlock = (title, controls, render) => {
  let content;
  try { content = render(); } catch (error) { content = `<div class="diagnostic error"><b>${esc(title)}</b><span>${esc(error.message)}</span></div>`; }
  return `<div class="coding-block"><span class="panel-label">${esc(title.toUpperCase())}</span><div class="dsp-controls">${controls}</div>${content}</div>`;
};
const blankOr = (value, label) => (String(value).trim() === '' ? null : engineeringInput(value, label));
function renderResistorSvg(names) {
  const bodyStart = 70, bodyEnd = 290;
  const positions = names.length <= 4 ? [100, 128, 156, 240] : names.length === 5 ? [96, 120, 144, 168, 240] : [96, 118, 140, 162, 232, 258];
  return `<svg class="resistor-svg" viewBox="0 0 360 90" role="img" aria-label="Resistor colour bands"><line x1="10" y1="45" x2="350" y2="45" class="resistor-lead"/><rect x="${bodyStart}" y="20" width="${bodyEnd - bodyStart}" height="50" rx="22" class="resistor-body"/>${names.map((name, index) => { const entry = COLOR_BANDS.find((band) => band.name === name); return name === 'none' ? '' : `<rect x="${positions[index]}" y="20" width="12" height="50" fill="${entry.hex}" stroke="#0006"/>`; }).join('')}</svg>`;
}
function renderResistorTab(config) {
  const count = [3, 4, 5, 6].includes(Number(config.bandCount)) ? Number(config.bandCount) : 4;
  const digitCount = count >= 5 ? 3 : 2;
  const names = Array.from({ length: count }, (_, index) => config.bands[index] || 'brown');
  const roleOf = (index) => (index < digitCount ? 'digit' : index === digitCount ? 'multiplier' : index === digitCount + 1 ? 'tolerance' : 'tempco');
  const roleLabel = { digit: 'Digit', multiplier: 'Multiplier', tolerance: 'Tolerance', tempco: 'Temp. coeff.' };
  const optionsFor = (role) => COLOR_BANDS.filter((entry) => (role === 'digit' ? entry.digit !== null : role === 'multiplier' ? entry.multiplier !== null : role === 'tolerance' ? entry.tolerance !== null && entry.name !== 'none' : entry.tempco !== null)).map((entry) => [entry.name, entry.name]);
  const bandSelects = names.map((name, index) => `<label>${roleLabel[roleOf(index)]} ${index + 1}<select data-calc-band="${index}">${optionsFor(roleOf(index)).map(([key]) => `<option value="${key}" ${key === name ? 'selected' : ''}>${key}</option>`).join('')}</select></label>`).join('');
  const decode = calcBlock('Colour bands → value', `${calcSelect('bandCount', 'Bands', count, [[3, '3 bands'], [4, '4 bands'], [5, '5 bands'], [6, '6 bands']])}${bandSelects}`, () => {
    const result = decodeResistorBands(names);
    return `${renderResistorSvg(names)}<div class="analysis-readouts comm-readouts">${readout('Resistance', ohms(result.value))}${readout('Tolerance', `±${result.tolerance} %`)}${readout('Range', `${ohms(result.minimum)} … ${ohms(result.maximum)}`)}${result.tempco === null ? '' : readout('Temperature coefficient', `${result.tempco} ppm/K`)}</div>`;
  });
  const encode = calcBlock('Value → colour bands', `${calcField('encodeValue', 'Resistance', config.encodeValue, 'Ω (e.g. 4.7k)')}${calcSelect('series', 'Preferred series', config.series, Object.keys(E_SERIES).map((key) => [key, key]))}`, () => {
    const value = engineeringInput(config.encodeValue, 'Resistance');
    const four = encodeResistorBands(value, { bands: 4 }), five = encodeResistorBands(value, { bands: 5 });
    const preferred = nearestPreferred(value, config.series);
    return `<div class="band-pair"><div>${renderResistorSvg(four.bands)}<small>4-band: ${four.bands.join(' · ')}${four.roundingError ? ` (codes ${ohms(four.value)})` : ''}</small></div><div>${renderResistorSvg(five.bands)}<small>5-band: ${five.bands.join(' · ')}${five.roundingError ? ` (codes ${ohms(five.value)})` : ''}</small></div></div>
      <div class="analysis-readouts comm-readouts">${readout(`Nearest ${config.series}`, `${ohms(preferred.value)} (${fmt(preferred.error * 100, 2)} %)`)}${readout(`${config.series} neighbours`, `${ohms(preferred.below)} / ${ohms(preferred.above)}`)}</div>`;
  });
  const markings = calcBlock('SMD resistor and capacitor markings', `${calcField('smdCode', 'SMD resistor code', config.smdCode, '472, 1002, 4R7, 01C')}${calcField('capCode', 'Capacitor code', config.capCode, '104K, 223J, 471')}`, () => {
    let smd, cap;
    try { const result = decodeSmdResistor(config.smdCode); smd = `${ohms(result.value)} — ${result.system}`; } catch (error) { smd = error.message; }
    try { const result = decodeCapacitorCode(config.capCode); cap = `${eng(result.farads, 'F')}${result.tolerance ? ` ${result.tolerance}` : ''} (${fmt(result.picofarads, 6)} pF)`; } catch (error) { cap = error.message; }
    return `<div class="analysis-readouts comm-readouts">${readout('SMD resistor', smd)}${readout('Capacitor', cap)}</div>`;
  });
  return `<section class="dsp-card coding-card">${decode}${encode}${markings}</section>`;
}
function renderTimerTab(config) {
  const mode = config.timerMode === 'monostable' ? 'monostable' : 'astable';
  const modeSelect = calcSelect('timerMode', 'Mode', mode, [['astable', 'Astable (oscillator)'], ['monostable', 'Monostable (one-shot)']]);
  const analysis = mode === 'astable'
    ? calcBlock('Astable analysis', `${modeSelect}${calcField('r1', 'R1', config.r1, 'Ω')}${calcField('r2', 'R2', config.r2, 'Ω')}${calcField('timerC', 'C', config.timerC, 'F')}`, () => {
      const result = timer555Astable({ r1: engineeringInput(config.r1, 'R1'), r2: engineeringInput(config.r2, 'R2'), c: engineeringInput(config.timerC, 'C') });
      // Two periods of output and capacitor voltage (Vcc = 1): charge 1/3→2/3 through R1+R2, discharge through R2.
      const xs = [], output = [], capacitor = [];
      for (let k = 0; k <= 400; k += 1) {
        const t = 2 * result.period * k / 400, phase = t % result.period;
        xs.push(t);
        const high = phase < result.high;
        output.push(high ? 1 : 0);
        capacitor.push(high ? 1 - (2 / 3) * 2 ** (-phase / result.high) : (2 / 3) * 2 ** (-(phase - result.high) / result.low));
      }
      const plot = renderPlotFrame({ title: 'Output (teal) and capacitor voltage (blue), Vcc = 1', series: [{ xs, ys: output, color: PLOT_COLORS[0], primary: true }, { xs, ys: capacitor, color: PLOT_COLORS[1] }], xMin: 0, xMax: xs.at(-1), xTicks: linearTicks(0, xs.at(-1), 's'), yRange: niceRange(0, 1), formatY: (value) => fmt(value, 2) });
      return `<div class="analysis-readouts comm-readouts">${readout('Frequency', eng(result.frequency, 'Hz'))}${readout('Period', eng(result.period, 's'))}${readout('High time', eng(result.high, 's'))}${readout('Low time', eng(result.low, 's'))}${readout('Duty cycle', `${fmt(result.duty * 100, 2)} %`)}</div>${plot}`;
    })
    : calcBlock('Monostable analysis', `${modeSelect}${calcField('monoR', 'R', config.monoR, 'Ω')}${calcField('monoC', 'C', config.monoC, 'F')}`, () => {
      const result = timer555Monostable({ r: engineeringInput(config.monoR, 'R'), c: engineeringInput(config.monoC, 'C') });
      return `<div class="analysis-readouts comm-readouts">${readout('Pulse width t = ln3·RC ≈ 1.1RC', eng(result.width, 's'))}</div>`;
    });
  const design = calcBlock('Astable design', `${calcField('designF', 'Target frequency', config.designF, 'Hz')}${calcNumber('designDuty', 'Duty cycle', config.designDuty, '0.5 – 1', 'min="0.5" max="0.99" step="0.01"')}${calcField('designC', 'Timing capacitor', config.designC, 'F')}`, () => {
    const result = design555Astable({ frequency: engineeringInput(config.designF, 'Frequency'), duty: Number(config.designDuty), c: engineeringInput(config.designC, 'C') });
    return `<div class="analysis-readouts comm-readouts">${readout('Exact R1', ohms(result.r1))}${readout('Exact R2', ohms(result.r2))}${readout('E24 build', `R1 = ${ohms(result.standard.r1)}, R2 = ${ohms(result.standard.r2)}`)}${readout('E24 result', `${eng(result.standard.frequency, 'Hz')}, ${fmt(result.standard.duty * 100, 1)} % duty`)}</div>${result.warnings.map((warning) => `<p class="module-footnote">${esc(warning)}</p>`).join('')}`;
  });
  return `<section class="dsp-card coding-card">${analysis}${design}<p class="module-footnote">Ideal NE555 thresholds at 1/3 and 2/3 Vcc; real parts add discharge-transistor and threshold-current errors of a few per cent.</p></section>`;
}
function renderOpampTab(config) {
  const controls = `${calcSelect('opampConfig', 'Configuration', config.opampConfig, Object.entries(OPAMP_CONFIGS))}${config.opampConfig === 'follower' ? '' : `${calcField('opR1', config.opampConfig === 'non-inverting' ? 'Rg (to ground)' : 'R1 (input)', config.opR1, 'Ω')}${calcField('opR2', 'R2 (feedback)', config.opR2, 'Ω')}`}${calcField('gbw', 'Gain-bandwidth', config.gbw, 'Hz')}${calcField('slew', 'Slew rate', config.slew, 'V/s')}${calcNumber('vinPeak', 'Input peak', config.vinPeak, 'V')}${calcNumber('supply', 'Supply ±', config.supply, 'V')}`;
  return `<section class="dsp-card coding-card">${calcBlock('Op-amp stage', controls, () => {
    const result = opampStage({ config: config.opampConfig, r1: engineeringInput(config.opR1, 'R1'), r2: engineeringInput(config.opR2, 'R2'), gbw: engineeringInput(config.gbw, 'Gain-bandwidth'), slewRate: engineeringInput(config.slew, 'Slew rate'), inputPeak: Number(config.vinPeak), supply: Number(config.supply) });
    const rail = Number(config.supply);
    const xs = Array.from({ length: 241 }, (_, k) => k / 240);
    const input = xs.map((x) => Number(config.vinPeak) * Math.sin(2 * Math.PI * x));
    const output = input.map((value) => Math.max(-rail, Math.min(rail, result.gain * value)));
    const values = [...input, ...output];
    const plot = renderPlotFrame({ title: 'One period: input (blue) and output (teal), clipped at the rails', series: [{ xs, ys: output, color: PLOT_COLORS[0], primary: true }, { xs, ys: input, color: PLOT_COLORS[1] }], xMin: 0, xMax: 1, xTicks: Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: `${k * 90}°` })), yRange: niceRange(Math.min(...values), Math.max(...values)), formatY: (value) => `${fmt(value, 2)} V` });
    return `<div class="analysis-readouts comm-readouts">${readout('Voltage gain', `${fmt(result.gain, 4)} (${fmt(result.gainDb, 2)} dB)`)}${readout('Noise gain', fmt(result.noiseGain, 4))}${readout('Closed-loop bandwidth', eng(result.bandwidth, 'Hz'))}${readout('Input impedance', ohms(result.inputImpedance))}${readout('Output peak', `${fmt(result.outputPeak, 4)} V${result.clipping ? ' — CLIPS at the rails' : ''}`)}${readout('Full-power bandwidth', finiteEng(result.fullPowerBandwidth, 'Hz'))}</div>${plot}`;
  })}<p class="module-footnote">Ideal op-amp with a single-pole gain-bandwidth limit: bandwidth = GBW / noise gain. Rails are treated as reachable (rail-to-rail output).</p></section>`;
}
function renderDecibelTab(config) {
  const level = calcBlock('Power and voltage levels', `${calcNumber('levelValue', 'Level', config.levelValue)}${calcSelect('levelUnit', 'Unit', config.levelUnit, Object.keys(POWER_UNITS).map((key) => [key, POWER_UNITS[key]]))}${calcNumber('levelImpedance', 'Impedance', config.levelImpedance, 'Ω', 'min="0.001" step="any"')}`, () => {
    const result = convertLevel(Number(config.levelValue), config.levelUnit, Number(config.levelImpedance));
    return `<div class="analysis-readouts comm-readouts">${readout('Power', eng(result.W, 'W'))}${readout('dBm', fmt(result.dBm, 4))}${readout('dBW', fmt(result.dBW, 4))}${readout('V rms', eng(result.Vrms, 'V'))}${readout('V peak', eng(result.Vpeak, 'V'))}${readout('V peak-to-peak', eng(result.Vpp, 'V'))}${readout('dBµV', fmt(result.dBuV, 4))}${readout('dBV', fmt(result.dBV, 4))}</div>`;
  });
  const ratios = calcBlock('Ratios and decibels', `${calcNumber('ratioValue', 'Ratio', config.ratioValue, '×', 'min="0" step="any"')}${calcNumber('dbValue', 'Decibels', config.dbValue, 'dB')}`, () => `<div class="analysis-readouts comm-readouts">${readout(`Power ratio ${fmt(Number(config.ratioValue), 6)}×`, `${fmt(ratioToDb(Number(config.ratioValue), 'power'), 4)} dB`)}${readout(`Voltage ratio ${fmt(Number(config.ratioValue), 6)}×`, `${fmt(ratioToDb(Number(config.ratioValue), 'voltage'), 4)} dB`)}${readout(`${fmt(Number(config.dbValue), 4)} dB as power ratio`, `${fmt(dbToRatio(Number(config.dbValue), 'power'), 6)}×`)}${readout(`${fmt(Number(config.dbValue), 4)} dB as voltage ratio`, `${fmt(dbToRatio(Number(config.dbValue), 'voltage'), 6)}×`)}</div>`);
  return `<section class="dsp-card coding-card">${level}${ratios}<p class="module-footnote">Power dB = 10·log10(P2/P1); voltage dB = 20·log10(V2/V1), valid when both voltages appear across the same impedance.</p></section>`;
}
function renderFormulasTab(config) {
  const ohm = calcBlock("Ohm's law — fill any two", `${calcField('ohmV', 'Voltage V', config.ohmV, 'V')}${calcField('ohmI', 'Current I', config.ohmI, 'A')}${calcField('ohmR', 'Resistance R', config.ohmR, 'Ω')}${calcField('ohmP', 'Power P', config.ohmP, 'W')}`, () => {
    const result = solveOhm({ V: blankOr(config.ohmV, 'V'), I: blankOr(config.ohmI, 'I'), R: blankOr(config.ohmR, 'R'), P: blankOr(config.ohmP, 'P') });
    return `<div class="analysis-readouts comm-readouts">${readout('V', eng(result.V, 'V'))}${readout('I', eng(result.I, 'A'))}${readout('R', ohms(result.R))}${readout('P', eng(result.P, 'W'))}</div>`;
  });
  const sp = calcBlock('Series and parallel', calcField('spValues', 'Values (R, L, or 1/C)', config.spValues, 'separate with spaces', 'type="text" spellcheck="false" maxlength="200"'), () => {
    const result = seriesParallel(String(config.spValues).trim().split(/[\s,;]+/).filter(Boolean).map((text) => engineeringInput(text, 'Value')));
    return `<div class="analysis-readouts comm-readouts">${readout('Series sum', eng(result.series, ''))}${readout('Parallel combination', eng(result.parallel, ''))}</div>`;
  });
  const divider = calcBlock('Voltage divider', `${calcNumber('divVin', 'Vin', config.divVin, 'V')}${calcField('divR1', 'R1 (top)', config.divR1, 'Ω')}${calcField('divR2', 'R2 (bottom)', config.divR2, 'Ω')}${calcField('divLoad', 'Load (blank = none)', config.divLoad, 'Ω')}`, () => {
    const result = voltageDivider({ vin: Number(config.divVin), r1: engineeringInput(config.divR1, 'R1'), r2: engineeringInput(config.divR2, 'R2'), load: blankOr(config.divLoad, 'Load') });
    return `<div class="analysis-readouts comm-readouts">${readout('Vout', eng(result.vout, 'V'))}${readout('Vout unloaded', eng(result.unloaded, 'V'))}${readout('Divider current', eng(result.current, 'A'))}${readout('Thevenin resistance', ohms(result.theveninResistance))}</div>`;
  });
  const rlc = calcBlock('RLC resonance', `${calcField('rlcR', 'R', config.rlcR, 'Ω')}${calcField('rlcL', 'L', config.rlcL, 'H')}${calcField('rlcC', 'C', config.rlcC, 'F')}`, () => {
    const result = rlcResonance({ resistance: engineeringInput(config.rlcR, 'R'), inductance: engineeringInput(config.rlcL, 'L'), capacitance: engineeringInput(config.rlcC, 'C') });
    const x = reactance({ frequency: result.resonance, capacitance: engineeringInput(config.rlcC, 'C'), inductance: engineeringInput(config.rlcL, 'L') });
    return `<div class="analysis-readouts comm-readouts">${readout('Resonant frequency', eng(result.resonance, 'Hz'))}${readout('Series Q', fmt(result.q, 4))}${readout('Bandwidth', eng(result.bandwidth, 'Hz'))}${readout('XL = XC at f0', ohms(x.inductive))}${readout('Damping ratio ζ', fmt(result.damping, 4))}</div>`;
  });
  const rc = calcBlock('RC time constant and cutoff', `${calcField('rcR', 'R', config.rcR, 'Ω')}${calcField('rcC', 'C', config.rcC, 'F')}`, () => {
    const result = rcFilter({ resistance: engineeringInput(config.rcR, 'R'), capacitance: engineeringInput(config.rcC, 'C') });
    return `<div class="analysis-readouts comm-readouts">${readout('τ = RC', eng(result.tau, 's'))}${readout('−3 dB cutoff', eng(result.cutoff, 'Hz'))}${readout('Rise time 10–90 %', eng(result.riseTime, 's'))}${readout('Settles (5τ)', eng(result.settle5Tau, 's'))}</div>`;
  });
  const led = calcBlock('LED series resistor', `${calcNumber('ledSupply', 'Supply', config.ledSupply, 'V')}${calcNumber('ledVf', 'LED forward voltage', config.ledVf, 'V')}${calcField('ledI', 'LED current', config.ledI, 'A')}`, () => {
    const result = ledResistor({ supply: Number(config.ledSupply), forwardVoltage: Number(config.ledVf), current: engineeringInput(config.ledI, 'Current') });
    return `<div class="analysis-readouts comm-readouts">${readout('Exact resistor', ohms(result.resistance))}${readout('Next E12 value up', ohms(result.standard))}${readout('Actual current', eng(result.actualCurrent, 'A'))}${readout('Resistor dissipation', eng(result.resistorPower, 'W'))}</div>`;
  });
  const adc = calcBlock('ADC resolution', `${calcNumber('adcBits', 'Bits', config.adcBits, '', 'min="1" max="32" step="1"')}${calcNumber('adcRef', 'Reference', config.adcRef, 'V')}`, () => {
    const result = adcResolution({ bits: Number(config.adcBits), reference: Number(config.adcRef) });
    return `<div class="analysis-readouts comm-readouts">${readout('Levels', result.levels.toLocaleString())}${readout('LSB size', eng(result.lsb, 'V'))}${readout('Ideal SNR (full-scale sine)', `${fmt(result.snrDb, 2)} dB`)}${readout('Dynamic range', `${fmt(result.dynamicRangeDb, 2)} dB`)}</div>`;
  });
  return `<section class="dsp-card coding-card"><div class="calc-grid">${ohm}${sp}${divider}${rlc}${rc}${led}${adc}</div><p class="module-footnote">Values accept engineering prefixes: p, n, u/µ, m, k, M, G (for example 4.7k, 100n, 2.2u).</p></section>`;
}
export function renderCalculators(state) {
  const config = calcConfiguration(state);
  const body = config.tab === 'timer' ? renderTimerTab(config) : config.tab === 'opamp' ? renderOpampTab(config) : config.tab === 'decibel' ? renderDecibelTab(config) : config.tab === 'formulas' ? renderFormulasTab(config) : renderResistorTab(config);
  return `<div class="page scroll-page calc-page">${pageHeader(modules.find((item) => item.id === 'calc'), 'ENGINEERING CALCULATORS', '<span class="pill live"><i></i> INSTANT RESULTS</span>')}
    ${labTabs(CALC_TABS, config.tab, 'data-calc-tab')}${body}</div>`;
}
export function bindCalculatorEvents() {
  document.querySelectorAll('[data-calc-tab]').forEach((button) => button.addEventListener('click', () => persistCalc({ tab: button.dataset.calcTab })));
  document.querySelectorAll('[data-calc-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.calcField;
    const number = CALC_NUMBER_FIELDS.includes(name);
    const value = number ? Number(field.value) : field.value.trim();
    if (number && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistCalc({ [name]: value });
  }));
  document.querySelectorAll('[data-calc-band]').forEach((select) => select.addEventListener('change', () => {
    const bands = [...calcConfiguration(getState()).bands];
    bands[Number(select.dataset.calcBand)] = select.value;
    persistCalc({ bands });
  }));
}
