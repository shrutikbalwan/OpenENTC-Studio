// Cellular system planning: Erlang-B/C traffic, frequency reuse on a hexagonal layout
// (cluster sizes, co-channel interference, sectoring), propagation models (free space,
// log-distance, Okumura–Hata, COST-231 Hata) with cell radius from a link budget, and a
// handoff simulation with correlated log-normal shadowing and hysteresis.

// ---------------------------------------------------------------------------
// Traffic.

/** Erlang-B blocking probability for A erlangs offered to N channels (stable recursion). */
export function erlangB(traffic, channels) {
  if (!(traffic >= 0) || !Number.isInteger(channels) || channels < 0) throw new RangeError('Traffic must be ≥ 0 and channels a whole number ≥ 0.');
  let b = 1;
  for (let n = 1; n <= channels; n += 1) b = traffic * b / (n + traffic * b);
  return b;
}

/** Erlang-C probability of waiting (A < N), with mean wait and P(wait > t) for holding time H. */
export function erlangC(traffic, channels, holdingTime = null, waitLimit = 0) {
  if (traffic >= channels) return { probabilityWait: 1, stable: false, meanWait: Infinity, probabilityWaitLonger: 1 };
  const b = erlangB(traffic, channels);
  const c = channels * b / (channels - traffic * (1 - b));
  const result = { probabilityWait: c, stable: true, meanWait: null, probabilityWaitLonger: null };
  if (holdingTime) {
    result.meanWait = c * holdingTime / (channels - traffic);
    result.probabilityWaitLonger = c * Math.exp(-(channels - traffic) * waitLimit / holdingTime);
  }
  return result;
}

/** Fewest channels that keep Erlang-B blocking at or below the grade of service. */
export function channelsForGos(traffic, gos) {
  if (!(gos > 0 && gos < 1)) throw new RangeError('Grade of service must be between 0 and 1.');
  let b = 1;
  for (let n = 1; n <= 100_000; n += 1) { b = traffic * b / (n + traffic * b); if (b <= gos) return n; }
  throw new RangeError('Traffic too large.');
}

/** Largest offered traffic N channels carry at the given blocking (bisection on Erlang-B). */
export function trafficForGos(channels, gos) {
  let low = 0, high = Math.max(1, channels * 2 + 10);
  for (let k = 0; k < 200; k += 1) { const mid = (low + high) / 2; if (erlangB(mid, channels) > gos) high = mid; else low = mid; }
  return (low + high) / 2;
}

/** Offered traffic from a user population: A = U · λ · H (H in seconds, λ calls per hour). */
export const offeredTraffic = ({ users, callsPerHour, holdingSeconds }) => users * callsPerHour * holdingSeconds / 3600;

// ---------------------------------------------------------------------------
// Frequency reuse.

/** Valid cluster sizes N = i² + ij + j² up to a limit, with their (i, j). */
export function clusterSizes(limit = 49) {
  const sizes = new Map();
  for (let i = 0; i <= 8; i += 1) for (let j = 0; j <= i; j += 1) { const n = i * i + i * j + j * j; if (n > 0 && n <= limit && !sizes.has(n)) sizes.set(n, { n, i, j }); }
  return [...sizes.values()].sort((a, b) => a.n - b.n);
}

export const SECTORING = Object.freeze({ omni: { label: 'Omnidirectional', interferers: 6, sectors: 1 }, '120': { label: '120° sectors', interferers: 2, sectors: 3 }, '60': { label: '60° sectors', interferers: 1, sectors: 6 } });

/** Co-channel reuse ratio, signal-to-interference (simple and worst-case first tier) and capacity. */
export function reusePlan({ cluster, pathLossExponent = 4, sectoring = 'omni', totalChannels = null, cells = null }) {
  const valid = clusterSizes(400).find((entry) => entry.n === cluster);
  if (!valid) throw new RangeError(`${cluster} is not a valid cluster size (N = i² + ij + j²).`);
  const n = pathLossExponent, q = Math.sqrt(3 * cluster), sector = SECTORING[sectoring];
  if (!sector) throw new RangeError('Unknown sectoring.');
  const sir = q ** n / sector.interferers;
  // Rappaport (3.9): mobile at the cell edge, six interferers at D−R, D−R, D, D, D+R, D+R.
  const worst = sectoring === 'omni' ? 1 / (2 * (q - 1) ** -n + 2 * q ** -n + 2 * (q + 1) ** -n) : null;
  const plan = { cluster, i: valid.i, j: valid.j, q, sir, sirDb: 10 * Math.log10(sir), worstSirDb: worst === null ? null : 10 * Math.log10(worst) };
  if (totalChannels) {
    plan.channelsPerCell = Math.floor(totalChannels / cluster);
    plan.channelsPerSector = Math.floor(plan.channelsPerCell / sector.sectors);
    if (cells) plan.capacity = plan.channelsPerCell * cells;
  }
  return plan;
}

