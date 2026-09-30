export type ComponentSimulationMetadata = Record<string, string>;
export interface ComponentDefinition { type: string; label: string; symbol: string; defaultValue: number; unit: string; pins: readonly string[]; simulation: ComponentSimulationMetadata; }
export declare const COMPONENT_DEFINITION_VERSION: number;
export declare const COMPONENT_DEFINITIONS: readonly ComponentDefinition[];
export declare function validateComponentDefinitions(input?: readonly ComponentDefinition[]): readonly ComponentDefinition[];
export declare function getComponentDefinition(type: string): ComponentDefinition | undefined;
