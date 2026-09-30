import type { SchematicComponent } from './types.d.ts';
export interface SelectionRect { x: number; y: number; width: number; height: number; }
export declare function componentsInRect(components: SchematicComponent[], rect: SelectionRect): string[];
