// Edge-to-edge distances between copper shapes: axis-aligned rectangles, circles and
// capsules (track segments with a half-width). Units are millimetres.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / length, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

export function segmentsIntersect(a, b) {
  const d1 = cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1), d2 = cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1), d4 = cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function segmentSegmentDistance(a, b) {
  if (segmentsIntersect(a, b)) return 0;
  return Math.min(
    pointSegmentDistance(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2), pointSegmentDistance(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2),
    pointSegmentDistance(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2), pointSegmentDistance(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2),
  );
}

export function pointRectDistance(px, py, rect) {
  const dx = Math.max(Math.abs(px - rect.x) - rect.w / 2, 0), dy = Math.max(Math.abs(py - rect.y) - rect.h / 2, 0);
  return Math.hypot(dx, dy);
}

function rectEdges(rect) {
  const x1 = rect.x - rect.w / 2, x2 = rect.x + rect.w / 2, y1 = rect.y - rect.h / 2, y2 = rect.y + rect.h / 2;
  return [{ x1, y1, x2, y2: y1 }, { x1: x2, y1, x2, y2 }, { x1: x2, y1: y2, x2: x1, y2 }, { x1, y1: y2, x2: x1, y2: y1 }];
}

export function segmentRectDistance(segment, rect) {
  if (pointRectDistance(segment.x1, segment.y1, rect) === 0 || pointRectDistance(segment.x2, segment.y2, rect) === 0) return 0;
  return Math.min(...rectEdges(rect).map((edge) => segmentSegmentDistance(segment, edge)));
}

export function rectRectDistance(a, b) {
  const dx = Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, 0), dy = Math.max(Math.abs(a.y - b.y) - (a.h + b.h) / 2, 0);
  return Math.hypot(dx, dy);
}

/**
 * Shapes: { kind: 'rect', x, y, w, h } | { kind: 'circle', x, y, r } | { kind: 'segment', x1, y1, x2, y2, r }.
 * Returns the gap between copper edges (0 when they touch or overlap).
 */
export function shapeDistance(a, b) {
  if (a.kind === 'rect' && b.kind !== 'rect') return shapeDistance(b, a);
  if (a.kind === 'segment' && b.kind === 'circle') return shapeDistance(b, a);
  let gap;
  if (a.kind === 'circle' && b.kind === 'circle') gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
  else if (a.kind === 'circle' && b.kind === 'rect') gap = pointRectDistance(a.x, a.y, b) - a.r;
  else if (a.kind === 'circle' && b.kind === 'segment') gap = pointSegmentDistance(a.x, a.y, b.x1, b.y1, b.x2, b.y2) - a.r - b.r;
  else if (a.kind === 'segment' && b.kind === 'segment') gap = segmentSegmentDistance(a, b) - a.r - b.r;
  else if (a.kind === 'segment' && b.kind === 'rect') gap = segmentRectDistance(a, b) - a.r;
  else gap = rectRectDistance(a, b);
  return Math.max(0, gap);
}

/** Distance from a point to the copper edge of a shape (0 inside). */
export const pointShapeDistance = (x, y, shape) => shapeDistance({ kind: 'circle', x, y, r: 0 }, shape);

export function shapeBounds(shape) {
  if (shape.kind === 'rect') return { x1: shape.x - shape.w / 2, y1: shape.y - shape.h / 2, x2: shape.x + shape.w / 2, y2: shape.y + shape.h / 2 };
  if (shape.kind === 'circle') return { x1: shape.x - shape.r, y1: shape.y - shape.r, x2: shape.x + shape.r, y2: shape.y + shape.r };
  return { x1: Math.min(shape.x1, shape.x2) - shape.r, y1: Math.min(shape.y1, shape.y2) - shape.r, x2: Math.max(shape.x1, shape.x2) + shape.r, y2: Math.max(shape.y1, shape.y2) + shape.r };
}
