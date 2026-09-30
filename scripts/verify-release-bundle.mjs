import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const expected = (value) => String(value).trim().toLowerCase();
const failures = [];

const manifest = JSON.parse(await readFile(resolve(dist, 'BUILD-MANIFEST.json'), 'utf8'));
for (const entry of manifest.files || []) {
  const actual = await sha256(resolve(dist, entry.path));
  if (actual !== expected(entry.sha256)) failures.push(`browser manifest mismatch: ${entry.path}`);
}

const sums = (await readFile(resolve(dist, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map((line) => {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/i);
  return match ? { sha256: match[1].toLowerCase(), path: match[2] } : null;
}).filter(Boolean);
if (sums.length !== manifest.files.length) failures.push('browser SHA256SUMS entry count differs from BUILD-MANIFEST');
for (const entry of manifest.files || []) {
  const sum = sums.find((candidate) => candidate.path === entry.path);
  if (!sum || sum.sha256 !== expected(entry.sha256)) failures.push(`browser checksum list mismatch: ${entry.path}`);
}

const nativeArtifacts = [
  ['dist/NATIVE-BUILD-SBOM.spdx.json', 'FABA8F307359AC465F40AD8F4ECA2717800239E85644C95F3F78F1862BCC1AEF'],
  ['dist/NATIVE-THIRD-PARTY-NOTICES.txt', 'D78974B8361ECF6C3FFC743EC51F933831A41148A805D38882665594E5B8DC11'],
];
for (const [relative, expectedHash] of nativeArtifacts) {
  const actual = await sha256(resolve(root, relative));
  if (actual !== expected(expectedHash)) failures.push(`native release artifact mismatch: ${relative}`);
}

const releaseManifest = await readFile(resolve(root, 'docs/release-evidence/release-manifest-2026-09-29.md'), 'utf8');
const desktopArtifacts = [
  'apps/desktop/src-tauri/target/release/openentc-studio.exe',
  'apps/desktop/src-tauri/target/release/bundle/nsis/OpenENTC Studio_0.1.0_x64-setup.exe',
  'apps/desktop/src-tauri/target/release/bundle/deb/OpenENTC Studio_0.1.0_amd64.deb',
  'apps/desktop/src-tauri/target/release/bundle/appimage/OpenENTC Studio_0.1.0_amd64.AppImage',
];
const desktopChecks = [];
for (const relative of desktopArtifacts) {
  const line = releaseManifest.split(/\r?\n/).find((candidate) => candidate.includes(relative));
  const match = line?.match(/\|\s*`([0-9A-F]{64})`\s*\|/i);
  const actual = await sha256(resolve(root, relative));
  desktopChecks.push({ relative, expected: match?.[1] || null, actual });
  if (!match || actual !== expected(match[1])) failures.push(`desktop release manifest mismatch: ${relative}`);
}

const report = { state: failures.length ? 'failed' : 'passed', browserFiles: manifest.files.length, nativeArtifacts: nativeArtifacts.length, desktopArtifacts: desktopChecks, failures };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
