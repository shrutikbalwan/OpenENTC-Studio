import test from 'node:test';
import assert from 'node:assert/strict';
import { converterTheory, harmonics, periodStats, rectifierTheory, simulateAcController, simulateConverter, simulateInverter, simulateRectifier } from '../packages/power/src/index.mjs';

const near = (actual, expected, relative, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * relative + 1e-9, `${label}: ${actual} vs ${expected}`);
const VM = 230 * Math.SQRT2;

test('waveform statistics and Fourier coefficients', () => {
  const n = 3600;
  const square = Array.from({ length: n }, (_, k) => (k < n / 2 ? 1 : -1));
  const h = harmonics(square, 9);
  near(h.list[0].amplitude, 4 / Math.PI, 1e-5, 'square fundamental');
  near(h.list[2].amplitude, 4 / (3 * Math.PI), 1e-4, 'third harmonic');
  assert.ok(h.list[1].amplitude < 1e-9, 'no even harmonics');
  const sine = Array.from({ length: n }, (_, k) => 2 + 3 * Math.sin(2 * Math.PI * k / n + 0.5));
  const s = harmonics(sine, 3);
  near(s.dc, 2, 1e-9, 'dc'); near(s.list[0].amplitude, 3, 1e-9, 'amplitude'); near(s.list[0].phase, 0.5 * 180 / Math.PI, 1e-6, 'phase');
  assert.deepEqual(periodStats([1, 3]), { mean: 2, rms: Math.sqrt(5), max: 3, min: 1, pp: 2 });
});

test('controlled rectifiers match the textbook Vdc and Vrms formulas', () => {
  const cases = [
    ['half-wave', 30, 0], ['half-wave-fwd', 45, 0.1], ['full-bridge', 30, 0], ['full-bridge', 60, 1], ['semi-bridge', 60, 0.1],
    ['three-pulse', 20, 1], ['three-pulse', 60, 0], ['six-pulse', 30, 0.5], ['six-pulse', 45, 0], ['six-pulse', 90, 0],
  ];
  for (const [type, alpha, l] of cases) {
    const result = simulateRectifier({ type, alpha, vm: VM, r: 10, l });
    near(result.vdc, result.theory.vdc, 0.004, `${type} α=${alpha}° L=${l} Vdc`);
    if (result.theory.vrms) near(result.vrms, result.theory.vrms, 0.002, `${type} Vrms`);
  }
  // Highly inductive full converter: square source current, PF = 0.9·cos α, THD 48.3 %.
  const big = simulateRectifier({ type: 'full-bridge', alpha: 30, vm: VM, r: 1, l: 5 });
  assert.equal(big.continuous, true);
  near(big.inputPowerFactor, 2 * Math.SQRT2 / Math.PI * Math.cos(Math.PI / 6), 0.01, 'PF');
  near(big.currentThd, 0.4834, 0.03, 'square-current THD');
  // Diode bridge = α 0; with a capacitor the ripple is below the Vm/(2fRC) estimate.
  const diode = simulateRectifier({ type: 'full-bridge', controlled: false, vm: VM, r: 10 });
  near(diode.vdc, 2 * VM / Math.PI, 0.001, 'diode bridge');
  const filtered = simulateRectifier({ type: 'full-bridge', controlled: false, vm: VM, r: 100, c: 1e-3 });
  assert.ok(filtered.ripple < filtered.theory.ripple && filtered.ripple > 0.75 * filtered.theory.ripple);
  near(filtered.vdc, VM - filtered.ripple / 2, 0.01, 'filtered Vdc');
  // A DC motor (back EMF) only conducts while the source exceeds E.
  const motor = simulateRectifier({ type: 'full-bridge', alpha: 30, vm: VM, r: 2, l: 0.01, e: 150 });
  assert.ok(Math.min(...motor.waveform.io) >= 0 && motor.vdc > 150);
  assert.throws(() => simulateRectifier({ type: 'twelve-pulse' }), /Unknown rectifier/);
  assert.equal(rectifierTheory({ type: 'six-pulse', alpha: 0, vm: 100, r: 1 }).vdc, 3 * Math.sqrt(3) * 100 / Math.PI);
});

