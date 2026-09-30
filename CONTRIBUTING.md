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
