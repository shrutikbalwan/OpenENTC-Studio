import { resolveNodeAliases } from '../../packages/schematic/src/index.mjs';
import { nodeFields } from '../../packages/schematic/src/components.mjs';
import { BJT_REVERSE_BETA, BJT_SATURATION_CURRENT, DIODE_EMISSION, MOSFET_DEFAULT_KP, MOSFET_LAMBDA, OPAMP_GAIN_BANDWIDTH, OPAMP_OPEN_LOOP_GAIN, OPAMP_POLE_CAPACITANCE, THERMAL_VOLTAGE, diodeSaturationCurrent, opampLimit } from '../../packages/schematic/src/device-models.mjs';

export { OPAMP_GAIN_BANDWIDTH, OPAMP_OPEN_LOOP_GAIN, opampLimit };

// Built-in modified nodal analysis (MNA) engine: nonlinear DC operating point,
// transient (trapezoidal integration) and small-signal AC analyses.
const EPSILON = 1e-12;
const GMIN = 1e-12;
const MAX_NEWTON_ITERATIONS = 150;
const MAX_UNKNOWNS = 400;
export const MAX_TRANSIENT_POINTS = 20000;
export const MAX_AC_POINTS = 1000;
const ANALOG_TYPES = Object.freeze(['resistor', 'voltage', 'current', 'capacitor', 'inductor', 'diode', 'led', 'switch', 'npn', 'pnp', 'nmos', 'pmos', 'opamp']);
const BRANCH_TYPES = Object.freeze(['voltage', 'inductor', 'switch', 'opamp']);
const INTERNAL_PREFIX = '#';
const STIMULUS_SHAPES = Object.freeze(['dc', 'step', 'sine', 'pulse']);

function solveLinear(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    if (Math.abs(augmented[pivot][pivot]) < EPSILON) throw new Error('Circuit matrix is singular. Check for floating nodes or conflicting sources.');
    for (let row = pivot + 1; row < n; row += 1) {
      const ratio = augmented[row][pivot] / augmented[pivot][pivot];
      if (ratio === 0) continue;
      for (let col = pivot; col <= n; col += 1) augmented[row][col] -= ratio * augmented[pivot][col];
    }
  }
  const result = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let rhs = augmented[row][n];
    for (let col = row + 1; col < n; col += 1) rhs -= augmented[row][col] * result[col];
    result[row] = rhs / augmented[row][row];
  }
  return result;
}

function solveComplex(re, im, bRe, bIm) {
  const n = bRe.length;
  const ar = re.map((row, i) => [...row, bRe[i]]);
  const ai = im.map((row, i) => [...row, bIm[i]]);
  const magnitude = (row, col) => Math.hypot(ar[row][col], ai[row][col]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row += 1) if (magnitude(row, pivot) > magnitude(best, pivot)) best = row;
    [ar[pivot], ar[best]] = [ar[best], ar[pivot]];
    [ai[pivot], ai[best]] = [ai[best], ai[pivot]];
    const pr = ar[pivot][pivot], pi = ai[pivot][pivot], denominator = pr * pr + pi * pi;
    if (Math.sqrt(denominator) < EPSILON) throw new Error('AC circuit matrix is singular. Check for floating nodes or conflicting sources.');
    for (let row = pivot + 1; row < n; row += 1) {
      const xr = ar[row][pivot], xi = ai[row][pivot];
      if (xr === 0 && xi === 0) continue;
      const rr = (xr * pr + xi * pi) / denominator, ri = (xi * pr - xr * pi) / denominator;
      for (let col = pivot; col <= n; col += 1) {
        const yr = ar[pivot][col], yi = ai[pivot][col];
        ar[row][col] -= rr * yr - ri * yi;
        ai[row][col] -= rr * yi + ri * yr;
      }
    }
  }
  const xr = Array(n).fill(0), xi = Array(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sr = ar[row][n], si = ai[row][n];
    for (let col = row + 1; col < n; col += 1) { sr -= ar[row][col] * xr[col] - ai[row][col] * xi[col]; si -= ar[row][col] * xi[col] + ai[row][col] * xr[col]; }
    const dr = ar[row][row], di = ai[row][row], denominator = dr * dr + di * di;
    xr[row] = (sr * dr + si * di) / denominator;
    xi[row] = (si * dr - sr * di) / denominator;
  }
  return { re: xr, im: xi };
}

