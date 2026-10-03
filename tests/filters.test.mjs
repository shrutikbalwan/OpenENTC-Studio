import test from 'node:test';
import assert from 'node:assert/strict';
import { convolutionSteps, designFir, designIir, frequencyResponseDigital, impulseResponse, lfilter, poleZero, polyFromRoots, polyRoots } from '../packages/numerics/src/index.mjs';

const close = (actual, expected, tolerance, label) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= tolerance, `${label}[${index}]: ${value} vs ${expected[index]}`));
const gainAt = (design, frequency) => { const response = frequencyResponseDigital(design.b, design.a, design.sampleRate, 4001); return response.decibels[Math.round(frequency / (design.sampleRate / 2) * 4000)]; };

// Reference coefficients from scipy.signal 1.17 (butter, cheby1, firwin).
test('Butterworth and Chebyshev IIR designs match scipy.signal', () => {
  const butter = designIir({ family: 'butterworth', type: 'lowpass', order: 4, cutoff: 1000, sampleRate: 8000 });
  close(butter.b, [0.010209480791203138, 0.04083792316481255, 0.061256884747218826, 0.04083792316481255, 0.010209480791203138], 1e-12, 'butter b');
  close(butter.a, [1, -1.9684277869385185, 1.7358607092088867, -0.7244708295073626, 0.12038959989624451], 1e-12, 'butter a');
  assert.equal(butter.stable, true);
  const cheby = designIir({ family: 'chebyshev1', type: 'highpass', order: 3, cutoff: 1500, sampleRate: 8000, rippleDb: 1 });
  close(cheby.b, [0.2386884655907613, -0.7160653967722839, 0.7160653967722839, -0.2386884655907613], 1e-12, 'cheby b');
  close(cheby.a, [1, -0.4689125493872218, 0.5344714998593948, 0.09387632452052644], 1e-12, 'cheby a');
});

test('IIR responses show −3 dB at the Butterworth cutoff and the Chebyshev ripple band', () => {
  const butter = designIir({ type: 'lowpass', order: 5, cutoff: 1000, sampleRate: 8000 });
  assert.ok(Math.abs(gainAt(butter, 1000) + 3.0103) < 0.01);
  assert.ok(Math.abs(gainAt(butter, 0)) < 1e-9);
  assert.ok(gainAt(butter, 3000) < -60);
  const cheby = designIir({ family: 'chebyshev1', type: 'lowpass', order: 4, cutoff: 1000, sampleRate: 8000, rippleDb: 2 });
  const response = frequencyResponseDigital(cheby.b, cheby.a, 8000, 4001);
  const passband = response.decibels.slice(0, 1000);
  assert.ok(Math.min(...passband) > -2.001 && Math.max(...passband) < 1e-6);
  assert.ok(Math.abs(gainAt(cheby, 1000) + 2) < 0.01);
  const band = designIir({ type: 'bandpass', order: 3, cutoff: [800, 1600], sampleRate: 8000 });
  assert.equal(band.poles.length, 6);
  assert.ok(Math.abs(gainAt(band, 800) + 3.0103) < 0.02 && Math.abs(gainAt(band, 1600) + 3.0103) < 0.02);
  const stop = designIir({ family: 'chebyshev1', type: 'bandstop', order: 4, cutoff: [1000, 2000], sampleRate: 8000, rippleDb: 0.5 });
  assert.ok(stop.stable && gainAt(stop, Math.sqrt(1000 * 2000)) < -40);
});

test('FIR windowed-sinc designs match firwin and have linear phase', () => {
  const fir = designFir({ type: 'bandpass', taps: 31, cutoff: [800, 1600], sampleRate: 8000, window: 'kaiser', beta: 6 });
  close(fir.b.slice(0, 16), [-3.614193867201428e-19, -0.0013748983012907723, -0.0028264627442789354, -0.001195334459837764, 0.001966071467821458, -2.0550038701910273e-18, -0.004525351174742532, 0.006508641907156734, 0.03877584009557845, 0.053815651359618306, -1.7784925488688835e-17, -0.10438790447320523, -0.15189056991050237, -0.0572037561343009, 0.11868165224052167, 0.20778815626012964], 1e-14, 'firwin');
  fir.b.forEach((value, index) => assert.ok(Math.abs(value - fir.b[fir.b.length - 1 - index]) < 1e-15));
  const lowpass = designFir({ type: 'lowpass', taps: 41, cutoff: 1000, sampleRate: 8000, window: 'hamming' });
  assert.equal(fir.b.length, 31);
  assert.ok(Math.abs(lowpass.b.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  const response = frequencyResponseDigital(lowpass.b, lowpass.a, 8000, 401);
  response.groupDelay.slice(5, 60).forEach((delay) => assert.ok(Math.abs(delay - 20) < 1e-6));
  assert.throws(() => designFir({ type: 'highpass', taps: 20, cutoff: 1000 }), /odd number/);
  assert.throws(() => designIir({ cutoff: 5000, sampleRate: 8000 }), /Nyquist/);
});

test('polynomial roots, lfilter and convolution steps', () => {
  const roots = polyRoots([1, -6, 11, -6]).map((root) => root.re);
  close(roots, [1, 2, 3], 1e-10, 'roots');
  const quartic = polyRoots([1, 0, 0, 0, 1]);
  quartic.forEach((root) => assert.ok(Math.abs(Math.hypot(root.re, root.im) - 1) < 1e-10 && Math.abs(Math.abs(root.re) - Math.SQRT1_2) < 1e-10));
  close(polyFromRoots(quartic), [1, 0, 0, 0, 1], 1e-10, 'rebuilt');
  close(polyRoots([2, 0, 0]).map((root) => root.re), [0, 0], 0, 'zero roots');
  // y[n] = x[n] + 0.5 y[n-1]: impulse response 0.5^n.
  close(impulseResponse([1], [1, -0.5], 6), [1, 0.5, 0.25, 0.125, 0.0625, 0.03125], 1e-15, 'impulse');
  close(lfilter([1, 1], [2], [2, 4, 6]), [1, 3, 5], 1e-15, 'fir lfilter');
  const fir = poleZero({ b: [1, -1], a: [1] });
  assert.equal(fir.zeros.length, 1); assert.ok(Math.abs(fir.zeros[0].re - 1) < 1e-12);
  const steps = convolutionSteps([1, 2, 3], [1, 1]);
  assert.deepEqual(steps.map((step) => step.value), [1, 3, 5, 3]);
  assert.equal(steps[1].terms.length, 2);
  assert.throws(() => convolutionSteps([], [1]), RangeError);
});
