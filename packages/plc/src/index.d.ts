export type Condition = { kind: 'always' } | { kind: 'contact'; name: string; negated: boolean; edge: boolean } | { kind: 'and' | 'or'; items: Condition[] };
export interface Output { kind: 'coil' | 'set' | 'reset' | 'ton' | 'tof' | 'tp' | 'ctu' | 'ctd' | 'res'; name: string; preset?: number }
export interface Rung { condition: Condition; outputs: Output[]; source: string; line: number }
export interface PlcState { bits: Record<string, boolean>; timers: Record<string, { elapsed: number; done: boolean; preset: number; kind: string; running: boolean }>; counters: Record<string, { count: number; done: boolean; preset: number; kind: string }>; edges: Record<string, boolean>; outputEdges: Record<string, boolean>; time: number; scans: number }
export declare function parseLadder(text: string): Rung[];
export declare function createPlc(): PlcState;
export declare function operands(rungs: Rung[]): { inputs: string[]; outputs: string[]; memory: string[]; timers: string[]; counters: string[] };
export declare function scan(plc: PlcState, rungs: Rung[], inputs?: Record<string, boolean | number>, dt?: number): boolean[];
export declare function parseInputScript(text: string): { time: number; name: string; value: boolean }[];
export declare function runLadder(rungs: Rung[], options?: { events?: { time: number; name: string; value: boolean }[]; duration?: number; scanTime?: number; watch?: string[] | null }): { times: number[]; traces: Record<string, number[]>; plc: PlcState; names: string[] };
export declare function firstRise(result: { times: number[]; traces: Record<string, number[]> }, name: string, after?: number): number | null;
export type LaidOut = (Condition & { w: number; h: number; items?: LaidOut[] });
export declare function layoutCondition(node: Condition): LaidOut;
export declare const LADDER_EXAMPLES: Readonly<Record<string, [string, string, string]>>;
