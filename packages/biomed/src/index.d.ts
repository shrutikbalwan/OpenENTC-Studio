export interface Beat { time: number; pvc: boolean; sample: number }
export declare function synthesizeEcg(options?: { duration?: number; sampleRate?: number; heartRate?: number; hrvStd?: number; respiration?: number; rsa?: number; pvcEvery?: number; baseline?: number; mains?: number; mainsFrequency?: number; emg?: number; seed?: number }): { sampleRate: number; signal: Float64Array; clean: Float64Array; beats: Beat[] };
export interface Section { b: number[]; a: number[] }
export declare function biquad(type: 'lowpass' | 'highpass' | 'notch' | 'bandpass', frequency: number, sampleRate: number, q?: number): Section;
export declare function lfilterSection(section: Section, x: ArrayLike<number>): Float64Array;
export declare function filtfilt(section: Section, x: ArrayLike<number>, pad?: number): Float64Array;
export declare function cleanEcg(x: ArrayLike<number>, sampleRate: number, options?: { highpass?: number; notch?: number; lowpass?: number }): Float64Array;
export declare function panTompkins(x: ArrayLike<number>, sampleRate: number): { bandpassed: Float64Array; derivative: Float64Array; squared: Float64Array; integrated: Float64Array; thresholds: { sample: number; threshold: number }[]; rPeaks: number[] };
export declare function scoreDetections(detected: number[], reference: number[], sampleRate: number, tolerance?: number): { truePositives: number; falseNegatives: number; falsePositives: number; sensitivity: number; ppv: number };
export declare function hrv(rPeaks: number[], sampleRate: number): { rr: number[]; meanRr: number; meanHr: number; sdnn: number; rmssd: number; pnn50: number; sd1: number; sd2: number; minHr: number; maxHr: number };
export interface Psd { frequency: number[]; power: number[]; df: number }
export declare function hrvSpectrum(rPeaks: number[], sampleRate: number, options?: { resample?: number }): Psd & { lf: number; hf: number; ratio: number };
export declare function welch(x: ArrayLike<number>, sampleRate: number, options?: { segment?: number }): Psd;
export declare const EEG_BANDS: readonly [string, number, number][];
export declare const EEG_STATES: Readonly<Record<string, { label: string; amplitudes: Record<string, number> }>>;
export declare function synthesizeEeg(options?: { state?: string; duration?: number; sampleRate?: number; noise?: number; blinks?: number; seed?: number }): { sampleRate: number; signal: Float64Array };
export declare function bandPowers(x: ArrayLike<number>, sampleRate: number, options?: { segment?: number | null }): { psd: Psd; bands: { name: string; lo: number; hi: number; power: number; relative: number }[]; total: number; dominant: string; peakFrequency: number; thetaBetaRatio: number };
