import { readFile } from 'node:fs/promises';
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

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Lint passed for ${files.length} JavaScript files.`);
}
