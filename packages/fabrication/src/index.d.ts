export type FabricationKind = 'bom' | 'gerber' | 'drill' | 'position';
export interface FabricationArtifact { kind: FabricationKind; path: string; size: number; sha256: string; mediaType?: string; [key: string]: unknown; }
export interface FabricationManifest { format: 'openentc-fabrication-manifest'; version: 1; boardPath: string; kicadVersion: string; generatedAt: string | null; artifacts: readonly FabricationArtifact[]; checks: { schematic: boolean; pcb: boolean; requiredOutputs: boolean; hashes: boolean }; complete: boolean; }
export declare const FABRICATION_KINDS: readonly FabricationKind[];
export declare function createFabricationManifest(input: unknown): FabricationManifest;
export declare function fabricationChecklist(manifest: unknown): readonly { kind: FabricationKind; present: boolean; validHash: boolean }[];
