// Speech Processing workspace. Entry points: renderSpeech(state); bindSpeechEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify } from '../../core/store.js';
import { cepstrum, formants, hamming, lpc, lpcSpectrum, melFilterbank, mfcc, pitchAmdf, pitchAutocorrelation, powerSpectrum, shortTimeFeatures, spectrogram, synthesizeNoise, synthesizeVowel } from '../../../packages/speech/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot, PLOT_COLORS } from '../../components/plots.js';
import { groupField, labSelect } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const SPEECH_TABS = [['waveform', 'Energy & ZCR'], ['pitch', 'Pitch'], ['lpc', 'LPC & formants'], ['spectrogram', 'Spectrogram'], ['mfcc', 'MFCC']];
// Peterson & Barney (1952) average male formants F1–F3 (Hz).
const VOWELS = { a: ['/ɑ/ as in "father"', [730, 1090, 2440]], i: ['/i/ as in "beet"', [270, 2290, 3010]], u: ['/u/ as in "boot"', [300, 870, 2240]], e: ['/ɛ/ as in "bet"', [530, 1840, 2480]], o: ['/ɔ/ as in "bought"', [570, 840, 2410]] };
const speechLab = makeLab('speech-lab', {
  tab: 'waveform',
  source: { kind: 'vowel', vowel: 'a', f0: 120, frameMs: 200, order: 10 },
  waveform: {}, pitch: {}, lpc: {}, spectrogram: {}, mfcc: {},
});
const speechField = groupField('data-speech-field');
// Recorded or loaded audio lives only in memory (it is not saved into the project).
let speechAudio = null;
function speechSignal(source) {
  if (source.kind === 'recorded' && speechAudio) return speechAudio;
  const fs = 8000, formantsHz = VOWELS[source.vowel]?.[1] ?? VOWELS.a[1];
  const bandwidths = [90, 110, 170];
  const vowel = synthesizeVowel({ f0: source.f0, formants: formantsHz.map((f, k) => [f, bandwidths[k]]), fs, duration: 0.4 });
  // Vowel, a short pause and a fricative, so every analysis has something to show.
  return { fs, samples: [...vowel, ...new Array(800).fill(0), ...synthesizeNoise({ fs, duration: 0.15 })], label: `synthetic ${VOWELS[source.vowel]?.[0] ?? ''} at ${source.f0} Hz + pause + "s"` };
}
function heatmap(label, matrix, { xLabels = [], yLabels = [], min = null, max = null } = {}) {
  const rows = matrix[0]?.length ?? 0, cols = matrix.length;
  if (!rows || !cols) return '';
  const values = matrix.flat().filter(Number.isFinite);
  const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values);
  const w = 600, h = 220, cw = w / cols, ch = h / rows;
  const colour = (v) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1))); return `hsl(${(260 - 220 * t).toFixed(0)},85%,${(12 + 50 * t).toFixed(0)}%)`; };
  const cells = matrix.map((column, x) => column.map((v, y) => `<rect x="${(x * cw).toFixed(2)}" y="${(h - (y + 1) * ch).toFixed(2)}" width="${(cw + 0.6).toFixed(2)}" height="${(ch + 0.6).toFixed(2)}" fill="${colour(v)}"/>`).join('')).join('');
  return `<div class="circuit-plot"><span class="plot-title">${esc(label)}</span><svg class="heatmap" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">${cells}</svg><div class="heatmap-axis"><span>${esc(xLabels[0] ?? '')}</span><span>${esc(yLabels.join(' · '))}</span><span>${esc(xLabels[1] ?? '')}</span></div></div>`;
}
function renderSpeechTab(config) {
  const s = config.source;
  const audio = speechSignal(s);
  const { fs, samples } = audio;
  const frameStart = Math.max(0, Math.min(samples.length - 400, Math.round(s.frameMs / 1000 * fs)));
  const frameLength = Math.round(0.04 * fs);
  const frame = samples.slice(frameStart, frameStart + frameLength);
  const sourceControls = `${labSelect('data-speech-select', 'source.kind', 'Signal', s.kind, [['vowel', 'Synthetic vowel'], ['recorded', speechAudio ? `Recorded / loaded (${fmt(speechAudio.samples.length / speechAudio.fs, 3)} s)` : 'Recorded / loaded (none yet)']])}${s.kind === 'vowel' ? `${labSelect('data-speech-select', 'source.vowel', 'Vowel', s.vowel, Object.entries(VOWELS).map(([id, v]) => [id, v[0]]))}${speechField('source.f0', 'Pitch f0', s.f0, 'Hz')}` : ''}${speechField('source.frameMs', 'Analysis frame at', s.frameMs, 'ms')}<button class="button" data-speech-record>● Record 2 s</button><label class="button file-button">Load WAV<input type="file" accept="audio/*,.wav" data-speech-file hidden></label><button class="button" data-speech-play>▶ Play</button>`;
  const t = samples.map((_, k) => k / fs);
  if (config.tab === 'waveform') {
    const st = shortTimeFeatures(samples, { fs });
    const eMax = Math.max(...st.energy, 1e-12);
    const counts = st.label.reduce((acc, l) => ({ ...acc, [l]: (acc[l] ?? 0) + 1 }), {});
    const body = `<div class="power-grid"><div>${linePlot(`Waveform — ${audio.label ?? 'recorded audio'}`, t, [{ name: 'x(t)', values: samples }], { xLabel: (x) => `${fmt(x * 1000, 3)} ms` })}${linePlot('Short-time energy (normalised) and zero-crossing rate per frame', st.times, [{ name: 'energy', values: st.energy.map((e) => e / eMax) }, { name: 'ZCR (crossings/sample)', values: st.zcr, color: '#f97316' }], { xLabel: (x) => `${fmt(x * 1000, 3)} ms`, yMin: 0, yMax: 1 })}<div class="vuv-strip">${st.label.map((l) => `<i class="${l}" title="${l}"></i>`).join('')}</div><div class="plot-legend"><span class="legend-chip" style="--chip:#34d399">voiced</span><span class="legend-chip" style="--chip:#f97316">unvoiced</span><span class="legend-chip" style="--chip:#475569">silence</span></div></div>
      <div class="analysis-readouts">${readout('Sampling rate', eng(fs, 'Hz'))}${readout('Frames (25 ms every 10 ms)', String(st.label.length))}${readout('Voiced / unvoiced / silence frames', `${counts.voiced ?? 0} / ${counts.unvoiced ?? 0} / ${counts.silence ?? 0}`)}<p class="field-help">Voiced sounds (vowels) are loud and periodic, so they cross zero rarely; unvoiced sounds (s, f, sh) are noise-like with a high zero-crossing rate and low energy; silence has neither. This simple rule is the first stage of most speech systems.</p></div></div>`;
    return { controls: sourceControls, body };
  }
  if (config.tab === 'pitch') {
    const ac = pitchAutocorrelation(frame, { fs }), am = pitchAmdf(frame, { fs }), cp = cepstrum(frame, { fs });
    const step = Math.round(0.01 * fs), track = [];
    for (let start = 0; start + frameLength <= samples.length; start += step) {
      const f = samples.slice(start, start + frameLength);
      const e = f.reduce((a, v) => a + v * v, 0) / f.length;
      const p = pitchAutocorrelation(f, { fs });
      track.push({ t: (start + frameLength / 2) / fs, f0: e > 1e-4 && p.strength > 0.3 ? p.f0 : Number.NaN });
    }
    const lags = ac.autocorrelation.map((_, k) => k / fs * 1000);
    const body = `<div class="power-grid"><div>${linePlot('Autocorrelation of the centre-clipped frame against lag (ms)', lags, [{ name: 'r(τ)', values: ac.autocorrelation }], { xLabel: (x) => `${fmt(x, 3)} ms` })}${linePlot('AMDF against lag (ms) — the dips mark the period', am.amdf.map((_, k) => k / fs * 1000), [{ name: 'AMDF', values: am.amdf, color: '#f97316' }], { xLabel: (x) => `${fmt(x, 3)} ms` })}${linePlot('Pitch track (autocorrelation), unvoiced frames blank', track.map((p) => p.t), [{ name: 'f0', values: track.map((p) => p.f0), color: PLOT_COLORS[2] }], { xLabel: (x) => `${fmt(x * 1000, 3)} ms`, unit: 'Hz' })}</div>
      <div class="analysis-readouts">${readout('Frame', `${fmt(frameStart / fs * 1000, 4)} ms, ${frameLength} samples (40 ms)`)}${readout('Autocorrelation pitch', `${fmt(ac.f0, 5)} Hz (period ${fmt(1000 / ac.f0, 4)} ms, strength ${fmt(ac.strength, 3)})`)}${readout('AMDF pitch', `${fmt(am.f0, 5)} Hz`)}${readout('Cepstral pitch', `${fmt(cp.f0, 5)} Hz (quefrency ${cp.quefrency} samples)`)}<p class="field-help">Three classic methods: the autocorrelation peaks at the pitch period; the AMDF dips there; the cepstrum separates the fast ripple of the harmonics (pitch) from the slow envelope (vocal tract). Centre clipping removes the formant ripple that causes octave errors.</p></div></div>`;
    return { controls: sourceControls, body };
  }
  if (config.tab === 'lpc') {
    const order = Math.max(2, Math.min(24, Math.round(s.order)));
    const model = lpc(frame.length >= 2 * order ? frame : samples.slice(0, 400), order);
    const env = lpcSpectrum(model.a, model.gain, { fs, points: 257 });
    const spec = powerSpectrum(frame.map((v, k) => v * hamming(frame.length)[k]), 512).map((p) => 10 * Math.log10(p + 1e-12));
    const shift = Math.max(...env.db) - Math.max(...spec);
    const found = formants(model.a, { fs });
    const cp = cepstrum(frame, { fs });
    const controls = `${sourceControls}${speechField('source.order', 'LPC order p', s.order)}`;
    const body = `<div class="power-grid"><div>${linePlot('Frame spectrum (dB) with the LPC envelope 20 log(G/|A|) and the cepstral envelope', spec.map((_, k) => k * fs / 512), [{ name: 'FFT |X|²', values: spec.map((v) => v + shift), color: '#64748b' }, { name: 'LPC envelope', values: env.freqs.map((_, k) => env.db[Math.min(k, env.db.length - 1)]).slice(0, spec.length) }, { name: 'cepstral envelope', values: cp.envelope.map((v) => 20 * v / Math.LN10 - 20 * cp.envelope[0] / Math.LN10 + env.db[0]).filter((_, k) => k % (cp.nfft / 512) === 0).slice(0, spec.length), color: '#f59e0b', dashed: true }], { xLabel: (x) => eng(x, 'Hz') })}${simpleTable(['Formant', 'Frequency', 'Bandwidth'], found.slice(0, 5).map((f, k) => [`F${k + 1}`, eng(f.frequency, 'Hz'), eng(f.bandwidth, 'Hz')]))}</div>
      <div class="analysis-readouts">${readout('Predictor a1 … ap', model.a.map((v) => fmt(v, 4)).join(', '))}${readout('Reflection (PARCOR) k1 … kp', model.reflection.map((v) => fmt(v, 3)).join(', '))}${readout('Prediction gain', `${fmt(10 * Math.log10(model.r[0] / model.error), 4)} dB`)}${s.kind === 'vowel' ? readout('True formants (synthesis)', VOWELS[s.vowel][1].map((f) => `${f} Hz`).join(', ')) : ''}<p class="field-help">Linear prediction models each sample as a weighted sum of the previous p samples. The Levinson–Durbin recursion solves for the weights from the autocorrelation; 1/A(z) is the all-pole vocal-tract filter and its pole angles are the formants. Rule of thumb: p = fs/1000 + 2.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'spectrogram') {
    const spec = spectrogram(samples, { fs, nfft: 256 });
    const binsStep = Math.max(1, Math.floor(spec.freqs.length / 64));
    const columns = spec.db.map((col) => col.filter((_, k) => k % binsStep === 0));
    const maxDb = Math.max(...spec.db.flat());
    const body = `<div class="power-grid"><div>${heatmap('Spectrogram: time → , frequency ↑ (0 to fs/2), brighter = louder', columns, { xLabels: ['0 ms', `${fmt(spec.times.at(-1) * 1000, 4)} ms`], yLabels: ['0 Hz at the bottom', `${eng(fs / 2, 'Hz')} at the top`], min: maxDb - 70, max: maxDb })}</div><div class="analysis-readouts">${readout('Window', '25 ms Hamming, 10 ms hop (wide-band would use 3–5 ms)')}${readout('Frequency resolution', eng(fs / 256, 'Hz'))}<p class="field-help">Horizontal dark bands in a vowel are the formants; the vertical striations are the glottal pulses. The fricative at the end is spread over high frequencies with no harmonic structure.</p></div></div>`;
    return { controls: sourceControls, body };
  }
  const coeffs = mfcc(samples, { fs, nfft: fs > 8000 ? 512 : 256, highFreq: fs / 2 });
  const bank = melFilterbank({ filters: 26, nfft: 256, fs: 8000 });
  const body = `<div class="power-grid"><div>${heatmap('MFCC c1 … c12 over time (c0 = log energy omitted)', coeffs.map((row) => row.slice(1)), { xLabels: ['0 ms', `${fmt(coeffs.length * 10, 4)} ms`], yLabels: ['c1 at the bottom', 'c12 at the top'] })}${linePlot('Mel filterbank (26 triangles, 8 kHz sampling) against frequency', bank[0].map((_, k) => k * 8000 / 256), bank.filter((_, k) => k % 2 === 0).map((row, k) => ({ name: `filter ${2 * k + 1}`, values: row, color: PLOT_COLORS[k % PLOT_COLORS.length] })).slice(0, 13), { xLabel: (x) => eng(x, 'Hz'), yMin: 0, yMax: 1 })}</div>
    <div class="analysis-readouts">${readout('Frames', String(coeffs.length))}${readout('Frame at the cursor', (coeffs[Math.min(coeffs.length - 1, Math.round(s.frameMs / 10))] ?? []).map((v) => fmt(v, 3)).join(', '))}${readout('Mel scale', 'mel = 2595·log10(1 + f/700)')}<p class="field-help">MFCCs: pre-emphasis, 25 ms frames, power spectrum, 26 mel-spaced triangular filters, log, DCT and liftering. They describe the spectral envelope compactly and are the standard input for speech recognisers. The numbers match python_speech_features.</p></div></div>`;
  return { controls: sourceControls, body };
}
export function renderSpeech(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'speech'), 'SPEECH PROCESSING', '')}${labCard('speech', 'Speech processing', SPEECH_TABS, speechLab.configuration(state), renderSpeechTab)}</div>`;
}
async function decodeToMono(arrayBuffer, targetRate = 8000) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await context.decodeAudioData(arrayBuffer);
  context.close?.();
  const data = buffer.getChannelData(0);
  const ratio = buffer.sampleRate / targetRate;
  const length = Math.min(Math.floor(data.length / ratio), targetRate * 10);
  // Average over each output sample's span (simple anti-alias low-pass).
  const samples = Array.from({ length }, (_, k) => { const a = Math.floor(k * ratio), b = Math.max(a + 1, Math.floor((k + 1) * ratio)); let s = 0; for (let i = a; i < b; i += 1) s += data[i]; return s / (b - a); });
  const peak = Math.max(...samples.map(Math.abs)) || 1;
  return { fs: targetRate, samples: samples.map((v) => v / peak), label: 'your audio' };
}
export function bindSpeechEvents() {
  bindLabControls('speech', speechLab, ['kind', 'vowel']);
  document.querySelectorAll('[data-speech-file]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try { speechAudio = await decodeToMono(await file.arrayBuffer()); speechLab.persist((config) => { config.source.kind = 'recorded'; config.source.frameMs = 200; }); notify(`Loaded ${file.name}`, 'success'); } catch (error) { notify(`Could not decode the audio: ${error.message}`, 'error'); }
  }));
  document.querySelectorAll('[data-speech-record]').forEach((button) => button.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { notify('This browser cannot record audio.', 'error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream), chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try { speechAudio = await decodeToMono(await new Blob(chunks).arrayBuffer()); speechLab.persist((config) => { config.source.kind = 'recorded'; }); notify('Recording ready', 'success'); } catch (error) { notify(`Could not decode the recording: ${error.message}`, 'error'); }
      };
      notify('Recording for 2 seconds — speak now', 'success');
      recorder.start();
      setTimeout(() => recorder.stop(), 2000);
    } catch (error) { notify(`Microphone not available: ${error.message}`, 'error'); }
  }));
  document.querySelectorAll('[data-speech-play]').forEach((button) => button.addEventListener('click', () => {
    const { fs, samples } = speechSignal(speechLab.configuration(getState()).source);
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = context.createBuffer(1, samples.length, fs);
      buffer.getChannelData(0).set(samples.map((v) => 0.8 * v));
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination); node.start();
      node.onended = () => context.close?.();
    } catch (error) { notify(`Cannot play audio: ${error.message}`, 'error'); }
  }));
}
