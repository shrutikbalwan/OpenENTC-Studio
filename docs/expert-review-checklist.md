# Expert review checklist

Use this checklist when a qualified reviewer (for example a faculty member teaching the subject, or
an engineer who uses the reference tool professionally) reviews one numerical engine. **No engine
has been independently reviewed yet.** Until a review is recorded, every entry in
[`validation/manifest.json`](../validation/manifest.json) stays `"review": "self-checked"`.

A review applies to one manifest entry (or a group of entries for the same engine) at one commit.

## Scope

- [ ] Manifest entry id(s) and engine file(s) reviewed:
- [ ] Commit SHA reviewed:
- [ ] Reviewer name, role and relevant qualification:
- [ ] Conflicts of interest (for example, the reviewer contributed the code):

## Model assumptions

- [ ] The equations and device models are stated (in code comments, help text or docs) and are appropriate for the course level they are used for.
- [ ] Simplifications are listed in the lab's limitations (capability ledger) and shown to users where results appear.
- [ ] Units are consistent; inputs outside the valid range are rejected or warned about.
- [ ] Failure modes (non-convergence, singular systems, non-physical results) produce a clear message, not a silent wrong number.

## Reference comparison

- [ ] The reference tool and version in the manifest match how the stored values were produced. Reproduce at least one value yourself.
- [ ] The tolerance is justified for the purpose (teaching, not design sign-off), and the test enforces it.
- [ ] Cases cover typical and edge conditions (for example small and large component values, saturation and cut-off, stable and unstable systems).
- [ ] Any disagreement with the reference is explained (different model, integration method, convention).

## Teaching use

- [ ] Results and explanations are correct for the syllabus they target; terminology matches common textbooks.
- [ ] The UI does not suggest the result is a measurement or a professional-SPICE-equivalent answer.
- [ ] Lab records carry the "simulated with educational models, not measured data" note.

## Sign-off

- [ ] Outcome: approved / approved with changes / not approved.
- [ ] Required changes (issue links):
- [ ] Date and signature (or a signed GitHub comment link).

Record the completed checklist as `docs/reviews/<manifest-entry-id>.md`, then change that entry to
`"review": "independently-reviewed"`. The test `tests/validation-manifest.test.mjs` refuses the
status without the review record. Re-review after any change to the engine's equations.
