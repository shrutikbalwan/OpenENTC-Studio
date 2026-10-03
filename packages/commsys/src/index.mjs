// Communication-system planning: the superheterodyne frequency plan (LO, image, image
// rejection of a tuned preselector), cascaded noise figure (Friis), receiver sensitivity,
// cascaded IIP3 and spurious-free dynamic range, and optical-fibre link design (NA, V-number,
// modes, dispersion, power and rise-time budgets).

export const BOLTZMANN = 1.380649e-23;
export const T0 = 290;
const C0 = 299_792_458;
const dbToLinear = (db) => 10 ** (db / 10);
const linearToDb = (value) => 10 * Math.log10(value);

/** Superheterodyne frequency plan for a signal fs and IF (same units), with a single-tuned preselector of loaded Q. */
export function superhet({ signal, intermediate, loAbove = true, q = 0 }) {
  if (!(signal > 0 && intermediate > 0)) throw new RangeError('Signal and IF frequencies must be positive.');
  const lo = loAbove ? signal + intermediate : signal - intermediate;
  if (lo <= 0) throw new RangeError('With low-side injection the IF must be below the signal frequency.');
  const image = loAbove ? signal + 2 * intermediate : signal - 2 * intermediate;
  if (image <= 0) throw new RangeError('The image frequency is not positive for this plan.');
  // Kennedy: α = √(1 + Q²ρ²), ρ = fi/fs − fs/fi, for a single tuned circuit.
  const rho = image / signal - signal / image;
  const rejection = Math.sqrt(1 + q * q * rho * rho);
  return { lo, image, rho, rejection, rejectionDb: 20 * Math.log10(rejection) };
}

/** LO tuning range for a band (e.g. MW 540–1650 kHz) and the resulting capacitance ratios. */
export function tuningRange({ low, high, intermediate, loAbove = true }) {
  const loLow = loAbove ? low + intermediate : low - intermediate, loHigh = loAbove ? high + intermediate : high - intermediate;
  return { loLow, loHigh, loRatio: loHigh / loLow, signalRatio: high / low, loCapacitanceRatio: (loHigh / loLow) ** 2, signalCapacitanceRatio: (high / low) ** 2 };
}

/** Friis cascade: stages [{ name, gainDb, nfDb }] → running gain, noise figure and each stage's share. */
export function friis(stages) {
  if (!stages.length) throw new RangeError('Add at least one stage.');
  let factor = 1, gain = 1;
  const rows = stages.map((stage, index) => {
    const f = dbToLinear(stage.nfDb), g = dbToLinear(stage.gainDb);
    const contribution = index === 0 ? f : (f - 1) / gain;
    factor = index === 0 ? f : factor + contribution;
    gain *= g;
    return { ...stage, noiseFactor: f, noiseTemperature: (f - 1) * T0, contribution, cumulativeGainDb: linearToDb(gain), cumulativeNfDb: linearToDb(factor), cumulativeTemperature: (factor - 1) * T0 };
  });
  return { rows, noiseFactor: factor, nfDb: linearToDb(factor), gainDb: linearToDb(gain), temperature: (factor - 1) * T0 };
}

/** Minimum detectable signal: −174 dBm/Hz + 10·log B + NF + SNR (at T0 = 290 K). */
export function sensitivity({ nfDb, bandwidth, snrDb = 0, temperature = T0 }) {
  const floor = linearToDb(BOLTZMANN * temperature * 1000);
  const noise = floor + linearToDb(bandwidth) + nfDb;
  return { kTdBmPerHz: floor, noiseFloorDbm: noise, sensitivityDbm: noise + snrDb, sensitivityMicrovolts50: Math.sqrt(dbToLinear(noise + snrDb) / 1000 * 50) * 1e6 };
}

/** Cascaded input third-order intercept: 1/IIP3 = Σ (gain before the stage)/IIP3ₖ (powers in mW). */
export function cascadedIip3(stages) {
  let inverse = 0, gain = 1;
  const rows = stages.map((stage) => {
    if (Number.isFinite(stage.iip3Dbm)) inverse += gain / dbToLinear(stage.iip3Dbm);
    gain *= dbToLinear(stage.gainDb);
    return { ...stage, cumulativeIip3Dbm: inverse > 0 ? -linearToDb(inverse) : Infinity };
  });
  const iip3Dbm = inverse > 0 ? -linearToDb(inverse) : Infinity;
  return { rows, iip3Dbm, oip3Dbm: iip3Dbm + linearToDb(gain) };
}

