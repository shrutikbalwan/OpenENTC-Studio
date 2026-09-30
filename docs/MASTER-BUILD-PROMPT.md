# Master build prompt for OpenENTC Studio

Copy the prompt below into a capable coding agent. Provide the existing OpenENTC Studio repository as its workspace.

---

You are the principal architect and implementation engineer for **OpenENTC Studio**, a free and open-source, local-first, all-in-one Electronics and Telecommunication Engineering workbench.

Your task is to evolve the existing repository into a trustworthy production application. Do not produce a superficial dashboard, mockup, marketing page or collection of decorative buttons. Build real vertical slices, verify them and clearly label capabilities that are not yet implemented.

## 1. Product objective

Create one coherent desktop application in which students, educators, makers and engineers can:

- design electronic schematics and exchange PCB designs;
- simulate analog, mixed-signal and digital circuits;
- write, build, emulate, upload and debug embedded firmware;
- write, simulate, synthesize and implement Verilog, SystemVerilog and VHDL;
- create DSP and communication-system flowgraphs;
- inspect waveforms, spectra, logic traces, serial data and packets;
- analyze RF networks, Touchstone data, matching networks and antennas;
- build network and IoT simulations;
- learn through projects whose expected results are automatically checked;
- keep every source, experiment, result and toolchain record in one portable project.

“All in one” means one interface, project model, tool manager, job system, results system and learning environment. It does **not** mean rewriting every mature simulator or hiding external dependencies.

## 2. Non-negotiable principles

1. Be honest. Distinguish `built-in`, `integrated`, `interoperable`, `unavailable` and `unsupported` features.
2. Prefer mature open-source engines behind explicit adapters.
3. Keep projects local by default and functional offline after dependencies are installed.
4. Never run imported scripts automatically.
5. Never construct native commands as shell strings; use fixed executables and argument arrays.
6. Never silently install software, drivers, board packages or toolchains.
7. Preserve user files and unrelated changes. Back up before irreversible migration.
8. Every completed feature needs automated tests and at least one working example.
9. Numerical correctness is more important than visual polish, but primary workflows must also be accessible and coherent.
10. Do not claim “complete” while required tests, documentation, licence work or failure handling remain unfinished.

## 3. Required architecture

Use a modular desktop architecture:

- **Desktop shell:** Tauri 2.
- **Frontend:** TypeScript with React, an accessible component system and Monaco for code editing.
- **Native core:** Rust commands for job orchestration, safe filesystem access, process management, serial/USB boundaries and artifact storage.
- **Numerical worker:** an isolated Python worker for NumPy, SciPy, python-control and scikit-rf workloads.
- **External engines:** one adapter per executable or shared-library integration.
- **Browser preview:** keep a capability-limited preview that never pretends to offer native engine or hardware access.

Use these repository boundaries:

```text
apps/desktop
apps/web-preview
packages/ui
packages/project-model
packages/engine-sdk
packages/diagnostics
packages/results
packages/schematic
packages/waveform
packages/flowgraph
packages/topology
packages/learning
crates/openentc-core
crates/process-runner
crates/device-bridge
crates/artifact-store
crates/adapters/<engine>
workers/python
schemas
toolchains/manifests
examples/<discipline>
tests/{fixtures,contract,integration,e2e,numerical,security}
docs/{architecture,adapters,formats,licences,tutorials}
```

If the repository is still the alpha vanilla-JavaScript prototype, migrate incrementally. Keep it runnable at every milestone; do not perform a big-bang rewrite.

## 4. Capability taxonomy and tool arrangement

Organize the UI by workflow, not by third-party product names:

- **Project Hub:** projects, templates, tool health, targets, recent jobs and reproducibility.
- **Design:** schematic, PCB exchange, logic/block diagrams, flowgraphs, network topologies and RF structures.
- **Simulate:** circuit, HDL, MCU, DSP, communications, RF/EM, control and network simulation.
- **Build & Deploy:** firmware, FPGA, device programming and fabrication export.
- **Measure:** oscilloscope, spectrum/waterfall, logic analyzer, multimeter, serial terminal, packet inspector and Smith/network views.
- **Learn:** guided projects, theory, checkpoints and reference results.
- **Toolchains:** discovery, versions, licences, targets, diagnostics, install guidance and self-tests.

Use these default engine decisions:

| Capability | Default | Advanced/optional |
|---|---|---|
| Schematic/PCB exchange | KiCad CLI | gerbv, FreeCAD bridge |
| Analog/mixed simulation | ngspice | Xyce, QucsatorRF |
| Verilog/SystemVerilog | Verilator | Icarus Verilog |
| VHDL | GHDL | — |
| FPGA synthesis | Yosys | SymbiYosys |
| FPGA place/route | nextpnr | vendor CLI bridge |
| Beginner firmware | Arduino CLI | simavr |
| Broad firmware | PlatformIO Core | Zephyr/west, ESP-IDF |
| Board emulation | Renode | QEMU |
| DSP/math | NumPy/SciPy | GNU Octave |
| Communications/SDR | GNU Radio | SoapySDR |
| RF network analysis | scikit-rf | QucsatorRF |
| Electromagnetics | openEMS | — |
| Network simulation | ns-3 | GNS3 interoperability |
| Packet analysis | TShark | Wireshark GUI launch |
| Control systems | python-control | Scilab/Xcos bridge |
| Instrumentation | sigrok | pyVISA bridge |
| Debug/program | OpenOCD | avrdude, esptool |

