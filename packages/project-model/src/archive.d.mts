import type { OpenEntcProject } from './types.d.ts';

export declare const PROJECT_ARCHIVE_ENTRY: 'openentc.project.json';
export declare const PROJECT_ARCHIVE_EXTENSION: '.entcproj';
export declare const PROJECT_ARCHIVE_MEDIA_TYPE: 'application/vnd.openentc.project+zip';
export declare function createProjectArchive(project: OpenEntcProject): Uint8Array;
export declare function importProjectArchive(input: ArrayBuffer | ArrayBufferView): OpenEntcProject;
