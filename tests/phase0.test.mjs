import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engines } from '../src/core/engine-registry.js';
import { createProject, serializeProject, validateProject } from '../src/core/project.js';
import { simulateDC } from '../src/engines/circuit-engine.js';
import { runVerification } from '../scripts/verify-lib.mjs';
import { rootFromModuleUrl } from '../scripts/server-path.mjs';
import { readUiSource } from './helpers/ui-source.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ledger = JSON.parse(await readFile(resolve(root, 'capabilities/ledger.json'), 'utf8'));
const verificationLedger = JSON.parse(await readFile(resolve(root, 'capabilities/verification.json'), 'utf8'));
const allowedStates = new Set(['built-in', 'integrated', 'interoperable', 'unavailable', 'unsupported']);

test('capability ledger has unique evidence-backed entries and honest states', async () => {
  const schema = JSON.parse(await readFile(resolve(root, 'capabilities/ledger.schema.json'), 'utf8'));
  assert.deepEqual(ledger.states, schema.properties.states.const);
  assert.deepEqual(ledger.states, [...allowedStates]);
  const ids = new Set();
  for (const capability of ledger.capabilities) {
    assert.ok(allowedStates.has(capability.state), `${capability.id} has an invalid state`);
    assert.ok(!ids.has(capability.id), `${capability.id} is duplicated`);
    ids.add(capability.id);
    assert.ok(capability.limitations.length > 0);
    for (const item of capability.evidence) {
      const path = item.split('#')[0];
      await access(resolve(root, path));
    }
  }
});

test('hardware-free verification ledger uses explicit independent evidence states', async () => {
  const schema = JSON.parse(await readFile(resolve(root, 'capabilities/verification.schema.json'), 'utf8'));
  assert.deepEqual(verificationLedger.statuses, schema.properties.statuses.const);
  assert.equal(verificationLedger.auditedAt, '2026-09-29');
  const ids = new Set();
  for (const capability of verificationLedger.capabilities) {
    assert.ok(!ids.has(capability.id), `${capability.id} is duplicated`);
    ids.add(capability.id);
    assert.ok(capability.software === null || capability.software === 'software-verified');
    assert.ok(capability.emulator === null || capability.emulator === 'emulator-verified');
    assert.ok(capability.hardware === null || capability.hardware === 'hardware-unverified' || capability.hardware === 'hardware-verified');
    assert.ok(capability.evidence.length > 0);
    for (const evidence of capability.evidence) await access(resolve(root, evidence.split('#')[0]));
  }
  const ngspice = verificationLedger.capabilities.find((entry) => entry.id === 'engine.ngspice');
  assert.equal(ngspice.software, 'software-verified');
  assert.equal(ngspice.hardware, 'hardware-unverified');
});

test('no external engine is represented as installed without detection evidence', () => {
  assert.equal(engines.find((engine) => engine.id === 'builtin-dc').status, 'built-in');
  for (const engine of engines.filter((entry) => entry.id !== 'builtin-dc')) {
    assert.ok(['unavailable', 'unsupported'].includes(engine.status), `${engine.id} is ${engine.status}`);
  }
});

test('toolchain UI distinguishes disabled and incompatible detection states', async () => {
  const source = readUiSource();
  const registry = await readFile(resolve(root, 'src/core/engine-registry.js'), 'utf8');
  assert.match(source, /state === 'invalid' \? 'Incompatible'/);
  assert.match(source, /engine\.disabled \? 'Disabled'/);
  assert.match(source, /statusClass = \(engine\) =>[\s\S]*'incompatible'/);
  assert.match(registry, /disabled: true/);
});

test('unimplemented primary workflows are disabled instead of reporting fake success', async () => {
  const source = readUiSource();
  assert.doesNotMatch(source, /data-action="run-module"/);
  assert.doesNotMatch(source, /data-action="build-code"/);
  assert.doesNotMatch(source, /data-action="connect-device"/);
  assert.match(source, /button class="button primary wide" disabled>Unavailable in this alpha/);
  assert.match(source, /data-action="upload-arduino"/);
  assert.match(source, /data-action="save-local"/);
  assert.match(source, /saveBrowserProject/);
});

