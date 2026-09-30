import { runProcess } from '../packages/process-runner/src/index.mjs';

const probes = [
  { id: 'ngspice', env: 'OPENENTC_NGSPICE', args: ['-v'] },
  { id: 'arduino-cli', env: 'OPENENTC_ARDUINO_CLI', args: ['version'] },
  { id: 'verilator', env: 'OPENENTC_VERILATOR', args: ['--version'] },
  { id: 'ghdl', env: 'OPENENTC_GHDL', args: ['--version'] },
  { id: 'yosys', env: 'OPENENTC_YOSYS', args: ['--version'] },
  { id: 'nextpnr-ice40', env: 'OPENENTC_NEXTPNR_ICE40', args: ['--version'] }
];

function configureRuntime(executable) {
  if (!executable || !/oss-cad-suite/i.test(executable)) return;
  const normalized = executable.replaceAll('\\', '/');
  const bin = normalized.slice(0, normalized.lastIndexOf('/'));
  const root = bin.slice(0, bin.lastIndexOf('/'));
  const separator = process.platform === 'win32' ? ';' : ':';
  process.env.PATH = [bin, `${root}/lib`, process.env.PATH || ''].filter(Boolean).join(separator);
}

for (const probe of probes) configureRuntime(process.env[probe.env] || '');

const results = [];
for (const probe of probes) {
  const executable = process.env[probe.env] || '';
  if (!executable) {
    results.push({ id: probe.id, state: 'not-configured', env: probe.env });
    continue;
  }
  const result = await runProcess({ executable, args: probe.args, timeoutMs: 10_000, maxOutputBytes: 64 * 1024 });
  results.push({ id: probe.id, state: result.ok ? 'passed' : 'failed', executable, output: `${result.stdout}\n${result.stderr}`.trim(), error: result.error });
}

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
if (results.some((result) => result.state === 'failed')) process.exitCode = 1;
