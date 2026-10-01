import { buildIntermediateNetlist, resolveNodeAliases } from './index.mjs';
import { BJT_REVERSE_BETA, BJT_SATURATION_CURRENT, DIODE_EMISSION, MOSFET_DEFAULT_KP, MOSFET_LAMBDA, OPAMP_CLIP_SHARPNESS, OPAMP_OPEN_LOOP_GAIN, OPAMP_POLE_CAPACITANCE, diodeSaturationCurrent } from './device-models.mjs';

const tokenPattern = /^[A-Za-z0-9_.:+-]+$/;
const assertToken = (value, label) => {
  if (!tokenPattern.test(value) || value.includes('..')) throw new TypeError(`${label} contains unsafe SPICE characters.`);
  return value;
};
const prefixes = { resistor: 'R', capacitor: 'C', inductor: 'L', voltage: 'V', current: 'I', diode: 'D', led: 'D', npn: 'Q', pnp: 'Q', nmos: 'M', pmos: 'M', opamp: 'X' };
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
  // Per-part models carry each part's authored value with the same parameters as the built-in solver.
  const models = [];
  let hasOpamp = false;
  for (const element of netlist.elements) {
    const id = assertToken(element.id, `Component ${element.id}`);
    const [left, right, third] = element.nodes.map((node) => assertToken(aliases[node] || node, `Node ${node}`));
    const reference = referenceFor(element.type, id);
    if (element.type === 'ground') continue;
    if (['resistor', 'capacitor', 'inductor'].includes(element.type)) lines.push(`${reference} ${left} ${right} ${formatValue(element.value)}`);
    else if (element.type === 'voltage' || element.type === 'current') lines.push(`${reference} ${left} ${right} ${formatValue(element.value)}`);
    else if (element.type === 'diode' || element.type === 'led') {
      lines.push(`${reference} ${left} ${right} D_${id}`);
      models.push(`.model D_${id} D(Is=${formatValue(diodeSaturationCurrent(element.value, element.type))} N=${DIODE_EMISSION[element.type]})`);
    } else if (element.type === 'npn' || element.type === 'pnp') {
      lines.push(`${reference} ${left} ${right} ${third} Q_${id}`);
      models.push(`.model Q_${id} ${element.type.toUpperCase()}(IS=${formatValue(BJT_SATURATION_CURRENT)} BF=${formatValue(element.value)} BR=${formatValue(BJT_REVERSE_BETA)})`);
    } else if (element.type === 'nmos' || element.type === 'pmos') {
      // Body is tied to the source; W = L so KP is the device transconductance K.
      lines.push(`${reference} ${left} ${right} ${third} ${third} M_${id} W=1u L=1u`);
      models.push(`.model M_${id} ${element.type.toUpperCase()}(LEVEL=1 VTO=${formatValue(element.type === 'pmos' ? -element.value : element.value)} KP=${formatValue(element.kp ?? MOSFET_DEFAULT_KP)} LAMBDA=${formatValue(MOSFET_LAMBDA)})`);
    } else if (element.type === 'opamp') {
      lines.push(`${reference} ${left} ${right} ${third} OPENENTC_OPAMP vsat=${formatValue(element.value)}`);
      hasOpamp = true;
    } else throw new TypeError(`SPICE export does not support component type: ${element.type}.`);
  }
  lines.push(...models);
  if (hasOpamp) lines.push(
    '.subckt OPENENTC_OPAMP inp inn out params: vsat=15',
    `G1 0 int inp inn ${formatValue(OPAMP_OPEN_LOOP_GAIN)}`,
    'R1 int 0 1',
    `C1 int 0 ${formatValue(OPAMP_POLE_CAPACITANCE)}`,
    `B1 out 0 V = v(int) / pow(1 + pow(abs(v(int) / vsat), ${OPAMP_CLIP_SHARPNESS}), ${formatValue(1 / OPAMP_CLIP_SHARPNESS)})`,
    '.ends OPENENTC_OPAMP',
  );
  lines.push('.end');
  return `${lines.join('\n')}\n`;
}
