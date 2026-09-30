export interface ArtifactRecord { path: string; sha256: string; size: number; mediaType: string; }
export declare const MAX_ARTIFACT_BYTES: number;
export declare const MAX_ARTIFACT_PATH_BYTES: number;
export declare const MAX_MEDIA_TYPE_BYTES: number;
export declare function writeArtifact(root: string, path: string, input: Uint8Array | string, options?: { mediaType?: string; maxBytes?: number }): Promise<ArtifactRecord>;
export declare function readArtifact(root: string, record: ArtifactRecord, options?: { maxBytes?: number }): Promise<Uint8Array>;
export interface ArtifactManifest { format: 'openentc-artifact-manifest'; version: 1; tool: string; toolVersion: string; generatedAt: string | null; artifacts: readonly ArtifactRecord[]; }
export declare function createArtifactManifest(records: readonly ArtifactRecord[], options?: { tool?: string; version?: string; generatedAt?: string | null }): ArtifactManifest;
