import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLesson, validateLesson, validateLessonCatalog } from '../packages/learning/src/index.mjs';

const lesson = { id: 'divider', title: 'Voltage divider', prerequisites: [], checkpoints: [{ id: 'voltage', kind: 'scalar', expected: 6, tolerance: 0.01 }, { id: 'table', kind: 'table-cell', row: 0, column: 1, expected: 2, tolerance: 0.1 }, { id: 'ber', kind: 'ber', maxRate: 0.2, tolerance: 0 }] };

test('lesson checkpoints evaluate real structured results within tolerance', () => {
  assert.equal(validateLesson(lesson).id, 'divider');
  const outcome = evaluateLesson(lesson, { voltage: { kind: 'scalar', data: 6.005 }, table: { kind: 'table', data: { rows: [[10, 2.02]] } }, ber: { kind: 'report', data: { kind: 'ber', rate: 0.1 } } });
  assert.equal(outcome.passed, true);
  assert.equal(outcome.checkpoints.length, 3);
});

test('lesson validation and result-kind mismatches fail honestly', () => {
  assert.throws(() => validateLesson({ ...lesson, checkpoints: [{ id: 'bad', kind: 'script', tolerance: 0 }] }), /invalid/);
  const outcome = evaluateLesson(lesson, { voltage: { kind: 'waveform', data: [] } });
  assert.equal(outcome.passed, false);
  assert.equal(outcome.checkpoints[0].reason, 'result-kind-mismatch');
});

test('lesson catalogs validate prerequisite references and reject cycles', () => {
  assert.deepEqual(validateLessonCatalog([{ ...lesson, id: 'intro' }, { ...lesson, id: 'advanced', prerequisites: ['intro'] }]).map((entry) => entry.id), ['intro', 'advanced']);
  assert.throws(() => validateLessonCatalog([{ ...lesson, id: 'a', prerequisites: ['missing'] }]), /missing/);
  assert.throws(() => validateLessonCatalog([{ ...lesson, id: 'a', prerequisites: ['b'] }, { ...lesson, id: 'b', prerequisites: ['a'] }]), /cycle/);
});
