import { normalizeNode } from './index.mjs';

export function defaultWireRoute(from, to) {
  if (!from || !to || !Number.isFinite(from.x) || !Number.isFinite(from.y) || !Number.isFinite(to.x) || !Number.isFinite(to.y)) throw new TypeError('Wire points must contain finite coordinates.');
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? { axis: 'x', coordinate: (from.x + to.x) / 2 }
    : { axis: 'y', coordinate: (from.y + to.y) / 2 };
}

function validRoute(route) {
  if (!route || typeof route !== 'object') return false;
  if (Array.isArray(route.points)) return Object.keys(route).length === 1 && route.points.length >= 1 && route.points.length <= 64 && route.points.every((point) => point && Object.keys(point).length === 2 && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000);
  return Object.keys(route).length === 2 && ['x', 'y'].includes(route.axis) && Number.isFinite(route.coordinate) && Math.abs(route.coordinate) <= 1_000_000;
}

function assertPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 1_000_000 || Math.abs(point.y) > 1_000_000) throw new TypeError('Wire points must contain finite bounded coordinates.');
}

function simplify(points) {
  const distinct = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y).map((point) => ({ x: point.x, y: point.y }));
  return distinct.filter((point, index) => {
    if (index === 0 || index === distinct.length - 1) return true;
    const before = distinct[index - 1]; const after = distinct[index + 1];
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

function appendOrthogonal(points, target) {
  const from = points.at(-1);
  if (from.x !== target.x && from.y !== target.y) {
    points.push(Math.abs(target.x - from.x) >= Math.abs(target.y - from.y)
      ? { x: target.x, y: from.y }
      : { x: from.x, y: target.y });
  }
  points.push({ x: target.x, y: target.y });
}

export function orthogonalPoints(from, to, route = undefined) {
  assertPoint(from); assertPoint(to);
  const selected = route ?? defaultWireRoute(from, to);
  if (!validRoute(selected)) throw new TypeError('Wire route must contain a bounded axis coordinate or point list.');
  if (selected.points) {
    const points = [{ x: from.x, y: from.y }];
    for (const target of [...selected.points, to]) appendOrthogonal(points, target);
    return simplify(points);
  }
  const points = selected.axis === 'x'
    ? [from, { x: selected.coordinate, y: from.y }, { x: selected.coordinate, y: to.y }, to]
    : [from, { x: from.x, y: selected.coordinate }, { x: to.x, y: selected.coordinate }, to];
  return simplify(points);
}

export function orthogonalPath(from, to, route = undefined) {
  const points = orthogonalPoints(from, to, route);
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
}

export function wireRouteHandle(from, to, route = undefined) {
  return wireRouteHandles(from, to, route)[0];
}

export function wireRouteHandles(from, to, route = undefined) {
  assertPoint(from); assertPoint(to);
  const selected = route ?? defaultWireRoute(from, to);
  if (!validRoute(selected)) throw new TypeError('Wire route must contain a bounded axis coordinate or point list.');
  if (selected.points) return selected.points.map((point, index) => ({ x: point.x, y: point.y, axis: 'point', index }));
  return [selected.axis === 'x'
    ? { x: selected.coordinate, y: (from.y + to.y) / 2, axis: 'x', coordinate: selected.coordinate }
    : { x: (from.x + to.x) / 2, y: selected.coordinate, axis: 'y', coordinate: selected.coordinate }];
}

export function wireRouteInsertionPoint(from, to, route = undefined) {
  const points = orthogonalPoints(from, to, route);
  if (points.length < 2) return { ...points[0] };
  let longest = { length: -1, from: points[0], to: points[1] };
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]; const b = points[index];
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (length > longest.length) longest = { length, from: a, to: b };
  }
  return { x: (longest.from.x + longest.to.x) / 2, y: (longest.from.y + longest.to.y) / 2 };
}

export function buildWireSegments(components = [], wires = []) {
  const points = new Map();
  for (const component of components) {
    if (!component || typeof component !== 'object') continue;
    for (const field of ['n1', 'n2']) {
      const node = normalizeNode(component[field]);
      if (node === '0' || !Number.isFinite(component.x) || !Number.isFinite(component.y)) continue;
      if (!points.has(node)) points.set(node, { x: component.x + 45, y: component.y + 25 });
    }
  }
  return wires.flatMap((wire) => {
    if (!wire || typeof wire.from !== 'string' || typeof wire.to !== 'string') return [];
    const fromNode = normalizeNode(wire.from);
    const toNode = normalizeNode(wire.to);
    const from = points.get(fromNode);
    const to = points.get(toNode);
    if (!from || !to || fromNode === toNode) return [];
    const segment = { fromNode, toNode, from: { ...from }, to: { ...to } };
    if (wire.route) segment.route = structuredClone(wire.route);
    return [segment];
  });
}
