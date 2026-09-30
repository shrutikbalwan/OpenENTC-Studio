# OpenENTC Studio: phase-by-phase master prompts

Use these prompts in order. Give the coding agent the same repository each time. Do not begin a new phase until the preceding phase satisfies its acceptance criteria and leaves no critical regression.

## Reusable preamble

Paste this preamble before every phase prompt:

```text
You are working on OpenENTC Studio, a free, open-source, local-first Electronics and Telecommunication Engineering workbench.

Read these files completely before acting:
- README.md
- CONTRIBUTING.md
- SECURITY.md
- docs/ARCHITECTURE.md
- docs/ENGINE-INTEGRATION.md
- docs/TOOLKIT-RESEARCH-AND-STRUCTURE.md
- docs/MASTER-BUILD-PROMPT.md

Inspect the repository, current tests, Git state and applicable project instructions. Preserve user changes. Do not silently install tools or dependencies, execute imported scripts, access hardware, upload firmware, capture live traffic or perform destructive migrations.

Core rules:
1. Implement a real vertical slice; do not create decorative controls or fake success states.
2. Capability states are built-in, integrated, interoperable, unavailable or unsupported.
3. Use fixed executable paths and argument arrays; never build shell-command strings.
4. Treat projects, models, scripts, HDL, PCAPs and tool output as untrusted.
5. Add tests for success, failure, cancellation and persistence.
6. Keep the repository runnable throughout the work.
7. State limitations honestly and do not mark the phase complete without verification evidence.

Before editing, provide a concise assessment and implementation plan. Then implement, verify and document the phase. At the end report user-visible outcomes, changed architecture, test results, unresolved limitations and readiness for the next phase.
```

---

## Phase 0 — Baseline audit and delivery controls

```text
PHASE 0 OBJECTIVE

Establish a trustworthy baseline for the existing OpenENTC Studio alpha. Do not expand product functionality in this phase.

Required work:
- Inventory every current screen, control, data model and test.
- Identify controls that are functional, simulated, decorative or misleading.
- Map current code to the target architecture and record migration gaps.
- Establish formatting, linting, type-checking and test commands.
- Add a capability ledger that records status and evidence for each feature.
- Add an architectural decision record for the desktop stack, engine-process boundary and licence strategy.
- Add issue templates for bug, engine adapter, numerical error and security report.
- Add a documented definition of done and release checklist.
- Record performance and accessibility baselines without claiming compliance.

Required outputs:
- docs/audit/alpha-baseline.md
- docs/decisions/0001-desktop-and-engine-boundary.md
- docs/definition-of-done.md
- machine-readable capability ledger
- reliable one-command verification script

Acceptance criteria:
- Every primary UI action has an honest capability state.
- Existing tests pass from a clean checkout.
- The audit identifies unsupported claims and the exact phase that will resolve each one.
- Verification failure produces a nonzero exit code.
- No native engine is represented as installed unless detection evidence exists.

Non-goals:
- Do not integrate ngspice, Arduino, KiCad or other external engines yet.
- Do not perform a framework rewrite.
- Do not redesign all screens.
```

## Phase 1 — Typed foundation, project schema and migration

```text
PHASE 1 OBJECTIVE

Create the typed application foundation and durable project format while keeping the existing alpha usable.

Required work:
- Introduce TypeScript incrementally with strict compiler settings.
- Establish the apps/packages/crates/schemas/tests structure described in the architecture document.
- Define JSON Schema 2020-12 schemas for project manifest, engine manifest, job, diagnostic, result and lesson.
- Implement typed project creation, validation, save, open, export and import.
- Implement schema-version migrations as pure functions.
- Back up a project before an on-disk migration and preserve unknown fields where safe.
- Separate authored data from generated runs/build artifacts.
- Implement command history infrastructure for undo/redo.
- Add structured application errors and stable diagnostic codes.
- Keep a limited web-preview entry point.

Required tests:
- schema valid/invalid fixtures;
- round-trip serialization;
- migrations from every fixture version;
- corrupt, oversized and malicious project inputs;
- path traversal and unsafe archive cases;
- undo/redo invariants;
- end-to-end create, save, reopen and export/import.

Acceptance criteria:
- A project created in the UI validates against the published schema.
- Saving and reopening causes no semantic changes.
- Failed migration leaves the original intact.
- Generated data can be cleaned without deleting authored files.
- Type checking and all previous tests pass.

Non-goals:
- No external simulation engine.
- No hardware access.
- No broad UI redesign beyond what the typed migration requires.
```

## Phase 2 — Desktop shell and secure native services

