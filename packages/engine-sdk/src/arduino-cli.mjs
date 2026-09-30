import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = ['version', 'board-inventory', 'core-inventory', 'library-inventory', 'compile', 'upload', 'monitor'];
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|[\\/])/;
const MAX_ENGINE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_BOARD_BYTES = 200;
const MAX_PORT_BYTES = 4096;
const MAX_PATH_BYTES = 32 * 1024;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

function boundedInventoryText(value, field, max = 200) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`Arduino CLI inventory ${field} is invalid or oversized.`);
  return value;
}

function inventoryArray(parsed, keys) {
  if (Array.isArray(parsed)) return parsed;
  for (const key of keys) if (Array.isArray(parsed?.[key])) return parsed[key];
  throw new TypeError('Arduino CLI inventory JSON does not contain the expected list.');
}

export function parseArduinoInventory(text, inventory) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_ENGINE_OUTPUT_BYTES) throw new TypeError('Arduino CLI inventory output is missing or exceeds the parser limit.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new TypeError('Arduino CLI inventory output is not valid JSON.'); }
  const keys = inventory === 'boards' ? ['boards'] : inventory === 'cores' ? ['platforms', 'cores'] : inventory === 'libraries' ? ['installed_libraries', 'libraries'] : null;
  if (!keys) throw new TypeError('Arduino CLI inventory kind is unsupported.');
  const entries = inventoryArray(parsed, keys);
  if (entries.length > 10_000) throw new TypeError('Arduino CLI inventory exceeds the item limit.');
  const items = entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Arduino CLI inventory contains a malformed item.');
    if (inventory === 'boards') {
      const name = boundedInventoryText(entry.name, 'board name'); const fqbn = boundedInventoryText(entry.fqbn, 'board FQBN');
      if (!name || !fqbn || !/^[A-Za-z0-9_.+-]+:[A-Za-z0-9_.+-]+:[A-Za-z0-9_.:+-]+$/.test(fqbn)) throw new TypeError('Arduino CLI board inventory contains an invalid board.');
      return Object.freeze({ name, fqbn });
    }
    if (inventory === 'cores') {
      const id = boundedInventoryText(entry.id || entry.platform, 'core id'); const name = boundedInventoryText(entry.name || id, 'core name');
      if (!id || !name || !/^[A-Za-z0-9_.+-]+:[A-Za-z0-9_.+-]+$/.test(id)) throw new TypeError('Arduino CLI core inventory contains an invalid core.');
      return Object.freeze({ id, name, installedVersion: boundedInventoryText(entry.installed_version || entry.installed, 'installed version', 100), latestVersion: boundedInventoryText(entry.latest_version || entry.latest, 'latest version', 100) });
    }
    const library = entry.library && typeof entry.library === 'object' ? entry.library : entry;
    const release = entry.release && typeof entry.release === 'object' ? entry.release : {};
    const name = boundedInventoryText(library.name || release.name, 'library name');
    if (!name) throw new TypeError('Arduino CLI library inventory contains an invalid library.');
    return Object.freeze({ name, version: boundedInventoryText(library.version || release.version, 'library version', 100), location: boundedInventoryText(library.location || entry.location, 'library location', MAX_PATH_BYTES) });
  });
  items.sort((left, right) => String(left.fqbn || left.id || left.name).localeCompare(String(right.fqbn || right.id || right.name)));
  return Object.freeze({ kind: 'arduino-inventory', inventory, items: Object.freeze(items) });
}

export function parseArduinoCliVersion(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > 64 * 1024) throw new TypeError('Arduino CLI version output is missing or exceeds the parser limit.');
  const match = text.match(/arduino-cli\s+(?:Version:\s*)?v?(\d+(?:\.\d+){1,2}(?:[-+][A-Za-z0-9.-]+)?)/i);
  if (!match) throw new TypeError('Arduino CLI version output is not recognized.');
  return match[1];
}

export function parseArduinoDiagnostics(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_ENGINE_OUTPUT_BYTES) throw new TypeError('Arduino CLI output is missing or exceeds the parser limit.');
  const diagnostics = [];
  const memory = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/i);
    if (match) diagnostics.push(createDiagnostic({ severity: match[4].toLowerCase(), code: match[4].toLowerCase() === 'error' ? 'FIRMWARE_COMPILE_ERROR' : 'FIRMWARE_COMPILE_WARNING', message: match[5].trim(), source: match[1], line: Number(match[2]), column: Number(match[3]) }));
    const flash = line.match(/Sketch uses\s+(\d+)\s+bytes.*maximum is\s+(\d+)/i);
    if (flash) memory.flash = { used: Number(flash[1]), capacity: Number(flash[2]) };
    const ram = line.match(/Global variables use\s+(\d+)\s+bytes.*maximum is\s+(\d+)/i);
    if (ram) memory.ram = { used: Number(ram[1]), capacity: Number(ram[2]) };
  }
  return Object.freeze({ kind: 'firmware-build-report', diagnostics, memory });
}

