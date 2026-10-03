# Modernization progress

Goal: turn OpenENTC Studio from a broad 0.1 prototype into a maintainable, secure, tested,
accessible and releasable **alpha**. No new laboratories. Nothing here claims the product is stable,
certified, laboratory-grade or hardware-qualified.

Baseline: [`docs/modernization-baseline.md`](modernization-baseline.md) (commit `1350ccf`).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 Baseline and safety | **done** | baseline, dependency map, extraction plan |
| 1 Correctness and repository fixes | **done** | Node version, full GPL text, README quick start, policies, issue forms |
| 2 UI modularisation | **done** | `src/app.js` 940 KB → 4 KB; 42 workspace modules; `ui:check` in verify |
| 3 Types and errors | pending | |
| 4 Browser workflows | pending | |
| 5 Coverage | pending | |
| 6 Security | partly done earlier | CodeQL, Dependabot, CSP and session-only API keys were added by the earlier hardening pass on this branch; the rest is pending |
| 7 Numerical credibility | pending | |
| 8 Accessibility and UX | pending | |
| 9 Onboarding and diagnostics | pending | |
| 10 CI and integrations | pending | |
| 11 Performance and recovery | pending | |
| 12 Release preparation | pending | |
| 13 Governance | partly done earlier | CODEOWNERS (placeholders), PR template, branch-protection and release policies exist |

## Completed work

### Phase 0 — baseline (2026-10-03)

- `docs/modernization-baseline.md`: environment, sizes, every verification command with its result,
  skipped tests, an opt-in run with real external tools, and browser performance figures.
- `scripts/app-dependency-map.mjs` (`npm run deps:map`): read-only static analysis of `src/app.js`
  covering categories, references between declarations, workspace ownership and the
  package-to-package import graph with cycle detection.
- `docs/architecture/app-dependency-map.generated.md` (generated) and
  `docs/architecture/app-dependency-map.md` (analysis and extraction order).
- `tests/app-dependency-map.test.mjs`: tests the analyser and asserts that the 57 packages have no import
  cycles and no runtime npm dependencies.
- No functional code changed.

### Phase 1 — correctness and repository fixes (2026-10-03)

- **Node.js:** the README, CONTRIBUTING, `docs/development.md` and `docs/support-matrix.md` now all state
  22.8.0 or newer, matching `engines` (the README used to say 20).
