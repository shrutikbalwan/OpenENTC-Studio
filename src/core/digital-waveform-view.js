const COMMANDS = new Set(['zoom-in', 'zoom-out', 'pan-left', 'pan-right']);

function assertTrace(trace) {
  if (trace?.kind !== 'digital-trace' || !Array.isArray(trace.signals) || !trace.signals.length) throw new TypeError('A non-empty digital trace is required.');
}

function traceEnd(trace) {
  return trace.signals.reduce((maximum, signal) => Math.max(maximum, ...(signal.samples?.length ? [signal.samples.at(-1).time] : [0])), 0);
}

export function digitalSignalGroups(trace) {
  assertTrace(trace);
  return Object.freeze([...new Set(trace.signals.map((signal) => signal.scope || '(root)'))].sort((a, b) => a.localeCompare(b)));
}

export function filterDigitalSignals(trace, requested = {}) {
  assertTrace(trace);
  const groups = digitalSignalGroups(trace);
  const group = requested.group === 'all' || groups.includes(requested.group) ? requested.group : 'all';
  const query = typeof requested.query === 'string' ? requested.query.trim().slice(0, 100).toLocaleLowerCase() : '';
  return Object.freeze(trace.signals.filter((signal) => {
    const inGroup = group === 'all' || (signal.scope || '(root)') === group;
    const searchable = `${signal.fullName || signal.name} ${signal.name}`.toLocaleLowerCase();
    return inGroup && (!query || searchable.includes(query));
  }));
}

export function normalizeDigitalWaveformView(trace, requested = {}) {
  assertTrace(trace);
  const maximum = traceEnd(trace);
  const startTime = Math.max(0, Math.min(maximum, Number.isSafeInteger(requested.startTime) ? requested.startTime : 0));
  const endTime = Math.max(startTime, Math.min(maximum, Number.isSafeInteger(requested.endTime) ? requested.endTime : maximum));
  const cursorA = Math.max(startTime, Math.min(endTime, Number.isSafeInteger(requested.cursorA) ? requested.cursorA : startTime));
  const cursorB = Math.max(startTime, Math.min(endTime, Number.isSafeInteger(requested.cursorB) ? requested.cursorB : endTime));
  const groups = digitalSignalGroups(trace);
  const group = requested.group === 'all' || groups.includes(requested.group) ? requested.group : 'all';
  const query = typeof requested.query === 'string' ? requested.query.slice(0, 100) : '';
  return Object.freeze({ startTime, endTime, cursorA, cursorB, group, query });
}

export function transformDigitalWaveformView(trace, requested, command) {
  assertTrace(trace);
  if (!COMMANDS.has(command)) throw new TypeError('Unsupported digital waveform view command.');
  const view = normalizeDigitalWaveformView(trace, requested);
  const maximum = traceEnd(trace);
  if (maximum === 0) return view;
  const width = Math.max(1, view.endTime - view.startTime);
  let nextWidth = width; let start = view.startTime;
  if (command === 'zoom-in') { nextWidth = Math.max(1, Math.ceil(width / 2)); start = Math.round((view.startTime + view.endTime - nextWidth) / 2); }
  if (command === 'zoom-out') { nextWidth = Math.min(maximum, width * 2); start = Math.round((view.startTime + view.endTime - nextWidth) / 2); }
  const pan = Math.max(1, Math.floor(width / 4));
  if (command === 'pan-left') start -= pan;
  if (command === 'pan-right') start += pan;
  start = Math.max(0, Math.min(maximum - nextWidth, start));
  const end = Math.min(maximum, start + nextWidth);
  return Object.freeze({ ...view, startTime: start, endTime: end, cursorA: Math.max(start, Math.min(end, view.cursorA)), cursorB: Math.max(start, Math.min(end, view.cursorB)) });
}

export function sampleDigitalSignal(signal, time) {
  if (!signal || !Array.isArray(signal.samples) || !Number.isFinite(time)) throw new TypeError('A digital signal and finite sample time are required.');
  let low = 0; let high = signal.samples.length - 1; let match = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (signal.samples[middle].time <= time) { match = middle; low = middle + 1; } else high = middle - 1;
  }
  return match < 0 ? '—' : signal.samples[match].value;
}

export function measureDigitalCursors(trace, requested) {
  const view = normalizeDigitalWaveformView(trace, requested);
  const signals = filterDigitalSignals(trace, view);
  return Object.freeze({
    cursorA: view.cursorA,
    cursorB: view.cursorB,
    deltaTime: view.cursorB - view.cursorA,
    values: Object.freeze(signals.map((signal) => Object.freeze({ id: signal.id, fullName: signal.fullName || signal.name, a: sampleDigitalSignal(signal, view.cursorA), b: sampleDigitalSignal(signal, view.cursorB) })))
  });
}

export function serializeDigitalCsv(trace, requested = {}) {
  const view = normalizeDigitalWaveformView(trace, requested);
  const signals = filterDigitalSignals(trace, view).slice(0, 128);
  const times = new Set([view.startTime, view.endTime]);
  for (const signal of signals) for (const sample of signal.samples) if (sample.time >= view.startTime && sample.time <= view.endTime) times.add(sample.time);
  const orderedTimes = [...times].sort((a, b) => a - b).slice(0, 100_000);
  const cell = (value) => { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  const header = ['time', ...signals.map((signal) => signal.fullName || signal.name)].map(cell).join(',');
  const rows = orderedTimes.map((time) => [time, ...signals.map((signal) => sampleDigitalSignal(signal, time))].map(cell).join(','));
  const csv = `${[header, ...rows].join('\n')}\n`;
  if (new TextEncoder().encode(csv).byteLength > 8 * 1024 * 1024) throw new RangeError('Digital waveform CSV exceeds the 8 MiB export limit.');
  return csv;
}
