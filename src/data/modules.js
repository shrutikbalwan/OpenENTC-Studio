import { COMPONENT_DEFINITIONS, COMPONENT_DEFINITION_VERSION, validateComponentDefinitions } from '../../packages/schematic/src/components.mjs';

export const modules = [
  { id: 'home', name: 'Mission control', short: 'Home', icon: '⌂', color: '#5eead4', description: 'Projects, engines and guided workflows.' },
  { id: 'circuit', name: 'Circuit Lab', short: 'Circuit', icon: '⌁', color: '#60a5fa', description: 'Draw, inspect and solve electronic circuits.' },
  { id: 'theory', name: 'Network Theory', short: 'Theory', icon: 'Ω', color: '#93c5fd', description: 'Thévenin, Norton, superposition, maximum power transfer, star–delta and two-port parameters for any netlist, DC or AC.' },
  { id: 'analog', name: 'Analog Design', short: 'Design', icon: '⊿', color: '#34d399', description: 'Design to a specification: BJT bias and CE amplifier, Wien/phase-shift/Colpitts/Hartley/crystal oscillators, Butterworth Sallen–Key and MFB band-pass filters, Zener and LM317 regulators, Schmitt triggers and the 565 PLL — with standard part values and a simulator check.' },
  { id: 'bench', name: 'Lab Bench', short: 'Bench', icon: '◔', color: '#facc15', description: 'Oscilloscope, function generator, bench power supply and multimeter connected to your Circuit Lab circuit.' },
  { id: 'faulthunt', name: 'Fault Hunt', short: 'Faults', icon: '⚑', color: '#ef4444', description: 'Troubleshooting practice: a part on the board has a hidden fault (open, short, drifted value, dead transistor). Find it with a virtual multimeter and get a score.' },
  { id: 'measure', name: 'Measurements', short: 'Measure', icon: '⊜', color: '#fbbf24', description: 'Virtual AC bridges with a null detector (Maxwell, Hay, Owen, Schering, De Sauty, Wien), Lissajous patterns, reading statistics and limiting errors, voltmeter loading, ammeter/voltmeter/ohmmeter design and the Q-meter.' },
  { id: 'embedded', name: 'Embedded Lab', short: 'Embedded', icon: '▣', color: '#f59e0b', description: 'Write firmware and prepare MCU projects.' },
  { id: 'power', name: 'Power Electronics', short: 'Power', icon: 'ϟ', color: '#f87171', description: 'Controlled rectifiers, DC-DC converters, inverters and AC controllers with waveforms, harmonics and textbook formulas.' },
  { id: 'machines', name: 'Machines & Devices', short: 'Machines', icon: '⚙', color: '#60a5fa', description: 'Transformer OC/SC tests, efficiency, regulation and all-day efficiency; DC shunt and series motor characteristics; induction-motor torque–slip and power flow; UJT and R triggering, snubbers, SCR strings and switching losses.' },
  { id: 'adc', name: 'ADC & DAC Lab', short: 'ADC', icon: '⊿', color: '#2dd4bf', description: 'Quantisation, DNL/INL, SNR and ENOB; SAR, flash, dual-slope and sigma-delta conversion step by step; R-2R and weighted DACs.' },
  { id: 'sensors', name: 'Sensors & Instrumentation', short: 'Sensors', icon: '♨', color: '#fb923c', description: 'Thermocouples (NIST tables), RTDs, thermistors, strain-gauge bridges, LVDTs and complete sensor → amplifier → ADC chains.' },
  { id: 'ev', name: 'EV Engineering', short: 'EV', icon: '⚡', color: '#a3e635', description: 'Battery-pack sizing, road load and range, motor torque–speed and acceleration, and charging time.' },
  { id: 'mcu', name: 'Microcontroller Lab', short: 'MCU', icon: '⌗', color: '#fbbf24', description: '8051 and Arduino Uno (ATmega328P) simulators with virtual boards, serial terminals and debugging.' },
  { id: 'twin', name: 'Real + Virtual Bench', short: 'Twin', icon: '⇄', color: '#2dd4bf', description: 'Run one firmware on a real Arduino over USB and on the simulated Uno wired to the same circuit, and compare both with theory: RC step response, divider and live streaming.' },
  { id: 'pcb', name: 'PCB Studio', short: 'PCB', icon: '▤', color: '#34d399', description: 'Schematic-to-board design workflow.' },
  { id: 'product', name: 'Product Design', short: 'Product', icon: '◰', color: '#a78bfa', description: 'Heat-sink thermal design, parts-count reliability and MTBF with redundancy, IPC-2221 PCB trace width and duty-cycled battery life.' },
  { id: 'fpga', name: 'FPGA & Digital', short: 'FPGA', icon: '◇', color: '#a78bfa', description: 'Design, synthesize and verify digital logic.' },
  { id: 'vlsi', name: 'VLSI Lab', short: 'VLSI', icon: '⧈', color: '#c084fc', description: 'CMOS inverter: VTC, switching threshold, noise margins, propagation delay and power with the SPICE level-1 model.' },
  { id: 'rtos', name: 'RTOS Scheduler', short: 'RTOS', icon: '⏱', color: '#38bdf8', description: 'RM, DM, EDF, LLF, FCFS and round-robin scheduling with Gantt charts, response-time analysis and priority inversion.' },
  { id: 'plc', name: 'PLC & Automation', short: 'PLC', icon: '⊣⊢', color: '#facc15', description: 'Write ladder logic, see the ladder diagram and run it live with clickable inputs and lamps: contacts, coils, latches, TON/TOF/TP timers and counters, with motor, interlock, traffic-light, star–delta and counter examples.' },
  { id: 'logic', name: 'Digital Logic Lab', short: 'Logic', icon: '⊼', color: '#e879f9', description: 'Boolean algebra, K-maps, gate and flip-flop simulation, number codes.' },
  { id: 'sigsys', name: 'Signals & Systems', short: 'S&S', icon: 'ℒ', color: '#fca5a5', description: 'Fourier series with Gibbs effect, Laplace and z-transform partial fractions and inverses, and the DFT step by step.' },
  { id: 'dsp', name: 'Signals & DSP', short: 'DSP', icon: '∿', color: '#fb7185', description: 'Generate, transform and inspect signals.' },
  { id: 'dip', name: 'Image Processing', short: 'Image', icon: '▧', color: '#c4b5fd', description: 'Histograms, equalisation, Otsu, spatial and median filters, Sobel and Canny edges, 2-D FFT filtering, morphology with object counting and JPEG-style DCT compression.' },
  { id: 'biomed', name: 'Biomedical Signals', short: 'Bio', icon: '♥', color: '#fb7185', description: 'Synthetic or pasted ECG with filtering, Pan–Tompkins QRS detection and heart-rate variability, and EEG rhythms with Welch band powers.' },
  { id: 'speech', name: 'Speech Processing', short: 'Speech', icon: '◌', color: '#e879f9', description: 'Record your voice or use synthetic vowels: short-time energy and zero-crossing rate, pitch by autocorrelation, AMDF and cepstrum, LPC with formants, spectrogram and MFCCs.' },
  { id: 'neural', name: 'Neural Networks', short: 'NN', icon: '⊛', color: '#f0abfc', description: 'Train a multilayer perceptron on 2-D datasets and watch the decision regions, loss and weights; step through the perceptron learning rule on logic gates.' },
  { id: 'communication', name: 'Communication', short: 'Comms', icon: '⌁', color: '#22d3ee', description: 'Explore modulation and communication chains.' },
  { id: 'info', name: 'Information & Coding', short: 'Info', icon: 'ℍ', color: '#c084fc', description: 'Entropy, Huffman and Shannon–Fano codes, LZW, channel capacity (Blahut–Arimoto, Shannon–Hartley), PN and Gold codes, DSSS against a jammer, FHSS and an OFDM link with cyclic prefix.' },
  { id: 'rf', name: 'RF & Antennas', short: 'RF', icon: '⌖', color: '#f97316', description: 'RF calculations, matching and antenna studies.' },
  { id: 'em', name: 'EM & Microwave', short: 'EM', icon: '⌁', color: '#38bdf8', description: 'Charges and Gauss\'s law, plane waves and skin depth, Fresnel and polarisation, waveguide modes, S-parameter networks and amplifier stability.' },
  { id: 'radar', name: 'Radar & Satellite', short: 'Radar', icon: '◬', color: '#f97316', description: 'Radar range equation, pulse timing, Doppler, MTI blind speeds and FMCW; Kepler orbits, GEO look angles and satellite link budgets; dipole patterns, dish and horn gain; reflex klystron, magnetron, directional coupler and VSWR.' },
  { id: 'console', name: 'Math Console', short: 'Console', icon: '≫', color: '#a5b4fc', description: 'A MATLAB-style calculator: complex numbers, matrices, A\\b, polynomials, your own functions and plots, with engineering suffixes like 4.7k and 100n.' },
  { id: 'calc', name: 'Engineering Calculators', short: 'Calc', icon: '⊞', color: '#38bdf8', description: 'Resistor and component codes, 555 timer, op-amps, decibels and circuit formulas.' },
  { id: 'iot', name: 'IoT & Control', short: 'IoT', icon: '◉', color: '#4ade80', description: 'Connect sensors, controllers and data flows.' },
  { id: 'cellular', name: 'Cellular Planning', short: 'Cellular', icon: '⬡', color: '#fb7185', description: 'Erlang-B/C traffic, hexagonal frequency reuse and S/I, Okumura–Hata path loss and cell radius, and handoff with shadowing.' },
  { id: 'network', name: 'Computer Networks', short: 'Network', icon: '⌘', color: '#818cf8', description: 'IPv4/IPv6 subnetting and VLSM, link-state and distance-vector routing, sliding-window ARQ timelines, ALOHA/CSMA throughput and saved packet captures.' },
  { id: 'sdr', name: 'SDR Flowgraph', short: 'SDR', icon: '⇶', color: '#22d3ee', description: 'Build GNU Radio-style flowgraphs: sources, filters, mixers, FM/PSK modulators, channel models and scope, FFT, constellation and error-count sinks — run offline in the browser.' },
  { id: 'wsn', name: 'Sensor Networks', short: 'WSN', icon: '⁂', color: '#a3e635', description: 'Random and grid deployments, radio connectivity and k-coverage, and network lifetime with direct, multi-hop and LEACH clustering on the first-order radio model.' },
  { id: 'crypto', name: 'Cryptography', short: 'Crypto', icon: '⚿', color: '#f472b6', description: 'Caesar, Vigenère, Playfair, Hill and rail fence; modular arithmetic, RSA and Diffie–Hellman; AES, DES and SHA-256 round by round.' },
  { id: 'record', name: 'Lab Records', short: 'Record', icon: '✎', color: '#fda4af', description: 'Write your practical journal and download it as a PDF with circuit, oscilloscope captures, graphs and programs.' },
  { id: 'learn', name: 'Learning Hub', short: 'Learn', icon: '◫', color: '#facc15', description: 'Eight ENTC tracks of short lessons linked to the labs, quizzes with fresh numbers every attempt, viva practice and verified lab checkpoints.' }
];

validateComponentDefinitions(COMPONENT_DEFINITIONS);
export { COMPONENT_DEFINITION_VERSION };
export const componentPalette = COMPONENT_DEFINITIONS.map(({ type, label, symbol, defaultValue, unit }) => ({ type, label, symbol, defaultValue, unit }));

export const learningTracks = [
  ['Circuit foundations', 8, 'Beginner'], ['Digital systems', 12, 'Beginner'],
  ['Embedded C and MCUs', 16, 'Intermediate'], ['Signals and systems', 14, 'Intermediate'],
  ['Digital communication', 18, 'Advanced'], ['RF and antenna design', 15, 'Advanced']
];
