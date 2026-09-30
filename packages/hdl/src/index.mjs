const MAX_TEXT_BYTES = 20 * 1024 * 1024;
const MAX_SIGNALS = 4096;
const MAX_SAMPLES = 1_000_000;
const MAX_SOURCE_SETS = 128;
const MAX_SOURCES_PER_SET = 4096;
const MAX_CONSTRAINTS = 4096;
const MAX_TARGETS = 128;
const MAX_PATH_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 200;

function boundedText(value, name, max = MAX_IDENTIFIER_LENGTH) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || [...value].some((character) => character < ' ' || character === '\u007f')) throw new TypeError(`${name} is invalid.`);
  return value;
}

function authoredPath(value, name) {
  boundedText(value, name, MAX_PATH_LENGTH);
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(value) || value.split(/[\\/]/).some((segment) => !segment || segment === '.' || segment === '..')) throw new TypeError(`${name} must be a confined authored path.`);
  return value.replaceAll('\\', '/');
}

function boundedEntries(value, name, max) {
  if (!Array.isArray(value) || value.length > max) throw new TypeError(`${name} is invalid.`);
  return value;
}

export const HDL_PROJECT_FORMAT = 'openentc-hdl-project';
export const HDL_PROJECT_VERSION = 1;
export const HDL_OPERATIONS = Object.freeze(['simulate', 'synthesize', 'place-route']);

export function createHdlProject(name = 'HDL design') {
  return validateHdlProject({
    format: HDL_PROJECT_FORMAT,
    version: HDL_PROJECT_VERSION,
    name,
    sourceSets: [],
    topUnit: null,
    constraints: [],
    targets: []
  });
}

export function validateHdlProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('HDL project is invalid.');
  if (input.format !== HDL_PROJECT_FORMAT || input.version !== HDL_PROJECT_VERSION) throw new TypeError('HDL project format or version is unsupported.');
  boundedText(input.name, 'HDL project name');
  if (input.topUnit !== null) boundedText(input.topUnit, 'HDL top unit');
  const sourceSets = boundedEntries(input.sourceSets, 'HDL source sets', MAX_SOURCE_SETS).map((sourceSet) => {
    if (!sourceSet || typeof sourceSet !== 'object' || Array.isArray(sourceSet)) throw new TypeError('HDL source set is invalid.');
    boundedText(sourceSet.id, 'HDL source-set id');
    const language = boundedText(sourceSet.language, 'HDL source-set language');
    if (!['verilog', 'systemverilog', 'vhdl'].includes(language)) throw new TypeError('HDL source-set language is unsupported.');
    const sources = boundedEntries(sourceSet.sources, 'HDL sources', MAX_SOURCES_PER_SET).map((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('HDL source is invalid.');
      const kind = boundedText(source.kind, 'HDL source kind');
      if (!['source', 'testbench'].includes(kind)) throw new TypeError('HDL source kind is unsupported.');
      return { ...source, path: authoredPath(source.path, 'HDL source path'), kind };
    });
    const ids = new Set(sources.map((source) => source.path));
    if (ids.size !== sources.length) throw new TypeError('HDL source paths must be unique within a source set.');
    return { ...sourceSet, id: sourceSet.id, language, sources };
  });
  const constraints = boundedEntries(input.constraints, 'HDL constraints', MAX_CONSTRAINTS).map((constraint) => {
    if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) throw new TypeError('HDL constraint is invalid.');
    boundedText(constraint.id, 'HDL constraint id');
    return { ...constraint, id: constraint.id, path: authoredPath(constraint.path, 'HDL constraint path') };
  });
  const targets = boundedEntries(input.targets, 'HDL targets', MAX_TARGETS).map((target) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) throw new TypeError('HDL target is invalid.');
    boundedText(target.id, 'HDL target id');
    const family = boundedText(target.family, 'HDL target family');
    if (!['generic', 'ice40'].includes(family)) throw new TypeError('HDL target family is unsupported.');
    if (target.device !== undefined) boundedText(target.device, 'HDL target device');
    return { ...target, id: target.id, family };
  });
  const ids = [...sourceSets, ...constraints, ...targets].map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('HDL document identifiers must be unique.');
  return Object.freeze({ ...input, sourceSets: Object.freeze(sourceSets.map((sourceSet) => Object.freeze({ ...sourceSet, sources: Object.freeze(sourceSet.sources.map((source) => Object.freeze(source))) }))), constraints: Object.freeze(constraints.map((constraint) => Object.freeze(constraint))), targets: Object.freeze(targets.map((target) => Object.freeze(target))) });
}

