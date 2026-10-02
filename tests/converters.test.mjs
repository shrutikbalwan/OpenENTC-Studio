import test from 'node:test';
import assert from 'node:assert/strict';
import { adcCode, adcThresholds, coherentCycles, createRandom, dualSlope, dynamicTest, fftRadix2, flashConvert, histogramTest, integratingRejection, linearity, r2rDac, sarConvert, sigmaDelta, weightedDac } from '../packages/converters/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('radix-2 FFT and coherent sampling helpers', () => {
  const n = 64, re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k += 1) re[k] = Math.cos(2 * Math.PI * 5 * k / n);
  fftRadix2(re, im);
  near(re[5], 32, 1e-9, 'bin 5'); near(re[59], 32, 1e-9, 'mirror'); near(Math.hypot(re[6], im[6]), 0, 1e-9, 'leakage');
  assert.throws(() => fftRadix2(new Float64Array(6), new Float64Array(6)), /power of two/);
  assert.equal(coherentCycles(4096, 132), 131);
  const a = createRandom(7), b = createRandom(7);
  assert.equal(a.next(), b.next());
});

test('ideal ADC: codes, SNR = 6.02N + 1.76 dB and ENOB = N', () => {
  const adc = adcThresholds({ bits: 8, vref: 5 });
  assert.equal(adcCode(adc, 0), 0); assert.equal(adcCode(adc, 5), 255); assert.equal(adcCode(adc, 2.5), 128); assert.equal(adcCode(adc, 5 / 256 * 0.49), 0); assert.equal(adcCode(adc, 5 / 256 * 0.51), 1);
  for (const bits of [8, 10, 12]) {
    const result = dynamicTest(adcThresholds({ bits, vref: 5 }), { n: 8192 });
    near(result.snr, 6.02 * bits + 1.76, 0.35, `${bits}-bit SNR`);
    near(result.enob, bits, 0.1, `${bits}-bit ENOB`);
  }
  const noisy = dynamicTest(adcThresholds({ bits: 10, vref: 5 }), { n: 8192, noiseLsb: 1 });
  near(noisy.snr, 10 * Math.log10(((1024 / 2) ** 2 / 2) / (1 / 12 + 1)), 0.5, 'SNR with 1 LSB rms noise'); // quantisation + thermal noise
});

test('static linearity: offset, gain, DNL/INL and missing codes, recovered by a ramp histogram', () => {
  const offsetGain = linearity(adcThresholds({ bits: 8, vref: 5, offsetLsb: 1.5, gainErrorPercent: 2 }));
  near(offsetGain.offsetLsb, 1.5 + 0.5 * 0.02, 1e-9, 'offset'); near(offsetGain.gainErrorPercent, 2, 1e-9, 'gain'); near(offsetGain.maxDnl, 0, 1e-9, 'DNL'); near(offsetGain.maxInl, 0, 1e-9, 'INL');
  const bow = linearity(adcThresholds({ bits: 8, vref: 5, bowLsb: 2 }));
  near(bow.maxInl, 2, 0.05, 'bow INL'); // the end-point line absorbs the bow at the end codes assert.deepEqual(bow.missingCodes, []);
  const bad = adcThresholds({ bits: 8, vref: 5, bowLsb: 1.5, mismatchLsb: 0.3, offsetLsb: 2, gainErrorPercent: 1 });
  const direct = linearity(bad), histogram = histogramTest(bad, { samplesPerCode: 256 });
  assert.ok(direct.missingCodes.length > 0);
  assert.deepEqual(histogram.missingCodes, direct.missingCodes);
  near(Math.max(...direct.inl.map((value, k) => Math.abs(value - histogram.inl[k]))), 0, 0.01, 'histogram INL');
  assert.ok(dynamicTest(bad).enob < 7.5, 'non-linearity lowers ENOB');
});

test('SAR, flash and dual-slope conversions', () => {
  const random = createRandom(11);
  for (let k = 0; k < 200; k += 1) {
    const vin = random.next() * 5;
    const sar = sarConvert(vin, { bits: 10, vref: 5 });
    assert.equal(sar.code, Math.min(1023, Math.floor(vin / 5 * 1024)));
    assert.equal(sar.steps.length, 10);
    assert.equal(flashConvert(vin, { bits: 4, vref: 5 }).code, Math.min(15, Math.round(vin / 5 * 16)));
  }
  const sar = sarConvert(3.3, { bits: 8, vref: 5 });
  assert.deepEqual(sar.steps.map((step) => step.keep), [true, false, true, false, true, false, false, false]); // 168 = 1010 1000
  assert.equal(flashConvert(1, { bits: 3 }).comparators, 7);
  const ds = dualSlope(1.234, { bits: 12, vref: 2, clock: 204_800, r: 100e3, c: 1e-6 });
  assert.equal(ds.count, Math.floor(4096 * 1.234 / 2)); near(ds.t1, 0.02, 1e-12, 'T1'); near(ds.peak, 1.234 * 0.02 / 0.1, 1e-12, 'integrator peak');
  near(integratingRejection(50, 0.02), 0, 1e-12, '50 Hz rejected by 20 ms integration'); near(integratingRejection(25, 0.02), 2 / Math.PI, 1e-12, 'half-cycle');
});

test('sigma-delta: in-band SQNR improves ≈9 dB/octave (1st order) and ≈15 dB/octave (2nd order)', () => {
  for (const [order, low, high] of [[1, 6, 10], [2, 12, 18]]) {
    const a = sigmaDelta({ order, osr: 32 }), b = sigmaDelta({ order, osr: 128 });
    const slope = (b.sqnr - a.sqnr) / 2;
    assert.ok(slope > low && slope < high, `order ${order}: ${slope} dB/octave`);
  }
  const result = sigmaDelta({ order: 2, osr: 64, amplitude: 0.5 });
  near(result.ones, 0.5, 0.01, 'mean density for a zero-mean sine');
  const peak = Math.max(...result.decimated.map((sample) => sample.value));
  near(peak, 0.5, 0.05, 'decimated output follows the input amplitude');
});

test('DACs: ideal R-2R and weighted outputs are exact; mismatch gives DNL at the MSB transition', () => {
  for (const make of [r2rDac, weightedDac]) {
    const ideal = make({ bits: 8, vref: 5 });
    ideal.levels.forEach((value, code) => near(value, code * 5 / 256, 1e-12, `${ideal.kind} code ${code}`));
    assert.equal(ideal.monotonic, true);
  }
  const ladder = r2rDac({ bits: 10, vref: 5, tolerancePercent: 1 });
  assert.ok(ladder.maxDnl > 0.1);
  const weighted = weightedDac({ bits: 8, vref: 5, tolerancePercent: 2 });
  assert.equal(weighted.resistorSpread, 128);
  assert.equal(weighted.worstStep % 16, 0, 'the worst step is a major carry');
  assert.throws(() => r2rDac({ bits: 20 }), /1–14 bits/);
});
