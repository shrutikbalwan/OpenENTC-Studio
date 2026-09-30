# OpenENTC Studio: toolkit research and target structure

Research date: 2026-09-28

## Executive decision

OpenENTC Studio should be an **open engineering workbench**, not a clone of Proteus and not a bundle of unrelated applications. “All in one” means:

- one project and asset model;
- one consistent desktop interface;
- one toolchain manager;
- one job, diagnostics and results system;
- one set of virtual instruments;
- adapters to mature open-source engines;
- reproducible examples, lessons and automated verification.

The product should have three honest capability levels:

1. **Built in:** implemented and tested inside OpenENTC.
2. **Integrated:** an external engine was detected and is controlled through a supported adapter.
3. **Interoperable:** files can be opened, imported or exported, but OpenENTC does not control the full workflow.

Never label a screen “working” merely because it contains controls.

## Research conclusions

### Electronics and PCB

- **KiCad** is the correct primary schematic/PCB interchange target. Its CLI can automate schematic and PCB checks and fabrication exports. KiCad also integrates ngspice, proving that a GUI-over-engine model is viable.
- **ngspice** is the default circuit engine. It supports shared-library control through callbacks as well as ordinary netlist execution. Shared-library integration is attractive later; CLI isolation is safer for the first production adapter.
- **Xyce** is an advanced optional engine for large circuits, harmonic balance and parallel workloads—not the beginner default.
- **Qucs-S/QucsatorRF** is a valuable interoperability reference for RF and multi-backend simulation. Do not copy its UI; learn from its backend-selection model.

Decision: build a canonical schematic graph, export SPICE for simulation, and export/import KiCad formats through a dedicated exchange adapter. Do not attempt a production PCB router in the first releases.

### Digital logic and FPGA

- **Yosys** is the central synthesis engine.
- **nextpnr** provides open place-and-route for supported FPGA families.
- **Icarus Verilog** is useful for simple event simulation; **Verilator** is preferred for fast SystemVerilog linting and compiled simulation.
- **GHDL** is the VHDL compiler/simulator. Its documentation explicitly recommends an external viewer for VCD/FST/GHW output.
- **GTKWave** is a compatibility target, but OpenENTC should also provide a native waveform viewer so users do not leave the application for routine inspection.
- **cocotb** and **SymbiYosys** belong in the advanced verification tier.

Decision: keep simulation, synthesis, place-and-route, programming and formal verification as separate jobs. A successful simulation must never be presented as proof that synthesis or timing closure succeeded.

### Embedded systems

- **Arduino CLI** is the simplest supported beginner backend and exposes board, library, compile, upload and monitor operations.
- **PlatformIO Core** is the broad multi-platform backend. Its documented CLI wraps build, package, library and serial-monitor functions across many MCU families.
- **Renode** is the preferred advanced emulator because it models boards and peripherals and supports automated Robot Framework tests and failed-state snapshots.
- **simavr** is a lightweight AVR-only emulator.
- **QEMU**, **OpenOCD**, `avrdude`, `esptool` and vendor SDK CLIs are optional target-specific adapters.

Decision: begin with Arduino CLI, add PlatformIO as the broad build adapter, then Renode for deterministic virtual boards. Physical upload and serial access require explicit user action and a desktop permission boundary.

### Signals, DSP and communications

- **NumPy/SciPy** should power deterministic built-in computations. `scipy.signal` covers filtering, convolution, correlation, resampling and related primitives.
- **GNU Octave** is the MATLAB-like script interoperability layer.
- **GNU Radio** is the communication/SDR runtime. Its block and flowgraph model maps naturally to a node editor.
- **SoapySDR** and hardware-specific SDR drivers are optional hardware adapters. They must never be installed silently.

Decision: use a typed OpenENTC signal pipeline as the canonical model. Execute lightweight blocks in the local Python worker; translate compatible pipelines to GNU Radio for real-time SDR and hardware.

### RF, microwave and electromagnetics

