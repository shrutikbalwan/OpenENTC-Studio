import type { EngineAdapter, Job } from './types.d.ts';
export interface PlatformIoDiagnosticResult { kind: 'firmware-build-report'; diagnostics: unknown[]; }
export declare function parsePlatformIoDiagnostics(text: string): PlatformIoDiagnosticResult;
export declare function createPlatformIoAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { projectPath?: string; environment?: string }, PlatformIoDiagnosticResult>;
