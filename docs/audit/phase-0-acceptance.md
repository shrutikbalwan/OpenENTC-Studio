# Phase 0 acceptance audit

Audit date: 2026-09-28

Status terms are applied from execution evidence, not intended design.

| Acceptance criterion | Status | Concrete evidence |
|---|---|---|
| Every primary UI action has an honest capability state. | PASS | `capabilities/ledger.json`; unavailable specialist, learning, build, device, fit, zoom, and problem-navigation controls are disabled in `src/app.js`; rendered Chrome checks showed disabled PCB and Circuit controls. `tests/phase0.test.mjs` rejects stale fake-success action bindings. |
| Existing tests pass from a clean checkout. | PASS | The supplied `openentc-studio-baseline.bundle` was cloned to `E:\OpenENTC Studio\openentc-studio-baseline-clean` at `46d065e…`; its clean `npm test` passed 4/4 and `npm run check` passed. |
| The audit identifies unsupported claims and the exact phase that will resolve each one. | PASS | `docs/audit/alpha-baseline.md` and each `plannedPhase` in `capabilities/ledger.json`. |
| Verification failure produces a nonzero exit code. | PASS | `scripts/verify.mjs`, `scripts/verify-lib.mjs`, and two injected failure tests in `tests/phase0.test.mjs`; the live format failure stopped the gate with exit code 1 before correction. |
| No native engine is represented as installed unless detection evidence exists. | PASS | `src/core/engine-registry.js` exposes only the internal solver as `built-in`; all external entries are `unavailable` or `unsupported`. This invariant is tested in `tests/phase0.test.mjs` and visible in the rendered engine table. |

## Required-output audit

| Required output/work | Status | Evidence |
|---|---|---|
| Complete screen, control, model, and test inventory | PASS | `docs/audit/alpha-baseline.md` |
| Functional/simulated/decorative/misleading classification | PASS | Baseline screen table and unsupported-claims table |
| Target-architecture migration gaps | PASS | Baseline architecture gap map |
| Formatting, linting, type-checking, and test commands | PARTIAL | Commands exist and pass. `npm run typecheck` is explicitly a JavaScript structural-contract check, not strict static checking; strict TypeScript is Phase 1. |
| Capability ledger | PASS | `capabilities/ledger.json`, schema, and ledger tests |
| Desktop/engine/licence ADR | PASS | `docs/decisions/0001-desktop-and-engine-boundary.md`; correctly marked Proposed because approval is not evidenced |
| Four issue templates | PASS | `.github/ISSUE_TEMPLATE/`; security template prevents public disclosure |
| Definition of done and release checklist | PASS | `docs/definition-of-done.md`, `docs/release-checklist.md` |
| Performance/accessibility baselines without compliance claims | PASS | Dedicated sections in `docs/audit/alpha-baseline.md` |
| Reliable one-command verification | PASS | `npm run verify`; format, lint, structural contracts, tests; no dependencies installed |
| Existing browser workflow remains runnable | PASS | Local HTTP checks returned 200 for `/` and `/src/app.js`; Chrome rendered the updated Mission control, PCB preview, Circuit Lab, and 9 V / 6 V / 27 mW result. The server-space regression is covered by `rootFromModuleUrl` test. |

## Phase decision

Phase 0 is accepted for handoff. The working directory remains an extracted tree without `.git`, but the supplied baseline bundle provides clean-checkout provenance and the clean clone passed the original gates. Phase 1 may begin in the working directory while preserving the bundle-derived baseline.
