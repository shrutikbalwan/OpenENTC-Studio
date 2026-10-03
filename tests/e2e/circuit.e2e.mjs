// Critical Circuit Lab journeys: start-up, first run, building a voltage divider from an empty
// canvas, DC simulation with a checked result, editing and re-running, saving and reopening.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, openModule, stop, storedProject, toastText, withPage } from './harness.mjs';

after(stop);

/** Read every "V(node)" / "I(part)" readout in the results panel as numbers with units. */
async function readResults(page) {
  await page.waitForSelector('.results .result-summary');
  return page.$$eval('.results .result-value', (rows) => Object.fromEntries(rows.map((row) => [row.querySelector('span').textContent, row.querySelector('b').textContent])));
}

async function setPartField(page, id, field, value) {
  await page.click(`[data-component-id="${id}"]`);
  const input = page.locator(`[data-part-field="${field}"]`);
  await input.fill(String(value));
  await input.press('Tab'); // change → updateProject → synchronous re-render
}

const volts = (text) => { const m = /^(-?[\d.]+)\s*(m|µ)?V$/.exec(text); assert.ok(m, `voltage readout: ${text}`); return Number(m[1]) * (m[2] === 'm' ? 1e-3 : m[2] === 'µ' || m[2] === 'u' ? 1e-6 : 1); };

test('application starts on Mission control with the starter project and no errors', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    assert.match(await page.locator('.workspace h1').innerText(), /Mission control/i);
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'My first ENTC lab');
    assert.equal(await page.locator('.sidebar [data-module]').count() > 40, true, 'every module is reachable from the sidebar');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  });
});

test('first run: the starter project opens in Circuit Lab and the quick-start result is 6 V', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.getByText('Open Circuit Lab').first().click();
    await page.waitForSelector('[data-action="simulate"]');
    await page.click('[data-action="simulate"]');
    const results = await readResults(page);
    assert.equal(results['V(out)'], '6 V');
    assert.equal(results['I(R1)'], '3 mA');
  });
});

test('build a voltage divider on an empty canvas, run DC, edit a value and re-run', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'circuit');
    await page.click('[data-action="clear-circuit"]');
    assert.equal(await page.locator('[data-component-id]').count(), 0, 'canvas is empty');
    await page.click('[data-add-component="voltage"]');
    await page.click('[data-add-component="resistor"]');
    await page.click('[data-add-component="resistor"]');
    await page.waitForSelector('[data-component-id="R2"]');
    await setPartField(page, 'V1', 'value', '12');
    await setPartField(page, 'V1', 'n1', 'vin');
    await setPartField(page, 'R1', 'n1', 'vin');
    await setPartField(page, 'R1', 'n2', 'mid');
    await setPartField(page, 'R1', 'value', '10k');
    await setPartField(page, 'R2', 'n1', 'mid');
    await setPartField(page, 'R2', 'value', '5k');
    const circuit = (await storedProject(page)).circuit.components.map((p) => `${p.id}:${p.value}:${p.n1}-${p.n2}`).sort();
    assert.deepEqual(circuit, ['R1:10000:vin-mid', 'R2:5000:mid-0', 'V1:12:vin-0']);
    await page.click('[data-action="simulate"]');
    let results = await readResults(page);
    assert.equal(results['V(mid)'], '4 V', '12 V × 5k / 15k');
    assert.equal(results['I(R1)'], '800 uA', 'the app writes micro as u');
    // Edit and re-run.
    await setPartField(page, 'R2', 'value', '10k');
    await page.click('[data-action="simulate"]');
    results = await readResults(page);
    assert.equal(results['V(mid)'], '6 V', '12 V × 10k / 20k');
  });
});

test('a saved project survives a reload with its edits', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await page.fill('[data-field="project-name"]', 'Reload check');
    await page.press('[data-field="project-name"]', 'Tab');
    await openModule(page, 'circuit');
    await setPartField(page, 'R2', 'value', '4.7k');
    await page.click('[data-action="save-local"]');
    assert.match(await toastText(page), /saved/i);
    await page.reload();
    await page.waitForSelector('.app-shell');
    assert.equal(await page.inputValue('[data-field="project-name"]'), 'Reload check');
    const r2 = (await storedProject(page)).circuit.components.find((p) => p.id === 'R2');
    assert.equal(r2.value, 4700);
    await openModule(page, 'circuit');
    await page.click('[data-action="simulate"]');
    const results = await readResults(page);
    assert.ok(Math.abs(volts(results['V(out)']) - 9 * 4.7 / 5.7) < 1e-3, `V(out) = 9 V × 4.7k / 5.7k, got ${results['V(out)']}`);
  });
});
