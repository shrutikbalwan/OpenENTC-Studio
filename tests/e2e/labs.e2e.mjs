// Laboratory journeys with checked results: Signals FFT, Control step response, Digital Logic
// minimisation, the 8051 trainer, the Arduino Uno simulator with its serial monitor, PCB layout to a
// fabrication ZIP, and a lab-record PDF.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openApp, openModule, stop, withPage } from './harness.mjs';

after(stop);

async function setField(page, selector, value) {
  const input = page.locator(selector);
  await input.fill(String(value));
  await input.press('Tab');
}

// Readouts are rendered as <span>label</span><b|strong>value</…> pairs.
const readout = (page, label) => page.evaluate((name) => { const span = [...document.querySelectorAll('.workspace span')].find((element) => element.textContent.trim() === name); return span?.nextElementSibling?.textContent.trim() ?? null; }, label);
function maxDftMagnitude(frequency, sampleRate, length) {
  const x = Array.from({ length }, (_, n) => Math.sin(2 * Math.PI * frequency * n / sampleRate));
  let best = 0;
  for (let k = 0; k < length; k += 1) {
    let re = 0, im = 0;
    for (let n = 0; n < length; n += 1) { re += x[n] * Math.cos(2 * Math.PI * k * n / length); im -= x[n] * Math.sin(2 * Math.PI * k * n / length); }
    best = Math.max(best, Math.hypot(re, im));
  }
  return best;
}
const numberIn = (text) => Number(String(text).replace(/,/g, '').match(/-?[\d.]+(?:e-?\d+)?/i)?.[0]);

test('Signals: a bin-aligned sine gives the textbook FFT peak N/2 and moves with the frequency', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'dsp');
    // 3 kHz at 48 kHz with 256 samples lands exactly on bin 16, so |X[16]| = N/2 = 128 for the unit-
    // amplitude sine. One FIR tap makes the lab's moving-average filter the identity.
    await setField(page, '[data-dsp-field="taps"]', 1);
    await setField(page, '[data-dsp-field="frequency"]', 3000);
    await setField(page, '[data-dsp-field="sampleRate"]', 48000);
    await setField(page, '[data-dsp-field="length"]', 256);
    await page.selectOption('[data-dsp-field="window"]', 'rectangular');
    await page.click('[data-action="run-dsp"]');
    const peak = numberIn(await readout(page, 'FFT peak'));
    assert.ok(Math.abs(peak - 128) < 1e-6, `FFT peak ${peak}`);
    assert.equal(await page.locator('.workspace svg path.trace').count(), 2, 'time series and spectrum are plotted');
    assert.equal(await page.locator('.workspace svg path.spectrum-trace').count(), 1);
    // Moving off the bin grid spreads the energy (leakage), so the peak drops below N/2.
    await setField(page, '[data-dsp-field="frequency"]', 3093.75);
    await page.click('[data-action="run-dsp"]');
    const leaked = numberIn(await readout(page, 'FFT peak'));
    // Independent reference: the largest |DFT| bin of the same sine, by direct summation.
    const reference = maxDftMagnitude(3093.75, 48000, 256);
    assert.ok(Math.abs(leaked - reference) < 1e-3, `half-bin offset peak ${leaked}, direct DFT ${reference.toFixed(3)}`);
    assert.ok(leaked < 128, 'leakage lowers the peak');
  });
});

test('Control: a first-order step response settles at the gain', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'iot');
    await setField(page, '[data-control-field="gain"]', 2.5);
    await setField(page, '[data-control-field="tau"]', 0.2);
    await page.click('[data-action="run-control"]');
    assert.equal(numberIn(await readout(page, 'Final value')), 2.5);
    assert.match(await readout(page, 'Stability'), /Stable/);
  });
});

test('Digital Logic: XOR stays irreducible and the consensus term is removed', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'logic');
    await setField(page, '[data-logic-field="expression"]', "A'B + AB'");
    let text = await page.locator('.workspace').innerText();
    assert.match(text, /Σm\(1, 2\)/);
    assert.match(text, /MINIMAL SOP\s*F = AB' \+ A'B/);
    assert.match(text, /MINIMAL POS\s*F = \(A' \+ B'\)\(A \+ B\)/);
    await setField(page, '[data-logic-field="expression"]', "AB + A'C + BC");
    text = await page.locator('.workspace').innerText();
    assert.match(text, /MINIMAL SOP\s*F = AB \+ A'C/, 'BC is the redundant consensus term');
  });
});

test('8051: the running-lights example assembles, runs and moves the LED on P1', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'mcu');
    await page.selectOption('[data-mcu-field="exampleId"]', 'running-lights');
    await page.click('[data-action="mcu-assemble"]');
    await page.click('[data-action="mcu-run"]');
    const leds = () => page.locator('.mcu-leds').innerHTML();
    await page.waitForFunction(() => /[1-9][\d,]* instructions/.test(document.querySelector('.workspace').innerText));
    const first = await leds();
    await page.waitForFunction((before) => document.querySelector('.mcu-leds')?.innerHTML !== before, first, { timeout: 5000 });
    assert.match(await page.locator('.workspace').innerText(), /machine cycles · [\d.]+ ms at 11\.0592 MHz/);
  });
});

test('Arduino Uno: the serial-calculator sketch answers over the serial monitor', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'mcu');
    await page.click('[data-mcu-tab="arduino"]');
    const option = await page.evaluate(() => [...document.querySelector('[data-mcu-field="avrExampleId"]').options].find((o) => /Serial calculator/.test(o.textContent))?.value);
    assert.ok(option, 'serial calculator example exists');
    await page.selectOption('[data-mcu-field="avrExampleId"]', option);
    await page.click('[data-action="uno-run"]');
    await page.waitForFunction(() => /Send a number/.test(document.querySelector('.mcu-terminal')?.textContent ?? ''), null, { timeout: 10000 });
    await page.fill('[data-uno-input]', '12');
    await page.click('[data-action="uno-send"]');
    await page.waitForFunction(() => /1728/.test(document.querySelector('.mcu-terminal')?.textContent ?? ''), null, { timeout: 10000 });
    const terminal = await page.locator('.mcu-terminal').innerText();
    assert.match(terminal, /144/, 'square of 12');
    assert.match(terminal, /1728/, 'cube of 12');
  });
});

test('PCB Studio: place, route and check the board, then download a fabrication ZIP with Gerbers', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'pcb');
    await page.click('[data-action="pcb-autoplace"]');
    await page.click('[data-action="pcb-autoroute"]');
    await page.click('[data-action="pcb-drc"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="pcb-export"]')]);
    assert.match(download.suggestedFilename(), /\.zip$/);
    const zip = readFileSync(await download.path());
    assert.equal(zip.subarray(0, 2).toString('latin1'), 'PK');
    const names = zip.toString('latin1');
    for (const pattern of [/\.gtl/i, /\.gbl/i, /\.drl|excellon/i, /bom/i]) assert.match(names, pattern, `ZIP contains ${pattern}`);
  });
});

test('Lab Records: apply a template and download a PDF lab record', async (t) => {
  await withPage(t, async (page) => {
    await openApp(page);
    await openModule(page, 'record');
    await page.click('[data-action="record-apply-template"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="record-download"]')]);
    assert.match(download.suggestedFilename(), /\.pdf$/);
    const pdf = readFileSync(await download.path());
    assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.match(pdf.subarray(-1024).toString('latin1'), /%%EOF\s*$/);
    assert.ok(pdf.length > 2000);
  });
});
