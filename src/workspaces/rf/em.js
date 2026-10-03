// Electromagnetics & Microwave workspace. Entry points: renderEm(state); bindEmEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { niceRange } from '../../core/circuit-plot.js';
import { amplifierStability, cascade, chargeField, circularWaveguide, fieldMap, fresnel, fresnelCurve, fromPolar, gaussFlux, planeWave, polarization, rectangularModePattern, rectangularWaveguide, sToZ, sweepCascade, TWO_PORT_ELEMENTS } from '../../../packages/em/src/index.mjs';
import { complexText, eng, fmt } from '../../shared/formatting.js';
import { engineeringInput } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderComplexPlane, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';
import { renderSmithChart } from '../../components/smith-chart.js';

const EM_TABS = [['charges', 'Charges & fields'], ['wave', 'Plane waves & skin depth'], ['interface', 'Reflection & polarisation'], ['waveguide', 'Waveguides'], ['sparams', 'S-parameter networks'], ['amplifier', 'Amplifier stability']];
const EM_MEDIA = { free: ['Free space', 1, 1, 0], copper: ['Copper', 1, 1, 5.8e7], aluminium: ['Aluminium', 1, 1, 3.5e7], seawater: ['Sea water', 81, 1, 4], soil: ['Dry soil', 3, 1, 1e-4], fr4: ['FR-4 (tan δ ≈ 0.02 at 1 GHz)', 4.4, 1, 4.9e-3], custom: ['Custom', null, null, null] };
const EM_NETWORKS = {
  lowpass: ['3rd-order Butterworth low-pass, 1 GHz', 'series-l 7.958n\nshunt-c 6.366p\nseries-l 7.958n', 0.1e9, 3e9, 1e9],
  bandpass: ['Shorted λ/4-stub band-pass, 1 GHz', 'short-stub 50 74.95m 1\nline 50 74.95m 1\nshort-stub 50 74.95m 1', 0.2e9, 1.8e9, 1e9],
  quarter: ['Quarter-wave line 70.7 Ω (100 Ω seen at port 1)', 'line 70.71 74.95m 1', 0.2e9, 2e9, 1e9],
  pad: ['6 dB attenuator + 50 Ω line', 'attenuator 6\nline 50 100m 0.66', 0.1e9, 2e9, 1e9],
};
const emLab = makeLab('em-lab', {
  tab: 'charges',
  charges: { list: '3 -3 0\n-2 3 1\n1 1 -4', probeX: 0, probeY: 2, gaussRadius: 4 },
  wave: { medium: 'copper', frequency: 1e6, epsR: 1, muR: 1, sigma: 5.8e7 },
  interface: { n1: 1, n2: 1.5, angle: 45, ex: 1, ey: 1, phase: -90 },
  waveguide: { shape: 'rect', a: 22.86, b: 10.16, radius: 10, epsR: 1, frequency: 10e9, sigma: 5.8e7, mode: 'TE10' },
  sparams: { preset: 'lowpass', z0: 50, elements: EM_NETWORKS.lowpass[1], start: 0.1e9, stop: 3e9, frequency: 1e9 },
  amplifier: { s11m: 0.61, s11a: -170, s12m: 0.05, s12a: 16, s21m: 2.24, s21a: 32, s22m: 0.51, s22a: -67 },
});
const emField = groupField('data-em-field');
const emText = (path, label, value, rows = 0) => (rows ? `<label class="em-text">${label}<textarea rows="${rows}" spellcheck="false" data-em-text="${path}">${esc(value)}</textarea></label>` : `<label>${label}<input type="text" spellcheck="false" data-em-text="${path}" value="${esc(value)}"></label>`);
const angleText = (value) => `${fmt(value, 4)}°`;
const polarText = (z) => `${fmt(Math.hypot(z.re, z.im), 4)} ∠ ${fmt(Math.atan2(z.im, z.re) * 180 / Math.PI, 4)}°`;
const matrixTable = (title, m, format = polarText) => `<table class="truth-table comm-table power-table em-matrix"><thead><tr><th colspan="2">${title}</th></tr></thead><tbody>${m.map((row) => `<tr>${row.map((value) => `<td>${esc(format(value))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const circlePoints = (center, radius, count = 120) => Array.from({ length: count + 1 }, (_, k) => ({ re: center.re + radius * Math.cos(2 * Math.PI * k / count), im: center.im + radius * Math.sin(2 * Math.PI * k / count) }));
function parseCharges(text) {
  const charges = String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const values = line.split(/[\s,]+/).map(Number);
    if (values.length < 3 || values.some((value) => !Number.isFinite(value))) throw new RangeError(`Charge line ${index + 1}: enter "q(nC) x(cm) y(cm)".`);
    return { q: values[0] * 1e-9, x: values[1] / 100, y: values[2] / 100 };
  });
  if (!charges.length || charges.length > 8) throw new RangeError('Enter 1 to 8 charges.');
  return charges;
}
function renderChargeMap(charges, c) {
  const xMin = -0.1, xMax = 0.1, yMin = -0.075, yMax = 0.075, columns = 64, rows = 48, width = 480, height = 360;
  const map = fieldMap(charges, { xMin, xMax, yMin, yMax, columns, rows, linesPerCharge: 14 });
  const sx = (x) => ((x - xMin) / (xMax - xMin) * width).toFixed(1), sy = (y) => ((yMax - y) / (yMax - yMin) * height).toFixed(1);
  const values = map.potential.flat().map(Math.abs).filter(Number.isFinite).sort((p, q) => p - q);
  const scale = values[Math.floor(values.length * 0.9)] || 1;
  const cells = map.potential.flatMap((row, r) => row.map((v, col) => {
    const t = Math.tanh(v / scale), alpha = Math.min(0.85, Math.abs(t));
    return `<rect x="${(col * width / columns).toFixed(1)}" y="${(r * height / rows).toFixed(1)}" width="${(width / columns + 0.5).toFixed(1)}" height="${(height / rows + 0.5).toFixed(1)}" fill="${t >= 0 ? '#ef4444' : '#3b82f6'}" fill-opacity="${alpha.toFixed(2)}"/>`;
  })).join('');
  const lines = map.lines.map((line) => `<path class="em-line" d="${line.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(y)}`).join('')}"/>`).join('');
  const marks = charges.map((q) => `<circle class="em-charge ${q.q >= 0 ? 'pos' : 'neg'}" cx="${sx(q.x)}" cy="${sy(q.y)}" r="9"/><text class="em-charge-label" x="${sx(q.x)}" y="${(Number(sy(q.y)) + 4).toFixed(1)}" text-anchor="middle">${q.q >= 0 ? '+' : '−'}</text>`).join('');
  const probe = `<circle class="em-probe" cx="${sx(c.probeX / 100)}" cy="${sy(c.probeY / 100)}" r="4"/>`;
  const gauss = `<circle class="em-gauss" cx="${sx(0)}" cy="${sy(0)}" r="${(c.gaussRadius / 100 / (xMax - xMin) * width).toFixed(1)}"/>`;
  return `<svg class="em-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="Potential map and field lines">${cells}${lines}${gauss}${marks}${probe}</svg>`;
}
function renderEmTab(config) {
  const c = config[config.tab];
  if (config.tab === 'charges') {
    const charges = parseCharges(c.list);
    const probe = chargeField(charges, c.probeX / 100, c.probeY / 100);
    const gauss = gaussFlux(charges, { radius: c.gaussRadius / 100 });
    const controls = `${emText('charges.list', 'Charges: q (nC), x (cm), y (cm) per line', c.list, 4)}${emField('charges.probeX', 'Probe x', c.probeX, 'cm')}${emField('charges.probeY', 'Probe y', c.probeY, 'cm')}${emField('charges.gaussRadius', 'Gauss sphere radius', c.gaussRadius, 'cm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">POTENTIAL (RED +, BLUE −) AND FIELD LINES IN THE z = 0 PLANE, 20 cm × 15 cm</span>${renderChargeMap(charges, c)}</div>
      <div class="analysis-readouts">${readout('|E| at the probe', eng(probe.magnitude, 'V/m'))}${readout('E direction', angleText(Math.atan2(probe.ey, probe.ex) * 180 / Math.PI))}${readout('Ex, Ey', `${eng(probe.ex, 'V/m')}, ${eng(probe.ey, 'V/m')}`)}${readout('Potential V at the probe', eng(probe.v, 'V'))}${readout('Charge inside the Gauss sphere', eng(gauss.enclosed, 'C'))}${readout('Flux ∮E·dA (4000-point quadrature)', `${fmt(gauss.flux, 6)} V·m`)}${readout('Q_enc / ε₀', `${fmt(gauss.expected, 6)} V·m`)}<p class="field-help">E and V are the superposition of kq/r² and kq/r from every charge (k = 1/4πε₀). The dashed circle is the Gauss sphere centred at the origin: the numerically integrated flux equals the enclosed charge divided by ε₀, whatever the charges outside do.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'wave') {
    const wave = planeWave({ frequency: c.frequency, epsR: c.epsR, muR: c.muR, sigma: c.sigma });
    const depth = Number.isFinite(wave.skinDepth) ? Math.min(4 * wave.skinDepth, 3 * wave.wavelength) : 3 * wave.wavelength;
    const zs = Array.from({ length: 600 }, (_, k) => depth * k / 599);
    const envelope = zs.map((z) => Math.exp(-wave.alpha * z));
    const frequencies = Array.from({ length: 121 }, (_, k) => 10 ** (1 + k * 0.075));
    const logDepth = frequencies.map((f) => Math.log10(planeWave({ frequency: f, epsR: c.epsR, muR: c.muR, sigma: c.sigma }).skinDepth));
    const controls = `${labSelect('data-em-select', 'wave.medium', 'Medium', c.medium, Object.entries(EM_MEDIA).map(([id, entry]) => [id, entry[0]]))}${emField('wave.frequency', 'Frequency', c.frequency, 'Hz')}${emField('wave.epsR', 'εr', c.epsR)}${emField('wave.muR', 'μr', c.muR)}${emField('wave.sigma', 'σ', c.sigma, 'S/m')}`;
    const body = `<div class="power-grid"><div>${linePlot('E(z) at t = 0 and its envelope e^(−αz) (z in metres)', zs, [{ name: 'E(z, 0)', values: zs.map((z, k) => envelope[k] * Math.cos(wave.beta * z)) }, { name: 'envelope', values: envelope, color: '#64748b', dashed: true }], { xLabel: (x) => eng(x, 'm') })}${c.sigma > 0 ? renderPlotFrame({ title: 'Skin depth δ against frequency (log–log)', series: [{ xs: frequencies, ys: logDepth, color: PLOT_COLORS[2], primary: true }], xMin: 10, xMax: frequencies.at(-1), logX: true, xTicks: [1, 3, 5, 7, 9].map((p) => ({ position: (p - 1) / 9, text: eng(10 ** p, 'Hz') })), yRange: niceRange(Math.min(...logDepth), Math.max(...logDepth)), formatY: (value) => eng(10 ** value, 'm') }) : ''}</div>
      <div class="analysis-readouts">${readout('Regime (σ/ωε)', `${wave.regime}, loss tangent ${fmt(wave.lossTangent, 4)}`)}${readout('Attenuation α', `${fmt(wave.alpha, 5)} Np/m = ${fmt(wave.alphaDbPerMetre, 5)} dB/m`)}${readout('Phase constant β', `${fmt(wave.beta, 5)} rad/m`)}${readout('Intrinsic impedance η', `${fmt(wave.etaMagnitude, 5)} ∠ ${fmt(wave.etaAngle, 4)}° Ω`)}${readout('Wavelength in the medium', eng(wave.wavelength, 'm'))}${readout('Phase velocity', eng(wave.phaseVelocity, 'm/s'))}${readout('Skin depth δ = 1/α', Number.isFinite(wave.skinDepth) ? eng(wave.skinDepth, 'm') : '∞ (lossless)')}${wave.surfaceResistance ? readout('Surface resistance Rs', eng(wave.surfaceResistance, 'Ω')) : ''}<p class="field-help">γ = √(jωμ(σ + jωε)) = α + jβ and η = √(jωμ/(σ + jωε)) with no approximation, so the same numbers hold for a perfect dielectric, a good conductor (η at 45°, δ = 1/√(πfμσ)) and anything in between.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'interface') {
    const r = fresnel({ n1: c.n1, n2: c.n2, angle: c.angle });
    const curve = fresnelCurve(c.n1, c.n2, 181);
    const pol = polarization({ ex: c.ex, ey: c.ey, phase: c.phase });
    const peak = Math.max(Math.abs(c.ex), Math.abs(c.ey), 1e-9);
    const controls = `${emField('interface.n1', 'n₁ (incident side)', c.n1)}${emField('interface.n2', 'n₂', c.n2)}${emField('interface.angle', 'Angle of incidence', c.angle, '°')}${emField('interface.ex', 'Polarisation Ex', c.ex)}${emField('interface.ey', 'Ey', c.ey)}${emField('interface.phase', 'Phase of Ey relative to Ex', c.phase, '°')}`;
    const body = `<div class="power-grid"><div>${linePlot('Reflectance against angle of incidence (degrees)', curve.angles, [{ name: 'Rs (TE, ⊥)', values: curve.Rs }, { name: 'Rp (TM, ∥)', values: curve.Rp }], { xLabel: (x) => `${fmt(x, 3)}°`, yMin: 0, yMax: 1 })}
      <span class="panel-label">POLARISATION ELLIPSE (WAVE COMING TOWARD YOU, +z)</span>${renderComplexPlane({ label: 'Polarisation ellipse', extent: peak * 1.2, curves: [{ points: pol.trace.map(([x, y]) => ({ re: x, im: y })), color: PLOT_COLORS[0] }], marks: [{ re: pol.trace[0][0], im: pol.trace[0][1] }, { re: pol.trace[8][0], im: pol.trace[8][1] }] })}</div>
      <div class="analysis-readouts">${readout('Transmitted angle (Snell)', r.tir ? 'none — total internal reflection' : angleText(r.transmittedAngle))}${readout('rs, rp', `${polarText(r.rs)}, ${polarText(r.rp)}`)}${readout('Rs, Rp (power)', `${fmt(r.Rs, 5)}, ${fmt(r.Rp, 5)}`)}${readout('Ts, Tp (power)', `${fmt(r.Ts, 5)}, ${fmt(r.Tp, 5)}`)}${readout('Brewster angle (Rp = 0)', angleText(r.brewster))}${readout('Critical angle', r.critical === null ? 'none (n₁ ≤ n₂)' : angleText(r.critical))}${readout('Polarisation', `${pol.kind}${pol.sense ? `, ${pol.sense} (IEEE)` : ''}`)}${readout('Axial ratio', Number.isFinite(pol.axialRatio) ? `${fmt(pol.axialRatio, 4)} (${fmt(pol.axialRatioDb, 4)} dB)` : '∞ (linear)')}${readout('Tilt of the major axis', angleText(pol.tilt))}<p class="field-help">Rs + Ts = 1 and Rp + Tp = 1 at every angle. The squares on the ellipse mark the field at ωt = 0 and a moment later, so you can see the rotation sense.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'waveguide') {
    const rect = c.shape === 'rect';
    const guide = rect ? rectangularWaveguide({ a: c.a / 1000, b: c.b / 1000, epsR: c.epsR, frequency: c.frequency, sigma: c.sigma || null }) : circularWaveguide({ radius: c.radius / 1000, epsR: c.epsR, frequency: c.frequency });
    const modes = guide.modes.slice(0, 10);
    const selected = modes.find((mode) => mode.name === c.mode) ?? guide.dominant;
    const fMax = Math.max(c.frequency * 1.5, modes[4].cutoff * 1.2);
    const fs = Array.from({ length: 300 }, (_, k) => fMax * k / 299);
    const v = 299792458 / Math.sqrt(c.epsR);
    const dispersion = modes.slice(0, 5).map((mode) => ({ name: mode.name, values: fs.map((f) => (f > mode.cutoff ? 2 * Math.PI * f / v * Math.sqrt(1 - (mode.cutoff / f) ** 2) : 0)) }));
    let pattern = '';
    if (rect) {
      const cols = 24, rowsCount = Math.max(4, Math.round(24 * c.b / c.a)), w = 480, h = Math.round(480 * c.b / c.a);
      const cells = rectangularModePattern(selected, c.a, c.b, cols, rowsCount);
      const cw = w / cols, ch = h / rowsCount;
      pattern = `<span class="panel-label">TRANSVERSE E FIELD OF ${selected.name} (COLOUR |E|, ARROWS DIRECTION)</span><svg class="em-map" viewBox="-4 -4 ${w + 8} ${h + 8}">${cells.map((cell, i) => { const x = (i % cols) * cw, y = h - (Math.floor(i / cols) + 1) * ch; const len = 0.45 * Math.min(cw, ch) * cell.magnitude, angle = Math.atan2(-cell.ey, cell.ex); const cx = x + cw / 2, cy = y + ch / 2; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cw + 0.5).toFixed(1)}" height="${(ch + 0.5).toFixed(1)}" fill="#f97316" fill-opacity="${(0.85 * cell.magnitude).toFixed(2)}"/>${len > 1 ? `<path class="em-arrow" d="M${(cx - len * Math.cos(angle)).toFixed(1)} ${(cy - len * Math.sin(angle)).toFixed(1)}L${(cx + len * Math.cos(angle)).toFixed(1)} ${(cy + len * Math.sin(angle)).toFixed(1)}"/>` : ''}`; }).join('')}<rect class="em-wall" x="0" y="0" width="${w}" height="${h}"/></svg>`;
    }
    const rows = modes.map((mode) => `<tr class="${mode.name === selected.name ? 'active' : ''}"><td>${mode.name}</td><td>${eng(mode.cutoff, 'Hz')}</td><td>${mode.propagating ? 'yes' : 'no'}</td><td>${mode.propagating ? eng(mode.guideWavelength, 'm') : '—'}</td><td>${mode.propagating ? eng(mode.impedance, 'Ω') : '—'}</td><td>${mode.propagating ? '0' : fmt(mode.attenuationDbPerMetre, 4)}</td></tr>`).join('');
    const controls = `${labSelect('data-em-select', 'waveguide.shape', 'Cross-section', c.shape, [['rect', 'Rectangular'], ['circ', 'Circular']])}${rect ? `${emField('waveguide.a', 'Width a', c.a, 'mm')}${emField('waveguide.b', 'Height b', c.b, 'mm')}` : emField('waveguide.radius', 'Radius', c.radius, 'mm')}${emField('waveguide.epsR', 'Filling εr', c.epsR)}${emField('waveguide.frequency', 'Frequency', c.frequency, 'Hz')}${rect ? emField('waveguide.sigma', 'Wall σ (0 = perfect)', c.sigma, 'S/m') : ''}${labSelect('data-em-select', 'waveguide.mode', 'Show mode', selected.name, modes.map((mode) => [mode.name, mode.name]))}`;
    const body = `<div class="power-grid"><div>${linePlot('Phase constant β (rad/m) against frequency — the dispersion diagram', fs, dispersion, { xLabel: (x) => eng(x, 'Hz') })}${pattern}</div>
      <div><div class="analysis-readouts">${readout('Dominant mode', `${guide.dominant.name}, cut-off ${eng(guide.dominant.cutoff, 'Hz')}`)}${readout('Single-mode band', `${eng(guide.singleModeBand[0], 'Hz')} – ${eng(guide.singleModeBand[1], 'Hz')}`)}${readout(`${selected.name} at ${eng(c.frequency, 'Hz')}`, selected.propagating ? `λg = ${eng(selected.guideWavelength, 'm')}, vp = ${eng(selected.phaseVelocity, 'm/s')}, vg = ${eng(selected.groupVelocity, 'm/s')}` : `evanescent, α = ${fmt(selected.attenuationDbPerMetre, 4)} dB/m`)}${selected.propagating ? readout(`Wave impedance Z_${selected.kind}`, eng(selected.impedance, 'Ω')) : ''}${guide.conductorLoss ? readout('TE10 wall loss (Pozar 3.96)', `${fmt(guide.conductorLoss.dbPerMetre, 4)} dB/m (Rs = ${eng(guide.conductorLoss.surfaceResistance, 'Ω')})`) : ''}</div>
      <table class="truth-table comm-table power-table"><thead><tr><th>Mode</th><th>Cut-off</th><th>Propagates</th><th>λg</th><th>Z</th><th>α dB/m</th></tr></thead><tbody>${rows}</tbody></table><p class="field-help">${rect ? 'fc = (c/2√εr)·√((m/a)² + (n/b)²); TE needs m or n > 0, TM needs both.' : 'fc = c·x/(2πa√εr) with x a zero of Jn (TM) or Jn′ (TE); TE11 is dominant.'} The conductor loss agrees with scikit-rf.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'sparams') {
    const elements = parseTwoPortElements(c.elements);
    const sweep = sweepCascade(elements, { start: c.start, stop: c.stop, points: 241, z0: c.z0 });
    const at = cascade(elements, c.frequency, c.z0);
    let z = null;
    try { z = sToZ(at.s, c.z0); if (z.flat().some((value) => !Number.isFinite(value.re))) z = null; } catch { z = null; }
    const controls = `${labSelect('data-em-select', 'sparams.preset', 'Example', c.preset, [...Object.entries(EM_NETWORKS).map(([id, entry]) => [id, entry[0]]), ['custom', 'Custom']])}${emText('sparams.elements', 'Elements, port 1 → port 2', c.elements, 6)}${emField('sparams.z0', 'Reference Z0', c.z0, 'Ω')}${emField('sparams.start', 'Sweep from', c.start, 'Hz')}${emField('sparams.stop', 'to', c.stop, 'Hz')}${emField('sparams.frequency', 'Spot frequency', c.frequency, 'Hz')}`;
    const floor = Math.max(-80, Math.min(...sweep.s11Db, ...sweep.s21Db));
    const body = `<div class="power-grid"><div>${linePlot('|S11| and |S21| in dB', sweep.frequencies, [{ name: '|S11|', values: sweep.s11Db.map((value) => Math.max(value, floor)) }, { name: '|S21|', values: sweep.s21Db.map((value) => Math.max(value, floor)) }], { xLabel: (x) => eng(x, 'Hz'), yMax: 0.5 })}<span class="panel-label">S11 ON THE SMITH CHART (DOT = SPOT FREQUENCY)</span>${renderSmithChart({ label: 'S11', traces: [{ points: sweep.s.map((s) => s[0][0]), color: PLOT_COLORS[0] }], points: [{ gamma: at.s[0][0], color: '#f59e0b', text: eng(c.frequency, 'Hz') }] })}</div>
      <div><div class="analysis-readouts">${readout('Return loss', `${fmt(at.returnLoss, 4)} dB (VSWR ${Number.isFinite(at.vswr) ? fmt(at.vswr, 4) : '∞'})`)}${readout('Insertion loss', `${fmt(at.insertionLoss, 4)} dB`)}${readout('Reciprocal (S12 = S21)', at.reciprocal ? 'yes' : 'no')}${readout('Lossless (S unitary)', at.lossless ? 'yes' : 'no')}</div>${matrixTable('S (mag ∠ deg)', at.s)}${matrixTable('ABCD', at.abcd, complexText)}${z ? matrixTable('Z (Ω)', z, complexText) : '<p class="field-help">Z does not exist for this network (e.g. a bare series element).</p>'}
      <p class="field-help">One element per line: <code>series-r|series-l|series-c value</code>, <code>shunt-r|shunt-l|shunt-c value</code>, <code>line Zc length vf [dB/m]</code>, <code>open-stub|short-stub Zc length vf</code>, <code>attenuator dB</code>. Values take k, m, µ/u, n, p. The chain is multiplied as ABCD matrices and converted to S; cascades, conversions and stub/line models agree with scikit-rf.</p></div></div>`;
    return { controls, body };
  }
  const s = [[fromPolar(c.s11m, c.s11a), fromPolar(c.s12m, c.s12a)], [fromPolar(c.s21m, c.s21a), fromPolar(c.s22m, c.s22a)]];
  const st = amplifierStability(s);
  const controls = ['11', '12', '21', '22'].map((ij) => `${emField(`amplifier.s${ij}m`, `|S${ij}|`, c[`s${ij}m`])}${emField(`amplifier.s${ij}a`, `∠S${ij}`, c[`s${ij}a`], '°')}`).join('');
  const smithPoints = st.match ? [{ gamma: st.match.gammaS, color: '#22c55e', text: 'ΓS' }, { gamma: st.match.gammaL, color: '#f59e0b', text: 'ΓL' }] : [];
  const body = `<div class="power-grid"><div><span class="panel-label">STABILITY CIRCLES: INPUT (BLUE, ΓS PLANE) AND OUTPUT (ORANGE, ΓL PLANE)</span>${renderSmithChart({ label: 'Stability circles', traces: [{ points: circlePoints(st.input.center, st.input.radius), color: PLOT_COLORS[0] }, { points: circlePoints(st.output.center, st.output.radius), color: '#f97316' }], points: smithPoints })}</div>
    <div class="analysis-readouts">${readout('Rollett K', fmt(st.k, 5))}${readout('|Δ| = |S11S22 − S12S21|', fmt(st.deltaMagnitude, 5))}${readout('μ (Edwards–Sinsky)', fmt(st.mu, 5))}${readout('Stability', st.unconditional ? 'unconditionally stable (K > 1, |Δ| < 1)' : 'potentially unstable — keep ΓS, ΓL in the stable regions')}${readout('Maximum available gain', st.maxGainDb === null ? '— (needs K > 1)' : `${fmt(st.maxGainDb, 4)} dB`)}${readout('Maximum stable gain |S21/S12|', `${fmt(st.maxStableGainDb, 4)} dB`)}${readout('Unilateral transducer gain (max)', `${fmt(st.unilateralGainDb, 4)} dB`)}${readout('Input circle', `centre ${polarText(st.input.center)}, r = ${fmt(st.input.radius, 4)}, stable ${st.input.stableInside ? 'inside' : 'outside'}`)}${readout('Output circle', `centre ${polarText(st.output.center)}, r = ${fmt(st.output.radius, 4)}, stable ${st.output.stableInside ? 'inside' : 'outside'}`)}${st.match ? readout('Simultaneous conjugate match', `ΓS = ${polarText(st.match.gammaS)}, ΓL = ${polarText(st.match.gammaL)}`) : ''}<p class="field-help">K, MAG and MSG agree with scikit-rf. With the conjugate-match ΓL, Γin equals ΓS* — the definition of the match.</p></div></div>`;
  return { controls, body };
}
function parseTwoPortElements(text) {
  const elements = String(text).split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line, index) => {
    const [type, ...rest] = line.split(/\s+/);
    if (!TWO_PORT_ELEMENTS[type]) throw new RangeError(`Line ${index + 1}: unknown element "${type}".`);
    const numbers = rest.map((token) => engineeringInput(token, `Line ${index + 1}`));
    if (type === 'line' || type.endsWith('stub')) {
      if (numbers.length < 2) throw new RangeError(`Line ${index + 1}: ${type} needs Zc and length.`);
      return { type, z0: numbers[0], length: numbers[1], vf: numbers[2] ?? 1, lossDbPerMetre: numbers[3] ?? 0 };
    }
    if (numbers.length !== 1) throw new RangeError(`Line ${index + 1}: ${type} needs one value.`);
    return { type, value: numbers[0] };
  }).filter((element) => !(element.type === 'shunt-c' && element.value === 0));
  if (!elements.length) throw new RangeError('Add at least one element.');
  return elements;
}
export function renderEm(state) {
  const config = emLab.configuration(state);
  let view;
  try { view = renderEmTab(config); } catch (error) { view = { controls: '', body: labError('em', 'EM & microwave', error) }; }
  return `<div class="page scroll-page power-page sigsys-page em-page">${pageHeader(modules.find((item) => item.id === 'em'), 'ELECTROMAGNETICS & MICROWAVE', '')}${labTabs(EM_TABS, config.tab, 'data-em-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindEmEvents() {
  bindLabControls('em', emLab, ['medium', 'shape', 'mode', 'preset']);
  document.querySelectorAll('[data-em-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.emText.split('.'); emLab.persist((config) => { config[group][key] = input.value; if (group === 'sparams') config.sparams.preset = 'custom'; }); }));
  document.querySelectorAll('[data-em-select="wave.medium"]').forEach((select) => select.addEventListener('change', () => {
    const medium = EM_MEDIA[select.value];
    if (medium?.[1] !== null) emLab.persist((config) => { [config.wave.epsR, config.wave.muR, config.wave.sigma] = medium.slice(1); });
  }));
  document.querySelectorAll('[data-em-select="sparams.preset"]').forEach((select) => select.addEventListener('change', () => {
    const preset = EM_NETWORKS[select.value];
    if (preset) emLab.persist((config) => { config.sparams.elements = preset[1]; config.sparams.start = preset[2]; config.sparams.stop = preset[3]; config.sparams.frequency = preset[4]; });
  }));
  document.querySelectorAll('[data-em-field^="wave."]').forEach((input) => input.addEventListener('change', () => { if (input.dataset.emField !== 'wave.frequency') emLab.persist((config) => { config.wave.medium = 'custom'; }); }));
}

// ---------------------------------------------------------------------------
// Shared helpers for the Phase 9 labs.

// ---------------------------------------------------------------------------
// Information theory, source coding and spread spectrum.
