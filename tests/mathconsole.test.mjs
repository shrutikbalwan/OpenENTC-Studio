import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, format, Matrix, parse, run, tokenize } from '../packages/mathconsole/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
// NumPy 2 on the same expressions (tests/fixtures/mathconsole/numpy.json).
const reference = JSON.parse(readFileSync(new URL('./fixtures/mathconsole/numpy.json', import.meta.url), 'utf8'));
const evaluate = (source, setup = '') => {
  const result = run(`${setup}\n${source}`, createSession());
  const last = result.outputs.at(-1);
  if (last.error) throw new Error(`${source}: ${last.error}`);
  return last.value;
};
const flat = (v) => (v instanceof Matrix ? Array.from(v.data) : typeof v === 'object' ? [v.re, v.im] : [v]);

test('linear algebra, statistics and polynomials match NumPy', () => {
  const setup = 'A = [4 -2 1; 3 6 -4; 2 1 8]; b = [12; -25; 32]; B = [2 1; 1 3]; M = [1 2 0 1; 0 1 3 2; 4 0 1 1; 2 2 2 5];';
  for (const [expression, expected] of Object.entries(reference.cases)) {
    const got = flat(evaluate(expression, setup)), want = [expected].flat();
    assert.equal(got.length, want.length, expression);
    want.forEach((v, i) => near(got[i], v, 1e-9, `${expression}[${i}]`));
  }
  const roots = evaluate('roots([1 -6 11 -6])').items.map((z) => (typeof z === 'number' ? z : z.re)).sort((a, b) => a - b);
  reference.roots.forEach((v, i) => near(roots[i], v, 1e-9, `root ${i}`));
});

test('syntax: suffixes, complex literals, ranges, transpose, matrices with signs, comments', () => {
  assert.equal(evaluate('4.7k'), 4700); near(evaluate('100n * 2'), 2e-7, 1e-12, 'nano'); assert.equal(evaluate('1M / 1k'), 1000);
  assert.deepEqual(evaluate('3 + 4j'), { re: 3, im: 4 });
  assert.equal(evaluate('abs(3 + 4i)'), 5);
  assert.deepEqual(flat(evaluate('1:3')), [1, 2, 3]); assert.deepEqual(flat(evaluate('10:-5:0')), [10, 5, 0]);
  assert.deepEqual(flat(evaluate('[1 -2 3]')), [1, -2, 3], 'space before a sign starts a new element');
  assert.deepEqual(flat(evaluate('[1 - 2 3]')), [-1, 3], 'spaced minus is subtraction');
  assert.deepEqual(flat(evaluate('[1 2 3]\'')), [1, 2, 3]); assert.equal(evaluate('[1 2 3]\'').rows, 3);
  assert.equal(evaluate('2 ^ 3 ^ 2'), 512, 'right-associative power'); assert.equal(evaluate('-2 ^ 2'), -4);
  assert.equal(evaluate('x = 5 % a comment\nx * 2'), 10);
  assert.equal(evaluate('m = [1 2; 3 4]; m(2, 1)'), 3); assert.equal(evaluate('v = 10:10:50; v(4)'), 40);
  assert.deepEqual(flat(evaluate('[[1 2]; [3 4]]')), [1, 2, 3, 4]);
  assert.ok(tokenize('a.^2').some((t) => t.value === '.^'));
  assert.equal(parse('f(x, y) = x + y').at(0).type, 'function');
});

test('user functions, constants, engineering helpers and errors', () => {
  assert.equal(evaluate('f(x) = 3*x + 1\nf(4)'), 13);
  assert.equal(evaluate('g(a, b) = a^2 + b^2\nsqrt(g(3, 4))'), 5);
  near(evaluate('parallel(1k, 1k, 2k)'), 400, 1e-12, 'parallel');
  near(evaluate('db(10)'), 20, 1e-12, 'dB'); near(evaluate('1 / (2*pi*sqrt(10m * 100n))'), 5032.92, 1e-5, 'LC resonance');
  near(evaluate('real(polar(2, 60))'), 1, 1e-12, 'polar'); near(evaluate('angle(1j)'), Math.PI / 2, 1e-12, 'angle');
  assert.deepEqual(evaluate('sqrt(-4)'), { re: 0, im: 2 });
  near(evaluate('exp(j*pi)'), -1, 1e-12, 'Euler');
  const session = createSession();
  run('x = 2', session); assert.equal(run('x^3', session).outputs[0].value, 8, 'variables persist');
  assert.match(run('[1 2] * [3 4]').outputs[0].error, /inner sizes/);
  assert.match(run('inv([1 2; 2 4])').outputs[0].error, /singular/);
  assert.match(run('nosuch(1)').outputs[0].error, /Unknown function/);
  assert.match(run('3 +').outputs[0].error, /Unexpected/);
  assert.equal(run('y = 1;').outputs.length, 0, 'semicolon suppresses output');
  const plotted = run('t = linspace(0, 1, 11); plot(t, t.^2)').outputs.at(-1);
  assert.equal(plotted.plot[0].x.length, 11); near(plotted.plot[0].y[10], 1, 1e-12, 'plot y');
  assert.equal(format(evaluate('[1 0; 0 1]')), '1  0\n0  1');
});
