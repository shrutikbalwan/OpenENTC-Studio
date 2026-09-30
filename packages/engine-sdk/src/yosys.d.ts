import type { EngineAdapter, Job } from './types.d.ts';
export interface YosysReport { kind: 'report'; metrics: Record<string, number>; textBytes: number; }
export declare function parseYosysReport(text: string): YosysReport;
export declare function createYosysAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { sources?: string[]; topModule?: string; netlistPath?: string }, YosysReport>;
