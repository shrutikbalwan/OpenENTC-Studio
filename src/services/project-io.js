// Browser project persistence: save to local storage and export a packaged .entcproj file.
import { createPackagedProjectExport } from '../core/project-file.js';
import { getState, notify, saveProject } from '../core/store.js';

export function saveBrowserProject() {
  try { saveProject(); notify('Project saved locally', 'success'); }
  catch (error) { notify(error?.message || 'Project could not be saved', 'error'); }
}
export function exportProject() {
  const exported = createPackagedProjectExport(getState().project);
  const blob = new Blob([exported.data], { type: exported.mediaType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = exported.fileName;
  link.click(); URL.revokeObjectURL(link.href); notify('Project exported', 'success');
}