test('every literal data-action control has a corresponding DOM binding', async () => {
  const source = readUiSource();
  const rendered = new Set([...source.matchAll(/data-action="([a-z0-9-]+)"/g)].map((match) => match[1]));
  const bound = new Set([...source.matchAll(/querySelector(?:All)?\('\[data-action="([a-z0-9-]+)"\]/g)].map((match) => match[1]));
  const unbound = [...rendered].filter((action) => !bound.has(action));
  assert.deepEqual(unbound, [], `literal actions without handlers: ${unbound.join(', ')}`);
});

test('verification returns nonzero and stops after a failing step', () => {
  const calls = [];
  const status = runVerification([
    ['first', ['run', 'first']],
    ['failure', ['run', 'failure']],
    ['must not run', ['run', 'last']]
  ], (_command, args) => {
    calls.push(args.at(-1));
    return { status: args.at(-1) === 'failure' ? 7 : 0 };
  });
  assert.equal(status, 7);
  assert.deepEqual(calls, ['first', 'failure']);
});

test('verification returns nonzero when a step cannot start', () => {
  const status = runVerification([['missing', ['run', 'missing']]], () => ({ error: new Error('not found') }));
  assert.equal(status, 1);
});

test('verification includes the isolated Python worker syntax gate', async () => {
  const source = await readFile(new URL('../scripts/verify-lib.mjs', import.meta.url), 'utf8');
  assert.match(source, /python worker/);
  assert.match(await readFile(new URL('../package.json', import.meta.url), 'utf8'), /worker:check/);
});

test('strict TypeScript configuration and model contract are published', async () => {
  const config = JSON.parse(await readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'));
  const model = await readFile(new URL('../packages/project-model/src/model.ts', import.meta.url), 'utf8');
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.noEmit, true);
  for (const typedBoundary of ['src/core/project.js', 'src/core/project-storage.js', 'src/core/project-file.js', 'src/core/store.js']) {
    assert.ok(config.include.includes(typedBoundary), `${typedBoundary} must remain in the strict compiler surface`);
    assert.match(await readFile(new URL(`../${typedBoundary}`, import.meta.url), 'utf8'), /^\/\/ @ts-check/);
  }
  assert.match(model, /export interface OpenEntcProject/);
  assert.match(model, /isOpenEntcProject/);
  assert.match(model, /Array\.isArray\(project\.circuit\?\.junctions\)/);
  assert.match(model, /project\.settings\?\.gridSize/);
  const project = await readFile(new URL('../src/core/project.d.ts', import.meta.url), 'utf8');
  assert.match(project, /export declare function migrateProject/);
  assert.match(project, /OpenEntcProject/);
  const store = await readFile(new URL('../src/core/store.d.ts', import.meta.url), 'utf8');
  assert.match(store, /artifactPermissionGranted/);
  assert.match(store, /undoProject/);
  assert.match(store, /recordLearningAttempt/);
  const packageTypes = await readFile(new URL('../packages/project-model/src/types.d.ts', import.meta.url), 'utf8');
  assert.match(packageTypes, /export interface ProjectSettings/);
  assert.match(packageTypes, /settings: ProjectSettings/);
  const typecheck = await readFile(new URL('../scripts/typecheck.mjs', import.meta.url), 'utf8');
  assert.match(typecheck, /import ts from 'typescript'/);
  assert.match(typecheck, /ts\.getPreEmitDiagnostics/);
  assert.doesNotMatch(typecheck, /compiler is unavailable|spawnSync\('tsc'/);
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.devDependencies.typescript, /^\d+\.\d+\.\d+$/);
});

test('engine SDK runtime and declaration exports stay aligned', async () => {
  const runtime = await readFile(resolve(root, 'packages/engine-sdk/src/index.mjs'), 'utf8');
  const declarations = await readFile(resolve(root, 'packages/engine-sdk/src/types.d.ts'), 'utf8');
  for (const adapter of ['Verilator', 'Ghdl', 'Yosys', 'QucsatorRf', 'Tshark', 'PlatformIo', 'Renode']) {
    assert.match(runtime, new RegExp(`create${adapter}Adapter`));
    assert.match(declarations, new RegExp(`create${adapter}Adapter`));
  }
});

test('Circuit Lab wires keyboard movement to the immutable editing command', async () => {
  const source = readUiSource();
  assert.match(source, /moveComponents/);
  assert.match(source, /arrowleft.*arrowright.*arrowup.*arrowdown/);
  assert.match(source, /moveSelected\(/);
  assert.match(source, /aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"/);
  assert.match(source, /let moved = false/);
  assert.match(source, /if \(!moved\) return/);
});

test('browser state and storage declaration contracts are published', async () => {
  const store = await readFile(new URL('../src/core/store.d.ts', import.meta.url), 'utf8');
  const storage = await readFile(new URL('../src/core/project-storage.d.ts', import.meta.url), 'utf8');
  assert.match(store, /export interface AppState/);
  assert.match(store, /PersistenceStatus/);
  assert.match(store, /recordExperiment/);
  assert.match(store, /saveProject/);
  assert.match(storage, /StoredProjectResult/);
});

test('project serialization preserves authored circuit and firmware data', () => {
  const original = createProject('Persistence fixture');
  original.circuit.components[1].value = 4321;
  original.embedded.code = 'void setup() {}\nvoid loop() {}';
  const reopened = validateProject(JSON.parse(serializeProject(original)));
  assert.deepEqual(reopened.circuit, original.circuit);
  assert.deepEqual(reopened.embedded, original.embedded);
  assert.equal(reopened.name, original.name);
});

test('limited DC solver rejects non-positive resistance', () => {
  const project = createProject('Invalid resistance');
  project.circuit.components.find((part) => part.type === 'resistor').value = 0;
  assert.throws(() => simulateDC(project.circuit.components), /greater than zero/);
});

test('development server decodes spaces in its filesystem root', () => {
  const path = rootFromModuleUrl('file:///E:/OpenENTC%20Studio/openentc-studio/scripts/server.mjs');
  assert.match(path, /OpenENTC Studio/);
  assert.doesNotMatch(path, /%20/);
});

test('development server serves browser-imported modules with executable MIME', async () => {
  const source = await readFile(resolve(root, 'scripts/server.mjs'), 'utf8');
  assert.match(source, /'\.mjs': 'text\/javascript; charset=utf-8'/);
});

test('development server uses canonical relative containment instead of string-prefix checks', async () => {
  const source = await readFile(resolve(root, 'scripts/server.mjs'), 'utf8');
  assert.match(source, /realpath/);
  assert.match(source, /relative\(root, candidate\)/);
  assert.match(source, /resolvedRelative\.startsWith\('\.\.'\)/);
  assert.doesNotMatch(source, /startsWith\(normalize\(root\)\)/);
});

test('browser build emits a verifiable sorted hash manifest', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'dist/BUILD-MANIFEST.json'), 'utf8'));
  assert.equal(manifest.format, 'openentc-build-manifest');
  assert.equal(manifest.version, 1);
  assert.ok(manifest.files.length > 0);
  const paths = manifest.files.map((entry) => entry.path);
  assert.deepEqual(paths, [...paths].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
  for (const entry of manifest.files) {
    const bytes = await readFile(resolve(root, 'dist', entry.path));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
});

test('browser build ships every module statically imported by the application entry point', async () => {
  const dist = resolve(root, 'dist');
  const pending = [resolve(dist, 'src/app.js')];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8').catch(() => assert.fail(`dist is missing ${file.slice(dist.length + 1)}`));
    for (const [, specifier] of source.matchAll(/^\s*(?:import|export)\s[^;]*?\bfrom\s+'([^']+)'/gm)) {
      if (specifier.startsWith('.')) pending.push(resolve(file, '..', specifier));
    }
  }
  assert.ok(seen.has(resolve(dist, 'packages/schematic/src/index.mjs')));
});

test('browser build metadata uses the authoritative package version', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(resolve(root, 'dist/BUILD-METADATA.json'), 'utf8'));
  assert.equal(metadata.version, packageJson.version);
  assert.equal(metadata.nativeDesktop, false);
});

