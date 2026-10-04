// Offline journey with a real service worker. Chromium's offline emulation does not block
// 127.0.0.1, so the test stops the server instead: afterwards only the service-worker cache can
// answer.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, openModule, stop, stopServer, withPage } from './harness.mjs';

after(stop);

test('after one visit the studio reloads and runs a simulation with the server gone', async (t) => {
  await withPage(t, async (page, context) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
    const cached = await page.evaluate(async () => (await (await caches.open('openentc-studio-v2')).keys()).length);
    assert.ok(cached > 150, `every web asset is precached (${cached})`);
    await stopServer();
    await context.setOffline(true);
    const offlinePage = await context.newPage();
    const failures = [];
    offlinePage.on('requestfailed', (request) => failures.push(new URL(request.url()).pathname));
    await offlinePage.goto(page.appUrl);
    await offlinePage.waitForSelector('.app-shell');
    await openModule(offlinePage, 'circuit');
    await offlinePage.click('[data-action="simulate"]');
    await offlinePage.waitForSelector('.results .result-summary');
    assert.match(await offlinePage.locator('.results').innerText(), /V\(out\)\s*6 V/);
    for (const id of ['dsp', 'mcu', 'pcb', 'learn']) await openModule(offlinePage, id);
    assert.deepEqual(failures, [], 'no request failed');
  }, { allowServiceWorkers: true });
});
