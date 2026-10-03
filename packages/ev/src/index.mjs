// Electric-vehicle engineering: battery-pack sizing, road-load forces and energy consumption,
// range, motor torque–speed envelope and gearing, acceleration and top speed, and CC-CV charging.

export const G = 9.81;
const KMH = 1 / 3.6;

export const CELLS = Object.freeze({
  nmc21700: { label: 'NMC 21700 (3.6 V, 5 Ah, 70 g)', nominal: 3.6, max: 4.2, min: 2.5, ah: 5, massKg: 0.07, resistance: 0.015 },
  nmc18650: { label: 'NMC 18650 (3.6 V, 3 Ah, 47 g)', nominal: 3.6, max: 4.2, min: 2.5, ah: 3, massKg: 0.047, resistance: 0.025 },
  lfpPrismatic: { label: 'LFP prismatic (3.2 V, 100 Ah, 2 kg)', nominal: 3.2, max: 3.65, min: 2.5, ah: 100, massKg: 2.0, resistance: 0.0008 },
  lfp32700: { label: 'LFP 32700 (3.2 V, 6 Ah, 140 g)', nominal: 3.2, max: 3.65, min: 2.5, ah: 6, massKg: 0.14, resistance: 0.008 },
});

/** Pack from a cell and an S×P arrangement. */
export function batteryPack({ cell, series, parallel, current = 0, packagingFactor = 1.35 }) {
  if (!(series >= 1 && parallel >= 1)) throw new RangeError('Series and parallel counts must be at least 1.');
  const nominal = cell.nominal * series, capacity = cell.ah * parallel;
  const energy = nominal * capacity / 1000;
  const resistance = cell.resistance * series / parallel;
  const cellMass = cell.massKg * series * parallel;
  return {
    series, parallel, cells: series * parallel, nominalVoltage: nominal, maxVoltage: cell.max * series, minVoltage: cell.min * series, capacityAh: capacity, energyKwh: energy,
    resistance, cellMassKg: cellMass, packMassKg: cellMass * packagingFactor, specificEnergy: energy * 1000 / (cellMass * packagingFactor),
    sag: current * resistance, loss: current * current * resistance, loadedVoltage: nominal - current * resistance, cRate: current / capacity,
  };
}

/** Choose S×P for a target nominal voltage and energy. */
export function designPack({ cell, targetVoltage, targetKwh }) {
  const series = Math.max(1, Math.round(targetVoltage / cell.nominal));
  const parallel = Math.max(1, Math.ceil(targetKwh * 1000 / (series * cell.nominal * cell.ah)));
  return batteryPack({ cell, series, parallel });
}

/**
 * Road-load forces at a speed: rolling Crr·m·g·cos θ, aerodynamic ½ρ·Cd·A·v², grade m·g·sin θ
 * and inertia m·a·(1 + rotating-mass factor). Battery power includes drivetrain efficiency and
 * auxiliaries; regeneration recovers `regenEfficiency` of negative wheel power.
 */
export function roadLoad({ massKg = 1500, crr = 0.01, cd = 0.3, area = 2.2, rho = 1.2, speedKmh = 80, gradePercent = 0, accel = 0, rotatingFactor = 0.05, drivetrainEfficiency = 0.9, auxKw = 0.5, regenEfficiency = 0.6, wheelRadius = 0.3, gearRatio = 9 } = {}) {
  const v = speedKmh * KMH;
  const theta = Math.atan(gradePercent / 100);
  const rolling = crr * massKg * G * Math.cos(theta) * (v > 0 ? 1 : 0);
  const aero = 0.5 * rho * cd * area * v * v;
  const grade = massKg * G * Math.sin(theta);
  const inertia = massKg * accel * (1 + rotatingFactor);
  const force = rolling + aero + grade + inertia;
  const wheelPower = force * v;
  const batteryPower = (wheelPower >= 0 ? wheelPower / drivetrainEfficiency : wheelPower * regenEfficiency) + auxKw * 1000;
  const wheelRpm = v / wheelRadius * 60 / (2 * Math.PI);
  return {
    speed: v, forces: { rolling, aero, grade, inertia, total: force }, wheelPower, batteryPower, wheelTorque: force * wheelRadius,
    motorRpm: wheelRpm * gearRatio, motorTorque: force * wheelRadius / gearRatio / (wheelPower >= 0 ? drivetrainEfficiency : 1 / drivetrainEfficiency),
    consumptionWhKm: v > 0 ? batteryPower / (speedKmh) : null,
  };
}

