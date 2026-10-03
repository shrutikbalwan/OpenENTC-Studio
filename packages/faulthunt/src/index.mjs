// Fault Hunt: hidden-fault troubleshooting practice. A board (Circuit Lab component list) gets one
// secret fault; the student measures node voltages (power on) or resistance between nodes (power
// off) with a virtual multimeter, then names the faulty part and the kind of fault.
// The circuit solver is injected (solveDC(components) → { nodes }), so the package has no UI or
// engine dependency.

const part = (id, type, value, unit, n1, n2, x, y) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation: 0 });
const device = (id, type, value, unit, [n1, n2, n3], x, y) => ({ id, type, label: id, value, unit, n1, n2, n3, x, y, rotation: 0 });

export const BOARDS = Object.freeze({
  divider: {
    name: 'Resistor network (6 resistors)', level: 'Beginner',
    description: 'A 12 V supply feeding a ladder of resistors. Every node has a definite voltage you can work out by hand.',
    components: [part('V1', 'voltage', 12, 'V', 'vcc', '0', 80, 160), part('R1', 'resistor', 1000, 'Ω', 'vcc', 'a', 200, 80), part('R2', 'resistor', 2200, 'Ω', 'a', '0', 260, 200), part('R3', 'resistor', 1000, 'Ω', 'a', 'b', 340, 80), part('R4', 'resistor', 3300, 'Ω', 'b', '0', 400, 200), part('R5', 'resistor', 1500, 'Ω', 'b', 'c', 480, 80), part('R6', 'resistor', 4700, 'Ω', 'c', '0', 540, 200)],
  },
  led: {
    name: 'LED indicator with transistor switch', level: 'Beginner',
    description: 'A 5 V logic signal switches an LED through an NPN transistor.',
    components: [part('VCC', 'voltage', 9, 'V', 'vcc', '0', 80, 100), part('VIN', 'voltage', 5, 'V', 'in', '0', 80, 240), part('RB', 'resistor', 10000, 'Ω', 'in', 'b', 200, 240), part('RL', 'resistor', 330, 'Ω', 'vcc', 'a', 340, 60), part('D1', 'led', 2, 'Vf', 'a', 'c', 340, 140), device('Q1', 'npn', 100, 'β', ['c', 'b', '0'], 340, 240), part('RBE', 'resistor', 47000, 'Ω', 'b', '0', 230, 320)],
  },
  bias: {
    name: 'CE amplifier bias network', level: 'Intermediate',
    description: 'Voltage-divider biased common-emitter stage. Find the fault from the DC operating point.',
    components: [part('VCC', 'voltage', 12, 'V', 'vcc', '0', 80, 160), part('R1', 'resistor', 47000, 'Ω', 'vcc', 'b', 220, 80), part('R2', 'resistor', 9100, 'Ω', 'b', '0', 220, 260), device('Q1', 'npn', 100, 'β', ['c', 'b', 'e'], 360, 170), part('RC', 'resistor', 2400, 'Ω', 'vcc', 'c', 480, 80), part('RE', 'resistor', 620, 'Ω', 'e', '0', 480, 260), part('CE', 'capacitor', 22e-6, 'F', 'e', '0', 600, 260)],
  },
  opamp: {
    name: 'Inverting op-amp amplifier (gain −4.7)', level: 'Intermediate',
    description: 'A 0.5 V DC input into an inverting amplifier with ±15 V rails.',
    components: [part('VIN', 'voltage', 0.5, 'V', 'in', '0', 80, 170), part('R1', 'resistor', 10000, 'Ω', 'in', 'm', 220, 120), device('U1', 'opamp', 15, 'Vsat', ['0', 'm', 'out'], 380, 180), part('R2', 'resistor', 47000, 'Ω', 'm', 'out', 380, 60), part('RL', 'resistor', 10000, 'Ω', 'out', '0', 540, 180)],
  },
  regulator: {
    name: 'Shunt voltage reference with load', level: 'Advanced',
    description: '12 V into a shunt reference built from four diodes in series (about 5 V, like a Zener) feeding a load.',
    components: [part('VIN', 'voltage', 12, 'V', 'in', '0', 80, 160), part('RS', 'resistor', 270, 'Ω', 'in', 'out', 220, 80), part('D1', 'diode', 1.3, 'Vf', 'out', 'k1', 360, 120), part('D2', 'diode', 1.3, 'Vf', 'k1', 'k2', 360, 180), part('D3', 'diode', 1.3, 'Vf', 'k2', 'k3', 360, 240), part('D4', 'diode', 1.3, 'Vf', 'k3', '0', 360, 300), part('RL', 'resistor', 1000, 'Ω', 'out', '0', 500, 200), part('C1', 'capacitor', 100e-6, 'F', 'out', '0', 600, 200)],
  },
});

export const FAULT_TYPES = Object.freeze({
  open: 'Open circuit (broken / dry joint)',
  short: 'Short circuit',
  high: 'Value too high (drifted / wrong part)',
  low: 'Value too low (wrong part)',
  dead: 'Dead device (no conduction)',
  leaky: 'Leaky (conducts when it should not)',
});

/** Fault kinds that make sense for a part type. */
export function faultsFor(type) {
  if (type === 'resistor') return ['open', 'short', 'high', 'low'];
  if (type === 'capacitor') return ['short', 'leaky'];
  if (type === 'diode' || type === 'led') return ['open', 'short'];
  if (type === 'npn' || type === 'pnp' || type === 'nmos' || type === 'pmos') return ['dead', 'short'];
  if (type === 'opamp') return ['dead'];
  return [];
}

