// Circuit theory: a phasor (complex) modified-nodal-analysis solver for netlists with
// independent and dependent sources, the network theorems (Thévenin, Norton, superposition,
// maximum power transfer), star–delta conversion and two-port parameters with conversions.

// ---------------------------------------------------------------------------
// Complex numbers as [re, im].
export const C = {
  of: (re, im = 0) => [re, im],
  polar: (magnitude, degrees) => [magnitude * Math.cos(degrees * Math.PI / 180), magnitude * Math.sin(degrees * Math.PI / 180)],
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; if (d === 0) throw new RangeError('division by zero'); return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  neg: (a) => [-a[0], -a[1]],
  conj: (a) => [a[0], -a[1]],
  abs: (a) => Math.hypot(a[0], a[1]),
  arg: (a) => Math.atan2(a[1], a[0]) * 180 / Math.PI,
  scale: (a, k) => [a[0] * k, a[1] * k],
};

/** Solve the complex linear system A·x = b (Gaussian elimination with partial pivoting). */
export function solveComplex(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row.map((value) => [...value]), [...vector[i]]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (C.abs(a[row][col]) > C.abs(a[pivot][col])) pivot = row;
    if (C.abs(a[pivot][col]) < 1e-14) throw new RangeError('The circuit has no unique solution (a floating node, a loop of voltage sources or a cut-set of current sources).');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = C.div(a[row][col], a[col][col]);
      if (factor[0] === 0 && factor[1] === 0) continue;
      for (let k = col; k <= n; k += 1) a[row][k] = C.sub(a[row][k], C.mul(factor, a[col][k]));
    }
  }
  return a.map((row, i) => C.div(row[n], row[i]));
}

// ---------------------------------------------------------------------------
// Netlist.

const SUFFIX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, k: 1e3, meg: 1e6, g: 1e9, t: 1e12 };
export function parseValue(text) {
  const match = String(text).trim().toLowerCase().match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(meg|[fpnuµmkgt])?[a-zω]*$/);
  if (!match) throw new RangeError(`"${text}" is not a number.`);
  return Number(match[1]) * (match[2] ? SUFFIX[match[2]] : 1);
}

/**
 * Netlist lines (SPICE-like): `R1 a b 4k`, `L1 a b 10m`, `C1 a b 1u`, `V1 a b 10` or
 * `V1 a b 10 30` (magnitude, phase°), `I1 a b 2`, `E1 o+ o- c+ c- gain` (VCVS),
 * `G1 o+ o- c+ c- gm` (VCCS), `F1 o+ o- Vname gain` (CCCS), `H1 o+ o- Vname r` (CCVS).
 * Ground is node 0; `*` or `;` start a comment. A current source's current flows from its first
 * node through the source to the second.
 */
export function parseNetlist(text) {
  const elements = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/[;*].*$/, '').trim();
    if (!line || line.startsWith('.')) return;
    const parts = line.split(/[\s,]+/);
    const name = parts[0], type = name[0].toUpperCase();
    const fail = (message) => { throw new RangeError(`line ${index + 1} (${name}): ${message}`); };
    if (!'RLCVIEGFH'.includes(type)) fail('unknown element; use R, L, C, V, I, E, G, F or H.');
    if (elements.some((element) => element.name.toLowerCase() === name.toLowerCase())) fail('duplicate name.');
    if ('RLC'.includes(type)) { if (parts.length < 4) fail('expected: name node node value'); const value = parseValue(parts[3]); if (!(value > 0)) fail('value must be positive.'); elements.push({ name, type, a: parts[1], b: parts[2], value }); }
    else if (type === 'V' || type === 'I') { if (parts.length < 4) fail('expected: name node node value [phase]'); elements.push({ name, type, a: parts[1], b: parts[2], value: C.polar(parseValue(parts[3]), parts[4] ? parseValue(parts[4]) : 0) }); }
    else if (type === 'E' || type === 'G') { if (parts.length < 6) fail('expected: name out+ out- ctrl+ ctrl- gain'); elements.push({ name, type, a: parts[1], b: parts[2], c: parts[3], d: parts[4], value: parseValue(parts[5]) }); }
    else { if (parts.length < 5) fail('expected: name out+ out- Vcontrol gain'); elements.push({ name, type, a: parts[1], b: parts[2], control: parts[3], value: parseValue(parts[4]) }); }
  });
  for (const element of elements) if (element.control && !elements.some((other) => other.type === 'V' && other.name.toLowerCase() === element.control.toLowerCase())) throw new RangeError(`${element.name}: controlling source ${element.control} is not a voltage source in the netlist.`);
  return elements;
}

