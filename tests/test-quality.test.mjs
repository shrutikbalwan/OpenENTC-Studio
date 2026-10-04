// The coverage and mutation tools themselves: lcov parsing, unloaded files, group thresholds, the
// "thresholds only go up" rule, and that every mutant still matches the code it mutates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseLcov, withUnloaded, summarise, checkThresholds, compareWithBase, sourceFiles } from '../scripts/coverage.mjs';
import { MUTANTS, runMutant } from '../scripts/mutation-check.mjs';

const lcov = 'SF:src/a.js\nFNF:2\nFNH:1\nBRF:4\nBRH:3\nLF:10\nLH:9\nend_of_record\nSF:packages/x/src/b.mjs\nFNF:0\nFNH:0\nBRF:0\nBRH:0\nLF:5\nLH:5\nend_of_record\n';

test('lcov is parsed per file and unloaded sources count as uncovered', () => {
  const files = parseLcov(lcov);
  assert.deepEqual(files.get('src/a.js'), { lines: [10, 9], branches: [4, 3], functions: [2, 1] });
  const all = withUnloaded(files, ['src/a.js', 'src/c.js'], () => '// comment\n\nconst a = 1;\nexport { a };\n');
  assert.deepEqual(all.get('src/c.js').lines, [2, 0]);
  const summary = summarise(all, { ui: { files: ['src/**'] }, pkg: { files: ['packages/*/src/**'] } });
  assert.equal(summary.ui.lines, 75);
  assert.deepEqual(summary.ui.unloaded, ['src/c.js']);
  assert.equal(summary.pkg.functions, 100, 'no functions counts as fully covered');
});

test('thresholds fail below the minimum, on empty groups, and when lowered against the base', () => {
  const summary = { ui: { files: 2, lines: 75, branches: 75, functions: 50 }, none: { files: 0, lines: 100, branches: 100, functions: 100 } };
  const failures = checkThresholds(summary, { ui: { files: ['src/**'], lines: 80, branches: 70 }, none: { files: ['nothing/**'] } });
  assert.equal(failures.length, 2);
  assert.match(failures[0], /ui: lines 75 % is below the threshold 80 %/);
  assert.match(failures[1], /none: no files matched/);
  assert.deepEqual(compareWithBase({ groups: { ui: { lines: 80 } } }, { groups: { ui: { lines: 80 } } }), []);
  assert.match(compareWithBase({ groups: { ui: { lines: 79 } } }, { groups: { ui: { lines: 80 } } })[0], /lowered from 80 to 79/);
  assert.match(compareWithBase({ groups: {} }, { groups: { ui: { lines: 80 } } })[0], /group removed/);
});

test('the source list covers the browser UI and packages', () => {
  const files = sourceFiles();
  assert.ok(files.includes('src/app.js') && files.includes('packages/errors/src/index.mjs'));
  assert.ok(files.every((file) => !file.includes('\\')), 'paths use forward slashes on every platform');
});

test('every mutant still matches its source and names existing tests', () => {
  for (const mutant of MUTANTS) {
    assert.ok(readFileSync(new URL(`../${mutant.file}`, import.meta.url), 'utf8').includes(mutant.from), `${mutant.name}: pattern is current`);
    for (const file of mutant.tests) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${mutant.name}: ${file}`);
    assert.notEqual(mutant.from, mutant.to);
  }
});

test('the mutation runner restores files and treats failing baselines as invalid', () => {
  const mutant = MUTANTS[0];
  const before = readFileSync(new URL(`../${mutant.file}`, import.meta.url), 'utf8');
  assert.equal(runMutant(mutant, () => ({ status: 1 })).status, 'invalid');
  let calls = 0;
  assert.equal(runMutant(mutant, () => ({ status: calls++ === 0 ? 0 : 1 })).status, 'killed');
  calls = 0;
  assert.equal(runMutant(mutant, () => ({ status: 0 })).status, 'survived');
  assert.equal(readFileSync(new URL(`../${mutant.file}`, import.meta.url), 'utf8'), before, 'source restored');
  assert.equal(runMutant({ ...mutant, from: 'no such text anywhere' }, () => ({ status: 0 })).status, 'stale');
  assert.equal(runMutant({ ...mutant, tests: ['tests/missing.test.mjs'] }, () => ({ status: 0 })).status, 'invalid');
});

test('external-tool report: unavailable is never a pass, and failures win', async () => {
  const { reportState, tapCounts, testState, markdownTable } = await import('../scripts/external-tools-report.mjs');
  assert.equal(reportState('not-configured'), 'unavailable');
  assert.equal(reportState('not-run'), 'skipped');
  assert.equal(reportState('passed'), 'passed');
  assert.equal(reportState('something-new'), 'failed', 'an unknown state is treated as a failure');
  const counts = tapCounts('# tests 6\n# pass 0\n# fail 0\n# skipped 6\n');
  assert.deepEqual(counts, { tests: 6, pass: 0, fail: 0, skipped: 6 });
  assert.equal(testState(counts, false), 'unavailable');
  assert.equal(testState(counts, true), 'skipped');
  assert.equal(testState({ pass: 5, fail: 1 }, true), 'failed');
  assert.equal(testState({ pass: 5, fail: 0 }, true), 'passed');
  assert.match(markdownTable([{ tool: 'ngspice', check: 'a|b', state: 'unavailable', detail: 'x' }]), /\| ngspice \| a\|b \| ⚪ unavailable \| x \|/);
});