- **scikit-rf** is the default network-data engine. It understands N-port network matrices and Touchstone data and provides Smith-chart operations.
- **QucsatorRF** is useful for transmission-line, S-parameter and harmonic-balance workflows.
- **openEMS** is the open full-wave FDTD engine, with Python and Octave interfaces. Full-wave jobs can consume significant time, memory and disk space, so they need estimates, quotas, cancellation and separate result bundles.

Decision: first ship calculators, Touchstone handling, matching networks and Smith charts; add QucsatorRF; only then add openEMS through a resource-controlled worker.

### Networks, control and instrumentation

- **ns-3** is the primary network-simulation backend: a modular discrete-event research and education simulator with C++ and Python APIs.
- **TShark/Wireshark** is the packet inspection backend. Saved PCAP/PCAPNG parsing should be available before privileged live capture.
- **python-control** is the lightweight control-system engine; Scilab/Xcos can be an optional interoperability target.
- **sigrok/PulseView** should be the hardware instrumentation reference for logic analyzers and supported test devices.
- **pySerial/libusb/OpenOCD** belong behind tightly scoped hardware services.

Decision: model simulation and capture separately. Network simulation is safe and reproducible; live capture and hardware programming require permissions and clear device selection.

## Recommended tool catalogue

| Domain | Default engine | Optional/advanced | OpenENTC integration |
|---|---|---|---|
| Schematic/PCB | KiCad CLI | gerbv | import/export, checks, fabrication artifacts |
| Analog/mixed signal | ngspice | Xyce, QucsatorRF | netlist job, structured waveforms |
| Digital logic | built-in educational engine | Icarus Verilog | native truth tables and timing |
| Verilog/SystemVerilog | Verilator | Icarus Verilog | lint, simulate, VCD/FST |
| VHDL | GHDL | — | analyze, elaborate, simulate |
| FPGA synthesis | Yosys | SymbiYosys | netlist, reports, formal results |
| FPGA place/route | nextpnr | vendor CLI bridge | timing, utilization, bitstream |
| Firmware beginner | Arduino CLI | simavr | boards, libraries, build, upload |
| Firmware broad | PlatformIO Core | Zephyr/west, ESP-IDF | environments, build, test, upload |
| Board emulation | Renode | QEMU | platform scripts, UART, tests |
| DSP/math | NumPy/SciPy | GNU Octave | local worker, arrays and plots |
| Communications/SDR | GNU Radio | SoapySDR | flowgraphs, streams, hardware |
| RF networks | scikit-rf | QucsatorRF | Touchstone, Smith, de-embedding |
| Electromagnetics | openEMS | — | queued resource-controlled jobs |
| Networking | ns-3 | GNS3 bridge | topology, simulation, traces |
| Packet analysis | TShark | Wireshark GUI | PCAP decode and filters |
| Control systems | python-control | Scilab/Xcos | models, responses, stability |
| Instruments | sigrok | pyVISA bridge | capture, decode, export |
| Debug/program | OpenOCD | avrdude, esptool | explicit device operations |
| Mechanical exchange | KiCad STEP export | FreeCAD | launch/import/export only |

## Product information architecture

Arrange the application by **engineering workflow**, not by executable name.

### 1. Project Hub

- recent projects, templates and learning tracks;
- toolchain health;
- project target summary;
- reproducibility and licence status;
- recent runs and failed jobs.

### 2. Design

- Schematic
- PCB
- Digital block diagram
- Signal/communication flowgraph
- Network topology
- RF structure and matching network

### 3. Simulate

- Circuit analyses: operating point, DC, AC, transient, noise, parameter sweep;
- Digital/HDL simulation;
- MCU/board emulation;
- DSP notebook and signal pipeline;
- modulation/channel/BER lab;
- RF network and EM simulation;
- control-system simulation;
- network discrete-event simulation.

### 4. Build & Deploy

- firmware environments and build matrix;
- FPGA synthesize/place-route/bitstream pipeline;
- device selection and programming;
- PCB checks and fabrication export;
- reproducible build manifest.

### 5. Measure

- oscilloscope;
- spectrum and waterfall;
- logic analyzer and protocol decoder;
- multimeter;
- serial terminal;
- packet inspector;
- Smith chart and network analyzer;
- common cursor, marker, measurement and export behavior.

