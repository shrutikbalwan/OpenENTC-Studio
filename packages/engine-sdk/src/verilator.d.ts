import type { EngineAdapter, Job } from './types.d.ts';
export interface VerilatorReport { kind: 'report'; diagnostics: unknown[]; }
export declare function parseVerilatorDiagnostics(text: string): VerilatorReport;
export declare function createVerilatorAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { sources?: string[]; topUnit?: string }, VerilatorReport>;
