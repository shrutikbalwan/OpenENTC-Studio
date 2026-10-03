// Wireless sensor networks: seeded deployments, connectivity and coverage, the first-order
// radio energy model, and round-by-round lifetime simulation of direct transmission, minimum-
// transmission-energy multi-hop routing and LEACH clustering (Heinzelman et al., 2000/2002).

export const RADIO_DEFAULTS = Object.freeze({ eElec: 50e-9, eFs: 10e-12, eMp: 0.0013e-12, eDa: 5e-9, packetBits: 4000, controlBits: 200 });
/** Crossover distance d0 = √(ε_fs/ε_mp) between free-space (d²) and multipath (d⁴) loss. */
export const crossover = (radio = RADIO_DEFAULTS) => Math.sqrt(radio.eFs / radio.eMp);
export function txEnergy(bits, distance, radio = RADIO_DEFAULTS) {
  const d0 = crossover(radio);
  return bits * radio.eElec + (distance < d0 ? bits * radio.eFs * distance ** 2 : bits * radio.eMp * distance ** 4);
}
export const rxEnergy = (bits, radio = RADIO_DEFAULTS) => bits * radio.eElec;

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Uniform random (or grid) deployment of n nodes in a width × height field. */
export function deploy({ nodes = 100, width = 100, height = 100, seed = 1, layout = 'random', sink = null }) {
  const random = mulberry32(seed);
  const list = [];
  if (layout === 'grid') {
    const columns = Math.ceil(Math.sqrt(nodes * width / height)), rows = Math.ceil(nodes / columns);
    for (let k = 0; k < nodes; k += 1) list.push({ id: k, x: width * ((k % columns) + 0.5) / columns, y: height * (Math.floor(k / columns) + 0.5) / rows });
  } else for (let k = 0; k < nodes; k += 1) list.push({ id: k, x: random() * width, y: random() * height });
  return { width, height, nodes: list, sink: sink ?? { x: width / 2, y: height / 2 } };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Neighbour graph within radio range; hops to the sink by BFS; isolated nodes. */
export function connectivity(field, range) {
  const { nodes, sink } = field;
  const neighbours = nodes.map((a) => nodes.filter((b) => b !== a && dist(a, b) <= range).map((b) => b.id));
  const hops = Array(nodes.length).fill(Infinity), queue = [];
  nodes.forEach((node) => { if (dist(node, sink) <= range) { hops[node.id] = 1; queue.push(node.id); } });
  for (let i = 0; i < queue.length; i += 1) for (const next of neighbours[queue[i]]) if (hops[next] === Infinity) { hops[next] = hops[queue[i]] + 1; queue.push(next); }
  const reachable = hops.filter(Number.isFinite).length;
  const degree = neighbours.reduce((sum, list) => sum + list.length, 0) / Math.max(1, nodes.length);
  return { neighbours, hops, reachable, connectedFraction: reachable / Math.max(1, nodes.length), averageDegree: degree, maxHops: Math.max(0, ...hops.filter(Number.isFinite)), isolated: neighbours.filter((list) => !list.length).length };
}

/** Fraction of the field covered by at least k sensing discs (grid estimate) and the uncovered holes. */
export function coverage(field, sensingRange, { k = 1, resolution = 80 } = {}) {
  let covered = 0, kCovered = 0;
  const cells = [];
  for (let i = 0; i < resolution; i += 1) for (let j = 0; j < resolution; j += 1) {
    const p = { x: field.width * (i + 0.5) / resolution, y: field.height * (j + 0.5) / resolution };
    const count = field.nodes.reduce((sum, node) => sum + (dist(node, p) <= sensingRange ? 1 : 0), 0);
    if (count >= 1) covered += 1;
    if (count >= k) kCovered += 1;
    cells.push(count);
  }
  const total = resolution * resolution;
  // Expected 1-coverage for a Poisson field ignoring edges: 1 − exp(−λπr²).
  const density = field.nodes.length / (field.width * field.height);
  return { fraction: covered / total, kFraction: kCovered / total, expected: 1 - Math.exp(-density * Math.PI * sensingRange ** 2), cells, resolution };
}

/**
 * Lifetime simulation. Each round every alive node sends one data packet to the sink:
 *  - direct:  straight to the sink;
 *  - mte:     along the minimum-energy path (Dijkstra on txEnergy) through other nodes;
 *  - leach:   to its nearest cluster head (elected with T(n) = p/(1 − p·(r mod 1/p))), which
 *             aggregates the packets and sends one to the sink.
 */
export function simulateLifetime(field, { protocol = 'leach', initialEnergy = 0.5, chProbability = 0.05, maxRounds = 5000, radio = RADIO_DEFAULTS, seed = 7, recordRound = null } = {}) {
  const random = mulberry32(seed);
  const n = field.nodes.length, energy = Array(n).fill(initialEnergy), alive = () => energy.map((e, i) => (e > 0 ? i : -1)).filter((i) => i >= 0);
  const lastHead = Array(n).fill(-Infinity);
  const epoch = Math.round(1 / chProbability);
  const history = { alive: [], energy: [], heads: [], headIds: [], delivered: [] };
  let firstDeath = null, halfDeath = null, lastDeath = null, delivered = 0, snapshot = null;
  const spend = (i, joules) => { energy[i] -= joules; };
  const toSink = field.nodes.map((node) => dist(node, field.sink));
  for (let round = 0; round < maxRounds; round += 1) {
    const living = alive();
    if (!living.length) { lastDeath ??= round; break; }
    let heads = [];
    const assignments = new Map();
    if (protocol === 'direct') {
      for (const i of living) { spend(i, txEnergy(radio.packetBits, toSink[i], radio)); delivered += 1; }
    } else if (protocol === 'mte') {
      // Dijkstra from the sink over alive nodes with edge cost = transmit energy.
      const cost = Array(n).fill(Infinity), next = Array(n).fill(-1), done = Array(n).fill(false);
      for (const i of living) cost[i] = txEnergy(radio.packetBits, toSink[i], radio);
      for (let step = 0; step < living.length; step += 1) {
        let u = -1;
        for (const i of living) if (!done[i] && (u < 0 || cost[i] < cost[u])) u = i;
        if (u < 0) break;
        done[u] = true;
        for (const v of living) {
          if (done[v]) continue;
          const c = cost[u] + txEnergy(radio.packetBits, dist(field.nodes[u], field.nodes[v]), radio) + rxEnergy(radio.packetBits, radio);
          if (c < cost[v]) { cost[v] = c; next[v] = u; }
        }
      }
      for (const i of living) {
        let node = i;
        while (node >= 0 && energy[node] > 0) {
          const hop = next[node];
          spend(node, txEnergy(radio.packetBits, hop >= 0 ? dist(field.nodes[node], field.nodes[hop]) : toSink[node], radio));
          if (hop >= 0) spend(hop, rxEnergy(radio.packetBits, radio));
          if (hop < 0) { delivered += 1; break; }
          node = hop;
        }
      }
      assignments.set('next', next);
    } else {
      const r = round % epoch;
      const threshold = chProbability / (1 - chProbability * r);
      // Nodes that have not been head yet in the current epoch of 1/p rounds are eligible.
      const currentEpoch = Math.floor(round / epoch);
      heads = living.filter((i) => Math.floor(lastHead[i] / epoch) < currentEpoch && (r === epoch - 1 || random() < threshold));
      for (const h of heads) lastHead[h] = round;
      if (!heads.length) {
        for (const i of living) { spend(i, txEnergy(radio.packetBits, toSink[i], radio)); delivered += 1; }
      } else {
        // Advertisement broadcasts and join requests (control packets).
        const advertise = Math.hypot(field.width, field.height);
        for (const h of heads) spend(h, txEnergy(radio.controlBits, advertise, radio));
        const members = new Map(heads.map((h) => [h, []]));
        for (const i of living) {
          if (heads.includes(i)) continue;
          spend(i, rxEnergy(radio.controlBits * heads.length, radio));
          let best = heads[0];
          for (const h of heads) if (dist(field.nodes[i], field.nodes[h]) < dist(field.nodes[i], field.nodes[best])) best = h;
          spend(i, txEnergy(radio.controlBits, dist(field.nodes[i], field.nodes[best]), radio));
          spend(best, rxEnergy(radio.controlBits, radio));
          members.get(best).push(i);
          spend(i, txEnergy(radio.packetBits, dist(field.nodes[i], field.nodes[best]), radio));
        }
        for (const h of heads) {
          const count = members.get(h).length;
          spend(h, count * rxEnergy(radio.packetBits, radio) + (count + 1) * radio.eDa * radio.packetBits);
          spend(h, txEnergy(radio.packetBits, toSink[h], radio));
          delivered += count + 1;
        }
        assignments.set('members', members);
      }
    }
    const nowAlive = energy.filter((e) => e > 0).length;
    if (nowAlive < n && firstDeath === null) firstDeath = round + 1;
    if (nowAlive <= n / 2 && halfDeath === null) halfDeath = round + 1;
    if (nowAlive === 0 && lastDeath === null) lastDeath = round + 1;
    history.alive.push(nowAlive); history.energy.push(energy.reduce((sum, e) => sum + Math.max(0, e), 0)); history.heads.push(heads.length); history.headIds.push(heads); history.delivered.push(delivered);
    if (recordRound !== null && round === recordRound) snapshot = { round, heads: [...heads], members: assignments.get('members') ? Object.fromEntries([...assignments.get('members')].map(([h, list]) => [h, [...list]])) : null, next: assignments.get('next') ? [...assignments.get('next')] : null, energy: [...energy] };
    if (nowAlive === 0) break;
  }
  return { protocol, firstDeath, halfDeath, lastDeath, delivered, history, snapshot, rounds: history.alive.length };
}
