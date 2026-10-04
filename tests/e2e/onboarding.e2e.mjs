// First-run guide, example library, help limits and the diagnostics centre with its redacted report.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openApp, openModule, stop, storedProject, toastText, withPage } from './harness.mjs';

after(stop);

test('first run: the guide loads an example, remembers progress and can be hidden for good', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const guide = page.locator('[data-onboarding]');
    await guide.waitFor();
    assert.match(await guide.innerText(), /0 of 4 done/);
    await page.click('[data-onboarding-step="example"]');
    await page.waitForSelector('.sidebar [data-module="circuit"].active');
    await page.waitForSelector('[data-component-id="C1"]');
    assert.ok((await storedProject(page)).circuit.components.some((part) => part.id === 'C1'), 'the RC low-pass example is in the project');
    await page.click('[data-action="home"]');
    assert.match(await page.locator('[data-onboarding]').innerText(), /1 of 4 done/);
    await page.click('[data-onboarding-step="limits"]');
    const help = page.locator('.modal[role="dialog"]');
    assert.match(await help.innerText(), /educational models/);
    await page.keyboard.press('Escape');
    await page.click('[data-onboarding-dismiss]');
    await page.waitForSelector('[data-onboarding]', { state: 'detached' });
    await page.reload();
    await page.waitForSelector('.app-shell');
    assert.equal(await page.locator('[data-onboarding]').count(), 0, 'a hidden guide stays hidden');
    assert.ok(await page.locator('.example-library').count(), 'the example library is still there');
  });
});

test('example library: circuit examples load into the Circuit Lab and other cards open their labs', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const cards = page.locator('[data-home-example]');
    assert.ok(await cards.count() >= 5, 'several circuit examples');
    const id = await cards.nth(1).getAttribute('data-home-example');
    await cards.nth(1).click();
    await page.waitForSelector('.sidebar [data-module="circuit"].active');
    assert.match(await toastText(page), /loaded/);
    await page.click('[data-action="home"]');
    await page.click('.example-card[data-module="fpga"]');
    await page.waitForSelector('.sidebar [data-module="fpga"].active');
    assert.ok(id);
  });
});

test('diagnostics: errors appear with recovery hints, and the report hides keys, names and paths', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.fill('[data-field="project-name"]', 'Priya secret project');
    await page.press('[data-field="project-name"]', 'Tab');
    // Store an API key for this tab, then produce an error.
    await page.click('[data-ai-open]');
    await page.fill('[data-ai-setting="apiKey"]', 'sk-test-abcdefghijklmnopqrstuv');
    await page.press('[data-ai-setting="apiKey"]', 'Tab');
    await page.click('[data-ai-close]');
    await openModule(page, 'machines');
    await page.fill('[data-mach-field="transformer.kva"]', 'twenty');
    await page.press('[data-mach-field="transformer.kva"]', 'Tab');
    await toastText(page);
    // Open diagnostics from the command palette.
    await page.keyboard.press('Control+k');
    await page.click('[data-command-diagnostics]');
    const dialog = page.locator('[data-diagnostics]');
    await dialog.waitFor();
    const text = await dialog.innerText();
    assert.match(text, /Project storage\s+saved/);
    assert.match(text, /Rating: enter a number such as/);
    const preview = await page.locator('[data-diag-json]').innerText();
    const report = JSON.parse(preview);
    assert.equal(report.format, 'openentc-diagnostics');
    assert.equal(report.app.version, '0.1.0');
    for (const leaked of ['sk-test-abcdefghijklmnopqrstuv', 'Priya', 'secret project']) assert.ok(!preview.includes(leaked), `report must not contain ${leaked}`);
    assert.equal(report.assistant.apiKeySet, true);
    // The download is exactly the preview.
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-diag="download"]')]);
    assert.match(download.suggestedFilename(), /^openentc-diagnostics-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(await readFile(await download.path(), 'utf8'), preview);
    // Clearing errors re-renders the centre without them.
    await page.click('[data-diag="clear"]');
    await page.waitForSelector('.diag-empty');
    // The issue link opens the public tracker in a new tab without an opener.
    const link = page.locator('[data-diagnostics] a[target="_blank"]');
    assert.match(await link.getAttribute('href'), /^https:\/\/github\.com\/shrutikbalwan\/OpenENTC-Studio\/issues\/new\/choose$/);
    assert.match(await link.getAttribute('rel'), /noopener/);
  });
});
