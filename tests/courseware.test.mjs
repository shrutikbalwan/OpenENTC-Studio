import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, drawParameters, instantiate, parseAnswer, scoreQuiz } from '../packages/learning/src/quiz.mjs';
import { findLesson, lessonIndex, TRACKS } from '../packages/learning/src/courseware.mjs';
import { modules } from '../src/data/modules.js';
import { freeSpaceLoss, offeredTraffic, reusePlan } from '../packages/cellular/src/index.mjs';
import { sensitivity, superhet } from '../packages/commsys/src/index.mjs';
import { rectangularWaveguide } from '../packages/em/src/index.mjs';
import { awgnCapacity, binaryEntropy } from '../packages/infotheory/src/index.mjs';
import { solveBridge, ammeterShunt } from '../packages/measurement/src/index.mjs';
import { doppler, orbit, pulseRadar, satelliteLink } from '../packages/radarsat/src/index.mjs';
import { hzToMel } from '../packages/speech/src/index.mjs';
import { designOscillator } from '../packages/analogdesign/src/index.mjs';
import { ujtOscillator } from '../packages/machines/src/index.mjs';
import { heatsink } from '../packages/productdesign/src/index.mjs';

test('answer parsing understands engineering notation', () => {
  assert.equal(parseAnswer('4.7k'), 4700); assert.equal(parseAnswer('2.2 µF'), 2.2e-6); assert.equal(parseAnswer('-12.5 V'), -12.5);
  assert.equal(parseAnswer('1e-3'), 0.001); assert.equal(parseAnswer('15 mA'), 0.015); assert.equal(parseAnswer('3M'), 3e6); assert.equal(parseAnswer('1,200'), 1200);
  assert.equal(parseAnswer('abc'), null);
  assert.deepEqual(drawParameters({ a: [1, 5, 1], b: { choices: ['x', 'y'] }, c: 7 }, 3), drawParameters({ a: [1, 5, 1], b: { choices: ['x', 'y'] }, c: 7 }, 3));
});

test('eight tracks, each lesson complete, every lab link points to a real module', () => {
  assert.equal(TRACKS.length, 8);
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
  assert.ok(lessonIndex().length >= 49);
  for (const module of ['info', 'analog', 'measure', 'radar', 'speech', 'plc', 'machines', 'product', 'faulthunt']) assert.ok(lessonIndex().some((lesson) => lesson.lab.module === module), `a lesson links to ${module}`);
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

test('new-track quiz answers agree with the new lab engines', () => {
  const answer = (lessonId, questionId, seed) => instantiate(findLesson(lessonId).questions.find((q) => q.id === questionId), seed);
  const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
  for (let seed = 1; seed <= 10; seed += 1) {
    const m = answer('bridges', 'maxwell-l', seed);
    close(m.answer, solveBridge('maxwell', { R1: 1e5, C1: m.params.c1, R2: m.params.r2, R3: m.params.r3 }).unknown.l, 'Maxwell');
    const sh = answer('meters', 'shunt', seed);
    close(sh.answer, ammeterShunt({ im: sh.params.im, rm: sh.params.rm, range: sh.params.range }).shunt, 'shunt');
    const u = answer('power-devices', 'ujt', seed);
    close(u.answer, ujtOscillator({ r: u.params.r, cap: u.params.c, eta: u.params.eta }).frequency, 'UJT');
    const h = answer('product', 'theta-sa', seed);
    close(h.answer, heatsink({ power: h.params.p, tjMax: h.params.tj, ambient: h.params.ta, thetaJc: h.params.jc, thetaCs: 0.5, margin: 1 }).requiredSa, 'θsa');
    const hb = answer('entropy-huffman', 'hb', seed);
    close(hb.answer, binaryEntropy(hb.params.p), 'Hb');
    const cap = answer('entropy-huffman', 'capacity', seed);
    close(cap.answer, awgnCapacity(cap.params.b, cap.params.snr).capacity, 'capacity');
    const w = answer('analog-design', 'wien-f', seed);
    close(w.answer, designOscillator({ type: 'wien', frequency: w.answer, c: w.params.c, series: 'exact' }).actual, 'Wien');
    const r = answer('radar', 'runamb', seed);
    close(r.answer, pulseRadar({ prf: r.params.prf }).unambiguousRange, 'Runamb');
    const d = answer('radar', 'doppler', seed);
    close(d.answer, doppler({ frequency: d.params.f, velocity: d.params.v }).fd, 'Doppler');
    const f = answer('satellite', 'fspl-sat', seed);
    close(f.answer, satelliteLink({ frequency: f.params.f, distance: f.params.d }).fspl, 'FSPL');
    const t = answer('satellite', 'period', seed);
    close(t.answer, orbit({ perigeeAltitude: t.params.alt }).period, 'period');
    const mel = answer('speech', 'mel', seed);
    close(mel.answer, hzToMel(mel.params.f), 'mel');
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
