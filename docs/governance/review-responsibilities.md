# Review responsibilities

Who must review a change, and which checks must pass, by the kind of change. Until the roles in
`docs/maintainers.md` are staffed, the sole maintainer does every review. That is a release risk,
recorded in `docs/governance/roadmap.md`.

| Change | Required review | Required evidence (in addition to green CI) |
|---|---|---|
| Numerical engine (`src/engines/`, `packages/*` kernels) | numerical reviewer | reference values with tool and version; an entry in `validation/manifest.json`; tolerance justified |
| Native boundary (`apps/desktop/src-tauri/`, `packages/process-runner/`, `packages/device-bridge/`) | native/security reviewer | Rust tests; no shell strings; allow-listed executables, argument arrays, path confinement, limits, timeouts and process-tree cancellation kept |
| Project format (`packages/project-model/`, `schemas/`) | project-format reviewer | migration test from every older version; `docs/project-compatibility-policy.md` updated |
| UI and styles | accessibility reviewer for visible changes | `tests/e2e/accessibility.e2e.mjs` green in both themes; keyboard path checked |
| Security-relevant code (escaping, credentials, CSP, AI assistant) | native/security reviewer | `tests/browser-security.test.mjs` and `npm run test:mutation` green |
| Dependencies | native/security reviewer | `docs/dependencies.md` entry: purpose, pinned version, SPDX licence, provenance, security review |
| CI workflows | native/security reviewer | actions pinned by SHA; no secrets in pull-request jobs; governance tests updated |
| Capability claims (`capabilities/`, docs, release notes) | maintainer other than the author | evidence files exist; no hardware, signing, WCAG or professional-equivalence claim without evidence |
| Release | maintainer other than the release author | `docs/release-checklist.md`; `npm run release:verify`; gate status in `release/gates.json` |

## Rules that never change

- A test is never weakened, skipped or deleted just to make a change pass.
- A simulated or mocked result is never presented as a hardware result.
- A coverage threshold is never lowered (CI enforces this).
- An external gate is marked `done` only with evidence.
