# Classroom pilot plan

**Status: planned, not started.** No classroom use has happened yet. The `classroom-pilot` gate in
`release/gates.json` is pending.

## Goal

Find out whether second- and third-year E&TC students can complete standard laboratory exercises
with OpenENTC Studio, where they get stuck, and whether any result misleads them.

## Scope

- **Cohort:** one class section (about 20–40 students), with a partner instructor who teaches the course.
- **Labs:** Circuit Lab (DC, AC and transient on the example circuits), DSP filter design, Digital Logic (K-map and minimisation), and a Communication lab (AM and BER).
- **Duration:** 3–4 weekly sessions of about 2 hours.
- **Setting:** the browser version, offline-capable, on the institution's computers. No hardware.

## Safeguards

- **Participation is voluntary.** It has no effect on grades, and students may use the usual tools instead.
- **No personal data is collected by the software.** Projects stay in the browser. Feedback is collected on paper or through the institution's own form, without names.
- **Instructors check every graded value against their usual method.** OpenENTC results are labelled "simulated with educational models".
- **The plan follows the institution's ethics or consent process,** if one applies, before starting.

## Measures

| Measure | How |
|---|---|
| Task completion | instructor checklist per exercise |
| Time to first correct result | instructor notes |
| Misleading or wrong results | every disagreement with the instructor's reference, logged as a numerical-error issue |
| Usability and accessibility problems | anonymous feedback form; observation |
| Diagnostics | students may attach the redacted diagnostic report to problem reports |

## Exit criteria for the gate

The gate is done when one complete cohort has finished. The report goes in
`docs/reviews/classroom-pilot-<date>.md`, and every critical finding is either fixed or listed as a
known limitation in the release notes.
