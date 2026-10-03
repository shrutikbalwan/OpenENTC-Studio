// Browser test harness (Playwright core + node:test).
//
// - Serves the built dist/ folder (what ships) on an ephemeral 127.0.0.1 port.
// - Launches Chromium: OPENENTC_CHROME if set, otherwise Playwright's downloaded browser
//   (`npx playwright-core install chromium`). Adds --no-sandbox only when running as root.
// - Each test gets a fresh context with the clock and Math.random pinned, no network beyond the
//   local server (other origins are aborted unless a test routes them), and a trace that is saved to
//   test-results/e2e/ only when the test fails, together with a screenshot.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createStaticServer } from '../../scripts/server.mjs';

export const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const resultsDir = resolve(root, 'test-results', 'e2e');

let shared = null;

/** Start (once per file) the server and browser. Call `stop()` in an `after` hook. */
export async function start() {
  if (shared) return shared;
  const server = await createStaticServer(resolve(root, process.env.OPENENTC_E2E_ROOT || 'dist'));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.OPENENTC_CHROME || undefined,
    args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
  });
  shared = { server, browser, url };
  return shared;
}

export async function stop() {
  if (!shared) return;
  await shared.browser.close();
  if (shared.server.listening) await new Promise((done) => shared.server.close(done));
  shared = null;
}

/** Take the server down (real offline: nothing on 127.0.0.1 answers any more). */
export async function stopServer() {
  if (!shared?.server.listening) return;
  shared.server.closeAllConnections();
  await new Promise((done) => shared.server.close(done));
}

const PIN_TIME_AND_RANDOMNESS = () => {
  let seed = 7;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
};

/**
 * Run `fn(page, context)` in a fresh browser context. On failure the trace and a screenshot are
 * written to test-results/e2e/<name>.{zip,png} and the error is rethrown.
 * @param {import('node:test').TestContext} t
 * @param {(page: import('playwright-core').Page, context: import('playwright-core').BrowserContext) => Promise<void>} fn
 * @param {{ viewport?: { width: number, height: number }, colorScheme?: 'light' | 'dark', allowServiceWorkers?: boolean, acceptDownloads?: boolean }} [options]
 */
export async function withPage(t, fn, { viewport = { width: 1400, height: 900 }, colorScheme = 'dark', allowServiceWorkers = false, acceptDownloads = true } = {}) {
  const { browser, url } = await start();
  const context = await browser.newContext({ viewport, colorScheme, timezoneId: 'UTC', locale: 'en-US', acceptDownloads, serviceWorkers: allowServiceWorkers ? 'allow' : 'block' });
  await context.addInitScript(PIN_TIME_AND_RANDOMNESS);
  // No test may reach the network: only the local server is allowed unless a test routes an origin.
  await context.route((target) => !target.href.startsWith(url), (route) => route.abort('blockedbyclient'));
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.appUrl = url;
  page.pageErrors = pageErrors;
  try {
    await fn(page, context);
    if (pageErrors.length) throw new Error(`Uncaught page errors: ${pageErrors.join(' | ')}`);
    await context.tracing.stop();
  } catch (error) {
    mkdirSync(resultsDir, { recursive: true });
    const name = t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 80);
    await page.screenshot({ path: resolve(resultsDir, `${name}.png`), fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: resolve(resultsDir, `${name}.zip`) }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

/** Open the app on a fresh profile and wait for the shell. */
export async function openApp(page, path = '') {
  await page.goto(`${page.appUrl}${path}`);
  await page.waitForSelector('.app-shell');
}

/** Click a module in the sidebar and wait until it is active. */
export async function openModule(page, id) {
  await page.click(`.sidebar [data-module="${id}"]`);
  await page.waitForSelector(`.sidebar [data-module="${id}"].active`);
}

/** Current toast text (or ''), after it appears. */
export async function toastText(page) {
  const toast = page.locator('.toast').last();
  await toast.waitFor({ state: 'visible', timeout: 5000 });
  return (await toast.innerText()).replace(/\s+/g, ' ').trim();
}

/** The project as stored in localStorage. */
export const storedProject = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('openentc-studio-project-v1') || 'null'));
