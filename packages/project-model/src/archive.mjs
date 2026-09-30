// @ts-check

import { ProjectError, PROJECT_ERROR_CODES } from './errors.mjs';
import { exportProject, importProject, MAX_PROJECT_BYTES } from './browser.mjs';

/** @typedef {import('./types.d.ts').OpenEntcProject} OpenEntcProject */

export const PROJECT_ARCHIVE_ENTRY = 'openentc.project.json';
export const PROJECT_ARCHIVE_EXTENSION = '.entcproj';
export const PROJECT_ARCHIVE_MEDIA_TYPE = 'application/vnd.openentc.project+zip';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const UTF8 = new TextEncoder();
const ARCHIVE_NAME = UTF8.encode(PROJECT_ARCHIVE_ENTRY);
const MAX_ARCHIVE_CONTAINER_BYTES = MAX_PROJECT_BYTES + 65_536;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});

/** @param {Uint8Array} bytes */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ crc >>> 8;
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {ArrayBuffer | ArrayBufferView} input
 * @returns {Uint8Array}
 */
function asBytes(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, 'Project archive must be binary data.');
}

/** @param {boolean} condition @param {string} message */
function requireArchive(condition, message) {
  if (!condition) throw new ProjectError(PROJECT_ERROR_CODES.INVALID_SHAPE, message);
}

/**
 * Create a deterministic store-only ZIP package containing the canonical
 * project manifest. Store-only output keeps extraction bounds exact and does
 * not expose a decompression-bomb surface.
 * @param {OpenEntcProject} project
 */
export function createProjectArchive(project) {
  const data = UTF8.encode(exportProject(project));
  if (data.byteLength > MAX_PROJECT_BYTES) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project manifest exceeds the archive limit.');
  const checksum = crc32(data);
  const localSize = 30 + ARCHIVE_NAME.byteLength + data.byteLength;
  const centralSize = 46 + ARCHIVE_NAME.byteLength;
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);

  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0x21, true);
  view.setUint32(14, checksum, true);
  view.setUint32(18, data.byteLength, true);
  view.setUint32(22, data.byteLength, true);
  view.setUint16(26, ARCHIVE_NAME.byteLength, true);
  view.setUint16(28, 0, true);
  output.set(ARCHIVE_NAME, 30);
  output.set(data, 30 + ARCHIVE_NAME.byteLength);

  const central = localSize;
  view.setUint32(central, CENTRAL_SIGNATURE, true);
  view.setUint16(central + 4, 20, true);
  view.setUint16(central + 6, 20, true);
  view.setUint16(central + 8, 0, true);
  view.setUint16(central + 10, 0, true);
  view.setUint16(central + 12, 0, true);
  view.setUint16(central + 14, 0x21, true);
  view.setUint32(central + 16, checksum, true);
  view.setUint32(central + 20, data.byteLength, true);
  view.setUint32(central + 24, data.byteLength, true);
  view.setUint16(central + 28, ARCHIVE_NAME.byteLength, true);
  view.setUint16(central + 30, 0, true);
  view.setUint16(central + 32, 0, true);
  view.setUint16(central + 34, 0, true);
  view.setUint16(central + 36, 0, true);
  view.setUint32(central + 38, 0, true);
  view.setUint32(central + 42, 0, true);
  output.set(ARCHIVE_NAME, central + 46);

  const end = central + centralSize;
  view.setUint32(end, END_SIGNATURE, true);
  view.setUint16(end + 4, 0, true);
  view.setUint16(end + 6, 0, true);
  view.setUint16(end + 8, 1, true);
  view.setUint16(end + 10, 1, true);
  view.setUint32(end + 12, centralSize, true);
  view.setUint32(end + 16, central, true);
  view.setUint16(end + 20, 0, true);
  return output;
}

/**
 * Import the strict manifest-only `.entcproj` profile. Unsupported ZIP
 * features are rejected instead of being partially interpreted.
 * @param {ArrayBuffer | ArrayBufferView} input
 * @returns {OpenEntcProject}
 */
