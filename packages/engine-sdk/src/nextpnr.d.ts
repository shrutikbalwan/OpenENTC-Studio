import type { EngineAdapter, Job } from './types.d.ts';
export interface NextpnrReport { kind: 'report'; target: string | null; timingMHz: number | null; belsUsed: number | null; }
export declare function parseNextpnrReport(text: string): NextpnrReport;
export declare function createNextpnrAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { target?: string; package?: string; netlistPath?: string; constraintsPath?: string; outputPath?: string }, NextpnrReport>;
