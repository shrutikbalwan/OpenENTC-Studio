# Development release manifest — 2026-09-29

This manifest describes locally produced development artifacts. It is not a signed production release.

| Artifact | SHA-256 | Verification |
| --- | --- | --- |
| Browser preview `dist/` | Recorded per-file in `dist/SHA256SUMS.txt` | `npm run verify` |
| Windows executable `apps/desktop/src-tauri/target/release/openentc-studio.exe` | `15FA7970E0061E8D7623D6C0BF4A00C53B1B6BB850242097CBD3E252416BC14A` | Current Cargo/Tauri release build with explicit WebView2 data directory and bundle icons |
| Windows NSIS installer `apps/desktop/src-tauri/target/release/bundle/nsis/OpenENTC Studio_0.1.0_x64-setup.exe` | `57D4E6FB02D53330D2BA2EF0985CC59C282A7F9EAA2FA1505091342897DCF0A7` | Current Tauri NSIS build with bundle icons; unsigned development artifact |
| Linux Debian package `apps/desktop/src-tauri/target/release/bundle/deb/OpenENTC Studio_0.1.0_amd64.deb` | `663BAA40C9CC5411DE12E05905D29AC6C6BE93D7A68EB3812638B6D804F38068` | Ubuntu WSL package build; clean-machine installation not certified |
| Linux AppImage `apps/desktop/src-tauri/target/release/bundle/appimage/OpenENTC Studio_0.1.0_amd64.AppImage` | `C90BC012FB9DE3F7D90E3D009B6EC1D6140C226EE4534BA9AE341598436ACAFE` | Ubuntu WSL package build; clean-machine/display compatibility not certified |

The browser artifact includes an SPDX 2.3 document, GPL licence text and third-party notice file. Native transitive licence review, clean-machine install/upgrade/uninstall, Linux packaging, signing and release approval remain open.
