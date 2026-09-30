# OpenENTC Studio release-readiness handoff — 2026-09-29

This is the final software-side handoff for the current development release. It is intentionally not a production-release approval: the phase auditor remains `review-required` until the external gates below have evidence.

## Verified in this workspace

| Area | Evidence | Result |
| --- | --- | --- |
| Repository verification | `npm run verify` | 378 tests; 370 passed, 0 failed, 8 optional skips |
| Browser artifact | `npm run build` and `npm run release:verify` | 36 browser files and hashes verified |
| Native dependency inventory | `npm run native:sbom` | SPDX inventory for 437 Cargo packages; 697 notice sections |
| Automated licence audit | `npm run license:audit` | 0 unresolved licence identifiers; human review still required |
| Windows desktop artifacts | `npm run desktop:check`, `npm run desktop:installer` | Executable and unsigned NSIS installer built; hashes verified |
| Local installer lifecycle | isolated install/reinstall/launch/uninstall smoke | Passed locally; not clean-machine certification |
| External tool software flows | ngspice, Arduino CLI, GHDL, Verilator, Yosys and nextpnr evidence | Software-verified only; no hardware claim |
| Browser smoke | `npm run browser:smoke` | DOM/accessibility smoke passed; not WCAG or performance qualification |

## Required external closure actions

| Gate | Required evidence to close it | Current owner/action |
| --- | --- | --- |
| Physical Arduino/FPGA/programmer | Device identity, revision, programmer, OS, tool versions, procedure and signed result | Hardware contributor; no matching device is present on this host |
| Board-specific FPGA acceptance | Reviewed PCF constraints, constrained nextpnr output, timing report and programming result | FPGA contributor with the named HX8K/CT256 board |
| Clean Windows/Linux installers | Fresh-machine install, upgrade, launch, uninstall and retained-user-data results | Windows/Linux test hosts; WSL and Docker are unavailable here |
| Desktop end-to-end engine run | Normal-user interactive Tauri session running a project-scoped engine job and recording its result | Desktop test host; current WebView2 session only supports bounded process observation |
| Full accessibility/performance | WCAG 2.2 AA review plus frame/input latency, memory, low-spec and cross-platform budgets | Accessibility/performance reviewer |
| Hosted GitHub Actions | Successful hosted `verify` matrix and Linux package job with uploaded artifacts | Repository maintainer; this checkout has no hosted remote/authenticated run |
| SBOM/licence approval | Human review of generated SPDX, notices, licence texts and security findings | Legal/security reviewer |
| Code signing/release approval | Approved certificate, signing logs, signature verification and release approver record | Windows SDK `signtool.exe` is now discovered at `C:/Program Files (x86)/Windows Kits/10/bin/10.0.26100.0/x64/signtool.exe`, but no approved certificate or release authority is configured |

## Authoritative status

Run `npm run phase:status` from the repository root. The expected state for this handoff is `review-required` with no missing evidence files and external gates remaining. Do not relabel the release as hardware-certified or production-signed based on software evidence alone.
