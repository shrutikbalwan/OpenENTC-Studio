export interface LabPart { id: string; type: string; label: string; value: number; unit: string; n1: string; n2: string; n3?: string; x: number; y: number; rotation: number }
export interface Sweep { frequencies: number[]; magnitudeDb: number[]; phase: number[] }
export declare function networkGain(netlist: string, frequency: number, out?: string): { magnitude: number; phase: number; re: number; im: number };
export declare function networkSweep(netlist: string, options: { start: number; stop: number; points?: number; out?: string }): Sweep;
export interface BiasDesign {
  ideal: { re: number; rc: number; r1: number; r2: number }; chosen: { re: number; rc: number; r1: number; r2: number };
  q: { ib: number; ic: number; ie: number; vce: number; vb: number; ve: number; vc: number; saturated: boolean }; vth: number; rth: number;
  smallSignal: { re: number; rpi: number; gm: number; rin: number; gain: number; gainDb: number }; stability: number;
  capacitors: { cin: number; cout: number; ce: number | null }; loadLine: { icSat: number; vceCut: number };
  components: LabPart[]; analysis: Record<string, unknown>; trace: string;
}
export declare function designBias(options?: { vcc?: number; ic?: number; beta?: number; vbe?: number; reFraction?: number; vceFraction?: number; stiffness?: number; rl?: number; fLow?: number; series?: string; bypass?: boolean }): BiasDesign;
export declare const OSCILLATORS: Readonly<Record<string, string>>;
export interface OscillatorDesign { type: string; values: Record<string, number>; actual: number; parallel?: number; q?: number; requiredGain: number; condition: string; feedback: { magnitude: number; phase: number; expected: number } | null; netlist?: string; formula: string }
export declare function designOscillator(options?: { type?: string; frequency?: number; c?: number; l?: number; ratio?: number; series?: string; crystal?: { ls: number; cs: number; cp: number; rs: number } }): OscillatorDesign;
export declare function butterworthQs(order: number): number[];
export interface FilterStage { q: number; R1: number; R2?: number; C1: number; C2?: number; f0: number; actualQ?: number; firstOrder?: boolean }
export declare function designSallenKey(options?: { kind?: 'lowpass' | 'highpass'; order?: number; fc?: number; c?: number; series?: string }): { kind: string; order: number; fc: number; stages: FilterStage[]; netlist: string; atCutoffDb: number; sweep: Sweep };
export declare function designBandpass(options?: { f0?: number; q?: number; gain?: number; c?: number; series?: string }): { values: Record<string, number>; f0: number; q: number; gain: number; bandwidth: number; netlist: string; centre: { magnitude: number; phase: number }; sweep: Sweep };
export declare function designZener(options?: { vinMin?: number; vinMax?: number; vz?: number; izMin?: number; ilMax?: number; ilMin?: number; rz?: number; series?: string }): { rs: number; ideal: number; izMax: number; izAtMin: number; pz: number; pr: number; ratings: { zenerW: number; resistorW: number }; lineRegulation: number; ok: boolean };
export declare function designLm317(options?: { vout?: number; vin?: number; iload?: number; r1?: number; series?: string }): { r1: number; r2: number; ideal: number; vout: number; dissipation: number; headroom: number; dropoutOk: boolean; minLoad: number };
export declare function designSchmitt(options?: { vut?: number; vlt?: number; vsat?: number; kind?: 'inverting' | 'noninverting'; r2?: number; series?: string }): { kind: string; r1: number; r2: number; vref: number; beta: number; vut: number; vlt: number; hysteresis: number };
export declare function designPll(options?: { rt?: number; ct?: number; c2?: number; vcc?: number }): { f0: number; lockRange: number; captureRange: number; lockBand: number[]; captureBand: number[] };
