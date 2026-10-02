// A GNU Radio-style software-defined-radio flowgraph engine. Blocks process whole buffers of
// real or complex samples in topological order; sinks return plot data (scope, spectrum,
// constellation, measurements, BER). Everything is deterministic for a given seed.
import { designFir, FIR_WINDOWS } from '../../numerics/src/filters.mjs';

const MAX_SAMPLES = 1 << 17;

// ---------------------------------------------------------------------------
// Streams: { re: Float64Array, im: Float64Array | null, rate }.

const stream = (re, im, rate) => ({ re, im, rate });
const isComplex = (s) => s.im !== null;
const imag = (s) => s.im ?? new Float64Array(s.re.length);

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gaussian(seed) {
  const random = mulberry32(seed);
  let spare = null;
  return () => { if (spare !== null) { const v = spare; spare = null; return v; } let u = 0; while (u === 0) u = random(); const r = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * random(); spare = r * Math.sin(t); return r * Math.cos(t); };
}

/** Real-coefficient FIR applied to a real or complex stream (zero initial state, same length). */
export function firFilter(taps, s) {
  const n = s.re.length, re = new Float64Array(n), im = isComplex(s) ? new Float64Array(n) : null;
  for (let i = 0; i < n; i += 1) {
    let accRe = 0, accIm = 0;
    for (let k = 0; k < taps.length && k <= i; k += 1) { accRe += taps[k] * s.re[i - k]; if (im) accIm += taps[k] * s.im[i - k]; }
    re[i] = accRe; if (im) im[i] = accIm;
  }
  return stream(re, im, s.rate);
}

/** Root-raised-cosine taps (unit energy), `span` symbols each side, `sps` samples per symbol. */
export function rrcTaps(sps, alpha, span) {
  const n = 2 * span * sps + 1, taps = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = (i - span * sps) / sps;
    let h;
    if (t === 0) h = 1 - alpha + 4 * alpha / Math.PI;
    else if (alpha > 0 && Math.abs(Math.abs(4 * alpha * t) - 1) < 1e-9) h = alpha / Math.SQRT2 * ((1 + 2 / Math.PI) * Math.sin(Math.PI / (4 * alpha)) + (1 - 2 / Math.PI) * Math.cos(Math.PI / (4 * alpha)));
    else h = (Math.sin(Math.PI * t * (1 - alpha)) + 4 * alpha * t * Math.cos(Math.PI * t * (1 + alpha))) / (Math.PI * t * (1 - (4 * alpha * t) ** 2));
    taps[i] = h;
  }
  const energy = Math.sqrt(taps.reduce((sum, v) => sum + v * v, 0));
  return taps.map((v) => v / energy);
}

export const CONSTELLATIONS = Object.freeze({
  bpsk: { label: 'BPSK', bits: 1, points: [[-1, 0], [1, 0]] },
  // Gray-coded QPSK: 00, 01, 11, 10 counter-clockwise from 45°.
  qpsk: { label: 'QPSK (Gray)', bits: 2, points: [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([i, q]) => [i / Math.SQRT2, q / Math.SQRT2]) },
  '8psk': { label: '8-PSK (Gray)', bits: 3, points: [0, 1, 3, 2, 7, 6, 4, 5].map((_, k, gray) => gray.indexOf(k)).map((k) => [Math.cos(2 * Math.PI * k / 8), Math.sin(2 * Math.PI * k / 8)]) },
  '16qam': { label: '16-QAM (Gray)', bits: 4, points: Array.from({ length: 16 }, (_, s) => { const g = [-3, -1, 3, 1]; return [g[s >> 2] / Math.sqrt(10), g[s & 3] / Math.sqrt(10)]; }) },
});

const nearestSymbol = (points, re, im) => { let best = 0, bestDistance = Infinity; points.forEach(([i, q], k) => { const d = (re - i) ** 2 + (im - q) ** 2; if (d < bestDistance) { bestDistance = d; best = k; } }); return best; };

function fftComplex(reInput, imInput) {
  const n = reInput.length, re = Float64Array.from(reInput), im = Float64Array.from(imInput);
  for (let i = 1, j = 0; i < n; i += 1) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) for (let k = 0; k < size / 2; k += 1) {
      const wr = Math.cos(angle * k), wi = Math.sin(angle * k), a = start + k, b = a + size / 2;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
  return { re, im };
}

