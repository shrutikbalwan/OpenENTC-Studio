# Support matrix

What OpenENTC Studio 0.1 (unreleased alpha) runs on, and how well each combination is verified.
"Verified" means an automated or recorded check exists; it does **not** mean certified or qualified.

Status words used below:

| Word | Meaning |
|---|---|
| **Tested in CI** | Runs on every pull request in GitHub Actions |
| **Tested locally** | Verified by a maintainer and recorded in `docs/release-evidence/` or `docs/modernization-baseline.md`; not repeated automatically |
| **Expected to work** | No known blocker, but no recorded test |
| **Unsupported** | Not intended to work; problems will not be fixed for this release |
| **Pending** | Planned qualification not yet done |

## Node.js (development and build only)

| Version | Status |
|---|---|
| 22.8.0 or newer (`engines` in `package.json`) | Required. CI uses Node 22; the baseline used 22.22.2. |
| 20.x and older | Unsupported: `engines` requires 22.8.0 or newer, and older versions are not tested |

The browser app itself has no Node.js or runtime npm dependency.

## Browser app

| Browser | Status |
|---|---|
| Chromium-based (Chrome, Edge), current | Tested locally: headless Chromium 141 in `browser:smoke` and the e2e probes. Browser workflows in CI are pending (Phase 4/10). |
| Firefox, current | Expected to work; not tested |
| Safari, current | Expected to work except Web Serial (not available in Safari); not tested |
| Mobile browsers | Expected to load; narrow-screen layouts are not yet verified (Phase 8) |
| Web Serial (Real + Virtual Bench) | Chromium only; tested with a mocked port, **no physical-board evidence** |
| Offline use (service worker) | Tested locally in Chromium |

## Operating systems

| OS | Browser app | Desktop app |
|---|---|---|
| Windows 10/11 x64 | Tested in CI (verify job) | Unsigned development build and NSIS installer built locally (`docs/release-evidence/windows-development-build-2026-09-29.md`). Clean-machine install: **pending**. Signing: **pending**. |
| Linux x64 (Ubuntu 22.04+) | Tested in CI | `.deb` and AppImage built locally (`docs/release-evidence/linux-packaging-build-2026-09-29.md`). Install/upgrade/uninstall on a clean machine: **pending**. |
| macOS | Expected to work | Unsupported in 0.1 (no build or test) |

## External tools (desktop app only)

The browser app never runs external programs. In the desktop app, an external tool is used only
when the user installs it, OpenENTC detects a reviewed version in an approved location, and the user
grants permission for the open project.

| Tool | State in 0.1 | Evidence |
|---|---|---|
| ngspice | Integrated (desktop, opt-in) | Opt-in tests pass with ngspice-42 in the baseline container; not run in CI |
| Arduino CLI | Integrated (desktop, opt-in) | Version smoke recorded earlier; compile/upload need a real board: **pending** |
| GHDL, Verilator, Yosys, nextpnr-ice40 | Integrated (desktop, opt-in) | `hdl:smoke` passes with GHDL 4.1.0, Verilator 5.020, Yosys 0.33, nextpnr 0.6 in the baseline container; not run in CI |
| KiCad, PlatformIO, Renode, GNU Radio, Wireshark | Unavailable (catalogued only) | — |
| simavr, GNU Octave | Unsupported as runtime engines (simavr was used only to generate reference fixtures) | — |

## Hardware

| Device | Status |
|---|---|
| Arduino Uno over USB (Real + Virtual Bench, upload, serial) | **Pending**: no physical-board evidence |
| FPGA boards, programmers | **Pending**: no physical-board evidence |

The full per-capability state is in [`capabilities/ledger.json`](../capabilities/ledger.json).
