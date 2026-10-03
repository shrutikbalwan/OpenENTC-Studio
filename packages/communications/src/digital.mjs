// Digital modulation lab: Gray-mapped constellations over AWGN, BER vs theory and eye diagrams.
import { boundedNumber, createRandom, qFunction } from './math.mjs';

export const DIGITAL_SCHEMES = Object.freeze({ bpsk: 2, qpsk: 4, '8psk': 8, '16qam': 16 });
const MAX_SIMULATED_BITS = 400_000;
const MAX_PLOTTED_POINTS = 1500;
const gray = (value) => value ^ (value >> 1);

/** Unit-average-energy constellation with Gray bit labels. */
export function constellation(scheme) {
  const order = DIGITAL_SCHEMES[scheme];
  if (!order) throw new RangeError(`Scheme must be one of ${Object.keys(DIGITAL_SCHEMES).join(', ')}.`);
  const bitsPerSymbol = Math.log2(order);
  if (scheme === '16qam') {
    const levels = [-3, -1, 3, 1]; // index by Gray pair: 00→-3, 01→-1, 10→3, 11→1
    const scale = 1 / Math.sqrt(10);
    return { order, bitsPerSymbol, points: Array.from({ length: 16 }, (_, label) => ({ i: levels[label >> 2] * scale, q: levels[label & 3] * scale, label })) };
  }
  // PSK: point k sits at angle 2πk/M (QPSK rotated by 45°) and carries Gray label gray(k).
  const offset = scheme === 'qpsk' ? Math.PI / 4 : 0;
  return { order, bitsPerSymbol, points: Array.from({ length: order }, (_, k) => ({ i: Math.cos(offset + 2 * Math.PI * k / order), q: Math.sin(offset + 2 * Math.PI * k / order), label: gray(k) })) };
}

/** Closed-form (Gray-coded, nearest-neighbour) bit error probability over AWGN. */
export function theoreticalBer(scheme, ebN0dB) {
  const ebN0 = 10 ** (ebN0dB / 10);
  const order = DIGITAL_SCHEMES[scheme];
  const k = Math.log2(order);
  if (scheme === 'bpsk' || scheme === 'qpsk') return qFunction(Math.sqrt(2 * ebN0));
  if (scheme === '8psk') return (2 / k) * qFunction(Math.sqrt(2 * k * ebN0) * Math.sin(Math.PI / order));
  return (4 / k) * (1 - 1 / Math.sqrt(order)) * qFunction(Math.sqrt(3 * k / (order - 1) * ebN0));
}

/** Simulate random bits through the modulator, AWGN at Eb/N0 and a minimum-distance detector. */
export function simulateDigitalLink({ scheme = 'qpsk', ebN0dB = 6, bits = 20_000, seed = 1 } = {}) {
  const map = constellation(scheme);
  const snr = boundedNumber(ebN0dB, -10, 30, 'Eb/N0 (dB)');
  const symbols = Math.ceil(Math.trunc(boundedNumber(bits, map.bitsPerSymbol, MAX_SIMULATED_BITS, 'Bit count')) / map.bitsPerSymbol);
  const random = createRandom(seed);
  // Es = 1, so Eb = 1/k and the per-dimension noise variance is N0/2 = 1 / (2·k·Eb/N0).
  const sigma = Math.sqrt(1 / (2 * map.bitsPerSymbol * 10 ** (snr / 10)));
  const byLabel = new Map(map.points.map((point) => [point.label, point]));
  let bitErrors = 0, symbolErrors = 0;
  const received = [];
  for (let n = 0; n < symbols; n += 1) {
    let label = 0;
    for (let b = 0; b < map.bitsPerSymbol; b += 1) label = (label << 1) | random.bit();
    const sent = byLabel.get(label);
    const point = { i: sent.i + sigma * random.gaussian(), q: map.order === 2 ? sent.q : sent.q + sigma * random.gaussian() };
    let best = map.points[0], bestDistance = Infinity;
    for (const candidate of map.points) { const distance = (candidate.i - point.i) ** 2 + (candidate.q - point.q) ** 2; if (distance < bestDistance) { bestDistance = distance; best = candidate; } }
    if (best.label !== label) { symbolErrors += 1; let difference = best.label ^ label; while (difference) { bitErrors += difference & 1; difference >>= 1; } }
    if (received.length < MAX_PLOTTED_POINTS) received.push({ i: point.i, q: point.q, error: best.label !== label });
  }
  const totalBits = symbols * map.bitsPerSymbol;
  return {
    kind: 'digital-link', scheme, ebN0dB: snr, bits: totalBits, symbols, sigma,
    reference: map.points.map((point) => ({ ...point, bits: point.label.toString(2).padStart(map.bitsPerSymbol, '0') })),
    received, bitErrors, symbolErrors, ber: bitErrors / totalBits, ser: symbolErrors / symbols, theory: theoreticalBer(scheme, snr),
  };
}

