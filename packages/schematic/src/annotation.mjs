const PREFIXES = Object.freeze({ voltage: 'V', current: 'I', resistor: 'R', capacitor: 'C', inductor: 'L', diode: 'D', led: 'LED', switch: 'S', ground: 'G', npn: 'Q', pnp: 'Q', nmos: 'M', pmos: 'M', opamp: 'U' });

export function annotateReferences(components = []) {
  if (!Array.isArray(components)) throw new TypeError('Components must be an array.');
  const counters = new Map();
  const renames = new Map();
  const annotated = components.map((component, index) => {
    if (!component || typeof component !== 'object' || typeof component.type !== 'string') throw new TypeError(`Component ${index} is invalid.`);
    const prefix = PREFIXES[component.type] || 'X';
    const number = (counters.get(prefix) || 0) + 1;
    counters.set(prefix, number);
    const id = `${prefix}${number}`;
    if (typeof component.id === 'string' && component.id !== id) renames.set(component.id, id);
    return { ...structuredClone(component), id, label: component.label === component.id ? id : component.label };
  });
  return { components: annotated, renames };
}

export const componentReferencePrefixes = PREFIXES;
