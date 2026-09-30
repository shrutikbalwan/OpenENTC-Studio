import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

function probe(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
  if (result.error) return { ok: false, detail: result.error.message };
  return { ok: result.status === 0, detail: (result.stdout || result.stderr || '').trim() };
}

function probeRustTool(name) {
  for (const command of [name, join(homedir(), '.cargo', 'bin', `${name}.exe`)]) {
    if (command !== name && !existsSync(command)) continue;
    const result = probe(command, ['--version']);
    if (result.ok) return { ...result, command };
  }
  return { ok: false, detail: `${name} was not found on PATH or in the Rustup user toolchain.`, command: name };
}

const cargo = probeRustTool('cargo');
const rustc = probeRustTool('rustc');
const buildScript = process.argv.includes('--installer') ? 'build:installer' : 'build:unbundled';
if (!cargo.ok || !rustc.ok) {
  console.error('[desktop] NOT VERIFIED: Cargo and rustc are required for the Tauri build.');
  if (!cargo.ok) console.error(`[desktop] cargo: ${cargo.detail}`);
  if (!rustc.ok) console.error(`[desktop] rustc: ${rustc.detail}`);
  process.exitCode = 2;
} else {
  console.log(`[desktop] ${cargo.detail}`);
  console.log(`[desktop] ${rustc.detail}`);
  const path = `${dirname(cargo.command)}${delimiter}${process.env.PATH ?? ''}`;
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    console.error('[desktop] npm did not provide its executable script path.');
    process.exit(1);
  }
  const build = spawnSync(process.execPath, [npmCli, '--prefix', 'apps/desktop', 'run', buildScript], { cwd: process.cwd(), env: { ...process.env, PATH: path }, stdio: 'inherit', windowsHide: true });
  if (build.error) console.error(`[desktop] build could not start: ${build.error.message}`);
  process.exitCode = build.status ?? 1;
}
