import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import { createProject, validateProject } from '../src/core/project.js';
import { engines } from '../src/core/engine-registry.js';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(await readFile(resolve(root, 'capabilities/ledger.json'), 'utf8'));
const project = validateProject(createProject('Type contract fixture'));
const storeDeclarations = await readFile(resolve(root, 'src/core/store.d.ts'), 'utf8');
const projectDeclarations = await readFile(resolve(root, 'src/core/project.d.ts'), 'utf8');

assert.equal(project.format, 'openentc-project');
assert.ok(Number.isInteger(project.version));
assert.ok(Array.isArray(project.circuit.components));
assert.ok(Array.isArray(ledger.capabilities));
assert.ok(engines.every((engine) => typeof engine.id === 'string' && typeof engine.status === 'string'));
assert.match(storeDeclarations, /recordExperiment/);
assert.match(projectDeclarations, /upsertExperiment/);

const configPath = resolve(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = config.error
  ? { errors: [config.error], fileNames: [], options: {} }
  : ts.parseJsonConfigFileContent(config.config, ts.sys, root, { noEmit: true }, configPath);
const program = parsed.errors.length
  ? undefined
  : ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
const diagnostics = [...parsed.errors, ...(program ? ts.getPreEmitDiagnostics(program) : [])];

if (diagnostics.length) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => ts.sys.newLine
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  process.exit(1);
}

console.log(`Strict TypeScript compiler check passed for ${parsed.fileNames.length} files.`);
