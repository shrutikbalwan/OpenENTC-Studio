import test from 'node:test';
import assert from 'node:assert/strict';
import { besselJ, berCurve, constellation, convolutionalEncode, crcCheck, crcDivide, CRC_POLYNOMIALS, erfc, eyeDiagram, fftInPlace, hammingDecode, hammingEncode, lineCode, measureSqnr, qFunction, samplingDemo, simulateAnalogModulation, simulateDigitalLink, theoreticalBer, viterbiDecode } from '../packages/communications/src/index.mjs';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const peak = (result, frequency) => { const index = result.spectrum.frequency.findIndex((value) => value >= frequency - 1e-9); return Math.max(...result.spectrum.amplitude.slice(index - 3, index + 4)); };

test('math helpers: erfc, Q-function, Bessel and FFT', () => {
  near(erfc(1), 0.157299207, 1e-7, 'erfc(1)');
  near(qFunction(3) / 1.349898e-3, 1, 1e-5, 'Q(3) relative');
  near(qFunction(6) / 9.865876e-10, 1, 1e-5, 'Q(6) tail relative accuracy');
  near(besselJ(0, 2.405), 0, 1e-3, 'first zero of J0');
  near(besselJ(1, 1), 0.4400505857, 1e-9, 'J1(1)');
  const re = [1, 0, 0, 0, 0, 0, 0, 0], im = new Array(8).fill(0);
  fftInPlace(re, im);
  assert.deepEqual(re, new Array(8).fill(1), 'impulse has a flat spectrum');
  assert.throws(() => fftInPlace([1, 2, 3], [0, 0, 0]), /power of two/);
});

test('AM spectrum, efficiency and envelope detection match theory', () => {
  const am = simulateAnalogModulation({ scheme: 'am', carrierFrequency: 10_000, messageFrequency: 1_000, index: 0.5 });
  near(peak(am, 10_000), 1, 1e-3, 'carrier amplitude');
  near(peak(am, 9_000), 0.25, 1e-3, 'lower sideband μ/2');
  near(peak(am, 11_000), 0.25, 1e-3, 'upper sideband μ/2');
  near(am.metrics.efficiency, 0.25 / 2.25, 1e-12, 'η = μ²/(2+μ²)');
  near(Math.min(...am.demodulated), 0.5, 1e-3, 'envelope minimum 1−μ');
  near(Math.max(...am.demodulated), 1.5, 1e-3, 'envelope maximum 1+μ');
  assert.match(simulateAnalogModulation({ scheme: 'am', index: 1.4 }).warnings[0], /Over-modulation/);
  const dsb = simulateAnalogModulation({ scheme: 'dsb-sc' });
  near(peak(dsb, 10_000), 0, 1e-3, 'suppressed carrier');
  near(Math.max(...dsb.demodulated), 1, 1e-3, 'coherent detection recovers the message');
});

test('FM sidebands follow Bessel functions and the discriminator recovers the deviation', () => {
  const fm = simulateAnalogModulation({ scheme: 'fm', carrierFrequency: 10_000, messageFrequency: 1_000, deviation: 2_405 });
  near(fm.metrics.beta, 2.405, 1e-12, 'β = Δf/fm');
  near(fm.metrics.carsonBandwidth, 2 * (2_405 + 1_000), 1e-9, 'Carson bandwidth');
  near(peak(fm, 10_000), 0, 2e-3, 'carrier vanishes at the first zero of J0');
  for (const line of fm.metrics.bessel.slice(1)) near(peak(fm, line.frequency), line.amplitude, 2e-3, `J${line.order}`);
  near(Math.max(...fm.demodulated), 2_405, 30, 'peak frequency deviation');
  const pm = simulateAnalogModulation({ scheme: 'pm', index: 1.2 });
  near(Math.max(...pm.demodulated), 1.2, 0.01, 'PM phase deviation');
});