/** BER versus Eb/N0, simulated (until enough errors are seen) alongside theory. */
export function berCurve({ scheme = 'qpsk', from = 0, to = 12, step = 1, bitsPerPoint = 100_000, seed = 3 } = {}) {
  const start = boundedNumber(from, -10, 30, 'Start Eb/N0'), stop = boundedNumber(to, start, 30, 'Stop Eb/N0'), increment = boundedNumber(step, 0.25, 10, 'Step');
  const points = [];
  for (let snr = start; snr <= stop + 1e-9; snr += increment) {
    const run = simulateDigitalLink({ scheme, ebN0dB: snr, bits: bitsPerPoint, seed: seed + points.length });
    points.push({ ebN0dB: Number(snr.toFixed(3)), simulated: run.bitErrors ? run.ber : null, errors: run.bitErrors, bits: run.bits, theory: run.theory });
  }
  return { kind: 'ber-curve', scheme, points };
}

/** Raised-cosine pulse value at t (in symbol periods) for roll-off α. */
export function raisedCosine(t, alpha) {
  if (Math.abs(t) < 1e-12) return 1;
  if (alpha > 0 && Math.abs(Math.abs(t) - 1 / (2 * alpha)) < 1e-9) return (Math.PI / 4) * Math.sin(Math.PI / (2 * alpha)) / (Math.PI / (2 * alpha));
  return (Math.sin(Math.PI * t) / (Math.PI * t)) * Math.cos(Math.PI * alpha * t) / (1 - (2 * alpha * t) ** 2);
}

/**
 * Polar baseband eye diagram: random ±1 symbols shaped by a raised-cosine (or
 * rectangular) pulse, AWGN at Eb/N0, sliced into two-symbol traces centred on the
 * sampling instant. Reports the vertical eye opening at the sampling instant.
 */
export function eyeDiagram({ alpha = 0.35, pulse = 'raised-cosine', ebN0dB = 20, symbols = 200, samplesPerSymbol = 16, seed = 5 } = {}) {
  const rolloff = boundedNumber(alpha, 0, 1, 'Roll-off');
  const count = Math.trunc(boundedNumber(symbols, 20, 1000, 'Symbol count'));
  const oversample = Math.trunc(boundedNumber(samplesPerSymbol, 4, 64, 'Samples per symbol'));
  if (!['raised-cosine', 'rectangular'].includes(pulse)) throw new RangeError('Pulse must be raised-cosine or rectangular.');
  const random = createRandom(seed);
  const data = Array.from({ length: count }, () => (random.bit() ? 1 : -1));
  const span = 8;
  const sigma = Math.sqrt(1 / (2 * 10 ** (boundedNumber(ebN0dB, -10, 60, 'Eb/N0 (dB)') / 10)));
  const length = count * oversample;
  const waveform = new Array(length).fill(0);
  for (let k = 0; k < count; k += 1) {
    for (let offset = -span * oversample; offset <= span * oversample; offset += 1) {
      const n = k * oversample + offset;
      if (n < 0 || n >= length) continue;
      const t = offset / oversample;
      waveform[n] += data[k] * (pulse === 'rectangular' ? (t >= -0.5 && t < 0.5 ? 1 : 0) : raisedCosine(t, rolloff));
    }
  }
  for (let n = 0; n < length; n += 1) waveform[n] += sigma * random.gaussian();
  const traces = [];
  let minimumOne = Infinity, maximumZero = -Infinity;
  for (let k = span; k < count - span - 1; k += 1) {
    // Two symbol periods centred on the sampling instant k·T.
    traces.push(Array.from({ length: 2 * oversample + 1 }, (_, n) => waveform[(k - 1) * oversample + n] ?? 0));
    const sample = waveform[k * oversample];
    if (data[k] > 0) minimumOne = Math.min(minimumOne, sample); else maximumZero = Math.max(maximumZero, sample);
  }
  return { kind: 'eye-diagram', pulse, alpha: rolloff, samplesPerSymbol: oversample, traces: traces.slice(0, 150), opening: Math.max(0, minimumOne - maximumZero) / 2, sigma };
}
