// Recovery: the backups kept in browser storage can be listed, read, restored and deleted, and
// listing never changes storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { discardBackup, inspectBackups, loadStoredProject, readBackup, restoreBackup, saveStoredProject, STORAGE_BACKUP_SUFFIX, STORAGE_CORRUPT_SUFFIX, STORAGE_TEMP_SUFFIX } from '../src/core/project-storage.js';
import { createProject } from '../src/core/project.js';

const KEY = 'test-project';
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

test('no backups: an empty list', () => {
  assert.deepEqual(inspectBackups(memoryStorage(), KEY), []);
});

test('a corrupt stored project leaves a backup that is listed as not openable, and can be downloaded and deleted', () => {
  const storage = memoryStorage({ [KEY]: '{"format":"openentc-project", broken' });
  const loaded = loadStoredProject(storage, KEY);
  assert.match(loaded.error, /invalid/i);
  const before = new Map(storage.map);
  const [backup] = inspectBackups(storage, KEY);
  assert.deepEqual(storage.map, before, 'listing does not change storage');
  assert.equal(backup.kind, 'corrupt');
  assert.equal(backup.valid, false);
  assert.ok(backup.error.length > 0);
  assert.equal(readBackup(storage, KEY, 'corrupt'), '{"format":"openentc-project", broken');
  assert.throws(() => restoreBackup(storage, KEY, 'corrupt'), /JSON|invalid|project/i);
  discardBackup(storage, KEY, 'corrupt');
  assert.equal(storage.getItem(`${KEY}${STORAGE_CORRUPT_SUFFIX}`), null);
});

test('a migration backup (written by loadStoredProject on a format upgrade, see project-storage tests) is valid and restorable', () => {
  // The current format is version 1, so no real upgrade exists yet; store the backup the way
  // loadStoredProject does, using a legacy file without the later "notes" field.
  const legacy = createProject('Old lab');
  delete legacy.notes;
  const storage = memoryStorage({ [`${KEY}${STORAGE_BACKUP_SUFFIX}`]: JSON.stringify(legacy) });
  const [backup] = inspectBackups(storage, KEY);
  assert.equal(backup.kind, 'migration');
  assert.equal(backup.valid, true);
  assert.equal(backup.name, 'Old lab');
  assert.equal(backup.components, legacy.circuit.components.length);
  const restored = restoreBackup(storage, KEY, 'migration');
  assert.equal(restored.name, 'Old lab');
  assert.deepEqual(restored.notes, [], 'restoring migrates the backup like an import');
});

test('an interrupted save is listed, and unknown kinds are rejected', () => {
  const storage = memoryStorage();
  saveStoredProject(storage, KEY, createProject('Saved'));
  storage.setItem(`${KEY}${STORAGE_TEMP_SUFFIX}`, JSON.stringify(createProject('Half-saved')));
  const [backup] = inspectBackups(storage, KEY);
  assert.equal(backup.kind, 'interrupted-write');
  assert.equal(backup.name, 'Half-saved');
  assert.throws(() => readBackup(storage, KEY, 'other'), /Unknown backup kind/);
  assert.throws(() => discardBackup(storage, KEY, 'other'), /Unknown backup kind/);
  assert.throws(() => restoreBackup(memoryStorage(), KEY, 'migration'), /no longer exists/);
});

test('a storage that throws on read reports no backups instead of crashing', () => {
  const storage = { getItem: () => { throw new Error('denied'); }, setItem() {}, removeItem() {} };
  assert.deepEqual(inspectBackups(storage, KEY), []);
});