export function importProjectArchive(input) {
  const bytes = asBytes(input);
  requireArchive(bytes.byteLength >= 22, 'Project archive is truncated.');
  if (bytes.byteLength > MAX_ARCHIVE_CONTAINER_BYTES) throw new ProjectError(PROJECT_ERROR_CODES.TOO_LARGE, 'Project archive exceeds the allowed size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  requireArchive(view.getUint32(end, true) === END_SIGNATURE, 'Project archive end record is invalid.');
  requireArchive(view.getUint16(end + 4, true) === 0 && view.getUint16(end + 6, true) === 0, 'Multi-disk project archives are unsupported.');
  requireArchive(view.getUint16(end + 8, true) === 1 && view.getUint16(end + 10, true) === 1, 'Project archive must contain exactly one manifest.');
  requireArchive(view.getUint16(end + 20, true) === 0, 'Project archive comments are unsupported.');
  const centralSize = view.getUint32(end + 12, true);
  const central = view.getUint32(end + 16, true);
  requireArchive(central + centralSize === end && centralSize >= 46 + ARCHIVE_NAME.byteLength, 'Project archive directory bounds are invalid.');
  requireArchive(view.getUint32(central, true) === CENTRAL_SIGNATURE, 'Project archive directory is invalid.');
  const flags = view.getUint16(central + 8, true);
  const method = view.getUint16(central + 10, true);
  const checksum = view.getUint32(central + 16, true);
  const compressedSize = view.getUint32(central + 20, true);
  const uncompressedSize = view.getUint32(central + 24, true);
  const nameLength = view.getUint16(central + 28, true);
  const extraLength = view.getUint16(central + 30, true);
  const commentLength = view.getUint16(central + 32, true);
  const localOffset = view.getUint32(central + 42, true);
  requireArchive(flags === 0 && method === 0, 'Encrypted or compressed project archives are unsupported.');
  requireArchive(compressedSize === uncompressedSize && uncompressedSize <= MAX_PROJECT_BYTES, 'Project archive manifest size is invalid.');
  requireArchive(nameLength === ARCHIVE_NAME.byteLength && extraLength === 0 && commentLength === 0, 'Project archive entry metadata is unsupported.');
  requireArchive(localOffset === 0, 'Project archive manifest offset is invalid.');
  requireArchive(46 + nameLength === centralSize, 'Project archive contains unexpected directory data.');
  const centralName = bytes.subarray(central + 46, central + 46 + nameLength);
  requireArchive(centralName.every((byte, index) => byte === ARCHIVE_NAME[index]), 'Project archive manifest name is invalid.');

  requireArchive(view.getUint32(0, true) === LOCAL_SIGNATURE, 'Project archive local header is invalid.');
  requireArchive(view.getUint16(6, true) === flags && view.getUint16(8, true) === method, 'Project archive headers disagree.');
  requireArchive(view.getUint32(14, true) === checksum && view.getUint32(18, true) === compressedSize && view.getUint32(22, true) === uncompressedSize, 'Project archive manifest metadata is inconsistent.');
  requireArchive(view.getUint16(26, true) === nameLength && view.getUint16(28, true) === 0, 'Project archive local entry metadata is unsupported.');
  const localName = bytes.subarray(30, 30 + nameLength);
  requireArchive(localName.every((byte, index) => byte === ARCHIVE_NAME[index]), 'Project archive local manifest name is invalid.');
  const dataStart = 30 + nameLength;
  requireArchive(dataStart + compressedSize === central, 'Project archive manifest bounds are invalid.');
  const data = bytes.subarray(dataStart, dataStart + uncompressedSize);
  requireArchive(crc32(data) === checksum, 'Project archive manifest checksum is invalid.');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { throw new ProjectError(PROJECT_ERROR_CODES.INVALID_JSON, 'Project archive manifest is not valid UTF-8.'); }
  return importProject(text);
}
