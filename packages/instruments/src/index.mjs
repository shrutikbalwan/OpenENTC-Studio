// Virtual lab bench: oscilloscope measurements and triggering, digital multimeter readings,
// function-generator and bench power-supply models applied to a circuit netlist.
// Pure functions; the circuit solver is passed in so the package stays engine-independent.

// ---------------------------------------------------------------------------
// Waveform measurements (oscilloscope "Measure" menu).

/** Interpolated time where the segment (t0, v0) → (t1, v1) crosses `level`. */
const cross = (t0, v0, t1, v1, level) => (v1 === v0 ? t0 : t0 + (level - v0) * (t1 - t0) / (v1 - v0));

/**
 * Rising and falling crossings of `level` with hysteresis (a crossing counts only after the
 * signal has gone beyond level ∓ hysteresis), times interpolated between samples.
 */
export function crossings(time, values, level, hysteresis = 0) {
  const rising = [], falling = [];
  let state = values[0] > level ? 1 : values[0] < level ? -1 : 0;
  let armedRise = values[0] < level - hysteresis, armedFall = values[0] > level + hysteresis;
  for (let k = 1; k < values.length; k += 1) {
    const v = values[k];
    if (v < level - hysteresis) armedRise = true;
    if (v > level + hysteresis) armedFall = true;
    if (state <= 0 && v >= level && v > values[k - 1] && armedRise) { rising.push(cross(time[k - 1], values[k - 1], time[k], v, level)); armedRise = false; state = 1; }
    else if (state >= 0 && v <= level && v < values[k - 1] && armedFall) { falling.push(cross(time[k - 1], values[k - 1], time[k], v, level)); armedFall = false; state = -1; }
    else if (v > level) state = 1;
    else if (v < level) state = -1;
  }
  return { rising, falling };
}

/** ∫v dt and ∫v² dt over [from, to] with the trapezoidal rule (v linear between samples). */
function integrals(time, values, from, to) {
  let area = 0, square = 0;
  for (let k = 1; k < time.length; k += 1) {
    let t0 = time[k - 1], t1 = time[k];
    if (t1 <= from || t0 >= to) continue;
    let v0 = values[k - 1], v1 = values[k];
    if (t0 < from) { v0 = v0 + (v1 - v0) * (from - t0) / (t1 - t0); t0 = from; }
    if (t1 > to) { v1 = values[k - 1] + (v1 - values[k - 1]) * (to - time[k - 1]) / (time[k] - time[k - 1]); t1 = to; }
    const h = t1 - t0;
    area += h * (v0 + v1) / 2;
    square += h * (v0 * v0 + v0 * v1 + v1 * v1) / 3; // exact for a linear segment
  }
  return { area, square };
}

/**
 * Automatic measurements of one trace: Vmax, Vmin, Vpp, mean, RMS (true and AC-coupled),
 * frequency, period, duty cycle and 10–90 % rise/fall time. Mean and RMS use a whole number of
 * periods when the signal is periodic (as bench scopes do), otherwise the whole record.
 */
export function measure(time, values) {
  if (time.length !== values.length || time.length < 2) throw new RangeError('A trace needs at least two samples.');
  let max = -Infinity, min = Infinity;
  for (const v of values) { if (v > max) max = v; if (v < min) min = v; }
  const pp = max - min;
  const mid = (max + min) / 2;
  const flat = pp <= 1e-9 * Math.max(1, Math.abs(max));
  const { rising, falling } = flat ? { rising: [], falling: [] } : crossings(time, values, mid, pp * 0.1);
  let period = null, from = time[0], to = time.at(-1);
  if (rising.length >= 2) {
    period = (rising.at(-1) - rising[0]) / (rising.length - 1);
    from = rising[0]; to = rising.at(-1);
  }
  const { area, square } = integrals(time, values, from, to);
  const span = to - from;
  const mean = area / span, rms = Math.sqrt(Math.max(0, square / span));
  const acRms = Math.sqrt(Math.max(0, rms * rms - mean * mean));
  let duty = null;
  if (period) {
    const highs = [];
    for (let k = 0; k + 1 < rising.length; k += 1) {
      const fall = falling.find((t) => t > rising[k] && t < rising[k + 1]);
      if (fall !== undefined) highs.push(fall - rising[k]);
    }
    if (highs.length) duty = highs.reduce((sum, h) => sum + h, 0) / highs.length / period;
  }
  const edgeTime = (direction) => {
    if (flat) return null;
    const low = min + 0.1 * pp, high = min + 0.9 * pp;
    const [first, second] = direction === 'rise' ? [low, high] : [high, low];
    const midTimes = direction === 'rise' ? rising : falling;
    for (const centre of midTimes) {
      let k = time.findIndex((t) => t >= centre);
      if (k < 1) continue;
      let a = null, b = null;
      for (let j = k; j >= 1; j -= 1) if ((values[j - 1] - first) * (values[j] - first) <= 0 && values[j - 1] !== values[j]) { a = cross(time[j - 1], values[j - 1], time[j], values[j], first); break; }
      for (let j = k; j < time.length; j += 1) if ((values[j - 1] - second) * (values[j] - second) <= 0 && values[j - 1] !== values[j]) { b = cross(time[j - 1], values[j - 1], time[j], values[j], second); break; }
      if (a !== null && b !== null && b >= a) return b - a;
    }
    return null;
  };
  return { max, min, pp, mean, rms, acRms, period, frequency: period ? 1 / period : null, duty, riseTime: edgeTime('rise'), fallTime: edgeTime('fall'), periods: period ? rising.length - 1 : 0 };
}