test('browser build emits an SPDX SBOM without claiming bundled external engines', async () => {
  const sbom = JSON.parse(await readFile(resolve(root, 'dist/BUILD-SBOM.spdx.json'), 'utf8'));
  assert.equal(sbom.spdxVersion, 'SPDX-2.3');
  assert.equal(sbom.packages[0].licenseDeclared, 'GPL-3.0-or-later');
  assert.match(sbom.annotations[0].comment, /not bundled/);
  assert.ok(sbom.relationships.some((relationship) => relationship.relationshipType === 'DESCRIBES'));
});

test('browser build carries license and third-party notice files', async () => {
  const license = await readFile(resolve(root, 'dist/LICENSE'), 'utf8');
  const notices = await readFile(resolve(root, 'dist/THIRD-PARTY-NOTICES.txt'), 'utf8');
  assert.match(license, /GNU GENERAL PUBLIC LICENSE|GPL/i);
  assert.match(notices, /No third-party engine binaries or libraries are bundled/);
});

test('browser styles honor prefers-reduced-motion', async () => {
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /animation-duration:\s*0\.001ms/);
  assert.match(styles, /scroll-behavior:\s*auto/);
});

test('browser styles preserve visible keyboard focus for styled controls', async () => {
  const styles = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  assert.match(styles, /focus-visible/);
  assert.match(styles, /project-title input:focus-visible/);
  assert.match(styles, /outline:2px solid var\(--teal\)/);
});

test('browser icon controls expose explicit accessible names', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="command"[^>]+aria-label="Open command palette"/);
  assert.match(source, /data-action="theme"[^>]+aria-label="Change color theme"/);
});

test('shared modal helper traps focus and restores the invoking control', async () => {
  const source = readUiSource();
  assert.match(source, /aria-modal="true" aria-labelledby="modal-title"/);
  assert.match(source, /previousFocus = (?:\/\*\* @type \{[^}]+\} \*\/ \()?document\.activeElement/, 'the invoking control is remembered');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /previousFocus\.focus\(\)/);
});

test('toast notifications expose explicit status roles and live politeness', async () => {
  const source = readUiSource();
  assert.match(source, /role="\$\{state\.toast\.tone === 'error' \? 'alert' : 'status'\}"/);
  assert.match(source, /aria-live="\$\{state\.toast\.tone === 'error' \? 'assertive' : 'polite'\}"/);
});

test('application root is not a broad live region', async () => {
  const source = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.match(source, /<div id="app"><\/div>/);
  assert.doesNotMatch(source, /id="app"[^>]+aria-live/);
});