/** Smallest valid cluster size that meets a required S/I (simple first-tier formula). */
export function clusterForSir(requiredSirDb, pathLossExponent = 4, sectoring = 'omni') {
  for (const { n } of clusterSizes(400)) if (reusePlan({ cluster: n, pathLossExponent, sectoring }).sirDb >= requiredSirDb) return n;
  return null;
}

/** Hexagonal layout (axial coordinates, `rings` rings round the centre) coloured by channel group for cluster (i, j). */
export function hexLayout({ i, j, rings = 3 }) {
  const n = i * i + i * j + j * j;
  // Co-channel lattice vectors in axial coordinates: a = (i, j), b = (−j, i + j).
  const a = [i, j], b = [-j, i + j];
  const det = a[0] * b[1] - a[1] * b[0];
  const representatives = new Map();
  const reduce = (q, r) => {
    const m = Math.floor((q * b[1] - r * b[0]) / det + 1e-9), k = Math.floor((a[0] * r - a[1] * q) / det + 1e-9);
    return [q - m * a[0] - k * b[0], r - m * a[1] - k * b[1]];
  };
  const cells = [];
  for (let q = -rings; q <= rings; q += 1) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r += 1) {
      const key = reduce(q, r).join(',');
      if (!representatives.has(key)) representatives.set(key, representatives.size);
      cells.push({ q, r, group: representatives.get(key), x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r });
    }
  }
  // Canonical numbering: the centre cell is group 0 and the rest in order of first appearance from it outward.
  const order = [...cells].sort((p, s) => Math.hypot(p.x, p.y) - Math.hypot(s.x, s.y) || Math.atan2(p.y, p.x) - Math.atan2(s.y, s.x));
  const rename = new Map();
  for (const cell of order) if (!rename.has(cell.group)) rename.set(cell.group, rename.size);
  return { cluster: n, groups: n, cells: cells.map((cell) => ({ ...cell, group: rename.get(cell.group) })) };
}

// ---------------------------------------------------------------------------
// Propagation.

const log10 = Math.log10;
export const freeSpaceLoss = (frequencyMHz, distanceKm) => 32.44 + 20 * log10(frequencyMHz) + 20 * log10(distanceKm);

/** Mobile-antenna correction a(hm) of the Hata model. */
export function hataMobileCorrection(frequencyMHz, mobileHeight, city = 'medium') {
  if (city === 'large') return frequencyMHz <= 300 ? 8.29 * log10(1.54 * mobileHeight) ** 2 - 1.1 : 3.2 * log10(11.75 * mobileHeight) ** 2 - 4.97;
  return (1.1 * log10(frequencyMHz) - 0.7) * mobileHeight - (1.56 * log10(frequencyMHz) - 0.8);
}

export const ENVIRONMENTS = Object.freeze({ 'urban-large': 'Urban, large city', 'urban-medium': 'Urban, small/medium city', suburban: 'Suburban', open: 'Open / rural' });

/** Okumura–Hata (150–1500 MHz) or COST-231 Hata (1500–2000 MHz) median path loss in dB. */
export function hataLoss({ frequencyMHz, baseHeight, mobileHeight, distanceKm, environment = 'urban-medium' }) {
  const f = frequencyMHz, cost = f > 1500;
  const a = hataMobileCorrection(f, mobileHeight, environment === 'urban-large' ? 'large' : 'medium');
  const slope = 44.9 - 6.55 * log10(baseHeight);
  if (cost) {
    const cm = environment === 'urban-large' ? 3 : 0;
    const urban = 46.3 + 33.9 * log10(f) - 13.82 * log10(baseHeight) - a + slope * log10(distanceKm) + cm;
    if (environment === 'suburban') return urban - 2 * log10(f / 28) ** 2 - 5.4;
    if (environment === 'open') return urban - 4.78 * log10(f) ** 2 + 18.33 * log10(f) - 40.94;
    return urban;
  }
  const urban = 69.55 + 26.16 * log10(f) - 13.82 * log10(baseHeight) - a + slope * log10(distanceKm);
  if (environment === 'suburban') return urban - 2 * log10(f / 28) ** 2 - 5.4;
  if (environment === 'open') return urban - 4.78 * log10(f) ** 2 + 18.33 * log10(f) - 40.94;
  return urban;
}

