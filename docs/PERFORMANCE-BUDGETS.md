# Performance budgets

Updated: 2026-09-28

These are regression budgets, not broad hardware or responsiveness claims. A budget is considered verified only for the operation and environment named below.

## Phase 3 schematic model

Reference fixture:

- 1,000 two-pin components arranged on a 50 × 20 world-coordinate grid;
- 500 authored wire aliases;
- deterministic ERC, intermediate-netlist generation, and rendered-wire geometry preparation.

Budget: the three pure model operations must complete together within 1,500 ms under the repository's Node.js verification process. The current Windows development host completed the fixture in approximately 13.0 ms on 2026-09-28; that observation is informational, while `tests/schematic-performance.test.mjs` is the repeatable gate.

This budget does not prove DOM painting, interaction latency, memory use, low-spec hardware performance, or WCAG conformance. Browser-frame timing and input-latency measurements remain required before Milestone 3 and the release performance gate can be marked complete.
