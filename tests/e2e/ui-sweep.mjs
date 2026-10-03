#!/usr/bin/env node
// UI sweep and render snapshot (opt-in; needs Playwright and a Chromium build).
//
//   OPENENTC_E2E_URL=http://127.0.0.1:4173/ node tests/e2e/ui-sweep.mjs [--snapshot out.json] [--compare base.json]
//
// It opens every module and every lab tab in a fresh project and fails on page errors, console
// errors, near-empty workspaces or error panels. With --snapshot it records a hash of the rendered
// shell HTML per view (randomness and the clock are pinned). With --compare it reports views whose
// HTML changed. This is the behaviour-preservation check for UI refactoring: a pure code move must
// produce identical HTML.
//
// Views that change on their own while displayed (running simulations) are recorded as 'live' and
// ignored by --compare; UNSTABLE lists any other view known to vary between runs.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const UNSTABLE = new Set();

const require = createRequire(import.meta.url);
const playwrightPath = process.env.OPENENTC_PLAYWRIGHT || `${execSync('npm root -g').toString().trim()}/playwright`;
const { chromium } = require(playwrightPath);
const url = process.env.OPENENTC_E2E_URL || 'http://127.0.0.1:4173/';
const option = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

const browser = await chromium.launch({ executablePath: process.env.OPENENTC_CHROME || undefined, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'UTC', locale: 'en-US' });
await context.addInitScript(() => {
  let seed = 1;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const RealDate = Date, fixed = 1790000000000;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
await page.goto(url);
await page.waitForSelector('.app-shell');

// Wait until the DOM stops changing for two animation frames (renders are synchronous, but some
// views schedule a follow-up paint).
const settle = () => page.evaluate(() => new Promise((resolve) => { let last = document.body.innerHTML.length, stable = 0; const tick = () => { const now = document.body.innerHTML.length; stable = now === last ? stable + 1 : 0; last = now; if (stable >= 2) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
// A view is "live" when it changes on its own (running simulations, animation frames); its hash
// is recorded as 'live' and --compare ignores it.
const viewHash = async () => { const first = await hash(); await page.waitForTimeout(300); const second = await hash(); return first === second ? first : 'live'; };
const hash = async () => createHash('sha256').update(await page.evaluate(() => document.querySelector('.app-shell').outerHTML.replace(/blob:[^"']+/g, 'blob:x'))).digest('hex').slice(0, 16);
const modules = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-module]')].map((element) => element.dataset.module))]);
const snapshot = { home: await hash() };
const problems = [];
let tabCount = 0;
for (const module of modules) {
  const before = errors.length;
  await page.evaluate((id) => document.querySelector(`.sidebar [data-module="${id}"]`)?.click(), module);
  await page.waitForFunction((id) => document.querySelector(`.sidebar [data-module="${id}"]`)?.classList.contains('active'), module, { timeout: 5000 }).catch(() => problems.push(`${module}: module did not open`));
  await settle();
  snapshot[module] = await viewHash();
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.workspace [role="tab"]')].map((tab) => { const attribute = [...tab.attributes].find((a) => a.name.startsWith('data-')); return attribute ? [attribute.name, attribute.value] : null; }).filter(Boolean));
  for (const [attribute, value] of tabs) {
    await page.evaluate(([a, v]) => document.querySelector(`.workspace [${a}="${v}"]`)?.click(), [attribute, value]);
    await page.waitForFunction(([a, v]) => document.querySelector(`.workspace [${a}="${v}"]`)?.getAttribute('aria-selected') === 'true', [attribute, value], { timeout: 5000 }).catch(() => problems.push(`${module}/${value}: tab did not become selected`));
    await settle();
    snapshot[`${module}/${attribute}=${value}`] = await viewHash();
    tabCount += 1;
    const panels = await page.evaluate(() => document.querySelectorAll('.workspace .diagnostic.error').length);
    if (panels) problems.push(`${module}/${value}: ${panels} error panel(s)`);
  }
  const textLength = await page.evaluate(() => document.querySelector('.workspace')?.innerText.length || 0);
  if (textLength < 200) problems.push(`${module}: workspace nearly empty (${textLength} characters)`);
  if (errors.length > before) problems.push(`${module}: ${errors.slice(before).join(' | ')}`);
}
await browser.close();

const report = { url, modules: modules.length, tabs: tabCount, views: Object.keys(snapshot).length, problems };
const snapshotPath = option('--snapshot');
if (snapshotPath) writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 1)}\n`);
const comparePath = option('--compare');
if (comparePath) {
  const base = JSON.parse(readFileSync(comparePath, 'utf8'));
  report.changedViews = Object.keys({ ...base, ...snapshot }).filter((key) => !UNSTABLE.has(key) && base[key] !== 'live' && snapshot[key] !== 'live' && base[key] !== snapshot[key]);
  report.liveViews = Object.keys(snapshot).filter((key) => snapshot[key] === 'live');
}
console.log(JSON.stringify(report, null, 2));
if (problems.length || report.changedViews?.length) process.exit(1);
