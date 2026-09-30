import type { EngineAdapter, Job } from './types.d.ts';
export interface RenodeDiagnosticResult { kind: 'emulation-report'; diagnostics: unknown[]; }
export declare function parseRenodeDiagnostics(output: string): RenodeDiagnosticResult;
export declare function createRenodeAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { scriptPath?: string; machine?: string }, RenodeDiagnosticResult>;
