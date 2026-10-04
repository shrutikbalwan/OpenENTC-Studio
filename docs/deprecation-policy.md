# Deprecation policy

How OpenENTC Studio removes or changes something users or contributors rely on.

## What this covers

- Project file formats and fields (see [project-compatibility-policy.md](project-compatibility-policy.md))
- Laboratory features, examples and lesson content
- `data-*` attributes and keyboard shortcuts that tests or users depend on
- Public exports of `packages/*` (their `index.d.ts` contracts)
- Supported Node.js versions, browsers, operating systems and external-tool versions
- Command-line scripts in `package.json`

## Process

1. **Announce.** Record the deprecation in `CHANGELOG.md` under *Deprecated*. Give the reason, the
   replacement and the earliest version in which it may be removed.
2. **Warn.** Where practical, show a non-blocking notice in the app or a warning from the script.
   Keep the old behaviour working.
3. **Wait.** Keep the deprecated item for at least **one minor release**, and at least **60 days**
   after the announcement.
   - Before 1.0, one minor release means one `0.x` step.
   - After 1.0, removal requires a major release.
4. **Remove.** Remove it in the announced version, under *Removed* in the changelog, with migration
   notes.

## Exceptions

A security fix may remove or restrict behaviour immediately. The changelog and the security
advisory explain what changed and why. Project files are still migrated, never silently discarded.

## Never deprecated silently

- The ability to open a project file that a released version saved
- Exporting a project in a documented format
