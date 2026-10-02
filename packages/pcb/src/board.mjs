// Board model: netlist from the Circuit Lab schematic, footprint placement, pads in board
// coordinates, copper connectivity and the ratsnest of connections still to route.
import { normalizeNode, resolveNodeAliases } from '../../schematic/src/index.mjs';
import { nodeFields } from '../../schematic/src/components.mjs';
import { footprintFor, rotatePoint } from './footprints.mjs';
import { shapeBounds, shapeDistance } from './geometry.mjs';

export const DEFAULT_RULES = Object.freeze({
  trackWidth: 0.4, clearance: 0.25, viaDiameter: 0.8, viaDrill: 0.4, edgeClearance: 0.5, grid: 0.2, margin: 3,
  minTrackWidth: 0.15, minDrill: 0.3, minAnnularRing: 0.13, maskExpansion: 0.05,
});

const RULE_LIMITS = { trackWidth: [0.1, 5], clearance: [0.1, 5], viaDiameter: [0.3, 5], viaDrill: [0.15, 4], edgeClearance: [0, 10], grid: [0.05, 1], margin: [0.5, 50], minTrackWidth: [0.05, 5], minDrill: [0.1, 4], minAnnularRing: [0.03, 2], maskExpansion: [0, 1] };

export function normalizeRules(rules = {}) {
  const result = { ...DEFAULT_RULES };
  for (const [key, [low, high]] of Object.entries(RULE_LIMITS)) {
    if (rules[key] === undefined || rules[key] === '') continue;
    const value = Number(rules[key]);
    if (!Number.isFinite(value) || value < low || value > high) throw new RangeError(`${key} must be between ${low} and ${high} mm.`);
    result[key] = value;
  }
  if (result.viaDrill >= result.viaDiameter) throw new RangeError('The via drill must be smaller than the via diameter.');
  return result;
}

const netName = (node) => (node === '0' ? 'GND' : node);

/** Parts (non-ground components) with footprints, and the nets that join their pads. */
export function extractNetlist(circuit, style = 'tht') {
  const components = Array.isArray(circuit?.components) ? circuit.components : [];
  if (components.length > 300) throw new RangeError('PCB Studio handles up to 300 components.');
  const aliases = resolveNodeAliases(components, circuit?.wires || [], circuit?.netLabels || []);
  const canonical = (node) => { const normalized = normalizeNode(node); return netName(aliases[normalized] ?? normalized); };
  const parts = [];
  const warnings = [];
  for (const component of components) {
    if (component.type === 'ground') continue;
    const assignment = footprintFor(component.type, style);
    if (!assignment) { warnings.push(`${component.label || component.id} (${component.type}) has no footprint and is skipped.`); continue; }
    const pinNets = {};
    for (const field of nodeFields(component)) pinNets[assignment.pinMap[field]] = canonical(component[field]);
    if (assignment.powerPins) warnings.push(`${component.label || component.id}: supply pins ${Object.entries(assignment.powerPins).map(([pad, name]) => `${pad} (${name})`).join(', ')} are not in the schematic; wire them to your supply on the board.`);
    parts.push({ id: component.id, reference: component.label || component.id, type: component.type, value: component.value, unit: component.unit, footprint: assignment.footprint, pinNets, powerPins: assignment.powerPins });
  }
  const nets = [...new Set(parts.flatMap((part) => Object.values(part.pinNets)))].sort((a, b) => (a === 'GND' ? -1 : b === 'GND' ? 1 : a.localeCompare(b)));
  return { parts, nets, warnings };
}

function partBounds(part, placement) {
  const { courtyard } = part.footprint;
  const corners = [[courtyard.x1, courtyard.y1], [courtyard.x2, courtyard.y2]].map(([x, y]) => rotatePoint(x, y, placement.rotation));
  return { x1: placement.x + Math.min(corners[0][0], corners[1][0]), y1: placement.y + Math.min(corners[0][1], corners[1][1]), x2: placement.x + Math.max(corners[0][0], corners[1][0]), y2: placement.y + Math.max(corners[0][1], corners[1][1]) };
}

/**
 * Initial placement: parts ordered by a breadth-first walk of the connection graph (so
 * connected parts sit together), packed into rows; then pairwise swaps that shorten the
 * total ratsnest are kept.
 */
