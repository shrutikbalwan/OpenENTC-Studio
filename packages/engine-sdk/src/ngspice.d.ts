import type { EngineAdapter, Job } from './types.d.ts';
export interface NgspiceMeasurementResult { kind: 'scalar-table'; units: 'SI'; measurements: Record<string, number>; }
export declare function parseNgspiceVersion(text: string): string;
export interface NgspiceDiagnostic { severity: 'info' | 'warning' | 'error'; code: string; message: string; source: string | null; line: number | null; column: number | null; fix: string | null; }
export declare function parseNgspiceDiagnostics(text: string): readonly NgspiceDiagnostic[];
export declare function parseNgspiceMeasurements(text: string): NgspiceMeasurementResult;
export interface NgspiceTableResult { kind: 'table'; columns: string[]; rows: number[][]; units: 'SI'; }
export interface NgspiceJob extends Job { components: unknown[]; wires?: unknown[]; title?: string; outputs?: string[]; source?: string; start?: number; stop?: number; step?: number; points?: number; startHz?: number; stopHz?: number; stepTime?: number; stopTime?: number; }
export declare function parseNgspiceOutput(text: string): NgspiceMeasurementResult | NgspiceTableResult;
export declare function createNgspiceAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell?: boolean; netlist: string; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null }): EngineAdapter<NgspiceJob, NgspiceMeasurementResult | NgspiceTableResult>;
