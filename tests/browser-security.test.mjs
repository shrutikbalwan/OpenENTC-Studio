import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esc, formatAssistantText, safeUrl } from '../src/core/html.js';
import { ASSISTANT_DEFAULTS, forgetApiKey, loadAssistantSettings, redactSecrets, resetCredentialMemory, saveAssistantSettings, SESSION_KEY, SETTINGS_KEY } from '../src/core/credentials.js';
import { chat, validateBaseUrl } from '../packages/assistant/src/index.mjs';
import { readUiSource } from './helpers/ui-source.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const memoryStorage = () => { const map = new Map(); return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map }; };
const KEY = 'sk-test-ABCDEFGHIJKLMNOPQRSTUVWX1234';

test('esc neutralises text, attribute and template-literal breakouts', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc(`" onmouseover="x' \``), '&quot; onmouseover=&quot;x&#39; &#96;');
  assert.equal(esc('a & b'), 'a &amp; b');
  assert.equal(esc(null), '');
  assert.equal(esc(42), '42');
  for (const payload of ['<svg onload=alert(1)>', '</textarea><script>alert(1)</script>', '"><iframe srcdoc="<script>">']) assert.doesNotMatch(esc(payload), /[<>"]/);
});

test('safeUrl only allows the schemes asked for', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', ' \tjavascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example/x']) assert.equal(safeUrl(bad), '', bad);
  assert.equal(safeUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(safeUrl('blob:http://127.0.0.1/abc', { schemes: ['blob:'] }), 'blob:http://127.0.0.1/abc');
  assert.equal(safeUrl('https://example.org', { schemes: ['blob:'] }), '');
  assert.equal(safeUrl('./docs/help.html'), './docs/help.html');
});

test('assistant replies are escaped before the small Markdown subset is applied', () => {
  const html = formatAssistantText('Hi <img src=x onerror=alert(1)> **<b onmouseover=x>bold</b>** `<script>` \n```html\n<script>alert(1)</script>\n```\n[link](javascript:alert(1))');
  assert.doesNotMatch(html, /<img|<script|onmouseover=x>|<b onmouseover|href=/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<pre class="ai-code">&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/pre>/);
  // Only these tags can appear, and never with attributes other than the code block's class.
  for (const tag of html.match(/<[a-z][^>]*>/gi) ?? []) assert.match(tag, /^<(b|code|br|pre class="ai-code")>$/, tag);
});

test('the API key is never persisted and an old saved key is deleted on load', () => {
  resetCredentialMemory();
  const local = memoryStorage(), session = memoryStorage();
  local.setItem(SETTINGS_KEY, JSON.stringify({ provider: 'groq', apiKey: KEY, consented: true }));
  const first = loadAssistantSettings(local, session);
  assert.equal(first.removedLegacyKey, true);
  assert.equal(first.apiKey, '', 'the legacy key is not loaded into memory');
  assert.doesNotMatch(local.getItem(SETTINGS_KEY), /sk-test/);
  assert.equal(first.settings.provider, 'groq', 'other settings survive the migration');
  saveAssistantSettings(local, session, { apiKey: KEY });
  assert.equal(loadAssistantSettings(local, session).apiKey, KEY, 'kept in memory for this page');
  for (const storage of [local, session]) for (const value of storage.map.values()) assert.ok(!value.includes(KEY), 'not in any storage by default');
  resetCredentialMemory(); // a reload
  assert.equal(loadAssistantSettings(local, session).apiKey, '', 'gone after reload');
  saveAssistantSettings(local, session, { apiKey: KEY, rememberKey: true });
  assert.equal(session.getItem(SESSION_KEY), KEY, 'only sessionStorage, only when asked');
  assert.ok(![...local.map.values()].some((v) => v.includes(KEY)));
  resetCredentialMemory();
  assert.equal(loadAssistantSettings(local, session).apiKey, KEY, 'restored for the same tab');
  saveAssistantSettings(local, session, { rememberKey: false });
  assert.equal(session.getItem(SESSION_KEY), null, 'turning the option off clears the tab copy');
  forgetApiKey(session);
  assert.equal(loadAssistantSettings(local, session).apiKey, '');
  assert.deepEqual(Object.keys(ASSISTANT_DEFAULTS).includes('apiKey'), false);
});

