import test from 'node:test';
import assert from 'node:assert/strict';
import { coldJunction, designInamp, lvdt, measurementChain, nearestE96, ntcResistance, ntcTemperatureBeta, rtdResistance, rtdTemperature, seebeck, steinhartHart, steinhartTemperature, strainBridge, thermocoupleEmf, thermocoupleTemperature, wheatstone } from '../packages/sensors/src/index.mjs';
import { accelerationRun, baseSpeedRpm, batteryPack, CELLS, chargingTime, constantSpeedRange, designPack, gearRatioForTopSpeed, motorTorque, roadLoad } from '../packages/ev/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

// Reference EMFs (mV, 0 °C reference) from NIST SRD 60 as tabulated by the thermocouples_reference package.
const NIST = {
  K: [[-200, -5.891404], [-100, -3.553631], [-20, -0.77754], [25, 1.000242], [100, 4.09623], [200, 8.138473], [500, 20.644286], [800, 33.27538], [1000, 41.275606], [1300, 52.410275]],
  J: [[-200, -7.890483], [-100, -4.632524], [25, 1.277288], [100, 5.268916], [300, 16.327206], [500, 27.392631], [750, 42.280518]],
  T: [[-200, -5.602961], [-100, -3.378582], [25, 0.991977], [100, 4.278519], [200, 9.288102], [400, 20.87197]],
  E: [[-200, -8.824581], [100, 6.31893], [500, 37.005354], [900, 68.786591]],
  N: [[-200, -3.990376], [100, 2.774124], [500, 16.747857], [1200, 43.84636]],
};

test('thermocouples match the NIST ITS-90 tables both ways', () => {
  for (const [type, rows] of Object.entries(NIST)) for (const [celsius, mv] of rows) {
    near(thermocoupleEmf(type, celsius), mv, 1e-6, `${type} ${celsius} °C`);
    near(thermocoupleTemperature(type, mv), celsius, 1e-4, `${type} inverse ${mv} mV`);
  }
  near(seebeck('K', 0), 39.45, 0.01, 'type K Seebeck at 0 °C (µV/°C)');
  const cj = coldJunction({ type: 'K', measuredMv: 4.09623 - 1.000242, coldC: 25 });
  near(cj.hotC, 100, 1e-3, 'cold-junction compensated');
  assert.ok(Math.abs(cj.uncompensatedC - 100) > 20, 'forgetting compensation is a large error');
  assert.throws(() => thermocoupleEmf('K', 1500), /covers/);
  assert.throws(() => thermocoupleEmf('Q', 10), /Unknown/);
});

test('Pt100 (IEC 60751), NTC β and Steinhart–Hart', () => {
  near(rtdResistance(0), 100, 1e-12, 'R0'); near(rtdResistance(100), 138.5055, 1e-4, '100 °C'); near(rtdResistance(-100), 60.2558, 1e-4, '−100 °C'); near(rtdResistance(200), 175.856, 1e-3, '200 °C');
  for (const t of [-195, -50, 0, 37, 420, 800]) near(rtdTemperature(rtdResistance(t)), t, 1e-6, `RTD inverse ${t}`);
  near(rtdResistance(100, { r0: 1000 }), 1385.055, 1e-3, 'Pt1000');
  near(ntcResistance(25), 10_000, 1e-9, 'R25'); near(ntcTemperatureBeta(ntcResistance(60)), 60, 1e-9, 'β inverse');
  const coefficients = steinhartHart([[0, 32_650], [25, 10_000], [50, 3_603]]);
  near(steinhartTemperature(32_650, coefficients), 0, 1e-9, 'SH point 1'); near(steinhartTemperature(10_000, coefficients), 25, 1e-9, 'SH point 2'); near(steinhartTemperature(3_603, coefficients), 50, 1e-9, 'SH point 3');
});

test('Wheatstone and strain-gauge bridges, LVDT', () => {
  assert.equal(wheatstone({ vex: 10, r1: 1000, r2: 1000, r3: 2000, r4: 2000 }).balanced, true);
  near(wheatstone({ vex: 10, r1: 1000, r2: 1100, r3: 1000, r4: 1000 }).vout, 10 * (1100 / 2100 - 0.5), 1e-12, 'unbalanced');
  const quarter = strainBridge({ vex: 5, gaugeFactor: 2, strain: 1e-3, config: 'quarter' });
  near(quarter.vout, 5 * 0.002 / (4 + 2 * 0.002), 1e-12, 'quarter exact'); near(quarter.linear, 2.5e-3, 1e-12, 'quarter linear');
  near(strainBridge({ vex: 5, strain: 1e-3, config: 'half' }).vout, 5e-3, 1e-12, 'half bridge is linear');
  near(strainBridge({ vex: 5, strain: 1e-3, config: 'full' }).vout, 1e-2, 1e-12, 'full bridge');
  const sensor = lvdt({ displacementMm: -2, sensitivity: 50, vex: 3 });
  near(sensor.amplitudeMv, 300, 1e-9, 'LVDT amplitude'); assert.equal(sensor.phaseDeg, 180);
});

