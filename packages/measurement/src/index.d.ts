export interface Complex { re: number; im: number }
export declare function armImpedance(arm: { r?: number; l?: number; cap?: number; form?: 'series' | 'parallel' }, frequency: number): Complex;
export declare function seriesEquivalent(z: Complex, frequency: number): { r: number; l: number | null; c: number | null; q?: number; d?: number };
export declare function bridgeUnknown(z2: Complex, z3: Complex, z4: Complex): Complex;
export declare function bridgeDetector(z1: Complex, z2: Complex, z3: Complex, z4: Complex, vs?: number): Complex;
export declare const BRIDGES: Readonly<Record<string, { name: string; measures: string; arms: string; formula: string }>>;
export declare function solveBridge(type: string, values: Record<string, number>, frequency?: number): { z?: Complex; unknown?: { r: number; l: number | null; c: number | null; q?: number; d?: number }; closed: Record<string, number>; frequency?: number; ratio?: number; detector?: number };
export declare function lissajous(options?: { fx?: number; fy?: number; ax?: number; ay?: number; phase?: number; points?: number }): { trace: [number, number][]; ratio: string; horizontalTangencies: number; verticalTangencies: number; ellipse?: { intercept: number; ymax: number; phaseFromIntercept: number } };
export declare function rationalApprox(x: number, maxDenominator?: number): { p: number; q: number; error: number };
export declare function phaseFromEllipse(intercept: number, ymax: number): number;
export declare function readingStatistics(values: number[]): { n: number; mean: number; median: number; range: number; averageDeviation: number; sd: number; variance: number; probableError: number; standardError: number; probableErrorOfMean: number; deviations: number[] };
export declare function combineErrors(kind: 'sum' | 'product', terms: { value: number; error: number; power?: number }[]): { worst: number; rss: number; value: number; absolute: boolean };
export declare function fullScaleToReading(percentFsd: number, fullScale: number, reading: number): number;
export declare function voltmeterLoading(options?: { vs?: number; ra?: number; rb?: number; sensitivity?: number; range?: number }): { meterResistance: number; trueV: number; reading: number; errorPercent: number };
export declare function ammeterShunt(options?: { im?: number; rm?: number; range?: number }): { multiplyingPower: number; shunt: number; shuntCurrent: number };
export declare function ayrtonShunt(options?: { im?: number; rm?: number; ranges?: number[] }): { totalShunt: number; taps: number[]; sections: number[]; ranges: number[] };
export declare function voltmeterMultiplier(options?: { im?: number; rm?: number; range?: number }): { multiplier: number; sensitivity: number; totalResistance: number };
export declare function seriesOhmmeter(options?: { battery?: number; im?: number; rm?: number; halfScale?: number }): { r1: number; r2: number; halfScale: number; deflection: (rx: number) => number; scale: { rx: number; fraction: number }[] };
export declare function qMeter(options?: { f1?: number; c1?: number; c2?: number; indicatedQ?: number; shuntR?: number }): { distributedC: number; inductance: number; trueQ: number; coilResistance: number; correctedForShunt: number };
