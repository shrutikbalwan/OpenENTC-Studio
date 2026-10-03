export interface Stream { re: Float64Array; im: Float64Array | null; rate: number }
export interface BlockParam { key: string; label: string; value: number | string; unit?: string; options?: [string | number, string][] }
export interface BlockDefinition { label: string; category: string; inputs: string[]; outputs: string[]; params: BlockParam[]; sink?: boolean; run(inputs: (Stream | null)[], params: Record<string, any>, ctx: { sampleRate: number; samples: number }): any[] }
export declare const BLOCKS: Readonly<Record<string, BlockDefinition>>;
export declare const CONSTELLATIONS: Readonly<Record<string, { label: string; bits: number; points: number[][] }>>;
export interface GraphBlock { id: string; type: string; x: number; y: number; params?: Record<string, any> }
export interface Graph { blocks: GraphBlock[]; connections: { from: string; to: string }[]; sampleRate?: number; samples?: number }
export declare function firFilter(taps: ArrayLike<number>, s: Stream): Stream;
export declare function rrcTaps(sps: number, alpha: number, span: number): Float64Array;
export declare function powerSpectrum(s: Stream, options?: { size?: number; window?: string }): { frequency: number[]; db: number[]; size: number; segments: number };
export declare function validateGraph(graph: Graph): Graph;
export declare function topologicalOrder(graph: Graph): string[];
export declare function blockParams(block: GraphBlock): Record<string, any>;
export declare function runFlowgraph(graph: Graph, options?: { sampleRate?: number; samples?: number }): { sinks: Record<string, any>; errors: Record<string, string>; rates: Record<string, { rate: number; length: number; complex: boolean }[]>; order: string[] };
export declare const SDR_EXAMPLES: Readonly<Record<string, { label: string; sampleRate: number; samples: number; blocks: GraphBlock[]; connections: [string, string][] }>>;
export declare function exampleGraph(id: string): Graph & { sampleRate: number; samples: number };
