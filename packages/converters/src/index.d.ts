export declare function createRandom(seed?: number): { next(): number; gaussian(): number };
export declare function fftRadix2(re: Float64Array | number[], im: Float64Array | number[]): void;
export declare function powerSpectrum(samples: ArrayLike<number>, options?: { window?: 'none' | 'blackman-harris' }): Float64Array;
export declare function coherentCycles(n: number, target: number): number;
export interface Adc { bits: number; vref: number; lsb: number; thresholds: Float64Array }
export declare function adcThresholds(options?: { bits?: number; vref?: number; offsetLsb?: number; gainErrorPercent?: number; bowLsb?: number; mismatchLsb?: number; seed?: number }): Adc;
export declare function adcCode(adc: Adc, v: number): number;
export interface Linearity { dnl: number[]; inl: number[]; missingCodes: number[]; maxDnl: number; maxInl: number }
export declare function linearity(adc: Adc): Linearity & { offsetLsb: number; gainErrorPercent: number };
export declare function histogramTest(adc: Adc, options?: { samplesPerCode?: number }): Linearity & { counts: number[] };
export declare function dynamicTest(adc: Adc, options?: { n?: number; cycles?: number | null; amplitudeFraction?: number; harmonicsCount?: number; noiseLsb?: number; seed?: number }): {
  cycles: number; codes: number[]; spectrumDbfs: number[]; snr: number; sinad: number; thd: number; sfdr: number; enob: number; idealSnr: number;
};
export declare function sarConvert(vin: number, options?: { bits?: number; vref?: number; comparatorOffset?: number }): { code: number; voltage: number; clocks: number; steps: { bit: number; trial: number; dac: number; keep: boolean; code: number }[] };
export declare function flashConvert(vin: number, options?: { bits?: number; vref?: number }): { code: number; references: number[]; thermometer: number[]; comparators: number; resistors: number };
export declare function dualSlope(vin: number, options?: { bits?: number; vref?: number; clock?: number; r?: number; c?: number }): { count: number; n1: number; t1: number; t2: number; peak: number; conversionTime: number; waveform: [number, number][]; resultVoltage: number };
export declare function integratingRejection(frequency: number, t1: number): number;
export declare function sigmaDelta(options?: { order?: 1 | 2; osr?: number; n?: number; amplitude?: number; cycles?: number | null; dither?: number; seed?: number }): {
  order: number; osr: number; cycles: number; bitstream: number[]; spectrumDb: number[]; bandEdgeBin: number; sqnr: number; theorySqnrFullScale: number; decimated: { index: number; value: number }[]; ones: number;
};
export interface DacReport { kind: string; bits: number; vref: number; levels: number[]; lsb: number; idealLsb: number; fullScale: number; resistors: Record<string, number | number[]>; resistorCount: number; resistorSpread: number; dnl: number[]; inl: number[]; maxDnl: number; maxInl: number; monotonic: boolean; worstStep: number }
export declare function r2rDac(options?: { bits?: number; vref?: number; r?: number; tolerancePercent?: number; seed?: number }): DacReport;
export declare function weightedDac(options?: { bits?: number; vref?: number; r?: number; tolerancePercent?: number; seed?: number }): DacReport;