```text
PHASE 2 OBJECTIVE

Package the application in Tauri 2 and create a secure native foundation without yet executing engineering engines.

Required work:
- Add the Tauri desktop shell while preserving the browser preview.
- Implement Rust services for approved project filesystem access, job lifecycle, artifact storage and application events.
- Define least-privilege Tauri capabilities.
- Implement a process-runner abstraction with fixed executable and argument arrays, timeouts, output limits, cancellation and owned process-tree termination.
- Use a fake executable for process-runner contract tests.
- Implement engine discovery interfaces as read-only probes.
- Add platform abstractions for Windows and Linux.
- Create a toolchain-manager UI showing detected, missing, incompatible and disabled states.
- Do not download or install missing tools.

Required security tests:
- command injection attempts;
- invalid executable IDs;
- path traversal and symlink escape;
- excessive stdout/stderr;
- timeout and cancellation;
- child process cleanup;
- arguments and paths containing spaces and Unicode.

Acceptance criteria:
- Desktop and browser-preview builds both work.
- The browser preview clearly disables native-only operations.
- Only allow-listed fake commands can execute in tests.
- Cancelling a test job terminates its entire owned process tree.
- Tool detection does not mutate the system.

Non-goals:
- Do not run ngspice or any real engineering engine.
- Do not request serial, USB or packet-capture permissions.
```

## Phase 3 — Schematic editor and electrical model

```text
PHASE 3 OBJECTIVE

Build a production-quality schematic authoring foundation independent of any simulation engine.

Required work:
- Implement an infinite pan/zoom canvas with stable world coordinates.
- Support selection, multi-selection, drag, rotate, copy/paste, delete, box selection and keyboard commands.
- Implement pins, wires, orthogonal segments, junctions, net labels and ground.
- Add R, C, L, independent voltage/current source, diode and switch components.
- Create a versioned component definition format with units, pins and simulation metadata.
- Implement safe SI-value parsing and formatting.
- Implement reference designator annotation.
- Add undo/redo for every edit.
- Implement electrical-rule checks: missing ground, floating node, duplicate reference, invalid value, unconnected required pin and conflicting ideal sources.
- Generate a deterministic intermediate netlist independent of SPICE syntax.

Required tests:
- graph connectivity and junction rules;
- wire split/merge behavior;
- undo/redo property tests;
- stable serialization and deterministic netlists;
- SI parsing edge cases;
- ERC fixtures;
- keyboard-only end-to-end schematic creation.

Acceptance criteria:
- A voltage divider can be drawn entirely in the UI and becomes the expected graph/netlist.
- Moving components preserves electrical connectivity.
- Undo/redo restores both geometry and connectivity.
- Invalid circuits show source-linked diagnostics.
- The editor remains responsive for the declared reference-size schematic.

Non-goals:
- No ngspice execution yet.
- No PCB routing.
- No claim of full KiCad format compatibility.
```

## Phase 4 — ngspice simulation and virtual instruments

```text
PHASE 4 OBJECTIVE

Deliver the first complete engineering workflow: schematic to real ngspice result to measurement.

Required work:
- Implement ngspice detection, version parsing and deterministic self-test.
- Build the ngspice adapter using the engine SDK and safe process runner.
- Translate the canonical circuit graph into deterministic SPICE netlists.
- Support operating point, DC sweep, AC analysis and transient analysis.
- Parse engine results into common scalar, table, waveform and spectrum schemas.
- Parse warnings/errors into source-linked diagnostics where possible.
- Add a job configuration panel with units and validated ranges.
- Build a performant waveform viewer with trace visibility, zoom, pan, cursors, delta measurements and CSV export.
- Add virtual multimeter and oscilloscope views backed by real results.
- Add cancellation, timeout and nonconvergence experiences.
- Retain the built-in educational DC solver as an explicitly limited fallback, not as ngspice.

Required tests:
- analytic voltage divider and RC fixtures;
- golden netlists;
- fake-engine contract suite;
- installed-ngspice integration tests when available;
- malformed and partial output;
- nonconvergence, timeout and cancellation;
- waveform rendering and measurement calculations.

Acceptance criteria:
- A user opens the voltage-divider example, runs ngspice and measures the correct output without a terminal.
- Missing ngspice produces installation guidance, never fake results.
- Results record the exact engine version and inputs.
- Repeated identical runs match within declared tolerance.
- Cancellation leaves no child process running.

Non-goals:
- No shared-library integration until CLI behavior is stable.
- No unsupported semiconductor-model promises.
```

## Phase 5 — Embedded firmware and physical-device boundary

