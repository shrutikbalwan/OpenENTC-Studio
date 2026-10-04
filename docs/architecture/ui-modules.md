# UI module architecture

Status: in force since Phase 2 of the modernization (2026-10-03). Before that, the whole browser
UI lived in one file, `src/app.js` (8,384 lines, 940 KB). It now has 67 lines and only composes the parts.

## Layers

```
src/app.js                 entry point: global listeners, start rendering, service worker
src/shell/                 app-shell (frame), navigation (routing), shell-events, home,
                           command-palette, assistant
src/workspaces/<area>/     one module per laboratory (42 files, 13 areas)
src/components/            tables, plots, Smith chart, forms, layout, dialogs (pure HTML builders)
src/controllers/           lab-controls: makeLab / bindLabControls / bindLabText
src/services/              render (re-render hook), desktop-project, project-io
src/state/                 circuit-editor, native-sessions (UI state outside the project)
src/shared/                escaping, formatting, parsing, simulation, experiments
src/core/                  store, project model facade, desktop bridge, views (unchanged)
packages/*                 domain engines: numerics, circuits, MCU, RF, … (unchanged)
```

Imports point **downwards only**:

```
app.js → shell → workspaces → components / controllers / services / state / shared → core → packages
```

A workspace never imports the shell or `app.js`. A workspace may import another workspace's
explicit exports when the product needs it: Lab Records reads Bench and MCU results, and the
Analog Design Studio loads circuits into the Circuit Lab. `npm run ui:check` (part of
`npm run verify`) fails on import cycles, unresolved or duplicate names, unused imports or locals,
and unused exports in these layers.

## Workspace contract

Each workspace module exports:

- `render<Module>(state) → string`: HTML for the workspace pane. Project data is always escaped with
  `esc()` from `src/shared/escaping.js`.
- `bind<Module>Events()`: attaches listeners after every render. It must do nothing when its
  elements are absent (all binders run on every render).
- Occasionally named data for another workspace, documented in the module header.

The `data-*` attribute names are the contract between a renderer and its binder, and tests and the
e2e probes depend on them. Renaming one is a breaking change.

Workspace areas: `circuit` (circuit, analog, bench, faulthunt, theory), `electrical` (power, adc,
sensors-ev, machines, measure, product), `signals` (dsp, sigsys, speech, dip, biomed), `control`
(control, plc), `communication` (communication, info, network, cellular, wsn, sdr, crypto), `rf`
(rf, em, radar), `digital` (logic, fpga, hdl-toolchain, vlsi-rtos), `embedded` (mcu, embedded,
twin), `pcb`, `records`, `toolchains`, `learning` (learning-hub, neural, console), `tools` (calculators).

## Rendering model (unchanged)

The store notifies → `render()` (shell) rebuilds the page with `innerHTML` → `bindEvents()`
re-attaches the shell listeners and every workspace binder. Code that changes state outside the
store calls `rerender()` from `src/services/render.js`. Phase 2 did not change this model; it only
moved code.

## How the move was verified

- `scripts/refactor-move.mjs` moved declarations verbatim. It resolves references with the
  TypeScript checker and refuses any move that would import back from the source module.
- `tests/e2e/ui-sweep.mjs --compare`: the rendered HTML of every module and tab (180 views, with
  the clock and randomness pinned) was hashed before the first move and compared after each batch.
  Every deterministic view was byte-identical. Views that change on their own (running simulations)
  are detected and reported as "live".
- `npm run verify`, the injection probe, the quick start (Run DC → 6 V) and the API-key flow passed
  after the final move.

## Known limits and next steps

- **Rendering and events share a file.** Each workspace keeps both in one module. Splitting them
  further, or rendering only the active workspace instead of the whole page, is a behaviour change
  left for later.
- **Large workspaces.** The biggest are `circuit/circuit.js` (89 KB), `embedded/mcu.js` (64 KB),
  `embedded/embedded.js` and `communication/communication.js` (about 40 KB each). They are the next
  candidates to split by tab.
- **Type checking.** `checkJs` is not yet enabled for these files (Phase 3).
