import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConnectivity, buildIntermediateNetlist, normalizeNode } from '../packages/schematic/src/index.mjs';
import { connectNodes, disconnectNodes, normalizeWires, pruneWires, setWireRoute } from '../src/core/wires.js';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';
import { buildWireSegments, defaultWireRoute, orthogonalPath, orthogonalPoints, wireRouteHandle, wireRouteHandles, wireRouteInsertionPoint } from '../packages/schematic/src/geometry.mjs';
import { componentsInRect } from '../packages/schematic/src/selection.mjs';

const divider = [
  { id: 'R2', type: 'resistor', label: 'R2', value: 2000, unit: 'Ω', n1: 'out', n2: 'GND' },
  { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: '0' },
  { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: 'out' }
];

test('schematic connectivity normalizes ground and is deterministic', () => {
  assert.equal(normalizeNode('GND'), '0');
  assert.deepEqual(buildConnectivity(divider), [['0'], ['out'], ['vcc']]);
  assert.deepEqual(buildConnectivity([...divider].reverse()), buildConnectivity(divider));
});

test('schematic wires merge aliases without changing component terminals', () => {
  const wires = [{ from: 'out', to: 'sense' }, { from: 'sense', to: 'probe' }];
  assert.deepEqual(buildConnectivity(divider, wires), [['0'], ['out', 'probe', 'sense'], ['vcc']]);
  assert.deepEqual(buildIntermediateNetlist(divider, wires).elements[0].nodes, ['vcc', 'out']);
});

test('net labels merge named nodes while junction records remain deterministic metadata', () => {
  const labels = [{ id: 'label-1', text: 'sense', node: 'out', x: 120, y: 80 }];
  assert.deepEqual(buildConnectivity(divider, [], labels), [['0'], ['out', 'sense'], ['vcc']]);
  assert.deepEqual(buildIntermediateNetlist(divider, [], labels).nodes, [['0'], ['out', 'sense'], ['vcc']]);
  assert.throws(() => buildConnectivity(divider, [], [{ id: 'bad', node: 'out', text: '' }]), /Net label/);
});

test('intermediate netlist sorts elements and preserves electrical metadata', () => {
  const netlist = buildIntermediateNetlist(divider);
  assert.deepEqual(netlist.elements.map((element) => element.id), ['R1', 'R2', 'V1']);
  assert.deepEqual(netlist.elements[0].nodes, ['vcc', 'out']);
});

test('intermediate netlist rejects duplicate references and malformed values', () => {
  assert.throws(() => buildIntermediateNetlist([{ ...divider[0], id: 'V1' }, divider[1]]), /Duplicate component reference/);
  assert.throws(() => buildIntermediateNetlist([{ ...divider[0], value: Number.NaN }]), /invalid value/);
});

test('wire editor connects normalized aliases idempotently and disconnects safely', () => {
  const connected = connectNodes([], 'GND', 'sense');
  assert.deepEqual(connected, [{ from: '0', to: 'sense' }]);
  assert.deepEqual(connectNodes(connected, 'sense', '0'), connected);
  assert.deepEqual(disconnectNodes(connected, 'sense', '0'), []);
});

test('wire pruning removes only aliases whose endpoints are no longer authored', () => {
  const wires = [
    { from: 'out', to: 'sense', route: { axis: 'x', coordinate: 120 } },
    { from: 'sense', to: 'probe' },
    { from: 'GND', to: 'shield' },
  ];
  assert.deepEqual(pruneWires(wires, ['out', 'sense', '0', 'shield']), [
    { from: '0', to: 'shield' },
    { from: 'out', to: 'sense', route: { axis: 'x', coordinate: 120 } },
  ]);
  assert.throws(() => pruneWires(wires, null), /Retained nodes/);
});

test('wire editor canonicalizes direction, splits self-links, and rejects malformed segments', () => {
  assert.deepEqual(normalizeWires([
    { from: 'b', to: 'a' },
    { from: 'a', to: 'b' },
    { from: 'GND', to: '0' }
  ]), [{ from: 'a', to: 'b' }]);
  assert.deepEqual(connectNodes([{ from: 'b', to: 'a' }], 'a', 'c'), [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' }
  ]);
  assert.throws(() => normalizeWires([{ from: 'a' }]), /Wire 0/);
});

test('SPICE export is deterministic, aliases nodes, and rejects unsupported types', () => {
  const text = buildSpiceNetlist([
    { id: 'R2', type: 'resistor', label: 'R2', value: 2000, unit: 'Ω', n1: 'sense', n2: '0' },
    { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'vcc', n2: 'GND' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'vcc', n2: 'out' }
  ], [{ from: 'out', to: 'sense' }], { title: 'divider' });
  assert.equal(text, '* divider\nR1 vcc out 1000\nR2 out 0 2000\nV1 vcc 0 9\n.end\n');
  assert.throws(() => buildSpiceNetlist([{ id: 'X1', type: 'mystery', label: 'X1', value: 1, unit: 'x', n1: 'a', n2: '0' }]), /does not support/);
});

test('SPICE export applies authored net labels without changing component terminals', () => {
  const text = buildSpiceNetlist([
    { id: 'V1', type: 'voltage', label: 'V1', value: 5, unit: 'V', n1: 'local', n2: '0' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'local', n2: '0' }
  ], [], { netLabels: [{ id: 'N1', text: 'vcc', node: 'local', x: 0, y: 0 }] });
  assert.match(text, /R1 vcc 0 1000/);
  assert.match(text, /V1 vcc 0 5/);
});