function diodeModel(part) {
  const forwardVoltage = Number(part.value);
  if (!(forwardVoltage > 0 && forwardVoltage <= 10)) throw new Error(`${part.label} must have a forward voltage between 0 and 10 V.`);
  const nVt = DIODE_EMISSION[part.type] * THERMAL_VOLTAGE;
  const saturation = diodeSaturationCurrent(forwardVoltage, part.type);
  return { nVt, saturation, critical: nVt * Math.log(nVt / (Math.SQRT2 * saturation)) };
}

function diodeCurrent(model, voltage) { return model.saturation * Math.expm1(voltage / model.nVt); }

// SPICE-style junction voltage limiting keeps Newton iterations out of exponential overflow.
function limitJunction(next, previous, model) {
  if (next > model.critical && Math.abs(next - previous) > 2 * model.nVt) {
    if (previous > 0) {
      const argument = 1 + (next - previous) / model.nVt;
      return argument > 0 ? previous + model.nVt * Math.log(argument) : model.critical;
    }
    return model.nVt * Math.log(next / model.nVt);
  }
  return next;
}

const voltageAcross = (x, a, b) => (a >= 0 ? x[a] : 0) - (b >= 0 ? x[b] : 0);
const dot = (coefficients, nodes, x) => coefficients.reduce((sum, coefficient, index) => sum + (nodes[index] >= 0 ? coefficient * x[nodes[index]] : 0), 0);

function stampConductance(matrix, a, b, conductance) {
  if (a >= 0) matrix[a][a] += conductance;
  if (b >= 0) matrix[b][b] += conductance;
  if (a >= 0 && b >= 0) { matrix[a][b] -= conductance; matrix[b][a] -= conductance; }
}

function stampCurrent(vector, a, b, current) {
  // Current `current` flows from node a through the element to node b.
  if (a >= 0) vector[a] -= current;
  if (b >= 0) vector[b] += current;
}

function stampBranch(matrix, a, b, k) {
  if (a >= 0) { matrix[a][k] += 1; matrix[k][a] += 1; }
  if (b >= 0) { matrix[b][k] -= 1; matrix[k][b] -= 1; }
}

/**
 * Stamp a linearized multi-terminal device. `currents[k]` is the current flowing from
 * terminal node k into the device, `gains[k][c]` its derivative with respect to control
 * voltage c, and each control voltage is `coefficients · terminal voltages`.
 */
function stampLinearized(matrix, vector, nodes, currents, gains, controls) {
  nodes.forEach((node, k) => {
    if (node < 0) return;
    let constant = currents[k];
    controls.forEach((control, c) => {
      constant -= gains[k][c] * control.value;
      control.coefficients.forEach((coefficient, j) => { if (nodes[j] >= 0 && coefficient) matrix[node][nodes[j]] += gains[k][c] * coefficient; });
    });
    vector[node] -= constant;
  });
}

const settledVoltage = (next, previous) => Math.abs(next - previous) <= 1e-6 * Math.max(1, Math.abs(next));

function diodeDevice(part, nodes) {
  const model = diodeModel(part);
  const coefficients = [1, -1];
  const evaluate = (voltage) => {
    const exponential = Math.exp(voltage / model.nVt);
    return { current: model.saturation * (exponential - 1) + GMIN * voltage, conductance: model.saturation * exponential / model.nVt + GMIN };
  };
  return {
    nodes,
    initial: (x) => ({ v: dot(coefficients, nodes, x) }),
    stamp(matrix, vector, state) {
      const { current, conductance } = evaluate(state.v);
      stampLinearized(matrix, vector, nodes, [current, -current], [[conductance], [-conductance]], [{ coefficients, value: state.v }]);
    },
    update(x, state) {
      const raw = dot(coefficients, nodes, x);
      const v = limitJunction(raw, state.v, model);
      return { state: { v }, settled: v === raw && settledVoltage(v, state.v) };
    },
    currents: (x) => ({ [part.id]: diodeCurrent(model, dot(coefficients, nodes, x)) }),
    power: (x) => { const v = dot(coefficients, nodes, x); return v * diodeCurrent(model, v); },
  };
}

