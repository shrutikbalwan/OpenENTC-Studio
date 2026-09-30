import type { EngineAdapter, Job } from './types.d.ts';
export interface TsharkPacketTrace { kind: 'packet-trace'; packets: readonly Record<string, unknown>[]; }
export declare function parseTsharkJson(text: string): TsharkPacketTrace;
export declare function parseTsharkDiagnostics(text: string): unknown[];
export declare function createTsharkAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<Job & { capturePath?: string; displayFilter?: string; maxPackets?: number }, { result: TsharkPacketTrace; diagnostics: unknown[] }>;
