// Re-render hook. The shell registers its render function once at startup; workspace code calls
// rerender() after changing state that lives outside the store (live sessions, runtimes, panels).
// This keeps workspaces from importing the shell, which would create an import cycle.
let renderer = () => {};

export function setRenderer(render) {
  if (typeof render !== 'function') throw new TypeError('setRenderer needs a function.');
  renderer = render;
}

export function rerender() {
  renderer();
}
