import { decodeWorkerResponse, encodeWorkerRequest } from './worker-protocol.mjs';

const DEFAULT_TIMEOUT_MS = 30_000;

export function createNumericalWorkerClient({ transportFactory, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof transportFactory !== 'function') throw new TypeError('Numerical worker transportFactory is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new RangeError('Numerical worker timeout is invalid.');
  let transport = null; let pending = null; let generation = 0;
  const start = () => {
    const currentGeneration = ++generation;
    transport = transportFactory();
    if (!transport || typeof transport.send !== 'function' || typeof transport.onLine !== 'function' || typeof transport.onExit !== 'function' || typeof transport.terminate !== 'function') throw new TypeError('Numerical worker transport is incomplete.');
    transport.onLine((line) => {
      if (!pending || pending.generation !== currentGeneration) return;
      let response; try { response = decodeWorkerResponse(line); } catch (error) { const failure = pending; pending = null; failure.reject(Object.assign(new Error(error.message), { code: 'WORKER_PROTOCOL_INVALID' })); transport.terminate(); return; }
      if (response.id !== undefined && response.id !== pending.id) return;
      const completed = pending; pending = null; clearTimeout(completed.timer); if (response.ok) completed.resolve(response.result); else completed.reject(Object.assign(new Error(response.error.message), { code: response.error.code }));
    });
    transport.onExit((error) => { if (!pending || pending.generation !== currentGeneration) return; const failure = pending; pending = null; clearTimeout(failure.timer); failure.reject(Object.assign(new Error(error?.message || 'Numerical worker exited.'), { code: 'WORKER_EXIT' })); });
    return transport;
  };
  const ensure = () => transport || start();
  return Object.freeze({
    request: (request, { signal } = {}) => {
      if (pending) return Promise.reject(Object.assign(new Error('Numerical worker is busy.'), { code: 'WORKER_BUSY' }));
      const line = encodeWorkerRequest(request); const active = ensure();
      return new Promise((resolve, reject) => {
        const cancel = () => { if (!pending) return; const cancelled = pending; pending = null; clearTimeout(cancelled.timer); active.terminate(); reject(Object.assign(new Error('Numerical worker request cancelled.'), { code: 'WORKER_CANCELLED' })); };
        if (signal?.aborted) { reject(Object.assign(new Error('Numerical worker request cancelled.'), { code: 'WORKER_CANCELLED' })); return; }
        const timer = setTimeout(() => { if (!pending) return; const timedOut = pending; pending = null; active.terminate(); timedOut.reject(Object.assign(new Error('Numerical worker request timed out.'), { code: 'WORKER_TIMEOUT' })); }, timeoutMs);
        pending = { id: request.id, generation, resolve, reject, timer };
        signal?.addEventListener('abort', cancel, { once: true });
        try { active.send(line); } catch (error) { pending = null; clearTimeout(timer); reject(Object.assign(new Error(error.message), { code: 'WORKER_SEND_FAILED' })); }
      });
    },
    restart: () => { if (pending) { const failure = pending; pending = null; clearTimeout(failure.timer); failure.reject(Object.assign(new Error('Numerical worker restarted.'), { code: 'WORKER_RESTARTED' })); } transport?.terminate(); transport = null; return ensure(); },
    close: () => { if (pending) { const failure = pending; pending = null; clearTimeout(failure.timer); failure.reject(Object.assign(new Error('Numerical worker closed.'), { code: 'WORKER_CLOSED' })); } transport?.terminate(); transport = null; }
  });
}