test('browser build emits conventional SHA256SUMS derived from its manifest', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'dist/BUILD-MANIFEST.json'), 'utf8'));
  const checksums = (await readFile(resolve(root, 'dist/SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/);
  assert.deepEqual(checksums, manifest.files.map((entry) => `${entry.sha256}  ${entry.path}`));
});

test('Circuit Lab exposes keyboard-focusable canvas terminals for real wire editing', async () => {
  const source = readUiSource();
  assert.match(source, /data-canvas-node/);
  assert.match(source, /chooseWireNode\(pin\.dataset\.canvasNode\)/);
});

test('Circuit Lab renders persisted component rotation on the canvas', async () => {
  const source = await readFile(resolve(root, 'src/styles.css'), 'utf8');
  assert.match(source, /\.circuit-part\s*\{[^}]*rotate\(var\(--part-rotation/);
  assert.match(readUiSource(), /--part-rotation/);
});

test('Circuit Lab authors bounded net labels and junction markers through the project model', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="add-net-label"/);
  assert.match(source, /data-action="add-junction"/);
  assert.match(source, /project\.circuit\.netLabels\.push/);
  assert.match(source, /project\.circuit\.junctions\.push/);
  assert.match(source, /renderWires\(parts, state\.project\.circuit\.wires, state\.project\.circuit\.netLabels, state\.project\.circuit\.junctions\)/);
  assert.match(source, /nodeFields\(part\)\.map\(\(field\) => part\[field\]\)\.filter\(Boolean\)\.map\(\(node\) => normalizeNode\(node\)\)/);
  assert.match(source, /bindAuthoredMarkerEvents/);
  assert.match(source, /removeNetLabel/);
  assert.match(source, /removeJunction/);
});

test('Circuit Lab renders ERC source and fix context beside diagnostics', async () => {
  const source = readUiSource();
  assert.match(source, /Source: \$\{esc\(location\)\}/);
  assert.match(source, /Fix: \$\{esc\(diagnostic\.fix\)\}/);
  assert.match(source, /data-diagnostic-component/);
  assert.match(source, /data-diagnostic-pin/);
  assert.match(source, /buildErcCanvasIssues/);
  assert.match(source, /aria-invalid="true"/);
  assert.match(source, /selectComponent\(id\)/);
});

test('Circuit Lab palette exposes the Phase 3 source and switch component types', async () => {
  // The palette is built from the schematic package's component definitions (src/data/modules.js).
  assert.match(await readFile(resolve(root, 'src/data/modules.js'), 'utf8'), /componentPalette = COMPONENT_DEFINITIONS\.map/);
  const source = await readFile(resolve(root, 'packages/schematic/src/components.mjs'), 'utf8');
  const app = readUiSource();
  assert.match(source, /type: 'current'/);
  assert.match(source, /type: 'switch'/);
  assert.match(app, /part\.type === 'current'/);
  assert.match(app, /part\.type === 'switch'/);
});

test('Circuit Lab exposes explicit reference annotation and collision-safe insertion', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="annotate-components"/);
  assert.match(source, /annotateCircuitComponents/);
  assert.match(source, /while \(used\.has\(`\$\{prefix\}\$\{count\}`\)\)/);
});

test('Circuit Lab copy/paste carries only internal wires with remapped nodes', async () => {
  const source = readUiSource();
  assert.match(source, /clipboardWires: \[\],/, 'the clipboard starts empty (src/state/circuit-editor.js)');
  assert.match(source, /clipboardWires = state\.project\.circuit\.wires\.filter/);
  assert.match(source, /result\.nodeMap\[wire\.from\]/);
  assert.match(source, /setWireRoute\(connected, from, to/);
  assert.match(source, /wire\.route\.coordinate \+ pasteOffset\[wire\.route\.axis\]/);
});

test('Circuit Lab exposes persistent orthogonal route and marker editing', async () => {
  const source = readUiSource();
  assert.match(source, /data-wire-route-from/);
  assert.match(source, /data-wire-handle-from/);
  assert.match(source, /beginWireRouteDrag/);
  assert.match(source, /setWireRoute\(project\.circuit\.wires, from, to, route\)/);
  assert.match(source, /wireRouteHandles/);
  assert.match(source, /wireRouteInsertionPoint/);
  assert.match(source, /data-wire-point-index/);
  assert.match(source, /routeWithAddedPoint/);
  assert.match(source, /beginMarkerDrag/);
  assert.match(source, /moveMarkerWithKeyboard/);
});

test('Circuit Lab exposes an actionable wire disconnect control', async () => {
  const source = readUiSource();
  assert.match(source, /data-wire-remove-from/);
  assert.match(source, /disconnectNodes\(project\.circuit\.wires, from, to\)/);
});

test('Circuit Lab exposes native ngspice only behind detected desktop grants', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="run-ngspice"/);
  assert.match(source, /ngspice\?\.state === 'detected'/);
  assert.match(source, /processPermissionGranted && state\.artifactPermissionGranted/);
  assert.match(source, /createDesktopEngineRunner/);
  assert.match(source, /createNgspiceAdapter/);
  assert.match(source, /desktopBridge\.registerArtifact/);
  assert.match(source, /ngspice-analysis/);
});

