// Analog Design Studio workspace: design-to-specification for bias, oscillators, filters,
// regulators, Schmitt triggers and PLLs, with loading into Circuit Lab. Entry points: renderAnalog(state), bindAnalogEvents().
import { modules } from '../../data/modules.js';
import { getState, notify, recordExperiment, setState, updateProject } from '../../core/store.js';
import { simulateDC } from '../../engines/circuit-engine.js';
import { niceRange } from '../../core/circuit-plot.js';
import { designBandpass, designBias, designLm317, designOscillator, designPll, designSallenKey, designSchmitt, designZener, networkSweep, OSCILLATORS } from '../../../packages/analogdesign/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';
import { circuitEditor } from '../../state/circuit-editor.js';
import { builtinConfiguration } from './circuit.js';

const ANALOG_TABS = [['bias', 'BJT bias & CE amplifier'], ['oscillator', 'Oscillators'], ['filter', 'Active filters'], ['regulator', 'Regulators'], ['schmitt', 'Schmitt trigger'], ['pll', 'PLL (565)']];
const SERIES_OPTIONS = [['E12', 'E12 (10 %)'], ['E24', 'E24 (5 %)'], ['E96', 'E96 (1 %)'], ['exact', 'Exact (no rounding)']];
const analogLab = makeLab('analog-lab', {
  tab: 'bias',
  bias: { vcc: 12, ic: 2e-3, beta: 100, reFraction: 0.1, vceFraction: 0.5, stiffness: 10, rl: 10e3, fLow: 100, series: 'E24', bypass: 'yes' },
  oscillator: { type: 'wien', frequency: 1000, c: 10e-9, l: 100e-6, ratio: 0.1, series: 'E24' },
  filter: { kind: 'lowpass', order: 4, fc: 1000, f0: 1000, q: 5, gain: 2, c: 10e-9, series: 'E96' },
  regulator: { kind: 'zener', vinMin: 12, vinMax: 15, vz: 5.1, izMin: 5e-3, ilMax: 20e-3, vout: 9, vin: 15, iload: 0.5, r1: 240, series: 'E24' },
  schmitt: { kind: 'inverting', vut: 2, vlt: -1, vsat: 13, r2: 10e3, series: 'E24' },
  pll: { rt: 10e3, ct: 10e-9, c2: 10e-6, vcc: 12, fin: 3500 },
});
const analogField = groupField('data-analog-field');
const analogSelect = (path, label, value, options) => labSelect('data-analog-select', path, label, value, options);
const partsTable = (values, units = {}) => simpleTable(['Part', 'Value'], Object.entries(values).map(([name, value]) => [name, eng(value, units[name] ?? (name.startsWith('C') ? 'F' : name.startsWith('L') ? 'H' : 'Ω'))]));
const sweepPlot = (title, sweep) => renderPlotFrame({ title, series: [{ xs: sweep.frequencies, ys: sweep.magnitudeDb, color: PLOT_COLORS[0], primary: true }], xMin: sweep.frequencies[0], xMax: sweep.frequencies.at(-1), logX: true, xTicks: logTicks(sweep.frequencies[0], sweep.frequencies.at(-1)), yRange: niceRange(Math.max(-80, Math.min(...sweep.magnitudeDb)), Math.max(...sweep.magnitudeDb) + 1), formatY: (value) => `${fmt(value, 3)} dB` });
function logTicks(start, stop) {
  const a = Math.log10(start), b = Math.log10(stop);
  return Array.from({ length: 5 }, (_, k) => ({ position: k / 4, text: eng(10 ** (a + (b - a) * k / 4), 'Hz') }));
}
function renderAnalogDesignTab(config) {
  const c = config[config.tab];
  if (config.tab === 'bias') {
    const d = designBias({ vcc: c.vcc, ic: c.ic, beta: c.beta, reFraction: c.reFraction, vceFraction: c.vceFraction, stiffness: c.stiffness, rl: c.rl, fLow: c.fLow, series: c.series, bypass: c.bypass === 'yes' });
    let sim = null;
    try { const dc = simulateDC(d.components); sim = { ic: (dc.nodes.vcc - dc.nodes.c) / d.chosen.rc, vce: dc.nodes.c - dc.nodes.e, vbe: dc.nodes.b - dc.nodes.e }; } catch { sim = null; }
    const vces = [0, d.loadLine.vceCut];
    const controls = `${analogField('bias.vcc', 'VCC', c.vcc, 'V')}${analogField('bias.ic', 'Target IC', c.ic, 'A')}${analogField('bias.beta', 'β (hFE)', c.beta)}${analogField('bias.reFraction', 'VE / VCC', c.reFraction)}${analogField('bias.vceFraction', 'VCE / VCC', c.vceFraction)}${analogField('bias.stiffness', 'Divider current / IB', c.stiffness)}${analogField('bias.rl', 'Load RL', c.rl, 'Ω')}${analogField('bias.fLow', 'Lower cut-off', c.fLow, 'Hz')}${analogSelect('bias.bypass', 'Emitter bypass', c.bypass, [['yes', 'With CE (high gain)'], ['no', 'No CE (stable gain)']])}${analogSelect('bias.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    const body = `<div class="power-grid"><div>${renderPlotFrame({ title: 'DC load line and Q-point (IC against VCE); the stem marks the Q-point', series: [{ xs: vces, ys: [d.loadLine.icSat, 0], color: PLOT_COLORS[0], primary: true }, { xs: [d.q.vce], ys: [d.q.ic], color: '#f59e0b', stem: true }], xMin: 0, xMax: d.loadLine.vceCut, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(d.loadLine.vceCut * k / 5, 'V') })), yRange: niceRange(0, d.loadLine.icSat), formatY: (value) => eng(value, 'A') })}
      <span class="panel-label">CHOSEN PARTS (IDEAL VALUE → STANDARD VALUE)</span>${simpleTable(['Part', 'Ideal', 'Chosen'], [['R1', eng(d.ideal.r1, 'Ω'), eng(d.chosen.r1, 'Ω')], ['R2', eng(d.ideal.r2, 'Ω'), eng(d.chosen.r2, 'Ω')], ['RC', eng(d.ideal.rc, 'Ω'), eng(d.chosen.rc, 'Ω')], ['RE', eng(d.ideal.re, 'Ω'), eng(d.chosen.re, 'Ω')], ['CIN', '', eng(d.capacitors.cin, 'F')], ['COUT', '', eng(d.capacitors.cout, 'F')], ...(d.capacitors.ce ? [['CE', '', eng(d.capacitors.ce, 'F')]] : [])])}
      <button class="button primary" data-analog-open>Open this amplifier in Circuit Lab →</button></div>
      <div class="analysis-readouts">${readout('Q-point (hand analysis, VBE 0.7 V)', `IC = ${eng(d.q.ic, 'A')}, VCE = ${eng(d.q.vce, 'V')}${d.q.saturated ? ' — SATURATED' : ''}`)}${sim ? readout('Q-point (circuit simulator)', `IC = ${eng(sim.ic, 'A')}, VCE = ${eng(sim.vce, 'V')}, VBE = ${eng(sim.vbe, 'V')}`) : ''}${readout('VB, VE, VC', `${eng(d.q.vb, 'V')}, ${eng(d.q.ve, 'V')}, ${eng(d.q.vc, 'V')}`)}${readout('Thévenin VTH, RTH', `${eng(d.vth, 'V')}, ${eng(d.rth, 'Ω')}`)}${readout('Stability factor S', fmt(d.stability, 4))}${readout('re = VT/IE, rπ, gm', `${eng(d.smallSignal.re, 'Ω')}, ${eng(d.smallSignal.rpi, 'Ω')}, ${eng(d.smallSignal.gm, 'S')}`)}${readout('Input resistance', eng(d.smallSignal.rin, 'Ω'))}${readout('Voltage gain Av', `${fmt(d.smallSignal.gain, 4)} (${fmt(d.smallSignal.gainDb, 4)} dB)`)}${readout('Load line', `IC(sat) = ${eng(d.loadLine.icSat, 'A')}, VCE(cut-off) = ${eng(d.loadLine.vceCut, 'V')}`)}<p class="field-help">Design rules: VE = 0.1·VCC for thermal stability, VCE = VCC/2 for maximum symmetrical swing, divider current about 10·IB so β changes barely move the Q-point. The tool rounds to standard values, then finds the exact Q-point of those parts; the simulator line uses the full diode law for VBE, which is why it differs by a few per cent.</p></div></div>`;
    return { controls, body, design: d };
  }
  if (config.tab === 'oscillator') {
    const lc = ['colpitts', 'hartley'].includes(c.type);
    const d = designOscillator({ type: c.type, frequency: c.frequency, c: c.c, l: c.l, ratio: c.ratio, series: c.series });
    const controls = `${analogSelect('oscillator.type', 'Type', c.type, Object.entries(OSCILLATORS))}${c.type === 'crystal' ? '' : analogField('oscillator.frequency', 'Wanted frequency', c.frequency, 'Hz')}${['wien', 'phase'].includes(c.type) ? analogField('oscillator.c', 'Chosen C', c.c, 'F') : ''}${lc ? analogField('oscillator.l', c.type === 'hartley' ? 'Total L (L1 + L2)' : 'Chosen L', c.l, 'H') : ''}${c.type === 'hartley' ? analogField('oscillator.ratio', 'L2 / (L1 + L2)', c.ratio) : ''}${c.type === 'crystal' ? '' : analogSelect('oscillator.series', 'Part series', c.series, SERIES_OPTIONS)}`;
    let plot = '';
    if (d.netlist) {
      const sweep = networkSweep(d.netlist, { start: d.actual / 20, stop: d.actual * 20, points: 241 });
      plot = `${sweepPlot('Feedback network |β(f)| in dB', sweep)}${linePlot('Feedback network phase (degrees)', sweep.frequencies.map((f) => Math.log10(f)), [{ name: 'phase', values: sweep.phase }], { xLabel: (x) => eng(10 ** x, 'Hz') })}`;
    }
    const body = `<div class="power-grid"><div>${partsTable(d.values)}${plot}</div>
      <div class="analysis-readouts">${readout('Formula', d.formula)}${readout('Frequency with these parts', eng(d.actual, 'Hz'))}${d.parallel ? readout('Parallel resonance fp', eng(d.parallel, 'Hz')) : ''}${d.q ? readout('Crystal Q', fmt(d.q, 5)) : ''}${readout('Barkhausen: required amplifier gain', `${fmt(d.requiredGain, 4)} — ${d.condition}`)}${d.feedback ? readout('Feedback β at f (phasor solver)', `${fmt(d.feedback.magnitude, 6)} ∠ ${fmt(d.feedback.phase, 4)}° (theory ${fmt(d.feedback.expected, 6)})`) : ''}<p class="field-help">An oscillator needs loop gain Aβ = 1 at 0° (or 360°). For RC types the tool builds the feedback network and solves it at the design frequency, so you can see β = 1/3 for the Wien bridge and 1/29 at 180° for the three-section phase-shift network. Make the gain slightly larger in practice so oscillation starts.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'filter') {
    const bp = c.kind === 'bandpass';
    const controls = `${analogSelect('filter.kind', 'Filter', c.kind, [['lowpass', 'Sallen–Key low-pass (Butterworth)'], ['highpass', 'Sallen–Key high-pass (Butterworth)'], ['bandpass', 'MFB band-pass']])}${bp ? `${analogField('filter.f0', 'Centre frequency', c.f0, 'Hz')}${analogField('filter.q', 'Q', c.q)}${analogField('filter.gain', 'Centre gain', c.gain)}` : `${analogField('filter.order', 'Order', c.order)}${analogField('filter.fc', 'Cut-off frequency', c.fc, 'Hz')}`}${analogField('filter.c', 'Base capacitor', c.c, 'F')}${analogSelect('filter.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    if (bp) {
      const d = designBandpass({ f0: c.f0, q: c.q, gain: c.gain, c: c.c, series: c.series });
      return { controls, body: `<div class="power-grid"><div>${sweepPlot('Magnitude response (phasor solver with ideal op-amp)', d.sweep)}${partsTable(d.values)}</div><div class="analysis-readouts">${readout('Centre frequency', eng(d.f0, 'Hz'))}${readout('Q', fmt(d.q, 5))}${readout('Bandwidth f0/Q', eng(d.bandwidth, 'Hz'))}${readout('Centre gain (formula)', fmt(d.gain, 5))}${readout('Centre gain (solver)', `${fmt(d.centre.magnitude, 5)} ∠ ${fmt(d.centre.phase, 4)}°`)}<p class="field-help">MFB (Delyiannis–Friend) band-pass: R1 = Q/(G·ω0C), R2 = Q/((2Q² − G)ω0C), R3 = 2Q/(ω0C). The response is computed by solving the full circuit, so rounding errors in the parts show up in the curve.</p></div></div>` };
    }
    const d = designSallenKey({ kind: c.kind, order: c.order, fc: c.fc, c: c.c, series: c.series });
    const rows = d.stages.map((stage, k) => [String(k + 1), stage.firstOrder ? '1st order' : `Q ${fmt(stage.q, 4)} → ${fmt(stage.actualQ, 4)}`, eng(stage.R1, 'Ω'), stage.R2 ? eng(stage.R2, 'Ω') : '—', eng(stage.C1, 'F'), stage.C2 ? eng(stage.C2, 'F') : '—', eng(stage.f0, 'Hz')]);
    return { controls, body: `<div class="power-grid"><div>${sweepPlot('Magnitude response of the whole cascade (phasor solver)', d.sweep)}${simpleTable(['Stage', 'Q wanted → got', 'R1', 'R2', 'C1', 'C2', 'f0'], rows)}</div><div class="analysis-readouts">${readout('Gain at fc', `${fmt(d.atCutoffDb, 4)} dB (ideal −3.01 dB)`)}${readout('Roll-off', `${20 * d.order} dB/decade`)}${readout('Stages', `${Math.floor(d.order / 2)} second-order${d.order % 2 ? ' + 1 first-order' : ''}`)}<p class="field-help">A Butterworth filter of order n is a cascade of second-order sections with Q = 1/(2 sin((2k − 1)π/2n)). Low-pass sections fix C2 and pick C1 ≥ 4Q²·C2, then solve for R1 and R2; high-pass sections use equal capacitors. Choose E96 or Exact to see how part tolerance moves the −3 dB point.</p></div></div>` };
  }
  if (config.tab === 'regulator') {
    const controls = `${analogSelect('regulator.kind', 'Regulator', c.kind, [['zener', 'Zener shunt'], ['lm317', 'LM317 adjustable']])}${c.kind === 'zener' ? `${analogField('regulator.vinMin', 'Vin min', c.vinMin, 'V')}${analogField('regulator.vinMax', 'Vin max', c.vinMax, 'V')}${analogField('regulator.vz', 'Zener voltage', c.vz, 'V')}${analogField('regulator.izMin', 'Iz min (knee)', c.izMin, 'A')}${analogField('regulator.ilMax', 'Load current max', c.ilMax, 'A')}` : `${analogField('regulator.vout', 'Wanted Vout', c.vout, 'V')}${analogField('regulator.vin', 'Vin', c.vin, 'V')}${analogField('regulator.iload', 'Load current', c.iload, 'A')}${analogField('regulator.r1', 'R1', c.r1, 'Ω')}`}${analogSelect('regulator.series', 'Resistor series', c.series, SERIES_OPTIONS.filter(([id]) => id !== 'exact' || c.kind === 'lm317'))}`;
    if (c.kind === 'zener') {
      const z = designZener({ vinMin: c.vinMin, vinMax: c.vinMax, vz: c.vz, izMin: c.izMin, ilMax: c.ilMax, series: c.series });
      return { controls, body: `<div class="analysis-readouts">${readout('Series resistor Rs (rounded down)', `${eng(z.rs, 'Ω')} (ideal ${eng(z.ideal, 'Ω')})`)}${readout('Iz at Vin min, full load', `${eng(z.izAtMin, 'A')} ${z.ok ? '≥ Iz min ✓' : '< Iz min ✗'}`)}${readout('Iz max (Vin max, no load)', eng(z.izMax, 'A'))}${readout('Zener dissipation (worst)', eng(z.pz, 'W'))}${readout('Resistor dissipation (worst)', eng(z.pr, 'W'))}${readout('Suggested ratings (2× margin)', `Zener ${eng(z.ratings.zenerW, 'W')}, resistor ${eng(z.ratings.resistorW, 'W')}`)}<p class="field-help">Rs = (Vin,min − Vz)/(Iz,min + IL,max) keeps the Zener in breakdown at the worst case; rounding Rs down only adds current. The Zener must survive the other worst case: highest input with the load removed.</p></div>` };
    }
    const r = designLm317({ vout: c.vout, vin: c.vin, iload: c.iload, r1: c.r1, series: c.series });
    return { controls, body: `<div class="analysis-readouts">${readout('R2', `${eng(r.r2, 'Ω')} (ideal ${eng(r.ideal, 'Ω')})`)}${readout('Actual Vout = 1.25(1 + R2/R1) + IADJ·R2', eng(r.vout, 'V'))}${readout('Dissipation (Vin − Vout)·I', eng(r.dissipation, 'W'))}${readout('Headroom', `${eng(r.headroom, 'V')} ${r.dropoutOk ? '≥ 3 V dropout ✓' : '< 3 V — will drop out ✗'}`)}${readout('Minimum load through R1', eng(r.minLoad, 'A'))}<p class="field-help">The LM317 keeps 1.25 V between OUT and ADJ, so R1 sets a fixed current and R2 lifts the output. Above about 1 W it needs a heat sink — see the thermal calculator in Product Design.</p></div>` };
  }
  if (config.tab === 'schmitt') {
    const s = designSchmitt({ vut: c.vut, vlt: c.vlt, vsat: c.vsat, kind: c.kind, r2: c.r2, series: c.series });
    const span = Math.max(Math.abs(s.vut), Math.abs(s.vlt)) * 2 + 1;
    const vin = Array.from({ length: 201 }, (_, k) => -span + 2 * span * k / 200);
    const inv = s.kind === 'inverting';
    const up = vin.map((v) => (inv ? (v < s.vut ? c.vsat : -c.vsat) : (v < s.vut ? -c.vsat : c.vsat)));
    const down = vin.map((v) => (inv ? (v > s.vlt ? -c.vsat : c.vsat) : (v > s.vlt ? c.vsat : -c.vsat)));
    const controls = `${analogSelect('schmitt.kind', 'Type', c.kind, [['inverting', 'Inverting'], ['noninverting', 'Non-inverting']])}${analogField('schmitt.vut', 'Upper threshold VUT', c.vut, 'V')}${analogField('schmitt.vlt', 'Lower threshold VLT', c.vlt, 'V')}${analogField('schmitt.vsat', '±Vsat', c.vsat, 'V')}${analogField('schmitt.r2', 'R2', c.r2, 'Ω')}${analogSelect('schmitt.series', 'Resistor series', c.series, SERIES_OPTIONS)}`;
    return { controls, body: `<div class="power-grid"><div>${linePlot('Transfer characteristic: Vout against Vin (rising, falling)', vin, [{ name: 'Vin rising', values: up }, { name: 'Vin falling', values: down, color: '#f97316', dashed: true }], { xLabel: (x) => eng(x, 'V') })}</div><div class="analysis-readouts">${readout('R1, R2', `${eng(s.r1, 'Ω')}, ${eng(s.r2, 'Ω')}`)}${readout('Reference voltage', eng(s.vref, 'V'))}${readout('Thresholds with these parts', `VUT = ${eng(s.vut, 'V')}, VLT = ${eng(s.vlt, 'V')}`)}${readout('Hysteresis', eng(s.hysteresis, 'V'))}<p class="field-help">${inv ? 'Inverting: the input goes to the − pin and R1/R2 feed back a fraction β = R2/(R1 + R2) of the output to the + pin.' : 'Non-inverting: the input goes through R1 to the + pin and R2 feeds the output back.'} Positive feedback makes the switching points depend on the output state, which ignores noise smaller than the hysteresis.</p></div></div>` };
  }
  const p = designPll({ rt: c.rt, ct: c.ct, c2: c.c2, vcc: c.vcc });
  const locked = Math.abs(c.fin - p.f0) <= p.lockRange, capturable = Math.abs(c.fin - p.f0) <= p.captureRange;
  const controls = `${analogField('pll.rt', 'Timing R1', c.rt, 'Ω')}${analogField('pll.ct', 'Timing C1', c.ct, 'F')}${analogField('pll.c2', 'Loop-filter C2', c.c2, 'F')}${analogField('pll.vcc', 'Total supply (+V − −V)', c.vcc, 'V')}${analogField('pll.fin', 'Input frequency', c.fin, 'Hz')}`;
  return { controls, body: `<div class="analysis-readouts">${readout('Free-running f0 = 0.3/(R1C1)', eng(p.f0, 'Hz'))}${readout('Lock range ±fL = ±8f0/V', `±${eng(p.lockRange, 'Hz')} → ${eng(p.lockBand[0], 'Hz')} to ${eng(p.lockBand[1], 'Hz')}`)}${readout('Capture range ±fC', `±${eng(p.captureRange, 'Hz')} → ${eng(p.captureBand[0], 'Hz')} to ${eng(p.captureBand[1], 'Hz')}`)}${readout(`Input at ${eng(c.fin, 'Hz')}`, capturable ? 'inside the capture range — the loop acquires lock' : locked ? 'inside the lock range — holds lock if already locked, will not acquire from unlocked' : 'outside the lock range — no lock')}<p class="field-help">The capture range is always narrower than the lock range: a bigger loop-filter capacitor gives a cleaner VCO control voltage but a narrower capture range. Formulas from the NE565 data sheet.</p></div>` };
}
export function renderAnalog(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'analog'), 'ANALOG DESIGN STUDIO — DESIGN TO A SPECIFICATION', '')}${labCard('analog', 'Analog design', ANALOG_TABS, analogLab.configuration(state), renderAnalogDesignTab)}</div>`;
}
export function bindAnalogEvents() {
  bindLabControls('analog', analogLab, ['series', 'bypass', 'type', 'kind']);
  document.querySelectorAll('[data-analog-open]').forEach((button) => button.addEventListener('click', () => {
    const view = renderAnalogDesignTab(analogLab.configuration(getState()));
    if (!view.design) return;
    loadDesignedCircuit(view.design.components, view.design.analysis, view.design.trace, 'Designed CE amplifier');
  }));
}
/** Put a generated circuit into Circuit Lab and open it. */
function loadDesignedCircuit(components, analysis, trace, name) {
  circuitEditor.wireSource = null; circuitEditor.selectedWire = null;
  updateProject((project) => { project.circuit.components = structuredClone(components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  recordExperiment({ id: 'circuit-builtin-analysis', kind: 'circuit', operation: 'builtin-analysis', inputs: { ...builtinConfiguration(getState()), source: 'V1', ...analysis } });
  setState({ simulation: null, selectedComponentId: null, selectedComponentIds: [], circuitPlotTrace: trace, activeModule: 'circuit' });
  notify(`${name} loaded. Press Run to simulate.`, 'success');
}

// ---------------------------------------------------------------------------
// Electronic Measurements: AC bridges, Lissajous, errors, meter design and the Q-meter.


// ---------------------------------------------------------------------------
// Radar, satellite, antennas and microwave tubes.




// ---------------------------------------------------------------------------
// Real + Virtual Bench: one firmware on a real Arduino (Web Serial) and on the simulated Uno.





// ---------------------------------------------------------------------------
// Neural-network playground.


// ---------------------------------------------------------------------------
// Math console.


// ---------------------------------------------------------------------------
// Learning Hub: tracks and lessons, quizzes, viva practice and verified lab checkpoints.
