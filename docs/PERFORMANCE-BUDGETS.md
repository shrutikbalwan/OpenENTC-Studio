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

## Modernization budgets (2026-10-04)

These are regression gates, not claims about low-end hardware. Each budget is set well above the
time measured in the reference container (Ubuntu 24.04, Node 22, headless Chromium 141), so slower CI
runners stay green while a large regression still fails.

| Operation | Measured | Budget | Gate |
|---|---|---|---|
| DC: 400-resistor ladder | ≈ 10 ms | 200 ms | `tests/performance.test.mjs` |
| DC: 20 diode branches (Newton) | ≈ 2 ms | 60 ms | same |
| Transient: RC, 10 000 steps | ≈ 45 ms | 1000 ms | same |
| AC: RC, 210 frequencies | ≈ 3 ms | 80 ms | same |
| FFT: 4096 samples | ≈ 2 ms | 40 ms | same |
| Project validation: 1001 components | ≈ 5 ms | 150 ms | same |
| Browser start-up to the app shell | ≈ 0.8 s | 5 s | `tests/e2e/performance.e2e.mjs` |
| Opening any lab (click to rendered) | slowest ≈ 330 ms (Neural Networks, which trains a network) | 1000 ms | same |
| Web assets downloaded on first visit | 2.73 MB total; largest file 164 KB | 3.5 MB; 256 KB | `scripts/bundle-budget.mjs` (the build fails) |

Two real problems were found while setting these budgets, and both are fixed:

- `fft()` in `packages/numerics` was a direct O(n²) DFT: 4096 samples took about 500 ms. It is now a radix-2 FFT for power-of-two lengths and a table-based DFT otherwise (about 2 ms). It is checked against a direct DFT. The old code fails the 40 ms budget.
- The Biomedical lab recomputed two maxima for every sample when scaling a plot (O(n²)). Opening it took about 1 s; it now takes under 50 ms.
