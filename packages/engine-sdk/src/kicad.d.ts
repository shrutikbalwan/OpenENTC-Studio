import type { EngineAdapter, Job } from './types.d.ts';
export interface KiCadReport { kind: 'report'; diagnostics: unknown[]; }
export declare function parseKiCadReport(text: string): KiCadReport;
export declare function createKiCadAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { projectPath?: string }, KiCadReport>;
