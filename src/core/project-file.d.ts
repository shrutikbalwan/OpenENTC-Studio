import type { OpenEntcProject } from '../../packages/project-model/src/types.d.ts';

export declare const PROJECT_EXPORT_MEDIA_TYPE: 'application/json';
export declare const PROJECT_EXPORT_EXTENSION: '.entc.json';
export { PROJECT_ARCHIVE_EXTENSION, PROJECT_ARCHIVE_MEDIA_TYPE } from '../../packages/project-model/src/archive.mjs';
export interface ProjectExport {
  readonly text: string;
  readonly fileName: string;
  readonly mediaType: string;
}
export interface BrowserProjectFile {
  size: number;
  name?: string;
  text(): Promise<string>;
  arrayBuffer?(): Promise<ArrayBuffer>;
}
export declare function projectFileStem(name: string): string;
export declare function createProjectExport(project: OpenEntcProject): Readonly<ProjectExport>;
export declare function createPackagedProjectExport(project: OpenEntcProject): Readonly<{ data: Uint8Array; fileName: string; mediaType: string }>;
export declare function importProjectFile(file: BrowserProjectFile): Promise<OpenEntcProject>;
