import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, drawParameters, instantiate, parseAnswer, scoreQuiz } from '../packages/learning/src/quiz.mjs';
import { findLesson, lessonIndex, TRACKS } from '../packages/learning/src/courseware.mjs';
import { modules } from '../src/data/modules.js';
import { freeSpaceLoss, offeredTraffic, reusePlan } from '../packages/cellular/src/index.mjs';
import { sensitivity, superhet } from '../packages/commsys/src/index.mjs';
import { rectangularWaveguide } from '../packages/em/src/index.mjs';

test('answer parsing understands engineering notation', () => {
  assert.equal(parseAnswer('4.7k'), 4700); assert.equal(parseAnswer('2.2 µF'), 2.2e-6); assert.equal(parseAnswer('-12.5 V'), -12.5);
  assert.equal(parseAnswer('1e-3'), 0.001); assert.equal(parseAnswer('15 mA'), 0.015); assert.equal(parseAnswer('3M'), 3e6); assert.equal(parseAnswer('1,200'), 1200);
  assert.equal(parseAnswer('abc'), null);
  assert.deepEqual(drawParameters({ a: [1, 5, 1], b: { choices: ['x', 'y'] }, c: 7 }, 3), drawParameters({ a: [1, 5, 1], b: { choices: ['x', 'y'] }, c: 7 }, 3));
});

test('six tracks, each lesson complete, every lab link points to a real module', () => {
  assert.equal(TRACKS.length, 6);
  const moduleIds = new Set(modules.map((m) => m.id));
  const ids = new Set();
  for (const track of TRACKS) {
    assert.ok(track.lessons.length >= 6, track.id); assert.ok(track.viva.length >= 8, `${track.id} viva`);
    for (const lesson of track.lessons) {
      assert.ok(!ids.has(lesson.id), `duplicate ${lesson.id}`); ids.add(lesson.id);
      assert.ok(moduleIds.has(lesson.lab.module), `${lesson.id} → ${lesson.lab.module}`);
      assert.ok(lesson.summary.length && lesson.formulas.length && lesson.questions.length >= 3, lesson.id);
    }
  }
  assert.equal(findLesson('divider').trackTitle, 'Circuit foundations');
  assert.ok(lessonIndex().length >= 36);
});

test('every question instantiates with finite answers for many seeds and accepts its own answer', () => {
  for (const lesson of lessonIndex()) for (const question of lesson.questions) for (let seed = 1; seed <= 40; seed += 1) {
    const q = instantiate(question, seed);
    assert.ok(q.prompt && q.prompt.length > 10, `${lesson.id}/${question.id} prompt`);
    if (q.kind === 'mcq') { assert.ok(q.answer >= 0 && q.answer < q.options.length); assert.equal(checkAnswer(q, q.answer).correct, true); continue; }
    assert.ok(Number.isFinite(q.answer), `${lesson.id}/${question.id} seed ${seed}: ${q.answer}`);
    assert.equal(checkAnswer(q, q.answer).correct, true);
    assert.equal(checkAnswer(q, String(q.answer)).correct, true);
    if (Math.abs(q.answer) > 1e-12) assert.equal(checkAnswer(q, q.answer * 1.5).correct, false, `${lesson.id}/${question.id} rejects a wrong answer`);
  }
});

test('quiz answers agree with the lab engines', () => {
  const answer = (lessonId, questionId, seed) => instantiate(findLesson(lessonId).questions.find((q) => q.id === questionId), seed);
  for (let seed = 1; seed <= 10; seed += 1) {
    const sir = answer('cellular', 'sir', seed);
    assert.ok(Math.abs(sir.answer - reusePlan({ cluster: sir.params.n, pathLossExponent: 4 }).sirDb) < 1e-9);
    const floor = answer('noise', 'noisefloor', seed);
    assert.ok(Math.abs(floor.answer - sensitivity({ nfDb: floor.params.nf, bandwidth: floor.params.b }).noiseFloorDbm) < 0.05, 'the lesson rounds kT at 290 K to −174 dBm/Hz (exact −173.98)');
    const image = answer('noise', 'image', seed);
    assert.ok(Math.abs(image.answer - superhet({ signal: image.params.fs, intermediate: 455e3 }).image) < 1e-6);
    const fc = answer('waveguides', 'fc', seed);
    assert.ok(Math.abs(fc.answer - rectangularWaveguide({ a: fc.params.a, b: fc.params.a / 2.25, frequency: 1e10 }).dominant.cutoff) < 1);
    const fspl = answer('link', 'fspl', seed);
    assert.ok(Math.abs(fspl.answer - freeSpaceLoss(fspl.params.f, fspl.params.d)) < 0.01);
    const traffic = answer('cellular', 'erlang', seed);
    assert.ok(Math.abs(traffic.answer - offeredTraffic({ users: traffic.params.users, callsPerHour: traffic.params.calls, holdingSeconds: traffic.params.minutes * 60 })) < 1e-9);
  }
});

test('scoring a quiz', () => {
  const lesson = findLesson('ohm-kirchhoff');
  const instances = lesson.questions.map((q) => instantiate(q, 5));
  const responses = { [instances[0].id]: instances[0].answer, [instances[2].id]: 0 };
  const score = scoreQuiz(instances, responses);
  assert.equal(score.total, 3); assert.equal(score.correct, 1);
  assert.equal(score.results[1].unanswered, true);
  assert.equal(score.results[2].correct, false);
});
