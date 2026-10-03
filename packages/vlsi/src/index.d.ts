export interface Process { vdd: number; vtn: number; vtp: number; kpn: number; kpp: number; lambdaN: number; lambdaP: number; wn: number; ln: number; wp: number; lp: number }
export declare const DEFAULT_PROCESS: Readonly<Process>;
export declare function level1Current(vgs: number, vds: number, device: { vt: number; kp: number; w: number; l: number; lambda?: number }): number;
export declare function inverterCurrents(vin: number, vout: number, p?: Process): { n: number; p: number };
export declare function solveOutput(vin: number, p?: Process): number;
export interface InverterTheory { vm: number; kr: number; vil: number; vih: number; voutAtVil: number; voutAtVih: number; nml: number; nmh: number }
export declare function inverterTheory(p?: Process): InverterTheory;
export declare function inverterVtc(p?: Process, points?: number): { vin: number[]; vout: number[]; current: number[]; vm: number; vil: number; vih: number; voh: number; vol: number; nml: number; nmh: number; gainAtVm: number; peakCurrent: number; vOutAtVil: number; vOutAtVih: number; ratio: number; theory: InverterTheory };
export declare function delayTheory(p?: Process, cl?: number): { tphl: number; tplh: number; tp: number };
export declare function inverterTransient(p?: Process, options?: { cl?: number; riseTime?: number; period?: number | null; steps?: number }): { time: number[]; input: number[]; output: number[]; supply: number[]; tphl: number | null; tplh: number | null; tp: number | null; fallTime: number; riseTime: number; energyPerCycle: number; switchingEnergy: number; theory: { tphl: number; tplh: number; tp: number } };
export declare function dynamicPower(options?: { cl?: number; vdd?: number; frequency?: number; activity?: number; leakage?: number }): { dynamic: number; static: number; total: number; energyPerTransition: number };
export declare function symmetricPmosWidth(p?: Process): number;
