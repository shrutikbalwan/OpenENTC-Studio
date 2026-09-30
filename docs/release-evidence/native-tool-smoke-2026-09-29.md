# Native tool version smoke evidence — 2026-09-29

The bounded `npm run native:smoke` command was run with explicit executable paths and elevated local process permission. The OSS CAD Suite runtime `bin` and `lib` directories are now added automatically by the smoke script.

| Tool | Result |
| --- | --- |
| Arduino CLI 1.5.1 | passed |
| GHDL 6.0.0 | passed |
| Verilator 5.053 devel | passed |
| Yosys 0.69+154 | passed |
| nextpnr-ice40 0.11.1 | passed |
| ngspice-26 (local console build) | passed; deterministic divider batch result `v(out) = 4.500000e+00` |

Version probes establish executable availability only. They do not certify physical boards, uploads, serial I/O, FPGA programming, or desktop-shell invocation.
