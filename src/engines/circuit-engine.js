import { resolveNodeAliases } from '../../packages/schematic/src/index.mjs';

// Built-in modified nodal analysis (MNA) engine: nonlinear DC operating point,
// transient (trapezoidal integration) and small-signal AC analyses.
const EPSILON = 1e-12;
const GMIN = 1e-12;
const THERMAL_VOLTAGE = 0.025865; // kT/q at the SPICE nominal 27 °C
const DIODE_REFERENCE_CURRENT = 0.01;
const DIODE_EMISSION = Object.freeze({ diode: 1, led: 2 });
const MAX_NEWTON_ITERATIONS = 150;
const MAX_UNKNOWNS = 400;
export const MAX_TRANSIENT_POINTS = 20000;
export const MAX_AC_POINTS = 1000;
const ANALOG_TYPES = Object.freeze(['resistor', 'voltage', 'current', 'capacitor', 'inductor', 'diode', 'led', 'switch']);
const BRANCH_TYPES = Object.freeze(['voltage', 'inductor', 'switch']);
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
  // Saturation current chosen so the diode conducts 10 mA at its rated forward voltage.
  const saturation = DIODE_REFERENCE_CURRENT / Math.expm1(forwardVoltage / nVt);
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

function buildCircuit(components, wires, netLabels) {
  if (!Array.isArray(components)) throw new TypeError('Circuit components must be an array.');
  const aliases = resolveNodeAliases(components, wires, netLabels);
  const node = (value) => aliases[String(value)] || String(value);
  const parts = components.filter((part) => ANALOG_TYPES.includes(part.type));
  for (const part of parts) {
    const value = Number(part.value);
    if (part.type === 'resistor' && !(value > 0)) throw new Error(`${part.label} must have a resistance greater than zero.`);
    if (part.type === 'capacitor' && !(value > 0)) throw new Error(`${part.label} must have a capacitance greater than zero.`);
    if (part.type === 'inductor' && !(value > 0)) throw new Error(`${part.label} must have an inductance greater than zero.`);
    if (['voltage', 'current'].includes(part.type) && !Number.isFinite(value)) throw new Error(`${part.label} must have a finite ${part.type === 'voltage' ? 'voltage' : 'current'}.`);
  }
  if (!parts.some((part) => part.type === 'voltage' || part.type === 'current')) throw new Error('Add at least one DC voltage source or current source.');
  const nodeNames = [...new Set(parts.flatMap((part) => [node(part.n1), node(part.n2)]).filter((name) => name !== '0'))];
  const nodeLookup = new Map(nodeNames.map((name, index) => [name, index]));
  // Voltage sources, inductors and closed switches carry an explicit branch current.
  const branchParts = parts.filter((part) => BRANCH_TYPES.includes(part.type) && (part.type !== 'switch' || Number(part.value) >= 0.5));
  const branchIndex = new Map(branchParts.map((part, index) => [part.id, nodeNames.length + index]));
  const size = nodeNames.length + branchParts.length;
  if (size > MAX_UNKNOWNS) throw new Error(`Circuit exceeds the built-in solver limit of ${MAX_UNKNOWNS} unknowns.`);
  const models = new Map(parts.filter((part) => DIODE_EMISSION[part.type]).map((part) => [part.id, diodeModel(part)]));
  const terminals = new Map(parts.map((part) => [part.id, [node(part.n1), node(part.n2)].map((name) => name === '0' ? -1 : nodeLookup.get(name))]));
  const warnings = components.filter((part) => !ANALOG_TYPES.includes(part.type) && part.type !== 'ground').map((part) => `${part.label} is not simulated by the built-in solver.`);
  return { parts, node, nodeNames, branchIndex, size, models, terminals, warnings };
}

const voltageAcross = (x, a, b) => (a >= 0 ? x[a] : 0) - (b >= 0 ? x[b] : 0);

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
 * Assemble and solve the nonlinear system with Newton-Raphson.
 * `state` describes the analysis: DC (capacitors open, inductors shorted) or one
 * transient step with companion models built from the previous time point.
 */
function solveNonlinear(circuit, options) {
  // Solve exactly first; add a tiny shunt conductance only when a node floats (e.g. between capacitors in DC).
  try { return solveNonlinearWith(circuit, options, 0); }
  catch (error) { if (!/singular/.test(error.message)) throw error; return solveNonlinearWith(circuit, options, GMIN); }
}

