// Quiz engine: multiple-choice questions and numeric questions whose parameters are drawn from a
// seed, so every attempt gets fresh numbers while the checking stays exact.

const SUFFIX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

/** Parse "4.7k", "2.2 µ", "1e-3", "-12.5 V" (trailing unit letters after the suffix are ignored). */
export function parseAnswer(text) {
  const match = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([fpnuµmkKMGT]?)([A-Za-zΩ°%/²³·]*)\s*$/.exec(String(text).replace(/,/g, ''));
  if (!match) return null;
  let value = Number(match[1]);
  // "m" alone is milli; "M" mega; a bare unit such as "V" or "Hz" is ignored.
  if (match[2]) value *= SUFFIX[match[2]];
  return Number.isFinite(value) ? value : null;
}

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Draw parameters: [min, max, step] picks from a range, { choices: [...] } picks one item, anything else is a constant. */
export function drawParameters(spec, seed) {
  const random = mulberry32(seed);
  return Object.fromEntries(Object.entries(spec || {}).map(([name, range]) => {
    if (Array.isArray(range)) { const [lo, hi, step] = range; const count = Math.floor((hi - lo) / step + 1e-9) + 1; return [name, Number((lo + step * Math.floor(random() * count)).toPrecision(12))]; }
    if (range && Array.isArray(range.choices)) return [name, range.choices[Math.floor(random() * range.choices.length)]];
    return [name, range];
  }));
}

const engineering = (value, unit = '') => {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return `0 ${unit}`.trim();
  const prefixes = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const [scale, prefix] = prefixes.find(([s]) => Math.abs(value) >= s * 0.9999) ?? prefixes.at(-1);
  return `${Number((value / scale).toPrecision(4))} ${prefix}${unit}`.trim();
};
export { engineering };

/** Instantiate a question for a seed: { kind, prompt, options?, answer, unit, tolerance, explanation }. */
export function instantiate(question, seed = 1) {
  if (question.type === 'mcq') return { kind: 'mcq', id: question.id, prompt: question.prompt, options: question.options, answer: question.answer, explanation: question.explain ?? '' };
  const params = drawParameters(question.params, seed);
  const answer = question.answer(params);
  return { kind: 'numeric', id: question.id, prompt: question.prompt(params), params, answer, unit: question.unit ?? '', tolerance: question.tolerance ?? 0.02, explanation: question.explain ? question.explain(params, answer) : '' };
}

/** Check a response: an option index for MCQ, text or a number for numeric (relative tolerance). */
export function checkAnswer(instance, response) {
  if (instance.kind === 'mcq') { const correct = Number(response) === instance.answer; return { correct, expected: instance.options[instance.answer], explanation: instance.explanation }; }
  const value = typeof response === 'number' ? response : parseAnswer(response);
  if (value === null) return { correct: false, invalid: true, expected: engineering(instance.answer, instance.unit), explanation: 'Enter a number, e.g. 4.7k or 0.0047.' };
  const scale = Math.max(Math.abs(instance.answer), 1e-300);
  const correct = Math.abs(value - instance.answer) <= instance.tolerance * scale || (instance.answer === 0 && Math.abs(value) < 1e-12);
  return { correct, value, expected: engineering(instance.answer, instance.unit), explanation: instance.explanation };
}

/** Score a whole quiz: responses keyed by question id. */
export function scoreQuiz(instances, responses) {
  const results = instances.map((instance) => ({ id: instance.id, ...(responses[instance.id] === undefined || responses[instance.id] === '' ? { correct: false, unanswered: true, expected: instance.kind === 'mcq' ? instance.options[instance.answer] : engineering(instance.answer, instance.unit), explanation: instance.explanation } : checkAnswer(instance, responses[instance.id])) }));
  const correct = results.filter((r) => r.correct).length;
  return { results, correct, total: instances.length, percent: instances.length ? 100 * correct / instances.length : 0 };
}