test('wire geometry resolves explicit aliases to stable orthogonal segments', () => {
  const segments = buildWireSegments([
    { id: 'R1', type: 'resistor', label: 'R1', value: 1, unit: 'Ω', n1: 'a', n2: '0', x: 10, y: 20 },
    { id: 'R2', type: 'resistor', label: 'R2', value: 1, unit: 'Ω', n1: 'b', n2: '0', x: 100, y: 40 }
  ], [{ from: 'a', to: 'b' }]);
  assert.deepEqual(segments, [{ fromNode: 'a', toNode: 'b', from: { x: 55, y: 45 }, to: { x: 145, y: 65 } }]);
});

test('orthogonal wire paths are deterministic and reject invalid coordinates', () => {
  assert.equal(orthogonalPath({ x: 10, y: 20 }, { x: 40, y: 60 }), 'M10 20 L10 40 L40 40 L40 60');
  assert.equal(orthogonalPath({ x: 10, y: 20 }, { x: 10, y: 60 }), 'M10 20 L10 60');
  assert.throws(() => orthogonalPath({ x: Number.NaN, y: 0 }, { x: 1, y: 1 }), /finite/);
});

test('authored orthogonal routes persist one movable segment without changing connectivity', () => {
  const routed = setWireRoute([{ from: 'b', to: 'a' }], 'a', 'b', { axis: 'x', coordinate: 75 });
  assert.deepEqual(routed, [{ from: 'a', to: 'b', route: { axis: 'x', coordinate: 75 } }]);
  assert.deepEqual(orthogonalPoints({ x: 10, y: 20 }, { x: 100, y: 80 }, routed[0].route), [
    { x: 10, y: 20 }, { x: 75, y: 20 }, { x: 75, y: 80 }, { x: 100, y: 80 }
  ]);
  assert.deepEqual(wireRouteHandle({ x: 10, y: 20 }, { x: 100, y: 80 }, routed[0].route), { x: 75, y: 50, axis: 'x', coordinate: 75 });
  assert.deepEqual(defaultWireRoute({ x: 0, y: 0 }, { x: 100, y: 20 }), { axis: 'x', coordinate: 50 });
  assert.deepEqual(buildConnectivity(divider, routed), buildConnectivity(divider, [{ from: 'a', to: 'b' }]));
  assert.throws(() => setWireRoute(routed, 'a', 'b', { axis: 'x', coordinate: Number.NaN }), /bounded/);
  assert.throws(() => setWireRoute(routed, 'missing', 'b', { axis: 'y', coordinate: 10 }), /not found/);
});

test('multi-bend wire routes preserve ordered waypoints and canonical direction', () => {
  const route = { points: [{ x: 80, y: 20 }, { x: 80, y: 70 }, { x: 120, y: 70 }] };
  const routed = setWireRoute([{ from: 'a', to: 'b' }], 'b', 'a', route);
  assert.deepEqual(routed, [{ from: 'a', to: 'b', route: { points: [...route.points].reverse() } }]);
  const points = orthogonalPoints({ x: 10, y: 10 }, { x: 150, y: 90 }, routed[0].route);
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index - 1].x === points[index].x || points[index - 1].y === points[index].y);
  }
  assert.deepEqual(wireRouteHandles({ x: 10, y: 10 }, { x: 150, y: 90 }, routed[0].route), [
    { x: 120, y: 70, axis: 'point', index: 0 },
    { x: 80, y: 70, axis: 'point', index: 1 },
    { x: 80, y: 20, axis: 'point', index: 2 },
  ]);
  const insertion = wireRouteInsertionPoint({ x: 10, y: 10 }, { x: 150, y: 90 }, routed[0].route);
  assert.ok(Number.isFinite(insertion.x) && Number.isFinite(insertion.y));
  assert.deepEqual(buildConnectivity(divider, routed), buildConnectivity(divider, [{ from: 'a', to: 'b' }]));
});

test('multi-bend routes enforce bounded point lists', () => {
  const wire = [{ from: 'a', to: 'b' }];
  assert.throws(() => setWireRoute(wire, 'a', 'b', { points: [] }), /finite and bounded/);
  assert.throws(() => setWireRoute(wire, 'a', 'b', { points: Array.from({ length: 65 }, (_, x) => ({ x, y: 0 })) }), /finite and bounded/);
  assert.throws(() => setWireRoute(wire, 'a', 'b', { points: [{ x: Number.NaN, y: 0 }] }), /finite and bounded/);
  assert.throws(() => setWireRoute(wire, 'a', 'b', { points: [{ x: 1_000_001, y: 0 }] }), /finite and bounded/);
  assert.throws(() => setWireRoute(wire, 'a', 'b', { points: [{ x: 1, y: 2, extra: true }] }), /finite and bounded/);
});

test('selection geometry is direction-independent and returns stable component ids', () => {
  const components = [{ id: 'R1', x: 20, y: 30 }, { id: 'R2', x: 100, y: 110 }, { id: 'R3', x: 300, y: 300 }];
  assert.deepEqual(componentsInRect(components, { x: 130, y: 130, width: -120, height: -120 }), ['R1', 'R2']);
});
