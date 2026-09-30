# Definition of done

A change is done only when all applicable items below have concrete evidence. “Not applicable” must include a reason.

## Product behavior

- The user-visible workflow succeeds end to end and exposes real results.
- Failure, persistence, and cancellation paths are tested where the feature has those states.
- Controls are functional or clearly disabled with one of: built-in, integrated, interoperable, unavailable, or unsupported.
- Missing optional engines and devices degrade safely without fabricated results.

## Engineering quality

- `npm run verify` passes and returns nonzero on any failed step.
- New logic has focused tests; numerical work includes reference values and tolerances.
- Project/schema changes include fixtures, round trips, migrations, backup behavior, and malicious-input cases.
- No unrelated user change is overwritten and the repository remains runnable.
- Documentation and `capabilities/ledger.json` match the verified implementation.

## Security and privacy

- Untrusted inputs are bounded, validated, and escaped at their sinks.
- Native execution uses allow-listed executable identifiers and argument arrays, never shell strings.
- Paths are canonicalized inside approved roots; symlink/traversal cases are tested.
- Timeouts, output limits, cancellation, and owned-process-tree cleanup are tested for processes.
- Hardware, upload, live capture, network, and installation actions require their own explicit scope and user initiation.
- No project data or telemetry leaves the device by default.

## Accessibility and performance

- The primary flow works by keyboard with visible focus and meaningful names.
- Dialog focus, errors, status changes, reduced motion, contrast, and screen-reader output are checked as applicable.
- Relevant declared performance budgets are measured with representative fixtures.
- The Phase 3 reference-size schematic model budget and its remaining browser-render qualification are recorded in `docs/PERFORMANCE-BUDGETS.md`.
- No compliance statement is made without recorded test evidence.

## Licensing and release evidence

- New third-party material has exact provenance, version, SPDX expression, notices, redistribution terms, and source obligations recorded.
- Bundled binaries and linked libraries have an approved licence/security decision.
- Verification commands, environment, passed/failed counts, limitations, and compatibility effects are recorded in the handoff.
