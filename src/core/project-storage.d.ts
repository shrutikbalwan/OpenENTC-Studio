import type { OpenEntcProject } from '../../packages/project-model/src/types.d.ts';

export declare const STORAGE_BACKUP_SUFFIX: string;
export declare const STORAGE_TEMP_SUFFIX: string;
export declare const STORAGE_CORRUPT_SUFFIX: string;
export declare const MAX_BROWSER_IMPORT_BYTES: number;
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface StoredProjectResult {
  project: OpenEntcProject;
  migrated: boolean;
  recovered?: boolean;
  backup: string | null;
  error?: string;
}
export declare function loadStoredProject(storage: StorageLike, key: string, options?: { backupKey?: string; corruptBackupKey?: string }): StoredProjectResult;
export declare function saveStoredProject(storage: StorageLike, key: string, project: OpenEntcProject): OpenEntcProject;
export declare function importStoredProjectText(text: string): OpenEntcProject;
export declare function storageVersion(): number;
