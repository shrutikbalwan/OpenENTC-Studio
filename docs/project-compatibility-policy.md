# Project compatibility policy

Students keep their work in project files, so a new version must not silently break or lose it.

## Formats

| Format | Use | Status |
|---|---|---|
| Project manifest (`format: "openentc-project"`, `version: 1`) | The JSON document stored in the browser and inside every export | Current |
| `.entcproj` | Packaged export: a bounded, manifest-only ZIP profile (`packages/project-model/src/archive.mjs`) | Current export format |
| `.entc.json` | Plain JSON export from earlier builds | Import supported (legacy) |
| Desktop project directory | Manifest plus `runs/` and `build/` artifacts | Current (desktop only) |

The schema is in [`schemas/project.schema.json`](../schemas/project.schema.json). Validation and
migration live in `packages/project-model/src/index.mjs` (`migrateProject`, `validateProject`).

## Rules

1. **Valid files keep opening.** Every project file that a released version accepted must still
   import into later versions, through a migration if needed, unless a deprecation (see
   [deprecation-policy.md](deprecation-policy.md)) has run its full course.
2. **Migrations are forward-only and tested.** A change to the manifest needs:
   - a new `version` number;
   - a pure migration step from the previous version;
   - a fixture of the old format;
   - a test showing the old fixture imports, validates and keeps its data.
3. **Original data is kept.** Browser storage keeps a migration backup and bounded copies of
   corrupt data. Desktop migration writes atomically and leaves the original manifest unchanged if
   migration fails.
4. **Newer files are refused clearly.** A project from a newer version is rejected with an
   "unsupported version" error. It is never partly loaded.
5. **Imports are untrusted.** Size limits apply (10 MB manifest, bounded archive entries and paths).
   Unknown or unsafe content is rejected, not executed.
6. **Generated results are not part of the contract.** Simulation results are runtime data and may
   change between versions as models improve. Authored inputs (circuits, experiment settings, code,
   notes) are covered by this policy.
7. **Secrets never enter projects.** API keys and credentials are never written to project files or exports.

## Pre-1.0 note

Before 1.0 the format can still change. Even so, rule 1 applies from the first tagged alpha: any
format change ships with a migration, never a break.
