import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeWorkerResponse, encodeWorkerRequest } from '../packages/numerics/src/worker-protocol.mjs';

test('numerical worker protocol encodes allow-listed requests and bounded envelopes', () => {
  const encoded = encodeWorkerRequest({ id: 'r1', operation: 'fft', args: { input: [1, 0, 1, 0] } });
  assert.match(encoded, /"operation":"fft"/);
  assert.deepEqual(decodeWorkerResponse('{"id":"r1","ok":true,"result":{"kind":"spectrum"}}').result, { kind: 'spectrum' });
  assert.throws(() => encodeWorkerRequest({ id: 'r2', operation: 'execute_python' }), /unsupported/);
  assert.throws(() => encodeWorkerRequest({ id: 'r\u0000bad', operation: 'fft' }), /invalid/);
  const circular = {}; circular.self = circular;
  assert.throws(() => encodeWorkerRequest({ id: 'r3', operation: 'fft', args: circular }), /serializable/);
  assert.throws(() => decodeWorkerResponse('{"ok":false,"error":{"code":"X"}}'), /error envelope/);
});

test('numerical worker protocol allow-lists bounded DSP extensions', () => {
  for (const operation of ['window', 'correlate', 'resample', 'fir_filter']) {
    assert.match(encodeWorkerRequest({ id: operation, operation, args: { input: [1, 2] } }), new RegExp(`"operation":"${operation}"`));
  }
});
