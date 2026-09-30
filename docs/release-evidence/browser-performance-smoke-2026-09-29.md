# Browser performance smoke — 2026-09-29

Command:

```text
npm run browser:smoke
```

The smoke started the repository preview server and loaded it with the installed Chrome headless executable.

- Result: `passed`
- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`
- URL: `http://127.0.0.1:4191/`
- Chrome exit code: `0`
- DOM validation: passed (`OpenENTC Studio` and `Mission control` present)
- Accessibility smoke assertions: passed for the labelled Engineering modules navigation, Command palette control and Project name control.
- DOM bytes: `13,425`
- Wall-clock launch/load/DOM time: `2,924.11 ms` on the latest rerun; earlier runs were `2,703.21 ms` and `21,727.73 ms`. The variance reflects the shared Chrome host and is informational, not a performance qualification budget.

This is a reproducible browser-load plus small DOM accessibility smoke on this Windows host. It is not a frame-latency, interaction-latency, memory, low-spec, cross-platform, or WCAG qualification, so those release gates remain open.
