import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProcess } from '../packages/process-runner/src/index.mjs';
import { createNgspiceAdapter } from '../packages/engine-sdk/src/ngspice.mjs';

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