/**
 * Phasor MNA at frequency f (0 = DC: inductors are shorts, capacitors open). Returns node
 * voltages, the current through every element (from its first node to its second) and the
 * complex power each element absorbs.
 */
export function solveNetwork(elements, { frequency = 0 } = {}) {
  const omega = 2 * Math.PI * frequency;
  const nodes = [...new Set(elements.flatMap((element) => [element.a, element.b, element.c, element.d].filter((node) => node !== undefined)))].filter((node) => node !== '0' && node.toLowerCase() !== 'gnd');
  const index = (node) => (node === '0' || node.toLowerCase() === 'gnd' ? -1 : nodes.indexOf(node));
  // Branch currents for voltage sources, VCVS, CCVS, and inductors at DC (shorts).
  const branchElements = elements.filter((element) => element.type === 'V' || element.type === 'E' || element.type === 'H' || (element.type === 'L' && omega === 0));
  const size = nodes.length + branchElements.length;
  const A = Array.from({ length: size }, () => Array.from({ length: size }, () => [0, 0]));
  const z = Array.from({ length: size }, () => [0, 0]);
  const add = (row, col, value) => { if (row >= 0 && col >= 0) A[row][col] = C.add(A[row][col], value); };
  const admittance = (element) => {
    if (element.type === 'R') return [1 / element.value, 0];
    if (element.type === 'C') return [0, omega * element.value];
    if (element.type === 'L') return C.div([1, 0], [0, omega * element.value]);
    return [0, 0];
  };
  const branchIndex = new Map(branchElements.map((element, k) => [element.name.toLowerCase(), nodes.length + k]));
  for (const element of elements) {
    const a = index(element.a), b = index(element.b);
    if ('RC'.includes(element.type) || (element.type === 'L' && omega > 0)) {
      if (element.type === 'C' && omega === 0) continue; // open at DC
      const y = admittance(element);
      add(a, a, y); add(b, b, y); add(a, b, C.neg(y)); add(b, a, C.neg(y));
    } else if (element.type === 'I') {
      if (a >= 0) z[a] = C.sub(z[a], element.value);
      if (b >= 0) z[b] = C.add(z[b], element.value);
    } else if (element.type === 'G') {
      const c = index(element.c), d = index(element.d), g = [element.value, 0];
      add(a, c, g); add(a, d, C.neg(g)); add(b, c, C.neg(g)); add(b, d, g);
    } else if (element.type === 'F') {
      const k = branchIndex.get(element.control.toLowerCase());
      add(a, k, [element.value, 0]); add(b, k, [-element.value, 0]);
    }
  }
  for (const element of branchElements) {
    const k = branchIndex.get(element.name.toLowerCase());
    const a = index(element.a), b = index(element.b);
    add(a, k, [1, 0]); add(b, k, [-1, 0]); add(k, a, [1, 0]); add(k, b, [-1, 0]);
    if (element.type === 'V') z[k] = element.value;
    else if (element.type === 'E') { const c = index(element.c), d = index(element.d); add(k, c, [-element.value, 0]); add(k, d, [element.value, 0]); }
    else if (element.type === 'H') add(k, branchIndex.get(element.control.toLowerCase()), [-element.value, 0]);
  }
  const x = solveComplex(A, z);
  const voltage = (node) => (index(node) < 0 ? [0, 0] : x[index(node)]);
  const voltages = Object.fromEntries([['0', [0, 0]], ...nodes.map((node) => [node, voltage(node)])]);
  const currents = {}, power = {};
  for (const element of elements) {
    const v = C.sub(voltage(element.a), voltage(element.b));
    let i;
    if (branchIndex.has(element.name.toLowerCase())) i = x[branchIndex.get(element.name.toLowerCase())];
    else if (element.type === 'I') i = element.value;
    else if (element.type === 'G') i = C.scale(C.sub(voltage(element.c), voltage(element.d)), element.value);
    else if (element.type === 'F') i = C.scale(x[branchIndex.get(element.control.toLowerCase())], element.value);
    else if (element.type === 'C' && omega === 0) i = [0, 0];
    else i = C.mul(v, admittance(element));
    currents[element.name] = i;
    // Absorbed complex power S = V·I* (phasor magnitudes taken as peak at AC: P = ½Re for peak
    // phasors; here phasors are treated as RMS values, so S = V·I*).
    power[element.name] = C.mul(v, C.conj(i));
  }
  return { nodes, voltages, currents, power, frequency };
}

// ---------------------------------------------------------------------------
// Theorems.

const withoutIndependentSources = (elements) => elements.map((element) => (element.type === 'V' || element.type === 'I' ? { ...element, value: [0, 0] } : element));

/**
 * Thévenin and Norton equivalents seen from terminals a–b: V_th = open-circuit voltage,
 * Z_th = V/I for a 1 A test source with independent sources off (works with dependent
 * sources), I_N = V_th / Z_th; also the short-circuit current as an independent check.
 */
