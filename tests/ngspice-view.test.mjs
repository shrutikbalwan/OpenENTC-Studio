import test from 'node:test';
import assert from 'node:assert/strict';
import { measureNgspiceCursors, normalizeNgspiceView, serializeNgspiceCsv, transformNgspiceWindowView } from '../src/core/ngspice-view.js';

const result = { kind: 'table', columns: ['time', 'v(out)', 'v(in)'], rows: Array.from({ length: 8 }, (_, index) => [index * 0.001, index * 2, 5]), units: 'SI' };

test('ngspice waveform view clamps traces, windows, and cursors to real rows', () => {
  assert.deepEqual(normalizeNgspiceView(result, { traceIndex: 99, startIndex: -5, endIndex: 99, cursorA: -1, cursorB: 99 }), { traceIndex: 1, startIndex: 0, endIndex: 7, cursorA: 0, cursorB: 7 });
  assert.deepEqual(measureNgspiceCursors(result, { traceIndex: 1, cursorA: 2, cursorB: 6 }), { xA: 0.002, yA: 4, xB: 0.006, yB: 12, deltaX: 0.004, deltaY: 8 });
});

test('ngspice waveform zoom and pan remain inside the result table', () => {
  const zoomed = transformNgspiceWindowView(result, {}, 'zoom-in');
  assert.deepEqual([zoomed.startIndex, zoomed.endIndex], [2, 5]);
  const right = transformNgspiceWindowView(result, zoomed, 'pan-right');
  assert.deepEqual([right.startIndex, right.endIndex], [3, 6]);
  assert.deepEqual(transformNgspiceWindowView(result, right, 'zoom-out'), { ...right, startIndex: 0, endIndex: 7 });
  assert.throws(() => transformNgspiceWindowView(result, {}, 'reset'), /Unsupported/);
});

test('ngspice CSV export preserves every parsed column and row', () => {
  const csv = serializeNgspiceCsv({ kind: 'table', columns: ['time', 'v,"out"'], rows: [[0, 1.25]] });
  assert.equal(csv, 'time,"v,""out"""\n0.00000000000,1.25000000000\n');
  assert.throws(() => serializeNgspiceCsv({ kind: 'table', columns: [], rows: [] }), /non-empty/);
});
