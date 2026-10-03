import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

// SHA-256 of the unmodified GPL-3.0 text (https://www.gnu.org/licenses/gpl-3.0.txt).
const GPL3_SHA256 = '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986';

test('Node.js requirement agrees across package.json and setup documentation', () => {
  const engines = JSON.parse(read('package.json')).engines.node;
  assert.equal(engines, '>=22.8.0');
  for (const doc of ['README.md', 'CONTRIBUTING.md', 'docs/development.md', 'docs/support-matrix.md']) {
    const text = read(doc);
    assert.match(text, /22\.8\.0/, `${doc} states the Node.js version`);
    assert.doesNotMatch(text, /Node(\.js)? (1[0-9]|20|21)(\.\d+)? or newer/i, `${doc} has no outdated Node.js requirement`);
  }
});

test('LICENSE is the complete, unmodified GPL-3.0 text and the or-later grant is preserved', () => {
  const license = readFileSync(resolve(root, 'LICENSE'));
  assert.equal(createHash('sha256').update(license).digest('hex'), GPL3_SHA256);
  const notice = read('NOTICE');
  assert.match(notice, /either version 3 of the License, or \(at your option\) any later\s+version/);
  assert.match(notice, /SPDX-License-Identifier: GPL-3\.0-or-later/);
  assert.equal(JSON.parse(read('package.json')).license, 'GPL-3.0-or-later');
  assert.equal(JSON.parse(read('apps/desktop/package.json')).license, 'GPL-3.0-or-later');
  assert.match(read('apps/desktop/src-tauri/Cargo.toml'), /^license = "GPL-3\.0-or-later"$/m);
});

test('repository and policy documents exist', () => {
  for (const path of ['CODE_OF_CONDUCT.md', 'NOTICE', '.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md', 'docs/maintainers.md', 'docs/repository-metadata.md', 'docs/features.md', 'docs/support-matrix.md', 'docs/project-compatibility-policy.md', 'docs/deprecation-policy.md', 'docs/security-contact-setup.md', 'docs/development.md']) {
    assert.ok(existsSync(resolve(root, path)), `${path} exists`);
  }
  assert.match(read('.github/CODEOWNERS'), /PLACEHOLDER/);
  // The security contact document must not invent a private address.
  assert.doesNotMatch(read('docs/security-contact-setup.md'), /[\w.+-]+@[\w-]+\.[\w.]+/);
});

test('issue forms cover bugs, numerical errors, security routing, external engines and accessibility', () => {
  for (const name of ['bug', 'numerical-error', 'security-routing', 'external-engine', 'accessibility']) {
    const text = read(`.github/ISSUE_TEMPLATE/${name}.yml`);
    assert.match(text, /^name: .+/m, name);
    assert.match(text, /^body:/m, name);
  }
  const security = read('.github/ISSUE_TEMPLATE/security-routing.yml');
  assert.match(security, /Do NOT describe the problem/);
  assert.match(security, /required: true/);
  assert.match(read('.github/ISSUE_TEMPLATE/config.yml'), /blank_issues_enabled: false/);
});

test('README is a concise entry point whose local links resolve', () => {
  const docs = ['README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'docs/features.md', 'docs/support-matrix.md', 'docs/maintainers.md', 'docs/project-compatibility-policy.md', 'docs/deprecation-policy.md', 'docs/security-contact-setup.md', 'docs/repository-metadata.md'];
  const readme = read('README.md');
  assert.ok(readme.split('\n').length < 120, 'README stays short; the catalogue lives in docs/features.md');
  assert.match(readme, /## Quick start/);
  assert.match(readme, /npm ci/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /docs\/features\.md/);
  assert.match(read('docs/features.md'), /capabilities\/ledger\.json/);
  for (const doc of docs) {
    for (const [, target] of read(doc).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(resolve(root, dirname(doc), target)), `${doc} links to missing ${target}`);
    }
  }
});
