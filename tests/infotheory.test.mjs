import test from 'node:test';
import assert from 'node:assert/strict';
import { awgnCapacity, becCapacity, binaryEntropy, bscCapacity, channelCapacity, decodeWithCode, dsss, encodeWithCode, entropy, fhss, goldCodes, huffman, lfsr, lzwDecode, lzwEncode, minimumEbN0Db, mutualInformation, ofdmLink, periodicCorrelation, PRIMITIVE_TAPS, qamDemap, qamMap, sequenceProperties, shannonFano, textSource } from '../packages/infotheory/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const SOURCE = [['A', 0.4], ['B', 0.2], ['C', 0.2], ['D', 0.1], ['E', 0.1]].map(([symbol, p]) => ({ symbol, p }));

// Optimal average length by an independent method: the sum of all merged probabilities.
function optimalLength(probabilities) {
  let list = [...probabilities], total = 0;
  while (list.length > 1) { list.sort((a, b) => a - b); const merged = list.shift() + list.shift(); total += merged; list.push(merged); }
  return total;
}

test('entropy and the textbook five-symbol source', () => {
  near(entropy([0.4, 0.2, 0.2, 0.1, 0.1]), 2.121928094887362, 1e-12, 'H');
  near(entropy([1, 1, 1, 1]), 2, 1e-12, 'uniform');
  near(entropy([0.5, 0.5], Math.E), Math.LN2, 1e-12, 'nats');
  near(binaryEntropy(0.11), 0.4999162, 1e-6, 'Hb(0.11)');
  const h = huffman(SOURCE);
  near(h.averageLength, 2.2, 1e-12, 'Huffman L');
  near(h.variance, 0.16, 1e-12, 'minimum-variance Huffman');
  near(h.efficiency, 2.121928094887362 / 2.2, 1e-12, 'efficiency');
  near(h.kraft, 1, 1e-12, 'Kraft equality');
  const sf = shannonFano(SOURCE);
  near(sf.averageLength, 2.2, 1e-12, 'Shannon–Fano L');
  assert.ok(sf.kraft <= 1 + 1e-12);
});

test('Huffman is optimal and prefix-free on random sources and round-trips text', () => {
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(random() * 12);
    const symbols = Array.from({ length: n }, (_, k) => ({ symbol: `s${k}`, p: 0.01 + random() }));
    const result = huffman(symbols);
    near(result.averageLength, optimalLength(result.codes.map((c) => c.p)), 1e-9, `trial ${trial}`);
    assert.ok(result.averageLength >= result.entropy - 1e-12 && result.averageLength < result.entropy + 1);
    const codes = result.codes.map((c) => c.code);
    codes.forEach((a, i) => codes.forEach((b, j) => { if (i !== j) assert.ok(!b.startsWith(a), `${a} prefixes ${b}`); }));
  }
  const text = 'ELECTRONICS AND TELECOMMUNICATION';
  const source = textSource(text);
  const code = huffman(source).codes;
  const bits = encodeWithCode(text, code);
  assert.equal(decodeWithCode(bits, code), text);
  near(bits.length / text.length, huffman(source).averageLength, 1e-12, 'bits per symbol equals L for the empirical source');
});

test('LZW compresses and decompresses exactly', () => {
  const classic = lzwEncode('TOBEORNOTTOBEORTOBEORNOT');
  assert.equal(classic.output.length, 16); // the Wikipedia example emits 16 codes before the stop code
  assert.equal(lzwDecode(classic.codes, classic.alphabet), 'TOBEORNOTTOBEORTOBEORNOT');
  for (const text of ['aaaaaaaaaaaaaaaaaaaa', 'abababababab', 'the rain in spain stays mainly in the plain', 'x']) {
    const encoded = lzwEncode(text);
    assert.equal(lzwDecode(encoded.codes, encoded.alphabet), text);
  }
  const repetitive = lzwEncode('ab'.repeat(2000));
  assert.ok(repetitive.compressedBits < repetitive.originalBits / 4);
});

