import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFunction, evaluateExpression, karnaughLayout, minimize, parseExpression, patternCovers, primeImplicants, truthTable } from '../packages/logic/src/boolean.mjs';

const sopValue = (implicants, term) => implicants.some((pattern) => patternCovers(pattern, term)) ? 1 : 0;

test('parser handles textbook notation, precedence and errors', () => {
  const { tree, variables } = parseExpression("AB' + C(D ⊕ E)");
  assert.deepEqual(variables, ['A', 'B', 'C', 'D', 'E']);
  assert.equal(evaluateExpression(tree, { A: 1, B: 0, C: 0, D: 0, E: 0 }), 1);
  assert.equal(evaluateExpression(tree, { A: 0, B: 0, C: 1, D: 1, E: 0 }), 1);
  assert.equal(evaluateExpression(tree, { A: 0, B: 0, C: 1, D: 1, E: 1 }), 0);
  assert.deepEqual(truthTable('A + B·C').minterms, truthTable('A | (B & C)').minterms);
  assert.deepEqual(truthTable("!(A+B)").minterms, truthTable("A'B'").minterms, 'De Morgan');
  assert.deepEqual(truthTable('A ^ B ^ C').minterms, [1, 2, 4, 7]);
  assert.deepEqual(parseExpression('X1 X0 + X2').variables, ['X0', 'X1', 'X2']);
  assert.throws(() => parseExpression('A +'), /ends unexpectedly/);
  assert.throws(() => parseExpression('(A'), /closing parenthesis/);
  assert.throws(() => parseExpression('A $ B'), /Unsupported character/);
  assert.throws(() => parseExpression('A B C D E F G H I'), /limited to 8 variables/);
});

test('Quine-McCluskey finds the textbook minimal forms', () => {
  const four = analyzeFunction(['A', 'B', 'C', 'D'], [0, 1, 2, 5, 6, 7, 8, 9, 10, 14]);
  assert.equal(four.sopImplicants.length, 3);
  assert.equal(four.sop, "A'BD + B'C' + CD'");
  assert.equal(four.canonicalSop, 'Σm(0, 1, 2, 5, 6, 7, 8, 9, 10, 14)');
  const withDontCares = analyzeFunction(['A', 'B', 'C', 'D'], [1, 3, 7, 11, 15], [0, 2, 5]);
  assert.equal(withDontCares.sop, "A'D + CD");
  assert.equal(withDontCares.pos, "(A' + C)D");
  assert.equal(analyzeFunction(['A', 'B'], [1, 2]).sop, "AB' + A'B", 'XOR has no simpler SOP');
  assert.deepEqual(primeImplicants(3, [0, 1, 2, 3]), ['0--']);
  assert.equal(analyzeFunction(['A'], []).sop, '0');
  assert.equal(analyzeFunction(['A', 'B'], [0, 1, 2, 3]).sop, '1');
  assert.equal(analyzeFunction([], [0]).sop, '1');
});

test('minimized SOP and POS always equal the function on its care set (randomized)', () => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 150; trial += 1) {
    const count = 2 + (trial % 5);
    const size = 2 ** count;
    const minterms = [], dontCares = [];
    for (let term = 0; term < size; term += 1) { const roll = random(); if (roll < 0.4) minterms.push(term); else if (roll < 0.5) dontCares.push(term); }
    const result = minimize(count, minterms, dontCares);
    const zeros = Array.from({ length: size }, (_, index) => index).filter((term) => !minterms.includes(term) && !dontCares.includes(term));
    for (let term = 0; term < size; term += 1) {
      if (dontCares.includes(term)) continue;
      assert.equal(sopValue(result.implicants, term), minterms.includes(term) ? 1 : 0, `SOP trial ${trial} term ${term}`);
    }
    const complement = minimize(count, zeros, dontCares);
    for (const term of zeros) assert.equal(sopValue(complement.implicants, term), 1, `POS trial ${trial} term ${term}`);
    for (const term of minterms) assert.equal(sopValue(complement.implicants, term), 0, `POS trial ${trial} term ${term}`);
    assert.equal(result.exact, true);
  }
});

