import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COMPONENT_DEFINITION_VERSION, COMPONENT_DEFINITIONS, getComponentDefinition, validateComponentDefinitions } from '../packages/schematic/src/components.mjs';

test('component definitions are versioned, unique, pinned, unit-bearing, and simulation-aware', () => {
  assert.equal(COMPONENT_DEFINITION_VERSION, 1);
  validateComponentDefinitions(COMPONENT_DEFINITIONS);
  assert.deepEqual(getComponentDefinition('resistor').pins, ['1', '2']);
  assert.equal(getComponentDefinition('resistor').simulation.dc, 'resistor');
  assert.throws(() => validateComponentDefinitions([{ type: 'bad' }]), /definitions are invalid/);
  assert.throws(() => validateComponentDefinitions([COMPONENT_DEFINITIONS[0], COMPONENT_DEFINITIONS[0]]), /types must be unique/);
});

test('component definition JSON Schema is published alongside the runtime contract', async () => {
  const schema = JSON.parse(await readFile(resolve('schemas/component-definition.schema.json'), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(schema.required, ['version', 'definitions']);
  assert.equal(schema.properties.version.const, COMPONENT_DEFINITION_VERSION);
  assert.equal(schema.$defs.definition.properties.pins.uniqueItems, true);
});
