export interface ComplexValue { real: number; imaginary: number; }
export interface SParameterPoint { frequency: number; values: readonly ComplexValue[]; }
export interface SParameterResult { kind: 's-parameters'; ports: number; frequencyUnit: string; format: 'RI' | 'MA' | 'DB'; referenceImpedance: number; points: readonly SParameterPoint[]; }
export declare function parseTouchstone(text: string, options?: { ports?: number }): SParameterResult;
export interface MatrixParameterPoint { frequency: number; values: readonly ComplexValue[]; }
export interface MatrixParameterResult { kind: 'z-parameters' | 'y-parameters' | 'abcd-parameters'; ports: 2; referenceImpedance: number; points: readonly MatrixParameterPoint[]; }
export declare function convertSParameters(result: SParameterResult, mode: 'Z' | 'Y' | 'ABCD'): MatrixParameterResult;
export declare function cascadeAbcd(first: MatrixParameterResult, second: MatrixParameterResult): MatrixParameterResult;
export declare function reflectionCoefficient(impedance: ComplexValue, referenceImpedance?: number): ComplexValue;

export interface Complex { re: number; im: number }
export declare const SPEED_OF_LIGHT: number;
export declare const FREE_SPACE_IMPEDANCE: number;
export interface Reflection { gamma: Complex; magnitude: number; angle: number; normalized: Complex; vswr: number; returnLossDb: number; mismatchLossDb: number; powerDelivered: number }
export declare function reflection(load: Complex | number, z0?: number): Reflection;
export declare function impedanceFromGamma(gamma: Complex, z0?: number): Complex;
export interface MatchElement { kind: 'inductor' | 'capacitor' | 'none'; value: number; unit: string }
export interface LMatchSolution { topology: 'shunt-at-load' | 'series-at-load'; series: MatchElement & { reactance: number }; shunt: MatchElement & { susceptance: number }; inputImpedance: Complex }
export declare function lMatch(load: Complex | number, z0?: number, frequency?: number): { load: Complex; z0: number; frequency: number; solutions: LMatchSolution[] };
export declare function lineInputImpedance(load: Complex | number, z0: number, lengthWavelengths: number, attenuationNepersPerWavelength?: number): Complex;
export declare function transmissionLine(options?: { load?: Complex; z0?: number; length?: number; lossDbPerWavelength?: number; points?: number }): { load: Complex; z0: number; length: number; reflection: Reflection; inputImpedance: Complex; trace: { d: number; gamma: Complex; voltage: number }[]; firstMaximum: number | null; firstMinimum: number | null };
export declare function quarterWaveMatch(load: Complex | number, z0?: number): { offset: number | null; realImpedance: number; transformerImpedance: number; alternatives?: { offset: number | null; realImpedance: number; transformerImpedance: number }[] };
export declare function singleStubMatch(load: Complex | number, z0?: number): { distance: number; susceptance: number; openStub: number; shortStub: number; inputAdmittance: Complex }[];
export declare function microstrip(options?: { width?: number; height?: number; permittivity?: number }): { ratio: number; effectivePermittivity: number; impedance: number; velocityFactor: number };
export declare function microstripWidth(options?: { impedance?: number; height?: number; permittivity?: number }): { width: number; ratio: number; effectivePermittivity: number; impedance: number; velocityFactor: number };
export declare function coaxImpedance(options?: { inner?: number; outer?: number; permittivity?: number }): { impedance: number; velocityFactor: number; cutoffFrequency: number };
export declare function twinLeadImpedance(options?: { spacing?: number; diameter?: number; permittivity?: number }): { impedance: number; velocityFactor: number };
export declare const ELEMENT_PATTERNS: Readonly<Record<string, string>>;
export declare function linearArray(options?: { elements?: number; spacing?: number; steer?: number; element?: string; points?: number }): { elements: number; spacing: number; steer: number; element: string; progressivePhase: number; theta: number[]; normalized: number[]; decibels: number[]; mainBeam: number; directivity: number; directivityDbi: number; beamwidth: number | null; sidelobeDb: number | null; gratingLobes: boolean; radiationResistance: number | null };
export declare function shortDipoleResistance(lengthWavelengths: number): number;
export declare function freeSpacePathLossDb(distance: number, frequency: number): number;
export interface LinkBudget { frequency: number; distance: number; wavelength: number; fspl: number; eirpDbm: number; receivedDbm: number; receivedWatts: number; noiseFloorDbm: number; snrDb: number; sensitivityDbm: number; marginDb: number; maxRange: number; fresnelRadius: number; shannonCapacity: number }
export declare function linkBudget(options?: { frequency?: number; distance?: number; txPowerDbm?: number; txGainDbi?: number; rxGainDbi?: number; txLossDb?: number; rxLossDb?: number; otherLossDb?: number; bandwidth?: number; noiseFigureDb?: number; requiredSnrDb?: number; temperature?: number }): LinkBudget;
