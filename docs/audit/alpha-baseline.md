# Alpha baseline audit

Audit date: 2026-09-28

Scope: OpenENTC Studio 0.1.0 browser alpha

Evidence: repository source, four original Node tests, and a rendered Chrome walkthrough at `http://127.0.0.1:4173`

This is an inventory and risk baseline, not a compliance claim. The extracted project did not contain Git metadata, so commit cleanliness and clean-checkout reproducibility could not be verified.

## Executive assessment

The alpha has one real engineering workflow: a fixed example or user-edited node model can be solved by the built-in modified nodal analysis implementation for positive resistors and independent DC voltage sources. The rendered voltage-divider example produced `V(vcc) = 9 V`, `V(out) = 6 V`, and `27 mW`, consistent with the unit fixture.

Project creation, localStorage persistence, theme selection, JSON import/export, component placement/editing, a simple firmware text editor, source-structure checks, and navigation are functional but limited. PCB, FPGA, DSP, communications, RF, IoT/network, and learning screens are previews. External tools are not detected or executable. Phase 0 therefore disables or relabels misleading actions and records every primary surface in `capabilities/ledger.json`.

## Screen and control inventory

| Screen | Controls and models | Baseline classification | Evidence / correction |
|---|---|---|---|
| Global shell | Home, module navigation, project name, theme, Import, Export, command palette, Help | Functional, with incomplete keyboard/focus behavior | `src/app.js`, `src/core/store.js`; command button wired in Phase 0 |
| Mission control | New project, voltage-divider demo, nine workspace cards, engine information/table | Navigation and project actions functional; engine table previously misleading | External entries changed from “connector” to unavailable/unsupported without detection evidence |
| Circuit Lab | Select, component search/add/select/drag/edit/delete, grid, clear, run DC, signal inputs | Functional but limited | `src/app.js`, `src/engines/circuit-engine.js` |
| Circuit Lab canvas | Inferred wire drawing, Fit, zoom −/+, component geometry | Wires are simulated from node names; Fit was fake success; zoom decorative | Fit/zoom disabled; real graph editing is Phase 3 |
| Circuit results | result tab, Problems tab, node values, power, meter, signal preview | Results are real for the limited solver; tabs are decorative; preview is generated, not measured | Signal display relabeled; waveform instruments are Phase 4 |
| Embedded Lab | editor, structure check, project tree, build, board change, device access, output clear | Editor and shallow structure check functional; remaining controls unavailable/decorative | Build/board/device and decorative tree/output actions disabled; Phase 5 |
| PCB Studio | save, run, starter steps, default statistics | Preview only | Disabled and labeled unavailable; Phase 7 |
| FPGA & Digital | save, run, starter steps, target statistics | Preview only | Disabled and labeled unavailable; Phase 6 |
| Signals & DSP | save, run, starter steps, sample/rate/window statistics | Preview only | Disabled and labeled unavailable; Phase 8 |
| Communication | save, run, starter steps, modulation/SNR/rate statistics | Preview only | Disabled and labeled unavailable; Phase 9 |
| RF & Antennas | save, run, starter steps, frequency/impedance/VSWR statistics | Preview only; displayed values are defaults, not computed results | Disabled and labeled unavailable; Phase 10 |
| IoT & Control | save, run, starter steps, device/broker/message statistics | Preview only | Disabled and labeled unavailable; Phase 11 |
| Networks | save, run, starter steps, nodes/links/packet statistics | Preview only | Disabled and labeled unavailable; Phase 11 |
| Learning Hub | Resume, six tracks, progress, start/continue | Decorative catalog with invented progress in the original alpha | Actions disabled and progress reset; Phase 12 |
| Modal layer | Help, engine explanation, command palette, close/done | Functional, but focus is not trapped or restored | Accessibility gap for Phase 13, with earlier remediation encouraged |

Secondary presentational controls such as schematic/result tabs, project-tree rows, editor tabs, output clear, and zoom are not primary operations and had no behavior. They are now disabled where they look actionable. The authoritative per-capability detail is the machine-readable ledger.

## Data model inventory

| Model | Location | Current shape and risk | Target / phase |
|---|---|---|---|
| Project v1 | `src/core/project.js` | One JSON object containing circuit, firmware, notes, and UI settings. Validation checks only format, version, and component array. Serialization changes `updatedAt`. | Published schemas, pure migrations, backups, safe archives in Phase 1 |
| Application state | `src/core/store.js` | Module/selection/panel, project, latest simulation and toast; one localStorage key | Typed services and command history in Phase 1 |
| Circuit component | `src/core/project.js` | `id`, type, label, numeric value/unit, two node names, x/y | Versioned component definitions and graph model in Phase 3 |
| Circuit result | `src/engines/circuit-engine.js` | nodes, branch currents, total resistor power, string warnings | Common diagnostic/result schemas in Phases 1 and 4 |
| Generated signal | `src/engines/circuit-engine.js` | shape/frequency/amplitude/offset sampled into `{t,v}` | Waveform result schema in Phase 4 |
| Engine entry | `src/core/engine-registry.js` | Static metadata; no discovery, version, path, self-test, or capability probe | Typed manifests Phase 1; read-only discovery Phase 2 |
| Module/lesson catalog | `src/data/modules.js` | UI metadata and planned lesson counts only | Lesson schema and real checkpoints in Phase 12 |

No job, diagnostic, artifact, reproducibility, document registry, engine manifest, lesson, command-history, permission, or generated-run model exists.

## Test inventory and baseline evidence

