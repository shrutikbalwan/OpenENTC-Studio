const MAX_BLOCKS = 512;
const MAX_CONNECTIONS = 2048;
const MAX_TEXT = 200;
const PORT_TYPES = Object.freeze(['real', 'complex', 'bits', 'bytes', 'message']);
const DIRECTIONS = Object.freeze(['input', 'output']);
const MAX_EXECUTION_ITEMS = 1_000_000;
import { addAwgn, bitErrorRate, qpskDemodulate, qpskModulate } from '../../communications/src/index.mjs';

function text(value, name) { if (typeof value !== 'string' || !value || value.length > MAX_TEXT || [...value].some((character) => character < ' ' || character === '\u007f')) throw new TypeError(`${name} is invalid.`); return value; }
function rate(value, name) { if (!Number.isFinite(value) || value <= 0 || value > 1e12) throw new TypeError(`${name} must be a positive bounded rate.`); return value; }
function port(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} is invalid.`); const id = text(value.id, `${name} id`); const direction = text(value.direction, `${name} direction`); const type = text(value.type, `${name} type`); if (!DIRECTIONS.includes(direction) || !PORT_TYPES.includes(type)) throw new TypeError(`${name} direction or type is unsupported.`); if (value.rate !== undefined) rate(value.rate, `${name} rate`); if (value.unit !== undefined) text(value.unit, `${name} unit`); return { ...value, id, direction, type, ...(value.rate === undefined ? {} : { rate: value.rate }) }; }

export const FLOWGRAPH_FORMAT = 'openentc-flowgraph';
export const FLOWGRAPH_VERSION = 1;
export const FLOWGRAPH_PORT_TYPES = PORT_TYPES;

export function validateFlowgraph(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.format !== FLOWGRAPH_FORMAT || input.version !== FLOWGRAPH_VERSION) throw new TypeError('Flowgraph format or version is unsupported.');
  text(input.name, 'Flowgraph name');
  if (!Array.isArray(input.blocks) || input.blocks.length > MAX_BLOCKS) throw new TypeError('Flowgraph blocks are invalid.');
  const blocks = input.blocks.map((block) => { if (!block || typeof block !== 'object' || Array.isArray(block)) throw new TypeError('Flowgraph block is invalid.'); const id = text(block.id, 'Flowgraph block id'); const kind = text(block.kind, 'Flowgraph block kind'); const ports = Array.isArray(block.ports) && block.ports.length <= 128 ? block.ports.map((entry) => port(entry, `Flowgraph ${id} port`)) : null; if (!ports) throw new TypeError(`Flowgraph ${id} ports are invalid.`); if (new Set(ports.map((entry) => entry.id)).size !== ports.length) throw new TypeError(`Flowgraph ${id} ports must be unique.`); return { ...block, id, kind, ports }; });
  const blockMap = new Map(blocks.map((block) => [block.id, block])); if (blockMap.size !== blocks.length) throw new TypeError('Flowgraph block ids must be unique.');
  if (!Array.isArray(input.connections) || input.connections.length > MAX_CONNECTIONS) throw new TypeError('Flowgraph connections are invalid.');
  const connections = input.connections.map((connection) => { if (!connection || typeof connection !== 'object' || Array.isArray(connection)) throw new TypeError('Flowgraph connection is invalid.'); const from = text(connection.from, 'Flowgraph connection source'); const to = text(connection.to, 'Flowgraph connection destination'); const [fromBlock, fromPort] = from.split(':'); const [toBlock, toPort] = to.split(':'); const source = blockMap.get(fromBlock)?.ports.find((entry) => entry.id === fromPort); const destination = blockMap.get(toBlock)?.ports.find((entry) => entry.id === toPort); if (!source || !destination || source.direction !== 'output' || destination.direction !== 'input') throw new TypeError('Flowgraph connection references invalid port direction or id.'); if (source.type !== destination.type || (source.rate !== undefined && destination.rate !== undefined && source.rate !== destination.rate)) throw new TypeError('Flowgraph connection has incompatible port type or rate.'); return { ...connection, from, to }; });
  const adjacency = new Map(blocks.map((block) => [block.id, []])); for (const connection of connections) adjacency.get(connection.from.split(':')[0]).push(connection.to.split(':')[0]);
  const visiting = new Set(); const visited = new Set(); const visit = (id) => { if (visiting.has(id)) throw new TypeError('Flowgraph contains a cycle.'); if (visited.has(id)) return; visiting.add(id); for (const next of adjacency.get(id)) visit(next); visiting.delete(id); visited.add(id); }; for (const block of blocks) visit(block.id);
  return Object.freeze({ ...input, blocks: Object.freeze(blocks.map((block) => Object.freeze({ ...block, ports: Object.freeze(block.ports.map((entry) => Object.freeze(entry))) }))), connections: Object.freeze(connections.map((connection) => Object.freeze(connection))) });
}

export function createFlowgraph(name = 'Untitled flowgraph') { return validateFlowgraph({ format: FLOWGRAPH_FORMAT, version: FLOWGRAPH_VERSION, name, blocks: [], connections: [] }); }

export function topologicalOrder(flowgraph) {
  const graph = validateFlowgraph(flowgraph); const indegree = new Map(graph.blocks.map((block) => [block.id, 0])); const edges = new Map(graph.blocks.map((block) => [block.id, []])); for (const connection of graph.connections) { const from = connection.from.split(':')[0]; const to = connection.to.split(':')[0]; edges.get(from).push(to); indegree.set(to, indegree.get(to) + 1); }
  const queue = [...indegree.entries()].filter(([, value]) => value === 0).map(([id]) => id).sort(); const order = []; while (queue.length) { const id = queue.shift(); order.push(id); for (const next of edges.get(id)) { indegree.set(next, indegree.get(next) - 1); if (indegree.get(next) === 0) queue.push(next); queue.sort(); } } if (order.length !== graph.blocks.length) throw new TypeError('Flowgraph contains a cycle.'); return Object.freeze(order);
}

export function executeFlowgraph(flowgraph, { inputs = {} } = {}) {
  const graph = validateFlowgraph(flowgraph); const order = topologicalOrder(graph); const outputs = new Map();
  const incoming = new Map(graph.blocks.map((block) => [block.id, []])); for (const connection of graph.connections) incoming.get(connection.to.split(':')[0]).push(connection);
  for (const id of order) {
    const block = graph.blocks.find((entry) => entry.id === id); const values = incoming.get(id).map((connection) => outputs.get(connection.from.split(':')[0])); const parameters = block.parameters && typeof block.parameters === 'object' ? block.parameters : {};
    let value;
    if (block.kind === 'bit-source') value = inputs[id] ?? block.data;
    else if (block.kind === 'qpsk-modulator') value = qpskModulate(values[0]);
    else if (block.kind === 'awgn') value = addAwgn(values[0], { sigma: parameters.sigma ?? 0, seed: parameters.seed ?? 1 });
    else if (block.kind === 'qpsk-demodulator') value = qpskDemodulate(values[0]);
    else if (block.kind === 'ber') value = bitErrorRate(parameters.expected, values[0]);
    else if (block.kind === 'sink') value = values[0];
    else throw new TypeError(`Flowgraph block kind '${block.kind}' is not supported by the built-in offline executor.`);
    if (value === undefined || value === null) throw new TypeError(`Flowgraph block '${id}' has no valid input data.`);
    const count = Array.isArray(value) ? value.length : Array.isArray(value?.symbols) ? value.symbols.length : 1; if (count > MAX_EXECUTION_ITEMS) throw new RangeError('Flowgraph execution output exceeds the limit.'); outputs.set(id, value);
  }
  return Object.freeze({ kind: 'flowgraph-run', outputs: Object.freeze(Object.fromEntries(outputs)) });
}
