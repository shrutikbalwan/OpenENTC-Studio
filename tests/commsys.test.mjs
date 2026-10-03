import test from 'node:test';
import assert from 'node:assert/strict';
import { cascadedIip3, fibreParameters, friis, powerBudget, receiverChain, riseTimeBudget, sensitivity, superhet, tuningRange } from '../packages/commsys/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('superheterodyne image frequency and rejection (Kennedy worked examples)', () => {
  const mw = superhet({ signal: 1000e3, intermediate: 455e3, q: 100 });
  assert.equal(mw.lo, 1455e3); assert.equal(mw.image, 1910e3);
  near(mw.rejection, 138.6, 0.1, 'α at 1 MHz');
  near(superhet({ signal: 25e6, intermediate: 455e3, q: 100 }).rejection, 7.2, 0.05, 'α at 25 MHz');
  const low = superhet({ signal: 100e6, intermediate: 10.7e6, loAbove: false });
  assert.equal(low.lo, 89.3e6); near(low.image, 78.6e6, 1e-3, 'low-side image');
  const band = tuningRange({ low: 540e3, high: 1650e3, intermediate: 455e3 });
  near(band.loCapacitanceRatio, (2105 / 995) ** 2, 1e-12, 'LO C ratio');
  near(band.signalCapacitanceRatio, (1650 / 540) ** 2, 1e-12, 'signal C ratio');
});

test('Friis cascade, noise temperature and sensitivity', () => {
  const stages = [{ name: 'LNA', gainDb: 20, nfDb: 1.5 }, { name: 'Mixer', gainDb: -7, nfDb: 7 }, { name: 'IF amp', gainDb: 30, nfDb: 10 }];
  const result = friis(stages);
  const f = (db) => 10 ** (db / 10);
  const expected = f(1.5) + (f(7) - 1) / f(20) + (f(10) - 1) / (f(20) * f(-7));
  near(result.noiseFactor, expected, 1e-12, 'F');
  near(result.gainDb, 43, 1e-12, 'G');
  near(result.rows[0].noiseTemperature, 290 * (f(1.5) - 1), 1e-9, 'Te');
  near(sensitivity({ nfDb: 0, bandwidth: 1 }).kTdBmPerHz, -173.975, 1e-3, 'kT0');
  near(sensitivity({ nfDb: 6, bandwidth: 1e6, snrDb: 10 }).sensitivityDbm, -173.975 + 60 + 6 + 10, 1e-3, 'MDS');
});

test('cascaded IIP3 and SFDR', () => {
  const stages = [{ gainDb: 10, nfDb: 2, iip3Dbm: 10 }, { gainDb: 0, nfDb: 8, iip3Dbm: 20 }];
  // 1/IIP3 = 1/10 mW + 10/100 mW = 0.2 → 6.99 dBm.
  near(cascadedIip3(stages).iip3Dbm, 10 * Math.log10(5), 1e-12, 'IIP3');
  near(cascadedIip3(stages).oip3Dbm, 10 * Math.log10(5) + 10, 1e-12, 'OIP3');
  const chain = receiverChain({ stages, bandwidth: 1e6, snrDb: 0 });
  near(chain.sfdrDb, (2 / 3) * (chain.linearity.iip3Dbm - chain.sensitivity.noiseFloorDbm), 1e-12, 'SFDR');
});

test('fibre NA, V-number, modes and single-mode cut-off', () => {
  const mm = fibreParameters({ n1: 1.48, n2: 1.46, coreDiameter: 50e-6, wavelength: 850e-9 });
  near(mm.na, Math.sqrt(1.48 ** 2 - 1.46 ** 2), 1e-15, 'NA');
  near(mm.v, Math.PI * 50e-6 * mm.na / 850e-9, 1e-9, 'V');
  assert.equal(mm.modes, Math.round(mm.v ** 2 / 2)); assert.equal(mm.singleMode, false);
  const sm = fibreParameters({ n1: 1.4504, n2: 1.4447, coreDiameter: 8.2e-6, wavelength: 1550e-9 });
  assert.equal(sm.singleMode, true);
  near(sm.cutoffWavelength, 1550e-9 * sm.v / 2.405, 1e-15, 'cut-off where V = 2.405'); assert.ok(sm.cutoffWavelength < 1550e-9);
  assert.throws(() => fibreParameters({ n1: 1.4, n2: 1.5, coreDiameter: 1e-5, wavelength: 1e-6 }), /core index/);
});

test('power and rise-time budgets', () => {
  const budget = powerBudget({ txPowerDbm: -3, rxSensitivityDbm: -32, length: 20, attenuation: 0.5, splices: 9, spliceLoss: 0.1, connectors: 2, connectorLoss: 0.5, margin: 6 });
  near(budget.totalLoss, 10 + 0.9 + 1 + 6, 1e-12, 'loss'); near(budget.excess, 29 - 17.9, 1e-12, 'excess');
  near(budget.maxLength, (29 - 7.9) / 0.5, 1e-12, 'max length'); assert.equal(budget.feasible, true);
  // Step-index modal spread L·n1·Δ/c: 1 km, n1 = 1.48, Δ = 1 % → 49.4 ns (Keiser).
  const rise = riseTimeBudget({ txRise: 15e-9, rxRise: 25e-9, length: 1, n1: 1.48, n2: 1.48 * 0.99 });
  near(rise.modal, 1000 * 1.48 * 0.01 / 299792458, 1e-15, 'modal');
  near(rise.system, Math.hypot(15e-9, 25e-9, rise.modal), 1e-18, 'system');
  const graded = riseTimeBudget({ txRise: 0, rxRise: 0, length: 1, n1: 1.48, n2: 1.48 * 0.99, profile: 'graded' });
  near(graded.modal * 8 / 0.01, rise.modal, 1e-15, 'graded = Δ/8 × step');
  const single = riseTimeBudget({ txRise: 0, rxRise: 0, length: 50, n1: 1.468, singleMode: true, dispersion: 17, spectralWidth: 0.1 });
  near(single.chromatic, 17e-12 * 0.1 * 50, 1e-20, 'chromatic'); assert.equal(single.modal, 0);
});
