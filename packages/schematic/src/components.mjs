export const COMPONENT_DEFINITION_VERSION = 1;

const definitions = [
  { type: 'voltage', label: 'DC source', symbol: 'V', defaultValue: 5, unit: 'V', pins: ['positive', 'negative'], simulation: { dc: 'ideal-voltage-source' } },
  { type: 'current', label: 'Current source', symbol: 'I', defaultValue: 0.001, unit: 'A', pins: ['positive', 'negative'], simulation: { dc: 'ideal-current-source' } },
  { type: 'resistor', label: 'Resistor', symbol: 'R', defaultValue: 1000, unit: 'Ω', pins: ['1', '2'], simulation: { dc: 'resistor' } },
  { type: 'capacitor', label: 'Capacitor', symbol: 'C', defaultValue: 0.000001, unit: 'F', pins: ['1', '2'], simulation: { transient: 'capacitor' } },
  { type: 'inductor', label: 'Inductor', symbol: 'L', defaultValue: 0.001, unit: 'H', pins: ['1', '2'], simulation: { transient: 'inductor' } },
  { type: 'diode', label: 'Diode', symbol: 'D', defaultValue: 0.7, unit: 'Vf', pins: ['anode', 'cathode'], simulation: { dc: 'diode-model' } },
  { type: 'led', label: 'LED', symbol: '↗', defaultValue: 2, unit: 'Vf', pins: ['anode', 'cathode'], simulation: { dc: 'diode-model' } },
  { type: 'switch', label: 'Switch', symbol: 'S', defaultValue: 1, unit: 'state', pins: ['1', '2'], simulation: { dc: 'ideal-switch' } },
  { type: 'npn', label: 'NPN transistor', symbol: 'Q', defaultValue: 100, unit: 'β', pins: ['collector', 'base', 'emitter'], simulation: { dc: 'ebers-moll-bjt', transient: 'ebers-moll-bjt', ac: 'small-signal-bjt' } },
  { type: 'pnp', label: 'PNP transistor', symbol: 'Q', defaultValue: 100, unit: 'β', pins: ['collector', 'base', 'emitter'], simulation: { dc: 'ebers-moll-bjt', transient: 'ebers-moll-bjt', ac: 'small-signal-bjt' } },
  { type: 'nmos', label: 'N-channel MOSFET', symbol: 'M', defaultValue: 2, unit: 'Vth', pins: ['drain', 'gate', 'source'], simulation: { dc: 'level1-mosfet', transient: 'level1-mosfet', ac: 'small-signal-mosfet' } },
  { type: 'pmos', label: 'P-channel MOSFET', symbol: 'M', defaultValue: 2, unit: 'Vth', pins: ['drain', 'gate', 'source'], simulation: { dc: 'level1-mosfet', transient: 'level1-mosfet', ac: 'small-signal-mosfet' } },
  { type: 'opamp', label: 'Op-amp', symbol: '▷', defaultValue: 15, unit: 'Vsat', pins: ['non-inverting', 'inverting', 'output'], simulation: { dc: 'single-pole-opamp', transient: 'single-pole-opamp', ac: 'single-pole-opamp' } },
  { type: 'ground', label: 'Ground', symbol: '⏚', defaultValue: 0, unit: 'V', pins: ['ground'], simulation: { dc: 'reference-node' } }
];

function validDefinition(definition) {
  return definition && typeof definition === 'object' && typeof definition.type === 'string' && definition.type.length <= 50
    && typeof definition.label === 'string' && typeof definition.symbol === 'string'
    && Number.isFinite(definition.defaultValue) && typeof definition.unit === 'string'
    && Array.isArray(definition.pins) && definition.pins.length > 0 && definition.pins.length <= 8
    && definition.pins.every((pin) => typeof pin === 'string' && pin.length > 0 && pin.length <= 50)
    && definition.simulation && typeof definition.simulation === 'object' && !Array.isArray(definition.simulation);
}

export const COMPONENT_DEFINITIONS = Object.freeze(definitions.map((definition) => Object.freeze({ ...definition, pins: Object.freeze([...definition.pins]), simulation: Object.freeze({ ...definition.simulation }) })));

export function validateComponentDefinitions(input = COMPONENT_DEFINITIONS) {
  if (!Array.isArray(input) || input.length > 1000 || input.some((definition) => !validDefinition(definition))) throw new TypeError('Component definitions are invalid.');
  const types = input.map((definition) => definition.type);
  if (new Set(types).size !== types.length) throw new TypeError('Component definition types must be unique.');
  return input;
}

/** Project fields that hold node names, in pin order. */
export const PIN_FIELDS = Object.freeze(['n1', 'n2', 'n3']);

/** Node fields a component uses: three-pin parts (transistors, op-amps) add `n3`. */
export function nodeFields(component) {
  return getComponentDefinition(component?.type)?.pins.length === 3 ? PIN_FIELDS : PIN_FIELDS.slice(0, 2);
}

/** Human-readable pin name for a node field, e.g. `collector` for an NPN `n1`. */
export function pinName(component, field) {
  const pins = getComponentDefinition(component?.type)?.pins;
  const index = PIN_FIELDS.indexOf(field);
  return pins?.length === 3 || pins?.length === 2 ? pins[index] ?? field : field;
}

export function getComponentDefinition(type) {
  return COMPONENT_DEFINITIONS.find((definition) => definition.type === type);
}
