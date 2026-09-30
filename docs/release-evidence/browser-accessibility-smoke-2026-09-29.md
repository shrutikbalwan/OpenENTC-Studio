# Browser accessibility smoke evidence — 2026-09-29

Environment: local browser preview at `http://127.0.0.1:4173/`, inspected through Chrome accessibility state.

Observed:

- The page exposes a named `OpenENTC Studio` web area and an accessible module navigation region.
- Primary actions expose button names or descriptions, including open/save/import/export, theme, command palette and each engineering lab.
- The project-name control is exposed as a settable text field with its accessible description.
- `Ctrl+K` opens a labelled `Command palette` dialog with a `Close` button and named navigation actions.
- `Escape` closes the dialog and restores focus to the command-palette button.
- Keyboard `Tab` moves through the top-bar controls without requiring pointer input.

Status: `software-verified` accessibility smoke only. This does not certify WCAG 2.2 AA, contrast, screen-reader interoperability across platforms, browser-frame latency, or clean-machine performance.