// Reference for the DCM buck: ngspice 42 with an ideal switch (Ron 1 mΩ) and near-ideal diode,
// 0.8 ms run → Vo = 17.1925 V, iL peak 4.0999 A, Vo ripple 0.10747 V.
test('DC-DC converters: CCM against the formulas, DCM buck against ngspice', () => {
  const buck = simulateConverter({ type: 'buck', vin: 24, duty: 0.5, frequency: 50e3, l: 100e-6, c: 100e-6, r: 10 });
  assert.equal(buck.mode, 'CCM');
  near(buck.vo, 12, 1e-4, 'buck Vo'); near(buck.rippleI, 1.2, 0.002, 'buck ΔI'); near(buck.rippleV, 0.03, 0.002, 'buck ΔV');
  const boost = simulateConverter({ type: 'boost', vin: 12, duty: 0.6, frequency: 50e3, l: 200e-6, c: 220e-6, r: 20 });
  near(boost.vo, 30, 1e-3, 'boost Vo'); near(boost.rippleI, boost.theory.rippleI, 0.002, 'boost ΔI'); near(boost.ilAverage, 3.75, 1e-3, 'boost IL');
  const inverting = simulateConverter({ type: 'buck-boost', vin: 12, duty: 0.6, frequency: 50e3, l: 200e-6, c: 220e-6, r: 20 });
  near(inverting.vo, -18, 1e-3, 'buck-boost Vo'); near(inverting.rippleV, inverting.theory.rippleV, 0.002, 'buck-boost ΔV');
  const dcm = simulateConverter({ type: 'buck', vin: 24, duty: 0.3, frequency: 50e3, l: 10e-6, c: 100e-6, r: 20 });
  assert.equal(dcm.mode, 'DCM'); assert.equal(dcm.theory.ccm, false);
  near(dcm.vo, 17.1925, 0.001, 'DCM Vo vs ngspice'); near(dcm.ilMax, 4.0999, 0.001, 'DCM iL peak'); near(dcm.rippleV, 0.10747, 0.005, 'DCM ripple');
  near(dcm.vo, dcm.theory.vo, 0.002, 'DCM formula');
  for (const [type, d] of [['boost', 0.4], ['buck-boost', 0.3]]) { const r = simulateConverter({ type, vin: 12, duty: d, frequency: 50e3, l: 5e-6, c: 220e-6, r: type === 'boost' ? 50 : 20 }); assert.equal(r.mode, 'DCM'); near(r.vo, r.theory.vo, 0.002, `${type} DCM`); }
  assert.equal(converterTheory({ type: 'buck', vin: 10, duty: 0.5, frequency: 1e3, l: 1, c: 1, r: 1 }).criticalL, 0.00025);
  assert.throws(() => simulateConverter({ duty: 1 }), /Duty/);
});

test('inverters: fundamental and THD of square, quasi-square, SPWM and three-phase outputs', () => {
  const square = simulateInverter({ mode: 'square', vdc: 400 });
  near(square.fundamentalPeak, 1600 / Math.PI, 1e-4, 'square V1'); near(square.voltageThd, 0.4834, 0.002, 'square THD');
  const quasi = simulateInverter({ mode: 'quasi-square', vdc: 400, width: 120 });
  near(quasi.fundamentalPeak, quasi.theory.fundamentalPeak, 2e-4, 'quasi-square V1');
  assert.ok(quasi.spectrum[2].amplitude < 1e-3 * quasi.fundamentalPeak, '120° pulse removes the 3rd harmonic');
  for (const mode of ['spwm-bipolar', 'spwm-unipolar']) near(simulateInverter({ mode, vdc: 400, ma: 0.8, mf: 21 }).fundamentalPeak, 320, 0.003, `${mode} V1`);
  const bipolar = simulateInverter({ mode: 'spwm-bipolar', ma: 0.8, mf: 21 }), unipolar = simulateInverter({ mode: 'spwm-unipolar', ma: 0.8, mf: 21 });
  assert.ok(unipolar.voltageThd < bipolar.voltageThd, 'unipolar PWM has less distortion');
  assert.ok(bipolar.spectrum[20].amplitude > 0.3 * 400 && unipolar.spectrum[20].amplitude < 0.02 * 400, 'bipolar has the carrier harmonic at mf, unipolar at 2mf');
  const six = simulateInverter({ mode: 'three-phase-six-step', vdc: 400 });
  near(six.fundamentalPeak, 2 * Math.sqrt(3) / Math.PI * 400, 1e-3, 'six-step line V1');
  near(six.phaseSpectrum[0].amplitude, 2 / Math.PI * 400, 1e-3, 'six-step phase V1');
  near(simulateInverter({ mode: 'three-phase-spwm', vdc: 400, ma: 0.8, mf: 21 }).fundamentalPeak, Math.sqrt(3) / 2 * 0.8 * 400, 0.003, '3-phase SPWM V1');
  assert.ok(six.spectrum[2].amplitude < 1e-4 * 400, 'no triplen harmonics in the line voltage'); // (sampling leaves ~1e-5)
});

test('AC voltage controller RMS output', () => {
  for (const alpha of [0, 60, 90, 135]) { const result = simulateAcController({ vm: VM, alpha, r: 10 }); near(result.vrms, result.theory.vrms, 0.002, `α=${alpha}`); }
  const rl = simulateAcController({ vm: VM, alpha: 20, r: 10, l: 0.05 }); // α below the load angle (57.5°): full conduction
  near(rl.vrms, 230, 0.002, 'full conduction');
});
