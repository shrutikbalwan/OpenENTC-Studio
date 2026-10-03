import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootFromModuleUrl } from './server-path.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

/**
 * Static file server confined to `root` (canonical relative containment, symlinks resolved).
 * Used by `npm run dev` (repository root) and by the browser tests (the built dist/ folder).
 * @param {string} servedRoot
 */
export async function createStaticServer(servedRoot) {
  const root = await realpath(servedRoot);
  return createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const candidate = join(root, pathname);
    const candidateRelative = relative(root, candidate);
    if (candidateRelative.startsWith('..') || isAbsolute(candidateRelative)) throw new Error('Invalid path');
    const resolvedCandidate = await realpath(candidate);
    const resolvedRelative = relative(root, resolvedCandidate);
    if (resolvedRelative.startsWith('..') || isAbsolute(resolvedRelative)) throw new Error('Invalid path');
    const info = await stat(resolvedCandidate);
    const file = info.isDirectory() ? join(resolvedCandidate, 'index.html') : resolvedCandidate;
    const resolvedFile = await realpath(file);
    const fileRelative = relative(root, resolvedFile);
    if (fileRelative.startsWith('..') || isAbsolute(fileRelative)) throw new Error('Invalid path');
    response.writeHead(200, { 'Content-Type': types[extname(resolvedFile)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(resolvedFile));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  const server = await createStaticServer(rootFromModuleUrl(import.meta.url));
  server.listen(port, '127.0.0.1', () => {
    console.log(`OpenENTC Studio is running at http://127.0.0.1:${port}`);
  });
}