test('digital modulation BER agrees with closed-form theory', () => {
  for (const [scheme, snr] of [['bpsk', 4], ['qpsk', 4], ['8psk', 6], ['16qam', 8]]) {
    const run = simulateDigitalLink({ scheme, ebN0dB: snr, bits: 400_000, seed: 11 });
    near(run.ber / run.theory, 1, 0.1, `${scheme} at ${snr} dB`);
  }
  near(theoreticalBer('bpsk', 9.6) / 1.0e-5, 1, 0.05, 'BPSK reaches 1e-5 near 9.6 dB');
  const points = constellation('16qam').points;
  near(points.reduce((sum, point) => sum + point.i ** 2 + point.q ** 2, 0) / 16, 1, 1e-12, '16-QAM unit average energy');
  for (const scheme of ['qpsk', '8psk', '16qam']) {
    const map = constellation(scheme);
    for (const a of map.points) {
      const nearest = map.points.filter((b) => b !== a).sort((x, y) => Math.hypot(x.i - a.i, x.q - a.q) - Math.hypot(y.i - a.i, y.q - a.q));
      const distance = Math.hypot(nearest[0].i - a.i, nearest[0].q - a.q);
      for (const neighbour of nearest.filter((b) => Math.abs(Math.hypot(b.i - a.i, b.q - a.q) - distance) < 1e-9)) {
        const difference = (neighbour.label ^ a.label).toString(2).split('1').length - 1;
        assert.equal(difference, 1, `${scheme} nearest neighbours differ by one bit (Gray)`);
      }
    }
  }
  const curve = berCurve({ scheme: 'bpsk', from: 0, to: 8, step: 4, bitsPerPoint: 50_000 });
  assert.equal(curve.points.length, 3);
  assert.ok(curve.points[0].simulated > curve.points[2].simulated);
});

test('raised-cosine eye is ISI-free at the sampling instant', () => {
  const clean = eyeDiagram({ alpha: 0.35, ebN0dB: 60 });
  near(clean.opening, 1, 5e-3, 'fully open eye with negligible noise');
  assert.ok(eyeDiagram({ alpha: 0.35, ebN0dB: 6 }).opening < clean.opening);
  assert.equal(clean.traces[0].length, 2 * clean.samplesPerSymbol + 1);
});

test('sampling, aliasing, SQNR and μ-law companding', () => {
  for (const bits of [8, 12, 16]) near(measureSqnr(bits), 6.02 * bits + 1.76, 0.25, `${bits}-bit SQNR`);
  assert.ok(measureSqnr(8, { law: 'mu-law', amplitude: 0.0316 }) > measureSqnr(8, { amplitude: 0.0316 }) + 10, 'μ-law helps quiet signals');
  const aliased = samplingDemo({ signalFrequency: 7_000, sampleRate: 8_000 });
  assert.equal(aliased.aliased, true);
  assert.equal(aliased.apparentFrequency, 1_000);
  assert.equal(samplingDemo({ signalFrequency: 1_000, sampleRate: 8_000, bits: 8 }).bitRate, 64_000);
});

test('line codes: Manchester has no DC and a mid-bit transition every bit; AMI alternates marks', () => {
  const manchester = lineCode('1011000', 'manchester');
  near(manchester.dcLevel, 0, 1e-12, 'Manchester DC');
  assert.ok(manchester.transitions >= 7);
  const ami = lineCode('1101', 'ami');
  assert.deepEqual(ami.segments.map((segment) => segment.level), [1, -1, 0, 1]);
  assert.equal(lineCode('1111', 'unipolar-nrz').transitions, 0, 'long runs of 1s lose clock information');
  assert.throws(() => lineCode('1021', 'ami'), /0 and 1/);
});

test('Hamming codes correct any single-bit error', () => {
  for (const data of ['1011', '0000', '1111', '10110011101']) {
    const { codeword, n } = hammingEncode(data);
    assert.equal(hammingDecode(codeword).syndrome, 0);
    for (let position = 1; position <= n; position += 1) {
      const corrupted = [...codeword]; corrupted[position - 1] = corrupted[position - 1] === '1' ? '0' : '1';
      const decoded = hammingDecode(corrupted.join(''));
      assert.equal(decoded.errorPosition, position);
      assert.equal(decoded.data, data);
    }
  }
  assert.equal(hammingEncode('1011').codeword, '0110011', 'textbook (7,4) example');
});

test('CRC long division matches published check values', () => {
  const textbook = crcDivide('11010011101100', '1011');
  assert.equal(textbook.remainder, '100');
  assert.equal(crcCheck(textbook.frame, '1011').valid, true);
  assert.equal(crcCheck('11010011101100101', '1011').valid, false);
  const ascii = [...'123456789'].map((character) => character.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  const crc32 = parseInt(crcDivide(ascii, CRC_POLYNOMIALS['CRC-32']).remainder, 2);
  assert.equal(((crc32 ^ 0xffffffff) >>> 0).toString(16), '765e7680', 'CRC-32/POSIX check value');
});

test('convolutional code (7,5) with Viterbi corrects separated errors', () => {
  const { encoded } = convolutionalEncode('1011');
  assert.equal(encoded, '111000010111', 'textbook (7,5) encoding');
  const corrupted = [...encoded]; corrupted[2] = corrupted[2] === '1' ? '0' : '1'; corrupted[7] = corrupted[7] === '1' ? '0' : '1';
  const decoded = viterbiDecode(corrupted.join(''));
  assert.equal(decoded.decoded, '1011');
  assert.equal(decoded.pathMetric, 2);
  assert.throws(() => viterbiDecode('101'), /pairs/);
});
