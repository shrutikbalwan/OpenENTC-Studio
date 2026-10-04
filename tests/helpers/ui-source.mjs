// The browser UI source as one string: src/app.js plus every module extracted from it
// (src/shell, workspaces, components, controllers, shared, state, services). Source-text tests use
// this instead of reading src/app.js alone, so they keep checking the same code after it moves.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LAYERS = ['shell', 'workspaces', 'components', 'controllers', 'shared', 'state', 'services'];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : [])).sort();
}

export function uiSourceFiles() {
  return [resolve(root, 'src/app.js'), ...LAYERS.flatMap((layer) => walk(resolve(root, 'src', layer)))];
}

export function readUiSource() {
  return uiSourceFiles().map((file) => readFileSync(file, 'utf8')).join('\n');
}