test('Circuit Lab exposes persisted ngspice job configuration and real table instruments', async () => {
  const source = readUiSource();
  assert.match(source, /NGSPICE_OPERATIONS = \['operating-point', 'dc-sweep', 'ac-analysis', 'transient'\]/);
  assert.match(source, /data-ngspice-field="operation"/);
  assert.match(source, /circuit-ngspice-analysis/);
  assert.match(source, /data-ngspice-view="traceIndex"/);
  assert.match(source, /data-ngspice-view="cursorA"/);
  assert.match(source, /data-action="ngspice-zoom-in"/);
  assert.match(source, /data-action="ngspice-pan-right"/);
  assert.match(source, /data-action="export-ngspice-csv"/);
  assert.match(source, /measureNgspiceCursors/);
  assert.match(source, /serializeNgspiceCsv/);
  assert.match(source, /parseNgspiceDiagnostics/);
  assert.match(source, /locateNgspiceDiagnostic/);
  assert.match(source, /kind: 'ngspice-error'/);
});

test('Embedded Lab exposes project-scoped Arduino CLI compile only behind desktop grants', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="build-arduino"/);
  assert.match(source, /arduino\?\.state === 'detected'/);
  assert.match(source, /processPermissionGranted && state\.artifactPermissionGranted/);
  assert.match(source, /createDesktopProcessAdapterRunner/);
  assert.match(source, /createArduinoCliAdapter/);
  assert.match(source, /board: target\.fqbn/);
  assert.match(source, /runs\/\$\{runId\}\/sketch\/sketch\.ino/);
  assert.match(source, /firmware-arduino-compile/);
  assert.match(source, /data-action="upload-arduino"/);
  assert.match(source, /runNativeArduinoUpload/);
  assert.match(source, /grantDeviceTarget\(project\.project_id, 'device-programmer', port, true\)/);
  assert.match(source, /deviceAuthorization: \{ permission: 'device-programmer', target: port \}/);
  assert.match(source, /data-action="cancel-arduino-upload"/);
  assert.match(source, /activeArduinoUpload\.adapter = compileAdapter/);
  assert.match(source, /activeArduinoUpload\.adapter = uploadAdapter/);
  assert.match(source, /await upload\.adapter\?\.cancel\(\)/);
  assert.match(source, /The port is entered manually; no connected-device scan runs/);
});

test('Embedded Lab inventories local Arduino packages without device discovery or installation', async () => {
  const source = readUiSource();
  const adapter = await readFile(resolve(root, 'packages/engine-sdk/src/arduino-cli.mjs'), 'utf8');
  assert.match(source, /data-action="refresh-arduino-inventory"/);
  assert.match(source, /data-field="arduino-board"/);
  assert.match(source, /firmware-arduino-target/);
  assert.match(source, /\['version', 'board-inventory', 'core-inventory', 'library-inventory'\]/);
  assert.match(source, /Refresh Arduino inventory and explicitly select an installed board/);
  assert.match(adapter, /\['board', 'listall', '--json'\]/);
  assert.doesNotMatch(adapter, /\['board', 'list'\]/);
  assert.doesNotMatch(adapter, /core', 'install/);
  assert.doesNotMatch(adapter, /lib', 'install/);
});

test('Embedded Lab exposes a bounded native serial terminal only after an exact target grant', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="grant-arduino-serial"/);
  assert.match(source, /grantDeviceTarget\(project\.project_id, 'device-serial', port, true\)/);
  assert.match(source, /data-serial-config="baud"/);
  assert.match(source, /data-serial-config="encoding"/);
  assert.match(source, /data-serial-config="lineEnding"/);
  assert.match(source, /data-serial-config="timestamps"/);
  assert.match(source, /desktopBridge\.startSerial/);
  assert.match(source, /desktopBridge\.pollSerial/);
  assert.match(source, /desktopBridge\.writeSerial/);
  assert.match(source, /exportArduinoSerial/);
  assert.match(source, /No port enumeration or background connection occurs/);
});

test('toolchain catalog is an honest browser-preview surface', async () => {
  const source = readUiSource();
  assert.match(source, /renderToolchains/);
  assert.match(source, /Native tools are never assumed installed/);
  assert.match(source, /open-toolchains/);
});

test('toolchain detection changes the rendered status class as well as its label', async () => {
  const source = readUiSource();
  assert.match(source, /const statusClass = \(engine\) =>/);
  assert.match(source, /detection\[engine\.id\]\?\.state === 'detected' \? 'ready'/);
  assert.match(source, /engine-status \$\{statusClass\(engine\)\}/);
});

test('replacing a project clears stale desktop identity and process permission state', async () => {
  const store = await readFile(new URL('../src/core/store.js', import.meta.url), 'utf8');
  assert.match(store, /desktopProject: null/);
  assert.match(store, /processPermissionGranted: false/);
  assert.match(store, /artifactPermissionGranted: false/);
  assert.match(store, /arduinoInventory: null/);
  assert.match(store, /arduinoDeviceGrant: null/);
  assert.match(store, /projectHistory\.commit\(validated\)/);
});

test('browser project replacement closes an open native session first', async () => {
  const source = readUiSource();
  assert.match(source, /async function closeNativeSessionForBrowserProject\(\)/);
  assert.match(source, /await desktopBridge\.closeProject\(\)/);
  assert.match(source, /closeNativeSessionForBrowserProject\(\)/);
});

test('desktop open cleans up a native session if post-open browser validation fails', async () => {
  const source = readUiSource();
  assert.match(source, /let nativeOpened = false/);
  assert.match(source, /nativeOpened = true/);
  assert.match(source, /if \(nativeOpened\) await desktopBridge\.closeProject\(\)\.catch/);
});

