import type { OpenEntcProject } from '../../packages/project-model/src/types.d.ts';

export type PersistenceStatus = 'saved' | 'unsaved' | 'recovered' | 'error';
export interface PersistenceState { status: PersistenceStatus; error: string | null; }
export interface DesktopProjectState { name: string; version: number; root: string; project_id: string; }
export type DesktopEvent = { kind: string; data: Record<string, unknown>; };
export interface ArduinoInventoryState { version: string; boards: Array<{ name: string; fqbn: string }>; cores: Array<{ id: string; name: string; installedVersion: string | null; latestVersion: string | null }>; libraries: Array<{ name: string; version: string | null; location: string | null }>; refreshedAt: string; }
export interface AppState {
  activeModule: string;
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  canvasView: { x: number; y: number; scale: number };
  bottomPanel: string;
  project: OpenEntcProject;
  simulation: Record<string, unknown> | null;
  ngspiceView: { traceIndex: number; startIndex: number; endIndex: number; cursorA: number; cursorB: number } | null;
  digitalView: ({ source?: 'generated' | 'imported' } & Partial<import('./digital-waveform-view.d.ts').DigitalWaveformView>) | null;
  arduinoInventory: ArduinoInventoryState | null;
  arduinoDeviceGrant: { projectId: string; permission: 'device-programmer' | 'device-serial'; target: string } | null;
  arduinoSerialGrant: { projectId: string; permission: 'device-serial'; target: string } | null;
  arduinoSerial: ({ text: string; nativeError: string | null } & import('../../packages/device-bridge/src/index.d.ts').SerialSessionSnapshot) | null;
  arduinoUpload: { runId: string; phase: 'compiling' | 'uploading' | 'cancelling'; port: string } | null;
  hdlJob: { runId: string; engine: string; operation: string; phase: 'running' | 'cancelling' } | null;
  hdlResults: { lint?: Record<string, unknown>; simulation?: Record<string, unknown>; synthesis?: Record<string, unknown>; placeRoute?: Record<string, unknown> } | null;
  lessonEvaluation: Record<string, unknown> | null;
  learningProgress: Record<string, unknown>;
  desktopProject: DesktopProjectState | null;
  desktopJobs: import('./desktop-bridge.d.ts').DesktopJobRecord[];
  desktopEvents: DesktopEvent[];
  processPermissionGranted: boolean;
  artifactPermissionGranted: boolean;
  toolchainDetection?: Record<string, { id: string; state: 'detected' | 'missing' | 'invalid'; path: string | null }>;
  toast: { message: string; tone: string; id: number } | null;
  persistence: PersistenceState;
}
export type StatePatch = Partial<AppState> | ((state: AppState) => Partial<AppState>);
export declare function getState(): AppState;
export declare function setState(patch: StatePatch): void;
export declare function subscribe(listener: (state: AppState) => void): () => void;
export declare function canUndoProject(): boolean;
export declare function canRedoProject(): boolean;
export declare function updateProject(updater: (project: OpenEntcProject) => void): void;
export declare function saveProject(project?: OpenEntcProject): OpenEntcProject;
export declare function recordExperiment(definition: Record<string, unknown>): void;
export declare function undoProject(): boolean;
export declare function redoProject(): boolean;
export declare function notify(message: string, tone?: string): void;
export declare function recordLearningAttempt(id: string, passed: boolean): Record<string, unknown>;
export declare function replaceProject(project: OpenEntcProject): void;
export declare function synchronizeOpenProject(project: OpenEntcProject): OpenEntcProject;
