import test from 'node:test';
import assert from 'node:assert/strict';
import { coaxImpedance, freeSpacePathLossDb, lineInputImpedance, linearArray, linkBudget, lMatch, microstrip, microstripWidth, quarterWaveMatch, reflection, singleStubMatch, transmissionLine } from '../packages/rf/src/index.mjs';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test('reflection coefficient, VSWR and return loss', () => {
  const r = reflection({ re: 100, im: 0 }, 50);
  near(r.magnitude, 1 / 3, 1e-12, '|Γ|');
  near(r.vswr, 2, 1e-12, 'VSWR');
  near(r.returnLossDb, 9.5424, 1e-4, 'return loss');
  near(r.mismatchLossDb, 0.5115, 1e-4, 'mismatch loss');
  assert.equal(reflection({ re: 50, im: 0 }, 50).vswr, 1);
  assert.equal(reflection({ re: 0, im: 25 }, 50).vswr, Infinity);
});

// Pozar, Microwave Engineering, Example 5.1: ZL = 200 − j100 Ω to 100 Ω at 500 MHz.
test('L-network matching reproduces Pozar example 5.1 and verifies Zin = Z0', () => {
  const { solutions } = lMatch({ re: 200, im: -100 }, 100, 500e6);
  assert.equal(solutions.length, 2);
  near(solutions[0].shunt.value, 0.92e-12, 0.01e-12, 'C1');
  near(solutions[0].series.value, 38.8e-9, 0.3e-9, 'L1 (book value rounded)');
  near(solutions[1].shunt.value, 46.1e-9, 0.1e-9, 'L2');
  near(solutions[1].series.value, 2.61e-12, 0.02e-12, 'C2');
  for (const load of [{ re: 200, im: -100 }, { re: 20, im: 30 }, { re: 10, im: -80 }]) {
    for (const solution of lMatch(load, 50, 1e8).solutions) { near(solution.inputImpedance.re, 50, 1e-9, 'Re Zin'); near(solution.inputImpedance.im, 0, 1e-9, 'Im Zin'); }
  }
  assert.throws(() => lMatch({ re: -5, im: 0 }), /positive/);
});

test('transmission lines: quarter-wave inversion, stub and quarter-wave matches', () => {
  const zin = lineInputImpedance({ re: 100, im: 50 }, 50, 0.25);
  near(zin.re, 20, 1e-9, 'Re'); near(zin.im, -10, 1e-9, 'Im');
  const half = lineInputImpedance({ re: 30, im: 40 }, 50, 0.5);
  near(half.re, 30, 1e-9, 'half-wave repeats');
  const line = transmissionLine({ load: { re: 100, im: 0 }, z0: 50, length: 0.5 });
  near(Math.max(...line.trace.map((p) => p.voltage)) / Math.min(...line.trace.map((p) => p.voltage)), 2, 1e-3, 'standing-wave ratio');
  near(line.firstMaximum, 0, 1e-12, 'Vmax at a resistive load above Z0');
  // Pozar Example 5.2 load: 60 − j80 Ω on 50 Ω.
  const stubs = singleStubMatch({ re: 60, im: -80 }, 50);
  near(stubs[0].distance, 0.110, 1e-3, 'd1'); near(stubs[1].distance, 0.259, 1e-3, 'd2');
  for (const stub of stubs) { near(stub.inputAdmittance.re, 0.02, 1e-12, 'Re Y'); near(stub.inputAdmittance.im, 0, 1e-12, 'Im Y'); }
  const qw = quarterWaveMatch({ re: 100, im: 0 }, 50);
  near(qw.transformerImpedance, Math.sqrt(5000), 1e-9, 'real load');
  const complexLoad = quarterWaveMatch({ re: 100, im: 50 }, 50);
  const atOffset = lineInputImpedance({ re: 100, im: 50 }, 50, complexLoad.offset);
  near(atOffset.im, 0, 1e-9, 'impedance is real at the transformer');
  near(atOffset.re, complexLoad.realImpedance, 1e-9, 'real impedance');
});

test('microstrip, coax and free-space loss formulas', () => {
  const design = microstripWidth({ impedance: 50, height: 1.6, permittivity: 4.4 });
  near(design.width, 3.06, 0.02, 'FR-4 50 Ω width (mm)');
  near(microstrip({ width: design.width, height: 1.6, permittivity: 4.4 }).impedance, 50, 1e-6, 'round trip');
  near(coaxImpedance({ inner: 1, outer: Math.E, permittivity: 1 }).impedance, 59.9585, 1e-3, 'coax ln(D/d) = 1');
  near(freeSpacePathLossDb(1000, 2.4e9), 100.05, 0.01, 'FSPL');
  assert.throws(() => coaxImpedance({ inner: 3, outer: 2 }), /exceed/);
});

test('antenna arrays: element directivity, broadside beam and end-fire', () => {
  near(linearArray({ elements: 1, element: 'isotropic' }).directivity, 1, 1e-9, 'isotropic');
  near(linearArray({ elements: 1, element: 'short-dipole' }).directivity, 1.5, 1e-6, 'short dipole');
  near(linearArray({ elements: 1, element: 'half-wave-dipole' }).directivity, 1.641, 1e-3, 'half-wave dipole');
  near(linearArray({ elements: 1, element: 'half-wave-dipole' }).beamwidth, 78, 0.5, 'half-wave dipole HPBW');
  const broadside = linearArray({ elements: 8, spacing: 0.5, steer: 90 });
  near(broadside.directivity, 8, 1e-6, '2Nd/λ');
  near(broadside.mainBeam, 90, 0.25, 'beam direction');
  near(broadside.beamwidth, 12.8, 0.1, 'HPBW');
  near(broadside.sidelobeDb, -12.8, 0.1, 'first sidelobe');
  const steered = linearArray({ elements: 8, spacing: 0.5, steer: 60 });
  near(steered.mainBeam, 60, 0.5, 'steered beam');
  assert.equal(linearArray({ elements: 4, spacing: 1, steer: 90 }).gratingLobes, true);
});

test('link budget follows Friis and the thermal noise floor', () => {
  const budget = linkBudget({ frequency: 2.4e9, distance: 1000, txPowerDbm: 20, txGainDbi: 2, rxGainDbi: 2, txLossDb: 1, rxLossDb: 1, bandwidth: 1e6, noiseFigureDb: 6, requiredSnrDb: 10 });
  near(budget.receivedDbm, 20 - 1 + 2 - 100.052 + 2 - 1, 0.001, 'received power');
  near(budget.noiseFloorDbm, -173.975 + 60 + 6, 0.01, 'kTB + NF');
  near(budget.marginDb, budget.receivedDbm - budget.sensitivityDbm, 1e-12, 'margin');
  near(freeSpacePathLossDb(budget.maxRange, 2.4e9) - budget.fspl, budget.marginDb, 1e-9, 'max range uses up the margin');
});
