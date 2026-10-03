#!/usr/bin/env node
// Structural checks for the browser UI modules (src/**/*.js):
//   1. unresolved names — an identifier with no declaration or import (catches broken extractions);
//   2. import cycles between files in src/ and packages/;
//   3. unused imports and locals in the UI modules (dead code);
//   4. exports from the shared UI layers that nothing imports.
// It uses the TypeScript compiler already pinned as a development dependency; no new dependency.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (file) => path.relative(root, file).split(path.sep).join('/');

async function walk(dir, filter) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

export async function uiFiles() {
  return (await walk(path.join(root, 'src'), (f) => f.endsWith('.js'))).sort();
}

export function diagnose(files) {
  const program = ts.createProgram(files, { allowJs: true, checkJs: true, noEmit: true, noUnusedLocals: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], skipLibCheck: true });
  const unresolved = [], unused = [];
  for (const file of files) {
    for (const d of program.getSemanticDiagnostics(program.getSourceFile(file))) {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start);
      const message = `${rel(file)}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
      if ([2304, 2552].includes(d.code)) unresolved.push(message);
      else if ([6133, 6192, 6198].includes(d.code)) unused.push(message);
    }
  }
  return { unresolved, unused };
}

export async function importGraph() {
  const files = [...await uiFiles(), ...await walk(path.join(root, 'packages'), (f) => /[\\/]src[\\/].*\.m?js$/.test(f))];
  const graph = {};
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    graph[rel(file)] = [...text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+'(\.[^']+)'/gm)].map((m) => rel(path.resolve(path.dirname(file), m[1])));
  }
  return graph;
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

const SHARED_LAYERS = /^src\/(shared|components|controllers|state|services|shell|workspaces)\//;

export async function unusedExports(graph) {
  const importers = new Map();
  const consumers = [...Object.keys(graph), ...(await walk(path.join(root, 'tests'), (f) => f.endsWith('.mjs'))).map(rel)];
  const texts = Object.fromEntries(await Promise.all(consumers.map(async (f) => [f, await readFile(path.join(root, f), 'utf8')])));
  for (const [file, text] of Object.entries(texts)) {
    for (const m of text.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s+'(\.[^']+)'/g)) {
      const target = rel(path.resolve(path.dirname(path.join(root, file)), m[2]));
      for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) (importers.get(target) ?? importers.set(target, new Set()).get(target)).add(name);
    }
  }
  const unused = [];
  for (const file of Object.keys(graph).filter((f) => SHARED_LAYERS.test(f))) {
    const text = texts[file];
    for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function\s*\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (!importers.get(file)?.has(m[1])) unused.push(`${file}: ${m[1]}`);
    }
  }
  return unused;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const files = await uiFiles();
  const { unresolved, unused } = diagnose(files);
  const graph = await importGraph();
  const cycles = findCycles(graph);
  const deadExports = await unusedExports(graph);
  const report = { files: files.length, unresolved, cycles, unusedImportsOrLocals: unused.length, unusedExports: deadExports };
  const failed = unresolved.length || cycles.length || deadExports.length || (process.argv.includes('--strict-unused') && unused.length);
  if (process.argv.includes('--list-unused')) report.unusedList = unused;
  console.log(JSON.stringify(report, null, 2));
  if (failed) { console.error('UI module check failed.'); process.exit(1); }
  console.log('UI module check passed.');
}
