import type { Question } from './quiz.d.ts';
export interface CourseLesson { id: string; title: string; minutes: number; lab: { module: string; label: string }; summary: string[]; formulas: string[]; questions: Question[] }
export interface Track { id: string; title: string; level: string; color: string; lessons: CourseLesson[]; viva: [string, string][] }
export declare const TRACKS: Track[];
export declare function lessonIndex(): (CourseLesson & { track: string; trackTitle: string })[];
export declare function findLesson(id: string): (CourseLesson & { track: string; trackTitle: string }) | null;
