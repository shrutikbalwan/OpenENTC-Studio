export type ProjectFormat = 'openentc-project';
export type SignalShape = 'sine' | 'square' | 'triangle';

export interface ProjectComponent {
  id: string;
  type: string;
  label: string;
  value: number;
  unit: string;
  n1: string;
  n2: string;
  x: number;
  y: number;
  rotation?: number;
  [key: string]: unknown;
}
export interface ProjectWire { from: string; to: string; route?: { axis: 'x' | 'y'; coordinate: number } | { points: Array<{ x: number; y: number }> }; [key: string]: unknown; }
export interface ProjectJunction { id: string; node: string; x: number; y: number; [key: string]: unknown; }
export interface ProjectNetLabel { id: string; text: string; node: string; x: number; y: number; [key: string]: unknown; }
export interface ProjectArtifact { path: string; sha256: string; size: number; mediaType: string; [key: string]: unknown; }
export interface ProjectProvenance { createdBy: string; engineVersions: Record<string, string>; [key: string]: unknown; }
export interface ProjectSettings { theme: string; grid: boolean; gridSize: number; [key: string]: unknown; }

export interface OpenEntcProject {
  format: ProjectFormat;
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  circuit: {
    wires: ProjectWire[];
    junctions: ProjectJunction[];
    netLabels: ProjectNetLabel[];
    components: ProjectComponent[];
    signal: { shape: SignalShape; frequency: number; amplitude: number; offset: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  embedded: { board: string; language: string; code: string; [key: string]: unknown };
  artifacts: ProjectArtifact[];
  units: Record<string, string>;
  provenance: ProjectProvenance;
  documents: Array<Record<string, unknown>>;
  targets: Array<Record<string, unknown>>;
  toolchainConstraints: Array<Record<string, unknown>>;
  experiments: Array<Record<string, unknown>>;
  notes: unknown[];
  settings: ProjectSettings;
  [key: string]: unknown;
}

export declare const PROJECT_FORMAT: ProjectFormat;
export declare const PROJECT_VERSION: number;
export declare const MAX_PROJECT_BYTES: number;
export declare const AUTHORED_DIRECTORIES: readonly string[];
export declare const GENERATED_DIRECTORIES: readonly string[];
export declare const MAX_ARCHIVE_ENTRIES: number;
export declare const MAX_ARCHIVE_BYTES: number;
export interface ArchiveEntry { path: string; size: number; type: 'file' | 'directory'; }
export declare function validateArchiveEntries(entries: unknown, options?: { maxEntries?: number; maxBytes?: number }): ArchiveEntry[];
export declare function createProject(name?: string, now?: string): OpenEntcProject;
export declare function migrateProject(input: unknown): OpenEntcProject;
export declare function validateProject(input: unknown, options?: { maxBytes?: number }): OpenEntcProject;
export declare function serializeProject(project: OpenEntcProject): string;
export declare function exportProject(project: OpenEntcProject): string;
export declare function importProject(text: string, options?: { maxBytes?: number }): OpenEntcProject;
export declare function registerArtifact(project: OpenEntcProject, artifact: ProjectArtifact): OpenEntcProject;
export interface ArtifactManifest { format: 'openentc-artifact-manifest'; version: 1; tool: string; toolVersion: string; generatedAt: string | null; artifacts: ProjectArtifact[]; }
export declare function registerArtifactManifest(project: OpenEntcProject, manifest: ArtifactManifest): OpenEntcProject;
export declare function removeArtifact(project: OpenEntcProject, path: string): OpenEntcProject;
export interface HistorySnapshot<T> {
  past: T[];
  present: T;
  future: T[];
}
export interface History<T> {
  value: T;
  canUndo: boolean;
  canRedo: boolean;
  commit(next: T): HistorySnapshot<T>;
  undo(): HistorySnapshot<T>;
  redo(): HistorySnapshot<T>;
  clear(): HistorySnapshot<T>;
}
export declare function createHistory<T>(initial: T, limit?: number): History<T>;
export declare const MAX_EXPERIMENT_DEFINITION_BYTES: number;
export declare const MAX_EXPERIMENT_DEFINITIONS: number;
export declare function upsertExperiment(experiments: Array<Record<string, unknown>>, definition: Record<string, unknown>, now?: string): Array<Record<string, unknown>>;
export declare function initializeProjectDirectory(root: string, project?: OpenEntcProject): Promise<string>;
export declare function saveProjectDirectory(root: string, project: OpenEntcProject): Promise<string>;
export declare function openProjectDirectory(root: string): Promise<OpenEntcProject>;
export declare function backupProjectManifest(root: string): Promise<string>;
export declare function migrateProjectDirectory(root: string): Promise<OpenEntcProject>;
export declare function cleanGeneratedDirectories(root: string): Promise<string[]>;
export declare const PROJECT_ARCHIVE_ENTRY: 'openentc.project.json';
export declare const PROJECT_ARCHIVE_EXTENSION: '.entcproj';
export declare const PROJECT_ARCHIVE_MEDIA_TYPE: 'application/vnd.openentc.project+zip';
export declare function createProjectArchive(project: OpenEntcProject): Uint8Array;
export declare function importProjectArchive(input: ArrayBuffer | ArrayBufferView): OpenEntcProject;
