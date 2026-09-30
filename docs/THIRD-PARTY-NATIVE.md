# Native third-party component record

This record covers direct Rust components linked into the OpenENTC Studio desktop executable. Exact resolved versions and transitive packages are pinned in `apps/desktop/src-tauri/Cargo.lock`. `npm run native:sbom` now emits a 437-package SPDX 2.3 dependency inventory at `dist/NATIVE-BUILD-SBOM.spdx.json` plus a 697-section notice candidate at `dist/NATIVE-THIRD-PARTY-NOTICES.txt`; on Windows it also detects the standard Rustup Cargo path when Cargo is not on `PATH`. Both remain generated candidates pending human licence-text, notice, security and release review.

| Component | Resolved version | SPDX licence | Source | Use |
|---|---:|---|---|---|
| serialport | 4.10.1 | MPL-2.0 | https://github.com/serialport/serialport-rs | Cross-platform blocking serial transport; built with default features disabled and no port enumeration |

The browser-preview artifact does not include this Rust library. Windows and Linux desktop artifacts link it into the native executable. The MPL-2.0 licence and upstream source must be included in the desktop release licence/SBOM review before a production release.

## Current review status (2026-09-29)

- Browser-preview SPDX output and third-party notice files are generated and verified by `npm run verify`.
- The native dependency record identifies `serialport` 4.10.1 and its MPL-2.0 source obligation.
- `npm run license:audit` currently reports 437 packages, zero unresolved generated SPDX declarations and 697 notice sections. This is an automated completeness check, not approval of licence compatibility, exact text, source offers or security.
- A complete transitive native SBOM, licence-text bundle, security review and release approval are still required before signing a production desktop release.
