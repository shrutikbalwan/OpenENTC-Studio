// Two-layer grid autorouter. Each net is grown pad by pad with an A* search over a
// cell grid (8 directions on each layer plus vias). Clearances are enforced by keep-out
// maps: a cell is usable by a net only if no other net's copper lies within
// clearance + half the track width (+ a grid allowance) of the cell centre.
import { pointShapeDistance, shapeBounds } from './geometry.mjs';
import { connectivity as connectivityGroups, copperItems, ratsnest } from './board.mjs';

const LAYERS = ['top', 'bottom'];
const BLOCKED = -1;

class MinHeap {
  constructor() { this.keys = []; this.values = []; }
  get size() { return this.keys.length; }
  push(key, value) {
    const keys = this.keys, values = this.values;
    let i = keys.length; keys.push(key); values.push(value);
    while (i > 0) { const p = (i - 1) >> 1; if (keys[p] <= key) break; keys[i] = keys[p]; values[i] = values[p]; i = p; }
    keys[i] = key; values[i] = value;
  }
  pop() {
    const keys = this.keys, values = this.values;
    const top = values[0];
    const lastKey = keys.pop(), lastValue = values.pop();
    if (keys.length) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= keys.length) break;
        if (child + 1 < keys.length && keys[child + 1] < keys[child]) child += 1;
        if (keys[child] >= lastKey) break;
        keys[i] = keys[child]; values[i] = values[child]; i = child;
      }
      keys[i] = lastKey; values[i] = lastValue;
    }
    return top;
  }
}

function createGrid(board, rules) {
  const step = rules.grid;
  const { x1, y1, x2, y2 } = board.outline;
  const cols = Math.floor((x2 - x1) / step) + 1, rows = Math.floor((y2 - y1) / step) + 1;
  if (cols * rows > 1_500_000) throw new RangeError('The board is too large for the router grid; increase the grid size.');
  const owner = LAYERS.map(() => new Int32Array(cols * rows));
  return { step, x0: x1, y0: y1, cols, rows, owner, netIds: new Map(board.nets.map((net, index) => [net, index + 1])) };
}

const cellX = (grid, i) => grid.x0 + i * grid.step;
const cellY = (grid, j) => grid.y0 + j * grid.step;

/** Mark the keep-out region of one copper shape (inflated by `inflate`) for `netId`. */
function markShape(grid, layerIndex, shape, inflate, netId) {
  const bounds = shapeBounds(shape);
  const i1 = Math.max(0, Math.floor((bounds.x1 - inflate - grid.x0) / grid.step)), i2 = Math.min(grid.cols - 1, Math.ceil((bounds.x2 + inflate - grid.x0) / grid.step));
  const j1 = Math.max(0, Math.floor((bounds.y1 - inflate - grid.y0) / grid.step)), j2 = Math.min(grid.rows - 1, Math.ceil((bounds.y2 + inflate - grid.y0) / grid.step));
  const map = grid.owner[layerIndex];
  for (let j = j1; j <= j2; j += 1) for (let i = i1; i <= i2; i += 1) {
    if (pointShapeDistance(cellX(grid, i), cellY(grid, j), shape) > inflate) continue;
    const index = j * grid.cols + i;
    const current = map[index];
    if (current === 0) map[index] = netId;
    else if (current !== netId) map[index] = BLOCKED;
  }
}

function markEdges(grid, board, inset) {
  for (const map of grid.owner) for (let j = 0; j < grid.rows; j += 1) for (let i = 0; i < grid.cols; i += 1) {
    const x = cellX(grid, i), y = cellY(grid, j);
    const edge = Math.min(x - board.outline.x1, board.outline.x2 - x, y - board.outline.y1, board.outline.y2 - y);
    if (edge < inset) map[j * grid.cols + i] = BLOCKED;
  }
}

/** Cells whose centre lies inside a shape: where a route may start or finish. */
function cellsInside(grid, shape) {
  const bounds = shapeBounds(shape);
  const cells = [];
  for (let j = Math.max(0, Math.ceil((bounds.y1 - grid.y0) / grid.step)); j <= Math.min(grid.rows - 1, Math.floor((bounds.y2 - grid.y0) / grid.step)); j += 1) {
    for (let i = Math.max(0, Math.ceil((bounds.x1 - grid.x0) / grid.step)); i <= Math.min(grid.cols - 1, Math.floor((bounds.x2 - grid.x0) / grid.step)); i += 1) {
      if (pointShapeDistance(cellX(grid, i), cellY(grid, j), shape) === 0) cells.push(j * grid.cols + i);
    }
  }
  if (!cells.length) {
    // Tiny pad between grid points: use the nearest cell.
    const cx = shape.kind === 'segment' ? shape.x1 : shape.x, cy = shape.kind === 'segment' ? shape.y1 : shape.y;
    const i = Math.min(grid.cols - 1, Math.max(0, Math.round((cx - grid.x0) / grid.step))), j = Math.min(grid.rows - 1, Math.max(0, Math.round((cy - grid.y0) / grid.step)));
    cells.push(j * grid.cols + i);
  }
  return cells;
}

