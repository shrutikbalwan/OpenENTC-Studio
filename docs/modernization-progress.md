# Modernization progress

Goal: turn OpenENTC Studio from a broad 0.1 prototype into a maintainable, secure, tested,
accessible and releasable **alpha**. No new laboratories. Nothing here claims the product is stable,
certified, laboratory-grade or hardware-qualified.

Baseline: [`docs/modernization-baseline.md`](modernization-baseline.md) (commit `1350ccf`).

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 Baseline and safety | **done** | baseline, dependency map, extraction plan |
| 1 Correctness and repository fixes | pending | |
| 2 UI modularisation | pending | plan in `docs/architecture/app-dependency-map.md` |
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

## Remaining work

Phases 1–13 as listed above. The next step is Phase 1: Node version agreement, full GPL text,
README quick start, feature catalogue moved out of the README, policy documents and issue templates.

## Verification evidence

| Date | Phase | Evidence |
|---|---|---|
| 2026-10-03 | 0 | `npm test` 689 tests (677 pass, 0 fail, 12 skipped); with ngspice-42 and process tests enabled, 687 pass and 2 skipped; `hdl:smoke` 8/8 stages passed; `browser:smoke` passed; cargo test 39 passed; audits 0 vulnerabilities. Details in the baseline. |

## Known limitations

- `release:verify` needs a Windows desktop executable, so it cannot pass in a Linux container.
- Browser checks need Chromium with `--no-sandbox` when run as root (container-specific).
- External-tool evidence comes from one container's tool versions, not from CI.
- No physical hardware, clean machine, code signing or independent expert review is available in this environment.

## Decisions and rationale

| Decision | Why |
|---|---|
| Continue on the existing hardening branch | It already has the CI, CodeQL, CSP and credential work that Phases 1 and 6 ask for. Redoing it would duplicate effort, and those commits are not merged yet. |
| Write a small in-repo analyser instead of adding a tool such as madge or dependency-cruiser | No new dependency is needed, and it understands this file's render/bind convention. |
| Extract shared components before any workspace | Shared components are used by 8–94 declarations each. Moving them first makes each workspace move small. |

## External actions still required

| Action | Owner |
|---|---|
| Enable branch protection, private vulnerability reporting and secret scanning in GitHub settings (not verified) | repository owner |
| Run `release:verify` on Windows after a desktop build | maintainer with Windows |
| Physical Arduino/FPGA tests, clean-machine install tests, code signing | maintainer with hardware and credentials |
| Independent numerical and teaching review | qualified human reviewers |
