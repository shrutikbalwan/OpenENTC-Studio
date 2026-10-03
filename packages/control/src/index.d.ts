export interface TransferFunction { kind: 'transfer-function'; numerator: readonly number[]; denominator: readonly number[]; inputUnits: string; outputUnits: string; }
export interface BodePoint { frequency: number; real: number; imaginary: number; magnitude: number; phase: number; }
export declare function createTransferFunction(numerator: ArrayLike<number>, denominator: ArrayLike<number>, options?: { inputUnits?: string; outputUnits?: string }): TransferFunction;
export declare function frequencyResponse(tf: TransferFunction, frequencies: ArrayLike<number>): { kind: 'bode'; points: readonly BodePoint[]; inputUnits: string; outputUnits: string };
export declare function firstOrderStep(options: { gain?: number; tau: number; sampleRate: number; length: number }): { kind: 'time-series'; data: Float64Array; sampleRate: number; units: string };
export declare function firstOrderStability(tau: number): { stable: boolean; reason: string };

export interface Complex { re: number; im: number }
export interface Tf { kind: 'transfer-function'; numerator: number[]; denominator: number[]; proper: boolean; zeros: Complex[]; poles: Complex[] }
export interface TimeResponse { input: 'step' | 'impulse'; time: number[]; output: number[]; duration?: number; diverged?: boolean; directFeedthrough?: boolean }
export interface StepInfo { finalValue: number; riseTime: number | null; peak: number | null; peakTime: number | null; overshoot: number | null; settlingTime: number | null; steadyStateError: number }
export interface Margins { gainMarginDb: number; phaseCrossover: number | null; phaseMarginDeg: number; gainCrossover: number | null }
export interface Stability { status: 'stable' | 'marginal' | 'unstable'; rightHalfPlanePoles: number }
export interface Bode { omega: number[]; magnitudeDb: number[]; phase: number[]; margins: Margins }
export interface RouthResult { coefficients: number[]; rows: { power: number; values: number[] }[]; signChanges: number; notes: string[]; stable: boolean; verdict: string }
export interface PidGains { kp?: number; ki?: number; kd?: number; tf?: number }
export declare function parsePolynomial(input: string | readonly number[]): number[];
export declare function formatPolynomial(coefficients: readonly number[], variable?: string): string;
export declare function makeTransferFunction(numerator: string | readonly number[], denominator: string | readonly number[]): Tf;
export declare function evaluateTf(tf: Tf, s: Complex): Complex;
export declare function closedLoop(open: Tf, feedback?: { numerator: number[]; denominator: number[] }): Tf;
export declare function seriesTf(first: Tf, second: Tf): Tf;
export declare function dcGain(tf: Tf): number;
export declare function classifyStability(poles: readonly Complex[]): Stability;
export declare function expm(matrix: number[][]): number[][];
export declare function defaultDuration(tf: Tf): number;
export declare function timeResponse(tf: Tf, options?: { input?: 'step' | 'impulse'; duration?: number | string; points?: number }): TimeResponse;
export declare function stepInfo(response: TimeResponse, finalValue?: number): StepInfo;
export declare function frequencyRange(tf: Tf): [number, number];
export declare function bode(tf: Tf, options?: { from?: number; to?: number; points?: number }): Bode;
export declare function margins(tf: Tf, omega: number[], magnitudeDb: number[], phase: number[]): Margins;
export declare function nyquist(tf: Tf, options?: { points?: number }): { omega: number[]; real: number[]; imaginary: number[] };
export declare function rootLocus(tf: Tf, options?: { maxGain?: number | string; points?: number }): { branches: { gain: number; re: number; im: number }[][]; poles: Complex[]; zeros: Complex[]; centroid: number | null; asymptoteAngles: number[]; crossings: { omega: number; gain: number }[] };
export declare function routhArray(input: string | readonly number[]): RouthResult;
export declare function pidController(gains?: PidGains): Tf;
export declare function zieglerNichols(plant: Tf): { ultimateGain: number | null; ultimatePeriod: number | null; rules: { name: string; kp: number; ki: number; kd: number; ti: number; td: number }[]; note?: string };
export declare function pidLoop(plant: Tf | { numerator: number[]; denominator: number[] }, gains: PidGains, options?: { duration?: number; points?: number }): { open: Tf; closed: Tf; stability: Stability; response: TimeResponse; info: StepInfo; margins: Margins };
export declare function analyzeSystem(numerator: string | readonly number[], denominator: string | readonly number[], options?: { feedback?: boolean; duration?: number | string }): { open: Tf; system: Tf; feedback: boolean; stability: Stability; dcGain: number; step: TimeResponse | null; impulse: TimeResponse | null; info: StepInfo | null; bode: Bode; nyquist: { omega: number[]; real: number[]; imaginary: number[] }; routh: RouthResult };
