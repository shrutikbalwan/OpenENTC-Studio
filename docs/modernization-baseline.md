# Modernization baseline — 2026-10-03

Phase 0 of the modernization programme (`docs/modernization-progress.md`). This file records the
state of the repository **before** any Phase 1–13 change. No functional code was changed to
produce it. The only additions are a read-only analysis script (`scripts/app-dependency-map.mjs`),
its test, its generated output and these documents.

This branch already carries an earlier hardening pass (commits `84ecbda`…`1350ccf`, not yet
merged to `main`): SHA-pinned CI, CodeQL, Dependabot, CODEOWNERS, a pull-request template,
rustfmt, a Content Security Policy and session-only API-key storage. See
`docs/audit/hardening-baseline-2026-10-03.md`. Those changes are part of this baseline and are
reused by later phases instead of being redone.

## Environment

| Item | Value |
|---|---|
| Commit | `1350ccf746455354d4cf4230095b7d49f6309688` (branch `claude/amazing-goodall-galjar`, 5 commits ahead of `main` `df1b6ad`) |
| Working tree | clean; no user-owned uncommitted changes found |
| Machine | Linux container, kernel 6.18, running as root, no USB devices or physical boards |
| Node / npm | v22.22.2 / 10.9.7 |
| Python | 3.11.15 (system interpreter has no NumPy/SciPy; reference fixtures were generated earlier in a separate virtual environment) |
| Rust / Cargo | 1.94.1 / 1.94.1 |
| Browser | Playwright Chromium 141.0.7390.37 (headless; needs `--no-sandbox` as root) |
| External tools found | ngspice-42, Icarus Verilog, GHDL 4.1.0, Yosys 0.33, Verilator 5.020, nextpnr-ice40 0.6, simavr. **Not found:** arduino-cli, kicad-cli, cargo-audit |

## Size

| Measure | Value |
|---|---|
| Tracked files | 692 |
| Source lines (`src`, `packages/*/src`, `scripts`, `apps`; JS/TS/Rust/CSS/HTML, excluding `.d.ts`) | 36,557 |
| Test lines (`tests/**/*.mjs\|js`) | 8,892 in 90 `*.test.mjs` files |
| `src/app.js` | **8,384 lines, 940,410 bytes**, 84 import statements, 707 top-level declarations |
| Domain packages | 57 (`packages/*`), none with runtime npm dependencies, no import cycles |
| Browser build (`dist/`, excluding the native SBOM and notices from `release:prepare`) | 2,931,559 bytes: `dist/src` 1,204,981 B and `dist/packages` 1,648,553 B (unbundled ES modules) |

## Verification commands

All runs are on the commit above, in this container.

