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
  for (const path of ['.github/CODEOWNERS', '.github/pull_request_template.md', '.github/dependabot.yml', '.github/workflows/codeql.yml', 'docs/governance/BRANCH-PROTECTION.md', 'docs/governance/RELEASE-POLICY.md', 'CHANGELOG.md', 'SECURITY.md']) assert.ok(existsSync(new URL(path, root)), path);
  const template = read('.github/pull_request_template.md');
  for (const heading of ['Scope', 'Test evidence', 'Numerical references', 'Security impact', 'Accessibility impact', 'Project schema compatibility', 'Hardware claims', 'Licence and provenance']) assert.match(template, new RegExp(`## ${heading}`), heading);
  const dependabot = read('.github/dependabot.yml');
  for (const ecosystem of ['npm', 'cargo', 'github-actions']) assert.match(dependabot, new RegExp(`package-ecosystem: ${ecosystem}`), ecosystem);
  assert.match(read('SECURITY.md'), /Report a vulnerability/);
});