/** Ebers-Moll (transport) BJT: terminals collector, base, emitter; value is the forward beta. */
function bjtDevice(part, nodes) {
  const beta = Number(part.value);
  if (!(beta > 0 && beta <= 1e5)) throw new Error(`${part.label} must have a current gain (β) between 0 and 100000.`);
  const polarity = part.type === 'pnp' ? -1 : 1;
  const junction = { nVt: THERMAL_VOLTAGE, saturation: BJT_SATURATION_CURRENT, critical: THERMAL_VOLTAGE * Math.log(THERMAL_VOLTAGE / (Math.SQRT2 * BJT_SATURATION_CURRENT)) };
  const be = [0, polarity, -polarity], bc = [-polarity, polarity, 0];
  const evaluate = (vbe, vbc) => {
    const ef = Math.exp(vbe / THERMAL_VOLTAGE), er = Math.exp(vbc / THERMAL_VOLTAGE);
    const forward = BJT_SATURATION_CURRENT * (ef - 1) + GMIN * vbe, reverse = BJT_SATURATION_CURRENT * (er - 1) + GMIN * vbc;
    const gf = BJT_SATURATION_CURRENT * ef / THERMAL_VOLTAGE + GMIN, gr = BJT_SATURATION_CURRENT * er / THERMAL_VOLTAGE + GMIN;
    const collector = forward - reverse * (1 + 1 / BJT_REVERSE_BETA), base = forward / beta + reverse / BJT_REVERSE_BETA;
    const dCollector = [gf, -gr * (1 + 1 / BJT_REVERSE_BETA)], dBase = [gf / beta, gr / BJT_REVERSE_BETA];
    return { collector, base, dCollector, dBase };
  };
  const terminalCurrents = (vbe, vbc) => {
    const { collector, base, dCollector, dBase } = evaluate(vbe, vbc);
    return {
      currents: [polarity * collector, polarity * base, -polarity * (collector + base)],
      gains: [dCollector.map((g) => polarity * g), dBase.map((g) => polarity * g), dCollector.map((g, c) => -polarity * (g + dBase[c]))],
    };
  };
  return {
    nodes,
    initial: (x, fresh) => fresh ? { vbe: junction.critical, vbc: 0 } : { vbe: dot(be, nodes, x), vbc: dot(bc, nodes, x) },
    stamp(matrix, vector, state) {
      const { currents, gains } = terminalCurrents(state.vbe, state.vbc);
      stampLinearized(matrix, vector, nodes, currents, gains, [{ coefficients: be, value: state.vbe }, { coefficients: bc, value: state.vbc }]);
    },
    update(x, state) {
      const rawBe = dot(be, nodes, x), rawBc = dot(bc, nodes, x);
      const vbe = limitJunction(rawBe, state.vbe, junction), vbc = limitJunction(rawBc, state.vbc, junction);
      return { state: { vbe, vbc }, settled: vbe === rawBe && vbc === rawBc && settledVoltage(vbe, state.vbe) && settledVoltage(vbc, state.vbc) };
    },
    currents(x) {
      const { currents } = terminalCurrents(dot(be, nodes, x), dot(bc, nodes, x));
      return { [part.id]: currents[0], [`${part.id}.base`]: currents[1] };
    },
    power(x) { const { currents } = terminalCurrents(dot(be, nodes, x), dot(bc, nodes, x)); return currents.reduce((sum, current, k) => sum + current * (nodes[k] >= 0 ? x[nodes[k]] : 0), 0); },
  };
}

