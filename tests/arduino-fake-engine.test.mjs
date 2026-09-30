import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createArduinoCliAdapter } from '../packages/engine-sdk/src/arduino-cli.mjs';
import { createDevicePermissionPolicy } from '../packages/device-bridge/src/index.mjs';
import { createFakeArduinoCliRunner } from './support/fake-arduino-cli.mjs';

const executable = 'C:\\Program Files\\Arduino CLI\\arduino-cli.exe';
const sketchPath = 'C:\\OpenENTC Projects\\Blink Example';
const buildPath = 'C:\\OpenENTC Projects\\Blink Example\\build';

test('Blink fixture and fake Arduino CLI produce deterministic compile evidence with spaced paths', async () => {
  const source = await readFile(resolve('tests/fixtures/arduino/Blink/Blink.ino'), 'utf8');
  assert.match(source, /pinMode\(LED_PIN, OUTPUT\)/);
  assert.match(source, /digitalWrite\(LED_PIN, HIGH\)/);
  const fake = createFakeArduinoCliRunner();
  const adapter = createArduinoCliAdapter({ executable, runner: fake.runner });
  const job = { operation: 'compile', board: 'arduino:avr:uno', sketchPath, buildPath };
  assert.equal((await adapter.selfTest()).available, true);
  await adapter.prepare(job); await adapter.run(job);
  const report = await adapter.parse(job);
  assert.deepEqual(fake.calls[0].args, ['compile', '--fqbn', 'arduino:avr:uno', '--build-path', buildPath, sketchPath]);
  assert.deepEqual(report.memory.flash, { used: 924, capacity: 32256 });
  assert.deepEqual(report.memory.ram, { used: 9, capacity: 2048 });
});

test('fake Arduino CLI covers deterministic inventory and malformed-output rejection', async () => {
  const good = createArduinoCliAdapter({ executable, runner: createFakeArduinoCliRunner().runner });
  await good.prepare({ operation: 'board-inventory' }); await good.run({ operation: 'board-inventory' });
  assert.deepEqual((await good.parse({ operation: 'board-inventory' })).items, [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }]);
  const bad = createArduinoCliAdapter({ executable, runner: createFakeArduinoCliRunner({ malformedInventory: true }).runner });
  await bad.prepare({ operation: 'board-inventory' }); await bad.run({ operation: 'board-inventory' });
  await assert.rejects(bad.parse({ operation: 'board-inventory' }), /valid JSON/);
});

test('fake Arduino CLI exercises compiler failure and timeout propagation', async () => {
  const failed = createArduinoCliAdapter({ executable, runner: createFakeArduinoCliRunner({ failCompile: true }).runner });
  const job = { operation: 'compile', board: 'arduino:avr:uno', sketchPath };
  await failed.prepare(job);
  await assert.rejects(failed.run(job), (error) => error.code === 'ENGINE_FAILURE' && /Blink\.ino:4:3/.test(error.message));
  const timed = createArduinoCliAdapter({ executable, runner: createFakeArduinoCliRunner({ timeout: true }).runner });
  await timed.prepare({ operation: 'version' });
  await assert.rejects(timed.run({ operation: 'version' }), (error) => error.code === 'PROCESS_TIMEOUT');
});

test('fake Arduino CLI upload requires the exact grant and supports cancellation', async () => {
  const policy = createDevicePermissionPolicy({ environment: 'desktop', allowed: ['programmer'] });
  const job = { operation: 'upload', board: 'arduino:avr:uno', port: 'COM4', sketchPath, buildPath };
  const fake = createFakeArduinoCliRunner({ delayMs: 1000 });
  const adapter = createArduinoCliAdapter({ executable, runner: fake.runner, permissionPolicy: policy });
  await assert.rejects(adapter.prepare(job), /permission/);
  policy.selectTarget('programmer', 'COM4');
  await adapter.prepare(job);
  const run = adapter.run(job);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await adapter.cancel(job);
  await assert.rejects(run, (error) => error.code === 'PROCESS_CANCELLED');
});
