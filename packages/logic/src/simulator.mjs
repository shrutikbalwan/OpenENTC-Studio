// Event-driven gate-level logic simulator for the Digital Logic Lab.
// Netlists are short text programs; every gate and flip-flop has a 1 ns delay,
// so propagation delay, glitches and latch races are visible in the timing diagram.

export const GATE_DELAY_NS = 1;
export const MAX_ELEMENTS = 500;
export const MAX_STOP_TIME_NS = 100_000;
const MAX_EVENTS = 500_000;
const MAX_COMBINATIONAL_INPUTS = 8;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GATES = { and: [2, 16], or: [2, 16], nand: [2, 16], nor: [2, 16], xor: [2, 16], xnor: [2, 16], not: [1, 1], buf: [1, 1], mux: [3, 3] };
const FLIP_FLOPS = { dff: ['D'], tff: ['T'], jkff: ['J', 'K'] };

/**
 * Parse a netlist. Lines:
 *   input A B [C=1]              toggle inputs (default 0); `X pattern=0110 step=20` plays bits
 *   clock CLK [period=20]        square wave starting low, first rising edge at period/2
 *   output S Cout                signals shown as LEDs
 *   and|or|nand|nor|xor|xnor Y = A B ...   not|buf Y = A   mux Y = S I0 I1
 *   dff Q [QN] = D CLK [RST]     tff Q [QN] = T CLK [RST]   jkff Q [QN] = J K CLK [RST]
 * Inputs may also be the constants 0 and 1. Comments start with # or //.
 */
export function parseNetlist(text) {
  if (typeof text !== 'string') throw new TypeError('Netlist must be text.');
  if (text.length > 64 * 1024) throw new RangeError('Netlist exceeds 64 KiB.');
  const inputs = [], clocks = [], outputs = [], elements = [];
  const drivers = new Map();
  const drive = (signal, line) => {
    if (!NAME.test(signal)) throw new SyntaxError(`Line ${line}: "${signal}" is not a valid signal name.`);
    if (drivers.has(signal)) throw new SyntaxError(`Line ${line}: signal ${signal} is already driven on line ${drivers.get(signal)}.`);
    drivers.set(signal, line);
  };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const content = raw.replace(/(#|\/\/).*$/, '').trim();
    if (!content) return;
    const [keyword, ...rest] = content.split(/\s+/);
    const kind = keyword.toLowerCase();
    if (kind === 'input') {
      if (!rest.length) throw new SyntaxError(`Line ${line}: list at least one input name.`);
      const options = Object.fromEntries(rest.filter((token) => /^(pattern|step)=/.test(token)).map((token) => token.split('=')));
      const names = rest.filter((token) => !/^(pattern|step)=/.test(token));
      if (options.pattern !== undefined && (names.length !== 1 || !/^[01]{1,256}$/.test(options.pattern))) throw new SyntaxError(`Line ${line}: pattern= takes up to 256 bits for a single input.`);
      for (const token of names) {
        const [name, value = '0'] = token.split('=');
        if (!['0', '1'].includes(value)) throw new SyntaxError(`Line ${line}: input ${name} must start at 0 or 1.`);
        drive(name, line);
        inputs.push({ name, value: Number(value), pattern: options.pattern ?? null, step: options.step === undefined ? 20 : boundedInteger(options.step, 1, 10_000, `Line ${line}: step`) });
      }
      return;
    }
    if (kind === 'clock') {
      const name = rest[0];
      const period = rest.find((token) => token.startsWith('period='));
      if (!name || name.includes('=')) throw new SyntaxError(`Line ${line}: name the clock, e.g. clock CLK period=20.`);
      drive(name, line);
      clocks.push({ name, period: period ? boundedInteger(period.slice(7), 4, 100_000, `Line ${line}: period`) : 20 });
      if (clocks.at(-1).period % 2) throw new SyntaxError(`Line ${line}: clock period must be an even number of ns.`);
      return;
    }
    if (kind === 'output') { for (const name of rest) { if (!NAME.test(name)) throw new SyntaxError(`Line ${line}: "${name}" is not a valid signal name.`); outputs.push(name); } return; }
    const equals = rest.indexOf('=');
    if (equals < 1) throw new SyntaxError(`Line ${line}: expected "${kind} OUTPUT = INPUTS".`);
    const targets = rest.slice(0, equals), sources = rest.slice(equals + 1);
    for (const source of sources) if (!NAME.test(source) && source !== '0' && source !== '1') throw new SyntaxError(`Line ${line}: "${source}" is not a valid signal name or constant.`);
    if (GATES[kind]) {
      const [minimum, maximum] = GATES[kind];
      if (targets.length !== 1) throw new SyntaxError(`Line ${line}: a ${kind} gate has one output.`);
      if (sources.length < minimum || sources.length > maximum) throw new SyntaxError(`Line ${line}: ${kind} takes ${minimum === maximum ? minimum : `${minimum} to ${maximum}`} input${maximum === 1 ? '' : 's'}.`);
      drive(targets[0], line);
      elements.push({ kind, outputs: targets, inputs: sources, line });
    } else if (FLIP_FLOPS[kind]) {
      const data = FLIP_FLOPS[kind].length;
      if (targets.length < 1 || targets.length > 2) throw new SyntaxError(`Line ${line}: ${kind} drives Q and an optional inverted QN.`);
      if (sources.length < data + 1 || sources.length > data + 2) throw new SyntaxError(`Line ${line}: ${kind} inputs are ${[...FLIP_FLOPS[kind], 'CLK', '[RST]'].join(' ')}.`);
      for (const target of targets) drive(target, line);
      elements.push({ kind, outputs: targets, inputs: sources, line, data, sequential: true });
    } else throw new SyntaxError(`Line ${line}: unknown element "${keyword}".`);
  });
  if (elements.length > MAX_ELEMENTS) throw new RangeError(`Netlists are limited to ${MAX_ELEMENTS} elements.`);
  for (const element of elements) for (const source of element.inputs) if (NAME.test(source) && !drivers.has(source)) throw new SyntaxError(`Line ${element.line}: signal ${source} is used but never driven.`);
  for (const name of outputs) if (!drivers.has(name)) throw new SyntaxError(`Output ${name} is never driven.`);
  if (!elements.length) throw new SyntaxError('Add at least one gate or flip-flop.');
  return { inputs, clocks, outputs, elements, signals: [...drivers.keys()] };
}

function boundedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}

const invert = (value) => value === 'x' ? 'x' : value === '1' ? '0' : '1';
const reduceAnd = (values) => values.includes('0') ? '0' : values.includes('x') ? 'x' : '1';
const reduceOr = (values) => values.includes('1') ? '1' : values.includes('x') ? 'x' : '0';
const reduceXor = (values) => values.includes('x') ? 'x' : String(values.filter((value) => value === '1').length % 2);

function evaluateGate(kind, values) {
  switch (kind) {
    case 'and': return reduceAnd(values);
    case 'nand': return invert(reduceAnd(values));
    case 'or': return reduceOr(values);
    case 'nor': return invert(reduceOr(values));
    case 'xor': return reduceXor(values);
    case 'xnor': return invert(reduceXor(values));
    case 'not': return invert(values[0]);
    case 'buf': return values[0];
    case 'mux': { const [select, zero, one] = values; return select === '0' ? zero : select === '1' ? one : zero === one ? zero : 'x'; }
    default: throw new TypeError(`Unknown gate ${kind}.`);
  }
}

function nextFlipFlopState(element, data, current) {
  if (data.includes('x')) return 'x';
  if (element.kind === 'dff') return data[0];
  if (element.kind === 'tff') return data[0] === '1' ? invert(current) : current;
  const [j, k] = data;
  return j === '0' && k === '0' ? current : j === '1' && k === '1' ? invert(current) : j;
}

/**
 * Simulate for `stopTime` ns. `values` overrides input start values by name. Flip-flops
 * power up at 0; gate outputs start unknown (x) until their inputs settle.
 */