/** Averaged (Welch, 50 % overlap) power spectrum in dB; complex streams give −fs/2…fs/2. */
export function powerSpectrum(s, { size = 1024, window = 'hann' } = {}) {
  const n = Math.min(size, 1 << Math.floor(Math.log2(Math.max(2, s.re.length))));
  const w = Float64Array.from({ length: n }, (_, k) => (window === 'rectangular' ? 1 : 0.5 - 0.5 * Math.cos(2 * Math.PI * k / n)));
  const gain = w.reduce((sum, v) => sum + v, 0);
  const power = new Float64Array(n);
  let segments = 0;
  for (let start = 0; start + n <= s.re.length; start += n / 2) {
    const spec = fftComplex(Float64Array.from({ length: n }, (_, k) => s.re[start + k] * w[k]), Float64Array.from({ length: n }, (_, k) => (s.im ? s.im[start + k] : 0) * w[k]));
    for (let k = 0; k < n; k += 1) power[k] += (spec.re[k] ** 2 + spec.im[k] ** 2) / (gain * gain);
    segments += 1;
  }
  const complexInput = isComplex(s);
  const bins = complexInput ? Array.from({ length: n }, (_, k) => (k + n / 2) % n) : Array.from({ length: n / 2 + 1 }, (_, k) => k);
  return {
    frequency: bins.map((k) => (k >= n / 2 && complexInput ? k - n : k) * s.rate / n),
    db: bins.map((k) => 10 * Math.log10(Math.max(1e-20, power[k] / Math.max(1, segments) * (complexInput || k === 0 || k === n / 2 ? 1 : 2)))),
    size: n, segments,
  };
}

// ---------------------------------------------------------------------------
// Block catalogue.

const p = (key, label, value, extra = {}) => ({ key, label, value, ...extra });
const yesNo = [['no', 'real'], ['yes', 'complex']];
const one = (fn) => (inputs, params, ctx) => [fn(inputs[0], params, ctx)];
const requireInputs = (inputs, count, label) => { for (let k = 0; k < count; k += 1) if (!inputs[k]) throw new RangeError(`${label}: input ${k + 1} is not connected.`); };
const sameRate = (a, b, label) => { if (a.rate !== b.rate) throw new RangeError(`${label}: inputs run at ${a.rate} and ${b.rate} samples/s — resample one of them.`); };
const map2 = (a, b, fnRe, fnIm) => {
  const n = Math.min(a.re.length, b.re.length), re = new Float64Array(n), complexOut = isComplex(a) || isComplex(b), im = complexOut ? new Float64Array(n) : null;
  const ai = imag(a), bi = imag(b);
  for (let i = 0; i < n; i += 1) { re[i] = fnRe(a.re[i], ai[i], b.re[i], bi[i]); if (im) im[i] = fnIm(a.re[i], ai[i], b.re[i], bi[i]); }
  return stream(re, im, a.rate);
};

