import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFault, BOARDS, boardNets, chooseFault, debrief, faultsFor, measureResistance, measureVoltage, score } from '../packages/faulthunt/src/index.mjs';
import { simulateDC } from '../src/engines/circuit-engine.js';

const solve = (components) => simulateDC(components);
const rel = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance + 1e-9, `${label}: ${actual} vs ${expected}`);

test('the virtual multimeter reads hand-calculated values on the resistor network', () => {
  const parts = BOARDS.divider.components;
  // Power off: R1 + R2 ∥ (R3 + R4 ∥ (R5 + R6)).
  const inner = 2200 * (1000 + 3300 * 6200 / 9500) / (2200 + 1000 + 3300 * 6200 / 9500);
  rel(measureResistance(parts, 'vcc', '0', solve), 1000 + inner, 1e-4, 'R(vcc–0)');
  rel(measureResistance(parts, 'c', '0', solve), 4700 * (1500 + 3300 * 3200 / 6500) / (4700 + 1500 + 3300 * 3200 / 6500), 1e-3, 'R(c–0)');
  rel(measureVoltage(parts, 'a', '0', solve), 12 * inner / (1000 + inner), 1e-9, 'V(a)');
  assert.equal(measureResistance(parts, 'a', 'a', solve), 0);
  assert.equal(measureResistance(applyFault(parts, { id: 'R1', kind: 'open' }), 'vcc', 'a', solve), Infinity, 'open resistor reads OL');
  assert.ok(measureResistance(applyFault(parts, { id: 'R1', kind: 'short' }), 'vcc', 'a', solve) < 0.01, 'short reads ~0 Ω');
});

test('every fault on every board solves, and chosen faults are visible', () => {
  for (const [id, board] of Object.entries(BOARDS)) {
    for (const part of board.components) for (const kind of faultsFor(part.type)) assert.doesNotThrow(() => solve(applyFault(board.components, { id: part.id, kind, factor: 5 })), `${id}/${part.id}/${kind}`);
    for (let seed = 1; seed <= 8; seed += 1) {
      const fault = chooseFault(board, seed, solve);
      const changes = debrief(board, fault, solve).map((row) => Math.abs(row.change));
      assert.ok(Math.max(...changes) > 0.05, `${id} seed ${seed} visible`);
    }
    assert.ok(boardNets(board).includes('0'));
  }
});

test('classic symptoms: open base resistor turns the LED off, shorted RE raises the collector current', () => {
  const led = BOARDS.led.components;
  const ok = solve(led).nodes, broken = solve(applyFault(led, { id: 'RB', kind: 'open' })).nodes;
  assert.ok(ok.c < 0.3, 'transistor saturated when healthy');
  assert.ok(broken.c > 7, 'collector rises toward VCC when the base is open (LED off)');
  const bias = BOARDS.bias.components;
  const h = solve(bias).nodes, s = solve(applyFault(bias, { id: 'RE', kind: 'short' })).nodes;
  assert.ok(s.c < h.c - 2, 'shorted RE: transistor heads for saturation');
  const dead = solve(applyFault(bias, { id: 'Q1', kind: 'dead' })).nodes;
  rel(dead.c, 12, 1e-3, 'dead transistor: collector at VCC');
  rel(dead.b, 12 * 9100 / 56100, 1e-3, 'dead transistor: base at the unloaded divider voltage');
});

test('scoring', () => {
  assert.equal(score({ measurements: 4, solved: true }), 100);
  assert.equal(score({ measurements: 10, wrongGuesses: 1, solved: true }), 55);
  assert.equal(score({ measurements: 3, peeked: true, solved: true }), 80);
  assert.equal(score({ solved: false }), 0);
});
