# Test categories

OpenENTC Studio has several kinds of tests. They prove different things. A pass in one category is
never reported as a pass in another — in particular, a simulated or mocked test is never a
hardware result.

| Category | Where | How to run | What a pass proves | What it does **not** prove |
|---|---|---|---|---|
| Unit | `tests/*.test.mjs` | `npm test` | Package and UI-module logic behaves as specified on the inputs in the test. | That the browser UI wires it up correctly, or that results match external tools. |
| Property and fuzz | `tests/property.test.mjs` | `npm test` (seed: `OPENENTC_PROPERTY_SEED`) | Invariants (FFT Parseval/linearity/symmetry, Boolean minimisation equivalence, unit round trips, subnet arithmetic) hold on many seeded random inputs; parsers and project validation reject corrupted input with an `Error`/`ProjectError` instead of crashing or hanging. | Correctness on inputs the generator never produces. |
| Reference fixture | reference values stored in unit tests (for example `tests/circuit.test.mjs` against ngspice, the filter tests against SciPy) | `npm test` | Built-in solvers match stored values computed by a named external tool or closed-form result, within stated tolerances. | That the external tool is installed here, or agreement outside the fixture set. |
| Live external tool | `tests/ngspice.integration.test.mjs`, `tests/optional-engines.integration.test.mjs`, `tests/process-runner.test.mjs` | Opt-in: set `OPENENTC_NGSPICE`, `OPENENTC_ARDUINO_CLI`, `OPENENTC_KICAD_CLI` to an exact executable path, or `OPENENTC_PROCESS_TESTS=1` | The adapter really runs that tool version and parses its output. | Anything about tools that were not installed. These tests are **skipped**, not passed, when the variable is unset. |
| Browser journey | `tests/e2e/*.e2e.mjs` | `npm run test:e2e` | Real Chromium can complete the listed user journeys against the built `dist/`, including offline reload. See [browser-tests.md](browser-tests.md). | Other browsers, screen readers, or real devices. |
| Coverage | `scripts/coverage.mjs` | `npm run coverage` | Which lines, branches and functions the unit tests execute, per risk group. | That executed code is checked by an assertion (that is what mutation testing checks). |
| Mutation | `scripts/mutation-check.mjs` | `npm run test:mutation` | For eight high-risk lines (escaping, size limits, path traversal, redaction, credential consent, browser device permissions, MNA stamps, legacy migration), the tests fail when the line is broken. | Anything about lines that are not in the mutant list. |
| Hardware | none automated | Manual, see [HARDWARE-FREE-RELEASE-POLICY.md](../HARDWARE-FREE-RELEASE-POLICY.md) | Only a recorded run on named physical hardware counts. | — No hardware test has been run in CI. Simulated serial/USB tests are unit tests. |

## Coverage thresholds

`coverage-thresholds.json` sets minimum line, branch and function coverage for each risk group.
The first values were set on 2026-10-04 just below the measured baseline:

| Group | Lines | Branches | Functions |
|---|---|---|---|
| all | 83.4 | 81.3 | 81.4 |
| packages | 98.5 | 85.4 | 93.9 |
| browser-ui | 56.0 | 65.3 | 56.6 |
| project-schema-and-migration | 98.2 | 89.1 | 95.4 |
| persistence | 100 | 77.3 | 93.5 |
| parsers | 98.2 | 85.3 | 84.6 |
| permissions-and-native-boundary | 98.4 | 82.3 | 92.1 |
| errors-and-redaction | 100 | 87.0 | 100 |
| circuit-solver | 99.1 | 95.4 | 98.6 |

Twelve browser-only files (the app entry, the shell, desktop project and project-file I/O services,
and a few workspaces) are not loaded by any unit test and count as 0 %. They are exercised by the
browser journeys, but browser coverage is not measured yet, so `browser-ui` coverage is
understated rather than overstated.

CI (`coverage` job) runs `node scripts/coverage.mjs --compare-base origin/main`. It fails if a
threshold is missed **or lowered** compared with `main`. Raise thresholds when coverage improves.

## Skipped tests and why

| Test | Skipped when | Reason |
|---|---|---|
| ngspice integration (6 tests) | `OPENENTC_NGSPICE` unset | Verification never searches for or runs external engines unless given an exact path. |
| arduino-cli / kicad-cli probes | their variable is unset | Same rule. |
| process runner (4 tests) | `OPENENTC_PROCESS_TESTS` ≠ `1` | They spawn real child processes; opt-in to keep the default gate hermetic. The process-group test also skips on Windows (POSIX process groups). |
| symlink cases (project model, phase 0) | the OS account may not create symlinks (Windows without developer mode) | The confinement code is still exercised by the non-symlink cases. |
