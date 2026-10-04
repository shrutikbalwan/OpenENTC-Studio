// @ts-check
// Circuit Lab editing state that is not part of the project: the wire being drawn, the selected
// wire and the copy/paste clipboard. Shared by the shell (which clears it on navigation) and the
// circuit workspaces.
export const circuitEditor = {
  wireSource: null,
  selectedWire: null,
  clipboardParts: [],
  clipboardWires: [],
};
