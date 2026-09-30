import { buildIntermediateNetlist, resolveNodeAliases } from './index.mjs';

const tokenPattern = /^[A-Za-z0-9_.:+-]+$/;
const assertToken = (value, label) => {
  if (!tokenPattern.test(value) || value.includes('..')) throw new TypeError(`${label} contains unsafe SPICE characters.`);
  return value;
};
const prefixes = { resistor: 'R', capacitor: 'C', inductor: 'L', voltage: 'V', current: 'I', diode: 'D', led: 'D' };
const referenceFor = (type, id) => id.toUpperCase().startsWith(prefixes[type]) ? id : `${prefixes[type]}${id}`;

function formatValue(value) {
  if (!Number.isFinite(value)) throw new TypeError('SPICE values must be finite numbers.');
  if (Object.is(value, -0)) return '0';
  return Number(value).toPrecision(12).replace(/\.0+(?=e|$)/i, '').replace(/(\.\d*?[1-9])0+(?=e|$)/i, '$1');
}

export function buildSpiceNetlist(components = [], wires = [], { title = 'OpenENTC Studio circuit', netLabels = [] } = {}) {
  const netlist = buildIntermediateNetlist(components, wires, netLabels);
  const aliases = resolveNodeAliases(components, wires, netLabels);
  const lines = [`* ${String(title).replace(/[\r\n]/g, ' ').slice(0, 200)}`];
  let hasDiode = false;
  for (const element of netlist.elements) {
    const id = assertToken(element.id, `Component ${element.id}`);
    const [left, right] = element.nodes.map((node) => assertToken(aliases[node] || node, `Node ${node}`));
    if (element.type === 'ground') continue;
    if (['resistor', 'capacitor', 'inductor'].includes(element.type)) lines.push(`${referenceFor(element.type, id)} ${left} ${right} ${formatValue(element.value)}`);
    else if (element.type === 'voltage' || element.type === 'current') lines.push(`${referenceFor(element.type, id)} ${left} ${right} ${formatValue(element.value)}`);
    else if (element.type === 'diode' || element.type === 'led') { lines.push(`${referenceFor(element.type, id)} ${left} ${right} D_OPENENTC`); hasDiode = true; }
    else throw new TypeError(`SPICE export does not support component type: ${element.type}.`);
  }
  if (hasDiode) lines.push('.model D_OPENENTC D(Is=1e-14 N=1)');
  lines.push('.end');
  return `${lines.join('\n')}\n`;
}
