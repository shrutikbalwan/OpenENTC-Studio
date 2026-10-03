import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autocorrelation, cepstrum, formants, hzToMel, levinson, lpc, lpcSpectrum, melFilterbank, melToHz, mfcc, pitchAmdf, pitchAutocorrelation, polynomialRoots, shortTimeFeatures, spectrogram, synthesizeNoise, synthesizeVowel } from '../packages/speech/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const reference = JSON.parse(readFileSync(new URL('./fixtures/speech/psf-mfcc.json', import.meta.url), 'utf8'));

test('MFCCs equal python_speech_features frame for frame', () => {
  const fs = 16000;
  const x = Array.from({ length: 4800 }, (_, n) => { const t = n / fs; return 0.5 * Math.sin(2 * Math.PI * 220 * t) + 0.3 * Math.sin(2 * Math.PI * 1250 * t + 0.3) + 0.2 * Math.sin(2 * Math.PI * 3100 * t + 1.1) * Math.exp(-3 * t); });
  const features = mfcc(x, { fs });
  assert.deepEqual([features.length, features[0].length], reference.shape);
  reference.mfcc.forEach((row, i) => row.forEach((value, k) => near(features[i * 5][k], value, 1e-7, `frame ${i * 5} c${k}`)));
  near(melToHz(hzToMel(1000)), 1000, 1e-9, 'mel round trip');
  near(hzToMel(1000), 999.9855, 1e-3, '1000 Hz ≈ 1000 mel');
  const bank = melFilterbank({ filters: 26, nfft: 512, fs: 16000 });
  assert.equal(bank.length, 26);
  assert.ok(bank.every((row) => Math.max(...row) <= 1 && Math.max(...row) > 0.5));
});

test('Levinson–Durbin solves the Toeplitz normal equations', () => {
  const x = synthesizeVowel({ fs: 8000 }).slice(800, 1200);
  const r = autocorrelation(x, 8);
  const { a, reflection, error } = levinson(r, 8);
  // Check R·a = r[1..p] directly.
  for (let i = 0; i < 8; i += 1) near(a.reduce((sum, ak, k) => sum + ak * r[Math.abs(i - k)], 0), r[i + 1], 1e-9 * r[0], `row ${i}`);
  near(error, r[0] - a.reduce((sum, ak, k) => sum + ak * r[k + 1], 0), 1e-9 * r[0], 'prediction error');
  assert.ok(reflection.every((k) => Math.abs(k) < 1), 'stable: |k| < 1');
  const roots = polynomialRoots([1, -3, 2]);
  assert.deepEqual(roots.map((z) => Math.round(z.re * 1e9) / 1e9).sort(), [1, 2]);
});

test('LPC recovers the formants of a synthetic /a/ and pitch estimators find f0', () => {
  const vowel = synthesizeVowel({ f0: 120, formants: [[730, 90], [1090, 110], [2440, 170]], fs: 8000 });
  const model = lpc(vowel.slice(1000, 1400), 10);
  const found = formants(model.a, { fs: 8000 });
  [730, 1090, 2440].forEach((f, k) => near(found[k].frequency, f, 0.03 * f, `F${k + 1}`));
  const env = lpcSpectrum(model.a, model.gain, { fs: 8000, points: 401 });
  const peakIndex = env.db.indexOf(Math.max(...env.db.slice(0, 150)));
  near(env.freqs[peakIndex], 730, 80, 'envelope peak near F1');
  for (const f0 of [100, 120, 200]) {
    const frame = synthesizeVowel({ f0, fs: 8000 }).slice(1000, 1320);
    near(pitchAutocorrelation(frame, { fs: 8000 }).f0, f0, 0.02 * f0, `autocorrelation ${f0}`);
    near(pitchAmdf(frame, { fs: 8000 }).f0, f0, 0.03 * f0, `AMDF ${f0}`);
    near(cepstrum(frame, { fs: 8000 }).f0, f0, 0.03 * f0, `cepstrum ${f0}`);
  }
});

test('energy and zero-crossing rate separate voiced, unvoiced and silence', () => {
  const fs = 8000;
  const signal = [...synthesizeVowel({ fs, duration: 0.2 }), ...new Array(1600).fill(0), ...synthesizeNoise({ fs, duration: 0.2 })];
  const st = shortTimeFeatures(signal, { fs });
  const at = (t) => st.label[st.times.findIndex((time) => time >= t)];
  assert.equal(at(0.1), 'voiced');
  assert.equal(at(0.3), 'silence');
  assert.equal(at(0.5), 'unvoiced');
  const spec = spectrogram(signal, { fs, nfft: 256 });
  assert.equal(spec.db[0].length, 129);
  near(spec.freqs.at(-1), 4000, 1e-9, 'Nyquist');
});
