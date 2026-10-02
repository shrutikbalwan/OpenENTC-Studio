// Footprint library for the Circuit Lab parts. Dimensions in millimetres, origin at the
// footprint centre, y pointing down (screen convention). Pad numbers follow the usual
// KiCad library conventions; `pinMap` ties schematic node fields (n1, n2, n3) to pads.

const tht = (number, x, y, size = 1.6, drill = 0.8, square = false) => ({ number, x, y, w: size, h: size, shape: square ? 'rect' : 'circle', drill });
const smd = (number, x, y, w, h) => ({ number, x, y, w, h, shape: 'rect', drill: null });
const box = (w, h) => [[-w / 2, -h / 2, w / 2, -h / 2], [w / 2, -h / 2, w / 2, h / 2], [w / 2, h / 2, -w / 2, h / 2], [-w / 2, h / 2, -w / 2, -h / 2]];
const courtyard = (w, h) => ({ x1: -w / 2, y1: -h / 2, x2: w / 2, y2: h / 2 });

function footprint(name, description, pads, size, extra = {}) {
  return Object.freeze({ name, description, pads: Object.freeze(pads.map((pad) => Object.freeze(pad))), courtyard: courtyard(size[0], size[1]), silk: Object.freeze(extra.silk || box(size[0] - 0.5, size[1] - 0.5)), smd: pads.every((pad) => pad.drill === null), ...extra });
}

export const FOOTPRINTS = Object.freeze({
  'R_Axial_P10.16mm': footprint('R_Axial_P10.16mm', 'Axial resistor, 0.4" pitch', [tht('1', -5.08, 0), tht('2', 5.08, 0)], [13, 3.2], { silk: box(6.4, 2.4) }),
  'C_Disc_P2.54mm': footprint('C_Disc_P2.54mm', 'Ceramic disc capacitor, 0.1" pitch', [tht('1', -1.27, 0, 1.6, 0.8, true), tht('2', 1.27, 0)], [5.2, 3.2]),
  'L_Axial_P10.16mm': footprint('L_Axial_P10.16mm', 'Axial inductor, 0.4" pitch', [tht('1', -5.08, 0), tht('2', 5.08, 0)], [13, 4], { silk: box(6.4, 3.2) }),
  'D_DO-41_P10.16mm': footprint('D_DO-41_P10.16mm', 'DO-41 axial diode (pad 1 = cathode)', [tht('1', -5.08, 0, 2, 1, true), tht('2', 5.08, 0, 2, 1)], [13.2, 3.4], { silk: [...box(5.2, 2.7), [-1.8, -1.35, -1.8, 1.35]] }),
  'LED_D5.0mm': footprint('LED_D5.0mm', '5 mm through-hole LED (pad 1 = cathode)', [tht('1', -1.27, 0, 1.8, 0.9, true), tht('2', 1.27, 0, 1.8, 0.9)], [6.2, 6.2], { silk: box(5.6, 5.6) }),
  'SW_P6.5mm': footprint('SW_P6.5mm', 'Two-pin push button, 6.5 mm pitch', [tht('1', -3.25, 0, 2, 1.1), tht('2', 3.25, 0, 2, 1.1)], [8.8, 6.6]),
  'TO-92_Inline': footprint('TO-92_Inline', 'TO-92 inline, 0.1" pitch', [tht('1', -2.54, 0, 1.5, 0.75, true), tht('2', 0, 0, 1.5, 0.75), tht('3', 2.54, 0, 1.5, 0.75)], [7, 4.6]),
  'DIP-8_W7.62mm': footprint('DIP-8_W7.62mm', 'DIP-8, 0.3" row spacing', [
    tht('1', -3.81, -3.81, 1.6, 0.8, true), tht('2', -3.81, -1.27), tht('3', -3.81, 1.27), tht('4', -3.81, 3.81),
    tht('5', 3.81, 3.81), tht('6', 3.81, 1.27), tht('7', 3.81, -1.27), tht('8', 3.81, -3.81),
  ], [10.2, 10.6], { silk: [...box(5.4, 10), [-1, -5, 1, -5]] }),
  'PinHeader_1x02_P2.54mm': footprint('PinHeader_1x02_P2.54mm', 'Two-pin header / power input', [tht('1', -1.27, 0, 1.7, 1, true), tht('2', 1.27, 0, 1.7, 1)], [5.2, 2.8]),
  'R_0805': footprint('R_0805', '0805 SMD resistor', [smd('1', -0.95, 0, 1.0, 1.3), smd('2', 0.95, 0, 1.0, 1.3)], [3.0, 1.8]),
  'C_0805': footprint('C_0805', '0805 SMD capacitor', [smd('1', -0.95, 0, 1.0, 1.3), smd('2', 0.95, 0, 1.0, 1.3)], [3.0, 1.8]),
  'L_1210': footprint('L_1210', '1210 SMD inductor', [smd('1', -1.5, 0, 1.2, 2.6), smd('2', 1.5, 0, 1.2, 2.6)], [4.4, 3.2]),
  'D_SOD-123': footprint('D_SOD-123', 'SOD-123 diode (pad 1 = cathode)', [smd('1', -1.65, 0, 0.9, 1.2), smd('2', 1.65, 0, 0.9, 1.2)], [4.6, 2.0], { silk: [...box(4.4, 1.8), [-1.0, -0.9, -1.0, 0.9]] }),
  'LED_0805': footprint('LED_0805', '0805 SMD LED (pad 1 = cathode)', [smd('1', -0.95, 0, 1.0, 1.3), smd('2', 0.95, 0, 1.0, 1.3)], [3.0, 1.8]),
  'SOT-23': footprint('SOT-23', 'SOT-23 three-terminal', [smd('1', -0.95, 1.1, 0.8, 0.9), smd('2', 0.95, 1.1, 0.8, 0.9), smd('3', 0, -1.1, 0.8, 0.9)], [3.4, 3.6]),
  'SOIC-8': footprint('SOIC-8', 'SOIC-8, 1.27 mm pitch', [
    smd('1', -2.7, -1.905, 1.55, 0.6), smd('2', -2.7, -0.635, 1.55, 0.6), smd('3', -2.7, 0.635, 1.55, 0.6), smd('4', -2.7, 1.905, 1.55, 0.6),
    smd('5', 2.7, 1.905, 1.55, 0.6), smd('6', 2.7, 0.635, 1.55, 0.6), smd('7', 2.7, -0.635, 1.55, 0.6), smd('8', 2.7, -1.905, 1.55, 0.6),
  ], [7.0, 5.4], { silk: [...box(3.6, 4.8), [-1.8, -2.4, -1.2, -2.4]] }),
});

