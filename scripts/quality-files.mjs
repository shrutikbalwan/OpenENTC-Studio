import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ignoredDirectories = new Set(['.git', 'build', 'dist', 'gen', 'node_modules', 'runs', 'target']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.yml']);
const javascriptExtensions = new Set(['.js', '.mjs']);

async function walk(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, path));
    else files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files;
}

export async function listTextFiles(root) {
  return (await walk(root)).filter((file) => textExtensions.has(extname(file)));
}

export async function listJavaScriptFiles(root) {
  return (await walk(root)).filter((file) => javascriptExtensions.has(extname(file)));
}
