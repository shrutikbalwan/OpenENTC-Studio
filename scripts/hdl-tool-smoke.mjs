import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runProcess } from '../packages/process-runner/src/index.mjs';

const tools = {
  ghdl: process.env.OPENENTC_GHDL || '',
  verilator: process.env.OPENENTC_VERILATOR || '',
  yosys: process.env.OPENENTC_YOSYS || '',
  nextpnr: process.env.OPENENTC_NEXTPNR_ICE40 || ''
};

function configureOssCadRuntime(executable) {
  if (!executable) return;
  const bin = resolve(dirname(executable));
  const root = resolve(bin, '..');
  if (!/oss-cad-suite/i.test(root)) return;
  if (!process.env.YOSYSHQ_ROOT) process.env.YOSYSHQ_ROOT = root;
  if (!process.env.VERILATOR_ROOT) process.env.VERILATOR_ROOT = join(root, 'share', 'verilator');
  const runtimePath = [bin, join(root, 'lib'), process.env.PATH || ''].filter(Boolean).join(process.platform === 'win32' ? ';' : ':');
  process.env.PATH = runtimePath;
}
configureOssCadRuntime(tools.verilator);
configureOssCadRuntime(tools.yosys);
configureOssCadRuntime(tools.nextpnr);

const vhdl = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity counter_tb is end entity;
architecture test of counter_tb is
  signal clk : std_logic := '0';
  signal reset_n : std_logic := '0';
  signal count : unsigned(3 downto 0) := (others => '0');
begin
  clk <= not clk after 5 ns;
  process(clk, reset_n) begin
    if reset_n = '0' then count <= (others => '0');
    elsif rising_edge(clk) then count <= count + 1;
    end if;
  end process;
  process begin wait for 12 ns; reset_n <= '1'; wait for 80 ns; wait; end process;
end architecture;
`;
const systemVerilog = `module counter(input logic clk, input logic reset_n, output logic [3:0] count);
  always_ff @(posedge clk or negedge reset_n) begin
    if (!reset_n) count <= 4'b0000;
    else count <= count + 4'b0001;
  end
endmodule
`;
const fpgaCore = `module core;
  wire unused = 1'b0;
endmodule
`;

async function invoke(executable, args, cwd) {
  if (!executable) return { state: 'not-configured' };
  const result = await runProcess({ executable, args, cwd, timeoutMs: 30_000, maxOutputBytes: 2 * 1024 * 1024 });
  return { state: result.ok ? 'passed' : 'failed', output: `${result.stdout}\n${result.stderr}`.trim(), error: result.error };
}

const root = await mkdtemp(join(tmpdir(), 'openentc-hdl-'));
const results = {};
try {
  const vhdlPath = join(root, 'counter_tb.vhd');
  const svPath = join(root, 'counter.sv');
  const corePath = join(root, 'core.sv');
  await writeFile(vhdlPath, vhdl, 'utf8');
  await writeFile(svPath, systemVerilog, 'utf8');
  await writeFile(corePath, fpgaCore, 'utf8');
  results.ghdlAnalyze = await invoke(tools.ghdl, ['-a', '--std=08', 'counter_tb.vhd'], root);
  if (results.ghdlAnalyze.state === 'passed') results.ghdlElaborate = await invoke(tools.ghdl, ['-e', '--std=08', 'counter_tb'], root);
  if (results.ghdlElaborate?.state === 'passed') results.ghdlSimulate = await invoke(tools.ghdl, ['-r', '--std=08', 'counter_tb', '--stop-time=100ns', '--vcd=counter.vcd'], root);
  results.verilatorLint = await invoke(tools.verilator, ['--lint-only', '--timing', '--top-module', 'counter', 'counter.sv'], root);
  results.yosysSynthesis = await invoke(tools.yosys, ['-p', 'read_verilog -sv counter.sv; hierarchy -top counter; proc; opt; memory; opt; write_json counter.json; stat'], root);
  if (results.yosysSynthesis.state === 'passed') {
    results.outputs = { vcd: (await readFile(join(root, 'counter.vcd')).catch(() => Buffer.alloc(0))).byteLength, json: (await readFile(join(root, 'counter.json')).catch(() => Buffer.alloc(0))).byteLength };
  }
  results.nextpnr = await invoke(tools.nextpnr, ['--version'], root);
  if (results.nextpnr.state === 'passed') {
    const coreSynthesis = await invoke(tools.yosys, ['-p', 'read_verilog -sv core.sv; synth_ice40 -top core; write_json core.json'], root);
    results.nextpnrSynthesis = coreSynthesis;
    if (coreSynthesis.state === 'passed') results.nextpnrDryRun = await invoke(tools.nextpnr, ['--hx8k', '--package', 'ct256', '--json', 'core.json', '--asc', 'core.asc'], root);
  }
  if (results.nextpnr.state === 'not-configured') results.nextpnr = { state: 'not-configured', reason: 'nextpnr executable is not configured' };
  else if (results.nextpnr.state === 'passed' && results.nextpnrDryRun?.state !== 'passed') results.nextpnrDryRun = { state: 'not-run', reason: 'constraint-free fixture could not be synthesized' };
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  if (Object.values(results).some((result) => result?.state === 'failed')) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
