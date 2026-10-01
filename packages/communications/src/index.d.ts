export interface SymbolPoint { i: number; q: number; }
export interface Constellation { kind: 'constellation'; modulation: 'QPSK'; bitsPerSymbol: 2; symbols: readonly SymbolPoint[]; sampleRate: number | null; units: 'normalized'; channel?: 'AWGN'; noiseSigma?: number; seed?: number; }
export interface BerResult { kind: 'ber'; errors: number; bits: number; rate: number; }
export declare function qpskModulate(bits: ArrayLike<0 | 1>): Constellation;
export declare function qpskDemodulate(constellation: Constellation): readonly (0 | 1)[];
export declare function addAwgn(constellation: Constellation, options?: { sigma?: number; seed?: number }): Constellation;
export declare function bitErrorRate(expected: ArrayLike<0 | 1>, actual: ArrayLike<0 | 1>): BerResult;

export const ANALOG_SCHEMES: readonly ('am' | 'dsb-sc' | 'fm' | 'pm')[];
export interface AnalogModulationResult { kind: 'analog-modulation'; scheme: string; carrierFrequency: number; messageFrequency: number; sampleRate: number; time: number[]; message: number[]; modulated: number[]; demodulated: number[]; spectrum: { frequency: number[]; amplitude: number[] }; metrics: Record<string, unknown>; warnings: string[] }
export function simulateAnalogModulation(options?: { scheme?: string; carrierFrequency?: number; messageFrequency?: number; index?: number; deviation?: number; carrierAmplitude?: number }): AnalogModulationResult;
export const DIGITAL_SCHEMES: Readonly<Record<'bpsk' | 'qpsk' | '8psk' | '16qam', number>>;
export interface ConstellationPoint { i: number; q: number; label: number }
export function constellation(scheme: string): { order: number; bitsPerSymbol: number; points: ConstellationPoint[] };
export function theoreticalBer(scheme: string, ebN0dB: number): number;
export function simulateDigitalLink(options?: { scheme?: string; ebN0dB?: number; bits?: number; seed?: number }): { kind: 'digital-link'; scheme: string; ebN0dB: number; bits: number; symbols: number; sigma: number; reference: (ConstellationPoint & { bits: string })[]; received: { i: number; q: number; error: boolean }[]; bitErrors: number; symbolErrors: number; ber: number; ser: number; theory: number };
export function berCurve(options?: { scheme?: string; from?: number; to?: number; step?: number; bitsPerPoint?: number; seed?: number }): { kind: 'ber-curve'; scheme: string; points: { ebN0dB: number; simulated: number | null; errors: number; bits: number; theory: number }[] };
export function raisedCosine(t: number, alpha: number): number;
export function eyeDiagram(options?: { alpha?: number; pulse?: 'raised-cosine' | 'rectangular'; ebN0dB?: number; symbols?: number; samplesPerSymbol?: number; seed?: number }): { kind: 'eye-diagram'; pulse: string; alpha: number; samplesPerSymbol: number; traces: number[][]; opening: number; sigma: number };
export const LINE_CODES: Readonly<Record<string, string>>;
export function quantize(value: number, bits: number): number;
export function measureSqnr(bits: number, options?: { law?: 'uniform' | 'mu-law'; amplitude?: number; samples?: number }): number;
export function samplingDemo(options?: { signalFrequency?: number; sampleRate?: number; bits?: number; law?: 'uniform' | 'mu-law'; amplitude?: number; periods?: number }): { kind: 'sampling'; signalFrequency: number; sampleRate: number; bits: number; law: string; amplitude: number; analog: { t: number; value: number }[]; samples: { t: number; value: number; quantized: number; code: number }[]; nyquistRate: number; aliased: boolean; apparentFrequency: number; bitRate: number; sqnr: number; sqnrTheory: number };
export function lineCode(bits: string, code: string): { kind: 'line-code'; code: string; name: string; bits: string; segments: { start: number; end: number; level: number }[]; dcLevel: number; transitions: number };
export const CRC_POLYNOMIALS: Readonly<Record<string, string>>;
export function hammingEncode(data: string): { codeword: string; n: number; k: number; parityPositions: number[] };
export function hammingDecode(codeword: string): { syndrome: number; errorPosition: number | null; corrected: string; data: string; detectedUncorrectable: boolean };
export function crcDivide(message: string, polynomial: string): { remainder: string; frame: string; degree: number; steps: { shift: number; value: string }[] };
export function crcCheck(frame: string, polynomial: string): { remainder: string; valid: boolean };
export function convolutionalEncode(data: string): { encoded: string; rate: string; constraintLength: number; generators: string[] };
export function viterbiDecode(received: string): { decoded: string; pathMetric: number; correctedErrors: number };
export function erfc(x: number): number;
export function qFunction(x: number): number;
export function createRandom(seed?: number): { uniform(): number; gaussian(): number; bit(): 0 | 1 };
export function fftInPlace(re: Float64Array | number[], im: Float64Array | number[]): void;
export function amplitudeSpectrum(samples: number[], sampleRate: number): { frequency: number[]; amplitude: number[] };
export function analyticSignal(samples: number[]): { re: number[]; im: number[] };
export function besselJ(order: number, x: number): number;
