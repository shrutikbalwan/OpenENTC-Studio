# Modernization final report — 2026-10-04

This report closes the modernization programme (Phases 0–13). It compares the repository with the
baseline in [`modernization-baseline.md`](modernization-baseline.md) (commit `1350ccf`, 2026-10-03).
Phase-by-phase detail and evidence are in [`modernization-progress.md`](modernization-progress.md).

**Bottom line:** OpenENTC Studio is now a maintainable, tested, documented **alpha**. It is **not** a
qualified release. Every external gate is still pending: code signing, clean-machine installs,
hardware qualification, a manual accessibility audit, independent numerical review, a human
licence review and a classroom pilot (`release/gates.json`). Nothing in this report claims WCAG
conformance, professional-SPICE equivalence, hardware qualification or certification.

## Before and after

| Measure | Baseline (2026-10-03) | Now (2026-10-04) |
|---|---|---|
| `src/app.js` | 940,410 bytes, 8,384 lines | 4,272 bytes; UI split into 42 workspace modules plus shell, components, controllers, services and state |
| Unit tests (`npm test`) | 689 (677 pass, 12 skipped) | **829 (817 pass, 0 fail, 12 skipped)** in 104 files |
| Browser journeys (Chromium) | none | **37** in 10 files (journeys, accessibility, onboarding, recovery, performance, offline) |
| Coverage | not measured | thresholds per risk group, never lowered against `main` (all 83.1 / 81.4 / 81.5 lines / branches / functions; packages 98.6 / 85.4 / 94.0) |
| Mutation check | none | 8 targeted mutants on security-critical lines, all killed |
| Property and fuzz tests | none | 10 seeded property and fuzz tests (FFT, Boolean minimisation, units, subnets, project validation, 5 parsers) |
| Type-checked files | listed files only | 134 files, strict (shared layers and packages) |
| CI jobs | 3 (Verify on 2 OSs, Linux desktop build) plus CodeQL | **9** plus CodeQL: Verify on 2 OSs, browser journeys, coverage and mutation, dependency/SBOM/licence audit, external tools, Windows desktop build, Linux desktop build, release dry runs |
| External tools in CI | none | ngspice 42, GHDL 4.1, Verilator 5.020, Yosys 0.33, nextpnr 0.6: 15 checks pass in hosted CI; arduino-cli and kicad-cli reported **unavailable** |
| Accessibility | one manual Chrome smoke | axe-core WCAG 2.0–2.2 A/AA rules on all 44 views in both themes: **0 violations** (166 light-theme contrast failures and other problems were fixed); skip link; reflow at 390 and 768 px |
| Security documentation | SECURITY.md, CSP | plus a threat model (11 trust boundaries), the AI data flow, expiring device grants and a redacted diagnostic report |
| Numerical evidence | reference values scattered in tests | validation manifest with 25 entries (tool, version, tolerance, test); expert-review checklist; review status on all 119 capabilities (0 independently reviewed) |
| Performance | one start-up smoke | budgets for 6 engine operations, start-up, lab switching and bundle size; FFT 500 ms → 2 ms; Biomedical lab opening 1 s → 50 ms |
| Release verification | `release:verify` failed (stale hard-coded hashes; needed a Windows exe) | release manifest without hard-coded hashes; reproducible build (344 identical files); dry runs pass on Windows and Linux in CI |
| Runtime npm dependencies | 0 | 0 (dev only: typescript, playwright-core, axe-core, each documented) |
| npm / Cargo audit | 0 vulnerabilities | 0 vulnerabilities; `cargo audit`: 0 vulnerabilities, 3 warnings from Tauri's GTK3 stack |
| Rust tests | 39 passed, 4 ignored | 39 passed, 4 ignored (desktop crate unchanged in this programme) |

## Real defects found and fixed

1. **Windows-only path bug** in the refactoring tool. Hosted CI exposed it, after earlier reports had relied on local runs only. This is recorded in the progress document.
2. **Legacy projects** without a `notes` field could not be opened.
3. **Offline:** the app did not work offline after one visit. Only 6 shell files were cached.
4. **Device permissions:** revoking one device target also removed others with the same name suffix.
5. **Privacy:** the AI assistant received the project name in the circuit netlist.
6. **Solver credibility:** non-physical results, such as 10¹² V from a current source into a reverse-biased diode, were shown without a warning.
7. **Accessibility:** light-theme contrast, unlabelled editors and inputs, charts without text alternatives, and nested interactive controls.
8. **Performance:** `fft()` was a direct O(n²) DFT, and the Biomedical lab did O(n²) work on every render.
9. **Release tooling:** `release:verify` had stale hard-coded hashes and could not pass outside one Windows machine.

## Final verification (2026-10-04, this container and hosted CI)

| Check | Result |
|---|---|
| `npm run verify` (format, lint 370 files, typecheck 134 files, UI module rules, build, unit tests) | passed; 829 tests, 0 failures, 12 opt-in skips |
| `npm run test:e2e` | 37 of 37 passed |
| `node scripts/coverage.mjs --compare-base origin/main` | thresholds met |
| `npm run test:mutation` | 8 of 8 mutants killed |
| External tools (local, real tools) | 15 passed, 2 unavailable, 0 failed |
| `npm audit` (workspace, desktop) | 0 vulnerabilities |
| `cargo test --lib` / `cargo fmt --check` / `cargo audit` | 39 passed / clean / 0 vulnerabilities, 3 warnings |
| `npm run release:reproducible` / `release:prepare` + `release:verify` | identical builds / integrity verified on a clean tree |
| Hosted CI run 104 (https://github.com/shrutikbalwan/OpenENTC-Studio/actions/runs/37179846899) | every job passed, including the Windows and Linux release dry runs |

## What is still not done

**External gates** (`release/gates.json`):
- code signing;
- clean-machine install tests;
- hardware qualification;
- a manual accessibility audit with screen readers;
- independent expert numerical review;
- human licence review;
- a classroom pilot.

**Engineering backlog** (`governance/backlog.md`): the main items are type-checking the UI workspaces, scanning every lab tab with axe, and measuring browser coverage.

**Governance:**
- Branch protection, private vulnerability reporting and secret scanning have **not** been verified as enabled in GitHub settings.
- The review roles in `docs/maintainers.md` are still placeholders.

## Where things are

| Topic | Document |
|---|---|
| Progress and evidence, phase by phase | `docs/modernization-progress.md` |
| Feature status (generated from the ledger) | `docs/feature-status.md` |
| Roadmap, backlog, review responsibilities, classroom pilot | `docs/governance/` |
| Testing: categories, CI, browser tests, numerical validation | `docs/testing/` |
| Security: threat model, AI data flow, CSP | `docs/security/` |
| Accessibility | `docs/accessibility.md` |
| Release checklist, policy, draft notes | `docs/release-checklist.md`, `docs/governance/RELEASE-POLICY.md`, `docs/releases/` |
| User guides | `docs/user-guide/` |
