// Computer-network fundamentals: IPv4 subnetting, VLSM and route summarisation, IPv6 notation,
// link-state (Dijkstra) and distance-vector (Bellman–Ford) routing step by step, sliding-window
// ARQ (stop-and-wait, Go-Back-N, Selective Repeat) timelines with losses, and MAC throughput.

// ---------------------------------------------------------------------------
// IPv4.

export function parseIpv4(text) {
  const parts = String(text).trim().split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) throw new RangeError(`"${text}" is not an IPv4 address.`);
  return parts.reduce((value, part) => value * 256 + Number(part), 0);
}
export const formatIpv4 = (value) => [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');
const maskOf = (prefix) => (prefix === 0 ? 0 : (2 ** 32 - 2 ** (32 - prefix)));
export const binaryIpv4 = (value) => [24, 16, 8, 0].map((shift) => (Math.floor(value / 2 ** shift) % 256).toString(2).padStart(8, '0')).join('.');

/** Parse "a.b.c.d/p" or "a.b.c.d 255.255.255.0". */
export function parseCidr(text) {
  const trimmed = String(text).trim();
  let address, prefix;
  if (trimmed.includes('/')) { const [ip, length] = trimmed.split('/'); address = parseIpv4(ip); prefix = Number(length); }
  else if (/\s/.test(trimmed)) { const [ip, mask] = trimmed.split(/\s+/); address = parseIpv4(ip); prefix = prefixFromMask(parseIpv4(mask)); }
  else { address = parseIpv4(trimmed); prefix = 32; }
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new RangeError('Prefix length must be 0–32.');
  return { address, prefix };
}

export function prefixFromMask(mask) {
  const bits = mask.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bits)) throw new RangeError(`${formatIpv4(mask)} is not a contiguous subnet mask.`);
  return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
}

function addressClass(first) {
  if (first < 128) return 'A'; if (first < 192) return 'B'; if (first < 224) return 'C'; if (first < 240) return 'D (multicast)'; return 'E (reserved)';
}
function addressScope(value) {
  const inRange = (net, prefix) => Math.floor(value / 2 ** (32 - prefix)) === Math.floor(parseIpv4(net) / 2 ** (32 - prefix));
  if (inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)) return 'private (RFC 1918)';
  if (inRange('127.0.0.0', 8)) return 'loopback';
  if (inRange('169.254.0.0', 16)) return 'link-local';
  if (inRange('100.64.0.0', 10)) return 'shared address space (CGNAT)';
  if (inRange('224.0.0.0', 4)) return 'multicast';
  if (inRange('240.0.0.0', 4)) return 'reserved';
  return 'public';
}

/** Everything about one subnet. */
export function subnetInfo(text) {
  const { address, prefix } = typeof text === 'string' ? parseCidr(text) : text;
  const size = 2 ** (32 - prefix), mask = maskOf(prefix);
  const network = address - (address % size), broadcast = network + size - 1;
  const usable = prefix >= 31 ? size : size - 2;
  return {
    address, prefix, network, broadcast, mask, wildcard: 2 ** 32 - 1 - mask, size, usable,
    firstHost: prefix >= 31 ? network : network + 1, lastHost: prefix >= 31 ? broadcast : broadcast - 1,
    cidr: `${formatIpv4(network)}/${prefix}`, class: addressClass(Math.floor(address / 2 ** 24)), scope: addressScope(address),
  };
}

/** Split a network into equal subnets: by count (rounded up to a power of two) or new prefix. */
export function splitSubnet(text, { count = null, newPrefix = null } = {}) {
  const base = subnetInfo(text);
  const prefix = newPrefix ?? base.prefix + Math.ceil(Math.log2(Math.max(1, count)));
  if (prefix < base.prefix || prefix > 32) throw new RangeError(`Cannot split a /${base.prefix} into /${prefix} subnets.`);
  const subnets = [], size = 2 ** (32 - prefix), total = 2 ** (prefix - base.prefix);
  for (let k = 0; k < Math.min(total, 4096); k += 1) subnets.push(subnetInfo({ address: base.network + k * size, prefix }));
  return { prefix, borrowedBits: prefix - base.prefix, total, subnets };
}

