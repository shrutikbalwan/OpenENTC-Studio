export type Complex = [number, number];
export declare const C: {
  of(re: number, im?: number): Complex; polar(magnitude: number, degrees: number): Complex; add(a: Complex, b: Complex): Complex; sub(a: Complex, b: Complex): Complex;
  mul(a: Complex, b: Complex): Complex; div(a: Complex, b: Complex): Complex; neg(a: Complex): Complex; conj(a: Complex): Complex; abs(a: Complex): number; arg(a: Complex): number; scale(a: Complex, k: number): Complex;
};
export declare function solveComplex(matrix: Complex[][], vector: Complex[]): Complex[];
export declare function parseValue(text: string): number;
export interface Element { name: string; type: 'R' | 'L' | 'C' | 'V' | 'I' | 'E' | 'G' | 'F' | 'H'; a: string; b: string; c?: string; d?: string; control?: string; value: number | Complex }
export declare function parseNetlist(text: string): Element[];
export declare function solveNetwork(elements: Element[], options?: { frequency?: number }): { nodes: string[]; voltages: Record<string, Complex>; currents: Record<string, Complex>; power: Record<string, Complex>; frequency: number };
export declare function thevenin(elements: Element[], a: string, b: string, options?: { frequency?: number }): { vth: Complex; zth: Complex; norton: Complex | null; shortCircuit: Complex | null; maxPower: number | null; matchedLoad: Complex };
export declare function superposition(elements: Element[], options?: { a?: string; b?: string; element?: string | null; frequency?: number }): { parts: { source: string; value: Complex }[]; sum: Complex; total: Complex };
export declare function powerTransferCurve(vth: Complex | number, rth: number, options?: { points?: number; maxRatio?: number }): { rl: number; power: number; efficiency: number }[];
export declare function starToDelta(star: { ra: number; rb: number; rc: number }): { rab: number; rbc: number; rca: number };
export declare function deltaToStar(delta: { rab: number; rbc: number; rca: number }): { ra: number; rb: number; rc: number };
export type Matrix = [[Complex, Complex], [Complex, Complex]];
export interface ParameterSets { z: Matrix; y: Matrix; h: Matrix; g: Matrix; abcd: Matrix }
export declare function measureTwoPort(elements: Element[], options: { p1: string; p1ref?: string; p2: string; p2ref?: string; frequency?: number }): { y: Matrix };
export declare function convertTwoPort(from: 'z' | 'y' | 'h' | 'g' | 'abcd', matrix: Matrix): ParameterSets;
export declare function twoPortAnalysis(elements: Element[], options: { p1: string; p1ref?: string; p2: string; p2ref?: string; frequency?: number }): ParameterSets & { reciprocal: boolean; symmetric: boolean };
export declare function loadedTwoPort(abcd: Matrix, zl: Complex): { zin: Complex; gain: Complex };
export declare function connectTwoPorts(kind: 'series' | 'parallel' | 'cascade', first: ParameterSets, second: ParameterSets): ParameterSets;
export declare const NETWORK_EXAMPLES: readonly { id: string; name: string; frequency: number; netlist: string; a?: string; b?: string; p1?: string; p2?: string }[];