export const BLOCKS = Object.freeze({
  // Sources --------------------------------------------------------------
  'signal-source': {
    label: 'Signal source', category: 'Sources', inputs: [], outputs: ['out'],
    params: [p('waveform', 'Waveform', 'cos', { options: [['cos', 'Cosine'], ['complex', 'Complex exponential'], ['square', 'Square'], ['triangle', 'Triangle'], ['saw', 'Sawtooth'], ['constant', 'Constant']] }), p('frequency', 'Frequency', 1000, { unit: 'Hz' }), p('amplitude', 'Amplitude', 1), p('offset', 'Offset', 0), p('phase', 'Phase', 0, { unit: '°' })],
    run: (_, params, ctx) => {
      const n = ctx.samples, re = new Float64Array(n), complexOut = params.waveform === 'complex', im = complexOut ? new Float64Array(n) : null;
      for (let i = 0; i < n; i += 1) {
        const cycles = params.frequency * i / ctx.sampleRate + params.phase / 360, frac = cycles - Math.floor(cycles), angle = 2 * Math.PI * cycles;
        let v;
        switch (params.waveform) {
          case 'square': v = frac < 0.5 ? 1 : -1; break;
          case 'triangle': v = 1 - 4 * Math.abs(frac - 0.5); break;
          case 'saw': v = 2 * frac - 1; break;
          case 'constant': v = 1; break;
          default: v = Math.cos(angle);
        }
        re[i] = params.offset + params.amplitude * v;
        if (im) im[i] = params.amplitude * Math.sin(angle);
      }
      return [stream(re, im, ctx.sampleRate)];
    },
  },
  'noise-source': {
    label: 'Noise source', category: 'Sources', inputs: [], outputs: ['out'],
    params: [p('distribution', 'Distribution', 'gaussian', { options: [['gaussian', 'Gaussian'], ['uniform', 'Uniform']] }), p('amplitude', 'Amplitude (σ or peak)', 0.1), p('complex', 'Type', 'no', { options: yesNo }), p('seed', 'Seed', 1)],
    run: (_, params, ctx) => {
      const g = gaussian(Math.round(params.seed)), u = mulberry32(Math.round(params.seed) + 17), n = ctx.samples;
      const draw = () => (params.distribution === 'uniform' ? (2 * u() - 1) : g()) * params.amplitude * (params.complex === 'yes' ? Math.SQRT1_2 : 1);
      const re = Float64Array.from({ length: n }, draw), im = params.complex === 'yes' ? Float64Array.from({ length: n }, draw) : null;
      return [stream(re, im, ctx.sampleRate)];
    },
  },
  'random-symbols': {
    label: 'Random symbols', category: 'Sources', inputs: [], outputs: ['out'],
    params: [p('count', 'Alphabet size M', 4), p('symbolRate', 'Symbol rate', 1000, { unit: 'sym/s' }), p('seed', 'Seed', 42)],
    run: (_, params, ctx) => {
      const random = mulberry32(Math.round(params.seed)), symbols = Math.max(1, Math.floor(ctx.samples * params.symbolRate / ctx.sampleRate));
      return [stream(Float64Array.from({ length: symbols }, () => Math.floor(random() * Math.max(2, Math.round(params.count)))), null, params.symbolRate)];
    },
  },
  // Math ------------------------------------------------------------------
  add: { label: 'Add', category: 'Math', inputs: ['in0', 'in1'], outputs: ['out'], params: [], run: (inputs) => { requireInputs(inputs, 2, 'Add'); sameRate(inputs[0], inputs[1], 'Add'); return [map2(inputs[0], inputs[1], (ar, ai, br) => ar + br, (ar, ai, br, bi) => ai + bi)]; } },
  subtract: { label: 'Subtract', category: 'Math', inputs: ['in0', 'in1'], outputs: ['out'], params: [], run: (inputs) => { requireInputs(inputs, 2, 'Subtract'); sameRate(inputs[0], inputs[1], 'Subtract'); return [map2(inputs[0], inputs[1], (ar, ai, br) => ar - br, (ar, ai, br, bi) => ai - bi)]; } },
  multiply: { label: 'Multiply', category: 'Math', inputs: ['in0', 'in1'], outputs: ['out'], params: [], run: (inputs) => { requireInputs(inputs, 2, 'Multiply'); sameRate(inputs[0], inputs[1], 'Multiply'); return [map2(inputs[0], inputs[1], (ar, ai, br, bi) => ar * br - ai * bi, (ar, ai, br, bi) => ar * bi + ai * br)]; } },
  'multiply-const': {
    label: 'Multiply const', category: 'Math', inputs: ['in'], outputs: ['out'], params: [p('gain', 'Gain', 1), p('phase', 'Phase', 0, { unit: '°' })],
    run: one((s, params) => {
      const c = Math.cos(params.phase * Math.PI / 180) * params.gain, d = Math.sin(params.phase * Math.PI / 180) * params.gain, complexOut = isComplex(s) || Math.abs(d) > 1e-15;
      const si = imag(s), re = s.re.map((v, i) => v * c - si[i] * d), im = complexOut ? s.re.map((v, i) => v * d + si[i] * c) : null;
      return stream(Float64Array.from(re), im ? Float64Array.from(im) : null, s.rate);
    }),
  },
  'add-const': { label: 'Add const', category: 'Math', inputs: ['in'], outputs: ['out'], params: [p('value', 'Value', 1)], run: one((s, params) => stream(s.re.map((v) => v + params.value), s.im ? Float64Array.from(s.im) : null, s.rate)) },
  conjugate: { label: 'Conjugate', category: 'Math', inputs: ['in'], outputs: ['out'], params: [], run: one((s) => stream(Float64Array.from(s.re), imag(s).map((v) => -v), s.rate)) },
  'complex-to-mag': { label: 'Complex → magnitude', category: 'Math', inputs: ['in'], outputs: ['out'], params: [], run: one((s) => { const si = imag(s); return stream(s.re.map((v, i) => Math.hypot(v, si[i])), null, s.rate); }) },
  'complex-to-arg': { label: 'Complex → phase', category: 'Math', inputs: ['in'], outputs: ['out'], params: [], run: one((s) => { const si = imag(s); return stream(s.re.map((v, i) => Math.atan2(si[i], v)), null, s.rate); }) },
  'complex-to-real': { label: 'Complex → real/imag', category: 'Math', inputs: ['in'], outputs: ['re', 'im'], params: [], run: (inputs) => { requireInputs(inputs, 1, 'Complex to real'); const s = inputs[0]; return [stream(Float64Array.from(s.re), null, s.rate), stream(Float64Array.from(imag(s)), null, s.rate)]; } },
  'float-to-complex': { label: 'Real/imag → complex', category: 'Math', inputs: ['re', 'im'], outputs: ['out'], params: [], run: (inputs) => { requireInputs(inputs, 1, 'Float to complex'); const a = inputs[0], b = inputs[1]; if (b) sameRate(a, b, 'Float to complex'); const n = b ? Math.min(a.re.length, b.re.length) : a.re.length; return [stream(a.re.slice(0, n), b ? b.re.slice(0, n) : new Float64Array(n), a.rate)]; } },
  // Filters ----------------------------------------------------------------
  'fir-filter': {
    label: 'FIR filter', category: 'Filters', inputs: ['in'], outputs: ['out'],
    params: [p('type', 'Response', 'lowpass', { options: [['lowpass', 'Low-pass'], ['highpass', 'High-pass'], ['bandpass', 'Band-pass'], ['bandstop', 'Band-stop']] }), p('cutoff', 'Cut-off / low edge', 2000, { unit: 'Hz' }), p('high', 'High edge (band)', 4000, { unit: 'Hz' }), p('taps', 'Taps', 101), p('window', 'Window', 'hamming', { options: FIR_WINDOWS.map((w) => [w, w]) }), p('decimation', 'Decimation', 1)],
    run: one((s, params) => {
      const band = params.type === 'bandpass' || params.type === 'bandstop';
      let taps = Math.round(params.taps); if ((params.type === 'highpass' || params.type === 'bandstop') && taps % 2 === 0) taps += 1;
      const design = designFir({ type: params.type, taps, cutoff: band ? [params.cutoff, params.high] : params.cutoff, sampleRate: s.rate, window: params.window });
      const filtered = firFilter(design.b, s), m = Math.max(1, Math.round(params.decimation));
      if (m === 1) return filtered;
      return stream(filtered.re.filter((_, i) => i % m === 0), filtered.im ? filtered.im.filter((_, i) => i % m === 0) : null, s.rate / m);
    }),
  },
  'moving-average': { label: 'Moving average', category: 'Filters', inputs: ['in'], outputs: ['out'], params: [p('length', 'Length', 16)], run: one((s, params) => { const n = Math.max(1, Math.round(params.length)); return firFilter(new Float64Array(n).fill(1 / n), s); }) },
  'dc-blocker': { label: 'DC blocker', category: 'Filters', inputs: ['in'], outputs: ['out'], params: [p('pole', 'Pole α', 0.995)], run: one((s, params) => { const run = (x) => { const y = new Float64Array(x.length); for (let i = 0; i < x.length; i += 1) y[i] = x[i] - (i ? x[i - 1] : 0) + params.pole * (i ? y[i - 1] : 0); return y; }; return stream(run(s.re), s.im ? run(s.im) : null, s.rate); }) },
  decimate: { label: 'Keep 1 in N', category: 'Filters', inputs: ['in'], outputs: ['out'], params: [p('factor', 'N', 4), p('offset', 'Offset', 0)], run: one((s, params) => { const n = Math.max(1, Math.round(params.factor)), o = Math.max(0, Math.round(params.offset)) % n; return stream(s.re.filter((_, i) => i % n === o), s.im ? s.im.filter((_, i) => i % n === o) : null, s.rate / n); }) },
  interpolate: { label: 'Upsample (zero-stuff)', category: 'Filters', inputs: ['in'], outputs: ['out'], params: [p('factor', 'L', 4), p('hold', 'Fill', 'zero', { options: [['zero', 'zeros'], ['hold', 'repeat (hold)']] })], run: one((s, params) => { const L = Math.max(1, Math.round(params.factor)); const up = (x) => { const y = new Float64Array(x.length * L); x.forEach((v, i) => { for (let k = 0; k < L; k += 1) y[i * L + k] = params.hold === 'hold' || k === 0 ? v : 0; }); return y; }; return stream(up(s.re), s.im ? up(s.im) : null, s.rate * L); }) },
  delay: { label: 'Delay', category: 'Filters', inputs: ['in'], outputs: ['out'], params: [p('samples', 'Samples', 10)], run: one((s, params) => { const d = Math.max(0, Math.round(params.samples)); const shift = (x) => { const y = new Float64Array(x.length); for (let i = d; i < x.length; i += 1) y[i] = x[i - d]; return y; }; return stream(shift(s.re), s.im ? shift(s.im) : null, s.rate); }) },
  // Modulation --------------------------------------------------------------
  'frequency-shift': { label: 'Frequency shift (mixer)', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('frequency', 'Shift', -1000, { unit: 'Hz' })], run: one((s, params) => { const si = imag(s), n = s.re.length, re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i += 1) { const a = 2 * Math.PI * params.frequency * i / s.rate, c = Math.cos(a), d = Math.sin(a); re[i] = s.re[i] * c - si[i] * d; im[i] = s.re[i] * d + si[i] * c; } return stream(re, im, s.rate); }) },
  'fm-modulator': { label: 'FM modulator', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('deviation', 'Peak deviation per unit input', 5000, { unit: 'Hz' })], run: one((s, params) => { const n = s.re.length, re = new Float64Array(n), im = new Float64Array(n); let phase = 0; for (let i = 0; i < n; i += 1) { phase += 2 * Math.PI * params.deviation * s.re[i] / s.rate; re[i] = Math.cos(phase); im[i] = Math.sin(phase); } return stream(re, im, s.rate); }) },
  'quadrature-demod': { label: 'Quadrature demod (FM)', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('deviation', 'Deviation for unit output', 5000, { unit: 'Hz' })], run: one((s, params) => { const si = imag(s), n = s.re.length, out = new Float64Array(n), gain = s.rate / (2 * Math.PI * params.deviation); for (let i = 1; i < n; i += 1) out[i] = gain * Math.atan2(si[i] * s.re[i - 1] - s.re[i] * si[i - 1], s.re[i] * s.re[i - 1] + si[i] * si[i - 1]); return stream(out, null, s.rate); }) },
  'symbol-mapper': {
    label: 'Symbol mapper + pulse shaping', category: 'Modulators', inputs: ['in'], outputs: ['out'],
    params: [p('constellation', 'Constellation', 'qpsk', { options: Object.entries(CONSTELLATIONS).map(([id, c]) => [id, c.label]) }), p('sps', 'Samples per symbol', 8), p('pulse', 'Pulse', 'rrc', { options: [['rrc', 'Root raised cosine'], ['rect', 'Rectangular']] }), p('alpha', 'Roll-off α', 0.35), p('span', 'RRC span (symbols each side)', 6)],
    run: one((s, params, ctx) => {
      const points = CONSTELLATIONS[params.constellation].points, sps = Math.max(1, Math.round(params.sps));
      const symbols = Array.from(s.re, (v) => Math.max(0, Math.min(points.length - 1, Math.round(v))));
      const upRe = new Float64Array(symbols.length * sps), upIm = new Float64Array(symbols.length * sps);
      symbols.forEach((sym, i) => { if (params.pulse === 'rect') for (let k = 0; k < sps; k += 1) { upRe[i * sps + k] = points[sym][0]; upIm[i * sps + k] = points[sym][1]; } else { upRe[i * sps] = points[sym][0] * Math.sqrt(sps); upIm[i * sps] = points[sym][1] * Math.sqrt(sps); } });
      const shaped = params.pulse === 'rect' ? stream(upRe, upIm, s.rate * sps) : firFilter(rrcTaps(sps, params.alpha, Math.round(params.span)), stream(upRe, upIm, s.rate * sps));
      void ctx;
      return shaped;
    }),
  },
  'matched-filter': { label: 'RRC matched filter', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('sps', 'Samples per symbol', 8), p('alpha', 'Roll-off α', 0.35), p('span', 'Span', 6)], run: one((s, params) => { const sps = Math.max(1, Math.round(params.sps)), out = firFilter(rrcTaps(sps, params.alpha, Math.round(params.span)), s); return stream(out.re.map((v) => v / Math.sqrt(sps)), out.im ? out.im.map((v) => v / Math.sqrt(sps)) : null, s.rate); }) },
  'symbol-sampler': { label: 'Symbol sampler', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('sps', 'Samples per symbol', 8), p('offset', 'Sample offset (delay)', 96)], run: one((s, params) => { const sps = Math.max(1, Math.round(params.sps)), o = Math.max(0, Math.round(params.offset)), re = [], im = []; const si = imag(s); for (let i = o; i < s.re.length; i += sps) { re.push(s.re[i]); im.push(si[i]); } return stream(Float64Array.from(re), Float64Array.from(im), s.rate / sps); }) },
  slicer: { label: 'Decision (slicer)', category: 'Modulators', inputs: ['in'], outputs: ['out'], params: [p('constellation', 'Constellation', 'qpsk', { options: Object.entries(CONSTELLATIONS).map(([id, c]) => [id, c.label]) })], run: one((s, params) => { const points = CONSTELLATIONS[params.constellation].points, si = imag(s); return stream(s.re.map((v, i) => nearestSymbol(points, v, si[i])), null, s.rate); }) },
  // Channel ------------------------------------------------------------------
  channel: {
    label: 'Channel model', category: 'Channel', inputs: ['in'], outputs: ['out'],
    params: [p('noise', 'Noise voltage (σ per complex sample)', 0.1), p('frequencyOffset', 'Frequency offset', 0, { unit: 'Hz' }), p('phase', 'Phase offset', 0, { unit: '°' }), p('gain', 'Gain', 1), p('seed', 'Seed', 7)],
    run: one((s, params) => {
      const g = gaussian(Math.round(params.seed)), si = imag(s), n = s.re.length, re = new Float64Array(n), im = new Float64Array(n), sigma = params.noise * Math.SQRT1_2;
      for (let i = 0; i < n; i += 1) { const a = 2 * Math.PI * params.frequencyOffset * i / s.rate + params.phase * Math.PI / 180, c = Math.cos(a) * params.gain, d = Math.sin(a) * params.gain; re[i] = s.re[i] * c - si[i] * d + sigma * g(); im[i] = s.re[i] * d + si[i] * c + sigma * g(); }
      return stream(re, im, s.rate);
    }),
  },
  // Sinks ---------------------------------------------------------------------
  'time-sink': { label: 'Time sink (scope)', category: 'Sinks', inputs: ['in'], outputs: [], params: [p('points', 'Samples shown', 400), p('start', 'Start sample', 0)], sink: true, run: (inputs, params) => { requireInputs(inputs, 1, 'Time sink'); const s = inputs[0], start = Math.max(0, Math.round(params.start)), end = Math.min(s.re.length, start + Math.max(2, Math.round(params.points))); return [{ kind: 'time', rate: s.rate, t: Array.from({ length: end - start }, (_, k) => (start + k) / s.rate), re: Array.from(s.re.slice(start, end)), im: s.im ? Array.from(s.im.slice(start, end)) : null }]; } },
  'freq-sink': { label: 'Frequency sink (FFT)', category: 'Sinks', inputs: ['in'], outputs: [], params: [p('size', 'FFT size', 1024, { options: [[256, '256'], [512, '512'], [1024, '1024'], [2048, '2048'], [4096, '4096']] })], sink: true, run: (inputs, params) => { requireInputs(inputs, 1, 'Frequency sink'); return [{ kind: 'spectrum', ...powerSpectrum(inputs[0], { size: Number(params.size) }), complex: isComplex(inputs[0]) }]; } },
  'constellation-sink': { label: 'Constellation sink', category: 'Sinks', inputs: ['in'], outputs: [], params: [p('skip', 'Skip first', 20), p('points', 'Points', 1000)], sink: true, run: (inputs, params) => { requireInputs(inputs, 1, 'Constellation sink'); const s = inputs[0], si = imag(s), start = Math.min(s.re.length, Math.round(params.skip)), end = Math.min(s.re.length, start + Math.round(params.points)); return [{ kind: 'constellation', re: Array.from(s.re.slice(start, end)), im: Array.from(si.slice(start, end)) }]; } },
  'number-sink': { label: 'Measurement sink', category: 'Sinks', inputs: ['in'], outputs: [], params: [p('skip', 'Skip first', 0)], sink: true, run: (inputs, params) => { requireInputs(inputs, 1, 'Measurement sink'); const s = inputs[0], si = imag(s), start = Math.min(s.re.length - 1, Math.max(0, Math.round(params.skip))); let sum = 0, sumIm = 0, power = 0, peak = 0; const n = s.re.length - start; for (let i = start; i < s.re.length; i += 1) { sum += s.re[i]; sumIm += si[i]; const p2 = s.re[i] ** 2 + si[i] ** 2; power += p2; peak = Math.max(peak, Math.sqrt(p2)); } return [{ kind: 'numbers', samples: n, rate: s.rate, mean: sum / n, meanIm: isComplex(s) ? sumIm / n : null, rms: Math.sqrt(power / n), powerDb: 10 * Math.log10(Math.max(1e-30, power / n)), peak }]; } },
  'ber-sink': {
    label: 'Symbol error counter', category: 'Sinks', inputs: ['sent', 'received'], outputs: [], params: [p('constellation', 'Constellation (for bit errors)', 'qpsk', { options: Object.entries(CONSTELLATIONS).map(([id, c]) => [id, c.label]) }), p('maxLag', 'Search delay up to', 20)], sink: true,
    run: (inputs, params) => {
      requireInputs(inputs, 2, 'Error counter');
      const a = inputs[0].re, b = inputs[1].re, bits = CONSTELLATIONS[params.constellation].bits;
      let best = { lag: 0, errors: Infinity, compared: 0, bitErrors: 0 };
      for (let lag = 0; lag <= Math.round(params.maxLag); lag += 1) {
        const n = Math.min(a.length, b.length - lag) - 2;
        if (n <= 0) break;
        let errors = 0, bitErrors = 0;
        for (let i = 0; i < n; i += 1) if (a[i] !== b[i + lag]) { errors += 1; let x = a[i] ^ b[i + lag]; while (x) { bitErrors += x & 1; x >>= 1; } }
        if (errors / n < best.errors / Math.max(1, best.compared) || best.errors === Infinity) best = { lag, errors, compared: n, bitErrors };
      }
      return [{ kind: 'errors', ...best, ser: best.errors / Math.max(1, best.compared), ber: best.bitErrors / Math.max(1, best.compared * bits) }];
    },
  },
});

