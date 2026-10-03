// Electronic product design: heat-sink thermal design, reliability (MTBF, redundancy),
// PCB trace width (IPC-2221) and battery life.

function positive(value, label) {
  const n = Number(value);
  if (!(n > 0) || !Number.isFinite(n)) throw new RangeError(`${label} must be a positive number.`);
  return n;
}

/**
 * Thermal path junction → case → sink → ambient: required sink-to-ambient resistance for a
 * maximum junction temperature, and the junction temperature with a chosen sink.
 */
export function heatsink({ power = 10, tjMax = 125, ambient = 40, thetaJc = 1.5, thetaCs = 0.5, thetaSa = 4, margin = 0.9 } = {}) {
  const p = positive(power, 'Power');
  const allowed = (margin * tjMax - ambient) / p;
  const required = allowed - thetaJc - thetaCs;
  const tj = ambient + p * (thetaJc + thetaCs + thetaSa);
  const noSink = (theta) => ambient + p * theta;
  return { requiredSa: required, needsSink: true, possible: required > 0, tj, tc: tj - p * thetaJc, ts: tj - p * (thetaJc + thetaCs), totalTheta: thetaJc + thetaCs + thetaSa, ok: tj <= margin * tjMax, noSink, maxPowerWithSink: (margin * tjMax - ambient) / (thetaJc + thetaCs + thetaSa) };
}

/** Typical base failure rates in FIT (failures per 10⁹ h), MIL-HDBK-217-style ballpark values. */
export const PART_FIT = Object.freeze({ resistor: 1, 'ceramic capacitor': 2, 'electrolytic capacitor': 20, diode: 3, transistor: 5, 'IC (small)': 10, microcontroller: 50, connector: 15, 'solder joint': 0.1, inductor: 3, crystal: 10, relay: 100 });

/** Parts-count reliability: total failure rate, MTBF, reliability after t hours and with redundancy. */
export function reliability(parts, { hours = 8760, redundant = 1, factor = 1 } = {}) {
  const fit = parts.reduce((sum, p) => sum + p.quantity * (p.fit ?? PART_FIT[p.type] ?? 0), 0) * factor;
  if (!(fit > 0)) throw new RangeError('Add at least one part with a failure rate.');
  const lambda = fit * 1e-9;
  const r = Math.exp(-lambda * hours);
  const parallel = 1 - (1 - r) ** redundant;
  return { fit, lambda, mtbf: 1 / lambda, reliability: r, redundantReliability: parallel, failuresPerThousandPerYear: 1000 * (1 - Math.exp(-lambda * 8760)), redundantMtbf: Array.from({ length: redundant }, (_, k) => 1 / ((k + 1) * lambda)).reduce((a, b) => a + b, 0) };
}

/** IPC-2221 trace width for a current and temperature rise; copper weight in oz/ft². */
export function traceWidth({ current = 2, riseC = 10, copperOz = 1, layer = 'external', lengthMm = 50, ambient = 25 } = {}) {
  const k = layer === 'internal' ? 0.024 : 0.048;
  const areaMil2 = (positive(current, 'Current') / (k * positive(riseC, 'Temperature rise') ** 0.44)) ** (1 / 0.725);
  const thicknessMil = 1.378 * positive(copperOz, 'Copper weight');
  const widthMil = areaMil2 / thicknessMil;
  const widthMm = widthMil * 0.0254;
  const areaM2 = areaMil2 * (25.4e-6) ** 2;
  const rho = 1.72e-8 * (1 + 0.00393 * (ambient + riseC - 20));
  const resistance = rho * (lengthMm / 1000) / areaM2;
  return { areaMil2, widthMil, widthMm, thicknessMil, resistance, drop: resistance * current, loss: current * current * resistance };
}

/** Battery life for a duty-cycled load, with derating and optional Peukert exponent. */
export function batteryLife({ capacityMah = 2000, activeMa = 50, sleepUa = 20, dutyPercent = 2, derating = 0.8, peukert = 1, ratedHours = 20 } = {}) {
  const d = dutyPercent / 100;
  const average = activeMa * d + (sleepUa / 1000) * (1 - d);
  const usable = positive(capacityMah, 'Capacity') * derating;
  let hours = usable / positive(average, 'Average current');
  if (peukert > 1) hours = ratedHours * (usable / (average * ratedHours)) ** peukert;
  return { averageMa: average, hours, days: hours / 24, years: hours / 8760 };
}
