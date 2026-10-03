// Learning Hub workspace. Entry points: renderLearningHub(state); bindLearningHubEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState } from '../../core/store.js';
import { findLesson, lessonIndex, TRACKS } from '../../../packages/learning/src/courseware.mjs';
import { instantiate, scoreQuiz } from '../../../packages/learning/src/quiz.mjs';
import { labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { makeLab } from '../../controllers/lab-controls.js';

const LEARN_TABS = [['tracks', 'Tracks & lessons'], ['quiz', 'Quiz'], ['viva', 'Viva practice'], ['verified', 'Verified lab checkpoints']];
const learnLab = makeLab('learn-lab', {
  tab: 'tracks',
  tracks: { track: 'circuits', lesson: '' },
  quiz: { lesson: 'ohm-kirchhoff', seed: 1, responses: {}, checked: false },
  viva: { track: 'circuits', index: 0, reveal: false },
  progress: { scores: {}, known: {} },
});
const lessonPassed = (progress, id) => (progress.scores[id] ?? 0) >= 66;
const trackProgress = (progress, track) => track.lessons.filter((lesson) => lessonPassed(progress, lesson.id)).length;
function renderLearnTracks(config) {
  const c = config.tracks, progress = config.progress;
  const track = TRACKS.find((t) => t.id === c.track) ?? TRACKS[0];
  const lesson = track.lessons.find((l) => l.id === c.lesson);
  const cards = `<section class="track-grid">${TRACKS.map((t, index) => { const done = trackProgress(progress, t); return `<article class="${t.id === track.id ? 'selected' : ''}" style="--track:${t.color}"><span class="track-number">${String(index + 1).padStart(2, '0')}</span><span class="track-level">${esc(t.level)}</span><h3>${esc(t.title)}</h3><p>${t.lessons.length} lessons · ${t.viva.length} viva questions</p><div class="progress"><i style="width:${(100 * done / t.lessons.length).toFixed(0)}%"></i></div><button class="button subtle" data-learn-track="${t.id}">${done ? `${done}/${t.lessons.length} passed — open` : 'Open track'}</button></article>`; }).join('')}</section>`;
  const list = `<div class="lesson-list"><span class="panel-label">${esc(track.title.toUpperCase())}</span>${track.lessons.map((l, index) => `<button class="lesson-row ${l.id === c.lesson ? 'active' : ''}" data-learn-lesson="${l.id}"><span>${index + 1}</span><b>${esc(l.title)}</b><small>${l.minutes} min · ${esc(l.lab.label)}</small><em>${lessonPassed(progress, l.id) ? `✓ ${Math.round(progress.scores[l.id])} %` : progress.scores[l.id] !== undefined ? `${Math.round(progress.scores[l.id])} %` : ''}</em></button>`).join('')}</div>`;
  const view = lesson ? `<article class="lesson-view"><span class="eyebrow">${esc(track.title)} · ${lesson.minutes} min</span><h2>${esc(lesson.title)}</h2>${lesson.summary.map((p) => `<p>${esc(p)}</p>`).join('')}<span class="panel-label">KEY FORMULAS</span><ul class="formula-list">${lesson.formulas.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><div class="lesson-actions"><button class="button primary" data-module="${lesson.lab.module}">Try it: ${esc(lesson.lab.label)} →</button><button class="button run" data-learn-quiz="${lesson.id}">Take the quiz (${lesson.questions.length} questions)</button></div></article>` : '<p class="field-help">Choose a lesson. Each one explains an idea in a few paragraphs, lists the key formulas, links to the lab where you can try it, and ends with a short quiz. A lesson counts as passed at 66 % or more.</p>';
  return `${cards}<div class="lesson-layout">${list}${view}</div>`;
}
function renderLearnQuiz(config) {
  const c = config.quiz, lesson = findLesson(c.lesson) ?? lessonIndex()[0];
  const instances = lesson.questions.map((q, k) => instantiate(q, c.seed * 97 + k));
  const score = c.checked ? scoreQuiz(instances, c.responses || {}) : null;
  const options = TRACKS.map((t) => `<optgroup label="${esc(t.title)}">${t.lessons.map((l) => `<option value="${l.id}" ${l.id === lesson.id ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</optgroup>`).join('');
  const questions = instances.map((q, k) => {
    const result = score?.results[k], response = c.responses?.[q.id] ?? '';
    const input = q.kind === 'mcq'
      ? `<div class="quiz-options">${q.options.map((option, i) => `<label class="${result && i === q.answer ? 'right' : ''} ${result && String(i) === String(response) && !result.correct ? 'wrong' : ''}"><input type="radio" name="q-${q.id}" value="${i}" data-learn-answer="${q.id}" ${String(i) === String(response) ? 'checked' : ''} ${c.checked ? 'disabled' : ''}> ${esc(option)}</label>`).join('')}</div>`
      : `<label class="quiz-numeric">Answer${q.unit ? ` (${esc(q.unit)})` : ''}<input type="text" spellcheck="false" data-learn-answer="${q.id}" value="${esc(response)}" placeholder="e.g. 4.7k or 0.0047" ${c.checked ? 'disabled' : ''}></label>`;
    const feedback = result ? `<div class="quiz-feedback ${result.correct ? 'ok' : 'bad'}"><b>${result.correct ? 'Correct' : result.unanswered ? 'Not answered' : 'Not quite'}</b> — answer: ${esc(result.expected)}. ${esc(result.explanation)}</div>` : '';
    return `<div class="quiz-question"><span class="quiz-number">${k + 1}</span><div><p>${esc(q.prompt)}</p>${input}${feedback}</div></div>`;
  }).join('');
  const best = config.progress.scores[lesson.id];
  return `<div class="dsp-controls"><label>Lesson<select data-learn-quiz-lesson>${options}</select></label>${best !== undefined ? `<span class="pill ${best >= 66 ? 'live' : ''}"><i></i> BEST ${Math.round(best)} %</span>` : ''}</div>
    <div class="quiz">${questions}</div>
    <div class="lesson-actions">${c.checked ? `<div class="quiz-score">Score: ${score.correct} / ${score.total} (${Math.round(score.percent)} %)</div><button class="button run" data-learn-new>New numbers, try again</button>` : '<button class="button run" data-learn-check>Check answers</button>'}<button class="button" data-module="${lesson.lab.module}">Open ${esc(lesson.lab.label)}</button></div>
    <p class="field-help">Numeric answers accept engineering notation (4.7k, 220n, 2.2M) and units are ignored; within 2 % counts as correct unless the question needs an exact value. "New numbers" draws fresh values so you cannot just memorise the answer.</p>`;
}
function renderLearnViva(config) {
  const c = config.viva, track = TRACKS.find((t) => t.id === c.track) ?? TRACKS[0];
  const index = Math.min(track.viva.length - 1, Math.max(0, c.index)), [question, answer] = track.viva[index];
  const known = config.progress.known[track.id] ?? [];
  return `<div class="dsp-controls">${labSelect('data-learn-viva-track', 'viva.track', 'Track', track.id, TRACKS.map((t) => [t.id, t.title]))}<span class="pill"><i></i> ${known.length} / ${track.viva.length} MARKED AS KNOWN</span></div>
    <div class="viva-card"><span class="eyebrow">Question ${index + 1} of ${track.viva.length}${known.includes(index) ? ' · known' : ''}</span><h2>${esc(question)}</h2>${c.reveal ? `<p class="viva-answer">${esc(answer)}</p><div class="lesson-actions"><button class="button run" data-learn-viva-mark="known">I knew this</button><button class="button" data-learn-viva-mark="review">Review again</button></div>` : '<p class="field-help">Say your answer out loud first, as you would to an examiner, then reveal the model answer.</p><button class="button primary" data-learn-viva-reveal>Show the answer</button>'}</div>
    <div class="lesson-actions"><button class="button" data-learn-viva-step="-1" ${index === 0 ? 'disabled' : ''}>← Previous</button><button class="button" data-learn-viva-step="1" ${index === track.viva.length - 1 ? 'disabled' : ''}>Next →</button></div>
    <ol class="viva-list">${track.viva.map(([q], i) => `<li class="${known.includes(i) ? 'known' : ''} ${i === index ? 'current' : ''}"><button data-learn-viva-go="${i}">${esc(q)}</button></li>`).join('')}</ol>`;
}
export function renderLearningHub(state) {
  const config = learnLab.configuration(state);
  if (config.tab === 'verified') return renderVerifiedLearning().replace('<div class="page scroll-page">', '<div class="page scroll-page learn-page">').replace('</div><section class="learning-hero">', `</div>${labTabs(LEARN_TABS, config.tab, 'data-learn-tab')}<section class="learning-hero">`);
  const passed = lessonIndex().filter((l) => lessonPassed(config.progress, l.id)).length, total = lessonIndex().length;
  let body;
  try { body = config.tab === 'quiz' ? renderLearnQuiz(config) : config.tab === 'viva' ? renderLearnViva(config) : renderLearnTracks(config); } catch (error) { body = `<div class="diagnostic error"><b>Learning Hub</b><span>${esc(error.message)}</span></div>`; }
  return `<div class="page scroll-page learn-page">${pageHeader(modules.find((item) => item.id === 'learn'), 'LEARN BY DOING', `<span class="pill live"><i></i> ${passed} / ${total} LESSONS PASSED</span>`)}${labTabs(LEARN_TABS, config.tab, 'data-learn-tab')}<div class="dsp-card">${body}</div></div>`;
}
export function bindLearningHubEvents() {
  const update = (fn) => learnLab.persist((config) => fn(config));
  document.querySelectorAll('[data-learn-tab]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tab = b.dataset.learnTab; })));
  document.querySelectorAll('[data-learn-track]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tracks.track = b.dataset.learnTrack; c.tracks.lesson = TRACKS.find((t) => t.id === b.dataset.learnTrack).lessons[0].id; })));
  document.querySelectorAll('[data-learn-lesson]').forEach((b) => b.addEventListener('click', () => update((c) => { c.tracks.lesson = b.dataset.learnLesson; })));
  const startQuiz = (id) => update((c) => { c.tab = 'quiz'; c.quiz = { lesson: id, seed: (c.quiz.seed || 1) + 1, responses: {}, checked: false }; });
  document.querySelectorAll('[data-learn-quiz]').forEach((b) => b.addEventListener('click', () => startQuiz(b.dataset.learnQuiz)));
  document.querySelector('[data-learn-quiz-lesson]')?.addEventListener('change', (event) => startQuiz(event.target.value));
  document.querySelectorAll('[data-learn-answer]').forEach((input) => input.addEventListener('change', () => update((c) => { c.quiz.responses = { ...c.quiz.responses, [input.dataset.learnAnswer]: input.value }; })));
  document.querySelector('[data-learn-check]')?.addEventListener('mousedown', (event) => event.preventDefault());
  document.querySelector('[data-learn-check]')?.addEventListener('click', () => {
    // Pick up a value still being typed (no change event yet).
    const pending = {}; document.querySelectorAll('input[type="text"][data-learn-answer]').forEach((input) => { pending[input.dataset.learnAnswer] = input.value; });
    update((c) => {
      c.quiz.responses = { ...c.quiz.responses, ...pending }; c.quiz.checked = true;
      const lesson = findLesson(c.quiz.lesson), instances = lesson.questions.map((q, k) => instantiate(q, c.quiz.seed * 97 + k));
      const percent = scoreQuiz(instances, c.quiz.responses).percent;
      c.progress.scores = { ...c.progress.scores, [lesson.id]: Math.max(c.progress.scores[lesson.id] ?? 0, percent) };
    });
  });
  document.querySelector('[data-learn-new]')?.addEventListener('click', () => update((c) => { c.quiz = { ...c.quiz, seed: c.quiz.seed + 1, responses: {}, checked: false }; }));
  document.querySelector('[data-learn-viva-track="viva.track"]')?.addEventListener('change', (event) => update((c) => { c.viva = { track: event.target.value, index: 0, reveal: false }; }));
  document.querySelector('[data-learn-viva-reveal]')?.addEventListener('click', () => update((c) => { c.viva.reveal = true; }));
  document.querySelectorAll('[data-learn-viva-step]').forEach((b) => b.addEventListener('click', () => update((c) => { c.viva.index += Number(b.dataset.learnVivaStep); c.viva.reveal = false; })));
  document.querySelectorAll('[data-learn-viva-go]').forEach((b) => b.addEventListener('click', () => update((c) => { c.viva.index = Number(b.dataset.learnVivaGo); c.viva.reveal = false; })));
  document.querySelectorAll('[data-learn-viva-mark]').forEach((b) => b.addEventListener('click', () => update((c) => {
    const track = TRACKS.find((t) => t.id === c.viva.track) ?? TRACKS[0], list = new Set(c.progress.known[track.id] ?? []);
    if (b.dataset.learnVivaMark === 'known') list.add(c.viva.index); else list.delete(c.viva.index);
    c.progress.known = { ...c.progress.known, [track.id]: [...list].sort((x, y) => x - y) };
    if (c.viva.index < track.viva.length - 1) c.viva.index += 1;
    c.viva.reveal = false;
  })));
}
function renderVerifiedLearning() {
  const state = getState(); const evaluation = state.lessonEvaluation || (state.learningProgress?.lessons['voltage-divider'] ? { passed: state.learningProgress.lessons['voltage-divider'].passed } : null); const dspPassed = state.learningProgress?.lessons['dsp-window']?.passed; const commPassed = state.learningProgress?.lessons['qpsk-ber']?.passed;
  return `<div class="page scroll-page">${pageHeader(modules.at(-1), 'LEARN BY BUILDING', '<button class="button primary" data-action="open-lesson-circuit">Open Circuit Lab</button>')}<section class="learning-hero"><div><span class="pill live"><i></i> VERIFIED CHECKPOINTS</span><h2>Build, measure, verify.</h2><p>Checkpoints consume real Circuit, Signals and Link Lab results with explicit tolerances.</p></div><div class="progress-ring"><strong>${[evaluation?.passed, dspPassed, commPassed].filter(Boolean).length}/3</strong><span>CHECKPOINT<br>PROGRESS</span></div></section><section class="track-grid"><article><span class="track-number">01</span><span class="track-level">FOUNDATION</span><h3>DC fundamentals</h3><p>Verify the output node is 6 V within ±0.01 V.</p><div class="progress"><i style="width:${evaluation?.passed ? '100%' : '0%'}"></i></div><span class="lesson-status">${evaluation ? (evaluation.passed ? 'Passed' : 'Not yet passed') : 'Not attempted'}</span></article><article><span class="track-number">02</span><span class="track-level">SIGNALS</span><h3>Windowed FFT</h3><p>Generate a real bounded signal and verify its sample count.</p><div class="progress"><i style="width:${dspPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-dsp-lesson">${dspPassed ? 'Passed' : 'Check DSP result'}</button></article><article><span class="track-number">03</span><span class="track-level">COMMS</span><h3>QPSK BER</h3><p>Verify offline BER stays below 20%.</p><div class="progress"><i style="width:${commPassed ? '100%' : '0%'}"></i></div><button class="button subtle" data-action="check-comm-lesson">${commPassed ? 'Passed' : 'Check BER result'}</button></article></section></div>`;
}
