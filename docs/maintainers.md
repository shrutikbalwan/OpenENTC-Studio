# Maintainers

## Current maintainers

| Role | GitHub | Areas |
|---|---|---|
| Repository owner | @shrutikbalwan | Everything (sole maintainer today) |

**Placeholder roles.** These need real people before 1.0. Until someone is named, these reviews
fall to the sole maintainer, and that is recorded as a release risk.

| Role | Reviews | Named person |
|---|---|---|
| Numerical reviewer | `src/engines/`, `packages/*` numerical kernels, `tests/fixtures/` | **to be confirmed** |
| Native/security reviewer | `apps/desktop/src-tauri/`, `packages/process-runner/`, `packages/device-bridge/`, CI | **to be confirmed** |
| Project-format reviewer | `packages/project-model/`, `schemas/`, migrations | **to be confirmed** |
| Accessibility reviewer | UI changes, `src/styles.css` | **to be confirmed** |
| Backup security contact | private vulnerability reports | **to be confirmed** |

Code ownership is in [`.github/CODEOWNERS`](../.github/CODEOWNERS).

## Responsibilities

- Triage new issues within 14 days, applying labels and asking for missing information.
- Review pull requests against the checklist in `.github/PULL_REQUEST_TEMPLATE.md`.
- Never merge a change that weakens a test, a bound or a permission check without a written reason.
- Keep [`capabilities/ledger.json`](../capabilities/ledger.json), [`CHANGELOG.md`](../CHANGELOG.md) and
  [`docs/modernization-progress.md`](modernization-progress.md) accurate.
- Follow [`docs/governance/RELEASE-POLICY.md`](governance/RELEASE-POLICY.md) for releases.
- Handle security reports as described in [`SECURITY.md`](../SECURITY.md).

## Becoming a maintainer

Anyone with a record of reviewed contributions in an area can be invited by an existing
maintainer. New maintainers are added to this file and to `CODEOWNERS` in a pull request.

## Repository metadata

The suggested GitHub description, topics and demo link are in
[`docs/repository-metadata.md`](repository-metadata.md).
