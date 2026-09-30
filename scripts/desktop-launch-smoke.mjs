import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const executable = process.env.OPENENTC_DESKTOP_EXE || resolve(import.meta.dirname, '../apps/desktop/src-tauri/target/release/openentc-studio.exe');
try { await access(executable); } catch {
  process.stdout.write(`${JSON.stringify({ state: 'not-configured', executable, reason: 'desktop executable is missing' }, null, 2)}\n`);
  process.exitCode = 2;
}
if (process.exitCode !== 2) {
  const child = spawn(executable, [], { windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const started = Date.now();
  const result = await new Promise((resolveResult) => {
    const timer = setTimeout(() => {
      resolveResult({ state: 'running-observation', exitCode: null });
      child.kill();
    }, Number(process.env.OPENENTC_DESKTOP_SMOKE_MS || 5_000));
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolveResult({ state: code === 0 ? 'exited-cleanly' : 'startup-failed', exitCode: code, signal });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolveResult({ state: 'spawn-failed', exitCode: null, error: error.message });
    });
  });
  const report = { ...result, executable, elapsedMs: Date.now() - started, stdout: stdout.trim().slice(0, 2_000), stderr: stderr.trim().slice(0, 4_000), engineRun: false };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.state === 'spawn-failed') process.exitCode = 2;
}
