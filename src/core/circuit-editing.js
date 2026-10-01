import { componentReferencePrefixes as prefixes } from '../../packages/schematic/src/annotation.mjs';
import { nodeFields } from '../../packages/schematic/src/components.mjs';
const clone = (value) => structuredClone(value);

function remapNodes(sources, existingComponents) {
  const used = new Set(existingComponents.flatMap((component) => nodeFields(component).map((field) => component[field])).filter((node) => typeof node === 'string'));
  const mapping = new Map();
  let index = 1;
  for (const source of sources) {
    for (const node of nodeFields(source).map((field) => source[field])) {
      if (typeof node !== 'string' || !node.trim() || node.trim() === '0' || node.trim() === 'GND' || mapping.has(node)) continue;
      let next = `paste_n${index}`;
      while (used.has(next)) next = `paste_n${++index}`;
      mapping.set(node, next);
      used.add(next);
      index += 1;
    }
  }
  return mapping;
}

function copyWithFreshNodes(source, nodeMap) {
  const copy = clone(source);
  for (const field of nodeFields(copy)) if (nodeMap.has(copy[field])) copy[field] = nodeMap.get(copy[field]);
  return copy;
}

export function rotateComponent(components, id, degrees = 90) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  if (!Number.isFinite(degrees)) throw new TypeError('Rotation degrees must be finite.');
  return components.map((component) => component.id === id
    ? { ...component, rotation: ((Number(component.rotation) || 0) + degrees) % 360 }
    : { ...component });
}

export function rotateComponents(components, ids, degrees = 90) {
  if (!Array.isArray(components) || !Array.isArray(ids)) throw new TypeError('Components and ids must be arrays.');
  if (!Number.isFinite(degrees)) throw new TypeError('Rotation degrees must be finite.');
  const selected = new Set(ids);
  return components.map((component) => selected.has(component.id)
    ? { ...component, rotation: ((Number(component.rotation) || 0) + degrees) % 360 }
    : { ...component });
}

export function moveComponents(components, ids, delta = { x: 0, y: 0 }) {
  if (!Array.isArray(components) || !Array.isArray(ids) || !delta || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw new TypeError('Components, ids, and finite movement deltas are required.');
  const selected = new Set(ids);
  return components.map((component) => selected.has(component.id)
    ? { ...component, x: Number(component.x) + delta.x, y: Number(component.y) + delta.y }
    : { ...component });
}

export function duplicateComponent(components, id, offset = { x: 28, y: 28 }) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  const source = components.find((component) => component.id === id);
  if (!source) return { components: components.map(clone), id: null };
  const prefix = prefixes[source.type] || 'U';
  const used = new Set(components.map((component) => component.id));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  const nextId = `${prefix}${index}`;
  return pasteComponent(components, source, offset, nextId);
}

export function pasteComponent(components, source, offset = { x: 28, y: 28 }, forcedId = null) {
  if (!Array.isArray(components) || !source) throw new TypeError('Components and source are required.');
  const prefix = prefixes[source.type] || 'U';
  const used = new Set(components.map((component) => component.id));
  let index = 1;
  while (used.has(forcedId || `${prefix}${index}`)) index += 1;
  const nextId = forcedId || `${prefix}${index}`;
  const copy = { ...copyWithFreshNodes(source, remapNodes([source], components)), id: nextId, label: source.type === 'ground' ? 'GND' : nextId, x: source.x + offset.x, y: source.y + offset.y };
  return { components: [...components.map(clone), copy], id: nextId };
}

export function pasteComponents(components, sources, offset = { x: 28, y: 28 }) {
  if (!Array.isArray(components) || !Array.isArray(sources) || sources.some((source) => !source)) throw new TypeError('Components and sources must be arrays.');
  let result = components.map(clone);
  const nodeMap = remapNodes(sources, result);
  const ids = [];
  for (const source of sources) {
    const prefix = prefixes[source.type] || 'U';
    const used = new Set(result.map((component) => component.id));
    let index = 1;
    while (used.has(`${prefix}${index}`)) index += 1;
    const id = `${prefix}${index}`;
    const copy = { ...copyWithFreshNodes(source, nodeMap), id, label: source.type === 'ground' ? 'GND' : id, x: source.x + offset.x, y: source.y + offset.y };
    result.push(copy);
    ids.push(id);
  }
  return { components: result, ids, nodeMap: Object.fromEntries(nodeMap) };
}
