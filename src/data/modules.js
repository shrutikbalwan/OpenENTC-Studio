import { COMPONENT_DEFINITIONS, COMPONENT_DEFINITION_VERSION, validateComponentDefinitions } from '../../packages/schematic/src/components.mjs';

export const modules = [
  { id: 'home', name: 'Mission control', short: 'Home', icon: '⌂', color: '#5eead4', description: 'Projects, engines and guided workflows.' },
  { id: 'circuit', name: 'Circuit Lab', short: 'Circuit', icon: '⌁', color: '#60a5fa', description: 'Draw, inspect and solve electronic circuits.' },
  { id: 'embedded', name: 'Embedded Lab', short: 'Embedded', icon: '▣', color: '#f59e0b', description: 'Write firmware and prepare MCU projects.' },
  { id: 'mcu', name: 'Microcontroller Lab', short: 'MCU', icon: '⌗', color: '#fbbf24', description: '8051 assembler and simulator with a virtual trainer board, serial terminal and debugger.' },
  { id: 'pcb', name: 'PCB Studio', short: 'PCB', icon: '▤', color: '#34d399', description: 'Schematic-to-board design workflow.' },
  { id: 'fpga', name: 'FPGA & Digital', short: 'FPGA', icon: '◇', color: '#a78bfa', description: 'Design, synthesize and verify digital logic.' },
  { id: 'logic', name: 'Digital Logic Lab', short: 'Logic', icon: '⊼', color: '#e879f9', description: 'Boolean algebra, K-maps, gate and flip-flop simulation, number codes.' },
  { id: 'dsp', name: 'Signals & DSP', short: 'DSP', icon: '∿', color: '#fb7185', description: 'Generate, transform and inspect signals.' },
  { id: 'communication', name: 'Communication', short: 'Comms', icon: '⌁', color: '#22d3ee', description: 'Explore modulation and communication chains.' },
  { id: 'rf', name: 'RF & Antennas', short: 'RF', icon: '⌖', color: '#f97316', description: 'RF calculations, matching and antenna studies.' },
  { id: 'calc', name: 'Engineering Calculators', short: 'Calc', icon: '⊞', color: '#38bdf8', description: 'Resistor and component codes, 555 timer, op-amps, decibels and circuit formulas.' },
  { id: 'iot', name: 'IoT & Control', short: 'IoT', icon: '◉', color: '#4ade80', description: 'Connect sensors, controllers and data flows.' },
  { id: 'network', name: 'Networks', short: 'Network', icon: '⌘', color: '#818cf8', description: 'Build and inspect communication networks.' },
  { id: 'learn', name: 'Learning Hub', short: 'Learn', icon: '◫', color: '#facc15', description: 'Experiments, references and progress.' }
];

const legacyComponentPalette = [
  { type: 'voltage', label: 'DC source', symbol: 'V', defaultValue: 5, unit: 'V' },
  { type: 'current', label: 'Current source', symbol: 'I', defaultValue: 0.001, unit: 'A' },
  { type: 'switch', label: 'Switch', symbol: 'S', defaultValue: 1, unit: 'state' },
  { type: 'resistor', label: 'Resistor', symbol: 'R', defaultValue: 1000, unit: 'Ω' },
  { type: 'capacitor', label: 'Capacitor', symbol: 'C', defaultValue: 0.000001, unit: 'F' },
  { type: 'inductor', label: 'Inductor', symbol: 'L', defaultValue: 0.001, unit: 'H' },
  { type: 'diode', label: 'Diode', symbol: 'D', defaultValue: 0.7, unit: 'Vf' },
  { type: 'led', label: 'LED', symbol: '↗', defaultValue: 2, unit: 'Vf' },
  { type: 'ground', label: 'Ground', symbol: '⏚', defaultValue: 0, unit: 'V' }
];

validateComponentDefinitions(COMPONENT_DEFINITIONS);
export { COMPONENT_DEFINITION_VERSION };
export const componentPalette = COMPONENT_DEFINITIONS.map(({ type, label, symbol, defaultValue, unit }) => ({ type, label, symbol, defaultValue, unit }));

export const learningTracks = [
  ['Circuit foundations', 8, 'Beginner'], ['Digital systems', 12, 'Beginner'],
  ['Embedded C and MCUs', 16, 'Intermediate'], ['Signals and systems', 14, 'Intermediate'],
  ['Digital communication', 18, 'Advanced'], ['RF and antenna design', 15, 'Advanced']
];