export function autoPlace(netlist, { spacing = 2.5, rowWidth } = {}) {
  const { parts } = netlist;
  if (!parts.length) return {};
  const neighbours = new Map(parts.map((part) => [part.id, new Set()]));
  for (const net of netlist.nets) {
    const members = parts.filter((part) => Object.values(part.pinNets).includes(net)).map((part) => part.id);
    if (net === 'GND' && members.length > 4) continue; // ground touches everything; ignore for ordering
    for (const a of members) for (const b of members) if (a !== b) neighbours.get(a).add(b);
  }
  const order = [];
  const seen = new Set();
  const byDegree = [...parts].sort((a, b) => neighbours.get(b.id).size - neighbours.get(a.id).size);
  for (const start of byDegree) {
    if (seen.has(start.id)) continue;
    const queue = [start.id];
    seen.add(start.id);
    while (queue.length) { const id = queue.shift(); order.push(id); for (const next of neighbours.get(id)) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
  }
  const lookup = new Map(parts.map((part) => [part.id, part]));
  const totalArea = parts.reduce((sum, part) => { const c = part.footprint.courtyard; return sum + (c.x2 - c.x1 + spacing) * (c.y2 - c.y1 + spacing); }, 0);
  const width = rowWidth || Math.max(20, Math.sqrt(totalArea) * 1.3);
  const placement = {};
  let x = 0, y = 0, rowHeight = 0;
  for (const id of order) {
    const c = lookup.get(id).footprint.courtyard;
    const w = c.x2 - c.x1, h = c.y2 - c.y1;
    if (x > 0 && x + w > width) { x = 0; y += rowHeight + spacing; rowHeight = 0; }
    placement[id] = { x: round(x - c.x1), y: round(y - c.y1), rotation: 0 };
    x += w + spacing;
    rowHeight = Math.max(rowHeight, h);
  }
  improvePlacement(netlist, placement);
  return placement;
}

const round = (value, step = 0.05) => Math.round(value / step) * step;

function wireLength(netlist, placement) {
  let total = 0;
  for (const net of netlist.nets) {
    const points = [];
    for (const part of netlist.parts) for (const [pad, padNet] of Object.entries(part.pinNets)) if (padNet === net) {
      const local = part.footprint.pads.find((entry) => entry.number === pad);
      const [dx, dy] = rotatePoint(local.x, local.y, placement[part.id].rotation);
      points.push([placement[part.id].x + dx, placement[part.id].y + dy]);
    }
    if (points.length < 2) continue;
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    total += Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys); // half-perimeter wire length
  }
  return total;
}

function improvePlacement(netlist, placement, gap = 1) {
  const ids = Object.keys(placement);
  const lookup = new Map(netlist.parts.map((part) => [part.id, part]));
  const overlapsAny = (changed) => changed.some((id) => {
    const a = partBounds(lookup.get(id), placement[id]);
    return ids.some((other) => {
      if (other === id) return false;
      const b = partBounds(lookup.get(other), placement[other]);
      return a.x1 < b.x2 + gap && b.x1 < a.x2 + gap && a.y1 < b.y2 + gap && b.y1 < a.y2 + gap;
    });
  });
  let best = wireLength(netlist, placement);
  for (let pass = 0; pass < 3; pass += 1) {
    let improved = false;
    for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
      const a = ids[i], b = ids[j];
      [placement[a], placement[b]] = [{ ...placement[b] }, { ...placement[a] }];
      const length = wireLength(netlist, placement);
      if (length < best - 1e-9 && !overlapsAny([a, b])) { best = length; improved = true; } else [placement[a], placement[b]] = [placement[b], placement[a]];
    }
    for (const id of ids) {
      const original = placement[id];
      for (const rotation of [0, 90, 180, 270]) {
        if (rotation === original.rotation) continue;
        placement[id] = { ...original, rotation };
        const length = wireLength(netlist, placement);
        if (length < best - 1e-9 && !overlapsAny([id])) { best = length; improved = true; break; }
        placement[id] = original;
      }
    }
    if (!improved) break;
  }
}

/** Board geometry: placed parts, pads in board coordinates and the outline. */
export function buildBoard(circuit, { style = 'tht', placement = {}, rules: inputRules = {} } = {}) {
  const rules = normalizeRules(inputRules);
  const netlist = extractNetlist(circuit, style);
  const missing = netlist.parts.filter((part) => !placement[part.id]);
  let positions = Object.fromEntries(netlist.parts.filter((part) => placement[part.id]).map((part) => [part.id, sanitizePlacement(placement[part.id])]));
  if (missing.length) {
    const auto = autoPlace({ ...netlist, parts: missing });
    // Place new parts below everything that is already on the board.
    const existing = Object.entries(positions).map(([id, place]) => partBounds(netlist.parts.find((p) => p.id === id), place));
    const offsetY = existing.length ? Math.max(...existing.map((b) => b.y2)) + 3 : 0;
    const offsetX = existing.length ? Math.min(...existing.map((b) => b.x1)) : 0;
    for (const [id, place] of Object.entries(auto)) positions[id] = { ...place, x: round(place.x + offsetX), y: round(place.y + offsetY) };
  }
  const parts = netlist.parts.map((part) => {
    const place = positions[part.id];
    const pads = part.footprint.pads.map((pad) => {
      const [dx, dy] = rotatePoint(pad.x, pad.y, place.rotation);
      const quarter = place.rotation % 180 !== 0;
      const w = quarter ? pad.h : pad.w, h = quarter ? pad.w : pad.h;
      const x = place.x + dx, y = place.y + dy;
      const shape = pad.shape === 'circle' ? { kind: 'circle', x, y, r: w / 2 } : { kind: 'rect', x, y, w, h };
      return { part: part.id, reference: part.reference, number: pad.number, net: part.pinNets[pad.number] ?? null, x, y, w, h, shape, drill: pad.drill, layers: pad.drill ? ['top', 'bottom'] : ['top'] };
    });
    return { ...part, placement: place, pads, bounds: partBounds(part, place), silk: part.footprint.silk.map(([x1, y1, x2, y2]) => { const [ax, ay] = rotatePoint(x1, y1, place.rotation), [bx, by] = rotatePoint(x2, y2, place.rotation); return [place.x + ax, place.y + ay, place.x + bx, place.y + by]; }) };
  });
  const bounds = parts.length ? { x1: Math.min(...parts.map((p) => p.bounds.x1)), y1: Math.min(...parts.map((p) => p.bounds.y1)), x2: Math.max(...parts.map((p) => p.bounds.x2)), y2: Math.max(...parts.map((p) => p.bounds.y2)) } : { x1: 0, y1: 0, x2: 20, y2: 15 };
  const outline = { x1: round(bounds.x1 - rules.margin, 0.5), y1: round(bounds.y1 - rules.margin, 0.5), x2: round(bounds.x2 + rules.margin, 0.5), y2: round(bounds.y2 + rules.margin, 0.5) };
  return { style, rules, parts, pads: parts.flatMap((part) => part.pads), nets: netlist.nets, warnings: netlist.warnings, outline, width: outline.x2 - outline.x1, height: outline.y2 - outline.y1, placement: positions };
}

