# Versioning and release policy

## Version numbers

OpenENTC Studio uses [Semantic Versioning 2.0.0](https://semver.org/).

- While the version is `0.y.z` the product is **alpha**. A minor bump (`0.y`) may change the project format or remove features, but only with a documented migration and a changelog entry.
- From `1.0.0`:
  - **MAJOR** — incompatible change to the project file format or a removed capability;
  - **MINOR** — new capability, backwards compatible;
  - **PATCH** — fixes only.
- Pre-releases use `-alpha.N`, `-beta.N` or `-rc.N` (for example `0.2.0-rc.1`).
- The project-file `version` field is separate from the app version and changes only with a migration (`packages/project-model`).

## Release notes

Every release has a `CHANGELOG.md` section ([Keep a Changelog](https://keepachangelog.com/) style), with these headings:

- Added
- Changed
- Fixed
- Security
- Deprecated / Removed
- Known limitations

Release notes must not claim more than the evidence supports:

- Hardware support needs a physical qualification record.
- Accuracy statements need a validation record.
- Signed installers need signing evidence.

Unresolved gates are listed under *Known limitations*.

## Release procedure

1. Freeze a release-candidate commit on `main` and record its SHA.
2. Run the full verification gate (`docs/release-checklist.md`) on a clean checkout and record the results.
3. Build browser and desktop artifacts, generate SBOMs and checksums (`npm run release:prepare`, `npm run release:verify`).
4. Complete clean-machine install, upgrade and uninstall testing on each supported OS.
5. Sign artifacts only in the protected release environment (below).
6. A maintainer other than the release author approves the release record in `docs/release-evidence/`.
7. Tag the approved commit `vX.Y.Z` (signed tag when available) and publish the release notes.

If credentials, clean machines or an approver are unavailable, stop at step 4. Publish only a release candidate, with the missing gates listed.

## Signing and credentials

- Signing certificates and keys are **never** committed and never exposed to pull-request workflows.
- Signing runs only in a GitHub *environment* named `release`, with required reviewers, restricted to tags matching `v*`.
- That environment's secrets are available only to the release workflow (not yet created), on protected tags.
