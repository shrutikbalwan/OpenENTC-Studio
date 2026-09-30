import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { listTextFiles } from './quality-files.mjs';

const root = resolve(import.meta.dirname, '..');
const failures = [];

for (const file of await listTextFiles(root)) {
  const source = await readFile(resolve(root, file), 'utf8');
  if (!source.endsWith('\n')) failures.push(`${file}: missing final newline`);
  source.split(/\r?\n/).forEach((line, index) => {
    if (/[\t ]+$/.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`);
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Format check passed.');
}
