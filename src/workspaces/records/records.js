// Lab Records workspace: the practical-journal form, sources gathered from other labs and the PDF
// lab record. Entry points: renderRecords(state), bindRecordEvents().
import { componentPalette, modules } from '../../data/modules.js';
import { esc, safeUrl } from '../../shared/escaping.js';
import { getState, notify, recordExperiment } from '../../core/store.js';
import { circuitTraces } from '../../core/circuit-plot.js';
import { nodeFields, pinName as componentPinName } from '../../../packages/schematic/src/components.mjs';
import { formatEngineeringValue } from '../../../packages/schematic/src/units.mjs';
import { AVR_EXAMPLES } from '../../../packages/mcu/src/index.mjs';
import { phaseDifference } from '../../../packages/instruments/src/index.mjs';
import { buildLabRecord } from '../../../packages/report/src/index.mjs';
import { capitalize, eng, fmt, lines } from '../../shared/formatting.js';
import { labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { isDcResult } from '../../shared/simulation.js';
import { mcuConfiguration, mcuRuntime, unoRuntime } from '../embedded/mcu.js';
import { benchCompute, benchConfiguration, benchScope } from '../circuit/bench.js';
import { reportError } from '../../services/errors.js';

const RECORD_TEMPLATES = Object.freeze({
  blank: { name: 'Blank record', title: '', aim: '', apparatus: '', theory: '', procedure: '', conclusion: '' },
  'rc-lowpass': {
    name: 'RC low-pass filter', title: 'Frequency response of a first-order RC low-pass filter',
    aim: 'To study the frequency response of a first-order RC low-pass filter and to find its cut-off frequency.',
    apparatus: 'Function generator\nDual-trace oscilloscope\nResistor 1 kΩ, capacitor 1 µF\nBreadboard and connecting wires',
    theory: 'A series resistor R followed by a shunt capacitor C passes low frequencies and attenuates high ones. The transfer function is H(jω) = 1 / (1 + jωRC), so |H| = 1 / √(1 + (f/fc)²) and the phase is −tan⁻¹(f/fc), where the cut-off frequency is fc = 1 / (2πRC). At fc the output is 0.707 times the input (−3 dB) and lags it by 45°. Above fc the gain falls by 20 dB per decade.',
    procedure: 'Connect the circuit as shown.\nSet the function generator to a 2 Vpp sine wave.\nConnect CH1 of the oscilloscope to the input and CH2 to the output.\nVary the frequency and note the output amplitude and the phase difference.\nCalculate the gain in dB and plot it against frequency on a log scale.\nFind the frequency at which the gain is −3 dB.',
    conclusion: 'The measured cut-off frequency agrees with fc = 1/(2πRC); the output lags the input by 45° at fc.',
  },
  'half-wave-rectifier': {
    name: 'Half-wave rectifier with capacitor filter', title: 'Half-wave rectifier with capacitor filter',
    aim: 'To study a half-wave rectifier with a capacitor filter and to measure its DC output voltage and ripple.',
    apparatus: 'Function generator (or step-down transformer)\nOscilloscope and digital multimeter\nDiode 1N4007, capacitor 100 µF, resistor 1 kΩ',
    theory: 'The diode conducts only during the positive half-cycle, so the load receives a pulsating DC. A capacitor across the load charges to nearly the peak voltage Vm − Vγ and discharges through the load while the diode is off. The peak-to-peak ripple is approximately Vr = Vdc / (f·R·C) and the ripple factor is γ = 1 / (2√3·f·R·C) for a half-wave rectifier.',
    procedure: 'Connect the circuit as shown.\nApply a 50 Hz sine wave of 20 Vpp.\nObserve the input on CH1 and the output on CH2.\nMeasure the DC output voltage with the multimeter.\nMeasure the peak-to-peak ripple using AC coupling on the oscilloscope.\nCalculate the ripple factor.',
    conclusion: 'The capacitor filter raises the DC output close to the peak value and the measured ripple agrees with Vr ≈ Vdc/(fRC).',
  },
  'inverting-opamp': {
    name: 'Inverting amplifier (op-amp)', title: 'Inverting amplifier using an op-amp',
    aim: 'To design an inverting amplifier of gain −10 and to verify its gain and phase.',
    apparatus: 'Op-amp IC 741 with ±12 V supply\nResistors 1 kΩ and 10 kΩ\nFunction generator, oscilloscope',
    theory: 'With negative feedback the inverting input is a virtual ground, so the input current Vin/R1 flows through Rf and Vout = −(Rf/R1)·Vin. The output is 180° out of phase with the input. The closed-loop bandwidth is the gain-bandwidth product divided by the noise gain (1 + Rf/R1).',
    procedure: 'Connect the circuit with R1 = 1 kΩ and Rf = 10 kΩ.\nApply a 1 kHz sine wave of 1 Vpp.\nObserve input and output on the two channels.\nMeasure the output amplitude and the phase difference.\nCalculate the gain and compare it with −Rf/R1.',
    conclusion: 'The measured gain is close to −Rf/R1 = −10 and the output is inverted (180° phase shift).',
  },
  'rlc-step': {
    name: 'Series RLC transient response', title: 'Transient response of a series RLC circuit',
    aim: 'To observe the step response of a series RLC circuit and to measure its damped frequency.',
    apparatus: 'Function generator (square wave)\nOscilloscope\nResistor 20 Ω, inductor 10 mH, capacitor 1 µF',
    theory: 'For a series RLC circuit the natural frequency is ωn = 1/√(LC) and the damping ratio is ζ = (R/2)·√(C/L). When ζ < 1 the capacitor voltage rings at the damped frequency ωd = ωn·√(1 − ζ²) while the oscillation decays with time constant 2L/R.',
    procedure: 'Connect the circuit as shown.\nApply a 100 Hz square wave of 5 Vpp with 2.5 V offset.\nObserve the capacitor voltage on CH2.\nMeasure the period of the ringing and the overshoot.\nCompare with the calculated damped frequency.',
    conclusion: 'The circuit is under-damped and the measured ringing frequency agrees with ωd = ωn√(1 − ζ²).',
  },
  'ce-amplifier': {
    name: 'BJT common-emitter amplifier', title: 'Single-stage BJT common-emitter amplifier',
    aim: 'To measure the voltage gain of a voltage-divider biased common-emitter amplifier.',
    apparatus: 'NPN transistor (β = 100)\nResistors 47 kΩ, 10 kΩ, 2.2 kΩ, 470 Ω, 1 kΩ\nCapacitors 10 µF, 100 µF\nDC power supply 12 V, function generator, oscilloscope, multimeter',
    theory: 'The voltage divider fixes the base voltage, setting the Q-point. With the emitter resistor bypassed, the mid-band voltage gain is Av = −gm·RC = −(IC/VT)·RC, and the output is 180° out of phase with the input. Coupling and bypass capacitors set the lower cut-off frequency.',
    procedure: 'Connect the circuit and switch on the 12 V supply.\nMeasure the DC collector current and voltages (Q-point).\nApply a 1 kHz sine wave of 20 mVpp at the input.\nObserve input and output and measure the output amplitude.\nCalculate the voltage gain in dB.',
    conclusion: 'The amplifier gives a mid-band gain of about 40 dB with a 180° phase shift, as predicted by Av = −gm·RC.',
  },
  'mcu-8051': {
    name: '8051 assembly program', title: '8051 assembly language program',
    aim: 'To write, assemble and execute an 8051 assembly language program and verify its output.',
    apparatus: 'OpenENTC 8051 simulator (or an 8051 trainer kit)\nPC with assembler',
    theory: 'The 8051 is an 8-bit microcontroller with 4 KB on-chip ROM, 128 bytes of RAM, four 8-bit I/O ports, two 16-bit timers and a full-duplex UART. Programs are written in assembly, converted to machine code by the assembler and executed from address 0000H.',
    procedure: 'Write the program in the editor.\nAssemble it and correct any errors.\nRun the program (or single-step it) and observe registers, ports and peripherals.\nNote the results.',
    conclusion: 'The program was executed successfully and produced the expected output.',
  },
  'mcu-arduino': {
    name: 'Arduino sketch', title: 'Interfacing with Arduino Uno (ATmega328P)',
    aim: 'To write an Arduino sketch, run it on the ATmega328P and verify its output.',
    apparatus: 'Arduino Uno (or the OpenENTC Uno simulator)\nArduino IDE / CLI\nLEDs, resistors, push buttons as required',
    theory: 'The Arduino Uno uses the 8-bit AVR ATmega328P running at 16 MHz with 32 KB flash, 2 KB SRAM, 14 digital I/O pins (6 with PWM) and 6 analogue inputs. A sketch has setup(), which runs once, and loop(), which runs repeatedly.',
    procedure: 'Write the sketch.\nCompile it and upload the HEX file.\nRun it and observe the pins, LEDs and serial monitor.\nNote the results.',
    conclusion: 'The sketch ran as expected on the ATmega328P.',
  },
});
const RECORD_DEFAULTS = Object.freeze({
  template: 'blank', institute: '', department: 'Department of Electronics & Telecommunication Engineering', course: '',
  name: '', roll: '', className: '', batch: '', number: '', date: '', title: '', aim: '', apparatus: '', theory: '', procedure: '',
  observations: '', calculations: '', result: '', conclusion: '',
  include: { circuit: true, bench: true, simulation: true, program8051: false, sketch: false, assessment: true },
});
function recordConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'lab-record')?.inputs || {};
  return { ...structuredClone(RECORD_DEFAULTS), ...saved, include: { ...RECORD_DEFAULTS.include, ...(saved.include || {}) } };
}
function persistRecord(patch) {
  const next = { ...recordConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The record text is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'lab-record', kind: 'report', operation: 'lab-record', inputs: next });
}
const PART_UNITS = { voltage: 'V', current: 'A', resistor: 'Ω', capacitor: 'F', inductor: 'H' };
/** Parse the observation text: first line is the header, cells split by | , or tab. */
function parseObservationTable(text) {
  const rows = lines(text).map((line) => line.split(/\s*[|\t]\s*|\s*,\s*/).map((cell) => cell.trim()));
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map((row) => row.length));
  return { columns: rows[0].concat(Array(width - rows[0].length).fill('')), rows: rows.slice(1).map((row) => row.concat(Array(width - row.length).fill(''))) };
}
/** The data each section of the record can draw on, with a short description for the checklist. */
function recordSources(state) {
  const parts = state.project.circuit.components.filter((part) => part.type !== 'ground');
  const sources = {};
  if (parts.length) sources.circuit = { label: `Circuit diagram data · ${parts.length} components`, blocks: () => [{ type: 'heading', text: 'Circuit components' }, { type: 'table', caption: 'Component list (from Circuit Lab)', columns: ['Ref.', 'Component', 'Value', 'Connections'], rows: parts.map((part) => [part.label, componentPalette.find((entry) => entry.type === part.type)?.label ?? part.type, PART_UNITS[part.type] ? formatEngineeringValue(Number(part.value), PART_UNITS[part.type], { digits: 4 }).trim() : `${fmt(Number(part.value), 4)} ${part.unit ?? ''}`.trim(), nodeFields(part).map((field) => `${componentPinName(part, field)}: ${part[field]}`).join(', ')]) }] };
  const benchConfig = benchConfiguration(state);
  const hasSource = state.project.circuit.components.some((part) => part.type === 'voltage' || part.type === 'current');
  if (hasSource) {
    const result = benchCompute(state, benchConfig);
    if (result.run) {
      const scope = benchScope(benchConfig, result);
      const used = scope.channels.map((channel, index) => ({ channel, index, values: scope.traceValues[index], m: scope.measurements[index] })).filter((entry) => entry.values);
      if (used.length) sources.bench = { label: `Lab Bench oscilloscope capture · ${used.map((entry) => `CH${entry.index + 1} ${entry.channel.node}`).join(', ')}`, blocks: () => {
        const g = benchConfig.generator;
        const pairs = [];
        if (g.enabled && g.sourceId) pairs.push(['Function generator', `${capitalize(g.shape)}, ${eng(g.frequency, 'Hz')}, ${eng(g.vpp, g.shape === 'pulse' ? 'V' : 'Vpp')}${g.offset ? `, offset ${eng(g.offset, 'V')}` : ''} on ${g.sourceId} (${g.impedance === '50' ? '50 Ω' : 'High-Z'} output)`]);
        (result.status || []).forEach((status) => pairs.push([`Power supply on ${status.sourceId}`, `${fmt(status.volts, 4)} V, ${eng(status.amps, 'A')} (${status.mode})`]));
        pairs.push(['Oscilloscope', `${eng(benchConfig.scope.tdiv, 's')}/div; ${used.map((entry) => `CH${entry.index + 1} = V(${entry.channel.node}) at ${eng(entry.channel.vdiv, 'V')}/div ${entry.channel.coupling.toUpperCase()}`).join('; ')}`]);
        const time = result.run.time;
        const series = used.map((entry) => { const xs = [], ys = []; for (let k = 0; k < time.length; k += 1) if (time[k] >= scope.start && time[k] <= scope.start + result.span) { xs.push((time[k] - scope.start) * 1000); ys.push(entry.values[k]); } return { name: `CH${entry.index + 1}: V(${entry.channel.node})`, xs, ys }; });
        const quantity = (label, pick) => [label, ...used.map((entry) => (entry.m ? pick(entry.m) : '—'))];
        const rows = [quantity('Peak-to-peak', (m) => eng(m.pp, 'V')), quantity('Maximum', (m) => eng(m.max, 'V')), quantity('Minimum', (m) => eng(m.min, 'V')), quantity('Mean (DC)', (m) => eng(Math.abs(m.mean) < m.pp * 1e-6 ? 0 : m.mean, 'V')), quantity('RMS of AC part', (m) => eng(m.acRms, 'V')), quantity('Frequency', (m) => (m.frequency ? eng(m.frequency, 'Hz') : '—')), quantity('Duty cycle', (m) => (m.duty === null ? '—' : `${fmt(m.duty * 100, 3)} %`))];
        const blocks = [{ type: 'heading', text: 'Observations (oscilloscope)' }, { type: 'keyvalue', pairs }, { type: 'plot', title: 'Oscilloscope capture', xLabel: 'Time (ms)', yLabel: 'Voltage (V)', series }, { type: 'table', caption: 'Automatic measurements', columns: ['Quantity', ...used.map((entry) => `CH${entry.index + 1}: V(${entry.channel.node})`)], rows, align: ['left', 'right', 'right'] }];
        if (used.length === 2 && used[0].m && used[1].m) {
          const gain = used[1].m.pp / used[0].m.pp;
          const phase = phaseDifference(used[0].m.window.time, used[0].m.window.v, used[1].m.window.v);
          blocks.push({ type: 'keyvalue', pairs: [['Gain (CH2 / CH1)', `${fmt(gain, 4)} = ${fmt(20 * Math.log10(gain), 2)} dB`], ['Phase of CH2 relative to CH1', phase === null ? '—' : `${fmt(phase, 1)}°`]] });
        }
        return blocks;
      } };
    }
  }
  const simulation = state.simulation;
  if (simulation?.kind === 'circuit-transient') {
    const traces = circuitTraces(simulation).filter((trace) => trace.unit === 'V').slice(0, 4);
    sources.simulation = { label: `Circuit Lab transient analysis · ${traces.map((trace) => trace.label).join(', ')}`, blocks: () => [{ type: 'heading', text: 'Simulation (transient)' }, { type: 'plot', title: 'Transient response', xLabel: 'Time (ms)', yLabel: 'Voltage (V)', series: traces.map((trace) => ({ name: trace.label, xs: simulation.time.map((t) => t * 1000), ys: trace.values })) }] };
  } else if (simulation?.kind === 'circuit-ac') {
    const nodes = Object.keys(simulation.nodes).filter((name) => name !== '0').slice(0, 4);
    sources.simulation = { label: `Circuit Lab AC sweep · ${nodes.map((name) => `V(${name})`).join(', ')}`, blocks: () => [{ type: 'heading', text: 'Simulation (frequency response)' }, { type: 'plot', title: 'Magnitude response', xLabel: 'Frequency (Hz)', yLabel: 'Gain (dB)', logX: true, series: nodes.map((name) => ({ name: `V(${name})`, xs: simulation.frequency, ys: simulation.nodes[name].magnitude.map((value) => 20 * Math.log10(Math.max(value, 1e-12))) })) }, { type: 'plot', title: 'Phase response', xLabel: 'Frequency (Hz)', yLabel: 'Phase (°)', logX: true, series: nodes.map((name) => ({ name: `V(${name})`, xs: simulation.frequency, ys: simulation.nodes[name].phase })) }] };
  } else if (isDcResult(simulation)) {
    sources.simulation = { label: `Circuit Lab DC operating point · ${Object.keys(simulation.nodes).length} nodes`, blocks: () => [{ type: 'heading', text: 'Simulation (DC operating point)' }, { type: 'table', caption: 'Node voltages and branch currents', columns: ['Quantity', 'Value'], align: ['left', 'right'], rows: [...Object.entries(simulation.nodes).map(([node, value]) => [`V(${node})`, `${fmt(value, 6)} V`]), ...Object.entries(simulation.currents).map(([id, value]) => [`I(${id})`, eng(value, 'A')])] }] };
  }
  const mcu = mcuConfiguration(state);
  sources.program8051 = { label: '8051 program from the Microcontroller Lab', blocks: () => {
    const output = mcuRuntime?.cpu?.serialOutput?.length ? String.fromCharCode(...mcuRuntime.cpu.serialOutput.slice(-2000)) : '';
    return [{ type: 'heading', text: 'Program (8051 assembly)' }, { type: 'code', text: mcu.source }, ...(output ? [{ type: 'code', title: 'Serial output', text: output }] : [])];
  } };
  const sketch = AVR_EXAMPLES.find((example) => example.id === mcu.avrExampleId);
  if (sketch) sources.sketch = { label: `Arduino sketch “${sketch.name}”`, blocks: () => {
    const output = unoRuntime?.board?.mcu?.usart?.output?.length ? String.fromCharCode(...unoRuntime.board.mcu.usart.output.slice(-2000)) : '';
    return [{ type: 'heading', text: 'Program (Arduino sketch)' }, { type: 'code', title: `${sketch.id}.ino`, text: sketch.source }, ...(output ? [{ type: 'code', title: 'Serial monitor', text: output }] : [])];
  } };
  return sources;
}
function buildRecordDocument(state) {
  const config = recordConfiguration(state);
  const sources = recordSources(state);
  const blocks = [];
  const text = (heading, value) => { if (String(value || '').trim()) blocks.push({ type: 'heading', text: heading }, { type: 'paragraph', text: value }); };
  const items = (heading, value, ordered) => { const entries = lines(value); if (entries.length) blocks.push({ type: 'heading', text: heading }, { type: 'list', items: entries, ordered }); };
  text('Aim', config.aim);
  items('Apparatus / software', config.apparatus, false);
  text('Theory', config.theory);
  if (config.include.circuit && sources.circuit) blocks.push(...sources.circuit.blocks());
  items('Procedure', config.procedure, true);
  const table = parseObservationTable(config.observations);
  if (table) blocks.push({ type: 'heading', text: 'Observation table' }, { type: 'table', ...table });
  for (const key of ['bench', 'simulation', 'program8051', 'sketch']) if (config.include[key] && sources[key]) blocks.push(...sources[key].blocks());
  text('Calculations', config.calculations);
  text('Result', config.result);
  text('Conclusion', config.conclusion);
  return buildLabRecord({ institute: config.institute, department: config.department, course: config.course, student: { name: config.name, roll: config.roll, className: config.className, batch: config.batch }, experiment: { number: config.number, title: config.title || 'Untitled experiment', date: config.date }, blocks, assessment: config.include.assessment });
}
/** Suggested result sentence from the bench measurements. */
function suggestedResult(state) {
  const config = benchConfiguration(state);
  const result = benchCompute(state, config);
  if (!result.run) return '';
  const scope = benchScope(config, result);
  const [a, b] = scope.measurements;
  if (a && b) {
    const gain = b.pp / a.pp;
    const phase = phaseDifference(a.window.time, a.window.v, b.window.v);
    return `At ${a.frequency ? eng(a.frequency, 'Hz') : 'the applied frequency'} the measured gain V(${scope.channels[1].node})/V(${scope.channels[0].node}) is ${fmt(gain, 4)} (${fmt(20 * Math.log10(gain), 2)} dB)${phase === null ? '' : ` with a phase shift of ${fmt(phase, 1)}°`}. The output has a DC level of ${eng(Math.abs(b.mean) < b.pp * 1e-6 ? 0 : b.mean, 'V')} and ${eng(b.pp, 'V')} peak to peak.`;
  }
  const m = a || b;
  return m ? `The measured signal is ${eng(m.pp, 'V')} peak to peak with a mean of ${eng(m.mean, 'V')}${m.frequency ? ` at ${eng(m.frequency, 'Hz')}` : ''}.` : '';
}
export function renderRecords(state) {
  const config = recordConfiguration(state);
  const sources = recordSources(state);
  const field = (name, label, attributes = '') => `<label>${label}<input type="text" data-record-field="${name}" value="${esc(config[name])}" ${attributes}></label>`;
  const area = (name, label, rows = 4, placeholder = '') => `<label class="record-area">${label}<textarea rows="${rows}" data-record-field="${name}" placeholder="${esc(placeholder)}">${esc(config[name])}</textarea></label>`;
  const include = [['circuit', 'Circuit component list'], ['bench', 'Lab Bench oscilloscope capture and measurements'], ['simulation', 'Circuit Lab simulation result'], ['program8051', '8051 program listing'], ['sketch', 'Arduino sketch listing'], ['assessment', 'Marks and signature block']]
    .map(([key, label]) => { const available = key === 'assessment' || sources[key]; return `<label class="record-check ${available ? '' : 'unavailable'}"><input type="checkbox" data-record-include="${key}" ${config.include[key] && available ? 'checked' : ''} ${available ? '' : 'disabled'}><span><b>${esc(label)}</b><small>${esc(available ? (sources[key]?.label ?? 'Assessment table and signature lines') : 'Nothing to include yet')}</small></span></label>`; }).join('');
  return `<div class="page scroll-page record-page">${pageHeader(modules.find((item) => item.id === 'record'), 'PRACTICAL JOURNAL', '<button class="button primary" data-action="record-download">Download PDF</button>')}
    <div class="record-layout"><div class="record-form">
      <div class="coding-block"><span class="panel-label">START FROM A TEMPLATE</span><div class="dsp-controls">${labSelect('data-record-template', 'template', 'Experiment template', config.template, Object.entries(RECORD_TEMPLATES).map(([id, template]) => [id, template.name]))}<button class="button ghost" data-action="record-apply-template">Fill aim, theory and procedure</button><button class="button ghost" data-action="record-suggest-result">Write result from bench readings</button></div></div>
      <div class="coding-block"><span class="panel-label">INSTITUTE & STUDENT</span><div class="record-grid">${field('institute', 'College / institute')}${field('department', 'Department')}${field('course', 'Course / laboratory')}${field('name', 'Student name')}${field('roll', 'Roll no.')}${field('className', 'Class / division')}${field('batch', 'Batch')}${field('number', 'Experiment no.')}${field('date', 'Date', 'placeholder="dd/mm/yyyy"')}</div>${field('title', 'Title of experiment')}</div>
      <div class="coding-block"><span class="panel-label">WRITE-UP</span>${area('aim', 'Aim', 2)}${area('apparatus', 'Apparatus / software (one per line)', 4)}${area('theory', 'Theory', 6)}${area('procedure', 'Procedure (one step per line)', 6)}${area('observations', 'Observation table (first line = column headings; separate cells with | )', 6, 'f (Hz) | Vin (Vpp) | Vout (Vpp)\n100 | 2 | 1.7')}${area('calculations', 'Calculations', 4)}${area('result', 'Result', 3)}${area('conclusion', 'Conclusion', 3)}</div>
    </div><aside class="record-side"><div class="coding-block"><span class="panel-label">INCLUDE FROM THIS PROJECT</span>${include}</div><div class="coding-block"><span class="panel-label">PREVIEW</span><button class="button ghost" data-action="record-preview">Show PDF preview</button><div class="record-preview" data-record-preview></div><p class="field-help">The PDF uses the standard Helvetica, Courier and Symbol fonts, so Greek letters such as Ω, µ and θ print correctly. Graphs are vector drawings.</p></div></aside></div></div>`;
}
let recordPreviewUrl = null;
function recordPdfBlob() {
  const doc = buildRecordDocument(getState());
  return new Blob([doc.toBytes()], { type: 'application/pdf' });
}
export function bindRecordEvents() {
  document.querySelectorAll('[data-record-field]').forEach((input) => input.addEventListener('change', () => persistRecord({ [input.dataset.recordField]: input.value })));
  document.querySelectorAll('[data-record-include]').forEach((input) => input.addEventListener('change', () => { const config = recordConfiguration(getState()); persistRecord({ include: { ...config.include, [input.dataset.recordInclude]: input.checked } }); }));
  document.querySelector('[data-record-template]')?.addEventListener('change', (event) => persistRecord({ template: event.target.value }));
  document.querySelector('[data-action="record-apply-template"]')?.addEventListener('click', () => {
    const config = recordConfiguration(getState());
    const template = RECORD_TEMPLATES[config.template] ?? RECORD_TEMPLATES.blank;
    const patch = Object.fromEntries(['title', 'aim', 'apparatus', 'theory', 'procedure', 'conclusion'].map((key) => [key, template[key]]));
    if (config.template.startsWith('mcu-')) patch.include = { ...config.include, program8051: config.template === 'mcu-8051', sketch: config.template === 'mcu-arduino', bench: false };
    persistRecord(patch);
    notify(`${template.name} template filled in. Edit any section before downloading.`, 'success');
  });
  document.querySelector('[data-action="record-suggest-result"]')?.addEventListener('click', () => {
    const text = suggestedResult(getState());
    if (!text) { notify('Put a circuit on the Lab Bench and probe it first.', 'error'); return; }
    persistRecord({ result: text });
  });
  document.querySelector('[data-action="record-download"]')?.addEventListener('click', () => {
    let blob;
    try { blob = recordPdfBlob(); } catch (error) { reportError(error); return; }
    const config = recordConfiguration(getState());
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `${['experiment', config.number, config.title].filter(Boolean).join('-').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'lab-record'}.pdf`;
    link.click(); URL.revokeObjectURL(link.href);
    notify('Lab record PDF downloaded', 'success');
  });
  document.querySelector('[data-action="record-preview"]')?.addEventListener('click', () => {
    let blob;
    try { blob = recordPdfBlob(); } catch (error) { reportError(error); return; }
    if (recordPreviewUrl) URL.revokeObjectURL(recordPreviewUrl);
    recordPreviewUrl = URL.createObjectURL(blob);
    const target = document.querySelector('[data-record-preview]');
    if (target) { const url = esc(safeUrl(recordPreviewUrl, { schemes: ['blob:'] })); target.innerHTML = `<iframe title="Lab record preview" src="${url}"></iframe><a href="${url}" target="_blank" rel="noopener">Open in a new tab</a>`; }
  });
}

// ---------------------------------------------------------------------------
// Power electronics lab.





// ---------------------------------------------------------------------------
// ADC & DAC lab.



// ---------------------------------------------------------------------------
// Sensors & instrumentation and EV engineering.




// ---------------------------------------------------------------------------
// VLSI lab (CMOS inverter) and RTOS scheduler.




// ---------------------------------------------------------------------------
// Signals & systems explorer.


// ---------------------------------------------------------------------------
// Electromagnetics & microwave lab.