export function simulateNetlist(netlistOrText, { stopTime, values = {} } = {}) {
  const netlist = typeof netlistOrText === 'string' ? parseNetlist(netlistOrText) : netlistOrText;
  const longestClock = Math.max(0, ...netlist.clocks.map((clock) => clock.period));
  const stop = boundedInteger(stopTime ?? (longestClock ? longestClock * 8 : 50), 1, MAX_STOP_TIME_NS, 'Stop time');
  const signal = new Map(netlist.signals.map((name) => [name, 'x']));
  const read = (name) => name === '0' || name === '1' ? name : signal.get(name);
  const fanout = new Map();
  netlist.elements.forEach((element, index) => element.inputs.forEach((name) => { if (!fanout.has(name)) fanout.set(name, new Set()); fanout.get(name).add(index); }));
  const queue = new Map();
  const schedule = (time, name, value) => { if (time > stop) return; if (!queue.has(time)) queue.set(time, new Map()); queue.get(time).set(name, value); };
  const samples = new Map(netlist.signals.map((name) => [name, []]));
  for (const input of netlist.inputs) {
    const start = values[input.name] === undefined ? input.value : Number(values[input.name]);
    if (input.pattern) [...input.pattern].forEach((bit, index) => schedule(index * input.step, input.name, bit));
    else schedule(0, input.name, String(start));
  }
  for (const clock of netlist.clocks) for (let time = 0, level = 0; time <= stop; time += clock.period / 2, level ^= 1) schedule(time, clock.name, String(level));
  for (const element of netlist.elements) if (element.sequential) { schedule(0, element.outputs[0], '0'); if (element.outputs[1]) schedule(0, element.outputs[1], '1'); }
  const pending = new Set(netlist.elements.map((_, index) => index).filter((index) => !netlist.elements[index].sequential));
  const constantInputs = new Set(netlist.elements.map((element, index) => element.inputs.every((name) => name === '0' || name === '1') ? index : -1).filter((index) => index >= 0));
  let events = 0;
  let oscillating = false;
  const warnings = [];
  const evaluate = (time, changed, before) => {
    const triggered = new Set();
    for (const name of changed) for (const index of fanout.get(name) ?? []) triggered.add(index);
    if (time === 0) { for (const index of pending) triggered.add(index); for (const index of constantInputs) triggered.add(index); }
    for (const index of triggered) {
      const element = netlist.elements[index];
      if (!element.sequential) { schedule(time + GATE_DELAY_NS, element.outputs[0], evaluateGate(element.kind, element.inputs.map(read))); continue; }
      const clockName = element.inputs[element.data], resetName = element.inputs[element.data + 1];
      const current = read(element.outputs[0]);
      let next = null;
      if (resetName && read(resetName) === '1') next = '0';
      else if (changed.has(clockName) && before.get(clockName) === '0' && read(clockName) === '1') {
        // Data is sampled just before the clock edge (setup), as in a real edge-triggered flip-flop.
        next = nextFlipFlopState(element, element.inputs.slice(0, element.data).map((name) => name === '0' || name === '1' ? name : before.get(name)), current);
      } else if (resetName && changed.has(resetName) && read(resetName) === 'x') next = 'x';
      if (next !== null && next !== current) { schedule(time + GATE_DELAY_NS, element.outputs[0], next); if (element.outputs[1]) schedule(time + GATE_DELAY_NS, element.outputs[1], invert(next)); }
    }
  };
  for (let time = 0; time <= stop; time += 1) {
    const updates = queue.get(time);
    queue.delete(time);
    if (!updates && time !== 0) continue;
    const before = new Map(signal);
    const changed = new Set();
    for (const [name, value] of updates ?? []) {
      if (signal.get(name) === value) continue;
      signal.set(name, value);
      samples.get(name).push({ time, value });
      changed.add(name);
      events += 1;
    }
    if (events > MAX_EVENTS) { oscillating = true; warnings.push(`Simulation stopped at ${time} ns after ${MAX_EVENTS} events; the circuit is oscillating.`); break; }
    evaluate(time, changed, before);
  }
  // An internal signal still toggling at a steady interval faster than any clock is a
  // free-running feedback loop (ring oscillator or latch race).
  const driven = new Set([...netlist.clocks.map((clock) => clock.name), ...netlist.inputs.map((input) => input.name)]);
  const fastest = netlist.clocks.length ? Math.min(...netlist.clocks.map((clock) => clock.period / 2)) : 10;
  for (const [name, list] of samples) {
    if (oscillating || driven.has(name)) continue;
    const tail = list.slice(-10);
    if (tail.length < 10) continue;
    const interval = tail[1].time - tail[0].time;
    const steady = tail.every((sample, index) => !index || sample.time - tail[index - 1].time === interval);
    if (steady && interval < fastest && tail.at(-1).time >= stop - 2 * interval) { oscillating = true; warnings.push(`Signal ${name} keeps toggling every ${interval} ns: the circuit contains an unstable feedback loop.`); }
  }
  const order = [...netlist.clocks.map((clock) => clock.name), ...netlist.inputs.map((input) => input.name), ...netlist.outputs, ...netlist.signals];
  const names = [...new Set(order)];
  return {
    kind: 'digital-trace', timescale: '1 ns', stopTime: stop,
    signals: names.map((name) => ({ id: name, name, fullName: name, scope: '', width: 1, samples: samples.get(name) })),
    final: Object.fromEntries(names.map((name) => [name, signal.get(name)])),
    oscillating, warnings,
  };
}

