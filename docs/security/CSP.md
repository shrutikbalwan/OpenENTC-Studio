# Content Security Policy

The same policy is set in two places:

- the browser and offline PWA, by a `<meta http-equiv>` tag in `index.html`;
- the desktop app, by `app.security.csp` in `apps/desktop/src-tauri/tauri.conf.json`. Tauri adds its own `ipc:` sources and script hashes at build time.

`tests/browser-security.test.mjs` checks that the two stay aligned on the security-critical directives.

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Anything not listed below may load only from the app itself. |
| `script-src` | `'self'` | Only the app's own modules run. There is no `unsafe-inline` and no `unsafe-eval`, so even if markup were injected, `<script>` tags, inline `on…=` handlers and `javascript:` URLs would not execute. |
| `style-src` | `'self' 'unsafe-inline'` | **Trade-off.** The UI sets per-element colours and sizes through 45 `style="…"` attributes in its templates, which this keyword permits. Removing it requires moving those values into classes or CSS custom properties (planned with the UI decomposition, hardening phase 3). Inline styles cannot run script; the residual risk is visual spoofing if markup were injected, which escaping prevents. |
| `img-src` | `'self' data: blob:` | Generated plots and exported images use `data:` and `blob:` URLs. |
| `font-src` | `'self'` | No web fonts are downloaded. The two family names map to locally installed fonts through `@font-face { src: local(…) }`. |
| `connect-src` | `'self' https: http://localhost:* http://127.0.0.1:*` | **Trade-off.** The AI lab partner calls a provider the *user* chooses, so its host cannot be listed in advance; any https host is allowed. Plain http is limited to local servers such as Ollama. The assistant enforces the same rule in `validateBaseUrl`. Nothing else in the app makes network requests. |
| `frame-src` | `'self' blob:` | Lab-record PDF preview. |
| `worker-src` | `'self'` | The offline service worker (`sw.js`). |
| `media-src` | `'self' blob:` | Speech-lab audio playback of recorded or loaded audio. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'none'` | An injected `<base>` cannot redirect relative URLs. |
| `form-action` | `'none'` | The app never submits forms. |

Not settable from a meta tag:

- `frame-ancestors` (clickjacking protection) needs an HTTP header from whatever server hosts the PWA.
- The bundled dev server (`scripts/server.mjs`) is for local use only.

## Verification

- **Browser (Chromium, 2026-10-03).** Every module and its tabs were opened with the policy active:
  - no violations;
  - the service worker registers;
  - the lab-record preview loads;
  - an injected inline handler did not run.
- **Desktop.** The configuration compiles (`cargo check`). The policy has **not yet been exercised in a running desktop webview**, because none is available in the build container. This is part of the desktop qualification in hardening phase 7.
