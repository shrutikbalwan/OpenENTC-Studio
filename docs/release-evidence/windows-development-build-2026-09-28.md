# Windows development-build evidence — 2026-09-28

Scope: local Windows x64 implementation verification. This is not clean-machine, signed-release, Linux, or external-engine evidence.

## Toolchain

- Node.js 22.20.0
- npm 10.9.3
- TypeScript 5.9.2 (repository-local)
- Cargo 1.98.1
- rustc 1.98.1
- Tauri CLI 2.12.0
- Tauri dialog plugin 2.8.0

## Passing gates

- `npm run verify`: PASS — format, lint, strict TypeScript across 70 files, Python worker syntax, browser production build, and 375 tests (369 passed, 0 failed, 6 optional-runtime skips).
- `cargo test --lib`: PASS — 38 passed, 0 failed, 4 ignored helper entry points. Coverage includes exact device grants, bounded native serial sessions, content-addressed adoption/readback of generated artifacts, real Unicode-path project persistence, project-confined processes, output capture, timeout and Windows Job Object-backed tree cancellation.
- `npm run desktop:check`: PASS — unbundled release executable produced.
- `npm run desktop:installer`: PASS — unsigned NSIS development installer produced.

## Artifacts

- `apps/desktop/src-tauri/target/release/openentc-studio.exe`
  - SHA-256: `AE5D611AB6804190D09981D3D67687FA00CDEC5E298323750FE4D115A83647B2`
- `apps/desktop/src-tauri/target/release/bundle/nsis/OpenENTC Studio_0.1.0_x64-setup.exe`
  - SHA-256: `DB9FA734E073D356C50AC38DB96A57E44DCE0F3C5F12C18BF13CCD499784F7E4`
  - Signature status: `NotSigned`

## Remaining qualification

- Install, launch, upgrade, and uninstall on a clean Windows machine.
- Build and smoke-test on the supported Linux baseline.
- Complete accessibility, performance, licence, SBOM, signing, and release-approval gates.
- Verify each optional engineering engine separately before changing its unavailable state.
- Arduino CLI is not installed and no serial target is authorized on this host. Inventory, compile, target-authorized upload, upload cancellation and bounded serial-terminal workflows have contract/native-build/rendered-UI evidence but no real reference-sketch, cancellation-against-hardware or hardware-I/O evidence. No attached-device discovery or package installation occurs.
- GHDL 6.0.0, Arduino CLI 1.5.1, Verilator 5.053, Yosys 0.69 and nextpnr-ice40 0.11.1 are installed locally, but project end-to-end outputs are not yet verified. ngspice and FPGA hardware remain unavailable. Project-scoped cancellable lint, staged simulation/generated-VCD import, synthesis/netlist registration and constrained HX8K/CT256 place-route have contract/UI/native-boundary evidence only; real engine outputs remain unverified.
