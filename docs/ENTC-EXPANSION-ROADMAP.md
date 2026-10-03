# ENTC Expansion Roadmap

Goal: make OpenENTC Studio cover every ENTC subject and the everyday industry tools a
student would otherwise need separate software for. The list comes from a gap analysis of
the SPPU E&TC 2019 syllabus (SE–BE, core and electives), the AICTE ECE model electives and
current industry skill demand, compared with the labs that already exist.

## Already built

Circuit Lab (DC/transient/AC with BJT, MOSFET, op-amp), Digital Logic Lab, Communication
Lab, Signals & DSP (FFT, filter designer, convolution), Control Lab (transfer functions, root
locus, Routh, PID), RF & Antennas (Smith chart, matching, lines, arrays, link budget),
Engineering Calculators and PCB Studio (placement, autorouting, DRC, Gerber export).

## Rules for every phase

- Each feature is a real computation, validated against an independent reference
  (textbook values, SciPy, ngspice, SDCC/ucsim, simavr, gerbonara …) with automated tests.
- Each feature gets a capability-ledger entry with evidence and honest limitations.
- `npm run verify` stays green and the UI is checked in a real browser before each push.

## Phases

| Phase | Theme | Items | Syllabus link |
|---|---|---|---|
| 1 | Embedded core | 8051 emulator (assembler, CPU, timers, UART, interrupts, LEDs/7-seg/LCD/switches, Intel HEX) · AVR/Arduino Uno emulator (HEX from Arduino IDE/CLI, GPIO, timers, UART) · Logic analyser with UART/I²C/SPI decoding | TE Microcontrollers, Embedded Processors |
| 2 | Lab bench & reports | Virtual instruments on Circuit Lab circuits (oscilloscope, function generator, DMM, power supply) · Lab-record (journal) PDF export from any experiment · Microcontroller + circuit co-simulation | All lab courses |
| 3 | Power & mixed signal | Power electronics lab (rectifiers, SCR firing, choppers, buck/boost, inverters, PWM) · ADC/DAC simulator (SAR, flash, Σ-Δ, INL/DNL) · Sensors & signal conditioning · EV battery/motor/range calculators | TE Power Devices, Sensors elective, BE EV elective |
| 4 | Digital design & VLSI | Verilog simulator with testbench and waveforms · CMOS inverter VTC, noise margins, delay · RTOS scheduling simulator | BE VLSI, Embedded & RTOS elective |
| 5 | Circuits, signals & EM theory | Network theorems & two-port solver · Fourier series, Laplace & Z-transform explorer, step-by-step DFT · Superheterodyne receiver & noise figure · EMFT field and wave visualiser · Waveguides & microwave networks · Fibre-optic link calculator | SE Electrical Circuits, Signals & Systems, Communication; TE EMFT; BE Microwave |
| 6 | Networks, mobile & security | Cellular planning (reuse, Erlang-B, Okumura-Hata, handoff) · Computer networks (subnetting, routing, sliding window) · Cryptography step by step (RSA, Diffie-Hellman, AES, SHA) · Wireless sensor networks · SDR flowgraph editor | TE Cellular Networks, Network Security; BE WSN, SDR electives |
| 7 | Applied & AI | Digital image processing · Biomedical signal processing (ECG/EEG) · Neural-network playground · Math/script console | TE DIP elective, BE ANN elective, AICTE Biomedical |
| 8 | Learning | Learning Hub lessons for all six tracks · Quizzes and viva questions with instant checking | Whole programme |

Thirty items in total. Phases run in order; each phase ends with documentation, the full
verification suite and a push.

## Progress

- [x] Phase 1 — 8051 emulator, Arduino Uno emulator (with Wire/SPI devices: I²C LCD, DS1307, 74HC595), logic analyser with UART/SPI/I²C decoders and VCD
- [x] Phase 2 — Lab Bench (oscilloscope, function generator, CV/CC supply, multimeter), Lab Records PDF export, Arduino + circuit co-simulation
- [x] Phase 3 — Power Electronics lab, ADC & DAC lab, Sensors & Instrumentation, EV Engineering
- [x] Phase 4 — built-in Verilog simulator (matches Icarus Verilog), VLSI Lab (CMOS inverter, matches ngspice), RTOS Scheduler
- [x] Phase 5 — Network Theory (phasor MNA, theorems, two-ports; matches ngspice), Signals & Systems explorer (matches SciPy), EM & Microwave lab (matches scikit-rf), receiver & noise and optical-fibre tabs in Communication
- [x] Phase 6 — Cellular Planning, Computer Networks (subnetting, routing, ARQ, MAC), Cryptography step by step, Sensor Networks (LEACH lifetime), SDR Flowgraph editor
- [x] Phase 7 — Image Processing (matches scipy/scikit-image), Biomedical Signals (Pan–Tompkins, HRV, EEG), Neural Networks playground, Math Console
- [x] Phase 8 — Learning Hub: 36 lessons in six tracks linked to the labs, quizzes with fresh numbers, viva practice

All eight phases (30 items) are built, validated and documented.
