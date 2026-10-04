# Threat model

Scope: the browser app (`index.html`, `src/`, `packages/`), the installable offline web app
(`sw.js`), and the Tauri desktop shell (`apps/desktop/src-tauri`). Status: maintained by the
project; **not independently reviewed**. Review again whenever a new trust boundary, native
command, file format or network destination is added.

## Assets

| Asset | Why it matters |
|---|---|
| Student projects (circuits, code, notes, lab inputs) | Coursework; may contain names or personal notes. |
| AI provider API key | Costs money if stolen; personal credential. |
| The user's computer (desktop app) | Native processes, files and serial/USB devices. |
| Connected hardware | A wrong upload or serial write can damage a board or circuit. |
| Diagnostic reports | Shared in public issues; must not leak the above. |

## Trust boundaries and untrusted inputs

| Boundary | Untrusted input | Controls | Tests |
|---|---|---|---|
| Project import (file, drag-and-drop, `localStorage`) | JSON project files, legacy files, corrupted storage | Size limit, schema validation, no prototype keys, path confinement for artifacts, migration that never runs code; a rejected file leaves the open project unchanged | `tests/project-model.test.mjs`, `tests/property.test.mjs` (corruption fuzz), mutation check (size limit, `..` paths, migration) |
| Parsers | VCD, Touchstone, Intel HEX, PCAP/PCAPNG, Verilog, SPICE text, CSV | Bounded loops and sizes; errors are `Error` objects; no `eval` | `tests/property.test.mjs` (fuzz, time bound), per-parser unit tests |
| Rendering | Every string from a project, parser, serial port, external tool or AI reply | All markup through `esc()`/`safeUrl()`; strict CSP (no inline script, no `eval`, no remote scripts) | `tests/browser-security.test.mjs`, `tests/e2e/injection-probe.mjs`, mutation check (escaping) |
| AI assistant (network) | Model replies and tool-call arguments | See [ai-data-flow.md](ai-data-flow.md): consent, https-only base URL, no redirects/cookies/referrer, escaped replies, side-effect-free tools, argument size limits | `tests/assistant.test.mjs`, `tests/browser-security.test.mjs`, assistant e2e journey |
| Credentials | API key | Memory or `sessionStorage` only (opt-in); never `localStorage`, project files, exports or logs; legacy copy deleted | `tests/browser-security.test.mjs`, mutation check (consent) |
| Native processes (desktop) | Tool paths, arguments, working directories, tool output | Allow-listed executables found by discovery, argument arrays (no shell), shells/interpreters refused, canonical project-root confinement for cwd and path arguments, output limits, timeouts, whole process-tree cancellation, per-project execution grant | Rust unit tests in `process_runner.rs`, `job.rs`, `native_project.rs`; `tests/process-runner.test.mjs` (opt-in) |
| Device access (desktop) | Serial data, port names | Browser never gets device scopes; per-(permission, target) grants that expire (default one hour) and are revoked on project close; bounded serial buffers and chunk sizes | `tests/contracts.test.mjs`, mutation check (browser permissions); Rust `serial_transport.rs` tests |
| Artifact writes (desktop) | Generated file names | Separate artifact grant; writes confined to `runs/` and `build/` | Rust `artifact_store.rs` tests |
| Diagnostics export | Recent errors, environment | Allow-listed fields only (counts, not content), then redaction of keys, tokens, home/private paths, e-mail addresses and stack lines | `tests/errors.test.mjs` |
| Supply chain | npm and Cargo dependencies, GitHub Actions | No runtime npm dependencies; pinned dev dependencies; actions pinned to commit SHAs; Dependabot; CodeQL; `npm audit` and `cargo audit` in CI | `tests/governance.test.mjs` |
| Offline cache | Service worker cache | Same-origin precache list generated at build time; cache version bump on change | `tests/e2e/offline.e2e.mjs` |

## Threats considered (STRIDE summary)

- **Spoofing:** a malicious AI endpoint pretending to be a provider. Mitigation: the user types the base URL; https only; the key is sent only to that host (no redirects).
- **Tampering:** a crafted project or capture file. Mitigation: validation and bounded parsers; nothing in a project is executed. Projects never carry commands: native tools run only from the allow list with arguments the app builds.
- **Repudiation:** not a goal for a single-user teaching tool.
- **Information disclosure:** key or personal data leaking via storage, logs, errors, diagnostics or the AI. Mitigation: credential rules, redaction, explicit consent before lab data is sent to the AI.
- **Denial of service:** huge files or pathological inputs freezing the tab. Mitigation: size limits, fuzzed time bounds, output limits and timeouts for native tools.
- **Elevation of privilege:** a project or AI reply causing script execution or native process launch. Mitigation: escaping plus CSP; no shell; allow-listed executables; per-project grants.

## Known gaps

- No independent security review or penetration test has been performed.
- OS credential storage for the desktop app is not used yet (needs a reviewed native plugin).
- The desktop build is unsigned; users cannot verify its origin.
- Fuzzing is seeded and short (runs in the normal test suite); there is no long-running coverage-guided fuzzer.
