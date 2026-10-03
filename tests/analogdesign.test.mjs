import test from 'node:test';
import assert from 'node:assert/strict';
import { butterworthQs, designBandpass, designBias, designLm317, designOscillator, designPll, designSallenKey, designSchmitt, designZener, networkGain } from '../packages/analogdesign/src/index.mjs';
import { simulateDC } from '../src/engines/circuit-engine.js';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const rel = (actual, expected, tolerance, label) => near(actual, expected, Math.abs(expected) * tolerance, label);

test('voltage-divider bias: textbook rules, exact Q-point and the circuit simulator agree', () => {
  const ideal = designBias({ vcc: 12, ic: 2e-3, beta: 100, series: 'exact' });
  rel(ideal.q.ic, 2e-3, 1e-9, 'IC with exact parts');
  rel(ideal.q.vce, 6, 1e-9, 'VCE = VCC/2');
  rel(ideal.q.ve, 1.2, 1e-9, 'VE = 0.1 VCC');
  const design = designBias({ vcc: 12, ic: 2e-3, beta: 100 });
  assert.deepEqual(design.chosen, { re: 620, rc: 2400, r1: 47000, r2: 9100 });
  // Boylestad's exact analysis of the chosen parts, by hand.
  const vth = 12 * 9100 / 56100, rth = 47000 * 9100 / 56100, ib = (vth - 0.7) / (rth + 101 * 620);
  rel(design.q.ib, ib, 1e-12, 'IB');
  rel(design.q.vce, 12 - 100 * ib * 2400 - 101 * ib * 620, 1e-12, 'VCE');
  rel(design.stability, 101 / (1 + 100 * 620 / (620 + rth)), 1e-12, 'S');
  // The built-in Ebers–Moll solver (VBE from the diode law, not a fixed 0.7 V) lands within a few per cent.
  const dc = simulateDC(design.components);
  const icSim = (dc.nodes.vcc - dc.nodes.c) / 2400;
  rel(icSim, design.q.ic, 0.05, 'simulated IC');
  near(dc.nodes.c - dc.nodes.e, design.q.vce, 0.3, 'simulated VCE');
  rel(design.smallSignal.re, 0.02585 / design.q.ie, 1e-12, 're');
  assert.ok(design.smallSignal.gain < -100);
  assert.throws(() => designBias({ reFraction: 0.5, vceFraction: 0.5 }), /room/);
});

test('oscillator feedback networks have the textbook β at the design frequency', () => {
  const wien = designOscillator({ type: 'wien', frequency: 1000, c: 10e-9 });
  near(wien.feedback.magnitude, 1 / 3, 1e-9, 'Wien β');
  near(wien.feedback.phase, 0, 1e-6, 'Wien phase');
  rel(wien.actual, 1 / (2 * Math.PI * 16e3 * 10e-9), 1e-12, 'Wien f');
  assert.equal(wien.values.Rf, 2 * wien.values.R1);
  const phase = designOscillator({ type: 'phase', frequency: 1000, c: 10e-9 });
  near(phase.feedback.magnitude, 1 / 29, 1e-9, 'phase-shift β');
  near(Math.abs(phase.feedback.phase), 180, 1e-6, 'phase-shift phase');
  rel(designOscillator({ type: 'phase', frequency: 1000, c: 10e-9, series: 'exact' }).actual, 1000, 1e-12, 'exact f');
  const colpitts = designOscillator({ type: 'colpitts', frequency: 1e6, l: 10e-6, series: 'exact' });
  rel(colpitts.actual, 1e6, 1e-12, 'Colpitts f');
  rel(colpitts.requiredGain, 10, 1e-12, 'C2/C1');
  const hartley = designOscillator({ type: 'hartley', frequency: 1e6, l: 10e-6, ratio: 0.2, series: 'exact' });
  rel(hartley.actual, 1e6, 1e-12, 'Hartley f');
  rel(hartley.requiredGain, 4, 1e-12, 'L1/L2');
  const xtal = designOscillator({ type: 'crystal' });
  assert.ok(xtal.parallel > xtal.actual && xtal.parallel / xtal.actual < 1.01);
  rel(xtal.parallel / xtal.actual, Math.sqrt(1 + 0.0199e-12 / 5.6e-12), 1e-9, 'fp/fs');
});

