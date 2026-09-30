import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCanvasView, screenToCanvas, snapCanvasPoint, zoomCanvasView } from '../src/core/canvas.js';

test('canvas zoom preserves the world point under the cursor', () => {
  const view = zoomCanvasView({ x: 10, y: 20, scale: 1 }, 2, { x: 110, y: 120 });
  assert.deepEqual(screenToCanvas({ x: 110, y: 120 }, view), { x: 100, y: 100 });
});

test('fit computes a bounded view around component extents', () => {
  const view = fitCanvasView([{ x: 100, y: 100 }, { x: 500, y: 300 }], { width: 800, height: 500 });
  assert.ok(view.scale >= 0.5 && view.scale <= 2.5);
  assert.deepEqual(screenToCanvas({ x: view.x + 100 * view.scale, y: view.y + 100 * view.scale }, view), { x: 100, y: 100 });
});

test('grid snapping is deterministic and bypasses invalid grid sizes', () => {
  assert.deepEqual(snapCanvasPoint({ x: 31, y: 49 }), { x: 40, y: 40 });
  assert.deepEqual(snapCanvasPoint({ x: 31, y: 49 }, 10), { x: 30, y: 50 });
  assert.deepEqual(snapCanvasPoint({ x: 31, y: 49 }, 0), { x: 31, y: 49 });
});
