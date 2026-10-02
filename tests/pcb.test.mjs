import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleCircuits } from '../src/data/example-circuits.js';
import { autoroute, billOfMaterials, buildBoard, crc32, createZip, excellonDrill, extractNetlist, fabricationFiles, footprintFor, placementFile, ratsnest, rotatePoint, runDrc, shapeDistance, traceWidthForCurrent } from '../packages/pcb/src/index.mjs';

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const example = (id) => exampleCircuits.find((entry) => entry.id === id);

test('copper geometry distances', () => {
  near(shapeDistance({ kind: 'circle', x: 0, y: 0, r: 1 }, { kind: 'circle', x: 3, y: 4, r: 1 }), 3, 1e-12, 'circle-circle');
  near(shapeDistance({ kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, { kind: 'rect', x: 5, y: 0, w: 2, h: 2 }), 3, 1e-12, 'rect-rect');
  near(shapeDistance({ kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, r: 0.2 }, { kind: 'circle', x: 5, y: 1, r: 0.3 }), 0.5, 1e-12, 'segment-circle');
  near(shapeDistance({ kind: 'segment', x1: -5, y1: 3, x2: 5, y2: 3, r: 0.5 }, { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }), 1.5, 1e-12, 'segment-rect');
  assert.equal(shapeDistance({ kind: 'segment', x1: -5, y1: -5, x2: 5, y2: 5, r: 0.1 }, { kind: 'segment', x1: -5, y1: 5, x2: 5, y2: -5, r: 0.1 }), 0);
  assert.deepEqual(rotatePoint(1, 0, 90), [-0, 1]);
});

test('netlist uses schematic nets, footprints and pin maps', () => {
  const netlist = extractNetlist(example('ce-amplifier'));
  assert.equal(netlist.parts.length, 10);
  assert.ok(netlist.nets.includes('GND'));
  const q1 = netlist.parts.find((part) => part.reference === 'Q1');
  assert.equal(q1.footprint.name, 'TO-92_Inline');
  // TO-92 E-B-C: collector on pad 3, base on pad 2, emitter on pad 1.
  const original = example('ce-amplifier').components.find((component) => component.id === q1.id);
  assert.equal(q1.pinNets['3'], original.n1 === '0' ? 'GND' : original.n1);
  assert.equal(footprintFor('led', 'tht').pinMap.n2, '1', 'LED cathode is pad 1');
  assert.equal(footprintFor('ground'), null);
  assert.match(extractNetlist(example('inverting-opamp')).warnings.join(' '), /supply pins/);
});

test('every example board auto-places, routes completely and passes DRC', () => {
  for (const circuit of exampleCircuits) for (const style of ['tht', 'smd']) {
    const board = buildBoard(circuit, { style });
    assert.ok(ratsnest(board).length > 0, `${circuit.id} has connections`);
    const routed = autoroute(board);
    assert.equal(routed.remaining, 0, `${circuit.id}/${style} fully routed`);
    const drc = runDrc(board, routed);
    assert.equal(drc.errors, 0, `${circuit.id}/${style}: ${drc.violations.map((v) => v.message).join('; ')}`);
    for (const track of routed.tracks) assert.ok(track.x1 >= board.outline.x1 && track.x2 <= board.outline.x2, 'tracks inside the outline');
  }
});

test('DRC catches shorts, clearance, edge and unrouted problems', () => {
  const board = buildBoard(example('rc-lowpass'));
  const unrouted = runDrc(board);
  assert.equal(unrouted.violations.filter((v) => v.type === 'unrouted').length, ratsnest(board).length);
  const a = board.pads[0];
  const other = board.pads.find((pad) => pad.net !== a.net);
  const short = runDrc(board, { tracks: [{ net: a.net, layer: 'top', x1: a.x, y1: a.y, x2: other.x, y2: other.y, width: 0.4 }] });
  assert.ok(short.violations.some((v) => v.type === 'short'), 'track across two nets is a short');
  const thin = runDrc(board, { tracks: [{ net: a.net, layer: 'top', x1: a.x, y1: a.y, x2: a.x, y2: a.y + 0.5, width: 0.05 }] });
  assert.ok(thin.violations.some((v) => v.type === 'track-width'));
  const edge = runDrc(board, { vias: [{ net: a.net, x: board.outline.x1 + 0.2, y: board.outline.y1 + 0.2, diameter: 0.8, drill: 0.4 }] });
  assert.ok(edge.violations.some((v) => v.type === 'edge'));
  const nearMiss = runDrc(board, { tracks: [{ net: 'X', layer: 'top', x1: other.x - 3, y1: other.y + other.h / 2 + 0.3, x2: other.x + 3, y2: other.y + other.h / 2 + 0.3, width: 0.2 }] });
  assert.ok(nearMiss.violations.some((v) => v.type === 'clearance'), '0.2 mm gap breaks the 0.25 mm rule');
});

test('placement persists and new parts land below existing ones', () => {
  const circuit = example('rc-lowpass');
  const first = buildBoard(circuit);
  const moved = { ...first.placement, R1: { x: first.placement.R1.x + 5, y: first.placement.R1.y, rotation: 90 } };
  const second = buildBoard(circuit, { placement: moved });
  assert.deepEqual(second.placement.R1, { x: moved.R1.x, y: moved.R1.y, rotation: 90 });
  const padsR1 = second.pads.filter((pad) => pad.part === 'R1');
  near(padsR1[0].x, padsR1[1].x, 1e-9, 'rotated 90°: pads stacked vertically');
  const grown = buildBoard({ components: [...circuit.components, { id: 'R9', type: 'resistor', label: 'R9', value: 100, unit: 'Ω', n1: 'out', n2: '0', x: 0, y: 0, rotation: 0 }] }, { placement: first.placement });
  const r9 = grown.parts.find((part) => part.id === 'R9');
  assert.ok(r9.bounds.y1 > Math.max(...grown.parts.filter((part) => part.id !== 'R9').map((part) => part.bounds.y2)), 'new part placed below');
  assert.throws(() => buildBoard(circuit, { rules: { viaDrill: 1, viaDiameter: 0.8 } }), /drill/);
});

test('fabrication outputs: Gerber, Excellon, BOM, CPL and ZIP', () => {
  const board = buildBoard(example('ce-amplifier'));
  const routed = autoroute(board);
  const files = fabricationFiles(board, { ...routed, name: 'demo' });
  assert.deepEqual(files.map((file) => file.path.split('-').slice(1).join('-')), ['F_Cu.gtl', 'B_Cu.gbl', 'F_Mask.gts', 'B_Mask.gbs', 'F_Silkscreen.gto', 'Edge_Cuts.gm1', 'PTH.drl', 'BOM.csv', 'CPL.csv']);
  const top = files[0].text;
  assert.match(top, /^G04 .*\n%TF\.GenerationSoftware/);
  assert.match(top, /%TF\.FileFunction,Copper,L1,Top\*%/);
  assert.match(top, /%FSLAX46Y46\*%\n%MOMM\*%/);
  assert.ok(top.trimEnd().endsWith('M02*'));
  assert.equal((top.match(/D03\*/g) || []).length, board.pads.length + routed.vias.length, 'one flash per pad and via');
  assert.equal((top.match(/D01\*/g) || []).length, routed.tracks.filter((t) => t.layer === 'top').length, 'one draw per top track');
  const coordinates = [...top.matchAll(/X(-?\d+)Y(-?\d+)D0[123]/g)].map((m) => [Number(m[1]) / 1e6, Number(m[2]) / 1e6]);
  assert.ok(coordinates.every(([x, y]) => x >= 0 && y >= 0 && x <= board.width && y <= board.height), 'coordinates within the board, origin at bottom-left');
  const drill = excellonDrill(board, routed.vias);
  assert.equal(drill.holes, board.pads.filter((pad) => pad.drill).length + routed.vias.length);
  assert.match(drill.text, /^M48\n[\s\S]*METRIC\nT1C\d\.\d{3}\n[\s\S]*%\nG05\n[\s\S]*M30\n$/);
  const bom = billOfMaterials(board);
  assert.equal(bom.rows.reduce((sum, row) => sum + row.references.length, 0), board.parts.length);
  assert.match(bom.text, /R1,1,resistor,47kΩ,R_Axial_P10\.16mm/);
  assert.equal(placementFile(board).trim().split('\n').length, board.parts.length + 1);
  const zip = createZip(files);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 12, true), files.length);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'standard CRC-32 check value');
});

test('IPC-2221 trace width', () => {
  // 1 A, 10 °C rise, 1 oz external copper ≈ 0.30 mm (≈ 12 mil).
  near(traceWidthForCurrent({ current: 1, temperatureRise: 10, copperOz: 1 }).widthMil, 11.8, 0.3, '1 A external');
  assert.ok(traceWidthForCurrent({ current: 1, external: false }).widthMm > traceWidthForCurrent({ current: 1 }).widthMm, 'internal layers need wider traces');
});
