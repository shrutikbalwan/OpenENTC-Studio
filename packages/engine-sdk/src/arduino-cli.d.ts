import type { EngineAdapter, Job } from './types.d.ts';
import type { DevicePermissionPolicy } from '../../device-bridge/src/index.d.ts';
export interface ArduinoDiagnosticResult { kind: 'firmware-build-report'; diagnostics: unknown[]; memory: Record<string, { used: number; capacity: number }>; }
export interface ArduinoInventoryResult { kind: 'arduino-inventory'; inventory: 'boards' | 'cores' | 'libraries'; items: ReadonlyArray<Record<string, string | null>>; }
export interface ArduinoVersionResult { kind: 'engine-version'; version: string; }
export declare function parseArduinoDiagnostics(text: string): ArduinoDiagnosticResult;
export declare function parseArduinoInventory(text: string, inventory: 'boards' | 'cores' | 'libraries'): ArduinoInventoryResult;
export declare function parseArduinoCliVersion(text: string): string;
export declare function createArduinoCliAdapter(options?: { executable?: string | null; runner?: ((spec: { executable: string; args: string[]; shell: false; signal: AbortSignal }) => Promise<{ ok: boolean; stdout?: string; stderr?: string; error?: string }>) | null; permissionPolicy?: DevicePermissionPolicy | null }): EngineAdapter<Job & { board?: string; port?: string; sketchPath?: string; buildPath?: string; baud?: number }, ArduinoDiagnosticResult | ArduinoInventoryResult | ArduinoVersionResult>;
