// Information Theory & Spread Spectrum workspace. Entry points: renderInfo(state); bindInfoEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { awgnCapacity, channelCapacity, dsss, encodeWithCode, fhss, GOLD_PAIRS, goldCodes, huffman, lfsr, lzwDecode, lzwEncode, minimumEbN0Db, mutualInformation, ofdmLink, periodicCorrelation, PRIMITIVE_TAPS, sequenceProperties, shannonFano, textSource } from '../../../packages/infotheory/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { engineeringInput, parseNumberList } from '../../shared/parsing.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, scatterPlane, stemPlot } from '../../components/plots.js';
import { groupField, labSelect, labText } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, bindLabText, makeLab } from '../../controllers/lab-controls.js';

const INFO_TABS = [['source', 'Source coding'], ['lzw', 'LZW'], ['channel', 'Channel capacity'], ['pn', 'PN & Gold codes'], ['dsss', 'DSSS & FHSS'], ['ofdm', 'OFDM']];
const INFO_CHANNELS = { bsc: ['Binary symmetric (p = 0.1)', '0.9 0.1\n0.1 0.9', '0.5 0.5'], bec: ['Binary erasure (ε = 0.2)', '0.8 0.2 0\n0 0.2 0.8', '0.5 0.5'], z: ['Z-channel (p = 0.3)', '1 0\n0.3 0.7', '0.5 0.5'], typewriter: ['Noisy typewriter (4 symbols)', '0.5 0.5 0 0\n0 0.5 0.5 0\n0 0 0.5 0.5\n0.5 0 0 0.5', '0.25 0.25 0.25 0.25'] };
const infoLab = makeLab('info-lab', {
  tab: 'source',
  source: { mode: 'probabilities', probabilities: 'A 0.4\nB 0.2\nC 0.2\nD 0.1\nE 0.1', text: 'ELECTRONICS AND TELECOMMUNICATION', method: 'huffman' },
  lzw: { text: 'TOBEORNOTTOBEORTOBEORNOT' },
  channel: { preset: 'bsc', matrix: INFO_CHANNELS.bsc[1], inputs: INFO_CHANNELS.bsc[2], bandwidth: 3100, snr: 30 },
  pn: { degree: 5, goldA: 2, goldB: 7 },
  dsss: { degree: 5, ebN0: 6, jsr: 10, jammerFrequency: 0.01, spread: 'yes', channelBits: 3, hops: 40 },
  ofdm: { subcarriers: 64, cp: 16, scheme: 'qpsk', channel: '1 0 0 0.6 0 0 0.45 0 0.3', snr: 25 },
});
const infoField = groupField('data-info-field');
const infoText = labText('info');
function parseSourceTable(text) {
  const symbols = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(/[\s,]+/);
    if (parts.length !== 2) throw new RangeError(`Line ${index + 1}: enter "symbol probability".`);
    return { symbol: parts[0], p: engineeringInput(parts[1], `Line ${index + 1}`) };
  });
  if (symbols.length > 40) throw new RangeError('Use at most 40 symbols.');
  return symbols;
}
const parseMatrix = (text) => String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => parseNumberList(line, `Row ${index + 1}`));
const showSymbol = (symbol) => (symbol === ' ' ? '␣' : symbol);
function renderInfoTab(config) {
  const c = config[config.tab];
  if (config.tab === 'source') {
    const symbols = c.mode === 'text' ? textSource(c.text).slice(0, 40) : parseSourceTable(c.probabilities);
    const huff = huffman(symbols), fano = shannonFano(symbols);
    const chosen = c.method === 'fano' ? fano : huff;
    const controls = `${labSelect('data-info-select', 'source.mode', 'Source', c.mode, [['probabilities', 'Symbol probabilities'], ['text', 'From a text message']])}${c.mode === 'text' ? infoText('source.text', 'Message', c.text, 3) : infoText('source.probabilities', 'Symbol and probability per line', c.probabilities, 6)}${labSelect('data-info-select', 'source.method', 'Code', c.method, [['huffman', 'Huffman (minimum variance)'], ['fano', 'Shannon–Fano']])}`;
    const rows = chosen.codes.map((entry) => [showSymbol(entry.symbol), fmt(entry.p, 4), entry.code, String(entry.code.length), fmt(-Math.log2(entry.p), 4)]);
    let encoded = '';
    if (c.mode === 'text') { const bits = encodeWithCode(c.text, chosen.codes); encoded = readout('Encoded message', `${bits.length} bits (${fmt(bits.length / [...c.text].length, 4)} bits/symbol) vs ${[...c.text].length * 8} bits in 8-bit ASCII`) + `<p class="field-help mono-wrap">${esc(bits.length > 400 ? `${bits.slice(0, 400)}…` : bits)}</p>`; }
    const steps = c.method === 'huffman' ? `<span class="panel-label">HUFFMAN REDUCTION (EACH COLUMN SORTED; THE TWO LOWEST ARE MERGED)</span>${simpleTable(huff.steps.map((_, k) => `Stage ${k + 1}`), Array.from({ length: symbols.length }, (_, row) => huff.steps.map((stage) => (stage[row] ? `${fmt(stage[row].p, 3)} ${stage[row].members.length > 1 ? '◆' : showSymbol(stage[row].members[0])}` : ''))))}` : `<span class="panel-label">SHANNON–FANO SPLITS</span>${simpleTable(['Level', 'Upper group (0)', 'Lower group (1)'], fano.splits.map((s) => [String(s.depth + 1), s.top.map(showSymbol).join(' '), s.bottom.map(showSymbol).join(' ')]))}`;
    const body = `<div class="power-grid"><div>${simpleTable(['Symbol', 'p', 'Code word', 'Length', 'Information −log₂p'], rows)}${steps}</div>
      <div class="analysis-readouts">${readout('Entropy H', `${fmt(chosen.entropy, 6)} bits/symbol`)}${readout('Average length L', `${fmt(chosen.averageLength, 6)} bits/symbol`)}${readout('Efficiency H/L', `${fmt(100 * chosen.efficiency, 5)} %`)}${readout('Redundancy 1 − H/L', `${fmt(100 * chosen.redundancy, 5)} %`)}${readout('Kraft sum Σ2^−l', fmt(chosen.kraft, 6))}${readout('Length variance', fmt(chosen.variance, 5))}${readout('Huffman vs Shannon–Fano', `L = ${fmt(huff.averageLength, 5)} vs ${fmt(fano.averageLength, 5)}`)}${encoded}<p class="field-help">Shannon's source-coding theorem: H ≤ L < H + 1 for the best prefix code. Huffman reaches the minimum L; with ties, the merged node is placed as high as possible, which gives the smallest variance of code lengths. ◆ marks a combined node.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'lzw') {
    const encoded = lzwEncode(c.text);
    const decoded = lzwDecode(encoded.codes, encoded.alphabet);
    const controls = infoText('lzw.text', 'Text to compress', c.text, 3);
    const steps = encoded.output.slice(0, 80).map((item, k) => [String(k + 1), showSymbol(item.phrase).replace(/ /g, '␣'), String(item.code), encoded.added[k] ? `${encoded.added[k].code} = ${encoded.added[k].phrase.replace(/ /g, '␣')}` : '—']);
    const body = `<div class="power-grid"><div>${simpleTable(['Step', 'Longest match w', 'Output code', 'New dictionary entry'], steps)}</div>
      <div class="analysis-readouts">${readout('Initial dictionary', encoded.alphabet.map((ch, i) => `${i}=${showSymbol(ch)}`).join(' '))}${readout('Codes sent', encoded.codes.join(' '))}${readout('Final dictionary size', String(encoded.dictionarySize))}${readout('Bits per code (fixed width)', String(encoded.bitsPerCode))}${readout('Compressed size', `${encoded.compressedBits} bits vs ${encoded.originalBits} bits uncompressed (${fmt(encoded.originalBits / encoded.compressedBits, 4)} : 1)`)}${readout('Decoder output matches', decoded === c.text ? 'yes — lossless' : 'NO')}<p class="field-help">LZW needs no probabilities: it builds the dictionary while it reads, and the decoder rebuilds the same dictionary from the codes alone. Long repeated text compresses well; short text can even grow.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'channel') {
    const matrix = parseMatrix(c.matrix);
    const inputs = parseNumberList(c.inputs, 'Input probabilities');
    const mi = mutualInformation(matrix, inputs);
    const cap = channelCapacity(matrix);
    const awgn = awgnCapacity(c.bandwidth, c.snr);
    const snrs = Array.from({ length: 81 }, (_, k) => -10 + k * 0.5);
    const etas = Array.from({ length: 80 }, (_, k) => 0.1 + k * 0.1);
    const controls = `${labSelect('data-info-select', 'channel.preset', 'Channel', c.preset, [...Object.entries(INFO_CHANNELS).map(([id, entry]) => [id, entry[0]]), ['custom', 'Custom']])}${infoText('channel.matrix', 'P(y|x): one row per input', c.matrix, 4)}${infoText('channel.inputs', 'Input probabilities P(x)', c.inputs)}${infoField('channel.bandwidth', 'AWGN bandwidth B', c.bandwidth, 'Hz')}${infoField('channel.snr', 'S/N', c.snr, 'dB')}`;
    const body = `<div class="power-grid"><div>${linePlot('Shannon–Hartley: C/B = log₂(1 + S/N) against S/N in dB', snrs, [{ name: 'C/B', values: snrs.map((s) => Math.log2(1 + 10 ** (s / 10))) }], { xLabel: (x) => `${fmt(x, 3)} dB` })}${linePlot('Minimum Eb/N0 (dB) against spectral efficiency η (bit/s/Hz)', etas, [{ name: 'Eb/N0 min', values: etas.map(minimumEbN0Db) }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div class="analysis-readouts">${readout('I(X;Y) for this input', `${fmt(mi.information, 6)} bits`)}${readout('H(X), H(Y)', `${fmt(mi.hx, 5)}, ${fmt(mi.hy, 5)} bits`)}${readout('H(X|Y) equivocation', `${fmt(mi.hxGivenY, 5)} bits`)}${readout('H(Y|X) noise entropy', `${fmt(mi.hyGivenX, 5)} bits`)}${readout('Output P(y)', mi.py.map((v) => fmt(v, 4)).join(', '))}${readout('Capacity C (Blahut–Arimoto)', `${fmt(cap.capacity, 8)} bits/use`)}${readout('Capacity-achieving P(x)', cap.inputDistribution.map((v) => fmt(v, 4)).join(', '))}${readout('AWGN capacity', `${eng(awgn.capacity, 'bit/s')} (${fmt(awgn.spectralEfficiency, 5)} bit/s/Hz)`)}${readout('Shannon limit (η → 0)', `${fmt(awgn.shannonLimitDb, 5)} dB`)}<p class="field-help">C = max over P(x) of I(X;Y). Blahut–Arimoto iterates until the upper and lower bounds agree to 10⁻¹²; it reproduces 1 − Hb(p) for the BSC and 1 − ε for the BEC.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'pn') {
    const degree = Math.round(c.degree);
    const taps = PRIMITIVE_TAPS[degree];
    if (!taps) throw new RangeError('Degree must be 2 to 10.');
    const run = lfsr(taps);
    const props = sequenceProperties(run.sequence);
    let gold = '';
    if (GOLD_PAIRS[degree]) {
      const family = goldCodes(degree);
      const a = Math.max(0, Math.min(family.family.length - 1, Math.round(c.goldA))), b = Math.max(0, Math.min(family.family.length - 1, Math.round(c.goldB)));
      const cross = periodicCorrelation(family.family[a], family.family[b]);
      gold = `${stemPlot(`Cross-correlation of Gold codes ${a} and ${b}`, cross, { color: PLOT_COLORS[1] })}${readout('Gold family', `${family.family.length} codes of length ${family.length}, preferred pair x^${family.pair[0].join('+x^')}+1 and x^${family.pair[1].join('+x^')}+1`)}${readout('Cross-correlation values', `${[...new Set(cross)].sort((p, q) => p - q).join(', ')} (allowed ${family.bound.join(', ')})`)}`;
    }
    const controls = `${labSelect('data-info-select', 'pn.degree', 'Register length n', degree, Object.keys(PRIMITIVE_TAPS).map((d) => [d, `${d} (length ${2 ** Number(d) - 1})`]))}${GOLD_PAIRS[degree] ? `${infoField('pn.goldA', 'Gold code A (index)', c.goldA)}${infoField('pn.goldB', 'Gold code B (index)', c.goldB)}` : ''}`;
    const runs = Object.entries(props.runs).map(([length, count]) => `${length}:${count}`).join('  ');
    const body = `<div class="power-grid"><div>${stemPlot('Periodic autocorrelation R(τ) of the m-sequence', props.correlation)}${gold}</div>
      <div class="analysis-readouts">${readout('Feedback polynomial', `x^${taps.join(' + x^')} + 1`)}${readout('First register states', run.states.slice(0, 8).join(' → '))}${readout('Sequence (one period)', run.sequence.slice(0, 127).join('') + (run.sequence.length > 127 ? '…' : ''))}${readout('Balance', `${props.ones} ones, ${props.zeros} zeros`)}${readout('Runs (length:count)', runs)}${readout('Off-peak autocorrelation', props.offPeak.join(', '))}<p class="field-help">The three PN properties: one more 1 than 0; half the runs have length 1, a quarter length 2, …; and the autocorrelation is N at τ = 0 and −1 everywhere else. Gold codes trade that perfect autocorrelation for a bounded cross-correlation, so many users can share a band (CDMA, GPS).</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'dsss') {
    const run = dsss({ degree: Math.round(c.degree), bits: 4000, ebN0Db: c.ebN0, jsrDb: c.jsr, jammerFrequency: c.jammerFrequency, spread: c.spread === 'yes' });
    const other = dsss({ degree: Math.round(c.degree), bits: 4000, ebN0Db: c.ebN0, jsrDb: c.jsr, jammerFrequency: c.jammerFrequency, spread: c.spread !== 'yes' });
    const hop = fhss({ degree: 5, channelBits: Math.max(1, Math.min(5, Math.round(c.channelBits))), hops: Math.max(4, Math.min(200, Math.round(c.hops))) });
    const xs = run.chips.map((_, k) => k).slice(0, 4 * run.chipsPerBit);
    const controls = `${labSelect('data-info-select', 'dsss.degree', 'PN length', Math.round(c.degree), [3, 4, 5, 6, 7, 8].map((d) => [d, `${2 ** d - 1} chips/bit`]))}${infoField('dsss.ebN0', 'Eb/N0', c.ebN0, 'dB')}${infoField('dsss.jsr', 'Jammer-to-signal J/S', c.jsr, 'dB')}${infoField('dsss.jammerFrequency', 'Jammer frequency (cycles/chip)', c.jammerFrequency)}${labSelect('data-info-select', 'dsss.spread', 'Spreading', c.spread, [['yes', 'On (DSSS)'], ['no', 'Off (plain BPSK)']])}${infoField('dsss.channelBits', 'FHSS channel bits', c.channelBits)}${infoField('dsss.hops', 'Hops shown', c.hops)}`;
    const body = `<div class="power-grid"><div>${linePlot('Transmitted chips and received samples (first 4 bits)', xs, [{ name: 'transmitted', values: run.chips.slice(0, xs.length) }, { name: 'received (noise + jammer)', values: run.received.slice(0, xs.length), color: '#64748b' }])}${stemPlot('Correlator output per bit (sign = decision)', run.despread.slice(0, 60), { color: PLOT_COLORS[2] })}${linePlot('FHSS hop pattern: channel against hop number', hop.pattern.map((p) => p.hop), [{ name: 'channel', values: hop.pattern.map((p) => p.channel), color: PLOT_COLORS[3] }])}</div>
      <div class="analysis-readouts">${readout('Processing gain Gp = 10 log N', `${fmt(run.processingGainDb, 4)} dB (${run.chipsPerBit} chips/bit)`)}${readout('BER now', `${fmt(run.ber, 4)} (${run.errors}/${run.bits})`)}${readout(c.spread === 'yes' ? 'BER without spreading' : 'BER with spreading', fmt(other.ber, 4))}${readout('Theory, AWGN only', fmt(run.theoryBer, 4))}${readout('Jamming margin ≈ Gp − (Eb/N0)req', `${fmt(run.processingGainDb - 9.6, 4)} dB for BER 10⁻⁵`)}${readout('FHSS', `${hop.channels} channels, ${eng(hop.bandwidth, 'Hz')} span, Gp = ${fmt(hop.processingGainDb, 4)} dB`)}${readout('Channel use', hop.use.join(' '))}<p class="field-help">The despreader multiplies by the same PN code: the wanted signal collapses back to the data rate while the jammer is spread over N chips, so only 1/N of its power lands in the decision. Spreading does not help against white noise — the BER with jammer off equals plain BPSK.</p></div></div>`;
    return { controls, body };
  }
  const channel = parseNumberList(c.channel, 'Channel taps');
  if (!channel.length || channel.length > 64) throw new RangeError('Enter 1 to 64 channel taps.');
  const run = ofdmLink({ subcarriers: Math.round(c.subcarriers), cp: Math.round(c.cp), scheme: c.scheme, channel, snrDb: c.snr, symbols: 30 });
  const ks = run.channelResponseDb.map((_, k) => k);
  const controls = `${labSelect('data-info-select', 'ofdm.subcarriers', 'Subcarriers N', Math.round(c.subcarriers), [16, 32, 64, 128, 256].map((n) => [n, String(n)]))}${infoField('ofdm.cp', 'Cyclic prefix', c.cp, 'samples')}${labSelect('data-info-select', 'ofdm.scheme', 'Mapping', c.scheme, [['qpsk', 'QPSK'], ['16qam', '16-QAM']])}${infoText('ofdm.channel', 'Multipath taps h[0], h[1], …', c.channel)}${infoField('ofdm.snr', 'Es/N0', c.snr, 'dB')}`;
  const body = `<div class="power-grid"><div><span class="panel-label">RECEIVED SUBCARRIERS BEFORE (LEFT) AND AFTER (RIGHT) THE ONE-TAP EQUALISER</span><div class="ofdm-pair">${scatterPlane('Raw constellation', run.raw, 2.5, '#64748b')}${scatterPlane('Equalised constellation', run.equalised, 1.6)}</div>${linePlot('Channel |H(k)|² in dB across subcarriers', ks, [{ name: '|H|²', values: run.channelResponseDb }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Transmitted OFDM signal (real part, three symbols with CP)', run.txPreview.map((_, k) => k), [{ name: 'Re x[n]', values: run.txPreview }])}</div>
    <div class="analysis-readouts">${readout('BER', `${fmt(run.ber, 4)} (${run.errors}/${run.bits} bits)`)}${readout('Channel delay spread', `${run.delaySpread} samples`)}${readout('CP covers the channel', run.cpCoversChannel ? 'yes — no inter-symbol interference' : 'NO — ISI and inter-carrier interference')}${readout('CP efficiency N/(N+CP)', `${fmt(100 * run.efficiency, 4)} %`)}<p class="field-help">The IFFT puts one QAM symbol on each subcarrier. When the cyclic prefix is at least as long as the channel, linear convolution becomes circular, so each subcarrier sees just a complex gain H(k) and a single division equalises it. Shorten the CP below the delay spread to watch the constellation smear.</p></div></div>`;
  return { controls, body };
}
export function renderInfo(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'info'), 'INFORMATION THEORY & SPREAD SPECTRUM', '')}${labCard('info', 'Information theory', INFO_TABS, infoLab.configuration(state), renderInfoTab)}</div>`;
}
export function bindInfoEvents() {
  bindLabControls('info', infoLab, ['mode', 'method', 'preset', 'spread', 'scheme']);
  bindLabText('info', infoLab, (config, group) => { if (group === 'channel') config.channel.preset = 'custom'; });
  document.querySelectorAll('[data-info-select="channel.preset"]').forEach((select) => select.addEventListener('change', () => {
    const preset = INFO_CHANNELS[select.value];
    if (preset) infoLab.persist((config) => { config.channel.matrix = preset[1]; config.channel.inputs = preset[2]; });
  }));
}
