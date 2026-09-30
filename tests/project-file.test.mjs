import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/core/project.js';
import { createPackagedProjectExport, createProjectExport, importProjectFile, projectFileStem, PROJECT_ARCHIVE_EXTENSION, PROJECT_ARCHIVE_MEDIA_TYPE, PROJECT_EXPORT_EXTENSION, PROJECT_EXPORT_MEDIA_TYPE } from '../src/core/project-file.js';
import { MAX_BROWSER_IMPORT_BYTES } from '../src/core/project-storage.js';

test('project file export is deterministic, portable, and round-trips', async () => {
  const project = createProject('  RF / Lab: \u03b1  ');
  const exported = createProjectExport(project);
  assert.equal(exported.fileName, `rf-lab${PROJECT_EXPORT_EXTENSION}`);
  assert.equal(exported.mediaType, PROJECT_EXPORT_MEDIA_TYPE);
  assert.equal(Object.isFrozen(exported), true);
  const reopened = await importProjectFile({
    size: Buffer.byteLength(exported.text),
    async text() { return exported.text; }
  });
  assert.deepEqual(reopened, project);
});

test('project filenames are bounded and have a stable fallback', () => {
  assert.equal(projectFileStem('***'), 'project');
  assert.ok(projectFileStem('a'.repeat(500)).length <= 120);
});

test('packaged project export and browser file import use the bounded archive path', async () => {
  const project = createProject('Packaged project');
  const exported = createPackagedProjectExport(project);
  assert.equal(exported.fileName, `packaged-project${PROJECT_ARCHIVE_EXTENSION}`);
  assert.equal(exported.mediaType, PROJECT_ARCHIVE_MEDIA_TYPE);
  const reopened = await importProjectFile({
    name: exported.fileName,
    size: exported.data.byteLength,
    async text() { throw new Error('archive import must not read text directly'); },
    async arrayBuffer() { return exported.data.slice().buffer; }
  });
  assert.deepEqual(reopened, project);
});

test('project file import rejects malformed file handles and oversized input before reading', async () => {
  await assert.rejects(() => importProjectFile(/** @type {never} */ (null)), /file is invalid/i);
  let read = false;
  await assert.rejects(() => importProjectFile({
    size: MAX_BROWSER_IMPORT_BYTES + 1,
    async text() { read = true; return ''; }
  }), /exceeds/i);
  assert.equal(read, false);
});