/** Shichman-Hodges (SPICE level 1) MOSFET with the body tied to the source: drain, gate, source. */
function mosfetDevice(part, nodes) {
  const threshold = Number(part.value);
  if (!(threshold > 0 && threshold <= 100)) throw new Error(`${part.label} must have a threshold voltage between 0 and 100 V.`);
  const kp = part.kp === undefined ? MOSFET_DEFAULT_KP : Number(part.kp);
  if (!(kp > 0 && kp <= 1e3)) throw new Error(`${part.label} must have a transconductance K greater than zero.`);
  const polarity = part.type === 'pmos' ? -1 : 1;
  const gs = [0, polarity, -polarity], ds = [polarity, 0, -polarity];
  // Square-law drain current for forward operation (vds >= 0), with derivatives.
  const forward = (vgs, vds) => {
    const overdrive = vgs - threshold, clm = 1 + MOSFET_LAMBDA * vds;
    if (overdrive <= 0) return { id: 0, gm: 0, gds: 0 };
    if (vds < overdrive) return { id: kp * (overdrive * vds - vds * vds / 2) * clm, gm: kp * vds * clm, gds: kp * (overdrive - vds) * clm + kp * (overdrive * vds - vds * vds / 2) * MOSFET_LAMBDA };
    return { id: kp / 2 * overdrive * overdrive * clm, gm: kp * overdrive * clm, gds: kp / 2 * overdrive * overdrive * MOSFET_LAMBDA };
  };
  const evaluate = (vgs, vds) => {
    let result;
    if (vds >= 0) result = forward(vgs, vds);
    else { const reverse = forward(vgs - vds, -vds); result = { id: -reverse.id, gm: -reverse.gm, gds: reverse.gm + reverse.gds }; }
    return { id: result.id + GMIN * vds, gm: result.gm, gds: result.gds + GMIN };
  };
  const terminal = (vgs, vds) => {
    const { id, gm, gds } = evaluate(vgs, vds);
    return { currents: [polarity * id, 0, -polarity * id], gains: [[polarity * gm, polarity * gds], [0, 0], [-polarity * gm, -polarity * gds]] };
  };
  const limitStep = (next, previous, maximum) => Math.min(previous + maximum, Math.max(previous - maximum, next));
  return {
    nodes,
    initial: (x) => ({ vgs: dot(gs, nodes, x), vds: dot(ds, nodes, x) }),
    stamp(matrix, vector, state) {
      const { currents, gains } = terminal(state.vgs, state.vds);
      stampLinearized(matrix, vector, nodes, currents, gains, [{ coefficients: gs, value: state.vgs }, { coefficients: ds, value: state.vds }]);
    },
    update(x, state) {
      const rawGs = dot(gs, nodes, x), rawDs = dot(ds, nodes, x);
      const vgs = limitStep(rawGs, state.vgs, 2), vds = limitStep(rawDs, state.vds, 10);
      return { state: { vgs, vds }, settled: vgs === rawGs && vds === rawDs && settledVoltage(vgs, state.vgs) && settledVoltage(vds, state.vds) };
    },
    currents: (x) => ({ [part.id]: terminal(dot(gs, nodes, x), dot(ds, nodes, x)).currents[0] }),
    power: (x) => terminal(dot(gs, nodes, x), dot(ds, nodes, x)).currents[0] * dot(ds, nodes, x) * polarity,
  };
}

/**
 * Op-amp: non-inverting, inverting, output. A transconductance stage drives an internal
 * RC node (open-loop gain A0, single pole at GBW / A0); the output follows that node
 * through a smooth limiter at ±value (the supply rails) with zero output resistance.
 */
function opampDevice(part, nodes, internal, branch) {
  const rail = Number(part.value);
  if (!(rail > 0 && rail <= 1e4)) throw new Error(`${part.label} must have a supply rail (Vsat) greater than zero.`);
  const [plus, minus, output] = nodes;
  return {
    nodes,
    initial: (x) => ({ v: x[internal] }),
    stamp(matrix, vector, state) {
      if (plus >= 0) matrix[internal][plus] -= OPAMP_OPEN_LOOP_GAIN;
      if (minus >= 0) matrix[internal][minus] += OPAMP_OPEN_LOOP_GAIN;
      const { value, slope } = opampLimit(state.v, rail);
      stampBranch(matrix, output, -1, branch);
      matrix[branch][internal] -= slope;
      vector[branch] = value - slope * state.v;
    },
    update: (x, state) => ({ state: { v: x[internal] }, settled: Math.abs(x[internal] - state.v) <= 1e-6 * Math.max(1, Math.abs(x[internal])) }),
    currents: (x) => ({ [part.id]: -x[branch] }),
    power: () => 0,
  };
}