// ---------------------------------------------------------------------------
// Graphs.

export function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.blocks) || !Array.isArray(graph.connections)) throw new TypeError('A flowgraph has blocks and connections.');
  if (graph.blocks.length > 64) throw new RangeError('At most 64 blocks.');
  const ids = new Set();
  for (const block of graph.blocks) {
    if (!BLOCKS[block.type]) throw new RangeError(`Unknown block type "${block.type}".`);
    if (ids.has(block.id)) throw new RangeError(`Duplicate block id "${block.id}".`);
    ids.add(block.id);
  }
  const taken = new Set();
  for (const c of graph.connections) {
    const [fromId, fromPort] = c.from.split(':'), [toId, toPort] = c.to.split(':');
    const from = graph.blocks.find((b) => b.id === fromId), to = graph.blocks.find((b) => b.id === toId);
    if (!from || !to || !BLOCKS[from.type].outputs.includes(fromPort) || !BLOCKS[to.type].inputs.includes(toPort)) throw new RangeError(`Connection ${c.from} → ${c.to} refers to a missing port.`);
    if (taken.has(c.to)) throw new RangeError(`Input ${c.to} has two connections.`);
    taken.add(c.to);
  }
  return graph;
}

export function topologicalOrder(graph) {
  const indegree = new Map(graph.blocks.map((b) => [b.id, 0])), edges = new Map(graph.blocks.map((b) => [b.id, []]));
  for (const c of graph.connections) { const from = c.from.split(':')[0], to = c.to.split(':')[0]; edges.get(from).push(to); indegree.set(to, indegree.get(to) + 1); }
  const queue = graph.blocks.filter((b) => indegree.get(b.id) === 0).map((b) => b.id), order = [];
  while (queue.length) { const id = queue.shift(); order.push(id); for (const next of edges.get(id)) { indegree.set(next, indegree.get(next) - 1); if (!indegree.get(next)) queue.push(next); } }
  if (order.length !== graph.blocks.length) throw new RangeError('The flowgraph has a loop — feedback is not supported.');
  return order;
}