/** Log-distance model: PL(d) = PL(d0) + 10 n log(d/d0), with PL(d0) from free space. */
export const logDistanceLoss = ({ frequencyMHz, distanceKm, exponent = 3.5, referenceKm = 0.001 }) => freeSpaceLoss(frequencyMHz, referenceKm) + 10 * exponent * log10(distanceKm / referenceKm);

/** Cell radius at which the Hata loss reaches the allowed maximum (closed form in log d). */
export function cellRadius({ maxLossDb, ...hata }) {
  const atOneKm = hataLoss({ ...hata, distanceKm: 1 });
  const slope = 44.9 - 6.55 * log10(hata.baseHeight);
  return 10 ** ((maxLossDb - atOneKm) / slope);
}

/** Maximum allowed path loss from a link budget (dBm, dB) less a fade margin for shadowing. */
export function maxAllowedLoss({ eirpDbm, rxSensitivityDbm, rxGainDb = 0, otherLossDb = 0, fadeMarginDb = 0 }) {
  return eirpDbm + rxGainDb - otherLossDb - fadeMarginDb - rxSensitivityDbm;
}

/** Fade margin for log-normal shadowing σ so that P(received > threshold) = coverage at the edge. */
export function fadeMargin(sigmaDb, edgeCoverage) {
  return sigmaDb * inverseNormal(edgeCoverage);
}

/** Inverse standard normal CDF (Acklam's rational approximation plus one Halley step). */
export function inverseNormal(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('Probability must be between 0 and 1.');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  // One Halley refinement step with erfc.
  const e = 0.5 * erfc(-x / Math.SQRT2) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

/** Complementary error function (Numerical Recipes erfcc, fractional error below 1.2e-7). */
export function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const approx = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? approx : 2 - approx;
}

// ---------------------------------------------------------------------------
// Handoff.

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gaussianSource(seed) {
  const random = mulberry32(seed);
  return () => { let u = 0; while (u === 0) u = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random()); };
}

/**
 * A mobile drives from base station A (at 0) to B (at `separation` km). Received powers follow
 * the log-distance model with Gudmundson-correlated shadowing; the call hands off to the other
 * cell when its power exceeds the serving one by the hysteresis for `timeToTrigger` metres.
 */
export function simulateHandoff({ separation = 2, txPowerDbm = 43, frequencyMHz = 900, exponent = 3.5, sigmaDb = 6, decorrelationM = 50, hysteresisDb = 3, timeToTriggerM = 0, thresholdDbm = -100, stepM = 5, seed = 1 }) {
  const steps = Math.round(separation * 1000 / stepM);
  const noiseA = gaussianSource(seed), noiseB = gaussianSource(seed + 7919);
  const rho = Math.exp(-stepM / decorrelationM), innovation = Math.sqrt(1 - rho * rho);
  let shadowA = sigmaDb * noiseA(), shadowB = sigmaDb * noiseB();
  const positions = [], powerA = [], powerB = [], serving = [];
  const events = [];
  let current = 'A', pending = 0, outage = 0;
  for (let k = 0; k <= steps; k += 1) {
    const x = Math.max(stepM / 1000 / 10, k * stepM / 1000), y = Math.max(stepM / 1000 / 10, separation - k * stepM / 1000);
    if (k > 0) { shadowA = rho * shadowA + innovation * sigmaDb * noiseA(); shadowB = rho * shadowB + innovation * sigmaDb * noiseB(); }
    const pa = txPowerDbm - logDistanceLoss({ frequencyMHz, distanceKm: x, exponent }) + (sigmaDb ? shadowA : 0);
    const pb = txPowerDbm - logDistanceLoss({ frequencyMHz, distanceKm: y, exponent }) + (sigmaDb ? shadowB : 0);
    positions.push(k * stepM / 1000); powerA.push(pa); powerB.push(pb);
    const [own, other] = current === 'A' ? [pa, pb] : [pb, pa];
    if (other > own + hysteresisDb) { pending += stepM; if (pending >= timeToTriggerM) { current = current === 'A' ? 'B' : 'A'; events.push({ position: k * stepM / 1000, to: current }); pending = 0; } }
    else pending = 0;
    if ((current === 'A' ? pa : pb) < thresholdDbm) outage += 1;
    serving.push(current);
  }
  const pingPong = events.filter((event, index) => index > 0 && event.to !== events[index - 1].to && event.position - events[index - 1].position < 0.2).length;
  return { positions, powerA, powerB, serving, events, handoffs: events.length, pingPong, outageFraction: outage / (steps + 1) };
}

/** Handoff point without shadowing: PB − PA = 10 n log(dA/dB) reaches the hysteresis H. */
export function idealHandoffPoint({ separation, exponent, hysteresisDb }) {
  const ratio = 10 ** (hysteresisDb / (10 * exponent));
  return separation * ratio / (1 + ratio);
}
