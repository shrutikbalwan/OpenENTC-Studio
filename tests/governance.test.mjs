import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const workflows = readdirSync(new URL('.github/workflows/', root)).filter((name) => /\.ya?ml$/.test(name));

test('every GitHub Action is pinned to a full commit SHA with its version noted', () => {
  assert.ok(workflows.length >= 2);
  for (const name of workflows) {
    for (const line of read(`.github/workflows/${name}`).split('\n')) {
      const match = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(#.*)?$/.exec(line);
      if (!match || match[1].startsWith('./')) continue;
      assert.match(match[1], /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${name}: ${match[1]} is not pinned to a commit SHA`);
      assert.ok(match[2], `${name}: ${match[1]} needs a "# version" comment`);
    }
  }
});

test('workflows run with least privilege and never expose credentials to pull requests', () => {
  for (const name of workflows) {
    const text = read(`.github/workflows/${name}`);
    assert.match(text, /^permissions:\s*\n\s+contents:\s*read\s*$/m, `${name}: top-level permissions must be contents: read`);
    assert.doesNotMatch(text, /pull_request_target/, `${name}: pull_request_target runs untrusted code with a privileged token`);
    assert.doesNotMatch(text, /\$\{\{\s*secrets\./, `${name}: CI must not use repository secrets`);
    assert.doesNotMatch(text, /write-all|contents:\s*write/, `${name}: no write access to repository contents`);
    const checkouts = text.split('\n').filter((line) => /uses:\s*actions\/checkout@/.test(line)).length;
    const persisted = (text.match(/persist-credentials:\s*false/g) ?? []).length;
    assert.equal(persisted, checkouts, `${name}: every checkout must set persist-credentials: false`);
  }
});

test('governance files exist', () => {
  for (const path of ['.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md', '.github/dependabot.yml', '.github/workflows/codeql.yml', 'docs/governance/BRANCH-PROTECTION.md', 'docs/governance/RELEASE-POLICY.md', 'CHANGELOG.md', 'SECURITY.md']) assert.ok(existsSync(new URL(path, root)), path);
  const template = read('.github/PULL_REQUEST_TEMPLATE.md');
  for (const heading of ['Scope', 'Test evidence', 'Numerical references', 'Security impact', 'Accessibility impact', 'Project schema compatibility', 'Hardware claims', 'Licence and provenance']) assert.match(template, new RegExp(`## ${heading}`), heading);
  const dependabot = read('.github/dependabot.yml');
  for (const ecosystem of ['npm', 'cargo', 'github-actions']) assert.match(dependabot, new RegExp(`package-ecosystem: ${ecosystem}`), ecosystem);
  assert.match(read('SECURITY.md'), /Report a vulnerability/);
});

test('CI runs the browser journeys and keeps failure traces', () => {
  const workflow = read('.github/workflows/verify.yml');
  assert.match(workflow, /browser-e2e:/);
  assert.match(workflow, /npx playwright-core install --with-deps chromium/);
  assert.match(workflow, /run: npm run test:e2e/);
  assert.match(workflow, /if: failure\(\)[\s\S]*?path: test-results\/e2e\//);
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:e2e'], /tests\/e2e\/\*\.e2e\.mjs/);
  assert.equal(pkg.devDependencies['playwright-core'], '1.56.1', 'pinned exactly');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'still no runtime dependencies');
});

test('CI checks coverage thresholds against main and runs the mutation check', () => {
  const workflow = read('.github/workflows/verify.yml');
  assert.match(workflow, /coverage:\n\s+name: Coverage and mutation checks/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /run: npm run build\n\s+- name: Check coverage thresholds/, 'tests read dist/, so the build runs first');
  assert.match(workflow, /run: node scripts\/coverage\.mjs --compare-base origin\/main/);
  assert.match(workflow, /run: npm run test:mutation/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.coverage, 'node scripts/coverage.mjs');
  assert.equal(pkg.scripts['test:mutation'], 'node scripts/mutation-check.mjs');
  const thresholds = JSON.parse(read('coverage-thresholds.json'));
  for (const [name, group] of Object.entries(thresholds.groups)) for (const kind of ['lines', 'branches', 'functions']) assert.ok(group[kind] > 0, `${name} ${kind} threshold is set`);
});

test('accessibility checks use a pinned axe-core and run in the browser journeys', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.devDependencies['axe-core'], '4.13.0', 'pinned exactly');
  assert.match(read('docs/dependencies.md'), /`axe-core` \| 4\.13\.0 \| MPL-2\.0/);
  assert.match(read('tests/e2e/accessibility.e2e.mjs'), /wcag22aa/);
  assert.match(read('docs/accessibility.md'), /not a WCAG conformance claim/i);
});

test('the version shown in the app and in diagnostic reports matches package.json', async () => {
  const { APP_VERSION, ISSUES_URL } = await import('../src/data/app-info.js');
  assert.equal(APP_VERSION, JSON.parse(read('package.json')).version);
  assert.match(ISSUES_URL, /^https:\/\/github\.com\/shrutikbalwan\/OpenENTC-Studio\/issues\//);
});
