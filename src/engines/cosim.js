// Microcontroller + circuit co-simulation: an Arduino Uno (ATmega328P) runs in lock-step with the
// built-in transient solver. Each connected pin is a Thévenin source in the circuit (an output is
// 5 V or 0 V behind its ~25 Ω driver, an input with pull-up is 5 V behind 35 kΩ, a plain input
// is high impedance); node voltages feed back into the pin's Schmitt-trigger input and the ADC.
import { createTransientSession } from './circuit-engine.js';
import { PIN_LABELS, unoPin } from '../../packages/mcu/src/index.mjs';
import { resolveNodeAliases } from '../../packages/schematic/src/index.mjs';

/** Node names of a circuit (after wires and net labels merge them), ground first. */
export function circuitNodes(components, wires = [], netLabels = []) {
  const aliases = resolveNodeAliases(components.filter((part) => part.type !== 'ground'), wires, netLabels);
  const names = [...new Set(Object.values(aliases))].filter((name) => name !== '0').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return ['0', ...names];
}

export const PIN_ELECTRICAL = Object.freeze({ vcc: 5, outputResistance: 25, pullUp: 35_000, highImpedance: 1e9, inputLow: 1.5, inputHigh: 3.0 });

/**
 * Connect `board` (an UnoBoard) to a circuit. `connections` is [{ pin: 'D9' | 'A0' | 9, node }].
 * The CPU runs until a connected pin changes (or `maxStep` passes) and the circuit is then
 * advanced to the same instant, so PWM and digital edges reach the circuit at their exact time.
 */
export function createCoSimulation(board, { components, wires = [], netLabels = [], connections = [], maxStep = 20e-6, probes = [], historyLimit = 20_000, electrical = PIN_ELECTRICAL } = {}) {
  const valid = new Set([...Object.keys(resolveNodeAliases(components, wires, netLabels)), '0']);
  for (const connection of connections) if (connection.node && !valid.has(String(connection.node))) throw new Error(`Node "${connection.node}" is not in the circuit.`);
  const seen = new Set();
  const pins = connections.filter((connection) => connection.node && String(connection.node).trim()).map((connection) => {
    const { port, bit, number } = unoPin(connection.pin);
    const label = PIN_LABELS[number];
    if (seen.has(label)) throw new Error(`Pin ${label} is connected twice.`);
    seen.add(label);
    return { label, port: board.mcu.ports[port], bit, analog: number >= 14 ? number - 14 : null, node: String(connection.node), source: `__pin_${label}_v`, resistor: `__pin_${label}_r`, input: null };
  });
  if (!pins.length) throw new Error('Connect at least one Arduino pin to a circuit node.');
  const parts = [...components];
  for (const pin of pins) parts.push(
    { id: pin.source, type: 'voltage', label: `${pin.label} driver`, value: 0, n1: `__pin_${pin.label}`, n2: '0' },
    { id: pin.resistor, type: 'resistor', label: `${pin.label} driver resistance`, value: electrical.highImpedance, n1: `__pin_${pin.label}`, n2: pin.node },
  );
  const session = createTransientSession(parts, wires, netLabels);
  const cpu = board.cpu;
  const clock = cpu.clock;

  /** What the pin puts into the circuit: [Thévenin voltage, resistance]. */
  const drive = (pin) => {
    const D = cpu.data;
    const output = (D[pin.port.ddr] >> pin.bit) & 1;
    if (output) return [((pin.port.levels() >> pin.bit) & 1) * electrical.vcc, electrical.outputResistance];
    if ((D[pin.port.port] >> pin.bit) & 1) return [electrical.vcc, electrical.pullUp];
    return [0, electrical.highImpedance];
  };
  const driveKey = () => pins.map((pin) => drive(pin).join(':')).join('|');
  let lastKey = '', dirty = false;
  const applyDrives = () => {
    for (const pin of pins) { const [volts, ohms] = drive(pin); session.setValue(pin.source, volts); session.setValue(pin.resistor, ohms); }
    lastKey = driveKey();
  };
  const listener = () => { if (!dirty && driveKey() !== lastKey) dirty = true; };
  for (const port of new Set(pins.map((pin) => pin.port))) port.listeners.push(listener);

  const history = { time: [], nodes: Object.fromEntries([...new Set([...pins.map((pin) => pin.node), ...probes])].map((node) => [node, []])) };
  const sense = () => {
    for (const pin of pins) {
      const volts = session.voltage(pin.node);
      pin.volts = volts;
      if (pin.analog !== null) board.mcu.adc.inputs[pin.analog] = Math.max(0, volts);
      // Schmitt-trigger input (VIL 0.3·Vcc, VIH 0.6·Vcc on the ATmega328P).
      const level = volts >= electrical.inputHigh ? 1 : volts <= electrical.inputLow ? 0 : pin.input ?? (volts > electrical.vcc / 2 ? 1 : 0);
      if (level !== pin.input) { pin.input = level; pin.port.setDrive(pin.bit, level); }
    }
    const t = cpu.cycles / clock;
    if (history.time.length >= historyLimit) { const drop = Math.floor(historyLimit / 4); history.time.splice(0, drop); for (const values of Object.values(history.nodes)) values.splice(0, drop); }
    history.time.push(t);
    for (const [node, values] of Object.entries(history.nodes)) values.push(session.voltage(node));
  };
  let analogCycle = cpu.cycles;
  applyDrives();
  sense();

  return {
    session, pins, history,
    get time() { return cpu.cycles / clock; },
    voltage: (node) => session.voltage(node),
    /** Run both simulators for `seconds` of simulated time. */
    advance(seconds) {
      const end = cpu.cycles + Math.round(seconds * clock);
      const sliceCycles = Math.max(1, Math.round(maxStep * clock));
      while (cpu.cycles < end && !cpu.halted) {
        const sliceEnd = Math.min(end, cpu.cycles + sliceCycles);
        dirty = false;
        while (cpu.cycles < sliceEnd && !dirty && !cpu.halted) cpu.step();
        const dt = (cpu.cycles - analogCycle) / clock;
        if (dt > 0) { session.step(dt); analogCycle = cpu.cycles; }
        // The drives in force during the interval were the old ones; switch now for the next one.
        if (dirty || driveKey() !== lastKey) applyDrives();
        sense();
      }
    },
    detach() { for (const port of new Set(pins.map((pin) => pin.port))) port.listeners.splice(port.listeners.indexOf(listener), 1); },
  };
}
