export interface ComplexValue { re: number; im: number }
export declare const WAVEFORMS: Readonly<Record<string, { label: string; value(u: number, amplitude: number, duty?: number): number; a0(amplitude: number, duty?: number): number; an(n: number, amplitude: number, duty?: number): number; bn(n: number, amplitude: number, duty?: number): number }>>;
export declare function numericCoefficients(value: (u: number) => number, harmonics: number, samples?: number): { a0: number; an: number[]; bn: number[] };
export declare function fourierSeries(type: string, options?: { amplitude?: number; duty?: number; harmonics?: number; points?: number; frequency?: number }): {
  type: string; a0: number; coefficients: { n: number; frequency: number; an: number; bn: number; magnitude: number; phase: number }[];
  t: number[]; original: number[]; synthesis: number[]; totalPower: number; capturedPower: number; powerFraction: number; overshoot: number; rms: number;
};
export declare function polyDivide(a: number[], b: number[]): { quotient: number[]; remainder: number[] };
export interface Term { pole: ComplexValue; order: number; residue: ComplexValue }
export declare function partialFractions(numerator: number[], denominator: number[]): { direct: number[]; terms: Term[] };
export declare function inverseLaplace(numerator: number[], denominator: number[]): { direct: number[]; terms: Term[]; evaluate(t: number): number; expression: string; impulses: { order: number; weight: number }[] };
export declare function limitTheorems(numerator: number[], denominator: number[]): { initial: number | null; final: number | null; finalExists: boolean };
export declare function partialFractionsZ(b: number[], a: number[]): { direct: number[]; terms: Term[] };
export declare function inverseZ(b: number[], a: number[], count?: number): { direct: number[]; terms: Term[]; h: number[]; rocRadius: number; stable: boolean; expression: string };
export declare function differenceEquation(b: number[], a: number[], input: number[]): number[];
export declare function longDivision(b: number[], a: number[], count?: number): number[];
export declare function dftSteps(x: number[]): { N: number; rows: { k: number; terms: { n: number; exponent: number; w: ComplexValue; product: ComplexValue }[]; value: ComplexValue; magnitude: number; phase: number }[]; twiddles: ComplexValue[]; operations: { multiplications: number; additions: number } };
export declare function fftButterflies(x: number[]): { N: number; bitReversedOrder: number[]; stages: { size: number; butterflies: { top: number; bottom: number; twiddle: string; w: ComplexValue; inTop: ComplexValue; inBottom: ComplexValue; outTop: ComplexValue; outBottom: ComplexValue }[]; values: ComplexValue[] }[]; output: ComplexValue[]; operations: { multiplications: number; additions: number } };