/** Range at constant speed from usable battery energy. */
export function constantSpeedRange({ usableKwh, ...vehicle }) {
  const load = roadLoad(vehicle);
  return { ...load, rangeKm: load.consumptionWhKm > 0 ? usableKwh * 1000 / load.consumptionWhKm : Infinity };
}

/** Motor envelope: constant torque up to base speed (P/T), then constant power to max speed. */
export function motorTorque(rpm, { peakTorque = 300, peakPowerKw = 150, maxRpm = 12_000 }) {
  if (rpm < 0 || rpm > maxRpm) return 0;
  const omega = rpm * 2 * Math.PI / 60;
  return omega > 0 ? Math.min(peakTorque, peakPowerKw * 1000 / omega) : peakTorque;
}
export function baseSpeedRpm({ peakTorque = 300, peakPowerKw = 150 }) { return peakPowerKw * 1000 / peakTorque * 60 / (2 * Math.PI); }

/**
 * Full-throttle acceleration (time integration, dt = 10 ms) with tyre-grip limit μ·m·g on
 * the driven axle share. Returns 0–100 km/h time, top speed and the speed–time curve.
 */
export function accelerationRun({ massKg = 1500, crr = 0.01, cd = 0.3, area = 2.2, rho = 1.2, wheelRadius = 0.3, gearRatio = 9, drivetrainEfficiency = 0.9, rotatingFactor = 0.05, mu = 0.9, drivenAxleShare = 0.5, motor = { peakTorque: 300, peakPowerKw: 150, maxRpm: 12_000 }, targetKmh = 100, maxTime = 60 } = {}) {
  const dt = 0.01;
  let v = 0, t = 0, distance = 0, t100 = null;
  const curve = [[0, 0]];
  const grip = mu * massKg * G * drivenAxleShare;
  while (t < maxTime) {
    const rpm = v / wheelRadius * 60 / (2 * Math.PI) * gearRatio;
    const traction = Math.min(grip, motorTorque(rpm, motor) * gearRatio * drivetrainEfficiency / wheelRadius);
    const resist = crr * massKg * G + 0.5 * rho * cd * area * v * v;
    const a = (traction - resist) / (massKg * (1 + rotatingFactor));
    if (a <= 1e-4 && t > 1) break;
    v += a * dt; distance += v * dt; t += dt;
    if (t100 === null && v >= targetKmh * KMH) t100 = t;
    if (Math.round(t / dt) % 10 === 0) curve.push([t, v / KMH]);
  }
  const rpmLimited = motor.maxRpm / gearRatio * 2 * Math.PI / 60 * wheelRadius / KMH;
  return { zeroToTarget: t100, topSpeedKmh: Math.min(v / KMH, rpmLimited), rpmLimitedTopSpeedKmh: rpmLimited, curve, distance, gripLimitedForce: grip };
}

/** Gear ratio needed for a top speed at the motor's maximum rpm. */
export function gearRatioForTopSpeed({ topSpeedKmh, maxRpm, wheelRadius }) {
  return maxRpm * 2 * Math.PI / 60 * wheelRadius / (topSpeedKmh * KMH);
}

/**
 * CC-CV charging: constant power until `taperSoc`, then the power falls linearly to
 * `endFraction` of the rated power at 100 % SoC. Charger efficiency applies to grid energy.
 */
export function chargingTime({ capacityKwh = 60, fromSoc = 0.2, toSoc = 0.8, chargerKw = 50, efficiency = 0.92, taperSoc = 0.8, endFraction = 0.1 } = {}) {
  if (!(toSoc > fromSoc)) throw new RangeError('Target SoC must be higher than the start.');
  const power = (soc) => (soc < taperSoc ? 1 : 1 - (1 - endFraction) * (soc - taperSoc) / (1 - taperSoc)) * chargerKw * efficiency;
  let soc = fromSoc, hours = 0;
  const curve = [[0, soc * 100, power(soc) / efficiency]];
  const ds = 0.001;
  while (soc < toSoc - 1e-12) {
    const step = Math.min(ds, toSoc - soc);
    hours += step * capacityKwh / power(soc + step / 2);
    soc += step;
    if (curve.length < 2000) curve.push([hours * 60, soc * 100, power(soc) / efficiency]);
  }
  const energy = (toSoc - fromSoc) * capacityKwh;
  return { minutes: hours * 60, energyKwh: energy, gridKwh: energy / efficiency, curve };
}