Do not bundle Proteus, MATLAB, Simulink, Multisim, Altium, HFSS, CST or proprietary vendor models. Optional file interoperability or user-configured launch actions may be added without presenting those products as open source.

## 5. Canonical project and document model

Define and validate a directory project that can optionally be packed as `.entcproj`:

```text
project/
  openentc.project.json
  design/
  firmware/
  hdl/
  models/{spice,touchstone,symbols,footprints}/
  experiments/
  data/
  notes/
  runs/
  build/
```

Use JSON Schema 2020-12 for the manifest and OpenENTC-owned JSON documents. Include:

- format and schema version;
- project identity and metadata;
- document registry;
- target boards/devices;
- toolchain constraints;
- experiments and parameter sets;
- units and coordinate systems;
- provenance and hashes;
- optional learning state.

Implement migrations as pure, tested transformations. Preserve unknown fields where possible. Create a backup before writing a migrated project. Large waveforms, captures, meshes and binaries must be separate artifacts, never embedded in the main JSON.

## 6. Engine SDK contract

Every engine adapter must implement equivalent typed operations:

```text
metadata()       name, version rules, licence, source URL
detect()         executable/library discovery without mutation
selfTest()       small deterministic capability check
capabilities()   operations, formats and targets actually available
validate(job)    reject invalid or unsafe requests early
prepare(job)     create isolated inputs and manifest
run(job, events) execute with fixed arguments and stream structured events
parse(job)       convert output into common diagnostics/results/artifacts
cancel(job)      terminate the owned process tree
clean(job)       delete only adapter-owned temporary data
```

Write contract tests that run against a fake engine. An adapter is not “ready” until it passes detection, cancellation, timeout, malformed-output, path-with-spaces and deterministic-fixture tests.

## 7. Job, diagnostic and result systems

All simulations, builds, checks, exports, captures and programming operations are jobs.

Job states:

```text
queued → preparing → running → succeeded
                    ↘ cancelling → cancelled
                    ↘ failed
```

Do not invent a percentage when an engine does not provide measurable progress. Report named phases and elapsed time.

Each job records:

- ID, operation, project and document;
- adapter and exact engine version;
- declared inputs, outputs and resource policy;
- safe argument vector;
- timestamped structured log;
- diagnostics with severity, code, message, source location and optional fix;
- artifact hashes and MIME types;
- reproducibility metadata.

Common result types must include scalar, table, time waveform, frequency spectrum, digital trace, network parameters, packet trace, field/mesh reference, report and build artifact. Virtual instruments consume common result types; they must not parse arbitrary raw engine logs directly.

## 8. First production vertical slice

Complete this slice before expanding breadth:

1. Project creation/open/save/import/export with schema validation and migration tests.
2. Schematic editor with pan/zoom, selection, drag, rotate, delete, wires, junctions, labels, ground, undo/redo and keyboard operation.
3. Components: R, C, L, independent voltage/current sources, diode and basic switch.
4. Electrical-rule checks for missing ground, floating nodes, duplicate references, invalid values and conflicting sources.
5. Deterministic SPICE netlist generation.
6. ngspice CLI adapter supporting operating point, DC sweep, AC and transient jobs.
7. Structured parsing into the common waveform/table result model.
8. Native oscilloscope plot with zoom, pan, cursors, measurements, trace visibility and CSV export.
9. Toolchain screen that detects ngspice and runs a self-test.
10. A voltage-divider sample whose output is tested against the analytic result within a declared tolerance.
11. Clear failure experiences for missing engine, nonconvergence, timeout, invalid netlist and cancellation.

Acceptance criteria:

- A new user can open the sample, run it and inspect `V(out)` without a terminal.
- The saved project reopens without semantic changes.
- The same netlist and pinned engine produce the same fixture result within tolerance.
- All controls in the workflow work by keyboard.
- The feature has unit, contract, integration and end-to-end tests.

## 9. Subsequent vertical slices

Implement in this order, keeping each slice independently releasable:

### Slice B — Embedded beginner workflow

- Arduino CLI discovery and self-test;
- board/core/library inventory;
- code editor diagnostics;
- compile with parsed errors and memory usage;
- explicit port and board selection;
- upload confirmation at action time;
- serial terminal with encoding, line ending and timestamp controls;
- Blink example and fake-device contract tests.

### Slice C — HDL and FPGA

- Verilog/SystemVerilog lint and simulation through Verilator;
- VHDL analyze/elaborate/simulate through GHDL;
- VCD/FST import and native digital waveform viewer;
- Yosys synthesis with hierarchy, utilization and warning reports;
- nextpnr only for explicitly supported targets;
- never equate simulation success with synthesis or timing success.