test('minimal cover is never larger than any other prime cover (exhaustive for 3 variables)', () => {
  for (let mask = 1; mask < 256; mask += 1) {
    const minterms = Array.from({ length: 8 }, (_, index) => index).filter((term) => mask & (1 << term));
    const result = minimize(3, minterms);
    const primes = primeImplicants(3, minterms);
    let best = Infinity;
    for (let subset = 1; subset < 2 ** primes.length; subset += 1) {
      const chosen = primes.filter((_, index) => subset & (1 << index));
      if (minterms.every((term) => chosen.some((pattern) => patternCovers(pattern, term)))) best = Math.min(best, chosen.length);
    }
    if (minterms.length === 8) best = 1;
    assert.equal(result.implicants.length, best, `function ${mask}`);
  }
});

test('K-map layout uses Gray order and groups list covered cells', () => {
  const layout = karnaughLayout(['A', 'B', 'C', 'D']);
  assert.deepEqual(layout.rows, ['00', '01', '11', '10']);
  assert.deepEqual(layout.cells[2], [12, 13, 15, 14]);
  assert.deepEqual(karnaughLayout(['A', 'B', 'C']).cells, [[0, 1, 3, 2], [4, 5, 7, 6]]);
  const result = analyzeFunction(['A', 'B', 'C', 'D'], [0, 2, 8, 10]);
  assert.equal(result.sop, "B'D'");
  assert.deepEqual(result.groups, [[0, 2, 8, 10]], 'corner group wraps around the map');
  assert.throws(() => karnaughLayout(['A']), /2 to 4 variables/);
});

test('universal NAND and NOR forms and gate counts', () => {
  const result = analyzeFunction(['A', 'B', 'C'], truthTable("AB + A'C").minterms);
  assert.equal(result.universal.nand.expression, "((AB)'·(A'C)')'");
  assert.equal(result.universal.nand.gates, 4, 'one inverter, two term NANDs, one output NAND');
  assert.deepEqual(result.gates, { inverters: 1, and: 2, or: 1, literals: 4 });
  assert.equal(analyzeFunction(['A'], [1]).universal.nand.gates, 0, 'a bare variable needs no gate');
  assert.equal(analyzeFunction(['A'], [0]).universal.nand.gates, 1, 'a complemented variable needs one inverter');
  assert.equal(analyzeFunction(['A', 'B'], [3]).universal.nor.expression, "(A' + B')'");
});

import { analyzeCombinational, LOGIC_TEMPLATES, parseNetlist, simulateNetlist } from '../packages/logic/src/simulator.mjs';
import { convertNumber, fromGray, parseNumber, toGray } from '../packages/logic/src/codes.mjs';

const template = (id) => LOGIC_TEMPLATES.find((item) => item.id === id).text;
const valueAt = (trace, name, time) => trace.signals.find((signal) => signal.name === name).samples.filter((sample) => sample.time <= time).at(-1)?.value ?? 'x';
const word = (trace, names, time) => names.map((name) => valueAt(trace, name, time)).join('');

test('combinational analysis turns gate netlists into truth tables', () => {
  const adder = analyzeCombinational(template('full-adder'));
  assert.deepEqual(adder.minterms, { S: [1, 2, 4, 7], Cout: [3, 5, 6, 7] });
  assert.equal(analyzeFunction(adder.variables, adder.minterms.Cout).sop, 'AB + ACin + BCin');
  const mux = analyzeCombinational(template('mux2'));
  assert.deepEqual(mux.variables, ['S', 'I0', 'I1']);
  assert.deepEqual(mux.minterms.Y, [2, 3, 5, 7], 'Y = S\'I0 + SI1 with S as the most significant input');
  assert.deepEqual(analyzeCombinational(template('decoder')).minterms, { Y0: [0], Y1: [1], Y2: [2], Y3: [3] });
  assert.throws(() => analyzeCombinational(template('sync-counter')), /combinational circuit/);
});

test('gate delays produce visible propagation in the timing diagram', () => {
  const trace = simulateNetlist('input A pattern=01 step=10\nnot B = A\nnot C = B\noutput C', { stopTime: 20 });
  assert.equal(valueAt(trace, 'C', 10), '0');
  assert.equal(valueAt(trace, 'C', 11), '0');
  assert.equal(valueAt(trace, 'C', 12), '1', 'two gate delays after the input edge');
});

