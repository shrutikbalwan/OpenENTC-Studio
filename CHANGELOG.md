# Changelog

All notable changes are recorded here. The format follows Keep a Changelog, and versions follow
Semantic Versioning (`docs/governance/RELEASE-POLICY.md`). The product is an **unreleased alpha**:
no signed or qualified release exists yet.

## [Unreleased]

### Added
- Hardening baseline audit (`docs/audit/hardening-baseline-2026-10-03.md`).
- Governance: CODEOWNERS, pull-request template, Dependabot, CodeQL, branch-protection and release policies.

### Changed
- GitHub Actions are pinned to reviewed commit SHAs; checkouts no longer persist credentials; the desktop CI job now checks Rust formatting and runs `cargo test --lib`.
- The desktop crate is formatted with rustfmt.

### Known limitations
- Branch protection, private vulnerability reporting and secret scanning must be enabled by the repository owner; they are not yet verified.
- See `docs/audit/hardening-baseline-2026-10-03.md` for the open findings (credential storage, CSP, monolithic UI, validation evidence, physical hardware).

## [0.1.0-alpha] — development history before 2026-10-03

Feature development through PR #7: the browser and desktop studio with 43 modules, the Learning Hub, Fault Hunt, the offline PWA and the Real + Virtual Bench. Not released, signed or hardware-qualified.
