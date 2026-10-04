// Application store: persistence on every change, save errors (quota), undo/redo history,
// subscriptions, project replacement, desktop synchronisation and learning progress.
import test from 'node:test';
import assert from 'node:assert/strict';

// The suite runs without isolation, so another file may already have created the in-memory storage.
if (!globalThis.localStorage) {
  const memory = new Map();
  globalThis.localStorage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k), key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size; }, clear: () => memory.clear() };
}
const store = await import('../src/core/store.js');
const { createProject } = await import('../src/core/project.js');
const { storageVersion } = await import('../src/core/project-storage.js');
const KEY = 'openentc-studio-project-v1';
const stored = () => JSON.parse(localStorage.getItem(KEY));

test('every project change is persisted and listeners are notified', () => {
  const seen = [];
  const unsubscribe = store.subscribe((state) => seen.push(state.project.name));
  store.updateProject((project) => { project.name = 'Store test'; });
  assert.equal(stored().name, 'Store test');
  assert.equal(store.getState().persistence.status, 'saved');
  assert.equal(seen.at(-1), 'Store test');
  assert.equal(unsubscribe(), true);
  store.updateProject((project) => { project.name = 'After unsubscribe'; });
  assert.equal(seen.at(-1), 'Store test', 'an unsubscribed listener is not called');
});

test('undo and redo walk the project history and clear simulation results', () => {
  store.updateProject((project) => { project.name = 'Step A'; });
  store.updateProject((project) => { project.name = 'Step B'; });
  store.setState({ simulation: { kind: 'circuit-ac' } });
  assert.equal(store.canUndoProject(), true);
  assert.equal(store.undoProject(), true);
  assert.equal(store.getState().project.name, 'Step A');
  assert.equal(store.getState().simulation, null);
  assert.equal(store.canRedoProject(), true);
  assert.equal(store.redoProject(), true);
  assert.equal(store.getState().project.name, 'Step B');
  while (store.canRedoProject()) store.redoProject();
  assert.equal(store.redoProject(), false, 'nothing to redo');
});

test('a storage failure (quota) is reported in the persistence state and by saveProject', () => {
  const original = localStorage.setItem;
  localStorage.setItem = () => { const error = new Error('QuotaExceededError: storage is full'); error.name = 'QuotaExceededError'; throw error; };
  try {
    store.updateProject((project) => { project.name = 'Too big'; });
    assert.equal(store.getState().persistence.status, 'error');
    assert.match(store.getState().persistence.error, /storage is full/);
    assert.equal(store.getState().project.name, 'Too big', 'the edit is kept in memory');
    assert.throws(() => store.saveProject(), /storage is full/);
    assert.equal(store.getState().persistence.status, 'error');
  } finally {
    localStorage.setItem = original;
  }
  const saved = store.saveProject();
  assert.equal(saved.name, 'Too big');
  assert.equal(store.getState().persistence.status, 'saved', 'saving again after space is freed clears the error');
});

test('saveProject refuses an invalid project without touching storage', () => {
  const before = localStorage.getItem(KEY);
  assert.throws(() => store.saveProject({ format: 'openentc-project', version: 1 }), /invalid|Project/i);
  assert.equal(localStorage.getItem(KEY), before);
});

test('replaceProject validates, resets runtime state and can be undone', () => {
  store.setState({ simulation: { kind: 'dsp' }, hdlJob: { id: 'x' } });
  const previous = store.getState().project.name;
  store.replaceProject(createProject('Replaced'));
  assert.equal(store.getState().project.name, 'Replaced');
  assert.equal(store.getState().simulation, null);
  assert.equal(store.getState().hdlJob, null);
  assert.throws(() => store.replaceProject({ name: 'broken' }), /invalid|Project/i);
  assert.equal(store.getState().project.name, 'Replaced', 'a rejected project leaves the open one');
  store.undoProject();
  assert.equal(store.getState().project.name, previous);
});

test('synchronizeOpenProject keeps the desktop session and validates the manifest', () => {
  store.setState({ desktopProject: { project_id: 'p1' } });
  const synced = store.synchronizeOpenProject(createProject('Desktop copy'));
  assert.equal(synced.name, 'Desktop copy');
  assert.deepEqual(store.getState().desktopProject, { project_id: 'p1' });
  assert.throws(() => store.synchronizeOpenProject({}), /invalid|Project|object/i);
});

test('learning attempts are recorded and persisted separately from the project', () => {
  const progress = store.recordLearningAttempt('voltage-divider', true);
  assert.equal(progress.lessons['voltage-divider'].passed, true);
  assert.equal(store.getState().learningProgress.lessons['voltage-divider'].passed, true);
  assert.equal(storageVersion(), store.getState().project.version);
});
