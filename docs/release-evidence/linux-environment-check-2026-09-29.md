# Linux environment check — 2026-09-29

The available local WSL distributions were inspected before attempting Linux verification.

- Ubuntu 22.04 (WSL 2) is installed but stopped.
- The distribution does not provide a Linux `node`/`npm` runtime.
- The Windows Node runtime is not a substitute for Linux verification because npm scripts and native dependencies resolve against the host OS.
- Installing a Linux Node runtime was not completed: the distro's package database requires an interactive privileged apt/sudo session that is not available to this run.

This was the initial environment check. It has been superseded for source verification by [linux-source-verify-2026-09-29.md](linux-source-verify-2026-09-29.md), after the WSL distro was provisioned with Node.js and Python. Linux Tauri packaging, installer, upgrade and uninstall gates remain **open**; the repository's `.github/workflows/verify.yml` remains the supported hosted path as well.