/** Exhaustively apply every input combination to a combinational netlist and tabulate outputs. */
export function analyzeCombinational(netlistOrText) {
  const netlist = typeof netlistOrText === 'string' ? parseNetlist(netlistOrText) : netlistOrText;
  if (netlist.clocks.length || netlist.elements.some((element) => element.sequential)) throw new Error('Truth-table analysis needs a combinational circuit (no clocks or flip-flops).');
  if (netlist.inputs.length > MAX_COMBINATIONAL_INPUTS) throw new RangeError(`Truth-table analysis supports up to ${MAX_COMBINATIONAL_INPUTS} inputs.`);
  const outputs = netlist.outputs.length ? netlist.outputs : netlist.elements.map((element) => element.outputs[0]);
  const settle = netlist.elements.length * GATE_DELAY_NS + 2;
  const variables = netlist.inputs.map((input) => input.name);
  const rows = [];
  for (let index = 0; index < 2 ** variables.length; index += 1) {
    const inputs = variables.map((_, bit) => (index >> (variables.length - 1 - bit)) & 1);
    const result = simulateNetlist({ ...netlist, inputs: netlist.inputs.map((input) => ({ ...input, pattern: null })) }, { stopTime: settle, values: Object.fromEntries(variables.map((name, bit) => [name, inputs[bit]])) });
    if (result.oscillating) throw new Error(`The circuit does not settle for inputs ${inputs.join('')}.`);
    rows.push({ index, inputs, outputs: outputs.map((name) => result.final[name]) });
  }
  return { variables, outputs, rows, minterms: Object.fromEntries(outputs.map((name, column) => [name, rows.filter((row) => row.outputs[column] === '1').map((row) => row.index)])) };
}

/** Starter circuits for the lab. */
export const LOGIC_TEMPLATES = Object.freeze([
  { id: 'half-adder', name: 'Half adder', text: 'input A B\noutput S C\nxor S = A B\nand C = A B\n' },
  { id: 'full-adder', name: 'Full adder', text: 'input A B Cin\noutput S Cout\nxor P = A B\nxor S = P Cin\nand G = A B\nand T = P Cin\nor Cout = G T\n' },
  { id: 'mux2', name: '2:1 multiplexer from gates', text: '# Y = S\'·I0 + S·I1\ninput S I0 I1\noutput Y\nnot SN = S\nand T0 = SN I0\nand T1 = S I1\nor Y = T0 T1\n' },
  { id: 'decoder', name: '2-to-4 decoder', text: 'input A1 A0\noutput Y0 Y1 Y2 Y3\nnot N1 = A1\nnot N0 = A0\nand Y0 = N1 N0\nand Y1 = N1 A0\nand Y2 = A1 N0\nand Y3 = A1 A0\n' },
  { id: 'sr-latch', name: 'SR latch (cross-coupled NOR)', text: '# Set, then reset: watch Q hold its state in between.\ninput S pattern=0100000 step=20\ninput R pattern=0000100 step=20\noutput Q QN\nnor Q = R QN\nnor QN = S Q\n' },
  { id: 'ripple-counter', name: '4-bit ripple counter', text: '# Each stage toggles on the falling edge of the previous Q (rising edge of QN).\nclock CLK period=20\noutput Q3 Q2 Q1 Q0\ntff Q0 Q0N = 1 CLK\ntff Q1 Q1N = 1 Q0N\ntff Q2 Q2N = 1 Q1N\ntff Q3 Q3N = 1 Q2N\n' },
  { id: 'sync-counter', name: '3-bit synchronous counter', text: 'clock CLK period=20\noutput Q2 Q1 Q0\ntff Q0 = 1 CLK\ntff Q1 = Q0 CLK\nand T2 = Q0 Q1\ntff Q2 = T2 CLK\n' },
  { id: 'shift-register', name: '4-bit shift register', text: 'clock CLK period=20\ninput DIN pattern=1011000 step=20\noutput Q0 Q1 Q2 Q3\ndff Q0 = DIN CLK\ndff Q1 = Q0 CLK\ndff Q2 = Q1 CLK\ndff Q3 = Q2 CLK\n' },
  { id: 'johnson', name: '4-bit Johnson counter', text: 'clock CLK period=20\noutput Q0 Q1 Q2 Q3\ndff Q0 = Q3N CLK\ndff Q1 = Q0 CLK\ndff Q2 = Q1 CLK\ndff Q3 Q3N = Q2 CLK\n' },
]);
