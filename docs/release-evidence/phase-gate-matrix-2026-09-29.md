# Phase-gate matrix — 2026-09-29

This matrix is the authoritative handoff summary for the current development release. `Pass` means the named software evidence exists; `Open` means the gate requires external state or broader qualification.

The detailed command-to-owner handoff is recorded in [release-readiness-handoff-2026-09-29.md](release-readiness-handoff-2026-09-29.md).

| Gate | Status | Evidence / required follow-up |
| --- | --- | --- |
| Browser implementation and persistence | Pass | `npm run verify`; project-model, storage and workspace tests |
| Native Rust boundary | Pass | `cargo test --lib`: 39 passed, 4 helper tests ignored; [native ngspice process-boundary evidence](native-ngspice-boundary-2026-09-29.md) |
| Windows executable and unsigned installer | Pass | [Windows build evidence](windows-development-build-2026-09-29.md); [release-bundle verification](release-bundle-verification-2026-09-29.md) |
| Isolated install/reinstall/launch/uninstall | Pass (local) | Same evidence document; clean-machine coverage remains open |
| Clean checkout reproducibility | Pass (local) | [Clean checkout verification](clean-checkout-verify-2026-09-29.md) |
| ngspice build and adapter analyses | Pass (software) | [ngspice evidence](ngspice-build-2026-09-29.md); [desktop startup probe](desktop-shell-startup-probe-2026-09-29.md) records a WebView2 session blocker, so physical behavior and normal-user desktop UI remain open |
| GHDL / Verilator / Yosys / nextpnr software flow | Pass (software) | [HDL smoke evidence](hdl-tool-smoke-2026-09-29.md) |
| Arduino CLI executable smoke | Pass (software) | [Native-tool evidence](native-tool-smoke-2026-09-29.md); board/upload/serial behavior remains open |
| Browser accessibility smoke | Pass (smoke) | [Accessibility evidence](browser-accessibility-smoke-2026-09-29.md); WCAG qualification remains open |
| Performance qualification | Partial | Pure-model budget and [headless browser-load smoke](browser-performance-smoke-2026-09-29.md) pass; frame latency, interaction latency, memory, low-spec and cross-platform qualification remain open |
| Hosted GitHub Actions | Open | Workflow now covers Windows/Linux source verification plus a Linux Tauri build and artifact upload; [readiness evidence](hosted-ci-readiness-2026-09-29.md) is recorded, but hosted run evidence is still missing |
| Linux source verification / desktop build / installer | Partial | [Linux source verification](linux-source-verify-2026-09-29.md), unbundled [Linux Tauri build](linux-tauri-build-2026-09-29.md), local [Linux package build](linux-packaging-build-2026-09-29.md) and WSL package install/launch/remove pass; hosted output plus clean-machine installation, upgrade and uninstall still require a desktop Linux host/VM |
| Physical Arduino / FPGA / programmer | Open | No matching Arduino/FPGA/programmer device was present in the Windows device inventory during the latest audit; closing this gate still requires named hardware, revision, programmer and procedure |
| Complete licence/SBOM review | Partial | Browser SBOM and generated 437-package native SPDX inventory exist; licence-text, security and approval review remain open |
| Code signing and release approval | Open | `npm run signing:check` provides a non-destructive preflight; certificate, signing execution and approver evidence are still missing |

The release must remain labelled as a development/alpha artifact until the open gates are satisfied or formally waived by the release approver.
