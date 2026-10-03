// Lesson and checkpoint validation and evaluation for the Learning Hub (scalar, table-cell and BER
// checks).
const CHECK_KINDS = Object.freeze(['scalar', 'table-cell', 'ber']);
const MAX_LESSONS = 512;

export function validateLesson(lesson) {
  if (!lesson || typeof lesson !== 'object' || typeof lesson.id !== 'string' || !lesson.id.trim()) throw new TypeError('Lesson id is required.');
  if (typeof lesson.title !== 'string' || !lesson.title.trim()) throw new TypeError('Lesson title is required.');
  if (!Array.isArray(lesson.prerequisites) || lesson.prerequisites.some((item) => typeof item !== 'string')) throw new TypeError('Lesson prerequisites must be strings.');
  if (!Array.isArray(lesson.checkpoints) || lesson.checkpoints.length > 256) throw new TypeError('Lesson checkpoints are invalid.');
  for (const checkpoint of lesson.checkpoints) {
    if (!checkpoint || typeof checkpoint.id !== 'string' || !CHECK_KINDS.includes(checkpoint.kind) || typeof checkpoint.tolerance !== 'number' || !Number.isFinite(checkpoint.tolerance) || checkpoint.tolerance < 0) throw new TypeError('Lesson checkpoint is invalid.');
    if (checkpoint.kind === 'scalar' && typeof checkpoint.expected !== 'number') throw new TypeError('Scalar checkpoint expected value is required.');
    if (checkpoint.kind === 'table-cell' && (!Number.isInteger(checkpoint.row) || !Number.isInteger(checkpoint.column) || typeof checkpoint.expected !== 'number')) throw new TypeError('Table checkpoint coordinates are invalid.');
    if (checkpoint.kind === 'ber' && (typeof checkpoint.maxRate !== 'number' || checkpoint.maxRate < 0 || checkpoint.maxRate > 1)) throw new TypeError('BER checkpoint limit is invalid.');
  }
  return Object.freeze(structuredClone(lesson));
}

export function validateLessonCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length > MAX_LESSONS) throw new TypeError('Lesson catalog is invalid.');
  const lessons = catalog.map((lesson) => validateLesson(lesson));
  const ids = new Set(lessons.map((lesson) => lesson.id));
  if (ids.size !== lessons.length) throw new TypeError('Lesson ids must be unique.');
  const graph = new Map(lessons.map((lesson) => [lesson.id, lesson.prerequisites]));
  for (const lesson of lessons) for (const prerequisite of lesson.prerequisites) if (prerequisite === lesson.id || !ids.has(prerequisite)) throw new TypeError(`Lesson prerequisite '${prerequisite}' is missing or self-referential.`);
  const visiting = new Set(); const visited = new Set(); const visit = (id) => { if (visiting.has(id)) throw new TypeError('Lesson prerequisite graph contains a cycle.'); if (visited.has(id)) return; visiting.add(id); for (const prerequisite of graph.get(id)) visit(prerequisite); visiting.delete(id); visited.add(id); }; for (const lesson of lessons) visit(lesson.id);
  return Object.freeze(lessons);
}

const within = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;

export function evaluateCheckpoint(checkpoint, result) {
  if (!checkpoint || !result) return Object.freeze({ passed: false, reason: 'missing-result' });
  if (checkpoint.kind === 'scalar' && result.kind === 'scalar') return Object.freeze({ passed: within(result.data, checkpoint.expected, checkpoint.tolerance), actual: result.data, expected: checkpoint.expected });
  if (checkpoint.kind === 'table-cell' && result.kind === 'table') {
    const actual = result.data?.rows?.[checkpoint.row]?.[checkpoint.column];
    return Object.freeze({ passed: Number.isFinite(actual) && within(actual, checkpoint.expected, checkpoint.tolerance), actual, expected: checkpoint.expected });
  }
  if (checkpoint.kind === 'ber' && result.kind === 'report' && result.data?.kind === 'ber') return Object.freeze({ passed: result.data.rate <= checkpoint.maxRate, actual: result.data.rate, maximum: checkpoint.maxRate });
  return Object.freeze({ passed: false, reason: 'result-kind-mismatch' });
}

export function evaluateLesson(lesson, resultsByCheckpoint) {
  const checked = validateLesson(lesson).checkpoints.map((checkpoint) => ({ id: checkpoint.id, ...evaluateCheckpoint(checkpoint, resultsByCheckpoint?.[checkpoint.id]) }));
  return Object.freeze({ passed: checked.every((item) => item.passed), checkpoints: Object.freeze(checked) });
}
