import type { Lesson } from './index.d.ts';

export declare const lessons: readonly Lesson[];
export declare function getLesson(id: string): Lesson | null;
