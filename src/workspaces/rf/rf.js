// RF Lab workspace. Entry points: renderRf(state); bindRfLabEvents().
import { getState, notify, recordExperiment, setState } from '../../core/store.js';
import { coaxImpedance, ELEMENT_PATTERNS, freeSpacePathLossDb, linearArray, linkBudget, lMatch, microstrip, microstripWidth, parseTouchstone, quarterWaveMatch, reflection, singleStubMatch, SPEED_OF_LIGHT, transmissionLine, twinLeadImpedance } from '../../../packages/rf/src/index.mjs';
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { decadeTicks, niceRange } from '../../core/circuit-plot.js';
import { cdiv, cexp, complex, cscale } from '../../../packages/numerics/src/index.mjs';
import { eng, finiteEng, fmt } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { labField, labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { renderSmithChart } from '../../components/smith-chart.js';

const RF_DEFAULTS = Object.freeze({
  tab: 'touchstone', loadRe: 100, loadIm: 50, z0: 50, frequency: '100M', lineLength: 0.3, lineLoss: 0, velocityFactor: 0.66,
  msHeight: 1.6, msEr: 4.4, msZ0: 50, msWidth: 3, coaxInner: 0.9, coaxOuter: 2.95, coaxEr: 2.25, twinSpacing: 10, twinDiameter: 1,
  elements: 8, spacing: 0.5, steer: 90, element: 'isotropic',
  linkFrequency: '2.4G', linkDistance: '1k', txPower: 20, txGain: 2, rxGain: 2, txLoss: 1, rxLoss: 1, otherLoss: 0, linkBandwidth: '1M', noiseFigure: 6, requiredSnr: 10,
});
const RF_TABS = [['touchstone', 'Touchstone S-parameters'], ['smith', 'Smith chart & matching'], ['line', 'Transmission lines'], ['antenna', 'Antenna arrays'], ['link', 'Link budget']];
const RF_TEXT_FIELDS = ['frequency', 'element', 'linkFrequency', 'linkDistance', 'linkBandwidth'];
function rfConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'rf-lab')?.inputs || {};
  return { ...RF_DEFAULTS, ...saved };
}
function persistRf(patch) {
  recordExperiment({ id: 'rf-lab', kind: 'rf', operation: 'rf-lab', inputs: { ...rfConfiguration(getState()), ...patch } });
}
const rfField = (...args) => labField('data-rf-lab-field', ...args);
const engText = 'type="text" spellcheck="false" maxlength="24"';
const impedanceText = (z) => `${fmt(z.re, 4)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im), 4)} Ω`;
function renderTouchstoneTab(state) {
  const result = state.simulation?.kind === 'rf' ? state.simulation.data : null;
  const s11 = result?.points?.map((point) => point.values[0]).filter(Boolean) || [];
  const gammas = s11.map((value) => complex(value.real, value.imaginary));
  const first = s11[0];
  return `<section class="dsp-card"><div class="dsp-controls"><label>Ports<input type="number" min="1" max="8" step="1" data-rf-field="ports" value="2"></label><button class="button run" data-action="parse-rf">Parse Touchstone</button></div><label class="rf-input-label">Touchstone text<textarea data-rf-field="text" rows="8" spellcheck="false" placeholder="# MHz S RI R 50\n1 1 0 0 0 0 0 0 0"></textarea></label>
    <div class="rf-result-grid"><div><span class="panel-label">S11 SMITH VIEW</span>${renderSmithChart({ label: 'S11 Smith chart', traces: gammas.length > 1 ? [{ points: gammas, color: PLOT_COLORS[0] }] : [], points: gammas.map((gamma, index) => ({ gamma, color: index === 0 ? '#f59e0b' : PLOT_COLORS[0], radius: index === 0 ? 4.5 : 2.5 })) })}</div><div><div class="stat-grid"><div><span>Ports</span><strong>${result?.ports ?? '—'}</strong><small>S-parameters</small></div><div><span>Reference</span><strong>${result ? fmt(result.referenceImpedance, 3) : '—'}</strong><small>Ω</small></div><div><span>Points</span><strong>${result?.points.length ?? '—'}</strong><small>${result?.frequencyUnit || 'frequency'}</small></div><div><span>S11 magnitude</span><strong>${first ? fmt(Math.hypot(first.real, first.imaginary), 3) : '—'}</strong><small>linear</small></div><div><span>S11 phase</span><strong>${first ? fmt(Math.atan2(first.imaginary, first.real) * 180 / Math.PI, 2) : '—'}</strong><small>degrees</small></div></div></div></div><p class="module-footnote">Parsed locally with bounded RI/MA/DB conversion. The first point is highlighted; no QucsatorRF, openEMS or network hardware is invoked.</p></section>`;
}
const elementText = (element) => (element.kind === 'none' ? 'none' : `${element.kind} ${eng(element.value, element.unit)}`);
const loadControls = (config) => `${rfField('loadRe', 'Load R', config.loadRe, 'Ω')}${rfField('loadIm', 'Load X', config.loadIm, 'Ω')}${rfField('z0', 'Z0', config.z0, 'Ω')}`;
function renderSmithTab(config) {
  const controls = `<div class="dsp-controls">${loadControls(config)}${rfField('frequency', 'Frequency', config.frequency, 'Hz (e.g. 100M)', engText)}</div>`;
  let body;
  try {
    const load = complex(Number(config.loadRe), Number(config.loadIm));
    const z0 = Number(config.z0);
    const frequency = engineeringInput(config.frequency, 'Frequency');
    const r = reflection(load, z0);
    const admittance = cdiv(complex(1), load);
    let lBlock, stubBlock, quarterBlock;
    try {
      const match = lMatch(load, z0, frequency);
      lBlock = `<table class="truth-table comm-table"><thead><tr><th>#</th><th>Topology (load → source)</th><th>Next to load</th><th>Toward source</th><th>Check Zin</th></tr></thead><tbody>${match.solutions.map((solution, index) => `<tr><td>${index + 1}</td><td>${solution.topology === 'shunt-at-load' ? 'shunt then series' : 'series then shunt'}</td><td>${solution.topology === 'shunt-at-load' ? `shunt ${elementText(solution.shunt)}` : `series ${elementText(solution.series)}`}</td><td>${solution.topology === 'shunt-at-load' ? `series ${elementText(solution.series)}` : `shunt ${elementText(solution.shunt)}`}</td><td>${impedanceText(solution.inputImpedance)}</td></tr>`).join('')}</tbody></table>`;
      stubBlock = `<table class="truth-table comm-table"><thead><tr><th>#</th><th>Stub position d from load</th><th>Open-stub length</th><th>Short-stub length</th></tr></thead><tbody>${singleStubMatch(load, z0).map((stub, index) => `<tr><td>${index + 1}</td><td>${fmt(stub.distance, 4)} λ</td><td>${fmt(stub.openStub, 4)} λ</td><td>${fmt(stub.shortStub, 4)} λ</td></tr>`).join('')}</tbody></table>`;
      const qw = quarterWaveMatch(load, z0);
      quarterBlock = `<div class="analysis-readouts comm-readouts">${readout('Line before transformer', `${fmt(qw.offset, 4)} λ`)}${readout('Impedance there', `${fmt(qw.realImpedance, 4)} Ω`)}${readout('Quarter-wave section Z1', `${fmt(qw.transformerImpedance, 4)} Ω`)}</div>`;
    } catch (error) { lBlock = `<div class="diagnostic warning"><b>Matching</b><span>${esc(error.message)}</span></div>`; stubBlock = ''; quarterBlock = ''; }
    const wavelength = SPEED_OF_LIGHT / frequency;
    body = `<div class="filter-lower"><div><span class="panel-label">SMITH CHART (normalised to Z0)</span>${renderSmithChart({ label: 'Smith chart with load', points: [{ gamma: r.gamma, color: '#f59e0b', text: 'ZL' }], traces: [{ points: Array.from({ length: 121 }, (_, k) => cscale(cexp(complex(0, 2 * Math.PI * k / 120)), r.magnitude)), color: '#94a3b855' }] })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Normalised z', `${fmt(r.normalized.re, 4)} ${r.normalized.im < 0 ? '−' : '+'} j${fmt(Math.abs(r.normalized.im), 4)}`)}${readout('Admittance Y', `${eng(admittance.re, 'S')} ${admittance.im < 0 ? '−' : '+'} j${eng(Math.abs(admittance.im), 'S')}`)}${readout('Γ', `${fmt(r.magnitude, 4)} ∠ ${fmt(r.angle, 2)}°`)}${readout('VSWR', Number.isFinite(r.vswr) ? fmt(r.vswr, 4) : '∞')}${readout('Return loss', Number.isFinite(r.returnLossDb) ? `${fmt(r.returnLossDb, 2)} dB` : '∞')}${readout('Mismatch loss', Number.isFinite(r.mismatchLossDb) ? `${fmt(r.mismatchLossDb, 3)} dB` : '∞')}${readout('Power delivered', `${fmt(r.powerDelivered * 100, 2)} %`)}${readout('Wavelength (free space)', eng(wavelength, 'm'))}</div>
      <span class="panel-label">LUMPED L-NETWORK MATCH AT ${esc(eng(frequency, 'Hz'))}</span>${lBlock}
      <span class="panel-label">SINGLE SHUNT-STUB MATCH</span>${stubBlock}
      <span class="panel-label">QUARTER-WAVE TRANSFORMER</span>${quarterBlock}</div></div>
      <p class="module-footnote">Matching follows Pozar, Microwave Engineering, §5.1–5.4; every L-network solution is checked by computing its input impedance. The faint circle is the constant-VSWR circle.</p>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Smith chart</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}</section>`;
}
function renderLineTab(config) {
  const controls = `<div class="dsp-controls">${loadControls(config)}${rfField('lineLength', 'Length', config.lineLength, 'wavelengths')}${rfField('lineLoss', 'Loss', config.lineLoss, 'dB per λ')}${rfField('frequency', 'Frequency', config.frequency, 'Hz', engText)}${rfField('velocityFactor', 'Velocity factor', config.velocityFactor, '', 'type="number" min="0.05" max="1" step="0.01"')}</div>`;
  let body;
  try {
    const line = transmissionLine({ load: { re: Number(config.loadRe), im: Number(config.loadIm) }, z0: Number(config.z0), length: Number(config.lineLength), lossDbPerWavelength: Number(config.lineLoss) });
    const frequency = engineeringInput(config.frequency, 'Frequency');
    const guided = SPEED_OF_LIGHT * bounded01(config.velocityFactor) / frequency;
    const distances = line.trace.map((point) => point.d);
    const voltages = line.trace.map((point) => point.voltage);
    const standing = renderPlotFrame({ title: '|V| along the line (load at 0 λ)', series: [{ xs: distances, ys: voltages, color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: Math.max(distances.at(-1), 1e-9), xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: `${fmt(distances.at(-1) * k / 5, 3)} λ` })), yRange: niceRange(0, Math.max(...voltages)), formatY: (value) => fmt(value, 2) });
    body = `<div class="filter-lower"><div><span class="panel-label">Γ FROM LOAD (●) TO INPUT (■)</span>${renderSmithChart({ label: 'Line on the Smith chart', traces: [{ points: line.trace.map((point) => point.gamma), color: PLOT_COLORS[0] }], points: [{ gamma: line.reflection.gamma, color: '#f59e0b', text: 'ZL' }, { gamma: line.trace.at(-1).gamma, color: '#fb7185', text: 'Zin' }] })}</div>
      <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Input impedance Zin', impedanceText(line.inputImpedance))}${readout('VSWR at the load', Number.isFinite(line.reflection.vswr) ? fmt(line.reflection.vswr, 4) : '∞')}${readout('First voltage maximum', line.firstMaximum === null ? 'flat line (matched)' : `${fmt(line.firstMaximum, 4)} λ from load`)}${readout('First voltage minimum', line.firstMinimum === null ? '—' : `${fmt(line.firstMinimum, 4)} λ from load`)}${readout('Guided wavelength', eng(guided, 'm'))}${readout('Physical length', eng(guided * line.length, 'm'))}</div>${standing}</div></div>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Transmission line</b><span>${esc(error.message)}</span></div>`; }
  let calculators;
  try {
    const analysis = microstrip({ width: Number(config.msWidth), height: Number(config.msHeight), permittivity: Number(config.msEr) });
    const synthesis = microstripWidth({ impedance: Number(config.msZ0), height: Number(config.msHeight), permittivity: Number(config.msEr) });
    const coax = coaxImpedance({ inner: Number(config.coaxInner), outer: Number(config.coaxOuter), permittivity: Number(config.coaxEr) });
    const twin = twinLeadImpedance({ spacing: Number(config.twinSpacing), diameter: Number(config.twinDiameter) });
    calculators = `<div class="calc-grid"><div class="coding-block"><span class="panel-label">MICROSTRIP</span><div class="dsp-controls">${rfField('msHeight', 'Substrate h', config.msHeight, 'mm')}${rfField('msEr', 'εr', config.msEr)}${rfField('msWidth', 'Trace width W', config.msWidth, 'mm')}${rfField('msZ0', 'Target Z0', config.msZ0, 'Ω')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0 for this width', `${fmt(analysis.impedance, 4)} Ω`)}${readout('Effective εr', fmt(analysis.effectivePermittivity, 4))}${readout(`Width for ${fmt(Number(config.msZ0), 4)} Ω`, `${fmt(synthesis.width, 4)} mm`)}${readout('Velocity factor', fmt(analysis.velocityFactor, 4))}</div></div>
      <div class="coding-block"><span class="panel-label">COAXIAL LINE</span><div class="dsp-controls">${rfField('coaxInner', 'Inner d', config.coaxInner, 'mm')}${rfField('coaxOuter', 'Outer D', config.coaxOuter, 'mm')}${rfField('coaxEr', 'εr', config.coaxEr)}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0', `${fmt(coax.impedance, 4)} Ω`)}${readout('Velocity factor', fmt(coax.velocityFactor, 4))}${readout('TE11 cutoff (approx.)', eng(coax.cutoffFrequency, 'Hz'))}</div></div>
      <div class="coding-block"><span class="panel-label">TWIN-LEAD (AIR)</span><div class="dsp-controls">${rfField('twinSpacing', 'Spacing', config.twinSpacing, 'mm')}${rfField('twinDiameter', 'Wire diameter', config.twinDiameter, 'mm')}</div>
      <div class="analysis-readouts comm-readouts">${readout('Z0', `${fmt(twin.impedance, 4)} Ω`)}</div></div></div>`;
  } catch (error) { calculators = `<div class="diagnostic error"><b>Line calculators</b><span>${esc(error.message)}</span></div>`; }
  return `<section class="dsp-card">${controls}${body}${calculators}<p class="module-footnote">Microstrip uses the Hammerstad-Jensen closed form (thin, lossless strip, quasi-static); coax and twin-lead use the ideal TEM formulas.</p></section>`;
}
function bounded01(value) { const number = Number(value); if (!(number > 0 && number <= 1)) throw new RangeError('Velocity factor must be between 0 and 1.'); return number; }
function renderPolarPattern(result) {
  const size = 320, c = size / 2, radius = 140, floor = -40;
  const rOf = (db) => Math.max(0, (db - floor) / -floor) * radius;
  const rings = [0, -10, -20, -30].map((db) => `<circle cx="${c}" cy="${c}" r="${rOf(db).toFixed(1)}"/><text x="${c + 3}" y="${(c - rOf(db) + 10).toFixed(1)}">${db} dB</text>`).join('');
  const spokes = Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return `<line x1="${c}" y1="${c}" x2="${(c + radius * Math.sin(a)).toFixed(1)}" y2="${(c - radius * Math.cos(a)).toFixed(1)}"/>`; }).join('');
  const labels = [0, 30, 60, 90, 120, 150, 180].map((deg) => { const a = deg * Math.PI / 180; return `<text x="${(c + (radius + 10) * Math.sin(a) - 8).toFixed(1)}" y="${(c - (radius + 10) * Math.cos(a) + 3).toFixed(1)}">${deg}°</text>`; }).join('');
  const half = (sign) => result.theta.map((deg, k) => { const a = deg * Math.PI / 180, r = rOf(result.decibels[k]); return `${k ? 'L' : 'M'}${(c + sign * r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`; }).join('');
  return `<svg class="pz-plot polar-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radiation pattern"><g class="polar-grid">${rings}${spokes}</g><g class="pz-axis-label">${labels}</g><path class="polar-trace" d="${half(1)}"/><path class="polar-trace" d="${half(-1)}"/><line class="array-axis" x1="${c}" y1="${c - radius - 4}" x2="${c}" y2="${c + radius + 4}"/></svg>`;
}
function renderAntennaTab(config) {
  const controls = `<div class="dsp-controls">${rfField('elements', 'Elements N', config.elements, '', 'type="number" min="1" max="64" step="1"')}${rfField('spacing', 'Spacing d', config.spacing, 'wavelengths', 'type="number" min="0.05" max="5" step="0.05"')}${rfField('steer', 'Beam direction', config.steer, '° from array axis (90 = broadside)', 'type="number" min="0" max="180" step="5"')}${labSelect('data-rf-lab-field', 'element', 'Element', config.element, Object.entries(ELEMENT_PATTERNS))}</div>`;
  let result;
  try { result = linearArray({ elements: Number(config.elements), spacing: Number(config.spacing), steer: Number(config.steer), element: config.element }); }
  catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Antenna array</b><span>${esc(error.message)}</span></div></section>`; }
  const rectangular = renderPlotFrame({ title: 'Normalised pattern (dB) vs θ', series: [{ xs: result.theta, ys: result.decibels.map((value) => Math.max(value, -50)), color: PLOT_COLORS[0], primary: true }, { xs: [0, 180], ys: [-3, -3], color: '#94a3b8', dashed: true }], xMin: 0, xMax: 180, xTicks: Array.from({ length: 7 }, (_, k) => ({ position: k / 6, text: `${k * 30}°` })), yRange: niceRange(-50, 0), formatY: (value) => `${fmt(value, 0)} dB` });
  return `<section class="dsp-card">${controls}
    <div class="filter-lower"><div><span class="panel-label">POLAR PATTERN (array axis vertical, rotationally symmetric)</span>${renderPolarPattern(result)}</div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Directivity', `${fmt(result.directivity, 4)} (${fmt(result.directivityDbi, 2)} dBi)`)}${readout('Main beam', `${fmt(result.mainBeam, 1)}°`)}${readout('Half-power beamwidth', result.beamwidth === null ? '—' : `${fmt(result.beamwidth, 2)}°`)}${readout('Highest sidelobe', result.sidelobeDb === null ? 'none' : `${fmt(result.sidelobeDb, 2)} dB`)}${readout('Progressive phase β', `${fmt(Math.abs(result.progressivePhase) < 1e-9 ? 0 : result.progressivePhase, 2)}°`)}${readout('Array length', `${fmt((result.elements - 1) * result.spacing, 3)} λ`)}${result.radiationResistance ? readout('Element radiation resistance', `${fmt(result.radiationResistance, 4)} Ω`) : ''}</div>
    ${result.gratingLobes ? '<div class="diagnostic warning"><b>Grating lobes</b><span>The spacing is large enough for extra full-strength beams; keep d &lt; λ / (1 + |cos θ0|).</span></div>' : ''}${rectangular}</div></div>
    <p class="module-footnote">Uniform amplitude array factor × element pattern for collinear elements along the axis; mutual coupling is ignored. Directivity is integrated numerically over the sphere.</p></section>`;
}
function renderLinkTab(config) {
  const controls = `<div class="dsp-controls">${rfField('linkFrequency', 'Frequency', config.linkFrequency, 'Hz', engText)}${rfField('linkDistance', 'Distance', config.linkDistance, 'm', engText)}${rfField('txPower', 'Tx power', config.txPower, 'dBm')}${rfField('txGain', 'Tx antenna gain', config.txGain, 'dBi')}${rfField('rxGain', 'Rx antenna gain', config.rxGain, 'dBi')}${rfField('txLoss', 'Tx cable loss', config.txLoss, 'dB')}${rfField('rxLoss', 'Rx cable loss', config.rxLoss, 'dB')}${rfField('otherLoss', 'Other losses / fade', config.otherLoss, 'dB')}${rfField('linkBandwidth', 'Bandwidth', config.linkBandwidth, 'Hz', engText)}${rfField('noiseFigure', 'Rx noise figure', config.noiseFigure, 'dB')}${rfField('requiredSnr', 'Required SNR', config.requiredSnr, 'dB')}</div>`;
  let budget, options;
  try {
    options = { frequency: engineeringInput(config.linkFrequency, 'Frequency'), distance: engineeringInput(config.linkDistance, 'Distance'), txPowerDbm: Number(config.txPower), txGainDbi: Number(config.txGain), rxGainDbi: Number(config.rxGain), txLossDb: Number(config.txLoss), rxLossDb: Number(config.rxLoss), otherLossDb: Number(config.otherLoss), bandwidth: engineeringInput(config.linkBandwidth, 'Bandwidth'), noiseFigureDb: Number(config.noiseFigure), requiredSnrDb: Number(config.requiredSnr) };
    budget = linkBudget(options);
  } catch (error) { return `<section class="dsp-card">${controls}<div class="diagnostic error"><b>Link budget</b><span>${esc(error.message)}</span></div></section>`; }
  const first = budget.distance / 100, last = budget.distance * 100;
  const distances = Array.from({ length: 200 }, (_, k) => first * (last / first) ** (k / 199));
  const received = distances.map((d) => budget.receivedDbm - (freeSpacePathLossDb(d, budget.frequency) - budget.fspl));
  const xTicks = decadeTicks(first, last).map((d) => ({ position: (Math.log10(d) - Math.log10(first)) / (Math.log10(last) - Math.log10(first)), text: eng(d, 'm') }));
  const plot = renderPlotFrame({ title: 'Received power (teal) vs distance; sensitivity (grey)', series: [{ xs: distances, ys: received, color: PLOT_COLORS[0], primary: true }, { xs: [first, last], ys: [budget.sensitivityDbm, budget.sensitivityDbm], color: '#94a3b8', dashed: true }], xMin: first, xMax: last, logX: true, xTicks, yRange: niceRange(Math.min(...received, budget.sensitivityDbm), Math.max(...received)), formatY: (value) => `${fmt(value, 0)} dBm` });
  const rows = [['Transmitter power', options.txPowerDbm], ['Tx cable loss', -options.txLossDb], ['Tx antenna gain', options.txGainDbi], ['= EIRP', budget.eirpDbm], ['Free-space path loss', -budget.fspl], ['Other losses / fade', -options.otherLossDb], ['Rx antenna gain', options.rxGainDbi], ['Rx cable loss', -options.rxLossDb], ['= Received power', budget.receivedDbm]];
  return `<section class="dsp-card">${controls}
    <div class="filter-lower"><div><span class="panel-label">BUDGET</span><table class="truth-table comm-table budget-table"><tbody>${rows.map(([name, value]) => `<tr class="${name.startsWith('=') ? 'budget-total' : ''}"><td>${name}</td><td>${Math.abs(value) < 1e-12 ? '0' : `${value > 0 && !name.startsWith('=') ? '+' : ''}${fmt(value, 2)}`} ${name.startsWith('=') || name === 'Transmitter power' ? 'dBm' : 'dB'}</td></tr>`).join('')}</tbody></table></div>
    <div class="comm-side"><div class="analysis-readouts comm-readouts">${readout('Received power', `${fmt(budget.receivedDbm, 2)} dBm (${eng(budget.receivedWatts, 'W')})`)}${readout('Noise floor kTB + NF', `${fmt(budget.noiseFloorDbm, 2)} dBm`)}${readout('SNR', `${fmt(budget.snrDb, 2)} dB`)}${readout('Sensitivity', `${fmt(budget.sensitivityDbm, 2)} dBm`)}${readout('Link margin', `${fmt(budget.marginDb, 2)} dB${budget.marginDb < 0 ? ' — link fails' : ''}`)}${readout('Range at 0 dB margin', finiteEng(budget.maxRange, 'm'))}${readout('Wavelength', eng(budget.wavelength, 'm'))}${readout('1st Fresnel zone radius (mid-path)', eng(budget.fresnelRadius, 'm'))}${readout('Shannon capacity', `${eng(budget.shannonCapacity, 'bit/s')}`)}</div>${plot}</div></div>
    <p class="module-footnote">Free-space Friis propagation with thermal noise at 290 K. Real links also need terrain, multipath and rain-fade allowances — put them in "Other losses".</p></section>`;
}
export function renderRf(state) {
  const config = rfConfiguration(state);
  const body = config.tab === 'smith' ? renderSmithTab(config) : config.tab === 'line' ? renderLineTab(config) : config.tab === 'antenna' ? renderAntennaTab(config) : config.tab === 'link' ? renderLinkTab(config) : renderTouchstoneTab(state);
  return `<div class="page scroll-page rf-page">${pageHeader(modules.find((item) => item.id === 'rf'), 'BUILT-IN RF LAB', '<span class="pill live"><i></i> LOCAL COMPUTATION</span>')}
    ${labTabs(RF_TABS, config.tab, 'data-rf-tab')}${body}</div>`;
}
function bindRfLabEvents() {
  document.querySelectorAll('[data-rf-tab]').forEach((button) => button.addEventListener('click', () => persistRf({ tab: button.dataset.rfTab })));
  document.querySelectorAll('[data-rf-lab-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.rfLabField;
    const text = RF_TEXT_FIELDS.includes(name);
    const value = text ? field.value.trim() : Number(field.value);
    if (!text && !Number.isFinite(value)) { notify('Enter a number', 'error'); return; }
    persistRf({ [name]: value });
  }));
}

export function bindRfEvents() {
  bindRfLabEvents();
  const saved = getState().project.experiments.find((experiment) => experiment?.id === 'rf-touchstone')?.inputs || {};
  const rfText = document.querySelector('[data-rf-field="text"]');
  const rfPorts = document.querySelector('[data-rf-field="ports"]');
  if (saved.text && rfText) rfText.value = saved.text;
  if (Number.isInteger(saved.ports) && rfPorts) rfPorts.value = String(saved.ports);
  document.querySelector('[data-action="parse-rf"]')?.addEventListener('click', () => {
    const text = document.querySelector('[data-rf-field="text"]')?.value || ''; const ports = Number(document.querySelector('[data-rf-field="ports"]')?.value);
    try { const normalizedPorts = Number.isInteger(ports) ? ports : 2; const data = parseTouchstone(text, { ports: normalizedPorts }); recordExperiment({ id: 'rf-touchstone', kind: 'rf', operation: 'touchstone-parse', inputs: { text, ports: normalizedPorts } }); setState({ simulation: { kind: 'rf', data } }); notify('Touchstone data parsed', 'success'); }
    catch (error) { notify(error.message, 'error'); }
  });
}
