#!/usr/bin/env node
// Refactoring helper used for the src/app.js modularisation (Phase 2). It moves top-level
// declarations from a source module into a target module without changing their text:
//
//   node scripts/refactor-move.mjs --from src/app.js --to src/workspaces/digital/logic.js \
//     --names renderLogic,bindLogicEvents,... [--doc "// Header comment"] [--export extraName,...]
//
// - Each declaration's block runs from its line (plus any comment directly above it) to the line
//   before the next top-level declaration (minus trailing blank lines and the next one's comment).
// - The target receives the moved declarations and the imports they need, with paths rewritten
//   for the target's directory. Only names the source still uses (plus --export) are exported.
//   An existing target is extended, merging imports.
// - The source imports back the moved names it still uses and drops imports it no longer uses.
// - The move is refused if moved code would need a declaration that stays in the source, because
//   that would create an import cycle. Move or share that declaration first.
//
// Identifiers are found with the TypeScript parser (strings and comments are ignored). Run `npm run ui:check` and the UI sweep afterwards.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/;
const IMPORT = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/;
const isComment = (line) => /^\s*(\/\/|\/\*\*|\*(?!\/)|\*\/)/.test(line) || /\*\/\s*$/.test(line);

export function parseModule(text) {
  const lines = text.split('\n');
  const imports = [];
  lines.forEach((line, index) => {
    const m = IMPORT.exec(line);
    if (m) imports.push({ index, from: m[2], names: m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [imported, local] = s.split(/\s+as\s+/); return { imported: imported.trim(), local: (local ?? imported).trim() }; }) });
  });
  const starts = [];
  lines.forEach((line, index) => { const m = DECL.exec(line); if (m) starts.push({ index, name: m[1] ?? m[2] }); });
  const blocks = new Map();
  starts.forEach(({ index, name }, k) => {
    let end = k + 1 < starts.length ? starts[k + 1].index : lines.length;
    while (end > index + 1 && lines[end - 1].trim() === '') end -= 1;
    let trailing = end;
    while (trailing > index + 1 && isComment(lines[trailing - 1])) trailing -= 1;
    if (trailing < end && /^\s*(\/\/|\/\*\*)/.test(lines[trailing])) end = trailing;
    while (end > index + 1 && lines[end - 1].trim() === '') end -= 1;
    let start = index;
    while (start > 0 && isComment(lines[start - 1]) && !DECL.test(lines[start - 1])) start -= 1;
    if (blocks.has(name)) throw new Error(`Duplicate top-level declaration ${name}.`);
    blocks.set(name, { start, end, line: index });
  });
  return { lines, imports, blocks };
}

