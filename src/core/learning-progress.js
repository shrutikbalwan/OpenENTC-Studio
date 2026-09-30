const MAX_LESSONS = 10_000;

export function createLearningProgress() { return { version: 1, lessons: {} }; }

export function validateLearningProgress(input) {
  if (!input || typeof input !== 'object' || input.version !== 1 || !input.lessons || typeof input.lessons !== 'object' || Array.isArray(input.lessons)) throw new TypeError('Learning progress is invalid.');
  const ids = Object.keys(input.lessons);
  if (ids.length > MAX_LESSONS || ids.some((id) => !/^[a-z0-9._-]{1,100}$/.test(id))) throw new TypeError('Learning progress lesson ids are invalid.');
  for (const value of Object.values(input.lessons)) if (!value || typeof value !== 'object' || typeof value.passed !== 'boolean' || !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > 1_000_000) throw new TypeError('Learning progress entry is invalid.');
  return structuredClone(input);
}

export function loadLearningProgress(storage, key = 'openentc-studio-learning-v1') {
  let raw;
  try { raw = storage.getItem(key); } catch { return createLearningProgress(); }
  if (!raw) return createLearningProgress();
  try { return validateLearningProgress(JSON.parse(raw)); } catch { return createLearningProgress(); }
}

export function saveLearningProgress(storage, progress, key = 'openentc-studio-learning-v1') {
  const valid = validateLearningProgress(progress);
  try { storage.setItem(key, JSON.stringify(valid)); } catch (error) { throw Object.assign(new Error(`Learning progress storage is unavailable: ${error?.message || 'access denied'}.`), { code: 'LEARNING_STORAGE_UNAVAILABLE', cause: error }); }
  return valid;
}

export function recordLessonAttempt(progress, id, passed) {
  const valid = validateLearningProgress(progress); if (typeof id !== 'string' || !/^[a-z0-9._-]{1,100}$/.test(id)) throw new TypeError('Lesson id is invalid.');
  const previous = valid.lessons[id] || { passed: false, attempts: 0 }; valid.lessons[id] = { passed: previous.passed || Boolean(passed), attempts: previous.attempts + 1 }; return valid;
}
