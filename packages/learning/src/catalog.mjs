import { validateLessonCatalog } from './index.mjs';

const definitions = [
  {
    id: 'voltage-divider',
    title: 'Voltage divider',
    prerequisites: [],
    checkpoints: [{ id: 'output', kind: 'scalar', expected: 6, tolerance: 0.01 }],
  },
  {
    id: 'dsp-window',
    title: 'Windowed FFT',
    prerequisites: [],
    checkpoints: [{ id: 'samples', kind: 'scalar', expected: 256, tolerance: 0 }],
  },
  {
    id: 'qpsk-ber',
    title: 'QPSK BER',
    prerequisites: [],
    checkpoints: [{ id: 'ber', kind: 'ber', maxRate: 0.2, tolerance: 0 }],
  },
];

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const lessons = Object.freeze(validateLessonCatalog(definitions).map((lesson) => deepFreeze(lesson)));

export function getLesson(id) {
  return lessons.find((lesson) => lesson.id === id) || null;
}
