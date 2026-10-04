// Security documentation and CI controls that the threat model relies on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the threat model covers every trust boundary and links the AI data flow', () => {
  const model = read('docs/security/threat-model.md');
  for (const boundary of ['Project import', 'Parsers', 'Rendering', 'AI assistant', 'Credentials', 'Native processes', 'Device access', 'Artifact writes', 'Diagnostics export', 'Supply chain', 'Offline cache']) assert.match(model, new RegExp(`\\| ${boundary}`), boundary);
  assert.match(model, /not independently reviewed/);
  assert.match(model, /ai-data-flow\.md/);
  assert.match(read('SECURITY.md'), /threat-model\.md/);
});

test('the AI data-flow document matches what the assistant actually sends', () => {
  const flow = read('docs/security/ai-data-flow.md');
  const assistant = read('packages/assistant/src/index.mjs');
  for (const option of ["redirect: 'error'", "credentials: 'omit'", "referrerPolicy: 'no-referrer'"]) assert.ok(assistant.includes(option), option);
  assert.match(flow, /credentials: 'omit'/);
  assert.match(flow, /3000 characters/);
  const shell = read('src/shell/assistant.js');
  assert.match(shell, /text\.length > 3000/);
  assert.doesNotMatch(shell, /title: state\.project\.name/, 'the project name is not sent to the AI');
  assert.match(shell, /settings\.shareLab \? assistantLabContext/, 'lab data is sent only when the user allows it');
});

test('CI audits npm and Cargo dependencies with a pinned cargo-audit', () => {
  const workflow = read('.github/workflows/verify.yml');
  assert.match(workflow, /security-audit:/);
  assert.match(workflow, /run: npm audit --audit-level=low/);
  assert.match(workflow, /cargo install cargo-audit --version \d+\.\d+\.\d+ --locked/);
  assert.match(workflow, /run: cargo audit/);
});