const DIRECTIONS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/**
 * A* from any source node to any target node. Nodes are (layer, cell) packed as
 * layer * cells + cell. Horizontal runs are cheaper on top and vertical runs on the
 * bottom, which keeps the two layers from fighting over the same channels.
 */
function search(grid, netId, sources, targets, { viaCost, viaRadiusCells, layers }) {
  const cells = grid.cols * grid.rows;
  const total = cells * 2;
  const g = new Float32Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const targetSet = new Set(targets);
  const targetPoints = targets.map((node) => { const cell = node % cells; return [cell % grid.cols, Math.floor(cell / grid.cols)]; });
  const heuristic = (cell) => {
    const i = cell % grid.cols, j = Math.floor(cell / grid.cols);
    let best = Infinity;
    for (let k = 0; k < targetPoints.length; k += Math.max(1, Math.floor(targetPoints.length / 16))) {
      const dx = Math.abs(i - targetPoints[k][0]), dy = Math.abs(j - targetPoints[k][1]);
      best = Math.min(best, Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
    }
    return best;
  };
  const usable = (layer, cell) => { const value = grid.owner[layer][cell]; return value === 0 || value === netId; };
  const viaFits = (cell) => {
    const i = cell % grid.cols, j = Math.floor(cell / grid.cols);
    for (let dj = -viaRadiusCells; dj <= viaRadiusCells; dj += 1) for (let di = -viaRadiusCells; di <= viaRadiusCells; di += 1) {
      if (di * di + dj * dj > viaRadiusCells * viaRadiusCells) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= grid.cols || jj >= grid.rows) return false;
      const neighbour = jj * grid.cols + ii;
      if (!usable(0, neighbour) || !usable(1, neighbour)) return false;
    }
    return true;
  };
  const heap = new MinHeap();
  for (const node of sources) { g[node] = 0; heap.push(heuristic(node % cells), node); }
  let expansions = 0;
  while (heap.size) {
    const node = heap.pop();
    if (closed[node]) continue;
    closed[node] = 1;
    if (targetSet.has(node)) {
      const path = [];
      for (let current = node; current !== -1; current = parent[current]) path.push(current);
      return path.reverse();
    }
    if (++expansions > 2_000_000) return null;
    const layer = node >= cells ? 1 : 0;
    const cell = node - layer * cells;
    const i = cell % grid.cols, j = Math.floor(cell / grid.cols);
    for (const [di, dj, cost] of DIRECTIONS) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= grid.cols || jj >= grid.rows) continue;
      const next = jj * grid.cols + ii;
      if (!usable(layer, next)) continue;
      if (di && dj && (!usable(layer, j * grid.cols + ii) || !usable(layer, jj * grid.cols + i))) continue; // no corner cutting
      const preferred = layer === 0 ? dj === 0 : di === 0;
      const step = cost + (preferred ? 0 : 0.6);
      const nextNode = layer * cells + next;
      const tentative = g[node] + step;
      if (tentative < g[nextNode]) { g[nextNode] = tentative; parent[nextNode] = node; heap.push(tentative + heuristic(next), nextNode); }
    }
    if (layers === 2) {
      const other = (1 - layer) * cells + cell;
      if (usable(1 - layer, cell) && g[node] + viaCost < g[other] && viaFits(cell)) { g[other] = g[node] + viaCost; parent[other] = node; heap.push(g[other] + heuristic(cell), other); }
    }
  }
  return null;
}

/** Convert a node path into straight track segments and vias. */
function pathToCopper(grid, path, net, rules) {
  const cells = grid.cols * grid.rows;
  const tracks = [], vias = [];
  const point = (node) => { const cell = node % cells; return { layer: node >= cells ? 1 : 0, x: round(cellX(grid, cell % grid.cols)), y: round(cellY(grid, Math.floor(cell / grid.cols))) }; };
  let start = point(path[0]);
  let previous = start, direction = null;
  for (let k = 1; k < path.length; k += 1) {
    const current = point(path[k]);
    if (current.layer !== previous.layer) {
      if (previous.x !== start.x || previous.y !== start.y) tracks.push({ net, layer: LAYERS[start.layer], x1: start.x, y1: start.y, x2: previous.x, y2: previous.y, width: rules.trackWidth });
      vias.push({ net, x: current.x, y: current.y, diameter: rules.viaDiameter, drill: rules.viaDrill });
      start = current; previous = current; direction = null;
      continue;
    }
    const step = [Math.sign(round(current.x - previous.x)), Math.sign(round(current.y - previous.y))];
    if (direction && (step[0] !== direction[0] || step[1] !== direction[1])) {
      tracks.push({ net, layer: LAYERS[start.layer], x1: start.x, y1: start.y, x2: previous.x, y2: previous.y, width: rules.trackWidth });
      start = previous;
    }
    direction = step;
    previous = current;
  }
  if (previous.x !== start.x || previous.y !== start.y) tracks.push({ net, layer: LAYERS[start.layer], x1: start.x, y1: start.y, x2: previous.x, y2: previous.y, width: rules.trackWidth });
  return { tracks, vias };
}