test('native manifest validation enforces bounded artifact references when present', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  assert.match(source, /project artifacts are invalid/);
  assert.match(source, /mediaType/);
  assert.match(source, /256 \* 1024 \* 1024/);
  assert.match(source, /hash\.len\(\) != 64/);
  assert.match(source, /is_ascii_alphabetic/);
});

test('native manifest validation enforces canonical timestamp shape', async () => {
  const source = await readFile(resolve(root, 'apps/desktop/src-tauri/src/native_project.rs'), 'utf8');
  assert.match(source, /fn valid_timestamp/);
  assert.match(source, /valid_timestamp\(timestamp\)/);
  assert.match(source, /timestamps_require_rfc3339_shape/);
});

test('native manifest validation enforces units and provenance bounds', async () => {
  const source = await readFile(resolve(root, 'apps/desktop/src-tauri/src/native_project.rs'), 'utf8');
  assert.match(source, /project units are invalid/);
  assert.match(source, /project provenance is invalid/);
  assert.match(source, /engineVersions/);
});

test('native manifest validation enforces schematic component and connectivity fields', async () => {
  const source = await readFile(resolve(root, 'apps/desktop/src-tauri/src/native_project.rs'), 'utf8');
  assert.match(source, /fn valid_component_id/);
  assert.match(source, /project circuit components are invalid/);
  assert.match(source, /bounded_text\(object\.get\("from"\)/);
  assert.match(source, /finite_number\(object\.get\("x"\)\)/);
});

test('native manifest validation bounds registry IDs and experiment definitions', async () => {
  const source = await readFile(resolve(root, 'apps/desktop/src-tauri/src/native_project.rs'), 'utf8');
  assert.match(source, /contains an invalid id/);
  assert.match(source, /MAX_EXPERIMENT_DEFINITION_BYTES/);
  assert.match(source, /project experiment definition is oversized/);
});

test('Toolchains exposes separate browser-denied device permission scopes', async () => {
  const source = readUiSource();
  assert.match(source, /createDevicePermissionPolicy/);
  assert.match(source, /DEVICE, PROCESS AND ARTIFACT PERMISSIONS/);
  assert.match(source, /Serial, USB, debug, capture, SDR, programmer, process execution and generated-artifact writes are separate permissions/);
  assert.match(source, /Process execution/);
  assert.match(source, /explicit project-scoped desktop grant/);
  assert.match(source, /data-action="grant-process"/);
  assert.match(source, /data-action="confirm-process-grant"/);
  assert.match(source, /data-action="grant-artifact"/);
  assert.match(source, /data-action="confirm-artifact-grant"/);
  assert.match(source, /data-action="revoke-process"/);
  assert.match(source, /data-action="revoke-artifact"/);
  assert.match(source, /grantArtifactWrite/);
  assert.match(source, /revokeProcessExecution/);
  assert.match(source, /revokeArtifactWrite/);
  assert.match(source, /No scope is granted automatically/);
});

test('canvas zoom controls are exposed as built-in actions', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="zoom-out"/);
  assert.match(source, /data-action="zoom-in"/);
  assert.doesNotMatch(source, /canvas zoom is planned for Phase 3/);
});

