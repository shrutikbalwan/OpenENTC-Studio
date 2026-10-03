export interface Measurements { max: number; min: number; pp: number; mean: number; rms: number; acRms: number; period: number | null; frequency: number | null; duty: number | null; riseTime: number | null; fallTime: number | null; periods: number }
export declare function crossings(time: ArrayLike<number>, values: ArrayLike<number>, level: number, hysteresis?: number): { rising: number[]; falling: number[] };
export declare function measure(time: ArrayLike<number>, values: ArrayLike<number>): Measurements;
export declare function phaseDifference(time: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>): number | null;
export declare function findTrigger(time: ArrayLike<number>, values: ArrayLike<number>, options?: { level?: number; slope?: 'rising' | 'falling'; from?: number; hysteresis?: number }): number | null;
export declare function valueAt(time: ArrayLike<number>, values: ArrayLike<number>, t: number): number;
export declare function screenTrace(time: ArrayLike<number>, values: ArrayLike<number>, start: number, span: number, columns?: number): { t: number; v: number }[];
export declare function oneTwoFive(minimum: number, maximum: number): number[];
export declare function autoScale(span: number, divisions: number): number;
export declare function dmmDisplay(value: number | null, unit: string, options?: { counts?: number; ranges?: number[] | null }): { text: string; overload: boolean; range: number | null };

export interface NetlistPart { id: string; type: string; label?: string; value: number; n1?: string; n2?: string; n3?: string; [key: string]: unknown }
export type DcSolver = (components: NetlistPart[], wires?: unknown[], netLabels?: unknown[]) => { nodes: Record<string, number>; currents: Record<string, number> };
export declare function zeroSources<T extends NetlistPart>(components: T[]): T[];
export declare function measureResistance(simulateDC: DcSolver, components: NetlistPart[], wires: unknown[], netLabels: unknown[], a: string, b: string, options?: { testCurrent?: number; compliance?: number }): { ohms: number | null; volts: number };
export declare function diodeTest(simulateDC: DcSolver, components: NetlistPart[], wires: unknown[], netLabels: unknown[], a: string, b: string): number | null;

export type GeneratorShape = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'pulse' | 'dc';
export declare const GENERATOR_SHAPES: readonly GeneratorShape[];
export interface GeneratorSettings { sourceId: string; shape?: GeneratorShape; frequency?: number; vpp?: number; offset?: number; duty?: number; impedance?: 'high-z' | '50' }
export declare function applyGenerator(components: NetlistPart[], settings: GeneratorSettings): { components: NetlistPart[]; stimulus: { sourceId: string; shape: string; frequency?: number; amplitude: number; offset: number; duty?: number } };
export interface SupplyChannel { sourceId: string; voltage: number; currentLimit: number; enabled?: boolean }
export declare function applySupplies(simulateDC: DcSolver, components: NetlistPart[], wires: unknown[], netLabels: unknown[], channels?: SupplyChannel[]): { components: NetlistPart[]; status: { sourceId: string; mode: 'CV' | 'CC' | 'off'; volts: number; amps: number }[] };