function validateJob(job, permissionPolicy = null) {
  if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`Arduino CLI operation is unsupported: ${job?.operation || 'missing'}.`);
  if (['compile', 'upload'].includes(job.operation) && (typeof job.board !== 'string' || !job.board.trim() || job.board.length > MAX_BOARD_BYTES || /[\u0000-\u001f\u007f]/.test(job.board))) throw new TypeError('Arduino compile/upload jobs require a bounded board FQBN (explicit board FQBN required).');
  if (['upload', 'monitor'].includes(job.operation) && (typeof job.port !== 'string' || !job.port.trim() || job.port.length > MAX_PORT_BYTES || /[\u0000-\u001f\u007f]/.test(job.port))) throw new TypeError('Arduino upload/monitor jobs require a bounded explicit port.');
  if (['compile', 'upload'].includes(job.operation) && (typeof job.sketchPath !== 'string' || job.sketchPath.length > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(job.sketchPath) || !ABSOLUTE_PATH.test(job.sketchPath))) throw new TypeError('Arduino compile/upload jobs require a bounded absolute approved sketch path.');
  if (job.buildPath !== undefined && (typeof job.buildPath !== 'string' || job.buildPath.length > MAX_PATH_BYTES || /[\u0000-\u001f\u007f]/.test(job.buildPath) || !ABSOLUTE_PATH.test(job.buildPath))) throw new TypeError('Arduino build output requires a bounded absolute project path.');
  if (job.baud !== undefined && (!Number.isInteger(job.baud) || job.baud < 1 || job.baud > 1_000_000)) throw new TypeError('Arduino monitor baud must be a bounded positive integer.');
  if (job.operation === 'upload') {
    if (!permissionPolicy) throw Object.assign(new Error('Arduino upload requires an explicit programmer permission grant.'), { code: 'DEVICE_PERMISSION_REQUIRED' });
    permissionPolicy.assertGranted('programmer', job.port);
  }
  if (job.operation === 'monitor') {
    if (!permissionPolicy) throw Object.assign(new Error('Arduino monitor requires an explicit serial permission grant.'), { code: 'DEVICE_PERMISSION_REQUIRED' });
    permissionPolicy.assertGranted('serial', job.port);
  }
  return true;
}

export function createArduinoCliAdapter({ executable = null, runner = null, permissionPolicy = null } = {}) {
  let prepared = null;
  let lastRun = null;
  let activeController = null;
  let cancelRequested = false;
  let running = false;
  return {
    metadata: () => ({ id: 'arduino-cli', name: 'Arduino CLI', license: 'GPL-3.0-only', integration: 'process', sourceUrl: 'https://github.com/arduino/arduino-cli' }),
    detect: async () => probeExecutable({ id: 'arduino-cli', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const configured = Boolean(executable && runner); return { ok: configured, available: configured, evidence: 'adapter-validation-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: (job) => validateJob(job, permissionPolicy),
    prepare: async (job) => {
      validateJob(job, permissionPolicy);
      const build = job.buildPath ? ['--build-path', job.buildPath] : [];
      const args = job.operation === 'compile' ? ['compile', '--fqbn', job.board, ...build, job.sketchPath]
        : job.operation === 'upload' ? ['upload', '-p', job.port, '--fqbn', job.board, ...(job.buildPath ? ['--input-dir', job.buildPath] : []), job.sketchPath]
          : job.operation === 'monitor' ? ['monitor', '-p', job.port, ...(job.baud ? ['-c', `${job.baud}`] : [])]
            : job.operation === 'board-inventory' ? ['board', 'listall', '--json']
              : job.operation === 'core-inventory' ? ['core', 'list', '--json']
                : job.operation === 'library-inventory' ? ['lib', 'list', '--json'] : ['version'];
      prepared = { arguments: args };
      return prepared;
    },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('Arduino CLI is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable);
      if (running) throw Object.assign(new Error('Arduino CLI adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true;
      cancelRequested = false;
      activeController = new AbortController();
      eventSink({ phase: 'running' });
      try {
        lastRun = await runner({ executable, args: prepared?.arguments || [], shell: false, signal: activeController.signal });
      } catch (error) {
        if (cancelRequested || activeController.signal.aborted) throw Object.assign(new Error('Arduino CLI job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error });
        throw error;
      } finally {
        activeController = null;
        running = false;
      }
      if (cancelRequested) throw Object.assign(new Error('Arduino CLI job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'Arduino CLI failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async (job) => job.operation === 'board-inventory' ? parseArduinoInventory(lastRun?.stdout || '', 'boards') : job.operation === 'core-inventory' ? parseArduinoInventory(lastRun?.stdout || '', 'cores') : job.operation === 'library-inventory' ? parseArduinoInventory(lastRun?.stdout || '', 'libraries') : job.operation === 'version' ? Object.freeze({ kind: 'engine-version', version: parseArduinoCliVersion(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`) }) : parseArduinoDiagnostics(`${lastRun?.stdout || ''}\n${lastRun?.stderr || ''}`),
    cancel: async () => { cancelRequested = true; activeController?.abort(); },
    clean: async () => { prepared = null; lastRun = null; activeController = null; }
  };
}
