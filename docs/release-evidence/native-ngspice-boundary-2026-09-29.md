# Native ngspice process-boundary evidence — 2026-09-29

The opt-in Rust test `process_runner::tests::opt_in_real_ngspice_runs_through_native_process_runner` was executed with:

```text
OPENENTC_NGSPICE=C:\Users\shrut\AppData\Local\Programs\ngspice\bin\ngspice.exe
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib
```

Result: **39 passed, 0 failed, 4 ignored**.

The test starts the real ngspice executable through the native bounded process runner, writes a project-scoped resistor-divider netlist, captures the generated report, and verifies `v(out) = 4.5 V`. This is native process-boundary evidence, not a claim that the Tauri GUI was driven end-to-end under a normal interactive desktop session; that shell/UI gate remains open.
