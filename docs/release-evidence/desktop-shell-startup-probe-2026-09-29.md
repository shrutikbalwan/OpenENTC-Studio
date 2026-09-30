# Desktop-shell startup probe — 2026-09-29

The current Windows x64 executable was rebuilt with the official Tauri command and tested from the available automation session.

Observed results:

- Direct debug and release launches exit with code `101` before exposing a targetable window.
- Console capture identifies the failure as Tauri WebView2 setup: `HRESULT 0x800700AA` (`The requested resource is in use`).
- Retrying with an isolated `WEBVIEW2_USER_DATA_FOLDER` creates the profile but returns WebView2 `HRESULT 0x8000FFFF` (`Catastrophic failure`); adding `--disable-gpu` does not change the result.
- The Tauri window now declares an app-local `dataDirectory` (`webview-data`) and was rebuilt; the same noninteractive probe still returns `HRESULT 0x800700AA`, so the config hardening does not by itself close this session-level blocker.
- The installed WebView2 runtime is present (`153.0.4234.48`).
- Process inspection shows the active WebView2 trees belong to Windows SearchHost, LinkedIn and WhatsApp data directories, not OpenENTC Studio; they were not terminated as part of this test.
- Native Rust library tests remain green: 39 passed, 0 failed, 4 ignored.

Interpretation: this is an environment/session-level WebView2 startup failure in the current noninteractive automation context, not evidence that an engine command completed. The normal-user desktop-shell and interactive native-engine gates remain open and require a supported interactive Windows desktop session. No hardware or release certification is inferred.

The same probe is now reproducible with `npm run desktop:launch-smoke`. It reports executable liveness and captures bounded startup output, while always setting `engineRun: false`; a successful process observation alone never closes the native-engine gate.

Latest elevated probe against the icon-configured rebuild: `OPENENTC_DESKTOP_SMOKE_MS=10000 npm run desktop:launch-smoke` returned `state: running-observation`, `elapsedMs: 10004`, empty stdout/stderr, and `engineRun: false`. This confirms bounded shell liveness for the current artifact, but interactive window access and a project-scoped engine run still require a supported desktop UI session.
