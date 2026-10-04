#!/usr/bin/env node
// Build the browser app twice and check that every output file is byte-for-byte identical
// (compares dist/SHA256SUMS.txt). A difference means the build embeds something that changes
// between runs (time, random values, file-system order) and the release cannot be reproduced.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = () => {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`build failed: ${result.stderr}`);
  return readFileSync(path.join(root, 'dist', 'SHA256SUMS.txt'), 'utf8');
};

/** Lines present in only one of the two checksum lists. */
export function differences(first, second) {
  const a = new Set(first.trim().split('\n')); const b = new Set(second.trim().split('\n'));
  return [...[...a].filter((line) => !b.has(line)).map((line) => `first only:  ${line}`), ...[...b].filter((line) => !a.has(line)).map((line) => `second only: ${line}`)];
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const first = build(); const second = build();
  const diff = differences(first, second);
  if (diff.length) { console.error(`The build is not reproducible:\n  ${diff.join('\n  ')}`); process.exitCode = 1; }
  else console.log(`Reproducible: two builds produced identical files (${first.trim().split('\n').length} files).`);
}