```text
PHASE 5 OBJECTIVE

Deliver a safe Arduino-first firmware workflow and establish the reusable hardware permission model.

Required work:
- Integrate Monaco with C/C++ syntax, diagnostics panel and project tree.
- Implement Arduino CLI detection, version/self-test and capability reporting.
- Support board/core/library inventory without silent installation.
- Support compile with structured source diagnostics and memory usage.
- Add explicit board and port selection.
- Add upload as a distinct user-initiated operation with clear target identity.
- Add a serial terminal with baud rate, encoding, line endings, timestamps, pause and export.
- Design the device bridge so serial, USB, debug and capture permissions are separate.
- Add a Blink example and a fake-board adapter for automated tests.
- Prepare but do not yet implement PlatformIO and Renode adapters.

Required tests:
- Arduino CLI fake-engine contract;
- compile success and failure parsing;
- no-board/no-port/wrong-board states;
- serial reconnect and bounded-buffer behavior;
- upload cancellation where the underlying tool safely permits it;
- hardware actions never run from imported-project automation.

Acceptance criteria:
- An installed Arduino CLI can compile the Blink example.
- Source errors link to the correct file and line.
- The user must explicitly choose a physical target before upload.
- The browser preview cannot access devices.
- Missing cores/libraries produce actionable guidance without automatic mutation.

Non-goals:
- Do not claim MCU simulation.
- Do not add unrestricted shell access for board packages.
```

## Phase 6 — HDL simulation and FPGA pipeline

```text
PHASE 6 OBJECTIVE

Implement truthful, separated HDL simulation, synthesis and FPGA implementation workflows.

Required work:
- Add HDL project documents, source sets, top unit, constraints and target definitions.
- Integrate Verilator for SystemVerilog lint and compiled simulation.
- Integrate GHDL for VHDL analyze, elaborate and simulate.
- Optionally integrate Icarus Verilog as a compatibility backend.
- Import VCD/FST/GHW where practical into a native digital waveform viewer.
- Implement Yosys synthesis with hierarchy, utilization and diagnostic reports.
- Implement nextpnr only for explicitly supported device families and complete target manifests.
- Keep simulation, synthesis, place/route, timing and bitstream as separate jobs and statuses.
- Add small counter/UART examples with testbenches.

Required tests:
- adapter contract tests for every engine;
- HDL diagnostic parsing fixtures;
- digital waveform parsing;
- known simulation and synthesis examples;
- missing constraints and unsupported target handling;
- cancellation and timeout;
- reproducibility records.

Acceptance criteria:
- Verilog/SystemVerilog and VHDL examples simulate and display waveforms when their engines are installed.
- Yosys reports utilization independently of simulation.
- The UI never calls a design “hardware ready” merely because simulation passed.
- Unsupported targets are blocked with explicit explanations.

Non-goals:
- Do not promise every SystemVerilog feature or FPGA family.
- Do not redistribute vendor toolchains without separate review.
```

## Phase 7 — KiCad interoperability and fabrication outputs

```text
PHASE 7 OBJECTIVE

Create a reliable PCB interoperability and fabrication workflow around KiCad without pretending to replace its mature PCB editor.

Required work:
- Detect supported KiCad CLI versions and capabilities.
- Define the OpenENTC-to-KiCad exchange boundary and preserve source ownership.
- Support opening/exporting supported schematic data with explicit fidelity diagnostics.
- Register KiCad PCB documents as first-class project assets.
- Run supported schematic/PCB checks through KiCad CLI and parse reports.
- Export BOM, Gerber, drill and position artifacts where supported.
- Provide artifact previews, hashes and a fabrication checklist.
- Support launch-in-KiCad as interoperability, not native integration.
- Record library provenance for symbols, footprints and models.

Required tests:
- KiCad version and capability fixtures;
- paths with spaces/Unicode;
- known-good and known-bad board projects;
- deterministic artifact manifest;
- missing footprint/library diagnostics;
- unsupported-version handling.

Acceptance criteria:
- A supported sample board can produce a verified fabrication artifact set.
- Every output records the KiCad version and command arguments.
- Round-trip limitations are visible before export.
- The application never claims native autorouting or full-format fidelity.

Non-goals:
- Do not build a production PCB router.
- Do not copy KiCad libraries without preserving their licence terms.
```

## Phase 8 — DSP, control and numerical worker

