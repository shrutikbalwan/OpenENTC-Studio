import test from 'node:test';
import assert from 'node:assert/strict';
import { allDayEfficiency, dcSeriesMotor, dcShuntMotor, inductionMotor, resistanceFiring, seriesString, snubber, switchingLoss, transformerTests, ujtOscillator } from '../packages/machines/src/index.mjs';
import { batteryLife, heatsink, reliability, traceWidth } from '../packages/productdesign/src/index.mjs';

const rel = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance + 1e-12, `${label}: ${actual} vs ${expected}`);

test('transformer OC/SC tests reproduce the textbook 20 kVA, 2500/250 V example', () => {
  const t = transformerTests({ kva: 20, hv: 2500, lv: 250, oc: { v: 250, i: 1.4, p: 105 }, sc: { v: 104, i: 8, p: 320 } });
  rel(t.rEq, 5, 1e-12, 'R01'); rel(t.xEq, 12, 1e-12, 'X01'); rel(t.zEq, 13, 1e-12, 'Z01');
  rel(t.efficiency(1, 0.8), 16000 / (16000 + 105 + 320), 1e-12, 'full-load efficiency 97.41 %');
  rel(t.regulation(1, 0.8), (8 * 5 * 0.8 + 8 * 12 * 0.6) / 2500, 1e-12, 'regulation 3.584 %');
  rel(t.regulation(1, 0.8, false), (8 * 5 * 0.8 - 8 * 12 * 0.6) / 2500, 1e-12, 'leading regulation');
  rel(t.maxEfficiencyLoad, Math.sqrt(105 / 320), 1e-12, 'max efficiency where copper = core loss');
  rel(t.r0, 250 / (1.4 * 0.3), 1e-12, 'R0');
  const day = allDayEfficiency(t, [[6, 1, 0.8], [10, 0.5, 0.8], [8, 0, 1]]);
  rel(day.efficiency, 176000 / (176000 + 6 * 320 + 10 * 80 + 24 * 105), 1e-12, 'all-day efficiency');
});

test('DC motors', () => {
  const shunt = dcShuntMotor({ v: 220, ra: 0.5, ratedIa: 20, ratedRpm: 1500 });
  rel(shunt.speedAt(shunt.ratedTorque), 1500, 1e-12, 'rated point');
  rel(shunt.backEmfRated, 210, 1e-12, 'Eb');
  rel(shunt.noLoadRpm, 1500 * 220 / 210, 1e-12, 'no-load speed');
  rel(dcShuntMotor({ fieldFraction: 0.8 }).noLoadRpm, 1500 * 220 / 210 / 0.8, 1e-12, 'field weakening raises speed');
  const series = dcSeriesMotor({ v: 220, ra: 0.3, rse: 0.2, ratedIa: 30, ratedRpm: 1000 });
  rel(series.atCurrent(30).rpm, 1000, 1e-12, 'series rated');
  rel(series.atCurrent(15).torque, series.ratedTorque / 4, 1e-12, 'T ∝ Ia²');
  assert.ok(series.atCurrent(15).rpm > 2000, 'series motor races at light load');
});

test('induction motor equivalent circuit (Chapman example 6-5)', () => {
  const m = inductionMotor({ vLine: 460, r1: 0.641, x1: 1.106, xm: 26.3, r2: 0.332, x2: 0.464, poles: 4, frequency: 60 });
  rel(m.vth, 255.2, 2e-3, 'Vth');
  rel(m.rth, 0.590, 2e-3, 'Rth');
  rel(m.sMax, 0.198, 0.02, 'slip at Tmax (Chapman takes Xth ≈ X1)');
  rel(m.tMax, 229, 0.01, 'pull-out torque');
  rel(m.startingTorque, 104, 0.03, 'starting torque');
  rel(m.torque(m.sMax), m.tMax, 1e-9, 'T(smax) = Tmax');
  const op = m.operating(0.022);
  rel(op.inducedTorque, m.torque(0.022), 1e-9, 'Thévenin torque equals the full circuit');
  rel(op.rpm, 1760.4, 1e-9, 'speed');
  rel(op.rotorCopper, 0.022 * op.airGap, 1e-12, 'Pcu2 = s·Pag');
});

