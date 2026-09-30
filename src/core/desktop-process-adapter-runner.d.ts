import type { DesktopArtifactReference, DesktopBridge, DesktopProcessResult, DesktopProjectSummary } from './desktop-bridge.d.ts';
export interface DesktopAdapterRunSpec { executable: string; args: string[]; signal?: AbortSignal; timeout_ms?: number; max_output_bytes?: number; }
export interface DesktopAdapterRunResult extends DesktopProcessResult { artifacts: readonly DesktopArtifactReference[]; }
export declare function createDesktopProcessAdapterRunner(options: { bridge: DesktopBridge; project: DesktopProjectSummary; runId: string; deviceAuthorization?: { permission: 'device-serial' | 'device-programmer'; target: string } | null; pollIntervalMs?: number; sleep?: (milliseconds: number) => Promise<void>; onStarted?: (runId: string) => void | Promise<void>; onArtifact?: (artifact: DesktopArtifactReference) => void; }): (spec: DesktopAdapterRunSpec) => Promise<DesktopAdapterRunResult>;
export declare function joinDesktopProjectPath(root: string, ...segments: string[]): string;
