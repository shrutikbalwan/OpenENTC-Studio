import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bandPowers, biquad, cleanEcg, EEG_STATES, filtfilt, hrv, hrvSpectrum, panTompkins, scoreDetections, synthesizeEcg, synthesizeEeg, welch } from '../packages/biomed/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/biomed/${name}`, import.meta.url), 'utf8'));

test('Pan–Tompkins finds every synthetic beat, including ectopics, noise and wander', () => {
  for (const options of [{}, { heartRate: 130, emg: 0.08, mains: 0.2 }, { pvcEvery: 4 }, { heartRate: 45, baseline: 0.8 }, { duration: 60, seed: 5, hrvStd: 0.08 }, { mainsFrequency: 60, seed: 9 }]) {
    const ecg = synthesizeEcg(options);
    const score = scoreDetections(panTompkins(ecg.signal, ecg.sampleRate).rPeaks, ecg.beats.map((b) => b.sample), ecg.sampleRate);
    assert.equal(score.sensitivity, 1, JSON.stringify(options)); assert.equal(score.ppv, 1, JSON.stringify(options));
  }
});

test('Pan–Tompkins on a real arrhythmic recording agrees with three independent detectors', () => {
  // scipy.datasets.electrocardiogram (MIT-BIH 208, frequent PVCs), first 60 s; consensus = beats found by
  // at least two of NeuroKit2's neurokit, pantompkins1985 and hamilton2002 detectors.
  const data = fixture('scipy-ecg-208.json');
  const bytes = Buffer.from(data.adc, 'base64'), codes = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  const x = Float64Array.from(codes, (v) => v / 200);
  const detected = panTompkins(x, data.fs).rPeaks;
  near(detected.length, data.consensus.length, 2, 'beat count');
  const score = scoreDetections(detected, data.consensus, data.fs, 0.05);
  assert.ok(score.sensitivity >= 0.9 && score.ppv >= 0.9, JSON.stringify(score));
});

test('zero-phase cleaning removes wander and mains without shifting the R peaks', () => {
  const ecg = synthesizeEcg({ baseline: 0.8, mains: 0.3, emg: 0 });
  const cleaned = cleanEcg(ecg.signal, ecg.sampleRate);
  const rms = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
  assert.ok(rms(cleaned, ecg.clean) < 0.3 * rms(ecg.signal, ecg.clean), 'closer to the clean ECG');
  const peaks = panTompkins(cleaned, ecg.sampleRate).rPeaks;
  for (const beat of ecg.beats) assert.ok(peaks.some((p) => Math.abs(p - beat.sample) <= 2), `R at ${beat.sample}`);
  // A notch kills its own frequency: steady-state gain at 50 Hz ≈ 0.
  const tone = Float64Array.from({ length: 3600 }, (_, k) => Math.sin(2 * Math.PI * 50 * k / 360));
  const out = filtfilt(biquad('notch', 50, 360, 30), tone);
  assert.ok(Math.max(...out.slice(1000, 2600).map(Math.abs)) < 0.01);
});

test('HRV time-domain and Poincaré measures follow their definitions', () => {
  const fs = 1000, rr = [800, 820, 790, 860, 810, 805, 840];
  const peaks = [0]; for (const v of rr) peaks.push(peaks.at(-1) + v);
  const h = hrv(peaks, fs);
  const mean = rr.reduce((s, v) => s + v, 0) / rr.length;
  near(h.meanRr, mean, 1e-9, 'mean RR'); near(h.meanHr, 60000 / mean, 1e-9, 'HR');
  near(h.sdnn, Math.sqrt(rr.reduce((s, v) => s + (v - mean) ** 2, 0) / (rr.length - 1)), 1e-9, 'SDNN');
  const d = rr.slice(1).map((v, i) => v - rr[i]);
  near(h.rmssd, Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length), 1e-9, 'RMSSD');
  near(h.pnn50, d.filter((v) => Math.abs(v) > 50).length / d.length, 1e-12, 'pNN50');
  // A purely respiratory (0.25 Hz) modulation puts the power in HF.
  const ecg = synthesizeEcg({ duration: 180, hrvStd: 0, rsa: 0.06, respiration: 0.25 });
  assert.ok(hrvSpectrum(ecg.beats.map((b) => b.sample), ecg.sampleRate).ratio < 0.2);
  const slow = synthesizeEcg({ duration: 180, hrvStd: 0, rsa: 0.06, respiration: 0.1 });
  assert.ok(hrvSpectrum(slow.beats.map((b) => b.sample), slow.sampleRate).ratio > 5, 'Mayer-wave (0.1 Hz) power is LF');
});

test('Welch PSD equals scipy.signal.welch; EEG states have the expected dominant band', () => {
  const ref = fixture('scipy-welch.json');
  const x = Float64Array.from({ length: ref.fs * 8 }, (_, n) => 20 * Math.sin(2 * Math.PI * 10.3 * n / ref.fs) + 8 * Math.sin(2 * Math.PI * 3.1 * n / ref.fs + 1) + 5 * Math.cos(2 * Math.PI * 21.7 * n / ref.fs) + 3 * Math.sin(0.37 * n) ** 3 + 2);
  const psd = welch(x, ref.fs, { segment: ref.nperseg });
  ref.psd.forEach((v, i) => near(psd.power[i], v, 1e-9 * Math.max(1, v), `PSD[${i}]`));
  const expected = { relaxed: 'alpha', alert: 'beta', drowsy: 'theta', sleep: 'delta' };
  for (const state of Object.keys(EEG_STATES)) {
    const eeg = synthesizeEeg({ state, seed: 4 });
    const powers = bandPowers(eeg.signal, eeg.sampleRate);
    assert.equal(powers.dominant, expected[state], state);
    near(powers.bands.reduce((s, b) => s + b.relative, 0), 1, 0.02, 'relative powers sum to 1');
  }
});
