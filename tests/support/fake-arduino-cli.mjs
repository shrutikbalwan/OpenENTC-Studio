const VERSION_OUTPUT = 'arduino-cli Version: 1.3.1 Commit: openentc-fake';
const COMPILE_OUTPUT = 'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.\nGlobal variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.';

function cancelledError() {
  return Object.assign(new Error('Fake Arduino CLI process was cancelled.'), { code: 'PROCESS_CANCELLED' });
}

export function createFakeArduinoCliRunner({ delayMs = 0, malformedInventory = false, failCompile = false, timeout = false } = {}) {
  const calls = [];
  const runner = async ({ executable, args, signal }) => {
    calls.push(Object.freeze({ executable, args: Object.freeze([...args]) }));
    if (signal?.aborted) throw cancelledError();
    if (timeout) throw Object.assign(new Error('Fake Arduino CLI process timed out.'), { code: 'PROCESS_TIMEOUT' });
    if (delayMs) await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(cancelledError()); }, { once: true });
    });
    if (args[0] === 'version') return { ok: true, stdout: VERSION_OUTPUT, stderr: '' };
    if (args[0] === 'board' && args[1] === 'listall') return { ok: true, stdout: malformedInventory ? '{bad json' : '{"boards":[{"name":"Arduino Uno","fqbn":"arduino:avr:uno"}]}', stderr: '' };
    if (args[0] === 'core' && args[1] === 'list') return { ok: true, stdout: '{"platforms":[{"id":"arduino:avr","name":"Arduino AVR Boards","installed_version":"1.8.6","latest_version":"1.8.6"}]}', stderr: '' };
    if (args[0] === 'lib' && args[1] === 'list') return { ok: true, stdout: '{"installed_libraries":[]}', stderr: '' };
    if (args[0] === 'compile') return failCompile ? { ok: false, stdout: '', stderr: `${args.at(-1)}\\Blink.ino:4:3: error: expected ';'` } : { ok: true, stdout: COMPILE_OUTPUT, stderr: '' };
    if (args[0] === 'upload') return { ok: true, stdout: 'Upload complete.', stderr: '' };
    return { ok: false, stdout: '', stderr: 'Unsupported fake Arduino CLI operation.', error: 'UNSUPPORTED_OPERATION' };
  };
  return Object.freeze({ runner, calls });
}
