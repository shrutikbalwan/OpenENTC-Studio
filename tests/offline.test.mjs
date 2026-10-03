import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('web-app manifest is valid and linked from index.html', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) assert.doesNotThrow(() => read(icon.src), icon.src);
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
});

test('service worker precaches the shell and falls back to the cache when offline', () => {
  const sw = read('sw.js');
  for (const path of ['./index.html', './src/app.js', './src/styles.css', './manifest.webmanifest']) assert.ok(sw.includes(`'${path}'`), path);
  assert.match(sw, /await fetch\(request\)/, 'network first');
  assert.match(sw, /cache\.match\(request/, 'cache fallback');
  assert.match(sw, /url\.origin !== self\.location\.origin/, 'never caches other origins (AI providers, CDNs)');
  assert.match(read('src/app.js'), /serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(read('scripts/build.mjs'), /'sw\.js'/);
});
