import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateReferences } from '../packages/schematic/src/annotation.mjs';

test('reference annotation is deterministic, collision-free, and preserves custom labels', () => {
  const source = [
    { id: 'R9', type: 'resistor', label: 'R9', value: 1 },
    { id: 'R2', type: 'resistor', label: 'sense', value: 2 },
    { id: 'X1', type: 'mystery', label: 'X1', value: 3 }
  ];
  const result = annotateReferences(source);
  assert.deepEqual(result.components.map((part) => part.id), ['R1', 'R2', 'X1']);
  assert.equal(result.components[0].label, 'R1');
  assert.equal(result.components[1].label, 'sense');
  assert.equal(result.renames.get('R9'), 'R1');
  assert.deepEqual(source[0], { id: 'R9', type: 'resistor', label: 'R9', value: 1 });
});
