import type { EngineAdapter, Job } from './types.d.ts';
export interface GhdlReport { kind: 'report'; diagnostics: unknown[]; }
export declare function parseGhdlDiagnostics(text: string): GhdlReport;
export declare function createGhdlAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { sources?: string[]; topEntity?: string; waveformPath?: string; stopTimeNs?: number }, GhdlReport>;
