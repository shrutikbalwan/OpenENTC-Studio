import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const port = Number(process.env.OPENENTC_PERF_PORT || 4179);
const url = `http://127.0.0.1:${port}/`;
const chromeCandidates = [
  process.env.OPENENTC_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
let chrome = null;
for (const candidate of chromeCandidates) {
  try { await access(candidate); chrome = candidate; break; } catch { /* try next candidate */ }
}
if (!chrome) {
  process.stdout.write(JSON.stringify({ state: 'not-configured', env: 'OPENENTC_CHROME' }, null, 2) + '\n');
  process.exitCode = 2;
} else {
  const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  try {
    const serverDeadline = Date.now() + 10_000;
    while (!serverOutput.includes(`http://127.0.0.1:${port}`)) {
      if (Date.now() > serverDeadline) throw new Error(`preview server did not start: ${serverOutput}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const started = performance.now();
    const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--dump-dom', url], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    browser.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    browser.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const timeout = setTimeout(() => browser.kill(), 30_000);
    const [result] = await once(browser, 'exit');
    clearTimeout(timeout);
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    const accessibility = {
      moduleNavigation: /<nav[^>]+aria-label=["']Engineering modules["']/i.test(stdout),
      commandPaletteControl: /aria-label=["']Open command palette["']/i.test(stdout),
      projectNameControl: /aria-label=["']Project name["']/i.test(stdout),
    };
    const passed = result === 0 && /OpenENTC Studio/i.test(stdout) && /Mission control/i.test(stdout) && Object.values(accessibility).every(Boolean);
    const report = { state: passed ? 'passed' : 'failed', chrome, url, elapsedMs, exitCode: result, domBytes: Buffer.byteLength(stdout), accessibility, stderr: stderr.trim().slice(0, 2_000) };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!passed) process.exitCode = 1;
  } finally {
    server.kill();
  }
}
