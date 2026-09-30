# OpenENTC Studio build execution plan

Updated: 2026-09-28

This plan turns the product roadmap into ordered, testable delivery milestones. A milestone is complete only when its implementation, automated tests, user-visible behavior, security boundary, and build evidence all pass. Later milestones may contain experimental slices, but they are not release-ready until all earlier gates pass.

Current status (2026-09-29): Milestone 1 is complete. Milestone 2 is complete for the Windows development-build gate, including native tests, a real ngspice process-boundary run and an unsigned installer; Linux, clean-machine installation and signing remain open. Milestone 3 is active: bounded multi-bend orthogonal wire routing, draggable junction/net-label markers and pin-level ERC source highlighting are implemented and covered by the full verification gate; final rendered accessibility/performance qualification remains. Milestone 4 includes configurable operating-point/DC/AC/transient jobs, a version self-test, retained evidence, magnitude/phase table rendering, trace selection, zoom/pan, cursor deltas, CSV export and structured source-linked engine failures; real console and native-boundary ngspice divider runs are software-verified, while interactive desktop-shell engine invocation and broader model coverage remain open.

## Delivery rules

- Keep `npm run verify` green after every slice.
- Preserve the browser preview while the desktop application is built.
- Never claim an external engine is available without detection and execution evidence.
- Keep authored project data separate from generated runs and build artifacts.
- Use fixed executable identities and argument arrays; never execute project content through a shell.
- Treat hardware, packet capture, uploads, plugins, and external processes as explicit permission boundaries.
- Update `docs/implementation-status.md` and `capabilities/ledger.json` only when evidence changes.

## Milestone 1 — Complete the typed project foundation

Target outcome: Phase 1 is complete and strict type checking is a mandatory part of verification.

Work:

1. Pin TypeScript as a development tool and invoke the repository-local compiler.
2. Resolve every strict compiler error in the existing TypeScript and declaration surface.
3. Type the project create, validate, migrate, save, open, import, and export boundaries end to end.
4. Keep runtime validation and published JSON Schemas aligned with the typed model.
5. Add packaged `.entcproj` import/export only through a bounded archive implementation that rejects traversal, links, duplicates, case collisions, and decompression bombs.
6. Add UI-to-project-model round-trip fixtures and ensure unknown safe fields survive.
7. Verify clean generated-data removal never removes authored content.

Gate:

- `npm run typecheck` runs a pinned compiler and passes; a missing compiler is a failure.
- `npm run verify` passes from a clean dependency install.
- UI-created projects validate and reopen without semantic drift.
- Invalid, oversized, malicious, and interrupted-write fixtures pass.

## Milestone 2 — Verify the secure desktop foundation

Target outcome: Phase 2 is complete on Windows first, followed by Linux verification.

Work:

1. Pin Rust and Tauri prerequisites and compile the existing desktop shell.
2. Add a reviewed native folder picker and remove the temporary absolute-path prompt.
3. Exercise native project open/read/save/close and recovery with real filesystem tests.
4. Compile and test native jobs, artifacts, events, discovery, authorization, and process ownership.
5. Verify timeout and cancellation terminate the complete owned process tree.
6. Build an unbundled desktop application, then development installers.
7. Add clean-machine Windows and Linux smoke workflows.

Gate:

- Browser and Tauri production builds pass.
- Cargo unit/integration tests pass.
- Native persistence round trips without data loss.
- Security fixtures cover traversal, symlinks, command injection, output limits, Unicode paths, timeout, and cancellation.
- No engineering engine or device permission is enabled in this milestone.

## Milestone 3 — Finish the schematic editor

Target outcome: Phase 3 provides a dependable authored electrical model.

Work:

1. Add pin-to-pin graphical wire drawing, segment editing, junction placement, dragging, and deletion.
2. Complete selection, copy/paste, rotation, keyboard editing, pan/zoom, grid, and undo/redo behavior.
3. Expand the governed component-definition library and reference annotation.
4. Add pin-level ERC diagnostics and canvas highlighting.
5. Keep the intermediate netlist deterministic and independent of rendering geometry.

Gate:

- Representative schematics round-trip through project storage.
- Connectivity remains stable after visual moves and edits.
- ERC and annotation fixtures cover malformed and conflicting designs.
- Primary schematic flows pass keyboard and screen-reader checks.

## Milestone 4 — Native SPICE and virtual instruments

Target outcome: Phase 4 runs real ngspice jobs and displays evidence-backed results.

Work:

1. Detect and self-test an explicitly configured ngspice executable.
2. Execute DC, AC, and transient jobs through the native runner.
3. Map supported components and models to deterministic SPICE.
4. Parse results into common result contracts with provenance and units.
5. Add oscilloscope, meter, waveform, cursor, and export views.
6. Surface engine errors against schematic sources.

Gate:

- Known circuits match tolerance-checked reference results.
- Cancellation and malformed-output tests pass.
- Missing ngspice remains an honest unavailable state.

## Milestone 5 — Embedded systems

Target outcome: Phase 5 supports safe compilation, simulation, and explicitly authorized device operations.

Work:

1. Integrate Arduino CLI and PlatformIO compile flows.
2. Add board/core detection and real compiler diagnostics.
3. Run Renode simulations without granting hardware access.
4. Add serial, upload, and programmer permissions as separate reviewed scopes.
5. Add device discovery, serial monitor limits, and cancellation.

Gate:

- Compile and simulation samples pass on supported tool versions.
- Upload and serial operations require explicit grants and selected targets.
- Browser mode cannot access devices.

## Milestone 6 — HDL and FPGA

Target outcome: Phase 6 supports simulation through target-specific FPGA implementation.

Work:

1. Execute Verilator and GHDL jobs and import generated waveforms.
2. Build a scalable waveform viewer with cursors and signal grouping.
3. Execute Yosys synthesis and report utilization.
4. Execute nextpnr for explicitly supported device families.
5. Generate bitstreams and add programming only as a separate permissioned operation.

Current progress: the Digital Lab persists bounded SystemVerilog and VHDL counter examples. It conditionally exposes project-scoped Verilator lint; separate GHDL analyze, elaborate and simulate stages with registered VCD readback; independent Yosys synthesis with utilization and a registered JSON netlist; and nextpnr place/route only for the published iCE40 HX8K/CT256 target with non-empty board-specific PCF constraints. Every stage requires positive detection plus process/artifact grants, retains process/output evidence and supports owned-process cancellation. Lint, simulation, synthesis and implementation results coexist and the UI explicitly denies hardware readiness, bitstream and programming claims. The native viewer now supports bounded hierarchy grouping, signal filtering, scalar/vector rendering, zoom/pan, dual-cursor measurements and bounded CSV export. GHDL, Verilator, Yosys and nextpnr are installed locally, but project end-to-end acceptance remains open; timing closure, bitstream and programming are still pending.

Gate:

- Verilog, SystemVerilog, and VHDL sample projects produce verified results.
- Simulation, synthesis, place/route, bitstream, and programming remain distinct jobs.

## Milestone 7 — PCB and fabrication

Target outcome: Phase 7 exchanges designs with KiCad and produces verified fabrication packages.

Work:

1. Implement bounded schematic/PCB interchange with explicit loss reporting.
2. Execute KiCad ERC/DRC and source-link diagnostics.
3. Generate BOM, Gerber, drill, and position outputs.
4. Hash outputs into the fabrication manifest and verify completeness.
5. Add safe fabrication-package export.

Gate:

- Round-trip fixtures document every supported and unsupported construct.
- Generated packages pass clean-machine inspection and manifest verification.

## Milestone 8 — DSP, control, and numerical workers

Target outcome: Phase 8 supplies reproducible worker-backed analysis.

Work:

1. Connect the numerical worker client to the native process host.
2. Add NumPy/SciPy-backed filters, spectra, resampling, and signal analysis.
3. Add transfer-function, state-space, stability, and response tools through a reviewed backend.
4. Persist authored experiments while keeping generated arrays in run artifacts.

Gate:

- Numerical fixtures meet published tolerances.
- Worker timeout, cancellation, restart, memory, and payload limits pass.

## Milestone 9 — Communications and SDR

Target outcome: Phase 9 expands offline communications into optional GNU Radio and SDR execution.