function sanitizePlacement(place) {
  const x = Number(place.x), y = Number(place.y), rotation = Number(place.rotation) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1000 || Math.abs(y) > 1000) throw new RangeError('Part positions must be within ±1000 mm.');
  if (![0, 90, 180, 270].includes(((rotation % 360) + 360) % 360)) throw new RangeError('Rotation must be a multiple of 90°.');
  return { x, y, rotation: ((rotation % 360) + 360) % 360 };
}

// ---------------------------------------------------------------------------
// Copper items and connectivity.

/** Every copper item: pads, track segments and vias, with their net and layers. */
export function copperItems(board, tracks = [], vias = []) {
  const items = board.pads.map((pad, index) => ({ type: 'pad', index, net: pad.net, layers: pad.layers, shape: pad.shape, label: `${pad.reference} pad ${pad.number}`, x: pad.x, y: pad.y }));
  tracks.forEach((track, index) => items.push({ type: 'track', index, net: track.net, layers: [track.layer], shape: { kind: 'segment', x1: track.x1, y1: track.y1, x2: track.x2, y2: track.y2, r: track.width / 2 }, label: `${track.net} track`, x: (track.x1 + track.x2) / 2, y: (track.y1 + track.y2) / 2 }));
  vias.forEach((via, index) => items.push({ type: 'via', index, net: via.net, layers: ['top', 'bottom'], shape: { kind: 'circle', x: via.x, y: via.y, r: via.diameter / 2 }, label: `${via.net} via`, x: via.x, y: via.y }));
  for (const item of items) item.bounds = shapeBounds(item.shape);
  return items;
}

const overlapBounds = (a, b, margin = 0) => a.x1 - margin <= b.x2 && b.x1 - margin <= a.x2 && a.y1 - margin <= b.y2 && b.y1 - margin <= a.y2;
const shareLayer = (a, b) => a.layers.some((layer) => b.layers.includes(layer));

/** Union-find groups of copper items that physically touch. */
export function connectivity(items) {
  const parent = items.map((_, index) => index);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = items[i], b = items[j];
    if (!shareLayer(a, b) || !overlapBounds(a.bounds, b.bounds, 1e-6)) continue;
    if (shapeDistance(a.shape, b.shape) <= 1e-6) { const ra = find(i), rb = find(j); if (ra !== rb) parent[rb] = ra; }
  }
  return items.map((_, index) => find(index));
}

/** Connections still needed: a minimum spanning forest between copper islands of each net. */
export function ratsnest(board, tracks = [], vias = []) {
  const items = copperItems(board, tracks, vias);
  const groups = connectivity(items);
  const lines = [];
  for (const net of board.nets) {
    const padIndices = items.map((item, index) => ({ item, index })).filter(({ item }) => item.type === 'pad' && item.net === net);
    if (padIndices.length < 2) continue;
    const islands = [...new Set(padIndices.map(({ index }) => groups[index]))];
    if (islands.length < 2) continue;
    // Kruskal over closest pad pairs between islands.
    const edges = [];
    for (let i = 0; i < padIndices.length; i += 1) for (let j = i + 1; j < padIndices.length; j += 1) {
      const a = padIndices[i], b = padIndices[j];
      if (groups[a.index] === groups[b.index]) continue;
      edges.push({ a, b, length: Math.hypot(a.item.x - b.item.x, a.item.y - b.item.y) });
    }
    edges.sort((p, q) => p.length - q.length);
    const parent = new Map(islands.map((island) => [island, island]));
    const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
    for (const edge of edges) {
      const ra = find(groups[edge.a.index]), rb = find(groups[edge.b.index]);
      if (ra === rb) continue;
      parent.set(rb, ra);
      lines.push({ net, x1: edge.a.item.x, y1: edge.a.item.y, x2: edge.b.item.x, y2: edge.b.item.y, from: edge.a.item.label, to: edge.b.item.label, length: edge.length });
    }
  }
  return lines;
}
