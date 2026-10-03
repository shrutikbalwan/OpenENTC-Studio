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

export interface Complex { re: number; im: number }
export declare function complex(re: number, im?: number): Complex;
export declare function cadd(a: Complex, b: Complex): Complex;
export declare function csub(a: Complex, b: Complex): Complex;
export declare function cmul(a: Complex, b: Complex): Complex;
export declare function cdiv(a: Complex, b: Complex): Complex;
export declare function cabs(a: Complex): number;
export declare function cscale(a: Complex, s: number): Complex;
export declare function csqrt(a: Complex): Complex;
export declare function cexp(a: Complex): Complex;
export declare function polyval(coefficients: readonly (number | Complex)[], x: Complex): Complex;
export declare function polyFromRoots(roots: readonly Complex[]): number[];
export declare function trimLeadingZeros(coefficients: readonly number[]): number[];
export declare function polyRoots(coefficients: readonly number[]): Complex[];
export declare function polymul(a: readonly number[], b: readonly number[]): number[];
export declare function polyadd(a: readonly number[], b: readonly number[]): number[];

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'bandstop';
export type FirWindow = 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'kaiser';
export declare const FILTER_TYPES: readonly FilterType[];
export declare const FIR_WINDOWS: readonly FirWindow[];
export interface IirDesign { kind: 'iir'; family: 'butterworth' | 'chebyshev1'; type: FilterType; order: number; sampleRate: number; cutoff: number[]; rippleDb: number; b: number[]; a: number[]; zeros: Complex[]; poles: Complex[]; gain: number; stable: boolean }
export interface FirDesign { kind: 'fir'; type: FilterType; taps: number; sampleRate: number; cutoff: number[]; window: FirWindow; b: number[]; a: number[]; linearPhase: true; delay: number }
export declare function designIir(options?: { family?: 'butterworth' | 'chebyshev1'; type?: FilterType; order?: number; cutoff?: number | number[]; sampleRate?: number; rippleDb?: number }): IirDesign;
export declare function firWindow(name: FirWindow, n: number, beta?: number): number[];
export declare function designFir(options?: { type?: FilterType; taps?: number; cutoff?: number | number[]; sampleRate?: number; window?: FirWindow; beta?: number }): FirDesign;
export declare function frequencyResponseDigital(b: readonly number[], a: readonly number[], sampleRate: number, points?: number): { frequency: number[]; magnitude: number[]; decibels: number[]; phase: number[]; groupDelay: number[] };
export declare function lfilter(b: readonly number[], a: readonly number[], input: ArrayLike<number>): number[];
export declare function impulseResponse(b: readonly number[], a: readonly number[], length?: number): number[];
export declare function poleZero(filter: { b: readonly number[]; a: readonly number[]; zeros?: Complex[]; poles?: Complex[] }): { zeros: Complex[]; poles: Complex[] };
export interface ConvolutionTerm { k: number; x: number; h: number; product: number }
export declare function convolutionSteps(x: readonly number[], h: readonly number[]): { n: number; terms: ConvolutionTerm[]; value: number }[];
