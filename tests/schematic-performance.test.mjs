import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { buildIntermediateNetlist } from '../packages/schematic/src/index.mjs';
import { checkElectricalRules } from '../packages/schematic/src/erc.mjs';
import { buildWireSegments } from '../packages/schematic/src/geometry.mjs';

const REFERENCE_COMPONENTS = 1_000;
const REFERENCE_WIRES = 500;
const MODEL_BUDGET_MS = 1_500;

function referenceSchematic() {
  const components = Array.from({ length: REFERENCE_COMPONENTS }, (_, index) => ({
    id: `R${index + 1}`,
    type: 'resistor',
    label: `R${index + 1}`,
    value: 1_000,
    unit: 'ohm',
    n1: index === 0 ? '0' : `n${index}`,
    n2: `n${index + 1}`,
    x: (index % 50) * 100,
    y: Math.floor(index / 50) * 80,
  }));
  const wires = Array.from({ length: REFERENCE_WIRES }, (_, index) => ({
    from: `n${index * 2 + 1}`,
    to: `n${index * 2 + 2}`,
  }));
  return { components, wires };
}

test('reference-size schematic model operations remain within the declared budget', () => {
  const { components, wires } = referenceSchematic();
  const started = performance.now();
  const diagnostics = checkElectricalRules(components, wires, []);
  const netlist = buildIntermediateNetlist(components, wires, []);
  const segments = buildWireSegments(components, wires);
  const elapsed = performance.now() - started;

  assert.deepEqual(diagnostics, []);
  assert.equal(netlist.elements.length, REFERENCE_COMPONENTS);
  assert.equal(segments.length, REFERENCE_WIRES);
  assert.ok(elapsed <= MODEL_BUDGET_MS, `Reference schematic model operations took ${elapsed.toFixed(1)} ms; budget is ${MODEL_BUDGET_MS} ms.`);
});
