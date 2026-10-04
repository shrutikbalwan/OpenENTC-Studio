// Network topology validation and graph metrics.
export function validateTopology(topology) {
  if (!topology || typeof topology !== 'object' || typeof topology.id !== 'string' || !topology.id.trim()) throw new TypeError('Topology id is required.');
  if (!Array.isArray(topology.nodes) || topology.nodes.length > 10_000 || topology.nodes.some((node) => !node || typeof node.id !== 'string' || !node.id.trim())) throw new TypeError('Topology nodes are invalid.');
  if (!Array.isArray(topology.links) || topology.links.length > 100_000) throw new TypeError('Topology links are invalid.');
  const ids = new Set(topology.nodes.map((node) => node.id));
  if (ids.size !== topology.nodes.length || topology.links.some((link) => !link || typeof link.from !== 'string' || typeof link.to !== 'string' || link.from === link.to || !ids.has(link.from) || !ids.has(link.to))) throw new TypeError('Topology links must reference distinct known nodes.');
  return Object.freeze(structuredClone(topology));
}

export function topologyMetrics(topology, sourceId = null) {
  const valid = validateTopology(topology); const adjacency = new Map(valid.nodes.map((node) => [node.id, new Set()]));
  for (const link of valid.links) { adjacency.get(link.from).add(link.to); adjacency.get(link.to).add(link.from); }
  const distances = {}; const queue = [];
  if (sourceId !== null) { if (!adjacency.has(sourceId)) throw new TypeError('Topology source node is unknown.'); distances[sourceId] = 0; queue.push(sourceId); }
  for (let index = 0; index < queue.length; index += 1) { const current = queue[index]; for (const next of adjacency.get(current)) if (distances[next] === undefined) { distances[next] = distances[current] + 1; queue.push(next); } }
  return Object.freeze({ kind: 'topology-metrics', nodes: valid.nodes.length, links: valid.links.length, reachable: Object.keys(distances).length, distances: Object.freeze(distances) });
}
