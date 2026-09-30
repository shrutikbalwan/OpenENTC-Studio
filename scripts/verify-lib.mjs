import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

export const verificationSteps = [
  ['format', ['run', 'format:check']],
  ['lint', ['run', 'lint']],
  ['type contracts', ['run', 'typecheck']],
  ['python worker', ['run', 'worker:check']],
  ['browser build', ['run', 'build']],
  ['tests', ['test']]
];

export function runVerification(steps = verificationSteps, run = spawnSync) {
  const npmCli = process.env.npm_execpath || resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  for (const [name, args] of steps) {
    console.log(`\n[verify] ${name}`);
    const result = run(process.execPath, [npmCli, ...args], { stdio: 'inherit' });
    if (result.error) {
      console.error(`[verify] ${name} could not start: ${result.error.message}`);
      return 1;
    }
    if (result.status !== 0) {
      console.error(`[verify] ${name} failed with exit code ${result.status ?? 1}.`);
      return result.status || 1;
    }
  }
  console.log('\n[verify] all checks passed');
  return 0;
}
