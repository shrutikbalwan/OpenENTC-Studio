// @ts-check
// Browser project persistence: save to local storage and export a packaged .entcproj file.
import { createPackagedProjectExport } from '../core/project-file.js';
import { getState, notify, saveProject } from '../core/store.js';
import { reportError } from './errors.js';

export function saveBrowserProject() {
  try { saveProject(); notify('Project saved locally', 'success'); }
  catch (error) { reportError(error, { fallback: 'Project could not be saved' }); }
}
export function exportProject() {
  const exported = createPackagedProjectExport(getState().project);
  const blob = new Blob([/** @type {BlobPart} */ (exported.data)], { type: exported.mediaType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = exported.fileName;
  link.click(); URL.revokeObjectURL(link.href); notify('Project exported', 'success');
}
