import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const manifest = new URL('../apps/desktop/src-tauri/Cargo.toml', import.meta.url);
const output = new URL('../dist/NATIVE-BUILD-SBOM.spdx.json', import.meta.url);
const noticesOutput = new URL('../dist/NATIVE-THIRD-PARTY-NOTICES.txt', import.meta.url);
const defaultCargo = process.platform === 'win32'
  ? join(process.env.CARGO_HOME || join(process.env.USERPROFILE || '', '.cargo'), 'bin', 'cargo.exe')
  : 'cargo';
const cargo = process.env.CARGO || (defaultCargo !== 'cargo' && existsSync(defaultCargo) ? defaultCargo : 'cargo');

let metadata;
try {
  metadata = JSON.parse(execFileSync(cargo, ['metadata', '--manifest-path', fileURLToPath(manifest), '--format-version', '1', '--locked'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
} catch (error) {
  const detail = error?.stderr?.toString?.() || error?.message || String(error);
  throw new Error(`cargo metadata failed; install Cargo or set CARGO to its absolute path: ${detail}`);
}

const packages = metadata.packages || [];
const byId = new Map(packages.map((pkg) => [pkg.id, pkg]));
const refFor = (pkg) => `SPDXRef-Cargo-${pkg.name.replace(/[^A-Za-z0-9.-]/g, '-')}-${pkg.version.replace(/[^A-Za-z0-9.-]/g, '-')}`;
const declaredLicense = (pkg) => {
  const value = pkg.license || (pkg.name === 'openentc-studio' ? 'GPL-3.0-or-later' : null);
  return value ? value.replace(/\s*\/\s*/g, ' OR ') : 'NOASSERTION';
};
const rootId = metadata.resolve?.root || metadata.workspace_members?.[0];
const rootPackage = byId.get(rootId) || packages.find((pkg) => pkg.name === 'openentc-studio');
const relationships = [];
if (rootPackage) relationships.push({ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: refFor(rootPackage) });

for (const pkg of packages) {
  const node = metadata.resolve?.nodes?.find((candidate) => candidate.id === pkg.id);
  for (const dependency of node?.dependencies || []) {
    const target = byId.get(dependency);
    if (target) relationships.push({ spdxElementId: refFor(pkg), relationshipType: 'DEPENDS_ON', relatedSpdxElement: refFor(target) });
  }
}

const document = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: 'OpenENTC Studio native Cargo build',
  documentNamespace: 'https://openentc.example.invalid/spdx/native-cargo-build',
  documentDescribes: rootPackage ? [refFor(rootPackage)] : [],
  creationInfo: { created: process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : '2026-09-29T00:00:00Z', creators: ['Tool: OpenENTC native SBOM generator'] },
  packages: packages.map((pkg) => ({
    SPDXID: refFor(pkg),
    name: pkg.name,
    versionInfo: pkg.version,
    downloadLocation: pkg.source || 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: declaredLicense(pkg),
    licenseDeclared: declaredLicense(pkg),
    copyrightText: 'NOASSERTION',
    supplier: pkg.authors?.length ? `Person: ${pkg.authors.join(', ')}` : 'NOASSERTION',
    description: pkg.description || undefined,
    externalRefs: pkg.source ? [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: `pkg:cargo/${pkg.name}@${pkg.version}` }] : [],
  })),
  relationships,
};

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

const noticeSections = [];
for (const pkg of packages) {
  const packageDirectory = pkg.manifest_path ? dirname(pkg.manifest_path) : null;
  if (!packageDirectory) continue;
  const files = (await readdir(packageDirectory).catch(() => [])).filter((name) => /^(?:license|copying|notice)(?:[._-]|$)/i.test(name)).sort();
  for (const name of files) {
    const path = join(packageDirectory, name);
    const text = await readFile(path, 'utf8').catch(() => '');
    if (text && text.length <= 2 * 1024 * 1024) noticeSections.push(`===== ${pkg.name} ${pkg.version} — ${name} =====\n${text.trim()}\n`);
  }
}
const rootLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8').catch(() => '');
noticeSections.unshift(`===== OpenENTC Studio — LICENSE =====\n${rootLicense.trim()}\n`);
await writeFile(noticesOutput, `OpenENTC Studio native Cargo dependency notices\n\nGenerated from Cargo metadata and local package sources. Review before distribution.\n\n${noticeSections.join('\n')}`, 'utf8');
process.stdout.write(`Native SPDX SBOM and third-party notices written (${packages.length} Cargo packages, ${noticeSections.length} notice sections).\n`);
