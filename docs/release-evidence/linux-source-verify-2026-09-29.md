# Linux source verification — 2026-09-29

An isolated copy of the repository was created under Ubuntu WSL 2 with generated outputs, Windows dependencies and native targets excluded. The copy ran:

```text
npm ci
npm run verify
```

Toolchain: Node.js `v22.22.1`, npm `9.2.0`, Python `3.14.4`.

Result: **378 tests, 370 passed, 0 failed, 8 optional-runtime skips**. Format, lint, strict TypeScript, Python worker compilation and browser build all passed. The isolated copy was temporary and removed by the WSL environment.

This closes Linux source verification only. Linux Tauri packaging, clean-machine installation, upgrade and uninstall still require a Linux desktop packaging host or VM.
