// Property-based tests with a seeded random generator (no dependency). Each property is checked on
// many generated inputs; a failure message prints the seed and case so it can be reproduced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fft } from '../packages/numerics/src/index.mjs';
import { analyzeFunction, truthTable } from '../packages/logic/src/boolean.mjs';
import { formatEngineeringValue, parseEngineeringValue } from '../packages/schematic/src/units.mjs';
import { subnetInfo } from '../packages/netproto/src/index.mjs';
import { createProject, validateProject } from '../packages/project-model/src/index.mjs';
import { ProjectError } from '../packages/project-model/src/errors.mjs';
import { parseVcd } from '../packages/hdl/src/index.mjs';
import { parseTouchstone } from '../packages/rf/src/index.mjs';
import { parsePcap, parsePcapNg } from '../packages/packets/src/index.mjs';
import { parseIntelHex } from '../packages/mcu/src/i8051/peripherals.mjs';
import { parse as parseVerilog } from '../packages/verilog/src/parser.mjs';

const SEED = Number(process.env.OPENENTC_PROPERTY_SEED || 20261004);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const random = rng(SEED);
const int = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const pick = (list) => list[int(0, list.length - 1)];

test('FFT: Parseval energy, linearity and conjugate symmetry for random real signals', () => {
  for (let c = 0; c < 40; c += 1) {
    const n = int(1, 96);
    const x = Array.from({ length: n }, () => random() * 2 - 1), y = Array.from({ length: n }, () => random() * 2 - 1);
    const a = random() * 4 - 2;
    const X = fft(x), Y = fft(y), Z = fft(x.map((v, i) => v + a * y[i]));
    const energyTime = x.reduce((s, v) => s + v * v, 0);
    const energyFreq = X.real.reduce((s, re, k) => s + re * re + X.imaginary[k] ** 2, 0) / n;
    assert.ok(Math.abs(energyTime - energyFreq) <= 1e-9 * Math.max(1, energyTime), `Parseval, seed ${SEED}, case ${c}, n=${n}`);
    for (let k = 0; k < n; k += 1) {
      assert.ok(Math.abs(Z.real[k] - (X.real[k] + a * Y.real[k])) < 1e-9 && Math.abs(Z.imaginary[k] - (X.imaginary[k] + a * Y.imaginary[k])) < 1e-9, `linearity, case ${c}, k=${k}`);
      const m = (n - k) % n;
      assert.ok(Math.abs(X.real[k] - X.real[m]) < 1e-9 && Math.abs(X.imaginary[k] + X.imaginary[m]) < 1e-9, `conjugate symmetry, case ${c}, k=${k}`);
    }
  }
});

test('Boolean minimisation: minimal SOP and POS reproduce every random function exactly', () => {
  for (let c = 0; c < 60; c += 1) {
    const count = int(1, 5), size = 2 ** count;
    const variables = ['A', 'B', 'C', 'D', 'E'].slice(0, count);
    const minterms = [], dontCares = [];
    for (let m = 0; m < size; m += 1) { const r = random(); if (r < 0.4) minterms.push(m); else if (r < 0.5) dontCares.push(m); }
    const result = analyzeFunction(variables, minterms, dontCares);
    for (const form of ['sop', 'pos']) {
      const expression = result[form];
      if (expression === '0' || expression === '1') {
        for (const m of minterms) assert.equal(expression, '1', `${form} constant, case ${c}`);
        if (!minterms.length) assert.equal(expression, '0');
        continue;
      }
      const table = truthTable(expression);
      // The parser orders variables alphabetically and may omit unused ones; evaluate by name.
      const ones = new Set();
      for (const row of table.rows) if (row.output) {
        for (let m = 0; m < size; m += 1) {
          const matches = table.variables.every((name, i) => ((m >> (count - 1 - variables.indexOf(name))) & 1) === row.inputs[i]);
          if (matches) ones.add(m);
        }
      }
      for (let m = 0; m < size; m += 1) {
        if (dontCares.includes(m)) continue;
        assert.equal(ones.has(m), minterms.includes(m), `${form} "${expression}" disagrees at minterm ${m} (seed ${SEED}, case ${c}, vars ${count}, minterms ${minterms}, dc ${dontCares})`);
      }
    }
  }
});

test('engineering units: formatting then parsing returns the value to 4 significant digits', () => {
  for (let c = 0; c < 300; c += 1) {
    const value = (random() < 0.5 ? -1 : 1) * 10 ** (random() * 24 - 12) * (1 + random());
    const unit = pick(['', 'V', 'A', 'Ω', 'F', 'H', 'Hz']);
    const text = formatEngineeringValue(value, unit);
    const back = parseEngineeringValue(text.replace(unit, '').trim());
    assert.ok(Math.abs(back - value) <= 5e-4 * Math.abs(value), `${value} → "${text}" → ${back}`);
  }
});

