import type { DesktopArtifactReference, DesktopBridge, DesktopProcessResult, DesktopProjectSummary } from './desktop-bridge.d.ts';

export interface DesktopEngineRunSpec {
  executable: string;
  args: string[];
  shell?: false;
  netlist: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  max_output_bytes?: number;
}
export interface DesktopEngineRunResult extends DesktopProcessResult { artifacts: readonly DesktopArtifactReference[]; }
export declare function createDesktopEngineRunner(options: {
  bridge: DesktopBridge;
  project: DesktopProjectSummary;
  runId: string;
  pollIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  onStarted?: (runId: string) => void | Promise<void>;
  onArtifacts?: (artifacts: readonly DesktopArtifactReference[]) => void;
}): (spec: DesktopEngineRunSpec) => Promise<DesktopEngineRunResult>;
