import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyseApp, findCycles, packageGraph } from '../scripts/app-dependency-map.mjs';

test('dependency map classifies declarations and follows references', () => {
  const source = [
    "import { solve } from '../packages/demo/src/index.mjs';",
    "import { setState } from './core/store.js';",
    'const demoLab = { value: 1 };',
    'function renderWorkspace(state, active) {',
    "  if (active.id === 'demo') return renderDemo(state);",
    '}',
    'function pageHeader() { return 1; }',
    'function renderDemo(state) { return pageHeader() + solve(demoLab.value); }',
    "function bindDemoEvents() { document.querySelector('x')?.addEventListener('click', () => setState({ v: demoLab.value })); }",
  ].join('\n');
  const app = analyseApp(source);
  const byName = Object.fromEntries(app.decls.map((d) => [d.name, d]));
  assert.equal(byName.renderDemo.category, 'render');
  assert.deepEqual(byName.renderDemo.usesModules, ['../packages/demo/src/index.mjs']);
  assert.deepEqual(byName.renderDemo.usesDecls, ['demoLab', 'pageHeader']);
  assert.equal(byName.bindDemoEvents.category, 'event');
  assert.deepEqual(byName.demoLab.usedBy, ['bindDemoEvents', 'renderDemo']);
  assert.equal(app.workspaces.demo.renderer, 'renderDemo');
  assert.equal(app.workspaces.demo.binder, 'bindDemoEvents');
});

test('cycle finder reports cycles and accepts acyclic graphs', () => {
  assert.deepEqual(findCycles({ a: ['b'], b: ['c'], c: [] }), []);
  assert.deepEqual(findCycles({ a: ['b'], b: ['a'] }), [['a', 'b', 'a']]);
});

test('domain packages have no import cycles and no runtime npm dependencies', async () => {
  const graph = await packageGraph();
  assert.ok(Object.keys(graph).length >= 50);
  assert.deepEqual(findCycles(graph), []);
  const external = Object.entries(graph).filter(([, deps]) => deps.some((d) => d.startsWith('npm:')));
  assert.deepEqual(external, []);
});

test('every workspace module in renderWorkspace is mapped to a renderer', async () => {
  const app = analyseApp(await readFile(new URL('../src/app.js', import.meta.url), 'utf8'));
  assert.ok(Object.keys(app.workspaces).length >= 40);
  for (const [id, w] of Object.entries(app.workspaces)) assert.match(w.renderer, /^render/, id);
});

test('UI module check: no unresolved names, no import cycles, no unused shared exports', async () => {
  const { diagnose, findCycles: fileCycles, importGraph, uiFiles, unusedExports } = await import('../scripts/check-ui-modules.mjs');
  const graph = await importGraph();
  assert.deepEqual(fileCycles(graph), []);
  assert.deepEqual(fileCycles({ 'a.js': ['b.js'], 'b.js': ['a.js'] }), [['a.js', 'b.js', 'a.js']]);
  assert.deepEqual(await unusedExports(graph), []);
  const { unresolved, unused } = diagnose(await uiFiles());
  assert.deepEqual(unresolved, []);
  assert.deepEqual(unused, [], 'no unused imports or locals in UI modules');
});
