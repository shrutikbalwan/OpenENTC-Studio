// Automated accessibility checks with axe-core (WCAG 2.0/2.1/2.2 A and AA rules) on every module in
// both themes, text alternatives for every graphic, the skip link, and reflow at phone and tablet
// widths. Automated checks find only part of the problems: they do not make the product WCAG
// conformant. See docs/accessibility.md for what is and is not covered.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openApp, root, stop, withPage } from './harness.mjs';

after(stop);

const AXE = readFileSync(resolve(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Documented exception (docs/accessibility.md): circuit pins are 10 px and sit 11 px apart on
// transistors. WCAG 2.5.8 allows this because the inspector's wire buttons do the same job.
const EXCLUDE = [['.canvas-pin']];

async function axeViolations(page) {
  // page.evaluate is not subject to the page's Content Security Policy, unlike an injected script tag.
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(AXE);
  return page.evaluate(async ({ tags, exclude }) => {
    const result = await window.axe.run({ exclude }, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
  }, { tags: TAGS, exclude: EXCLUDE });
}

const moduleIds = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('.sidebar [data-module]')].map((e) => e.dataset.module))]);

async function openEach(page, visit) {
  for (const id of await moduleIds(page)) {
    await page.evaluate((m) => document.querySelector(`.sidebar [data-module="${m}"]`)?.click(), id);
    await page.waitForFunction((m) => document.querySelector(`.sidebar [data-module="${m}"]`)?.classList.contains('active'), id);
    await visit(id);
  }
}

for (const theme of ['dark', 'light']) {
  test(`axe finds no WCAG A/AA violations on any module (${theme} theme)`, async (t) => {
    await withPage(t, async (page) => {
      await openApp(page);
      if (theme === 'light') { await page.click('[data-action="theme"]'); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); }
      const problems = [];
      for (const v of await axeViolations(page)) problems.push(`home: ${v}`);
      await openEach(page, async (id) => { for (const v of await axeViolations(page)) problems.push(`${id}: ${v}`); });
      assert.deepEqual(problems, []);
    });
  });
}

test('axe finds no violations in the command palette, help dialog and AI assistant panel', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.modal[role="dialog"]');
    assert.deepEqual(await axeViolations(page), [], 'command palette');
    await page.keyboard.press('Escape');
    await page.click('[data-action="help"]');
    await page.waitForSelector('.modal[role="dialog"]');
    assert.deepEqual(await axeViolations(page), [], 'help dialog');
    await page.keyboard.press('Escape');
    await page.click('[data-ai-open]');
    await page.waitForSelector('[data-ai-setting="provider"]');
    assert.deepEqual(await axeViolations(page), [], 'assistant settings');
  });
});

test('every graphic has a text alternative or is marked decorative', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const unnamed = () => page.evaluate(() => [...document.querySelectorAll('svg, canvas, img')].filter((el) => {
      if (el.closest('[aria-hidden="true"]')) return false;
      if (el.tagName === 'IMG') return !el.hasAttribute('alt');
      if (el.getAttribute('role') === 'img' && (el.getAttribute('aria-label') || el.querySelector('title'))) return false;
      const labelled = el.parentElement?.closest('[aria-label], button, a, [role="img"]');
      return !labelled;
    }).map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') || ''}`));
    const problems = (await unnamed()).map((item) => `home: ${item}`);
    await openEach(page, async (id) => { for (const item of await unnamed()) problems.push(`${id}: ${item}`); });
    assert.deepEqual(problems, []);
  });
});

test('the first Tab reaches "Skip to the lab", which moves focus to the workspace', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'skip-to-main');
    assert.ok(await page.evaluate(() => document.activeElement.getBoundingClientRect().top >= 0), 'the skip link is visible when focused');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');
  });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`no module scrolls sideways at ${viewport.width} px (WCAG 1.4.10 reflow)`, async (t) => {
    await withPage(t, async (page) => {
      await openApp(page);
      const overflow = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
      const problems = [];
      if (await overflow() > 1) problems.push('home');
      await openEach(page, async (id) => { const extra = await overflow(); if (extra > 1) problems.push(`${id} (+${extra}px)`); });
      assert.deepEqual(problems, []);
    }, { viewport });
  });
}
