export function createHistory(initialValue, limit = 100) {
  if (!Number.isInteger(limit) || limit < 0 || limit > 10_000) throw new TypeError('History limit must be an integer from 0 through 10000.');
  let past = [];
  let present = structuredClone(initialValue);
  let future = [];

  const snapshot = () => ({
    past: past.map((value) => structuredClone(value)),
    present: structuredClone(present),
    future: future.map((value) => structuredClone(value))
  });

  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get value() { return structuredClone(present); },
    commit(nextValue) {
      past = limit === 0 ? [] : [...past, structuredClone(present)].slice(-limit);
      present = structuredClone(nextValue);
      future = [];
      return snapshot();
    },
    undo() {
      if (!past.length) return snapshot();
      future = [structuredClone(present), ...future];
      present = past.at(-1);
      past = past.slice(0, -1);
      return snapshot();
    },
    redo() {
      if (!future.length) return snapshot();
      past = limit === 0 ? [] : [...past, structuredClone(present)].slice(-limit);
      present = future[0];
      future = future.slice(1);
      return snapshot();
    },
    clear() { past = []; future = []; return snapshot(); }
  };
}
