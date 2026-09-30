# Hardware-free development and release policy

OpenENTC Studio is developed virtual first. Physical boards and laboratory instruments are optional validation targets, not prerequisites for building the application.

## Capability states

Use these states independently from the existing implementation ledger states:

- `software-verified`: automated software workflow passed.
- `emulator-verified`: supported emulator workflow passed.
- `hardware-unverified`: physical validation has not been performed.
- `hardware-verified`: the named hardware, revision, programmer, OS and test procedure passed.

Never infer `hardware-verified` from `software-verified` or `emulator-verified`.

## Hardware-free substitutes

| Physical dependency | Development substitute |
|---|---|
| Arduino board | Arduino CLI compile plus fixture artifacts |
| Serial device | Fake serial transport and deterministic loopback fixtures |
| AVR board | simavr |
| Complex MCU/board | Renode, or QEMU when supported |
| FPGA board | HDL simulation, Yosys synthesis and nextpnr dry-run |
| FPGA programmer | Fake programmer contract adapter |
| Oscilloscope/logic analyzer | Generated waveform and protocol fixtures |
| SDR | GNU Radio simulation sources/sinks and recorded IQ fixtures |
| Live network | ns-3 and saved PCAP/PCAPNG fixtures |
| RF instruments | scikit-rf and Touchstone fixtures |

## Phase-gate rule

Missing hardware is not a software phase blocker. A phase may pass its software gate when fake-device contract tests pass, compile/simulate/emulate operations pass where available, hardware actions are permission-gated, the capability ledger records hardware as unverified, and documentation states exactly what was not physically tested.

## Release profiles

- **Developer/Alpha:** software and emulator workflows; unsigned builds permitted with clear warnings.
- **Beta:** clean-install and cross-platform software verification; hardware remains unverified.
- **Hardware-certified profile:** published separately for each contributed hardware matrix entry.

Hardware certification requires a signed report containing device identity, revision, programmer, operating system, tool versions, procedure and result.

Physical certification remains additive and must never block the browser, desktop, simulation, emulation, persistence, documentation or accessibility software gates.
