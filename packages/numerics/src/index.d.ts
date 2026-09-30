export interface Signal { kind: 'time-series'; data: Float64Array; sampleRate: number; units: string; start: number; }
export interface Spectrum { kind: 'spectrum'; real: Float64Array; imaginary: Float64Array; frequencies: Float64Array; sampleRate: number; units: string; }
export declare function createSignal(samples: ArrayLike<number>, options: { sampleRate: number; units?: string; start?: number }): Signal;
export declare function generateSine(options: { frequency: number; amplitude?: number; phase?: number; offset?: number; sampleRate: number; length: number }): Signal;
export declare function seededNoise(length: number, options?: { seed?: number; amplitude?: number; sampleRate?: number; units?: string }): Signal;
export declare function convolve(input: Signal | ArrayLike<number>, kernel: Signal | ArrayLike<number>): Signal | Float64Array;
export declare function filterFir(signal: Signal | ArrayLike<number>, coefficients: ArrayLike<number>): Signal | Float64Array;
export interface Correlation { kind: 'correlation'; data: Float64Array; lagStart: number; sampleRate: number; units: string; }
export declare function applyWindow(input: Signal | ArrayLike<number>, options?: { window?: 'hann' | 'hamming' | 'rectangular' }): Signal | Float64Array;
export declare function correlate(input: Signal | ArrayLike<number>, reference: Signal | ArrayLike<number>): Correlation;
export declare function resample(input: Signal | ArrayLike<number>, targetSampleRate: number): Signal | Float64Array;
export declare function fft(signal: Signal | ArrayLike<number>): Spectrum;
