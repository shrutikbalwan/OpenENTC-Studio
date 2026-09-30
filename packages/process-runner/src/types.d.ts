export declare const PROCESS_ERROR_CODES: {
  readonly INVALID_EXECUTABLE: 'PROCESS_INVALID_EXECUTABLE';
  readonly INVALID_ARGUMENTS: 'PROCESS_INVALID_ARGUMENTS';
  readonly OUTPUT_LIMIT: 'PROCESS_OUTPUT_LIMIT';
  readonly TIMEOUT: 'PROCESS_TIMEOUT';
  readonly CANCELLED: 'PROCESS_CANCELLED';
};
export declare const MAX_PROCESS_OUTPUT_BYTES: 16777216;
export declare const MAX_PROCESS_ARGS: 256;
export declare const MAX_PROCESS_ARG_BYTES: 65536;
export declare const MAX_PROCESS_PATH_BYTES: 32768;
export declare const MAX_PROCESS_TIMEOUT_MS: 86400000;
export interface ProcessSpec { executable: string; args?: string[]; cwd?: string; timeoutMs?: number; maxOutputBytes?: number; }
export interface ProcessResult { ok: boolean; code: number | null; signal: string | null; stdout: string; stderr: string; error: string | null; }
export interface SpawnLike { (executable: string, args: string[], options: { cwd?: string; shell: false; windowsHide: boolean; detached: boolean }): any; }
export declare function runProcess(spec: ProcessSpec, options?: { signal?: AbortSignal; spawnImpl?: SpawnLike }): Promise<ProcessResult>;
