#!/usr/bin/env node
// Small, targeted mutation testing for high-risk code. Each mutant changes one security- or
// correctness-critical line; the named tests must then fail ("kill" the mutant). A surviving mutant
// means the tests would not notice that bug. Files are always restored, even on error.
//
//   npm run test:mutation
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTANTS = [
  { name: 'HTML escaping drops <', file: 'src/core/html.js', from: "'<': '&lt;'", to: "'<': '<'", tests: ['tests/browser-security.test.mjs'] },
  { name: 'project size limit doubled', file: 'packages/project-model/src/index.mjs', from: 'if (utf8ByteLength(encoded) > maxBytes) throw', to: 'if (utf8ByteLength(encoded) > maxBytes * 2) throw', tests: ['tests/project-model.test.mjs'] },
  { name: 'artifact path accepts ..', file: 'packages/project-model/src/index.mjs', from: "segment !== '.' && segment !== '..'", to: "segment !== '.'", tests: ['tests/project-model.test.mjs'] },
  { name: 'bearer tokens no longer redacted', file: 'packages/errors/src/index.mjs', from: "[/Bearer\\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],", to: '', tests: ['tests/errors.test.mjs'] },
  { name: 'API key written to sessionStorage without consent', file: 'src/core/credentials.js', from: 'if (next.rememberKey && memoryKey) session?.setItem', to: 'if (memoryKey) session?.setItem', tests: ['tests/browser-security.test.mjs'] },
  { name: 'browser allowed device permissions', file: 'packages/device-bridge/src/index.mjs', from: "allowed: environment === 'desktop' && allowedSet.has(permission),", to: 'allowed: allowedSet.has(permission),', tests: ['tests/contracts.test.mjs'] },
  { name: 'conductance stamp sign error', file: 'src/engines/circuit-engine.js', from: 'matrix[a][b] -= conductance; matrix[b][a] -= conductance;', to: 'matrix[a][b] += conductance; matrix[b][a] -= conductance;', tests: ['tests/circuit.test.mjs'] },
  { name: 'legacy notes migration removed', file: 'packages/project-model/src/index.mjs', from: '  if (value.notes === undefined) value.notes = [];\n', to: '', tests: ['tests/project-model.test.mjs'] },
];

export function runMutant(mutant, run = (tests) => spawnSync(process.execPath, ['--test', '--experimental-test-isolation=none', ...tests], { cwd: root, encoding: 'utf8' })) {
  const file = path.join(root, mutant.file);
  const missing = mutant.tests.filter((test) => !existsSync(path.join(root, test)));
  if (missing.length) return { ...mutant, status: 'invalid', detail: `missing test files: ${missing.join(', ')}` };
  const original = readFileSync(file, 'utf8');
  if (!original.includes(mutant.from)) return { ...mutant, status: 'stale', detail: 'pattern not found; update the mutant' };
  // The tests must pass on the unmutated code; otherwise a "kill" would mean nothing.
  if (run(mutant.tests).status !== 0) return { ...mutant, status: 'invalid', detail: 'tests fail without the mutation' };
  try {
    writeFileSync(file, original.replace(mutant.from, mutant.to));
    const result = run(mutant.tests);
    return { ...mutant, status: result.status === 0 ? 'survived' : 'killed' };
  } finally {
    writeFileSync(file, original);
  }
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const results = MUTANTS.map((mutant) => { const r = runMutant(mutant); console.log(`${r.status.padEnd(8)} ${mutant.name}${r.detail ? ` (${r.detail})` : ''}`); return r; });
  const bad = results.filter((r) => r.status !== 'killed');
  console.log(`\n${results.length - bad.length}/${results.length} mutants killed.`);
  if (bad.length) process.exit(1);
}