test('IPv4 subnetting invariants hold for random addresses and prefixes', () => {
  for (let c = 0; c < 300; c += 1) {
    const octets = Array.from({ length: 4 }, () => int(0, 255));
    const prefix = int(0, 32);
    const info = subnetInfo(`${octets.join('.')}/${prefix}`);
    assert.equal(info.size, 2 ** (32 - prefix));
    assert.ok(info.network <= info.address && info.address <= info.broadcast, `containment ${octets}/${prefix}`);
    assert.equal(info.network % info.size, 0, 'network is aligned to the block size');
    assert.equal(info.broadcast - info.network + 1, info.size);
    assert.equal(info.usable, prefix >= 31 ? info.size : info.size - 2);
    assert.equal(info.mask + info.wildcard, 2 ** 32 - 1);
  }
});

test('project validation: random corruptions are rejected with ProjectError, never a crash', () => {
  const base = validateProject(createProject('Fuzz base'));
  const paths = [['name'], ['version'], ['format'], ['createdAt'], ['circuit', 'components'], ['circuit', 'wires'], ['circuit', 'signal', 'frequency'], ['settings', 'gridSize'], ['experiments'], ['notes'], ['artifacts'], ['units'], ['embedded', 'code']];
  const junk = [null, undefined, -1, 0, 1e309, NaN, '', 'x'.repeat(300), [], {}, [{ id: '../../etc' }], { __proto__: { polluted: true } }, true, '<script>'];
  let rejected = 0;
  for (let c = 0; c < 400; c += 1) {
    const project = structuredClone(base);
    const path = pick(paths), value = pick(junk);
    let target = project;
    for (const key of path.slice(0, -1)) target = target[key];
    if (value === undefined) delete target[path.at(-1)]; else target[path.at(-1)] = structuredClone(value);
    try {
      const result = validateProject(project);
      assert.equal(result.format, 'openentc-project', `accepted projects stay well-formed (case ${c}, ${path.join('.')})`);
    } catch (error) {
      assert.ok(error instanceof ProjectError, `case ${c}: ${path.join('.')} = ${JSON.stringify(value)} threw ${error?.constructor?.name}: ${error?.message}`);
      rejected += 1;
    }
  }
  assert.ok(rejected > 200, `most corruptions are rejected (${rejected}/400)`);
  assert.equal(Object.prototype.polluted, undefined, 'no prototype pollution');
});

const MUTATIONS = [(s) => s.slice(0, int(0, s.length)), (s) => s + String.fromCharCode(int(0, 0xffff)).repeat(int(1, 20)), (s) => { const i = int(0, s.length); return s.slice(0, i) + pick(['\0', '\n\n', '$', '#', ':', '-1', '1e999', 'NaN', '{', '"']) + s.slice(i); }, () => Array.from({ length: int(0, 400) }, () => String.fromCharCode(int(0, 127))).join('')];

function fuzzText(name, seedText, parse, cases = 250) {
  test(`${name}: mutated input either parses or throws an Error quickly`, () => {
    for (let c = 0; c < cases; c += 1) {
      let text = seedText;
      for (let m = int(1, 3); m > 0; m -= 1) text = pick(MUTATIONS)(text);
      const started = performance.now();
      try { parse(text); } catch (error) { assert.ok(error instanceof Error, `${name} case ${c} threw a non-Error`); }
      assert.ok(performance.now() - started < 2000, `${name} case ${c} took too long`);
    }
  });
}

fuzzText('VCD parser', '$timescale 1ns $end\n$scope module t $end\n$var wire 1 ! clk $end\n$upscope $end\n$enddefinitions $end\n#0\n0!\n#5\n1!\n#10\n0!\n', parseVcd);
fuzzText('Touchstone parser', '! test\n# GHz S MA R 50\n1.0 0.5 -45 0.9 10 0.9 10 0.5 -45\n2.0 0.4 -60 0.8 20 0.8 20 0.4 -60\n', (text) => parseTouchstone(text));
fuzzText('Intel HEX parser', ':0300300002337A1E\n:00000001FF\n', parseIntelHex);
fuzzText('Verilog parser', 'module t(input a, input b, output y);\n  assign y = a & b;\nendmodule\n', parseVerilog, 150);

test('PCAP and PCAPNG parsers: random and truncated bytes throw Errors, never hang', () => {
  const pcapHeader = Uint8Array.from([0xd4, 0xc3, 0xb2, 0xa1, 2, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 1, 0, 0, 0]);
  for (let c = 0; c < 300; c += 1) {
    const length = int(0, 200);
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) bytes[i] = int(0, 255);
    if (random() < 0.5) bytes.set(pcapHeader.subarray(0, Math.min(length, pcapHeader.length)));
    for (const parse of [parsePcap, parsePcapNg]) {
      const started = performance.now();
      try { parse(bytes); } catch (error) { assert.ok(error instanceof Error, `case ${c}`); }
      assert.ok(performance.now() - started < 1000);
    }
  }
});
