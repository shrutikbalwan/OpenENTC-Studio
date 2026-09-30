const EPSILON = 1e-12;
import { resolveNodeAliases } from '../../packages/schematic/src/index.mjs';

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

export function simulateDC(components, wires = [], netLabels = []) {
  const aliases = resolveNodeAliases(components, wires, netLabels);
  const node = (value) => aliases[String(value)] || String(value);
  const supported = components.filter((part) => ['resistor', 'voltage', 'current'].includes(part.type));
  const nodeNames = [...new Set(supported.flatMap((part) => [node(part.n1), node(part.n2)]).filter((name) => name !== '0'))];
  const sources = supported.filter((part) => part.type === 'voltage');
  const currentSources = supported.filter((part) => part.type === 'current');
  if (!sources.length && !currentSources.length) throw new Error('Add at least one DC voltage source or current source.');
  const size = nodeNames.length + sources.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const vector = Array(size).fill(0);
  const nodeIndex = (name) => name === '0' ? -1 : nodeNames.indexOf(node(name));

  for (const part of supported) {
    const a = nodeIndex(part.n1), b = nodeIndex(part.n2);
    if (part.type === 'resistor') {
      const resistance = Number(part.value);
      if (!(resistance > 0)) throw new Error(`${part.label} must have a resistance greater than zero.`);
      const conductance = 1 / resistance;
      if (a >= 0) matrix[a][a] += conductance;
      if (b >= 0) matrix[b][b] += conductance;
      if (a >= 0 && b >= 0) { matrix[a][b] -= conductance; matrix[b][a] -= conductance; }
    } else if (part.type === 'voltage') {
      const sourceIndex = nodeNames.length + sources.indexOf(part);
      if (a >= 0) { matrix[a][sourceIndex] += 1; matrix[sourceIndex][a] += 1; }
      if (b >= 0) { matrix[b][sourceIndex] -= 1; matrix[sourceIndex][b] -= 1; }
      vector[sourceIndex] = Number(part.value);
    } else {
      const current = Number(part.value);
      if (!Number.isFinite(current)) throw new Error(`${part.label} must have a finite current.`);
      // Positive current flows from n1 to n2, so it leaves n1 and enters n2.
      if (a >= 0) vector[a] -= current;
      if (b >= 0) vector[b] += current;
    }
  }
  const solution = solveLinear(matrix, vector);
  const nodes = Object.fromEntries([['0', 0], ...nodeNames.map((name, index) => [name, solution[index]])]);
  const currents = {};
  for (const part of supported) {
    currents[part.id] = part.type === 'resistor'
      ? (nodes[node(part.n1)] - nodes[node(part.n2)]) / Number(part.value)
      : part.type === 'current' ? Number(part.value) : solution[nodeNames.length + sources.indexOf(part)];
  }
  const totalPower = supported.filter((part) => part.type === 'resistor').reduce((sum, part) => sum + currents[part.id] ** 2 * Number(part.value), 0);
  return { nodes, currents, totalPower, warnings: components.filter((part) => !['resistor', 'voltage', 'current', 'ground'].includes(part.type)).map((part) => `${part.label} is ignored in DC resistive mode.`) };
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
