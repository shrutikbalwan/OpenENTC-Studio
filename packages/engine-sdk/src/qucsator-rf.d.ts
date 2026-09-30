import type { EngineAdapter, Job } from './types.d.ts';
export interface QucsatorRfReport { kind: 'rf-report'; dataset: boolean; datasetPath: string | null; diagnostics: unknown[]; outputBytes: number; }
export declare function parseQucsatorRfReport(text: string, datasetPath?: string | null): QucsatorRfReport;
export declare function createQucsatorRfAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { netlistPath?: string; outputPath?: string }, QucsatorRfReport>;
