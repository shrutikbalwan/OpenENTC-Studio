export interface DigitalSample { time: number; value: string; }
export interface DigitalSignal { id: string; name: string; fullName: string; scope: string; width: number; samples: readonly DigitalSample[]; }
export interface DigitalTrace { kind: 'digital-trace'; timescale: string; signals: readonly DigitalSignal[]; }
export declare function parseVcd(text: string): DigitalTrace;

export type HdlLanguage = 'verilog' | 'systemverilog' | 'vhdl';
export type HdlSourceKind = 'source' | 'testbench';
export type HdlOperation = 'simulate' | 'synthesize' | 'place-route';
export interface HdlSource { path: string; kind: HdlSourceKind; [key: string]: unknown; }
export interface HdlSourceSet { id: string; language: HdlLanguage; sources: readonly HdlSource[]; [key: string]: unknown; }
export interface HdlConstraint { id: string; path: string; [key: string]: unknown; }
export interface HdlTarget { id: string; family: 'generic' | 'ice40'; device?: string; [key: string]: unknown; }
export interface HdlProject { format: 'openentc-hdl-project'; version: 1; name: string; sourceSets: readonly HdlSourceSet[]; topUnit: string | null; constraints: readonly HdlConstraint[]; targets: readonly HdlTarget[]; [key: string]: unknown; }
export interface HdlJob { operation: HdlOperation; targetId: string | null; project: string; sourceSets: readonly string[]; constraints: readonly string[]; }
export declare const HDL_PROJECT_FORMAT: 'openentc-hdl-project';
export declare const HDL_PROJECT_VERSION: 1;
export declare const HDL_OPERATIONS: readonly HdlOperation[];
export declare function createHdlProject(name?: string): HdlProject;
export declare function validateHdlProject(input: unknown): HdlProject;
export declare function createHdlJob(document: unknown, operation: HdlOperation, targetId?: string | null): HdlJob;
