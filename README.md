# OpenENTC Studio

OpenENTC Studio is a free, open-source foundation for an all-in-one Electronics and Telecommunication Engineering workspace. It combines a working browser-based laboratory with a modular connector layer for specialist open-source tools.

## Included in this release

- Interactive ENTC dashboard with Circuit and Embedded alpha workspaces plus seven specialist workflow previews
- Schematic canvas with components, selection, editing, wire aliases, ERC diagnostics and project persistence
- Deterministic SPICE export plus permission-gated desktop ngspice operating-point, DC, AC and transient workflows with version evidence, magnitude/phase traces, cursor deltas, CSV export and source-linked engine failures (native execution remains unavailable in the browser preview)
- Built-in circuit simulator (modified nodal analysis, Newton-Raphson, trapezoidal integration) for resistors, capacitors, inductors, diodes, LEDs, switches, NPN/PNP transistors (Ebers-Moll), N/P-channel MOSFETs (level 1) and op-amps (finite gain, 1 MHz GBW, rail clipping) with independent sources: DC operating point, transient (step, sine and square-pulse stimulus) and small-signal AC sweeps, cross-checked against ngspice
- Interactive waveform and Bode plots with rise time, overshoot, RMS and −3 dB bandwidth readouts, CSV export, and nine ready-made example circuits including BJT and op-amp amplifiers
- Limited DC-result meter and generated signal preview
- Built-in Signals workspace with bounded sine generation, causal FIR filtering and FFT; a digital filter designer (Butterworth and Chebyshev I IIR, windowed-sinc FIR with rectangular/Hann/Hamming/Blackman/Kaiser windows) with magnitude, phase, group delay, impulse response, z-plane pole-zero plot, coefficients matching scipy.signal and a two-tone filtering demo; and a step-by-step convolution explorer
- Built-in Control Lab: transfer functions typed as polynomials in s, poles/zeros and stability, exact step and impulse responses with rise/overshoot/settling/steady-state error, Bode plots with gain and phase margins, Nyquist and pole-zero maps, root locus with asymptotes and jω crossings, Routh-Hurwitz tables (including zero-row cases), and a PID loop with Ziegler-Nichols tuning
- Digital Logic Lab: Boolean expressions or minterm notation to truth tables, K-maps with groups, exact Quine-McCluskey minimization with don't-cares, SOP/POS and NAND/NOR-only forms with gate diagrams; an event-driven gate and flip-flop simulator (text netlists, clocks, 1 ns delays, timing diagrams, truth-table extraction) with adder, decoder, latch, counter and shift-register templates; and a number/code converter (bases, complements, Gray, BCD, excess-3)
- Authored experiment configurations persist in the versioned project manifest and restore into Signals, Control, QPSK, RF, Network and Digital Waveform labs; generated results remain runtime data
- Built-in Communication Lab: QPSK link; AM, DSB-SC, FM and PM with spectra, Bessel sideband tables and demodulation; BPSK/QPSK/8-PSK/16-QAM constellations with measured vs theoretical BER, BER-vs-Eb/N0 curves and raised-cosine eye diagrams; sampling, aliasing, uniform/μ-law PCM with SQNR and seven line codes; Hamming, CRC and convolutional/Viterbi error-control coding
- Built-in RF Lab: Touchstone S-parameters on a real Smith chart; reflection, VSWR, return and mismatch loss; L-network, single-stub and quarter-wave matching (Pozar method, each solution verified); lossy transmission lines with Γ trajectory and standing-wave plots; microstrip (analysis and synthesis), coax and twin-lead impedance; uniform linear antenna arrays with polar patterns, directivity, beamwidth and sidelobe level; and a Friis link budget with noise floor, SNR, margin and range
- Engineering Calculators: resistor colour codes (3–6 bands, both directions) with E6–E96 preferred values, SMD and capacitor markings, 555 astable/monostable analysis and design, op-amp gain/bandwidth/clipping, dB and power-unit conversion (dBm, dBW, dBµV, V rms), Ohm's law, series/parallel, dividers, RLC resonance, RC filters, LED resistors and ADC resolution
- Lab Bench: a two-channel oscilloscope (V/div, time/div, AC/DC coupling, edge trigger, cursors, automatic Vpp/RMS/frequency/duty/rise-time/phase measurements, CSV export), function generator (sine, square, triangle, sawtooth, pulse; offset, duty, High-Z or 50 Ω output), two-channel CV/CC bench supply and a 6000-count autoranging multimeter (DC/AC volts and amps, ohms, diode test, continuity), all connected to the Circuit Lab circuit, with five ready experiments
- Lab Records: fill in a practical-journal write-up (aim, apparatus, theory, procedure, observation table, result) from experiment templates, include the circuit component list, Lab Bench oscilloscope captures and measurements, Circuit Lab simulation graphs and 8051/Arduino program listings, and download a formatted PDF with a marks and signature block
- Power Electronics: single- and three-phase diode/SCR rectifiers (half-wave, full and semi converters, 3- and 6-pulse) with R/RL/RLE and capacitor-filter loads, buck/boost/buck-boost converters in CCM and DCM, square/quasi-square/SPWM single- and three-phase inverters, and an AC voltage controller — waveforms, harmonic spectra, THD, power factor and every simulated value next to its textbook formula
- ADC & DAC Lab: ADC transfer functions with offset, gain, bow and mismatch errors, DNL/INL by end-point and ramp-histogram methods, FFT-based SNR/SINAD/SFDR/ENOB (ideal ADCs reach 6.02N + 1.76 dB), SAR conversion clock by clock, flash comparator ladders, dual-slope integration with mains rejection, 1st/2nd-order sigma-delta noise shaping and decimation, and R-2R / binary-weighted DACs with resistor tolerance
- Sensors & Instrumentation: NIST ITS-90 thermocouple tables (E, J, K, N, T) with cold-junction compensation, Pt100/Pt1000 (IEC 60751), NTC β and Steinhart–Hart fits, quarter/half/full strain-gauge bridges, LVDTs, in-amp gain and level-shift design with E96 resistors, and complete sensor → amplifier → ADC → °C chains with error plots
- EV Engineering: battery-pack S×P sizing with sag and losses, road-load forces, consumption and range vs speed, motor torque–speed envelope with 0–100 km/h and top speed, gear-ratio selection and CC-CV charging time
- Built-in Verilog simulator (FPGA & Digital): event-driven four-state simulation of a Verilog-2001 subset — modules, parameters, hierarchy, memories, blocking/non-blocking assignments, delays, edges, case/casez, functions, tasks, $display/$monitor/$random — with a console, waveform viewer and VCD download; output and waveforms match Icarus Verilog on 21 test designs, and 14 lab designs (counters, adders, FSMs, ALU, RAM, UART, PWM, traffic light) are built in
- VLSI Lab: CMOS inverter voltage transfer characteristic, switching threshold, VIL/VIH and noise margins, short-circuit current, propagation delays, rise/fall times and dynamic power with SPICE level-1 devices — next to the long-channel formulas and matching ngspice
- RTOS Scheduler: rate-monotonic, deadline-monotonic, EDF, least-laxity, fixed-priority, FCFS and round-robin scheduling with Gantt charts, deadline misses, Liu–Layland and EDF utilisation tests, exact response-time analysis and priority inversion with priority inheritance or ceiling protocols
- Network Theory: phasor (complex) nodal analysis of any SPICE-style netlist with R, L, C, independent and all four dependent sources; Thévenin/Norton equivalents (with dependent sources), superposition, maximum power transfer, star–delta, and Z/Y/h/g/ABCD two-port parameters with conversions, reciprocity/symmetry and loaded gain
- Signals & Systems: Fourier series of standard waveforms with partial-sum synthesis, Gibbs overshoot and Parseval power; Laplace and z-transform partial fractions (repeated and complex poles), inverse transforms, poles/zeros, ROC, stability and initial/final values; and the DFT term by term with the radix-2 FFT butterfly diagram — partial fractions match SciPy
- EM & Microwave: point charges with field lines and a numerical Gauss's-law check, plane waves in any medium (α, β, η, skin depth), Fresnel reflection with Brewster and critical angles, polarisation ellipse, rectangular and circular waveguide modes with field patterns and wall loss, S-parameter cascades with Smith chart, and amplifier stability circles — checked against scikit-rf
- Communication receiver & fibre tabs: superheterodyne frequency plan and image rejection, Friis noise figure, sensitivity, IIP3 and SFDR; fibre NA, V-number, modes, power budget and rise-time budget
- Cellular Planning: Erlang-B/C traffic with blocking curves, hexagonal reuse patterns for any cluster size with S/I and sectoring, Okumura–Hata/COST-231 path loss with fade margin and cell radius, and handoff with shadowing, hysteresis and time-to-trigger
- Computer Networks: IPv4 subnetting with binary view, VLSM plans, route summarisation and IPv6 compression; Dijkstra step tables and shortest-path trees; distance-vector rounds with count-to-infinity and poisoned reverse; stop-and-wait, Go-Back-N and Selective Repeat timelines with lost frames and ACKs; ALOHA, CSMA and CSMA/CD throughput
- Cryptography: Caesar (with χ² cracking), Vigenère (index of coincidence, key recovery), Playfair, Hill and rail fence; extended Euclid, square-and-multiply, Miller–Rabin and CRT; RSA with CRT decryption and signatures; Diffie–Hellman with a man-in-the-middle and a discrete-log attack; AES, DES and SHA-256/HMAC round by round — checked against FIPS vectors, node:crypto and PyCryptodome
- Sensor Networks: random or grid deployments with radio links, hop counts and k-coverage maps, and lifetime curves for direct, minimum-energy multi-hop and LEACH clustering on the first-order radio model
- SDR Flowgraph: a GNU Radio-style block editor — drag blocks, wire ports, edit parameters and see scope, spectrum, constellation and error-count sinks update; examples for FM, AM, QPSK with RRC pulses and a mixer with channel filter
- Image Processing: built-in test images or your own picture; histogram equalisation, gamma, Otsu and bit planes; mean, Gaussian, Laplacian and median filters with added noise; Sobel and step-by-step Canny; 2-D FFT ideal/Butterworth/Gaussian filters; erosion, dilation, opening, closing and object counting; JPEG-style DCT compression with PSNR
- Biomedical Signals: synthetic ECG with wander, mains hum, muscle noise and ectopic beats (or your own pasted recording), zero-phase cleaning, Pan–Tompkins QRS detection shown stage by stage, HRV with tachogram, Poincaré plot and LF/HF, and EEG rhythms with Welch band powers
- Neural Networks: train a multilayer perceptron (tanh/ReLU/sigmoid, Adam or SGD, L2) on circle, XOR, spiral, blobs, moons or a sine curve and replay the decision regions epoch by epoch; step through the perceptron learning rule and see why XOR fails
- Math Console: a MATLAB-style calculator with scripts and a command line — complex phasors, matrices and A\\b, ranges, your own functions, polynomials, engineering suffixes (4.7k, 100n) and plot()
- Learning Hub: six tracks (circuits, digital, embedded, signals, communication, RF) of short lessons with key formulas and a button to the matching lab, quizzes that draw fresh numbers every attempt and accept answers like 4.7k, viva practice with model answers, and the verified lab checkpoints
- AI lab partner: an "Ask AI" panel on every page that works with OpenAI or any OpenAI-compatible service (free local Ollama, OpenRouter, Groq, Gemini). It reads your current lab, calculates with OpenENTC's own engines before answering (each reply shows the calculations), and can explain, give hints only, or act as a viva examiner — in English, Hindi or Marathi
- Information & Coding: entropy and source coding (Huffman with the reduction table, Shannon–Fano, LZW), mutual information and channel capacity by Blahut–Arimoto and Shannon–Hartley, m-sequence PN properties and Gold codes, DSSS against a jammer, FHSS hop patterns and an OFDM link where the cyclic prefix beats multipath
- Analog Design: enter a specification and get a design with standard part values — voltage-divider bias and CE amplifier (load line, Q-point, stability factor, gain, coupling capacitors, open it in Circuit Lab and run it), Wien/phase-shift/Colpitts/Hartley/crystal oscillators with the feedback β solved at the design frequency, Butterworth Sallen–Key filters of any order and MFB band-pass with the whole cascade solved, Zener and LM317 regulators, Schmitt triggers and the 565 PLL
- Measurements: virtual AC bridges with a live null detector and a challenge mode where the unknown is hidden until you balance it (Maxwell, Hay, Owen, Schering, De Sauty, Wien), Lissajous figures with ratio and phase, reading statistics and limiting errors, voltmeter loading, ammeter/Ayrton shunt, voltmeter multiplier and ohmmeter design, and the Q-meter
- Microcontroller Lab: an 8051 assembler (byte-identical to SDCC's for all 255 opcodes) and cycle-accurate simulator (matches ucsim) with timers, UART, interrupts, Intel HEX load/save, breakpoints and single-stepping, and a virtual trainer board — LEDs, DIP switches, push buttons on INT0/INT1, 7-segment display, 4×4 keypad, 16×2 LCD and a serial terminal — plus nine classic lab programs; and an Arduino Uno (ATmega328P) simulator that runs compiled sketches (.hex) with GPIO, PWM, timers, USART, ADC and interrupts — instruction results and cycle counts match simavr — with a pin view, LEDs, buttons, potentiometers, LiquidCrystal LCD, I²C LCD backpack (PCF8574), DS1307 RTC, 74HC595 shift register and serial monitor, plus fourteen example sketches built with the official Arduino core (including Wire and SPI); the Uno can be co-simulated with the Circuit Lab circuit — pins drive the circuit (with hardware PWM on D3/5/6/9/10/11) and node voltages feed the pins and ADC — with ready PWM-DAC, RC-timer, voltage-divider and transistor-switch experiments; both boards have a logic analyser that captures every pin with UART, SPI and I²C decoders (output matches sigrok) and VCD export/import for GTKWave and PulseView
- PCB Studio: turns the Circuit Lab schematic into a board with through-hole or SMD footprints, auto-placement, drag-and-rotate editing, ratsnest, a two-layer A* autorouter with vias, a geometric design-rule check (clearance, shorts, widths, drills, annular ring, board edge, unrouted nets), an IPC-2221 trace-width calculator, and a fabrication ZIP (Gerber X2 copper/mask/silkscreen/outline, Excellon drill, BOM, pick-and-place)
- Embedded text editor with an Arduino starter, shallow source-structure checks, read-only installed board/core/library inventory, explicit board and manual port selection, desktop compilation/upload, and a separately permissioned bounded serial terminal with baud, encoding, line-ending, timestamp, pause and export controls
- Digital Lab with persisted SystemVerilog/VHDL examples; separately cancellable Verilator lint, GHDL simulation/VCD ingestion, Yosys synthesis/netlist and explicit nextpnr HX8K/CT256 place-route workflows when detected; plus bounded scalar/vector VCD import
- Unavailable previews remain for FPGA, full RF/IoT/network workflows and specialist engine execution; DSP and communications now include the bounded built-in slices listed above
- Evidence-backed engine catalogue with compiled read-only desktop detection; external engines remain unavailable until explicitly configured and detected
- Offline project import/export using a bounded manifest-only `.entcproj` package, with legacy `.entc.json` import compatibility and migration backups
- Portable project metadata for units, provenance and content-addressed generated-artifact references
- Responsive, keyboard-accessible interface with light and dark themes
- Read-only Toolchains workspace with reviewed engine metadata and honest unavailable/unsupported states
- Tested Arduino CLI and native serial boundaries with bounded inventory/output, explicit board/port validation, project-confined build evidence, separate programmer/serial target grants and no connected-device scan. Arduino CLI is locally installed and its version smoke test passes; board inventory, compile, upload and serial I/O still require an authorized target.
- No runtime package dependencies

## Run

1. Install Node.js 20 or newer.
2. In this folder, run `npm ci`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:4173`.

Create the reproducible browser-preview bundle with `npm run build`; it writes `dist/` with a versioned metadata file, SPDX SBOM, license/notices, SHA-256 manifest, and conventional `SHA256SUMS.txt`. Run `npm run release:prepare` to build the preview and regenerate the native Cargo SBOM/notice candidate together; `npm run license:audit` checks that every generated native package has a declared licence and that notices exist, while human legal/security review remains required. Run `npm run phase:status` to audit the authoritative phase matrix and evidence links. Run the complete baseline gate with `npm run verify`. Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run worker:check`, `npm test`, `npm run browser:smoke` (opt-in headless Chrome load/DOM smoke), `npm run native:sbom` (desktop Cargo SPDX inventory and notice candidate), and `npm run release:verify` (cross-artifact hash verification).

Build the Windows desktop executable with `npm run desktop:check`. Build the unsigned NSIS development installer with `npm run desktop:installer`; on Linux, `npm --prefix apps/desktop run build:linux-bundles` produces `deb` and `AppImage` packages when the Tauri Linux prerequisites are installed. Signing and clean-machine release qualification are intentionally separate release gates.

Linux package structure and local WSL lifecycle probes are available as `bash scripts/linux-deb-lifecycle-smoke.sh <package.deb>` and `bash scripts/linux-xvfb-smoke.sh <desktop-binary>`; they require a test Linux host with package mutation privileges and a virtual display, and do not replace clean-machine qualification.

Native tool versions can be checked without automatic discovery or installation using `npm run native:smoke`. Set absolute executable paths through `OPENENTC_NGSPICE`, `OPENENTC_ARDUINO_CLI`, `OPENENTC_VERILATOR`, `OPENENTC_GHDL`, `OPENENTC_YOSYS` and `OPENENTC_NEXTPNR_ICE40` before running it.

With `OPENENTC_NGSPICE` configured, run `npm run ngspice:integration` to exercise real version, operating-point, DC, AC and transient adapter workflows. This is software evidence only; physical circuits and desktop-shell UI execution remain separate gates.

Run the hardware-free HDL acceptance fixture with `npm run hdl:smoke`. It performs real GHDL analyze/elaborate/simulation, Verilator lint, Yosys JSON synthesis and a constraint-free nextpnr iCE40 dry-run when their executable paths are configured. The application’s board workflow still requires a board-specific PCF.

The repository pins TypeScript as a development dependency. The `typecheck` command validates the existing structural contracts and runs the strict compiler in-process against `tsconfig.json`, so verification fails on compiler diagnostics or when dependencies have not been installed.

## Important scope

The built-in circuit simulator covers linear R/L/C networks, exponential diode and LED models, ideal switches, BJTs, MOSFETs, op-amps and independent sources. Transistors use fixed small-signal capacitances (BJT Cje 8 pF, Cjc 4 pF, τF 0.3 ns; MOSFET Cgs 10 pF, Cgd 2 pF) and have no Early effect, the MOSFET body is tied to the source, the op-amp has a single pole and zero output resistance, there are no controlled sources, the transient time step is fixed, and circuits are limited to 400 unknowns; use the ngspice workflow for larger or more detailed circuits. Specialist applications are unavailable previews: there is no detection or execution in this browser alpha, and no external executable is represented as installed. Future desktop packaging can discover installed engines and invoke reviewed versions according to their own licences.

Browser projects use crash-aware localStorage writes with bounded corrupt backups and interrupted-write recovery. The Windows Tauri shell is compiled and exercises native Unicode-path persistence, a reviewed folder picker, project-scoped permissions, bounded jobs/artifacts/events, and owned process-tree timeout/cancellation. Linux and clean-machine installer verification remain pending.

## Architecture

- `src/app.js`: application shell and workspace rendering
- `src/core/store.js`: state, autosave and project lifecycle
- `src/core/project.js`: browser-safe project validation and import/export facade
- `packages/project-model`: versioned project schema, migrations, directory persistence, artifact references and history contracts
- `packages/artifact-store`: bounded atomic artifact writes and SHA-256 integrity records
- `packages/schematic`: deterministic connectivity, intermediate netlists and electrical-rule checks
- `packages/numerics`, `packages/communications`, `packages/control`, `packages/rf`, `packages/hdl`, `packages/topology`, `packages/packets`: bounded built-in numerical and interoperability kernels
- `src/core/engine-registry.js`: external-tool capability registry
- `src/engines/circuit-engine.js`: built-in DC, transient and AC circuit simulator
- `packages/numerics/src/filters.mjs`, `packages/control/src/analysis.mjs`: filter design and control-systems analysis
- `packages/rf/src/rf-tools.mjs`, `packages/calculators`: RF design tools and everyday electronics calculators
- `packages/instruments`: oscilloscope measurements and trigger, multimeter display and ohmmeter, function-generator and CV/CC supply models
- `packages/report`: dependency-free PDF writer and lab-record layout (tables, graphs, listings)
- `packages/power`: ideal-switch rectifier, DC-DC, inverter and AC-controller simulation with Fourier analysis
- `packages/converters`: ADC/DAC behavioural models, linearity and FFT-based dynamic testing
- `packages/sensors`: thermocouple, RTD, thermistor, bridge and signal-conditioning models
- `packages/ev`: battery, road-load, motor/acceleration and charging calculations
- `packages/verilog`: Verilog lexer, parser, four-state values and event-driven simulator
- `packages/vlsi`: CMOS inverter static and transient analysis
- `packages/rtos`: real-time scheduling simulation and analysis
- `packages/network`: complex MNA solver, network theorems and two-port parameters
- `packages/sigsys`: Fourier series, Laplace/z-transform partial fractions and step-by-step DFT/FFT
- `packages/em`: electrostatics, plane waves, Fresnel, polarisation, waveguides and two-port S-parameter networks
- `packages/commsys`: superheterodyne plan, Friis cascade, sensitivity, IIP3 and fibre-optic link budgets
- `packages/cellular`: Erlang-B/C, reuse and co-channel interference, Hata path loss and handoff simulation
- `packages/netproto`: subnetting/VLSM/IPv6, link-state and distance-vector routing, ARQ simulation and MAC throughput
- `packages/cryptolab`: classical ciphers, BigInt number theory, RSA/DH, and AES/DES/SHA-256 with every round recorded
- `packages/wsn`: deployment, connectivity, coverage, radio energy model and LEACH lifetime simulation
- `packages/sdr`: flowgraph engine with DSP, modulation, channel and sink blocks
- `packages/imaging`: greyscale image processing (point ops, filters, Canny, FFT, morphology, DCT/JPEG)
- `packages/biomed`: ECG/EEG synthesis, biquad filtering, Pan–Tompkins, HRV and Welch band powers
- `packages/neural`: datasets, MLP with backpropagation and gradient checking, perceptron rule
- `packages/mathconsole`: tokenizer, parser and interpreter for the console language
- `packages/assistant`: OpenAI-compatible chat loop with engine-backed tools for the AI lab partner
- `packages/infotheory`: entropy, Huffman/Shannon–Fano/LZW coding, DMC capacity (Blahut–Arimoto), LFSR m-sequences, Gold codes, DSSS, FHSS, Gray QAM and OFDM
- `packages/analogdesign`: design-to-spec for bias, oscillators, Sallen–Key/MFB filters, regulators, Schmitt trigger and PLL, verified with the phasor network solver
- `packages/measurement`: complex-impedance bridge solver, Lissajous, statistics and error propagation, meter design and Q-meter
- `packages/mcu`: 8051 instruction set, assembler, CPU simulator, trainer-board peripherals and Intel HEX; ATmega328P core, peripherals (including TWI with I²C devices) and Arduino Uno board; logic-analyser channels, protocol decoders and VCD
- `packages/pcb`: footprints, board model, autorouter, DRC and Gerber/Excellon/BOM/ZIP output for PCB Studio
- `packages/logic`: Boolean minimization, gate-level logic simulation and number codes for the Digital Logic Lab
- `src/core/circuit-plot.js`: waveform/Bode plotting, measurements and CSV export
- `src/data/example-circuits.js`: example circuits for the built-in simulator
- `src/data/modules.js`: ENTC module catalogue

Detailed planning documents:

- `docs/TOOLKIT-RESEARCH-AND-STRUCTURE.md`: researched tool selection, information architecture, repository layout, safety model and delivery plan
- `docs/MASTER-BUILD-PROMPT.md`: reusable implementation prompt for a coding agent
- `docs/PHASE-BY-PHASE-MASTER-PROMPTS.md`: standalone prompts for phases 0–13, with acceptance criteria and handoffs
- `docs/audit/alpha-baseline.md`: evidence-backed screen, control, model, test, performance and accessibility baseline
- `capabilities/ledger.json`: machine-readable capability state and evidence ledger
- `docs/definition-of-done.md` and `docs/release-checklist.md`: delivery and release gates
- `docs/HARDWARE-FREE-RELEASE-POLICY.md`: virtual-first development, capability wording and hardware certification rules
- `.github/workflows/verify.yml`: clean Windows/Linux software verification workflow

## Roadmap

1. Complete desktop-shell qualification for the software-verified ngspice and Arduino CLI workflows, then add physical-board evidence where contributed.
2. Verify the Tauri shell and development installer on clean Windows and Linux machines.
3. Connect each verified engine adapter to native discovery and process execution only after its target-specific permission review.
4. Add MCU emulation and GNU Radio flowgraph exchange; extend native HDL qualification across supported engines.
5. Establish signed releases, component-library governance and reproducible builds.

## Licence

The OpenENTC Studio shell is GPL-3.0-or-later. Connected tools keep their own licences and attribution requirements.
