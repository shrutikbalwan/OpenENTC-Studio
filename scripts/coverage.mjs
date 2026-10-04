#!/usr/bin/env node
// Coverage with Node's built-in V8 coverage (no extra dependency).
//
//   node scripts/coverage.mjs                 run the unit tests with coverage and check thresholds
//   node scripts/coverage.mjs --lcov file     reuse an existing lcov report instead of running tests
//   node scripts/coverage.mjs --compare-base origin/main
//                                             also fail if coverage-thresholds.json lowers any
//                                             threshold compared with that git revision
//
// Writes coverage/lcov.info and coverage/summary.json. Source files that no test loads are counted
// as 0 % covered (Node only reports loaded files), so an untested module cannot raise the total.
// Thresholds live in coverage-thresholds.json, per group, for lines, branches and functions. Raise
// them as coverage improves; CI's --compare-base check stops them from silently going down.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const rel = (file) => path.relative(root, file).split(path.sep).join('/');

/** Every JavaScript source file that coverage should account for. */
export function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.m?js$/.test(entry.name)) out.push(rel(full));
    }
  };
  walk(path.join(root, 'src'));
  for (const entry of readdirSync(path.join(root, 'packages'), { withFileTypes: true })) if (entry.isDirectory()) walk(path.join(root, 'packages', entry.name, 'src'));
  return out.sort();
}

/** Parse an lcov report into per-file totals. */
export function parseLcov(text) {
  const files = new Map();
  for (const block of text.split('end_of_record')) {
    const sf = /^SF:(.+)$/m.exec(block);
    if (!sf) continue;
    const n = (key) => Number((new RegExp(`^${key}:(\\d+)$`, 'm').exec(block) ?? [0, 0])[1]);
    const file = path.isAbsolute(sf[1]) ? rel(sf[1]) : sf[1].split(path.sep).join('/');
    files.set(file, { lines: [n('LF'), n('LH')], branches: [n('BRF'), n('BRH')], functions: [n('FNF'), n('FNH')] });
  }
  return files;
}

/** Add unloaded source files as uncovered (non-blank, non-comment lines). */
export function withUnloaded(files, sources, read = (file) => readFileSync(path.join(root, file), 'utf8')) {
  const out = new Map(files);
  for (const file of sources) {
    if (out.has(file)) continue;
    const lines = read(file).split('\n').filter((line) => line.trim() && !/^\s*(\/\/|\*|\/\*)/.test(line)).length;
    out.set(file, { lines: [lines, 0], branches: [0, 0], functions: [0, 0], unloaded: true });
  }
  return out;
}

const percent = ([total, hit]) => (total ? Math.round((hit / total) * 1000) / 10 : 100);

export function summarise(files, groups) {
  const summary = {};
  for (const [name, group] of Object.entries(groups)) {
    const patterns = group.files.map((glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*')}$`));
    const members = [...files.entries()].filter(([file]) => patterns.some((pattern) => pattern.test(file)));
    const sum = (kind) => members.reduce((acc, [, totals]) => [acc[0] + totals[kind][0], acc[1] + totals[kind][1]], [0, 0]);
    summary[name] = { files: members.length, unloaded: members.filter(([, t]) => t.unloaded).map(([f]) => f), lines: percent(sum('lines')), branches: percent(sum('branches')), functions: percent(sum('functions')) };
  }
  return summary;
}

export function checkThresholds(summary, groups) {
  const failures = [];
  for (const [name, group] of Object.entries(groups)) {
    for (const kind of ['lines', 'branches', 'functions']) {
      if (group[kind] !== undefined && summary[name][kind] < group[kind]) failures.push(`${name}: ${kind} ${summary[name][kind]} % is below the threshold ${group[kind]} %`);
    }
    if (!summary[name].files) failures.push(`${name}: no files matched ${group.files.join(', ')}`);
  }
  return failures;
}

/** Thresholds may only go up: compare with coverage-thresholds.json at a git revision. */
export function compareWithBase(current, base) {
  const lowered = [];
  for (const [name, group] of Object.entries(base.groups ?? {})) {
    if (!current.groups[name]) { lowered.push(`${name}: group removed`); continue; }
    for (const kind of ['lines', 'branches', 'functions']) if ((current.groups[name][kind] ?? 0) < (group[kind] ?? 0)) lowered.push(`${name}: ${kind} threshold lowered from ${group[kind]} to ${current.groups[name][kind] ?? 0}`);
  }
  return lowered;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const config = JSON.parse(readFileSync(path.join(root, 'coverage-thresholds.json'), 'utf8'));
  mkdirSync(path.join(root, 'coverage'), { recursive: true });
  let lcovPath = arg('--lcov');
  if (!lcovPath) {
    lcovPath = path.join(root, 'coverage', 'lcov.info');
    const result = spawnSync(process.execPath, ['--test', '--experimental-test-isolation=none', '--experimental-test-coverage', '--test-reporter=lcov', `--test-reporter-destination=${lcovPath}`, '--test-reporter=dot', '--test-reporter-destination=stdout'], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) { console.error('Tests failed; coverage not checked.'); process.exit(result.status ?? 1); }
  }
  const files = withUnloaded(parseLcov(readFileSync(lcovPath, 'utf8')), sourceFiles());
  const summary = summarise(files, config.groups);
  writeFileSync(path.join(root, 'coverage', 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log('\nCoverage (lines / branches / functions):');
  for (const [name, s] of Object.entries(summary)) console.log(`  ${name.padEnd(24)} ${String(s.lines).padStart(5)} / ${String(s.branches).padStart(5)} / ${String(s.functions).padStart(5)}  (${s.files} files${s.unloaded.length ? `, ${s.unloaded.length} not loaded by any test` : ''})`);
  const failures = checkThresholds(summary, config.groups);
  const base = arg('--compare-base');
  if (base) {
    let baseText = null;
    try { baseText = execFileSync('git', ['show', `${base}:coverage-thresholds.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { console.log(`No coverage-thresholds.json at ${base}; nothing to compare.`); }
    if (baseText) failures.push(...compareWithBase(config, JSON.parse(baseText)));
  }
  if (failures.length) { console.error(`\nCoverage check failed:\n  ${failures.join('\n  ')}`); process.exit(1); }
  console.log('\nCoverage thresholds met.');
}
