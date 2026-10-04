# Security contact setup

This is a checklist for the repository owner. No private email address has been chosen yet, so
this document does not invent one. Until the steps below are done, private reporting depends on
GitHub features the owner must enable.

## Steps (repository owner)

| # | Action | Where | Status |
|---|---|---|---|
| 1 | Enable **private vulnerability reporting** | *Settings → Code security → Private vulnerability reporting* | not verified |
| 2 | Enable **secret scanning** and **push protection** | *Settings → Code security* | not verified |
| 3 | Enable **Dependabot alerts** and security updates (the version-update config is already in `.github/dependabot.yml`) | *Settings → Code security* | not verified |
| 4 | Confirm **CodeQL** results appear (workflow `.github/workflows/codeql.yml`) | *Security → Code scanning* | not verified |
| 5 | Optionally create a dedicated security mailbox that the owner controls. Add it to `SECURITY.md` only after it is working. | — | not started |
| 6 | Name at least one backup security contact with repository admin rights, so reports are seen when the owner is away | `docs/maintainers.md` | not started |
| 7 | Test the flow: open a test private advisory, confirm notification, then close it | *Security → Advisories* | not started |

## After setup

- Update the "Reporting a vulnerability" section in [`SECURITY.md`](../SECURITY.md) to say private
  reporting is enabled, and remove the fallback text.
- Record the date and who verified each step in the table above.
- The issue form `.github/ISSUE_TEMPLATE/security-routing.yml` remains only as a way to ask for a
  private channel; it must never collect details.

## Response targets (from SECURITY.md)

- Acknowledge within 7 days.
- Agree on a disclosure date with the reporter.
- Publish a GitHub security advisory with the fix.
