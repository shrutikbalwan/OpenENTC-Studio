# Development guide

Commands for contributors and maintainers. For a first run, see the quick start in the
[README](../README.md).

## Commands

1. Install Node.js 22.8.0 or newer (the `engines` field in `package.json`).
2. In this folder, run `npm ci`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:4173`.

Create the reproducible browser-preview bundle with `npm run build`; it writes `dist/` with a versioned metadata file, SPDX SBOM, license/notices, SHA-256 manifest, and conventional `SHA256SUMS.txt`. Run `npm run release:prepare` to build the preview and regenerate the native Cargo SBOM/notice candidate together; `npm run license:audit` checks that every generated native package has a declared licence and that notices exist, while human legal/security review remains required. Run `npm run phase:status` to audit the authoritative phase matrix and evidence links. Run the complete baseline gate with `npm run verify`. Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run worker:check`, `npm test`, `npm run browser:smoke` (opt-in headless Chrome load/DOM smoke), `npm run native:sbom` (desktop Cargo SPDX inventory and notice candidate), and `npm run release:verify` (cross-artifact hash verification).

Build the Windows desktop executable with `npm run desktop:check`. Build the unsigned NSIS development installer with `npm run desktop:installer`; on Linux, `npm --prefix apps/desktop run build:linux-bundles` produces `deb` and `AppImage` packages when the Tauri Linux prerequisites are installed. Signing and clean-machine release qualification are intentionally separate release gates.

Linux package structure and local WSL lifecycle probes are available as `bash scripts/linux-deb-lifecycle-smoke.sh <package.deb>` and `bash scripts/linux-xvfb-smoke.sh <desktop-binary>`; they require a test Linux host with package mutation privileges and a virtual display, and do not replace clean-machine qualification.

Native tool versions can be checked without automatic discovery or installation using `npm run native:smoke`. Set absolute executable paths through `OPENENTC_NGSPICE`, `OPENENTC_ARDUINO_CLI`, `OPENENTC_VERILATOR`, `OPENENTC_GHDL`, `OPENENTC_YOSYS` and `OPENENTC_NEXTPNR_ICE40` before running it.

With `OPENENTC_NGSPICE` configured, run `npm run ngspice:integration` to exercise real version, operating-point, DC, AC and transient adapter workflows. This is software evidence only; physical circuits and desktop-shell UI execution remain separate gates.

Run the hardware-free HDL acceptance fixture with `npm run hdl:smoke`. It performs real GHDL analyze/elaborate/simulation, Verilator lint, Yosys JSON synthesis and a constraint-free nextpnr iCE40 dry-run when their executable paths are configured. The application’s board workflow still requires a board-specific PCF.

The repository pins TypeScript as a development dependency. The `typecheck` command validates the existing structural contracts and runs the strict compiler in-process against `tsconfig.json`, so verification fails on compiler diagnostics or when dependencies have not been installed.

## Roadmap

1. Complete desktop-shell qualification for the software-verified ngspice and Arduino CLI workflows, then add physical-board evidence where contributed.
2. Verify the Tauri shell and development installer on clean Windows and Linux machines.
3. Connect each verified engine adapter to native discovery and process execution only after its target-specific permission review.
4. Add MCU emulation and GNU Radio flowgraph exchange; extend native HDL qualification across supported engines.
5. Establish signed releases, component-library governance and reproducible builds.