/**
 * Phase of trace B relative to trace A in degrees, (−180, 180]: negative when B lags A.
 * Uses the mean-level rising crossings of both traces.
 */
export function phaseDifference(time, a, b) {
  const ma = measure(time, a), mb = measure(time, b);
  if (!ma.period || !mb.period) return null;
  const ra = crossings(time, a, (ma.max + ma.min) / 2, ma.pp * 0.1).rising;
  const rb = crossings(time, b, (mb.max + mb.min) / 2, mb.pp * 0.1).rising;
  const ta = ra.at(-1);
  // Nearest B crossing to A's last rising crossing.
  const tb = rb.reduce((best, t) => (Math.abs(t - ta) < Math.abs(best - ta) ? t : best), rb[0]);
  let degrees = -360 * (tb - ta) / ma.period;
  degrees = ((degrees + 180) % 360 + 360) % 360 - 180;
  return degrees === -180 ? 180 : degrees;
}

/**
 * Oscilloscope trigger: the first time ≥ `from` where the trace crosses `level` on the given
 * slope (with a small hysteresis so noise does not re-trigger). Returns null when none is found.
 */
export function findTrigger(time, values, { level = 0, slope = 'rising', from = -Infinity, hysteresis = 0 } = {}) {
  let armed = false;
  for (let k = 1; k < time.length; k += 1) {
    const v0 = values[k - 1], v1 = values[k];
    if (slope === 'rising' ? v0 < level - hysteresis : v0 > level + hysteresis) armed = true;
    if (time[k] < from || !armed) continue;
    if (slope === 'rising' ? v0 < level && v1 >= level : v0 > level && v1 <= level) {
      const t = cross(time[k - 1], v0, time[k], v1, level);
      if (t >= from) return t;
    }
  }
  return null;
}

/** Linear interpolation of a trace at time t (clamped to the record). */
export function valueAt(time, values, t) {
  if (t <= time[0]) return values[0];
  if (t >= time.at(-1)) return values.at(-1);
  let low = 0, high = time.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (time[mid] <= t) low = mid; else high = mid; }
  return values[low] + (values[high] - values[low]) * (t - time[low]) / (time[high] - time[low]);
}

/**
 * The part of a trace shown on screen, [start, start + span], as display points. Long records
 * are reduced to a min/max pair per pixel column so narrow spikes stay visible.
 */
export function screenTrace(time, values, start, span, columns = 500) {
  const end = start + span;
  const inside = [];
  for (let k = 0; k < time.length; k += 1) if (time[k] > start && time[k] < end) inside.push(k);
  const points = [{ t: start, v: valueAt(time, values, start) }];
  if (inside.length <= columns * 2) for (const k of inside) points.push({ t: time[k], v: values[k] });
  else {
    let column = -1, lo = null, hi = null;
    const flush = () => { if (lo === null) return; const pair = lo.t < hi.t ? [lo, hi] : [hi, lo]; points.push(pair[0]); if (pair[1] !== pair[0]) points.push(pair[1]); };
    for (const k of inside) {
      const c = Math.floor((time[k] - start) / span * columns);
      if (c !== column) { flush(); column = c; lo = hi = { t: time[k], v: values[k] }; }
      else { if (values[k] < lo.v) lo = { t: time[k], v: values[k] }; if (values[k] > hi.v) hi = { t: time[k], v: values[k] }; }
    }
    flush();
  }
  points.push({ t: end, v: valueAt(time, values, end) });
  return points;
}

