import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sbomPath = resolve(root, 'dist/NATIVE-BUILD-SBOM.spdx.json');
const noticesPath = resolve(root, 'dist/NATIVE-THIRD-PARTY-NOTICES.txt');
const sbom = JSON.parse(await readFile(sbomPath, 'utf8'));
const packages = Array.isArray(sbom.packages) ? sbom.packages : [];
const unresolved = packages.filter((pkg) => !pkg.licenseDeclared || pkg.licenseDeclared === 'NOASSERTION');
const notices = await readFile(noticesPath, 'utf8');
const noticeSections = (notices.match(/^===== /gm) || []).length;
const report = {
  state: unresolved.length === 0 && noticeSections > 0 ? 'passed' : 'review-required',
  packageCount: packages.length,
  unresolvedLicenseCount: unresolved.length,
  unresolvedExamples: unresolved.slice(0, 20).map((pkg) => `${pkg.name}@${pkg.versionInfo}`),
  noticeSectionCount: noticeSections,
  humanReviewRequired: true,
};
await stat(noticesPath);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.state !== 'passed') process.exitCode = 1;