/** Spurious-free dynamic range (two-tone, third order): ⅔(IIP3 − noise floor). */
export const sfdr = (iip3Dbm, noiseFloorDbm) => (2 / 3) * (iip3Dbm - noiseFloorDbm);

/** Full receiver chain: Friis, sensitivity, IIP3 and SFDR together. */
export function receiverChain({ stages, bandwidth, snrDb }) {
  const noise = friis(stages);
  const sens = sensitivity({ nfDb: noise.nfDb, bandwidth, snrDb });
  const linearity = cascadedIip3(stages);
  return { noise, sensitivity: sens, linearity, sfdrDb: Number.isFinite(linearity.iip3Dbm) ? sfdr(linearity.iip3Dbm, sens.noiseFloorDbm) : Infinity };
}

// ---------------------------------------------------------------------------
// Optical fibre.

/** Step-index fibre parameters: NA, acceptance angle, V-number, mode count and single-mode cut-off. */
export function fibreParameters({ n1, n2, coreDiameter, wavelength }) {
  if (!(n1 > n2 && n2 > 0)) throw new RangeError('The core index n1 must be greater than the cladding index n2.');
  const na = Math.sqrt(n1 * n1 - n2 * n2), delta = (n1 * n1 - n2 * n2) / (2 * n1 * n1);
  const radius = coreDiameter / 2, v = 2 * Math.PI * radius * na / wavelength;
  return {
    na, delta, acceptanceAngle: Math.asin(Math.min(1, na)) * 180 / Math.PI, criticalAngle: Math.asin(n2 / n1) * 180 / Math.PI,
    v, singleMode: v < 2.405, modes: v < 2.405 ? 1 : Math.round(v * v / 2), cutoffWavelength: 2 * Math.PI * radius * na / 2.405,
    maxCoreDiameterSingleMode: 2.405 * wavelength / (Math.PI * na),
  };
}

/** Optical power budget (dBm, dB, dB/km, km). */
export function powerBudget({ txPowerDbm, rxSensitivityDbm, length, attenuation, splices = 0, spliceLoss = 0.1, connectors = 2, connectorLoss = 0.5, margin = 3 }) {
  const items = [
    { name: `Fibre ${length} km × ${attenuation} dB/km`, loss: length * attenuation },
    { name: `${splices} splices × ${spliceLoss} dB`, loss: splices * spliceLoss },
    { name: `${connectors} connectors × ${connectorLoss} dB`, loss: connectors * connectorLoss },
    { name: 'System margin', loss: margin },
  ];
  const totalLoss = items.reduce((sum, item) => sum + item.loss, 0);
  const received = txPowerDbm - totalLoss + margin;
  const available = txPowerDbm - rxSensitivityDbm;
  const fixed = splices * spliceLoss + connectors * connectorLoss + margin;
  return { items, totalLoss, receivedDbm: received, available, excess: available - totalLoss, feasible: available >= totalLoss, maxLength: attenuation > 0 ? Math.max(0, (available - fixed) / attenuation) : Infinity };
}

/** Rise-time budget: t_sys = √(t_tx² + t_modal² + t_chrom² + t_rx²); max NRZ rate 0.7/t_sys, RZ 0.35/t_sys. */
export function riseTimeBudget({ txRise, rxRise, length, n1, n2 = null, profile = 'step', dispersion = 0, spectralWidth = 0, singleMode = false }) {
  const lengthMetres = length * 1000;
  let modal = 0;
  if (!singleMode && n2) {
    const delta = (n1 - n2) / n1;
    // Step index: Δτ = L n1 Δ / c; graded (parabolic) index: L n1 Δ² / (8c).
    modal = profile === 'graded' ? lengthMetres * n1 * delta * delta / (8 * C0) : lengthMetres * n1 * delta / C0;
  }
  const chromatic = Math.abs(dispersion) * 1e-12 * spectralWidth * length; // ps/(nm·km) × nm × km
  const system = Math.sqrt(txRise ** 2 + modal ** 2 + chromatic ** 2 + rxRise ** 2);
  return { modal, chromatic, system, maxNrzRate: 0.7 / system, maxRzRate: 0.35 / system, items: [['Transmitter', txRise], ['Modal dispersion', modal], ['Chromatic dispersion', chromatic], ['Receiver', rxRise]] };
}
