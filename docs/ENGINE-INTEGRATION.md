# Engine integration contract

Every connector should implement the same lifecycle:

1. `detect()` — locate supported executable versions.
2. `capabilities()` — report available operations and targets.
3. `prepare(project, operation)` — produce isolated input files.
4. `run(operation, args)` — execute without an intermediate shell.
5. `parse(result)` — convert output into OpenENTC diagnostics and artifacts.
6. `cancel()` — stop the owned process tree safely.
7. `clean()` — remove only connector-owned temporary files.

## Planned adapters

| Discipline | Primary engine | First supported exchange |
|---|---|---|
| Analog circuits | ngspice | SPICE netlist and raw waveform |
| PCB | KiCad | `.kicad_sch`, `.kicad_pcb`, Gerber |
| Embedded | Arduino CLI | Sketch, build log and firmware image |
| AVR simulation | simavr | ELF firmware and UART stream |
| FPGA | Yosys/nextpnr | Verilog, JSON netlist, bitstream |
| DSP | GNU Octave | Script, CSV and plot data |
| Communications | GNU Radio | Flowgraph exchange and sample stream |
| Networks | Wireshark/tshark | PCAP and decoded packet records |

Connectors must not claim readiness merely because a button exists. The interface distinguishes built-in, detected, unavailable and unsupported capabilities.
