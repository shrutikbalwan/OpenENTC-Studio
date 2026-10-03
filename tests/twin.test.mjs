import test from 'node:test';
import assert from 'node:assert/strict';
import { adcToVolts, compareDivider, compareRc, explainDifference, fitCharging, parseTwinOutput, rcCharge } from '../packages/twin/src/index.mjs';
import { AVR_EXAMPLES, UnoBoard } from '../packages/mcu/src/index.mjs';
import { createCoSimulation } from '../src/engines/cosim.js';

const rel = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance, `${label}: ${actual} vs ${expected}`);

test('parser reads every reply of the twin firmware', () => {
  const text = 'OPENENTC-TWIN 1\r\nBEGIN RC,200\r\nRC,0,20\r\nRC,1,30\r\nEND\r\nDC,512.25,326.00\r\nEND\r\nS,100,10,20\r\nS,120,11,21\r\nEND\r\nERR unknown command\r\n';
  const p = parseTwinOutput(text);
  assert.equal(p.banner, 'OPENENTC-TWIN 1');
  assert.deepEqual(p.rc, { period: 200e-6, samples: [20, 30] });
  assert.deepEqual(p.dc, { a0: 512.25, a1: 326 });
  assert.equal(p.stream.length, 2);
  assert.equal(p.complete, 3);
  assert.deepEqual(p.errors, ['ERR unknown command']);
  rel(adcToVolts(1023), 5 * 1023.5 / 1024, 1e-12, 'full scale');
});

test('the RC fit recovers τ and the start time from noisy, quantised data', () => {
  const r = 10e3, c = 4.7e-6, period = 1e-3;
  let seed = 3; const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
  const raws = Array.from({ length: 250 }, (_, k) => Math.max(0, Math.min(1023, Math.floor(rcCharge(Math.max(0, k * period - 0.3e-3), r, c) * 1024 / 5 + 2 * noise()))));
  const run = compareRc({ r, c, period, raws });
  rel(run.fit.tau, r * c, 0.02, 'τ');
  assert.ok(Math.abs(run.errorPercent) < 2);
  rel(run.impliedC, c, 0.02, 'implied C');
  assert.ok(run.fit.r2 > 0.99);
  rel(compareDivider({ vs: 5, rTop: 10e3, rBottom: 4.7e3, code: 326 }).theory, 5 * 4.7 / 14.7, 1e-12, 'divider theory');
  assert.match(explainDifference(15), /check/);
  assert.throws(() => fitCharging([0, 1, 2], [0, 1, 2]), /8 samples/);
});

test('the same firmware runs on the simulated Uno against a real RC circuit', () => {
  const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
  assert.ok(firmware && firmware.flashBytes < 32256);
  const board = new UnoBoard(firmware.hex, firmware.board, { capture: false });
  const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
  const sim = createCoSimulation(board, { components: [part('R1', 'resistor', 10e3, 'drive', 'cap'), part('C1', 'capacitor', 1e-6, 'cap', '0'), part('V1', 'voltage', 5, 'vcc', '0'), part('R2', 'resistor', 10e3, 'vcc', 'mid'), part('R3', 'resistor', 4.7e3, 'mid', '0')], connections: [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }, { pin: 'A1', node: 'mid' }], maxStep: 50e-6 });
  const output = () => parseTwinOutput(Buffer.from(board.mcu.usart.output).toString());
  sim.advance(0.05);
  assert.equal(output().banner, 'OPENENTC-TWIN 1');
  board.mcu.usart.receive([...Buffer.from('R200\n')]);
  for (let k = 0; k < 40 && output().complete < 1; k += 1) sim.advance(0.05);
  const rc = output().rc;
  assert.equal(rc.samples.length, 250);
  const run = compareRc({ r: 10e3, c: 1e-6, period: rc.period, raws: rc.samples });
  assert.ok(Math.abs(run.errorPercent) < 3, `simulated τ error ${run.errorPercent} %`);
  board.mcu.usart.receive([...Buffer.from('D\n')]);
  for (let k = 0; k < 20 && output().complete < 2; k += 1) sim.advance(0.05);
  const divider = compareDivider({ rTop: 10e3, rBottom: 4.7e3, code: output().dc.a1 });
  assert.ok(Math.abs(divider.errorPercent) < 1, `divider error ${divider.errorPercent} %`);
});