test('credentials never reach the project model, export code or logs', () => {
  for (const path of ['src/core/project.js', 'src/core/project-file.js', 'src/core/project-storage.js', 'packages/project-model/src/index.mjs', 'packages/project-model/src/archive.mjs']) assert.doesNotMatch(read(path), /apiKey|openentc\.assistant/, path);
  assert.doesNotMatch(readUiSource(), /console\.(log|info|debug|warn|error)\([^)]*apiKey/);
  assert.equal(redactSecrets(`Incorrect API key provided: ${KEY}`, [KEY]), 'Incorrect API key provided: [redacted]');
  assert.equal(redactSecrets('Authorization: Bearer abcdefghijklmnop'), 'Authorization: Bearer [redacted]');
  assert.equal(redactSecrets('key AIzaSyA1234567890abcdefghijklmn'), 'key [redacted]');
});

test('provider URLs: https only, no credentials, no query or fragment', () => {
  assert.equal(validateBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1');
  assert.equal(validateBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  for (const bad of ['http://example.org/v1', 'https://user:pass@example.org/v1', 'https://example.org/v1?key=abc', 'https://example.org/v1#k', 'ftp://example.org', 'javascript:alert(1)', 'http://[::1]:11434/v1']) assert.throws(() => validateBaseUrl(bad), undefined, bad);
});

test('chat refuses redirects, redacts keys in errors and survives malicious replies', async () => {
  const settings = { provider: 'openai', apiKey: KEY, model: 'm', mode: 'explain', language: 'en' };
  let options;
  const reply = (body, status = 200) => async (url, init) => { options = init; return { ok: status < 400, status, statusText: 'x', headers: { get: () => null }, json: async () => body }; };
  await chat({ settings, messages: [{ role: 'user', content: 'hi' }], fetchImpl: reply({ choices: [{ message: { content: 'ok' } }] }) });
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  await assert.rejects(chat({ settings, messages: [], fetchImpl: reply({ error: { message: `bad key ${KEY}` } }, 401) }), (error) => !error.message.includes(KEY) && /\[redacted\]/.test(error.message));
  await assert.rejects(chat({ settings, messages: [], fetchImpl: async () => { throw new TypeError(`network ${KEY}`); } }), (error) => !error.message.includes(KEY));
  // Non-string content, oversized tool arguments, unknown tools and non-array tool_calls.
  const weird = await chat({ settings, messages: [], fetchImpl: reply({ choices: [{ message: { content: { html: '<img onerror=x>' } } }] }) });
  assert.equal(typeof weird.reply, 'string');
  let round = 0;
  const steps = [
    { choices: [{ message: { content: null, tool_calls: [{ id: 'a', function: { name: 'calculate', arguments: 'x'.repeat(30_000) } }, { id: 'b', function: { name: '<script>', arguments: '{}' } }, { id: 'c', function: { name: 'calculate', arguments: '[1,2]' } }] } }] },
    { choices: [{ message: { content: 'done', tool_calls: 'not-an-array' } }] },
  ];
  const result = await chat({ settings, messages: [], fetchImpl: async (url, init) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => steps[round++] }) });
  assert.equal(result.reply, 'done');
  assert.match(result.trace[0].output, /too large/);
  assert.match(result.trace[1].output, /unknown tool/);
  await assert.rejects(chat({ settings, messages: [], fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => '9999999' }, json: async () => ({}) }) }), /too large/);
});

test('Content Security Policy blocks inline and remote scripts in the browser and desktop builds', () => {
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(read('index.html'))?.[1];
  assert.ok(meta, 'index.html has a CSP');
  const tauri = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json')).app.security.csp;
  assert.ok(tauri, 'tauri.conf.json has a CSP');
  const directives = (policy) => Object.fromEntries(policy.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
  for (const policy of [directives(meta), Object.fromEntries(Object.entries(tauri).map(([k, v]) => [k, v.split(/\s+/)]))]) {
    assert.deepEqual(policy['script-src'], ["'self'"]);
    assert.deepEqual(policy['object-src'], ["'none'"]);
    assert.deepEqual(policy['base-uri'], ["'none'"]);
    assert.ok(!JSON.stringify(policy).includes('unsafe-eval'));
    for (const host of ['http://localhost:*', 'http://127.0.0.1:*', 'https:']) assert.ok(policy['connect-src'].includes(host), host);
  }
  assert.doesNotMatch(read('src/styles.css'), /@import|https?:\/\//, 'no remote stylesheet or font');
  assert.doesNotMatch(readUiSource(), /<[a-z][^>]*\son[a-z]+=["'{$]/i, 'no inline event-handler attributes in templates');
});