export function createHdlJob(document, operation, targetId = null) {
  const project = validateHdlProject(document);
  boundedText(operation, 'HDL operation');
  if (!HDL_OPERATIONS.includes(operation)) throw new TypeError('HDL operation is unsupported.');
  if (targetId !== null) boundedText(targetId, 'HDL target id');
  if (operation === 'place-route' && !targetId) throw new TypeError('HDL place-route requires an explicit target.');
  if (targetId && !project.targets.some((target) => target.id === targetId)) throw new TypeError('HDL target is not declared.');
  return Object.freeze({ operation, targetId, project: project.name, sourceSets: project.sourceSets.map((sourceSet) => sourceSet.id), constraints: project.constraints.map((constraint) => constraint.id) });
}

export function parseVcd(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_TEXT_BYTES) throw new TypeError('VCD input is missing or exceeds the size limit.');
  let timescale = null; let currentTime = 0; let inDefinitions = true; let samples = 0;
  const signals = []; const signalsById = new Map(); const scopes = [];
  const normalizedText = text.replace(/\$timescale\s+([^\s]+)\s+([^\s]+)\s+\$end/g, '$timescale $1 $2 $end');
  for (const raw of normalizedText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('$timescale')) { const match = line.match(/^\$timescale\s+([^\s]+)\s+([^\s]+)\s+\$end$/); if (!match) throw new TypeError('VCD timescale is malformed.'); timescale = `${match[1]} ${match[2]}`; continue; }
    if (line.startsWith('$scope')) { const match = line.match(/^\$scope\s+\S+\s+(\S+)\s+\$end$/); if (!match) throw new TypeError('VCD scope is malformed.'); scopes.push(match[1]); continue; }
    if (line === '$upscope $end') { if (!scopes.length) throw new TypeError('VCD scope nesting is malformed.'); scopes.pop(); continue; }
    if (line.startsWith('$var')) {
      const match = line.match(/^\$var\s+\S+\s+(\d+)\s+(\S+)\s+(\S+)\s+\$end$/); const width = Number(match?.[1]); if (!match || !Number.isInteger(width) || width < 1 || width > 4096) throw new TypeError('VCD signal width is invalid or unsupported.');
      if (signals.length >= MAX_SIGNALS) throw new RangeError('VCD signal count exceeds the limit.');
      const scope = scopes.join('.'); const signal = { id: match[2], name: match[3], fullName: [...scopes, match[3]].join('.'), scope, width, samples: [] };
      signals.push(signal); signalsById.set(match[2], [...(signalsById.get(match[2]) || []), signal]); continue;
    }
    if (line === '$enddefinitions $end') { if (scopes.length) throw new TypeError('VCD scope nesting is incomplete.'); inDefinitions = false; continue; }
    if (line.startsWith('#')) { const nextTime = Number(line.slice(1)); if (!Number.isSafeInteger(nextTime) || nextTime < currentTime) throw new TypeError('VCD timestamp is invalid or out of order.'); currentTime = nextTime; continue; }
    if (!inDefinitions && /^[01xzXZ]\S+$/.test(line)) {
      const targets = signalsById.get(line.slice(1)); if (!targets) throw new TypeError('VCD value references an unknown identifier.');
      if (targets.some((signal) => signal.width !== 1)) throw new TypeError('Scalar VCD value cannot update a vector signal.');
      const value = line[0].toLowerCase(); for (const signal of targets) { signal.samples.push(Object.freeze({ time: currentTime, value })); samples += 1; }
      if (samples > MAX_SAMPLES) throw new RangeError('VCD sample count exceeds the limit.');
      continue;
    }
    if (!inDefinitions && /^[bB][01xzXZ]+\s+\S+$/.test(line)) {
      const match = line.match(/^[bB]([01xzXZ]+)\s+(\S+)$/); const targets = signalsById.get(match[2]); if (!targets) throw new TypeError('VCD vector value references an unknown identifier.');
      if (targets.some((signal) => match[1].length > signal.width)) throw new TypeError('VCD vector value exceeds the declared signal width.');
      for (const signal of targets) { signal.samples.push(Object.freeze({ time: currentTime, value: match[1].toLowerCase().padStart(signal.width, match[1][0].toLowerCase() === '1' ? '0' : match[1][0].toLowerCase()) })); samples += 1; }
      if (samples > MAX_SAMPLES) throw new RangeError('VCD sample count exceeds the limit.');
    }
  }
  if (!timescale || inDefinitions || !signals.length) throw new TypeError('VCD definitions are incomplete.');
  return Object.freeze({ kind: 'digital-trace', timescale, signals: Object.freeze(signals.map((signal) => Object.freeze({ ...signal, samples: Object.freeze(signal.samples) }))) });
}
