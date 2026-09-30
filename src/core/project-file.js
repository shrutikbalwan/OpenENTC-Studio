// @ts-check

import { exportProject } from './project.js';
import { importStoredProjectText, MAX_BROWSER_IMPORT_BYTES } from './project-storage.js';
import { createProjectArchive, importProjectArchive, PROJECT_ARCHIVE_EXTENSION, PROJECT_ARCHIVE_MEDIA_TYPE } from '../../packages/project-model/src/archive.mjs';

/** @typedef {import('../../packages/project-model/src/types.d.ts').OpenEntcProject} OpenEntcProject */

export const PROJECT_EXPORT_MEDIA_TYPE = 'application/json';
export const PROJECT_EXPORT_EXTENSION = '.entc.json';
export { PROJECT_ARCHIVE_EXTENSION, PROJECT_ARCHIVE_MEDIA_TYPE };
const MAX_BROWSER_ARCHIVE_BYTES = MAX_BROWSER_IMPORT_BYTES + 65_536;

/**
 * Convert a project name into a portable download stem.
 * @param {string} name
 */
export function projectFileStem(name) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'project';
}

/**
 * Produce the complete browser-download payload through the canonical project
 * serializer, keeping DOM and URL operations outside the project boundary.
 * @param {OpenEntcProject} project
 */
export function createProjectExport(project) {
  return Object.freeze({
    text: exportProject(project),
    fileName: `${projectFileStem(project.name)}${PROJECT_EXPORT_EXTENSION}`,
    mediaType: PROJECT_EXPORT_MEDIA_TYPE
  });
}

/** @param {OpenEntcProject} project */
export function createPackagedProjectExport(project) {
  return Object.freeze({
    data: createProjectArchive(project),
    fileName: `${projectFileStem(project.name)}${PROJECT_ARCHIVE_EXTENSION}`,
    mediaType: PROJECT_ARCHIVE_MEDIA_TYPE
  });
}

/**
 * Read an explicitly selected browser file through the same bounded import
 * path used by local storage.
 * @param {{ size: number, name?: string, text(): Promise<string>, arrayBuffer?(): Promise<ArrayBuffer> }} file
 */
export async function importProjectFile(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.text !== 'function') {
    throw new TypeError('Selected project file is invalid.');
  }
  const packaged = file.name?.toLowerCase().endsWith(PROJECT_ARCHIVE_EXTENSION) === true;
  const limit = packaged ? MAX_BROWSER_ARCHIVE_BYTES : MAX_BROWSER_IMPORT_BYTES;
  if (file.size > limit) {
    throw new RangeError(`Project file exceeds the ${Math.round(limit / 1024 / 1024)} MB limit.`);
  }
  if (packaged) {
    if (typeof file.arrayBuffer !== 'function') throw new TypeError('Packaged project file cannot be read as binary data.');
    return importProjectArchive(await file.arrayBuffer());
  }
  return importStoredProjectText(await file.text());
}
