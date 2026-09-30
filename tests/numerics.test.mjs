import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWindow, convolve, correlate, createSignal, fft, filterFir, generateSine, resample, seededNoise, MAX_N2_OPERATIONS } from '../packages/numerics/src/index.mjs';
import { createNumericalWorkerClient } from '../packages/numerics/src/worker-client.mjs';

function fakeTransport({ response, delay = 0 } = {}) {
  let lineHandler = () => {}; let exitHandler = () => {}; let terminated = false;
  return {
    send: () => { if (response !== undefined) setTimeout(() => { if (!terminated) lineHandler(response); }, delay); },
    onLine: (handler) => { lineHandler = handler; }, onExit: (handler) => { exitHandler = handler; },
    terminate: () => { terminated = true; }, crash: (error = new Error('crashed')) => exitHandler(error)
  };
}

test('signal metadata and seeded noise are deterministic', () => {
  const first = seededNoise(8, { seed: 42, amplitude: 0.5, sampleRate: 1000, units: 'V' });
  const second = seededNoise(8, { seed: 42, amplitude: 0.5, sampleRate: 1000, units: 'V' });
  assert.deepEqual(Array.from(first.data), Array.from(second.data));
  assert.equal(first.sampleRate, 1000);
  assert.equal(first.units, 'V');
});

test('sine generation and convolution preserve declared sampling metadata', () => {
  const sine = generateSine({ frequency: 10, amplitude: 2, sampleRate: 100, length: 4 });
  assert.equal(sine.data[0], 0);
  const filtered = convolve(sine, [0.5, 0.5]);
  assert.equal(filtered.kind, 'time-series');
  assert.equal(filtered.sampleRate, 100);
  assert.equal(filtered.data.length, 5);
});

test('DFT returns expected DC and Nyquist components with bounded input', () => {
  const result = fft(createSignal([1, 1, 1, 1], { sampleRate: 4, units: 'V' }));
  assert.ok(Math.abs(result.real[0] - 4) < 1e-12);
  assert.ok(result.real.slice(1).every((value) => Math.abs(value) < 1e-12));
  assert.equal(result.frequencies[1], 1);
  assert.throws(() => fft(new Float64Array(4097)), /supports/);
});

test('windowing, correlation, and resampling preserve bounded numerical metadata', () => {
  const signal = createSignal([1, 1, 1, 1], { sampleRate: 4, units: 'V' });
  const windowed = applyWindow(signal, { window: 'hann' });
  assert.equal(windowed.data[0], 0);
  const correlation = correlate(signal, [1, 1]);
  assert.deepEqual(Array.from(correlation.data), [1, 2, 2, 2, 1]);
  assert.equal(correlation.lagStart, -1);
  const slower = resample(signal, 2);
  assert.equal(slower.sampleRate, 2);
  assert.deepEqual(Array.from(slower.data), [1, 1]);
  assert.throws(() => applyWindow(signal, { window: 'blackman' }), /Window/);
});

test('causal FIR filtering preserves signal metadata and bounds', () => {
  const signal = createSignal([1, 2, 3, 4], { sampleRate: 100, units: 'V' });
  const filtered = filterFir(signal, [0.5, 0.5]);
  assert.equal(filtered.sampleRate, 100);
  assert.equal(filtered.units, 'V');
  assert.deepEqual(Array.from(filtered.data), [0.5, 1.5, 2.5, 3.5]);
  assert.throws(() => filterFir(signal, []), /coefficients/);
});

test('quadratic numerical workloads fail before exceeding the computation budget', () => {
  const size = Math.floor(Math.sqrt(MAX_N2_OPERATIONS)) + 1;
  const left = new Float64Array(size);
  const right = new Float64Array(size);
  const firInput = new Float64Array(Math.floor(MAX_N2_OPERATIONS / 4096) + 1);
  const firCoefficients = new Float64Array(4096);
  assert.throws(() => convolve(left, right), /workload/);
  assert.throws(() => correlate(left, right), /workload/);
  assert.throws(() => filterFir(firInput, firCoefficients), /workload/);
});

test('direct numerical operations reject oversized raw inputs', () => {
  const oversized = new Float64Array(1_000_001);
  assert.throws(() => applyWindow(oversized), /bounded/);
  assert.throws(() => filterFir(oversized, [1]), /bounded/);
  assert.throws(() => resample(oversized, 1), /bounded/);
});

test('numerical worker client validates response envelopes and supports cancellation', async () => {
  const transport = fakeTransport({ response: JSON.stringify({ id: 'one', ok: true, result: { value: 6 } }) });
  const client = createNumericalWorkerClient({ transportFactory: () => transport, timeoutMs: 100 });
  assert.deepEqual(await client.request({ id: 'one', operation: 'generate_sine', args: { length: 1, frequency: 1, sampleRate: 2 } }), { value: 6 });
  const controller = new AbortController(); controller.abort(); await assert.rejects(client.request({ id: 'cancelled', operation: 'window', args: { input: [1] } }, { signal: controller.signal }), (error) => error.code === 'WORKER_CANCELLED');
});

test('numerical worker client reports timeout, protocol failure and worker exit', async () => {
  const timeoutClient = createNumericalWorkerClient({ transportFactory: () => fakeTransport({ response: JSON.stringify({ id: 'late', ok: true, result: {} }), delay: 30 }), timeoutMs: 5 });
  await assert.rejects(timeoutClient.request({ id: 'late', operation: 'window', args: { input: [1] } }), (error) => error.code === 'WORKER_TIMEOUT');
  const malformedClient = createNumericalWorkerClient({ transportFactory: () => fakeTransport({ response: 'not-json' }), timeoutMs: 100 });
  await assert.rejects(malformedClient.request({ id: 'bad', operation: 'window', args: { input: [1] } }), (error) => error.code === 'WORKER_PROTOCOL_INVALID');
  let current; const exitClient = createNumericalWorkerClient({ transportFactory: () => { current = fakeTransport(); return current; }, timeoutMs: 100 });
  const pending = exitClient.request({ id: 'exit', operation: 'window', args: { input: [1] } }); current.crash(); await assert.rejects(pending, (error) => error.code === 'WORKER_EXIT');
});

test('numerical worker client can restart a pending transport', async () => {
  let created = 0; const client = createNumericalWorkerClient({ transportFactory: () => { created += 1; return fakeTransport({ response: JSON.stringify({ id: 'new', ok: true, result: 9 }), delay: 10 }); }, timeoutMs: 100 });
  const pending = client.request({ id: 'old', operation: 'window', args: { input: [1] } }); client.restart(); await assert.rejects(pending, (error) => error.code === 'WORKER_RESTARTED'); assert.equal(created, 2); client.close();
});