The original suite contained four Node tests in `tests/circuit.test.mjs`:

1. analytic 9 V divider success;
2. missing-source failure;
3. bounded square-wave samples;
4. project JSON round trip.

Before edits, `npm run check` passed and `npm test` passed 4/4 on Node 22.20.0 and npm 10.9.3. There was no formatter, linter, static type checker, browser end-to-end suite, accessibility test, security test, cancellation test, or performance test. Phase 0 adds dependency-free quality gates and ledger/verification tests; the `typecheck` command checks alpha runtime structures only. It is not a substitute for strict TypeScript, which remains Phase 1 work.

Cancellation is not applicable to current product operations because the browser alpha owns no background jobs or child processes. Job cancellation begins in Phase 2 and must not be inferred from this baseline.

## Target-architecture gap map

| Target boundary | Current mapping | Gap / resolving phase |
|---|---|---|
| `apps/desktop`, `apps/web-preview` | root `index.html`, `src/app.js` | No desktop shell or split entry points; Phases 1–2 |
| `packages/ui` | monolithic template strings and `src/styles.css` | No typed accessible design system; incremental work Phases 1–3, release gate Phase 13 |
| `packages/project-model` | `src/core/project.js`, `store.js` | No schemas/migrations/backups/undo; Phase 1 |
| `packages/engine-sdk`, diagnostics, results | static registry and ad-hoc errors/results | Missing; Phase 1 |
| `packages/schematic`, waveform | app rendering and circuit engine | No canonical graph/ERC/netlist/viewer; Phases 3–4 |
| flowgraph/topology/learning packages | preview metadata only | Phases 9, 11, and 12 |
| Rust crates/native services | none | Phase 2 |
| Python worker | none | Phase 8 |
| schemas/toolchain manifests/examples/test layers | one v1 object and one test file | Phase 1 onward |

## Unsupported or overstated claims

| Claim in alpha | Audit finding | Resolution |
|---|---|---|
| “ten engineering workspaces” | The navigation contains 11 screens including Home and Learning, or nine specialist labs plus Circuit and Embedded. Counting is ambiguous. | Documentation corrected in Phase 0; information architecture continues in Phase 1 |
| “Schematic canvas” | Components can be positioned, but wires are inferred visually from shared node strings; there is no authored electrical graph. | Phase 3 |
| “Virtual multimeter, oscilloscope and signal-generator controls” | Meter reads a real limited DC result; the oscilloscope is only a generated signal preview. | Relabeled Phase 0; real result-backed instruments Phase 4 |
| “Embedded code lab” | Editing and shallow source validation work; no compilation or board toolchain exists. | Relabeled Phase 0; Phase 5 |
| “Engine registry” implying connectors | Registry is static metadata only and provides no detection evidence. | Honest unavailable states Phase 0; discovery Phase 2; adapters in domain phases |
| “keyboard-accessible interface” | Native buttons/inputs help, but drag-only movement, missing focus management, unlabeled icon reliance, and no formal keyboard test remain. | Baseline only Phase 0; Circuit keyboard flow Phase 3; WCAG gate Phase 13 |
| “100% local” | Current runtime uses local files/localStorage, but no privacy test or telemetry audit exists. | Phrase should mean local-by-default, not an audited percentage; Phase 13 review |
| “project-based curriculum” and progress | No lesson content, checkpoints, or progress store exists. | Disabled Phase 0; Phase 12 |

## Security and licence baseline

- The browser alpha starts no native processes and accesses no hardware.
- Project JSON is untrusted but only shallowly validated; import size, malicious nesting, prototype-shaped properties, and archive paths are untested. Phase 1 owns these controls.
- HTML interpolation uses `esc` for most project text. A complete DOM injection audit is not present.
- The local server normalizes paths and checks the normalized root prefix, but this is not a production security boundary.
- The project declares `GPL-3.0-or-later`. External engines are not bundled. Licence expressions in the registry are planning metadata and require exact-version review before distribution.
- The proposed stack/process/licence decision is recorded in `docs/decisions/0001-desktop-and-engine-boundary.md`.

## Performance baseline

No compliance or production performance claim is made. At audit time the app had 23 repository files before Phase 0 outputs, `src/app.js` was about 33 KB, and `src/styles.css` about 32 KB. The dependency-free local server returned the page and the Chrome UI rendered interactively on the audit host. There is no instrumented startup budget, large-project fixture, memory profile, waveform stress test, or lower-spec machine evidence. Reference-size and release budgets must be defined before Phases 3, 4, 11, and 13 claim responsiveness.

## Accessibility baseline

No WCAG conformance claim is made. Positive baseline evidence includes semantic buttons, a navigation label, a project-name accessible label, native form controls, a labelled dialog with focus trap/restore, scoped toast announcements, visible dark/light themes, reduced-motion handling, and visible `:focus-visible` indicators. Known gaps include disabled/placeholder controls in the original UI, drag-only component movement, no keyboard end-to-end test, some icon controls relying on titles, and uncertain contrast. Primary-flow WCAG 2.2 AA verification is a Phase 13 release gate.

## Phase 0 limitations

- The source was supplied as an extracted directory without `.git`; Git history and clean-checkout execution are not verified.
- Strict static type checking is unavailable without adding a compiler; Phase 0 performs syntax and runtime structural-contract checks only.
- The browser walkthrough sampled Mission control, Circuit Lab, DC execution, and Embedded Lab. Other screens share one renderer and were audited from source.
- No external executable was probed or represented as installed.
