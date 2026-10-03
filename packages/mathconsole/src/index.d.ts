export declare class Matrix { constructor(rows: number, cols: number, data?: Float64Array); rows: number; cols: number; data: Float64Array; get(r: number, c: number): number }
export type Value = number | { re: number; im: number } | Matrix | { type: 'string'; value: string } | { type: 'list'; items: (number | { re: number; im: number })[] };
export interface Token { type: string; value: any; start: number; end: number }
export declare function tokenize(source: string): Token[];
export declare function parse(source: string): any[];
export declare function matMul(A: Matrix, B: Matrix): Matrix;
export declare function transpose(A: Matrix): Matrix;
export declare function solve(A: Matrix, B: Matrix): Matrix;
export declare function determinant(A: Matrix): number;
export declare const FUNCTIONS: Record<string, (...args: any[]) => any>;
export declare const CONSTANTS: Readonly<Record<string, number>>;
export interface Session { variables: Map<string, Value>; functions: Map<string, any> }
export declare function createSession(): Session;
export interface Output { name?: string; value?: Value; text?: string; error?: string; plot?: { x: number[]; y: number[] }[] }
export declare function run(source: string, session?: Session): { session: Session; outputs: Output[] };
export declare function format(value: Value): string;
export declare function describe(value: Value): string;
