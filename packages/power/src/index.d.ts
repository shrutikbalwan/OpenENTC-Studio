export interface Stats { mean: number; rms: number; max: number; min: number; pp: number }
export interface Harmonic { order: number; amplitude: number; rms: number; phase: number }
export declare function periodStats(values: ArrayLike<number>): Stats;
export declare function harmonics(values: ArrayLike<number>, count?: number): { dc: number; list: Harmonic[]; thd: number | null };

export type RectifierType = 'half-wave' | 'half-wave-fwd' | 'full-bridge' | 'semi-bridge' | 'three-pulse' | 'six-pulse';
export declare const RECTIFIERS: Readonly<Record<RectifierType, { phases: 1 | 3; label: string }>>;
export interface RectifierOptions { type?: RectifierType; controlled?: boolean; alpha?: number; vm?: number; frequency?: number; r?: number; l?: number; e?: number; c?: number; stepsPerCycle?: number; maxCycles?: number }
export interface Theory { vdc?: number; vrms?: number; ripple?: number; fundamentalPeak?: number; thd?: number; note?: string }
export interface RectifierResult {
  type: RectifierType; controlled: boolean; alpha: number; frequency: number; vm: number;
  waveform: { theta: number[]; vs: number[]; vo: number[]; io: number[]; is: number[]; vt: number[]; phases: number[][] };
  vdc: number; vrms: number; idc: number; irms: number; ripple: number; formFactor: number | null; rippleFactor: number | null;
  loadPower: number; sourceCurrentRms: number; inputPowerFactor: number | null; displacementFactor: number | null; currentThd: number | null;
  sourceHarmonics: Harmonic[]; continuous: boolean | null; theory: Theory;
}
export declare function simulateRectifier(options?: RectifierOptions): RectifierResult;
export declare function rectifierTheory(options: RectifierOptions & { vm: number; r: number }): Theory;

export type ConverterType = 'buck' | 'boost' | 'buck-boost';
export declare const CONVERTERS: Readonly<Record<ConverterType, string>>;
export interface ConverterOptions { type?: ConverterType; vin?: number; duty?: number; frequency?: number; l?: number; c?: number; r?: number; stepsPerPeriod?: number; maxPeriods?: number }
export interface ConverterTheory { type: ConverterType; criticalL: number; ccm: boolean; ratio: number; vo: number; rippleI: number | null; rippleV: number | null; il: number | null }
export declare function converterTheory(options: Required<Pick<ConverterOptions, 'type' | 'vin' | 'duty' | 'frequency' | 'l' | 'c' | 'r'>>): ConverterTheory;
export declare function simulateConverter(options?: ConverterOptions): {
  type: ConverterType; periods: number; waveform: { t: number[]; gate: number[]; il: number[]; vo: number[]; isw: number[]; idiode: number[]; vsw: number[] };
  vo: number; rippleV: number; ilAverage: number; ilMax: number; ilMin: number; rippleI: number; mode: 'CCM' | 'DCM'; ratio: number; outputPower: number; theory: ConverterTheory;
};

export type InverterMode = 'square' | 'quasi-square' | 'spwm-bipolar' | 'spwm-unipolar' | 'three-phase-six-step' | 'three-phase-spwm';
export declare const INVERTERS: Readonly<Record<InverterMode, string>>;
export interface InverterOptions { mode?: InverterMode; vdc?: number; frequency?: number; ma?: number; mf?: number; width?: number; r?: number; l?: number; samples?: number; harmonicsCount?: number }
export declare function simulateInverter(options?: InverterOptions): {
  mode: InverterMode; waveform: { t: number[]; vo: number[]; vphase: number[] | null; io: number[] };
  fundamentalPeak: number; fundamentalRms: number; vrms: number; voltageThd: number | null; currentThd: number | null;
  spectrum: Harmonic[]; phaseSpectrum: Harmonic[] | null; loadPower: number; theory: Theory;
};
export declare function inverterTheory(options: { mode: InverterMode; vdc: number; ma?: number; width?: number }): Theory;
export declare function simulateAcController(options?: { vm?: number; frequency?: number; alpha?: number; r?: number; l?: number; stepsPerCycle?: number }): {
  waveform: { theta: number[]; vs: number[]; vo: number[]; io: number[] }; vrms: number; irms: number; power: number; powerFactor: number; currentThd: number | null; harmonics: Harmonic[]; theory: Theory;
};