test('Circuit Lab inspector uses bounded SI engineering-value parsing', async () => {
  const source = readUiSource();
  assert.match(source, /parseEngineeringValue\(input\.value/);
  assert.match(source, /Use SI suffixes/);
  assert.doesNotMatch(source, /data-part-field="value" value=.*type="number"/);
});

test('Signals workspace uses real local numerical primitives', async () => {
  const source = readUiSource();
  assert.match(source, /function renderDsp/);
  assert.match(source, /generateSine\(/);
  assert.match(source, /fft\(windowed\)/);
  assert.match(source, /run-dsp/);
});

test('Signals workspace exposes bounded windowing through the numerical kernel', async () => {
  const source = readUiSource();
  assert.match(source, /applyWindow/);
  assert.match(source, /data-dsp-field="window"/);
});

test('Signals workspace exposes bounded FIR filtering through the numerical kernel', async () => {
  const source = readUiSource();
  const numerics = await readFile(new URL('../packages/numerics/src/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /filterFir/);
  assert.match(source, /data-dsp-field="taps"/);
  assert.match(numerics, /export function filterFir/);
});

test('Signals workspace exports only real bounded result samples', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="export-dsp"/);
  assert.match(source, /result\?\.kind !== 'dsp'/);
  assert.match(source, /time_s,value/);
});

test('Signals workspace exports real FFT columns only after a spectrum exists', async () => {
  const source = readUiSource();
  assert.match(source, /data-action="export-spectrum"/);
  assert.match(source, /result\.spectrum\?\.real/);
  assert.match(source, /frequency_hz,real,imaginary,magnitude/);
});

test('Signals workspace renders an FFT magnitude trace from computed bins', async () => {
  const source = readUiSource();
  assert.match(source, /const magnitudes = result \? Array\.from\(result\.spectrum\.real,/);
  assert.match(source, /FFT MAGNITUDE/);
  assert.match(source, /spectrumPath/);
});

test('Python numerical worker allow-lists the FIR filter operation', async () => {
  const source = await readFile(new URL('../workers/python/worker.py', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../packages/numerics/src/worker-protocol.mjs', import.meta.url), 'utf8');
  assert.match(source, /operation == "fir_filter"/);
  assert.match(protocol, /'fir_filter'/);
  assert.match(source, /MAX_N2_OPERATIONS/);
  assert.match(source, /workload exceeds the computation limit/);
});

test('Communication workspace uses real QPSK and BER primitives', async () => {
  const source = readUiSource();
  assert.match(source, /function renderCommunication/);
  assert.match(source, /qpskModulate\(bits\)/);
  assert.match(source, /bitErrorRate\(bits/);
  assert.match(source, /run-communication/);
});

test('Control workspace uses the bounded first-order control kernel', async () => {
  const source = readUiSource();
  assert.match(source, /function renderControl/);
  assert.match(source, /firstOrderStep/);
  assert.match(source, /firstOrderStability/);
  assert.match(source, /run-control/);
  assert.match(source, /export-control/);
  assert.match(source, /time_s,value/);
});

test('experiment runs persist authored configurations separately from generated results', async () => {
  const app = readUiSource();
  const store = await readFile(new URL('../src/core/store.js', import.meta.url), 'utf8');
  const experiments = await readFile(new URL('../packages/project-model/src/experiments.mjs', import.meta.url), 'utf8');
  assert.match(store, /export function recordExperiment/);
  assert.match(experiments, /64 \* 1024/);
  assert.match(experiments, /JSON-serializable/);
  assert.match(store, /project\.experiments/);
  assert.match(app, /recordExperiment\(\{ id: 'signals-fft'/);
  assert.match(app, /recordExperiment\(\{ id: 'circuit-dc'/);
  assert.match(app, /recordExperiment\(\{ id: 'control-step'/);
  assert.match(app, /recordExperiment\(\{ id: 'qpsk-ber'/);
  assert.match(app, /recordExperiment\(\{ id: 'topology-metrics'/);
  assert.match(app, /recordExperiment\(\{ id: 'rf-touchstone'/);
  assert.match(app, /saved = getState\(\)\.project\.experiments\.find\(\(experiment\) => experiment\?\.id === 'rf-touchstone'/);
  assert.match(app, /recordExperiment\(\{ id: 'vcd-import'/);
  assert.match(app, /savedVcd = getState\(\)\.project\.experiments/);
  assert.match(app, /savedTopology = getState\(\)\.project\.experiments/);
  assert.match(app, /topologyField\.value = JSON\.stringify/);
  assert.match(app, /state\.project\.experiments\.find\(\(experiment\) => experiment\?\.id === 'signals-fft'/);
  assert.match(app, /state\.project\.experiments\.find\(\(experiment\) => experiment\?\.id === 'control-step'/);
  assert.match(app, /state\.project\.experiments\.find\(\(experiment\) => experiment\?\.id === 'qpsk-ber'/);
});

test('embedded editor writes authored firmware source through the project store', async () => {
  const source = readUiSource();
  assert.match(source, /data-field="embedded-code"/);
  assert.match(source, /project\.embedded\.code = editor\.value/);
  assert.match(source, /updateProject/);
});

test('Project Hub exposes persisted authored experiment configurations without generated results', async () => {
  const source = readUiSource();
  assert.match(source, /AUTHORED EXPERIMENTS/);
  assert.match(source, /state\.project\.experiments\.slice\(-6\)/);
  assert.match(source, /Project manifest/);
  assert.match(source, /Run a built-in experiment to save its authored configuration here/);
  assert.match(source, /experimentModules/);
  assert.match(source, /experiment-list \.engine-row/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /aria-label.*Open.*experiment/);
});

test('Packet workspace exposes bounded saved-PCAP parsing without live capture', async () => {
  const source = readUiSource();
  assert.match(source, /function renderNetwork/);
  assert.match(source, /parsePcap/);
  assert.match(source, /parsePcapNg/);
  assert.match(source, /SAVED CAPTURE ONLY/);
  assert.match(source, /live capture is unavailable/);
});

test('Packet workspace exposes deterministic topology metrics without live network access', async () => {
  const source = readUiSource();
  assert.match(source, /topologyMetrics/);
  assert.match(source, /run-topology/);
  assert.match(source, /no broker or live network access/);
});

test('Circuit Lab ignores non-DC shared results instead of dereferencing incompatible shapes', async () => {
  const source = readUiSource();
  assert.match(source, /const isDcResult = \(simulation\) => Boolean\(simulation\?\.nodes && simulation\?\.currents && !simulation\.kind\)/);
  assert.match(source, /const circuitCompatible = isDcResult\(state\.simulation\) \|\| \['ngspice', 'ngspice-error', 'circuit-transient', 'circuit-ac'\]\.includes\(state\.simulation\?\.kind\)/);
  assert.match(source, /const circuitState = circuitCompatible \? state/);
  assert.match(source, /const result = isDcResult\(state\.simulation\) \? state\.simulation : null/);
});

test('project persistence failures are surfaced instead of claiming a local save', async () => {
  const store = await readFile(new URL('../src/core/store.js', import.meta.url), 'utf8');
  const app = readUiSource();
  assert.match(store, /persistence: \{ status: 'error'/);
  assert.match(store, /Project could not be saved/);
  assert.match(store, /initialStoragePresent/);
  assert.match(await readFile(new URL('../src/core/project-storage.js', import.meta.url), 'utf8'), /STORAGE_CORRUPT_SUFFIX/);
  assert.match(await readFile(new URL('../src/core/project-storage.js', import.meta.url), 'utf8'), /raw\.length > MAX_BROWSER_IMPORT_BYTES/);
  assert.match(await readFile(new URL('../src/core/project-storage.js', import.meta.url), 'utf8'), /recovered: true/);
  assert.match(store, /status: initialLoad\.error/);
  assert.match(app, /state\.persistence\?\.status === 'error'/);
  assert.match(app, /Recovered locally/);
  assert.match(app, /Save failed/);
});

test('Digital workspace exposes bounded VCD import and explicitly gated native Verilator lint', async () => {
  const source = readUiSource();
  assert.match(source, /function renderDigital/);
  assert.match(source, /parseVcd/);
  assert.match(source, /data-action="lint-verilator"/);
  assert.match(source, /data-action="cancel-hdl-job"/);
  assert.match(source, /data-action="synthesize-yosys"/);
  assert.match(source, /runNativeYosysSynthesis/);
  assert.match(source, /synthesis: \{ report, runId, engine: 'yosys', state: 'succeeded'/);
  assert.match(source, /A synthesis report is not simulation evidence/);
  assert.match(source, /data-action="place-route-nextpnr"/);
  assert.match(source, /runNativeNextpnrPlaceRoute/);
  assert.match(source, /target: 'ice40', package: 'ct256'/);
  assert.match(source, /no bitstream or hardware-ready claim was made/);
  assert.match(source, /data-action="simulate-ghdl"/);
  assert.match(source, /runNativeGhdlSimulation/);
  assert.match(source, /\['analyze', 'elaborate', 'simulate'\]/);
  assert.match(source, /desktopBridge\.readArtifact/);
  assert.match(source, /simulation does not imply synthesis or hardware readiness/);
  assert.match(source, /await active\.adapter\.cancel\(\)/);
  assert.match(source, /createVerilatorAdapter/);
  assert.match(source, /hdl-systemverilog-counter/);
  assert.match(source, /runs\/\$\{runId\}\/src\/counter\.sv/);
  assert.match(source, /Lint is a separate source-quality job/);
  assert.match(source, /GHDL and compiled simulation, generated-waveform ingestion/);
});

test('Embedded structure checks expose source-linked firmware diagnostics', async () => {
  const source = readUiSource();
  assert.match(source, /analyzeSketchSource/);
  assert.match(source, /diagnostic\.code/);
  assert.match(source, /line \$\{diagnostic\.line\}/);
});

test('RF workspace uses the bounded Touchstone parser', async () => {
  const source = readUiSource();
  assert.match(source, /function renderRf/);
  assert.match(source, /parseTouchstone\(text/);
  assert.match(source, /parse-rf/);
});

test('RF workspace derives a Smith-view trace from parsed S11 data', async () => {
  const source = readUiSource();
  assert.match(source, /const s11 = result/);
  assert.match(source, /S11 SMITH VIEW/);
  assert.match(source, /Math\.atan2\(first\.imaginary/);
});

test('Learning workspace evaluates a real DC result checkpoint', async () => {
  const source = readUiSource();
  assert.match(source, /function renderVerifiedLearning/);
  assert.match(source, /evaluateLesson\(lesson/);
  assert.match(source, /Run the voltage-divider DC analysis first/);
});

test('Learning workspace adds real DSP and BER checkpoints', async () => {
  const source = readUiSource();
  assert.match(source, /dsp-window/);
  assert.match(source, /qpsk-ber/);
  assert.match(source, /check-dsp-lesson/);
  assert.match(source, /check-comm-lesson/);
});

test('static server refuses traversal, encoded traversal and symlink escapes', async () => {
  const { createStaticServer } = await import('../scripts/server.mjs');
  const { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const base = mkdtempSync(join(tmpdir(), 'openentc-serve-'));
  const served = join(base, 'served');
  mkdirSync(served);
  writeFileSync(join(served, 'index.html'), '<p>ok</p>');
  writeFileSync(join(base, 'secret.txt'), 'secret');
  symlinkSync(join(base, 'secret.txt'), join(served, 'link.txt'));
  const server = await createStaticServer(served);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  const get = async (path) => { const response = await fetch(`http://127.0.0.1:${port}${path}`); return { status: response.status, text: await response.text() }; };
  try {
    assert.equal((await get('/')).text, '<p>ok</p>');
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2Fsecret.txt', '/link.txt']) {
      const result = await get(path);
      assert.equal(result.status, 404, path);
      assert.doesNotMatch(result.text, /secret/, path);
    }
  } finally {
    server.close();
  }
});
