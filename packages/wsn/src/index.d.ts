export interface Radio { eElec: number; eFs: number; eMp: number; eDa: number; packetBits: number; controlBits: number }
export declare const RADIO_DEFAULTS: Readonly<Radio>;
export declare function crossover(radio?: Radio): number;
export declare function txEnergy(bits: number, distance: number, radio?: Radio): number;
export declare function rxEnergy(bits: number, radio?: Radio): number;
export interface Field { width: number; height: number; nodes: { id: number; x: number; y: number }[]; sink: { x: number; y: number } }
export declare function deploy(options: { nodes?: number; width?: number; height?: number; seed?: number; layout?: 'random' | 'grid'; sink?: { x: number; y: number } | null }): Field;
export declare function connectivity(field: Field, range: number): { neighbours: number[][]; hops: number[]; reachable: number; connectedFraction: number; averageDegree: number; maxHops: number; isolated: number };
export declare function coverage(field: Field, sensingRange: number, options?: { k?: number; resolution?: number }): { fraction: number; kFraction: number; expected: number; cells: number[]; resolution: number };
export interface LifetimeResult { protocol: string; firstDeath: number | null; halfDeath: number | null; lastDeath: number | null; delivered: number; rounds: number; history: { alive: number[]; energy: number[]; heads: number[]; headIds: number[][]; delivered: number[] }; snapshot: { round: number; heads: number[]; members: Record<string, number[]> | null; next: number[] | null; energy: number[] } | null }
export declare function simulateLifetime(field: Field, options?: { protocol?: 'direct' | 'mte' | 'leach'; initialEnergy?: number; chProbability?: number; maxRounds?: number; radio?: Radio; seed?: number; recordRound?: number | null }): LifetimeResult;