function random(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Pick a fault that actually changes at least one node voltage by more than `minimumChange`. */
export function chooseFault(board, seed, solveDC, { minimumChange = 0.05 } = {}) {
  const rand = random(seed);
  const candidates = board.components.flatMap((p) => faultsFor(p.type).map((kind) => ({ id: p.id, kind })));
  if (!candidates.length) throw new RangeError('This board has no parts that can fail.');
  const healthy = solveDC(board.components).nodes;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const fault = { ...candidates[Math.floor(rand() * candidates.length)], factor: 3 + Math.floor(rand() * 8) };
    try {
      const faulty = solveDC(applyFault(board.components, fault)).nodes;
      const change = Math.max(...Object.keys(healthy).map((n) => Math.abs((faulty[n] ?? 0) - healthy[n])));
      if (change > minimumChange) return fault;
    } catch { /* a fault that the solver cannot handle is skipped */ }
  }
  throw new RangeError('Could not find a visible fault on this board.');
}

/** Apply a fault to a copy of the components (models: open = 1 GΩ, short = 1 mΩ, dead device removed or isolated). */
export function applyFault(components, fault) {
  const list = structuredClone(components);
  const index = list.findIndex((p) => p.id === fault.id);
  if (index < 0) throw new RangeError(`No part ${fault.id}.`);
  const p = list[index];
  const asResistor = (value, n1 = p.n1, n2 = p.n2) => ({ ...p, type: 'resistor', value, unit: 'Ω', n1, n2 });
  const factor = fault.factor ?? 5;
  if (p.type === 'resistor') {
    if (fault.kind === 'open') p.value = 1e9;
    else if (fault.kind === 'short') p.value = 1e-3;
    else if (fault.kind === 'high') p.value *= factor;
    else if (fault.kind === 'low') p.value /= factor;
  } else if (p.type === 'capacitor') {
    list[index] = asResistor(fault.kind === 'short' ? 1e-3 : 470);
  } else if (p.type === 'diode' || p.type === 'led') {
    list[index] = asResistor(fault.kind === 'open' ? 1e9 : 1e-3);
  } else if (['npn', 'pnp', 'nmos', 'pmos'].includes(p.type)) {
    // Dead: collector–emitter (drain–source) open, base/gate floating; short: C–E (D–S) shorted.
    if (fault.kind === 'dead') list[index] = asResistor(1e9, p.n1, p.n3);
    else list[index] = asResistor(1e-3, p.n1, p.n3);
    if (fault.kind === 'dead') list.push({ ...asResistor(1e9, p.n2, p.n3), id: `${p.id}__b` });
  } else if (p.type === 'opamp') {
    // Dead op-amp: output stuck near 0 V through its output resistance, inputs high impedance.
    list[index] = asResistor(100, p.n3, '0');
    list.push({ ...asResistor(1e9, p.n1, p.n2), id: `${p.id}__in` });
  }
  return list;
}

/** Power-on DC voltage between two nets (red, black). */
export function measureVoltage(components, red, black, solveDC) {
  const nodes = solveDC(components).nodes;
  if (!(red in nodes) || !(black in nodes)) throw new RangeError('Probe a net that exists on the board.');
  return nodes[red] - nodes[black];
}

/**
 * Power-off resistance between two nets: every source is disconnected (voltage sources opened,
 * capacitors open at DC) and a 1 mA test current is driven from red to black, as a DMM does.
 */
export function measureResistance(components, red, black, solveDC) {
  if (red === black) return 0;
  const powerOff = components.filter((p) => p.type !== 'voltage' && p.type !== 'current' && p.type !== 'ground');
  // Keep every net referenced so the solver has a ground; tie the black probe to ground.
  const test = [...powerOff, { id: '__IT', type: 'current', label: '__IT', value: 1e-3, unit: 'A', n1: black, n2: red, x: 0, y: 0, rotation: 0 }];
  const relabel = (net) => (net === black ? '0' : net === '0' ? black : net);
  const shifted = test.map((p) => ({ ...p, n1: relabel(p.n1), n2: relabel(p.n2), ...(p.n3 !== undefined ? { n3: relabel(p.n3) } : {}) }));
  // Tie every net to ground through 100 MΩ so floating sections still solve (like the meter's input).
  const nets = [...new Set(shifted.flatMap((p) => [p.n1, p.n2, p.n3].filter((n) => n !== undefined && n !== '0')))];
  const bleed = nets.map((net, k) => ({ id: `__B${k}`, type: 'resistor', label: '__B', value: 1e8, unit: 'Ω', n1: net, n2: '0', x: 0, y: 0, rotation: 0 }));
  const nodes = solveDC([...shifted, ...bleed]).nodes;
  const v = nodes[relabel(red)] ?? 0;
  const r = v / 1e-3;
  return r > 5e7 ? Infinity : r;
}

/** Score a hunt: 100 − 4 per measurement beyond five − 25 per wrong diagnosis − 20 for peeking. */
export function score({ measurements = 0, wrongGuesses = 0, peeked = false, solved = false } = {}) {
  if (!solved) return 0;
  return Math.max(10, 100 - 4 * Math.max(0, measurements - 5) - 25 * wrongGuesses - (peeked ? 20 : 0));
}

/** Healthy and faulty voltages at every net, for the debrief after the hunt. */
export function debrief(board, fault, solveDC) {
  const healthy = solveDC(board.components).nodes, faulty = solveDC(applyFault(board.components, fault)).nodes;
  return Object.keys(healthy).filter((n) => n !== '0').sort().map((net) => ({ net, healthy: healthy[net], faulty: faulty[net] ?? 0, change: (faulty[net] ?? 0) - healthy[net] }));
}

/** Nets on a board (for the probe selectors). */
export const boardNets = (board) => [...new Set(board.components.flatMap((p) => [p.n1, p.n2, p.n3].filter((n) => n !== undefined)))].sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : a.localeCompare(b)));
