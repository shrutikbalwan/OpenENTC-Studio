# Changelog

All notable changes are recorded here. The format follows Keep a Changelog, and versions follow
Semantic Versioning (`docs/governance/RELEASE-POLICY.md`). The product is an **unreleased alpha**:
no signed or qualified release exists yet.

## [Unreleased]

### Added
- Governance: roadmap, backlog, review responsibilities, classroom pilot plan (not started), a feature-status matrix generated from the capability ledger, and the modernization final report.
- Performance budgets for the engines, browser start-up, lab switching and download size; a "Backups in this browser" section in the diagnostics centre to open, download or delete backups.
- CI: an external-tools job (ngspice, GHDL, Verilator, Yosys, nextpnr) with a passed/failed/unavailable/skipped report, an unsigned Windows desktop build, and SBOM and licence audit; `docs/testing/ci.md`.
- A first-run guide and example library on Mission control; a diagnostics centre (health, recent errors, a redacted report to copy or download, and a link to report a problem); a "Know the limits" section in Help; user guides in `docs/user-guide/`.
- Automated accessibility tests (axe-core 4.13.0, development only) on every module in both themes; a skip link; an "Alpha · educational" maturity badge on each lab; `docs/accessibility.md`.
- Numerical validation manifest (`validation/manifest.json`), expert review checklist, a required `review` field in the capability ledger, circuit solver diagnostics (iterations, GMIN, source stepping) and a warning for non-physical node voltages.
- Threat model and AI data-flow documents (`docs/security/`), a CI dependency-audit job (`npm audit`, `cargo audit`), expiring device permission grants with `revokePermission`/`revokeAll`, and `createDiagnosticReport()` for redacted diagnostics.
- Coverage reporting with per-risk-group thresholds (`npm run coverage`), a targeted mutation check (`npm run test:mutation`), seeded property and fuzz tests, store tests, and a CI `coverage` job. See `docs/testing/test-categories.md`.
- 24 Playwright browser journeys (`npm run test:e2e`) and a `browser-e2e` CI job; development dependency `playwright-core` 1.56.1 (see `docs/dependencies.md`).
- Shared error classes with stable codes, recovery hints and redaction (`packages/errors`); a central `reportError()` and error panel; a generated package API reference (`docs/api/packages.md`).
- Code of Conduct, maintainers, repository metadata, support matrix, project compatibility, deprecation and security-contact setup documents.
- Modernization baseline and the `npm run deps:map` dependency analyser.
- Hardening baseline audit (`docs/audit/hardening-baseline-2026-10-03.md`).
- Governance: CODEOWNERS, pull-request template, Dependabot, CodeQL, branch-protection and release policies.
- Content Security Policy for the browser app and the desktop webview (`docs/security/CSP.md`).
- Browser-security tests and an opt-in Chromium injection probe (`tests/e2e/injection-probe.mjs`).

### Fixed
- **Performance:** `fft()` is now an O(n log n) FFT (about 300× faster for 4096 samples), and the Biomedical lab opens about 20× faster.
- **Accessibility:** light-theme text contrast, labels for code editors and other form fields, text alternatives for all charts, low-contrast meter captions, and nested interactive controls on circuit parts.
- Revoking a device target no longer also revokes other targets that end with the same name (for example `usb:COM4`).
- **Privacy:** the AI assistant no longer receives the project name in the circuit netlist title.
- Projects saved before the `notes` field existed are migrated instead of being rejected.
- The installed web app now really works offline after one visit: the service worker precaches every web asset (`precache.json`), not only the shell.

### Changed
- Release tooling: `release:prepare` writes a release manifest (artifacts, hashes, source commit, gate status) and `release:verify` re-checks it without hard-coded hashes; `release:reproducible` checks that two builds are identical; both desktop CI jobs run a release dry run. External gates are tracked in `release/gates.json` and are all pending.
- Error messages now include the recovery hint (what to try next).
- Lab-record PDF footers now say the values are simulated with educational models, not measured data.
- The browser UI is split into modules: `src/app.js` (940 KB) is now a 67-line entry point over `src/shell`, 42 workspace modules in `src/workspaces`, and shared `components`, `controllers`, `services`, `state` and `shared` layers. Rendered output is unchanged. `npm run ui:check` (in `verify`) blocks import cycles and unused code.
- `LICENSE` now holds the full GPL-3.0 text; the "or any later version" grant is in `NOTICE`. The desktop manifests declare `GPL-3.0-or-later`.
- The README is a short introduction with a quick start; the feature catalogue moved to `docs/features.md`, the command reference to `docs/development.md`. The documented Node.js requirement is now 22.8.0 or newer everywhere.
- Issue forms: added accessibility and security-contact-request forms, renamed the engine form, and disabled blank issues.
- GitHub Actions are pinned to reviewed commit SHAs; checkouts no longer persist credentials; the desktop CI job now checks Rust formatting and runs `cargo test --lib`.
- The desktop crate is formatted with rustfmt.
- **Security:** the AI assistant API key is no longer saved in `localStorage`. It stays in memory, or in `sessionStorage` when "remember for this tab" is on. A key saved by an older version is deleted at startup, and the settings panel says so.
- **Security:** the assistant client refuses redirects, sends no cookies, limits response size and tool calls, and removes keys from error text. Local endpoints are limited to `localhost` and `127.0.0.1`.
- Fonts load from local aliases instead of Google Fonts, so the app makes no third-party request offline.

### Known limitations
- Branch protection, private vulnerability reporting and secret scanning must be enabled by the repository owner; they are not yet verified.
- The desktop CSP is set in configuration but has not been exercised in a running desktop build. `style-src` still allows inline styles.
- See `docs/audit/hardening-baseline-2026-10-03.md` for the open findings (monolithic UI, validation evidence, physical hardware).

## [0.1.0-alpha] — development history before 2026-10-03

Feature development through PR #7: the browser and desktop studio with 43 modules, the Learning Hub, Fault Hunt, the offline PWA and the Real + Virtual Bench. Not released, signed or hardware-qualified.
