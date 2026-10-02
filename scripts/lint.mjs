import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import ts from 'typescript';
import { listJavaScriptFiles } from './quality-files.mjs';

const root = resolve(import.meta.dirname, '..');
const files = await listJavaScriptFiles(root);
const forbidden = [
  { pattern: /\beval\s*\(/, message: 'eval is forbidden' },
  { pattern: /\bnew\s+Function\s*\(/, message: 'dynamic Function construction is forbidden' },
  { pattern: /\bexec(?:Sync)?\s*\(\s*`/, message: 'shell command templates are forbidden' }
];
const failures = [];

for (const file of files) {
  const source = await readFile(resolve(root, file), 'utf8');
  const syntax = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { allowJs: true, checkJs: false, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  for (const diagnostic of syntax.diagnostics || []) failures.push(`${file}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  for (const rule of forbidden) if (rule.pattern.test(source)) failures.push(`${file}: ${rule.message}`);
}

// The transpiler above does not report duplicate declarations or imports; Node's own parser
// does, so every file also goes through `node --check` (eight at a time).
const run = promisify(execFile);
const queue = [...files];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let file = queue.shift(); file; file = queue.shift()) {
    try { await run(process.execPath, ['--check', resolve(root, file)]); }
    catch (error) { failures.push(`${file}: ${String(error.stderr || error.message).split('\n').filter((line) => /Error/.test(line))[0] ?? 'syntax error'}`); }
  }
}));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Lint passed for ${files.length} JavaScript files.`);
}