function buildCircuit(components, wires, netLabels) {
  if (!Array.isArray(components)) throw new TypeError('Circuit components must be an array.');
  const aliases = resolveNodeAliases(components, wires, netLabels);
  const node = (value) => aliases[String(value)] || String(value);
  const authored = components.filter((part) => ANALOG_TYPES.includes(part.type));
  for (const part of authored) {
    const value = Number(part.value);
    if (part.type === 'resistor' && !(value > 0)) throw new Error(`${part.label} must have a resistance greater than zero.`);
    if (part.type === 'capacitor' && !(value > 0)) throw new Error(`${part.label} must have a capacitance greater than zero.`);
    if (part.type === 'inductor' && !(value > 0)) throw new Error(`${part.label} must have an inductance greater than zero.`);
    if (['voltage', 'current'].includes(part.type) && !Number.isFinite(value)) throw new Error(`${part.label} must have a finite ${part.type === 'voltage' ? 'voltage' : 'current'}.`);
    for (const field of nodeFields(part)) if (typeof part[field] !== 'string' || !part[field].trim()) throw new Error(`${part.label} has an unconnected ${field} terminal.`);
  }
  if (!authored.some((part) => part.type === 'voltage' || part.type === 'current')) throw new Error('Add at least one DC voltage source or current source.');
  // Each op-amp adds a hidden pole node with a 1 Ω load and a capacitor setting its open-loop bandwidth.
  const internalNode = (part) => `${INTERNAL_PREFIX}${part.id}`;
  const synthetic = authored.filter((part) => part.type === 'opamp').flatMap((part) => [
    { id: `${INTERNAL_PREFIX}${part.id}.r`, type: 'resistor', label: part.label, value: 1, n1: internalNode(part), n2: '0', internal: true },
    { id: `${INTERNAL_PREFIX}${part.id}.c`, type: 'capacitor', label: part.label, value: OPAMP_POLE_CAPACITANCE, n1: internalNode(part), n2: '0', internal: true },
  ]);
  const parts = [...authored, ...synthetic];
  const nodeNames = [...new Set(parts.flatMap((part) => nodeFields(part).map((field) => part.internal ? part[field] : node(part[field]))).filter((name) => name !== '0'))];
  const nodeLookup = new Map(nodeNames.map((name, index) => [name, index]));
  // Voltage sources, inductors, closed switches and op-amp outputs carry an explicit branch current.
  const branchParts = parts.filter((part) => BRANCH_TYPES.includes(part.type) && (part.type !== 'switch' || Number(part.value) >= 0.5));
  const branchIndex = new Map(branchParts.map((part, index) => [part.id, nodeNames.length + index]));
  const size = nodeNames.length + branchParts.length;
  if (size > MAX_UNKNOWNS) throw new Error(`Circuit exceeds the built-in solver limit of ${MAX_UNKNOWNS} unknowns.`);
  const terminals = new Map(parts.map((part) => [part.id, nodeFields(part).map((field) => part.internal ? part[field] : node(part[field])).map((name) => name === '0' ? -1 : nodeLookup.get(name))]));
  const devices = new Map();
  for (const part of authored) {
    const nodes = terminals.get(part.id);
    if (DIODE_EMISSION[part.type]) devices.set(part.id, diodeDevice(part, nodes));
    else if (part.type === 'npn' || part.type === 'pnp') devices.set(part.id, bjtDevice(part, nodes));
    else if (part.type === 'nmos' || part.type === 'pmos') devices.set(part.id, mosfetDevice(part, nodes));
    else if (part.type === 'opamp') devices.set(part.id, opampDevice(part, nodes, nodeLookup.get(internalNode(part)), branchIndex.get(part.id)));
  }
  const warnings = components.filter((part) => !ANALOG_TYPES.includes(part.type) && part.type !== 'ground').map((part) => `${part.label} is not simulated by the built-in solver.`);
  return { parts, node, nodeNames, branchIndex, size, devices, terminals, warnings };
}

/**
 * Assemble and solve the nonlinear system with Newton-Raphson.
 * `step` selects DC (capacitors open, inductors shorted) or one transient step with
 * companion models built from the previous time point.
 */
function solveNonlinear(circuit, options) {
  // Solve exactly first; add a tiny shunt conductance only when a node floats (e.g. between capacitors in DC).
  try { return solveNonlinearWith(circuit, options, 0); }
  catch (error) { if (!/singular/.test(error.message)) throw error; return solveNonlinearWith(circuit, options, GMIN); }
}

function stampLinearParts(circuit, matrix, vector, { sourceValue, scale = 1, step = null }) {
  const { parts, terminals, branchIndex, devices } = circuit;
  for (const part of parts) {
    if (devices.has(part.id)) continue;
    const [a, b] = terminals.get(part.id);
    const value = Number(part.value);
    if (part.type === 'resistor') stampConductance(matrix, a, b, 1 / value);
    else if (part.type === 'current') stampCurrent(vector, a, b, scale * sourceValue(part));
    else if (part.type === 'voltage') { const k = branchIndex.get(part.id); stampBranch(matrix, a, b, k); vector[k] = scale * sourceValue(part); }
    else if (part.type === 'switch') { if (branchIndex.has(part.id)) stampBranch(matrix, a, b, branchIndex.get(part.id)); }
    else if (part.type === 'capacitor') {
      if (!step) continue;
      const previous = step.capacitors.get(part.id);
      const conductance = step.method === 'euler' ? value / step.h : 2 * value / step.h;
      const history = step.method === 'euler' ? conductance * previous.voltage : conductance * previous.voltage + previous.current;
      stampConductance(matrix, a, b, conductance);
      stampCurrent(vector, a, b, -history);
    } else if (part.type === 'inductor') {
      const k = branchIndex.get(part.id);
      stampBranch(matrix, a, b, k);
      if (step) {
        const previous = step.inductors.get(part.id);
        const resistance = step.method === 'euler' ? value / step.h : 2 * value / step.h;
        matrix[k][k] -= resistance;
        vector[k] = step.method === 'euler' ? -resistance * previous.current : -resistance * previous.current - previous.voltage;
      }
    }
  }
}

