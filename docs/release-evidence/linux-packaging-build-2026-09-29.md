# Linux packaging build evidence — 2026-09-29

Host: Ubuntu 22.04 under WSL2 after restarting the WSL service. Toolchain: Node.js 22.22.1, Cargo 1.93.1, rustc 1.93.1, Tauri CLI 2.12.0. The desktop workspace received a clean Linux `npm ci` so the platform-specific Tauri CLI binding was installed.

Command:

```text
RUSTFLAGS='-A dead_code' npm --prefix apps/desktop run build:linux-bundles
```

Result: **passed**. Tauri produced both requested Linux packages after the existing square PNG icons were declared explicitly in `apps/desktop/src-tauri/tauri.conf.json`.

| Package | Size | SHA-256 |
| --- | ---: | --- |
| `OpenENTC Studio_0.1.0_amd64.deb` | 3,617,072 bytes | `663BAA40C9CC5411DE12E05905D29AC6C6BE93D7A68EB3812638B6D804F38068` |
| `OpenENTC Studio_0.1.0_amd64.AppImage` | 87,022,072 bytes | `C90BC012FB9DE3F7D90E3D009B6EC1D6140C226EE4534BA9AE341598436ACAFE` |

This closes the local Linux package-build portion of the gate. It does not certify installation, upgrade, uninstall, display-server compatibility, clean-machine behavior, hosted CI, signing or physical hardware.

## Package inspection

- `dpkg-deb --info` reports package `open-entc-studio` version `0.1.0`, architecture `amd64`, and the expected GTK/WebKit dependencies.
- `dpkg-deb --contents` contains the executable, desktop entry and hicolor icon payload.
- `file` identifies the AppImage as a 64-bit Linux ELF executable.
- `--appimage-extract` completed successfully and contained an executable `squashfs-root/usr/bin/openentc-studio`.
- The AppImage runtime probes `--appimage-version` and `--appimage-help` returned successfully.

These checks validate package structure and payload presence only; they do not replace a clean Linux install/upgrade/uninstall run.

The repeatable lifecycle probe is `scripts/linux-deb-lifecycle-smoke.sh`. Run as Ubuntu WSL root, it passed package install (`0`), package presence verification (`0`), same-version reinstall (`0`), a bounded executable observation (`timeout 124` after remaining alive for the five-second bound), package removal (`0`) and post-removal absence (`1`, meaning `dpkg-query` found no package). The only launch output was a non-fatal DRI3 acceleration warning. This is WSL-local lifecycle evidence, not clean-machine certification.

The packaged native binary and the actual AppImage both passed `scripts/linux-xvfb-smoke.sh` under a virtual X display: each returned `launchStatus: 124` after the full 10-second bound, with only Mesa/Zink software-rendering warnings. This confirms bounded Linux desktop process liveness, not interactive engine execution or clean-machine display compatibility.
