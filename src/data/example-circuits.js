// Ready-made circuits for the built-in simulator. Each sets the analysis it demonstrates.
const part = (id, type, value, unit, n1, n2, x, y, rotation = 0) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation });
const device = (id, type, value, unit, [n1, n2, n3], x, y) => ({ id, type, label: id, value, unit, n1, n2, n3, x, y, rotation: 0 });
const ground = (x, y = 270) => part('GND', 'ground', 0, 'V', '0', '0', x, y);

export const exampleCircuits = Object.freeze([
  {
    id: 'rc-lowpass', name: 'RC low-pass filter', summary: 'AC sweep · corner at 159 Hz', trace: 'V(out)',
    analysis: { analysis: 'ac', startHz: 1, stopHz: 100_000, pointsPerDecade: 30 },
    components: [part('V1', 'voltage', 5, 'V', 'in', '0', 120, 170), part('R1', 'resistor', 1000, 'Ω', 'in', 'out', 300, 90), part('C1', 'capacitor', 0.000001, 'F', 'out', '0', 480, 170), ground(300)],
  },
  {
    id: 'rlc-bandpass', name: 'Series RLC band-pass', summary: 'AC sweep · resonance at 1.59 kHz', trace: 'V(out)',
    analysis: { analysis: 'ac', startHz: 100, stopHz: 100_000, pointsPerDecade: 60 },
    components: [part('V1', 'voltage', 1, 'V', 'in', '0', 120, 170), part('L1', 'inductor', 0.01, 'H', 'in', 'a', 280, 90), part('C1', 'capacitor', 0.000001, 'F', 'a', 'out', 440, 90), part('R1', 'resistor', 100, 'Ω', 'out', '0', 600, 170), ground(360)],
  },
  {
    id: 'rlc-step', name: 'RLC step response', summary: 'Transient · underdamped ringing', trace: 'V(out)',
    analysis: { analysis: 'transient', stopTime: 0.003, timeStep: 0.000001, shape: 'step', amplitude: null },
    components: [part('V1', 'voltage', 5, 'V', 'in', '0', 120, 170), part('R1', 'resistor', 20, 'Ω', 'in', 'a', 280, 90), part('L1', 'inductor', 0.01, 'H', 'a', 'out', 440, 90), part('C1', 'capacitor', 0.000001, 'F', 'out', '0', 600, 170), ground(360)],
  },
  {
    id: 'half-wave-rectifier', name: 'Half-wave rectifier', summary: 'Transient · 50 Hz sine with filter capacitor', trace: 'V(out)',
    analysis: { analysis: 'transient', stopTime: 0.06, timeStep: 0.00002, shape: 'sine', frequency: 50, amplitude: null },
    components: [part('V1', 'voltage', 10, 'V', 'in', '0', 120, 170), part('D1', 'diode', 0.7, 'Vf', 'in', 'out', 300, 90), part('C1', 'capacitor', 0.0001, 'F', 'out', '0', 460, 170), part('R1', 'resistor', 1000, 'Ω', 'out', '0', 620, 170), ground(360)],
  },
  {
    id: 'ce-amplifier', name: 'BJT common-emitter amplifier', summary: 'AC sweep · 40 dB midband, Miller roll-off at 360 kHz', trace: 'V(c)',
    analysis: { analysis: 'ac', startHz: 1, stopHz: 100_000_000, pointsPerDecade: 20, source: 'VS' },
    components: [part('VCC', 'voltage', 12, 'V', 'vcc', '0', 120, 90), part('VS', 'voltage', 0.01, 'V', 's', '0', 120, 230), part('RS', 'resistor', 1000, 'Ω', 's', 's2', 200, 330), part('CIN', 'capacitor', 0.00001, 'F', 's2', 'b', 250, 230), part('R1', 'resistor', 47000, 'Ω', 'vcc', 'b', 300, 120), part('R2', 'resistor', 10000, 'Ω', 'b', '0', 300, 320), device('Q1', 'npn', 100, 'β', ['c', 'b', 'e'], 460, 220), part('RC', 'resistor', 2200, 'Ω', 'vcc', 'c', 600, 120), part('RE', 'resistor', 470, 'Ω', 'e', '0', 600, 320), part('CE', 'capacitor', 0.0001, 'F', 'e', '0', 740, 320), ground(460, 340)],
  },
  {
    id: 'inverting-opamp', name: 'Inverting op-amp (gain −10)', summary: 'AC sweep · bandwidth = GBW / 11', trace: 'V(out)',
    analysis: { analysis: 'ac', startHz: 10, stopHz: 10_000_000, pointsPerDecade: 20 },
    components: [part('V1', 'voltage', 0.5, 'V', 'in', '0', 120, 170), part('R1', 'resistor', 1000, 'Ω', 'in', 'm', 280, 120), device('U1', 'opamp', 15, 'Vsat', ['0', 'm', 'out'], 460, 190), part('R2', 'resistor', 10000, 'Ω', 'm', 'out', 460, 80), ground(300)],
  },
  {
    id: 'opamp-clipping', name: 'Op-amp clipping', summary: 'Transient · 2 V sine × 10 hits the ±12 V rails', trace: 'V(out)',
    analysis: { analysis: 'transient', stopTime: 0.003, timeStep: 0.000002, shape: 'sine', frequency: 1000, amplitude: null },
    components: [part('V1', 'voltage', 2, 'V', 'in', '0', 120, 170), part('R1', 'resistor', 1000, 'Ω', 'in', 'm', 280, 120), device('U1', 'opamp', 12, 'Vsat', ['0', 'm', 'out'], 460, 190), part('R2', 'resistor', 10000, 'Ω', 'm', 'out', 460, 80), part('RL', 'resistor', 10000, 'Ω', 'out', '0', 620, 190), ground(300)],
  },
  {
    id: 'mosfet-switch', name: 'MOSFET LED switch', summary: 'Transient · 500 Hz gate drive, low-side NMOS', trace: 'I(D1)',
    analysis: { analysis: 'transient', stopTime: 0.004, timeStep: 0.000002, shape: 'pulse', frequency: 500, amplitude: null, source: 'VG' },
    components: [part('VDD', 'voltage', 5, 'V', 'vdd', '0', 120, 110), part('VG', 'voltage', 5, 'V', 'g', '0', 120, 250), part('R1', 'resistor', 150, 'Ω', 'vdd', 'a', 300, 80), part('D1', 'led', 2, 'Vf', 'a', 'd', 460, 80), device('M1', 'nmos', 2, 'Vth', ['d', 'g', '0'], 460, 220), ground(300)],
  },
  {
    id: 'led-driver', name: 'LED with series resistor', summary: 'DC · LED current and drop', trace: 'V(led)',
    analysis: { analysis: 'dc' },
    components: [part('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 170), part('R1', 'resistor', 150, 'Ω', 'vcc', 'led', 300, 90), part('D1', 'led', 2, 'Vf', 'led', '0', 480, 170), ground(300)],
  },
]);
