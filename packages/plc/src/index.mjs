// PLC ladder logic: a small rung language, a scan-cycle simulator with IEC-style timers and
// counters, and a layout of each rung for drawing a ladder diagram.
//
// Rung syntax (one rung per line, `#` starts a comment):
//   (I0.0 | Q0.0) /I0.1 -> Q0.0          series = AND (space), parallel = OR (|), /X = normally closed
//   ^I0.2 -> CTU C0 5                     ^X = rising-edge (one-shot) contact
//   I0.3 -> TON T0 2.5s, S M0.0           several outputs separated by commas
// Operands: I (inputs), Q (outputs), M (memory) as X0.0–X7.7; T0–T15 timer done bits; C0–C15 counter
// done bits. Outputs: Q/M coil, S x / R x (latch / unlatch), TON Tn t, TOF Tn t, TP Tn t,
// CTU Cn preset, CTD Cn preset, RES Tn|Cn.

const BIT = /^[IQM][0-7]\.[0-7]$/;
const TIMER = /^T(1[0-5]|[0-9])$/;
const COUNTER = /^C(1[0-5]|[0-9])$/;

function parseDuration(text, line) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/i.exec(text ?? '');
  if (!match) throw new RangeError(`Rung ${line}: "${text}" is not a time (use 500ms, 2s or 1m).`);
  const unit = (match[2] ?? 's').toLowerCase();
  return Number(match[1]) * (unit === 'ms' ? 0.001 : unit === 'm' ? 60 : 1);
}

function tokenize(text) {
  return text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/\|/g, ' | ').trim().split(/\s+/).filter(Boolean);
}

function parseCondition(tokens, line) {
  let position = 0;
  const peek = () => tokens[position];
  const parseOr = () => {
    const branches = [parseAnd()];
    while (peek() === '|') { position += 1; branches.push(parseAnd()); }
    return branches.length === 1 ? branches[0] : { kind: 'or', items: branches };
  };
  const parseAnd = () => {
    const items = [];
    while (position < tokens.length && peek() !== '|' && peek() !== ')') items.push(parseFactor());
    if (!items.length) throw new RangeError(`Rung ${line}: empty branch.`);
    return items.length === 1 ? items[0] : { kind: 'and', items };
  };
  const parseFactor = () => {
    const token = tokens[position++];
    if (token === '(') {
      const inner = parseOr();
      if (tokens[position++] !== ')') throw new RangeError(`Rung ${line}: missing ")".`);
      return inner;
    }
    let name = token, negated = false, edge = false;
    if (name.startsWith('/')) { negated = true; name = name.slice(1); }
    if (name.startsWith('^')) { edge = true; name = name.slice(1); }
    name = name.toUpperCase();
    if (!BIT.test(name) && !TIMER.test(name) && !COUNTER.test(name)) throw new RangeError(`Rung ${line}: unknown operand "${token}".`);
    return { kind: 'contact', name, negated, edge };
  };
  const tree = parseOr();
  if (position !== tokens.length) throw new RangeError(`Rung ${line}: unexpected "${tokens[position]}".`);
  return tree;
}

function parseOutput(text, line) {
  const parts = text.trim().split(/\s+/);
  const op = parts[0].toUpperCase();
  const target = (parts[1] ?? '').toUpperCase();
  if (BIT.test(op) && !op.startsWith('I')) return { kind: 'coil', name: op };
  if ((op === 'S' || op === 'R') && BIT.test(target) && !target.startsWith('I')) return { kind: op === 'S' ? 'set' : 'reset', name: target };
  if (['TON', 'TOF', 'TP'].includes(op)) {
    if (!TIMER.test(target)) throw new RangeError(`Rung ${line}: ${op} needs a timer T0–T15.`);
    return { kind: op.toLowerCase(), name: target, preset: parseDuration(parts[2], line) };
  }
  if (op === 'CTU' || op === 'CTD') {
    if (!COUNTER.test(target)) throw new RangeError(`Rung ${line}: ${op} needs a counter C0–C15.`);
    const preset = Number(parts[2]);
    if (!Number.isInteger(preset) || preset < 1) throw new RangeError(`Rung ${line}: the counter preset must be a whole number ≥ 1.`);
    return { kind: op.toLowerCase(), name: target, preset };
  }
  if (op === 'RES' && (TIMER.test(target) || COUNTER.test(target))) return { kind: 'res', name: target };
  throw new RangeError(`Rung ${line}: unknown output "${text.trim()}".`);
}

