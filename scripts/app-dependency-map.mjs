#!/usr/bin/env node
// Static dependency map for src/app.js and the domain packages. Read-only analysis used to plan
// the UI modularisation: it lists top-level declarations of app.js with their line ranges, classifies
// them (render, bind/event, state, persistence, native bridge, helper), records which imports and
// which other declarations each one references, and builds the package-to-package import graph.
//
// Usage: node scripts/app-dependency-map.mjs [--json out.json] [--markdown out.md]
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const STATE_CALLS = ['setState', 'updateProject', 'recordExperiment', 'replaceProject', 'synchronizeOpenProject', 'undoProject', 'redoProject', 'recordLearningAttempt'];
const PERSIST_CALLS = ['saveProject', 'localStorage', 'sessionStorage', 'importProjectFile', 'createPackagedProjectExport', 'storeAssistantSettings', 'forgetApiKey', 'loadAssistantSettings'];
const NATIVE_CALLS = ['desktopBridge', 'createDesktopEngineRunner', 'createDesktopProcessAdapterRunner', 'navigator.serial', 'createSerialSession'];

export function analyseApp(source) {
  const lines = source.split('\n');
  const imports = [];
  const importRe = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)';/;
  for (const line of lines) {
    const m = importRe.exec(line);
    if (!m) continue;
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [orig, alias] = s.split(/\s+as\s+/); return { imported: orig.trim(), local: (alias ?? orig).trim() }; });
    imports.push({ from: m[2], names });
  }
  const localToModule = new Map();
  for (const imp of imports) for (const n of imp.names) localToModule.set(n.local, imp.from);

  const declRe = /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
  const decls = [];
  lines.forEach((line, index) => {
    const m = declRe.exec(line);
    if (m) decls.push({ name: m[1] ?? m[2], kind: m[1] ? 'function' : 'binding', start: index + 1 });
  });
  decls.forEach((d, i) => { d.end = (decls[i + 1]?.start ?? lines.length + 1) - 1; });
  const declNames = new Set(decls.map((d) => d.name));

  const identRe = /[A-Za-z_$][\w$]*/g;
  for (const d of decls) {
    const body = lines.slice(d.start - 1, d.end).join('\n');
    d.lines = d.end - d.start + 1;
    d.bytes = Buffer.byteLength(body);
    const ids = new Set(body.match(identRe) ?? []);
    ids.delete(d.name);
    d.usesDecls = [...ids].filter((id) => declNames.has(id)).sort();
    d.usesModules = [...new Set([...ids].filter((id) => localToModule.has(id)).map((id) => localToModule.get(id)))].sort();
    d.innerHTML = (body.match(/\.innerHTML\s*=/g) ?? []).length;
    d.listeners = (body.match(/addEventListener\(/g) ?? []).length;
    d.stateCalls = STATE_CALLS.filter((c) => ids.has(c));
    d.persistence = PERSIST_CALLS.filter((c) => body.includes(c));
    d.native = NATIVE_CALLS.filter((c) => body.includes(c));
    d.category = classify(d);
  }
  const usedBy = new Map(decls.map((d) => [d.name, []]));
  for (const d of decls) for (const u of d.usesDecls) usedBy.get(u)?.push(d.name);
  for (const d of decls) d.usedBy = usedBy.get(d.name).sort();
  return { lines: lines.length, bytes: Buffer.byteLength(source), imports, decls, workspaces: workspaceOwnership(source, decls) };
}

// Workspaces are the renderers chosen in renderWorkspace(). A declaration reachable from exactly one
// workspace renderer (and not from the shell) is a candidate to move with that workspace; one reached
// from several is shared and belongs in components/ or shared/. Binders (bind*Events) are all called
// by bindEvents() on every render, so they are attributed by the declarations they share.
function workspaceOwnership(source, decls) {
  const byName = new Map(decls.map((d) => [d.name, d]));
  const reach = (rootName, stop = new Set()) => {
    const seen = new Set(), todo = [rootName];
    while (todo.length) { const n = todo.pop(); if (seen.has(n) || !byName.has(n) || (stop.has(n) && n !== rootName)) continue; seen.add(n); todo.push(...byName.get(n).usesDecls); }
    return seen;
  };
  const roots = {};
  const body = source.slice(source.indexOf('function renderWorkspace('), source.indexOf('function pageHeader('));
  for (const m of body.matchAll(/(?:activeModule|active\.id) === '([\w-]+)'\)(?: \{[\s\S]*?)? return (render\w+)\(/g)) roots[m[1]] = m[2];
  const shellRoots = ['render', 'renderWorkspace'];
  const binders = decls.filter((d) => /^bind\w+Events$/.test(d.name) && d.name !== 'bindEvents');
  const stop = new Set([...Object.values(roots), ...shellRoots, ...binders.map((b) => b.name)]);
  const shell = new Set(shellRoots.flatMap((r) => [...reach(r, stop)]));
  const reached = Object.fromEntries(Object.entries(roots).map(([id, r]) => [id, reach(r, stop)]));
  const owners = new Map();
  for (const [id, set] of Object.entries(reached)) for (const n of set) (owners.get(n) ?? owners.set(n, []).get(n)).push(id);
  const result = {};
  for (const [id, r] of Object.entries(roots)) {
    const exclusive = [...reached[id]].filter((n) => owners.get(n).length === 1 && !shell.has(n));
    // Score each binder by the declarations it shares with this workspace, weighted by how specific
    // each one is (1 / number of workspaces that reach it).
    const binder = binders.map((b) => ({ name: b.name, score: [...reach(b.name, stop)].filter((n) => n !== b.name && reached[id].has(n) && !shell.has(n)).reduce((a, n) => a + 1 / owners.get(n).length, 0) })).filter((b) => b.score >= 0.5).sort((a, b) => b.score - a.score)[0]?.name ?? null;
    const exclusiveLines = exclusive.reduce((a, n) => a + byName.get(n).lines, 0);
    const exclusiveBytes = exclusive.reduce((a, n) => a + byName.get(n).bytes, 0);
    result[id] = { renderer: r, binder, reachable: reached[id].size, exclusive: exclusive.length, exclusiveLines, exclusiveBytes, shared: [...reached[id]].filter((n) => owners.get(n).length > 1 || shell.has(n)).length };
  }
  return result;
}

function classify(d) {
  if (d.native.length) return 'native-bridge';
  if (/^render|Tab$|View$|Panel$|Card$|Plot$|Table$/.test(d.name) && !/^bind/.test(d.name)) return 'render';
  if (/^(bind|wire|attach|handle|on[A-Z])/.test(d.name) || d.listeners > 0) return 'event';
  if (d.persistence.length) return 'persistence';
  if (d.stateCalls.length) return 'state-mutation';
  if (d.kind === 'binding') return 'module-state-or-constant';
  return 'helper';
}

export async function packageGraph() {
  const dir = path.join(root, 'packages');
  const names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const graph = {};
  for (const name of names) {
    const deps = new Set();
    const srcDir = path.join(dir, name, 'src');
    const files = await listFiles(srcDir);
    for (const file of files.filter((f) => /\.(mjs|js)$/.test(f))) {
      const text = await readFile(file, 'utf8');
      for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
        const spec = m[1];
        if (!spec.startsWith('.')) { if (!spec.startsWith('node:')) deps.add(`npm:${spec}`); continue; }
        const resolved = path.resolve(path.dirname(file), spec);
        const rel = path.relative(dir, resolved).split(path.sep);
        if (rel[0] !== '..' && rel[0] !== name) deps.add(rel[0]);
        else if (rel[0] === '..') deps.add(`../${rel.slice(1, 3).join('/')}`);
      }
    }
    graph[name] = [...deps].sort();
  }
  return graph;
}

