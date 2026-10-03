# Security policy

Do not place secrets, access tokens or private device data in an OpenENTC project.

Engine connectors are a security boundary. They must validate paths, avoid shell interpolation, restrict writable directories, enforce timeouts and terminate owned child processes on cancellation. Project imports must be treated as untrusted data.

The browser preview runs only built-in capabilities and has no native process, filesystem, or device authority. The unsigned Windows development build includes project-scoped native services, but external processes remain unavailable until a project is opened, a reviewed executable is detected in an approved tool location, and the user grants process execution for that project. The native runner rejects shells/interpreters, bounds arguments and output, confines its working directory plus every path-shaped argument to the canonical project root, and owns the complete child-process tree for timeout, cancellation, revocation, and project close. Generated writes require a separate artifact grant and remain confined to `runs/` or `build/`.

This is still an unsigned development build. Do not treat it as a trusted public release until clean-machine verification, supported-OS qualification, signing, licence review, and the remaining release checklist are complete.

## AI assistant

The optional AI lab partner sends the user's questions to the OpenAI-compatible service they configure. If they allow it, it also sends the current lab's inputs and results.

- **API key storage.** The key is held in memory and forgotten on reload. If the user ticks *Keep the key until this tab closes*, it is also kept in `sessionStorage`. It is never written to `localStorage`, project files, exports or logs. Older versions stored it in `localStorage`; on startup that copy is deleted without being read into memory, and the user is told once.
- **Desktop app.** The same rules apply. OS credential storage (Windows Credential Manager, macOS Keychain, libsecret) was considered but needs a new native plugin, so it awaits a dependency and licence review.
- **Base URL.**
  - It must use https; plain http is allowed only for `localhost` and `127.0.0.1` (local servers such as Ollama).
  - It must not contain user info, a query string or a fragment.
- **Requests.** They never follow redirects, never send cookies and send no referrer, so the key reaches only the configured host.
- **Error messages.** These are redacted: the key and anything shaped like a bearer token or provider key become `[redacted]`.
- **Replies.** Model replies are escaped before rendering (`src/core/html.js`).
- **Tool calls.** They run only the built-in, side-effect-free calculators. At most 8 calls per step, and oversized arguments are refused.

## Browser hardening

- **Content Security Policy** in `index.html` and `tauri.conf.json`. Scripts come only from the app itself, inline scripts and event handlers are blocked, and `object` and `base` are disabled. See `docs/security/CSP.md`.
- **Escaping.** All markup is built through `esc()` and `safeUrl()` in `src/core/html.js`.
- **Probes.** `tests/browser-security.test.mjs` covers escaping, URL schemes, assistant replies, credentials and the CSP. The opt-in browser probe `tests/e2e/injection-probe.mjs` feeds hostile strings through:
  - the project name and component labels;
  - saved lab inputs;
  - an imported VCD file;
  - the serial monitor and an AI reply.

## Reporting a vulnerability

Do not disclose security vulnerabilities in a public issue, and do not attach sensitive projects, captures, credentials or device data.

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private vulnerability reporting). The repository owner must enable this feature under *Settings → Code security*. Until it is confirmed enabled, open a public issue that only asks for a private contact, with no technical details. We aim to acknowledge reports within 7 days and to agree a disclosure date with the reporter.

## Secrets

- Never commit tokens, API keys, signing certificates or passwords. Signing material belongs only in the protected release environment (see `docs/governance/RELEASE-POLICY.md`).
- The repository owner should enable GitHub **secret scanning** and **push protection** (*Settings → Code security*). These are owner settings and cannot be enabled from source.
- If a secret is committed, treat it as compromised: revoke and rotate it first, then remove it from history. Removing it from history alone is not enough.
- CI workflows run with read-only `contents` permission, check out without persisting credentials, and use no repository secrets. Pull requests from forks therefore cannot reach any credential.
