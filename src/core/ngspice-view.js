const COMMANDS = new Set(['zoom-in', 'zoom-out', 'pan-left', 'pan-right']);

function assertTable(result) {
  if (result?.kind !== 'table' || !Array.isArray(result.columns) || !result.columns.length || !Array.isArray(result.rows) || !result.rows.length) throw new TypeError('A non-empty ngspice table is required.');
}

export function normalizeNgspiceView(result, requested = {}) {
  assertTable(result);
  const lastIndex = result.rows.length - 1;
  const traceIndex = Number.isInteger(requested.traceIndex) && requested.traceIndex >= 1 && requested.traceIndex < result.columns.length ? requested.traceIndex : Math.min(1, result.columns.length - 1);
  const startIndex = Math.max(0, Math.min(lastIndex, Number.isInteger(requested.startIndex) ? requested.startIndex : 0));
  const endIndex = Math.max(startIndex, Math.min(lastIndex, Number.isInteger(requested.endIndex) ? requested.endIndex : lastIndex));
  const cursorA = Math.max(startIndex, Math.min(endIndex, Number.isInteger(requested.cursorA) ? requested.cursorA : startIndex));
  const cursorB = Math.max(startIndex, Math.min(endIndex, Number.isInteger(requested.cursorB) ? requested.cursorB : endIndex));
  return Object.freeze({ traceIndex, startIndex, endIndex, cursorA, cursorB });
}

export function transformNgspiceWindowView(result, requested, command) {
  assertTable(result);
  if (!COMMANDS.has(command)) throw new TypeError('Unsupported ngspice view command.');
  const view = normalizeNgspiceView(result, requested);
  const last = result.rows.length - 1;
  const width = view.endIndex - view.startIndex + 1;
  let nextWidth = width; let start = view.startIndex;
  if (command === 'zoom-in') { nextWidth = Math.max(Math.min(2, result.rows.length), Math.ceil(width / 2)); start = Math.round((view.startIndex + view.endIndex - nextWidth + 1) / 2); }
  if (command === 'zoom-out') { nextWidth = Math.min(result.rows.length, width * 2); start = Math.round((view.startIndex + view.endIndex - nextWidth + 1) / 2); }
  const pan = Math.max(1, Math.floor(width / 4));
  if (command === 'pan-left') start -= pan;
  if (command === 'pan-right') start += pan;
  start = Math.max(0, Math.min(last - nextWidth + 1, start));
  const end = Math.min(last, start + nextWidth - 1);
  return Object.freeze({ ...view, startIndex: start, endIndex: end, cursorA: Math.max(start, Math.min(end, view.cursorA)), cursorB: Math.max(start, Math.min(end, view.cursorB)) });
}

export function measureNgspiceCursors(result, requested) {
  const view = normalizeNgspiceView(result, requested);
  const a = result.rows[view.cursorA]; const b = result.rows[view.cursorB];
  return Object.freeze({ xA: a[0], yA: a[view.traceIndex], xB: b[0], yB: b[view.traceIndex], deltaX: b[0] - a[0], deltaY: b[view.traceIndex] - a[view.traceIndex] });
}

export function serializeNgspiceCsv(result) {
  assertTable(result);
  const cell = (value) => { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  return `${[result.columns.map(cell).join(','), ...result.rows.map((row) => row.map((value) => Number(value).toPrecision(12)).join(','))].join('\n')}\n`;
}
