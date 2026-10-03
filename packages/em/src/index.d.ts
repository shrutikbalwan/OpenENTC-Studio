export interface Complex { re: number; im: number }
export type Matrix2 = [[Complex, Complex], [Complex, Complex]] | Complex[][];
export interface Charge { q: number; x: number; y: number; z?: number }
export declare const C0: number;
export declare const MU0: number;
export declare const EPS0: number;
export declare const ETA0: number;
export declare const ZERO: Complex;
export declare const J: Complex;
export declare function chargeField(charges: Charge[], x: number, y: number, z?: number): { ex: number; ey: number; ez: number; v: number; magnitude: number };
export declare function gaussFlux(charges: Charge[], options?: { x?: number; y?: number; z?: number; radius?: number; points?: number }): { flux: number; enclosed: number; expected: number };
export declare function fieldMap(charges: Charge[], options: { xMin: number; xMax: number; yMin: number; yMax: number; columns?: number; rows?: number; linesPerCharge?: number }): { potential: number[][]; lines: [number, number][][] };
export interface PlaneWave { alpha: number; beta: number; alphaDbPerMetre: number; eta: Complex; etaMagnitude: number; etaAngle: number; wavelength: number; phaseVelocity: number; skinDepth: number; lossTangent: number; regime: string; surfaceResistance: number | null }
export declare function planeWave(options: { frequency: number; epsR?: number; muR?: number; sigma?: number }): PlaneWave;
export declare function skinDepth(frequency: number, sigma: number, muR?: number): number;
export declare function normalIncidence(eta1: number | Complex, eta2: number | Complex): { gamma: Complex; tau: Complex; reflectance: number; transmittance: number; swr: number };
export interface Fresnel { rs: Complex; rp: Complex; ts: Complex; tp: Complex; Rs: number; Rp: number; Ts: number; Tp: number; transmittedAngle: number | null; tir: boolean; phaseS: number; phaseP: number; brewster: number; critical: number | null }
export declare function fresnel(options: { n1: number; n2: number; angle: number }): Fresnel;
export declare function fresnelCurve(n1: number, n2: number, points?: number): { angles: number[]; Rs: number[]; Rp: number[] };
export declare function polarization(options: { ex: number; ey: number; phase: number }): { stokes: number[]; tilt: number; axialRatio: number; axialRatioDb: number; kind: 'linear' | 'circular' | 'elliptical'; sense: 'right-hand' | 'left-hand' | null; trace: [number, number][] };
export declare const BESSEL_ZEROS: Readonly<{ TM: number[][]; TE: number[][] }>;
export interface Mode { kind: 'TE' | 'TM'; m: number; n: number; name: string; root?: number; cutoff: number; propagating: boolean; beta: number; attenuation: number; attenuationDbPerMetre: number; guideWavelength: number; phaseVelocity: number; groupVelocity: number; impedance: number | null }
export declare function rectangularWaveguide(options: { a: number; b: number; epsR?: number; frequency: number; maxIndex?: number; sigma?: number | null }): { modes: Mode[]; dominant: Mode; singleModeBand: [number, number]; conductorLoss: { alpha: number; dbPerMetre: number; surfaceResistance: number } | null };
export declare function rectangularModePattern(mode: { kind: 'TE' | 'TM'; m: number; n: number }, a: number, b: number, columns?: number, rows?: number): { x: number; y: number; ex: number; ey: number; magnitude: number }[];
export declare function circularWaveguide(options: { radius: number; epsR?: number; frequency: number }): { modes: Mode[]; dominant: Mode; singleModeBand: [number, number] };
export declare function matMul(p: Matrix2, q: Matrix2): Complex[][];
export declare function sToAbcd(s: Matrix2, z0?: number): Complex[][];
export declare function abcdToS(m: Matrix2, z0?: number): Complex[][];
export declare function sToZ(s: Matrix2, z0?: number): Complex[][];
export declare function zToS(z: Matrix2, z0?: number): Complex[][];
export interface TwoPortElement { type: string; value?: number; z0?: number; length?: number; vf?: number; lossDbPerMetre?: number }
export declare const TWO_PORT_ELEMENTS: Readonly<Record<string, { label: string; unit: string }>>;
export declare function elementAbcd(element: TwoPortElement, frequency: number, z0?: number): Complex[][];
export interface Figures { s11Db: number; s21Db: number; s12Db: number; s22Db: number; returnLoss: number; insertionLoss: number; vswr: number; reciprocal: boolean; lossless: boolean }
export declare function sParameterFigures(s: Matrix2): Figures;
export declare function cascade(elements: TwoPortElement[], frequency: number, z0?: number): Figures & { abcd: Complex[][]; s: Complex[][] };
export declare function sweepCascade(elements: TwoPortElement[], options: { start: number; stop: number; points?: number; z0?: number }): { frequencies: number[]; s: Complex[][][]; s11Db: number[]; s21Db: number[]; s22Db: number[] };
export interface StabilityCircle { center: Complex; radius: number; stableInside: boolean }
export declare function amplifierStability(s: Matrix2): { k: number; delta: Complex; deltaMagnitude: number; mu: number; unconditional: boolean; maxGain: number | null; maxGainDb: number | null; maxStableGain: number; maxStableGainDb: number; unilateralGainDb: number; input: StabilityCircle; output: StabilityCircle; match: { gammaS: Complex; gammaL: Complex } | null };
export declare function inputReflection(s: Matrix2, gammaL: Complex): Complex;
export declare function fromPolar(magnitude: number, degrees: number): Complex;