### 6. Learn

- guided experiments tied to real projects;
- theory cards and equations;
- checkable milestones;
- known-good reference results;
- offline sample library.

### 7. Toolchains

- discovered, missing, incompatible and disabled tools;
- version and path;
- licence and source URL;
- capabilities and supported targets;
- installation guidance (never silent installation);
- self-test and diagnostic logs.

## Target technical architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Tauri 2 desktop shell                                           │
│ React + TypeScript UI · accessible design system · Monaco editor │
├─────────────────────────────────────────────────────────────────┤
│ Workspace services                                              │
│ project · commands · jobs · diagnostics · results · undo · help  │
├─────────────────────────────────────────────────────────────────┤
│ Domain services                                                 │
│ schematic · PCB · HDL · firmware · signal · RF · network · learn │
├─────────────────────────────────────────────────────────────────┤
│ Engine SDK                                                      │
│ detect → validate → prepare → run → parse → cancel → clean       │
├──────────────────────┬──────────────────────┬───────────────────┤
│ Rust native services │ Python math worker   │ External programs │
│ safe process runner  │ NumPy/SciPy/control │ CLI/shared library │
│ serial/USB/files     │ scikit-rf/openEMS   │ explicit adapters  │
└──────────────────────┴──────────────────────┴───────────────────┘
```

### Repository structure

```text
openentc-studio/
  apps/
    desktop/                 # Tauri shell and application composition
    web-preview/             # capability-limited browser preview
  packages/
    ui/                      # accessible design system
    project-model/           # canonical project API and migrations
    engine-sdk/              # adapter types and contract tests
    diagnostics/             # common errors, warnings, source locations
    results/                 # waveform/table/artifact schemas
    schematic/               # graph, ERC and netlist generation
    waveform/                # virtual instruments and large-data renderer
    flowgraph/               # DSP/comms node graph
    topology/                # network/IoT graph
    learning/                # lessons, checks and progress
  crates/
    openentc-core/           # commands, jobs and event bus
    process-runner/          # allow-listed child-process execution
    device-bridge/           # serial/USB/debug boundaries
    artifact-store/          # content-addressed run outputs
    adapters/                # one crate/module per native engine
  workers/
    python/                  # isolated numerical/RF/control worker
  schemas/
    project.schema.json
    engine-manifest.schema.json
    result.schema.json
    lesson.schema.json
  toolchains/
    manifests/               # known executables and capability probes
    lock/                    # optional reproducible version locks
  examples/
    circuits/ embedded/ fpga/ dsp/ communications/ rf/ networks/
  tests/
    fixtures/ contract/ integration/ e2e/ numerical/ security/
  docs/
    architecture/ adapters/ formats/ licences/ tutorials/
```

## Canonical project layout

Use a directory project, optionally packed as `.entcproj`:

```text
my-project/
  openentc.project.json
  design/
    schematic.json
    board.kicad_pcb
    logic.json
    flowgraphs/
    topologies/
  firmware/
  hdl/
  models/
    spice/ touchstone/ symbols/ footprints/
  experiments/
  data/
  notes/
  runs/                     # generated; safe to clean
  build/                    # generated; safe to clean
