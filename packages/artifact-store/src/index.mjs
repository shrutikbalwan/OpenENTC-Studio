import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
export const MAX_ARTIFACT_PATH_BYTES = 4096;
export const MAX_MEDIA_TYPE_BYTES = 200;

function safePath(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.length > MAX_ARTIFACT_PATH_BYTES || relativePath.includes('\0') || [...relativePath].some((character) => character < ' ' || character === '\u007f') || relativePath.startsWith('/') || relativePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(relativePath) || isAbsolute(relativePath) || relativePath.split(/[\\/]/).some((segment) => !segment || segment === '.' || segment === '..')) throw new TypeError('Artifact path must be a safe bounded relative path.');
  const rootPath = resolve(root); const target = resolve(rootPath, relativePath); const rel = relative(rootPath, target);
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new TypeError('Artifact path escapes its approved root.');
  return target;
}

async function assertNoSymlinkEscape(root, target) {
  const rootPath = resolve(root);
  const realRoot = await realpath(rootPath);
  const rel = relative(rootPath, target);
  const parts = rel ? rel.split(/[\\/]/).filter(Boolean) : [];
  let current = rootPath;
  for (const part of parts) {
    current = join(current, part);
    let info;
    try { info = await lstat(current); } catch (error) { if (error?.code === 'ENOENT') break; throw error; }
    if (!info.isSymbolicLink()) continue;
    const resolved = await realpath(current);
    const escaped = relative(realRoot, resolved);
    if (escaped === '..' || escaped.startsWith(`..${sep}`) || isAbsolute(escaped)) throw new TypeError('Artifact path escapes its approved root through a symlink.');
    throw new TypeError('Artifact path cannot traverse a symlinked project entry.');
  }
}

function digest(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

export function createArtifactManifest(records, { tool = 'openentc', version = 'unknown', generatedAt = null } = {}) {
  if (!Array.isArray(records) || records.length > 100_000) throw new TypeError('Artifact manifest records are invalid or oversized.');
  const hasControl = (value) => [...value].some((character) => character < ' ' || character === '\u007f');
  if (typeof tool !== 'string' || !tool.trim() || tool.length > 200 || hasControl(tool) || typeof version !== 'string' || !version.trim() || version.length > 200 || hasControl(version)) throw new TypeError('Artifact manifest tool metadata is invalid.');
  if (generatedAt !== null && (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt)))) throw new TypeError('Artifact manifest timestamp is invalid.');
  const normalized = records.map((record) => {
    if (!record || typeof record.path !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256) || !Number.isInteger(record.size) || record.size < 0 || record.size > MAX_ARTIFACT_BYTES || typeof record.mediaType !== 'string' || !record.mediaType.trim() || record.mediaType.length > MAX_MEDIA_TYPE_BYTES) throw new TypeError('Artifact manifest record is invalid.');
    const path = record.path.replaceAll('\\', '/');
    if (!path || path.length > MAX_ARTIFACT_PATH_BYTES || path.startsWith('/') || /^[A-Za-z]:\//.test(path) || path.split('/').some((segment) => !segment || segment === '.' || segment === '..') || [...path].some((character) => character < ' ' || character === '\u007f')) throw new TypeError('Artifact manifest path must be a safe bounded relative path.');
    return { path, sha256: record.sha256, size: record.size, mediaType: record.mediaType };
  });
  normalized.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  for (let index = 1; index < normalized.length; index += 1) if (normalized[index - 1].path === normalized[index].path) throw new TypeError('Artifact manifest contains duplicate paths.');
  return Object.freeze({ format: 'openentc-artifact-manifest', version: 1, tool, toolVersion: version, generatedAt, artifacts: Object.freeze(normalized.map((record) => Object.freeze(record))) });
}

export async function writeArtifact(root, relativePath, input, { mediaType = 'application/octet-stream', maxBytes = MAX_ARTIFACT_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_ARTIFACT_BYTES) throw new RangeError('Artifact size limit is outside the allowed range.');
  if (typeof mediaType !== 'string' || !mediaType.trim() || mediaType.length > MAX_MEDIA_TYPE_BYTES || [...mediaType].some((character) => character < ' ' || character === '\u007f')) throw new TypeError('Artifact media type is invalid or exceeds its limit.');
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.byteLength > maxBytes) throw new RangeError('Artifact exceeds the configured size limit.');
  const target = safePath(root, relativePath);
  await assertNoSymlinkEscape(root, target);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, buffer, { flag: 'wx' });
  await rename(temporary, target);
  return Object.freeze({ path: relativePath.replaceAll('\\', '/'), sha256: digest(buffer), size: buffer.byteLength, mediaType });
}

export async function readArtifact(root, record, { maxBytes = MAX_ARTIFACT_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_ARTIFACT_BYTES) throw new RangeError('Artifact size limit is outside the allowed range.');
  if (!record || typeof record.path !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256) || (record.size !== undefined && (!Number.isInteger(record.size) || record.size < 0 || record.size > maxBytes)) || (record.mediaType !== undefined && (typeof record.mediaType !== 'string' || !record.mediaType.trim() || record.mediaType.length > MAX_MEDIA_TYPE_BYTES))) throw new TypeError('Artifact record is invalid.');
  const target = safePath(root, record.path);
  await assertNoSymlinkEscape(root, target);
  const info = await stat(target);
  if (info.size > maxBytes) throw new RangeError('Artifact exceeds the configured size limit.');
  if (record.size !== undefined && info.size !== record.size) throw new Error('Artifact size metadata does not match the stored file.');
  const buffer = await readFile(target);
  if (digest(buffer) !== record.sha256) throw new Error('Artifact integrity check failed.');
  return buffer;
}
