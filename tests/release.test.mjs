// Release tooling: the manifest lists artifacts without hard-coded hashes, detects tampering, never
// marks an external gate done without evidence, and the build is reproducible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ARTIFACTS, verifyBrowserBuild } from '../scripts/release-manifest.mjs';
import { differences } from '../scripts/check-reproducible-build.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('external release gates are pending unless real evidence exists', () => {
  const { gates } = JSON.parse(read('release/gates.json'));
  for (const id of ['code-signing', 'clean-machine-install', 'hardware-qualification', 'accessibility-audit', 'expert-numerical-review', 'licence-review', 'classroom-pilot']) assert.ok(gates[id], `${id} is tracked`);
  for (const [id, gate] of Object.entries(gates)) {
    assert.ok(['pending', 'in-progress', 'done'].includes(gate.status), `${id}: status`);
    if (gate.status === 'done') assert.ok(gate.evidence && existsSync(path.join(root, gate.evidence)), `${id}: "done" needs an evidence file`);
  }
  // None of these has been performed for this alpha. Update the test together with real evidence.
  assert.equal(Object.values(gates).filter((gate) => gate.status === 'done').length, 0);
});

test('the release manifest hashes what was built; no hash is hard-coded in the script', () => {
  const script = read('scripts/release-manifest.mjs');
  assert.doesNotMatch(script, /['"`][0-9A-Fa-f]{64}['"`]/, 'no literal SHA-256 values');
  for (const required of ['dist/BUILD-MANIFEST.json', 'dist/SHA256SUMS.txt', 'dist/NATIVE-BUILD-SBOM.spdx.json', 'dist/NATIVE-THIRD-PARTY-NOTICES.txt']) assert.ok(ARTIFACTS.some((a) => a.path === required && a.required), required);
  for (const platform of ['windows', 'linux']) assert.ok(ARTIFACTS.some((a) => a.platform === platform && a.kind === 'desktop-executable' && !a.required), `${platform} build is optional unless --require is given`);
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['release:prepare'], /release-manifest\.mjs prepare$/);
  assert.equal(pkg.scripts['release:verify'], 'node scripts/release-manifest.mjs verify');
  assert.equal(existsSync(path.join(root, 'scripts/verify-release-bundle.mjs')), false, 'the old checker with hard-coded hashes is gone');
});

test('browser build verification detects a changed, missing or unlisted file', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'openentc-release-'));
  try {
    writeFileSync(path.join(dir, 'a.txt'), 'alpha');
    writeFileSync(path.join(dir, 'b.txt'), 'beta');
    const hash = (text) => import('node:crypto').then(({ createHash }) => createHash('sha256').update(text).digest('hex'));
    const files = [{ path: 'a.txt', sha256: await hash('alpha') }, { path: 'b.txt', sha256: await hash('beta') }];
    writeFileSync(path.join(dir, 'BUILD-MANIFEST.json'), JSON.stringify({ files }));
    writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${files.map((f) => `${f.sha256}  ${f.path}`).join('\n')}\n`);
    assert.deepEqual((await verifyBrowserBuild(dir)).failures, []);
    writeFileSync(path.join(dir, 'a.txt'), 'tampered');
    assert.match((await verifyBrowserBuild(dir)).failures.join('\n'), /browser file changed: a\.txt/);
    rmSync(path.join(dir, 'b.txt'));
    assert.match((await verifyBrowserBuild(dir)).failures.join('\n'), /browser file missing: b\.txt/);
    writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${files[0].sha256}  a.txt\n`);
    assert.match((await verifyBrowserBuild(dir)).failures.join('\n'), /different numbers of files/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reproducibility check reports lines that differ between two builds', () => {
  assert.deepEqual(differences('aa  x\nbb  y\n', 'aa  x\nbb  y\n'), []);
  assert.deepEqual(differences('aa  x\nbb  y\n', 'aa  x\ncc  y\n'), ['first only:  bb  y', 'second only: cc  y']);
});

test('CI runs a release dry run on both desktop builds and checks reproducibility', () => {
  const workflow = read('.github/workflows/verify.yml');
  assert.match(workflow, /npm run release:prepare\n\s+node scripts\/release-manifest\.mjs verify --require windows/);
  assert.match(workflow, /npm run release:prepare\n\s+node scripts\/release-manifest\.mjs verify --require linux/);
  assert.match(workflow, /run: npm run release:reproducible/);
});
