export declare function parseIpv4(text: string): number;
export declare function formatIpv4(value: number): string;
export declare function binaryIpv4(value: number): string;
export declare function parseCidr(text: string): { address: number; prefix: number };
export declare function prefixFromMask(mask: number): number;
export interface Subnet { address: number; prefix: number; network: number; broadcast: number; mask: number; wildcard: number; size: number; usable: number; firstHost: number; lastHost: number; cidr: string; class: string; scope: string }
export declare function subnetInfo(text: string | { address: number; prefix: number }): Subnet;
export declare function splitSubnet(text: string, options?: { count?: number | null; newPrefix?: number | null }): { prefix: number; borrowedBits: number; total: number; subnets: Subnet[] };
export declare function vlsm(text: string, requirements: { name: string; hosts: number }[]): { base: Subnet; allocations: (Subnet & { name: string; hosts: number; index: number; wasted: number })[]; used: number; free: number };
export declare function summarize(list: string[]): { summary: Subnet; exact: boolean; extraAddresses: number };
export declare function expandIpv6(text: string): string[];
export declare function compressIpv6(text: string): string;
export declare function ipv6Info(text: string): { expanded: string; compressed: string; prefix: number; network: string; addresses: bigint; type: string };
export interface Graph { nodes: string[]; edges: { from: string; to: string; cost: number }[] }
export declare function parseGraph(text: string): Graph;
export declare function dijkstra(graph: Graph, source: string): { distance: Record<string, number>; previous: Record<string, string | null>; steps: { added: string; visited: string[]; distance: Record<string, number>; previous: Record<string, string | null> }[]; forwarding: { destination: string; nextHop: string | null; cost: number; path: string[] }[] };
export type DvTable = Record<string, Record<string, { cost: number; via: string | null }>>;
export interface DvOptions { maxRounds?: number; poisonedReverse?: boolean; infinity?: number; initial?: DvTable | null }
export declare function distanceVector(graph: Graph, options?: DvOptions): { rounds: DvTable[]; table: DvTable; converged: boolean; roundsToConverge: number };
export declare function linkChange(graph: Graph, change: { from: string; to: string; cost: number }, options?: DvOptions): { before: ReturnType<typeof distanceVector>; after: ReturnType<typeof distanceVector> };
export interface ArqEvent { type: 'data' | 'ack' | 'timeout'; seq?: number; ack?: number; start?: number; end?: number; at?: number; lost?: boolean; retransmission?: boolean; index?: number }
export declare function simulateArq(options: { protocol?: 'stop-and-wait' | 'gbn' | 'sr'; frames?: number; window?: number; propagation?: number; ackTime?: number; timeout?: number | null; lostFrames?: number[]; lostAcks?: number[] }): { protocol: string; window: number; timeout: number; events: ArqEvent[]; deliveries: { seq: number; at: number }[]; transmissions: number; retransmissions: number; finish: number; efficiency: number };
export declare function arqUtilisation(options: { a: number; window: number; p?: number }): { stopAndWait: number; goBackN: number; selectiveRepeat: number; windowToFill: number; sequenceBitsGbn: number; sequenceBitsSr: number };
export declare function pureAloha(g: number): number;
export declare function slottedAloha(g: number): number;
export declare function nonPersistentCsma(g: number, a: number): number;
export declare function onePersistentCsma(g: number, a: number): number;
export declare function csmaCdEfficiency(a: number): number;
