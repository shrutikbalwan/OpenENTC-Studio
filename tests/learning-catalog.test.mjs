import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLesson, lessons } from '../packages/learning/src/catalog.mjs';

test('learning catalog exposes validated built-in lessons with stable ids', () => {
  assert.deepEqual(lessons.map((lesson) => lesson.id), ['voltage-divider', 'dsp-window', 'qpsk-ber']);
  assert.equal(getLesson('voltage-divider').checkpoints[0].expected, 6);
  assert.equal(getLesson('missing'), null);
  assert.throws(() => lessons[0].checkpoints.push({ id: 'x' }), TypeError);
});

test('learning package publishes the catalog as a typed subpath', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../packages/learning/package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.exports['./catalog'].import, './src/catalog.mjs');
  assert.equal(packageJson.exports['./catalog'].types, './src/catalog.d.ts');
});
