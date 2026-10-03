# Contributing

OpenENTC Studio welcomes focused changes that keep the toolkit free, transparent and useful for students.
Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node.js 22.8.0 or newer. Run `npm ci`, then `npm run dev`; see the README quick start and
[docs/development.md](docs/development.md) for every command.

## Issues

Use the issue forms: bug, numerical error, external engine problem or accessibility problem.
Never report a security problem in a public issue; follow [SECURITY.md](SECURITY.md).

## Changes

Before submitting a change:

1. Keep engine-specific code behind the connector boundary.
2. Add tests for numerical logic and project-format changes.
3. Do not add proprietary binaries, component libraries or copied vendor assets.
4. Record new third-party licence obligations.
5. Keep core workflows usable offline.
6. Run `npm run verify` and include the result in the change description.

The baseline quality commands are:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck` (structural contracts plus strict TypeScript for the files listed in `tsconfig.json`)
- `npm test`

Feature claims must stay accurate: update `docs/features.md` and `capabilities/ledger.json` whenever a user-visible capability or limitation changes. Follow `docs/definition-of-done.md` and the release gates in `docs/release-checklist.md`.

Use small pull requests and describe which engineering workflow was verified.

## Dependencies

Prefer a small, auditable implementation to a new runtime dependency. A new dependency (npm, Cargo, firmware or GitHub Action) needs, in the pull request:

- its purpose and why existing code cannot do the job;
- an exact pinned version (GitHub Actions: a full commit SHA with the version in a comment);
- its SPDX licence and source repository;
- a short security review: maintainer activity, install scripts, network or native access.

Dependabot proposes updates weekly (`.github/dependabot.yml`); each update goes through the same review and CI.

## Governance

Pull requests use the template in `.github/PULL_REQUEST_TEMPLATE.md`. Code owners are listed in `.github/CODEOWNERS`. Branch protection, review rules and the release process are described in `docs/governance/`.
