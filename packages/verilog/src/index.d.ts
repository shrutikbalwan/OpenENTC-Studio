export declare class Value {
  constructor(width: number, v?: bigint, x?: bigint, z?: bigint, signed?: boolean);
  width: number; v: bigint; x: bigint; z: bigint; signed: boolean;
  static of(width: number, number: number | bigint, signed?: boolean): Value;
  static unknown(width: number, signed?: boolean): Value;
  static highZ(width: number): Value;
  get known(): boolean;
  get big(): bigint;
  get signedBig(): bigint;
  toNumber(): number;
  resize(width: number, signedExtend?: boolean): Value;
  equals(other: Value): boolean;
  toBinary(): string;
}
export declare function parseNumber(text: string): Value;
export declare class VerilogError extends Error { line: number | null }
export interface Token { type: 'id' | 'keyword' | 'number' | 'string' | 'system' | 'op' | 'eof'; value: string; line: number }
export declare function tokenize(source: string): Token[];
export declare function parse(source: string): { name: string; line: number; ports: string[]; params: unknown[]; items: unknown[] }[];
export interface SignalTrace { path: string; name: string; scope: string; width: number; history: { t: number; value: Value }[]; final: Value }
export interface SimulationResult { output: string; error: string | null; time: number; finished: boolean; finishReason: string | null; steps: number; signals: SignalTrace[]; scopes: string[]; tops: string[] }
export declare function simulate(source: string, options?: { top?: string | null; maxTime?: number; maxSteps?: number; maxOutput?: number; randomSeed?: number }): SimulationResult;
export declare function resultToVcd(result: SimulationResult): string;
export declare const VERILOG_EXAMPLES: readonly { id: string; name: string; source: string }[];
