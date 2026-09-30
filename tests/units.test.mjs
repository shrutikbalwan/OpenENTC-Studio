import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEngineeringValue, parseEngineeringValue } from '../packages/schematic/src/units.mjs';

test('engineering units parse SI prefixes and suffixes safely', () => {
  assert.equal(parseEngineeringValue('4.7kΩ', { unit: 'Ω' }), 4700);
  assert.equal(parseEngineeringValue('2.2 µF', { unit: 'F' }), 2.2e-6);
  assert.equal(parseEngineeringValue('1e-3'), 0.001);
  assert.throws(() => parseEngineeringValue('4.7xΩ'), /invalid format|prefix|unit/);
});

test('engineering formatter chooses deterministic prefixes', () => {
  assert.equal(formatEngineeringValue(4700, 'Ω'), '4.7 kΩ');
  assert.equal(formatEngineeringValue(0.0000022, 'F'), '2.2 uF');
  assert.equal(formatEngineeringValue(0, 'V'), '0 V');
});