export function thevenin(elements, a, b, { frequency = 0 } = {}) {
  const open = solveNetwork(elements, { frequency });
  const vth = C.sub(open.voltages[a] ?? [0, 0], open.voltages[b] ?? [0, 0]);
  const test = solveNetwork([...withoutIndependentSources(elements), { name: '__Itest', type: 'I', a: b, b: a, value: [1, 0] }], { frequency });
  const zth = C.sub(test.voltages[a] ?? [0, 0], test.voltages[b] ?? [0, 0]);
  let isc = null;
  try { const shorted = solveNetwork([...elements, { name: '__Vshort', type: 'V', a, b, value: [0, 0] }], { frequency }); isc = shorted.currents.__Vshort; } catch { isc = null; } // current a → b through the short
  const ideal = C.abs(zth) > 1e-12;
  return { vth, zth, norton: ideal ? C.div(vth, zth) : null, shortCircuit: isc, maxPower: ideal && zth[0] > 0 ? (C.abs(vth) ** 2) / (4 * zth[0]) : null, matchedLoad: C.conj(zth) };
}

/** Superposition: the response at a node pair (or an element current) from each independent source alone. */
export function superposition(elements, { a, b = '0', element = null, frequency = 0 } = {}) {
  const sources = elements.filter((entry) => entry.type === 'V' || entry.type === 'I');
  const measure = (result) => (element ? result.currents[element] : C.sub(result.voltages[a] ?? [0, 0], result.voltages[b] ?? [0, 0]));
  const parts = sources.map((source) => {
    const only = elements.map((entry) => ((entry.type === 'V' || entry.type === 'I') && entry !== source ? { ...entry, value: [0, 0] } : entry));
    return { source: source.name, value: measure(solveNetwork(only, { frequency })) };
  });
  const total = measure(solveNetwork(elements, { frequency }));
  return { parts, sum: parts.reduce((sum, part) => C.add(sum, part.value), [0, 0]), total };
}

/** Power delivered to a load R swept around the matched value (resistive Thévenin network). */
export function powerTransferCurve(vth, rth, { points = 101, maxRatio = 5 } = {}) {
  const magnitude = Array.isArray(vth) ? C.abs(vth) : vth;
  return Array.from({ length: points }, (_, k) => { const rl = rth * maxRatio * (k + 1) / points; return { rl, power: magnitude * magnitude * rl / (rth + rl) ** 2, efficiency: rl / (rth + rl) }; });
}

/** Star (Y) ↔ delta (Δ) conversion. */
export function starToDelta({ ra, rb, rc }) { const s = ra * rb + rb * rc + rc * ra; return { rab: s / rc, rbc: s / ra, rca: s / rb }; }
export function deltaToStar({ rab, rbc, rca }) { const s = rab + rbc + rca; return { ra: rab * rca / s, rb: rab * rbc / s, rc: rbc * rca / s }; }

// ---------------------------------------------------------------------------
// Two-ports. Port 1 = (p1, p1ref), port 2 = (p2, p2ref); matrices are [[x11, x12], [x21, x22]].

/** Measure the Y parameters by applying 1 V at one port with the other port shorted. */
export function measureTwoPort(elements, { p1, p1ref = '0', p2, p2ref = '0', frequency = 0 } = {}) {
  const passive = withoutIndependentSources(elements);
  const drive = (v1, v2) => {
    const result = solveNetwork([...passive, { name: '__V1', type: 'V', a: p1, b: p1ref, value: [v1, 0] }, { name: '__V2', type: 'V', a: p2, b: p2ref, value: [v2, 0] }], { frequency });
    return [C.neg(result.currents.__V1), C.neg(result.currents.__V2)]; // current into each port
  };
  const [y11, y21] = drive(1, 0), [y12, y22] = drive(0, 1);
  return { y: [[y11, y12], [y21, y22]] };
}

