import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlc, firstRise, LADDER_EXAMPLES, layoutCondition, operands, parseInputScript, parseLadder, runLadder, scan } from '../packages/plc/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const lastHigh = (result, name) => result.times[result.traces[name].lastIndexOf(1)];

test('parser: series/parallel, NC and edge contacts, outputs and errors', () => {
  const [rung] = parseLadder('(I0.0 | Q0.0) /I0.1 -> Q0.0, TON T3 1.5s');
  assert.equal(rung.condition.kind, 'and');
  assert.equal(rung.condition.items[0].kind, 'or');
  assert.equal(rung.condition.items[1].negated, true);
  assert.deepEqual(rung.outputs.map((o) => [o.kind, o.name]), [['coil', 'Q0.0'], ['ton', 'T3']]);
  assert.equal(rung.outputs[1].preset, 1.5);
  const box = layoutCondition(rung.condition);
  assert.deepEqual([box.w, box.h], [2, 2]);
  assert.throws(() => parseLadder('I0.0 -> I0.1'), /unknown output/);
  assert.throws(() => parseLadder('I9.0 -> Q0.0'), /unknown operand/);
  assert.throws(() => parseLadder('(I0.0 -> Q0.0'), /missing/);
  assert.deepEqual(operands(parseLadder(LADDER_EXAMPLES.stardelta[1])).outputs, ['Q0.0', 'Q0.1', 'Q0.2']);
});

test('seal-in, interlock and scan order behave like a real PLC', () => {
  const motor = runLadder(parseLadder(LADDER_EXAMPLES.motor[1]), { events: parseInputScript(LADDER_EXAMPLES.motor[2]), duration: 8 });
  near(firstRise(motor, 'Q0.0'), 0.5, 1e-9, 'start');
  assert.equal(motor.traces['Q0.0'][motor.times.findIndex((t) => t >= 3)], 1, 'sealed in after START released');
  near(motor.times[motor.traces['Q0.0'].indexOf(0, motor.times.findIndex((t) => t >= 1))], 4, 1e-9, 'stop');
  const lock = runLadder(parseLadder(LADDER_EXAMPLES.interlock[1]), { events: parseInputScript(LADDER_EXAMPLES.interlock[2]), duration: 6 });
  assert.equal(lock.traces['Q0.1'][lock.times.findIndex((t) => t >= 3)], 0, 'reverse refused while forward runs');
  near(firstRise(lock, 'Q0.1'), 5, 1e-9, 'reverse after stop');
  // Results are visible to later rungs within the same scan.
  const plc = createPlc();
  scan(plc, parseLadder('I0.0 -> M0.0\nM0.0 -> Q0.0'), { 'I0.0': 1 });
  assert.equal(plc.bits['Q0.0'], true);
  const late = createPlc();
  scan(late, parseLadder('M0.0 -> Q0.0\nI0.0 -> M0.0'), { 'I0.0': 1 });
  assert.equal(late.bits['Q0.0'], false, 'one scan later when the rung order is reversed');
});

test('TON, TOF and TP timing at 10 ms scans', () => {
  const r = runLadder(parseLadder('I0.0 -> TON T0 2s\nT0 -> Q0.0\nI0.0 -> TOF T1 1.5s\nT1 -> Q0.1\nI0.0 -> TP T2 0.75s\nT2 -> Q0.2'), { events: parseInputScript('1 I0.0=1; 4 I0.0=0'), duration: 7 });
  near(firstRise(r, 'Q0.0'), 3, 1e-9, 'TON on-delay');
  near(lastHigh(r, 'Q0.0'), 3.99, 1e-9, 'TON off with input');
  near(firstRise(r, 'Q0.1'), 1, 1e-9, 'TOF on at once');
  near(lastHigh(r, 'Q0.1'), 5.49, 1e-9, 'TOF off-delay 1.5 s');
  near(firstRise(r, 'Q0.2'), 1, 1e-9, 'TP starts');
  near(lastHigh(r, 'Q0.2'), 1.74, 1e-9, 'TP length 0.75 s');
  const traffic = runLadder(parseLadder(LADDER_EXAMPLES.traffic[1]), { duration: 25 });
  near(firstRise(traffic, 'Q0.1'), 5, 1e-9, 'green after 5 s red');
  near(firstRise(traffic, 'Q0.2'), 9, 1e-9, 'amber after 4 s green');
  // T2 is cleared in the scan after it finishes and T0 restarts one scan later: 11 s + 2 scans.
  near(firstRise(traffic, 'Q0.1', 10), 16.02, 1e-9, 'second green');
});

test('counters, latches and reset', () => {
  const r = runLadder(parseLadder(LADDER_EXAMPLES.counter[1]), { events: parseInputScript(LADDER_EXAMPLES.counter[2]), duration: 6 });
  near(firstRise(r, 'Q0.0'), 3, 1e-9, 'full on the sixth bottle');
  assert.equal(r.plc.counters.C0.count, 0, 'reset');
  const down = runLadder(parseLadder('^I0.0 -> CTD C1 2\nC1 -> Q0.0'), { events: parseInputScript('1 I0.0=1; 1.1 I0.0=0; 2 I0.0=1; 2.1 I0.0=0'), duration: 3 });
  near(firstRise(down, 'Q0.0'), 2, 1e-9, 'CTD reaches zero');
  const latch = runLadder(parseLadder('I0.0 -> S Q0.0\nI0.1 -> R Q0.0'), { events: parseInputScript('1 I0.0=1; 1.2 I0.0=0; 3 I0.1=1; 3.2 I0.1=0'), duration: 4 });
  near(firstRise(latch, 'Q0.0'), 1, 1e-9, 'set');
  near(lastHigh(latch, 'Q0.0'), 2.99, 1e-9, 'reset');
  const edge = runLadder(parseLadder('^I0.0 -> CTU C0 100'), { events: parseInputScript('1 I0.0=1; 3 I0.0=0'), duration: 4 });
  assert.equal(edge.plc.counters.C0.count, 1, 'a held input counts once');
});
