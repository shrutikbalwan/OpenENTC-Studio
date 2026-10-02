export type ThermocoupleType = 'K' | 'J' | 'T' | 'E' | 'N';
export declare const THERMOCOUPLE_COEFFICIENTS: Readonly<Record<ThermocoupleType, readonly [number, number, number[], number[]?][]>>;
export declare const THERMOCOUPLE_TYPES: Readonly<Record<ThermocoupleType, string>>;
export declare function thermocoupleEmf(type: ThermocoupleType, celsius: number): number;
export declare function seebeck(type: ThermocoupleType, celsius: number): number;
export declare function thermocoupleTemperature(type: ThermocoupleType, millivolts: number): number;
export declare function coldJunction(options: { type?: ThermocoupleType; measuredMv: number; coldC?: number }): { hotC: number; uncompensatedC: number; linearC: number; coldEmf: number };
export declare const IEC_60751: Readonly<{ a: number; b: number; c: number }>;
export interface RtdOptions { r0?: number; a?: number; b?: number; c?: number }
export declare function rtdResistance(celsius: number, options?: RtdOptions): number;
export declare function rtdTemperature(ohms: number, options?: RtdOptions): number;
export declare function ntcResistance(celsius: number, options?: { r25?: number; beta?: number }): number;
export declare function ntcTemperatureBeta(ohms: number, options?: { r25?: number; beta?: number }): number;
export declare function steinhartHart(points: [number, number][]): { a: number; b: number; c: number };
export declare function steinhartTemperature(ohms: number, coefficients: { a: number; b: number; c: number }): number;
export declare function lm35Voltage(celsius: number): number;
export declare function wheatstone(options: { vex?: number; r1: number; r2: number; r3: number; r4: number }): { va: number; vb: number; vout: number; balanced: boolean };
export declare function strainBridge(options?: { vex?: number; gaugeFactor?: number; strain?: number; config?: 'quarter' | 'half' | 'full'; r?: number }): { vout: number; linear: number; nonlinearityPercent: number; sensitivity: number; deltaR: number; arms: { r1: number; r2: number; r3: number; r4: number } };
export declare function lvdt(options?: { displacementMm?: number; sensitivity?: number; vex?: number; rangeMm?: number; residualMv?: number }): { amplitudeMv: number; phaseDeg: number; signedMv: number; inRange: boolean };
export declare const INAMPS: Readonly<Record<string, { label: string; constant: number }>>;
export declare function nearestE96(value: number): number;
export declare function designInamp(options: { sensorMin: number; sensorMax: number; adcMin?: number; adcMax?: number; inamp?: string; marginPercent?: number }): { targetGain: number; rgIdeal: number; rg: number; gain: number; reference: number; outMin: number; outMax: number };
export declare function measurementChain(options?: { sensor?: 'pt100' | 'pt1000' | 'k-type' | 'ntc' | 'lm35'; tMin?: number; tMax?: number; excitation?: number; adcBits?: number; vref?: number; inamp?: string; linearize?: 'exact' | 'linear'; points?: number; coldC?: number; beta?: number; r25?: number; divider?: number }): {
  amp: ReturnType<typeof designInamp>; rows: { t: number; sensorV: number; ampV: number; code: number; reading: number; error: number; linearError: number; exactError: number }[]; resolution: number; maxError: number; maxLinearError: number; sensorSpan: [number, number];
};
