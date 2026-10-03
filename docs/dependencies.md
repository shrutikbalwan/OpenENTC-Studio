# Dependency register

OpenENTC Studio has **no runtime dependencies**: the browser app ships only its own code. The
packages below are development tools. Every entry is pinned to an exact version in
`package.json`/`package-lock.json` (lockfile integrity hashes) and is updated through Dependabot
pull requests reviewed like any other change (`CONTRIBUTING.md`).

| Package | Version | Licence (SPDX) | Purpose | Source and provenance | Security review |
|---|---|---|---|---|---|
| `typescript` | 5.9.2 | Apache-2.0 | `npm run typecheck`, `ui:check`, and the refactoring tools' syntax tree and type checker | npm registry; maintained by Microsoft (github.com/microsoft/TypeScript) | No install scripts; no network or native access at run time |
| `playwright-core` | 1.56.1 | Apache-2.0 | browser journeys (`npm run test:e2e`) | npm registry; maintained by Microsoft (github.com/microsoft/playwright); integrity `sha512-hutraynyn31F…` in the lockfile | No install scripts. Browsers are **not** downloaded on `npm ci`; CI runs `npx playwright-core install --with-deps chromium` explicitly. Used only in tests, never shipped. |

Desktop (Tauri) and Rust dependencies are listed in `apps/desktop/package.json`,
`apps/desktop/src-tauri/Cargo.toml` and the generated native SBOM (`npm run native:sbom`). The
licence audit is `npm run license:audit`.