test('in-amp design and measurement chains', () => {
  assert.equal(nearestE96(837.3), 845); assert.equal(nearestE96(10_000), 10_000); assert.equal(nearestE96(4990), 4990);
  const amp = designInamp({ sensorMin: 0.1, sensorMax: 0.175, adcMin: 0, adcMax: 5, inamp: 'ad620' });
  near(amp.gain, 1 + 49_400 / amp.rg, 1e-12, 'gain equation');
  assert.ok(amp.outMin > 0 && amp.outMax < 5, 'output stays inside the ADC range');
  for (const [sensor, tMax, worst] of [['pt100', 200, 0.05], ['k-type', 800, 0.25], ['ntc', 100, 0.1], ['lm35', 100, 0.05]]) {
    const chain = measurementChain({ sensor, tMin: 0, tMax, adcBits: 12 });
    assert.ok(chain.maxError <= Math.max(worst, chain.resolution), `${sensor}: ${chain.maxError}`);
    assert.ok(chain.maxLinearError >= chain.maxError - 1e-9, `${sensor}: exact linearisation is never worse`);
  }
  assert.ok(measurementChain({ sensor: 'ntc', tMin: 0, tMax: 100 }).maxLinearError > 5, 'a thermistor is far from linear');
});

test('EV: battery pack, road load and range', () => {
  const pack = designPack({ cell: CELLS.nmc21700, targetVoltage: 400, targetKwh: 60 });
  assert.equal(pack.series, 111); assert.equal(pack.parallel, 31); assert.equal(pack.cells, 3441);
  near(pack.nominalVoltage, 399.6, 1e-9, 'pack V'); near(pack.energyKwh, 399.6 * 155 / 1000, 1e-9, 'pack kWh'); near(pack.resistance, 0.015 * 111 / 31, 1e-12, 'pack R');
  const loaded = batteryPack({ cell: CELLS.lfpPrismatic, series: 100, parallel: 1, current: 200 });
  near(loaded.sag, 200 * 0.08, 1e-9, 'IR drop'); near(loaded.loss, 200 * 200 * 0.08, 1e-9, 'I²R'); near(loaded.cRate, 2, 1e-12, 'C-rate');
  const load = roadLoad({ massKg: 1600, crr: 0.01, cd: 0.28, area: 2.3, speedKmh: 100, auxKw: 0, drivetrainEfficiency: 0.9 });
  near(load.forces.rolling, 0.01 * 1600 * 9.81, 1e-9, 'rolling'); near(load.forces.aero, 0.5 * 1.2 * 0.28 * 2.3 * (100 / 3.6) ** 2, 1e-9, 'aero');
  near(load.consumptionWhKm, load.forces.total / 0.9 / 3.6, 1e-9, 'Wh/km = F/η/3.6');
  near(roadLoad({ massKg: 1000, speedKmh: 0, gradePercent: 10, auxKw: 0 }).forces.grade, 1000 * 9.81 * Math.sin(Math.atan(0.1)), 1e-9, 'grade');
  const range = constantSpeedRange({ usableKwh: 55, speedKmh: 80 });
  near(range.rangeKm, 55_000 / range.consumptionWhKm, 1e-9, 'range');
  assert.ok(constantSpeedRange({ usableKwh: 55, speedKmh: 120 }).rangeKm < range.rangeKm, 'faster is shorter');
});

test('EV: motor envelope, gearing, acceleration and charging', () => {
  const motor = { peakTorque: 300, peakPowerKw: 150, maxRpm: 12_000 };
  near(baseSpeedRpm(motor), 150_000 / 300 * 60 / (2 * Math.PI), 1e-9, 'base speed');
  assert.equal(motorTorque(1000, motor), 300); near(motorTorque(8000, motor), 150_000 / (8000 * 2 * Math.PI / 60), 1e-9, 'constant power'); assert.equal(motorTorque(13_000, motor), 0);
  near(gearRatioForTopSpeed({ topSpeedKmh: 150, maxRpm: 12_000, wheelRadius: 0.3 }), 12_000 * 2 * Math.PI / 60 * 0.3 / (150 / 3.6), 1e-9, 'gear ratio');
  const run = accelerationRun({ motor });
  assert.ok(run.zeroToTarget > 5 && run.zeroToTarget < 10, `0–100 ${run.zeroToTarget}`);
  near(run.topSpeedKmh, run.rpmLimitedTopSpeedKmh, 0.5, 'rpm-limited top speed');
  const weak = accelerationRun({ motor: { peakTorque: 100, peakPowerKw: 20, maxRpm: 12_000 } });
  assert.ok(weak.topSpeedKmh < weak.rpmLimitedTopSpeedKmh, 'drag-limited top speed');
  const charge = chargingTime({ capacityKwh: 60, fromSoc: 0.2, toSoc: 0.8, chargerKw: 50, efficiency: 0.92 });
  near(charge.minutes, 36 / 46 * 60, 1e-6, 'constant-power section');
  assert.ok(chargingTime({ capacityKwh: 60, fromSoc: 0.8, toSoc: 1, chargerKw: 50 }).minutes > 0.2 * 60 / 46 * 60, 'taper makes the last 20 % slower');
});
