// Signals / DSP Lab workspace. Entry points: renderDsp(state); bindDspLabEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment } from '../../core/store.js';
import { niceRange } from '../../core/circuit-plot.js';
import { cabs, cdiv, cexp, complex, convolutionSteps, designFir, designIir, FILTER_TYPES, FIR_WINDOWS, frequencyResponseDigital, impulseResponse, lfilter, poleZero, polyval } from '../../../packages/numerics/src/index.mjs';
import { decibels, eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { indexTicks, linearTicks, planeExtent, PLOT_COLORS, renderComplexPlane, renderPlotFrame } from '../../components/plots.js';
import { labField, labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';

const DSP_DEFAULTS = Object.freeze({
  tab: 'fft', method: 'butterworth', filterType: 'lowpass', order: 4, taps: 31, window: 'hamming', beta: 6, rippleDb: 1,
  cutoff: 1000, cutoffHigh: 2000, sampleRate: 8000, toneLow: 300, toneHigh: 2500, convX: '1 2 3 1', convH: '1 1 0.5', convN: 2,
});
const DSP_TABS = [['fft', 'Signal & FFT'], ['filter', 'Filter designer'], ['convolution', 'Convolution']];
const FILTER_METHODS = [['butterworth', 'Butterworth IIR'], ['chebyshev1', 'Chebyshev type I IIR'], ['fir', 'FIR (windowed sinc)']];
const FILTER_TYPE_LABELS = { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', bandstop: 'Band-stop' };
function dspConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'dsp-lab')?.inputs || {};
  return { ...DSP_DEFAULTS, ...saved };
}
function persistDsp(patch) {
  recordExperiment({ id: 'dsp-lab', kind: 'dsp', operation: 'dsp-lab', inputs: { ...dspConfiguration(getState()), ...patch } });
}
const dspField = (...args) => labField('data-dsp-lab-field', ...args);
const dspSelect = (...args) => labSelect('data-dsp-lab-field', ...args);
function designFromConfig(config) {
  const band = config.filterType === 'bandpass' || config.filterType === 'bandstop';
  const cutoff = band ? [Number(config.cutoff), Number(config.cutoffHigh)] : Number(config.cutoff);
  const common = { type: config.filterType, cutoff, sampleRate: Number(config.sampleRate) };
  return config.method === 'fir'
    ? designFir({ ...common, taps: Number(config.taps), window: config.window, beta: Number(config.beta) })
    : designIir({ ...common, family: config.method, order: Number(config.order), rippleDb: Number(config.rippleDb) });
}
function renderFilterTab(config) {
  const band = config.filterType === 'bandpass' || config.filterType === 'bandstop';
  const fir = config.method === 'fir';
  const controls = `<div class="dsp-controls">${dspSelect('method', 'Design method', config.method, FILTER_METHODS)}${dspSelect('filterType', 'Response', config.filterType, FILTER_TYPES.map((type) => [type, FILTER_TYPE_LABELS[type]]))}${dspField('sampleRate', 'Sample rate', config.sampleRate, 'Hz')}${dspField('cutoff', band ? 'Lower edge' : 'Cutoff', config.cutoff, 'Hz')}${band ? dspField('cutoffHigh', 'Upper edge', config.cutoffHigh, 'Hz') : ''}
    ${fir ? `${dspField('taps', 'Taps', config.taps, '', 'type="number" min="3" max="513" step="1"')}${dspSelect('window', 'Window', config.window, FIR_WINDOWS.map((name) => [name, name[0].toUpperCase() + name.slice(1)]))}${config.window === 'kaiser' ? dspField('beta', 'Kaiser β', config.beta, '', 'type="number" min="0" max="20" step="0.5"') : ''}` : `${dspField('order', 'Order', config.order, '', 'type="number" min="1" max="12" step="1"')}${config.method === 'chebyshev1' ? dspField('rippleDb', 'Passband ripple', config.rippleDb, 'dB', 'type="number" min="0.01" max="10" step="0.1"') : ''}`}</div>`;
  let design;
  try { design = designFromConfig(config); } catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Filter design</b><span>${esc(error.message)}</span></div></section>`; }
  const fs = design.sampleRate, nyquist = fs / 2;
  const response = frequencyResponseDigital(design.b, design.a, fs, 801);
  const floor = Math.max(-140, Math.min(...response.decibels));
  const xTicks = linearTicks(0, nyquist, 'Hz');
  const magnitude = renderPlotFrame({ title: 'Magnitude response (dB)', series: [{ xs: response.frequency, ys: response.decibels.map((value) => Math.max(value, floor)), color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(floor, Math.max(1, ...response.decibels)), formatY: (value) => `${fmt(value, 0)} dB` });
  const phaseDegrees = response.phase.map((value) => value * 180 / Math.PI);
  const phase = renderPlotFrame({ title: 'Phase response (°, unwrapped)', series: [{ xs: response.frequency, ys: phaseDegrees, color: PLOT_COLORS[1], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(Math.min(...phaseDegrees), Math.max(...phaseDegrees)), formatY: (value) => `${fmt(value, 0)}°` });
  const delays = response.groupDelay.filter((value, index) => response.decibels[index] > -40 && Number.isFinite(value));
  const groupDelay = renderPlotFrame({ title: 'Group delay (samples)', series: [{ xs: response.frequency, ys: response.groupDelay.map((value, index) => (response.decibels[index] > -40 ? value : NaN)), color: PLOT_COLORS[2], primary: true }], xMin: 0, xMax: nyquist, xTicks, yRange: niceRange(Math.min(0, ...delays), Math.max(1, ...delays)), formatY: (value) => fmt(value, 1) });
  const impulse = impulseResponse(design.b, design.a, fir ? design.taps : 64);
  const indices = impulse.map((_, n) => n);
  const impulsePlot = renderPlotFrame({ title: 'Impulse response h[n]', series: [{ xs: indices, ys: impulse, color: PLOT_COLORS[4], stem: true }], xMin: 0, xMax: impulse.length - 1, xTicks: indexTicks(0, impulse.length - 1), yRange: niceRange(Math.min(0, ...impulse), Math.max(0, ...impulse)), formatY: (value) => fmt(value, 3) });
  let pz = null;
  if (!fir || design.taps <= 129) pz = poleZero(design);
  const pzPlot = pz ? renderComplexPlane({ label: 'Pole-zero plot in the z-plane', extent: planeExtent([...pz.poles, ...pz.zeros, { re: 1, im: 1 }]), unitCircle: true, poles: pz.poles, zeros: pz.zeros }) : '<p class="module-footnote">Pole-zero plot is shown for FIR filters up to 129 taps.</p>';
  // Demonstration: two tones through the filter.
  const tones = [Number(config.toneLow), Number(config.toneHigh)];
  const demoLength = 400;
  const input = Array.from({ length: demoLength }, (_, n) => tones.reduce((sum, tone) => sum + Math.sin(2 * Math.PI * tone * n / fs), 0));
  const output = lfilter(design.b, design.a, input);
  const times = input.map((_, n) => n / fs);
  const demoValues = [...input, ...output];
  const demo = renderPlotFrame({ title: 'Two-tone input (blue) and filtered output (teal)', series: [{ xs: times, ys: output, color: PLOT_COLORS[0], primary: true }, { xs: times, ys: input, color: PLOT_COLORS[1] }], xMin: 0, xMax: times.at(-1), xTicks: linearTicks(0, times.at(-1), 's'), yRange: niceRange(Math.min(...demoValues), Math.max(...demoValues)), formatY: (value) => fmt(value, 1) });
  const gainAt = (frequency) => { const zInverse = cexp(complex(0, -2 * Math.PI * frequency / fs)); return 20 * Math.log10(Math.max(1e-12, cabs(cdiv(polyval([...design.b].reverse(), zInverse), polyval([...design.a].reverse(), zInverse))))); };
  const edgeGains = design.cutoff.map((frequency) => `${eng(frequency, 'Hz')}: ${decibels(gainAt(frequency))}`).join(' · ');
  const coefficientText = `b = [${design.b.map((value) => Number(value.toPrecision(10))).join(', ')}]\na = [${design.a.map((value) => Number(value.toPrecision(10))).join(', ')}]`;
  return `<section class="dsp-card">${controls}
    <div class="analysis-readouts comm-readouts">${readout('Filter', `${FILTER_TYPE_LABELS[design.type]} ${fir ? `FIR, ${design.taps} taps, ${design.window}` : `${design.family === 'butterworth' ? 'Butterworth' : 'Chebyshev I'}, order ${design.order}`}`)}${readout('Stability', fir || design.stable ? 'stable (all poles inside |z| = 1)' : 'UNSTABLE')}${readout('Gain at band edge', edgeGains)}${readout(fir ? 'Delay (linear phase)' : 'Phase', fir ? `${fmt(design.delay, 1)} samples = ${eng(design.delay / fs, 's')}` : 'non-linear (IIR)')}${readout('Coefficients', `${design.b.length} b, ${design.a.length} a`)}</div>
    <div class="analysis-plots comm-plots">${magnitude}${phase}${groupDelay}${impulsePlot}</div>
    <div class="filter-lower"><div><span class="panel-label">POLE-ZERO PLOT (z-plane)</span>${pzPlot}</div>
    <div class="comm-side"><span class="panel-label">FILTERING DEMO</span><div class="dsp-controls">${dspField('toneLow', 'Tone 1', config.toneLow, 'Hz')}${dspField('toneHigh', 'Tone 2', config.toneHigh, 'Hz')}</div>
    <div class="analysis-readouts comm-readouts">${tones.map((tone) => readout(`Gain at ${eng(tone, 'Hz')}`, decibels(gainAt(tone)))).join('')}</div>${demo}
    <span class="panel-label">COEFFICIENTS (scipy.signal / MATLAB order)</span><pre class="crc-steps">${esc(coefficientText)}</pre></div></div>
    <p class="module-footnote">IIR filters use analog prototypes with the prewarped bilinear transform, the same method as scipy.signal.butter / cheby1. FIR filters use the windowed-sinc method of scipy.signal.firwin.</p></section>`;
}
function parseSequence(text, label) {
  const values = String(text).trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new SyntaxError(`${label} must be a list of numbers separated by spaces or commas.`);
  return values;
}
function renderConvolutionTab(config) {
  const controls = `<div class="dsp-controls">${dspField('convX', 'Input x[n]', config.convX, '', 'type="text" spellcheck="false"')}${dspField('convH', 'Impulse response h[n]', config.convH, '', 'type="text" spellcheck="false"')}</div>`;
  let x, h, steps;
  try { x = parseSequence(config.convX, 'x[n]'); h = parseSequence(config.convH, 'h[n]'); steps = convolutionSteps(x, h); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Convolution</b><span>${esc(error.message)}</span></div></section>`; }
  const y = steps.map((step) => step.value);
  const selected = Math.min(steps.length - 1, Math.max(0, Math.trunc(Number(config.convN) || 0)));
  const last = steps.length - 1;
  const all = [...x, ...h, ...y];
  const yRange = niceRange(Math.min(0, ...all), Math.max(0, ...all));
  const stem = (title, values, color) => renderPlotFrame({ title, series: [{ xs: values.map((_, n) => n), ys: values, color, stem: true }], xMin: 0, xMax: last, xTicks: indexTicks(0, last), yRange, formatY: (value) => fmt(value, 2) });
  const shifted = Array.from({ length: steps.length }, (_, k) => { const index = selected - k; return index >= 0 && index < h.length ? h[index] : NaN; });
  const step = steps[selected];
  const rows = step.terms.map((term) => `<tr><td>${term.k}</td><td>${fmt(term.x, 4)}</td><td>${fmt(term.h, 4)}</td><td>${fmt(term.product, 4)}</td></tr>`).join('');
  const formula = `y[${selected}] = ${step.terms.map((term) => `x[${term.k}]·h[${selected - term.k}]`).join(' + ')} = ${step.terms.map((term) => `${fmt(term.x, 3)}×${fmt(term.h, 3)}`).join(' + ')} = ${fmt(step.value, 4)}`;
  return `<section class="dsp-card">${controls}
    <div class="analysis-plots comm-plots">${stem('Input x[n]', x, PLOT_COLORS[1])}${stem('Impulse response h[n]', h, PLOT_COLORS[4])}${stem(`Flipped and shifted h[${selected} − k]`, shifted, PLOT_COLORS[2])}${stem('Output y[n] = x[n] * h[n]', y, PLOT_COLORS[0])}</div>
    <span class="panel-label">STEP THROUGH THE SUM — choose n</span><div class="bit-row conv-steps">${steps.map((entry) => `<button class="bit${entry.n === selected ? ' flipped' : ''}" data-dsp-conv-n="${entry.n}">${entry.n}</button>`).join('')}</div>
    <div class="conv-detail"><table class="truth-table comm-table"><thead><tr><th>k</th><th>x[k]</th><th>h[n−k]</th><th>product</th></tr></thead><tbody>${rows}</tbody></table><div><pre class="crc-steps">${esc(formula)}</pre><div class="analysis-readouts comm-readouts">${readout('Output length', `${x.length} + ${h.length} − 1 = ${y.length}`)}${readout('y[n]', y.map((value) => fmt(value, 3)).join(', '))}</div></div></div>
    <p class="module-footnote">Linear convolution y[n] = Σ x[k]·h[n−k]. The same sum describes any LTI system: the output is the input weighted by the shifted impulse response.</p></section>`;
}
function renderFftTab(state) {
  const result = state.simulation?.kind === 'dsp' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'signals-fft')?.inputs || {};
  const signal = result?.signal;
  const values = signal ? Array.from(signal.data) : [];
  const min = values.length ? Math.min(...values) : -1; const max = values.length ? Math.max(...values) : 1; const span = max - min || 1;
  const path = values.length > 1 ? values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 560).toFixed(1)} ${(150 - ((value - min) / span) * 130).toFixed(1)}`).join(' ') : '';
  const peak = result ? Math.max(...result.spectrum.real.map((real, index) => Math.hypot(real, result.spectrum.imaginary[index]))) : null;
  const magnitudes = result ? Array.from(result.spectrum.real, (real, index) => Math.hypot(real, result.spectrum.imaginary[index])) : [];
  const magnitudeMax = Math.max(1e-12, ...magnitudes);
  const spectrumPath = magnitudes.length > 1 ? magnitudes.map((value, index) => `${index ? 'L' : 'M'} ${(index / (magnitudes.length - 1) * 560).toFixed(1)} ${(150 - (value / magnitudeMax) * 130).toFixed(1)}`).join(' ') : '';
  return `<section class="dsp-card"><div class="dsp-controls"><label>Frequency<input type="number" min="0.1" step="0.1" data-dsp-field="frequency" value="${esc(config.frequency ?? 1000)}"><span>Hz</span></label><label>Sample rate<input type="number" min="10" step="10" data-dsp-field="sampleRate" value="${esc(config.sampleRate ?? 48000)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-dsp-field="length" value="${esc(config.length ?? 256)}"></label><label>FIR taps<input type="number" min="1" max="64" step="1" data-dsp-field="taps" value="${esc(config.taps ?? 1)}"></label><label>Window<select data-dsp-field="window"><option value="rectangular" ${config.window === 'rectangular' ? 'selected' : ''}>Rectangular</option><option value="hann" ${!config.window || config.window === 'hann' ? 'selected' : ''}>Hann</option><option value="hamming" ${config.window === 'hamming' ? 'selected' : ''}>Hamming</option></select></label><button class="button run" data-action="run-dsp">Generate + FFT</button><button class="button ghost" data-action="export-dsp">Export samples</button><button class="button ghost" data-action="export-spectrum">Export spectrum</button></div>
    <div class="dsp-plot"><span class="panel-label">TIME SERIES</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div><div class="dsp-plot"><span class="panel-label">FFT MAGNITUDE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace spectrum-trace" d="${spectrumPath}"/></svg></div>
    <div class="stat-grid"><div><span>Samples</span><strong>${signal?.data.length || '—'}</strong><small>bounded local array</small></div><div><span>Sample rate</span><strong>${signal ? fmt(signal.sampleRate) : '—'}</strong><small>Hz</small></div><div><span>FFT peak</span><strong>${peak === null ? '—' : fmt(peak, 3)}</strong><small>magnitude</small></div></div>
    <p class="module-footnote">This built-in experiment uses deterministic local math. It does not execute imported Python or claim SciPy/NumPy availability.</p></section>`;
}
export function renderDsp(state) {
  const config = dspConfiguration(state);
  const body = config.tab === 'filter' ? renderFilterTab(config) : config.tab === 'convolution' ? renderConvolutionTab(config) : renderFftTab(state);
  return `<div class="page scroll-page dsp-page">${pageHeader(modules.find((item) => item.id === 'dsp'), 'BUILT-IN NUMERICAL LAB', '<span class="pill live"><i></i> LOCAL COMPUTATION</span>')}
    ${labTabs(DSP_TABS, config.tab, 'data-dsp-tab')}${body}</div>`;
}
export function bindDspLabEvents() {
  document.querySelectorAll('[data-dsp-tab]').forEach((button) => button.addEventListener('click', () => persistDsp({ tab: button.dataset.dspTab })));
  document.querySelectorAll('[data-dsp-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.dspLabField;
    const text = ['method', 'filterType', 'window', 'convX', 'convH'].includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistDsp({ [name]: value });
  }));
  document.querySelectorAll('[data-dsp-conv-n]').forEach((button) => button.addEventListener('click', () => persistDsp({ convN: Number(button.dataset.dspConvN) })));
}
