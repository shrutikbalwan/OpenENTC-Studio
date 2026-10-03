// Design-rule check: exact geometric clearances between copper of different nets, shorts,
// track width, drill and annular ring, board-edge clearance, courtyard overlaps and
// connections that are still unrouted.
import { copperItems, ratsnest } from './board.mjs';
import { pointSegmentDistance, shapeDistance } from './geometry.mjs';

const EPSILON = 1e-6;
const overlap = (a, b, margin) => a.x1 - margin <= b.x2 && b.x1 - margin <= a.x2 && a.y1 - margin <= b.y2 && b.y1 - margin <= a.y2;

function edgeDistance(shape, outline) {
  // Smallest distance from copper to any outline edge (negative when outside the board).
  const points = shape.kind === 'segment' ? [[shape.x1, shape.y1], [shape.x2, shape.y2]] : [[shape.x, shape.y]];
  const reach = shape.kind === 'rect' ? [shape.w / 2, shape.h / 2] : [shape.r, shape.r];
  let best = Infinity;
  for (const [x, y] of points) best = Math.min(best, x - reach[0] - outline.x1, outline.x2 - x - reach[0], y - reach[1] - outline.y1, outline.y2 - y - reach[1]);
  return best;
}

export function runDrc(board, { tracks = [], vias = [] } = {}) {
  const rules = board.rules;
  const violations = [];
  const add = (type, severity, message, x, y, items = []) => violations.push({ type, severity, message, x, y, items });
  const items = copperItems(board, tracks, vias);
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = items[i], b = items[j];
    if (a.net && a.net === b.net) continue;
    if (!a.layers.some((layer) => b.layers.includes(layer))) continue;
    if (!overlap(a.bounds, b.bounds, rules.clearance)) continue;
    const gap = shapeDistance(a.shape, b.shape);
    if (gap <= EPSILON && a.net && b.net) add('short', 'error', `Short circuit: ${a.label} (${a.net}) touches ${b.label} (${b.net}).`, (a.x + b.x) / 2, (a.y + b.y) / 2, [a.label, b.label]);
    else if (gap < rules.clearance - EPSILON) add('clearance', 'error', `Clearance ${gap.toFixed(3)} mm < ${rules.clearance} mm between ${a.label} (${a.net || 'no net'}) and ${b.label} (${b.net || 'no net'}).`, (a.x + b.x) / 2, (a.y + b.y) / 2, [a.label, b.label]);
  }
  for (const track of tracks) {
    if (track.width < rules.minTrackWidth - EPSILON) add('track-width', 'error', `Track on ${track.net} is ${track.width} mm wide (minimum ${rules.minTrackWidth} mm).`, (track.x1 + track.x2) / 2, (track.y1 + track.y2) / 2);
  }
  const drilled = [...board.pads.filter((pad) => pad.drill).map((pad) => ({ label: `${pad.reference} pad ${pad.number}`, drill: pad.drill, size: Math.min(pad.w, pad.h), x: pad.x, y: pad.y })), ...vias.map((via) => ({ label: `${via.net} via`, drill: via.drill, size: via.diameter, x: via.x, y: via.y }))];
  for (const hole of drilled) {
    if (hole.drill < rules.minDrill - EPSILON) add('drill', 'error', `${hole.label}: drill ${hole.drill} mm is below the ${rules.minDrill} mm minimum.`, hole.x, hole.y);
    if ((hole.size - hole.drill) / 2 < rules.minAnnularRing - EPSILON) add('annular-ring', 'error', `${hole.label}: annular ring ${((hole.size - hole.drill) / 2).toFixed(3)} mm is below ${rules.minAnnularRing} mm.`, hole.x, hole.y);
  }
  for (const item of items) {
    const distance = edgeDistance(item.shape, board.outline);
    if (distance < rules.edgeClearance - EPSILON) add('edge', 'error', `${item.label} is ${Math.max(0, distance).toFixed(3)} mm from the board edge (minimum ${rules.edgeClearance} mm).`, item.x, item.y, [item.label]);
  }
  for (let i = 0; i < board.parts.length; i += 1) for (let j = i + 1; j < board.parts.length; j += 1) {
    const a = board.parts[i].bounds, b = board.parts[j].bounds;
    if (a.x1 < b.x2 - EPSILON && b.x1 < a.x2 - EPSILON && a.y1 < b.y2 - EPSILON && b.y1 < a.y2 - EPSILON) add('courtyard', 'warning', `Courtyards of ${board.parts[i].reference} and ${board.parts[j].reference} overlap.`, (Math.max(a.x1, b.x1) + Math.min(a.x2, b.x2)) / 2, (Math.max(a.y1, b.y1) + Math.min(a.y2, b.y2)) / 2);
  }
  for (const line of ratsnest(board, tracks, vias)) add('unrouted', 'error', `Unrouted ${line.net}: ${line.from} → ${line.to}.`, (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2);
  // Dangling track ends that touch nothing of their own net are allowed but reported.
  for (const track of tracks) {
    for (const [x, y] of [[track.x1, track.y1], [track.x2, track.y2]]) {
      const touching = items.some((item) => item.net === track.net && !(item.type === 'track' && tracks[item.index] === track) && item.layers.includes(track.layer) && (item.shape.kind === 'segment' ? pointSegmentDistance(x, y, item.shape.x1, item.shape.y1, item.shape.x2, item.shape.y2) <= item.shape.r + track.width / 2 : shapeDistance({ kind: 'circle', x, y, r: track.width / 2 }, item.shape) <= EPSILON));
      if (!touching) add('dangling', 'warning', `Dangling track end on ${track.net}.`, x, y);
    }
  }
  const errors = violations.filter((violation) => violation.severity === 'error').length;
  return { violations, errors, warnings: violations.length - errors, passed: errors === 0 };
}
