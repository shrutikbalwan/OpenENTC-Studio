import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningProgress, loadLearningProgress, recordLessonAttempt, saveLearningProgress } from '../src/core/learning-progress.js';

function storage() { const map = new Map(); return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; }

test('learning progress persists separately and records attempts monotonically', () => {
  const store = storage(); let progress = createLearningProgress(); progress = recordLessonAttempt(progress, 'voltage-divider', false); progress = recordLessonAttempt(progress, 'voltage-divider', true); saveLearningProgress(store, progress);
  const reopened = loadLearningProgress(store); assert.deepEqual(reopened.lessons['voltage-divider'], { passed: true, attempts: 2 });
});

test('corrupt progress resets safely without touching project storage', () => {
  const store = storage(); store.setItem('openentc-studio-learning-v1', '{bad'); assert.deepEqual(loadLearningProgress(store), createLearningProgress());
  assert.throws(() => recordLessonAttempt(createLearningProgress(), '../project', true), /invalid/);
});

test('learning progress access failures recover without crashing initialization', () => {
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(loadLearningProgress(denied), createLearningProgress());
  assert.throws(() => saveLearningProgress(denied, createLearningProgress()), /storage is unavailable/);
});
