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

test('every module routes to a renderer imported from a workspace or shell module', async () => {
  const navigation = await readFile(new URL('../src/shell/navigation.js', import.meta.url), 'utf8');
  const { modules } = await import('../src/data/modules.js').catch(() => ({ modules: null }));
  const routes = Object.fromEntries([...navigation.matchAll(/(?:activeModule|active\.id) === '([\w-]+)'\)(?: \{[\s\S]*?)? return (render\w+)\(/g)].map((m) => [m[1], m[2]]));
  assert.ok(Object.keys(routes).length >= 40);
  const imported = new Map();
  for (const m of navigation.matchAll(/^import \{([^}]*)\} from '([^']+)';/gm)) for (const name of m[1].split(',').map((n) => n.trim())) imported.set(name, m[2]);
  for (const [id, renderer] of Object.entries(routes)) assert.match(imported.get(renderer) ?? '', /^(\.\.\/workspaces\/|\.\/)/, `${id} → ${renderer}`);
  if (modules) for (const module of modules) assert.ok(routes[module.id] || module.id === 'home' || /renderEngineeringModule/.test(navigation), module.id);
  // The entry point stays a thin composition layer.
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(app.split('\n').length < 150, 'src/app.js is a composition layer');
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
