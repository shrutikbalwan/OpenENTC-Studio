# Release checklist

This checklist is a gate. Unchecked critical items block a release rather than becoming silent follow-up work.

## Source and reproducibility

- [ ] Release commit is identified and the working tree is clean.
- [ ] Toolchain and dependency versions are pinned and documented.
- [ ] A clean checkout builds using documented commands.
- [x] Release artifacts have checksums and an SPDX SBOM for the browser preview, with desktop development-artifact hashes recorded.
- [ ] Third-party notices, exact licence texts, and source offers are complete.

## Verification

- [x] `npm run verify` passes.
- [x] Desktop and browser-preview production builds pass.
- [ ] Unit, contract, security, migration, numerical, accessibility, performance, and end-to-end suites pass as applicable.
- [ ] Supported optional-engine matrix records OS, engine version, operation, and evidence.
- [ ] Windows and Linux clean-machine sample workflows pass.

## Safety and data integrity

- [ ] Project upgrade, crash-safe writes, backup, recovery, and backward compatibility are verified.
- [ ] Imported projects cannot auto-run scripts, processes, uploads, devices, or captures.
- [x] Process timeout/cancellation terminates the owned tree and preserves a readable job record.
- [ ] No known critical/high security, correctness, accessibility, or data-loss issue remains.
- [ ] Upgrade and uninstall behavior preserves user-authored projects.

## Product truthfulness

- [ ] The capability ledger matches executable evidence and all primary controls.
- [x] Missing optional engines show guidance and never fake results.
- [ ] Documentation and release notes state limitations, breaking changes, and migrations.
- [ ] Primary flows meet the declared accessibility and performance budgets.
- [x] Installation packages and signatures are verified, or development builds are labeled clearly.
- [x] Hardware-free release policy is published; software/emulator evidence is never presented as hardware certification.

## Approval record

- Release version/commit:
- Verification evidence location:
- Licence reviewer:
- Security reviewer:
- Release approver:
- Known noncritical exceptions and owners:

## Current alpha evidence (2026-09-29)

The dependency-free browser-preview build emits `dist/BUILD-METADATA.json`, `dist/BUILD-MANIFEST.json`, `dist/SHA256SUMS.txt`, `dist/BUILD-SBOM.spdx.json`, `dist/LICENSE`, and `dist/THIRD-PARTY-NOTICES.txt` through `npm run build`; `npm run native:sbom` additionally emits the deterministic 437-package native Cargo inventory `dist/NATIVE-BUILD-SBOM.spdx.json` (SHA-256 `FABA8F307359AC465F40AD8F4ECA2717800239E85644C95F3F78F1862BCC1AEF`) and the generated native notice candidate. `npm run release:prepare` performs both generation steps plus the automated licence audit, and the browser build preserves the native evidence. `npm run verify` re-hashes and tests the browser outputs. Strict TypeScript, Rust/Cargo tests, the Windows release executable, and an unsigned NSIS development installer have recorded local evidence. A Chrome keyboard/accessibility smoke is recorded in `docs/release-evidence/browser-accessibility-smoke-2026-09-29.md`, but it is not WCAG certification. See `docs/release-evidence/windows-development-build-2026-09-29.md`. Clean-machine installation, Linux, full accessibility/performance budgets, desktop-shell external-engine runs, complete licence review and signing remain unchecked release blockers.

## Current software-gate update (2026-09-29)

The following additional software evidence is complete: real ngspice batch simulation and adapter version parsing; GHDL analyze/elaborate/simulation; Verilator lint; Yosys JSON synthesis; nextpnr-ice40 HX8K/CT256 constraint-free dry-run; Arduino CLI version probe; rebuilt Windows Tauri executable and unsigned NSIS installer; isolated local installer install/reinstall/launch/uninstall smoke; clean Windows-style checkout verification; isolated Ubuntu WSL `npm ci` plus verification and an unbundled Linux Tauri release build; browser accessibility smoke; and headless Chrome browser-load smoke. These results are recorded in `docs/release-evidence/` and remain distinct from physical, clean-machine installer, hosted-CI, full performance/WCAG, signing and approval evidence.

The complete requirement-by-requirement handoff is [phase-gate-matrix-2026-09-29.md](release-evidence/phase-gate-matrix-2026-09-29.md). `npm run phase:status` checks its evidence links and reports remaining Partial/Open gates; `npm run signing:check` reports whether an approved signing tool and certificate reference are configured without signing anything; `npm run release:verify` checks the recorded browser, native, Windows and locally produced Linux development-artifact hashes together.