- **Licence:**
  - `LICENSE` is now the unmodified GPL-3.0 text (SHA-256 `3972dc97…`, the same as gnu.org's `gpl-3.0.txt`).
  - The "or any later version" grant and the copyright line moved to a new `NOTICE` file, which the build and the native notices now include.
  - `license = "GPL-3.0-or-later"` was added to the desktop `package.json` and `Cargo.toml`.
- **README:** reduced to an introduction, a five-minute quick start (checked in Chromium: the starter
  divider reads 6 V), limitations, a documentation index, contribution and licence. The full catalogue
  moved to `docs/features.md` with a link to the ledger. The detailed commands moved to `docs/development.md`.
- **New documents:** `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, with a placeholder conduct contact),
  `docs/maintainers.md` (with placeholder reviewer roles), `docs/repository-metadata.md` (suggested description, topics and a
  demo-URL placeholder), `docs/support-matrix.md`, `docs/project-compatibility-policy.md`,
  `docs/deprecation-policy.md` and `docs/security-contact-setup.md` (an owner checklist; no invented address).
- **GitHub templates:**
  - The PR template was renamed to `.github/PULL_REQUEST_TEMPLATE.md`.
  - CODEOWNERS placeholders are marked.
  - The issue forms are now bug, numerical error, security contact request (replacing a Markdown template), external engine problem (renamed) and accessibility (new), plus a `config.yml` that disables blank issues and links to private vulnerability reporting.
- **Test:** `tests/repository-docs.test.mjs` checks the Node version agreement, the licence hash and
  grants, that the documents exist, the issue forms, the README size and that local links in the documents resolve.

### Phase 2 — UI modularisation (2026-10-03)

- **`src/app.js`:** 8,384 lines / 940,410 bytes at the baseline, now **67 lines / 4,220 bytes**. It only composes the parts.
- **New layers:**
  - `src/shell/` (6 files);
  - `src/workspaces/` (42 files in 13 areas, one entry module per laboratory);
  - `src/components/` (tables, plots, Smith chart, forms, layout, dialogs);
  - `src/controllers/` (lab controls), `src/services/` (render hook, desktop project, project I/O);
  - `src/state/` (circuit-editor and native-session state), `src/shared/` (escaping, formatting, parsing).
- **Guard rails in `npm run verify`:** `npm run ui:check` fails on import cycles, unresolved or duplicate
  names, unused imports or locals, and unused shared exports.
- **Tests:**
  - workspace contract tests (each renderer renders its title, no "undefined", binder is safe without DOM);
  - unit tests for components, controllers and the render service;
  - tests for the move tool.
  - Source-text tests read the whole UI tree (`tests/helpers/ui-source.mjs`).
- **Tools:**
  - `scripts/refactor-move.mjs`: verbatim declaration mover using the TypeScript checker; refuses cycles.
  - `tests/e2e/ui-sweep.mjs`: opens every module and tab and fails on errors; `--compare` checks that the rendered HTML is identical.
- **Dead code removed:** two legacy renderers, an old Learning page, a duplicate helper, an unused palette and four unused
  imports. Two source-text tests that matched only that dead code now check the live code.
- **Documents:** `docs/architecture/ui-modules.md` and `docs/architecture/adr-0002-ui-modularisation.md`.

## Remaining work

Phases 3–13. The next step is Phase 3: type safety (`checkJs` for critical modules) and a consistent
error architecture.

## Verification evidence

| Date | Phase | Evidence |
|---|---|---|
| 2026-10-03 | 2 | After the final move: `npm run verify` 756 tests (744 pass, 0 fail, 12 skipped); `ui:check` clean; `ui-sweep --compare` against the pre-Phase-2 snapshot: 0 changed views out of 180 (1 view detected as live); injection probe clean across 43 modules; quick start reads 6 V; API-key flow unchanged. |
| 2026-10-03 | 1 | `npm run verify` 698 tests (686 pass, 0 fail, 12 skipped); `browser:smoke` passed; `cargo test` 39 passed; `native:sbom` and `license:audit` ran (0 unresolved licences); quick start walked in Chromium. GitHub's licence detection cannot be run locally; the file matches the official text byte for byte. |
| 2026-10-03 | 0 | `npm test` 689 tests (677 pass, 0 fail, 12 skipped); with ngspice-42 and process tests enabled, 687 pass and 2 skipped; `hdl:smoke` 8/8 stages passed; `browser:smoke` passed; cargo test 39 passed; audits 0 vulnerabilities. Details in the baseline. |

## Known limitations

- Workspaces keep rendering and event binding in one module, and the whole page still re-renders on every change (unchanged behaviour; see `docs/architecture/ui-modules.md`).
- `release:verify` checks hard-coded hashes for the native SBOM and notices. Phase 1 changed the notices (added NOTICE), so that check needs regeneration in Phase 12. It already could not run on Linux.

- `release:verify` needs a Windows desktop executable, so it cannot pass in a Linux container.
- Browser checks need Chromium with `--no-sandbox` when run as root (container-specific).
- External-tool evidence comes from one container's tool versions, not from CI.
- No physical hardware, clean machine, code signing or independent expert review is available in this environment.

## Decisions and rationale

| Decision | Why |
|---|---|
| Continue on the existing hardening branch | It already has the CI, CodeQL, CSP and credential work that Phases 1 and 6 ask for. Redoing it would duplicate effort, and those commits are not merged yet. |
| Write a small in-repo analyser instead of adding a tool such as madge or dependency-cruiser | No new dependency is needed, and it understands this file's render/bind convention. |
| Keep `LICENSE` as pure GPL text and move the project notice to `NOTICE` | GitHub's detector (licensee) matches the licence file against the official text; a preamble lowers the match. |
| Move code verbatim with a checker-based tool, and prove identical HTML per view | A hand rewrite of 940 KB could not be reviewed. Identical output is a strong, cheap check. See ADR 0002. |
| Extract shared components before any workspace | Shared components are used by 8–94 declarations each. Moving them first makes each workspace move small. |

## External actions still required

| Action | Owner |
|---|---|
| Enable branch protection, private vulnerability reporting and secret scanning in GitHub settings (not verified) | repository owner |
| Run `release:verify` on Windows after a desktop build | maintainer with Windows |
| Physical Arduino/FPGA tests, clean-machine install tests, code signing | maintainer with hardware and credentials |
| Independent numerical and teaching review | qualified human reviewers |
