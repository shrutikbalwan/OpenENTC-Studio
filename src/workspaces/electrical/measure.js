// Electronic Measurements workspace. Entry points: renderMeasurement(state); bindMeasurementEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { ammeterShunt, armImpedance, ayrtonShunt, bridgeDetector, BRIDGES, combineErrors, fullScaleToReading, lissajous, qMeter, readingStatistics, seriesOhmmeter, solveBridge, voltmeterLoading, voltmeterMultiplier } from '../../../packages/measurement/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { parseNumberList } from '../../shared/parsing.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderComplexPlane, stemPlot } from '../../components/plots.js';
import { groupField, labSelect, labText } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, bindLabText, makeLab } from '../../controllers/lab-controls.js';

const MEAS_TABS = [['bridge', 'AC bridges'], ['lissajous', 'Lissajous'], ['errors', 'Errors & statistics'], ['meters', 'Meter design'], ['qmeter', 'Q-meter']];
const BRIDGE_ARMS = { maxwell: ['R1', 'C1', 'R2', 'R3'], hay: ['R1', 'C1', 'R2', 'R3'], owen: ['R2', 'C2', 'R3', 'C4'], schering: ['C2', 'R3', 'R4', 'C4'], desauty: ['C2', 'R3', 'R4'], wien: ['R1', 'R2', 'C1', 'C2', 'R4'] };
const measLab = makeLab('meas-lab', {
  tab: 'bridge',
  bridge: { type: 'maxwell', mode: 'practice', seed: 1, frequency: 1000, vs: 1, R1: 400e3, C1: 0.4e-6, R2: 1000, R3: 1000, C2: 100e-12, R4: 2000, C4: 50e-9, lx: 0.5, rx: 2.1, cx: 200e-12, crx: 25e3 },
  lissajous: { fx: 1000, fy: 2000, ax: 1, ay: 1, phase: 30 },
  errors: { readings: '101.2 101.4 101.7 101.3 101.3 101.2 101.0 101.3 101.5 101.1', formula: 'i2r', e1: 1, e2: 2, fsd: 1, fullScale: 150, reading: 75, vs: 10, ra: 100e3, rb: 100e3, sensitivity: 20e3, range: 10 },
  meters: { im: 1e-3, rm: 100, range: 1, ranges: '0.01 0.1 1', vrange: 10, battery: 3, halfScale: 1500 },
  qmeter: { f1: 1e6, c1: 400e-12, c2: 95e-12, indicatedQ: 120, shuntR: 0.02 },
});
const measField = groupField('data-meas-field');
const measText = labText('meas');
const ERROR_FORMULAS = { i2r: ['P = I²R', [['I', 2], ['R', 1]]], vi: ['P = V·I', [['V', 1], ['I', 1]]], v2r: ['P = V²/R', [['V', 2], ['R', -1]]], ohm: ['R = V/I', [['V', 1], ['I', -1]]], sum: ['R = R1 + R2 (absolute errors)', null] };
/** In challenge mode the unknown comes from a seed and stays hidden. */
function bridgeUnknownValues(c) {
  if (c.mode !== 'challenge') return c;
  const r = (k) => { const x = Math.sin(c.seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { ...c, lx: Number((0.1 + 0.9 * r(1)).toPrecision(3)), rx: Number((1 + 49 * r(2)).toPrecision(3)), cx: Number((50e-12 + 450e-12 * r(3)).toPrecision(3)), crx: Number((1e3 + 49e3 * r(4)).toPrecision(3)) };
}
function bridgeArms(type, raw) {
  const c = bridgeUnknownValues(raw);
  const f = c.frequency, z = (arm) => armImpedance(arm, f);
  if (type === 'maxwell') return { z2: { re: c.R2, im: 0 }, z3: { re: c.R3, im: 0 }, z4: z({ r: c.R1, cap: c.C1, form: 'parallel' }), unknown: z({ r: c.rx, l: c.lx }) };
  if (type === 'hay') return { z2: { re: c.R2, im: 0 }, z3: { re: c.R3, im: 0 }, z4: z({ r: c.R1, cap: c.C1 }), unknown: z({ r: c.rx, l: c.lx }) };
  if (type === 'owen') return { z2: z({ r: c.R2, cap: c.C2 }), z3: { re: c.R3, im: 0 }, z4: z({ cap: c.C4 }), unknown: z({ r: c.rx, l: c.lx }) };
  if (type === 'schering') return { z2: z({ cap: c.C2 }), z3: { re: c.R3, im: 0 }, z4: z({ r: c.R4, cap: c.C4, form: 'parallel' }), unknown: z({ r: c.crx, cap: c.cx }) };
  if (type === 'desauty') return { z2: z({ cap: c.C2 }), z3: { re: c.R3, im: 0 }, z4: { re: c.R4, im: 0 }, unknown: z({ cap: c.cx }) };
  return null;
}
function renderBridgeSchematic(type) {
  const labels = { maxwell: ['Lx, Rx', 'R2', 'R3', 'R1 ∥ C1'], hay: ['Lx, Rx', 'R2', 'R3', 'R1 + C1'], owen: ['Lx, Rx', 'R2 + C2', 'R3', 'C4'], schering: ['Cx, Rx', 'C2', 'R3', 'R4 ∥ C4'], desauty: ['Cx', 'C2', 'R3', 'R4'], wien: ['R1 + C1', 'R2 ∥ C2', 'R3', 'R4'] }[type];
  return `<svg class="bridge-svg" viewBox="0 0 300 220" role="img" aria-label="Bridge diagram"><path class="bridge-wire" d="M150 20 L40 110 L150 200 L260 110 Z M150 20 V0 M150 200 V220 M40 110 H95 M205 110 H260"/><circle class="bridge-detector" cx="150" cy="110" r="22"/><text x="150" y="115" text-anchor="middle" class="bridge-text">D</text>
    <text x="70" y="55" class="bridge-text" text-anchor="middle">Z1: ${esc(labels[0])}</text><text x="230" y="55" class="bridge-text" text-anchor="middle">Z2: ${esc(labels[1])}</text><text x="70" y="175" class="bridge-text" text-anchor="middle">Z3: ${esc(labels[2])}</text><text x="230" y="175" class="bridge-text" text-anchor="middle">Z4: ${esc(labels[3])}</text><text x="160" y="12" class="bridge-text">AC source</text></svg>`;
}
function renderMeasTab(config) {
  const c = config[config.tab];
  if (config.tab === 'bridge') {
    const info = BRIDGES[c.type];
    const arms = BRIDGE_ARMS[c.type];
    const units = (name) => (name.startsWith('C') ? 'F' : 'Ω');
    const hidden = c.mode === 'challenge';
    const unknownFields = hidden ? '' : info.measures === 'L' ? `${measField('bridge.lx', 'Hidden unknown Lx', c.lx, 'H')}${measField('bridge.rx', 'Hidden unknown Rx', c.rx, 'Ω')}` : info.measures === 'C' ? `${measField('bridge.cx', 'Hidden unknown Cx', c.cx, 'F')}${c.type === 'schering' ? measField('bridge.crx', 'Hidden unknown Rx (series)', c.crx, 'Ω') : ''}` : '';
    const controls = `${labSelect('data-meas-select', 'bridge.type', 'Bridge', c.type, Object.entries(BRIDGES).map(([id, b]) => [id, b.name]))}${c.type === 'wien' ? '' : `${labSelect('data-meas-select', 'bridge.mode', 'Mode', c.mode, [['practice', 'Practice (unknown shown)'], ['challenge', 'Challenge (unknown hidden)']])}${hidden ? '<button class="button" data-meas-new-unknown>New hidden unknown</button>' : ''}`}${c.type === 'wien' ? '' : measField('bridge.frequency', 'Source frequency', c.frequency, 'Hz')}${arms.map((name) => measField(`bridge.${name}`, `${name} (adjust to balance)`, c[name], units(name))).join('')}${unknownFields}`;
    const values = Object.fromEntries(arms.map((name) => [name, c[name]]));
    const solved = solveBridge(c.type, values, c.frequency);
    let detector = '';
    if (c.type !== 'wien') {
      const a = bridgeArms(c.type, c);
      const v = bridgeDetector(a.unknown, a.z2, a.z3, a.z4, c.vs);
      const mag = Math.hypot(v.re, v.im);
      const level = Math.min(1, Math.log10(1 + mag * 1e4) / 4);
      detector = `<div class="null-meter"><span class="panel-label">NULL DETECTOR</span><div class="null-bar"><i style="width:${(100 * level).toFixed(1)}%"></i></div><b>${eng(mag, 'V')}</b><small>${mag < 1e-4 * c.vs ? 'Balanced — read the unknown from the arms' : 'Not balanced — adjust the arms until the detector reads (almost) zero'}</small>${hidden && mag < 1e-3 * c.vs ? `<small>Hidden value was ${info.measures === 'L' ? `Lx = ${eng(bridgeUnknownValues(c).lx, 'H')}, Rx = ${eng(bridgeUnknownValues(c).rx, 'Ω')}` : `Cx = ${eng(bridgeUnknownValues(c).cx, 'F')}`} — well done.</small>` : ''}</div>`;
    }
    const answer = c.type === 'wien' ? `${readout('Balance frequency', eng(solved.frequency, 'Hz'))}${readout('Required R3/R4', fmt(solved.ratio, 6))}${readout('Detector at balance', eng(solved.detector, 'V'))}` : info.measures === 'L' ? `${readout('Lx from the arms (complex balance)', eng(solved.unknown.l ?? Number.NaN, 'H'))}${readout('Rx from the arms', eng(solved.unknown.r, 'Ω'))}${readout('Textbook formula', `Lx = ${eng(solved.closed.l, 'H')}, Rx = ${eng(solved.closed.r, 'Ω')}`)}${readout('Coil Q = ωL/R', fmt(solved.unknown.q, 5))}` : `${readout('Cx from the arms (complex balance)', eng(solved.unknown.c ?? Number.NaN, 'F'))}${readout('Rx (series)', eng(solved.unknown.r, 'Ω'))}${readout('Textbook formula', `Cx = ${eng(solved.closed.c, 'F')}${solved.closed.r !== undefined ? `, Rx = ${eng(solved.closed.r, 'Ω')}` : ''}`)}${solved.unknown.d !== undefined ? readout('Dissipation factor D', fmt(solved.unknown.d, 5)) : ''}`;
    const body = `<div class="power-grid"><div>${renderBridgeSchematic(c.type)}${detector}</div><div class="analysis-readouts">${readout('Arms', info.arms)}${readout('Balance condition', 'Z1·Z4 = Z2·Z3 (magnitude and angle)')}${readout('Formula', info.formula)}${answer}<p class="field-help">This is a virtual bridge: a hidden unknown sits in arm Z1 and the null detector shows the real off-balance voltage. Adjust the variable arms until the detector nulls, then read the unknown from the arm values — exactly as in the lab. The unknown is computed from the general complex balance, so you can check the textbook formula against it.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'lissajous') {
    const fig = lissajous({ fx: c.fx, fy: c.fy, ax: c.ax, ay: c.ay, phase: c.phase });
    const ext = Math.max(c.ax, c.ay) * 1.15;
    const controls = `${measField('lissajous.fx', 'X (horizontal) frequency', c.fx, 'Hz')}${measField('lissajous.fy', 'Y (vertical) frequency', c.fy, 'Hz')}${measField('lissajous.ax', 'X amplitude', c.ax, 'V')}${measField('lissajous.ay', 'Y amplitude', c.ay, 'V')}${measField('lissajous.phase', 'Phase of Y', c.phase, '°')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">CRO IN X–Y MODE</span>${renderComplexPlane({ label: 'Lissajous figure', extent: ext, curves: [{ points: fig.trace.map(([x, y]) => ({ re: x, im: y })), color: PLOT_COLORS[0] }] })}</div><div class="analysis-readouts">${readout('fy : fx', fig.ratio)}${readout('Tangencies', `${fig.horizontalTangencies} on a horizontal line, ${fig.verticalTangencies} on a vertical line`)}${readout('Rule', 'fy/fx = horizontal tangencies / vertical tangencies')}${fig.ellipse ? `${readout('Y-intercept / Y-max', `${fmt(fig.ellipse.intercept, 4)} / ${fmt(fig.ellipse.ymax, 4)}`)}${readout('Phase from sin φ = y0/ymax', `${fmt(fig.ellipse.phaseFromIntercept, 5)}° (or ${fmt(180 - fig.ellipse.phaseFromIntercept, 5)}°)`)}` : ''}<p class="field-help">With equal frequencies the figure is an ellipse: a line at 0° or 180°, a circle at 90° when the amplitudes are equal. For other ratios the pattern stands still only when the ratio is a simple fraction.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'errors') {
    const stats = readingStatistics(parseNumberList(c.readings, 'Readings'));
    const formula = ERROR_FORMULAS[c.formula];
    const combined = formula[1] ? combineErrors('product', [{ value: 1, error: c.e1 / 100, power: formula[1][0][1] }, { value: 1, error: c.e2 / 100, power: formula[1][1][1] }]) : combineErrors('sum', [{ value: 0, error: c.e1 }, { value: 0, error: c.e2 }]);
    const load = voltmeterLoading({ vs: c.vs, ra: c.ra, rb: c.rb, sensitivity: c.sensitivity, range: c.range });
    const controls = `${measText('errors.readings', 'Repeated readings', c.readings, 3)}${labSelect('data-meas-select', 'errors.formula', 'Result', c.formula, Object.entries(ERROR_FORMULAS).map(([id, f]) => [id, f[0]]))}${measField('errors.e1', formula[1] ? `Error in ${formula[1][0][0]} (±%)` : 'Error in R1 (±Ω)', c.e1)}${measField('errors.e2', formula[1] ? `Error in ${formula[1][1][0]} (±%)` : 'Error in R2 (±Ω)', c.e2)}${measField('errors.fsd', 'Meter accuracy (±% FSD)', c.fsd)}${measField('errors.fullScale', 'Full scale', c.fullScale)}${measField('errors.reading', 'Reading', c.reading)}${measField('errors.sensitivity', 'Voltmeter sensitivity', c.sensitivity, 'Ω/V')}${measField('errors.range', 'Voltmeter range', c.range, 'V')}${measField('errors.ra', 'Divider Ra', c.ra, 'Ω')}${measField('errors.rb', 'Divider Rb (measured)', c.rb, 'Ω')}${measField('errors.vs', 'Divider supply', c.vs, 'V')}`;
    const body = `<div class="power-grid"><div>${stemPlot('Deviation of each reading from the mean', stats.deviations, { color: PLOT_COLORS[2] })}${simpleTable(['#', 'Reading', 'Deviation d', 'd²'], stats.deviations.map((d, k) => [String(k + 1), fmt(stats.mean + d, 6), fmt(d, 4), fmt(d * d, 4)]))}</div>
      <div class="analysis-readouts">${readout('Arithmetic mean', fmt(stats.mean, 7))}${readout('Median, range', `${fmt(stats.median, 7)}, ${fmt(stats.range, 4)}`)}${readout('Average deviation', fmt(stats.averageDeviation, 5))}${readout('Standard deviation s (n − 1)', fmt(stats.sd, 5))}${readout('Probable error 0.6745·s', fmt(stats.probableError, 5))}${readout('Standard error of the mean s/√n', fmt(stats.standardError, 5))}${readout(`Limiting error of ${formula[0]}`, formula[1] ? `worst ±${fmt(100 * combined.worst, 4)} %, RSS ±${fmt(100 * combined.rss, 4)} %` : `worst ±${fmt(combined.worst, 4)} Ω, RSS ±${fmt(combined.rss, 4)} Ω`)}${readout('±% FSD as ±% of reading', `±${fmt(fullScaleToReading(c.fsd, c.fullScale, c.reading), 4)} %`)}${readout('Voltmeter loading', `true ${eng(load.trueV, 'V')}, meter reads ${eng(load.reading, 'V')} (${fmt(load.errorPercent, 4)} %), Rm = ${eng(load.meterResistance, 'Ω')}`)}<p class="field-help">For products and quotients relative errors add (times the power); for sums absolute errors add. Worst case assumes every error has its maximum value with the same sign; RSS is the statistical estimate. A meter's ±% FSD is a fixed number of units, so it becomes a large percentage near the bottom of the scale.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'meters') {
    const shunt = ammeterShunt({ im: c.im, rm: c.rm, range: c.range });
    const ayrton = ayrtonShunt({ im: c.im, rm: c.rm, ranges: parseNumberList(c.ranges, 'Ranges') });
    const volt = voltmeterMultiplier({ im: c.im, rm: c.rm, range: c.vrange });
    const ohm = seriesOhmmeter({ battery: c.battery, im: c.im, rm: c.rm, halfScale: c.halfScale });
    const rxs = Array.from({ length: 121 }, (_, k) => c.halfScale * 10 ** (-2 + 4 * k / 120));
    const controls = `${measField('meters.im', 'Movement full-scale current Im', c.im, 'A')}${measField('meters.rm', 'Movement resistance Rm', c.rm, 'Ω')}${measField('meters.range', 'Ammeter range', c.range, 'A')}${measText('meters.ranges', 'Ayrton ranges (A)', c.ranges)}${measField('meters.vrange', 'Voltmeter range', c.vrange, 'V')}${measField('meters.battery', 'Ohmmeter battery', c.battery, 'V')}${measField('meters.halfScale', 'Ohmmeter half-scale R', c.halfScale, 'Ω')}`;
    const body = `<div class="power-grid"><div>${linePlot('Series ohmmeter scale: deflection (fraction of FSD) against log10(Rx/Rh)', rxs.map((rx) => Math.log10(rx / c.halfScale)), [{ name: 'deflection', values: rxs.map((rx) => ohm.deflection(rx)) }], { xLabel: (x) => eng(c.halfScale * 10 ** x, 'Ω'), yMin: 0, yMax: 1 })}${simpleTable(['Range', 'Tap resistance', 'Section'], ayrton.ranges.map((range, k) => [eng(range, 'A'), eng(ayrton.taps[k], 'Ω'), eng(ayrton.sections[k], 'Ω')]))}</div>
      <div class="analysis-readouts">${readout('Ammeter shunt Rsh = Rm/(m − 1)', `${eng(shunt.shunt, 'Ω')} (m = ${fmt(shunt.multiplyingPower, 5)})`)}${readout('Ayrton total shunt', eng(ayrton.totalShunt, 'Ω'))}${readout('Voltmeter multiplier Rs = V/Im − Rm', eng(volt.multiplier, 'Ω'))}${readout('Voltmeter sensitivity 1/Im', `${eng(volt.sensitivity, 'Ω/V')}`)}${readout('Ohmmeter R1 (series), R2 (zero adjust)', `${eng(ohm.r1, 'Ω')}, ${eng(ohm.r2, 'Ω')}`)}<p class="field-help">The Ayrton shunt switches ranges without ever leaving the movement unprotected. The series ohmmeter scale is non-linear and reversed: zero ohms at full scale, half scale at Rx = Rh, infinity at zero deflection.</p></div></div>`;
    return { controls, body };
  }
  const q = qMeter({ f1: c.f1, c1: c.c1, c2: c.c2, indicatedQ: c.indicatedQ, shuntR: c.shuntR });
  const controls = `${measField('qmeter.f1', 'First resonance f1', c.f1, 'Hz')}${measField('qmeter.c1', 'Tuning C at f1', c.c1, 'F')}${measField('qmeter.c2', 'Tuning C at 2·f1', c.c2, 'F')}${measField('qmeter.indicatedQ', 'Indicated Q', c.indicatedQ)}${measField('qmeter.shuntR', 'Insertion (shunt) resistance', c.shuntR, 'Ω')}`;
  return { controls, body: `<div class="analysis-readouts">${readout('Distributed capacitance Cd = (C1 − 4C2)/3', eng(q.distributedC, 'F'))}${readout('Coil inductance', eng(q.inductance, 'H'))}${readout('True Q = Qind(1 + Cd/C1)', fmt(q.trueQ, 5))}${readout('Coil series resistance ωL/Q', eng(q.coilResistance, 'Ω'))}${readout('Q corrected for the insertion resistance', fmt(q.correctedForShunt, 5))}<p class="field-help">The Q-meter resonates the coil with a calibrated capacitor and reads Q = Vc/Vin. The coil's own self-capacitance adds to the tuning capacitor, so it is measured by resonating at f1 and 2f1: (C2 + Cd) = (C1 + Cd)/4.</p></div>` };
}
export function renderMeasurement(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'measure'), 'ELECTRONIC MEASUREMENTS & INSTRUMENTATION', '')}${labCard('meas', 'Measurements', MEAS_TABS, measLab.configuration(state), renderMeasTab)}</div>`;
}
export function bindMeasurementEvents() {
  bindLabControls('meas', measLab, ['type', 'formula', 'mode']);
  document.querySelectorAll('[data-meas-new-unknown]').forEach((button) => button.addEventListener('click', () => measLab.persist((config) => { config.bridge.seed = (config.bridge.seed % 9973) + 1; })));
  bindLabText('meas', measLab);
}
