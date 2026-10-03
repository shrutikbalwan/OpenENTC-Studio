# Contributing

OpenENTC Studio welcomes focused changes that keep the toolkit free, transparent and useful for students.

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
- `npm run typecheck` (alpha structural contracts; strict TypeScript begins in Phase 1)
- `npm test`

Update `capabilities/ledger.json` whenever a user-visible capability or limitation changes. Follow `docs/definition-of-done.md` and the release gates in `docs/release-checklist.md`.

Use small pull requests and describe which engineering workflow was verified.

## Dependencies

Prefer a small, auditable implementation to a new runtime dependency. A new dependency (npm, Cargo, firmware or GitHub Action) needs, in the pull request:

- its purpose and why existing code cannot do the job;
- an exact pinned version (GitHub Actions: a full commit SHA with the version in a comment);
- its SPDX licence and source repository;
- a short security review: maintainer activity, install scripts, network or native access.

Dependabot proposes updates weekly (`.github/dependabot.yml`); each update goes through the same review and CI.

## Governance

Pull requests use the template in `.github/pull_request_template.md`. Code owners are listed in `.github/CODEOWNERS`. Branch protection, review rules and the release process are described in `docs/governance/`.
