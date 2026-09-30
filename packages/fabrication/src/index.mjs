const KINDS = Object.freeze(['bom', 'gerber', 'drill', 'position']);
const MAX_ARTIFACTS = 4096;
const MAX_TEXT = 4096;
const MAX_SIZE = 268435456;
const SAFE_PATH = /^(?!\/)(?![A-Za-z]:[\\/])(?!.*(?:^|[\\/])\.{1,2}(?:[\\/]|$))[^\u0000-\u001F\u007F]+$/;
const text = (value, name, max = MAX_TEXT) => { if (typeof value !== 'string' || !value || value.length > max || [...value].some((character) => character < ' ' || character === '\u007f')) throw new TypeError(`${name} is invalid.`); return value; };
const path = (value, name) => { text(value, name); if (!SAFE_PATH.test(value)) throw new TypeError(`${name} must be a safe relative generated path.`); return value.replaceAll('\\', '/'); };

export const FABRICATION_KINDS = KINDS;

export function createFabricationManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Fabrication manifest is invalid.');
  text(input.boardPath, 'board path'); text(input.kicadVersion, 'KiCad version');
  if (!Array.isArray(input.artifacts) || input.artifacts.length > MAX_ARTIFACTS) throw new TypeError('Fabrication artifacts are invalid.');
  const artifacts = input.artifacts.map((artifact) => { if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new TypeError('Fabrication artifact is invalid.'); const kind = text(artifact.kind, 'artifact kind'); if (!KINDS.includes(kind)) throw new TypeError('Fabrication artifact kind is unsupported.'); const size = artifact.size; if (!Number.isInteger(size) || size < 0 || size > MAX_SIZE) throw new TypeError('Fabrication artifact size is invalid.'); if (typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new TypeError('Fabrication artifact hash is invalid.'); return Object.freeze({ ...artifact, kind, path: path(artifact.path, 'artifact path'), size }); });
  const byKind = new Map(artifacts.map((artifact) => [artifact.kind, artifact])); if (byKind.size !== artifacts.length) throw new TypeError('Fabrication artifact kinds must be unique.');
  const checks = { schematic: Boolean(input.checks?.schematic), pcb: Boolean(input.checks?.pcb), requiredOutputs: KINDS.every((kind) => byKind.has(kind)), hashes: artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)) };
  return Object.freeze({ format: 'openentc-fabrication-manifest', version: 1, boardPath: input.boardPath, kicadVersion: input.kicadVersion, generatedAt: input.generatedAt ?? null, artifacts: Object.freeze(artifacts), checks: Object.freeze(checks), complete: Object.values(checks).every(Boolean) });
}

export function fabricationChecklist(manifest) {
  const value = createFabricationManifest(manifest);
  return Object.freeze(KINDS.map((kind) => Object.freeze({ kind, present: value.artifacts.some((artifact) => artifact.kind === kind), validHash: value.artifacts.filter((artifact) => artifact.kind === kind).every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)) })));
}
