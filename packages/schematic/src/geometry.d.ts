import type { SchematicComponent, SchematicWire } from './types.d.ts';
export interface WirePoint { x: number; y: number; }
export type WireRoute = { axis: 'x' | 'y'; coordinate: number } | { points: WirePoint[] };
export interface WireSegment { fromNode: string; toNode: string; from: WirePoint; to: WirePoint; route?: WireRoute; }
export declare function defaultWireRoute(from: WirePoint, to: WirePoint): { axis: 'x' | 'y'; coordinate: number };
export declare function orthogonalPoints(from: WirePoint, to: WirePoint, route?: WireRoute): WirePoint[];
export declare function orthogonalPath(from: WirePoint, to: WirePoint, route?: WireRoute): string;
export declare function wireRouteHandle(from: WirePoint, to: WirePoint, route?: WireRoute): { x: number; y: number; axis: 'x' | 'y' | 'point'; coordinate?: number; index?: number };
export declare function wireRouteHandles(from: WirePoint, to: WirePoint, route?: WireRoute): Array<{ x: number; y: number; axis: 'x' | 'y' | 'point'; coordinate?: number; index?: number }>;
export declare function wireRouteInsertionPoint(from: WirePoint, to: WirePoint, route?: WireRoute): WirePoint;
export declare function buildWireSegments(components: SchematicComponent[], wires?: SchematicWire[]): WireSegment[];
