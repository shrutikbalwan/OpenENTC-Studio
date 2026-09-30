# Linux Tauri build evidence — 2026-09-29

An isolated Ubuntu WSL checkout completed the Linux desktop native build.

Environment:

- Ubuntu WSL (isolated `/tmp/openentc-linux-desktop` checkout)
- Node.js 22.22.1, npm 9.2.0
- Rust/cargo/rustc 1.93.1
- Tauri CLI 2.12.0
- GTK/WebKit/AppIndicator development packages installed in the Ubuntu environment

Command:

```text
npm ci
npm --prefix apps/desktop ci
RUSTFLAGS='-A dead_code' npm --prefix apps/desktop run build:unbundled
```

Result:

```text
Finished `release` profile [optimized] target(s) in 6m 13s
Built application at: /tmp/openentc-linux-desktop/apps/desktop/src-tauri/target/release/openentc-studio
```

The `RUSTFLAGS` setting is a toolchain workaround for a Rust 1.93 dead-code-analysis compiler ICE encountered in the first attempt; it does not change runtime behavior. The first attempt failed in the compiler before project code generation, and the retry succeeded.

This is software build evidence for an unbundled Linux executable. It does not certify a Linux package, desktop integration, clean-machine install/upgrade/uninstall behavior, display-server compatibility, or hardware workflows. The WSL service became unavailable after the build session, so no post-build binary checksum was recorded.
