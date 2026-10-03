# Changelog

All notable changes are recorded here. The format follows Keep a Changelog, and versions follow
Semantic Versioning (`docs/governance/RELEASE-POLICY.md`). The product is an **unreleased alpha**:
no signed or qualified release exists yet.

## [Unreleased]

### Added
- Code of Conduct, maintainers, repository metadata, support matrix, project compatibility, deprecation and security-contact setup documents.
- Modernization baseline and the `npm run deps:map` dependency analyser.
- Hardening baseline audit (`docs/audit/hardening-baseline-2026-10-03.md`).
- Governance: CODEOWNERS, pull-request template, Dependabot, CodeQL, branch-protection and release policies.
- Content Security Policy for the browser app and the desktop webview (`docs/security/CSP.md`).
- Browser-security tests and an opt-in Chromium injection probe (`tests/e2e/injection-probe.mjs`).

### Changed
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