test('SCR triggering, snubber, strings and switching loss', () => {
  const u = ujtOscillator({ vbb: 20, eta: 0.63, r: 20e3, cap: 0.1e-6 });
  rel(u.period, 20e3 * 0.1e-6 * Math.log(1 / 0.37), 1e-12, 'UJT period');
  rel(u.vp, 13.3, 1e-12, 'Vp'); assert.ok(u.oscillates);
  assert.equal(ujtOscillator({ r: 1e3 }).oscillates, false, 'R too small latches on');
  rel(resistanceFiring({ vm: 100, r: 9e3, rMin: 1e3, igt: 5e-3, vgt: 0 }).alpha, 30, 1e-9, 'R firing at 30°');
  assert.equal(resistanceFiring({ vm: 10, r: 1e5 }).fires, false);
  const s = snubber({ vs: 300, l: 50e-6, dvdt: 50e6, zeta: 0.65 });
  rel(s.check, s.rs, 1e-12, 'Rs = 2ζ√(L/Cs)');
  rel(s.rs, 50e-6 * 50e6 / 300, 1e-12, 'Rs');
  const str = seriesString({ vs: 10e3, n: 6, vbm: 2e3, deltaIb: 10e-3, deltaQ: 20e-6 });
  rel(str.r, 2000 / (5 * 0.01), 1e-12, 'static sharing R'); rel(str.c, 5 * 20e-6 / 2000, 1e-12, 'dynamic C'); rel(str.efficiency, 10 / 12, 1e-12, 'string efficiency');
  rel(switchingLoss({ v: 400, i: 10, tr: 50e-9, tf: 80e-9, frequency: 50e3, duty: 0.5, rdsOn: 0.1 }).total, 13 + 5, 1e-12, 'MOSFET loss');
});

test('product design: thermal, reliability, IPC-2221 trace width, battery', () => {
  const h = heatsink({ power: 10, tjMax: 125, ambient: 40, thetaJc: 1.5, thetaCs: 0.5, thetaSa: 4, margin: 1 });
  rel(h.requiredSa, (125 - 40) / 10 - 2, 1e-12, 'required θsa');
  rel(h.tj, 40 + 10 * 6, 1e-12, 'Tj');
  const r = reliability([{ type: 'resistor', quantity: 20 }, { type: 'microcontroller', quantity: 1 }, { type: 'electrolytic capacitor', quantity: 3, fit: 20 }], { hours: 8760, redundant: 2 });
  rel(r.fit, 20 + 50 + 60, 1e-12, 'FIT'); rel(r.mtbf, 1e9 / 130, 1e-12, 'MTBF');
  rel(r.redundantReliability, 1 - (1 - r.reliability) ** 2, 1e-12, 'parallel redundancy');
  rel(r.redundantMtbf, 1.5 * r.mtbf, 1e-12, 'two in parallel: 1.5 × MTBF');
  rel(traceWidth({ current: 1, riseC: 10, copperOz: 1, layer: 'external' }).widthMil, 11.8, 0.01, '1 A, 10 °C, 1 oz external ≈ 11.8 mil');
  const inner = traceWidth({ current: 1, riseC: 10, copperOz: 1, layer: 'internal' });
  rel(inner.areaMil2, traceWidth({ current: 1, riseC: 10 }).areaMil2 * 2 ** (1 / 0.725), 1e-9, 'internal needs 2^(1/0.725) × the area');
  const b = batteryLife({ capacityMah: 2000, activeMa: 50, sleepUa: 20, dutyPercent: 2, derating: 0.8 });
  rel(b.averageMa, 1 + 0.0196, 1e-12, 'average current'); rel(b.hours, 1600 / 1.0196, 1e-12, 'hours');
});