/** The 1-2-5 sequence of oscilloscope V/div and s/div settings. */
export function oneTwoFive(minimum, maximum) {
  const steps = [];
  for (let decade = Math.floor(Math.log10(minimum)); 10 ** decade <= maximum; decade += 1) {
    for (const m of [1, 2, 5]) { const value = Number((m * 10 ** decade).toPrecision(3)); if (value >= minimum * 0.999 && value <= maximum * 1.001) steps.push(value); }
  }
  return steps;
}

/** Smallest 1-2-5 setting that fits `span` into `divisions`. */
export function autoScale(span, divisions) {
  const target = span / divisions;
  const decade = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * decade >= target * 0.999) return Number((m * decade).toPrecision(3));
  return Number((10 * decade).toPrecision(3));
}

// ---------------------------------------------------------------------------
// Digital multimeter.

// Ranges of a typical 6000-count handheld meter (scaled for other count sizes).
const DMM_RANGES = { V: [0.6, 6, 60, 600, 1000], A: [600e-6, 6e-3, 60e-3, 600e-3, 6, 10], 'Ω': [600, 6e3, 60e3, 600e3, 6e6, 60e6], default: [600e-6, 6e-3, 60e-3, 600e-3, 6, 60, 600, 6e3, 60e3, 600e3, 6e6, 60e6] };
const PREFIXES = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];

/**
 * Format a reading like an autoranging handheld meter with `counts` (6000 = "3 5/6 digit").
 * Picks the smallest range that holds the value; beyond the top range it shows OL.
 */
export function dmmDisplay(value, unit, { counts = 6000, ranges = null } = {}) {
  if (value === null || !Number.isFinite(value)) return { text: 'OL', overload: true, range: null };
  const magnitude = Math.abs(value);
  const fullScale = counts / 10 ** Math.floor(Math.log10(counts)); // e.g. 6.000 for 6000 counts
  const candidates = ranges ?? (DMM_RANGES[unit] ?? DMM_RANGES.default).map((r) => r / 6 * fullScale);
  const range = candidates.find((r) => magnitude < r * 0.99995);
  if (range === undefined) return { text: 'OL', overload: true, range: candidates.at(-1) };
  const [scale, prefix] = PREFIXES.find(([s]) => range / s >= 0.999) ?? PREFIXES.at(-1);
  const scaledRange = range / scale;
  const integerDigits = Math.max(1, Math.floor(Math.log10(scaledRange * 0.99999)) + 1);
  const totalDigits = Math.floor(Math.log10(counts)) + 1;
  const decimals = Math.max(0, totalDigits - integerDigits);
  const shown = (value / scale).toFixed(decimals);
  return { text: `${shown === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : shown} ${prefix}${unit}`, overload: false, range };
}

/** Copy of the circuit with every independent source turned off (V → 0 V short, I → 0 A open). */
export function zeroSources(components) {
  return components.map((part) => (part.type === 'voltage' || part.type === 'current' ? { ...part, value: 0 } : part));
}

/**
 * Ohmmeter between nodes a and b: sources off, a test current (1 mA, like a 6000-count meter's
 * 6 kΩ range) is pushed into a and R = ΔV / I. Diodes show their forward drop at that current.
 * Returns null (OL) when the meter's 3 V compliance is exceeded.
 */
export function measureResistance(simulateDC, components, wires, netLabels, a, b, { testCurrent = 1e-3, compliance = 3 } = {}) {
  const probe = { id: '__ohmmeter', type: 'current', label: 'ohmmeter', value: testCurrent, n1: b, n2: a };
  const result = simulateDC([...zeroSources(components), probe], wires, netLabels);
  const v = (result.nodes[a] ?? 0) - (result.nodes[b] ?? 0);
  if (!Number.isFinite(v) || Math.abs(v) > compliance) return { ohms: null, volts: Math.min(compliance, Math.abs(v)) };
  return { ohms: v / testCurrent, volts: v };
}

/** Diode-test mode: forward voltage at 1 mA between anode probe a and cathode probe b (OL above 3 V). */
export function diodeTest(simulateDC, components, wires, netLabels, a, b) {
  const { volts, ohms } = measureResistance(simulateDC, components, wires, netLabels, a, b);
  return ohms === null ? null : volts;
}

