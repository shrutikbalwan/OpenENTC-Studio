# Security policy

Do not place secrets, access tokens or private device data in an OpenENTC project.

Engine connectors are a security boundary. They must validate paths, avoid shell interpolation, restrict writable directories, enforce timeouts and terminate owned child processes on cancellation. Project imports must be treated as untrusted data.

The browser preview runs only built-in capabilities and has no native process, filesystem, or device authority. The unsigned Windows development build includes project-scoped native services, but external processes remain unavailable until a project is opened, a reviewed executable is detected in an approved tool location, and the user grants process execution for that project. The native runner rejects shells/interpreters, bounds arguments and output, confines its working directory plus every path-shaped argument to the canonical project root, and owns the complete child-process tree for timeout, cancellation, revocation, and project close. Generated writes require a separate artifact grant and remain confined to `runs/` or `build/`.

This is still an unsigned development build. Do not treat it as a trusted public release until clean-machine verification, supported-OS qualification, signing, licence review, and the remaining release checklist are complete.

## Reporting a vulnerability

Do not disclose security vulnerabilities in a public issue or attach sensitive projects, captures, credentials or device data. Use GitHub private vulnerability reporting when it is enabled for this repository. If it is not available, ask the maintainers for a private reporting channel without including exploit details in the public request. A dedicated security contact has not yet been published; this is a known release-process gap, not an invitation to report publicly.
