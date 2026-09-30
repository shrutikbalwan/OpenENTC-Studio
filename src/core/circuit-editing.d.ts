export interface EditableComponent { id: string; type: string; label: string; x: number; y: number; rotation?: number; [key: string]: unknown; }
export declare function rotateComponent(components: EditableComponent[], id: string, degrees?: number): EditableComponent[];
export declare function rotateComponents(components: EditableComponent[], ids: string[], degrees?: number): EditableComponent[];
export declare function moveComponents(components: EditableComponent[], ids: string[], delta?: { x: number; y: number }): EditableComponent[];
export declare function duplicateComponent(components: EditableComponent[], id: string, offset?: { x: number; y: number }): { components: EditableComponent[]; id: string | null };
export declare function pasteComponent(components: EditableComponent[], source: EditableComponent, offset?: { x: number; y: number }): { components: EditableComponent[]; id: string };
export declare function pasteComponents(components: EditableComponent[], sources: EditableComponent[], offset?: { x: number; y: number }): { components: EditableComponent[]; ids: string[]; nodeMap: Record<string, string> };
