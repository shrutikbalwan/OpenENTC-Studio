# Hosted CI readiness — 2026-09-29

The workflow at `.github/workflows/verify.yml` is syntactically parseable and now contains two jobs:

- `verify`: clean Windows and Ubuntu source verification (`npm ci`, `npm run verify`)
- `desktop-linux-build`: Ubuntu Tauri dependencies (including FUSE support), Rust setup, `npm ci`, `npm --prefix apps/desktop ci`, Tauri `deb`/`AppImage` packaging, and package/binary artifact upload
- The Linux job now also inspects Debian metadata/content, confirms the AppImage ELF type, extracts the AppImage and checks for the executable payload before upload.

Local checks:

- Python YAML parser accepted `.github/workflows/verify.yml`.
- The repository verification gate passed: 378 tests, 370 passed, 0 failed, 8 skipped.
- The isolated Ubuntu source verification and Linux unbundled Tauri build passed independently.
- The repository now exposes `npm --prefix apps/desktop run build:linux-bundles` for the same package-producing path used by CI; that path also produced local `.deb` and `.AppImage` artifacts in Ubuntu WSL (see [Linux package evidence](linux-packaging-build-2026-09-29.md)).

Status: **not hosted-verified**. This extracted workspace has no authenticated GitHub Actions run evidence. A push or pull request in the project’s hosted repository must complete both jobs before the hosted-CI phase gate changes to `Pass`.