test('channel capacities: BSC, BEC, Z-channel and Shannon–Hartley', () => {
  near(channelCapacity([[0.9, 0.1], [0.1, 0.9]]).capacity, bscCapacity(0.1), 1e-9, 'BSC');
  near(channelCapacity([[0.8, 0.2, 0], [0, 0.2, 0.8]]).capacity, becCapacity(0.2), 1e-9, 'BEC');
  for (const p of [0.1, 0.3, 0.5]) {
    const closed = Math.log2(1 + (1 - p) * p ** (p / (1 - p)));
    near(channelCapacity([[1, 0], [p, 1 - p]]).capacity, closed, 1e-9, `Z-channel p=${p}`);
  }
  const noisyTypewriter = [[0.5, 0.5, 0, 0], [0, 0.5, 0.5, 0], [0, 0, 0.5, 0.5], [0.5, 0, 0, 0.5]];
  near(channelCapacity(noisyTypewriter).capacity, 1, 1e-9, 'noisy typewriter');
  const mi = mutualInformation([[0.9, 0.1], [0.1, 0.9]], [0.5, 0.5]);
  near(mi.information, bscCapacity(0.1), 1e-12, 'I(X;Y) at uniform input');
  near(mi.hx - mi.hxGivenY, mi.information, 1e-12, 'H(X) − H(X|Y)');
  const awgn = awgnCapacity(3100, 30);
  near(awgn.capacity, 3100 * Math.log2(1001), 1e-6, 'telephone channel');
  near(awgn.shannonLimitDb, -1.5917, 1e-4, 'Shannon limit');
  near(minimumEbN0Db(1), 0, 1e-12, 'η = 1 needs 0 dB');
});

test('m-sequences have every PN property and Gold codes are three-valued', () => {
  for (const degree of Object.keys(PRIMITIVE_TAPS).map(Number)) {
    const sequence = lfsr(PRIMITIVE_TAPS[degree]).sequence;
    const props = sequenceProperties(sequence);
    assert.equal(props.length, 2 ** degree - 1);
    assert.equal(props.ones, 2 ** (degree - 1));
    assert.deepEqual(props.offPeak, [-1]);
    for (let r = 1; r <= degree - 2; r += 1) assert.equal(props.runs[r], 2 ** (degree - 1 - r), `runs of ${r}`);
    assert.equal(props.runs[degree], 1);
    assert.equal(props.runs[degree - 1], 1);
  }
  for (const degree of [5, 6, 7, 9, 10]) {
    const gold = goldCodes(degree);
    assert.equal(gold.family.length, gold.length + 2);
    const allowed = new Set(gold.bound);
    for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 10; j += 1) periodicCorrelation(gold.family[i], gold.family[j]).forEach((value) => assert.ok(allowed.has(value), `degree ${degree}: ${value}`));
  }
});

test('DSSS matches BPSK theory and the processing gain beats a jammer', () => {
  const clean = dsss({ degree: 5, bits: 20000, ebN0Db: 5, seed: 2 });
  near(clean.ber, clean.theoryBer, 0.0025, 'BER at 5 dB');
  near(clean.processingGainDb, 10 * Math.log10(31), 1e-12, 'Gp');
  const spread = dsss({ degree: 7, bits: 5000, ebN0Db: 8, jsrDb: 12 });
  const plain = dsss({ degree: 7, bits: 5000, ebN0Db: 8, jsrDb: 12, spread: false });
  assert.ok(spread.ber < 0.01, `spread ${spread.ber}`);
  assert.ok(plain.ber > 0.2, `unspread ${plain.ber}`);
  const hop = fhss({ degree: 5, channelBits: 3, hops: 31 * 3 });
  assert.equal(hop.channels, 8);
  assert.equal(hop.use.reduce((a, b) => a + b, 0), 93);
});

test('OFDM: Gray QAM round trip, cyclic prefix removes ISI', () => {
  const bits = Array.from({ length: 64 }, (_, k) => (k * 7 + (k >> 2)) % 2);
  for (const scheme of ['qpsk', '16qam']) {
    const { symbols } = qamMap(bits, scheme);
    assert.deepEqual(qamDemap(symbols, scheme), bits);
    near(symbols.reduce((sum, s) => sum + s.re ** 2 + s.im ** 2, 0) / symbols.length, 1, 0.35, `${scheme} power`);
  }
  const good = ofdmLink({ cp: 16, snrDb: 60, scheme: '16qam' });
  assert.equal(good.errors, 0);
  assert.equal(good.cpCoversChannel, true);
  const bad = ofdmLink({ cp: 0, snrDb: 60, scheme: '16qam' });
  assert.ok(bad.ber > 0.01, `no CP ${bad.ber}`);
  near(good.efficiency, 0.8, 1e-12, 'CP overhead');
  near(ofdmLink({ channel: [1], cp: 0, snrDb: 9.8, symbols: 200, seed: 5 }).ber, 0.5 * (1 - 0.9999) + 0.0012, 0.0015, 'flat QPSK at Es/N0 9.8 dB ≈ Eb/N0 6.8 dB');
});
