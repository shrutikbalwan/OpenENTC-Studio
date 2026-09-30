# OpenENTC Studio desktop shell

This directory contains the Tauri 2 desktop boundary for the existing browser
preview. The shell intentionally grants only the Tauri core window/event
permissions. Filesystem, process, network, serial, USB and capture access are
not enabled by this initial capability manifest; those services must be added
through reviewed Rust commands and explicit project-scoped permissions.

The current sandbox has no Rust/Cargo toolchain, so a native build is not
claimed. The browser preview remains the runnable development surface.

When the desktop shell is built, Toolchains exposes project-scoped job
snapshots, bounded lifecycle events, retained failure text, and cancellation
for active process jobs. These records are runtime data; they are not written
into authored project manifests. Browser preview keeps all native job and
process actions disabled.

From a machine with the reviewed Rust and Tauri CLI toolchains available:

```text
npm --prefix apps/desktop run dev
npm --prefix apps/desktop run build:unbundled
```

Optional installed-engine smokes are explicit and opt-in:

```text
OPENENTC_NGSPICE=<absolute path> npm test
OPENENTC_ARDUINO_CLI=<absolute path> npm test
OPENENTC_KICAD_CLI=<absolute path> npm test
```

Without these variables, the integration tests skip and the tools remain
`UNAVAILABLE`; no executable discovery or installation is performed.
