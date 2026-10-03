export type Bit = 0 | 1;
export type LogicValue = '0' | '1' | 'x';
export interface ExpressionTree { op: 'var' | 'const' | 'not' | 'and' | 'or' | 'xor'; name?: string; value?: Bit; arg?: ExpressionTree; args?: ExpressionTree[] }
export interface FunctionAnalysis {
  variables: string[]; minterms: number[]; dontCares: number[]; sop: string; sopImplicants: string[]; primes: string[]; exact: boolean;
  pos: string; posImplicants: string[]; gates: { inverters: number; and: number; or: number; literals: number };
  universal: { nand: { expression: string; gates: number } | null; nor: { expression: string; gates: number } | null };
  karnaugh: { rowVariables: string[]; colVariables: string[]; rows: string[]; cols: string[]; cells: number[][] } | null;
  groups: number[][]; canonicalSop: string;
}
export const MAX_VARIABLES: number;
export function parseExpression(text: string): { tree: ExpressionTree; variables: string[] };
export function evaluateExpression(tree: ExpressionTree, assignment: Record<string, Bit | boolean>): Bit;
export function truthTable(expression: string | { tree: ExpressionTree; variables: string[] }): { variables: string[]; rows: { index: number; inputs: Bit[]; output: Bit }[]; minterms: number[] };
export function patternCovers(pattern: string, term: number): boolean;
export function primeImplicants(count: number, terms: number[]): string[];
export function minimize(count: number, minterms: number[], dontCares?: number[]): { implicants: string[]; primes: string[]; exact: boolean; constant: Bit | null };
export function formatSop(implicants: string[], variables: string[]): string;
export function formatPos(implicantsOfComplement: string[], variables: string[]): string;
export function universalForms(sop: string[], pos: string[], variables: string[]): FunctionAnalysis['universal'];
export function gateCount(implicants: string[], variables: string[]): FunctionAnalysis['gates'];
export function karnaughLayout(variables: string[]): NonNullable<FunctionAnalysis['karnaugh']>;
export function analyzeFunction(variables: string[], minterms: number[], dontCares?: number[]): FunctionAnalysis;

export interface NetlistElement { kind: string; outputs: string[]; inputs: string[]; line: number; data?: number; sequential?: boolean }
export interface Netlist { inputs: { name: string; value: Bit; pattern: string | null; step: number }[]; clocks: { name: string; period: number }[]; outputs: string[]; elements: NetlistElement[]; signals: string[] }
export interface LogicTrace { kind: 'digital-trace'; timescale: '1 ns'; stopTime: number; signals: { id: string; name: string; fullName: string; scope: string; width: 1; samples: { time: number; value: LogicValue }[] }[]; final: Record<string, LogicValue>; oscillating: boolean; warnings: string[] }
export const GATE_DELAY_NS: number;
export const MAX_ELEMENTS: number;
export const MAX_STOP_TIME_NS: number;
export const LOGIC_TEMPLATES: readonly { id: string; name: string; text: string }[];
export function parseNetlist(text: string): Netlist;
export function simulateNetlist(netlist: string | Netlist, options?: { stopTime?: number; values?: Record<string, Bit> }): LogicTrace;
export function analyzeCombinational(netlist: string | Netlist): { variables: string[]; outputs: string[]; rows: { index: number; inputs: Bit[]; outputs: LogicValue[] }[]; minterms: Record<string, number[]> };

export const MAX_CODE_BITS: number;
export function parseNumber(text: string, base?: 'binary' | 'octal' | 'decimal' | 'hex'): number;
export function toGray(value: number): number;
export function fromGray(gray: number): number;
export function convertNumber(value: number, bits?: number): { decimal: string; binary: string; octal: string; hex: string; signedDecimal: string; onesComplement: string; twosComplementOfValue: string; gray: string; bcd: string; excess3: string; onesCount: number; evenParityBit: Bit };