| Command | Exit | Time | Result |
|---|---|---|---|
| `npm ci` | 0 | 1.1 s | |
| `npm run format:check` | 0 | 0.7 s | passed |
| `npm run lint` | 0 | 5.5 s | passed (264 files after this phase's script and test) |
| `npm run typecheck` | 0 | 1.6 s | passed (`checkJs` is off; only listed files are checked) |
| `npm run worker:check` | 0 | 0.2 s | passed |
| `npm test` | 0 | 41.8 s | **689 tests: 677 pass, 0 fail, 12 skipped** |
| `npm run build` | 0 | 0.5 s | passed |
| `npm run browser:smoke` | 0 | — | passed with `OPENENTC_CHROME` pointing at a `--no-sandbox` wrapper. Without it the command reports "not configured". |
| `npm run phase:status` | 0 | 0.2 s | `review-required`: 15 gates, 9 pass, 3 partial, 3 open, no missing evidence files |
| `npm run release:verify` | **1** | — | **Pre-existing failure, not applicable here.** It requires the Windows desktop executable `apps/desktop/src-tauri/target/release/openentc-studio.exe`, which a Linux container cannot build. |
| `npm audit` / `npm --prefix apps/desktop audit` | 0 | — | 0 vulnerabilities each |
| `cargo fmt --check` | 0 | — | passed |
| `cargo clippy --all-targets` | 0 | — | 35 warnings (lib), unchanged from the hardening baseline |
| `cargo test` | 0 | 1.8 s | 39 passed, 4 ignored (helper processes run by other tests) |

### Skipped tests (default run)

| Tests | Reason | Enable with |
|---|---|---|
| 6 ngspice tests | need a reviewed ngspice executable | `OPENENTC_NGSPICE=/path/to/ngspice` |
| arduino-cli and kicad-cli smoke | need those executables | tool-specific variables |
| 4 process-runner tests | spawn real child processes | `OPENENTC_PROCESS_TESTS=1` |

### Opt-in external-tool run (real tools in this container)

| Command | Result |
|---|---|
| `OPENENTC_NGSPICE=/usr/bin/ngspice OPENENTC_PROCESS_TESTS=1 … node --test tests/*.test.mjs` | **689 tests: 687 pass, 0 fail, 2 skipped** (arduino-cli, kicad-cli not installed). The 6 ngspice-42 comparisons and the 4 process-runner tests passed. |
| `npm run hdl:smoke` (GHDL, Verilator, Yosys, nextpnr-ice40) | all 8 stages passed: GHDL analyse/elaborate/simulate, Verilator lint, Yosys synthesis, nextpnr synthesis and dry-run |
| `npm run ngspice:smoke` | passed |

This is evidence for these tool versions in this container only. CI does not run these tools yet
(Phase 10).

## Browser performance

| Measure | Value | How |
|---|---|---|
| `browser:smoke` `elapsedMs` | 8,238 ms on the first (cold) run, then 751 / 733 / 700 ms | This times the **whole headless Chromium process** (`--dump-dom`), not page load. It is a coarse liveness check. |
| DOM size after first render | 31,142 bytes | `browser:smoke` |
| `domContentLoaded` / `load` | 219–233 ms / 263–266 ms (3 runs) | Playwright, dev server on `127.0.0.1:4173`, fresh context each run |
| Resources fetched on first load | 135 files, 2,483 KB decoded | Navigation and Resource Timing APIs |
| JS heap after load | 9 MB | `performance.memory` |
| Switch to Circuit Lab | 66–164 ms | click until the workspace re-renders |

There are no enforced budgets yet; `docs/PERFORMANCE-BUDGETS.md` lists targets without tests.
Phase 11 will set enforceable budgets.

## Architecture snapshot

The full machine-generated map is `docs/architecture/app-dependency-map.generated.md`
(`npm run deps:map`). The analysis and the extraction plan are in
`docs/architecture/app-dependency-map.md`.

- **Rendering:** `render()` rebuilds the whole page with `app.innerHTML` on every state change, then
  `bindEvents()` re-attaches every listener. `renderWorkspace()` picks one of 44 workspace
  renderers by `activeModule`.
- **Events:** 354 `addEventListener` calls; 44 `bind*Events()` functions are all called on every render
  and do nothing when their elements are absent.
- **State:** a central store (`src/core/store.js`: `getState`, `setState`, `updateProject`, undo/redo)
  plus 32 module-level mutable lab objects and sessions inside `app.js`.
- **Persistence:** project storage goes through `src/core/project-storage.js` via the store. In
  `app.js`, `saveBrowserProject`, `exportProject`, the assistant settings and the Learning Hub touch storage.
- **Native bridge:** 35 declarations call `desktopBridge` or the desktop runners (ngspice, Arduino,
  HDL, serial, permission grants, project open/save).
- **HTML sinks:** 9 `innerHTML` assignments (root render, MCU and Uno painters, logic analyser,
  record preview, PLC live panel, modal). Every interpolation relies on `esc()`.

## Known issues found during the baseline (to fix in later phases)

| Issue | Phase |
|---|---|
| README says "Install Node.js 20 or newer"; `package.json` `engines` says `>=22.8.0` | 1 |
| `LICENSE` is a 10-line notice, not the full GPL text, so GitHub may not detect the licence | 1 |
| `src/app.js` is 940 KB, with rendering, events, state and native calls together | 2 |
| `checkJs` is off for most of `src/` | 3 |
| No end-to-end browser workflows; `browser:smoke` only checks that the page renders | 4 |
| No coverage reporting | 5 |
| External-tool comparisons do not run in CI | 7, 10 |
| No enforced performance or accessibility budgets | 8, 11 |
| `release:verify` assumes a Windows build | 12 |
