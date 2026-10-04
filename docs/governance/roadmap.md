# Roadmap

The modernization programme (Phases 0–13, `docs/modernization-progress.md`) turned the 0.1
prototype into a tested, documented alpha. This roadmap covers what comes next. **No new labs are
planned until the beta criteria are met.** The priority is credibility, not breadth.

## 0.1 alpha (now)

- Browser app, offline after one visit, plus unsigned Windows and Linux desktop development builds.
- Every external gate in `release/gates.json` is pending.

## 0.2 beta: entry criteria

| Criterion | Evidence needed |
|---|---|
| Signed installers | `code-signing` gate done (certificate, verified signatures) |
| Clean-machine installs | `clean-machine-install` gate done on Windows 10/11 and Ubuntu 24.04 |
| Independent numerical review of the core engines | `expert-numerical-review` done for at least circuit DC/AC/transient, filters, control and communications (`docs/reviews/`) |
| Manual accessibility audit | `accessibility-audit` done; critical findings fixed |
| Classroom pilot | `classroom-pilot` done with one cohort; findings triaged |
| Named reviewers | numerical, native/security and project-format roles in `docs/maintainers.md` staffed |
| Branch protection | enabled and verified in GitHub settings (`docs/governance/BRANCH-PROTECTION.md`) |

## 0.2 engineering work (highest value first)

1. Type-check the workspaces and shell (about 950 KB, currently outside `npm run typecheck`).
2. Scan every tab of every lab with axe, not only the default view. Add data tables as text alternatives for key plots.
3. Measure browser coverage in the e2e journeys, so `browser-ui` coverage is not understated.
4. Render the active lab only: the whole page re-renders on every change today.
5. Store desktop API keys in the OS credential store, after a dependency and licence review.
6. Hardware qualification: Arduino Uno upload and serial monitor, iCE40 programming, on named boards.

## 1.0: direction, not commitments

- A stable project-format guarantee (`docs/project-compatibility-policy.md`) with migration tests for every released version.
- Published validation reports per engine.
- At least two maintainers with release rights.