function solveNonlinearWith(circuit, { guess, sourceValue, scale = 1, step = null }, gmin) {
  const { parts, size, terminals, branchIndex, models, nodeNames } = circuit;
  let x = guess ? [...guess] : Array(size).fill(0);
  const junction = new Map([...models.keys()].map((id) => { const [a, b] = terminals.get(id); return [id, voltageAcross(x, a, b)]; }));
  for (let iteration = 0; iteration < MAX_NEWTON_ITERATIONS; iteration += 1) {
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const vector = Array(size).fill(0);
    for (let index = 0; index < nodeNames.length; index += 1) matrix[index][index] += gmin;
    for (const part of parts) {
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
      } else if (models.has(part.id)) {
        const model = models.get(part.id);
        const voltage = junction.get(part.id);
        const exponential = Math.exp(voltage / model.nVt);
        const conductance = model.saturation * exponential / model.nVt + GMIN;
        const current = model.saturation * (exponential - 1) + GMIN * voltage;
        stampConductance(matrix, a, b, conductance);
        stampCurrent(vector, a, b, current - conductance * voltage);
      }
    }
    const next = solveLinear(matrix, vector);
    if (!models.size) return next;
    let converged = true;
    for (const [id, previous] of junction) {
      const [a, b] = terminals.get(id);
      const raw = voltageAcross(next, a, b);
      const limited = limitJunction(raw, previous, models.get(id));
      if (limited !== raw || Math.abs(limited - previous) > 1e-6 * Math.max(1, Math.abs(limited))) converged = false;
      junction.set(id, limited);
    }
    for (let index = 0; index < size && converged; index += 1) if (Math.abs(next[index] - x[index]) > 1e-6 * Math.max(Math.abs(next[index]), Math.abs(x[index])) + 1e-9) converged = false;
    x = next;
    if (converged && iteration > 0) return x;
  }
  throw new Error('Circuit did not converge. Check diode orientation and source values.');
}

function operatingPoint(circuit, sourceValue) {
  try { return solveNonlinear(circuit, { sourceValue }); }
  catch (error) {
    if (!circuit.models.size || /singular/.test(error.message)) throw error;
    // Source stepping: ramp all independent sources up from 10 % for hard nonlinear circuits.
    let guess = null;
    for (let scale = 0.1; scale <= 1.0001; scale += 0.1) guess = solveNonlinear(circuit, { guess, sourceValue, scale: Math.min(scale, 1) });
    return guess;
  }
}

function partCurrents(circuit, x, sourceValue, capacitorCurrents = null) {
  const currents = {};
  for (const part of circuit.parts) {
    const [a, b] = circuit.terminals.get(part.id);
    const voltage = voltageAcross(x, a, b);
    if (part.type === 'resistor') currents[part.id] = voltage / Number(part.value);
    else if (circuit.branchIndex.has(part.id)) currents[part.id] = x[circuit.branchIndex.get(part.id)];
    else if (circuit.models.has(part.id)) currents[part.id] = diodeCurrent(circuit.models.get(part.id), voltage);
    else if (part.type === 'current') currents[part.id] = sourceValue(part);
    else if (part.type === 'capacitor') currents[part.id] = capacitorCurrents?.get(part.id) ?? 0;
    else currents[part.id] = 0;
  }
  return currents;
}

const dissipatedPower = (circuit, x, currents) => circuit.parts
  .filter((part) => part.type === 'resistor' || circuit.models.has(part.id))
  .reduce((sum, part) => { const [a, b] = circuit.terminals.get(part.id); return sum + voltageAcross(x, a, b) * currents[part.id]; }, 0);

const nodeVoltages = (circuit, x) => Object.fromEntries([['0', 0], ...circuit.nodeNames.map((name, index) => [name, x[index]])]);

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
  const nodes = Object.fromEntries(circuit.nodeNames.map((name, index) => [name, [x[index]]]));
  const initialCurrents = partCurrents(circuit, x, sourceAt(0));
  const currents = Object.fromEntries(Object.entries(initialCurrents).map(([id, value]) => [id, [value]]));

  for (let index = 1; index <= steps; index += 1) {
    const t = Math.min(index * h, stop);
    const dt = t - time[time.length - 1];
    const method = index === 1 ? 'euler' : 'trapezoidal';
    x = solveNonlinear(circuit, { guess: x, sourceValue: sourceAt(t), step: { h: dt, method, capacitors, inductors } });
    const capacitorCurrents = new Map();
    for (const part of circuit.parts) {
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
    circuit.nodeNames.forEach((name, nodeIndex) => nodes[name].push(x[nodeIndex]));
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
  const { size, nodeNames, terminals, branchIndex, models } = circuit;
  const nodes = Object.fromEntries(nodeNames.map((name) => [name, { magnitude: [], phase: [] }]));
  for (const frequency of frequencies) {
    const omega = 2 * Math.PI * frequency;
    const re = Array.from({ length: size }, () => Array(size).fill(0));
    const im = Array.from({ length: size }, () => Array(size).fill(0));
    const bRe = Array(size).fill(0), bIm = Array(size).fill(0);
    for (const part of circuit.parts) {
      const [a, b] = terminals.get(part.id);
      const value = Number(part.value);
      if (part.type === 'resistor') stampConductance(re, a, b, 1 / value);
      else if (part.type === 'capacitor') stampConductance(im, a, b, omega * value);
      else if (models.has(part.id)) {
        const model = models.get(part.id);
        stampConductance(re, a, b, model.saturation * Math.exp(voltageAcross(bias, a, b) / model.nVt) / model.nVt + GMIN);
      } else if (part.type === 'current') { if (part.id === input.id) stampCurrent(bRe, a, b, 1); }
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
    nodeNames.forEach((name, index) => {
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
