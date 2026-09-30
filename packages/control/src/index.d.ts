export interface TransferFunction { kind: 'transfer-function'; numerator: readonly number[]; denominator: readonly number[]; inputUnits: string; outputUnits: string; }
export interface BodePoint { frequency: number; real: number; imaginary: number; magnitude: number; phase: number; }
export declare function createTransferFunction(numerator: ArrayLike<number>, denominator: ArrayLike<number>, options?: { inputUnits?: string; outputUnits?: string }): TransferFunction;
export declare function frequencyResponse(tf: TransferFunction, frequencies: ArrayLike<number>): { kind: 'bode'; points: readonly BodePoint[]; inputUnits: string; outputUnits: string };
export declare function firstOrderStep(options: { gain?: number; tau: number; sampleRate: number; length: number }): { kind: 'time-series'; data: Float64Array; sampleRate: number; units: string };
export declare function firstOrderStability(tau: number): { stable: boolean; reason: string };
