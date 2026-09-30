import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../packages/process-runner/src/index.mjs';

// These are opt-in integration probes. The normal verification gate never
// searches for, installs, or invokes user-managed engineering tools.
const probes = [
  { id: 'arduino-cli', env: 'OPENENTC_ARDUINO_CLI', args: ['version'] },
  { id: 'kicad-cli', env: 'OPENENTC_KICAD_CLI', args: ['--version'] }
];

for (const probe of probes) {
  const executable = process.env[probe.env] || '';
  test(`opt-in ${probe.id} executable smoke reports version output`, { skip: !executable }, async () => {
    assert.match(executable, /^(?:[A-Za-z]:[\\/]|[\\/])/);
    const result = await runProcess({ executable, args: probe.args, cwd: process.cwd(), timeoutMs: 10_000, maxOutputBytes: 64 * 1024 });
    assert.equal(result.ok, true, result.error || result.stderr);
    assert.ok(`${result.stdout}\n${result.stderr}`.trim().length > 0, `${probe.id} returned no version output`);
  });
}