Work:

1. Expand the typed flowgraph and offline block executor.
2. Translate supported graphs to GNU Radio with explicit unsupported-block errors.
3. Add bounded streaming results and capture artifacts.
4. Add SDR discovery and hardware permission scopes.

Gate:

- Reference modulation/channel chains meet vector and BER tolerances.
- Hardware is never opened without an explicit grant and selected device.

## Milestone 10 — RF and electromagnetics

Target outcome: Phase 10 provides complete two-port analysis and optional specialist-engine execution.

Work:

1. Complete Smith, magnitude/phase, group-delay, stability, and matching views.
2. Integrate scikit-rf-compatible analysis contracts.
3. Execute QucsatorRF through the native runner.
4. Introduce openEMS only after a separate resource and sandbox review.

Gate:

- Network conversions and cascades match reference datasets.
- External results retain exact engine provenance and configuration.

## Milestone 11 — Networks, IoT, and instrumentation

Target outcome: Phase 11 provides safe saved-capture analysis, simulation, and permissioned live interfaces.

Work:

1. Execute TShark against explicitly selected saved captures.
2. Add protocol trees, display filters, and bounded exports.
3. Add network simulation and MQTT/IoT experiment contracts.
4. Add live capture and instruments only through distinct elevated permissions.

Gate:

- Malformed captures, filter failures, cancellation, and size limits pass.
- Live interfaces are absent from browser mode and denied by default on desktop.

## Milestone 12 — Learning and plugin ecosystem

Target outcome: Phase 12 provides complete learning tracks and a controlled extension model.

Work:

1. Add lesson authoring, prerequisite editing, assessment feedback, and complete core tracks.
2. Keep learning progress separate from engineering project truth.
3. Add reviewed plugin installation, signatures/provenance, grants, updates, and removal.
4. Run plugins through capability-mediated APIs; do not expose unrestricted process or filesystem access.

Gate:

- Checkpoints consume real built-in or engine results.
- Untrusted plugins cannot load or acquire undeclared permissions.

## Milestone 13 — Hardening and public release

Target outcome: Phase 13 produces a supportable public release.

Work:

1. Freeze features and close correctness, data-loss, security, accessibility, and performance findings.
2. Meet WCAG 2.2 AA for primary workflows or document narrowly scoped exceptions.
3. Verify upgrades, backups, recovery, and uninstall behavior.
4. Complete SBOM, licences, source offers, release notes, checksums, and signatures.
5. Run the supported OS/engine matrix on clean machines.

Gate:

- Every item in `docs/release-checklist.md` has execution evidence.
- Installers and signatures verify on supported operating systems.
- The capability ledger exactly matches executable behavior.

## Immediate work queue

Completed on 2026-09-28:

1. Milestone 1 typed project foundation, strict compiler gate and bounded `.entcproj` packaging.
2. Windows Milestone 2 implementation: native folder picker, Unicode-path persistence, secure services, real owned process-tree tests, release executable and unsigned NSIS development installer.
3. Full repository verification: 378 tests, 370 passed, 0 failed and 8 optional-runtime skips; the native Rust suite passes 39 tests with 4 helper entry points ignored.
4. Milestone 5 Arduino workflow: conditional CLI self-test and installed-package inventory, explicit board/manual-port selection, project-confined compile evidence, cancellable target-authorized upload, bounded native serial terminal controls for baud, encoding, line endings, timestamps, pause, export and reconnect, plus a canonical Blink fixture and test-only fake Arduino CLI contract. Programmer and serial grants are separate and revocable; no connected-device scan or package install occurs. Real inventory, compilation, upload, cancellation and serial I/O remain unverified because Arduino CLI and hardware are absent on this host.

Next:

1. Run clean-machine Windows and Linux desktop smoke workflows and record installer/uninstall evidence.
2. Complete Milestone 3 rendered keyboard/screen-reader and browser-frame/input-latency qualification on an available browser surface.
3. Run the desktop-shell ngspice and Arduino CLI workflows on a supported normal-user environment. Their explicit executable/version and software reference-workflow evidence is now recorded; hardware and shell/UI qualification remain separate.