const det = (m) => C.sub(C.mul(m[0][0], m[1][1]), C.mul(m[0][1], m[1][0]));
/** Convert between Z, Y, h, g and ABCD (transmission) parameters. */
export function convertTwoPort(from, matrix) {
  const [[a, b], [c, d]] = matrix;
  const D = det(matrix);
  const toZ = {
    z: () => matrix,
    y: () => [[C.div(d, D), C.div(C.neg(b), D)], [C.div(C.neg(c), D), C.div(a, D)]],
    h: () => [[C.div(D, d), C.div(b, d)], [C.div(C.neg(c), d), C.div([1, 0], d)]],
    g: () => [[C.div([1, 0], a), C.div(C.neg(b), a)], [C.div(c, a), C.div(D, a)]],
    abcd: () => [[C.div(a, c), C.div(D, c)], [C.div([1, 0], c), C.div(d, c)]],
  }[from];
  if (!toZ) throw new RangeError(`Unknown parameter set "${from}".`);
  const z = toZ();
  const Dz = det(z);
  const [[z11, z12], [z21, z22]] = z;
  return {
    z,
    y: [[C.div(z22, Dz), C.div(C.neg(z12), Dz)], [C.div(C.neg(z21), Dz), C.div(z11, Dz)]],
    h: [[C.div(Dz, z22), C.div(z12, z22)], [C.div(C.neg(z21), z22), C.div([1, 0], z22)]],
    g: [[C.div([1, 0], z11), C.div(C.neg(z12), z11)], [C.div(z21, z11), C.div(Dz, z11)]],
    abcd: [[C.div(z11, z21), C.div(Dz, z21)], [C.div([1, 0], z21), C.div(z22, z21)]],
  };
}

/** All parameter sets of a network plus reciprocity/symmetry and loaded behaviour. */
export function twoPortAnalysis(elements, options) {
  const { y } = measureTwoPort(elements, options);
  let sets;
  try { sets = convertTwoPort('y', y); } catch { sets = { y, z: null, h: null, g: null, abcd: null }; }
  const close = (p, q) => C.abs(C.sub(p, q)) <= 1e-9 * Math.max(1, C.abs(p), C.abs(q));
  return { ...sets, reciprocal: close(y[0][1], y[1][0]), symmetric: close(y[0][0], y[1][1]) && close(y[0][1], y[1][0]) };
}

/** Input impedance and voltage gain with a load ZL on port 2 (from ABCD). */
export function loadedTwoPort(abcd, zl) {
  const [[A, B], [Cp, D]] = abcd;
  const zin = C.div(C.add(C.mul(A, zl), B), C.add(C.mul(Cp, zl), D));
  const gain = C.div(zl, C.add(C.mul(A, zl), B)); // V2 / V1
  return { zin, gain };
}

/** Interconnections: series (add Z), parallel (add Y), cascade (multiply ABCD). */
export function connectTwoPorts(kind, first, second) {
  const addM = (p, q) => p.map((row, i) => row.map((value, j) => C.add(value, q[i][j])));
  const mulM = (p, q) => [[C.add(C.mul(p[0][0], q[0][0]), C.mul(p[0][1], q[1][0])), C.add(C.mul(p[0][0], q[0][1]), C.mul(p[0][1], q[1][1]))], [C.add(C.mul(p[1][0], q[0][0]), C.mul(p[1][1], q[1][0])), C.add(C.mul(p[1][0], q[0][1]), C.mul(p[1][1], q[1][1]))]];
  if (kind === 'series') return convertTwoPort('z', addM(first.z, second.z));
  if (kind === 'parallel') return convertTwoPort('y', addM(first.y, second.y));
  if (kind === 'cascade') return convertTwoPort('abcd', mulM(first.abcd, second.abcd));
  throw new RangeError('Connection must be series, parallel or cascade.');
}

export const NETWORK_EXAMPLES = Object.freeze([
  { id: 'thevenin-bridge', name: 'Thévenin: unbalanced bridge', frequency: 0, a: 'a', b: 'b', netlist: 'V1 1 0 12\nR1 1 a 4\nR2 a 0 6\nR3 1 b 3\nR4 b 0 9' },
  { id: 'dependent', name: 'Thévenin with a dependent source', frequency: 0, a: 'a', b: '0', netlist: 'V1 1 0 10\nR1 1 a 2\nR2 a 0 4\n* current-controlled voltage source: 3·I(Vx)\nVx a x 0\nH1 x 0 Vx 3' },
  { id: 'superposition', name: 'Superposition: two sources', frequency: 0, a: 'm', b: '0', netlist: 'V1 1 0 20\nR1 1 m 5\nR2 m 0 10\nI1 0 m 3' },
  { id: 'ac-thevenin', name: 'AC Thévenin: RL source, 50 Hz', frequency: 50, a: 'out', b: '0', netlist: 'V1 1 0 230 0\nR1 1 2 10\nL1 2 out 31.83m\nC1 out 0 318.3u' },
  { id: 'two-port-t', name: 'Two-port: resistive T network', frequency: 0, p1: '1', p2: '2', netlist: 'R1 1 m 10\nR2 m 2 20\nR3 m 0 30' },
  { id: 'two-port-amp', name: 'Two-port: transistor hybrid-π (VCCS)', frequency: 0, p1: 'b', p2: 'c', netlist: 'Rpi b 0 2.5k\nG1 c 0 b 0 0.04\nRo c 0 50k' },
]);
