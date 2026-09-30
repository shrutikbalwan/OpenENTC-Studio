export type ResultKind = 'scalar' | 'table' | 'waveform' | 'spectrum' | 'digital-trace' | 'constellation' | 'network' | 'packet-trace' | 'field-reference' | 'artifact' | 'report';
export declare const MAX_RESULT_POINTS: 1000000;
export declare const MAX_RESULT_PAYLOAD_BYTES: 67108864;
export declare const MAX_RESULT_PROVENANCE_INPUT_BYTES: 1000000;
export interface ResultArtifact { path: string; sha256: string; size: number; mediaType: string; [key: string]: unknown; }
export interface Result<T = unknown> {
  readonly kind: ResultKind;
  readonly provenance: { engine: string; inputs: string[]; [key: string]: unknown };
  readonly data: T;
  readonly units: string | null;
  readonly sampleRate: number | null;
  readonly artifacts: ResultArtifact[];
}
export declare function createResult<T>(input: { kind: ResultKind; provenance: Result<T>['provenance']; data?: T; units?: string | null; sampleRate?: number | null; artifacts?: ResultArtifact[] }): Result<T>;
export declare function scalarResult(value: number, units: string | null, provenance: Result['provenance']): Result<number>;
export declare function waveformResult(points: Array<{ t: number; v: number }>, options: { units?: string | null; sampleRate: number; provenance: Result['provenance'] }): Result<unknown>;
export declare function tableResult(rows: number[][], options: { columns?: string[]; units?: string | null; provenance: Result['provenance'] }): Result<unknown>;
export declare function digitalTraceResult(signals: unknown[], options: { timescale: string; provenance: Result['provenance'] }): Result<unknown>;
export declare function constellationResult(symbols: Array<{ i: number; q: number }>, options: { modulation: string; provenance: Result['provenance'] }): Result<unknown>;
