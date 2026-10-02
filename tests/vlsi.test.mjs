import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROCESS, delayTheory, dynamicPower, inverterTransient, inverterVtc, level1Current, solveOutput, symmetricPmosWidth } from '../packages/vlsi/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const ideal = { ...DEFAULT_PROCESS, lambdaN: 0, lambdaP: 0 };

test('level-1 MOSFET regions', () => {
  const device = { vt: 0.5, kp: 100e-6, w: 2, l: 1, lambda: 0 };
  assert.equal(level1Current(0.4, 1, device), 0);
  near(level1Current(1.5, 0.2, device), 200e-6 * (1 * 0.2 - 0.02), 1e-15, 'linear');
  near(level1Current(1.5, 2, device), 100e-6 * 1, 1e-15, 'saturation');
  near(level1Current(1.5, 2, { ...device, lambda: 0.1 }), 100e-6 * 1.2, 1e-15, 'channel-length modulation');
  near(level1Current(1.5, -0.2, device), -level1Current(1.7, 0.2, device), 1e-15, 'source/drain swap');
});

test('inverter VTC matches the long-channel closed forms (λ = 0)', () => {
  const vtc = inverterVtc(ideal);
  const theory = vtc.theory;
  near(vtc.vm, theory.vm, 1e-6, 'VM'); near(vtc.vil, theory.vil, 1e-4, 'VIL'); near(vtc.vih, theory.vih, 1e-4, 'VIH');
  near(vtc.voh, 1.8, 1e-9, 'VOH'); near(vtc.vol, 0, 1e-9, 'VOL');
  near(vtc.nml, theory.vil, 1e-4, 'NML'); near(vtc.nmh, 1.8 - theory.vih, 1e-4, 'NMH');
  // A stronger NMOS pulls VM down.
  assert.ok(inverterVtc({ ...ideal, wn: 4 }).vm < vtc.vm);
  near(symmetricPmosWidth(ideal), 2.5, 1e-9, 'symmetric sizing (kp′·Wp = kn′·Wn)');
});

// Reference: ngspice 42, LEVEL=1 models (VTO ±0.45, KP 200u/80u, LAMBDA 0.05/0.1, W 1u/2.5u, L 1u),
// DC sweep and a 1 fs-edge pulse into 100 fF: VM 0.905, VIL 0.7795, VIH 1.033;
// Vout(0.5 V) = 1.79839591 V, Vout(1.2 V) = 17.8703 mV; tPHL 472.007 ps, tPLH 444.222 ps, tf 1.08536 ns, tr 1.04872 ns.
test('inverter with channel-length modulation agrees with ngspice', () => {
  const vtc = inverterVtc(DEFAULT_PROCESS);
  near(vtc.vm, 0.905, 0.001, 'VM'); near(vtc.vil, 0.7795, 0.001, 'VIL'); near(vtc.vih, 1.033, 0.001, 'VIH');
  near(solveOutput(0.5), 1.79839591, 1e-6, 'Vout at 0.5 V (ngspice)'); near(solveOutput(1.2), 0.0178703282, 1e-6, 'Vout at 1.2 V (ngspice)');
  const transient = inverterTransient(DEFAULT_PROCESS, { cl: 100e-15, steps: 60_000 });
  near(transient.tphl, 472.007e-12, 0.5e-12, 'tPHL'); near(transient.tplh, 444.222e-12, 0.5e-12, 'tPLH');
  near(transient.fallTime, 1.08536e-9, 1e-12, 'fall time'); near(transient.riseTime, 1.04872e-9, 1e-12, 'rise time');
});

test('step-input delays and switching energy', () => {
  const transient = inverterTransient(ideal, { cl: 100e-15 });
  const theory = delayTheory(ideal, 100e-15);
  near(transient.tphl, theory.tphl, theory.tphl * 0.001, 'tPHL formula'); near(transient.tplh, theory.tplh, theory.tplh * 0.001, 'tPLH formula');
  near(transient.energyPerCycle, 100e-15 * 1.8 * 1.8, 100e-15 * 1.8 * 1.8 * 0.002, 'energy C·VDD² per cycle');
  assert.ok(inverterTransient(ideal, { cl: 100e-15, riseTime: 1e-9 }).tphl > 0, 'a slow input still switches');
  const power = dynamicPower({ cl: 100e-15, vdd: 1.8, frequency: 100e6, activity: 0.5 });
  near(power.dynamic, 0.5 * 100e-15 * 3.24 * 100e6, 1e-12, 'αCV²f');
});
