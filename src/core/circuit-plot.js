// Pure helpers for plotting and measuring built-in transient and AC results.

export const MAX_PLOT_POINTS = 1200;

/** Traces a result can plot: node voltages first, then component currents (transient only). */
export function circuitTraces(result) {
  if (!result) return [];
  if (result.kind === 'circuit-ac') {
    return Object.keys(result.nodes).map((node) => ({ key: `V(${node})`, label: `V(${node})`, node }));
  }
  if (result.kind !== 'circuit-transient') return [];
  const voltages = Object.keys(result.nodes).filter((node) => node !== '0').map((node) => ({ key: `V(${node})`, label: `V(${node})`, unit: 'V', values: result.nodes[node] }));
  const currents = Object.keys(result.currents).map((id) => ({ key: `I(${id})`, label: `I(${id})`, unit: 'A', values: result.currents[id] }));
  return [...voltages, ...currents];
}

/** Keep the traced shape (including peaks) while bounding SVG size: min and max per bucket, in order. */
export function decimate(xs, ys, limit = MAX_PLOT_POINTS) {
  if (xs.length <= limit) return { xs: [...xs], ys: [...ys] };
  const buckets = Math.max(1, Math.floor(limit / 2));
  const size = xs.length / buckets;
  const outX = [], outY = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(bucket * size), end = Math.min(xs.length, Math.floor((bucket + 1) * size));
    let low = start, high = start;
    for (let index = start; index < end; index += 1) { if (ys[index] < ys[low]) low = index; if (ys[index] > ys[high]) high = index; }
    for (const index of low <= high ? [low, high] : [high, low]) if (outX.at(-1) !== xs[index] || outY.at(-1) !== ys[index]) { outX.push(xs[index]); outY.push(ys[index]); }
  }
  if (outX.at(-1) !== xs.at(-1)) { outX.push(xs.at(-1)); outY.push(ys.at(-1)); }
  return { xs: outX, ys: outY };
}

/** Rounded axis range and tick values for a linear axis. */
export function niceRange(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
  const low = Math.floor(min / step) * step, high = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Number(value.toPrecision(12)));
  return { min: low, max: high, ticks };
}

/** Decade ticks for a logarithmic frequency axis. */
export function decadeTicks(min, max) {
  const ticks = [];
  for (let exponent = Math.ceil(Math.log10(min) - 1e-9); 10 ** exponent <= max * (1 + 1e-9); exponent += 1) ticks.push(10 ** exponent);
  return ticks;
}

/** SVG path for a polyline scaled into width × height (y grows downward). */
export function linePath(xs, ys, { width, height, xMin, xMax, yMin, yMax, logX = false }) {
  const mapX = logX ? (x) => (Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin) || 1) : (x) => (x - xMin) / (xMax - xMin || 1);
  const spanY = yMax - yMin || 1;
  let path = '';
  for (let index = 0; index < xs.length; index += 1) {
    if (!Number.isFinite(ys[index])) continue;
    path += `${path ? 'L' : 'M'}${(mapX(xs[index]) * width).toFixed(2)} ${(height - (ys[index] - yMin) / spanY * height).toFixed(2)}`;
  }
  return path;
}

const interpolateCrossing = (xs, ys, index, level) => xs[index - 1] + (level - ys[index - 1]) / (ys[index] - ys[index - 1]) * (xs[index] - xs[index - 1]);

/** Step-response measurements: final value, extremes, 10–90 % rise time and overshoot. */
export function stepMetrics(time, values) {
  const initial = values[0], final = values.at(-1);
  const peak = Math.max(...values), minimum = Math.min(...values);
  const change = final - initial;
  const metrics = { initial, final, peak, minimum, riseTime: null, overshootPercent: null };
  if (Math.abs(change) < 1e-12 * Math.max(1, Math.abs(final))) return metrics;
  const level = (fraction) => initial + fraction * change;
  const crossing = (target) => { for (let index = 1; index < values.length; index += 1) if ((values[index - 1] - target) * (values[index] - target) <= 0 && values[index] !== values[index - 1]) return interpolateCrossing(time, values, index, target); return null; };
  const low = crossing(level(0.1)), high = crossing(level(0.9));
  if (low !== null && high !== null && high >= low) metrics.riseTime = high - low;
  const extreme = change > 0 ? peak : minimum;
  metrics.overshootPercent = Math.max(0, (extreme - final) / change * 100);
  return metrics;
}

/** Periodic-waveform measurements over the whole trace (uniform time grid): peak-to-peak, mean and RMS. */
export function waveformMetrics(values) {
  let sum = 0, squares = 0;
  for (const value of values) { sum += value; squares += value * value; }
  return { peakToPeak: Math.max(...values) - Math.min(...values), average: sum / values.length, rms: Math.sqrt(squares / values.length) };
}

/** Unwrap a phase trace in degrees so the plot does not jump by 360°. */
export function unwrapPhase(phase) {
  const out = [];
  let offset = 0;
  for (let index = 0; index < phase.length; index += 1) {
    if (index) { const delta = phase[index] + offset - out[index - 1]; if (delta > 180) offset -= 360; else if (delta < -180) offset += 360; }
    out.push(phase[index] + offset);
  }
  return out;
}

const crossingLog = (frequency, values, index, level) => 10 ** interpolateCrossing(frequency.map(Math.log10), values, index, level);

/** Bode measurements: peak gain, and the −3 dB points around it (null when not crossed in range). */
export function bodeMetrics(frequency, magnitude, phase) {
  const decibels = magnitude.map((value) => 20 * Math.log10(Math.max(value, 1e-300)));
  let peakIndex = 0;
  decibels.forEach((value, index) => { if (value > decibels[peakIndex]) peakIndex = index; });
  const level = decibels[peakIndex] - 3.0103;
  let lower = null, upper = null;
  for (let index = peakIndex; index > 0; index -= 1) if (decibels[index - 1] <= level && decibels[index] > level) { lower = crossingLog(frequency, decibels, index, level); break; }
  for (let index = peakIndex + 1; index < decibels.length; index += 1) if (decibels[index - 1] > level && decibels[index] <= level) { upper = crossingLog(frequency, decibels, index, level); break; }
  return { decibels, peakDb: decibels[peakIndex], peakFrequency: frequency[peakIndex], lowerCutoff: lower, upperCutoff: upper, phase: unwrapPhase(phase) };
}

const csvNumber = (value) => Number.isFinite(value) ? String(value) : '';

/** CSV export of every trace in a transient or AC result. */
export function circuitResultCsv(result) {
  if (result?.kind === 'circuit-transient') {
    const traces = circuitTraces(result);
    const rows = [['time_s', ...traces.map((trace) => `${trace.label}_${trace.unit}`)].join(',')];
    result.time.forEach((time, index) => rows.push([time, ...traces.map((trace) => trace.values[index])].map(csvNumber).join(',')));
    return `${rows.join('\n')}\n`;
  }
  if (result?.kind === 'circuit-ac') {
    const nodes = Object.keys(result.nodes);
    const rows = [['frequency_hz', ...nodes.flatMap((node) => [`V(${node})_dB`, `V(${node})_phase_deg`])].join(',')];
    result.frequency.forEach((frequency, index) => rows.push([frequency, ...nodes.flatMap((node) => [20 * Math.log10(result.nodes[node].magnitude[index]), result.nodes[node].phase[index]])].map(csvNumber).join(',')));
    return `${rows.join('\n')}\n`;
  }
  throw new TypeError('Only built-in transient and AC results can be exported.');
}
