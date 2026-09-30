# OpenENTC Studio project status

Status date: 2026-09-29

## Verified complete

- Browser application workflows and bounded project persistence.
- Circuit, DSP, communications, RF, network, learning and digital waveform slices implemented within their declared capability boundaries.
- Digital VCD hierarchy parsing, scalar/vector rendering, scope filtering, zoom/pan, dual cursors and bounded CSV export.
- Project-scoped native process, job, artifact, event and permission boundaries.
- Windows Tauri executable and unsigned NSIS development installer.
- Full repository verification: 378 tests, 370 passed, 0 failed and 8 optional-runtime skips.
- Native Rust library tests: 39 passed, 0 failed and 4 helper tests ignored.
- Locally verified tool binaries: GHDL 6.0.0, Arduino CLI 1.5.1, Verilator 5.053, Yosys 0.69 and nextpnr-ice40 0.11.1.
- Latest verification rerun: 378 tests, 370 passed, 0 failed and 8 optional-runtime skips; strict type, lint, worker and browser-build checks passed.
- Rebuilt the Windows desktop executable and unsigned NSIS installer directly with the installed Rustup toolchain; `cargo test --lib` passed 39 tests. Current hashes and limitations are recorded in [windows-development-build-2026-09-29.md](release-evidence/windows-development-build-2026-09-29.md).
- Rebuilt the current Windows executable with the official Tauri command and refreshed its recorded SHA-256. A follow-up noninteractive launch returned exit code 101 without a targetable window; this is recorded as environment-context evidence, not a normal-user shell pass, so interactive desktop-shell engine execution remains open.
- Rebuilt the unsigned NSIS installer after the WebView2 data-directory and bundle-icon configuration changes; the current Windows and Linux package hashes are recorded in [release-manifest-2026-09-29.md](release-evidence/release-manifest-2026-09-29.md), and `npm run release:verify` passes all four desktop artifacts.
- Captured the underlying desktop startup error: WebView2 setup returns `0x800700AA` (resource in use); an isolated profile returns `0x8000FFFF` (catastrophic failure). The installed WebView2 runtime is present, but this automation session is not a supported interactive desktop context. Details are in [desktop-shell-startup-probe-2026-09-29.md](release-evidence/desktop-shell-startup-probe-2026-09-29.md).
- Completed an isolated local NSIS install/launch/uninstall smoke in a dedicated workspace directory; clean-machine, upgrade and cross-platform installer behavior remain unverified.
- Completed a same-version reinstall smoke that preserved an unrelated user marker through reinstall and uninstallation; this is local evidence, not clean-machine upgrade certification.
- Completed an isolated checkout-style `npm ci` plus `npm run verify` run from source without existing dependencies or generated outputs; evidence is recorded in [clean-checkout-verify-2026-09-29.md](release-evidence/clean-checkout-verify-2026-09-29.md).
- Consolidated all current gates and external blockers in [phase-gate-matrix-2026-09-29.md](release-evidence/phase-gate-matrix-2026-09-29.md).
- Added `npm run native:smoke`, an explicit-environment, bounded version probe for ngspice, Arduino CLI, Verilator, GHDL, Yosys and nextpnr-ice40. Elevated local execution passes all six configured tools; evidence is recorded in [native-tool-smoke-2026-09-29.md](release-evidence/native-tool-smoke-2026-09-29.md). The console ngspice build also passes the deterministic 4.5 V divider batch smoke.
- Adopted the hardware-free release policy: software and emulator gates may pass without boards, while physical results remain explicitly `hardware-unverified` until a named hardware test report exists.
- Added `npm run hdl:smoke`: real GHDL analyze/elaborate/simulation produced a VCD, Verilator lint passed, Yosys produced a JSON netlist, and nextpnr completed a constraint-free iCE40 HX8K/CT256 dry-run. The application’s board workflow still requires board-specific PCF constraints.
- Recorded the HDL smoke results in [hdl-tool-smoke-2026-09-29.md](release-evidence/hdl-tool-smoke-2026-09-29.md) with explicit software-verified versus hardware-unverified wording.
- Recorded a Chrome accessibility smoke in [browser-accessibility-smoke-2026-09-29.md](release-evidence/browser-accessibility-smoke-2026-09-29.md): named controls, keyboard traversal, labelled command-palette dialog and focus restoration passed. WCAG conformance and cross-platform performance remain unclaimed.
- Added GitHub Actions verification for clean Windows and Linux software environments; hosted-run evidence will be recorded when CI executes the workflow.
- Extended the GitHub Actions workflow with a Linux Tauri native-build job, required GTK/WebKit dependencies, Rust setup and an uploaded unbundled executable artifact. [Hosted-CI readiness evidence](release-evidence/hosted-ci-readiness-2026-09-29.md) records the local workflow checks; no hosted run is claimed until GitHub records a successful job.
- Added the explicit Linux packaging command `npm --prefix apps/desktop run build:linux-bundles` for `deb` and `AppImage` outputs, and changed the hosted Linux job to upload those packages. Package generation and clean-machine lifecycle evidence still require a hosted/desktop Linux run.
- Checked and provisioned the available Ubuntu WSL environment. An isolated Linux checkout now passes `npm ci` plus `npm run verify` (378 tests, 370 passed, 0 failed, 8 skips); evidence is recorded in [linux-source-verify-2026-09-29.md](release-evidence/linux-source-verify-2026-09-29.md). Linux Tauri packaging and clean-machine installer behavior remain open; the earlier toolchain limitation is retained in [linux-environment-check-2026-09-29.md](release-evidence/linux-environment-check-2026-09-29.md).
- Completed an isolated Ubuntu WSL unbundled Linux Tauri release build with Rust 1.93.1 and Tauri CLI 2.12.0; the optimized `openentc-studio` executable was produced after applying the documented `RUSTFLAGS='-A dead_code'` compiler-workaround for a Rust dead-code-analysis ICE. Evidence is recorded in [linux-tauri-build-2026-09-29.md](release-evidence/linux-tauri-build-2026-09-29.md). Linux package generation and clean-machine install/upgrade/uninstall remain open.
- Completed the Ubuntu WSL Linux package build after restoring the distro and installing the Linux Tauri CLI binding: both `.deb` and `.AppImage` packages were produced with explicit square icons. Hashes and limitations are recorded in [linux-packaging-build-2026-09-29.md](release-evidence/linux-packaging-build-2026-09-29.md); clean-machine lifecycle, hosted CI and release approval remain open.
- Exercised the real ngspice executable through the native Rust process runner; the bounded project-scoped divider run passed. Evidence is recorded in [native-ngspice-boundary-2026-09-29.md](release-evidence/native-ngspice-boundary-2026-09-29.md). This does not close the interactive Tauri shell/UI gate.
- Generated a 437-package SPDX 2.3 native Cargo dependency inventory and 697-section third-party notice candidate with `npm run native:sbom`; these artifacts are evidence, while licence-text, security and release-approval review remain open.
- Added `npm run browser:smoke`: headless Chrome loaded the built preview and validated the DOM in 2,825.11 ms wall-clock time. This is browser-load evidence only; frame, interaction, memory, low-spec and WCAG qualification remain open.
- Re-ran the headless Chrome browser-load smoke after release-preparation changes: it passed in 2,703.21 ms with the expected DOM. The evidence remains a load smoke, not full frame, interaction, memory, low-spec or WCAG qualification.
- Extended the Chrome smoke with executable DOM accessibility assertions for the Engineering modules navigation, Command palette and Project name controls; the latest run passed. Chrome host timing remains variable and is not a full performance or WCAG qualification.
- Refreshed the Chrome smoke on port 4191: it passed in 2,924.11 ms with 13,425 DOM bytes and all three accessibility assertions true; this remains load/smoke evidence only.
- Added `npm run release:prepare` and preserved native SBOM/notice candidates across browser rebuilds; `npm run release:verify` now passes after a complete preparation cycle without requiring Cargo during offline hash verification.
- Added `npm run release:verify`; it passes all 36 browser-file hashes, both native release artifacts, the Windows executable/NSIS installer and the locally produced Linux `.deb`/AppImage hashes. It also corrected stale desktop checksums in the release manifest.
- Added a schema-backed hardware-free verification ledger at [capabilities/verification.json](../capabilities/verification.json), with independent software, emulator and hardware statuses checked by the full test suite.

## Not release-complete

- The ngspice source build completed and installed under the user-local program directory. The console-capable rebuild, adapter version integration test and deterministic divider batch result are software-verified; broad model coverage and desktop-shell invocation remain separate qualification items.
- The rebuilt desktop shell has a local elevated launch smoke, but end-to-end native engine runs still need to be executed and recorded from the desktop shell under a normal supported-user environment.
- FPGA bitstream generation/programming and physical iCE40 HX8K/CT256 validation require hardware, programmer access and board-specific PCF constraints.
- Arduino hardware upload and serial validation require a connected board.
- Clean Windows/Linux installer, upgrade and uninstall testing remains outstanding; the new CI workflow covers source verification, not installer UX or hardware.
- Code signing, accessibility/performance qualification, SBOM/licence review and release approval remain outstanding.

The project is software-complete for the implemented scope, but it must not be represented as a fully hardware-validated or production-signed release until the external gates above have evidence.
