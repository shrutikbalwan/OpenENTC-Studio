# Hardening baseline — 2026-10-03

This is the starting point for the hardening and release-readiness programme. It records what
was measured before any code changed. Nothing here is a release claim.

## Starting point

| Item | Value |
|---|---|
| Commit | `df1b6ad6a8dfbd4b6254f9e59607ebe7062c6d02` (`main`, merge of PR #7) |
| Environment | Linux container (6.18 kernel), running as root, no physical devices attached |
| Node / npm | v22.22.2 / 10.9.7 |
| Rust / Cargo | 1.94.1 / 1.94.1 |
| Browser | Playwright Chromium 1194 (headless) |

## Commands and results

| Command | Result | Notes |
|---|---|---|
| `npm ci` | pass (1.2 s) | |
| `npm run verify` | pass (47 s) | format, lint, typecheck, build, tests: **678 tests, 666 pass, 0 fail, 12 skipped** |
| `npm run browser:smoke` | **not configured** by default | Needs `OPENENTC_CHROME`. In this container Chromium refuses to run as root without `--no-sandbox`; with a wrapper that adds the flag the smoke **passes** (1.6 s load, 30.7 kB DOM, the 3 accessibility probes true). |
| `npm run phase:status` | `review-required` | 15 gates: 9 pass, 3 partial, 3 open; `missingEvidence: []` |
| `npm audit` | 0 vulnerabilities | |
| `npm --prefix apps/desktop ci` / `audit` | pass / 0 vulnerabilities | |
| `cargo fmt --check` | **fails** | 217 formatting diffs across 11 Rust files (`artifact_store`, `discovery`, `events`, `job`, `lib`, `native_project`, `permissions`, `platform`, `process_runner`, `project_fs`, `serial_transport`) |
| `cargo clippy --all-targets` | pass with **35 warnings** | 28 × "can be simplified", 7 × dead code (3 methods, 2 functions, 2 constants), 1 needless borrow |
| `cargo test` | pass | 39 passed, 4 ignored (the ignored tests are child-process helpers, run by other tests) |
| `OPENENTC_PROCESS_TESTS=1 node --test tests/process-runner.test.mjs` | pass | 10/10, including process-group cancellation |

### Skipped Node tests (12)

| Tests | Why skipped | Gate |
|---|---|---|
| 6 ngspice tests (smoke, adapter, DC/AC/transient, built-in vs ngspice, device netlists, capacitances) | opt-in, need a reviewed ngspice executable | `OPENENTC_NGSPICE` |
| arduino-cli and kicad-cli smoke | opt-in, need the executables | env variables |
| 4 process-runner tests | opt-in, spawn real processes | `OPENENTC_PROCESS_TESTS=1` (they pass when enabled, above) |

So the README's "matches ngspice" claims rest on tests that **do not run in CI**. They are
evidence only when someone runs them with ngspice installed.

## Inventory

### Large source files

| File | Lines | Size |
|---|---|---|
| `src/app.js` | **8,391** | **940 kB** (many very long lines) |
| `packages/verilog/src/simulator.mjs` | 847 | |
| `src/engines/circuit-engine.js` | 682 | |
| `packages/mcu/src/avr/peripherals.mjs` | 537 | |
| `packages/learning/src/courseware.mjs` | 530 | |

`src/app.js` holds the shell, routing, every lab's rendering and event binding, the assistant
and the modal system. It is the main maintainability risk.

### HTML-generation sinks (browser)

- **9 `innerHTML` assignments** in `src/app.js` and nowhere else:
  - the root render (`app.innerHTML`, line 140), which receives every template;
  - two diffing `set()` helpers;
  - the instruction listing, lab-record preview iframe, PLC live panel, logic-analyser SVG and modal layer.
- No `outerHTML`, `insertAdjacentHTML`, `document.write`, `srcdoc`, `DOMParser` or `eval` / `new Function`. Lint forbids the last two.
- The UI is built from template strings: **6,431 `${…}` interpolations** against **557 `esc(…)` calls**. Most interpolations are numbers or static text, but correctness depends on every author remembering `esc` — there is no structural guarantee.
- **Dynamic probe** (`docs/audit` method, run in Chromium): hostile strings were placed in the project name and every component label of a valid project. Then all 51 modules were opened, looking for escaped markup or executed handlers. **Result: none found.**
  - **Not yet probed:** lab inputs inside experiments, imported VCD/PCAP/Touchstone text, serial-monitor output and AI replies. Phase 2 covers these.
- The project validator limits component ids and lengths, but it accepts arbitrary characters in names and labels. Output escaping is therefore the only defence, and it is a correct design only if it is complete.

### Browser storage

| Key | Content | Concern |
|---|---|---|
| `openentc-studio-project-v1` (+ temp/backup/corrupt keys) | the validated project | expected |
| learning-progress key (via `saveLearningProgress`) | quiz scores | expected |
| `openentc.assistant.v1` | assistant settings **including the cloud API key** | **finding:** a persistent credential in `localStorage` |

### Content Security Policy

- `index.html` has **no CSP**.
- `tauri.conf.json` `app.security` sets only `capabilities`, with no `csp` key, so the desktop webview has **no CSP**. **Finding.**

### Native boundary (desktop)

- Tauri capability `main-capability` grants only `core:default`.
- There are 31 `#[tauri::command]` handlers:
  - job queue and events;
  - artifact store and verify;
  - process start, cancel and revoke;
  - serial start, poll, write and close;
  - project open, save and close;
  - permission grants for process execution, artifact write and device target;
  - engine detection.
- `SECURITY.md` describes the process rules: argument arrays, allow-listed tools, canonical path confinement, bounds and process-tree cancellation. The opt-in process tests above exercise them.

### CI and governance

- One workflow, `verify.yml`, with `permissions: contents: read`, Windows and Linux verify, and a Linux Tauri build with artifact upload.
- Actions are pinned by **tag, not SHA**: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `dtolnay/rust-toolchain@stable`.
- **Missing:** `CODEOWNERS`, pull-request template, Dependabot, CodeQL or another static analysis, `CHANGELOG.md`, versioning policy, branch-protection procedure.
- Present: issue templates for bug, engine adapter, numerical error and security report.
- `SECURITY.md` says there is no private reporting channel yet.

### Release gates (from `docs/release-evidence/phase-gate-matrix-2026-09-29.md`)

| Status | Gates |
|---|---|
| Open | Hosted GitHub Actions evidence record; physical Arduino/FPGA/programmer; code signing and release approval |
| Partial | Performance qualification; Linux installer; licence/SBOM review |
| Pass (local or software only) | Browser persistence; native Rust boundary; Windows unsigned build; isolated install (no clean machine); clean checkout; ngspice and HDL software flows; Arduino CLI smoke; accessibility smoke |

The matrix predates Phases 9–12 (new labs, Fault Hunt, offline PWA, Real + Virtual Bench) and does not mention them.

### Capability ledger

- 119 entries: 105 built-in, 13 unavailable, 1 unsupported.
- Every evidence path and anchor exists (checked by script).
- **Gaps:**
  - No field separates *self-consistency*, *external-tool agreement*, *textbook agreement*, *physical-hardware* and *expert-review* evidence.
  - No entry names a reviewer or a validity range in machine-readable form.
  - Validation claims live only in free-text `limitations`.
  - Physical-hardware evidence: **none**. The Real + Virtual Bench real-device path was tested only with a mocked Web Serial port.
  - Expert review: **none recorded** for any module.

### Documentation claims needing evidence

| Claim type | Evidence today |
|---|---|
| "matches SciPy / scikit-rf / scikit-image / python_speech_features / Icarus / sigrok / FIPS vectors" | Golden fixtures generated by those tools are checked in under `tests/fixtures`, and tests compare against them. Provenance notes are inside some fixtures but not in a uniform record. |
| "matches ngspice" | Opt-in tests only. Not run in CI or in this baseline. |
| "results match simavr / ucsim" | Earlier fixture comparisons; to be re-checked for provenance in Phase 5. |
| Phase 9–12 labs | Textbook or closed-form checks written in the same change as the implementation, without independent review. |
| Physical hardware (Arduino, FPGA, programmers, Real + Virtual Bench) | **None** |

## Findings by priority

1. **High:** the cloud API key is persisted in `localStorage`. (Phase 2)
2. **High:** no Content Security Policy in browser or desktop. (Phase 2)
3. **Medium:** escaping is by convention across 6,431 interpolations, without a structural boundary or regression tests for untested inputs (lab inputs, imports, serial, AI). (Phase 2)
4. **Medium:** CI actions are not pinned to SHAs, and there is no Dependabot, CodeQL, CODEOWNERS or PR template. (Phase 1)
5. **Medium:** `cargo fmt` drift in 11 files, and clippy warnings including dead code. (Phase 1 hygiene)
6. **Medium:** the 8,391-line `src/app.js` monolith. (Phase 3)
7. **Medium:** no physical-hardware evidence and no expert review; the ledger cannot express validation levels. (Phases 5 and 7)
8. **Low:** browser smoke cannot run as root without a wrapper. Document the requirement or add an explicit flag. (Phase 4)
