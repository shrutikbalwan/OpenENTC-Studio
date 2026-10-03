import type { FunctionAnalysis, LogicTrace } from '../../packages/logic/src/index.js';
export const GROUP_COLORS: string[];
export function parseMintermNotation(text: string, count?: number | null): { variables: string[]; minterms: number[]; dontCares: number[] } | null;
export function renderKarnaugh(analysis: FunctionAnalysis): string;
export function renderGateDiagram(implicants: string[], variables: string[]): string;
export function renderTimingDiagram(trace: LogicTrace, names: string[]): string;
