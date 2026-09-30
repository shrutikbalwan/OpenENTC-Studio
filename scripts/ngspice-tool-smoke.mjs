import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runProcess } from '../packages/process-runner/src/index.mjs';

const executable = process.env.OPENENTC_NGSPICE || '';
if (!executable) {
  process.stdout.write(JSON.stringify({ state: 'not-configured', env: 'OPENENTC_NGSPICE' }, null, 2) + '\n');
  process.exitCode = 2;
} else {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openentc-ngspice-'));
  const netlist = path.join(dir, 'divider.cir');
  const output = path.join(dir, 'divider.out');
  await fs.writeFile(netlist, `* deterministic resistor divider\nV1 in 0 9\nR1 in out 1k\nR2 out 0 1k\n.op\n.control\nrun\nprint v(out)\n.endc\n.end\n`, 'utf8');
  const result = await runProcess({ executable, args: ['-b', '-o', output, netlist], timeoutMs: 20_000, maxOutputBytes: 128 * 1024 });
  const report = await fs.readFile(output, 'utf8').catch(() => '');
  const passed = result.ok && /v\(out\).*4\.5|4\.500/i.test(report);
  process.stdout.write(JSON.stringify({ state: passed ? 'passed' : 'failed', executable, output: `${result.stdout}\n${result.stderr}`.trim(), report, error: result.error }, null, 2) + '\n');
  if (!passed) process.exitCode = 1;
}
