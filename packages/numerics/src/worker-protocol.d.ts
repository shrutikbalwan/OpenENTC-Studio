export interface WorkerRequest { id: string; operation: 'generate_sine' | 'convolve' | 'fft' | 'window' | 'correlate' | 'resample' | 'fir_filter'; args?: Record<string, unknown>; }
export interface WorkerResponse { id: string | null; ok: boolean; result?: unknown; error?: { code: string; message: string }; }
export declare function encodeWorkerRequest(request: WorkerRequest): string;
export declare function decodeWorkerResponse(line: string): WorkerResponse;
export declare const WORKER_OPERATIONS: readonly string[];
export interface NumericalWorkerTransport { send(line: string): void; onLine(handler: (line: string) => void): void; onExit(handler: (error?: Error) => void): void; terminate(): void; }
export declare function createNumericalWorkerClient(options: { transportFactory: () => NumericalWorkerTransport; timeoutMs?: number }): { request(request: WorkerRequest, options?: { signal?: AbortSignal }): Promise<unknown>; restart(): NumericalWorkerTransport; close(): void; };
