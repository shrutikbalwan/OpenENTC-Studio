# Browser journeys (end-to-end tests)

`npm run test:e2e` builds the app and runs `tests/e2e/*.e2e.mjs` with Node's test runner and
Playwright (`playwright-core`) in Chromium. CI runs the same command in the `browser-e2e` job of
`.github/workflows/verify.yml` on every push and pull request. A failing journey fails the job, and
its trace and screenshot are uploaded as the `e2e-failure-traces` artifact.

## How the tests are made deterministic

- The built `dist/` folder is served on an ephemeral `127.0.0.1` port (`createStaticServer` in
  `scripts/server.mjs`), so the tests exercise what ships.
- Each test gets a fresh browser profile. `Math.random` is seeded; time zone and locale are fixed.
- **No network:** every request to another origin is aborted. The assistant tests route only the fake
  origin `https://llm.mock.test`. No secrets or public APIs are used.
- Traces and screenshots are written to `test-results/e2e/` **only when a test fails**.

## Running locally

```bash
npx playwright-core install chromium   # once; or set OPENENTC_CHROME=/path/to/chrome
npm run test:e2e
```

When running as root (containers), the harness adds `--no-sandbox` automatically.

## Coverage of the required journeys

| # | Journey | Test (file › name) | What is checked |
|---|---|---|---|
| 1 | Application start-up | circuit › application starts… | Mission control, starter project, 40+ modules, no page errors |
| 2 | First-run onboarding | circuit › first run… | The starter project opens in Circuit Lab and the quick-start result is 6 V. **A guided onboarding flow does not exist yet (Phase 9).** |
| 3 | Create a voltage divider | circuit › build a voltage divider on an empty canvas… | parts added from the palette and wired by node names; stored project checked |
| 4 | DC simulation with expected result | same | V(mid) = 4 V, I(R1) = 800 µA (12 V, 10 kΩ/5 kΩ) |
| 5 | Edit and re-run | same | R2 = 10 kΩ → V(mid) = 6 V |
| 6 | Save and reopen | circuit › a saved project survives a reload… | name and R2 = 4.7 kΩ persist; V(out) = 9 V × 4.7/5.7 |
| 7 | Export and import `.entcproj` | project › export a packaged .entcproj… | ZIP download, re-import restores the project |
| 8 | Reject malformed or oversized projects | project › malformed and oversized files… | broken JSON, wrong shape, future version, not-a-ZIP, more than 10 MB; open project unchanged |
| 9 | Migrate an older project | project › an older (version 0) project… | migrated to version 1, data and settings kept, simulates correctly |
| 10 | Recover from corrupt or interrupted storage | project › corrupt stored project…, › interrupted write… | fresh project, corrupt backup kept, clear status; pending write recovered |
| 11 | Signals example | labs › Signals… | bin-aligned FFT peak = N/2 = 128; off-bin peak equals a direct DFT computed in the test |
| 12 | Control example | labs › Control… | first-order final value equals the gain |
| 13 | Digital Logic examples | labs › Digital Logic… | XOR minimal SOP/POS; consensus term removed |
| 14 | 8051 example | labs › 8051… | running lights assemble, run, and the LEDs change |
| 15 | Arduino simulation example | labs › Arduino Uno… | serial calculator: send 12, receive 144 and 1728 |
| 16 | PCB and fabrication package | labs › PCB Studio… | auto-place, auto-route, DRC; ZIP with copper, drill and BOM files |
| 17 | Lab-record PDF | labs › Lab Records… | valid PDF header and trailer |
| 18 | AI assistant with a mocked provider | assistant › assistant answers… | bearer header, no cookies, reply rendered as text, key not stored |
| 19 | AI timeout and invalid response | assistant › an invalid provider reply…, › a provider that never answers… | malformed JSON and 401 reported (key redacted); 60 s timeout via a fake clock; Stop works |
| 20 | Offline reload after installation | offline › after one visit… | real service worker; **server stopped**; fresh page loads and simulates |
| 21 | Keyboard-only navigation | shell › keyboard only… | Tab to a module and Enter; Ctrl+K palette with focus and Escape; arrow-key move and Ctrl+Z |
| 22 | Light and dark themes | shell › light and dark themes… | attribute and background change; choice persists |
| 23 | Narrow screen | shell › narrow phone screen… | 375 px: no horizontal scroll; navigation and Run DC usable |
| 24 | User-visible error recovery | shell › bad input is reported… | invalid text rejected with a hint; a model error shows a panel; Reset restores the example |

Phase 8 added `tests/e2e/accessibility.e2e.mjs` (7 tests): axe-core on every module in both themes and in dialogs, text alternatives, the skip link, and reflow at 390 px and 768 px. See [../accessibility.md](../accessibility.md).

## What these tests do not cover

- Firefox, Safari and mobile browsers. Only Chromium runs.
- The desktop (Tauri) app and its native tools; those have separate opt-in smoke tests.
- Physical hardware (Web Serial with a real board).
- Visual design and real screen-reader output. Automated accessibility rules run (see above), but no assistive technology is driven.

## Findings from writing these tests

1. **Legacy migration bug, fixed.** Projects saved before the `notes` field existed were rejected
   ("Project notes are invalid"). Both project models now add `notes: []` during migration.
2. **Offline bug, fixed.** Only six shell files were precached, so after a single visit the app
   could not start offline: its other modules had loaded before the service worker took control. The
   build now writes `precache.json` with every web asset, and the worker precaches it on install.
   Chromium's offline emulation does not block 127.0.0.1, so the test stops the server instead.
3. **Fixed in Phase 8.** The Signals plots had no accessible name. They now have `role="img"` and a label, like every other chart.
