export interface CanvasView { x: number; y: number; scale: number; }
export interface CanvasPoint { x: number; y: number; }
export declare const MIN_CANVAS_SCALE: number;
export declare const MAX_CANVAS_SCALE: number;
export declare const DEFAULT_GRID_SIZE: number;
export declare function clampCanvasScale(scale: number): number;
export declare function zoomCanvasView(view: CanvasView, factor: number, anchor?: CanvasPoint): CanvasView;
export declare function screenToCanvas(point: CanvasPoint, view: CanvasView): CanvasPoint;
export declare function fitCanvasView(components: Array<{ x: number; y: number }>, viewport: { width: number; height: number }, padding?: number): CanvasView;
export declare function snapCanvasPoint(point: CanvasPoint, gridSize?: number): CanvasPoint;