// Pin maps follow common parts: TO-92 2N3904 (E-B-C) / 2N7000 (S-G-D); SOT-23 BJT (B-E-C) /
// MOSFET (G-S-D); single op-amp DIP/SOIC (741/TL071: 2 = IN−, 3 = IN+, 6 = OUT, 4 = V−, 7 = V+).
const ASSIGNMENTS = {
  resistor: { tht: ['R_Axial_P10.16mm', { n1: '1', n2: '2' }], smd: ['R_0805', { n1: '1', n2: '2' }], prefix: 'R' },
  capacitor: { tht: ['C_Disc_P2.54mm', { n1: '1', n2: '2' }], smd: ['C_0805', { n1: '1', n2: '2' }], prefix: 'C' },
  inductor: { tht: ['L_Axial_P10.16mm', { n1: '1', n2: '2' }], smd: ['L_1210', { n1: '1', n2: '2' }], prefix: 'L' },
  diode: { tht: ['D_DO-41_P10.16mm', { n1: '2', n2: '1' }], smd: ['D_SOD-123', { n1: '2', n2: '1' }], prefix: 'D' },
  led: { tht: ['LED_D5.0mm', { n1: '2', n2: '1' }], smd: ['LED_0805', { n1: '2', n2: '1' }], prefix: 'D' },
  switch: { tht: ['SW_P6.5mm', { n1: '1', n2: '2' }], smd: ['SW_P6.5mm', { n1: '1', n2: '2' }], prefix: 'SW' },
  npn: { tht: ['TO-92_Inline', { n1: '3', n2: '2', n3: '1' }], smd: ['SOT-23', { n1: '3', n2: '1', n3: '2' }], prefix: 'Q' },
  pnp: { tht: ['TO-92_Inline', { n1: '3', n2: '2', n3: '1' }], smd: ['SOT-23', { n1: '3', n2: '1', n3: '2' }], prefix: 'Q' },
  nmos: { tht: ['TO-92_Inline', { n1: '3', n2: '2', n3: '1' }], smd: ['SOT-23', { n1: '3', n2: '1', n3: '2' }], prefix: 'Q' },
  pmos: { tht: ['TO-92_Inline', { n1: '3', n2: '2', n3: '1' }], smd: ['SOT-23', { n1: '3', n2: '1', n3: '2' }], prefix: 'Q' },
  opamp: { tht: ['DIP-8_W7.62mm', { n1: '3', n2: '2', n3: '6' }], smd: ['SOIC-8', { n1: '3', n2: '2', n3: '6' }], prefix: 'U', powerPins: { 4: 'V−', 7: 'V+' } },
  voltage: { tht: ['PinHeader_1x02_P2.54mm', { n1: '1', n2: '2' }], smd: ['PinHeader_1x02_P2.54mm', { n1: '1', n2: '2' }], prefix: 'J' },
  current: { tht: ['PinHeader_1x02_P2.54mm', { n1: '1', n2: '2' }], smd: ['PinHeader_1x02_P2.54mm', { n1: '1', n2: '2' }], prefix: 'J' },
};

export const FOOTPRINT_STYLES = Object.freeze(['tht', 'smd']);

/** Footprint and pin map for a schematic component type, or null for symbols with no part (ground). */
export function footprintFor(type, style = 'tht') {
  const entry = ASSIGNMENTS[type];
  if (!entry) return null;
  const [name, pinMap] = entry[style === 'smd' ? 'smd' : 'tht'];
  return { footprint: FOOTPRINTS[name], pinMap, prefix: entry.prefix, powerPins: entry.powerPins || null };
}

/** Rotate a footprint-local point by 0/90/180/270° (clockwise on screen, y down). */
export function rotatePoint(x, y, rotation) {
  switch (((rotation % 360) + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
