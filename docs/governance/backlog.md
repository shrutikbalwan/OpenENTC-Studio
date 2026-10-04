# Backlog

Known work found during modernization, ordered by priority. Each item names where it came from.
Items move to GitHub issues when someone picks them up.

| # | Item | Why it matters | Source |
|---|---|---|---|
| 1 | Complete the external release gates (signing, clean machines, hardware, accessibility audit, expert review, licence review, pilot) | Required before any non-development release | `release/gates.json` |
| 2 | Type-check `src/workspaces` and `src/shell` | Most UI code has no type checking | Phase 3 known limitation |
| 3 | Axe scans for every lab tab and error state | Only default views are scanned | `docs/accessibility.md` |
| 4 | Data-table alternatives for key plots | Plots have only a short label | `docs/accessibility.md` |
| 5 | Browser (e2e) coverage measurement | 14 browser-only files count as 0 % | `docs/testing/test-categories.md` |
| 6 | A test that reaches the circuit non-convergence error | The message logic is covered only by review | Phase 7 |
| 7 | Render only the active lab | The full page re-renders on each change | `docs/architecture/ui-modules.md` |
| 8 | Target-size exception for circuit pins (WCAG 2.5.8) | Relies on the inspector as the equivalent control | `docs/accessibility.md` |
| 9 | OS credential storage for desktop API keys | Keys are memory- or session-only today | `SECURITY.md` |
| 10 | Upgrade off GTK3-based Tauri dependencies when possible | `cargo audit` warnings for `glib` 0.18 and `proc-macro-error` | Phase 6 |
| 11 | Long-running coverage-guided fuzzing of the parsers | The seeded fuzz tests are short | `docs/security/threat-model.md` |
| 12 | arduino-cli and kicad-cli in CI | Always reported unavailable | `docs/testing/ci.md` |
| 13 | Replace the CODEOWNERS placeholders with named reviewers | One person reviews everything today | `docs/maintainers.md` |
| 14 | Move GitHub Actions off Node 20 when new pinned versions are reviewed | Runner deprecation warning | hosted CI logs |
