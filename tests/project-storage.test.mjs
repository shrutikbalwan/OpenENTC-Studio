import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/core/project.js';
import { importStoredProjectText, loadStoredProject, saveStoredProject } from '../src/core/project-storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    value: (key) => values.get(key)
  };
}

test('storage boundary saves validated projects and preserves authored data', () => {
  const storage = memoryStorage();
  const project = createProject('Storage fixture');
  project.embedded.code = 'void setup() {}';
  saveStoredProject(storage, 'project', project);
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.project.name, 'Storage fixture');
  assert.equal(loaded.project.embedded.code, 'void setup() {}');
  assert.equal(loaded.migrated, false);
});

test('storage boundary backs up and rewrites a migrated project', () => {
  const storage = memoryStorage();
  const legacy = { ...createProject('Legacy storage'), version: 0, unknown: { keep: true } };
  storage.setItem('project', JSON.stringify(legacy));
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.migrated, true);
  assert.deepEqual(JSON.parse(loaded.backup).unknown, { keep: true });
  assert.equal(JSON.parse(storage.value('project')).version, 1);
  assert.equal(JSON.parse(storage.value('project')).unknown.keep, true);
});

test('corrupt stored JSON does not replace it with a fabricated project', () => {
  const storage = memoryStorage();
  storage.setItem('project', '{broken');
  const loaded = loadStoredProject(storage, 'project');
  assert.match(loaded.error, /invalid/i);
  assert.equal(storage.value('project'), '{broken');
  assert.equal(storage.value('project-corrupt-backup'), '{broken');
});

test('oversized stored JSON is rejected before parsing and retained only within the backup bound', () => {
  const storage = memoryStorage();
  const oversized = 'x'.repeat(10 * 1024 * 1024 + 20);
  storage.setItem('project', oversized);
  const loaded = loadStoredProject(storage, 'project');
  assert.match(loaded.error, /exceeds/i);
  assert.equal(storage.value('project'), oversized);
  assert.equal(storage.value('project-corrupt-backup').length, 10 * 1024 * 1024);
});

test('pending verified temporary project is promoted after an interrupted commit', () => {
  const storage = memoryStorage();
  const pending = createProject('Recovered pending project');
  storage.setItem('project-write-temp', JSON.stringify(pending));
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.project.name, 'Recovered pending project');
  assert.equal(JSON.parse(storage.value('project')).name, 'Recovered pending project');
  assert.equal(storage.value('project-write-temp'), undefined);
});

test('valid pending project recovers even when the committed record is corrupt', () => {
  const storage = memoryStorage();
  storage.setItem('project', '{broken');
  storage.setItem('project-write-temp', JSON.stringify(createProject('Pending recovery')));
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.project.name, 'Pending recovery');
  assert.equal(storage.value('project-corrupt-backup'), '{broken');
});

test('invalid committed project is retained and valid pending project is recovered', () => {
  const storage = memoryStorage();
  const invalid = JSON.stringify({ format: 'openentc-project', version: 1, name: '' });
  storage.setItem('project', invalid);
  storage.setItem('project-write-temp', JSON.stringify(createProject('Pending after invalid manifest')));
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.project.name, 'Pending after invalid manifest');
  assert.equal(storage.value('project-corrupt-backup'), invalid);
});

test('invalid committed project without pending data is retained and reported', () => {
  const storage = memoryStorage();
  const invalid = JSON.stringify({ format: 'openentc-project', version: 1, name: '' });
  storage.setItem('project', invalid);
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.recovered, undefined);
  assert.match(loaded.error, /name is invalid/i);
  assert.equal(storage.value('project-corrupt-backup'), invalid);
});

test('browser import uses bounded migration and validation', () => {
  const legacy = { ...createProject('Legacy'), version: 0, circuit: { ...createProject().circuit } };
  const imported = importStoredProjectText(JSON.stringify(legacy));
  assert.equal(imported.version, 1);
  assert.equal(imported.name, 'Legacy');
  assert.throws(() => importStoredProjectText('{'), /JSON is invalid/);
});

test('storage write failure rolls back the prior project and temporary record', () => {
  const storage = memoryStorage();
  const original = createProject('Original');
  saveStoredProject(storage, 'project', original);
  const before = storage.value('project');
  const realSetItem = storage.setItem;
  let writes = 0;
  storage.setItem = (key, value) => {
    writes += 1;
    if (writes === 2) throw new Error('quota');
    realSetItem(key, value);
  };
  assert.throws(() => saveStoredProject(storage, 'project', createProject('Changed')), /quota/);
  assert.equal(storage.value('project'), before);
  assert.equal(storage.value('project-write-temp'), undefined);
});

test('storage access failures become explicit persistence errors instead of crashing initialization', () => {
  const unavailable = {
    getItem() { throw new Error('storage denied'); },
    setItem() { throw new Error('storage denied'); },
    removeItem() { throw new Error('storage denied'); }
  };
  const loaded = loadStoredProject(unavailable, 'openentc');
  assert.equal(loaded.project.format, 'openentc-project');
  assert.match(loaded.error, /storage is unavailable/i);
  assert.throws(() => saveStoredProject(unavailable, 'openentc', createProject('Denied')), /storage denied/);
});

test('storage boundary normalizes non-Error failures without exposing an undefined message', () => {
  const unavailable = {
    getItem() { throw 'denied'; },
    setItem() { throw 'denied'; },
    removeItem() { throw 'denied'; }
  };
  const loaded = loadStoredProject(unavailable, 'openentc');
  assert.equal(loaded.error, 'Project storage is unavailable: access denied.');
});

test('migration backup-read failures are contained and preserve the committed manifest', () => {
  const values = new Map([['project', JSON.stringify({ ...createProject('Backup read failure'), version: 0 })]]);
  const storage = {
    getItem(key) { if (key === 'project-migration-backup') throw new Error('backup read denied'); return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const loaded = loadStoredProject(storage, 'project');
  assert.equal(loaded.migrated, false);
  assert.match(loaded.error, /backup read denied/);
  assert.equal(JSON.parse(values.get('project')).version, 0);
});

test('migration write failure rolls back the committed record and backup', () => {
  const storage = memoryStorage();
  const legacy = { ...createProject('Legacy migration'), version: 0 };
  const original = JSON.stringify(legacy);
  storage.setItem('project', original);
  const realSetItem = storage.setItem;
  let writes = 0;
  storage.setItem = (key, value) => {
    writes += 1;
    if (writes === 2) throw new Error('quota');
    realSetItem(key, value);
  };
  const loaded = loadStoredProject(storage, 'project');
  assert.match(loaded.error, /quota/i);
  assert.equal(storage.value('project'), original);
  assert.equal(storage.value('project-migration-backup'), undefined);
});
