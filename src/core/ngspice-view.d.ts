export interface NgspiceTable { kind: 'table'; columns: string[]; rows: number[][]; units?: string; }
export interface NgspiceView { traceIndex: number; startIndex: number; endIndex: number; cursorA: number; cursorB: number; }
export interface NgspiceCursorMeasurement { xA: number; yA: number; xB: number; yB: number; deltaX: number; deltaY: number; }
export declare function normalizeNgspiceView(result: NgspiceTable, requested?: Partial<NgspiceView>): Readonly<NgspiceView>;
export declare function transformNgspiceWindowView(result: NgspiceTable, requested: Partial<NgspiceView>, command: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right'): Readonly<NgspiceView>;
export declare function measureNgspiceCursors(result: NgspiceTable, requested: Partial<NgspiceView>): Readonly<NgspiceCursorMeasurement>;
export declare function serializeNgspiceCsv(result: NgspiceTable): string;