/** VLSM: allocate subnets for host requirements, largest first, packed from the start of the block. */
export function vlsm(text, requirements) {
  const base = subnetInfo(text);
  const ordered = requirements.map((entry, index) => ({ ...entry, index })).sort((a, b) => b.hosts - a.hosts || a.index - b.index);
  let next = base.network;
  const allocations = ordered.map((entry) => {
    const bits = Math.max(2, Math.ceil(Math.log2(entry.hosts + 2)));
    const prefix = 32 - bits, size = 2 ** bits;
    next = Math.ceil(next / size) * size;
    if (next + size - 1 > base.broadcast) throw new RangeError(`Not enough space in ${base.cidr} for "${entry.name}" (${entry.hosts} hosts).`);
    const info = subnetInfo({ address: next, prefix });
    next += size;
    return { ...entry, ...info, wasted: info.usable - entry.hosts };
  });
  const used = allocations.reduce((sum, entry) => sum + entry.size, 0);
  return { base, allocations, used, free: base.size - used };
}

/** Smallest single prefix covering all the given networks (route summarisation / supernetting). */
export function summarize(list) {
  const nets = list.map((entry) => subnetInfo(entry));
  if (!nets.length) throw new RangeError('Enter at least one network.');
  let prefix = Math.min(...nets.map((net) => net.prefix));
  const low = Math.min(...nets.map((net) => net.network)), high = Math.max(...nets.map((net) => net.broadcast));
  while (prefix > 0 && Math.floor(low / 2 ** (32 - prefix)) !== Math.floor(high / 2 ** (32 - prefix))) prefix -= 1;
  const summary = subnetInfo({ address: low, prefix });
  const covered = nets.reduce((sum, net) => sum + net.size, 0);
  return { summary, exact: covered === summary.size && new Set(nets.map((net) => net.network)).size === nets.length, extraAddresses: summary.size - covered };
}

// ---------------------------------------------------------------------------
// IPv6 notation.

