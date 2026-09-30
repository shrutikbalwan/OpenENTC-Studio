import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateComponent, moveComponents, pasteComponent, pasteComponents, rotateComponent, rotateComponents } from '../src/core/circuit-editing.js';
import { componentReferencePrefixes } from '../packages/schematic/src/annotation.mjs';

const parts = [
  { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'a', n2: '0', x: 10, y: 20 },
  { id: 'R2', type: 'resistor', label: 'R2', value: 2000, unit: 'Ω', n1: 'b', n2: '0', x: 30, y: 40 }
];

test('rotation is immutable and wraps at one turn', () => {
  const rotated = rotateComponent(parts, 'R1');
  assert.equal(rotated[0].rotation, 90);
  assert.equal(parts[0].rotation, undefined);
  assert.equal(rotateComponent(rotated, 'R1', 270)[0].rotation, 0);
});

test('multi-selection rotation updates only selected components immutably', () => {
  const rotated = rotateComponents(parts, ['R1', 'R2']);
  assert.deepEqual(rotated.map((part) => part.rotation), [90, 90]);
  assert.equal(parts[0].rotation, undefined);
  assert.equal(rotateComponents(rotated, ['R2'], 270)[1].rotation, 0);
  assert.throws(() => rotateComponent(parts, 'R1', Number.NaN), /finite/);
  assert.throws(() => rotateComponents(parts, ['R1'], Number.POSITIVE_INFINITY), /finite/);
});

test('keyboard movement updates selected components immutably', () => {
  const moved = moveComponents(parts, ['R1', 'R2'], { x: 20, y: -10 });
  assert.deepEqual(moved.map((part) => [part.x, part.y]), [[30, 10], [50, 30]]);
  assert.deepEqual(parts.map((part) => [part.x, part.y]), [[10, 20], [30, 40]]);
  assert.throws(() => moveComponents(parts, ['R1'], { x: Number.NaN, y: 0 }), /finite/);
});

test('duplicate and paste allocate collision-free references and isolate copied nodes', () => {
  const duplicate = duplicateComponent(parts, 'R1');
  assert.equal(duplicate.id, 'R3');
  assert.notEqual(duplicate.components.at(-1).n1, 'a');
  assert.equal(duplicate.components.at(-1).n2, '0');
  assert.equal(duplicate.components.at(-1).x, 38);
  const pasted = pasteComponent(parts, { ...parts[0], id: 'clipboard' });
  assert.equal(pasted.id, 'R3');
  assert.equal(pasted.components.length, 3);
});

test('switch duplication follows the canonical S reference prefix', () => {
  const switchParts = [{ id: 'S1', type: 'switch', label: 'S1', value: 1, unit: 'state', n1: 'a', n2: 'b', x: 10, y: 20 }];
  const duplicate = duplicateComponent(switchParts, 'S1');
  assert.equal(duplicate.id, 'S2');
  assert.equal(duplicate.components.at(-1).label, 'S2');
  assert.equal(componentReferencePrefixes.switch, 'S');
});

test('multi-selection paste preserves the source set and allocates unique references', () => {
  const pasted = pasteComponents(parts, parts);
  assert.deepEqual(pasted.ids, ['R3', 'R4']);
  assert.equal(pasted.components.length, 4);
  assert.deepEqual(pasted.components.slice(-2).map((part) => [part.n1, part.n2]), [['paste_n1', '0'], ['paste_n2', '0']]);
  assert.deepEqual(pasted.nodeMap, { a: 'paste_n1', b: 'paste_n2' });
});
