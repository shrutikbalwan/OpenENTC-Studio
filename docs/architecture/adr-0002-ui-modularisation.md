# ADR 0002: Split the UI monolith by moving code, not by rewriting it

- Status: accepted (2026-10-03)
- Context: Phase 2 of `docs/modernization-progress.md`

## Context

`src/app.js` held the shell, 44 workspace renderers and binders, the assistant, native-tool
orchestration and the modal system in 940 KB. Every change risked unrelated laboratories, and
review was impractical.

## Decision

1. **No framework.** We keep plain ES modules and string templates. A framework would mean
   rewriting all 43 modules and would add runtime dependencies, against the project's
   dependency policy.
2. **Move declarations verbatim** with a tool (`scripts/refactor-move.mjs`) instead of rewriting by
   hand. The tool resolves references with the TypeScript compiler (a pinned development dependency)
   and refuses moves that would create an import cycle.
3. **Shared pieces first, then the lowest-coupled workspaces, then the shell.** This was planned with
   `npm run deps:map` (`docs/architecture/app-dependency-map.md`).
4. **State that importers must reassign** (`let` bindings shared across modules) becomes properties of
   exported state objects in `src/state/`, because ES module bindings are read-only for importers.
5. **Re-rendering** goes through `src/services/render.js`, so workspaces never import the shell.
6. **Proof of behaviour preservation:** hash the rendered HTML of every view before and after each
   batch (`tests/e2e/ui-sweep.mjs`).
7. **Guard rails in `npm run verify`:** `ui:check` (cycles, name errors, unused code), workspace contract
   tests, and source-text tests that read the whole UI tree (`tests/helpers/ui-source.mjs`).

## Consequences

- `src/app.js` is a 67-line composition layer. Each workspace has one entry module.
- Module evaluation order changed: module-level lab objects are now created when their workspace
  module is imported, which is still before the first render. No view changed.
- Two source-text tests had matched strings that existed only in dead legacy code. They now check the
  live code. The dead code was removed.
- Rendering and event binding remain in the same workspace file, and the whole page still re-renders
  on every change. Those are separate, behaviour-changing decisions for later.