function solveNonlinearWith(circuit, options, gmin) {
  const { size, devices, nodeNames } = circuit;
  let x = options.guess ? [...options.guess] : Array(size).fill(0);
  const states = new Map([...devices].map(([id, device]) => [id, device.initial(x, !options.guess)]));
  for (let iteration = 0; iteration < MAX_NEWTON_ITERATIONS; iteration += 1) {
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const vector = Array(size).fill(0);
    for (let index = 0; index < nodeNames.length; index += 1) matrix[index][index] += gmin;
    stampLinearParts(circuit, matrix, vector, options);
    for (const [id, device] of devices) device.stamp(matrix, vector, states.get(id));
    const next = solveLinear(matrix, vector);
    if (!devices.size) return next;
    let converged = true;
    for (const [id, device] of devices) {
      const { state, settled } = device.update(next, states.get(id));
      if (!settled) converged = false;
      states.set(id, state);
    }
    for (let index = 0; index < size && converged; index += 1) if (Math.abs(next[index] - x[index]) > 1e-6 * Math.max(Math.abs(next[index]), Math.abs(x[index])) + 1e-9) converged = false;
    x = next;
    if (converged && iteration > 0) return x;
  }
  throw new Error('Circuit did not converge. Check device orientation, bias and source values.');
}

function operatingPoint(circuit, sourceValue) {
  try { return solveNonlinear(circuit, { sourceValue }); }
  catch (error) {
    if (!circuit.devices.size || /singular/.test(error.message)) throw error;
    // Source stepping: ramp all independent sources up from 10 % for hard nonlinear circuits.
    let guess = null;
    for (let scale = 0.1; scale <= 1.0001; scale += 0.1) guess = solveNonlinear(circuit, { guess, sourceValue, scale: Math.min(scale, 1) });
    return guess;
  }
}

function partCurrents(circuit, x, sourceValue, capacitorCurrents = null) {
  const currents = {};
  for (const part of circuit.parts) {
    if (part.internal) continue;
    if (circuit.devices.has(part.id)) { Object.assign(currents, circuit.devices.get(part.id).currents(x)); continue; }
    const [a, b] = circuit.terminals.get(part.id);
    if (part.type === 'resistor') currents[part.id] = voltageAcross(x, a, b) / Number(part.value);
    else if (circuit.branchIndex.has(part.id)) currents[part.id] = x[circuit.branchIndex.get(part.id)];
    else if (part.type === 'current') currents[part.id] = sourceValue(part);
    else if (part.type === 'capacitor') currents[part.id] = capacitorCurrents?.get(part.id) ?? 0;
    else currents[part.id] = 0;
  }
  return currents;
}

const dissipatedPower = (circuit, x, currents) => circuit.parts.reduce((sum, part) => {
  if (part.internal) return sum;
  if (circuit.devices.has(part.id)) return sum + circuit.devices.get(part.id).power(x);
  if (part.type !== 'resistor') return sum;
  const [a, b] = circuit.terminals.get(part.id);
  return sum + voltageAcross(x, a, b) * currents[part.id];
}, 0);

const visibleNodes = (circuit) => circuit.nodeNames.map((name, index) => [name, index]).filter(([name]) => !name.startsWith(INTERNAL_PREFIX));
const nodeVoltages = (circuit, x) => Object.fromEntries([['0', 0], ...visibleNodes(circuit).map(([name, index]) => [name, x[index]])]);

export function simulateDC(components, wires = [], netLabels = []) {
  const circuit = buildCircuit(components, wires, netLabels);
  const sourceValue = (part) => Number(part.value);
  const x = operatingPoint(circuit, sourceValue);
  const currents = partCurrents(circuit, x, sourceValue);
  return { nodes: nodeVoltages(circuit, x), currents, totalPower: dissipatedPower(circuit, x, currents), warnings: circuit.warnings };
}

function boundedNumber(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  return number;
}

