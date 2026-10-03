export declare const TWIN_BANNER: string;
export declare const TWIN_BAUD: number;
export declare function adcToVolts(code: number, vref?: number): number;
export interface TwinOutput { banner: string | null; rc: { period: number; samples: number[] } | null; dc: { a0: number; a1: number } | null; stream: { ms: number; a0: number; a1: number }[]; errors: string[]; complete: number }
export declare function parseTwinOutput(text: string): TwinOutput;
export declare function rcCharge(t: number, r: number, c: number, vs?: number): number;
export declare function fitCharging(times: number[], volts: number[], options?: { vFinal?: number | null }): { tau: number; t0: number; r2: number; points: number; vFinal: number };
export declare function compareRc(options: { r: number; c: number; vs?: number; vref?: number; period: number; raws: number[] }): { times: number[]; volts: number[]; theory: number[]; fit: { tau: number; t0: number; r2: number; points: number; vFinal: number }; tauTheory: number; errorPercent: number; impliedC: number; settled: number };
export declare function compareDivider(options: { vs?: number; rTop: number; rBottom: number; vref?: number; code: number }): { theory: number; measured: number; errorPercent: number; impliedRatio: number };
export declare function explainDifference(errorPercent: number): string;