export function expandIpv6(text) {
  let value = String(text).trim().toLowerCase().split('/')[0];
  if (value.includes('.')) {
    const v4 = parseIpv4(value.slice(value.lastIndexOf(':') + 1));
    value = `${value.slice(0, value.lastIndexOf(':') + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) throw new RangeError('Only one "::" is allowed.');
  const head = halves[0] ? halves[0].split(':') : [], tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0 || (halves.length === 2 && missing < 1)) throw new RangeError('An IPv6 address has eight 16-bit groups.');
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) throw new RangeError('IPv6 groups are 1–4 hexadecimal digits.');
  return groups.map((group) => group.padStart(4, '0'));
}

/** RFC 5952 canonical text: lower case, no leading zeros, longest run (≥ 2) of zero groups as "::". */
export function compressIpv6(text) {
  const groups = expandIpv6(text).map((group) => group.replace(/^0+(?=.)/, ''));
  let best = -1, bestLength = 1;
  for (let i = 0; i < 8;) {
    if (groups[i] !== '0') { i += 1; continue; }
    let j = i; while (j < 8 && groups[j] === '0') j += 1;
    if (j - i > bestLength) { best = i; bestLength = j - i; }
    i = j;
  }
  if (best < 0) return groups.join(':');
  return `${groups.slice(0, best).join(':')}::${groups.slice(best + bestLength).join(':')}`;
}

export function ipv6Info(text) {
  const [, length] = String(text).split('/');
  const prefix = length === undefined ? 128 : Number(length);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) throw new RangeError('IPv6 prefix length must be 0–128.');
  const groups = expandIpv6(text);
  const value = groups.reduce((acc, group) => (acc << 16n) | BigInt(`0x${group}`), 0n);
  const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
  const network = value & mask;
  const toText = (big) => compressIpv6(Array.from({ length: 8 }, (_, k) => ((big >> BigInt(16 * (7 - k))) & 0xffffn).toString(16)).join(':'));
  const first = groups[0];
  const type = value === 1n ? 'loopback' : value === 0n ? 'unspecified' : first.startsWith('fe8') || first.startsWith('fe9') || first.startsWith('fea') || first.startsWith('feb') ? 'link-local' : first.startsWith('ff') ? 'multicast' : /^f[cd]/.test(first) ? 'unique local' : /^[23]/.test(first) ? 'global unicast' : 'other';
  return { expanded: groups.join(':'), compressed: compressIpv6(text), prefix, network: `${toText(network)}/${prefix}`, addresses: 2n ** BigInt(128 - prefix), type };
}

// ---------------------------------------------------------------------------
// Routing.

/** Parse "A B 4" lines into an undirected weighted graph. */
export function parseGraph(text) {
  const edges = String(text).split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line, index) => {
    const [from, to, cost] = line.split(/[\s,]+/);
    const value = Number(cost ?? 1);
    if (!from || !to || from === to || !(value > 0)) throw new RangeError(`Link ${index + 1}: write "A B cost" with a positive cost.`);
    return { from, to, cost: value };
  });
  const nodes = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].sort();
  return { nodes, edges };
}

const neighbours = (graph, node) => graph.edges.flatMap((edge) => (edge.from === node ? [[edge.to, edge.cost]] : edge.to === node ? [[edge.from, edge.cost]] : []));

/** Dijkstra from a source with the textbook step table (N′, D(v), p(v)) and the forwarding table. */
export function dijkstra(graph, source) {
  if (!graph.nodes.includes(source)) throw new RangeError(`Unknown source "${source}".`);
  const distance = Object.fromEntries(graph.nodes.map((node) => [node, Infinity])), previous = Object.fromEntries(graph.nodes.map((node) => [node, null]));
  distance[source] = 0;
  const done = new Set(), steps = [];
  while (done.size < graph.nodes.length) {
    const candidates = graph.nodes.filter((node) => !done.has(node) && Number.isFinite(distance[node]));
    if (!candidates.length) break;
    const node = candidates.reduce((best, next) => (distance[next] < distance[best] || (distance[next] === distance[best] && next < best) ? next : best));
    done.add(node);
    for (const [next, cost] of neighbours(graph, node)) if (!done.has(next) && distance[node] + cost < distance[next]) { distance[next] = distance[node] + cost; previous[next] = node; }
    steps.push({ added: node, visited: [...done], distance: { ...distance }, previous: { ...previous } });
  }
  const forwarding = graph.nodes.filter((node) => node !== source).map((node) => {
    if (!Number.isFinite(distance[node])) return { destination: node, nextHop: null, cost: Infinity, path: [] };
    const path = [node]; while (path[0] !== source) path.unshift(previous[path[0]]);
    return { destination: node, nextHop: path[1], cost: distance[node], path };
  });
  return { distance, previous, steps, forwarding };
}

/**
 * Synchronous distance-vector rounds. Each round every node sends its vector to its neighbours
 * and recomputes Dx(y) = min_v c(x,v) + Dv(y). `poisonedReverse` advertises ∞ for routes that go
 * through the neighbour. Stops when nothing changes or at `maxRounds`; costs at or above
 * `infinity` (16 for RIP) count as unreachable.
 */
export function distanceVector(graph, { maxRounds = 100, poisonedReverse = false, infinity = Infinity, initial = null } = {}) {
  const nodes = graph.nodes;
  let table = initial ? structuredClone(initial) : Object.fromEntries(nodes.map((x) => [x, Object.fromEntries(nodes.map((y) => [y, { cost: x === y ? 0 : Infinity, via: x === y ? x : null }]))]));
  if (!initial) for (const x of nodes) for (const [v, cost] of neighbours(graph, x)) table[x][v] = { cost, via: v };
  const rounds = [structuredClone(table)];
  let converged = false;
  for (let round = 0; round < maxRounds; round += 1) {
    const next = {};
    let changed = false;
    for (const x of nodes) {
      next[x] = {};
      for (const y of nodes) {
        if (x === y) { next[x][y] = { cost: 0, via: x }; continue; }
        let best = { cost: Infinity, via: null };
        for (const [v, cost] of neighbours(graph, x)) {
          const advertised = poisonedReverse && table[v][y].via === x ? Infinity : table[v][y].cost;
          const total = Math.min(infinity, cost + advertised);
          if (total < best.cost || (total === best.cost && best.via !== null && v < best.via)) best = { cost: total, via: v };
        }
        if (best.cost >= infinity) best = { cost: Infinity, via: null };
        next[x][y] = best;
        if (best.cost !== table[x][y].cost || best.via !== table[x][y].via) changed = true;
      }
    }
    table = next;
    rounds.push(structuredClone(table));
    if (!changed) { converged = true; rounds.pop(); break; }
  }
  return { rounds, table, converged, roundsToConverge: rounds.length - 1 };
}

/** Change a link cost (Infinity = failure) starting from a converged table: shows count-to-infinity. */
export function linkChange(graph, { from, to, cost }, options = {}) {
  const before = distanceVector(graph, options);
  const changed = { nodes: graph.nodes, edges: graph.edges.flatMap((edge) => ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from) ? (Number.isFinite(cost) ? [{ ...edge, cost }] : []) : [edge])) };
  const after = distanceVector(changed, { ...options, initial: before.table });
  return { before, after };
}

// ---------------------------------------------------------------------------
// Sliding-window ARQ.

/**
 * Event simulation of stop-and-wait (window 1), Go-Back-N or Selective Repeat. Times in units of
 * the frame transmission time. `lostFrames` / `lostAcks` are 1-based indices of transmissions
 * (every data frame or ACK sent, including retransmissions) that the channel drops.
 */
export function simulateArq({ protocol = 'gbn', frames = 10, window = 4, propagation = 1, ackTime = 0, timeout = null, lostFrames = [], lostAcks = [] }) {
  const w = protocol === 'stop-and-wait' ? 1 : window;
  if (!(frames >= 1 && frames <= 200)) throw new RangeError('Frames must be 1–200.');
  if (!(w >= 1 && w <= 64)) throw new RangeError('Window must be 1–64.');
  const rto = timeout ?? 1 + 2 * propagation + ackTime + 0.5;
  const lostData = new Set(lostFrames), lostAck = new Set(lostAcks);
  const events = [], deliveries = [];
  let time = 0, dataCount = 0, ackCount = 0, base = 0, next = 0, expected = 0;
  const acked = new Set(), received = new Set(), timers = new Map(), arrivals = [];
  const sendFrame = (seq, retransmission) => {
    dataCount += 1;
    const start = time, lost = lostData.has(dataCount);
    time += 1;
    events.push({ type: 'data', seq, start, end: start + 1 + propagation, lost, retransmission, index: dataCount });
    if (!lost) arrivals.push({ kind: 'data', seq, at: start + 1 + propagation });
    if (protocol === 'sr') timers.set(seq, start + rto);
    else if (!timers.has('base')) timers.set('base', start + rto);
  };
  let guard = 0;
  while ((protocol === 'sr' ? acked.size < frames : base < frames) && guard < 20_000) {
    guard += 1;
    arrivals.sort((a, b) => a.at - b.at);
    const nextArrival = arrivals[0]?.at ?? Infinity;
    const timerEntries = [...timers.entries()].filter(([key]) => key === 'base' || !acked.has(key));
    const nextTimer = timerEntries.length ? Math.min(...timerEntries.map(([, at]) => at)) : Infinity;
    // Send whenever the window allows and nothing happens before the sender is free.
    if (next < base + w && next < frames && time <= Math.min(nextArrival, nextTimer)) { sendFrame(next, false); next += 1; continue; }
    if (!Number.isFinite(nextArrival) && !Number.isFinite(nextTimer)) break;
    if (nextArrival <= nextTimer) {
      const event = arrivals.shift();
      time = Math.max(time, event.at);
      if (event.kind === 'data') {
        // Receiver.
        let ackNumber;
        if (protocol === 'sr') {
          if (event.seq >= expected && event.seq < expected + w) { received.add(event.seq); while (received.has(expected)) { deliveries.push({ seq: expected, at: event.at }); expected += 1; } }
          ackNumber = event.seq; // individual ACK
        } else {
          if (event.seq === expected) { deliveries.push({ seq: expected, at: event.at }); expected += 1; }
          ackNumber = expected; // cumulative: next frame expected
        }
        ackCount += 1;
        const lost = lostAck.has(ackCount);
        events.push({ type: 'ack', ack: ackNumber, start: event.at + ackTime, end: event.at + ackTime + propagation, lost, index: ackCount });
        if (!lost) arrivals.push({ kind: 'ack', ack: ackNumber, at: event.at + ackTime + propagation });
      } else if (protocol === 'sr') {
        acked.add(event.ack); timers.delete(event.ack);
        while (acked.has(base)) base += 1;
      } else if (event.ack > base) {
        base = event.ack;
        if (base < next) timers.set('base', time + rto); else timers.delete('base');
      }
    } else {
      // Timeout.
      time = Math.max(time, nextTimer);
      if (protocol === 'sr') {
        const [seq] = timerEntries.find(([, at]) => at === nextTimer);
        events.push({ type: 'timeout', seq, at: time });
        sendFrame(seq, true);
      } else {
        events.push({ type: 'timeout', seq: base, at: time });
        timers.delete('base');
        for (let seq = base; seq < next; seq += 1) sendFrame(seq, true);
      }
    }
  }
  const finish = Math.max(...events.map((event) => event.end ?? event.at));
  return { protocol, window: w, timeout: rto, events, deliveries, transmissions: dataCount, retransmissions: dataCount - frames, finish, efficiency: frames / finish };
}

/** Link utilisation of the three ARQ schemes with a = Tp/Tt and frame-error probability p. */
export function arqUtilisation({ a, window, p = 0 }) {
  const stopAndWait = (1 - p) / (1 + 2 * a);
  const full = window >= 1 + 2 * a;
  const goBackN = full ? (1 - p) / (1 + 2 * a * p) : window * (1 - p) / ((1 + 2 * a) * (1 - p + window * p));
  const selectiveRepeat = full ? 1 - p : window * (1 - p) / (1 + 2 * a);
  return { stopAndWait, goBackN, selectiveRepeat, windowToFill: 1 + 2 * a, sequenceBitsGbn: Math.ceil(Math.log2(window + 1)), sequenceBitsSr: Math.ceil(Math.log2(2 * window)) };
}

// ---------------------------------------------------------------------------
// Medium access.

export const pureAloha = (g) => g * Math.exp(-2 * g);
export const slottedAloha = (g) => g * Math.exp(-g);
/** Non-persistent and 1-persistent CSMA throughput (Kleinrock–Tobagi) and CSMA/CD efficiency 1/(1 + 5a). */
export const nonPersistentCsma = (g, a) => g * Math.exp(-a * g) / (g * (1 + 2 * a) + Math.exp(-a * g));
export function onePersistentCsma(g, a) {
  const e = Math.exp(-g * (1 + 2 * a));
  return g * (1 + g + a * g * (1 + g + a * g / 2)) * e / (g * (1 + 2 * a) - (1 - Math.exp(-a * g)) + (1 + a * g) * Math.exp(-g * (1 + a)));
}
export const csmaCdEfficiency = (a) => 1 / (1 + 5 * a);
