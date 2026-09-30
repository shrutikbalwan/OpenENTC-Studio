import type { DigitalSignal, DigitalTrace } from '../../packages/hdl/src/index.d.ts';
export interface DigitalWaveformView { startTime: number; endTime: number; cursorA: number; cursorB: number; group: string; query: string; }
export declare function digitalSignalGroups(trace: DigitalTrace): readonly string[];
export declare function filterDigitalSignals(trace: DigitalTrace, requested?: Partial<DigitalWaveformView>): readonly DigitalSignal[];
export declare function normalizeDigitalWaveformView(trace: DigitalTrace, requested?: Partial<DigitalWaveformView>): Readonly<DigitalWaveformView>;
export declare function transformDigitalWaveformView(trace: DigitalTrace, requested: Partial<DigitalWaveformView>, command: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right'): Readonly<DigitalWaveformView>;
export declare function sampleDigitalSignal(signal: DigitalSignal, time: number): string;
export declare function measureDigitalCursors(trace: DigitalTrace, requested?: Partial<DigitalWaveformView>): Readonly<{ cursorA: number; cursorB: number; deltaTime: number; values: readonly Readonly<{ id: string; fullName: string; a: string; b: string }>[] }>;
export declare function serializeDigitalCsv(trace: DigitalTrace, requested?: Partial<DigitalWaveformView>): string;