test('Sallen–Key Butterworth filters of every order follow |H|² = 1/(1 + (f/fc)^2n)', () => {
  near(butterworthQs(2)[0], Math.SQRT1_2, 1e-12, 'Q of order 2');
  assert.deepEqual(butterworthQs(4).map((q) => Number(q.toFixed(4))), [1.3066, 0.5412]);
  for (const kind of ['lowpass', 'highpass']) {
    for (let order = 1; order <= 6; order += 1) {
      const design = designSallenKey({ kind, order, fc: 2000, c: 10e-9, series: 'exact' });
      for (const ratio of [0.25, 0.5, 1, 2, 4]) {
        const f = 2000 * ratio, x = kind === 'lowpass' ? ratio : 1 / ratio;
        near(20 * Math.log10(networkGain(design.netlist, f).magnitude), -10 * Math.log10(1 + x ** (2 * order)), 1e-4, `${kind} n=${order} at ${ratio}·fc`);
      }
    }
    const real = designSallenKey({ kind, order: 4, fc: 2000, c: 10e-9, series: 'E96' });
    near(real.atCutoffDb, -3.01, 0.25, `${kind} with E96 parts`);
  }
});

test('MFB band-pass: centre gain, Q and frequency from the chosen parts match the solver', () => {
  const exact = designBandpass({ f0: 1000, q: 5, gain: 2, series: 'exact' });
  rel(exact.f0, 1000, 1e-12, 'f0');
  rel(exact.q, 5, 1e-12, 'Q');
  rel(exact.centre.magnitude, 2, 1e-5, 'centre gain');
  const real = designBandpass({ f0: 1000, q: 5, gain: 2 });
  rel(real.centre.magnitude, real.gain, 1e-5, 'gain of E24 parts');
  const upper = networkGain(real.netlist, real.f0 * (Math.sqrt(1 + 1 / (4 * real.q ** 2)) + 1 / (2 * real.q)));
  rel(upper.magnitude, real.gain / Math.SQRT2, 1e-4, 'upper −3 dB edge');
  assert.throws(() => designBandpass({ q: 1, gain: 3 }), /2Q²/);
});

test('regulators, Schmitt trigger and PLL', () => {
  const z = designZener({ vinMin: 12, vinMax: 15, vz: 5.1, izMin: 5e-3, ilMax: 20e-3 });
  rel(z.ideal, 276, 1e-12, 'ideal Rs');
  assert.equal(z.rs, 270);
  assert.ok(z.ok && z.izAtMin >= 5e-3);
  rel(z.pz, 5.1 * (15 - 5.1) / 270, 1e-12, 'Zener power with no load');
  const lm = designLm317({ vout: 5, vin: 9, iload: 0.5, r1: 240, series: 'exact' });
  rel(lm.vout, 5, 1e-12, 'LM317 Vout');
  rel(lm.dissipation, 2, 1e-12, 'LM317 power');
  for (const kind of ['inverting', 'noninverting']) {
    const s = designSchmitt({ vut: 2, vlt: -1, vsat: 13, kind, series: 'exact' });
    rel(s.vut, 2, 1e-12, `${kind} VUT`);
    rel(s.vlt, -1, 1e-12, `${kind} VLT`);
  }
  const pll = designPll({ rt: 10e3, ct: 10e-9, c2: 10e-6, vcc: 12 });
  rel(pll.f0, 3000, 1e-12, '565 f0');
  rel(pll.lockRange, 2000, 1e-12, 'lock range');
  rel(pll.captureRange, Math.sqrt(2 * Math.PI * 2000 / (3.6e3 * 10e-6)) / (2 * Math.PI), 1e-12, 'capture range');
});
