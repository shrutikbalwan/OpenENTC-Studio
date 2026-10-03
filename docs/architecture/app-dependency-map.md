# `src/app.js` dependency map and extraction plan

Status: Phase 0 analysis. No code has moved yet. The raw data is in
[`app-dependency-map.generated.md`](app-dependency-map.generated.md); regenerate it with
`npm run deps:map` after every extraction to track progress.

## How the UI works today

```
store (src/core/store.js) ──subscribe──▶ render()
                                           │  app.innerHTML = shell + renderWorkspace(state, active) + renderAssistant()
                                           │  renderWorkspace → one of 44 render<Module>() functions (string templates)
                                           ▼
                                        bindEvents()
                                           │  shell listeners (nav, theme, import/export, desktop open/save, help, palette)
                                           │  then calls all 44 bind<Module>Events(); each queries its own [data-*] elements
                                           ▼
                           handlers call setState / updateProject / module-level lab objects
                           → store notifies → render() again
```

- **Data-action contract.** The DOM is the interface between renderers and binders, using `data-module`,
  `data-action`, `data-field`, `data-<lab>` and `data-ai-*` attributes. Tests and the e2e probe rely
  on these names, so extraction must keep them unchanged.
- **Module-level state.** 272 top-level `const`/`let` bindings: constants, lab objects created by
  `makeLab()` (one per laboratory), MCU/Uno runtimes, serial sessions, timers and the wire-editing
  cursor (`wireSource`, `selectedWire`, clipboards). This state lives outside the store, so moving a
  workspace means moving its lab object with it, or into `src/state/`.

## Categories (top-level declarations)

| Category | Count | Bytes | Notes |
|---|---|---|---|
| render | 167 | 519 KB | string-template renderers; the bulk of the file |
| event | 65 | 126 KB | `bind*Events` and handlers |
| native-bridge | 35 | 98 KB | desktop bridge, ngspice/Arduino/HDL runners, serial, permission grants; includes `render`, `renderCircuit`, `renderEmbedded`, `renderDigital`, `renderToolchains` because they read `desktopBridge.available` |
| helper | 114 | 90 KB | formatting, plotting, parsing, lab helpers |
| module state / constants | 272 | 66 KB | see above |
| state mutation | 50 | 26 KB | functions that call `setState`/`updateProject`/`recordExperiment` |
| persistence | 4 (+4 that also render or bind) | — | `saveBrowserProject`, `exportProject`, assistant settings, Learning Hub progress |

## Shared building blocks (most-referenced declarations)

These must move **first**, into `src/components/` and `src/shared/`, because almost every workspace
uses them. Moving them is mechanical: they are pure string builders or formatters.

| Declaration | Used by | Target |
|---|---|---|
| `fmt`, `eng`, `ohms`, `fraction` | 94, 67, 9, 8 | `src/shared/formatting.js` |
| `readout`, `comparisonRow`, `comparisonTable`, `simpleTable` | 58, 8, 8, 8 | `src/components/tables/` |
| `PLOT_COLORS`, `renderPlotFrame`, `linePlot`, `rect`, `lines`, `renderComplexPlane` | 52, 30, 23, 21, 14, 8 | `src/components/plots/` |
| `pageHeader`, `labTabs`, `labCard`, `labError` | 48, 21, 8, 13 | `src/components/` (layout, errors) |
| `labSelect`, `groupField`, `engineeringInput`, `makeLab`, `bindLabControls` | 39, 23, 16, 28, 22 | `src/components/forms/` and `src/controllers/lab-controls.js` |
| `esc`, `safeUrl`, `formatAssistantText` | (already in `src/core/html.js`) | re-export from `src/shared/escaping.js` |

## Coupling by workspace

"Exclusive" declarations are reachable only from that workspace's renderer, so they can move with
it. "Shared" ones are reachable from several workspaces or from the shell. Figures are from the
generated map and are approximate (textual identifier matching).

| Lowest coupling (start here) | Exclusive / shared | Highest coupling (do last) | Exclusive / shared |
|---|---|---|---|
| logic (`renderLogic`) | 11 / 2 | circuit (`renderCircuit`) | 22 / 12, plus wires, canvas, native ngspice |
| learn (`renderLearningHub`) | 9 / 4 | mcu (`renderMcu`) | 28 / 10, plus runtimes, timers, serial |
| fpga (`renderDigital`) | 7 / 5, native HDL | communication | 23 / 13 |
| pcb (`renderPcb`) | 8 / 7 | measure, em, info, sigsys | 9–15 / 19–23 |
| power (`renderPower`) | 16 / 9 | record (`renderRecords`) | 6 / 17; reads results from many labs |
| console (`renderConsole`) | 7 / 9 | home, shell, assistant | shell-owned |

## Extraction order for Phase 2

Each step is one reviewable commit with `npm run verify` and the browser checks green.

1. `src/shared/` (escaping re-export, formatting, input parsing) and `src/components/`
   (tables, plots, forms, layout, errors), with unit tests. `app.js` imports them back, so behaviour is unchanged.
2. A dependency-cycle check over `src/` (extend `scripts/app-dependency-map.mjs` `findCycles` to
   file imports) and an unused-export check, both wired into `npm run verify`.
3. Low-coupling workspaces, one per commit: logic → learn → pcb → power → console → vlsi/rtos →
   the Phase 9 calculator labs (machines, product, radar, speech, analog, info, measure) →
   signals (dsp, sigsys) → control (iot) → rf/em → communication → crypto/dip/biomed/neural/wsn/sdr/cellular.
   Each workspace gets `src/workspaces/<area>/<module>.js` exporting `render<Module>(state)` and
   `bind<Module>Events(ctx)`, and owns its lab object.
4. Native-bridge workspaces after `src/services/native/` exists: toolchains, fpga, embedded, twin.
5. Records, bench and fault hunt, which read other labs' results through a small `src/services/results.js`.
6. Circuit and MCU last, with wire-editing and runtime state moved to `src/state/`.
7. The shell (`src/shell/app-shell.js`, `navigation.js`, `command-palette.js`, `status-bar.js`) and the
   assistant panel. `app.js` becomes the composition layer.

## Risks

- **Hidden coupling through module-level state.** Some binders read lab objects owned by another
  workspace (sensors and EV share `bindSensorEvents`; vlsi and rtos share a binder). Move those pairs together.
- **Full re-render on every change.** Extraction does not change this. A later change could
  render only the active workspace, but that is a behaviour change and is out of scope for Phase 2.
- **The textual analysis can mislead.** Confirm each move with `node --check`, the full test
  suite and the browser probe that opens all 43 modules.
