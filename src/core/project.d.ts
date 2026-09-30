import type { ArtifactManifest, OpenEntcProject } from '../../packages/project-model/src/model';

export declare const PROJECT_FORMAT: 'openentc-project';
export declare const PROJECT_VERSION: number;
export declare const MAX_PROJECT_BYTES: number;
export declare const MAX_EXPERIMENT_DEFINITION_BYTES: number;
export declare const MAX_EXPERIMENT_DEFINITIONS: number;

export declare function createProject(name?: string, now?: string): OpenEntcProject;
export declare function validateProject(input: unknown, options?: { maxBytes?: number }): OpenEntcProject;
export declare function migrateProject(input: unknown): OpenEntcProject;
export declare function serializeProject(project: OpenEntcProject): string;
export declare function exportProject(project: OpenEntcProject): string;
export declare function importProject(text: string, options?: { maxBytes?: number }): OpenEntcProject;
export declare function registerArtifactManifest(project: OpenEntcProject, manifest: ArtifactManifest): OpenEntcProject;
export declare function upsertExperiment(experiments: Array<Record<string, unknown>>, definition: Record<string, unknown>, now?: string): Array<Record<string, unknown>>;
