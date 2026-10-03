# Protecting `main`

These settings live in GitHub, not in the repository, so the repository owner has to apply
them. **Status: not yet verified as enabled.** This file describes the intended configuration
and how to check it.

## Required configuration

In *Settings → Rules → Rulesets* (or *Branches → Branch protection rules*), create a rule for
`main`:

1. **Require a pull request before merging.**
   - Require at least **1 approval**.
   - Dismiss stale approvals when new commits are pushed.
   - Require review from Code Owners (`.github/CODEOWNERS`).
   - Require approval of the most recent push by someone other than its author.
2. **Require status checks to pass**, with branches up to date. Required checks:
   - `Verify (ubuntu-latest)`
   - `Verify (windows-latest)`
   - `Linux desktop build`
   - `Analyze (javascript-typescript)`
   - `Analyze (actions)`
3. **Require conversation resolution** before merging.
4. **Block force pushes** and **block deletion** of `main`.
5. **Require linear history** (optional; squash or rebase merges).
6. Do not allow bypass, except for a documented emergency procedure.

Also enable, under *Settings → Code security*:

- private vulnerability reporting;
- secret scanning and push protection;
- Dependabot alerts and security updates;
- code scanning (CodeQL; the workflow is `.github/workflows/codeql.yml`).

Under *Settings → Actions → General*:

- set *Workflow permissions* to **read repository contents** (the default token is read-only);
- require approval before running workflows from first-time outside contributors.

## Single-maintainer limitation

The project currently has one maintainer, so "approval by someone other than the author" cannot
yet be met. Until a second reviewer joins:

- keep the rule enabled for outside contributions;
- record self-merges in the pull request as *maintainer self-review*;
- treat numerical and security changes as provisional until an independent reviewer approves them.

## How to verify

Run, with a token that can read repository administration settings:

```
gh api repos/shrutikbalwan/OpenENTC-Studio/rulesets
gh api repos/shrutikbalwan/OpenENTC-Studio/branches/main/protection
```

Record the output and the date in `docs/release-evidence/` before claiming the gate is met.
