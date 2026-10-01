import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess } from '../packages/process-runner/src/index.mjs';
import { createNgspiceAdapter } from '../packages/engine-sdk/src/ngspice.mjs';
import { simulateAC, simulateDC, simulateTransient } from '../src/engines/circuit-engine.js';

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
