import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSketchSource } from '../packages/firmware/src/index.mjs';

test('firmware structure analysis reports source-linked missing functions and braces', () => {
  const report = analyzeSketchSource('void setup() {\n\n');
  assert.equal(report.kind, 'firmware-structure-report');
  assert.ok(report.diagnostics.some((diagnostic) => diagnostic.code === 'FIRMWARE_LOOP_MISSING'));
  assert.ok(report.diagnostics.some((diagnostic) => diagnostic.code === 'FIRMWARE_BRACE_UNBALANCED'));
  assert.ok(report.diagnostics.every((diagnostic) => Number.isInteger(diagnostic.line)));
});

test('firmware structure analysis accepts a minimal sketch and bounds source', () => {
  assert.equal(analyzeSketchSource('void setup() {}\nvoid loop() {}').diagnostics.length, 0);
  assert.throws(() => analyzeSketchSource('x'.repeat(1_000_001)), /size limit/);
});