```

`openentc.project.json` stores format version, targets, documents, toolchain constraints, experiment definitions and provenance. Validate it with JSON Schema 2020-12. Store large binary results outside the JSON document.

## Unified job and result model

Every operation becomes a job with:

- immutable ID, project ID and operation;
- adapter and exact engine version;
- declared inputs and expected outputs;
- state: queued, preparing, running, cancelling, succeeded, failed or cancelled;
- progress with phase names rather than invented percentages;
- timestamped structured logs;
- diagnostics with severity, source file, line and suggested fix;
- resource limits and timeout;
- artifact manifest with hashes;
- reproducibility record: arguments, environment subset and toolchain lock.

Common result types:

- scalar measurement;
- table;
- time-series waveform;
- frequency spectrum;
- logic trace;
- network parameters;
- field/mesh data;
- packet trace;
- build artifact;
- report and diagnostic collection.

## Safety and licence architecture

- The UI never constructs a shell command string.
- Rust adapters pass fixed executable and argument arrays.
- Tauri capabilities allow-list each executable and argument pattern; Tauri documents this scope mechanism for shell commands.
- Jobs run in project-owned temporary directories with time, disk and memory limits where available.
- Live packet capture, USB, serial and programming are separate permissions.
- Imported projects, SPICE models, HDL, scripts and captures are untrusted input.
- Do not automatically execute scripts from imported projects.
- Do not bundle proprietary tools or vendor models.
- Keep per-engine notices, exact licence texts, source URLs and modification records.
- Generate an SPDX software bill of materials for releases and use exact SPDX identifiers.
- Treat this document as engineering guidance, not legal advice; perform a licence review before distribution.

## Delivery plan

### Foundation — release 0.2

- migrate shell to TypeScript;
- define schemas and migrations;
- implement command/job/result services;
- schematic wires, undo/redo, ERC and SPICE export;
- ngspice CLI adapter;
- native waveform viewer;
- toolchain manager with honest states;
- sample projects and contract tests.

### Core engineering — release 0.3

- Arduino CLI build/upload/monitor;
- KiCad CLI checks and fabrication export;
- Verilator/GHDL simulation and waveform import;
- Yosys synthesis reports;
- Python DSP worker;
- structured run history.

### Telecommunication — release 0.4

- typed flowgraph editor;
- GNU Radio translation and execution;
- scikit-rf Touchstone/Smith tools;
- modulation, channel and BER experiments;
- TShark saved-capture analysis;
- ns-3 experiment templates.

### Advanced — release 0.5+

- PlatformIO and Renode;
- nextpnr target support;
- QucsatorRF and Xyce;
- openEMS queued jobs;
- sigrok devices;
- plugin SDK and signed community catalog.

## Definition of “perfect enough to release”

- No primary control is decorative.
- Each operation exposes its real capability and limitation.
- A clean machine can run the bundled sample projects with documented prerequisites.
- Numerical results are checked against reference fixtures and tolerances.
- Project migrations are reversible through backup and tested with old fixtures.
- Cancelling a job terminates its owned process tree.
- Offline use works except where an installation/download action is explicitly requested.
- Accessibility covers keyboard navigation, focus, contrast, labels and reduced motion.
- Windows and Linux installers are signed or clearly marked development builds.
- Licences, notices, source offers and SBOM are included.
- Documentation separates built-in, integrated and interoperable features.

## Primary research sources

- KiCad SPICE integration: https://www.kicad.org/discover/spice/
- KiCad CLI: https://docs.kicad.org/master/en/cli/cli.html
- ngspice shared library: https://ngspice.sourceforge.io/shared.html
- ngspice manual/licensing: https://ngspice.sourceforge.io/docs/ngspice-manual.pdf
- Xyce: https://xyce.sandia.gov/
- Qucs-S backend guidance: https://qucs-s-help.readthedocs.io/en/latest/overview/choosing-a-sim-backend.html
- Yosys documentation: https://yosyshq.readthedocs.io/
- Verilator overview: https://verilator.org/guide/latest/overview.html
- GHDL overview: https://ghdl.github.io/ghdl/about.html
- Arduino CLI: https://docs.arduino.cc/arduino-cli/getting-started
- PlatformIO Core: https://docs.platformio.org/en/latest/core/
- Renode documentation: https://renode.readthedocs.io/
- SciPy signal processing: https://docs.scipy.org/doc/scipy/reference/signal.html
- GNU Radio structure: https://wiki.gnuradio.org/index.php/FAQ
- scikit-rf networks: https://scikit-rf.readthedocs.io/en/latest/tutorials/Networks.html
- openEMS: https://www.openems.de/
- ns-3: https://www.nsnam.org/
- TShark: https://www.wireshark.org/docs/man-pages/tshark
- Tauri command scopes: https://v2.tauri.app/reference/javascript/shell/
- JSON Schema: https://json-schema.org/specification
- SPDX identifiers and SBOM: https://spdx.dev/learn/handling-license-info/
