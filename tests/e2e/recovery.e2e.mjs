// Recovery journeys: inspect, download, delete and restore the backups kept in browser storage.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openApp, stop, toastText, withPage } from './harness.mjs';

after(stop);
const KEY = 'openentc-studio-project-v1';

async function openBackups(page) {
  await page.click('[data-action="help"]');
  await page.click('[data-help-diagnostics]');
  await page.waitForSelector('[data-diagnostics]');
}

test('a damaged project is listed as a backup that can be downloaded and then deleted', async (t) => {
  await withPage(t, async (page, context) => {
    await context.addInitScript((key) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{"format":"openentc-project", truncated'); sessionStorage.setItem('seeded', '1'); } }, KEY);
    await openApp(page);
    await openBackups(page);
    const item = page.locator('[data-backup="corrupt"]');
    assert.match(await item.innerText(), /Damaged project[\s\S]*Cannot be opened/);
    assert.equal(await page.locator('[data-backup-restore="corrupt"]').count(), 0, 'a damaged backup cannot be opened');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-backup-download="corrupt"]')]);
    assert.equal(download.suggestedFilename(), 'openentc-backup-corrupt.json');
    assert.equal(await readFile(await download.path(), 'utf8'), '{"format":"openentc-project", truncated', 'the original bytes, for salvage');
    await page.click('[data-backup-delete="corrupt"]');
    assert.match(await page.locator('[data-backup-delete="corrupt"]').innerText(), /Delete for good/, 'deleting asks twice');
    await page.click('[data-backup-delete="corrupt"]');
    await page.waitForSelector('[data-backup="corrupt"]', { state: 'detached' });
    assert.equal(await page.evaluate((key) => localStorage.getItem(`${key}-corrupt-backup`), KEY), null);
  });
});

test('a valid backup can be opened, and Ctrl+Z returns to the project it replaced', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.click('[data-action="save-local"]');
    await toastText(page);
    // A backup made from a real saved project, in the older shape (no "notes" field).
    await page.evaluate((key) => {
      const legacy = JSON.parse(localStorage.getItem(key));
      legacy.name = 'Old lab';
      delete legacy.notes;
      localStorage.setItem(`${key}-migration-backup`, JSON.stringify(legacy));
    }, KEY);
    const current = await page.inputValue('[data-field="project-name"]');
    await openBackups(page);
    const item = page.locator('[data-backup="migration"]');
    assert.match(await item.innerText(), /Before the last format upgrade[\s\S]*Old lab/);
    await page.click('[data-backup-restore="migration"]');
    assert.match(await toastText(page), /Opened the backup "Old lab"/);
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'Old lab');
    await page.keyboard.press('Control+z');
    assert.equal(await page.inputValue('[data-field="project-name"]'), current, 'undo returns to the previous project');
  });
});
