// Radar & Satellite workspace. Entry points: renderRadar(state); bindRadarEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { apertureAntenna, combineCn, dipolePattern, directionalCoupler, directivity, doppler, fmcw, friisLink, gOverT, halfPowerBeamwidth, lookAngles, magnetron, orbit, orbitTrace, pulseRadar, R_EARTH, radarRange, reflexKlystron, satelliteLink, vswrMeasurement } from '../../../packages/radarsat/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderComplexPlane } from '../../components/plots.js';
import { groupField } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const RADAR_TABS = [['radar', 'Radar range'], ['doppler', 'Doppler, MTI & FMCW'], ['orbit', 'Orbits & look angles'], ['link', 'Satellite link'], ['antenna', 'Antennas'], ['tubes', 'Microwave tubes & tests']];
const radarLab = makeLab('radar-lab', {
  tab: 'radar',
  radar: { pt: 1e6, gainDb: 40, frequency: 3e9, rcs: 1, bandwidth: 1e6, noiseFigureDb: 3, snrDb: 13, lossDb: 3, pulses: 1, prf: 1000, pulseWidth: 1e-6 },
  doppler: { frequency: 10e9, velocity: 30, prf: 1000, sweepBandwidth: 150e6, sweepTime: 1e-3, beat: 50e3 },
  orbit: { perigee: 35786e3, apogee: 35786e3, latitude: 18.52, longitude: 73.86, satelliteLongitude: 83 },
  link: { upEirp: 75, upFrequency: 6e9, satGt: -2, downEirp: 38, downFrequency: 4e9, esGain: 45, antennaNoise: 30, feedLoss: 0.3, lnaNoise: 50, distance: 38000e3, bandwidth: 36e6, otherLoss: 1 },
  antenna: { length: 0.5, frequency: 10e9, diameter: 1, efficiency: 0.55, ptDbm: 20, gt: 10, gr: 10, distance: 1000, linkFrequency: 2.4e9 },
  tubes: { v0: 300, frequency: 9e9, spacing: 1e-3, mv0: 26e3, b0: 0.336, a: 0.05, b: 0.1, p1: 1, p2: 0.89, p3: 0.01, p4: 1e-5, vmax: 2, vmin: 1 },
});
const radarField = groupField('data-radar-field');
function polarPattern(label, angles, field) {
  const size = 300, c0 = size / 2, r0 = 130;
  const full = [...angles.map((a, k) => [a, field[k]]), ...angles.slice(1).reverse().map((a, k) => [360 - a, field[angles.length - 2 - k]])];
  const path = full.map(([a, v], k) => { const t = a * Math.PI / 180; return `${k ? 'L' : 'M'}${(c0 + r0 * v * Math.sin(t)).toFixed(1)} ${(c0 - r0 * v * Math.cos(t)).toFixed(1)}`; }).join('') + 'Z';
  const rings = [0.25, 0.5, Math.SQRT1_2, 1].map((r) => `<circle class="unit-circle" cx="${c0}" cy="${c0}" r="${(r0 * r).toFixed(1)}"${r === Math.SQRT1_2 ? ' stroke-dasharray="3 3"' : ''}/>`).join('');
  return `<svg class="pz-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">${rings}<path class="axis" d="M${c0} 10V${size - 10}M10 ${c0}H${size - 10}"/><path class="pz-curve" stroke="${PLOT_COLORS[0]}" fill="${PLOT_COLORS[0]}" fill-opacity="0.15" d="${path}"/><text class="pz-axis-label" x="${c0 + 4}" y="18">θ = 0° (antenna axis)</text></svg>`;
}
function renderRadarTab(config) {
  const c = config[config.tab];
  if (config.tab === 'radar') {
    const r = radarRange(c), p = pulseRadar({ prf: c.prf, pulseWidth: c.pulseWidth, pt: c.pt });
    const ranges = Array.from({ length: 200 }, (_, k) => r.rmax * 0.1 + r.rmax * 1.9 * k / 199);
    const controls = `${radarField('radar.pt', 'Peak power Pt', c.pt, 'W')}${radarField('radar.gainDb', 'Antenna gain', c.gainDb, 'dB')}${radarField('radar.frequency', 'Frequency', c.frequency, 'Hz')}${radarField('radar.rcs', 'Target RCS σ', c.rcs, 'm²')}${radarField('radar.bandwidth', 'Receiver bandwidth', c.bandwidth, 'Hz')}${radarField('radar.noiseFigureDb', 'Noise figure', c.noiseFigureDb, 'dB')}${radarField('radar.snrDb', 'Required SNR', c.snrDb, 'dB')}${radarField('radar.lossDb', 'System losses', c.lossDb, 'dB')}${radarField('radar.pulses', 'Pulses integrated', c.pulses)}${radarField('radar.prf', 'PRF', c.prf, 'Hz')}${radarField('radar.pulseWidth', 'Pulse width', c.pulseWidth, 's')}`;
    const body = `<div class="power-grid"><div>${linePlot('Received SNR (dB) against target range — the line crosses the threshold at Rmax', ranges, [{ name: 'SNR', values: ranges.map(r.snrAt) }, { name: 'threshold', values: ranges.map(() => c.snrDb), color: '#f59e0b', dashed: true }], { xLabel: (x) => eng(x, 'm') })}</div>
      <div class="analysis-readouts">${readout('Maximum range Rmax', eng(r.rmax, 'm'))}${readout('Wavelength', eng(r.lambda, 'm'))}${readout('Noise power kT0BF', `${fmt(r.noisePowerDbm, 5)} dBm`)}${readout('Minimum detectable signal', `${fmt(r.sminDbm, 5)} dBm`)}${readout('Unambiguous range c/2PRF', eng(p.unambiguousRange, 'm'))}${readout('Range resolution cτ/2', eng(p.rangeResolution, 'm'))}${readout('Duty cycle, average power', `${fmt(100 * p.duty, 4)} %, ${eng(p.averagePower, 'W')}`)}${readout('Blind (minimum) range', eng(p.minimumRange, 'm'))}<p class="field-help">R⁴ law: doubling the range needs 16 × the power. Integrating n pulses coherently adds 10·log n dB of SNR. A target beyond c/2PRF returns after the next pulse and appears at a false, shorter range.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'doppler') {
    const d = doppler({ frequency: c.frequency, velocity: c.velocity, prf: c.prf });
    const f = fmcw({ bandwidth: c.sweepBandwidth, sweepTime: c.sweepTime, beat: c.beat, frequency: c.frequency });
    const vs = Array.from({ length: 400 }, (_, k) => 4 * d.firstBlind * k / 399);
    const controls = `${radarField('doppler.frequency', 'Carrier frequency', c.frequency, 'Hz')}${radarField('doppler.velocity', 'Radial velocity (+ approaching)', c.velocity, 'm/s')}${radarField('doppler.prf', 'PRF', c.prf, 'Hz')}${radarField('doppler.sweepBandwidth', 'FMCW sweep bandwidth', c.sweepBandwidth, 'Hz')}${radarField('doppler.sweepTime', 'Sweep time', c.sweepTime, 's')}${radarField('doppler.beat', 'Measured beat frequency', c.beat, 'Hz')}`;
    const body = `<div class="power-grid"><div>${linePlot('Single-delay MTI canceller response |H| = 2|sin(π fd/PRF)| against target speed', vs, [{ name: '|H|', values: vs.map((v) => doppler({ frequency: c.frequency, velocity: v, prf: c.prf }).cancellerGain) }], { xLabel: (x) => eng(x, 'm/s'), yMin: 0, yMax: 2 })}</div>
      <div class="analysis-readouts">${readout('Doppler shift fd = 2v/λ', eng(d.fd, 'Hz'))}${readout('Blind speeds n·λ·PRF/2', d.blindSpeeds.map((v) => eng(v, 'm/s')).join(', '))}${readout('Canceller gain at this speed', fmt(d.cancellerGain, 4))}${readout('FMCW slope B/T', eng(f.slope, 'Hz/s'))}${readout('FMCW range R = c·fb/(2·slope)', eng(f.range, 'm'))}${readout('FMCW range resolution c/2B', eng(f.rangeResolution, 'm'))}<p class="field-help">The MTI filter cancels fixed clutter (fd = 0) but also any target whose Doppler is a multiple of the PRF — the blind speeds. Staggered PRFs move the blind speeds apart.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'orbit') {
    const o = orbit({ perigeeAltitude: c.perigee, apogeeAltitude: c.apogee });
    const look = lookAngles({ latitude: c.latitude, longitude: c.longitude, satelliteLongitude: c.satelliteLongitude });
    const trace = orbitTrace(o, 240);
    const ext = Math.max(...trace.flat().map(Math.abs)) * 1.1;
    const earth = Array.from({ length: 73 }, (_, k) => ({ re: R_EARTH * Math.cos(k * Math.PI / 36), im: R_EARTH * Math.sin(k * Math.PI / 36) }));
    const controls = `${radarField('orbit.perigee', 'Perigee altitude', c.perigee, 'm')}${radarField('orbit.apogee', 'Apogee altitude', c.apogee, 'm')}${radarField('orbit.latitude', 'Earth-station latitude (N +)', c.latitude, '°')}${radarField('orbit.longitude', 'Earth-station longitude (E +)', c.longitude, '°')}${radarField('orbit.satelliteLongitude', 'GEO satellite longitude', c.satelliteLongitude, '°')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">ORBIT TO SCALE (EARTH SHADED)</span>${renderComplexPlane({ label: 'Orbit', extent: ext, curves: [{ points: earth, color: '#38bdf8' }, { points: trace.map(([x, y]) => ({ re: x, im: y })), color: PLOT_COLORS[0] }] })}</div>
      <div class="analysis-readouts">${readout('Semi-major axis a', eng(o.a, 'm'))}${readout('Eccentricity', fmt(o.e, 5))}${readout('Period T = 2π√(a³/μ)', `${fmt(o.period / 3600, 6)} h`)}${readout('Speed at perigee / apogee', `${eng(o.perigeeSpeed, 'm/s')} / ${eng(o.apogeeSpeed, 'm/s')}`)}${readout('Geostationary radius', eng(o.geostationaryRadius, 'm'))}${readout('Look angles to the GEO satellite', look.visible ? `azimuth ${fmt(look.azimuth, 5)}°, elevation ${fmt(look.elevation, 5)}°` : 'below the horizon — not visible')}${readout('Slant range', eng(look.slantRange, 'm'))}${readout('Central angle γ', `${fmt(look.centralAngle, 5)}°`)}<p class="field-help">Kepler's third law gives the period from a alone. A satellite at 35 786 km above the equator turns with the Earth (one sidereal day), so a dish can stay fixed. Azimuth is measured from true north; from India GEO satellites sit to the south.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'link') {
    const up = satelliteLink({ eirpDbw: c.upEirp, frequency: c.upFrequency, distance: c.distance, gtDb: c.satGt, otherLossDb: c.otherLoss, bandwidth: c.bandwidth });
    const gt = gOverT({ antennaGainDb: c.esGain, antennaNoise: c.antennaNoise, feedLossDb: c.feedLoss, lnaNoise: c.lnaNoise });
    const down = satelliteLink({ eirpDbw: c.downEirp, frequency: c.downFrequency, distance: c.distance, gtDb: gt.gtDb, otherLossDb: c.otherLoss, bandwidth: c.bandwidth });
    const total = combineCn(up.cn, down.cn);
    const controls = `${radarField('link.upEirp', 'Uplink EIRP', c.upEirp, 'dBW')}${radarField('link.upFrequency', 'Uplink frequency', c.upFrequency, 'Hz')}${radarField('link.satGt', 'Satellite G/T', c.satGt, 'dB/K')}${radarField('link.downEirp', 'Satellite EIRP', c.downEirp, 'dBW')}${radarField('link.downFrequency', 'Downlink frequency', c.downFrequency, 'Hz')}${radarField('link.esGain', 'Earth-station antenna gain', c.esGain, 'dB')}${radarField('link.antennaNoise', 'Antenna noise temperature', c.antennaNoise, 'K')}${radarField('link.feedLoss', 'Feed loss', c.feedLoss, 'dB')}${radarField('link.lnaNoise', 'LNA noise temperature', c.lnaNoise, 'K')}${radarField('link.distance', 'Slant range', c.distance, 'm')}${radarField('link.bandwidth', 'Transponder bandwidth', c.bandwidth, 'Hz')}${radarField('link.otherLoss', 'Atmospheric + pointing loss', c.otherLoss, 'dB')}`;
    const rows = [['EIRP', `${fmt(c.upEirp, 4)} dBW`, `${fmt(c.downEirp, 4)} dBW`], ['Free-space loss', `${fmt(up.fspl, 5)} dB`, `${fmt(down.fspl, 5)} dB`], ['Other losses', `${fmt(c.otherLoss, 3)} dB`, `${fmt(c.otherLoss, 3)} dB`], ['Receiver G/T', `${fmt(c.satGt, 4)} dB/K`, `${fmt(gt.gtDb, 4)} dB/K`], ['− Boltzmann', '228.6 dB', '228.6 dB'], ['C/N0', `${fmt(up.cn0, 5)} dBHz`, `${fmt(down.cn0, 5)} dBHz`], ['− 10 log B', `${fmt(10 * Math.log10(c.bandwidth), 5)} dB`, `${fmt(10 * Math.log10(c.bandwidth), 5)} dB`], ['C/N', `${fmt(up.cn, 5)} dB`, `${fmt(down.cn, 5)} dB`]];
    const body = `<div class="power-grid"><div>${simpleTable(['Item', 'Uplink', 'Downlink'], rows)}</div><div class="analysis-readouts">${readout('Earth-station Tsys', eng(gt.tsys, 'K'))}${readout('Earth-station G/T', `${fmt(gt.gtDb, 5)} dB/K`)}${readout('Overall C/N (1/C/N = 1/up + 1/down)', `${fmt(total, 5)} dB`)}<p class="field-help">C/N0 = EIRP − path loss + G/T − 10 log k. The weaker link dominates the overall C/N; the satellite's small antenna and limited power usually make the downlink the weak one.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'antenna') {
    const pattern = dipolePattern(c.length, 721);
    const d = directivity(pattern.field, pattern.angles), hp = halfPowerBeamwidth(pattern.field, pattern.angles);
    const ap = apertureAntenna({ frequency: c.frequency, diameter: c.diameter, efficiency: c.efficiency });
    const fr = friisLink({ ptDbm: c.ptDbm, gtDb: c.gt, grDb: c.gr, frequency: c.linkFrequency, distance: c.distance });
    const controls = `${radarField('antenna.length', 'Dipole length (wavelengths)', c.length)}${radarField('antenna.frequency', 'Dish frequency', c.frequency, 'Hz')}${radarField('antenna.diameter', 'Dish diameter', c.diameter, 'm')}${radarField('antenna.efficiency', 'Aperture efficiency', c.efficiency)}${radarField('antenna.ptDbm', 'Friis: Pt', c.ptDbm, 'dBm')}${radarField('antenna.gt', 'Gt', c.gt, 'dBi')}${radarField('antenna.gr', 'Gr', c.gr, 'dBi')}${radarField('antenna.linkFrequency', 'Link frequency', c.linkFrequency, 'Hz')}${radarField('antenna.distance', 'Distance', c.distance, 'm')}`;
    const body = `<div class="power-grid"><div><span class="panel-label">E-PLANE PATTERN OF THE DIPOLE (DASHED RING = HALF POWER)</span>${polarPattern('Dipole pattern', pattern.angles, pattern.field)}</div>
      <div class="analysis-readouts">${readout('Directivity (numerical integration)', `${fmt(d, 5)} = ${fmt(10 * Math.log10(d), 4)} dBi`)}${readout('Half-power beamwidth', hp === null ? '—' : `${fmt(hp, 4)}°`)}${readout('Dish gain η(πD/λ)²', `${fmt(ap.dishGainDb, 5)} dBi`)}${readout('Dish beamwidth ≈ 70λ/D', `${fmt(ap.dishBeamwidth, 4)}°`)}${readout('Effective aperture Gλ²/4π', `${fmt(ap.effectiveArea(ap.dishGain), 4)} m²`)}${readout('Far-field distance 2D²/λ', eng(ap.farField, 'm'))}${readout('Friis: path loss, received power', `${fmt(fr.fspl, 5)} dB, ${fmt(fr.prDbm, 5)} dBm`)}<p class="field-help">The pattern comes from E(θ) = [cos(πL cosθ) − cos(πL)]/sinθ and the directivity from integrating it over the sphere: 1.5 for a short dipole, 1.64 (2.15 dBi) at λ/2, 2.41 at λ. Longer than about 1.25λ the main lobe splits.</p></div></div>`;
    return { controls, body };
  }
  const rk = reflexKlystron({ v0: c.v0, frequency: c.frequency, spacing: c.spacing });
  const mg = magnetron({ v0: c.mv0, b0: c.b0, cathodeRadius: c.a, anodeRadius: c.b });
  const dc = directionalCoupler({ p1: c.p1, p2: c.p2, p3: c.p3, p4: c.p4 });
  const vs = vswrMeasurement({ vmax: c.vmax, vmin: c.vmin });
  const controls = `${radarField('tubes.v0', 'Klystron beam voltage V0', c.v0, 'V')}${radarField('tubes.frequency', 'Klystron frequency', c.frequency, 'Hz')}${radarField('tubes.spacing', 'Repeller spacing L', c.spacing, 'm')}${radarField('tubes.mv0', 'Magnetron anode voltage', c.mv0, 'V')}${radarField('tubes.b0', 'Magnetic flux density', c.b0, 'T')}${radarField('tubes.a', 'Cathode radius a', c.a, 'm')}${radarField('tubes.b', 'Anode radius b', c.b, 'm')}${radarField('tubes.p1', 'Coupler P1 (input)', c.p1, 'W')}${radarField('tubes.p2', 'P2 (through)', c.p2, 'W')}${radarField('tubes.p3', 'P3 (coupled)', c.p3, 'W')}${radarField('tubes.p4', 'P4 (isolated)', c.p4, 'W')}${radarField('tubes.vmax', 'Slotted line Vmax', c.vmax, 'V')}${radarField('tubes.vmin', 'Vmin', c.vmin, 'V')}`;
  const body = `<div class="power-grid"><div>${simpleTable(['Mode n', 'Transit (cycles)', 'Repeller voltage', 'Max efficiency'], rk.modes.map((m) => [String(m.n), `${m.cycles}`, m.possible ? eng(m.repeller, 'V') : 'not possible', `${fmt(100 * m.efficiency, 4)} %`]))}</div>
    <div class="analysis-readouts">${readout('Magnetron Hull cut-off field for V0', eng(mg.hullField, 'T'))}${readout('Hull cut-off voltage for B0', eng(mg.hullVoltage, 'V'))}${readout('Cyclotron frequency eB/2πm', eng(mg.cyclotron, 'Hz'))}${readout('Regime', mg.regime)}${readout('Coupler: coupling, directivity, isolation', `${fmt(dc.coupling, 4)} dB, ${fmt(dc.directivity, 4)} dB, ${fmt(dc.isolation, 4)} dB`)}${readout('Insertion loss', `${fmt(dc.insertionLoss, 4)} dB`)}${readout('VSWR, |Γ|, return loss', `${fmt(vs.vswr, 4)}, ${fmt(vs.gamma, 4)}, ${fmt(vs.returnLoss, 4)} dB`)}<p class="field-help">Reflex klystron modes need a transit time of n − ¼ cycles in the repeller space; higher modes need less repeller voltage but give less power. Isolation = coupling + directivity.</p></div></div>`;
  return { controls, body };
}
export function renderRadar(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'radar'), 'RADAR, SATELLITE, ANTENNAS & MICROWAVE', '')}${labCard('radar', 'Radar & satellite', RADAR_TABS, radarLab.configuration(state), renderRadarTab)}</div>`;
}
export function bindRadarEvents() { bindLabControls('radar', radarLab); }

// ---------------------------------------------------------------------------
// Speech processing.


// ---------------------------------------------------------------------------
// PLC ladder lab.