test('counters, shift register and Johnson counter step on each clock edge', () => {
  const ripple = simulateNetlist(template('ripple-counter'), { stopTime: 400 });
  const counts = Array.from({ length: 18 }, (_, cycle) => parseInt(word(ripple, ['Q3', 'Q2', 'Q1', 'Q0'], 19 + cycle * 20), 2));
  assert.deepEqual(counts, Array.from({ length: 18 }, (_, cycle) => (cycle + 1) % 16));
  const sync = simulateNetlist(template('sync-counter'), { stopTime: 200 });
  assert.deepEqual(Array.from({ length: 9 }, (_, cycle) => parseInt(word(sync, ['Q2', 'Q1', 'Q0'], 19 + cycle * 20), 2)), [1, 2, 3, 4, 5, 6, 7, 0, 1]);
  const shift = simulateNetlist(template('shift-register'), { stopTime: 200 });
  assert.deepEqual(Array.from({ length: 5 }, (_, cycle) => word(shift, ['Q0', 'Q1', 'Q2', 'Q3'], 19 + cycle * 20)), ['1000', '0100', '1010', '1101', '0110']);
  const johnson = simulateNetlist(template('johnson'), { stopTime: 200 });
  assert.deepEqual(Array.from({ length: 8 }, (_, cycle) => word(johnson, ['Q0', 'Q1', 'Q2', 'Q3'], 19 + cycle * 20)), ['1000', '1100', '1110', '1111', '0111', '0011', '0001', '0000']);
});

test('JK flip-flop toggles, holds, sets and resets; async reset wins', () => {
  const trace = simulateNetlist('clock CLK period=20\ninput J pattern=1101 step=20\ninput K pattern=1011 step=20\ninput RST pattern=00001 step=20\njkff Q = J K CLK RST\noutput Q', { stopTime: 100 });
  assert.deepEqual([19, 39, 59, 79, 99].map((time) => valueAt(trace, 'Q', time)), ['1', '1', '0', '1', '0']);
});

test('SR latch holds state, starts unknown and flags the S=R=1 release race', () => {
  const latch = simulateNetlist(template('sr-latch'), { stopTime: 140 });
  assert.equal(valueAt(latch, 'Q', 19), 'x');
  assert.deepEqual([39, 79, 99, 139].map((time) => valueAt(latch, 'Q', time)), ['1', '1', '0', '0']);
  const race = simulateNetlist('input S pattern=1100 step=10\ninput R pattern=1100 step=10\nnor Q = R QN\nnor QN = S Q\noutput Q', { stopTime: 60 });
  assert.equal(race.oscillating, true);
  const ring = simulateNetlist('input EN pattern=01 step=10\nnand A = EN C\nnot B = A\nnot C = B', { stopTime: 100 });
  assert.match(ring.warnings[0], /every 3 ns/);
  for (const item of LOGIC_TEMPLATES) assert.equal(simulateNetlist(item.text, { stopTime: 200 }).oscillating, false, `${item.id} is stable`);
});

test('netlist parser reports undriven, doubly driven and unknown elements by line', () => {
  assert.throws(() => parseNetlist('input A\nand Y = A B'), /Line 2: signal B is used but never driven/);
  assert.throws(() => parseNetlist('input A\nand Y = A A\nor Y = A A'), /Line 3: signal Y is already driven on line 2/);
  assert.throws(() => parseNetlist('input A\nfoo Y = A'), /unknown element "foo"/);
  assert.throws(() => parseNetlist('input A\nnot Y = A A'), /not takes 1 input/);
  assert.throws(() => parseNetlist('clock C period=7\ndff Q = 1 C'), /even number/);
  assert.equal(parseNetlist('# comment\ninput A=1 // trailing\nbuf Y = A').inputs[0].value, 1);
});

test('number converter covers bases, complements, Gray, BCD and excess-3', () => {
  const value = convertNumber(parseNumber('2A', 'hex'), 8);
  assert.equal(value.decimal, '42');
  assert.equal(value.binary, '0010 1010');
  assert.equal(value.octal, '52');
  assert.equal(value.gray, '0011 1111');
  assert.equal(value.twosComplementOfValue, '1101 0110');
  assert.equal(convertNumber(97, 8).bcd, '1001 0111');
  assert.equal(convertNumber(97, 8).excess3, '1100 1010');
  assert.equal(convertNumber(255, 8).signedDecimal, '-1');
  assert.equal(convertNumber(7, 4).evenParityBit, 1);
  for (let number = 0; number < 4096; number += 1) assert.equal(fromGray(toGray(number)), number);
  for (let number = 0; number < 255; number += 1) assert.equal((toGray(number) ^ toGray(number + 1)).toString(2).split('1').length - 1, 1, 'adjacent Gray codes differ in one bit');
  assert.throws(() => parseNumber('102', 'binary'), /not a valid binary/);
  assert.throws(() => convertNumber(256, 8), /needs more than 8 bits/);
});