/** Build the time-domain value function for the stimulus source; other sources stay at their DC value. */
export function stimulusWaveform(stimulus = {}, nominal = 0) {
  const shape = stimulus.shape ?? 'step';
  if (!STIMULUS_SHAPES.includes(shape)) throw new RangeError(`Stimulus shape must be one of ${STIMULUS_SHAPES.join(', ')}.`);
  const amplitude = stimulus.amplitude === undefined ? nominal : boundedNumber(stimulus.amplitude, -1e6, 1e6, 'Stimulus amplitude');
  const offset = stimulus.offset === undefined ? 0 : boundedNumber(stimulus.offset, -1e6, 1e6, 'Stimulus offset');
  const frequency = shape === 'sine' || shape === 'pulse' ? boundedNumber(stimulus.frequency ?? 1000, 1e-6, 1e12, 'Stimulus frequency') : 0;
  if (shape === 'dc') return () => offset + amplitude;
  if (shape === 'step') return (time) => offset + (time > 0 ? amplitude : 0);
  if (shape === 'sine') return (time) => offset + amplitude * Math.sin(2 * Math.PI * frequency * time);
  // Square pulse: high for the first half of each period after t = 0, low otherwise.
  return (time) => { const cycle = time * frequency; return offset + (time > 0 && cycle - Math.ceil(cycle) + 1 <= 0.5 ? amplitude : 0); };
}

/**
 * Transient analysis with trapezoidal integration (backward Euler on the first step
 * and after source discontinuities are absorbed by the fixed output grid).
 * `stimulus.sourceId` selects which independent source follows the waveform.
 */
export function simulateTransient(components, wires = [], netLabels = [], { stopTime, timeStep, stimulus = {} } = {}) {
  const circuit = buildCircuit(components, wires, netLabels);
  const stop = boundedNumber(stopTime, 1e-12, 1e6, 'Stop time');
  const h = boundedNumber(timeStep, 1e-15, stop, 'Time step');
  const steps = Math.ceil(stop / h - 1e-9);
  if (steps + 1 > MAX_TRANSIENT_POINTS) throw new RangeError(`Transient analysis is limited to ${MAX_TRANSIENT_POINTS} points; increase the time step.`);
  const sources = circuit.parts.filter((part) => part.type === 'voltage' || part.type === 'current');
  const driven = stimulus.sourceId ? sources.find((part) => part.id === stimulus.sourceId) : sources[0];
  if (!driven) throw new Error(`Stimulus source ${stimulus.sourceId} is not an independent source in this circuit.`);
  const waveform = stimulusWaveform(stimulus, Number(driven.value));
  const sourceAt = (time) => (part) => part.id === driven.id ? waveform(time) : Number(part.value);

  let x = operatingPoint(circuit, sourceAt(0));
  const capacitors = new Map(circuit.parts.filter((part) => part.type === 'capacitor').map((part) => { const [a, b] = circuit.terminals.get(part.id); return [part.id, { voltage: voltageAcross(x, a, b), current: 0 }]; }));
  const inductors = new Map(circuit.parts.filter((part) => part.type === 'inductor').map((part) => [part.id, { current: x[circuit.branchIndex.get(part.id)], voltage: 0 }]));
  const time = [0];
  const visible = visibleNodes(circuit);
  const nodes = Object.fromEntries(visible.map(([name, index]) => [name, [x[index]]]));
  const initialCurrents = partCurrents(circuit, x, sourceAt(0));
  const currents = Object.fromEntries(Object.entries(initialCurrents).map(([id, value]) => [id, [value]]));

  for (let index = 1; index <= steps; index += 1) {
    const t = Math.min(index * h, stop);
    const dt = t - time[time.length - 1];
    const method = index === 1 ? 'euler' : 'trapezoidal';
    x = solveNonlinear(circuit, { guess: x, sourceValue: sourceAt(t), step: { h: dt, method, capacitors, inductors } });
    const capacitorCurrents = new Map();
    for (const part of circuit.parts) {
      if (part.type !== 'capacitor' && part.type !== 'inductor') continue;
      const [a, b] = circuit.terminals.get(part.id);
      const voltage = voltageAcross(x, a, b);
      if (part.type === 'capacitor') {
        const previous = capacitors.get(part.id);
        const conductance = method === 'euler' ? Number(part.value) / dt : 2 * Number(part.value) / dt;
        const current = method === 'euler' ? conductance * (voltage - previous.voltage) : conductance * (voltage - previous.voltage) - previous.current;
        capacitors.set(part.id, { voltage, current });
        capacitorCurrents.set(part.id, current);
      } else if (part.type === 'inductor') inductors.set(part.id, { current: x[circuit.branchIndex.get(part.id)], voltage });
    }
    time.push(t);
    for (const [name, nodeIndex] of visible) nodes[name].push(x[nodeIndex]);
    const stepCurrents = partCurrents(circuit, x, sourceAt(t), capacitorCurrents);
    for (const [id, value] of Object.entries(stepCurrents)) currents[id].push(value);
  }
  return { kind: 'circuit-transient', time, nodes: { 0: time.map(() => 0), ...nodes }, currents, stimulus: { sourceId: driven.id, shape: stimulus.shape ?? 'step' }, warnings: circuit.warnings };
}

