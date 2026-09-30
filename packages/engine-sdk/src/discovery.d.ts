export interface DiscoveryResult { id: string; status: 'detected' | 'missing'; path: string | null; evidence: string; displayName?: string; supportedOperations?: string[]; }
export declare const MAX_DISCOVERY_CANDIDATES: 64;
export declare const MAX_DISCOVERY_PATH_BYTES: 4096;
export declare const MAX_ENGINE_ID_BYTES: 100;
export declare const MAX_MANIFEST_BYTES: 262144;
export declare function assertAbsoluteExecutable(path: string): string;
export declare function probeExecutable(input: { id: string; candidates?: string[] }): Promise<DiscoveryResult>;
export declare function probeEngineManifest(manifest: { id: string; displayName?: string; executableCandidates?: string[]; operations?: string[] }): Promise<DiscoveryResult>;
export declare function loadAndProbeManifest(path: string): Promise<DiscoveryResult>;
