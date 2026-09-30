import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHdlJob, createHdlProject, parseVcd, validateHdlProject } from '../packages/hdl/src/index.mjs';

test('HDL project documents preserve bounded source sets, constraints and targets', () => {
  const project = validateHdlProject({
    format: 'openentc-hdl-project', version: 1, name: 'Counter', topUnit: 'counter',
    sourceSets: [{ id: 'rtl', language: 'systemverilog', sources: [{ path: 'hdl/counter.sv', kind: 'source' }, { path: 'hdl/counter_tb.sv', kind: 'testbench' }] }],
    constraints: [{ id: 'pins', path: 'hdl/pins.pcf' }], targets: [{ id: 'ice40', family: 'ice40', device: 'hx8k' }], future: { keep: true }
  });
  assert.equal(project.sourceSets[0].sources[1].kind, 'testbench');
  assert.equal(project.future.keep, true);
  assert.equal(createHdlJob(project, 'simulate').operation, 'simulate');
  assert.equal(createHdlJob(project, 'place-route', 'ice40').targetId, 'ice40');
});

test('HDL jobs keep simulation, synthesis and place-route separate and reject unsafe documents', () => {
  const project = createHdlProject('Safe HDL');
  assert.throws(() => createHdlJob(project, 'place-route'), /explicit target/);
  assert.throws(() => validateHdlProject({ ...project, sourceSets: [{ id: 'rtl', language: 'verilog', sources: [{ path: '../escape.v', kind: 'source' }] }] }), /confined/);
  assert.throws(() => validateHdlProject({ ...project, targets: [{ id: 'ice', family: 'unsupported' }] }), /unsupported/);
});

test('published iCE40 implementation target is explicit and stops before bitstream programming', async () => {
  const target = JSON.parse(await readFile(new URL('../targets/ice40-hx8k-ct256.json', import.meta.url), 'utf8'));
  assert.deepEqual({ format: target.format, version: target.version, id: target.id, family: target.family, device: target.device, package: target.package, constraintsFormat: target.constraintsFormat }, { format: 'openentc-fpga-target', version: 1, id: 'ice40-hx8k-ct256', family: 'ice40', device: 'hx8k', package: 'ct256', constraintsFormat: 'pcf' });
  assert.equal(target.outputFormat, 'asc');
  assert.equal(target.bitstream, null);
  assert.equal(target.programmer, null);
});

test('VCD parser preserves timescale, identifiers and scalar transitions', () => {
  const trace = parseVcd('$date today $end\n$timescale 1 ns $end\n$var wire 1 ! clk $end\n$var wire 1 " data $end\n$enddefinitions $end\n#0\n0!\n1"\n#10\n1!\n0"');
  assert.equal(trace.kind, 'digital-trace');
  assert.equal(trace.timescale, '1 ns');
  assert.deepEqual(trace.signals[0].samples, [{ time: 0, value: '0' }, { time: 10, value: '1' }]);
  assert.equal(trace.signals[1].name, 'data');
});

test('VCD parser imports bounded vector transitions from generated HDL waveforms', () => {
  const trace = parseVcd('$timescale\n  1 ns\n$end\n$var wire 4 ! count $end\n$enddefinitions $end\n#0\nb0 !\n#10\nb101 !');
  assert.equal(trace.signals[0].width, 4);
  assert.deepEqual(trace.signals[0].samples, [{ time: 0, value: '0000' }, { time: 10, value: '0101' }]);
  assert.throws(() => parseVcd('$timescale 1 ns $end\n$var wire 2 ! q $end\n$enddefinitions $end\n#0\nb101 !'), /exceeds/);
});

test('VCD parser accepts a separate bit-range reference as emitted by Verilator', () => {
  const trace = parseVcd('$timescale 1ps $end\n$scope module top $end\n$var wire 4 $ cnt [3:0] $end\n$upscope $end\n$enddefinitions $end\n#0\nb0000 $\n#5\nb0001 $');
  assert.equal(trace.timescale, '1 ps');
  assert.equal(trace.signals[0].name, 'cnt[3:0]');
  assert.equal(trace.signals[0].fullName, 'top.cnt[3:0]');
  assert.deepEqual(trace.signals[0].samples, [{ time: 0, value: '0000' }, { time: 5, value: '0001' }]);
});

test('VCD parser rejects incomplete definitions and unknown identifiers', () => {
  assert.throws(() => parseVcd('$timescale 1 ns $end\n$enddefinitions $end'), /definitions/);
  assert.throws(() => parseVcd('$timescale 1 ns $end\n$var wire 1 ! clk $end\n$enddefinitions $end\n#1\n1?'), /unknown/);
});

test('VCD parser retains hierarchy and updates identifier aliases', () => {
  const trace = parseVcd('$timescale 1 ns $end\n$scope module tb $end\n$var wire 1 ! clk $end\n$scope module dut $end\n$var wire 1 ! clk_alias $end\n$upscope $end\n$upscope $end\n$enddefinitions $end\n#0\n0!\n#5\n1!');
  assert.deepEqual(trace.signals.map(({ name, fullName, scope }) => ({ name, fullName, scope })), [
    { name: 'clk', fullName: 'tb.clk', scope: 'tb' },
    { name: 'clk_alias', fullName: 'tb.dut.clk_alias', scope: 'tb.dut' }
  ]);
  assert.equal(trace.signals[1].samples[1].value, '1');
  assert.throws(() => parseVcd('$timescale 1 ns $end\n$scope module tb $end\n$var wire 1 ! clk $end\n$enddefinitions $end'), /scope nesting/);
  assert.throws(() => parseVcd('$timescale 1 ns $end\n$var wire 1 ! clk $end\n$enddefinitions $end\n#2\n1!\n#1\n0!'), /out of order/);
});
