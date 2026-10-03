// Communication Lab (including the receiver and fibre tabs) workspace. Entry points: renderCommunication(state); bindCommLabEvents(), bindReceiverEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { niceRange } from '../../core/circuit-plot.js';
import { berCurve, convolutionalEncode, CRC_POLYNOMIALS, crcCheck, crcDivide, DIGITAL_SCHEMES, eyeDiagram, hammingDecode, hammingEncode, LINE_CODES, lineCode, samplingDemo, simulateAnalogModulation, simulateDigitalLink, viterbiDecode } from '../../../packages/communications/src/index.mjs';
import { fibreParameters, powerBudget, receiverChain, riseTimeBudget, superhet, tuningRange } from '../../../packages/commsys/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linearTicks, linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

function renderQpskLink(state) {
  const result = state.simulation?.kind === 'communication' ? state.simulation : null;
  const config = state.project.experiments.find((experiment) => experiment?.id === 'qpsk-ber')?.inputs || {};
  const points = result?.channel?.symbols || [];
  const plot = points.map((point) => `<circle cx="${150 + point.i * 100}" cy="${150 - point.q * 100}" r="4"/>`).join('');
  return `<section class="dsp-card"><div class="dsp-controls"><label>Bits<input data-comm-field="bits" value="${esc(config.bits ?? '00110110')}" maxlength="256" aria-label="Bit sequence"></label><label>Noise σ<input type="number" min="0" max="2" step="0.01" data-comm-field="sigma" value="${esc(config.sigma ?? 0.15)}"></label><button class="button run" data-action="run-communication">Run QPSK + BER</button></div>
    <div class="constellation"><span class="panel-label">CONSTELLATION</span><svg viewBox="0 0 300 300"><path d="M150 10V290M10 150H290"/>${plot}</svg></div>
    <div class="stat-grid"><div><span>Symbols</span><strong>${result?.channel?.symbols.length || '—'}</strong><small>QPSK</small></div><div><span>Errors</span><strong>${result?.ber?.errors ?? '—'}</strong><small>bit errors</small></div><div><span>BER</span><strong>${result ? fmt(result.ber.rate, 4) : '—'}</strong><small>measured</small></div></div>
    <p class="module-footnote">Seeded offline channel model. No GNU Radio flowgraph or SDR hardware is accessed.</p></section>`;
}
const COMM_DEFAULTS = Object.freeze({
  tab: 'link', scheme: 'am', carrierFrequency: 10000, messageFrequency: 1000, index: 0.5, deviation: 2405,
  digitalScheme: 'qpsk', ebN0dB: 6, bits: 20000, eyeAlpha: 0.35, eyePulse: 'raised-cosine', eyeEbN0dB: 20,
  signalFrequency: 1000, sampleRate: 8000, quantBits: 4, law: 'uniform', amplitude: 1, lineBits: '1011000110',
  hammingData: '1011', hammingFlips: [], crcMessage: '11010011101100', crcPolynomial: '1011', convData: '1011', convFlips: [],
});
const COMM_TABS = [['link', 'QPSK link'], ['analog', 'Analog modulation'], ['digital', 'Digital modulation & BER'], ['pcm', 'Sampling, PCM & line codes'], ['coding', 'Error-control coding'], ['receiver', 'Receiver & noise'], ['fibre', 'Optical fibre link']];
let analogCache = { key: null, value: null };
function commConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'comm-lab')?.inputs || {};
  return { ...COMM_DEFAULTS, ...saved };
}
function persistComm(patch) {
  recordExperiment({ id: 'comm-lab', kind: 'communication', operation: 'comm-lab', inputs: { ...commConfiguration(getState()), ...patch } });
}
const commField = (name, label, value, unit = '', attributes = 'type="number" step="any"') => `<label>${label}<input ${attributes} data-comm-lab-field="${name}" value="${esc(value)}">${unit ? `<span>${unit}</span>` : ''}</label>`;
const commSelect = (name, label, value, options) => `<label>${label}<select data-comm-lab-field="${name}">${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
function commPlot(title, xs, seriesList, unitX, formatY) {
  const values = seriesList.flatMap((series) => series.ys);
  const xMin = xs[0], xMax = xs.at(-1);
  return renderPlotFrame({ title, series: seriesList.map((series, index) => ({ xs, ys: series.ys, color: series.color || PLOT_COLORS[index], primary: index === 0 })), xMin, xMax, xTicks: linearTicks(xMin, xMax, unitX), yRange: niceRange(Math.min(...values), Math.max(...values)), formatY });
}
function renderAnalogTab(config) {
  const key = JSON.stringify([config.scheme, config.carrierFrequency, config.messageFrequency, config.index, config.deviation]);
  if (analogCache.key !== key) { try { analogCache = { key, value: simulateAnalogModulation({ scheme: config.scheme, carrierFrequency: Number(config.carrierFrequency), messageFrequency: Number(config.messageFrequency), index: Number(config.index), deviation: Number(config.deviation) }) }; } catch (error) { analogCache = { key, value: { error: error.message } }; } }
  const result = analogCache.value;
  const controls = `<div class="dsp-controls">${commSelect('scheme', 'Scheme', config.scheme, [['am', 'AM (DSB with carrier)'], ['dsb-sc', 'DSB-SC'], ['fm', 'FM'], ['pm', 'PM']])}${commField('carrierFrequency', 'Carrier fc', config.carrierFrequency, 'Hz')}${commField('messageFrequency', 'Message fm', config.messageFrequency, 'Hz')}${config.scheme === 'fm' ? commField('deviation', 'Peak deviation Δf', config.deviation, 'Hz') : config.scheme === 'dsb-sc' ? '' : commField('index', config.scheme === 'pm' ? 'Phase deviation kp' : 'Modulation index μ', config.index, config.scheme === 'pm' ? 'rad' : '')}</div>`;
  if (result.error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(result.error)}</span></div></section>`;
  const time = commPlot('Modulated signal and message', result.time, [{ ys: result.modulated }, { ys: result.message, color: PLOT_COLORS[1] }], 's', (value) => fmt(value, 2));
  const demodUnit = config.scheme === 'fm' ? 'Hz' : config.scheme === 'pm' ? 'rad' : 'V';
  const demod = commPlot(`Demodulated output (${config.scheme === 'am' ? 'envelope detector' : config.scheme === 'dsb-sc' ? 'coherent detector' : config.scheme === 'fm' ? 'frequency discriminator' : 'phase detector'})`, result.time, [{ ys: result.demodulated, color: PLOT_COLORS[2] }], 's', (value) => eng(value, demodUnit));
  const span = config.scheme === 'fm' || config.scheme === 'pm' ? result.metrics.carsonBandwidth * 1.3 : 6 * result.messageFrequency;
  const low = Math.max(0, result.carrierFrequency - span / 2), high = result.carrierFrequency + span / 2;
  const indices = result.spectrum.frequency.map((frequency, index) => frequency >= low && frequency <= high ? index : -1).filter((index) => index >= 0);
  const spectrum = commPlot('Spectrum (amplitude)', indices.map((index) => result.spectrum.frequency[index] / 1e3), [{ ys: indices.map((index) => result.spectrum.amplitude[index]), color: PLOT_COLORS[3] }], 'kHz', (value) => fmt(value, 3));
  const metrics = result.metrics;
  const readouts = config.scheme === 'fm' || config.scheme === 'pm'
    ? `${readout('Modulation index β', fmt(metrics.beta, 3))}${readout('Peak deviation', eng(metrics.peakDeviation, 'Hz'))}${readout('Carson bandwidth', eng(metrics.carsonBandwidth, 'Hz'))}`
    : `${readout('Bandwidth', eng(metrics.bandwidth, 'Hz'))}${readout('Sidebands', metrics.sidebands.map((value) => eng(value, 'Hz')).join(' · '))}${readout('Power efficiency η', `${fmt(metrics.efficiency * 100, 2)} %`)}${config.scheme === 'am' ? readout('Carrier / sideband power', `${fmt(metrics.carrierPower, 3)} / ${fmt(metrics.sidebandPower, 4)} W (1 Ω)`) : ''}`;
  const bessel = metrics.bessel ? `<table class="truth-table comm-table"><thead><tr><th>Line</th><th>Frequency</th><th>|J<sub>n</sub>(β)|</th></tr></thead><tbody>${metrics.bessel.map((line) => `<tr><td>${line.order ? `fc ± ${line.order}·fm` : 'carrier'}</td><td>${esc(eng(line.frequency, 'Hz'))}</td><td>${fmt(line.amplitude, 4)}</td></tr>`).join('')}</tbody></table>` : '';
  return `<section class="dsp-card">${controls}${result.warnings.map((warning) => `<div class="diagnostic warning"><b>Warning</b><span>${esc(warning)}</span></div>`).join('')}
    <div class="analysis-readouts comm-readouts">${readouts}</div><div class="analysis-plots comm-plots">${time}${spectrum}${demod}</div>${bessel}
    <p class="module-footnote">Ideal receivers built on the analytic signal; the spectrum uses a flat-top window so line amplitudes read directly.</p></section>`;
}
function renderConstellation(result) {
  const scale = 110, size = 300, centre = size / 2;
  const limit = Math.max(1.2, ...result.reference.map((point) => Math.max(Math.abs(point.i), Math.abs(point.q)) * 1.25));
  const position = (value) => centre + value / limit * scale;
  const received = result.received.map((point) => `<circle class="${point.error ? 'symbol-error' : 'symbol-ok'}" cx="${position(point.i).toFixed(1)}" cy="${(size - position(point.q)).toFixed(1)}" r="1.6"/>`).join('');
  const reference = result.reference.map((point) => `<circle class="symbol-reference" cx="${position(point.i).toFixed(1)}" cy="${(size - position(point.q)).toFixed(1)}" r="4"/><text class="symbol-label" x="${(position(point.i) + 6).toFixed(1)}" y="${(size - position(point.q) - 6).toFixed(1)}">${point.bits}</text>`).join('');
  return `<svg class="constellation-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="Received constellation"><path class="axis" d="M${centre} 8V${size - 8}M8 ${centre}H${size - 8}"/>${received}${reference}</svg>`;
}
function renderBerCurve(curve) {
  if (!curve) return '<p class="field-help">Press “Plot BER curve” to sweep Eb/N0 from 0 to 12 dB (100,000 bits per point).</p>';
  const width = 600, height = 220, left = 56, bottom = 24;
  const floor = -6;
  const x = (snr) => left + (snr - curve.points[0].ebN0dB) / (curve.points.at(-1).ebN0dB - curve.points[0].ebN0dB) * (width - left - 10);
  const y = (ber) => 8 + (Math.min(0, Math.max(floor, Math.log10(ber))) / floor) * (height - bottom - 8);
  const theoryPath = curve.points.map((point, index) => `${index ? 'L' : 'M'}${x(point.ebN0dB).toFixed(1)} ${y(point.theory).toFixed(1)}`).join('');
  const simulated = curve.points.filter((point) => point.simulated).map((point) => `<circle class="ber-point" cx="${x(point.ebN0dB).toFixed(1)}" cy="${y(point.simulated).toFixed(1)}" r="3.5"><title>${point.ebN0dB} dB: ${point.simulated.toExponential(2)} (${point.errors} errors)</title></circle>`).join('');
  const grid = Array.from({ length: -floor + 1 }, (_, k) => `<line class="ber-grid" x1="${left}" x2="${width - 10}" y1="${y(10 ** -k)}" y2="${y(10 ** -k)}"/><text class="ber-axis" x="${left - 6}" y="${y(10 ** -k) + 3}" text-anchor="end">${k ? `1e-${k}` : '1'}</text>`).join('');
  const xTicks = curve.points.map((point) => `<text class="ber-axis" x="${x(point.ebN0dB)}" y="${height - 6}" text-anchor="middle">${point.ebN0dB}</text>`).join('');
  return `<svg class="ber-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="BER versus Eb/N0">${grid}${xTicks}<path class="ber-theory" d="${theoryPath}"/>${simulated}<text class="ber-axis" x="${width - 12}" y="18" text-anchor="end">x: Eb/N0 (dB) · y: BER</text></svg><div class="plot-legend"><span class="legend-chip" style="--chip:#60a5fa">theory</span><span class="legend-chip" style="--chip:#f59e0b">simulated</span></div>`;
}
function renderEye(eye) {
  const width = 600, height = 200, samples = eye.traces[0].length;
  const extent = Math.max(1.6, ...eye.traces.flat().map(Math.abs));
  const x = (index) => 10 + index / (samples - 1) * (width - 20);
  const y = (value) => height / 2 - value / extent * (height / 2 - 10);
  const paths = eye.traces.map((trace) => `<path d="${trace.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join('')}"/>`).join('');
  return `<svg class="eye-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Eye diagram"><line class="ber-grid" x1="${x((samples - 1) / 2)}" x2="${x((samples - 1) / 2)}" y1="4" y2="${height - 4}"/><g class="eye-traces">${paths}</g></svg>`;
}
function renderDigitalTab(config, state) {
  let result, eye, error = '';
  try {
    result = simulateDigitalLink({ scheme: config.digitalScheme, ebN0dB: Number(config.ebN0dB), bits: Number(config.bits), seed: 11 });
    eye = eyeDiagram({ alpha: Number(config.eyeAlpha), pulse: config.eyePulse, ebN0dB: Number(config.eyeEbN0dB) });
  } catch (caught) { error = caught.message; }
  const controls = `<div class="dsp-controls">${commSelect('digitalScheme', 'Scheme', config.digitalScheme, Object.keys(DIGITAL_SCHEMES).map((key) => [key, { bpsk: 'BPSK', qpsk: 'QPSK', '8psk': '8-PSK', '16qam': '16-QAM' }[key]]))}${commField('ebN0dB', 'Eb/N0', config.ebN0dB, 'dB')}${commField('bits', 'Bits', config.bits, '', 'type="number" min="100" max="400000" step="100"')}<button class="button ghost" data-action="comm-ber-curve">Plot BER curve</button></div>`;
  if (error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(error)}</span></div></section>`;
  const curve = state.commBerCurve?.scheme === config.digitalScheme ? state.commBerCurve : null;
  return `<section class="dsp-card">${controls}
    <div class="comm-digital-layout"><div><span class="panel-label">RECEIVED CONSTELLATION (errors in red)</span>${renderConstellation(result)}</div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Measured BER', result.bitErrors ? result.ber.toExponential(3) : `0 (< ${(1 / result.bits).toExponential(1)})`)}${readout('Theoretical BER', result.theory.toExponential(3))}${readout('Bit errors', `${result.bitErrors} / ${result.bits.toLocaleString()}`)}${readout('Symbol error rate', result.ser.toExponential(3))}${readout('Noise σ per axis', fmt(result.sigma, 4))}</div>
    <span class="panel-label">BER VS EB/N0</span>${renderBerCurve(curve)}</div></div>
    <span class="panel-label">EYE DIAGRAM (POLAR BASEBAND)</span><div class="dsp-controls">${commSelect('eyePulse', 'Pulse', config.eyePulse, [['raised-cosine', 'Raised cosine'], ['rectangular', 'Rectangular']])}${config.eyePulse === 'raised-cosine' ? commField('eyeAlpha', 'Roll-off α', config.eyeAlpha, '', 'type="number" min="0" max="1" step="0.05"') : ''}${commField('eyeEbN0dB', 'Eb/N0', config.eyeEbN0dB, 'dB')}<div class="result-value"><span>Eye opening</span><b>${fmt(eye.opening * 100, 1)} %</b></div></div>${renderEye(eye)}</section>`;
}
function renderLineCodes(bits) {
  const codes = Object.keys(LINE_CODES).map((code) => lineCode(bits, code));
  const left = 150, width = 600, row = 46, height = codes.length * row + 30;
  const x = (position) => left + position / bits.length * width;
  const rows = codes.map((result, index) => {
    const mid = 22 + index * row, y = (level) => mid - level * 14;
    const path = result.segments.map((segment, k) => `${k ? `V${y(segment.level)}` : `M${x(segment.start)} ${y(segment.level)}`}H${x(segment.end)}`).join('');
    return `<text class="timing-name" x="${left - 10}" y="${mid + 4}">${esc(result.name)}</text><line class="timing-row" x1="${left}" x2="${left + width}" y1="${mid}" y2="${mid}"/><path class="timing-wave" d="${path}"/><text class="timing-time" x="${left + width + 30}" y="${mid + 4}">DC ${fmt(result.dcLevel, 2)}</text>`;
  }).join('');
  const bitLabels = [...bits].map((bit, index) => `<line class="timing-tick" x1="${x(index)}" x2="${x(index)}" y1="4" y2="${height - 20}"/><text class="timing-time" x="${x(index + 0.5)}" y="${height - 6}">${bit}</text>`).join('');
  return `<svg class="timing-diagram" viewBox="0 0 ${left + width + 70} ${height}" role="img" aria-label="Line code waveforms">${bitLabels}${rows}</svg>`;
}
function renderPcmTab(config) {
  let result, codes = '', error = '';
  try {
    result = samplingDemo({ signalFrequency: Number(config.signalFrequency), sampleRate: Number(config.sampleRate), bits: Number(config.quantBits), law: config.law, amplitude: Number(config.amplitude) });
    codes = renderLineCodes(String(config.lineBits));
  } catch (caught) { error = caught.message; }
  const controls = `<div class="dsp-controls">${commField('signalFrequency', 'Signal f', config.signalFrequency, 'Hz')}${commField('sampleRate', 'Sample rate fs', config.sampleRate, 'Hz')}${commField('quantBits', 'Bits n', config.quantBits, '', 'type="number" min="1" max="16" step="1"')}${commSelect('law', 'Quantizer', config.law, [['uniform', 'Uniform'], ['mu-law', 'μ-law (μ = 255)']])}${commField('amplitude', 'Amplitude', config.amplitude, '× full scale', 'type="number" min="0.001" max="1" step="0.01"')}</div>`;
  if (error) return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Input error</b><span>${esc(error)}</span></div></section>`;
  const width = 600, height = 200;
  const duration = result.analog.at(-1).t;
  const x = (t) => 10 + t / duration * (width - 20), y = (value) => height / 2 - value * (height / 2 - 12);
  const analog = result.analog.map((point, index) => `${index ? 'L' : 'M'}${x(point.t).toFixed(1)} ${y(point.value).toFixed(1)}`).join('');
  const stairs = result.samples.map((point, index) => `${index ? `V${y(point.quantized).toFixed(1)}` : `M${x(point.t).toFixed(1)} ${y(point.quantized).toFixed(1)}`}H${x(Math.min(duration, result.samples[index + 1]?.t ?? duration)).toFixed(1)}`).join('');
  const stems = result.samples.length <= 200 ? result.samples.map((point) => `<line class="pcm-stem" x1="${x(point.t).toFixed(1)}" x2="${x(point.t).toFixed(1)}" y1="${y(0)}" y2="${y(point.value).toFixed(1)}"/><circle class="pcm-sample" cx="${x(point.t).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="2.6"/>`).join('') : '';
  const plot = `<svg class="pcm-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sampling and quantization"><line class="ber-grid" x1="10" x2="${width - 10}" y1="${y(0)}" y2="${y(0)}"/><path class="pcm-analog" d="${analog}"/><path class="pcm-stairs" d="${stairs}"/>${stems}</svg><div class="plot-legend"><span class="legend-chip" style="--chip:#5eead4">analog signal</span><span class="legend-chip" style="--chip:#f59e0b">samples</span><span class="legend-chip" style="--chip:#a78bfa">quantized (zero-order hold)</span></div>`;
  return `<section class="dsp-card">${controls}${result.aliased ? `<div class="diagnostic warning"><b>Aliasing</b><span>fs = ${esc(eng(result.sampleRate, 'Hz'))} is below the Nyquist rate ${esc(eng(result.nyquistRate, 'Hz'))}: the samples look like a ${esc(eng(result.apparentFrequency, 'Hz'))} tone.</span></div>` : ''}
    <div class="analysis-readouts comm-readouts">${readout('Nyquist rate 2f', eng(result.nyquistRate, 'Hz'))}${readout('Apparent frequency', eng(result.apparentFrequency, 'Hz'))}${readout('PCM bit rate n·fs', eng(result.bitRate, 'bit/s'))}${readout('Measured SQNR', `${fmt(result.sqnr, 2)} dB`)}${readout(result.law === 'uniform' ? 'Theory 6.02n + 1.76 + 20log(A)' : 'Uniform-law theory (reference)', `${fmt(result.sqnrTheory, 2)} dB`)}</div>${plot}
    <span class="panel-label">LINE CODES</span><div class="dsp-controls">${commField('lineBits', 'Bits', config.lineBits, '', 'type="text" maxlength="64" spellcheck="false"')}</div>${codes}</section>`;
}
function renderBits(text, flips, kind, highlight = []) {
  return `<div class="bit-row">${[...text].map((bit, index) => `<button class="bit${flips.includes(index) ? ' flipped' : ''}${highlight.includes(index) ? ' parity' : ''}" data-comm-flip="${kind}:${index}" aria-label="Bit ${index + 1} is ${bit}${flips.includes(index) ? ', flipped by the channel' : ''}; click to flip">${bit}</button>`).join('')}</div>`;
}
function renderCodingTab(config) {
  const blocks = [];
  try {
    const encoded = hammingEncode(String(config.hammingData));
    const received = [...encoded.codeword].map((bit, index) => config.hammingFlips.includes(index) ? (bit === '1' ? '0' : '1') : bit).join('');
    const decoded = hammingDecode(received);
    blocks.push(`<div class="coding-block"><span class="panel-label">HAMMING (${encoded.n}, ${encoded.k}) — SINGLE-ERROR CORRECTION</span><div class="dsp-controls">${commField('hammingData', 'Data bits', config.hammingData, '', 'type="text" maxlength="26" spellcheck="false"')}</div>
      <div class="coding-line"><span>Codeword (parity at ${encoded.parityPositions.join(', ')})</span>${renderBits(encoded.codeword, [], 'none', encoded.parityPositions.map((position) => position - 1))}</div>
      <div class="coding-line"><span>Received — click bits to inject errors</span>${renderBits(received, config.hammingFlips, 'hamming')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Syndrome', `${decoded.syndrome} (${decoded.syndrome.toString(2).padStart(encoded.parityPositions.length, '0')})`)}${readout('Error position', decoded.errorPosition ?? 'none')}${readout('Decoded data', decoded.data)}${readout('Result', decoded.data === String(config.hammingData) ? 'correct' : 'wrong (more than one error)')}</div></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>Hamming</b><span>${esc(error.message)}</span></div>`); }
  try {
    const crc = crcDivide(String(config.crcMessage), String(config.crcPolynomial));
    const named = Object.entries(CRC_POLYNOMIALS);
    blocks.push(`<div class="coding-block"><span class="panel-label">CYCLIC REDUNDANCY CHECK</span><div class="dsp-controls">${commField('crcMessage', 'Message bits', config.crcMessage, '', 'type="text" maxlength="256" spellcheck="false"')}${commField('crcPolynomial', 'Generator (bits)', config.crcPolynomial, '', 'type="text" maxlength="33" spellcheck="false"')}<label>Standard<select data-comm-crc-preset><option value="">Choose…</option>${named.map(([name, bits]) => `<option value="${bits}">${esc(name)}</option>`).join('')}</select></label></div>
      <div class="analysis-readouts comm-readouts">${readout('Remainder (CRC)', crc.remainder)}${readout('Transmitted frame', crc.frame)}${readout('Receiver check', crcCheck(crc.frame, String(config.crcPolynomial)).valid ? 'remainder 0 — valid' : 'invalid')}</div>
      <pre class="crc-steps">${esc([`${config.crcMessage}${'0'.repeat(crc.degree)}   ← message + ${crc.degree} zeros`, ...crc.steps.map((step) => `${step.value}   XOR ${config.crcPolynomial} at bit ${step.shift}`)].join('\n'))}</pre></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>CRC</b><span>${esc(error.message)}</span></div>`); }
  try {
    const encoded = convolutionalEncode(String(config.convData));
    const received = [...encoded.encoded].map((bit, index) => config.convFlips.includes(index) ? (bit === '1' ? '0' : '1') : bit).join('');
    const decoded = viterbiDecode(received);
    blocks.push(`<div class="coding-block"><span class="panel-label">CONVOLUTIONAL CODE (RATE 1/2, K = 3, GENERATORS 7, 5) + VITERBI</span><div class="dsp-controls">${commField('convData', 'Data bits', config.convData, '', 'type="text" maxlength="32" spellcheck="false"')}</div>
      <div class="coding-line"><span>Encoded (with 2 tail bits)</span>${renderBits(encoded.encoded, [], 'none')}</div>
      <div class="coding-line"><span>Received — click bits to inject errors</span>${renderBits(received, config.convFlips, 'conv')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Viterbi output', decoded.decoded)}${readout('Path metric (bit differences)', decoded.pathMetric)}${readout('Result', decoded.decoded === String(config.convData) ? 'correct' : 'decoding error')}</div></div>`);
  } catch (error) { blocks.push(`<div class="diagnostic error"><b>Convolutional code</b><span>${esc(error.message)}</span></div>`); }
  return `<section class="dsp-card coding-card">${blocks.join('')}</section>`;
}
// Receiver planning and optical-fibre link design (Communication tabs).
const rxLab = makeLab('rx-lab', {
  receiver: { signal: 1e6, intermediate: 455e3, side: 'above', q: 100, bandLow: 540e3, bandHigh: 1650e3, stages: 'LNA 20 1.5 5\nBand-pass filter -2 2 100\nMixer -7 7 10\nIF amplifier 40 6 20', bandwidth: 10e3, snr: 10 },
  fibre: { n1: 1.48, n2: 1.46, core: 50, wavelength: 850, profile: 'graded', length: 2, attenuation: 3, splices: 1, spliceLoss: 0.3, connectors: 2, connectorLoss: 0.5, margin: 6, txPower: -10, rxSensitivity: -30, txRise: 1, rxRise: 2, dispersion: 100, spectralWidth: 40 },
});
const rxField = (...args) => groupField('data-rx-field')(...args);
function parseStages(text) {
  const stages = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const tokens = line.split(/\s+/);
    const numbers = [];
    while (tokens.length && Number.isFinite(Number(tokens.at(-1))) && numbers.length < 3) numbers.unshift(Number(tokens.pop()));
    if (numbers.length < 2) throw new RangeError(`Stage ${index + 1}: enter "name gain(dB) NF(dB) [IIP3 dBm]".`);
    const [gainDb, nfDb, iip3Dbm] = numbers.length === 3 ? numbers : [...numbers, Infinity];
    return { name: tokens.join(' ') || `Stage ${index + 1}`, gainDb, nfDb, iip3Dbm };
  });
  if (!stages.length) throw new RangeError('Add at least one receiver stage.');
  return stages;
}
function renderReceiverTab(state) {
  const c = rxLab.configuration(state).receiver;
  let content;
  try {
    const plan = superhet({ signal: c.signal, intermediate: c.intermediate, loAbove: c.side === 'above', q: c.q });
    const band = tuningRange({ low: c.bandLow, high: c.bandHigh, intermediate: c.intermediate, loAbove: c.side === 'above' });
    const chain = receiverChain({ stages: parseStages(c.stages), bandwidth: c.bandwidth, snrDb: c.snr });
    const freqs = [c.intermediate, plan.lo, c.signal, plan.image];
    const fMax = Math.max(...freqs) * 1.15;
    const fs = Array.from({ length: 400 }, (_, k) => fMax * (k + 1) / 400);
    const preselector = fs.map((f) => { const rho = f / c.signal - c.signal / f; return -10 * Math.log10(1 + (c.q * rho) ** 2); });
    const lines = [['IF', c.intermediate, PLOT_COLORS[3]], ['LO', plan.lo, '#f59e0b'], ['Signal', c.signal, PLOT_COLORS[0]], ['Image', plan.image, '#ef4444']];
    const range = niceRange(Math.max(-60, Math.min(...preselector)), 0);
    const spectrum = renderPlotFrame({ title: 'Frequency plan and the preselector response (dB)', series: [{ xs: fs, ys: preselector, color: '#64748b', primary: true }, ...lines.map(([, f, color]) => ({ xs: [f], ys: [range.min], color, stem: true }))], xMin: 0, xMax: fMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(fMax * k / 5, 'Hz') })), yRange: range, formatY: (value) => `${fmt(value, 3)} dB` });
    const rows = chain.noise.rows.map((row, index) => `<tr><td>${esc(row.name)}</td><td>${fmt(row.gainDb, 4)}</td><td>${fmt(row.nfDb, 4)}</td><td>${fmt(row.noiseTemperature, 4)} K</td><td>${fmt(row.contribution - (index === 0 ? 1 : 0), 4)}</td><td>${fmt(row.cumulativeNfDb, 4)}</td><td>${fmt(row.cumulativeGainDb, 4)}</td><td>${Number.isFinite(chain.linearity.rows[index].cumulativeIip3Dbm) ? fmt(chain.linearity.rows[index].cumulativeIip3Dbm, 4) : '∞'}</td></tr>`).join('');
    const share = chain.noise.rows.map((row, index) => [row.name, row.contribution - (index === 0 ? 1 : 0)]);
    const shareTotal = share.reduce((sum, [, value]) => sum + value, 0) || 1;
    content = `<div class="power-grid"><div>${spectrum}<div class="plot-legend">${lines.map(([name, f, color]) => `<span class="legend-chip" style="--chip:${color}">${name} ${eng(f, 'Hz')}</span>`).join('')}</div>
      <span class="panel-label">WHO ADDS THE NOISE (SHARE OF F − 1)</span><div class="rx-bars">${share.map(([name, value]) => `<div><span>${esc(name)}</span><i style="width:${(100 * value / shareTotal).toFixed(1)}%"></i><b>${fmt(100 * value / shareTotal, 3)} %</b></div>`).join('')}</div></div>
      <div><div class="analysis-readouts">${readout('Local oscillator', eng(plan.lo, 'Hz'))}${readout('Image frequency fs ± 2·IF', eng(plan.image, 'Hz'))}${readout('Image rejection √(1 + Q²ρ²)', `${fmt(plan.rejection, 5)} (${fmt(plan.rejectionDb, 4)} dB)`)}${readout('LO range for the band', `${eng(band.loLow, 'Hz')} – ${eng(band.loHigh, 'Hz')} (C ratio ${fmt(band.loCapacitanceRatio, 4)} vs ${fmt(band.signalCapacitanceRatio, 4)} for the RF stage)`)}${readout('Cascade noise figure (Friis)', `${fmt(chain.noise.nfDb, 4)} dB, Te = ${fmt(chain.noise.temperature, 5)} K`)}${readout('Total gain', `${fmt(chain.noise.gainDb, 4)} dB`)}${readout('Noise floor kTB·F', `${fmt(chain.sensitivity.noiseFloorDbm, 5)} dBm`)}${readout('Sensitivity (at the SNR above)', `${fmt(chain.sensitivity.sensitivityDbm, 5)} dBm = ${fmt(chain.sensitivity.sensitivityMicrovolts50, 4)} µV in 50 Ω`)}${readout('Cascade IIP3 / OIP3', Number.isFinite(chain.linearity.iip3Dbm) ? `${fmt(chain.linearity.iip3Dbm, 4)} / ${fmt(chain.linearity.oip3Dbm, 4)} dBm` : '∞')}${readout('Spurious-free dynamic range', Number.isFinite(chain.sfdrDb) ? `${fmt(chain.sfdrDb, 4)} dB` : '—')}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Stage</th><th>G dB</th><th>NF dB</th><th>Te</th><th>Adds to F</th><th>NF so far</th><th>G so far</th><th>IIP3 so far</th></tr></thead><tbody>${rows}</tbody></table><p class="field-help">F = F₁ + (F₂ − 1)/G₁ + (F₃ − 1)/(G₁G₂) + …: a lossy filter or mixer before the LNA ruins the noise figure; after enough gain, later stages hardly matter. Image rejection uses the single-tuned preselector of Kennedy's textbook.</p></div></div>`;
  } catch (error) { content = `<div class="diagnostic error"><b>Receiver</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${rxField('receiver.signal', 'Signal fs', c.signal, 'Hz')}${rxField('receiver.intermediate', 'IF', c.intermediate, 'Hz')}${labSelect('data-rx-select', 'receiver.side', 'LO injection', c.side, [['above', 'High side (fLO = fs + IF)'], ['below', 'Low side (fLO = fs − IF)']])}${rxField('receiver.q', 'Preselector Q', c.q)}${rxField('receiver.bandLow', 'Band from', c.bandLow, 'Hz')}${rxField('receiver.bandHigh', 'to', c.bandHigh, 'Hz')}<label class="em-text">Stages: name, gain dB, NF dB, IIP3 dBm<textarea rows="5" spellcheck="false" data-rx-text="receiver.stages">${esc(c.stages)}</textarea></label>${rxField('receiver.bandwidth', 'Bandwidth', c.bandwidth, 'Hz')}${rxField('receiver.snr', 'Required SNR', c.snr, 'dB')}`;
  return `<div class="power-page sigsys-page"><section class="dsp-card"><div class="dsp-controls">${controls}</div>${content}</section></div>`;
}
function renderFibreTab(state) {
  const c = rxLab.configuration(state).fibre;
  let content;
  try {
    const fibre = fibreParameters({ n1: c.n1, n2: c.n2, coreDiameter: c.core * 1e-6, wavelength: c.wavelength * 1e-9 });
    const budget = powerBudget({ txPowerDbm: c.txPower, rxSensitivityDbm: c.rxSensitivity, length: c.length, attenuation: c.attenuation, splices: c.splices, spliceLoss: c.spliceLoss, connectors: c.connectors, connectorLoss: c.connectorLoss, margin: c.margin });
    const rise = riseTimeBudget({ txRise: c.txRise * 1e-9, rxRise: c.rxRise * 1e-9, length: c.length, n1: c.n1, n2: c.n2, profile: c.profile, dispersion: c.dispersion, spectralWidth: c.spectralWidth, singleMode: fibre.singleMode });
    const xs = Array.from({ length: 201 }, (_, k) => c.length * k / 200);
    const splicesAt = Array.from({ length: Math.max(0, Math.round(c.splices)) }, (_, k) => c.length * (k + 1) / (Math.round(c.splices) + 1));
    const level = xs.map((x) => c.txPower - (c.connectors > 0 ? c.connectorLoss : 0) - c.attenuation * x - c.spliceLoss * splicesAt.filter((at) => at <= x).length - (x >= c.length ? Math.max(0, c.connectors - 1) * c.connectorLoss : 0));
    content = `<div class="power-grid"><div>${linePlot('Optical power along the link (dBm against km)', xs, [{ name: 'power', values: level }, { name: 'receiver sensitivity', values: xs.map(() => c.rxSensitivity), color: '#ef4444', dashed: true }, { name: 'sensitivity + margin', values: xs.map(() => c.rxSensitivity + c.margin), color: '#f59e0b', dashed: true }], { xLabel: (x) => `${fmt(x, 3)} km` })}
      <span class="panel-label">RISE-TIME BUDGET</span><div class="rx-bars">${rise.items.map(([name, value]) => `<div><span>${name}</span><i style="width:${(100 * value / rise.system).toFixed(1)}%"></i><b>${eng(value, 's')}</b></div>`).join('')}</div></div>
      <div><div class="analysis-readouts">${readout('Numerical aperture', `${fmt(fibre.na, 5)} (acceptance ±${fmt(fibre.acceptanceAngle, 4)}°)`)}${readout('Relative index difference Δ', `${fmt(fibre.delta * 100, 4)} %`)}${readout('V-number', `${fmt(fibre.v, 5)} → ${fibre.singleMode ? 'single-mode' : `about ${fibre.modes} modes (V²/2)`}`)}${readout('Single-mode cut-off wavelength', eng(fibre.cutoffWavelength, 'm'))}${readout('Total loss incl. margin', `${fmt(budget.totalLoss, 4)} dB of ${fmt(budget.available, 4)} dB available`)}${readout('Received power', `${fmt(budget.receivedDbm, 4)} dBm`)}${readout('Power budget', budget.feasible ? `OK, ${fmt(budget.excess, 4)} dB spare` : `short by ${fmt(-budget.excess, 4)} dB`)}${readout('Loss-limited length', `${fmt(budget.maxLength, 4)} km`)}${readout(`Modal spread (${fibre.singleMode ? 'single-mode: none' : c.profile === 'graded' ? 'graded index Ln₁Δ²/8c' : 'step index Ln₁Δ/c'})`, eng(rise.modal, 's'))}${readout('Chromatic spread D·Δλ·L', eng(rise.chromatic, 's'))}${readout('System rise time', eng(rise.system, 's'))}${readout('Maximum bit rate', `NRZ ${eng(rise.maxNrzRate, 'b/s')}, RZ ${eng(rise.maxRzRate, 'b/s')}`)}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Loss item</th><th>dB</th></tr></thead><tbody>${budget.items.map((item) => `<tr><td>${esc(item.name)}</td><td>${fmt(item.loss, 4)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } catch (error) { content = `<div class="diagnostic error"><b>Fibre link</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${rxField('fibre.n1', 'Core n₁', c.n1)}${rxField('fibre.n2', 'Cladding n₂', c.n2)}${rxField('fibre.core', 'Core diameter', c.core, 'µm')}${rxField('fibre.wavelength', 'Wavelength', c.wavelength, 'nm')}${labSelect('data-rx-select', 'fibre.profile', 'Index profile', c.profile, [['step', 'Step index'], ['graded', 'Graded (parabolic)']])}${rxField('fibre.length', 'Length', c.length, 'km')}${rxField('fibre.attenuation', 'Attenuation', c.attenuation, 'dB/km')}${rxField('fibre.splices', 'Splices', c.splices)}${rxField('fibre.spliceLoss', 'per splice', c.spliceLoss, 'dB')}${rxField('fibre.connectors', 'Connectors', c.connectors)}${rxField('fibre.connectorLoss', 'per connector', c.connectorLoss, 'dB')}${rxField('fibre.margin', 'Margin', c.margin, 'dB')}${rxField('fibre.txPower', 'Source power', c.txPower, 'dBm')}${rxField('fibre.rxSensitivity', 'Receiver sensitivity', c.rxSensitivity, 'dBm')}${rxField('fibre.txRise', 'Source rise time', c.txRise, 'ns')}${rxField('fibre.rxRise', 'Detector rise time', c.rxRise, 'ns')}${rxField('fibre.dispersion', 'Chromatic dispersion D', c.dispersion, 'ps/nm·km')}${rxField('fibre.spectralWidth', 'Source spectral width', c.spectralWidth, 'nm')}`;
  return `<div class="power-page sigsys-page"><section class="dsp-card"><div class="dsp-controls">${controls}</div>${content}</section></div>`;
}
export function bindReceiverEvents() {
  bindLabControls('rx', rxLab, ['side', 'profile']);
  document.querySelectorAll('[data-rx-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.rxText.split('.'); rxLab.persist((config) => { config[group][key] = input.value; }); }));
}
export function renderCommunication(state) {
  const config = commConfiguration(state);
  const body = config.tab === 'analog' ? renderAnalogTab(config) : config.tab === 'digital' ? renderDigitalTab(config, state) : config.tab === 'pcm' ? renderPcmTab(config) : config.tab === 'coding' ? renderCodingTab(config) : config.tab === 'receiver' ? renderReceiverTab(state) : config.tab === 'fibre' ? renderFibreTab(state) : renderQpskLink(state);
  return `<div class="page scroll-page communication-page">${pageHeader(modules.find((item) => item.id === 'communication'), 'BUILT-IN COMMUNICATION LAB', '<span class="pill live"><i></i> OFFLINE EXPERIMENT</span>')}
    <div class="logic-tabs" role="tablist">${COMM_TABS.map(([id, label]) => `<button role="tab" aria-selected="${config.tab === id}" class="${config.tab === id ? 'active' : ''}" data-comm-tab="${id}">${label}</button>`).join('')}</div>${body}</div>`;
}
export function bindCommLabEvents() {
  document.querySelectorAll('[data-comm-tab]').forEach((button) => button.addEventListener('click', () => persistComm({ tab: button.dataset.commTab })));
  document.querySelectorAll('[data-comm-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.commLabField;
    const text = ['scheme', 'digitalScheme', 'eyePulse', 'law', 'lineBits', 'hammingData', 'crcMessage', 'crcPolynomial', 'convData'].includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    const reset = name === 'hammingData' ? { hammingFlips: [] } : name === 'convData' ? { convFlips: [] } : {};
    persistComm({ [name]: value, ...reset });
  }));
  document.querySelector('[data-comm-crc-preset]')?.addEventListener('change', (event) => { if (event.target.value) persistComm({ crcPolynomial: event.target.value }); });
  document.querySelectorAll('[data-comm-flip]').forEach((button) => button.addEventListener('click', () => {
    const [kind, index] = button.dataset.commFlip.split(':');
    if (kind === 'none') return;
    const key = kind === 'hamming' ? 'hammingFlips' : 'convFlips';
    const flips = commConfiguration(getState())[key];
    const position = Number(index);
    persistComm({ [key]: flips.includes(position) ? flips.filter((value) => value !== position) : [...flips, position] });
  }));
  document.querySelector('[data-action="comm-ber-curve"]')?.addEventListener('click', () => {
    const config = commConfiguration(getState());
    try { setState({ commBerCurve: berCurve({ scheme: config.digitalScheme, from: 0, to: 12, step: 1, bitsPerPoint: 100_000 }) }); notify('BER curve computed', 'success'); }
    catch (error) { notify(error.message, 'error'); }
  });
}
