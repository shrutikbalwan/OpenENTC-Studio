// Electrical Machines & Power Devices workspace. Entry points: renderMachines(state); bindMachinesEvents().
import { modules } from '../../data/modules.js';
import { allDayEfficiency, dcSeriesMotor, dcShuntMotor, inductionMotor, resistanceFiring, seriesString, snubber, switchingLoss, transformerTests, ujtOscillator } from '../../../packages/machines/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { parseNumberList } from '../../shared/parsing.js';
import { readout } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { groupField, labSelect, labText } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, bindLabText, makeLab } from '../../controllers/lab-controls.js';

const MACH_TABS = [['transformer', 'Transformer'], ['dc', 'DC motors'], ['induction', 'Induction motor'], ['scr', 'SCR triggering & protection']];
const machLab = makeLab('mach-lab', {
  tab: 'transformer',
  transformer: { kva: 20, hv: 2500, lv: 250, ocV: 250, ocI: 1.4, ocP: 105, scV: 104, scI: 8, scP: 320, pf: 0.8, lagging: 'lag', cycle: '6 1 0.8\n10 0.5 0.8\n8 0 1' },
  dc: { v: 220, ra: 0.5, ratedIa: 20, ratedRpm: 1500, extraRa: 0, fieldFraction: 1, rse: 0.2 },
  induction: { vLine: 460, r1: 0.641, x1: 1.106, xm: 26.3, r2: 0.332, x2: 0.464, poles: 4, frequency: 60, slip: 0.022, rotationalLoss: 1100 },
  scr: { vbb: 20, eta: 0.63, r: 20e3, cap: 0.1e-6, vm: 325, gateR: 20e3, igt: 1e-3, vs: 300, l: 50e-6, dvdt: 50e6, stringV: 10e3, n: 6, vbm: 2e3, deltaIb: 10e-3, deltaQ: 20e-6, device: 'mosfet', swV: 400, swI: 10, swF: 50e3 },
});
const machField = groupField('data-mach-field');
function renderMachTab(config) {
  const c = config[config.tab];
  if (config.tab === 'transformer') {
    const t = transformerTests({ kva: c.kva, hv: c.hv, lv: c.lv, oc: { v: c.ocV, i: c.ocI, p: c.ocP }, sc: { v: c.scV, i: c.scI, p: c.scP } });
    const cycle = String(c.cycle).split('\n').map((l) => l.trim()).filter(Boolean).map((l, k) => { const v = parseNumberList(l, `Cycle line ${k + 1}`); if (v.length !== 3) throw new RangeError(`Cycle line ${k + 1}: hours, load fraction, pf.`); return v; });
    const day = allDayEfficiency(t, cycle);
    const xs = Array.from({ length: 101 }, (_, k) => 0.02 + 1.23 * k / 100);
    const controls = `${machField('transformer.kva', 'Rating', c.kva, 'kVA')}${machField('transformer.hv', 'HV', c.hv, 'V')}${machField('transformer.lv', 'LV', c.lv, 'V')}${machField('transformer.ocV', 'OC test (LV): V', c.ocV, 'V')}${machField('transformer.ocI', 'I', c.ocI, 'A')}${machField('transformer.ocP', 'P', c.ocP, 'W')}${machField('transformer.scV', 'SC test (HV): V', c.scV, 'V')}${machField('transformer.scI', 'I', c.scI, 'A')}${machField('transformer.scP', 'P', c.scP, 'W')}${machField('transformer.pf', 'Load power factor', c.pf)}${labSelect('data-mach-select', 'transformer.lagging', 'pf type', c.lagging, [['lag', 'Lagging'], ['lead', 'Leading']])}${labText('mach')('transformer.cycle', 'Daily cycle: hours, load fraction, pf', c.cycle, 3)}`;
    const body = `<div class="power-grid"><div>${linePlot('Efficiency (%) against load (fraction of full load)', xs, [{ name: `pf ${c.pf}`, values: xs.map((x) => 100 * t.efficiency(x, c.pf)) }, { name: 'pf 1', values: xs.map((x) => 100 * t.efficiency(x, 1)), color: '#f59e0b', dashed: true }], { xLabel: (x) => fmt(x, 3) })}${linePlot('Regulation (%) against power factor angle (lag positive)', Array.from({ length: 91 }, (_, k) => k), [{ name: 'lagging', values: Array.from({ length: 91 }, (_, k) => 100 * t.regulation(1, Math.cos(k * Math.PI / 180), true)) }, { name: 'leading', values: Array.from({ length: 91 }, (_, k) => 100 * t.regulation(1, Math.cos(k * Math.PI / 180), false)), color: '#f97316' }], { xLabel: (x) => `${fmt(x, 3)}°` })}</div>
      <div class="analysis-readouts">${readout('No-load pf, Iw, Iμ', `${fmt(t.pf0, 4)}, ${eng(t.iw, 'A')}, ${eng(t.imu, 'A')}`)}${readout('R0, X0 (LV side)', `${eng(t.r0, 'Ω')}, ${eng(t.x0, 'Ω')}`)}${readout('R01, X01, Z01 (HV side)', `${eng(t.rEq, 'Ω')}, ${eng(t.xEq, 'Ω')}, ${eng(t.zEq, 'Ω')}`)}${readout('Per-unit impedance', `${fmt(t.percentImpedance, 4)} %`)}${readout('Full-load copper loss', eng(t.copperFull, 'W'))}${readout(`Full-load efficiency at pf ${c.pf}`, `${fmt(100 * t.efficiency(1, c.pf), 5)} %`)}${readout('Full-load regulation', `${fmt(100 * t.regulation(1, c.pf, c.lagging === 'lag'), 5)} %`)}${readout('Maximum efficiency', `${fmt(100 * t.maxEfficiency, 5)} % at ${fmt(100 * t.maxEfficiencyLoad, 4)} % load (copper = core loss)`)}${readout('All-day efficiency', `${fmt(100 * day.efficiency, 5)} % (${eng(day.output, 'Wh')} out, ${eng(day.copper + day.core, 'Wh')} lost)`)}<p class="field-help">The open-circuit test gives the core branch (R0, X0) and core loss; the short-circuit test gives the series impedance and full-load copper loss. Distribution transformers are designed for high all-day efficiency because their core is energised all day.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'dc') {
    const shunt = dcShuntMotor(c), series = dcSeriesMotor({ v: c.v, ra: c.ra, rse: c.rse, ratedIa: c.ratedIa, ratedRpm: c.ratedRpm });
    const tMax = 2 * shunt.ratedTorque;
    const ts = Array.from({ length: 101 }, (_, k) => tMax * (k + 0.5) / 101);
    const controls = `${machField('dc.v', 'Supply V', c.v, 'V')}${machField('dc.ra', 'Armature Ra', c.ra, 'Ω')}${machField('dc.ratedIa', 'Rated armature current', c.ratedIa, 'A')}${machField('dc.ratedRpm', 'Rated speed', c.ratedRpm, 'rpm')}${machField('dc.extraRa', 'Extra armature resistance', c.extraRa, 'Ω')}${machField('dc.fieldFraction', 'Field flux (fraction of rated)', c.fieldFraction)}${machField('dc.rse', 'Series field Rse', c.rse, 'Ω')}`;
    const body = `<div class="power-grid"><div>${linePlot('Speed (rpm) against load torque (N·m)', ts, [{ name: 'shunt', values: ts.map((t) => Math.max(0, shunt.speedAt(t))) }, { name: 'series', values: ts.map((t) => Math.min(4 * c.ratedRpm, series.atTorque(t).rpm)), color: '#f97316' }], { xLabel: (x) => fmt(x, 3) })}</div>
      <div class="analysis-readouts">${readout('Shunt: back EMF at rated load', eng(shunt.backEmfRated, 'V'))}${readout('kΦ (with field setting)', `${fmt(shunt.kPhi, 5)} V·s/rad`)}${readout('Rated torque', `${fmt(shunt.ratedTorque, 5)} N·m`)}${readout('No-load speed', `${fmt(shunt.noLoadRpm, 5)} rpm`)}${readout('Starting current without a starter', eng(shunt.startingCurrent, 'A'))}${readout('Series: torque constant K', fmt(series.k, 5))}${readout('Series: starting torque', `${fmt(series.startingTorque, 5)} N·m`)}<p class="field-help">A shunt motor's speed falls only slightly with load (nearly constant speed); a series motor's torque grows as Ia², so it starts heavy loads (traction) but races dangerously at no load. Adding armature resistance lowers speed; weakening the field raises it.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'induction') {
    const m = inductionMotor(c);
    const op = m.operating(c.slip);
    const slips = Array.from({ length: 200 }, (_, k) => 1 - 0.995 * k / 199);
    const controls = `${machField('induction.vLine', 'Line voltage (star)', c.vLine, 'V')}${machField('induction.r1', 'R1', c.r1, 'Ω')}${machField('induction.x1', 'X1', c.x1, 'Ω')}${machField('induction.xm', 'Xm', c.xm, 'Ω')}${machField('induction.r2', "R2'", c.r2, 'Ω')}${machField('induction.x2', "X2'", c.x2, 'Ω')}${machField('induction.poles', 'Poles', c.poles)}${machField('induction.frequency', 'Frequency', c.frequency, 'Hz')}${machField('induction.slip', 'Operating slip', c.slip)}${machField('induction.rotationalLoss', 'Friction, windage & core loss', c.rotationalLoss, 'W')}`;
    const body = `<div class="power-grid"><div>${linePlot('Torque (N·m) against speed (rpm)', slips.map((s) => m.ns * (1 - s)), [{ name: 'T(s)', values: slips.map((s) => m.torque(s)) }], { xLabel: (x) => fmt(x, 4) })}</div>
      <div class="analysis-readouts">${readout('Synchronous speed', `${fmt(m.ns, 5)} rpm`)}${readout('Thévenin Vth, Rth, Xth', `${eng(m.vth, 'V')}, ${eng(m.rth, 'Ω')}, ${eng(m.xth, 'Ω')}`)}${readout('Slip at maximum torque', fmt(m.sMax, 5))}${readout('Pull-out torque', `${fmt(m.tMax, 5)} N·m at ${fmt(m.ns * (1 - m.sMax), 5)} rpm`)}${readout('Starting torque', `${fmt(m.startingTorque, 5)} N·m`)}${readout(`At s = ${c.slip}`, `${fmt(op.rpm, 5)} rpm, I = ${eng(op.current, 'A')}, pf ${fmt(op.pf, 4)}`)}${readout('Power flow', `Pin ${eng(op.pin, 'W')} → Pag ${eng(op.airGap, 'W')} → Pconv ${eng(op.converted, 'W')} → Pout ${eng(op.output, 'W')}`)}${readout('Efficiency, load torque', `${fmt(100 * op.efficiency, 4)} %, ${fmt(op.loadTorque, 5)} N·m`)}<p class="field-help">Rotor copper loss is s × air-gap power, so a motor running at high slip wastes power. Doubling R2' (wound rotor) moves the pull-out torque to a higher slip without changing its size — that is how slip-ring motors get high starting torque.</p></div></div>`;
    return { controls, body };
  }
  const u = ujtOscillator({ vbb: c.vbb, eta: c.eta, r: c.r, cap: c.cap });
  const fire = resistanceFiring({ vm: c.vm, r: c.gateR, igt: c.igt });
  const sn = snubber({ vs: c.vs, l: c.l, dvdt: c.dvdt });
  const str = seriesString({ vs: c.stringV, n: Math.round(c.n), vbm: c.vbm, deltaIb: c.deltaIb, deltaQ: c.deltaQ });
  const sw = switchingLoss({ device: c.device, v: c.swV, i: c.swI, frequency: c.swF });
  const tt = Array.from({ length: 400 }, (_, k) => 3 * u.period * k / 399);
  const vc = tt.map((t) => { const local = t % u.period; return c.vbb * (1 - Math.exp(-local / (c.r * c.cap))) * (u.vp / (c.vbb * (1 - Math.exp(-u.period / (c.r * c.cap))))); });
  const controls = `${machField('scr.vbb', 'UJT VBB', c.vbb, 'V')}${machField('scr.eta', 'Intrinsic stand-off η', c.eta)}${machField('scr.r', 'Timing R', c.r, 'Ω')}${machField('scr.cap', 'Timing C', c.cap, 'F')}${machField('scr.vm', 'R-trigger supply peak', c.vm, 'V')}${machField('scr.gateR', 'Gate resistor', c.gateR, 'Ω')}${machField('scr.igt', 'Gate trigger current', c.igt, 'A')}${machField('scr.vs', 'Snubber: supply', c.vs, 'V')}${machField('scr.l', 'Source inductance', c.l, 'H')}${machField('scr.dvdt', 'dv/dt rating', c.dvdt, 'V/s')}${machField('scr.stringV', 'String voltage', c.stringV, 'V')}${machField('scr.n', 'SCRs in series', c.n)}${machField('scr.vbm', 'SCR blocking voltage', c.vbm, 'V')}${labSelect('data-mach-select', 'scr.device', 'Switch', c.device, [['mosfet', 'MOSFET'], ['igbt', 'IGBT']])}${machField('scr.swV', 'Switched voltage', c.swV, 'V')}${machField('scr.swI', 'Current', c.swI, 'A')}${machField('scr.swF', 'Switching frequency', c.swF, 'Hz')}`;
  const body = `<div class="power-grid"><div>${linePlot('UJT capacitor voltage (sawtooth) — each drop is a trigger pulse', tt, [{ name: 'Vc', values: vc }], { xLabel: (x) => eng(x, 's'), unit: 'V' })}</div>
    <div class="analysis-readouts">${readout('UJT peak voltage Vp = ηVBB + VD', eng(u.vp, 'V'))}${readout('Trigger frequency 1/(RC ln(1/(1−η)))', eng(u.frequency, 'Hz'))}${readout('Timing R must lie between', `${eng(u.rMin, 'Ω')} and ${eng(u.rMax, 'Ω')} ${u.oscillates ? '✓' : '✗ (no oscillation)'}`)}${readout('R triggering: firing angle', fire.fires ? `${fmt(fire.alpha, 4)}° (range 0–90°)` : 'never fires — gate current too small')}${readout('Snubber Rs, Cs (ζ = 0.65)', `${eng(sn.rs, 'Ω')}, ${eng(sn.cs, 'F')}`)}${readout('Series string: Rs, Cs, efficiency', `${eng(str.r, 'Ω')}, ${eng(str.c, 'F')}, ${fmt(100 * str.efficiency, 4)} %`)}${readout(`${c.device.toUpperCase()} losses`, `switching ${eng(sw.switching, 'W')} + conduction ${eng(sw.conduction, 'W')} = ${eng(sw.total, 'W')}`)}<p class="field-help">R triggering can only delay firing up to 90°; RC and UJT triggering give the full range. The snubber limits dv/dt so the SCR is not falsely turned on. In a series string, resistors share the static voltage and capacitors share it during switching.</p></div></div>`;
  return { controls, body };
}
export function renderMachines(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'machines'), 'ELECTRICAL MACHINES & POWER DEVICES', '')}${labCard('mach', 'Machines', MACH_TABS, machLab.configuration(state), renderMachTab)}</div>`;
}
export function bindMachinesEvents() { bindLabControls('mach', machLab, ['lagging', 'device']); bindLabText('mach', machLab); }
