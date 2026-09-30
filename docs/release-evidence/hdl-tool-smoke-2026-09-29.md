# Hardware-free HDL tool smoke evidence

Date: 2026-09-29
Host: Windows x64 development host
Command: `npm run hdl:smoke`

The command creates a bounded temporary fixture and executes the configured tools through the project process boundary. It does not access hardware or install packages. On the Windows OSS CAD Suite installation, the script adds both `bin` and `lib` to the process runtime path so bundled DLLs are loaded deterministically.

## Results

| Stage | Result | Evidence |
|---|---|---|
| GHDL analyze | passed | VHDL-2008 `counter_tb.vhd` analyzed successfully |
| GHDL elaborate | passed | `counter_tb` elaborated successfully |
| GHDL simulation | passed | Simulation stopped at 100 ns and produced an 842-byte VCD |
| Verilator lint | passed | SystemVerilog `counter.sv` lint completed without diagnostics |
| Yosys synthesis | passed | SystemVerilog synthesized and produced a 2,947-byte JSON netlist |
| nextpnr-ice40 | passed (dry-run) | Constraint-free HX8K/CT256 place-and-route completed with automatic IO placement; no board pin claim is made |

Installed versions observed by the native smoke probe:

- GHDL 6.0.0
- Verilator 5.053 devel
- Yosys 0.69+154
- nextpnr-ice40 0.11.1

## Interpretation

The elevated rerun completed GHDL analyze/elaborate/simulate, Verilator lint, Yosys JSON synthesis and nextpnr-ice40 HX8K/CT256 constraint-free dry-run successfully. This is `software-verified` HDL evidence. It is not `hardware-verified` evidence and does not claim board-constrained placement, bitstream programming, timing behavior on a physical board or programmer compatibility.
