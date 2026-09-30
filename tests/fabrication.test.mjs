import test from 'node:test';
import assert from 'node:assert/strict';
import { createFabricationManifest, fabricationChecklist } from '../packages/fabrication/src/index.mjs';

const hash = 'a'.repeat(64);
const artifacts = ['bom', 'gerber', 'drill', 'position'].map((kind) => ({ kind, path: `runs/fabrication/${kind}.out`, size: 12, sha256: hash }));

test('fabrication manifest records complete hashed output set and checklist', () => {
  const manifest = createFabricationManifest({ boardPath: 'design/board.kicad_pcb', kicadVersion: '9.0.0', checks: { schematic: true, pcb: true }, artifacts });
  assert.equal(manifest.complete, true);
  assert.deepEqual(fabricationChecklist(manifest).map((item) => item.present), [true, true, true, true]);
  assert.equal(manifest.checks.hashes, true);
});

test('fabrication manifest stays incomplete when required outputs or checks are absent', () => {
  const manifest = createFabricationManifest({ boardPath: 'design/board.kicad_pcb', kicadVersion: '9.0.0', checks: { schematic: true }, artifacts: [artifacts[1]] });
  assert.equal(manifest.complete, false);
  assert.equal(manifest.checks.requiredOutputs, false);
  assert.equal(fabricationChecklist(manifest).find((item) => item.kind === 'gerber').validHash, true);
});

test('fabrication manifest rejects unsafe paths, duplicate kinds, invalid hashes and unknown outputs', () => {
  for (const change of [
    { path: '../escape.out' },
    { sha256: 'bad' },
    { kind: 'unknown' }
  ]) assert.throws(() => createFabricationManifest({ boardPath: 'design/board.kicad_pcb', kicadVersion: '9.0.0', artifacts: [{ ...artifacts[0], ...change }] }));
  assert.throws(() => createFabricationManifest({ boardPath: 'design/board.kicad_pcb', kicadVersion: '9.0.0', artifacts: [artifacts[0], artifacts[0]] }), /unique/);
});
