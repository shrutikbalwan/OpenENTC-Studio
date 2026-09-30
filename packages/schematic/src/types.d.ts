export interface SchematicComponent { id: string; type: string; label: string; value: number; unit: string; n1: string; n2: string; x?: number; y?: number; rotation?: number; [key: string]: unknown; }
export interface IntermediateElement { id: string; type: string; label: string; value: number; unit: string; nodes: [string, string]; }
export interface IntermediateNetlist { nodes: string[][]; elements: IntermediateElement[]; }
export declare function normalizeNode(node: string): string;
export type SchematicWireRoute = { axis: 'x' | 'y'; coordinate: number } | { points: Array<{ x: number; y: number }> };
export interface SchematicWire { from: string; to: string; route?: SchematicWireRoute; [key: string]: unknown; }
export interface SchematicNetLabel { id: string; text: string; node: string; x: number; y: number; [key: string]: unknown; }
export declare function buildConnectivity(components: SchematicComponent[], wires?: SchematicWire[], netLabels?: SchematicNetLabel[]): string[][];
export declare function resolveNodeAliases(components: SchematicComponent[], wires?: SchematicWire[], netLabels?: SchematicNetLabel[]): Record<string, string>;
export declare function buildIntermediateNetlist(components: SchematicComponent[], wires?: SchematicWire[], netLabels?: SchematicNetLabel[]): IntermediateNetlist;
