// Biomedical Signals workspace. Entry points: renderBio(state); bindBioEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { decimate, niceRange } from '../../core/circuit-plot.js';
import { bandPowers, cleanEcg, EEG_STATES, hrv, hrvSpectrum, panTompkins, scoreDetections, synthesizeEcg, synthesizeEeg } from '../../../packages/biomed/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const BIO_TABS = [['ecg', 'ECG & QRS detection'], ['hrv', 'Heart-rate variability'], ['eeg', 'EEG rhythms'], ['import', 'Your recording']];
const bioLab = makeLab('bio-lab', {
  tab: 'ecg',
  ecg: { heartRate: 72, hrvStd: 0.03, pvcEvery: 0, baseline: 0.3, mains: 0.05, mainsFrequency: 50, emg: 0.02, duration: 10, seed: 1, clean: 'yes' },
  hrv: { heartRate: 70, hrvStd: 0.04, rsa: 0.05, respiration: 0.25, duration: 180, seed: 2 },
  eeg: { state: 'relaxed', noise: 3, blinks: 0, duration: 30, seed: 1 },
  import: { samples: '', sampleRate: 360, kind: 'ecg' },
});
const bioField = (...args) => groupField('data-bio-field')(...args);
const scatterPlot = (title, xs, ys, unit) => {
  const size = 260, lo = Math.min(...xs, ...ys), hi = Math.max(...xs, ...ys), span = hi - lo || 1, p = (v) => (16 + (v - lo) / span * (size - 32)).toFixed(1), q = (v) => (size - 16 - (v - lo) / span * (size - 32)).toFixed(1);
  return `<div class="sdr-const"><span class="panel-label">${esc(title)}</span><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(title)}"><path class="axis" d="M16 ${size - 16}H${size - 16}M16 16V${size - 16}"/><path class="axis" d="M16 ${size - 16}L${size - 16} 16" stroke-dasharray="4 3"/>${xs.map((x, i) => `<circle cx="${p(x)}" cy="${q(ys[i])}" r="2.5"/>`).join('')}<text x="20" y="12" class="bio-axis">${fmt(hi, 4)} ${unit}</text><text x="${size - 70}" y="${size - 4}" class="bio-axis">${fmt(lo, 4)} ${unit}</text></svg></div>`;
};
function ecgReport(signal, fs, truth = null) {
  const pt = panTompkins(signal, fs);
  const ts = Array.from(signal, (_, k) => k / fs);
  const stages = linePlot('Pan–Tompkins stages: band-pass 5–15 Hz and moving-window integration (scaled)', ts, [{ name: 'band-passed', values: Array.from(pt.bandpassed) }, { name: 'integrated', values: Array.from(pt.integrated, (v) => v / Math.max(...pt.integrated) * Math.max(...pt.bandpassed.map(Math.abs))) }], { xLabel: (v) => `${fmt(v, 3)} s` });
  const ecgPlot = renderPlotFrame({ title: 'ECG (mV) with detected R peaks', series: [{ ...decimate(ts, Array.from(signal), 2400), color: PLOT_COLORS[0], primary: true }, { xs: pt.rPeaks.map((p) => p / fs), ys: pt.rPeaks.map((p) => signal[p]), color: '#ef4444', stem: true }], xMin: 0, xMax: ts.at(-1), xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: `${fmt(ts.at(-1) * k / 5, 3)} s` })), yRange: niceRange(Math.min(...signal), Math.max(...signal)), formatY: (v) => fmt(v, 3) });
  const score = truth ? scoreDetections(pt.rPeaks, truth, fs) : null;
  let h = null; try { h = hrv(pt.rPeaks, fs); } catch { h = null; }
  return { pt, ecgPlot, stages, score, h };
}
function renderBioTab(config) {
  const c = config[config.tab];
  if (config.tab === 'ecg') {
    const ecg = synthesizeEcg({ duration: Math.min(60, c.duration), heartRate: c.heartRate, hrvStd: c.hrvStd, pvcEvery: Math.round(c.pvcEvery), baseline: c.baseline, mains: c.mains, mainsFrequency: c.mainsFrequency, emg: c.emg, seed: Math.round(c.seed) });
    const shown = c.clean === 'yes' ? cleanEcg(ecg.signal, ecg.sampleRate, { notch: c.mainsFrequency }) : ecg.signal;
    const report = ecgReport(shown, ecg.sampleRate, ecg.beats.map((b) => b.sample));
    const ts = Array.from(ecg.signal, (_, k) => k / ecg.sampleRate);
    const controls = `${bioField('ecg.heartRate', 'Heart rate', c.heartRate, 'bpm')}${bioField('ecg.hrvStd', 'Beat-to-beat variability', c.hrvStd)}${bioField('ecg.pvcEvery', 'Ectopic beat every (0 = none)', c.pvcEvery)}${bioField('ecg.baseline', 'Baseline wander', c.baseline, 'mV')}${bioField('ecg.mains', 'Mains hum', c.mains, 'mV')}${labSelect('data-bio-select', 'ecg.mainsFrequency', 'Mains frequency', c.mainsFrequency, [[50, '50 Hz (India, Europe)'], [60, '60 Hz']])}${bioField('ecg.emg', 'Muscle noise', c.emg, 'mV')}${bioField('ecg.duration', 'Duration', c.duration, 's')}${bioField('ecg.seed', 'Seed', c.seed)}${labSelect('data-bio-select', 'ecg.clean', 'Clean before detection', c.clean, [['yes', 'Yes: 0.5 Hz high-pass, notch, 40 Hz low-pass'], ['no', 'No (raw)']])}`;
    const body = `<div>${linePlot('Raw ECG (mV)', ts, [{ name: 'raw', values: Array.from(ecg.signal) }, { name: 'true clean ECG', values: Array.from(ecg.clean), color: '#64748b', dashed: true }], { xLabel: (v) => `${fmt(v, 3)} s` })}${report.ecgPlot}${report.stages}</div>
      <div class="analysis-readouts">${readout('Beats in the recording', ecg.beats.length)}${readout('Detected', report.pt.rPeaks.length)}${readout('Sensitivity / positive predictivity', `${fmt(report.score.sensitivity * 100, 4)} % / ${fmt(report.score.ppv * 100, 4)} %`)}${report.h ? readout('Heart rate', `${fmt(report.h.meanHr, 4)} bpm (min ${fmt(report.h.minHr, 4)}, max ${fmt(report.h.maxHr, 4)})`) : ''}<p class="field-help">Pan–Tompkins: band-pass 5–15 Hz → derivative → square → 150 ms moving-window integration → adaptive thresholds (signal and noise levels updated with every peak), 200 ms refractory period and search-back after 166 % of the mean RR. Cleaning uses forward–backward (zero-phase) biquads so R peaks do not move.</p></div>`;
    return { controls, body };
  }
  if (config.tab === 'hrv') {
    const ecg = synthesizeEcg({ duration: Math.min(600, c.duration), heartRate: c.heartRate, hrvStd: c.hrvStd, rsa: c.rsa, respiration: c.respiration, seed: Math.round(c.seed), emg: 0.01, mains: 0, baseline: 0.1 });
    const peaks = panTompkins(ecg.signal, ecg.sampleRate).rPeaks, h = hrv(peaks, ecg.sampleRate), spectrum = hrvSpectrum(peaks, ecg.sampleRate);
    const beatsIndex = h.rr.map((_, i) => i + 1);
    const controls = `${bioField('hrv.heartRate', 'Mean heart rate', c.heartRate, 'bpm')}${bioField('hrv.hrvStd', 'Random variability', c.hrvStd)}${bioField('hrv.rsa', 'Respiratory modulation', c.rsa)}${bioField('hrv.respiration', 'Breathing rate', c.respiration, 'Hz')}${bioField('hrv.duration', 'Recording', c.duration, 's')}${bioField('hrv.seed', 'Seed', c.seed)}`;
    const keep = spectrum.frequency.map((f, i) => (f <= 0.5 ? i : -1)).filter((i) => i >= 0);
    const body = `<div class="power-grid"><div>${linePlot('RR tachogram (ms) against beat number', beatsIndex, [{ name: 'RR', values: h.rr }], { xLabel: (v) => fmt(v, 3) })}${linePlot('RR power spectrum (ms²/Hz), 4 Hz resampling, Welch', keep.map((i) => spectrum.frequency[i]), [{ name: 'PSD', values: keep.map((i) => spectrum.power[i]) }], { xLabel: (v) => `${fmt(v, 3)} Hz` })}</div>
      <div><div class="analysis-readouts">${readout('Mean HR / mean RR', `${fmt(h.meanHr, 4)} bpm / ${fmt(h.meanRr, 4)} ms`)}${readout('SDNN', `${fmt(h.sdnn, 4)} ms`)}${readout('RMSSD', `${fmt(h.rmssd, 4)} ms`)}${readout('pNN50', `${fmt(h.pnn50 * 100, 4)} %`)}${readout('Poincaré SD1 / SD2', `${fmt(h.sd1, 4)} / ${fmt(h.sd2, 4)} ms`)}${readout('LF (0.04–0.15 Hz) / HF (0.15–0.4 Hz)', `${fmt(spectrum.lf, 4)} / ${fmt(spectrum.hf, 4)} ms² — LF/HF ${fmt(spectrum.ratio, 4)}`)}</div>${scatterPlot('Poincaré plot: RRₙ₊₁ against RRₙ', h.rr.slice(0, -1), h.rr.slice(1), 'ms')}<p class="field-help">Breathing at 0.15–0.4 Hz modulates the heart through the vagus nerve (respiratory sinus arrhythmia) and shows up as HF power; set the breathing rate to 0.1 Hz to move it into LF.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'eeg') {
    const eeg = synthesizeEeg({ state: c.state, noise: c.noise, blinks: Math.round(c.blinks), duration: Math.min(120, c.duration), seed: Math.round(c.seed) });
    const powers = bandPowers(eeg.signal, eeg.sampleRate);
    const show = Math.min(eeg.signal.length, eeg.sampleRate * 5), ts = Array.from({ length: show }, (_, k) => k / eeg.sampleRate);
    const keep = powers.psd.frequency.map((f, i) => (f > 0 && f <= 45 ? i : -1)).filter((i) => i >= 0);
    const controls = `${labSelect('data-bio-select', 'eeg.state', 'Brain state', c.state, Object.entries(EEG_STATES).map(([id, s]) => [id, s.label]))}${bioField('eeg.noise', 'Noise', c.noise, 'µV')}${bioField('eeg.blinks', 'Eye blinks', c.blinks)}${bioField('eeg.duration', 'Duration', c.duration, 's')}${bioField('eeg.seed', 'Seed', c.seed)}`;
    const body = `<div class="power-grid"><div>${linePlot('EEG, first 5 s (µV)', ts, [{ name: 'EEG', values: Array.from(eeg.signal.slice(0, show)) }], { xLabel: (v) => `${fmt(v, 3)} s` })}${renderPlotFrame({ title: 'Power spectral density (dB µV²/Hz), Welch 2 s', series: [{ xs: keep.map((i) => powers.psd.frequency[i]), ys: keep.map((i) => 10 * Math.log10(Math.max(1e-6, powers.psd.power[i]))), color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: 45, xTicks: [0, 4, 8, 13, 30, 45].map((f) => ({ position: f / 45, text: `${f} Hz` })), yRange: niceRange(Math.min(...keep.map((i) => 10 * Math.log10(Math.max(1e-6, powers.psd.power[i])))), Math.max(...keep.map((i) => 10 * Math.log10(Math.max(1e-6, powers.psd.power[i]))))), formatY: (v) => fmt(v, 3) })}</div>
      <div><span class="panel-label">RELATIVE BAND POWER</span><div class="rx-bars">${powers.bands.map((b) => `<div><span>${b.name} ${b.lo}–${b.hi} Hz</span><i style="width:${(100 * b.relative).toFixed(1)}%"></i><b>${fmt(b.relative * 100, 3)} %</b></div>`).join('')}</div><div class="analysis-readouts">${readout('Dominant rhythm', powers.dominant)}${readout('Spectral peak', `${fmt(powers.peakFrequency, 4)} Hz`)}${readout('θ/β ratio', fmt(powers.thetaBetaRatio, 4))}${readout('Total power 0.5–45 Hz', `${fmt(powers.total, 5)} µV²`)}</div><p class="field-help">Eyes-closed relaxation shows a strong alpha peak near 10 Hz; alertness shifts power to beta, drowsiness to theta and deep sleep to delta. Blinks add large low-frequency transients that inflate delta.</p></div></div>`;
    return { controls, body };
  }
  const values = String(c.samples).split(/[\s,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  const controls = `<label class="em-text">Samples (numbers separated by commas, spaces or new lines)<textarea rows="5" spellcheck="false" data-bio-text="import.samples">${esc(c.samples)}</textarea></label>${bioField('import.sampleRate', 'Sample rate', c.sampleRate, 'Hz')}${labSelect('data-bio-select', 'import.kind', 'Signal', c.kind, [['ecg', 'ECG → QRS and heart rate'], ['eeg', 'EEG → band powers']])}`;
  if (values.length < c.sampleRate * 3) return { controls, body: `<p class="field-help">Paste at least 3 seconds of samples (${Math.round(c.sampleRate * 3)} values) exported from a data logger, an Arduino or a PhysioNet CSV. Nothing leaves your computer.</p>` };
  const x = Float64Array.from(values.slice(0, 600 * c.sampleRate));
  if (c.kind === 'eeg') {
    const powers = bandPowers(x, c.sampleRate);
    return { controls, body: `<div class="rx-bars">${powers.bands.map((b) => `<div><span>${b.name}</span><i style="width:${(100 * b.relative).toFixed(1)}%"></i><b>${fmt(b.relative * 100, 3)} %</b></div>`).join('')}</div>${readout('Dominant rhythm', `${powers.dominant}, peak ${fmt(powers.peakFrequency, 4)} Hz`)}` };
  }
  const report = ecgReport(cleanEcg(x, c.sampleRate, { notch: 0 }), c.sampleRate);
  return { controls, body: `<div>${report.ecgPlot}${report.stages}</div><div class="analysis-readouts">${readout('Beats detected', report.pt.rPeaks.length)}${report.h ? `${readout('Heart rate', `${fmt(report.h.meanHr, 4)} bpm`)}${readout('SDNN / RMSSD', `${fmt(report.h.sdnn, 4)} / ${fmt(report.h.rmssd, 4)} ms`)}` : ''}</div>` };
}
export function renderBio(state) {
  const config = bioLab.configuration(state);
  let view;
  try { view = renderBioTab(config); } catch (error) { view = { controls: '', body: labError('bio', 'Biomedical signals', error) }; }
  return `<div class="page scroll-page power-page sigsys-page bio-page">${pageHeader(modules.find((item) => item.id === 'biomed'), 'BIOMEDICAL SIGNAL PROCESSING', '')}${labTabs(BIO_TABS, config.tab, 'data-bio-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindBioEvents() {
  bindLabControls('bio', bioLab, ['clean', 'state', 'kind']);
  document.querySelectorAll('[data-bio-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.bioText.split('.'); bioLab.persist((config) => { config[group][key] = input.value; }); }));
}
