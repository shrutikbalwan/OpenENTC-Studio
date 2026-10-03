// @ts-check

import { createProject, importProject, MAX_PROJECT_BYTES, PROJECT_VERSION, validateProject } from './project.js';
import { StorageError } from '../../packages/errors/src/index.mjs';

/** @typedef {import('../../packages/project-model/src/types.d.ts').OpenEntcProject} OpenEntcProject */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void, removeItem?(key: string): void }} StorageLike */

export const STORAGE_BACKUP_SUFFIX = '-migration-backup';
export const STORAGE_TEMP_SUFFIX = '-write-temp';
export const STORAGE_CORRUPT_SUFFIX = '-corrupt-backup';
export const MAX_BROWSER_IMPORT_BYTES = MAX_PROJECT_BYTES;

/**
 * @param {unknown} error
 * @param {string} fallback
 */
function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * @param {StorageLike} storage
 * @param {string} key
 * @param {{ backupKey?: string, corruptBackupKey?: string }} [options]
 * @returns {{ project: OpenEntcProject, migrated: boolean, recovered?: boolean, backup: string | null, error?: string }}
 */
export function loadStoredProject(storage, key, { backupKey = `${key}${STORAGE_BACKUP_SUFFIX}`, corruptBackupKey = `${key}${STORAGE_CORRUPT_SUFFIX}` } = {}) {
  const temporaryKey = `${key}${STORAGE_TEMP_SUFFIX}`;
  let raw;
  let pending;
  try {
    raw = storage.getItem(key);
    pending = storage.getItem(temporaryKey);
  } catch (error) {
    return { project: createProject(), migrated: false, backup: null, error: `Project storage is unavailable: ${errorMessage(error, 'access denied')}.` };
  }
  if (!raw && pending && pending.length <= MAX_BROWSER_IMPORT_BYTES) {
    try {
      const recovered = validateProject(JSON.parse(pending));
      storage.setItem(key, JSON.stringify(recovered));
      storage.removeItem?.(temporaryKey);
      return { project: recovered, migrated: false, recovered: true, backup: null };
    } catch { /* discard only the uncommitted temporary record; authored data was absent */ }
  }
  if (!raw) return { project: createProject(), migrated: false, backup: null };
  if (raw.length > MAX_BROWSER_IMPORT_BYTES) {
    try { storage.setItem(corruptBackupKey, raw.slice(0, MAX_BROWSER_IMPORT_BYTES)); } catch { /* preserve the size error even when backup storage is unavailable */ }
    return { project: createProject(), migrated: false, backup: raw.slice(0, MAX_BROWSER_IMPORT_BYTES), error: 'Stored project exceeds the allowed size; a bounded corrupt backup was retained.' };
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    try { storage.setItem(corruptBackupKey, raw); } catch { /* preserve the original error even when backup storage is unavailable */ }
    if (pending && pending.length <= MAX_BROWSER_IMPORT_BYTES) {
      try {
        const recovered = validateProject(JSON.parse(pending));
        storage.setItem(key, JSON.stringify(recovered));
        storage.removeItem?.(temporaryKey);
        return { project: recovered, migrated: false, recovered: true, backup: raw };
      } catch { /* report the corrupt source when the pending record is also invalid */ }
    }
    return { project: createProject(), migrated: false, backup: raw, error: 'Stored project JSON is invalid; a corrupt backup was retained.' };
  }
  try {
    const project = validateProject(parsed);
    if (pending) storage.removeItem?.(temporaryKey);
    const migrated = parsed.version !== project.version;
    let backup = null;
    if (migrated) {
      backup = raw;
      const serialized = JSON.stringify(project);
      let previousBackup = null;
      try {
        previousBackup = storage.getItem(backupKey);
        storage.setItem(backupKey, raw);
        storage.setItem(key, serialized);
        if (storage.getItem(key) !== serialized) throw new StorageError('Migrated project write could not be verified.');
      } catch (error) {
        try { storage.setItem(key, raw); } catch { /* preserve the original record when storage is failing */ }
        try { if (previousBackup === null) storage.removeItem?.(backupKey); else storage.setItem(backupKey, previousBackup); } catch { /* preserve the original migration error */ }
        return { project, migrated: false, backup: null, error: errorMessage(error, 'Project migration could not be persisted.') };
      }
    }
    return { project, migrated, backup };
  } catch (error) {
    const boundedRaw = raw.slice(0, MAX_BROWSER_IMPORT_BYTES);
    try { storage.setItem(corruptBackupKey, boundedRaw); } catch { /* preserve the validation error even when backup storage is unavailable */ }
    if (pending && pending.length <= MAX_BROWSER_IMPORT_BYTES) {
      try {
        const recovered = validateProject(JSON.parse(pending));
        storage.setItem(key, JSON.stringify(recovered));
        storage.removeItem?.(temporaryKey);
        return { project: recovered, migrated: false, recovered: true, backup: raw };
      } catch { /* report the invalid committed source when the pending record is also invalid */ }
    }
    return { project: createProject(), migrated: false, backup: raw, error: errorMessage(error, 'Stored project is invalid.') };
  }
}

/**
 * @param {StorageLike} storage
 * @param {string} key
 * @param {OpenEntcProject} project
 */
export function saveStoredProject(storage, key, project) {
  const validated = validateProject(project);
  const serialized = JSON.stringify(validated);
  const temporaryKey = `${key}${STORAGE_TEMP_SUFFIX}`;
  let previous = null;
  try {
    previous = storage.getItem(key);
    storage.setItem(temporaryKey, serialized);
    if (storage.getItem(temporaryKey) !== serialized) throw new StorageError('Temporary project write could not be verified.');
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new StorageError('Project write could not be verified.');
    storage.removeItem?.(temporaryKey);
  } catch (error) {
    try {
      if (previous === null) storage.removeItem?.(key);
      else storage.setItem(key, previous);
      storage.removeItem?.(temporaryKey);
    } catch { /* preserve the original persistence error */ }
    throw error;
  }
  return validated;
}

/** Parse an imported project through the same bounded migration/validation path as storage. */
/** @param {string} text */
export function importStoredProjectText(text) {
  return importProject(text, { maxBytes: MAX_BROWSER_IMPORT_BYTES });
}

export function storageVersion() { return PROJECT_VERSION; }