// ---------------------------------------------------------------------------
// Function generator and bench power supply applied to a netlist.

export const GENERATOR_SHAPES = Object.freeze(['sine', 'square', 'triangle', 'sawtooth', 'pulse', 'dc']);

/**
 * Turn function-generator settings into a circuit and a transient stimulus. Amplitude is set
 * as peak-to-peak into a high-impedance load (as on a bench generator); with a 50 Ω output the
 * generator's internal resistor is inserted in series, so the voltage at the terminals drops
 * with load exactly as it does on the bench.
 */
export function applyGenerator(components, { sourceId, shape = 'sine', frequency = 1000, vpp = 2, offset = 0, duty = 0.5, impedance = 'high-z' } = {}) {
  if (!GENERATOR_SHAPES.includes(shape)) throw new RangeError(`Waveform must be one of ${GENERATOR_SHAPES.join(', ')}.`);
  const source = components.find((part) => part.id === sourceId && part.type === 'voltage');
  if (!source) throw new Error('Choose a voltage source for the function generator to drive.');
  if (!(frequency > 0)) throw new RangeError('Frequency must be positive.');
  if (!(vpp >= 0)) throw new RangeError('Amplitude must be zero or positive.');
  const amplitude = shape === 'pulse' ? vpp : vpp / 2;
  let parts = components;
  if (impedance === '50') {
    const inner = `__fgen_${source.id}`;
    parts = [...components.map((part) => (part.id === source.id ? { ...part, n1: inner } : part)), { id: `__fgen_r_${source.id}`, type: 'resistor', label: 'Generator 50 Ω', value: 50, n1: inner, n2: source.n1 }];
  }
  const stimulus = shape === 'dc'
    ? { sourceId: source.id, shape: 'dc', amplitude: 0, offset }
    : { sourceId: source.id, shape, frequency, amplitude, offset, duty };
  return { components: parts, stimulus };
}

/**
 * Bench supply channels (CV/CC). Each channel sets a voltage source's value; if the load would
 * draw more than the current limit the channel switches to constant current at the limit, like
 * a real supply. Returns the modified circuit and each channel's operating point.
 */
export function applySupplies(simulateDC, components, wires, netLabels, channels = []) {
  let parts = components.map((part) => {
    const channel = channels.find((entry) => entry.sourceId === part.id && entry.enabled !== false);
    if (channel && part.type === 'voltage') return { ...part, value: Number(channel.voltage) };
    const off = channels.find((entry) => entry.sourceId === part.id && entry.enabled === false);
    return off && part.type === 'voltage' ? { ...part, value: 0 } : part;
  });
  const status = [];
  for (let pass = 0; pass < 3; pass += 1) {
    const result = simulateDC(parts, wires, netLabels);
    let changed = false;
    status.length = 0;
    for (const channel of channels) {
      const part = parts.find((entry) => entry.id === channel.sourceId);
      if (!part) continue;
      const nodes = (name) => result.nodes[name] ?? 0;
      if (part.type === 'voltage') {
        const delivered = -(result.currents[part.id] ?? 0); // source current flows n1 → n2 inside the source
        const limit = Number(channel.currentLimit);
        if (channel.enabled !== false && limit > 0 && Math.abs(delivered) > limit * 1.0001) {
          // Switch to constant current at the limit, in the direction it was flowing.
          parts = parts.map((entry) => (entry.id === part.id ? { ...entry, type: 'current', value: Math.sign(delivered) * limit, n1: part.n2, n2: part.n1, ccFrom: part } : entry));
          changed = true;
        }
        status.push({ sourceId: channel.sourceId, mode: channel.enabled === false ? 'off' : 'CV', volts: nodes(part.n1) - nodes(part.n2), amps: delivered });
      } else {
        const original = part.ccFrom;
        const volts = nodes(original.n1) - nodes(original.n2);
        // Back to CV if the CC solution would exceed the set voltage.
        if (Math.abs(volts) > Math.abs(Number(channel.voltage)) * 1.0001) { parts = parts.map((entry) => (entry.id === part.id ? { ...original, value: Number(channel.voltage) } : entry)); changed = true; }
        status.push({ sourceId: channel.sourceId, mode: 'CC', volts, amps: Number(part.value) });
      }
    }
    if (!changed) break;
  }
  return { components: parts.map(({ ccFrom, ...part }) => (void ccFrom, part)), status };
}
