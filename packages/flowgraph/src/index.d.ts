export type FlowgraphPortType = 'real' | 'complex' | 'bits' | 'bytes' | 'message';
export type FlowgraphDirection = 'input' | 'output';
export interface FlowgraphPort { id: string; direction: FlowgraphDirection; type: FlowgraphPortType; rate?: number; unit?: string; [key: string]: unknown; }
export interface FlowgraphBlock { id: string; kind: string; ports: readonly FlowgraphPort[]; [key: string]: unknown; }
export interface FlowgraphConnection { from: string; to: string; [key: string]: unknown; }
export interface Flowgraph { format: 'openentc-flowgraph'; version: 1; name: string; blocks: readonly FlowgraphBlock[]; connections: readonly FlowgraphConnection[]; [key: string]: unknown; }
export declare const FLOWGRAPH_FORMAT: 'openentc-flowgraph';
export declare const FLOWGRAPH_VERSION: 1;
export declare const FLOWGRAPH_PORT_TYPES: readonly FlowgraphPortType[];
export declare function validateFlowgraph(input: unknown): Flowgraph;
export declare function createFlowgraph(name?: string): Flowgraph;
export declare function topologicalOrder(flowgraph: Flowgraph): readonly string[];
export interface FlowgraphRun { kind: 'flowgraph-run'; outputs: Readonly<Record<string, unknown>>; }
export declare function executeFlowgraph(flowgraph: Flowgraph, options?: { inputs?: Record<string, unknown> }): FlowgraphRun;
