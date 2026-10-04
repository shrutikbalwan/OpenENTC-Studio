// Browser performance budgets: start-up and switching between labs. Budgets are several times the times
// measured on 2026-10-04 in headless Chromium, so they catch large regressions without flaking on
// slower CI machines. See docs/PERFORMANCE-BUDGETS.md.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { stop, withPage } from './harness.mjs';

after(stop);

test('start-up and lab switching stay within their budgets', async (t) => {
  await withPage(t, async (page) => {
    const started = Date.now();
    await page.goto(page.appUrl);
    await page.waitForSelector('.app-shell');
    const startup = Date.now() - started;
    assert.ok(startup < 5000, `start-up took ${startup} ms; budget 5000 ms`);
    const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll('.sidebar [data-module]')].map((e) => e.dataset.module))]);
    const slow = [];
    let worst = 0;
    for (const id of ids) {
      const ms = await page.evaluate((m) => { const t0 = performance.now(); document.querySelector(`.sidebar [data-module="${m}"]`).click(); return performance.now() - t0; }, id);
      worst = Math.max(worst, ms);
      if (ms > 1000) slow.push(`${id}: ${ms.toFixed(0)} ms`);
    }
    t.diagnostic(`start-up ${startup} ms; slowest lab switch ${worst.toFixed(0)} ms`);
    assert.deepEqual(slow, [], 'every lab renders within 1000 ms of the click');
  });
});
