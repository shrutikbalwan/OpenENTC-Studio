import test from 'node:test';
import assert from 'node:assert/strict';
import { checkElectricalRules, locateElectricalRuleDiagnostic } from '../packages/schematic/src/erc.mjs';

const valid = [
  { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: '0' },
  { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: '0' }
];

test('ERC accepts grounded connected circuit', () => assert.deepEqual(checkElectricalRules(valid), []));
test('ERC reports missing ground, floating node, duplicate reference and invalid value', () => {
  const diagnostics = checkElectricalRules([{ ...valid[0], n2: 'floating' }, { ...valid[0], value: Number.NaN, n2: 'floating' }, { ...valid[1], id: 'V1', n1: 'unique', n2: 'isolated' }]);
  const codes = diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes('ERC_MISSING_GROUND'));
  assert.ok(codes.includes('ERC_FLOATING_NODE'));
  assert.ok(codes.includes('ERC_DUPLICATE_REFERENCE'));
  assert.ok(codes.includes('ERC_INVALID_VALUE'));
});

test('ERC reports conflicting ideal sources', () => {
  const diagnostics = checkElectricalRules([valid[0], { ...valid[0], id: 'V2', value: 5 }]);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'ERC_CONFLICTING_SOURCE'));
});

test('ERC resolves wire aliases before checking floating nodes', () => {
  const aliased = [{ ...valid[0], n1: 'source' }, { ...valid[1], n1: 'sense', n2: '0' }];
  assert.deepEqual(checkElectricalRules(aliased, [{ from: 'source', to: 'sense' }]), []);
});

test('ERC reports missing required component pins', () => {
  const diagnostics = checkElectricalRules([{ ...valid[0], n2: '' }]);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'ERC_UNCONNECTED_PIN'));
  const diagnostic = diagnostics.find((entry) => entry.code === 'ERC_UNCONNECTED_PIN');
  assert.match(diagnostic.message, /n2/);
  assert.equal(diagnostic.source, 'V1:n2');
  assert.deepEqual(locateElectricalRuleDiagnostic([{ ...valid[0], n2: '' }], [], [], diagnostic), [{ componentId: 'V1', pin: 'n2' }]);
});

test('ERC diagnostics resolve component and aliased node targets to exact canvas pins', () => {
  const components = [{ ...valid[0], n1: 'source' }, { ...valid[1], n1: 'sense', n2: '0' }];
  const wires = [{ from: 'source', to: 'sense' }];
  assert.deepEqual(locateElectricalRuleDiagnostic(components, wires, [], { source: 'V1' }), [{ componentId: 'V1', pin: null }]);
  assert.deepEqual(locateElectricalRuleDiagnostic(components, wires, [], { source: 'source' }), [
    { componentId: 'V1', pin: 'n1' },
    { componentId: 'R1', pin: 'n1' },
  ]);
  assert.deepEqual(locateElectricalRuleDiagnostic(components, wires, [], { source: null }), []);
});
