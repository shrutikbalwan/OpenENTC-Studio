import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identifiers, move } from '../scripts/refactor-move.mjs';

test('identifiers ignore strings, comments and property names', () => {
  const ids = identifiers("const a = b.c + `${d}C` + 'C'; // e\nf({ g: h, i });");
  for (const name of ['a', 'b', 'd', 'f', 'h', 'i']) assert.ok(ids.has(name), name);
  for (const name of ['c', 'C', 'e', 'g']) assert.ok(!ids.has(name), name);
});

test('move extracts declarations with their imports, exports only what the source still uses', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openentc-move-'));
  const from = join(dir, 'src', 'app.js');
  const to = join(dir, 'src', 'workspaces', 'demo.js');
  const source = [
    "import { esc, other } from './core/html.js';",
    "import { solve } from '../packages/demo/src/index.mjs';",
    '',
    'const keep = 1;',
    '',
    '/** Helper comment. */',
    'const helper = (x) => esc(x);',
    'function renderDemo() { return helper(solve()); }',
    '',
    'function shell() { return renderDemo() + keep + other; }',
    '',
  ].join('\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(from, source);
  const result = move({ from, to, names: ['helper', 'renderDemo'], doc: '// Demo workspace.' });
  assert.deepEqual(result.importedBack, ['renderDemo']);
  const target = readFileSync(to, 'utf8');
  assert.match(target, /^\/\/ Demo workspace\./);
  assert.match(target, /import \{ esc \} from '\.\.\/core\/html\.js';/);
  assert.match(target, /import \{ solve \} from '\.\.\/\.\.\/packages\/demo\/src\/index\.mjs';/);
  assert.match(target, /\/\*\* Helper comment\. \*\/\nconst helper/, 'leading comment moves, helper stays private');
  assert.match(target, /export function renderDemo/);
  const after = readFileSync(from, 'utf8');
  assert.match(after, /import \{ other \} from '\.\/core\/html\.js';/, 'unused import names are pruned');
  assert.doesNotMatch(after, /packages\/demo/);
  assert.match(after, /import \{ renderDemo \} from '\.\/workspaces\/demo\.js';/);
  assert.doesNotMatch(after, /helper/);
});

test('move refuses when moved code needs a declaration that stays (would create a cycle)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openentc-move-'));
  const from = join(dir, 'app.js');
  writeFileSync(from, 'const shared = 1;\nfunction a() { return shared; }\nfunction b() { return a(); }\n');
  assert.throws(() => move({ from, to: join(dir, 'w.js'), names: ['a'] }), /uses declarations that stay in .*: shared/);
});


test('move ignores locals that share a name with a declaration that stays', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openentc-move-'));
  const from = join(dir, 'app.js');
  writeFileSync(from, 'const fraction = 1;\nfunction a(fraction) { const x = fraction * 2; return x; }\nfunction b() { return a(3) + fraction; }\n');
  const result = move({ from, to: join(dir, 'w.js'), names: ['a'] });
  assert.deepEqual(result.importedBack, ['a']);
  assert.match(readFileSync(join(dir, 'w.js'), 'utf8'), /export function a\(fraction\)/);
});

test('move into an existing module never imports the module itself or a name twice', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openentc-move-'));
  const from = join(dir, 'app.js');
  const to = join(dir, 'fmt.js');
  writeFileSync(to, "import { esc } from './escaping.js';\n\nexport const fmt = (v) => esc(String(v));\n");
  writeFileSync(from, "import { fmt } from './fmt.js';\nimport { esc } from './html.js';\n\nconst eng = (v) => esc(fmt(v));\nfunction use() { return eng(1); }\n");
  move({ from, to, names: ['eng'] });
  const target = readFileSync(to, 'utf8');
  assert.doesNotMatch(target, /from '\.\/fmt\.js'/, 'no self-import');
  assert.equal(target.match(/import \{[^}]*\besc\b/g).length, 1, 'esc imported once');
  assert.match(readFileSync(from, 'utf8'), /^import \{ eng \} from '\.\/fmt\.js';$/m, 'merged into the existing import; fmt is no longer used');
});
