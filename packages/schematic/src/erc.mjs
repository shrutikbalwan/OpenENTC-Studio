import { createDiagnostic } from '../../diagnostics/src/index.mjs';
import { normalizeNode, resolveNodeAliases } from './index.mjs';
import { getComponentDefinition } from './components.mjs';

export const ERC_CODES = Object.freeze({
  MISSING_GROUND: 'ERC_MISSING_GROUND',
  FLOATING_NODE: 'ERC_FLOATING_NODE',
  DUPLICATE_REFERENCE: 'ERC_DUPLICATE_REFERENCE',
  INVALID_VALUE: 'ERC_INVALID_VALUE',
  CONFLICTING_SOURCE: 'ERC_CONFLICTING_SOURCE',
  UNCONNECTED_PIN: 'ERC_UNCONNECTED_PIN'
});

export function checkElectricalRules(components = [], wires = [], netLabels = []) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  const diagnostics = [];
  // ERC must still report invalid values, so topology normalization uses a safe
  // placeholder value rather than failing before diagnostics can be emitted.
  const topologyComponents = components.map((component, index) => ({
    ...component,
    id: typeof component?.id === 'string' && component.id.trim() ? component.id : `invalid-${index}`,
    type: typeof component?.type === 'string' && component.type.trim() ? component.type : 'unknown',
    label: typeof component?.label === 'string' && component.label.trim() ? component.label : `invalid-${index}`,
    unit: typeof component?.unit === 'string' ? component.unit : '',
    n1: typeof component?.n1 === 'string' && component.n1.trim() ? component.n1 : `__unconnected_${index}_1`,
    n2: typeof component?.n2 === 'string' && component.n2.trim() ? component.n2 : `__unconnected_${index}_2`,
    value: Number.isFinite(component?.value) ? component.value : 0
  }));
  const aliases = resolveNodeAliases(topologyComponents, wires, netLabels);
  const resolve = (raw) => {
    const normalized = typeof raw === 'string' && raw.trim() ? normalizeNode(raw) : '__unconnected__';
    return aliases[normalized] || normalized;
  };
  const references = new Map();
  const nodeUse = new Map();
  const sources = new Map();
  for (const component of components) {
    if (!component || typeof component !== 'object') continue;
    const id = String(component.id ?? 'unknown');
    if (references.has(id)) diagnostics.push(createDiagnostic({ code: ERC_CODES.DUPLICATE_REFERENCE, message: `Reference ${id} is used more than once.`, source: id }));
    references.set(id, component);
    const definition = getComponentDefinition(component.type);
    if (definition) {
      const pins = definition.pins.length === 1 ? ['n1'] : ['n1', 'n2'];
      for (const pin of pins) {
        if (typeof component[pin] !== 'string' || !component[pin].trim()) {
          diagnostics.push(createDiagnostic({
            code: ERC_CODES.UNCONNECTED_PIN,
            message: `${id} has an unconnected required pin (${pin}).`,
            source: `${id}:${pin}`,
            fix: `Connect ${pin} to a named node or ground.`
          }));
        }
      }
    }
    for (const raw of [component.n1, component.n2]) { if (typeof raw === 'string' && raw.trim()) { const node = resolve(raw); nodeUse.set(node, (nodeUse.get(node) ?? 0) + 1); } }
    if (component.type !== 'ground' && (typeof component.value !== 'number' || !Number.isFinite(component.value))) diagnostics.push(createDiagnostic({ code: ERC_CODES.INVALID_VALUE, message: `${id} has an invalid numeric value.`, source: id, fix: 'Enter a finite engineering value.' }));
    if (component.type === 'voltage') { const key = [resolve(component.n1), resolve(component.n2)].sort().join('::'); if (sources.has(key)) diagnostics.push(createDiagnostic({ code: ERC_CODES.CONFLICTING_SOURCE, message: `Ideal voltage sources ${sources.get(key)} and ${id} share the same terminals.`, source: id })); else sources.set(key, id); }
  }
  if (!nodeUse.has('0')) diagnostics.push(createDiagnostic({ code: ERC_CODES.MISSING_GROUND, message: 'No ground node is connected.', fix: 'Add a ground symbol or connect a terminal to node 0.' }));
  for (const [node, count] of nodeUse) if (node !== '0' && count === 1) diagnostics.push(createDiagnostic({ code: ERC_CODES.FLOATING_NODE, message: `Node ${node} has only one connection.`, source: node, fix: 'Connect the node to another component.' }));
  return diagnostics;
}

export function locateElectricalRuleDiagnostic(components = [], wires = [], netLabels = [], diagnostic) {
  if (!Array.isArray(components) || !Array.isArray(wires) || !Array.isArray(netLabels)) throw new TypeError('Schematic records must be arrays.');
  if (!diagnostic || typeof diagnostic !== 'object') throw new TypeError('Diagnostic is required.');
  const source = typeof diagnostic.source === 'string' ? diagnostic.source : '';
  if (!source) return Object.freeze([]);

  const directPin = source.match(/^(.*):(n1|n2)$/);
  if (directPin) {
    const component = components.find((entry) => entry?.id === directPin[1]);
    if (component) return Object.freeze([Object.freeze({ componentId: component.id, pin: directPin[2] })]);
  }

  const componentTargets = components
    .filter((component) => component?.id === source)
    .map((component) => Object.freeze({ componentId: component.id, pin: null }));
  if (componentTargets.length) return Object.freeze(componentTargets);

  const aliases = resolveNodeAliases(components, wires, netLabels);
  const resolve = (raw) => {
    const normalized = normalizeNode(raw);
    return aliases[normalized] || normalized;
  };
  const targetNode = resolve(source);
  const targets = [];
  for (const component of components) {
    if (!component || typeof component.id !== 'string') continue;
    for (const pin of ['n1', 'n2']) {
      if (typeof component[pin] === 'string' && component[pin].trim() && resolve(component[pin]) === targetNode) {
        targets.push(Object.freeze({ componentId: component.id, pin }));
      }
    }
  }
  return Object.freeze(targets);
}