```text
PHASE 8 OBJECTIVE

Implement an isolated numerical-computing layer and real DSP/control experiments.

Required work:
- Define a versioned protocol between the Rust core and isolated Python worker.
- Pin and inventory NumPy, SciPy, python-control and plotting dependencies.
- Define typed arrays with data type, shape, sample rate, units and provenance.
- Implement signal generation, noise, convolution, correlation, FFT, FIR/IIR filtering, resampling and windowing.
- Implement transfer-function/state-space models, time/frequency responses, poles/zeros and stability diagnostics.
- Build notebook-like experiment panels without executing arbitrary imported Python.
- Add spectrum, waterfall, Bode, pole-zero and step-response views.
- Enforce array, runtime and memory limits.
- Add deterministic examples with analytic/reference results.

Required tests:
- numerical fixtures with absolute and relative tolerances;
- worker protocol and crash recovery;
- oversized/malformed array rejection;
- cancellation and timeout;
- unit and sample-rate validation;
- deterministic seeded-noise experiments.

Acceptance criteria:
- Users can construct and run a filter experiment without writing Python.
- Results carry units, sample rate and dependency versions.
- Worker failure does not crash or corrupt the desktop project.
- Imported projects cannot execute arbitrary Python automatically.

Non-goals:
- Do not implement a general unrestricted notebook kernel.
- Do not claim MATLAB/Simulink compatibility.
```

## Phase 9 — Communications and SDR

```text
PHASE 9 OBJECTIVE

Build communication-system experiments and a safe GNU Radio integration.

Required work:
- Implement a typed flowgraph with port types, rates, units and parameter validation.
- Add sources, sinks, filters, resamplers, noise/channel models and measurement blocks.
- Add AM/FM, ASK/FSK/PSK/QPSK/QAM, sampling, line coding, PCM and BER learning experiments.
- Implement supported flowgraph execution in the Python worker for deterministic offline experiments.
- Add a GNU Radio adapter and translate only explicitly supported blocks.
- Import/export supported flowgraph representations with fidelity diagnostics.
- Add constellation, eye, spectrum, waterfall and BER views.
- Design SoapySDR hardware access as a later, separately permissioned capability.

Required tests:
- modulation/demodulation reference vectors;
- BER against known or bounded theoretical behavior;
- graph type/rate/cycle validation;
- GNU Radio fake and installed-engine contracts;
- unsupported block/parameter handling;
- streaming cancellation and bounded buffers.

Acceptance criteria:
- A QPSK-over-noisy-channel example runs locally and produces constellation and BER results.
- Supported GNU Radio flowgraphs run when detected.
- Unsupported translation is blocked before execution with precise diagnostics.
- No SDR hardware is accessed without explicit selection and permission.

Non-goals:
- Do not promise universal GNU Radio flowgraph compatibility.
- Do not silently install SDR drivers.
```

## Phase 10 — RF, microwave and electromagnetics

```text
PHASE 10 OBJECTIVE

Deliver practical RF network tools first, followed by controlled optional full-wave simulation.

Required work:
- Integrate scikit-rf into the numerical worker.
- Support Touchstone import/export with port, frequency and impedance validation.
- Implement S, Z, Y and ABCD conversions, cascade/de-embedding where valid and matching calculations.
- Add Smith chart, magnitude/phase, group delay and stability views.
- Add transmission-line and matching-network educational experiments.
- Add optional QucsatorRF adapter for supported RF circuit jobs.
- Add openEMS only as an advanced queued adapter with mesh estimate, memory/disk warning, timeout, cancellation and result manifest.
- Never load unbounded field dumps into the UI; use summaries, slices and on-demand data.

Required tests:
- Touchstone fixtures and parameter conversions;
- known matching-network results;
- malformed/inconsistent port data;
- QucsatorRF adapter contract;
- openEMS fake job for estimates, cancellation and disk limit;
- large-result visualization budgets.

Acceptance criteria:
- Users can import an `.s2p` file, inspect it on a Smith chart and export derived data.
- Units, reference impedance and port ordering remain explicit.
- openEMS cannot start until its resource estimate and output location are visible.
- Full-wave failure or cancellation leaves a readable partial-job report.

Non-goals:
- Do not claim equivalence to proprietary HFSS/CST workflows.
- Do not make openEMS part of the beginner default install.
```

## Phase 11 — Networks, IoT and instrumentation

