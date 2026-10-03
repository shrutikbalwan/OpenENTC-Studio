// AI assistant journeys against a mocked OpenAI-compatible provider. No real service is contacted:
// the harness blocks every non-local origin and these tests route only https://llm.mock.test.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, stop, withPage } from './harness.mjs';

after(stop);

const BASE = 'https://llm.mock.test/v1';
const KEY = 'sk-test-ABCDEFGHIJKLMNOPQRSTUVWX1234';

async function configure(page) {
  await page.click('[data-ai-open]');
  await page.waitForSelector('[data-ai-setting="provider"]');
  await page.selectOption('[data-ai-setting="provider"]', 'openai');
  for (const [field, value] of [['baseUrl', BASE], ['model', 'mock-model'], ['apiKey', KEY]]) {
    await page.fill(`[data-ai-setting="${field}"]`, value);
    await page.press(`[data-ai-setting="${field}"]`, 'Tab');
  }
  const consent = page.locator('[data-ai-setting="consented"]');
  if (!(await consent.isChecked())) await consent.check();
  await page.click('[data-ai-view="chat"]');
}

async function ask(page, question) {
  await page.fill('[data-ai-draft]', question);
  await page.click('[data-ai-send]');
}

const panelText = (page) => page.locator('.ai-panel').innerText();
const reply = (content) => ({ id: 'x', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] });

test('assistant answers through a mocked provider; the key is sent only as a bearer header and never stored', async (t) => {
  await withPage(t, async (page) => {
    const requests = [];
    await page.route(`${BASE}/chat/completions`, async (route) => {
      const request = route.request();
      requests.push({ headers: request.headers(), body: request.postDataJSON() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply('Ohm\'s law: V = I × R. <img src=x onerror=alert(1)>')) });
    });
    await openApp(page);
    await configure(page);
    await ask(page, 'What is Ohm\'s law?');
    await page.waitForFunction(() => /V = I × R/.test(document.querySelector('.ai-messages')?.textContent ?? ''));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.authorization, `Bearer ${KEY}`);
    assert.equal(requests[0].headers.cookie, undefined, 'no cookies are sent');
    assert.equal(requests[0].body.model, 'mock-model');
    assert.ok(requests[0].body.messages.some((m) => m.role === 'user' && /Ohm/.test(m.content)));
    assert.equal(await page.locator('.ai-messages img').count(), 0, 'model output is rendered as text');
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    assert.doesNotMatch(stored, /sk-test-ABCDEF/, 'the key is in memory only by default');
  });
});

test('an invalid provider reply is reported and the chat stays usable', async (t) => {
  await withPage(t, async (page) => {
    let calls = 0;
    await page.route(`${BASE}/chat/completions`, async (route) => {
      calls += 1;
      if (calls === 1) await route.fulfill({ status: 200, contentType: 'application/json', body: '{"choices": [ this is not json' });
      else if (calls === 2) await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: `bad key ${KEY}` } }) });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply('Recovered.')) });
    });
    await openApp(page);
    await configure(page);
    await ask(page, 'first');
    await page.waitForFunction(() => !document.querySelector('[data-ai-stop]'), null, { timeout: 10000 });
    assert.match(await panelText(page), /The AI service returned no message./, 'malformed JSON is reported, not shown as a reply');
    await ask(page, 'second');
    await page.waitForFunction(() => /AI service error 401/.test(document.querySelector('.ai-panel')?.textContent ?? ''), null, { timeout: 10000 });
    assert.doesNotMatch(await panelText(page), /sk-test-ABCDEF/, 'the key is redacted from the error');
    await ask(page, 'third');
    await page.waitForFunction(() => /Recovered\./.test(document.querySelector('.ai-messages')?.textContent ?? ''), null, { timeout: 10000 });
  });
});

test('a provider that never answers times out with a clear message; Stop cancels a request', async (t) => {
  await withPage(t, async (page) => {
    await page.clock.install();
    await page.clock.resume();
    await page.route(`${BASE}/chat/completions`, () => { /* never answer */ });
    await openApp(page);
    await configure(page);
    await ask(page, 'slow question');
    await page.waitForSelector('[data-ai-stop]');
    await page.clock.fastForward(61_000);
    await page.waitForFunction(() => /did not answer in time/.test(document.querySelector('.ai-panel')?.textContent ?? ''), null, { timeout: 10000 });
    // A second request can be stopped by the user.
    await ask(page, 'another slow question');
    await page.click('[data-ai-stop]');
    await page.waitForFunction(() => /Stopped\./.test(document.querySelector('.ai-panel')?.textContent ?? ''), null, { timeout: 10000 });
  });
});