async function listFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...await listFiles(full)); else out.push(full);
    }
    return out;
  } catch { return []; }
}

export function findCycles(graph) {
  const cycles = [], state = {}, stack = [];
  const visit = (n) => {
    state[n] = 1; stack.push(n);
    for (const m of graph[n] ?? []) {
      if (!(m in graph)) continue;
      if (state[m] === 1) cycles.push([...stack.slice(stack.indexOf(m)), m]);
      else if (!state[m]) visit(m);
    }
    stack.pop(); state[n] = 2;
  };
  for (const n of Object.keys(graph)) if (!state[n]) visit(n);
  return cycles;
}

function markdown(app, graph) {
  const byCat = {};
  for (const d of app.decls) (byCat[d.category] ??= []).push(d);
  const out = ['# src/app.js dependency map (generated)', '', 'Generated by `npm run deps:map` (`scripts/app-dependency-map.mjs`). Do not edit by hand.', 'The analysis matches identifiers textually, so short names that collide with imports (for example `C` or `image`) can add false package links. Treat it as a planning aid, not a proof.', '', `\`src/app.js\`: ${app.lines} lines, ${app.bytes} bytes, ${app.imports.length} import statements, ${app.decls.length} top-level declarations.`, '', '### Declarations by category', ''];
  out.push('| Category | Declarations | Lines | Bytes |', '|---|---|---|---|');
  for (const [cat, list] of Object.entries(byCat).sort()) out.push(`| ${cat} | ${list.length} | ${list.reduce((a, d) => a + d.lines, 0)} | ${list.reduce((a, d) => a + d.bytes, 0)} |`);
  out.push('', '### Workspaces (entry renderer, likely binder, coupling)', '', '| Module id | Renderer | Binder | Reachable decls | Exclusive decls | Exclusive bytes | Shared decls |', '|---|---|---|---|---|---|---|');
  for (const [id, w] of Object.entries(app.workspaces).sort((a, b) => a[1].shared - b[1].shared)) out.push(`| ${id} | \`${w.renderer}\` | ${w.binder ? `\`${w.binder}\`` : '—'} | ${w.reachable} | ${w.exclusive} | ${w.exclusiveBytes} | ${w.shared} |`);
  out.push('', '### Largest declarations', '', '| Name | Lines | Bytes | Range | Category | Packages used |', '|---|---|---|---|---|---|');
  for (const d of [...app.decls].sort((a, b) => b.bytes - a.bytes).slice(0, 40)) out.push(`| \`${d.name}\` | ${d.lines} | ${d.bytes} | ${d.start}–${d.end} | ${d.category} | ${d.usesModules.map((m) => m.replace(/^\.\.\/packages\/|\/src\/.*$|^\.\//g, '')).join(', ')} |`);
  out.push('', '### Package dependency graph', '', '| Package | Imports |', '|---|---|');
  for (const [name, deps] of Object.entries(graph)) out.push(`| ${name} | ${deps.join(', ') || '—'} |`);
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const app = analyseApp(await readFile(path.join(root, 'src/app.js'), 'utf8'));
  const graph = await packageGraph();
  const cycles = findCycles(graph);
  const summary = { appLines: app.lines, appBytes: app.bytes, imports: app.imports.length, declarations: app.decls.length, innerHTML: app.decls.reduce((a, d) => a + d.innerHTML, 0), listeners: app.decls.reduce((a, d) => a + d.listeners, 0), packages: Object.keys(graph).length, packageCycles: cycles };
  const jsonOut = option('--json'), mdOut = option('--markdown');
  if (jsonOut) await writeFile(jsonOut, `${JSON.stringify({ summary, app, graph }, null, 2)}\n`);
  if (mdOut) await writeFile(mdOut, `${markdown(app, graph)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}
