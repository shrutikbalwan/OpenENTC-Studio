export interface Topology { id: string; nodes: Array<{ id: string; [key: string]: unknown }>; links: Array<{ from: string; to: string; [key: string]: unknown }>; [key: string]: unknown; }
export declare function validateTopology(topology: Topology): Readonly<Topology>;
export declare function topologyMetrics(topology: Topology, sourceId?: string | null): { kind: 'topology-metrics'; nodes: number; links: number; reachable: number; distances: Readonly<Record<string, number>> };
