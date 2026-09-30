import test from 'node:test';
import assert from 'node:assert/strict';
import { digitalSignalGroups, filterDigitalSignals, measureDigitalCursors, normalizeDigitalWaveformView, sampleDigitalSignal, serializeDigitalCsv, transformDigitalWaveformView } from '../src/core/digital-waveform-view.js';

const trace = { kind: 'digital-trace', timescale: '1 ns', signals: [
  { id: '!', name: 'clk', fullName: 'tb.clk', scope: 'tb', width: 1, samples: [{ time: 0, value: '0' }, { time: 10, value: '1' }, { time: 20, value: '0' }, { time: 30, value: '1' }] },
  { id: '"', name: 'count', fullName: 'tb.dut.count', scope: 'tb.dut', width: 4, samples: [{ time: 0, value: '0000' }, { time: 20, value: '0001' }, { time: 30, value: '0010' }] }
] };

test('digital waveform view clamps time windows and discovers scopes', () => {
  assert.deepEqual(digitalSignalGroups(trace), ['tb', 'tb.dut']);
  assert.deepEqual(normalizeDigitalWaveformView(trace, { startTime: -1, endTime: 99, cursorA: -2, cursorB: 44, group: 'missing', query: 'count' }), { startTime: 0, endTime: 30, cursorA: 0, cursorB: 30, group: 'all', query: 'count' });
  assert.deepEqual(filterDigitalSignals(trace, { group: 'tb.dut', query: 'COUNT' }).map((signal) => signal.name), ['count']);
});

test('digital waveform zoom and pan remain inside the trace', () => {
  const zoomed = transformDigitalWaveformView(trace, {}, 'zoom-in');
  assert.deepEqual([zoomed.startTime, zoomed.endTime], [8, 23]);
  assert.deepEqual([transformDigitalWaveformView(trace, zoomed, 'pan-right').startTime, transformDigitalWaveformView(trace, zoomed, 'pan-right').endTime], [11, 26]);
  assert.throws(() => transformDigitalWaveformView(trace, {}, 'reset'), /Unsupported/);
});

test('digital cursor sampling retains values between transitions', () => {
  assert.equal(sampleDigitalSignal(trace.signals[1], 25), '0001');
  assert.equal(sampleDigitalSignal({ samples: [{ time: 5, value: '1' }] }, 2), '—');
  const measurement = measureDigitalCursors(trace, { cursorA: 10, cursorB: 25, group: 'tb.dut' });
  assert.equal(measurement.deltaTime, 15);
  assert.deepEqual(measurement.values, [{ id: '"', fullName: 'tb.dut.count', a: '0000', b: '0001' }]);
});

test('digital waveform CSV export is bounded and carries vector values', () => {
  assert.equal(serializeDigitalCsv(trace, { startTime: 0, endTime: 20, group: 'tb.dut' }), 'time,tb.dut.count\n0,0000\n20,0001\n');
  assert.throws(() => serializeDigitalCsv({ kind: 'digital-trace', signals: [] }), /non-empty/);
});
