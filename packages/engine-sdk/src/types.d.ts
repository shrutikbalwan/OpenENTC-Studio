export type JobState = 'queued' | 'preparing' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';
export interface EngineAdapter<Job = unknown, Result = unknown> {
  metadata(): Record<string, unknown>;
  detect(): Promise<Record<string, unknown>>;
  selfTest(): Promise<Record<string, unknown>>;
  capabilities(): string[];
  validate(job: Job): unknown;
  prepare(job: Job): Promise<unknown>;
  run(job: Job, eventSink?: (event: unknown) => void): Promise<unknown>;
  parse(job: Job): Promise<Result>;
  cancel(job: Job): Promise<void>;
  clean(job: Job): Promise<void>;
}
export interface JobArtifact { path: string; sha256: string; size: number; mediaType: string; [key: string]: unknown; }
export declare function assertAdapter<T extends EngineAdapter>(adapter: T): T;
export declare function createAdapter<T extends EngineAdapter>(adapter: T): T;
export declare function executeAdapterJob<T extends EngineAdapter>(adapter: T, job: Job, eventSink?: (event: unknown) => void, options?: { signal?: AbortSignal }): Promise<Job & { result?: unknown }>;
export interface Job {
  id: string;
  projectId: string;
  operation: string;
  adapter: string | null;
  engineVersion: string | null;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  inputs: string[];
  outputs: string[];
  arguments: string[];
  resourcePolicy: Record<string, unknown>;
  reproducibility: { inputs: string[]; arguments: string[]; [key: string]: unknown };
  diagnostics: unknown[];
  artifacts: JobArtifact[];
  logs: unknown[];
}
export declare function createJob(input: Pick<Job, 'id' | 'projectId' | 'operation'> & Partial<Job>): Job;
export declare function transitionJob(job: Job, nextState: JobState): Job;
export declare function requestCancel(job: Job): Job;
export declare function completeCancellation(job: Job): Job;
export declare function failJob(job: Job, error: unknown): Job;
export { createNgspiceAdapter, parseNgspiceDiagnostics, parseNgspiceMeasurements, parseNgspiceOutput, parseNgspiceVersion } from './ngspice.d.ts';
export { createArduinoCliAdapter, parseArduinoCliVersion, parseArduinoDiagnostics, parseArduinoInventory } from './arduino-cli.d.ts';
export { createKiCadAdapter, parseKiCadReport } from './kicad.d.ts';
export { createVerilatorAdapter, parseVerilatorDiagnostics } from './verilator.d.ts';
export { createGhdlAdapter, parseGhdlDiagnostics } from './ghdl.d.ts';
export { createYosysAdapter, parseYosysReport } from './yosys.d.ts';
export { createNextpnrAdapter, parseNextpnrReport } from './nextpnr.d.ts';
export { createQucsatorRfAdapter, parseQucsatorRfReport } from './qucsator-rf.d.ts';
export { createTsharkAdapter, parseTsharkDiagnostics, parseTsharkJson } from './tshark.d.ts';
export { createPlatformIoAdapter, parsePlatformIoDiagnostics } from './platformio.d.ts';
export { createRenodeAdapter, parseRenodeDiagnostics } from './renode.d.ts';
export { assertAbsoluteExecutable, probeExecutable, probeEngineManifest, loadAndProbeManifest } from './discovery.d.ts';
export { validateEngineManifest } from './manifest.d.ts';
