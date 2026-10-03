// Signals & Systems workspace. Entry points: renderSigsys(state); bindSigsysEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { niceRange } from '../../core/circuit-plot.js';
import { cabs, polyRoots } from '../../../packages/numerics/src/index.mjs';
import { dftSteps, fftButterflies, fourierSeries, inverseLaplace, inverseZ, limitTheorems, longDivision, WAVEFORMS } from '../../../packages/sigsys/src/index.mjs';
import { complexText, fmt, shifted } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { indexTicks, linePlot, planeExtent, PLOT_COLORS, renderComplexPlane, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const SIGSYS_TABS = [['fourier', 'Fourier series'], ['laplace', 'Laplace transform'], ['z', 'Z-transform'], ['dft', 'DFT step by step']];
const sigLab = makeLab('sigsys-lab', {
  tab: 'fourier',
  fourier: { type: 'square', amplitude: 1, duty: 0.25, harmonics: 9 },
  laplace: { numerator: '10', denominator: '1 2 10' },
  z: { b: '1 0.5', a: '1 -1.5 0.56', count: 20 },
  dft: { samples: '1 2 3 4 0 -1 0.5 2' },
});
const parseCoefficients = (text, label) => {
  const values = String(text).trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new RangeError(`${label}: enter numbers separated by spaces.`);
  return values;
};
const polyText = (coefficients, variable, ascendingNegative = false) => {
  const parts = [];
  coefficients.forEach((c, i) => {
    if (Math.abs(c) < 1e-15) return;
    const power = ascendingNegative ? i : coefficients.length - 1 - i;
    const v = power === 0 ? '' : ascendingNegative ? `${variable}⁻${power === 1 ? '¹' : String(power).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('')}` : power === 1 ? variable : `${variable}${String(power).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('')}`;
    const magnitude = Math.abs(c);
    const coefficient = magnitude === 1 && v ? '' : fmt(magnitude, 4);
    parts.push(`${c < 0 ? '−' : parts.length ? '+' : ''} ${coefficient}${v}`.trim());
  });
  return parts.join(' ') || '0';
};
const imaginaryAware = (value) => (Math.abs(value.re) < 1e-12 && Math.abs(value.im) > 1e-12 ? `${value.im < 0 ? '−' : ''}j${fmt(Math.abs(value.im), 4)}` : complexText(value));
const termText = (term, variable, z = false) => `${imaginaryAware(term.residue)} / ${z ? `(1 − ${complexText(term.pole)}·z⁻¹)` : `(${shifted(variable, term.pole)})`}${term.order > 1 ? `^${term.order}` : ''}`;
const differenceText = (b, a) => {
  const signed = (value, text, first) => `${first ? (value < 0 ? '−' : '') : value < 0 ? ' − ' : ' + '}${fmt(Math.abs(value), 4) === '1' ? '' : `${fmt(Math.abs(value), 4)}·`}${text}`;
  const rhs = [...b.map((value, k) => ({ value, text: k ? `x[n−${k}]` : 'x[n]' })), ...a.slice(1).map((value, k) => ({ value: -value, text: `y[n−${k + 1}]` }))].filter((term) => Math.abs(term.value) > 1e-15);
  return `${fmt(a[0], 4) === '1' ? '' : `${fmt(a[0], 4)}·`}y[n] = ${rhs.map((term, index) => signed(term.value, term.text, index === 0)).join('')}`;
};
function renderSigsysTab(config) {
  const c = config[config.tab];
  const field = groupField('data-sig-field');
  const text = (path, label, value, placeholder = '') => `<label>${label}<input type="text" spellcheck="false" data-sig-text="${path}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
  if (config.tab === 'fourier') {
    const series = fourierSeries(c.type, { amplitude: c.amplitude, duty: c.duty, harmonics: c.harmonics, points: 1200 });
    const controls = `${labSelect('data-sig-select', 'fourier.type', 'Waveform', c.type, Object.entries(WAVEFORMS).map(([id, wave]) => [id, wave.label]))}${field('fourier.amplitude', 'Amplitude A', c.amplitude)}${c.type === 'pulse' ? field('fourier.duty', 'Duty cycle d', c.duty) : ''}<label>Harmonics N = ${c.harmonics}<input type="range" min="0" max="99" step="1" data-sig-range="fourier.harmonics" value="${c.harmonics}"></label>`;
    const spectrum = [{ n: 0, magnitude: Math.abs(series.a0) }, ...series.coefficients];
    const rows = series.coefficients.slice(0, 12).map((coefficient) => `<tr><td>${coefficient.n}</td><td>${fmt(coefficient.an, 5)}</td><td>${fmt(coefficient.bn, 5)}</td><td>${fmt(coefficient.magnitude, 5)}</td><td>${fmt(coefficient.phase, 2)}°</td></tr>`).join('');
    const body = `<div class="power-grid"><div>${linePlot(`Waveform and the sum of ${c.harmonics} harmonics (time in periods T)`, series.t, [{ name: 'f(t)', values: series.original, color: '#64748b' }, { name: 'partial sum', values: series.synthesis }], { xLabel: (x) => fmt(x, 2) })}${renderPlotFrame({ title: 'Amplitude spectrum |cₙ| (n = harmonic number)', series: [{ xs: spectrum.map((s) => s.n), ys: spectrum.map((s) => s.magnitude), color: PLOT_COLORS[2], stem: true }], xMin: 0, xMax: Math.max(1, c.harmonics), xTicks: indexTicks(0, Math.max(1, c.harmonics)), yRange: niceRange(0, Math.max(...spectrum.map((s) => s.magnitude), 1e-9)), formatY: (value) => fmt(value, 3) })}</div>
      <div><div class="analysis-readouts">${readout('DC term a₀', fmt(series.a0, 6))}${readout('Power in a₀ and N harmonics (Parseval)', `${fmt(series.powerFraction * 100, 4)} % of ${fmt(series.totalPower, 4)}`)}${readout('RMS value', fmt(series.rms, 5))}${readout('Overshoot of the partial sum', `${fmt(series.overshoot * 100, 3)} % of the jump`)}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>n</th><th>aₙ</th><th>bₙ</th><th>cₙ</th><th>φₙ</th></tr></thead><tbody>${rows}</tbody></table><p class="field-help">f(t) = a₀ + Σ [aₙ cos nω₀t + bₙ sin nω₀t] = a₀ + Σ cₙ cos(nω₀t + φₙ). Coefficients are the exact closed forms (checked against numerical integration). At a jump the partial sums overshoot by about 9 % however many harmonics you add — the Gibbs phenomenon.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'laplace') {
    const num = parseCoefficients(c.numerator, 'Numerator'), den = parseCoefficients(c.denominator, 'Denominator');
    const inverse = inverseLaplace(num, den);
    const step = inverseLaplace(num, [...den, 0]);
    const limits = limitTheorems(num, den);
    const poles = polyRoots(den), zeros = num.length > 1 ? polyRoots(num) : [];
    const slowest = Math.min(...poles.map((p) => Math.abs(p.re)).filter((v) => v > 1e-6), Infinity);
    const fastestOsc = Math.max(0, ...poles.map((p) => Math.abs(p.im)));
    const tMax = Number.isFinite(slowest) ? Math.min(60, 6 / slowest) : fastestOsc > 0 ? 4 * 2 * Math.PI / fastestOsc : 10;
    const ts = Array.from({ length: 400 }, (_, k) => tMax * k / 399);
    const controls = `${text('laplace.numerator', 'Numerator N(s), descending powers', c.numerator, '1 3')}${text('laplace.denominator', 'Denominator D(s), descending powers', c.denominator, '1 3 2')}`;
    const body = `<div class="power-grid"><div>${linePlot('Inverse transform f(t)', ts, [{ name: 'f(t)', values: ts.map((t) => inverse.evaluate(t)) }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Step response (inverse of F(s)/s)', ts, [{ name: 'step', values: ts.map((t) => step.evaluate(t)) }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div><div class="analysis-readouts">${readout('F(s)', `(${polyText(num, 's')}) / (${polyText(den, 's')})`)}${readout('Partial fractions', [...(inverse.direct.length ? [`${polyText(inverse.direct, 's')} (direct)`] : []), ...inverse.terms.map((term) => termText(term, 's'))].join('  +  '))}${readout('f(t) for t ≥ 0', inverse.expression + (inverse.impulses.length ? '  + impulse terms' : ''))}${readout('Poles', poles.map(complexText).join(', '))}${readout('Zeros', zeros.length ? zeros.map(complexText).join(', ') : 'none')}${readout('Initial value f(0+) = lim s·F(s)', limits.initial === null ? 'infinite (improper F)' : fmt(limits.initial, 6))}${readout('Final value lim s·F(s) as s → 0', limits.finalExists ? fmt(limits.final, 6) : 'does not exist (pole in the right half or on the jω axis)')}${readout('Stability', poles.every((p) => p.re < -1e-12) ? 'stable (all poles in the left half-plane)' : 'not asymptotically stable')}</div>
      ${renderComplexPlane({ label: 's-plane', extent: planeExtent([...poles, ...zeros]), poles, zeros })}<p class="field-help">Residues come from the Taylor series of (s − p)ᵐF(s), so repeated and complex poles are exact; they match scipy.signal.residue.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'z') {
    const b = parseCoefficients(c.b, 'Numerator'), a = parseCoefficients(c.a, 'Denominator');
    const count = Math.max(4, Math.min(80, Math.round(c.count)));
    const inverse = inverseZ(b, a, count);
    const division = longDivision(b, a, 8);
    const poles = polyRoots([...a].reverse()).map((root) => (cabs(root) < 1e-15 ? root : root)), zeros = b.length > 1 ? polyRoots([...b].reverse()) : [];
    // Roots of A(z⁻¹) in z⁻¹ are 1/p: convert to z-plane poles.
    const zPoles = inverse.terms.map((term) => term.pole);
    const zZeros = zeros.filter((w) => cabs(w) > 1e-12).map((w) => ({ re: w.re / (w.re ** 2 + w.im ** 2), im: -w.im / (w.re ** 2 + w.im ** 2) }));
    void poles;
    const ns = Array.from({ length: count }, (_, n) => n);
    const controls = `${text('z.b', 'Numerator b₀ b₁ … (powers of z⁻¹)', c.b, '1 0.5')}${text('z.a', 'Denominator a₀ a₁ …', c.a, '1 -1.5 0.56')}${field('z.count', 'Samples', count)}`;
    const body = `<div class="power-grid"><div>${renderPlotFrame({ title: 'Impulse response h[n]', series: [{ xs: ns, ys: inverse.h, color: PLOT_COLORS[0], stem: true }], xMin: 0, xMax: count - 1, xTicks: indexTicks(0, count - 1), yRange: niceRange(Math.min(0, ...inverse.h), Math.max(0, ...inverse.h)), formatY: (value) => fmt(value, 3) })}${renderComplexPlane({ label: 'z-plane', extent: planeExtent([...zPoles, ...zZeros, { re: 1, im: 1 }]), unitCircle: true, poles: zPoles, zeros: zZeros })}</div>
      <div class="analysis-readouts">${readout('H(z)', `(${polyText(b, 'z', true)}) / (${polyText(a, 'z', true)})`)}${readout('Difference equation', differenceText(b, a))}${readout('Partial fractions', [...inverse.terms.map((term) => termText(term, 'z', true)), ...inverse.direct.map((coefficient, i) => `${fmt(coefficient, 5)}·z⁻${i}`)].join('  +  '))}${readout('h[n] (causal)', `${inverse.expression}${inverse.direct.length ? ' + direct terms' : ''}, n ≥ 0`)}${readout('Region of convergence', `|z| > ${fmt(inverse.rocRadius, 5)}`)}${readout('Stability', inverse.stable ? 'stable (ROC includes the unit circle)' : 'unstable (a pole on or outside the unit circle)')}${readout('Long division (first terms)', division.map((value) => fmt(value, 5)).join(', '))}<p class="field-help">The closed-form h[n] equals the long-division series and the difference equation (and matches scipy.signal.residuez).</p></div></div>`;
    return { controls, body };
  }
  const x = parseCoefficients(c.samples, 'Samples');
  const dft = dftSteps(x);
  const power2 = x.length >= 2 && (x.length & (x.length - 1)) === 0 && x.length <= 16;
  const fft = power2 ? fftButterflies(x) : null;
  const controls = text('dft.samples', 'Sequence x[n] (up to 32 numbers)', c.samples, '1 2 3 4');
  const ks = dft.rows.map((row) => row.k);
  const expansion = dft.N <= 8 ? dft.rows.map((row) => `<tr><td>X[${row.k}]</td><td class="dft-terms">${row.terms.map((term) => `${fmt(x[term.n], 3)}·W<sub>${dft.N}</sub><sup>${term.exponent}</sup>`).join(' + ')}</td><td>${esc(complexText(row.value))}</td></tr>`).join('') : '';
  const butterflies = fft ? (() => {
    const width = 160 + fft.stages.length * 170, rowH = 34, height = fft.N * rowH + 30;
    const col = (s) => 90 + s * 170;
    const y = (i) => 24 + i * rowH;
    const parts = [];
    fft.bitReversedOrder.forEach((n, i) => parts.push(`<text x="4" y="${y(i) + 4}" class="bf-label">x[${n}] = ${fmt(x[n], 3)}</text>`));
    fft.stages.forEach((stage, s) => {
      for (const bf of stage.butterflies) {
        parts.push(`<path class="bf-line" d="M${col(s)} ${y(bf.top)} L${col(s + 1)} ${y(bf.top)} M${col(s)} ${y(bf.bottom)} L${col(s + 1)} ${y(bf.bottom)} M${col(s)} ${y(bf.top)} L${col(s + 1)} ${y(bf.bottom)} M${col(s)} ${y(bf.bottom)} L${col(s + 1)} ${y(bf.top)}"/><text x="${col(s) + 6}" y="${y(bf.bottom) - 4}" class="bf-twiddle">${esc(bf.twiddle)}</text>`);
      }
      stage.values.forEach((value, i) => parts.push(`<text x="${col(s + 1) - 4}" y="${y(i) - 6}" class="bf-value" text-anchor="end">${esc(complexText(value))}</text>`));
    });
    fft.output.forEach((_, k) => parts.push(`<text x="${col(fft.stages.length) + 8}" y="${y(k) + 4}" class="bf-label">X[${k}]</text>`));
    return `<div class="gantt-scroll"><svg viewBox="0 0 ${width + 60} ${height}" width="${width + 60}" height="${height}" class="butterfly">${parts.join('')}</svg></div>`;
  })() : '<p class="field-help">The butterfly diagram is shown for 2, 4, 8 or 16 samples.</p>';
  const body = `<div class="power-grid"><div>${renderPlotFrame({ title: '|X[k]|', series: [{ xs: ks, ys: dft.rows.map((row) => row.magnitude), color: PLOT_COLORS[0], stem: true }], xMin: 0, xMax: Math.max(1, dft.N - 1), xTicks: indexTicks(0, Math.max(1, dft.N - 1)), yRange: niceRange(0, Math.max(...dft.rows.map((row) => row.magnitude), 1e-9)), formatY: (value) => fmt(value, 3) })}${renderPlotFrame({ title: '∠X[k] (degrees)', series: [{ xs: ks, ys: dft.rows.map((row) => (row.magnitude < 1e-12 ? 0 : row.phase)), color: PLOT_COLORS[3], stem: true }], xMin: 0, xMax: Math.max(1, dft.N - 1), xTicks: indexTicks(0, Math.max(1, dft.N - 1)), yRange: niceRange(-180, 180), formatY: (value) => `${fmt(value, 3)}°` })}</div>
    <div>${expansion ? `<table class="truth-table comm-table power-table"><thead><tr><th>k</th><th>X[k] = Σ x[n]·W<sub>N</sub><sup>nk</sup></th><th>Value</th></tr></thead><tbody>${expansion}</tbody></table>` : ''}<div class="analysis-readouts">${readout('W_N = e^(−j2π/N)', complexText(dft.twiddles[1] ?? { re: 1, im: 0 }))}${readout('Direct DFT', `${dft.operations.multiplications} complex multiplications`)}${fft ? readout('Radix-2 FFT', `${fft.operations.multiplications} complex multiplications in ${fft.stages.length} stages`) : ''}</div></div></div>${fft ? `<span class="panel-label">DECIMATION-IN-TIME FFT BUTTERFLIES (inputs in bit-reversed order)</span>${butterflies}` : butterflies}`;
  return { controls, body };
}
export function renderSigsys(state) {
  const config = sigLab.configuration(state);
  let view;
  try { view = renderSigsysTab(config); } catch (error) { view = { controls: '', body: labError('sig', 'Signals & systems', error) }; }
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'sigsys'), 'SIGNALS & SYSTEMS', '')}${labTabs(SIGSYS_TABS, config.tab, 'data-sig-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindSigsysEvents() {
  bindLabControls('sig', sigLab, ['type']);
  document.querySelectorAll('[data-sig-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.sigText.split('.'); sigLab.persist((config) => { config[group][key] = input.value; }); }));
  document.querySelectorAll('[data-sig-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.sigRange.split('.'); sigLab.persist((config) => { config[group][key] = Number(input.value); }); }));
}
