export interface CircuitTransientResult { kind: 'circuit-transient'; time: number[]; nodes: Record<string, number[]>; currents: Record<string, number[]>; stimulus: { sourceId: string; shape: string }; warnings: string[] }
export interface CircuitAcResult { kind: 'circuit-ac'; frequency: number[]; nodes: Record<string, { magnitude: number[]; phase: number[] }>; inputSourceId: string; warnings: string[] }
export type CircuitPlotResult = CircuitTransientResult | CircuitAcResult;
export interface CircuitTrace { key: string; label: string; unit?: 'V' | 'A'; values?: number[]; node?: string }
export interface StepMetrics { initial: number; final: number; peak: number; minimum: number; riseTime: number | null; overshootPercent: number | null }
export interface BodeMetrics { decibels: number[]; peakDb: number; peakFrequency: number; lowerCutoff: number | null; upperCutoff: number | null; phase: number[] }
export const MAX_PLOT_POINTS: number;
export function circuitTraces(result: CircuitPlotResult | null | undefined): CircuitTrace[];
export function decimate(xs: readonly number[], ys: readonly number[], limit?: number): { xs: number[]; ys: number[] };
export function niceRange(min: number, max: number, count?: number): { min: number; max: number; ticks: number[] };
export function decadeTicks(min: number, max: number): number[];
export function linePath(xs: readonly number[], ys: readonly number[], options: { width: number; height: number; xMin: number; xMax: number; yMin: number; yMax: number; logX?: boolean }): string;
export function stepMetrics(time: readonly number[], values: readonly number[]): StepMetrics;
export function waveformMetrics(values: readonly number[]): { peakToPeak: number; average: number; rms: number };
export function unwrapPhase(phase: readonly number[]): number[];
export function bodeMetrics(frequency: readonly number[], magnitude: readonly number[], phase: readonly number[]): BodeMetrics;
export function circuitResultCsv(result: CircuitPlotResult): string;
