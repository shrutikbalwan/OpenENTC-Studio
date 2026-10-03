// Control Lab workspace. Entry points: renderControl(state); bindControlLabEvents().
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { analyzeSystem, classifyStability, firstOrderStability, firstOrderStep, formatPolynomial, makeTransferFunction, pidController, pidLoop, rootLocus, routhArray, timeResponse, zieglerNichols } from '../../../packages/control/src/index.mjs';
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { decadeTicks, niceRange } from '../../core/circuit-plot.js';
import { polyadd, polyRoots } from '../../../packages/numerics/src/index.mjs';
import { complexText, eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linearTicks, planeExtent, PLOT_COLORS, renderComplexPlane, renderPlotFrame } from '../../components/plots.js';
import { labField, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { reportError } from '../../services/errors.js';

const CONTROL_DEFAULTS = Object.freeze({
  tab: 'first-order', numerator: '10', denominator: 's(s+1)(s+5)', feedback: true, duration: '',
  locusNumerator: '1', locusDenominator: 's(s+2)(s+4)', locusGain: 20, routh: 's^4 + 2s^3 + 3s^2 + 4s + 5',
  plantNumerator: '1', plantDenominator: '(s+1)^3', kp: 2, ki: 1, kd: 0.5, tf: 0.01,
});
const CONTROL_TABS = [['first-order', 'First-order step'], ['analysis', 'Transfer function'], ['locus', 'Root locus & Routh'], ['pid', 'PID tuning']];
const CONTROL_TEXT_FIELDS = ['numerator', 'denominator', 'duration', 'locusNumerator', 'locusDenominator', 'routh', 'plantNumerator', 'plantDenominator'];
function controlConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'control-lab')?.inputs || {};
  return { ...CONTROL_DEFAULTS, ...saved };
}
function persistControl(patch) {
  recordExperiment({ id: 'control-lab', kind: 'control', operation: 'control-lab', inputs: { ...controlConfiguration(getState()), ...patch } });
}
const controlField = (...args) => labField('data-control-lab-field', ...args);
const textAttributes = 'type="text" spellcheck="false" maxlength="200"';
const fraction = (name, numerator, denominator) => `<div class="tf-display"><span>${esc(name)} =</span><div class="tf-fraction"><span>${esc(formatPolynomial(numerator))}</span><span>${esc(formatPolynomial(denominator))}</span></div></div>`;
const rootList = (roots) => (roots.length ? roots.map(complexText).join(', ') : 'none');
const timeOrDash = (value) => (value === null || !Number.isFinite(value) ? '—' : eng(value, 's'));
const marginText = (value, unit, crossover) => (Number.isFinite(value) ? `${fmt(value, 2)} ${unit}${crossover ? ` at ${fmt(crossover, 4)} rad/s` : ''}` : '∞ (no crossover)');
const STABILITY_TEXT = { stable: 'Stable — all poles in the left half-plane', marginal: 'Marginally stable — poles on the jω axis', unstable: 'Unstable — pole(s) in the right half-plane' };
function timePlot(title, response, color, extra = []) {
  const series = [{ xs: response.time, ys: response.output, color, primary: true }, ...extra];
  const values = series.flatMap((entry) => entry.ys).filter(Number.isFinite);
  const stop = response.time.at(-1) || 1;
  return renderPlotFrame({ title, series, xMin: 0, xMax: stop, xTicks: linearTicks(0, stop, 's'), yRange: niceRange(Math.min(0, ...values), Math.max(0, ...values)), formatY: (value) => fmt(value, 2) });
}
function bodePlots(result) {
  const first = result.omega[0], last = result.omega.at(-1);
  const xTicks = decadeTicks(first, last).map((omega) => ({ position: (Math.log10(omega) - Math.log10(first)) / (Math.log10(last) - Math.log10(first) || 1), text: `${eng(omega, '')}` }));
  const magnitude = result.magnitudeDb.map((value) => Math.max(-200, Math.min(200, value)));
  return renderPlotFrame({ title: 'Bode magnitude (dB) vs ω (rad/s)', series: [{ xs: result.omega, ys: magnitude, color: PLOT_COLORS[0], primary: true }, { xs: [first, last], ys: [0, 0], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...magnitude), Math.max(...magnitude, 0)), formatY: (value) => `${fmt(value, 0)} dB` })
    + renderPlotFrame({ title: 'Bode phase (°) vs ω (rad/s)', series: [{ xs: result.omega, ys: result.phase, color: PLOT_COLORS[1], primary: true }, { xs: [first, last], ys: [-180, -180], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...result.phase, -180), Math.max(...result.phase)), formatY: (value) => `${fmt(value, 0)}°` });
}
function nyquistPlane(data) {
  const points = data.real.map((re, index) => ({ re, im: data.imaginary[index] })).filter((point) => Number.isFinite(point.re) && Number.isFinite(point.im));
  // Frame the region around −1 that decides stability; far-away branches run off the edge.
  const near = points.filter((point) => Math.hypot(point.re, point.im) <= 10);
  const extent = Math.max(1.5, ...near.map((point) => Math.max(Math.abs(point.re), Math.abs(point.im)))) * 1.15;
  return renderComplexPlane({ label: 'Nyquist plot', extent, criticalPoint: true, curves: [{ points, color: PLOT_COLORS[0] }, { points: points.map((point) => ({ re: point.re, im: -point.im })), color: PLOT_COLORS[1], dashed: true }] });
}
function renderControlAnalysisTab(config) {
  const controls = `<div class="dsp-controls">${controlField('numerator', 'Numerator N(s)', config.numerator, '', textAttributes)}${controlField('denominator', 'Denominator D(s)', config.denominator, '', textAttributes)}${controlField('duration', 'Time span (blank = auto)', config.duration, 's', textAttributes)}<label class="check-label"><input type="checkbox" data-control-lab-field="feedback" ${config.feedback ? 'checked' : ''}> Unity negative feedback</label></div>
    <p class="module-footnote">Type polynomials as "s^2 + 2s + 1", "(s+1)(s+3)", "s(s+2)^2" or coefficient lists like "1 2 1".</p>`;
  let analysis;
  try { analysis = analyzeSystem(config.numerator, config.denominator, { feedback: Boolean(config.feedback), duration: config.duration === '' ? undefined : Number(config.duration) }); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Transfer function</b><span>${esc(error.message)}</span></div></section>`; }
  const { open, system, info, bode: frequency } = analysis;
  const label = config.feedback ? 'T(s)' : 'G(s)';
  const plots = [];
  if (analysis.step) {
    const final = analysis.stability.status === 'stable' ? analysis.dcGain : null;
    plots.push(timePlot(`${label} unit-step response${analysis.step.diverged ? ' (diverging)' : ''}`, analysis.step, PLOT_COLORS[0], final === null ? [] : [{ xs: [0, analysis.step.time.at(-1)], ys: [final, final], color: '#94a3b8', dashed: true }]));
    plots.push(timePlot(`${label} impulse response`, analysis.impulse, PLOT_COLORS[4]));
  }
  plots.push(bodePlots(frequency));
  const pzPoints = [...system.poles, ...system.zeros];
  return `<section class="dsp-card">${controls}
    <div class="tf-row">${fraction('G(s)', open.numerator, open.denominator)}${config.feedback ? fraction('T(s) = G / (1 + G)', system.numerator, system.denominator) : ''}</div>
    ${analysis.step ? '' : '<div class="diagnostic warning"><b>Improper system</b><span>The numerator degree exceeds the denominator degree, so only frequency-domain results are shown.</span></div>'}
    <div class="analysis-readouts comm-readouts">${readout('Stability', STABILITY_TEXT[analysis.stability.status])}${readout(`Poles of ${label}`, rootList(system.poles))}${readout(`Zeros of ${label}`, rootList(system.zeros))}${readout('DC gain', Number.isFinite(analysis.dcGain) ? fmt(analysis.dcGain, 4) : '∞ (integrator)')}
    ${info && analysis.stability.status === 'stable' ? `${readout('Rise time (10–90 %)', timeOrDash(info.riseTime))}${readout('Overshoot', `${fmt(info.overshoot, 2)} %`)}${readout('Peak time', timeOrDash(info.peakTime))}${readout('Settling time (2 %)', timeOrDash(info.settlingTime))}${readout('Steady-state error (step)', fmt(info.steadyStateError, 4))}` : ''}
    ${readout('Gain margin of G', marginText(frequency.margins.gainMarginDb, 'dB', frequency.margins.phaseCrossover))}${readout('Phase margin of G', marginText(frequency.margins.phaseMarginDeg, '°', frequency.margins.gainCrossover))}</div>
    <div class="analysis-plots comm-plots">${plots.join('')}</div>
    <div class="filter-lower"><div><span class="panel-label">POLE-ZERO MAP OF ${label} (s-plane)</span>${renderComplexPlane({ label: 'Pole-zero map', extent: planeExtent(pzPoints), poles: system.poles, zeros: system.zeros })}</div>
    <div><span class="panel-label">NYQUIST PLOT OF G(jω) — solid ω &gt; 0, dashed ω &lt; 0, ● = −1</span>${nyquistPlane(analysis.nyquist)}</div></div>
    <p class="module-footnote">Time responses use exact matrix-exponential discretisation of the state-space model (matching scipy.signal.step). Margins are measured on the open loop G(s).</p></section>`;
}
function renderLocusTab(config) {
  const controls = `<div class="dsp-controls">${controlField('locusNumerator', 'Open-loop N(s)', config.locusNumerator, '', textAttributes)}${controlField('locusDenominator', 'Open-loop D(s)', config.locusDenominator, '', textAttributes)}${controlField('locusGain', 'Gain K', config.locusGain, '', 'type="number" min="0" step="any"')}</div>`;
  let body = '';
  try {
    const open = makeTransferFunction(config.locusNumerator, config.locusDenominator);
    const locus = rootLocus(open);
    const gain = Math.max(0, Number(config.locusGain) || 0);
    const characteristic = polyadd(open.denominator, open.numerator.map((value) => value * gain));
    const closedPoles = polyRoots(characteristic);
    const stability = classifyStability(closedPoles);
    const reference = [...locus.poles, ...locus.zeros, ...locus.crossings.map((crossing) => ({ re: 0, im: crossing.omega })), ...closedPoles];
    if (locus.centroid !== null) reference.push({ re: locus.centroid, im: 0 });
    const extent = planeExtent(reference);
    const curves = locus.branches.map((branch, index) => ({ points: branch, color: PLOT_COLORS[index % PLOT_COLORS.length] }));
    body = `${fraction('G(s)', open.numerator, open.denominator)}
      <div class="filter-lower"><div><span class="panel-label">ROOT LOCUS OF 1 + K·G(s) = 0 (■ = poles at K)</span>${renderComplexPlane({ label: 'Root locus', extent, curves, poles: locus.poles, zeros: locus.zeros, marks: closedPoles })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Open-loop poles', rootList(locus.poles))}${readout('Open-loop zeros', rootList(locus.zeros))}${readout('Asymptote centroid', locus.centroid === null ? '—' : fmt(locus.centroid, 4))}${readout('Asymptote angles', locus.asymptoteAngles.length ? locus.asymptoteAngles.map((angle) => `${fmt(angle, 1)}°`).join(', ') : 'none')}
      ${readout('jω-axis crossings', locus.crossings.length ? locus.crossings.map((crossing) => `K = ${fmt(crossing.gain, 4)} at ω = ${fmt(crossing.omega, 4)} rad/s`).join('; ') : 'none')}${readout(`Closed-loop poles at K = ${fmt(gain, 4)}`, rootList(closedPoles))}${readout('Closed loop at this K', STABILITY_TEXT[stability.status])}</div>
      <button class="button ghost" data-control-routh="${esc(characteristic.map((value) => Number(value.toPrecision(10))).join(' '))}">Send 1 + K·G(s) to Routh table</button></div></div>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Root locus</b><span>${esc(error.message)}</span></div>`; }
  let routhBlock;
  try {
    const routh = routhArray(config.routh);
    const width = Math.max(...routh.rows.map((row) => row.values.length));
    routhBlock = `<div class="analysis-readouts comm-readouts">${readout('Polynomial', formatPolynomial(routh.coefficients))}${readout('Sign changes in first column', routh.signChanges)}${readout('Verdict', routh.verdict)}</div>
      <table class="truth-table routh-table"><tbody>${routh.rows.map((row) => `<tr><th>s<sup>${row.power}</sup></th>${Array.from({ length: width }, (_, index) => `<td class="${index === 0 ? 'routh-first' : ''}">${row.values[index] === undefined ? '' : fmt(row.values[index], 4)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${routh.notes.map((note) => `<p class="module-footnote">${esc(note)}</p>`).join('')}`;
  } catch (error) { routhBlock = `<div class="diagnostic error"><b>Routh-Hurwitz</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}
    <div class="coding-block routh-block"><span class="panel-label">ROUTH-HURWITZ STABILITY TABLE</span><div class="dsp-controls">${controlField('routh', 'Characteristic polynomial', config.routh, '', textAttributes)}</div>${routhBlock}</div></section>`;
}
function renderPidTab(config) {
  const gains = { kp: Number(config.kp), ki: Number(config.ki), kd: Number(config.kd), tf: Number(config.tf) };
  const controls = `<div class="dsp-controls">${controlField('plantNumerator', 'Plant N(s)', config.plantNumerator, '', textAttributes)}${controlField('plantDenominator', 'Plant D(s)', config.plantDenominator, '', textAttributes)}${controlField('kp', 'Kp', config.kp)}${controlField('ki', 'Ki', config.ki)}${controlField('kd', 'Kd', config.kd)}${controlField('tf', 'Derivative filter Tf', config.tf, 's')}</div>`;
  let plant, loop, tuning;
  try { plant = makeTransferFunction(config.plantNumerator, config.plantDenominator); loop = pidLoop(plant, gains); tuning = zieglerNichols(plant); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>PID loop</b><span>${esc(error.message)}</span></div></section>`; }
  const stop = loop.response.time.at(-1);
  const plantStability = classifyStability(plant.poles).status;
  const extra = [];
  if (plantStability === 'stable' && plant.proper) {
    const openStep = timeResponse(plant, { duration: stop, points: loop.response.time.length });
    extra.push({ xs: openStep.time, ys: openStep.output, color: PLOT_COLORS[1] });
  }
  extra.push({ xs: [0, stop], ys: [1, 1], color: '#94a3b8', dashed: true });
  const plot = timePlot(`Closed-loop step: PID (teal)${extra.length > 1 ? ', plant alone (blue)' : ''}, set-point (grey)`, loop.response, PLOT_COLORS[0], extra);
  const info = loop.info;
  const stable = loop.stability.status === 'stable';
  const znTable = tuning.rules.length
    ? `<table class="truth-table comm-table"><thead><tr><th>Rule</th><th>Kp</th><th>Ti</th><th>Td</th><th>Ki</th><th>Kd</th><th></th></tr></thead><tbody>${tuning.rules.map((rule) => `<tr><td>${rule.name}</td><td>${fmt(rule.kp, 4)}</td><td>${rule.ti ? fmt(rule.ti, 4) : '∞'}</td><td>${fmt(rule.td, 4)}</td><td>${fmt(rule.ki, 4)}</td><td>${fmt(rule.kd, 4)}</td><td><button class="button ghost small" data-control-zn="${rule.name}">Apply</button></td></tr>`).join('')}</tbody></table>`
    : `<p class="module-footnote">${esc(tuning.note)}</p>`;
  return `<section class="dsp-card">${controls}
    <div class="tf-row">${fraction('G(s)', plant.numerator, plant.denominator)}${fraction('C(s)', pidController(gains).numerator, pidController(gains).denominator)}</div>
    <div class="analysis-readouts comm-readouts">${readout('Closed loop', STABILITY_TEXT[loop.stability.status])}${stable ? `${readout('Rise time (10–90 %)', timeOrDash(info.riseTime))}${readout('Overshoot', `${fmt(info.overshoot, 2)} %`)}${readout('Settling time (2 %)', timeOrDash(info.settlingTime))}${readout('Steady-state error', fmt(info.steadyStateError, 4))}` : ''}${readout('Gain margin of C·G', marginText(loop.margins.gainMarginDb, 'dB', loop.margins.phaseCrossover))}${readout('Phase margin of C·G', marginText(loop.margins.phaseMarginDeg, '°', loop.margins.gainCrossover))}</div>
    <div class="analysis-plots">${plot}</div>
    <span class="panel-label">ZIEGLER-NICHOLS (ULTIMATE-GAIN METHOD)</span>
    <div class="analysis-readouts comm-readouts">${readout('Ultimate gain Ku', tuning.ultimateGain === null ? '—' : fmt(tuning.ultimateGain, 4))}${readout('Ultimate period Tu', tuning.ultimatePeriod === null ? '—' : eng(tuning.ultimatePeriod, 's'))}</div>${znTable}
    <p class="module-footnote">C(s) = Kp + Ki/s + Kd·s/(Tf·s + 1). Ziegler-Nichols gains are a starting point and usually give about 25–60 % overshoot; reduce Kp or Kd to tame it.</p></section>`;
}
function renderFirstOrderTab(state) {
  const result = state.simulation?.kind === 'control' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'control-step')?.inputs || {};
  const values = result?.response?.data ? Array.from(result.response.data) : [];
  const max = Math.max(1, ...(values.length ? values : [1]));
  const path = values.length > 1 ? values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 560).toFixed(1)} ${(150 - (value / max) * 130).toFixed(1)}`).join(' ') : '';
  return `<section class="dsp-card"><div class="dsp-controls"><label>Gain<input type="number" step="0.1" data-control-field="gain" value="${esc(config.gain ?? 1)}"></label><label>Time constant<input type="number" min="0.001" step="0.001" data-control-field="tau" value="${esc(config.tau ?? 0.1)}"><span>s</span></label><label>Sample rate<input type="number" min="1" step="1" data-control-field="sampleRate" value="${esc(config.sampleRate ?? 100)}"><span>Hz</span></label><label>Samples<input type="number" min="8" max="4096" step="8" data-control-field="length" value="${esc(config.length ?? 256)}"></label><button class="button run" data-action="run-control">Run step response</button><button class="button ghost" data-action="export-control">Export response</button></div>
    <div class="dsp-plot"><span class="panel-label">STEP RESPONSE</span><svg viewBox="0 0 560 170" preserveAspectRatio="none"><path class="trace" d="${path}"/></svg></div>
    <div class="stat-grid"><div><span>Stability</span><strong>${result ? (result.stability.stable ? 'Stable' : 'Unstable') : '—'}</strong><small>first-order pole</small></div><div><span>Final value</span><strong>${result ? fmt(values.at(-1), 3) : '—'}</strong><small>output units</small></div><div><span>Samples</span><strong>${values.length || '—'}</strong><small>bounded local array</small></div></div>
    <p class="module-footnote">This built-in experiment uses a deterministic first-order model. It does not claim python-control, Scilab or hardware-in-the-loop availability.</p></section>`;
}
export function renderControl(state) {
  const config = controlConfiguration(state);
  const body = config.tab === 'analysis' ? renderControlAnalysisTab(config) : config.tab === 'locus' ? renderLocusTab(config) : config.tab === 'pid' ? renderPidTab(config) : renderFirstOrderTab(state);
  return `<div class="page scroll-page control-page">${pageHeader(modules.find((item) => item.id === 'iot'), 'BUILT-IN CONTROL LAB', '<span class="pill live"><i></i> LOCAL MODEL</span>')}
    ${labTabs(CONTROL_TABS, config.tab, 'data-control-tab')}${body}</div>`;
}
function bindControlLabEvents() {
  document.querySelectorAll('[data-control-tab]').forEach((button) => button.addEventListener('click', () => persistControl({ tab: button.dataset.controlTab })));
  document.querySelectorAll('[data-control-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.controlLabField;
    if (field.type === 'checkbox') { persistControl({ [name]: field.checked }); return; }
    const text = CONTROL_TEXT_FIELDS.includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistControl({ [name]: value });
  }));
  document.querySelector('[data-control-routh]')?.addEventListener('click', (event) => persistControl({ routh: event.currentTarget.dataset.controlRouth }));
  document.querySelectorAll('[data-control-zn]').forEach((button) => button.addEventListener('click', () => {
    const config = controlConfiguration(getState());
    try {
      const rule = zieglerNichols(makeTransferFunction(config.plantNumerator, config.plantDenominator)).rules.find((entry) => entry.name === button.dataset.controlZn);
      if (!rule) return;
      const round = (value) => Number(value.toPrecision(4));
      persistControl({ kp: round(rule.kp), ki: round(rule.ki), kd: round(rule.kd) });
      notify(`Ziegler-Nichols ${rule.name} gains applied`, 'success');
    } catch (error) { reportError(error); }
  }));
}

export function bindControlEvents() {
  bindControlLabEvents();
  document.querySelector('[data-action="run-control"]')?.addEventListener('click', () => {
    const read = (name, fallback) => { const value = Number(document.querySelector(`[data-control-field="${name}"]`)?.value); return Number.isFinite(value) ? value : fallback; };
    try {
      const gain = read('gain', 1); const tau = Math.max(0.001, read('tau', 0.1)); const sampleRate = Math.max(1, read('sampleRate', 100)); const length = Math.min(4096, Math.max(8, Math.trunc(read('length', 256))));
      recordExperiment({ id: 'control-step', kind: 'control', operation: 'step-response', inputs: { gain, tau, sampleRate, length } });
      setState({ simulation: { kind: 'control', response: firstOrderStep({ gain, tau, sampleRate, length }), stability: firstOrderStability(tau) } });
      notify('Control step response computed', 'success');
    } catch (error) { reportError(error); }
  });
  document.querySelector('[data-action="export-control"]')?.addEventListener('click', () => {
    const result = getState().simulation;
    const response = result?.kind === 'control' ? result.response : null;
    if (!response?.data?.length) { notify('Run the control experiment before exporting.', 'error'); return; }
    const rows = ['time_s,value', ...Array.from(response.data, (value, index) => `${(index / response.sampleRate).toFixed(9)},${Number(value).toPrecision(12)}`)];
    const blob = new Blob([`${rows.join('\n')}\n`], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'openentc-step-response.csv'; link.click(); URL.revokeObjectURL(link.href); notify('Step response CSV exported', 'success');
  });
}
