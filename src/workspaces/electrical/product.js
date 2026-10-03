// Electronic Product Design workspace. Entry points: renderProduct(state); bindProductEvents().
import { modules } from '../../data/modules.js';
import { batteryLife, heatsink, PART_FIT, reliability, traceWidth } from '../../../packages/productdesign/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout, simpleTable } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { groupField, labSelect, labText } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, bindLabText, makeLab } from '../../controllers/lab-controls.js';

const PRODUCT_TABS = [['thermal', 'Heat sink'], ['reliability', 'Reliability & MTBF'], ['trace', 'PCB trace width'], ['battery', 'Battery life']];
const productLab = makeLab('product-lab', {
  tab: 'thermal',
  thermal: { power: 10, tjMax: 125, ambient: 40, thetaJc: 1.5, thetaCs: 0.5, thetaSa: 4, margin: 0.9 },
  reliability: { parts: 'resistor 20\nceramic capacitor 15\nelectrolytic capacitor 3\nmicrocontroller 1\nIC (small) 3\nconnector 2\ncrystal 1', hours: 8760, redundant: 1, factor: 1 },
  trace: { current: 2, riseC: 10, copperOz: 1, layer: 'external', lengthMm: 50 },
  battery: { capacityMah: 2000, activeMa: 50, sleepUa: 20, dutyPercent: 2, derating: 0.8, peukert: 1 },
});
const productField = groupField('data-product-field');
function renderProductTab(config) {
  const c = config[config.tab];
  if (config.tab === 'thermal') {
    const h = heatsink(c);
    const controls = `${productField('thermal.power', 'Power dissipated', c.power, 'W')}${productField('thermal.tjMax', 'Max junction temperature', c.tjMax, '°C')}${productField('thermal.ambient', 'Ambient', c.ambient, '°C')}${productField('thermal.thetaJc', 'θjc (data sheet)', c.thetaJc, '°C/W')}${productField('thermal.thetaCs', 'θcs (pad/grease)', c.thetaCs, '°C/W')}${productField('thermal.thetaSa', 'θsa of chosen sink', c.thetaSa, '°C/W')}${productField('thermal.margin', 'Design margin (× Tj max)', c.margin)}`;
    const powers = Array.from({ length: 101 }, (_, k) => 2 * c.power * k / 100);
    const body = `<div class="power-grid"><div>${linePlot('Junction temperature against power with the chosen sink', powers, [{ name: 'Tj', values: powers.map((p) => heatsink({ ...c, power: Math.max(p, 1e-6) }).tj) }, { name: 'limit', values: powers.map(() => c.margin * c.tjMax), color: '#ef4444', dashed: true }], { xLabel: (x) => eng(x, 'W') })}</div><div class="analysis-readouts">${readout('Required sink θsa', h.possible ? `≤ ${fmt(h.requiredSa, 4)} °C/W` : 'impossible — even an ideal sink is not enough')}${readout('With the chosen sink: Tj, Tcase, Tsink', `${fmt(h.tj, 4)} °C, ${fmt(h.tc, 4)} °C, ${fmt(h.ts, 4)} °C ${h.ok ? '✓' : '✗ too hot'}`)}${readout('Total θja', `${fmt(h.totalTheta, 4)} °C/W`)}${readout('Max power with this sink', eng(h.maxPowerWithSink, 'W'))}<p class="field-help">Heat flows like current through thermal resistances: ΔT = P × θ. Keep Tj below about 90 % of its rating for long life — every 10 °C cooler roughly doubles component life.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'reliability') {
    const parts = String(c.parts).split('\n').map((l) => l.trim()).filter(Boolean).map((l, k) => { const match = /^(.*?)\s+(\d+)(?:\s+([\d.]+))?$/.exec(l); if (!match) throw new RangeError(`Part line ${k + 1}: "type quantity [FIT]".`); return { type: match[1], quantity: Number(match[2]), fit: match[3] ? Number(match[3]) : undefined }; });
    const r = reliability(parts, { hours: c.hours, redundant: Math.max(1, Math.round(c.redundant)), factor: c.factor });
    const years = Array.from({ length: 101 }, (_, k) => 20 * k / 100);
    const controls = `${labText('product')('reliability.parts', `Parts: type quantity [FIT] (known types: ${Object.keys(PART_FIT).join(', ')})`, c.parts, 6)}${productField('reliability.hours', 'Mission time', c.hours, 'h')}${productField('reliability.redundant', 'Units in parallel', c.redundant)}${productField('reliability.factor', 'Environment factor πE', c.factor)}`;
    const body = `<div class="power-grid"><div>${linePlot('Reliability R(t) against years in service', years, [{ name: 'single', values: years.map((y) => Math.exp(-r.lambda * y * 8760)) }, { name: `${Math.round(c.redundant)} in parallel`, values: years.map((y) => 1 - (1 - Math.exp(-r.lambda * y * 8760)) ** Math.max(1, Math.round(c.redundant))), color: '#f59e0b' }], { xLabel: (x) => `${fmt(x, 3)} y`, yMin: 0, yMax: 1 })}${simpleTable(['Part', 'Qty', 'FIT each', 'FIT total'], parts.map((p) => { const each = p.fit ?? PART_FIT[p.type] ?? 0; return [p.type, String(p.quantity), fmt(each, 4), fmt(each * p.quantity * c.factor, 4)]; }))}</div><div class="analysis-readouts">${readout('Total failure rate', `${fmt(r.fit, 5)} FIT (${r.lambda.toExponential(3)} /h)`)}${readout('MTBF = 1/λ', `${fmt(r.mtbf, 5)} h = ${fmt(r.mtbf / 8760, 4)} years`)}${readout(`Reliability after ${fmt(c.hours, 5)} h`, `${fmt(100 * r.reliability, 5)} %`)}${readout('With redundancy', `${fmt(100 * r.redundantReliability, 5)} %, MTBF ${fmt(r.redundantMtbf / 8760, 4)} years`)}${readout('Failures per 1000 units per year', fmt(r.failuresPerThousandPerYear, 4))}<p class="field-help">Parts-count method: in a series system every failure stops the product, so failure rates add. FIT values here are typical ballpark figures; use the manufacturer's data or MIL-HDBK-217 / IEC 61709 for a real prediction.</p></div></div>`;
    return { controls, body };
  }
  if (config.tab === 'trace') {
    const t = traceWidth(c);
    const currents = Array.from({ length: 100 }, (_, k) => 0.1 + 9.9 * k / 99);
    const controls = `${productField('trace.current', 'Current', c.current, 'A')}${productField('trace.riseC', 'Allowed temperature rise', c.riseC, '°C')}${productField('trace.copperOz', 'Copper weight', c.copperOz, 'oz')}${labSelect('data-product-select', 'trace.layer', 'Layer', c.layer, [['external', 'External (outer)'], ['internal', 'Internal']])}${productField('trace.lengthMm', 'Trace length', c.lengthMm, 'mm')}`;
    const body = `<div class="power-grid"><div>${linePlot('Required width (mm) against current (A)', currents, [{ name: 'external', values: currents.map((i) => traceWidth({ ...c, current: i, layer: 'external' }).widthMm) }, { name: 'internal', values: currents.map((i) => traceWidth({ ...c, current: i, layer: 'internal' }).widthMm), color: '#f97316' }], { xLabel: (x) => eng(x, 'A') })}</div><div class="analysis-readouts">${readout('Minimum width', `${fmt(t.widthMm, 4)} mm (${fmt(t.widthMil, 4)} mil)`)}${readout('Cross-section', `${fmt(t.areaMil2, 4)} mil²`)}${readout('Resistance of the trace', eng(t.resistance, 'Ω'))}${readout('Voltage drop, power loss', `${eng(t.drop, 'V')}, ${eng(t.loss, 'W')}`)}<p class="field-help">IPC-2221: I = k·ΔT^0.44·A^0.725 with k = 0.048 outside and 0.024 inside (inner layers cannot shed heat to air). The PCB Studio DRC can check your board against this width.</p></div></div>`;
    return { controls, body };
  }
  const b = batteryLife(c);
  const duties = Array.from({ length: 100 }, (_, k) => 0.1 + 99.9 * k / 99);
  const controls = `${productField('battery.capacityMah', 'Capacity', c.capacityMah, 'mAh')}${productField('battery.activeMa', 'Active current', c.activeMa, 'mA')}${productField('battery.sleepUa', 'Sleep current', c.sleepUa, 'µA')}${productField('battery.dutyPercent', 'Active time', c.dutyPercent, '%')}${productField('battery.derating', 'Usable fraction', c.derating)}${productField('battery.peukert', 'Peukert exponent (1 = ideal)', c.peukert)}`;
  const body = `<div class="power-grid"><div>${linePlot('Battery life (days, log10) against active duty cycle (%)', duties, [{ name: 'life', values: duties.map((d) => Math.log10(batteryLife({ ...c, dutyPercent: d }).days)) }], { xLabel: (x) => `${fmt(x, 3)} %` })}</div><div class="analysis-readouts">${readout('Average current', eng(b.averageMa / 1000, 'A'))}${readout('Battery life', `${fmt(b.hours, 5)} h = ${fmt(b.days, 4)} days = ${fmt(b.years, 4)} years`)}<p class="field-help">For IoT nodes the sleep current often decides battery life: at a 1 % duty cycle a 20 µA sleep current can matter as much as the active current. The plot's y-axis is log10(days).</p></div></div>`;
  return { controls, body };
}
export function renderProduct(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'product'), 'ELECTRONIC PRODUCT DESIGN', '')}${labCard('product', 'Product design', PRODUCT_TABS, productLab.configuration(state), renderProductTab)}</div>`;
}
export function bindProductEvents() { bindLabControls('product', productLab, ['layer']); bindLabText('product', productLab); }
