export declare const PLUGIN_API_VERSION: 1;
export declare const PLUGIN_PERMISSIONS: readonly string[];
export declare const PLUGIN_TRUST_LEVELS: readonly ['builtin', 'reviewed', 'untrusted'];
export interface PluginManifest { id: string; name: string; version: string; license: string; sourceUrl: string; apiVersion: number; permissions: string[]; entrypoint?: string; [key: string]: unknown; }
export declare function validatePluginManifest(manifest: PluginManifest, options?: { apiVersion?: number }): Readonly<PluginManifest>;
export declare function declaredPermissions(manifest: PluginManifest): Set<string>;
export interface PluginTrustAssessment { level: 'builtin' | 'reviewed' | 'untrusted'; loadable: boolean; reason: string; }
export declare function assessPluginTrust(manifest: PluginManifest, policy?: { builtInIds?: readonly string[]; reviewedSourceUrls?: readonly string[] }): PluginTrustAssessment;
export declare function authorizePluginPermission(manifest: PluginManifest, permission: string, grantedPermissions?: readonly string[] | Set<string>): true;
