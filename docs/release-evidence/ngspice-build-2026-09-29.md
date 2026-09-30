# ngspice source-build evidence — 2026-09-29

The checked-in `scripts/build-ngspice-msys2.sh` was run with the official ngspice source tree and the locally installed MSYS2 UCRT64 toolchain. The source build completed with exit code 0 and installed `ngspice.exe` and `ngnutmeg.exe` under the user-local ngspice prefix.

The build uses `--disable-xspice` because the optional XSpice IPC component is not portable to this MSYS2 environment. CIDER and OpenMP remain enabled. The console-capable rebuild completed with exit code 0. `npm run ngspice:smoke` then ran a deterministic 9 V / 1 kΩ / 1 kΩ divider in batch mode and completed successfully with `v(out) = 4.500000e+00`.

Status: `software-verified` for source compilation, installation and the bounded batch divider smoke. This does not certify every ngspice device model or physical circuit behavior.

The opt-in adapter integration test also passed with the same executable: 3 tests passed, 0 failed, 0 skipped. It covers real version-output parsing, a project-scoped operating-point divider run parsed as `v(out) = 4.5`, and successful DC, AC and transient table analyses.
