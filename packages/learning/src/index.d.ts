export interface LessonCheckpoint { id: string; kind: 'scalar' | 'table-cell' | 'ber'; expected?: number; tolerance: number; row?: number; column?: number; maxRate?: number; }
export interface Lesson { id: string; title: string; prerequisites: string[]; checkpoints: LessonCheckpoint[]; [key: string]: unknown; }
export declare function validateLesson(lesson: Lesson): Readonly<Lesson>;
export declare function validateLessonCatalog(catalog: Lesson[]): readonly Lesson[];
export declare function evaluateCheckpoint(checkpoint: LessonCheckpoint, result: unknown): { passed: boolean; [key: string]: unknown };
export declare function evaluateLesson(lesson: Lesson, resultsByCheckpoint?: Record<string, unknown>): { passed: boolean; checkpoints: readonly unknown[] };