export const blockParams = (block) => Object.fromEntries(BLOCKS[block.type].params.map((param) => [param.key, block.params?.[param.key] ?? param.value]));

/** Run every block; returns per-block outputs, sink results and per-block errors. */
export function runFlowgraph(graph, { sampleRate = 48_000, samples = 8192 } = {}) {
  validateGraph(graph);
  if (!(sampleRate > 0) || !(samples >= 16 && samples <= MAX_SAMPLES)) throw new RangeError(`Samples must be 16–${MAX_SAMPLES} and the sample rate positive.`);
  const order = topologicalOrder(graph), outputs = new Map(), sinks = {}, errors = {};
  const ctx = { sampleRate, samples };
  for (const id of order) {
    const block = graph.blocks.find((b) => b.id === id), def = BLOCKS[block.type];
    const inputs = def.inputs.map((port) => { const c = graph.connections.find((x) => x.to === `${id}:${port}`); if (!c) return null; const [fromId, fromPort] = c.from.split(':'); return outputs.get(fromId)?.[BLOCKS[graph.blocks.find((b) => b.id === fromId).type].outputs.indexOf(fromPort)] ?? null; });
    if (def.inputs.length && inputs.some((input, k) => input === null && graph.connections.some((x) => x.to === `${id}:${def.inputs[k]}`))) { errors[id] = 'an upstream block failed'; continue; }
    try {
      const result = def.run(inputs, blockParams(block), ctx);
      if (def.sink) sinks[id] = result[0];
      else {
        for (const s of result) if (s.re.length > MAX_SAMPLES * 4) throw new RangeError('Output too long — reduce interpolation.');
        outputs.set(id, result);
      }
    } catch (error) { errors[id] = error.message; }
  }
  const rates = Object.fromEntries([...outputs].map(([id, list]) => [id, list.map((s) => ({ rate: s.rate, length: s.re.length, complex: isComplex(s) }))]));
  return { sinks, errors, rates, order };
}

