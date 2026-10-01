// Device model parameters shared by the built-in simulator and the SPICE exporter,
// so a circuit simulated in the browser and in ngspice uses identical models.

export const THERMAL_VOLTAGE = 0.025865; // kT/q at the SPICE nominal 27 °C
export const DIODE_REFERENCE_CURRENT = 0.01;
export const DIODE_EMISSION = Object.freeze({ diode: 1, led: 2 });
export const BJT_SATURATION_CURRENT = 1e-14;
export const BJT_REVERSE_BETA = 1;
export const MOSFET_DEFAULT_KP = 0.02;
export const MOSFET_LAMBDA = 0.01;
// Constant junction capacitances and transit time typical of small-signal parts (2N3904 / 2N7000 class).
export const BJT_CJE = 8e-12;
export const BJT_CJC = 4e-12;
export const BJT_TF = 3e-10;
export const MOSFET_CGS = 10e-12;
export const MOSFET_CGD = 2e-12;
export const OPAMP_OPEN_LOOP_GAIN = 2e5;
export const OPAMP_GAIN_BANDWIDTH = 1e6;
export const OPAMP_CLIP_SHARPNESS = 8;
/** Capacitance of the op-amp's internal 1 Ω pole node: pole at GBW / A0. */
export const OPAMP_POLE_CAPACITANCE = OPAMP_OPEN_LOOP_GAIN / (2 * Math.PI * OPAMP_GAIN_BANDWIDTH);

/** Saturation current that makes a diode or LED conduct 10 mA at its rated forward voltage. */
export function diodeSaturationCurrent(forwardVoltage, type = 'diode') {
  return DIODE_REFERENCE_CURRENT / Math.expm1(forwardVoltage / (DIODE_EMISSION[type] * THERMAL_VOLTAGE));
}

/** Smooth rail limiter f(v) = v / (1 + |v/rail|^n)^(1/n) and its derivative. */
export function opampLimit(v, rail) {
  const u = Math.abs(v / rail) ** OPAMP_CLIP_SHARPNESS;
  return { value: v / (1 + u) ** (1 / OPAMP_CLIP_SHARPNESS), slope: (1 + u) ** (-1 / OPAMP_CLIP_SHARPNESS - 1) };
}
