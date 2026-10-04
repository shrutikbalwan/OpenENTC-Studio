# Numerical validation

OpenENTC Studio's engines are **educational models**. They are checked against reference tools and
closed-form results, but they are not professional SPICE or a certified computation tool, and no
engine has been independently reviewed yet.

## Where the evidence is

- [`validation/manifest.json`](../../validation/manifest.json) has one entry per validated behaviour. Each entry records:
  - the engine;
  - the reference (tool and version, closed form or textbook);
  - the tolerance the test enforces;
  - the test that enforces it;
  - the review status.
- `tests/validation-manifest.test.mjs` fails if:
  - an entry names a missing engine or test;
  - an external-tool reference has no version;
  - an entry claims an independent review without a review record in `docs/reviews/`.
- Every capability in `capabilities/ledger.json` has a `review` field. Today every capability is `not-independently-reviewed`.
- Reviews use the [expert review checklist](../expert-review-checklist.md).

## Reference values

- Values from ngspice 42, SciPy 1.17, scikit-image 0.26 and NumPy 2 were recorded once and stored in the tests or in `tests/fixtures/`. CI does not run those tools.
- The opt-in live ngspice tests (`OPENENTC_NGSPICE`) re-run the comparison on a machine with ngspice installed.

## What users see

- **Circuit Lab DC results** show how the solver reached the answer: the Newton iteration count, whether a GMIN shunt was added for a floating node, and whether source stepping was used. They also carry an "Educational model" note.
- **Non-physical results** produce a warning instead of a silent number, for example a node above 1 MV because a current source drives a reverse-biased diode.
- **When the solver fails to converge**, the error names the iteration limit and the node that was still changing. The same details are also stored as context for diagnostics.
- **Every lab-record PDF page** says "simulated with educational models, not measured data".