/** Logarithmic frequency points from start to stop inclusive. */
export function logFrequencies(start, stop, pointsPerDecade) {
  const first = boundedNumber(start, 1e-6, 1e12, 'Start frequency');
  const last = boundedNumber(stop, first, 1e12, 'Stop frequency');
  const density = Math.trunc(boundedNumber(pointsPerDecade, 1, 200, 'Points per decade'));
  const count = Math.max(2, Math.round(Math.log10(last / first) * density) + 1);
  if (count > MAX_AC_POINTS) throw new RangeError(`AC analysis is limited to ${MAX_AC_POINTS} frequency points.`);
  return Array.from({ length: count }, (_, index) => first * (last / first) ** (index / (count - 1)));
}

/**
 * Small-signal AC analysis linearized at the DC operating point. The input source
 * carries a 1 V (or 1 A) AC magnitude; all other independent sources are AC-zero,
 * so every node voltage is the transfer function from that input.
 */
export function simulateAC(components, wires = [], netLabels = [], { startFrequency = 10, stopFrequency = 1e6, pointsPerDecade = 20, inputSourceId } = {}) {
  const circuit = buildCircuit(components, wires, netLabels);
  const frequencies = logFrequencies(startFrequency, stopFrequency, pointsPerDecade);
  const sources = circuit.parts.filter((part) => part.type === 'voltage' || part.type === 'current');
  const input = inputSourceId ? sources.find((part) => part.id === inputSourceId) : sources[0];
  if (!input) throw new Error(`AC input ${inputSourceId} is not an independent source in this circuit.`);
  const bias = operatingPoint(circuit, (part) => Number(part.value));
  const { size, nodeNames, terminals, branchIndex, devices } = circuit;
  const biasStates = new Map([...devices].map(([id, device]) => [id, device.initial(bias, false)]));
  const visible = visibleNodes(circuit);
  const nodes = Object.fromEntries(visible.map(([name]) => [name, { magnitude: [], phase: [] }]));
  for (const frequency of frequencies) {
    const omega = 2 * Math.PI * frequency;
    const re = Array.from({ length: size }, () => Array(size).fill(0));
    const im = Array.from({ length: size }, () => Array(size).fill(0));
    const bRe = Array(size).fill(0), bIm = Array(size).fill(0);
    for (const part of circuit.parts) {
      // Nonlinear devices contribute their small-signal Jacobian at the bias point.
      if (devices.has(part.id)) { devices.get(part.id).stamp(re, Array(size).fill(0), biasStates.get(part.id)); continue; }
      const [a, b] = terminals.get(part.id);
      const value = Number(part.value);
      if (part.type === 'resistor') stampConductance(re, a, b, 1 / value);
      else if (part.type === 'capacitor') stampConductance(im, a, b, omega * value);
      else if (part.type === 'current') { if (part.id === input.id) stampCurrent(bRe, a, b, 1); }
      else if (branchIndex.has(part.id)) {
        const k = branchIndex.get(part.id);
        stampBranch(re, a, b, k);
        if (part.type === 'inductor') im[k][k] -= omega * value;
        if (part.id === input.id) bRe[k] = 1;
      }
    }
    let solution;
    try { solution = solveComplex(re, im, bRe, bIm); }
    catch (error) { if (!/singular/.test(error.message)) throw error; for (let index = 0; index < nodeNames.length; index += 1) re[index][index] += GMIN; solution = solveComplex(re, im, bRe, bIm); }
    visible.forEach(([name, index]) => {
      nodes[name].magnitude.push(Math.hypot(solution.re[index], solution.im[index]));
      nodes[name].phase.push(Math.atan2(solution.im[index], solution.re[index]) * 180 / Math.PI);
    });
  }
  return { kind: 'circuit-ac', frequency: frequencies, nodes, inputSourceId: input.id, warnings: circuit.warnings };
}

export function sampleWaveform({ shape = 'sine', frequency = 1000, amplitude = 5, offset = 0 }, points = 180) {
  return Array.from({ length: points }, (_, index) => {
    const phase = index / (points - 1) * Math.PI * 4;
    let normalized = Math.sin(phase);
    if (shape === 'square') normalized = Math.sin(phase) >= 0 ? 1 : -1;
    if (shape === 'triangle') normalized = 2 / Math.PI * Math.asin(Math.sin(phase));
    return { t: index / (points - 1) * (2 / frequency), v: offset + amplitude * normalized };
  });
}