/** Parse a ladder program into rungs { condition, outputs, source }. */
export function parseLadder(text) {
  const rungs = [];
  String(text).split('\n').forEach((raw, index) => {
    const source = raw.replace(/#.*$/, '').trim();
    if (!source) return;
    const line = rungs.length + 1;
    const arrow = source.indexOf('->');
    if (arrow < 0) throw new RangeError(`Rung ${line}: use "condition -> output".`);
    const left = source.slice(0, arrow).trim(), right = source.slice(arrow + 2).trim();
    const condition = left === '' || left.toUpperCase() === 'ALWAYS' ? { kind: 'always' } : parseCondition(tokenize(left), line);
    const outputs = right.split(',').filter((part) => part.trim()).map((part) => parseOutput(part, line));
    if (!outputs.length) throw new RangeError(`Rung ${line}: no output.`);
    rungs.push({ condition, outputs, source, line: index + 1 });
  });
  if (!rungs.length) throw new RangeError('Write at least one rung.');
  if (rungs.length > 64) throw new RangeError('Use at most 64 rungs.');
  return rungs;
}

/** A fresh PLC memory image. */
export function createPlc() {
  return { bits: {}, timers: {}, counters: {}, edges: {}, outputEdges: {}, time: 0, scans: 0 };
}

const read = (plc, name) => {
  if (TIMER.test(name)) return Boolean(plc.timers[name]?.done);
  if (COUNTER.test(name)) return Boolean(plc.counters[name]?.done);
  return Boolean(plc.bits[name]);
};

function evaluate(node, plc, previous) {
  if (node.kind === 'always') return true;
  if (node.kind === 'and') return node.items.every((item) => evaluate(item, plc, previous));
  if (node.kind === 'or') return node.items.some((item) => evaluate(item, plc, previous));
  const value = read(plc, node.name);
  if (node.edge) { const was = Boolean(previous[node.name]); return node.negated ? (!value && was) : (value && !was); }
  return node.negated ? !value : value;
}

/** Collect every operand a program refers to (for the I/O panel). */
export function operands(rungs) {
  const names = new Set();
  const walk = (node) => { if (node.kind === 'contact') names.add(node.name); else if (node.items) node.items.forEach(walk); };
  rungs.forEach((rung) => { walk(rung.condition); rung.outputs.forEach((out) => names.add(out.name)); });
  const sorted = [...names].sort();
  return { inputs: sorted.filter((n) => n.startsWith('I')), outputs: sorted.filter((n) => n.startsWith('Q')), memory: sorted.filter((n) => n.startsWith('M')), timers: sorted.filter((n) => TIMER.test(n)), counters: sorted.filter((n) => COUNTER.test(n)) };
}

/**
 * One scan: copy the inputs into the image and solve the rungs top to bottom (results are visible
 * to later rungs in the same scan, as in a real PLC). dt is the time since the previous scan.
 */
export function scan(plc, rungs, inputs = {}, dt = 0.01) {
  for (const [name, value] of Object.entries(inputs)) plc.bits[name] = Boolean(value);
  const previous = { ...plc.edges };
  const powered = [];
  for (const rung of rungs) {
    const on = evaluate(rung.condition, plc, previous);
    powered.push(on);
    rung.outputs.forEach((out, k) => {
      const key = `${rung.line}:${k}`;
      const wasOn = Boolean(plc.outputEdges[key]);
      plc.outputEdges[key] = on;
      if (out.kind === 'coil') plc.bits[out.name] = on;
      else if (out.kind === 'set') { if (on) plc.bits[out.name] = true; }
      else if (out.kind === 'reset') { if (on) plc.bits[out.name] = false; }
      else if (out.kind === 'ton' || out.kind === 'tof' || out.kind === 'tp') {
        const t = plc.timers[out.name] ?? (plc.timers[out.name] = { elapsed: 0, done: false, preset: out.preset, kind: out.kind, running: false });
        t.preset = out.preset; t.kind = out.kind;
        if (out.kind === 'ton') {
          // Time counts from the scan that first saw the input on (dt is the time since the previous scan).
          if (on) { if (wasOn) t.elapsed = Math.min(out.preset, t.elapsed + dt); t.done = t.elapsed >= out.preset - 1e-9; t.running = !t.done; } else { t.elapsed = 0; t.done = false; t.running = false; }
        } else if (out.kind === 'tof') {
          if (on) { t.elapsed = 0; t.done = true; t.running = false; } else if (t.done) { if (!wasOn) t.elapsed = Math.min(out.preset, t.elapsed + dt); t.running = t.elapsed < out.preset - 1e-9; t.done = t.running; }
        } else {
          // Pulse timer: a rising edge starts a fixed-length pulse that ignores the input until it ends.
          if (t.running) { t.elapsed = Math.min(out.preset, t.elapsed + dt); if (t.elapsed >= out.preset - 1e-9) t.running = false; }
          else if (on && !wasOn) { t.running = true; t.elapsed = 0; }
          t.done = t.running;
        }
      } else if (out.kind === 'ctu' || out.kind === 'ctd') {
        const c = plc.counters[out.name] ?? (plc.counters[out.name] = { count: out.kind === 'ctd' ? out.preset : 0, done: false, preset: out.preset, kind: out.kind });
        c.preset = out.preset; c.kind = out.kind;
        if (on && !wasOn) c.count = out.kind === 'ctu' ? Math.min(32767, c.count + 1) : Math.max(0, c.count - 1);
        c.done = out.kind === 'ctu' ? c.count >= c.preset : c.count <= 0;
      } else if (out.kind === 'res' && on) {
        if (TIMER.test(out.name)) plc.timers[out.name] = { elapsed: 0, done: false, preset: plc.timers[out.name]?.preset ?? 0, kind: plc.timers[out.name]?.kind ?? 'ton', running: false };
        else { const c = plc.counters[out.name]; plc.counters[out.name] = { count: c?.kind === 'ctd' ? c.preset : 0, done: false, preset: c?.preset ?? 0, kind: c?.kind ?? 'ctu' }; }
      }
    });
  }
  // Edge memory for ^contacts: remember every operand's value at the end of this scan.
  for (const name of Object.keys(plc.bits)) plc.edges[name] = plc.bits[name];
  for (const name of Object.keys(plc.timers)) plc.edges[name] = plc.timers[name].done;
  for (const name of Object.keys(plc.counters)) plc.edges[name] = plc.counters[name].done;
  plc.time += dt;
  plc.scans += 1;
  return powered;
}

/** Parse an input script such as "0.5 I0.0=1; 0.7 I0.0=0" into sorted events. */
export function parseInputScript(text) {
  return String(text).split(/[;\n]/).map((part) => part.trim()).filter(Boolean).map((part, index) => {
    const match = /^(\d+(?:\.\d+)?)\s*s?\s+([IQM][0-7]\.[0-7])\s*=\s*([01])$/i.exec(part);
    if (!match) throw new RangeError(`Input event ${index + 1}: write "time I0.0=1".`);
    return { time: Number(match[1]), name: match[2].toUpperCase(), value: match[3] === '1' };
  }).sort((a, b) => a.time - b.time);
}

/** Run a program against scripted input events; returns sampled traces of the chosen signals. */
export function runLadder(rungs, { events = [], duration = 10, scanTime = 0.01, watch = null } = {}) {
  if (!(scanTime > 0) || duration / scanTime > 200000) throw new RangeError('Choose a scan time that gives at most 200 000 scans.');
  const plc = createPlc();
  const list = operands(rungs);
  const names = watch ?? [...list.inputs, ...list.outputs, ...list.memory, ...list.timers, ...list.counters];
  const traces = Object.fromEntries(names.map((name) => [name, []]));
  const times = [];
  const inputs = {};
  let next = 0;
  const steps = Math.round(duration / scanTime);
  const every = Math.max(1, Math.floor(steps / 2000));
  for (let k = 0; k <= steps; k += 1) {
    const t = k * scanTime;
    while (next < events.length && events[next].time <= t + 1e-9) { inputs[events[next].name] = events[next].value; next += 1; }
    scan(plc, rungs, inputs, scanTime);
    if (k % every === 0 || k === steps) { times.push(t); names.forEach((name) => traces[name].push(read(plc, name) ? 1 : 0)); }
  }
  return { times, traces, plc, names };
}

/** First time (s) a trace becomes 1 after `after`, or null. */
export function firstRise(result, name, after = 0) {
  const trace = result.traces[name];
  for (let k = 1; k < trace.length; k += 1) if (result.times[k] >= after && trace[k] && !trace[k - 1]) return result.times[k];
  return null;
}

// ---------------------------------------------------------------------------
// Layout for drawing: each node becomes a box of width w (cells) and height h (rows).

export function layoutCondition(node) {
  if (node.kind === 'contact' || node.kind === 'always') return { ...node, w: 1, h: 1 };
  const items = node.items.map(layoutCondition);
  if (node.kind === 'and') return { kind: 'and', items, w: items.reduce((s, i) => s + i.w, 0), h: Math.max(...items.map((i) => i.h)) };
  return { kind: 'or', items, w: Math.max(...items.map((i) => i.w)), h: items.reduce((s, i) => s + i.h, 0) };
}

export const LADDER_EXAMPLES = Object.freeze({
  motor: ['Motor start/stop with seal-in', '# I0.0 = START push button, I0.1 = STOP push button\n(I0.0 | Q0.0) /I0.1 -> Q0.0\nQ0.0 -> Q0.1   # run lamp', '0.5 I0.0=1; 0.7 I0.0=0; 4 I0.1=1; 4.2 I0.1=0; 6 I0.0=1; 6.1 I0.0=0'],
  interlock: ['Forward/reverse with interlock', '(I0.0 | Q0.0) /I0.2 /Q0.1 -> Q0.0   # forward\n(I0.1 | Q0.1) /I0.2 /Q0.0 -> Q0.1   # reverse, blocked while forward runs', '0.5 I0.0=1; 0.7 I0.0=0; 2 I0.1=1; 2.2 I0.1=0; 4 I0.2=1; 4.2 I0.2=0; 5 I0.1=1; 5.2 I0.1=0'],
  traffic: ['Traffic light (TON chain)', '# Red 5 s → green 4 s → amber 2 s, repeating\n/T2 -> TON T0 5s\nT0 -> TON T1 4s\nT1 -> TON T2 2s\n/T0 -> Q0.0   # red\nT0 /T1 -> Q0.1   # green\nT1 -> Q0.2   # amber', ''],
  stardelta: ['Star–delta starter', '(I0.0 | M0.0) /I0.1 -> M0.0   # run\nM0.0 -> Q0.0, TON T0 3s   # main contactor\nM0.0 /T0 /Q0.2 -> Q0.1   # star\nM0.0 T0 /Q0.1 -> Q0.2   # delta after 3 s', '0.5 I0.0=1; 0.7 I0.0=0; 8 I0.1=1; 8.2 I0.1=0'],
  counter: ['Bottle counter (CTU)', '# I0.0 = bottle sensor, I0.1 = reset; box full after 6 bottles\n^I0.0 -> CTU C0 6\nC0 -> Q0.0   # box full lamp\nI0.1 -> RES C0', '0.5 I0.0=1; 0.6 I0.0=0; 1 I0.0=1; 1.1 I0.0=0; 1.5 I0.0=1; 1.6 I0.0=0; 2 I0.0=1; 2.1 I0.0=0; 2.5 I0.0=1; 2.6 I0.0=0; 3 I0.0=1; 3.1 I0.0=0; 5 I0.1=1; 5.1 I0.1=0'],
  alarm: ['Alarm latch with acknowledge', 'I0.0 -> S M0.0   # fault latches the alarm\nI0.1 /I0.0 -> R M0.0   # acknowledge clears it once the fault is gone\nM0.0 T0 -> Q0.0   # flashing lamp (on while T1 times)\nM0.0 /T1 -> TON T0 500ms\nT0 -> TON T1 500ms', '1 I0.0=1; 1.5 I0.0=0; 4 I0.1=1; 4.2 I0.1=0'],
});
