import { normalizeNode } from '../../packages/schematic/src/index.mjs';

const MAX_ROUTE_COORDINATE = 1_000_000;
const MAX_ROUTE_POINTS = 64;

function normalizeRoute(route) {
  if (route === undefined || route === null) return undefined;
  if (!route || typeof route !== 'object') throw new TypeError('Wire route must contain a bounded axis coordinate or point list.');
  if (Array.isArray(route.points)) {
    if (Object.keys(route).length !== 1 || route.points.length < 1 || route.points.length > MAX_ROUTE_POINTS || route.points.some((point) => !point || typeof point !== 'object' || Object.keys(point).length !== 2 || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > MAX_ROUTE_COORDINATE || Math.abs(point.y) > MAX_ROUTE_COORDINATE)) throw new TypeError('Wire route points must be finite and bounded.');
    return { points: route.points.map((point) => ({ x: point.x, y: point.y })) };
  }
  if (Object.keys(route).length !== 2 || !['x', 'y'].includes(route.axis) || !Number.isFinite(route.coordinate) || Math.abs(route.coordinate) > MAX_ROUTE_COORDINATE) throw new TypeError('Wire route must contain a bounded axis coordinate or point list.');
  return { axis: route.axis, coordinate: route.coordinate };
}

function canonicalWire(from, to, route) {
  const left = normalizeNode(from);
  const right = normalizeNode(to);
  if (left === right) return null;
  let normalizedRoute = normalizeRoute(route);
  const reversed = left.localeCompare(right) > 0;
  const wire = reversed ? { from: right, to: left } : { from: left, to: right };
  if (reversed && normalizedRoute?.points) normalizedRoute = { points: [...normalizedRoute.points].reverse() };
  return normalizedRoute ? { ...wire, route: normalizedRoute } : wire;
}

export function normalizeWires(wires) {
  if (!Array.isArray(wires)) throw new TypeError('Wires must be an array.');
  const unique = new Map();
  for (const [index, wire] of wires.entries()) {
    if (!wire || typeof wire !== 'object' || typeof wire.from !== 'string' || typeof wire.to !== 'string') throw new TypeError(`Wire ${index} must connect two node names.`);
    const normalized = canonicalWire(wire.from, wire.to, wire.route);
    if (normalized) {
      const key = `${normalized.from}\u0000${normalized.to}`;
      const current = unique.get(key);
      const routeKey = (entry) => entry?.route ? JSON.stringify(entry.route) : 'z';
      if (!current || routeKey(normalized) < routeKey(current)) unique.set(key, normalized);
    }
  }
  return [...unique.values()].sort((a, b) => `${a.from}\u0000${a.to}`.localeCompare(`${b.from}\u0000${b.to}`));
}

export function connectNodes(wires, from, to) {
  const normalized = normalizeWires(wires);
  const added = canonicalWire(from, to);
  return added ? normalizeWires([...normalized, added]) : normalized;
}

export function setWireRoute(wires, from, to, route) {
  const target = canonicalWire(from, to);
  if (!target) throw new TypeError('Wire route endpoints must be different.');
  const routedTarget = route === undefined || route === null ? target : canonicalWire(from, to, route);
  let found = false;
  const updated = normalizeWires(wires).map((wire) => {
    if (wire.from !== target.from || wire.to !== target.to) return wire;
    found = true;
    const normalizedRoute = routedTarget.route;
    return normalizedRoute ? { ...wire, route: normalizedRoute } : { from: wire.from, to: wire.to };
  });
  if (!found) throw new Error('Wire was not found.');
  return normalizeWires(updated);
}

export function disconnectNodes(wires, from, to) {
  const normalized = normalizeWires(wires);
  const removed = canonicalWire(from, to);
  if (!removed) return normalized;
  return normalized.filter((wire) => wire.from !== removed.from || wire.to !== removed.to);
}

export function pruneWires(wires, retainedNodes) {
  if (!retainedNodes || typeof retainedNodes[Symbol.iterator] !== 'function') throw new TypeError('Retained nodes must be iterable.');
  const retained = new Set([...retainedNodes].map((node) => normalizeNode(node)));
  return normalizeWires(wires).filter((wire) => retained.has(wire.from) && retained.has(wire.to));
}
