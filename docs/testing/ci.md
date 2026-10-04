# Continuous integration

All jobs are in `.github/workflows/verify.yml` (plus CodeQL in `codeql.yml`). They run on every
push and pull request. Every action is pinned to a commit SHA, and checkouts do not keep
credentials.

| Job | Runner | What it proves |
|---|---|---|
| Verify (ubuntu-latest, windows-latest) | both | `npm run verify`: format, lint, typecheck, UI module checks, build, every unit test |
| Browser journeys (Chromium) | ubuntu | the journey, accessibility and onboarding tests in `tests/e2e`; failure traces are uploaded |
| Coverage and mutation checks | ubuntu | coverage thresholds per risk group, never lowered against `main`; 8 targeted mutants must be killed |
| Dependency audit (npm and Cargo) | ubuntu | `npm audit` for the workspace and the desktop shell, a pinned `cargo audit`, and the native SBOM plus licence audit (SBOM uploaded) |
| External tools | ubuntu-24.04 | installs ngspice 42, GHDL 4.1, Verilator 5.020, Yosys 0.33 and nextpnr-ice40 0.6, then runs `scripts/external-tools-report.mjs` |
| Windows desktop build (unsigned) | windows | Rust unit tests, then an unsigned NSIS installer (uploaded) |
| Linux desktop build | ubuntu | rustfmt, Rust unit tests, `.deb` and AppImage build and payload inspection |
| CodeQL | ubuntu | static analysis of the JavaScript |

## External-tool states

The external-tool report gives every check exactly one state:

- **passed:** the tool ran and its checks passed.
- **failed:** the tool ran and a check failed. This fails the job.
- **unavailable:** the tool was not installed or configured, so nothing ran. **This is not a pass.**
- **skipped:** the check exists but did not apply, for example on another platform.

The table appears in the job summary and is uploaded as `external-tools-report.json`. arduino-cli
and kicad-cli are not installed in CI, so they always report **unavailable**. Icarus Verilog is not
integrated with the product (the Verilog lab has its own simulator), so it is not checked.

## What CI does not prove

- The desktop builds are **unsigned**, and no clean-machine install test runs in CI.
- No physical hardware is connected. Serial, USB and programmer paths are tested with simulated devices only.
- Browser tests use Chromium only.
