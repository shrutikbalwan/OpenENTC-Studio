export interface Pad { number: string; x: number; y: number; w: number; h: number; shape: 'rect' | 'circle'; drill: number | null }
export interface Footprint { name: string; description: string; pads: readonly Pad[]; courtyard: { x1: number; y1: number; x2: number; y2: number }; silk: readonly number[][]; smd: boolean }
export declare const FOOTPRINTS: Readonly<Record<string, Footprint>>;
export declare const FOOTPRINT_STYLES: readonly ('tht' | 'smd')[];
export declare function footprintFor(type: string, style?: 'tht' | 'smd'): { footprint: Footprint; pinMap: Record<string, string>; prefix: string; powerPins: Record<string, string> | null } | null;
export declare function rotatePoint(x: number, y: number, rotation: number): [number, number];

export type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'circle'; x: number; y: number; r: number } | { kind: 'segment'; x1: number; y1: number; x2: number; y2: number; r: number };
export interface Bounds { x1: number; y1: number; x2: number; y2: number }
export declare function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number;
export declare function segmentsIntersect(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean;
export declare function segmentSegmentDistance(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): number;
export declare function pointRectDistance(px: number, py: number, rect: { x: number; y: number; w: number; h: number }): number;
export declare function segmentRectDistance(segment: { x1: number; y1: number; x2: number; y2: number }, rect: { x: number; y: number; w: number; h: number }): number;
export declare function rectRectDistance(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number;
export declare function shapeDistance(a: Shape, b: Shape): number;
export declare function pointShapeDistance(x: number, y: number, shape: Shape): number;
export declare function shapeBounds(shape: Shape): Bounds;

export interface Rules { trackWidth: number; clearance: number; viaDiameter: number; viaDrill: number; edgeClearance: number; grid: number; margin: number; minTrackWidth: number; minDrill: number; minAnnularRing: number; maskExpansion: number }
export declare const DEFAULT_RULES: Readonly<Rules>;
export declare function normalizeRules(rules?: Partial<Record<keyof Rules, number | string>>): Rules;
export interface Placement { x: number; y: number; rotation: number }
export interface NetlistPart { id: string; reference: string; type: string; value: number; unit: string; footprint: Footprint; pinNets: Record<string, string>; powerPins: Record<string, string> | null }
export interface Netlist { parts: NetlistPart[]; nets: string[]; warnings: string[] }
export interface CircuitLike { components?: Array<Record<string, unknown>>; wires?: Array<{ from: string; to: string }>; netLabels?: Array<{ node: string; text: string }> }
export declare function extractNetlist(circuit: CircuitLike, style?: 'tht' | 'smd'): Netlist;
export declare function autoPlace(netlist: Netlist, options?: { spacing?: number; rowWidth?: number }): Record<string, Placement>;
export interface BoardPad { part: string; reference: string; number: string; net: string | null; x: number; y: number; w: number; h: number; shape: Shape; drill: number | null; layers: string[] }
export interface BoardPart extends NetlistPart { placement: Placement; pads: BoardPad[]; bounds: Bounds; silk: number[][] }
export interface Board { style: 'tht' | 'smd'; rules: Rules; parts: BoardPart[]; pads: BoardPad[]; nets: string[]; warnings: string[]; outline: Bounds; width: number; height: number; placement: Record<string, Placement> }
export interface Track { net: string; layer: 'top' | 'bottom'; x1: number; y1: number; x2: number; y2: number; width: number }
export interface Via { net: string; x: number; y: number; diameter: number; drill: number }
export declare function buildBoard(circuit: CircuitLike, options?: { style?: 'tht' | 'smd'; placement?: Record<string, Placement>; rules?: Partial<Record<keyof Rules, number | string>> }): Board;
export interface CopperItem { type: 'pad' | 'track' | 'via'; index: number; net: string | null; layers: string[]; shape: Shape; label: string; x: number; y: number; bounds: Bounds }
export declare function copperItems(board: Board, tracks?: Track[], vias?: Via[]): CopperItem[];
export declare function connectivity(items: CopperItem[]): number[];
export interface RatsnestLine { net: string; x1: number; y1: number; x2: number; y2: number; from: string; to: string; length: number }
export declare function ratsnest(board: Board, tracks?: Track[], vias?: Via[]): RatsnestLine[];
export declare function autoroute(board: Board, options?: { tracks?: Track[]; vias?: Via[]; layers?: 1 | 2; passes?: number; nets?: string[] }): { tracks: Track[]; vias: Via[]; failed: { net: string; from: string; to: string }[]; remaining: number; passes: number };
export interface Violation { type: string; severity: 'error' | 'warning'; message: string; x: number; y: number; items: string[] }
export declare function runDrc(board: Board, copper?: { tracks?: Track[]; vias?: Via[] }): { violations: Violation[]; errors: number; warnings: number; passed: boolean };
export declare function strokeText(text: string, x: number, y: number, height?: number): number[][];
export declare function strokeTextWidth(text: string, height?: number): number;
export declare function silkscreen(board: Board, height?: number): number[][];
export declare function excellonDrill(board: Board, vias?: Via[]): { text: string; holes: number; tools: number };
export declare function billOfMaterials(board: Board): { rows: { type: string; value: string; footprint: string; references: string[] }[]; text: string };
export declare function placementFile(board: Board): string;
export declare function fabricationFiles(board: Board, options?: { tracks?: Track[]; vias?: Via[]; name?: string }): { path: string; text: string }[];
export declare function crc32(bytes: Uint8Array): number;
export declare function createZip(files: { path: string; text?: string; bytes?: Uint8Array }[], date?: Date): Uint8Array;
export declare function traceWidthForCurrent(options?: { current?: number; temperatureRise?: number; copperOz?: number; external?: boolean }): { widthMm: number; widthMil: number; areaMil2: number };
