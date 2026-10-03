import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCKS, exampleGraph, powerSpectrum, rrcTaps, runFlowgraph, SDR_EXAMPLES, validateGraph } from '../packages/sdr/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// scipy.signal.firwin + lfilter on the same signal (tests/fixtures/sdr/scipy-fir.json).
const reference = JSON.parse(readFileSync(new URL('./fixtures/sdr/scipy-fir.json', import.meta.url), 'utf8'));
const graphOf = (blocks, connections) => ({ blocks: blocks.map(([id, type, params = {}]) => ({ id, type, x: 0, y: 0, params })), connections: connections.map(([from, to]) => ({ from, to })) });
const Q = (x) => 0.5 * erfc(x / Math.SQRT2);
function erfc(x) { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : 2 - y; }

test('FIR filter block equals scipy firwin + lfilter', () => {
  const x = Float64Array.from(reference.x);
  for (const [type, entry] of Object.entries(reference.filters)) {
    const params = { type, cutoff: Array.isArray(entry.cutoff) ? entry.cutoff[0] : entry.cutoff, high: Array.isArray(entry.cutoff) ? entry.cutoff[1] : 0, taps: entry.taps, window: 'hamming', decimation: 1 };
    const [out] = BLOCKS['fir-filter'].run([{ re: x, im: null, rate: 48000 }], params, {});
    entry.y.forEach((value, i) => near(out.re[i], value, 1e-12, `${type}[${i}]`));
  }
});

test('RRC pulses: unit energy and zero ISI after the matched filter (Nyquist)', () => {
  const sps = 8, span = 6, taps = rrcTaps(sps, 0.35, span);
  near(taps.reduce((s, v) => s + v * v, 0), 1, 1e-12, 'energy');
  const full = Array.from({ length: 2 * taps.length - 1 }, (_, n) => taps.reduce((s, v, k) => s + (n - k >= 0 && n - k < taps.length ? v * taps[n - k] : 0), 0));
  const centre = taps.length - 1;
  near(full[centre], 1, 1e-12, 'peak');
  for (let m = 1; m <= 4; m += 1) near(full[centre + m * sps], 0, 2e-3, `ISI at ${m} symbols`);
});

test('spectrum puts a tone in the right bin and a mixer moves it', () => {
  const graph = graphOf([['s', 'signal-source', { waveform: 'complex', frequency: 3000 }], ['shift', 'frequency-shift', { frequency: 6000 }], ['a', 'freq-sink', { size: 1024 }], ['b', 'freq-sink', { size: 1024 }]], [['s:out', 'a:in'], ['s:out', 'shift:in'], ['shift:out', 'b:in']]);
  const run = runFlowgraph(graph, { sampleRate: 48000, samples: 8192 });
  const peak = (spec) => spec.frequency[spec.db.indexOf(Math.max(...spec.db))];
  assert.equal(peak(run.sinks.a), 3000); assert.equal(peak(run.sinks.b), 9000);
  near(Math.max(...run.sinks.a.db), 0, 0.01, 'unit complex tone = 0 dB');
  const real = powerSpectrum({ re: Float64Array.from({ length: 4096 }, (_, i) => Math.cos(2 * Math.PI * 1500 * i / 48000)), im: null, rate: 48000 }, { size: 1024 });
  near(Math.max(...real.db), -3.0103, 0.01, 'real cosine of amplitude 1 has power 1/2');
});

test('FM modulate then quadrature-demodulate returns the message', () => {
  const run = runFlowgraph(exampleGraph('fm'), { sampleRate: 48000, samples: 8192 });
  assert.deepEqual(run.errors, {});
  near(run.sinks.meter.rms, Math.SQRT1_2, 0.02, 'demodulated tone RMS');
  const clean = graphOf([['m', 'signal-source', { frequency: 700, amplitude: 0.8 }], ['fm', 'fm-modulator', { deviation: 3000 }], ['d', 'quadrature-demod', { deviation: 3000 }], ['scope', 'time-sink', { points: 300, start: 1 }]], [['m:out', 'fm:in'], ['fm:out', 'd:in'], ['d:out', 'scope:in']]);
  const out = runFlowgraph(clean, { sampleRate: 48000, samples: 512 }).sinks.scope;
  // Phase difference over one sample recovers the input of that sample.
  out.re.forEach((v, k) => near(v, 0.8 * Math.cos(2 * Math.PI * 700 * (k + 1) / 48000), 1e-9, `sample ${k}`));
});

test('QPSK link: symbol error rate follows 2Q(√(Es/N0)) − Q²', () => {
  const graph = exampleGraph('qpsk');
  const noise = 1.5;
  graph.blocks.find((b) => b.id === 'ch').params.noise = noise;
  const run = runFlowgraph(graph, { sampleRate: 8000, samples: 131072 });
  const esN0 = 8 / noise ** 2, q = Q(Math.sqrt(esN0));
  const theory = 2 * q - q * q;
  assert.equal(run.sinks.ber.lag, 0);
  near(run.sinks.ber.ser, theory, 0.25 * theory, 'SER');
  assert.equal(runFlowgraph(exampleGraph('qpsk'), { sampleRate: 8000, samples: 16384 }).sinks.ber.errors, 0, 'clean at low noise');
});

test('every example runs, and bad graphs are rejected', () => {
  for (const id of Object.keys(SDR_EXAMPLES)) assert.deepEqual(runFlowgraph(exampleGraph(id), exampleGraph(id)).errors, {}, id);
  const loop = graphOf([['a', 'add'], ['b', 'multiply-const']], [['a:out', 'b:in'], ['b:out', 'a:in0']]);
  assert.throws(() => runFlowgraph(loop), /loop/);
  assert.throws(() => validateGraph(graphOf([['a', 'signal-source'], ['b', 'time-sink']], [['a:out', 'b:nope']])), /missing port/);
  assert.throws(() => validateGraph(graphOf([['a', 'signal-source'], ['c', 'signal-source'], ['b', 'time-sink']], [['a:out', 'b:in'], ['c:out', 'b:in']])), /two connections/);
  const mismatch = graphOf([['a', 'signal-source'], ['r', 'random-symbols'], ['sum', 'add']], [['a:out', 'sum:in0'], ['r:out', 'sum:in1']]);
  assert.match(runFlowgraph(mismatch).errors.sum, /resample/);
});