// ---------------------------------------------------------------------------
// Example flowgraphs.

const block = (id, type, x, y, params = {}) => ({ id, type, x, y, params });
export const SDR_EXAMPLES = Object.freeze({
  fm: {
    label: 'FM transmitter → noisy channel → FM receiver', sampleRate: 48_000, samples: 8192,
    blocks: [block('tone', 'signal-source', 20, 30, { frequency: 500, amplitude: 1 }), block('fm', 'fm-modulator', 220, 30, { deviation: 5000 }), block('ch', 'channel', 420, 30, { noise: 0.05 }), block('demod', 'quadrature-demod', 620, 30, { deviation: 5000 }), block('lpf', 'fir-filter', 620, 170, { cutoff: 2000, taps: 101 }), block('scope', 'time-sink', 820, 170, { points: 600, start: 200 }), block('spec', 'freq-sink', 420, 200, {}), block('meter', 'number-sink', 820, 30, { skip: 200 })],
    connections: [['tone:out', 'fm:in'], ['fm:out', 'ch:in'], ['ch:out', 'demod:in'], ['demod:out', 'lpf:in'], ['lpf:out', 'scope:in'], ['ch:out', 'spec:in'], ['demod:out', 'meter:in']],
  },
  am: {
    label: 'AM: carrier × (1 + m·message), envelope detection', sampleRate: 48_000, samples: 8192,
    blocks: [block('msg', 'signal-source', 20, 30, { frequency: 300, amplitude: 0.6 }), block('dc', 'add-const', 220, 30, { value: 1 }), block('carrier', 'signal-source', 20, 170, { frequency: 6000 }), block('mix', 'multiply', 420, 80), block('env', 'complex-to-mag', 620, 30), block('lpf', 'fir-filter', 820, 30, { cutoff: 1000, taps: 101 }), block('scope', 'time-sink', 620, 200, { points: 800 }), block('spec', 'freq-sink', 820, 200, {}), block('out', 'time-sink', 1010, 110, { points: 800, start: 100 })],
    connections: [['msg:out', 'dc:in'], ['dc:out', 'mix:in0'], ['carrier:out', 'mix:in1'], ['mix:out', 'env:in'], ['env:out', 'lpf:in'], ['mix:out', 'scope:in'], ['mix:out', 'spec:in'], ['lpf:out', 'out:in']],
  },
  qpsk: {
    label: 'QPSK with RRC pulses, AWGN, matched filter and error count', sampleRate: 8000, samples: 16384,
    blocks: [block('src', 'random-symbols', 20, 30, { count: 4, symbolRate: 1000 }), block('map', 'symbol-mapper', 220, 30, { constellation: 'qpsk', sps: 8 }), block('ch', 'channel', 420, 30, { noise: 0.3 }), block('mf', 'matched-filter', 620, 30, { sps: 8 }), block('samp', 'symbol-sampler', 820, 30, { sps: 8, offset: 96 }), block('dec', 'slicer', 820, 170, { constellation: 'qpsk' }), block('ber', 'ber-sink', 620, 200, { constellation: 'qpsk' }), block('const', 'constellation-sink', 1010, 30, {}), block('spec', 'freq-sink', 420, 200, {})],
    connections: [['src:out', 'map:in'], ['map:out', 'ch:in'], ['ch:out', 'mf:in'], ['mf:out', 'samp:in'], ['samp:out', 'dec:in'], ['src:out', 'ber:sent'], ['dec:out', 'ber:received'], ['samp:out', 'const:in'], ['ch:out', 'spec:in']],
  },
  mixer: {
    label: 'Two stations, a mixer and a channel filter (superhet idea)', sampleRate: 48_000, samples: 8192,
    blocks: [block('s1', 'signal-source', 20, 30, { waveform: 'complex', frequency: 6000, amplitude: 1 }), block('s2', 'signal-source', 20, 170, { waveform: 'complex', frequency: 9000, amplitude: 0.5 }), block('sum', 'add', 220, 90), block('mix', 'frequency-shift', 420, 90, { frequency: -6000 }), block('lpf', 'fir-filter', 620, 90, { cutoff: 1500, taps: 151 }), block('before', 'freq-sink', 420, 230, {}), block('after', 'freq-sink', 820, 90, {})],
    connections: [['s1:out', 'sum:in0'], ['s2:out', 'sum:in1'], ['sum:out', 'mix:in'], ['mix:out', 'lpf:in'], ['sum:out', 'before:in'], ['lpf:out', 'after:in']],
  },
});

export function exampleGraph(id) {
  const example = SDR_EXAMPLES[id];
  if (!example) throw new RangeError(`Unknown example "${id}".`);
  return { sampleRate: example.sampleRate, samples: example.samples, blocks: example.blocks.map((b) => structuredClone(b)), connections: example.connections.map(([from, to]) => ({ from, to })) };
}
