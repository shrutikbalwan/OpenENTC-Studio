# Types and errors

Status: Phase 3 of the modernization (2026-10-03).

## How types are checked

`npm run typecheck` (part of `npm run verify`) runs the TypeScript compiler in strict mode over the
files listed in `tsconfig.json`. Two kinds of file are checked:

1. **Type-checked JavaScript (`// @ts-check` plus a `tsconfig.json` include):** the compiler checks
   the implementation itself against JSDoc types.
2. **Declaration contracts (`*.d.ts`):** these describe a module's public interface. The compiler
   checks that the declarations are consistent with each other. It does **not** prove that the `.js`
   implementation matches them; behaviour tests cover that.

## Critical boundaries

| Boundary | Implementation | Static types | Kind |
|---|---|---|---|
| Project schema and migrations | `packages/project-model/src/index.mjs`, `archive.mjs` | `types.d.ts`, `archive.d.mts`, `model.ts`, `schemas/project.schema.json`; `archive.mjs` type-checked | contract + checked |
| Browser project facade | `src/core/project.js`, `project-file.js` | type-checked JS + `.d.ts` | checked |
| Browser persistence | `src/core/project-storage.js`, `src/core/store.js` | type-checked JS + `.d.ts` | checked |
| Native bridge (Tauri commands) | `src/core/desktop-bridge.js` | `desktop-bridge.d.ts` | contract |
| Native engine runners | `src/core/desktop-engine-runner.js`, `desktop-process-adapter-runner.js` | `.d.ts` | contract |
| Process execution | `packages/process-runner` (Node) and `apps/desktop/src-tauri` (Rust) | `types.d.ts`; Rust types checked by `cargo` | contract + Rust |
| Serial and device permissions | `packages/device-bridge` | `index.d.ts` | contract |
| AI provider configuration | `packages/assistant`, `src/core/credentials.js` | `index.d.ts`, `credentials.d.ts` | contract |
| Simulation request/response | `src/engines/circuit-engine.js`, `packages/results`, `packages/engine-sdk` | `results/types.d.ts`, `engine-sdk/*.d.ts` | contract |
| Errors | `packages/errors` | type-checked JS + `index.d.ts` | checked |
| Shared UI layers | `src/shared`, `src/components`, `src/controllers`, `src/services`, `src/state` | type-checked JS | checked |

Every domain package declares its public interface. `docs/api/packages.md` is generated from the
packages and lists each one's purpose, declaration files and exports. A test fails if that file is
out of date or a package lacks a header or declarations.

**Not yet type-checked:** the workspace modules (`src/workspaces`, about 900 KB) and the shell.
They are covered by behaviour tests, the UI sweep and `ui:check`. Turning on `// @ts-check` for them
one by one is the remaining type-safety work.

## Error architecture (`packages/errors`)

| Class | Code | Base class kept for older callers | Typical source |
|---|---|---|---|
| `ValidationError` | `OPENENTC_VALIDATION` | `RangeError` | bad component value, out-of-range input |
| `ProjectFormatError` (and `ProjectError`) | `OPENENTC_PROJECT_FORMAT` (`PROJECT_*` codes kept) | `Error` | malformed, oversized or newer project files |
| `NumericalError` | `OPENENTC_NUMERICAL` | `Error` | singular circuit matrix |
| `ConvergenceError` | `OPENENTC_CONVERGENCE` | `Error` | Newton–Raphson did not converge |
| `PermissionError` | `OPENENTC_PERMISSION` | `Error` | a project-scoped grant is missing |
| `NativeToolError` | `OPENENTC_NATIVE_TOOL` (`DESKTOP_UNAVAILABLE` kept) | `Error` | desktop services or an engine failed |
| `TimeoutError` | `OPENENTC_TIMEOUT` | `RangeError` | a bounded job ran out of time |
| `StorageError` | `OPENENTC_STORAGE` | `Error` | a browser storage write could not be verified |

Each error carries:
- `code`: stable, machine-readable;
- `message`: safe to show the user;
- `location`: optional file/line/column or component id;
- `recovery`: what the user can do next;
- `context`: redacted when the error is created.

Existing codes and `instanceof` checks keep working.

Adopted so far:
- the circuit solver uses `ValidationError` (with the component as location), `NumericalError` and `ConvergenceError`;
- project files use `ProjectError`, which is a `ProjectFormatError`;
- the desktop bridge uses `NativeToolError`;
- browser storage uses `StorageError`.

Other engines still throw plain `Error` or `RangeError`. `toUserFacing()` handles those too.

## Presentation

- `toUserFacing(error)` turns any thrown value into `{ code, message, recovery?, location? }`. It
  never includes a stack trace, a secret or a private absolute path.
- `reportError(error, { prefix, fallback })` (`src/services/errors.js`) shows that message in the
  toast and keeps the last 20 errors in memory, redacted, for the diagnostics view planned in
  Phase 9. Every former `notify(error.message, 'error')` call site now uses it.
- `renderErrorPanel()` (`src/components/errors.js`) is the single in-lab error panel. Its markup is
  unchanged for plain errors; it adds the recovery hint when the error provides one.

## Redaction rules (`redactText`, `redactDiagnostic`)

They remove:
- bearer tokens and provider-style keys (`sk-…`, `AIza…`, `ghp_…`);
- `api_key=` / `token:` / `password=` values;
- exact secrets passed in;
- home-directory paths (shown as `<home>/…`) and temporary or system paths;
- stack-frame lines.

`redactDiagnostic` also drops keys named like secrets and bounds depth, array length and string size.

## What reaches user-visible exports

- Project exports (`.entcproj`) contain only the validated project. Credentials are never stored
  in projects (see `SECURITY.md`).
- Lab-record PDFs contain the user's own text and simulation results; no error objects are included.
- No error, stack trace or secret is written to any export. The future diagnostic export (Phase 9) must
  build its content with `redactDiagnostic` and `recentErrors()`.
