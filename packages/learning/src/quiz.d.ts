export declare function parseAnswer(text: string): number | null;
export declare function drawParameters(spec: Record<string, unknown> | undefined, seed: number): Record<string, any>;
export declare function engineering(value: number, unit?: string): string;
export interface McqQuestion { type: 'mcq'; id: string; prompt: string; options: string[]; answer: number; explain?: string }
export interface NumericQuestion { type: 'numeric'; id: string; params: Record<string, unknown>; prompt(p: Record<string, any>): string; answer(p: Record<string, any>): number; unit?: string; tolerance?: number; explain?(p: Record<string, any>, answer: number): string }
export type Question = McqQuestion | NumericQuestion;
export interface Instance { kind: 'mcq' | 'numeric'; id: string; prompt: string; options?: string[]; answer: number; unit?: string; tolerance?: number; params?: Record<string, any>; explanation: string }
export declare function instantiate(question: Question, seed?: number): Instance;
export interface Check { correct: boolean; invalid?: boolean; unanswered?: boolean; value?: number; expected: string; explanation: string }
export declare function checkAnswer(instance: Instance, response: string | number): Check;
export declare function scoreQuiz(instances: Instance[], responses: Record<string, string | number>): { results: (Check & { id: string })[]; correct: number; total: number; percent: number };
