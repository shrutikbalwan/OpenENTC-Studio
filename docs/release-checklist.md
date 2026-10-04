# Release checklist

This checklist is a gate. Unchecked critical items block a release rather than becoming silent follow-up work.

## Automated gates (CI on every push)

| Gate | How | Status |
|---|---|---|
| Format, lint, typecheck, UI module rules, unit tests (Ubuntu and Windows) | `npm run verify` | automated |
| Browser journeys, accessibility rules, onboarding, recovery, performance | `npm run test:e2e` | automated |
| Coverage thresholds (never lowered) and targeted mutants | `coverage` job | automated |
| Dependency audit, native SBOM and licence audit | `security-audit` job | automated |
| External tools: ngspice, GHDL, Verilator, Yosys, nextpnr | `external-tools` job | automated; arduino-cli and kicad-cli are reported **unavailable** |
| Windows and Linux desktop builds (unsigned), with Rust tests | desktop jobs | automated |
| Reproducible browser build | `npm run release:reproducible` | automated (Linux job) |
| Release manifest and integrity | `npm run release:prepare`, then `release-manifest.mjs verify --require <os>` | automated dry run in both desktop jobs |

## External gates (`release/gates.json`)

These need people, credentials, machines or hardware. They are **all pending** for this alpha. The
release manifest records them, and `release:verify` prints them on every run.

| Gate | Status |
|---|---|
| Code signing of installers and executables | pending |
| Clean-machine install, upgrade and uninstall (Windows 10/11, Ubuntu) | pending |
| Hardware qualification on named boards | pending |
| Manual accessibility audit with screen readers | pending |
| Independent expert review of the numerical engines | pending |
| Human licence review of native notices and source offers | pending |
| Classroom pilot | pending |

## Before tagging a release

- [ ] Release commit identified; `release:verify` reports no uncommitted changes.
- [ ] All automated gates green on that commit.
- [ ] Release notes written from `CHANGELOG.md`, with limitations and pending gates (template: `docs/releases/`).
- [ ] Each external gate either done with evidence linked in `release/gates.json`, or the release is published as a **development pre-release** that lists it as pending.
- [ ] A maintainer other than the author approves the release record.

## Approval record

- Release version/commit:
- Verification evidence location:
- Licence reviewer:
- Security reviewer:
- Release approver:
- Known noncritical exceptions and owners:

## Earlier alpha evidence (2026-09-29, superseded by the automated gates above)

The dependency-free browser-preview build emits `dist/BUILD-METADATA.json`, `dist/BUILD-MANIFEST.json`, `dist/SHA256SUMS.txt`, `dist/BUILD-SBOM.spdx.json`, `dist/LICENSE`, and `dist/THIRD-PARTY-NOTICES.txt` through `npm run build`; `npm run native:sbom` additionally emits the deterministic 437-package native Cargo inventory `dist/NATIVE-BUILD-SBOM.spdx.json` (SHA-256 `FABA8F307359AC465F40AD8F4ECA2717800239E85644C95F3F78F1862BCC1AEF`) and the generated native notice candidate. `npm run release:prepare` performs both generation steps plus the automated licence audit, and the browser build preserves the native evidence. `npm run verify` re-hashes and tests the browser outputs. Strict TypeScript, Rust/Cargo tests, the Windows release executable, and an unsigned NSIS development installer have recorded local evidence. A Chrome keyboard/accessibility smoke is recorded in `docs/release-evidence/browser-accessibility-smoke-2026-09-29.md`, but it is not WCAG certification. See `docs/release-evidence/windows-development-build-2026-09-29.md`. Clean-machine installation, Linux, full accessibility/performance budgets, desktop-shell external-engine runs, complete licence review and signing remain unchecked release blockers.

## Current software-gate update (2026-09-29)

The following additional software evidence is complete: real ngspice batch simulation and adapter version parsing; GHDL analyze/elaborate/simulation; Verilator lint; Yosys JSON synthesis; nextpnr-ice40 HX8K/CT256 constraint-free dry-run; Arduino CLI version probe; rebuilt Windows Tauri executable and unsigned NSIS installer; isolated local installer install/reinstall/launch/uninstall smoke; clean Windows-style checkout verification; isolated Ubuntu WSL `npm ci` plus verification and an unbundled Linux Tauri release build; browser accessibility smoke; and headless Chrome browser-load smoke. These results are recorded in `docs/release-evidence/` and remain distinct from physical, clean-machine installer, hosted-CI, full performance/WCAG, signing and approval evidence.

The complete requirement-by-requirement handoff is [phase-gate-matrix-2026-09-29.md](release-evidence/phase-gate-matrix-2026-09-29.md). `npm run phase:status` checks its evidence links and reports remaining Partial/Open gates; `npm run signing:check` reports whether an approved signing tool and certificate reference are configured without signing anything; `npm run release:verify` checks the recorded browser, native, Windows and locally produced Linux development-artifact hashes together.
