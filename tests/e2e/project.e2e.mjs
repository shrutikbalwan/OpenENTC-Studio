// Project-file journeys: export and re-import a packaged .entcproj, reject malformed and oversized
// files without touching the open project, migrate an older project, and recover from corrupt or
// interrupted browser storage.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApp, openModule, stop, storedProject, toastText, withPage } from './harness.mjs';

after(stop);

const KEY = 'openentc-studio-project-v1';

async function importFile(page, name, buffer, mimeType = 'application/octet-stream') {
  await page.setInputFiles('#project-import', { name, mimeType, buffer });
}

test('export a packaged .entcproj, change the project, then import the file back', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.fill('[data-field="project-name"]', 'Round trip');
    await page.press('[data-field="project-name"]', 'Tab');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
    assert.match(download.suggestedFilename(), /\.entcproj$/);
    const bytes = readFileSync(await download.path());
    assert.equal(bytes.subarray(0, 2).toString('latin1'), 'PK', 'a ZIP container');
    assert.ok(bytes.length < 200_000);
    // Change the open project, then restore it from the export.
    await page.fill('[data-field="project-name"]', 'Changed');
    await page.press('[data-field="project-name"]', 'Tab');
    await importFile(page, download.suggestedFilename(), bytes);
    assert.match(await toastText(page), /Project imported/);
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'Round trip');
    assert.equal((await storedProject(page)).circuit.components.length, 4);
  });
});

test('malformed and oversized files are rejected with a message and the open project is kept', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.fill('[data-field="project-name"]', 'Keep me');
    await page.press('[data-field="project-name"]', 'Tab');
    const cases = [
      ['broken.entc.json', Buffer.from('{ not json'), /JSON|invalid/i],
      ['wrong-shape.entc.json', Buffer.from(JSON.stringify({ format: 'openentc-project', version: 1, name: 'x' })), /invalid|components|createdAt/i],
      ['future.entc.json', Buffer.from(JSON.stringify({ format: 'openentc-project', version: 99, name: 'x' })), /version 99 is not supported/i],
      ['not-a-zip.entcproj', Buffer.from('this is not a zip archive'), /archive|zip|invalid/i],
      ['huge.entc.json', Buffer.alloc(10 * 1024 * 1024 + 10, 0x20), /exceeds the 10 MB limit/],
    ];
    for (const [name, bytes, message] of cases) {
      await importFile(page, name, bytes);
      const text = await toastText(page);
      assert.match(text, message, `${name}: ${text}`);
      assert.equal(await page.inputValue('[data-field="project-name"]'), 'Keep me', `${name} left the project unchanged`);
      await page.evaluate(() => document.querySelector('.toast')?.remove());
    }
    assert.equal((await storedProject(page)).name, 'Keep me');
  });
});

test('an older (version 0) project imports through migration with its data intact', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    const legacy = {
      name: 'Legacy lab', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z',
      circuit: { components: [{ id: 'V1', type: 'voltage', label: 'V1', value: 5, unit: 'V', n1: 'a', n2: '0', x: 100, y: 100 }, { id: 'R1', type: 'resistor', label: 'R1', value: 100, unit: 'Ω', n1: 'a', n2: '0', x: 200, y: 100 }], signal: { shape: 'sine', frequency: 1000, amplitude: 1, offset: 0 } },
      embedded: { board: 'Arduino Uno', language: 'C++', code: '' }, settings: { theme: 'light', grid: true },
    };
    await importFile(page, 'legacy.entc.json', Buffer.from(JSON.stringify(legacy)), 'application/json');
    assert.match(await toastText(page), /Project imported/);
    const project = await storedProject(page);
    assert.equal(project.version, 1, 'migrated to the current version');
    assert.equal(project.format, 'openentc-project');
    assert.deepEqual(project.circuit.wires, [], 'missing collections are added');
    assert.equal(project.settings.gridSize, 20);
    assert.deepEqual(project.circuit.components.map((p) => p.id), ['V1', 'R1'], 'authored data kept');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'settings kept');
    await openModule(page, 'circuit');
    await page.click('[data-action="simulate"]');
    await page.waitForSelector('.results .result-summary');
    assert.match(await page.locator('.results').innerText(), /I\(R1\)\s*50 mA/);
  });
});

test('corrupt stored project: the app starts with a fresh project, keeps a backup and says so', async (t) => {
  await withPage(t, async (page, context) => {
    await context.addInitScript((key) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{"format":"openentc-project", truncated'); sessionStorage.setItem('seeded', '1'); } }, KEY);
    await openApp(page);
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'Untitled ENTC project', 'a fresh project is opened');
    assert.match(await page.locator('.project-title .saved').innerText(), /Save failed/);
    assert.match(await page.locator('.project-title .saved').getAttribute('title'), /corrupt backup was retained/);
    assert.equal(await page.evaluate((key) => localStorage.getItem(`${key}-corrupt-backup`), KEY), '{"format":"openentc-project", truncated', 'the damaged data is preserved');
    // Saving again works and clears the error state.
    await page.click('[data-action="save-local"]');
    assert.match(await toastText(page), /saved/i);
    assert.match(await page.locator('.project-title .saved').innerText(), /Saved locally/);
  });
});

test('interrupted write: a valid pending temporary record is recovered on the next start', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.click('[data-action="save-local"]');
    const pending = { ...(await storedProject(page)), name: 'Recovered after crash', updatedAt: '2026-10-03T12:00:00.000Z' };
    await page.evaluate(([key, value]) => { localStorage.setItem(`${key}-write-temp`, value); localStorage.setItem(key, '{"broken"'); }, [KEY, JSON.stringify(pending)]);
    await page.reload();
    await page.waitForSelector('.app-shell');
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'Recovered after crash');
    assert.equal(await page.evaluate((key) => localStorage.getItem(`${key}-write-temp`), KEY), null, 'the temporary record is cleared');
  });
});
