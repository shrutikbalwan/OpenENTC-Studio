import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/core/project.js';
import { createProjectArchive, importProjectArchive, PROJECT_ARCHIVE_ENTRY } from '../packages/project-model/src/archive.mjs';

test('project archive is deterministic and round-trips the canonical manifest', () => {
  const project = createProject('Archive fixture', '2026-09-28T00:00:00.000Z');
  const first = createProjectArchive(project);
  const second = createProjectArchive(project);
  assert.deepEqual(first, second);
  assert.equal(new DataView(first.buffer).getUint32(0, true), 0x04034b50);
  assert.match(new TextDecoder().decode(first), new RegExp(PROJECT_ARCHIVE_ENTRY.replace('.', '\\.')));
  assert.deepEqual(importProjectArchive(first), project);
});

test('project archive rejects corruption, unsupported flags, extra entries, and truncation', () => {
  const archive = createProjectArchive(createProject('Archive rejection fixture'));

  const corrupt = archive.slice();
  const nameLength = new DataView(corrupt.buffer).getUint16(26, true);
  corrupt[30 + nameLength] ^= 0xff;
  assert.throws(() => importProjectArchive(corrupt), /checksum/i);

  const encrypted = archive.slice();
  const encryptedView = new DataView(encrypted.buffer);
  const end = encrypted.byteLength - 22;
  const central = encryptedView.getUint32(end + 16, true);
  encryptedView.setUint16(6, 1, true);
  encryptedView.setUint16(central + 8, 1, true);
  assert.throws(() => importProjectArchive(encrypted), /encrypted|unsupported/i);

  const extraEntry = archive.slice();
  const extraView = new DataView(extraEntry.buffer);
  extraView.setUint16(extraEntry.byteLength - 22 + 8, 2, true);
  extraView.setUint16(extraEntry.byteLength - 22 + 10, 2, true);
  assert.throws(() => importProjectArchive(extraEntry), /exactly one/i);

  assert.throws(() => importProjectArchive(archive.subarray(0, archive.byteLength - 1)), /end record|invalid/i);
});
