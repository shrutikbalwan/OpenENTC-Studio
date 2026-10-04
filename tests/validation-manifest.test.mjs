// The numerical validation manifest must point at real engines and real tests, and must never claim
// an independent review that has not happened (see docs/expert-review-checklist.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('validation/manifest.json'));

test('every validation entry names an existing engine, a known reference and an existing test', () => {
  const ids = new Set();
  for (const entry of manifest.entries) {
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`); ids.add(entry.id);
    assert.ok(existsSync(new URL(`../${entry.engine}`, import.meta.url)), `${entry.id}: engine ${entry.engine}`);
    assert.ok(manifest.references[entry.reference], `${entry.id}: reference ${entry.reference}`);
    assert.ok(typeof entry.tolerance === 'string' && entry.tolerance.length, `${entry.id}: tolerance`);
    const source = read(entry.test.file);
    assert.ok(source.includes(`test('${entry.test.name}'`) || source.includes(`test(\`${entry.test.name}\``), `${entry.id}: test "${entry.test.name}" exists in ${entry.test.file}`);
  }
  assert.ok(manifest.entries.length >= 20);
});

test('external-tool references carry a version, and no entry claims an independent review yet', () => {
  for (const [id, reference] of Object.entries(manifest.references)) if (reference.kind === 'external-tool') assert.match(reference.version ?? '', /\d/, `${id} has a version`);
  const allowed = new Set(['self-checked', 'independently-reviewed']);
  for (const entry of manifest.entries) {
    assert.ok(allowed.has(entry.review), `${entry.id}: review status`);
    // Changing this requires a signed-off review record in docs/reviews/ (none exists yet).
    if (entry.review === 'independently-reviewed') assert.ok(existsSync(new URL(`../docs/reviews/${entry.id}.md`, import.meta.url)), `${entry.id}: review record`);
  }
});

test('the expert-review checklist exists and covers the manifest', () => {
  const checklist = read('docs/expert-review-checklist.md');
  for (const heading of ['Scope', 'Model assumptions', 'Reference comparison', 'Teaching use', 'Sign-off']) assert.match(checklist, new RegExp(`## ${heading}`), heading);
  assert.match(checklist, /validation\/manifest\.json/);
});

test('every capability records its independent-review status honestly', () => {
  const ledger = JSON.parse(read('capabilities/ledger.json'));
  const schema = JSON.parse(read('capabilities/ledger.schema.json'));
  const allowed = schema.properties.capabilities.items.properties.review.enum;
  for (const capability of ledger.capabilities) {
    assert.ok(allowed.includes(capability.review), `${capability.id}: review status`);
    if (capability.review === 'independently-reviewed') assert.ok(existsSync(new URL(`../docs/reviews/${capability.id}.md`, import.meta.url)), `${capability.id}: review record`);
  }
  assert.equal(ledger.capabilities.filter((c) => c.review === 'independently-reviewed').length, 0, 'no independent review has been recorded yet; update this when one is');
});
