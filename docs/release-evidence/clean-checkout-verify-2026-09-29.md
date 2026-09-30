# Clean checkout-style verification — 2026-09-29

An isolated copy of the repository was created in a temporary directory with generated outputs, installed dependencies and native build targets excluded. From that copy:

- `npm ci` installed the lockfile-resolved dependency set and reported 0 vulnerabilities.
- `npm run verify` passed: 378 tests, 370 passed, 0 failed and 8 optional-runtime skips; format, lint, strict typecheck, Python worker compilation and browser build also passed.

The temporary copy was removed after verification. This proves reproducibility from the current source tree and lockfile on this Windows host; it is not hosted GitHub Actions evidence, a Linux build, or clean-machine installer evidence.
