# Release-bundle verification — 2026-09-29

Command:

```text
npm run release:verify
```

The browser build preserves existing native SBOM/notice evidence in `dist/`; run `npm run native:sbom` once when the native dependency lockfile changes, then use this offline verifier. This keeps release verification usable on machines where Cargo is intentionally not on `PATH`.

Result: **passed**.

- 36 browser-preview files matched `BUILD-MANIFEST.json` and `SHA256SUMS.txt`.
- Native SPDX SBOM and native third-party notice hashes matched the recorded evidence.
- Windows executable hash matched the development release manifest.
- Windows NSIS installer hash matched the development release manifest.
- Linux Debian package hash matched the development release manifest.
- Linux AppImage hash matched the development release manifest.

This verifier checks integrity and provenance of locally produced development artifacts. It does not certify a signed release, clean-machine installation/upgrade/uninstall, hardware behavior, or human approval.
