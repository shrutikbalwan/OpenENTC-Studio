#!/usr/bin/env node
// Release manifest: one file that lists every release artifact with its size and SHA-256, the source
// commit, and the external gates that are still pending. Nothing is hard-coded: `prepare` hashes what
// was just built, and `verify` re-hashes it.
//
//   node scripts/release-manifest.mjs prepare            write dist/RELEASE-MANIFEST.json
//   node scripts/release-manifest.mjs verify             check the browser build and every listed artifact
//   node scripts/release-manifest.mjs verify --require windows,linux
//                                                        also fail unless those desktop builds are listed
//
// External gates (signing, clean-machine installs, hardware, accessibility audit, expert review,
// licence review) are recorded as "pending". Only a person who has done one may change it, in
// release/gates.json, with evidence.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');

export const ARTIFACTS = Object.freeze([
  { path: 'dist/BUILD-MANIFEST.json', kind: 'browser-manifest', platform: 'web', required: true },
  { path: 'dist/SHA256SUMS.txt', kind: 'browser-checksums', platform: 'web', required: true },
  { path: 'dist/BUILD-SBOM.spdx.json', kind: 'sbom', platform: 'web', required: true },
  { path: 'dist/NATIVE-BUILD-SBOM.spdx.json', kind: 'sbom', platform: 'native', required: true },
  { path: 'dist/NATIVE-THIRD-PARTY-NOTICES.txt', kind: 'notices', platform: 'native', required: true },
  { path: 'apps/desktop/src-tauri/target/release/openentc-studio.exe', kind: 'desktop-executable', platform: 'windows' },
  { path: 'apps/desktop/src-tauri/target/release/bundle/nsis/OpenENTC Studio_0.1.0_x64-setup.exe', kind: 'installer-unsigned', platform: 'windows' },
  { path: 'apps/desktop/src-tauri/target/release/openentc-studio', kind: 'desktop-executable', platform: 'linux' },
  { path: 'apps/desktop/src-tauri/target/release/bundle/deb/OpenENTC Studio_0.1.0_amd64.deb', kind: 'package-unsigned', platform: 'linux' },
  { path: 'apps/desktop/src-tauri/target/release/bundle/appimage/OpenENTC Studio_0.1.0_amd64.AppImage', kind: 'package-unsigned', platform: 'linux' },
]);

function git(args) {
  // Not trimmed: `git status --porcelain` lines start with a status column that may be a space.
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
}

/** Check the browser build's own manifest and checksum list against the files. */
export async function verifyBrowserBuild(directory = dist) {
  const failures = [];
  const manifest = JSON.parse(await readFile(path.join(directory, 'BUILD-MANIFEST.json'), 'utf8'));
  for (const entry of manifest.files ?? []) {
    const file = path.join(directory, entry.path);
    if (!existsSync(file)) { failures.push(`browser file missing: ${entry.path}`); continue; }
    if ((await sha256(file)) !== String(entry.sha256).toLowerCase()) failures.push(`browser file changed: ${entry.path}`);
  }
  const sums = (await readFile(path.join(directory, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map((line) => /^([0-9a-f]{64}) {2}(.+)$/i.exec(line)).filter(Boolean).map((m) => ({ sha256: m[1].toLowerCase(), path: m[2] }));
  if (sums.length !== (manifest.files ?? []).length) failures.push('SHA256SUMS.txt and BUILD-MANIFEST.json list different numbers of files');
  for (const entry of manifest.files ?? []) if (sums.find((sum) => sum.path === entry.path)?.sha256 !== String(entry.sha256).toLowerCase()) failures.push(`checksum list disagrees for ${entry.path}`);
  return { files: (manifest.files ?? []).length, failures };
}

export async function prepare() {
  const gates = JSON.parse(await readFile(path.join(root, 'release', 'gates.json'), 'utf8'));
  const artifacts = [];
  for (const artifact of ARTIFACTS) {
    const file = path.join(root, artifact.path);
    if (!existsSync(file)) {
      if (artifact.required) throw new Error(`Required release artifact missing: ${artifact.path}. Run npm run release:prepare.`);
      continue;
    }
    artifacts.push({ path: artifact.path, kind: artifact.kind, platform: artifact.platform, bytes: (await stat(file)).size, sha256: await sha256(file) });
  }
  const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
  const changed = (git(['status', '--porcelain', '--untracked-files=no']) ?? '').split('\n').filter(Boolean).map((line) => line.slice(3));
  const manifest = {
    format: 'openentc-release-manifest', version: 1,
    product: 'OpenENTC Studio', productVersion: version, channel: 'alpha',
    source: { commit: process.env.GITHUB_SHA || git(['rev-parse', 'HEAD'])?.trim() || null, dirty: changed.length > 0, changedFiles: changed.slice(0, 20) },
    signed: false,
    artifacts,
    gates: gates.gates,
  };
  await writeFile(path.join(dist, 'RELEASE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function verify({ require = [] } = {}) {
  const browser = await verifyBrowserBuild();
  const failures = [...browser.failures];
  const manifest = JSON.parse(await readFile(path.join(dist, 'RELEASE-MANIFEST.json'), 'utf8'));
  for (const artifact of manifest.artifacts) {
    const file = path.join(root, artifact.path);
    if (!existsSync(file)) { failures.push(`listed artifact missing: ${artifact.path}`); continue; }
    if ((await sha256(file)) !== artifact.sha256) failures.push(`artifact changed since prepare: ${artifact.path}`);
  }
  for (const required of ARTIFACTS.filter((a) => a.required)) if (!manifest.artifacts.some((a) => a.path === required.path)) failures.push(`required artifact not listed: ${required.path}`);
  for (const platform of require) if (!manifest.artifacts.some((a) => a.platform === platform && a.kind === 'desktop-executable')) failures.push(`no ${platform} desktop build is listed (build it, then run release:prepare again)`);
  if (manifest.source.dirty) failures.push(`the release was prepared from a working tree with uncommitted changes: ${manifest.source.changedFiles.join(', ')}`);
  const pending = Object.entries(manifest.gates).filter(([, gate]) => gate.status !== 'done').map(([id]) => id);
  return { state: failures.length ? 'failed' : 'integrity-verified', browserFiles: browser.files, artifacts: manifest.artifacts.map((a) => `${a.platform}: ${a.path}`), signed: manifest.signed, pendingExternalGates: pending, failures };
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const [command] = process.argv.slice(2);
  const requireIndex = process.argv.indexOf('--require');
  const require = requireIndex > 0 ? process.argv[requireIndex + 1].split(',').filter(Boolean) : [];
  if (command === 'prepare') {
    const manifest = await prepare();
    console.log(`dist/RELEASE-MANIFEST.json: ${manifest.artifacts.length} artifacts, commit ${manifest.source.commit ?? 'unknown'}${manifest.source.dirty ? ' (uncommitted changes)' : ''}`);
  } else if (command === 'verify') {
    const report = await verify({ require });
    console.log(JSON.stringify(report, null, 2));
    if (report.pendingExternalGates.length) console.log(`\nIntegrity is verified only. These external gates are still pending, so this is not a qualified release: ${report.pendingExternalGates.join(', ')}.`);
    if (report.state === 'failed') process.exitCode = 1;
  } else {
    console.error('Usage: node scripts/release-manifest.mjs prepare | verify [--require windows,linux]');
    process.exitCode = 2;
  }
}
