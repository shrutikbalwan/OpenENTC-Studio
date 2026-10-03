# Security policy

Do not place secrets, access tokens or private device data in an OpenENTC project.

Engine connectors are a security boundary. They must validate paths, avoid shell interpolation, restrict writable directories, enforce timeouts and terminate owned child processes on cancellation. Project imports must be treated as untrusted data.

The browser preview runs only built-in capabilities and has no native process, filesystem, or device authority. The unsigned Windows development build includes project-scoped native services, but external processes remain unavailable until a project is opened, a reviewed executable is detected in an approved tool location, and the user grants process execution for that project. The native runner rejects shells/interpreters, bounds arguments and output, confines its working directory plus every path-shaped argument to the canonical project root, and owns the complete child-process tree for timeout, cancellation, revocation, and project close. Generated writes require a separate artifact grant and remain confined to `runs/` or `build/`.

This is still an unsigned development build. Do not treat it as a trusted public release until clean-machine verification, supported-OS qualification, signing, licence review, and the remaining release checklist are complete.

## AI assistant

The optional AI lab partner sends the user's questions — and, only if they allow it, the current lab's inputs and results — to the OpenAI-compatible service they configure. The API key is kept in the browser's localStorage, is never written to projects or exports, and is sent only to that service. Base URLs must use https, except plain http to localhost for local servers such as Ollama. Model replies are rendered as escaped text; tool calls run only the built-in, side-effect-free calculators.

## Reporting a vulnerability

Do not disclose security vulnerabilities in a public issue, and do not attach sensitive projects, captures, credentials or device data.

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private vulnerability reporting). The repository owner must enable this feature under *Settings → Code security*. Until it is confirmed enabled, open a public issue that only asks for a private contact, with no technical details. We aim to acknowledge reports within 7 days and to agree a disclosure date with the reporter.

## Secrets

- Never commit tokens, API keys, signing certificates or passwords. Signing material belongs only in the protected release environment (see `docs/governance/RELEASE-POLICY.md`).
- The repository owner should enable GitHub **secret scanning** and **push protection** (*Settings → Code security*). These are owner settings and cannot be enabled from source.
- If a secret is committed, treat it as compromised: revoke and rotate it first, then remove it from history. Removing it from history alone is not enough.
- CI workflows run with read-only `contents` permission, check out without persisting credentials, and use no repository secrets. Pull requests from forks therefore cannot reach any credential.