const round = (value) => Math.round(value * 1e4) / 1e4;

function routeOnce(board, rules, order, existing, layers) {
  const grid = createGrid(board, rules);
  const allowance = rules.grid * Math.SQRT1_2; // a path between two free cell centres stays within this of one of them
  const inflate = rules.clearance + rules.trackWidth / 2 + allowance;
  const tracks = [...existing.tracks], vias = [...existing.vias];
  for (const item of copperItems(board, tracks, vias)) {
    if (!item.net) { for (const layer of item.layers) markShape(grid, LAYERS.indexOf(layer), item.shape, inflate, BLOCKED); continue; }
    for (const layer of item.layers) markShape(grid, LAYERS.indexOf(layer), item.shape, inflate, grid.netIds.get(item.net));
  }
  markEdges(grid, board, rules.edgeClearance + rules.trackWidth / 2 + allowance);
  const cells = grid.cols * grid.rows;
  const viaRadiusCells = Math.max(0, Math.ceil((rules.viaDiameter / 2 - rules.trackWidth / 2) / rules.grid));
  const failed = [];
  const nodesOf = (shape, itemLayers) => { const inside = cellsInside(grid, shape); return itemLayers.flatMap((layer) => inside.map((cell) => LAYERS.indexOf(layer) * cells + cell)); };
  for (const net of order) {
    const netId = grid.netIds.get(net);
    // Connections still open for this net, nearest first; route each from the net's current copper.
    for (let guard = 0; guard < 200; guard += 1) {
      const open = ratsnest(board, tracks, vias).filter((line) => line.net === net);
      if (!open.length) break;
      const line = open[0];
      const fromPad = board.pads.find((pad) => pad.x === line.x1 && pad.y === line.y1 && pad.net === net);
      const toPad = board.pads.find((pad) => pad.x === line.x2 && pad.y === line.y2 && pad.net === net);
      // Sources: everything connected to the first pad; targets: the second pad's island.
      const all = copperItems(board, tracks, vias);
      const groups = connectivityGroups(all);
      const islandItems = (pad) => { const padIndex = all.findIndex((item) => item.type === 'pad' && item.x === pad.x && item.y === pad.y && item.net === net); return all.filter((_, index) => groups[index] === groups[padIndex]); };
      const sources = islandItems(fromPad).flatMap((item) => nodesOf(item.shape, item.layers.filter((layer) => layers === 2 || layer === 'top')));
      const targets = islandItems(toPad).flatMap((item) => nodesOf(item.shape, item.layers.filter((layer) => layers === 2 || layer === 'top')));
      const path = search(grid, netId, sources, targets, { viaCost: 6, viaRadiusCells, layers });
      if (!path) { failed.push({ net, from: line.from, to: line.to }); break; }
      const copper = pathToCopper(grid, path, net, rules);
      for (const track of copper.tracks) { tracks.push(track); markShape(grid, LAYERS.indexOf(track.layer), { kind: 'segment', x1: track.x1, y1: track.y1, x2: track.x2, y2: track.y2, r: track.width / 2 }, inflate, netId); }
      for (const via of copper.vias) { vias.push(via); for (const layerIndex of [0, 1]) markShape(grid, layerIndex, { kind: 'circle', x: via.x, y: via.y, r: via.diameter / 2 }, inflate, netId); }
    }
  }
  return { tracks, vias, failed };
}


/**
 * Route every open connection. Nets go shortest-first; when some fail, the failed nets are
 * moved to the front and the board is re-routed (up to `passes` times), keeping the best.
 */
export function autoroute(board, { tracks = [], vias = [], layers = 2, passes = 4, nets } = {}) {
  const rules = board.rules;
  const lines = ratsnest(board, tracks, vias);
  const lengths = new Map();
  for (const line of lines) lengths.set(line.net, (lengths.get(line.net) || 0) + line.length);
  let order = [...lengths.keys()].filter((net) => !nets || nets.includes(net)).sort((a, b) => lengths.get(a) - lengths.get(b));
  let best = null;
  for (let pass = 0; pass < passes && order.length; pass += 1) {
    const result = routeOnce(board, rules, order, { tracks, vias }, layers);
    const remaining = ratsnest(board, result.tracks, result.vias).length;
    if (!best || remaining < best.remaining) best = { ...result, remaining, pass: pass + 1 };
    if (!remaining) break;
    const failedNets = [...new Set(result.failed.map((entry) => entry.net))];
    order = [...failedNets, ...order.filter((net) => !failedNets.includes(net))];
  }
  if (!best) return { tracks, vias, failed: [], remaining: 0, passes: 0 };
  return { tracks: best.tracks, vias: best.vias, failed: best.failed, remaining: best.remaining, passes: best.pass };
}
