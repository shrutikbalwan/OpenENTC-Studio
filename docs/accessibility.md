# Accessibility

**This is not a WCAG conformance claim.** OpenENTC Studio aims for WCAG 2.2 level AA. Automated
tools find only part of the problems. No screen-reader study, manual expert audit or test with
disabled users has been done yet.

## What is checked automatically

`tests/e2e/accessibility.e2e.mjs` runs in CI (`browser-e2e` job):

| Check | Scope |
|---|---|
| axe-core 4.13.0, WCAG 2.0/2.1/2.2 A and AA rules | Home and all 43 modules (default view), in the dark and light themes; the command palette, the help dialog and the AI assistant settings |
| Text alternatives | Every `svg`, `canvas` and `img` either has a text alternative (`role="img"` and `aria-label`, or `alt`) or is marked decorative (`aria-hidden`) |
| Skip link | The first Tab reaches "Skip to the lab", which moves focus to the workspace |
| Reflow (WCAG 1.4.10) | No module scrolls sideways at 390 px and 768 px wide |

`tests/e2e/shell.e2e.mjs` covers keyboard-only use (Tab to a module, Enter, command palette with focus trap and Escape, arrow-key part movement and undo), both themes, and a phone-width screen.

## Fixed in the 2026-10-04 audit

The first axe run found these problems:

- light-theme contrast failures on 166 elements in 35 modules (module accent colours drawn as text on white);
- unlabelled code editors, the logic-analyser selects and the RTOS task table;
- low-contrast meter captions;
- nested interactive controls on circuit parts;
- several charts with no text alternative, including the Signals (DSP) plots.

All of them are fixed. In the light theme, accent-coloured text is now darkened to keep at least 4.5:1 contrast.

## Known exceptions and gaps

- **Circuit pins** are 10 px targets placed 11 px apart on transistors, which is below the 24 px target size in WCAG 2.5.8. The pins are excluded from the axe target-size rule. The criterion's "equivalent" exception applies: the inspector's wire buttons connect the same terminals with full-size controls.
- **Only the default view of each module is scanned.** Other tabs, results panels and error states are not all covered automatically.
- **Charts have a short text alternative (their title), not a data table.** Students who cannot see a plot get the numeric readouts shown beside most plots, but not every plot has one.
- **The circuit canvas** can be used with the keyboard (select, move with arrows, connect through the inspector), but screen-reader announcement of wiring changes has not been tested.
- **No tests yet** with NVDA, JAWS, VoiceOver or TalkBack, with Windows high-contrast mode, or at 200 % and 400 % zoom on the desktop app.

## Reporting a problem

Use the **Accessibility** issue form. Say which module, browser and assistive technology you use.
