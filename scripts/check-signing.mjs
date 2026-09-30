import { access } from 'node:fs/promises';

const configuredSigntool = process.env.SIGNTOOL || '';
const signtoolCandidates = [
  configuredSigntool,
  'C:/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x64/signtool.exe',
  'C:/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x86/signtool.exe',
].filter(Boolean);
let detectedSigntool = '';
for (const candidate of signtoolCandidates) {
  try { await access(candidate); detectedSigntool = candidate; break; } catch { /* try next candidate */ }
}
const certificate = process.env.OPENENTC_SIGNING_CERT || '';
const checks = {
  signtoolConfigured: Boolean(configuredSigntool),
  certificateConfigured: Boolean(certificate),
  signtoolDiscovered: Boolean(detectedSigntool),
};
checks.signtoolPresent = Boolean(detectedSigntool);
const ready = checks.signtoolConfigured && checks.signtoolPresent && checks.certificateConfigured;
const report = {
  state: ready ? 'configured-not-executed' : 'not-configured',
  checks,
  discoveredSigntool: detectedSigntool || null,
  nextAction: ready ? 'Run signing in the approved release environment and record certificate identity and verification output.' : 'Set SIGNTOOL to the approved signtool path and provide an approved code-signing certificate reference; no signing action was attempted.',
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
