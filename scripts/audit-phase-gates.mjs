import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const matrixPath = resolve(root, 'docs/release-evidence/phase-gate-matrix-2026-09-29.md');
const matrix = await readFile(matrixPath, 'utf8');
const rows = matrix.split(/\r?\n/).filter((line) => line.startsWith('| ') && !line.startsWith('| ---') && !line.includes('| Gate |'));
const gates = [];
const missingEvidence = [];
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length < 3) continue;
  const [gate, status, evidence] = cells;
  const links = [...evidence.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1].split('#')[0]);
  for (const link of links) {
    if (/^https?:\/\//i.test(link)) continue;
    const path = resolve(root, 'docs/release-evidence', link);
    try { await access(path); } catch { missingEvidence.push({ gate, path: link }); }
  }
  gates.push({ gate, status });
}
const counts = gates.reduce((result, gate) => {
  const key = gate.status.startsWith('Pass') ? 'pass' : gate.status.startsWith('Partial') ? 'partial' : gate.status.startsWith('Open') ? 'open' : 'other';
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});
const report = { state: missingEvidence.length ? 'failed' : 'review-required', matrix: matrixPath, gateCount: gates.length, counts, missingEvidence, externalGatesRemain: (counts.open || 0) + (counts.partial || 0) > 0 };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (missingEvidence.length) process.exitCode = 1;
