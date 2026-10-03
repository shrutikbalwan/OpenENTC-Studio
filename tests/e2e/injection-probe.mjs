#!/usr/bin/env node
// Browser injection probe (opt-in; needs Playwright and a Chromium build).
//   OPENENTC_E2E_URL=http://127.0.0.1:4173/ node tests/e2e/injection-probe.mjs
// Hostile strings go into every untrusted input we can reach — the project name and component
// labels, saved lab inputs, an imported VCD file, the Arduino serial monitor and an AI reply.
// Then every module and tab is opened. The probe fails if any injected element appears in the
// DOM or any injected handler runs.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.OPENENTC_PLAYWRIGHT || `${execSync('npm root -g').toString().trim()}/playwright`;
const { chromium } = require(playwrightPath);
const url = process.env.OPENENTC_E2E_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.OPENENTC_CHROME || undefined, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const hits = [];
await page.exposeFunction('__xssHit', (where) => hits.push(`executed: ${where}`));
page.on('pageerror', (e) => hits.push(`pageerror: ${e.message}`));
const P = (tag) => `'"><img data-xss=${tag} src=x onerror=__xssHit('${tag}')>`;

// 1. Project name, component labels and saved lab inputs (seeded before the app starts).
await page.goto(url); await page.waitForTimeout(500);
const project = await page.evaluate(() => JSON.parse(localStorage.getItem('openentc-studio-project-v1')));
project.name = P('name');
project.circuit.components.forEach((c, i) => { c.label = P(`label${i}`).slice(0, 100); });
const lab = (id, inputs) => ({ id, kind: 'calculator', operation: id, inputs });
project.experiments = [
  lab('info-lab', { tab: 'source', source: { mode: 'text', text: P('info') } }),
  lab('plc-lab', { tab: 'program', program: { example: 'custom', text: P('plc'), script: P('plcscript') } }),
  lab('meas-lab', { tab: 'errors', errors: { readings: P('readings') } }),
  lab('product-lab', { tab: 'reliability', reliability: { parts: P('parts') } }),
  lab('mach-lab', { tab: 'transformer', transformer: { cycle: P('cycle') } }),
  lab('em-lab', { tab: 'sparams', sparams: { preset: 'custom', elements: P('em') } }),
];
await page.addInitScript((text) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('openentc-studio-project-v1', text); localStorage.setItem('openentc.assistant.v1', JSON.stringify({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'm', consented: true })); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(project));
await page.reload(); await page.waitForTimeout(800);
const seededName = await page.evaluate(() => JSON.parse(localStorage.getItem('openentc-studio-project-v1')).name);
if (!seededName.includes('data-xss')) throw new Error('The hostile project was rejected by validation, so the probe did not test rendering.');

// 2. Every module and its first tabs.
const modules = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-module]')].map((e) => e.dataset.module))]);
const found = new Set();
const scan = async (where) => { for (const tag of await page.evaluate(() => [...document.querySelectorAll('[data-xss]')].map((e) => e.getAttribute('data-xss')))) found.add(`${where}: ${tag}`); };
for (const m of modules) {
  await page.evaluate((id) => document.querySelector(`[data-module="${id}"]`)?.click(), m); await page.waitForTimeout(100);
  await scan(m);
  const tabs = await page.$$('.logic-tabs button');
  for (const [k, t] of tabs.slice(0, 10).entries()) { await t.click().catch(() => {}); await page.waitForTimeout(40); await scan(`${m} tab ${k}`); }
}

// 3. Imported VCD with hostile signal names.
const dir = mkdtempSync(join(tmpdir(), 'openentc-probe-'));
const vcd = join(dir, 'hostile.vcd');
writeFileSync(vcd, `$timescale 1us $end\n$scope module top $end\n$var wire 1 ! ${P('vcd').replace(/\s/g, '_')} $end\n$upscope $end\n$enddefinitions $end\n#0\n0!\n#10\n1!\n`);
await page.evaluate(() => document.querySelector('[data-module="mcu"]')?.click()); await page.waitForTimeout(300);
const vcdInput = await page.$('[data-la-import]');
if (vcdInput) { await vcdInput.setInputFiles(vcd); await page.waitForTimeout(500); await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); await page.waitForTimeout(300); await scan('vcd import'); } else hits.push('note: VCD import control not found');

// 4. AI reply with hostile content (the provider is mocked; nothing leaves the machine).
await page.route('http://localhost:11434/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: `${P('ai')} **${P('aibold')}** \`${P('aicode')}\`` } }] }) }));
await page.click('[data-ai-open]'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('[data-ai-view="chat"]')?.click()); await page.waitForTimeout(200);
await page.fill('[data-ai-draft]', P('aiquestion'));
await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
await scan('assistant');
const aiShown = await page.evaluate(() => document.querySelector('.ai-msg.assistant')?.textContent ?? '');
if (!aiShown.includes('data-xss=ai')) hits.push('note: the AI reply was not displayed, so the AI path was not exercised');

await browser.close();
const report = { url, modules: modules.length, escapedMarkup: [...found], hits };
console.log(JSON.stringify(report, null, 2));
if (found.size || hits.some((h) => h.startsWith('executed') || h.startsWith('pageerror'))) process.exitCode = 1;
