// Ready-made circuits for the built-in simulator. Each sets the analysis it demonstrates.
const part = (id, type, value, unit, n1, n2, x, y, rotation = 0) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation });
const ground = (x) => part('GND', 'ground', 0, 'V', '0', '0', x, 270);

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
    id: 'led-driver', name: 'LED with series resistor', summary: 'DC · LED current and drop', trace: 'V(led)',
    analysis: { analysis: 'dc' },
    components: [part('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 170), part('R1', 'resistor', 150, 'Ω', 'vcc', 'led', 300, 90), part('D1', 'led', 2, 'Vf', 'led', '0', 480, 170), ground(300)],
  },
]);
