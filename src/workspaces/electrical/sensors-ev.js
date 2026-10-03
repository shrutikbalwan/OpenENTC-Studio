// Sensors & Instrumentation and EV Engineering (they share one lab binder) workspace. Entry points: renderSensors(state), renderEv(state); bindSensorEvents().
import { modules } from '../../data/modules.js';
import { coldJunction, INAMPS, lvdt, measurementChain, ntcResistance, rtdResistance, rtdTemperature, seebeck, steinhartHart, steinhartTemperature, strainBridge, THERMOCOUPLE_COEFFICIENTS, THERMOCOUPLE_TYPES, thermocoupleEmf } from '../../../packages/sensors/src/index.mjs';
import { accelerationRun, baseSpeedRpm, batteryPack, CELLS, chargingTime, constantSpeedRange, designPack, gearRatioForTopSpeed, motorTorque } from '../../../packages/ev/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const SENSOR_TABS = [['thermocouple', 'Thermocouples'], ['resistive', 'RTD & thermistor'], ['bridge', 'Bridges & LVDT'], ['chain', 'Measurement chain']];
const sensorLab = makeLab('sensor-lab', {
  tab: 'thermocouple',
  thermocouple: { type: 'K', hot: 300, cold: 25, measuredMv: 11.208 },
  resistive: { r0: 100, temperature: 100, ohms: 138.5055, r25: 10_000, beta: 3950, t1: 0, r1: 32_650, t2: 25, r2: 10_000, t3: 50, r3: 3_603 },
  bridge: { config: 'quarter', vex: 5, gaugeFactor: 2, strain: 1e-3, r: 350, lvdtMm: 1.5, lvdtSensitivity: 50, lvdtVex: 3 },
  chain: { sensor: 'pt100', tMin: 0, tMax: 200, adcBits: 12, vref: 5, inamp: 'ad620', linearize: 'exact', excitation: 1e-3 },
});
const sensorField = groupField('data-sensor-field');
const sensorSelect = (path, label, value, options) => labSelect('data-sensor-select', path, label, value, options);
function renderSensorTab(config) {
  const c = config[config.tab];
  if (config.tab === 'thermocouple') {
    const emf = thermocoupleEmf(c.type, c.hot), cold = thermocoupleEmf(c.type, c.cold);
    const cj = coldJunction({ type: c.type, measuredMv: c.measuredMv, coldC: c.cold });
    const [low, high] = [THERMOCOUPLE_COEFFICIENTS[c.type][0][0], THERMOCOUPLE_COEFFICIENTS[c.type].at(-1)[1]];
    const ts = Array.from({ length: 241 }, (_, k) => low + (high - low) * k / 240);
    const controls = `${sensorSelect('thermocouple.type', 'Type', c.type, Object.entries(THERMOCOUPLE_TYPES))}${sensorField('thermocouple.hot', 'Hot junction', c.hot, '°C')}${sensorField('thermocouple.cold', 'Cold (reference) junction', c.cold, '°C')}${sensorField('thermocouple.measuredMv', 'Measured voltage', c.measuredMv, 'mV')}`;
    const body = `<div class="power-grid"><div>${linePlot(`Type ${c.type} EMF (mV) vs temperature (°C), reference 0 °C`, ts, [{ name: 'E(T)', values: ts.map((t) => thermocoupleEmf(c.type, t)) }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('Seebeck coefficient (µV/°C)', ts, [{ name: 'S(T)', values: ts.map((t) => seebeck(c.type, t)) }], { xLabel: (v) => `${Math.round(v)}` })}</div>
      <div class="analysis-readouts">${readout(`E(${c.hot} °C), reference 0 °C`, `${fmt(emf, 5)} mV`)}${readout(`E(${c.cold} °C) of the cold junction`, `${fmt(cold, 5)} mV`)}${readout('Voltmeter reading E(hot) − E(cold)', `${fmt(emf - cold, 5)} mV`)}${readout('Seebeck coefficient at the hot junction', `${fmt(seebeck(c.type, c.hot), 4)} µV/°C`)}
      <span class="panel-label">FROM A MEASURED VOLTAGE</span>${readout('Compensated temperature', `${fmt(cj.hotC, 4)} °C`)}${readout('Without cold-junction compensation', `${fmt(cj.uncompensatedC, 4)} °C`)}${readout('Straight line (Seebeck at 0 °C)', `${fmt(cj.linearC, 4)} °C`)}<p class="field-help">NIST ITS-90 reference functions (NIST SRD 60). The voltmeter sees E(T_hot) − E(T_cold), so the cold-junction EMF is added back before inverting the table.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'resistive') {
    const sh = steinhartHart([[c.t1, c.r1], [c.t2, c.r2], [c.t3, c.r3]]);
    const ts = Array.from({ length: 201 }, (_, k) => -50 + k);
    const controls = `${sensorSelect('resistive.r0', 'Platinum RTD', c.r0, [[100, 'Pt100'], [1000, 'Pt1000']])}${sensorField('resistive.temperature', 'Temperature', c.temperature, '°C')}${sensorField('resistive.ohms', 'Measured RTD resistance', c.ohms, 'Ω')}${sensorField('resistive.r25', 'NTC R25', c.r25, 'Ω')}${sensorField('resistive.beta', 'NTC β', c.beta, 'K')}${sensorField('resistive.t1', 'SH point 1', c.t1, '°C')}${sensorField('resistive.r1', 'R at point 1', c.r1, 'Ω')}${sensorField('resistive.t2', 'SH point 2', c.t2, '°C')}${sensorField('resistive.r2', 'R at point 2', c.r2, 'Ω')}${sensorField('resistive.t3', 'SH point 3', c.t3, '°C')}${sensorField('resistive.r3', 'R at point 3', c.r3, 'Ω')}`;
    const ntcAt = ntcResistance(c.temperature, c);
    const body = `<div class="power-grid"><div>${linePlot(`Pt${c.r0} resistance (Ω) vs temperature (°C)`, ts, [{ name: 'RTD', values: ts.map((t) => rtdResistance(t, { r0: c.r0 })) }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('NTC resistance (Ω, β model) vs temperature (°C)', ts, [{ name: 'NTC', values: ts.map((t) => ntcResistance(t, c)) }], { xLabel: (v) => `${Math.round(v)}` })}</div>
      <div class="analysis-readouts">${readout(`Pt${c.r0} at ${c.temperature} °C`, `${fmt(rtdResistance(c.temperature, { r0: c.r0 }), 6)} Ω`)}${readout(`Temperature for ${c.ohms} Ω`, `${fmt(rtdTemperature(c.ohms, { r0: c.r0 }), 5)} °C`)}${readout('Mean sensitivity 0–100 °C', `${fmt((rtdResistance(100, { r0: c.r0 }) - c.r0) / 100, 5)} Ω/°C (α = ${fmt((rtdResistance(100) - 100) / 10000, 6)})`)}${readout(`NTC at ${c.temperature} °C (β)`, `${eng(ntcAt, 'Ω')}`)}${readout('Steinhart–Hart A, B, C', `${sh.a.toExponential(5)}, ${sh.b.toExponential(5)}, ${sh.c.toExponential(5)}`)}${readout(`SH temperature at ${eng(ntcAt, 'Ω')}`, `${fmt(steinhartTemperature(ntcAt, sh), 4)} °C`)}<p class="field-help">IEC 60751 Callendar–Van Dusen: R = R0[1 + A·T + B·T² + C(T − 100)T³] (C only below 0 °C). Steinhart–Hart: 1/T = A + B·ln R + C·(ln R)³ through your three calibration points.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'bridge') {
    const bridge = strainBridge(c);
    const sensor = lvdt({ displacementMm: c.lvdtMm, sensitivity: c.lvdtSensitivity, vex: c.lvdtVex });
    const strains = Array.from({ length: 101 }, (_, k) => -5e-3 + k * 1e-4);
    const controls = `${sensorSelect('bridge.config', 'Bridge', c.config, [['quarter', 'Quarter bridge (1 gauge)'], ['half', 'Half bridge (2 gauges, bending)'], ['full', 'Full bridge (4 gauges)']])}${sensorField('bridge.vex', 'Excitation', c.vex, 'V')}${sensorField('bridge.gaugeFactor', 'Gauge factor', c.gaugeFactor)}${sensorField('bridge.strain', 'Strain', c.strain, 'ε')}${sensorField('bridge.r', 'Gauge resistance', c.r, 'Ω')}${sensorField('bridge.lvdtMm', 'LVDT core position', c.lvdtMm, 'mm')}${sensorField('bridge.lvdtSensitivity', 'LVDT sensitivity', c.lvdtSensitivity, 'mV/V/mm')}${sensorField('bridge.lvdtVex', 'LVDT excitation', c.lvdtVex, 'V')}`;
    const body = `<div class="power-grid"><div>${linePlot('Bridge output (V) vs strain (µε)', strains.map((s) => s * 1e6), ['quarter', 'half', 'full'].map((config, index) => ({ name: config, values: strains.map((strain) => strainBridge({ ...c, strain, config }).vout), color: PLOT_COLORS[index] })), { xLabel: (v) => `${Math.round(v)}`, unit: 'V' })}</div>
      <div class="analysis-readouts">${readout('ΔR of an active gauge', eng(bridge.deltaR, 'Ω'))}${readout('Bridge output (exact)', eng(bridge.vout, 'V'))}${readout('Small-strain formula', eng(bridge.linear, 'V'))}${readout('Non-linearity', `${fmt(bridge.nonlinearityPercent, 4)} %`)}${readout('Sensitivity', `${fmt(bridge.sensitivity * 1000, 5)} mV/V per unit strain`)}<span class="panel-label">LVDT</span>${readout('Output amplitude', `${fmt(sensor.amplitudeMv, 4)} mV`)}${readout('Phase vs excitation', `${sensor.phaseDeg}°`)}<p class="field-help">Quarter bridge: Vout = Vex·(ΔR/R)/(4 + 2ΔR/R) — slightly non-linear. Half (bending) and full bridges are linear and 2× / 4× as sensitive, and cancel temperature drift.</p></div></div>`;
    return { controls, body };
  }
  const chain = measurementChain(c);
  const ts = chain.rows.map((row) => row.t);
  const controls = `${sensorSelect('chain.sensor', 'Sensor', c.sensor, [['pt100', 'Pt100 (1 mA excitation)'], ['pt1000', 'Pt1000 (1 mA excitation)'], ['k-type', 'Type K thermocouple'], ['ntc', 'NTC 10 k in a divider'], ['lm35', 'LM35 (10 mV/°C)']])}${sensorField('chain.tMin', 'From', c.tMin, '°C')}${sensorField('chain.tMax', 'To', c.tMax, '°C')}${sensorSelect('chain.inamp', 'Amplifier', c.inamp, Object.entries(INAMPS).map(([id, spec]) => [id, spec.label]))}${sensorField('chain.adcBits', 'ADC bits', c.adcBits, 'bit')}${sensorField('chain.vref', 'ADC reference', c.vref, 'V')}${sensorSelect('chain.linearize', 'Conversion to °C', c.linearize, [['exact', 'Exact sensor law'], ['linear', 'Straight line between end points']])}`;
  const body = `<div class="power-grid"><div>${linePlot('Reading error (°C) across the range', ts, [{ name: 'exact law', values: chain.rows.map((row) => row.exactError) }, { name: 'straight line', values: chain.rows.map((row) => row.linearError), color: PLOT_COLORS[3] }], { xLabel: (v) => `${Math.round(v)}` })}${linePlot('Amplifier output (V) into the ADC', ts, [{ name: 'Vout', values: chain.rows.map((row) => row.ampV) }], { xLabel: (v) => `${Math.round(v)}`, unit: 'V', yMin: 0, yMax: c.vref })}</div>
    <div class="analysis-readouts">${readout('Sensor output span', `${eng(chain.sensorSpan[0], 'V')} … ${eng(chain.sensorSpan[1], 'V')}`)}${readout('Required gain', fmt(chain.amp.targetGain, 5))}${readout('RG (E96)', `${eng(chain.amp.rg, 'Ω')} (ideal ${eng(chain.amp.rgIdeal, 'Ω')})`)}${readout('Actual gain', fmt(chain.amp.gain, 5))}${readout('Output reference (level shift)', eng(chain.amp.reference, 'V'))}${readout('ADC range used', `${eng(chain.amp.outMin, 'V')} … ${eng(chain.amp.outMax, 'V')}`)}${readout('Resolution', `${fmt(chain.resolution, 4)} °C per LSB`)}${readout('Worst error (selected conversion)', `${fmt(chain.maxError, 4)} °C`)}${readout('Worst error with a straight line', `${fmt(chain.maxLinearError, 4)} °C`)}<p class="field-help">The gain maps the sensor span onto 90 % of the ADC range (5 % margin each side); the reference pin shifts the level. Converting with the exact sensor law leaves only quantisation error.</p></div></div>`;
  return { controls, body };
}
export function renderSensors(state) {
  const config = sensorLab.configuration(state);
  let view;
  try { view = renderSensorTab(config); } catch (error) { view = { controls: '', body: labError('sensor', 'Sensors', error) }; }
  return `<div class="page scroll-page power-page sensor-page">${pageHeader(modules.find((item) => item.id === 'sensors'), 'SENSORS & SIGNAL CONDITIONING', '<span class="pill live"><i></i> NIST / IEC REFERENCE DATA</span>')}${labTabs(SENSOR_TABS, config.tab, 'data-sensor-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
const EV_TABS = [['pack', 'Battery pack'], ['drive', 'Road load & range'], ['performance', 'Motor & acceleration'], ['charging', 'Charging']];
const evLab = makeLab('ev-lab', {
  tab: 'pack',
  pack: { cell: 'nmc21700', targetVoltage: 400, targetKwh: 60, current: 200 },
  vehicle: { massKg: 1600, crr: 0.01, cd: 0.28, area: 2.3, speedKmh: 80, gradePercent: 0, drivetrainEfficiency: 0.9, auxKw: 0.5, usableKwh: 55, wheelRadius: 0.31, gearRatio: 9 },
  motor: { peakTorque: 300, peakPowerKw: 150, maxRpm: 12_000, mu: 0.9, drivenAxleShare: 0.5 },
  charging: { capacityKwh: 60, fromSoc: 20, toSoc: 80, chargerKw: 50, efficiency: 0.92, taperSoc: 80 },
});
const evField = groupField('data-ev-field');
function renderEvTab(config) {
  const v = config.vehicle;
  if (config.tab === 'pack') {
    const c = config.pack;
    const cell = CELLS[c.cell];
    const pack = designPack({ cell, targetVoltage: c.targetVoltage, targetKwh: c.targetKwh });
    const loaded = batteryPack({ cell, series: pack.series, parallel: pack.parallel, current: c.current });
    const controls = `${labSelect('data-ev-select', 'pack.cell', 'Cell', c.cell, Object.entries(CELLS).map(([id, item]) => [id, item.label]))}${evField('pack.targetVoltage', 'Target pack voltage', c.targetVoltage, 'V')}${evField('pack.targetKwh', 'Target energy', c.targetKwh, 'kWh')}${evField('pack.current', 'Load current', c.current, 'A')}`;
    const body = `<div class="analysis-readouts ev-readouts">${readout('Configuration', `${pack.series}S ${pack.parallel}P = ${pack.cells} cells`)}${readout('Nominal / max / min voltage', `${fmt(pack.nominalVoltage, 4)} / ${fmt(pack.maxVoltage, 4)} / ${fmt(pack.minVoltage, 4)} V`)}${readout('Capacity', `${fmt(pack.capacityAh, 4)} Ah`)}${readout('Energy', `${fmt(pack.energyKwh, 4)} kWh`)}${readout('Internal resistance', eng(pack.resistance, 'Ω'))}${readout(`At ${c.current} A: voltage sag / heat`, `${fmt(loaded.sag, 4)} V / ${eng(loaded.loss, 'W')}`)}${readout('C-rate', fmt(loaded.cRate, 3))}${readout('Cell mass / pack mass (×1.35 packaging)', `${fmt(pack.cellMassKg, 4)} kg / ${fmt(pack.packMassKg, 4)} kg`)}${readout('Pack specific energy', `${fmt(pack.specificEnergy, 4)} Wh/kg`)}<p class="field-help">Series cells set the voltage (S = Vpack / Vcell), parallel strings set the capacity (P = E / (S·Vcell·Ah)). Pack resistance = Rcell·S/P.</p></div>`;
    return { controls, body };
  }
  const vehicleControls = `${evField('vehicle.massKg', 'Mass', v.massKg, 'kg')}${evField('vehicle.crr', 'Rolling resistance Crr', v.crr)}${evField('vehicle.cd', 'Drag coefficient Cd', v.cd)}${evField('vehicle.area', 'Frontal area', v.area, 'm²')}${evField('vehicle.drivetrainEfficiency', 'Drivetrain efficiency', v.drivetrainEfficiency)}${evField('vehicle.wheelRadius', 'Wheel radius', v.wheelRadius, 'm')}${evField('vehicle.gearRatio', 'Gear ratio', v.gearRatio)}`;
  if (config.tab === 'drive') {
    const load = constantSpeedRange({ ...v });
    const speeds = Array.from({ length: 29 }, (_, k) => 20 + k * 5);
    const ranges = speeds.map((speedKmh) => constantSpeedRange({ ...v, speedKmh, gradePercent: 0 }));
    const controls = `${vehicleControls}${evField('vehicle.speedKmh', 'Speed', v.speedKmh, 'km/h')}${evField('vehicle.gradePercent', 'Road grade', v.gradePercent, '%')}${evField('vehicle.auxKw', 'Auxiliary load (AC, lights)', v.auxKw, 'kW')}${evField('vehicle.usableKwh', 'Usable battery energy', v.usableKwh, 'kWh')}`;
    const body = `<div class="power-grid"><div>${linePlot('Range (km) at constant speed (km/h), flat road', speeds, [{ name: 'range', values: ranges.map((r) => r.rangeKm) }], { xLabel: (x) => `${Math.round(x)}` })}${linePlot('Consumption (Wh/km) vs speed', speeds, [{ name: 'Wh/km', values: ranges.map((r) => r.consumptionWhKm) }], { xLabel: (x) => `${Math.round(x)}` })}</div>
      <div class="analysis-readouts">${readout('Rolling resistance', eng(load.forces.rolling, 'N'))}${readout('Aerodynamic drag', eng(load.forces.aero, 'N'))}${readout('Grade force', eng(load.forces.grade, 'N'))}${readout('Total tractive force', eng(load.forces.total, 'N'))}${readout('Power at the wheels', eng(load.wheelPower, 'W'))}${readout('Battery power (incl. losses and auxiliaries)', eng(load.batteryPower, 'W'))}${readout('Motor speed / torque', `${Math.round(load.motorRpm).toLocaleString()} rpm / ${fmt(load.motorTorque, 4)} N·m`)}${readout('Consumption', `${fmt(load.consumptionWhKm, 4)} Wh/km`)}${readout('Range', Number.isFinite(load.rangeKm) ? `${fmt(load.rangeKm, 4)} km` : '— (regenerating)')}<p class="field-help">F = Crr·m·g·cos θ + ½ρ·Cd·A·v² + m·g·sin θ. Battery power = F·v/η + auxiliaries; range = usable energy / consumption.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'performance') {
    const m = config.motor;
    const motor = { peakTorque: m.peakTorque, peakPowerKw: m.peakPowerKw, maxRpm: m.maxRpm };
    const run = accelerationRun({ ...v, motor, mu: m.mu, drivenAxleShare: m.drivenAxleShare });
    const rpms = Array.from({ length: 121 }, (_, k) => k * m.maxRpm / 120);
    const controls = `${vehicleControls}${evField('motor.peakTorque', 'Peak torque', m.peakTorque, 'N·m')}${evField('motor.peakPowerKw', 'Peak power', m.peakPowerKw, 'kW')}${evField('motor.maxRpm', 'Max speed', m.maxRpm, 'rpm')}${evField('motor.mu', 'Tyre grip μ', m.mu)}${evField('motor.drivenAxleShare', 'Weight on driven axle', m.drivenAxleShare)}`;
    const body = `<div class="power-grid"><div>${linePlot('Motor torque (N·m) and power (kW) vs rpm', rpms, [{ name: 'torque', values: rpms.map((rpm) => motorTorque(rpm, motor)) }, { name: 'power', values: rpms.map((rpm) => motorTorque(rpm, motor) * rpm * 2 * Math.PI / 60 / 1000), color: PLOT_COLORS[3] }], { xLabel: (x) => `${Math.round(x)}` })}${linePlot('Speed (km/h) vs time (s), full throttle', run.curve.map(([t]) => t), [{ name: 'speed', values: run.curve.map(([, speed]) => speed) }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div class="analysis-readouts">${readout('Base speed', `${Math.round(baseSpeedRpm(motor)).toLocaleString()} rpm`)}${readout('0–100 km/h', run.zeroToTarget === null ? 'not reached' : `${fmt(run.zeroToTarget, 3)} s`)}${readout('Top speed', `${fmt(run.topSpeedKmh, 4)} km/h`)}${readout('Top speed if limited only by motor rpm', `${fmt(run.rpmLimitedTopSpeedKmh, 4)} km/h`)}${readout('Grip-limited traction', eng(run.gripLimitedForce, 'N'))}${readout('Gear ratio for 150 km/h at max rpm', fmt(gearRatioForTopSpeed({ topSpeedKmh: 150, maxRpm: m.maxRpm, wheelRadius: v.wheelRadius }), 4))}<p class="field-help">Constant torque up to base speed (P/T), then constant power. Traction = min(μ·m·g·share, T·G·η/r); integrated every 10 ms against rolling and aerodynamic drag.</p></div></div>`;
    return { controls, body };
  }
  const c = config.charging;
  const result = chargingTime({ capacityKwh: c.capacityKwh, fromSoc: c.fromSoc / 100, toSoc: c.toSoc / 100, chargerKw: c.chargerKw, efficiency: c.efficiency, taperSoc: c.taperSoc / 100 });
  const controls = `${evField('charging.capacityKwh', 'Battery capacity', c.capacityKwh, 'kWh')}${evField('charging.fromSoc', 'From', c.fromSoc, '%')}${evField('charging.toSoc', 'To', c.toSoc, '%')}${evField('charging.chargerKw', 'Charger power', c.chargerKw, 'kW')}${evField('charging.efficiency', 'Charging efficiency', c.efficiency)}${evField('charging.taperSoc', 'CV taper starts at', c.taperSoc, '%')}`;
  const body = `<div class="power-grid"><div>${linePlot('State of charge (%) vs time (min)', result.curve.map(([t]) => t), [{ name: 'SoC', values: result.curve.map(([, soc]) => soc) }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Charger power (kW) vs time (min)', result.curve.map(([t]) => t), [{ name: 'power', values: result.curve.map(([, , p]) => p), color: PLOT_COLORS[3] }], { xLabel: (x) => fmt(x, 3), yMin: 0 })}</div>
    <div class="analysis-readouts">${readout('Charging time', `${fmt(result.minutes, 4)} min (${fmt(result.minutes / 60, 3)} h)`)}${readout('Energy into the battery', `${fmt(result.energyKwh, 4)} kWh`)}${readout('Energy from the grid', `${fmt(result.gridKwh, 4)} kWh`)}<p class="field-help">Constant power (CC) to the taper point, then the power falls linearly to 10 % at full charge (CV phase) — why the last 20 % is slow.</p></div></div>`;
  return { controls, body };
}
export function renderEv(state) {
  const config = evLab.configuration(state);
  let view;
  try { view = renderEvTab(config); } catch (error) { view = { controls: '', body: labError('ev', 'EV', error) }; }
  return `<div class="page scroll-page power-page ev-page">${pageHeader(modules.find((item) => item.id === 'ev'), 'ELECTRIC VEHICLES', '')}${labTabs(EV_TABS, config.tab, 'data-ev-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindSensorEvents() { bindLabControls('sensor', sensorLab, ['type', 'config', 'sensor', 'inamp', 'linearize']); bindLabControls('ev', evLab, ['cell']); }