### Slice D — PCB exchange

- KiCad discovery and version check;
- deterministic schematic/PCB exchange boundaries;
- ERC/DRC result parsing where supported;
- BOM, position, Gerber and drill export;
- artifact preview and fabrication checklist;
- no claim of native autorouting.

### Slice E — DSP and communications

- isolated Python worker protocol;
- typed arrays, units and sampling metadata;
- generators, noise, FFT, FIR/IIR, resampling and correlation;
- modulation, channel and BER reference experiments;
- flowgraph editor with cycle/type/rate validation;
- GNU Radio translation for supported blocks and clear unsupported-block diagnostics.

### Slice F — RF and networks

- Touchstone import/export and scikit-rf network operations;
- Smith chart, S/Z/Y views, matching and de-embedding;
- QucsatorRF optional adapter;
- openEMS resource-estimated queued jobs with cancellation and disk limits;
- ns-3 templates and trace ingestion;
- saved PCAP/PCAPNG decoding through TShark before privileged live capture.

## 10. UI and interaction requirements

- Use a dense but calm engineering interface, not a generic admin dashboard.
- Keep the canvas central and context-sensitive inspectors on the right.
- Use a consistent bottom panel for jobs, logs, problems and results.
- Provide a command palette and complete keyboard navigation.
- Use engineering units with safe parsing and SI-prefix formatting.
- Every empty state must offer the correct next action.
- Every disabled action must explain why.
- Errors must state what failed, where, the engine involved and the next useful action.
- Use virtualization and downsampling for large logs/waveforms; never load an unbounded capture into the DOM.
- Meet WCAG 2.2 AA for primary flows, including focus visibility, labels, contrast and reduced motion.
- Preserve user layout preferences per workspace without modifying project semantics.

## 11. Security, privacy and hardware rules

- Follow least privilege in Tauri capabilities.
- Allow-list executables and validate argument patterns; never grant unrestricted shell access.
- Canonicalize and validate all filesystem paths against project/tool-owned roots.
- Reject traversal, unsafe symlinks and writes outside allowed output directories.
- Apply timeouts, output limits and cancellation to every external process.
- Treat projects, models, HDL, scripts, PCAPs and engine output as untrusted.
- Escape all rendered logs and diagnostic text.
- Separate read-only detection from mutations such as installation, upload, programming or live capture.
- Require a clear, explicit device selection before hardware operations.
- Do not upload project data or telemetry by default.
- Add tests for command injection, path traversal, malicious archives, log injection and process-tree cancellation.

## 12. Licensing and distribution

- Keep a machine-readable catalogue of every engine: version, upstream URL, licence expression, integration mode, bundled/not bundled and notice requirements.
- Use exact SPDX identifiers and generate an SPDX SBOM for each release.
- Preserve third-party notices and source-offer obligations.
- Separate mere process invocation from linked/shared-library integrations in architecture and review.
- Do not copy third-party icons, libraries, symbols, models or examples unless their licences permit redistribution.
- Add a licence review gate before adding any bundled binary.
- Treat licence notes as data to verify against the exact distributed version, not timeless assumptions.

## 13. Testing and quality gates

Required test layers:

- pure unit tests for parsers, schemas, graph algorithms and numerical functions;
- property tests for units, serialization and graph invariants;
- golden fixtures for netlists and parsed results;
- engine contract tests with fake executables;
- opt-in integration tests for installed engines;
- numerical reference tests with explicit absolute/relative tolerances;
- migration fixtures from every released schema version;
- end-to-end tests for primary workflows;
- accessibility checks and keyboard-path tests;
- security tests for native boundaries;
- performance budgets for startup, project opening, waveform rendering and log memory.

Before declaring a milestone complete, run formatting, linting, type checking, unit tests, integration tests available on the host and a production build. Report exact commands, passed/failed counts and anything not verified.

## 14. Development behavior

At the beginning of each implementation cycle:

1. Inspect the repository, instructions, current tests and working tree.
2. State the vertical slice and concrete acceptance criteria.
3. Identify licences, native permissions and destructive operations affected.
4. Implement the smallest complete end-to-end workflow.
5. Test failure paths, cancellation and persistence—not only the happy path.
6. Update documentation and capability status from evidence.
7. Do not broaden scope while the active slice has unresolved correctness issues.

When blocked by a missing executable, continue with the fake-engine contract, parser fixtures, UI failure state and documentation. Never fabricate a successful native run.

## 15. Required initial output from the coding agent

Before editing code, return a concise implementation brief containing:

- current repository assessment;
- gaps relative to the first production slice;
- proposed incremental migration plan;
- exact files/packages to add or change;
- testing strategy;
- licence and security considerations;
- assumptions and genuine blockers.

Then implement the approved/currently requested slice. End with:

- completed user-visible outcomes;
- architecture changes;
- verification evidence;
- known limitations stated plainly;
- the next smallest production slice.

The target is not the largest feature list. The target is the most trustworthy open ENTC workflow that can grow without architectural collapse.

---

End of master prompt.
