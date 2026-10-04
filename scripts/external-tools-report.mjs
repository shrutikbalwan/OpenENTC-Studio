#!/usr/bin/env node
// Run every opt-in external-tool check and report each tool as one of:
//   passed       the tool ran and its checks passed
//   failed       the tool ran and a check failed (exit code 1)
//   unavailable  no executable was configured (OPENENTC_* variable unset): nothing was run
//   skipped      the check exists but was skipped for another reason (for example the platform)
// "unavailable" is never counted as a pass. Writes external-tools-report.json and, in GitHub
// Actions, a table in the job summary.
//
//   OPENENTC_NGSPICE=/usr/bin/ngspice OPENENTC_GHDL=... node scripts/external-tools-report.mjs
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 });
const firstLine = (text) => String(text ?? '').split('\n').map((line) => line.trim()).find((line) => /[A-Za-z0-9]/.test(line)) ?? '';

/** Map a smoke-script state to a report state. */
export function reportState(state) {
  return { passed: 'passed', failed: 'failed', 'not-configured': 'unavailable', 'not-run': 'skipped' }[state] ?? 'failed';
}

/** Count a TAP stream's results (node --test --test-reporter=tap). */
export function tapCounts(text) {
  const count = (name) => Number((new RegExp(`^# ${name} (\\d+)$`, 'm').exec(text) ?? [0, 0])[1]);
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped') };
}

/** One state for a group of tests: failed > passed > skipped/unavailable. */
export function testState(counts, configured) {
  if (counts.fail > 0) return 'failed';
  if (counts.pass > 0) return 'passed';
  return configured ? 'skipped' : 'unavailable';
}

export function markdownTable(rows) {
  const icon = { passed: '✅', failed: '❌', unavailable: '⚪', skipped: '⏭️' };
  return ['| Tool | Check | State | Detail |', '|---|---|---|---|', ...rows.map((row) => `| ${row.tool} | ${row.check} | ${icon[row.state] ?? ''} ${row.state} | ${String(row.detail ?? '').replaceAll('|', '\\|').slice(0, 120)} |`)].join('\n');
}

function main() {
  const rows = [];
  const versions = node(['scripts/native-tool-smoke.mjs']);
  for (const result of JSON.parse(versions.stdout || '{"results":[]}').results) rows.push({ tool: result.id, check: 'version probe', state: reportState(result.state), detail: result.state === 'not-configured' ? `${result.env} not set` : firstLine(result.output) || result.error });

  const hdl = node(['scripts/hdl-tool-smoke.mjs']);
  let hdlResults = {};
  try { hdlResults = JSON.parse(hdl.stdout).results ?? JSON.parse(hdl.stdout); } catch { rows.push({ tool: 'hdl', check: 'HDL smoke', state: 'failed', detail: firstLine(hdl.stderr) }); }
  for (const [check, result] of Object.entries(hdlResults)) if (result && typeof result === 'object' && 'state' in result) rows.push({ tool: check.replace(/[A-Z].*$/, ''), check: `HDL smoke: ${check}`, state: reportState(result.state), detail: result.reason ?? result.error ?? '' });

  const ngspiceConfigured = Boolean(process.env.OPENENTC_NGSPICE);
  const ngspice = tapCounts(node(['--test', '--experimental-test-isolation=none', '--test-reporter=tap', 'tests/ngspice.integration.test.mjs']).stdout);
  rows.push({ tool: 'ngspice', check: 'built-in solver vs ngspice (DC, AC, transient, devices)', state: testState(ngspice, ngspiceConfigured), detail: `${ngspice.pass} passed, ${ngspice.fail} failed, ${ngspice.skipped} skipped` });

  const optional = tapCounts(node(['--test', '--experimental-test-isolation=none', '--test-reporter=tap', 'tests/optional-engines.integration.test.mjs']).stdout);
  rows.push({ tool: 'arduino-cli, kicad-cli', check: 'version probes', state: testState(optional, Boolean(process.env.OPENENTC_ARDUINO_CLI || process.env.OPENENTC_KICAD_CLI)), detail: `${optional.pass} passed, ${optional.fail} failed, ${optional.skipped} skipped` });

  const processTests = tapCounts(node(['--test', '--experimental-test-isolation=none', '--test-reporter=tap', 'tests/process-runner.test.mjs'], { OPENENTC_PROCESS_TESTS: '1' }).stdout);
  rows.push({ tool: 'process runner', check: 'real child processes: output limit, timeout, process-group cancellation', state: testState(processTests, true), detail: `${processTests.pass} passed, ${processTests.fail} failed, ${processTests.skipped} skipped` });

  const report = { generatedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, rows };
  writeFileSync(path.join(root, 'external-tools-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const table = markdownTable(rows);
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## External tools\n\n${table}\n\n⚪ unavailable means the tool was not installed or configured, so nothing ran. It is not a pass.\n`);
  if (rows.some((row) => row.state === 'failed')) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) main();
