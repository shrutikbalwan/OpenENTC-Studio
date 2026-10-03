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
// Resolve what the moved line ranges really refer to, using the TypeScript checker: names bound to
// an import, names bound to another top-level declaration of the source, and nothing else (locals
// and parameters with the same spelling are ignored).
export function freeReferences(file, text, ranges) {
  const program = ts.createProgram([file], { allowJs: true, checkJs: false, noEmit: true, noResolve: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  const lineStarts = sf.getLineStarts();
  const spans = ranges.map(([startLine, endLine]) => [lineStarts[startLine], endLine < lineStarts.length ? lineStarts[endLine] : text.length]);
  const inside = (pos) => spans.some(([a, b]) => pos >= a && pos < b);
  const imports = new Set(), topLevel = new Set();
  const topOf = (node) => { while (node.parent && node.parent !== sf) node = node.parent; return node; };
  const visit = (node) => {
    if (ts.isIdentifier(node) && inside(node.getStart(sf))) {
      const symbol = checker.getSymbolAtLocation(node);
      const declaration = symbol?.declarations?.[0];
      if (declaration && declaration.getSourceFile() === sf) {
        const top = topOf(declaration);
        if (ts.isImportDeclaration(top)) imports.add(node.text);
        else if (top.pos <= declaration.pos && !inside(top.getStart(sf)) && (ts.isVariableStatement(top) || ts.isFunctionDeclaration(top) || ts.isClassDeclaration(top))) {
          const isTopBinding = ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration) || (ts.isVariableDeclaration(declaration) && declaration.parent?.parent === top);
          if (isTopBinding) topLevel.add(node.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { imports, topLevel };
}

// One pass over a module: for every top-level declaration, the other top-level declarations and
// the imported names it references (resolved with the checker, so locals are not confused).
export function referenceMap(file) {
  const program = ts.createProgram([file], { allowJs: true, checkJs: false, noEmit: true, noResolve: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  const map = new Map();
  const namesOf = (statement) => (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name ? [statement.name.text]
    : ts.isVariableStatement(statement) ? statement.declarationList.declarations.filter((d) => ts.isIdentifier(d.name)).map((d) => d.name.text) : [];
  const topOf = (node) => { while (node.parent && node.parent !== sf) node = node.parent; return node; };
  for (const statement of sf.statements) {
    const names = namesOf(statement);
    if (!names.length) continue;
    const refs = { topLevel: new Set(), imports: new Set() };
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0];
        if (declaration && declaration.getSourceFile() === sf) {
          const top = topOf(declaration);
          if (ts.isImportDeclaration(top)) refs.imports.add(node.text);
          else if (top !== statement && namesOf(top).includes(node.text) && (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration) || ts.isVariableDeclaration(declaration) && declaration.parent?.parent === top)) refs.topLevel.add(node.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
    for (const name of names) map.set(name, refs);
  }
  return map;
}

// Remove import specifiers the compiler reports as unused (TS6133/TS6192), so a local with the same
// spelling never keeps a dead import alive.
export function pruneUnusedImports(file) {
  const program = ts.createProgram([file], { allowJs: true, checkJs: true, noEmit: true, noResolve: true, noUnusedLocals: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
  const sf = program.getSourceFile(file);
  const unused = new Set();
  for (const d of program.getSemanticDiagnostics(sf)) {
    if (![6133, 6192].includes(d.code) || d.start === undefined) continue;
    let node = ts.getTokenAtPosition ? ts.getTokenAtPosition(sf, d.start) : null;
    while (node && !ts.isImportDeclaration(node)) node = node.parent;
    if (!node) continue;
    if (d.code === 6192) for (const el of node.importClause?.namedBindings?.elements ?? []) unused.add(el.name.text);
    else unused.add(sf.text.slice(d.start, d.start + d.length));
  }
  if (!unused.size) return [];
  const lines = sf.text.split('\n').flatMap((line) => {
    const m = IMPORT.exec(line);
    if (!m) return [line];
    const kept = m[1].split(',').map((x) => x.trim()).filter(Boolean).filter((x) => !unused.has((x.split(/\s+as\s+/)[1] ?? x).trim()));
    return kept.length ? [`import { ${kept.join(', ')} } from '${m[2]}';`] : [];
  });
  writeFileSync(file, lines.join('\n'));
  return [...unused];
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
  const refs = freeReferences(path.resolve(from), source.lines.join('\n'), [...moving].map((n) => [source.blocks.get(n).start, source.blocks.get(n).end]));
  const movedIds = refs.imports;
  const staying = [...refs.topLevel].filter((n) => !moving.has(n));
  if (staying.length) throw new Error(`Moved code uses declarations that stay in ${from}: ${staying.join(', ')}. Move or share them first.`);

  // Imports for the target.
  const needed = new Map();
  for (const imp of source.imports) {
    for (const n of imp.names) {
      if (!movedIds.has(n.local)) continue;
      const target = resolveSpec(from, imp.from);
      if (target === path.resolve(to)) continue; // the name is defined in the target itself
      const key = target.startsWith('/') ? target : `pkg:${target}`;
      (needed.get(key) ?? needed.set(key, new Set()).get(key)).add(n.imported === n.local ? n.local : `${n.imported} as ${n.local}`);
    }
  }
  let targetText = '';
  if (existsSync(to)) {
    const existing = parseModule(readFileSync(to, 'utf8'));
    // A name the target already imports (from any path) or defines must not be imported again.
    const present = new Set([...existing.imports.flatMap((imp) => imp.names.map((n) => n.local)), ...existing.blocks.keys()]);
    for (const set of needed.values()) for (const entry of [...set]) if (present.has(entry.split(/\s+as\s+/).pop())) set.delete(entry);
    for (const [key, set] of [...needed]) if (!set.size) needed.delete(key);
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
  pruneUnusedImports(path.resolve(from));
  pruneUnusedImports(path.resolve(to));
  return { moved: names.length, importedBack: back, targetImports: importBlock.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const list = (name) => (arg(name) ?? '').split(',').filter(Boolean);
  const result = move({ from: arg('--from') ?? 'src/app.js', to: arg('--to'), names: list('--names'), doc: arg('--doc') ?? '', exportAlso: list('--export') });
  console.log(JSON.stringify(result));
}