```text
PHASE 11 OBJECTIVE

Implement reproducible network simulation, offline packet analysis and carefully permissioned instrumentation.

Required work:
- Define a typed network/IoT topology document.
- Integrate ns-3 for supported educational experiment templates.
- Import generated traces and metrics into common result types.
- Integrate TShark for saved PCAP/PCAPNG decoding and display filters.
- Add packet table, protocol tree, byte view, flow summary and export.
- Add IoT message-flow experiments using simulated MQTT-like data before real brokers.
- Add sigrok as an optional instrumentation adapter.
- Keep live capture, external brokers, serial, USB and device programming as distinct permission scopes.
- Add retention and size controls for captures.

Required tests:
- topology validation;
- deterministic ns-3 seeded scenarios;
- PCAP parsing and malicious-capture fixtures;
- TShark adapter contract;
- bounded tables and capture storage;
- permission and cancellation behavior.

Acceptance criteria:
- A sample network topology produces reproducible metrics and a trace.
- A saved PCAP opens without privileged capture permissions.
- Live capture is disabled until an explicit interface is selected and permission granted.
- Large captures do not freeze or exhaust the UI.

Non-goals:
- Do not implement covert capture or background monitoring.
- Do not treat simulated IoT messaging as a real deployed broker connection.
```

## Phase 12 — Learning system, plugin SDK and community safety

```text
PHASE 12 OBJECTIVE

Turn verified engineering workflows into an extensible learning and community platform.

Required work:
- Define a lesson schema with prerequisites, project template, instructions, checkpoints, hints and expected-result tolerances.
- Build lessons using actual jobs and result assertions, not separate mock simulations.
- Add offline examples for every stable vertical slice.
- Add progress storage that is separate from project semantics.
- Define a versioned plugin SDK for documents, commands, result viewers, engine adapters and lessons.
- Create permissions and trust levels for plugins.
- Require manifests, compatible API versions, exact licences and source provenance.
- Add a signed-catalog design, but do not launch a public marketplace without review infrastructure.
- Add contribution templates and automated plugin contract tests.

Required tests:
- lesson checkpoint correctness and tolerance boundaries;
- offline lesson operation;
- plugin API compatibility;
- permission denial;
- malicious/invalid manifest rejection;
- plugin failure isolation.

Acceptance criteria:
- At least one complete learning track uses real circuit, embedded and DSP workflows.
- A plugin cannot receive undeclared filesystem, process, network or device access.
- Incompatible plugins fail safely with actionable diagnostics.
- Learning results are reproducible from the included project template.

Non-goals:
- Do not enable arbitrary unsigned plugin installation by default.
- Do not add cloud accounts or telemetry as a requirement.
```

## Phase 13 — Hardening, accessibility and production release

```text
PHASE 13 OBJECTIVE

Prepare the verified feature set for a responsible public release. Freeze feature expansion during this phase.

Required work:
- Close all critical/high correctness, security, data-loss and accessibility issues.
- Complete keyboard and screen-reader testing for primary workflows.
- Meet WCAG 2.2 AA for primary flows and document remaining exceptions.
- Profile startup, project opening, waveform rendering, large logs and captures against explicit budgets.
- Complete Windows and Linux packaging, upgrade and uninstall behavior.
- Add crash-safe project writes and recovery UI.
- Produce exact third-party notices, licence texts, source offers where required and an SPDX SBOM.
- Pin reproducible release toolchains and generate checksums.
- Add signed releases where infrastructure permits.
- Run clean-machine installation and sample-project verification.
- Write user, educator, contributor, adapter-author and troubleshooting documentation.

Required release gates:
- formatting, lint, type checking and all unit/contract/security tests pass;
- supported-engine integration matrix is recorded;
- end-to-end primary workflows pass on Windows and Linux;
- no known critical/high vulnerability or data-loss defect;
- project backward compatibility and recovery are verified;
- capabilities and limitations match real evidence;
- licence review and SBOM are complete;
- release notes identify breaking changes and migration behavior.

Acceptance criteria:
- A clean machine can install OpenENTC, open included examples and complete every advertised built-in workflow.
- Missing optional engines degrade gracefully.
- Failed jobs and application restart do not corrupt authored project data.
- The release can be reproduced from documented source and toolchain versions.

Non-goals:
- No new engineering domain or major feature.
- No “temporary” bypass of tests, permissions or licence checks to meet a date.
```

## Final coordination prompt

Use this after each phase:

```text
Audit the phase just completed against every acceptance criterion. Cite concrete files, tests and execution evidence. Classify each criterion as PASS, PARTIAL, FAIL or NOT VERIFIED. Do not change a status to PASS based on appearance or intended design.

If any critical criterion is FAIL or NOT VERIFIED, remain in the current phase and implement the smallest safe correction. If all critical criteria pass, produce a concise handoff for the next phase containing:
- stable APIs and schemas;
- new commands and test fixtures;
- capability-ledger changes;
- migrations or compatibility obligations;
- security and licence decisions;
- known noncritical limitations;
- exact verification commands.
```
