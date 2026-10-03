export interface BoardPart { id: string; type: string; label: string; value: number; unit: string; n1: string; n2: string; n3?: string; x: number; y: number; rotation: number }
export interface Board { name: string; level: string; description: string; components: BoardPart[] }
export interface Fault { id: string; kind: string; factor?: number }
export type SolveDC = (components: BoardPart[]) => { nodes: Record<string, number> };
export declare const BOARDS: Readonly<Record<string, Board>>;
export declare const FAULT_TYPES: Readonly<Record<string, string>>;
export declare function faultsFor(type: string): string[];
export declare function chooseFault(board: Board, seed: number, solveDC: SolveDC, options?: { minimumChange?: number }): Fault;
export declare function applyFault(components: BoardPart[], fault: Fault): BoardPart[];
export declare function measureVoltage(components: BoardPart[], red: string, black: string, solveDC: SolveDC): number;
export declare function measureResistance(components: BoardPart[], red: string, black: string, solveDC: SolveDC): number;
export declare function score(options?: { measurements?: number; wrongGuesses?: number; peeked?: boolean; solved?: boolean }): number;
export declare function debrief(board: Board, fault: Fault, solveDC: SolveDC): { net: string; healthy: number; faulty: number; change: number }[];
export declare function boardNets(board: Board): string[];
