import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess } from '../packages/process-runner/src/index.mjs';
import { createNgspiceAdapter } from '../packages/engine-sdk/src/ngspice.mjs';
import { simulateAC, simulateDC, simulateTransient } from '../src/engines/circuit-engine.js';
import { buildSpiceNetlist } from '../packages/schematic/src/spice.mjs';

// Opt-in only: verification never searches for, installs, or executes an
// external engine unless the caller supplies its exact executable path.
const executable = process.env.OPENENTC_NGSPICE || '';
const enabled = Boolean(executable);

test('opt-in ngspice executable smoke reports real version output', { skip: !enabled }, async () => {
  assert.match(executable, /^(?:[A-Za-z]:[\\/]|[\\/])/);
  const result = await runProcess({ executable, args: ['-v'], cwd: process.cwd(), timeoutMs: 10_000, maxOutputBytes: 64 * 1024 });
  assert.equal(result.ok, true, result.error || result.stderr);
  assert.match(`${result.stdout}\n${result.stderr}`, /ngspice/i);
});

test('opt-in ngspice adapter runs a project-scoped resistor divider', { skip: !enabled }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-ngspice-integration-'));
  try {
    const adapter = createNgspiceAdapter({
      executable,
      runner: async ({ netlist }) => {
        const input = join(root, 'divider.cir');
        const output = join(root, 'divider.out');
        await writeFile(input, netlist, 'utf8');
        const result = await runProcess({ executable, args: ['-b', '-o', output, input], cwd: root, timeoutMs: 20_000, maxOutputBytes: 2 * 1024 * 1024 });
        const report = await readFile(output, 'utf8').catch(() => '');
        return { ...result, stdout: `${result.stdout}\n${report}` };
      }
    });
    const job = {
      operation: 'operating-point',
      title: 'integration divider',
      components: [
        { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'in', n2: '0' },
        { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'in', n2: 'out' },
        { id: 'R2', type: 'resistor', label: 'R2', value: 1000, unit: 'Ω', n1: 'out', n2: '0' }
      ],
      wires: []
    };
    await adapter.prepare(job);
    const run = await adapter.run(job);
    assert.equal(run.ok, true, run.error || run.stderr);
    const parsed = await adapter.parse();
    assert.equal(parsed.measurements['v(out)'], 4.5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('opt-in ngspice adapter completes DC, AC and transient analyses', { skip: !enabled }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-ngspice-analyses-'));
  const components = [
    { id: 'V1', type: 'voltage', label: 'V1', value: 9, unit: 'V', n1: 'in', n2: '0' },
    { id: 'R1', type: 'resistor', label: 'R1', value: 1000, unit: 'Ω', n1: 'in', n2: 'out' },
    { id: 'R2', type: 'resistor', label: 'R2', value: 1000, unit: 'Ω', n1: 'out', n2: '0' }
  ];
  try {
    for (const operation of ['dc-sweep', 'ac-analysis', 'transient']) {
      const adapter = createNgspiceAdapter({
        executable,
        runner: async ({ netlist }) => {
          const input = join(root, `${operation}.cir`);
          const output = join(root, `${operation}.out`);
          await writeFile(input, netlist, 'utf8');
          const result = await runProcess({ executable, args: ['-b', '-o', output, input], cwd: root, timeoutMs: 20_000, maxOutputBytes: 2 * 1024 * 1024 });
          const report = await readFile(output, 'utf8').catch(() => '');
          return { ...result, stdout: `${result.stdout}\n${report}` };
        }
      });
      const job = { operation, components, wires: [], source: 'V1', points: 5, startHz: 1, stopHz: 1_000, start: 0, stop: 9, step: 1, stepTime: 1e-6, stopTime: 1e-5 };
      await adapter.prepare(job);
      const run = await adapter.run(job);
      assert.equal(run.ok, true, `${operation}: ${run.error || run.stderr}`);
      const parsed = await adapter.parse();
      assert.equal(parsed.kind, 'table', `${operation} should produce a numeric table`);
      assert.ok(parsed.rows.length > 0, `${operation} should produce at least one row`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('opt-in built-in solver agrees with ngspice for DC, transient and AC analyses', { skip: !enabled }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-solver-crosscheck-'));
  const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, unit: '', n1, n2 });
  // Same diode law as the built-in engine: 10 mA at the rated forward voltage, Vt at 27 °C.
  const saturation = (forward, emission) => 0.01 / Math.expm1(forward / (emission * 0.025865));
  const measure = async (name, body) => {
    const file = join(root, `${name}.cir`);
    await writeFile(file, `* ${name}\n${body}\n.end\n`);
    const result = await runProcess({ executable, args: ['-b', file], cwd: root, timeoutMs: 30_000, maxOutputBytes: 1024 * 1024 });
    assert.equal(result.ok, true, result.error || result.stderr);
    return (label) => Number(result.stdout.match(new RegExp(`^${label}\\s*=\\s*([-0-9.eE+]+)`, 'mi'))[1]);
  };
  try {
    const dc = simulateDC([part('V1', 'voltage', 9, 'vcc', '0'), part('R1', 'resistor', 470, 'vcc', 'a'), part('D1', 'diode', 0.7, 'a', 'b'), part('R2', 'resistor', 220, 'b', '0'), part('D2', 'led', 2, 'b', 'c'), part('R3', 'resistor', 330, 'c', '0')]);
    let value = await measure('dc', `V1 vcc 0 9\nR1 vcc a 470\nD1 a b DD\nR2 b 0 220\nD2 b c DL\nR3 c 0 330\n.model DD D(Is=${saturation(0.7, 1)} N=1)\n.model DL D(Is=${saturation(2, 2)} N=2)\n.op\n.control\nrun\nprint v(a) v(b) v(c)\n.endc`);
    for (const node of ['a', 'b', 'c']) assert.ok(Math.abs(dc.nodes[node] - value(`v\\(${node}\\)`)) < 1e-4, `DC v(${node})`);
    const transient = simulateTransient([part('V1', 'voltage', 5, 'in', '0'), part('R1', 'resistor', 50, 'in', 'x'), part('L1', 'inductor', 10e-3, 'x', 'y'), part('C1', 'capacitor', 1e-6, 'y', '0')], [], [], { stopTime: 2e-3, timeStep: 1e-6 });
    value = await measure('tran', 'V1 in 0 PWL(0 0 1n 5)\nR1 in x 50\nL1 x y 10m\nC1 y 0 1u\n.tran 1u 2m 0 1u\n.control\nrun\nmeas tran v05 FIND v(y) AT=0.5m\nmeas tran v10 FIND v(y) AT=1m\nmeas tran v15 FIND v(y) AT=1.5m\n.endc');
    for (const [label, index] of [['v05', 500], ['v10', 1000], ['v15', 1500]]) assert.ok(Math.abs(transient.nodes.y[index] - value(label)) < 1e-3, `transient ${label}`);
    const ac = simulateAC([part('V1', 'voltage', 3, 'in', '0'), part('R1', 'resistor', 1000, 'in', 'a'), part('D1', 'diode', 0.7, 'a', '0'), part('C1', 'capacitor', 10e-6, 'a', '0')], [], [], { startFrequency: 10, stopFrequency: 1e5, pointsPerDecade: 1 });
    value = await measure('ac', `V1 in 0 DC 3 AC 1\nR1 in a 1000\nD1 a 0 DD\nC1 a 0 10u\n.model DD D(Is=${saturation(0.7, 1)} N=1)\n.ac dec 1 10 100k\n.control\nrun\nmeas ac m100 FIND vdb(a) AT=100\nmeas ac p100 FIND vp(a) AT=100\n.endc`);
    assert.ok(Math.abs(20 * Math.log10(ac.nodes.a.magnitude[1]) - value('m100')) < 1e-2, 'AC magnitude');
    assert.ok(Math.abs(ac.nodes.a.phase[1] - value('p100') * 180 / Math.PI) < 1e-2, 'AC phase');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('opt-in exported transistor and op-amp netlists agree with the built-in solver in ngspice', { skip: !enabled }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-device-crosscheck-'));
  const part = (id, type, value, n1, n2, n3, extra = {}) => ({ id, type, label: id, value, unit: '', n1, n2, ...(n3 ? { n3 } : {}), ...extra });
  const measure = async (name, components, control, acSource) => {
    let netlist = buildSpiceNetlist(components).replace(/\.end\n$/, '');
    if (acSource) netlist = netlist.replace(new RegExp(`^(${acSource} \\S+ \\S+) (\\S+)$`, 'm'), '$1 DC $2 AC 1');
    const file = join(root, `${name}.cir`);
    await writeFile(file, `${netlist}.control\n${control}\n.endc\n.end\n`);
    const result = await runProcess({ executable, args: ['-b', file], cwd: root, timeoutMs: 30_000, maxOutputBytes: 1024 * 1024 });
    assert.equal(result.ok, true, result.error || result.stderr);
    return (label) => Number(result.stdout.match(new RegExp(`^${label}\\s*=\\s*([-0-9.eE+]+)`, 'mi'))[1]);
  };
  try {
    const amplifier = [part('VCC', 'voltage', 12, 'vcc', '0'), part('VS', 'voltage', 0, 's', '0'), part('CIN', 'capacitor', 10e-6, 's', 'b'), part('R1', 'resistor', 47e3, 'vcc', 'b'), part('R2', 'resistor', 10e3, 'b', '0'), part('RC', 'resistor', 2.2e3, 'vcc', 'c'), part('RE', 'resistor', 470, 'e', '0'), part('CE', 'capacitor', 100e-6, 'e', '0'), part('Q1', 'npn', 120, 'c', 'b', 'e')];
    let value = await measure('ce', amplifier, 'op\nprint v(b) v(c) v(e)');
    const bias = simulateDC(amplifier);
    for (const node of ['b', 'c', 'e']) assert.ok(Math.abs(bias.nodes[node] - value(`v\\(${node}\\)`)) < 1e-4, `BJT bias v(${node})`);
    value = await measure('ce-ac', amplifier, 'ac dec 1 10 100k\nmeas ac g1k FIND vdb(c) AT=1000', 'VS');
    const gain = simulateAC(amplifier, [], [], { startFrequency: 10, stopFrequency: 1e5, pointsPerDecade: 1, inputSourceId: 'VS' });
    assert.ok(Math.abs(20 * Math.log10(gain.nodes.c.magnitude[2]) - value('g1k')) < 1e-2, 'BJT amplifier gain');
    const inverter = [part('VDD', 'voltage', 5, 'vdd', '0'), part('VI', 'voltage', 2.4, 'in', '0'), part('MP', 'pmos', 1, 'out', 'in', 'vdd', { kp: 0.04 }), part('MN', 'nmos', 1, 'out', 'in', '0'), part('RL', 'resistor', 1e5, 'out', '0')];
    value = await measure('cmos', inverter, 'op\nprint v(out)');
    assert.ok(Math.abs(simulateDC(inverter).nodes.out - value('v\\(out\\)')) < 1e-4, 'CMOS inverter output');
    const opamp = [part('V1', 'voltage', 0.5, 'in', '0'), part('R1', 'resistor', 1e3, 'in', 'm'), part('R2', 'resistor', 10e3, 'm', 'out'), part('U1', 'opamp', 15, '0', 'm', 'out')];
    value = await measure('opamp', opamp, 'op\nprint v(out)\nac dec 1 1k 1meg\nmeas ac a2 FIND vdb(out) AT=100k', 'V1');
    assert.ok(Math.abs(simulateDC(opamp).nodes.out - value('v\\(out\\)')) < 1e-4, 'op-amp DC output');
    const response = simulateAC(opamp, [], [], { startFrequency: 1e3, stopFrequency: 1e6, pointsPerDecade: 1 });
    assert.ok(Math.abs(20 * Math.log10(response.nodes.out.magnitude[2]) - value('a2')) < 1e-2, 'op-amp closed-loop bandwidth');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('opt-in transistor capacitances agree with ngspice in AC and transient analyses', { skip: !enabled }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'openentc-capacitance-crosscheck-'));
  const part = (id, type, value, n1, n2, n3, extra = {}) => ({ id, type, label: id, value, unit: '', n1, n2, ...(n3 ? { n3 } : {}), ...extra });
  const measure = async (name, netlist, control) => {
    const file = join(root, `${name}.cir`);
    await writeFile(file, `${netlist}.options reltol=1e-6 vntol=1e-9\n.control\n${control}\n.endc\n.end\n`);
    const result = await runProcess({ executable, args: ['-b', file], cwd: root, timeoutMs: 60_000, maxOutputBytes: 1024 * 1024 });
    assert.equal(result.ok, true, result.error || result.stderr);
    return (label) => Number(result.stdout.match(new RegExp(`^${label}\\s*=\\s*([-0-9.eE+]+)`, 'mi'))[1]);
  };
  try {
    const amplifier = [part('VCC', 'voltage', 12, 'vcc', '0'), part('VS', 'voltage', 0, 's', '0'), part('RS', 'resistor', 1e3, 's', 's2'), part('CIN', 'capacitor', 10e-6, 's2', 'b'), part('R1', 'resistor', 47e3, 'vcc', 'b'), part('R2', 'resistor', 10e3, 'b', '0'), part('RC', 'resistor', 2.2e3, 'vcc', 'c'), part('RE', 'resistor', 470, 'e', '0'), part('CE', 'capacitor', 100e-6, 'e', '0'), part('Q1', 'npn', 100, 'c', 'b', 'e')];
    const acNetlist = buildSpiceNetlist(amplifier).replace(/\.end\n$/, '').replace(/^(VS s 0) 0$/m, '$1 DC 0 AC 1');
    let value = await measure('miller', acNetlist, 'ac dec 1 1meg 100meg\nmeas ac m1 FIND vdb(c) AT=1meg\nmeas ac m2 FIND vdb(c) AT=10meg\nmeas ac m3 FIND vdb(c) AT=100meg');
    const response = simulateAC(amplifier, [], [], { startFrequency: 1e6, stopFrequency: 1e8, pointsPerDecade: 1, inputSourceId: 'VS' });
    ['m1', 'm2', 'm3'].forEach((label, index) => assert.ok(Math.abs(20 * Math.log10(response.nodes.c.magnitude[index]) - value(label)) < 1e-3, `Miller roll-off ${label}`));
    const step = 2.5e-11;
    const gateDrive = [part('VDD', 'voltage', 10, 'vdd', '0'), part('VG', 'voltage', 10, 'in', '0'), part('RG', 'resistor', 1e3, 'in', 'g'), part('RD', 'resistor', 100, 'vdd', 'd'), part('M1', 'nmos', 2, 'd', 'g', '0', { kp: 0.05 })];
    const tranNetlist = buildSpiceNetlist(gateDrive).replace(/\.end\n$/, '').replace(/^VG in 0 10$/m, `VG in 0 PWL(0 0 ${step} 10)`);
    value = await measure('gate', tranNetlist, `tran ${step} 60n 0 ${step}\nmeas tran g1 FIND v(g) AT=20n\nmeas tran d1 FIND v(d) AT=20n\nmeas tran d2 FIND v(d) AT=60n`);
    const transient = simulateTransient(gateDrive, [], [], { stopTime: 60e-9, timeStep: step, stimulus: { sourceId: 'VG', shape: 'step' } });
    assert.ok(Math.abs(transient.nodes.g[800] - value('g1')) < 0.01, 'gate voltage during the Miller plateau');
    assert.ok(Math.abs(transient.nodes.d[800] - value('d1')) < 2e-3, 'drain voltage while switching');
    assert.ok(Math.abs(transient.nodes.d[2400] - value('d2')) < 1e-3, 'drain voltage after switching');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
