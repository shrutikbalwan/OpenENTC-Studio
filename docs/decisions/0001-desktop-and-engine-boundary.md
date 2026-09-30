# ADR 0001: Desktop stack, engine-process boundary, and licence strategy

- Status: Proposed
- Date: 2026-09-28
- Decision owner: OpenENTC maintainers (individual owner not recorded)

## Context

OpenENTC needs local filesystem, process, serial, USB, and later capture capabilities while retaining a limited browser preview. It must integrate independently versioned engineering tools without presenting them as bundled or installed, and must preserve licence and provenance information for every distributed or invoked component.

The alpha is dependency-free browser JavaScript. The target documents recommend Tauri 2, TypeScript/React, Rust native services, isolated numerical workers, and explicit adapters. No evidence supplied with this audit establishes that maintainers have formally approved or implemented that recommendation, so this record remains Proposed.

## Proposed decision

1. Use Tauri 2 as the desktop shell and keep a capability-limited browser preview.
2. Migrate the UI incrementally to strict TypeScript and React; do not perform a big-bang rewrite.
3. Put filesystem, job, artifact, event, device, and child-process authority in Rust services behind least-privilege Tauri commands.
4. Execute external tools only through named adapters and an allow-listed process runner. The runner accepts a fixed executable identifier and argument array, never a shell command string, and enforces working-root, timeout, output, cancellation, and owned-process-tree policies.
5. Treat CLI process integration as the default boundary. Linked/shared-library integration requires a separate security and licence decision.
6. Keep the OpenENTC shell under `GPL-3.0-or-later`. Do not bundle an engine, model, library, symbol, footprint, or example until its exact version, SPDX expression, notices, redistribution terms, source obligations, and modification record have passed review.
7. Record each engine’s version, executable evidence, source URL, licence, integration mode, capabilities, and bundled status. Absence of detection evidence means `unavailable`, not installed or integrated.

## Decision tests

- Browser builds expose no native process or device commands.
- Native command APIs cannot accept arbitrary executable paths or shell strings.
- Imported content cannot automatically start a process, device action, script, capture, or upload.
- Every distributed third-party item appears in notices and the release SBOM with an exact licence expression.
- Cancellation tests demonstrate owned process-tree termination before an adapter becomes integrated.

## Alternatives considered

### Keep a browser-only application

This preserves a small attack surface but cannot safely satisfy local engine, filesystem, and hardware workflows. It remains suitable only for the preview.

### Electron/Node desktop shell

This offers mature packaging and a uniform JavaScript stack, but grants a larger Node/native surface and does not match the Rust service boundary already selected in the architecture research.

### Bundle or embed engineering engines

This can simplify installation but increases update, platform, security, and licence obligations. It is rejected as the default. A future engine-specific decision may approve a reviewed bundle.

### Invoke shell commands from the frontend

Rejected. It creates command-injection and authority-confusion risks and conflicts with the project security rules.

### Rewrite all engineering engines inside OpenENTC

Rejected as infeasible and likely to reduce correctness. OpenENTC owns canonical models, orchestration, diagnostics, results, and learning workflows; mature engines retain domain execution.

## Consequences

Expected benefits are a narrow native trust boundary, honest capability reporting, reusable adapter contracts, and separation of OpenENTC code from engine distribution obligations. Costs include Rust/TypeScript build complexity, per-platform process control, adapter maintenance, and explicit compatibility testing.

Risks include Tauri capability misconfiguration, unsafe path canonicalization, child-process leakage, output exhaustion, ABI/licence changes if shared libraries are later adopted, and UI drift between browser and desktop. Contract/security tests and the capability ledger are mandatory controls, not optional documentation.

## Follow-up and review triggers

- Phase 1: publish schemas and typed engine/job/diagnostic/result contracts.
- Phase 2: validate Tauri capabilities and the process runner on Windows and Linux.
- Before any bundled binary or shared library: create a separate approved ADR and licence review.
- Revisit this decision if Tauri 2 cannot meet accessibility, packaging, process-tree, or supported-platform requirements.

## Provenance

- `docs/ARCHITECTURE.md`
- `docs/ENGINE-INTEGRATION.md`
- `docs/TOOLKIT-RESEARCH-AND-STRUCTURE.md`
- `docs/MASTER-BUILD-PROMPT.md`
- `SECURITY.md`
- `LICENSE`