// Identifiers referenced in code (not inside strings, template text or comments), via the
// TypeScript parser. Property names after a dot are excluded; shorthand properties are included.
export function identifiers(text) {
  const found = new Set();
  const file = ts.createSourceFile('x.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node) => {
    if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) found.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
const relativeSpec = (fromFile, toFile) => { let spec = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/'); if (!spec.startsWith('.')) spec = `./${spec}`; return spec; };
const resolveSpec = (file, spec) => (spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : spec);
const importLine = (names, spec) => `import { ${[...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b)).join(', ')} } from '${spec}';`;

export function move({ from, to, names, doc = '', exportAlso = [] }) {
  const source = parseModule(readFileSync(from, 'utf8'));
  const missing = names.filter((n) => !source.blocks.has(n));
  if (missing.length) throw new Error(`Not top-level declarations in ${from}: ${missing.join(', ')}`);
  const moving = new Set(names);
  const remove = new Set();
  for (const name of moving) {
    const { start, end } = source.blocks.get(name);
    for (let i = start; i < end; i += 1) remove.add(i);
    if (start > 0 && source.lines[start - 1].trim() === '' && source.lines[end]?.trim() === '') remove.add(end);
  }
  const remaining = source.lines.filter((_, i) => !remove.has(i));
  const bodyIds = identifiers(remaining.filter((l) => !IMPORT.test(l)).join('\n'));
  const back = names.filter((n) => bodyIds.has(n));
  const exported = new Set([...back, ...exportAlso]);
  const chunks = [];
  for (const name of [...source.blocks.keys()].filter((n) => moving.has(n))) {
    const { start, end, line } = source.blocks.get(name);
    const chunk = source.lines.slice(start, end);
    if (exported.has(name) && !chunk[line - start].startsWith('export ')) chunk[line - start] = `export ${chunk[line - start]}`;
    chunks.push(chunk.join('\n'));
  }
  const movedText = chunks.join('\n');
  const movedIds = identifiers(movedText);
  const staying = [...source.blocks.keys()].filter((n) => !moving.has(n) && movedIds.has(n));
  if (staying.length) throw new Error(`Moved code uses declarations that stay in ${from}: ${staying.join(', ')}. Move or share them first.`);

  // Imports for the target.
  const needed = new Map();
  for (const imp of source.imports) {
    for (const n of imp.names) {
      if (!movedIds.has(n.local)) continue;
      const target = resolveSpec(from, imp.from);
      const key = target.startsWith('/') ? target : `pkg:${target}`;
      (needed.get(key) ?? needed.set(key, new Set()).get(key)).add(n.imported === n.local ? n.local : `${n.imported} as ${n.local}`);
    }
  }
  let targetText = '';
  if (existsSync(to)) {
    const existing = parseModule(readFileSync(to, 'utf8'));
    for (const imp of existing.imports) {
      const target = resolveSpec(to, imp.from);
      const key = target.startsWith('/') ? target : `pkg:${target}`;
      for (const n of imp.names) (needed.get(key) ?? needed.set(key, new Set()).get(key)).add(n.imported === n.local ? n.local : `${n.imported} as ${n.local}`);
    }
    const kept = existing.lines.filter((_, i) => !existing.imports.some((imp) => imp.index === i));
    const firstCode = kept.findIndex((l) => l.trim() && !l.startsWith('//'));
    doc = kept.slice(0, firstCode).join('\n');
    targetText = kept.slice(firstCode).join('\n').trimEnd();
  }
  const importBlock = [...needed.entries()].map(([key, set]) => importLine(set, key.startsWith('pkg:') ? key.slice(4) : relativeSpec(to, key))).sort((a, b) => (a.includes("'../../packages") === b.includes("'../../packages") ? 0 : a.includes("'../../packages") ? -1 : 1));
  mkdirSync(path.dirname(to), { recursive: true });
  writeFileSync(to, `${doc.trim() ? `${doc.trim()}\n` : ''}${importBlock.join('\n')}\n\n${targetText ? `${targetText}\n\n` : ''}${movedText}\n`);

  // Rewrite the source: drop moved blocks, import back what is still used (merging with an
  // existing import of the target), prune unused imports.
  const backSpec = relativeSpec(from, to);
  const rewritten = [];
  let merged = false;
  for (const line of remaining) {
    const m = IMPORT.exec(line);
    if (!m) { rewritten.push(line); continue; }
    let kept = m[1].split(',').map((s) => s.trim()).filter(Boolean).filter((s) => bodyIds.has((s.split(/\s+as\s+/)[1] ?? s).trim()));
    if (m[2] === backSpec && back.length) { kept = [...new Set([...kept, ...back])].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b)); merged = true; }
    if (kept.length) rewritten.push(`import { ${kept.join(', ')} } from '${m[2]}';`);
  }
  if (back.length && !merged) {
    const lastImport = rewritten.reduce((last, line, i) => (IMPORT.test(line) ? i : last), -1);
    rewritten.splice(lastImport + 1, 0, importLine(back, relativeSpec(from, to)));
  }
  writeFileSync(from, rewritten.join('\n'));
  return { moved: names.length, importedBack: back, targetImports: importBlock.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const list = (name) => (arg(name) ?? '').split(',').filter(Boolean);
  const result = move({ from: arg('--from') ?? 'src/app.js', to: arg('--to'), names: list('--names'), doc: arg('--doc') ?? '', exportAlso: list('--export') });
  console.log(JSON.stringify(result));
}
