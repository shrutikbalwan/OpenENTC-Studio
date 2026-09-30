# Windows development-build evidence — 2026-09-29

Scope: local Windows x64 development build. This is not clean-machine, Linux, signed-release, hardware, or hosted-CI evidence.

Toolchain: Cargo 1.98.1, rustc 1.98.1, Tauri 2.12.0, Node.js 22.20.0 and npm 10.9.3.

## Commands and results

- `cargo test --lib`: PASS — 39 passed, 0 failed, 4 helper entry points ignored.
- `npm --prefix apps/desktop run build:installer` with the Rustup Cargo bin directory on `PATH`: PASS — optimized Tauri executable and unsigned NSIS installer produced.
- Elevated local launch smoke: PASS — the rebuilt executable remained responsive as a Windows process for the observation window; the process was then closed. The non-elevated sandbox launch reports `Access is denied`, so this is not clean-machine or normal-user evidence.
- Isolated installer smoke: PASS — the unsigned NSIS installer installed into a dedicated workspace directory, produced `openentc-studio.exe` and `uninstall.exe`, the installed executable launched for observation, and the matching silent uninstaller removed the isolated target with exit code 0.
- Same-version reinstall smoke: PASS — rerunning the installer with the valid NSIS `/D=path` syntax returned exit code 0 over an existing isolated install, preserved an unrelated user marker, and the matching uninstaller returned exit code 0. The marker was then removed during test cleanup; this is not clean-machine upgrade evidence.
- Browser `npm run verify`: PASS — 378 tests, 370 passed, 0 failed and 8 optional-runtime skips.

## Artifacts

Current follow-up probes: a direct noninteractive launch can return exit code `101` with WebView2 `0x800700AA`, while the bounded elevated `npm run desktop:launch-smoke` observation kept the current executable alive for 10 seconds with no stderr. This context difference is recorded explicitly; normal-user desktop-shell UI and engine-run qualification remain open.

- `apps/desktop/src-tauri/target/release/openentc-studio.exe`
- SHA-256: `15FA7970E0061E8D7623D6C0BF4A00C53B1B6BB850242097CBD3E252416BC14A`
- `apps/desktop/src-tauri/target/release/bundle/nsis/OpenENTC Studio_0.1.0_x64-setup.exe`
- SHA-256: `57D4E6FB02D53330D2BA2EF0985CC59C282A7F9EAA2FA1505091342897DCF0A7`
  - Signature status: `NotSigned`

## Qualification still required

Latest artifact refresh: `npm run desktop:installer` completed successfully after the WebView2 configuration update. The current hashes in this document and the release manifest were verified by `npm run release:verify`; the installer remains unsigned development output.

The refreshed icon-configured installer was independently smoke-tested again: silent install exit `0`, installed executable and uninstaller present, executable stayed alive for a 3-second observation, silent uninstall exit `0`, and the isolated target directory was removed. This remains local development evidence, not clean-machine certification.

Clean-machine install/launch/upgrade/uninstall, Linux packaging, desktop end-to-end engine runs, accessibility/performance qualification, licence review, hosted Actions execution, signing and release approval remain open. The isolated installer smoke is local development evidence only.
