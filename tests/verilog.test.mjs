import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse, parseNumber, resultToVcd, simulate, Value } from '../packages/verilog/src/index.mjs';

const dir = new URL('./fixtures/verilog/', import.meta.url);
const read = (name) => readFileSync(new URL(name, dir), 'utf8');
const programs = readdirSync(dir).filter((name) => name.endsWith('.v')).sort();

/** Read a VCD into "scope.name" → [time, bits] changes (last value per time step). */
function readVcd(text) {
  const ids = new Map(), out = new Map(), stack = [];
  let time = 0, definitions = true;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (definitions) {
      let match;
      if ((match = line.match(/^\$scope \w+ (\S+) \$end/))) stack.push(match[1]);
      else if (line.startsWith('$upscope')) stack.pop();
      else if ((match = line.match(/^\$var \w+ (\d+) (\S+) (\S+)/))) { const name = `${stack.join('.')}.${match[3]}`; if (!ids.has(match[2])) ids.set(match[2], []); ids.get(match[2]).push(name); out.set(name, []); }
      else if (line.startsWith('$enddefinitions')) definitions = false;
      continue;
    }
    if (!line || line.startsWith('$')) continue;
    if (line[0] === '#') { time = Number(line.slice(1)); continue; }
    const [bits, id] = line[0] === 'b' ? line.slice(1).split(' ') : [line[0], line.slice(1)];
    for (const name of ids.get(id) ?? []) { const list = out.get(name); if (list.length && list.at(-1)[0] === time) list[list.length - 1] = [time, bits]; else list.push([time, bits]); }
  }
  return out;
}
const extend = (bits, width) => bits.padStart(width, /[xz]/.test(bits[0]) ? bits[0] : '0').slice(-width);
const changes = (list) => list.filter((entry, index) => index === 0 || entry[1] !== list[index - 1][1]).map(([time, bits]) => `${time}:${bits}`);

// Expected outputs and waveforms come from Icarus Verilog 12.0 (see fixtures/verilog/REFERENCE.txt).
for (const program of programs) {
  const base = program.replace(/\.v$/, '');
  test(`Verilog ${base}: $display output and every waveform match Icarus Verilog`, () => {
    const result = simulate(read(program));
    assert.equal(result.error, null);
    assert.equal(result.output.trimEnd(), read(`${base}.out`).trimEnd());
    const reference = readVcd(read(`${base}.vcd`));
    let compared = 0;
    for (const signal of result.signals) {
      const expected = reference.get(signal.path);
      if (!expected) continue;
      compared += 1;
      assert.deepEqual(changes(signal.history.map((change) => [change.t, change.value.toBinary()])), changes(expected.map(([time, bits]) => [time, extend(bits, signal.width)])), signal.path);
    }
    assert.ok(compared > 0);
  });
}

test('four-state values and literals', () => {
  assert.equal(parseNumber("8'hA5").toBinary(), '10100101');
  assert.equal(parseNumber("4'b1x0z").toBinary(), '1x0z');
  assert.equal(parseNumber("8'bx").toBinary(), 'xxxxxxxx');
  assert.equal(parseNumber("6'o7_7").toBinary(), '111111');
  assert.equal(parseNumber('-5'.slice(1)).signed, true);
  assert.equal(Value.of(4, -1).toBinary(), '1111');
  assert.equal(Value.of(4, 0b1010, true).resize(8).toBinary(), '11111010');
  assert.equal(Value.of(4, 0b1010).resize(8).toBinary(), '00001010');
});

test('errors are reported with line numbers; runaway loops stop', () => {
  assert.throws(() => parse('module m; initial begin x = ; end endmodule'), /line 1/);
  assert.match(simulate('module m; initial y = 1; endmodule').error, /'y' is not declared/);
  assert.match(simulate('module m; reg a; always a = ~a; endmodule', { maxSteps: 10_000 }).error, /without a delay|stopped after/);
  const timed = simulate('module m; reg c = 0; always #1 c = ~c; endmodule', { maxTime: 50 });
  assert.equal(timed.error, null); assert.match(timed.finishReason, /time limit/);
  assert.match(resultToVcd(timed), /\$var wire 1 \S+ c \$end/);
});
