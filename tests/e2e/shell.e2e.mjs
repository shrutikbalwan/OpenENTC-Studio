// Application-wide journeys: keyboard-only use, light and dark themes, a narrow phone screen and
// visible recovery from bad input.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, openModule, stop, storedProject, toastText, withPage } from './harness.mjs';

after(stop);

const focused = (page) => page.evaluate(() => { const el = document.activeElement; return el ? { tag: el.tagName, module: el.dataset?.module ?? null, action: el.dataset?.action ?? null, cls: el.className } : null; });

test('keyboard only: reach a module with Tab, open it with Enter, use the command palette and undo', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    let reached = null;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      const now = await focused(page);
      if (now?.module === 'circuit') reached = now;
    }
    assert.ok(reached, 'the Circuit Lab navigation button is reachable with Tab');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.sidebar [data-module="circuit"].active');
    // Command palette: Ctrl+K opens a modal dialog with focus inside; Escape closes it.
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.modal[role="dialog"]');
    assert.match((await focused(page)).cls, /modal-close/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal-layer[hidden]', { state: 'attached' });
    // Select a part and move it with the arrow keys; Ctrl+Z undoes the move.
    await page.click('[data-component-id="R1"]');
    const before = (await storedProject(page)).circuit.components.find((p) => p.id === 'R1');
    await page.keyboard.press('ArrowRight');
    const moved = (await storedProject(page)).circuit.components.find((p) => p.id === 'R1');
    assert.ok(moved.x > before.x, 'arrow key moves the selected part');
    await page.keyboard.press('Control+z');
    assert.match(await toastText(page), /undone/);
    const undone = (await storedProject(page)).circuit.components.find((p) => p.id === 'R1');
    assert.equal(undone.x, before.x);
  });
});

test('light and dark themes switch, change the page colours and persist across a reload', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    const dark = await background();
    await page.click('[data-action="theme"]');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
    const light = await background();
    assert.notEqual(light, dark, 'the page background changes');
    await page.reload();
    await page.waitForSelector('.app-shell');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'the choice is saved with the project');
    await page.click('[data-action="theme"]');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  });
});

test('narrow phone screen: no sideways scrolling, navigation and the main action stay usable', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(await overflow() <= 1, `home page fits (${await overflow()} px overflow)`);
    const nav = page.locator('.sidebar [data-module="circuit"]');
    await nav.scrollIntoViewIfNeeded();
    assert.ok(await nav.isVisible(), 'navigation is visible');
    await nav.click();
    await page.waitForSelector('.sidebar [data-module="circuit"].active');
    const run = page.locator('[data-action="simulate"]');
    await run.scrollIntoViewIfNeeded();
    assert.ok(await run.isVisible(), 'Run DC analysis is reachable');
    await run.click();
    await page.waitForSelector('.results .result-summary');
    assert.ok(await overflow() <= 1, `Circuit Lab fits (${await overflow()} px overflow)`);
  }, { viewport: { width: 375, height: 812 } });
});

test('bad input is reported, the old value is kept, and a broken tab can be reset to its example', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'machines');
    const kva = page.locator('[data-mach-field="transformer.kva"]');
    // Not a number: rejected with a hint and the saved value stays.
    await kva.fill('twenty');
    await kva.press('Tab');
    assert.match(await toastText(page), /Rating: enter a number such as/);
    assert.equal(await page.inputValue('[data-mach-field="transformer.kva"]'), '20');
    // A number the model rejects: the tab shows an error panel with a reset button.
    await kva.fill('-5');
    await kva.press('Tab');
    const panel = page.locator('.workspace .diagnostic.error');
    await panel.waitFor();
    assert.match(await panel.innerText(), /positive/i);
    await page.click('[data-mach-reset]');
    await page.waitForSelector('.workspace .diagnostic.error', { state: 'detached' });
    assert.equal(await page.inputValue('[data-mach-field="transformer.kva"]'), '20', 'reset restores the example');
  });
});
