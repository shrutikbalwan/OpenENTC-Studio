const TEXT_FIELDS = ['id', 'type', 'label', 'n1', 'n2'];

function assertComponent(component, index) {
  if (!component || typeof component !== 'object') throw new TypeError(`Component ${index} must be an object.`);
  for (const field of TEXT_FIELDS) if (typeof component[field] !== 'string' || !component[field].trim()) throw new TypeError(`Component ${index} has an invalid ${field}.`);
  if (typeof component.value !== 'number' || !Number.isFinite(component.value)) throw new TypeError(`Component ${component.id} has an invalid value.`);
}

export function normalizeNode(node) {
  if (typeof node !== 'string' || !node.trim()) throw new TypeError('Node name must be non-empty text.');
  return node.trim() === 'GND' ? '0' : node.trim();
}

export function buildConnectivity(components = [], wires = [], netLabels = []) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  if (!Array.isArray(wires)) throw new TypeError('Wires must be an array.');
  if (!Array.isArray(netLabels)) throw new TypeError('Net labels must be an array.');
  const nodes = new Set(['0']);
  for (const [index, component] of components.entries()) { assertComponent(component, index); nodes.add(normalizeNode(component.n1)); nodes.add(normalizeNode(component.n2)); }
  const parent = new Map([...nodes].map((node) => [node, node]));
  const find = (node) => { if (!parent.has(node)) parent.set(node, node); const root = parent.get(node); if (root !== node) parent.set(node, find(root)); return parent.get(node); };
  for (const [index, wire] of wires.entries()) {
    if (!wire || typeof wire !== 'object' || typeof wire.from !== 'string' || typeof wire.to !== 'string') throw new TypeError(`Wire ${index} must connect two node names.`);
    const from = normalizeNode(wire.from); const to = normalizeNode(wire.to); nodes.add(from); nodes.add(to); const left = find(from); const right = find(to); if (left !== right) parent.set(right, left);
  }
  for (const [index, label] of netLabels.entries()) {
    if (!label || typeof label !== 'object' || typeof label.node !== 'string' || typeof label.text !== 'string' || !label.text.trim()) throw new TypeError(`Net label ${index} must contain text and a node.`);
    const node = normalizeNode(label.node); const text = normalizeNode(label.text); nodes.add(node); nodes.add(text);
    const left = find(node); const right = find(text); if (left !== right) parent.set(right, left);
  }
  const groups = new Map();
  for (const node of [...nodes].sort((a, b) => a.localeCompare(b))) { const root = find(node); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(node); }
  return [...groups.values()].map((group) => group.sort()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function resolveNodeAliases(components = [], wires = [], netLabels = []) {
  const preferred = new Set(netLabels.filter((label) => label && typeof label.text === 'string').map((label) => normalizeNode(label.text)));
  return Object.fromEntries(buildConnectivity(components, wires, netLabels).flatMap((group) => {
    const canonical = group.find((node) => preferred.has(node)) || group[0];
    return group.map((node) => [node, canonical]);
  }));
}

export function buildIntermediateNetlist(components = [], wires = [], netLabels = []) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  const elements = components.map((component, index) => { assertComponent(component, index); return { id: component.id, type: component.type, label: component.label, value: component.value, unit: component.unit, nodes: [normalizeNode(component.n1), normalizeNode(component.n2)] }; });
  const duplicateIds = elements.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) throw new TypeError(`Duplicate component reference: ${[...new Set(duplicateIds)].sort()[0]}.`);
  return Object.freeze({ nodes: buildConnectivity(components, wires, netLabels), elements: elements.sort((a, b) => a.id.localeCompare(b.id)).map((element) => Object.freeze(element)) });
}
