// Network Theory workspace. Entry points: renderNetworkTheory(state); bindNetworkTheoryEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { deltaToStar, loadedTwoPort, NETWORK_EXAMPLES, parseNetlist as parseTheoryNetlist, powerTransferCurve, solveNetwork, starToDelta, superposition, thevenin, twoPortAnalysis } from '../../../packages/network/src/index.mjs';
import { eng, phasor, rect } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const THEORY_TABS = [['theorems', 'Theorems'], ['twoport', 'Two-port networks'], ['stardelta', 'Star–delta']];
const netLab = makeLab('network-lab', {
  tab: 'theorems',
  theorems: { example: 'thevenin-bridge', netlist: NETWORK_EXAMPLES[0].netlist, frequency: 0, a: 'a', b: 'b' },
  twoport: { example: 'two-port-t', netlist: NETWORK_EXAMPLES[4].netlist, frequency: 0, p1: '1', p2: '2', zl: 100 },
  stardelta: { ra: 10, rb: 20, rc: 30 },
});
const matrixHtml = (label, m, units) => `<div class="matrix-card"><b>${label}</b><table class="truth-table matrix"><tbody>${m.map((row, i) => `<tr>${row.map((value, j) => `<td>${esc(rect(value, units[i][j]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function renderNetworkTheory(state) {
  const config = netLab.configuration(state);
  const tabs = labTabs(THEORY_TABS, config.tab, 'data-net-tab');
  let body;
  try {
    if (config.tab === 'theorems') {
      const c = config.theorems;
      const elements = parseTheoryNetlist(c.netlist);
      const solution = solveNetwork(elements, { frequency: c.frequency });
      const th = thevenin(elements, c.a, c.b, { frequency: c.frequency });
      const sup = superposition(elements, { a: c.a, b: c.b, frequency: c.frequency });
      const nodeRows = Object.entries(solution.voltages).filter(([node]) => node !== '0').map(([node, value]) => `<tr><td>V(${esc(node)})</td><td>${esc(phasor(value, 'V'))}</td></tr>`).join('');
      const elementRows = elements.map((element) => `<tr><td>${esc(element.name)}</td><td>${esc(phasor(solution.currents[element.name], 'A'))}</td><td>${esc(rect(solution.power[element.name], c.frequency ? 'VA' : 'W'))}</td></tr>`).join('');
      const resistive = Math.abs(th.zth[1]) < 1e-9 && th.zth[0] > 0;
      const curve = resistive ? powerTransferCurve(th.vth, th.zth[0], { points: 200 }) : null;
      body = `<div class="dsp-controls">${labSelect('data-net-example', 'theorems', 'Example', c.example, NETWORK_EXAMPLES.filter((entry) => entry.a).map((entry) => [entry.id, entry.name]))}${groupField('data-net-field')('theorems.frequency', 'Frequency (0 = DC)', c.frequency, 'Hz')}<label>Terminal a<input data-net-text="theorems.a" value="${esc(c.a)}"></label><label>Terminal b<input data-net-text="theorems.b" value="${esc(c.b)}"></label></div>
        <div class="power-grid"><div><label class="rf-input-label">Netlist (R, L, C, V, I, E, G, F, H — see help)<textarea data-net-text="theorems.netlist" rows="12" spellcheck="false">${esc(c.netlist)}</textarea></label>
          <table class="truth-table comm-table power-table"><thead><tr><th>Node</th><th>Voltage</th></tr></thead><tbody>${nodeRows}</tbody></table>
          <table class="truth-table comm-table power-table"><thead><tr><th>Element</th><th>Current (first → second node)</th><th>Power absorbed</th></tr></thead><tbody>${elementRows}</tbody></table></div>
        <div><span class="panel-label">THÉVENIN / NORTON SEEN FROM ${esc(c.a)}–${esc(c.b)}</span><div class="analysis-readouts">${readout('V_Th (open circuit)', phasor(th.vth, 'V'))}${readout('Z_Th (sources off, 1 A test source)', rect(th.zth, 'Ω'))}${readout('I_N = V_Th / Z_Th', th.norton ? phasor(th.norton, 'A') : '—')}${readout('Short-circuit current (check)', th.shortCircuit ? phasor(th.shortCircuit, 'A') : '—')}${readout('Load for maximum power', rect(th.matchedLoad, 'Ω'))}${readout('Maximum power |V_Th|² / 4R_Th', th.maxPower === null ? '—' : eng(th.maxPower, 'W'))}</div>
          ${curve ? linePlot('Power in a load resistor R_L (W) vs R_L (Ω)', curve.map((p) => p.rl), [{ name: 'P', values: curve.map((p) => p.power) }], { xLabel: (x) => eng(x, 'Ω'), unit: 'W' }) : ''}
          <span class="panel-label">SUPERPOSITION: V(${esc(c.a)}) − V(${esc(c.b)})</span><table class="truth-table comm-table power-table"><tbody>${sup.parts.map((part) => `<tr><td>${esc(part.source)} alone (others off)</td><td>${esc(phasor(part.value, 'V'))}</td></tr>`).join('')}<tr><td><b>Sum</b></td><td><b>${esc(phasor(sup.sum, 'V'))}</b></td></tr><tr><td>All sources together</td><td>${esc(phasor(sup.total, 'V'))}</td></tr></tbody></table>
          <p class="field-help">Voltage sources are turned off as shorts and current sources as opens; dependent sources stay in the circuit. AC phasors are RMS values, so the power column is the complex power S = V·I*. Matches ngspice (MNA) to 6 digits.</p></div></div>`;
    } else if (config.tab === 'twoport') {
      const c = config.twoport;
      const elements = parseTheoryNetlist(c.netlist);
      const result = twoPortAnalysis(elements, { p1: c.p1, p2: c.p2, frequency: c.frequency });
      const loaded = result.abcd ? loadedTwoPort(result.abcd, [c.zl, 0]) : null;
      const Ω = 'Ω', S = 'S';
      body = `<div class="dsp-controls">${labSelect('data-net-example', 'twoport', 'Example', c.example, NETWORK_EXAMPLES.filter((entry) => entry.p1).map((entry) => [entry.id, entry.name]))}${groupField('data-net-field')('twoport.frequency', 'Frequency (0 = DC)', c.frequency, 'Hz')}<label>Port 1 node (to ground)<input data-net-text="twoport.p1" value="${esc(c.p1)}"></label><label>Port 2 node (to ground)<input data-net-text="twoport.p2" value="${esc(c.p2)}"></label>${groupField('data-net-field')('twoport.zl', 'Load on port 2', c.zl, 'Ω')}</div>
        <div class="power-grid"><div><label class="rf-input-label">Network netlist (no independent sources needed)<textarea data-net-text="twoport.netlist" rows="10" spellcheck="false">${esc(c.netlist)}</textarea></label>
          <div class="analysis-readouts">${readout('Reciprocal (z12 = z21)', result.reciprocal ? 'yes' : 'no')}${readout('Symmetrical (z11 = z22)', result.symmetric ? 'yes' : 'no')}${loaded ? `${readout(`Input impedance with ${eng(c.zl, 'Ω')} load`, rect(loaded.zin, 'Ω'))}${readout('Voltage gain V2 / V1', phasor(loaded.gain, ''))}` : ''}</div></div>
        <div class="matrix-grid">${result.z ? matrixHtml('Z (impedance)', result.z, [[Ω, Ω], [Ω, Ω]]) : ''}${matrixHtml('Y (admittance)', result.y, [[S, S], [S, S]])}${result.h ? matrixHtml('h (hybrid)', result.h, [[Ω, ''], ['', S]]) : ''}${result.g ? matrixHtml('g (inverse hybrid)', result.g, [[S, ''], ['', Ω]]) : ''}${result.abcd ? matrixHtml('ABCD (transmission)', result.abcd, [['', Ω], [S, '']]) : ''}</div></div>
        <p class="field-help">Y parameters are measured by driving each port with 1 V while the other is shorted; the others are converted from Y. Some sets do not exist for some networks (e.g. Z for an ideal series element).</p>`;
    } else {
      const c = config.stardelta;
      const delta = starToDelta(c);
      const star = deltaToStar(delta);
      body = `<div class="dsp-controls">${groupField('data-net-field')('stardelta.ra', 'Star Ra', c.ra, 'Ω')}${groupField('data-net-field')('stardelta.rb', 'Star Rb', c.rb, 'Ω')}${groupField('data-net-field')('stardelta.rc', 'Star Rc', c.rc, 'Ω')}</div><div class="analysis-readouts">${readout('Delta Rab = (RaRb + RbRc + RcRa) / Rc', eng(delta.rab, 'Ω'))}${readout('Delta Rbc', eng(delta.rbc, 'Ω'))}${readout('Delta Rca', eng(delta.rca, 'Ω'))}${readout('Back to star (check)', `${eng(star.ra, 'Ω')}, ${eng(star.rb, 'Ω')}, ${eng(star.rc, 'Ω')}`)}</div>`;
    }
  } catch (error) { body = `<div class="diagnostic error"><b>Network</b><span>${esc(error.message)}</span></div>`; }
  return `<div class="page scroll-page power-page network-page">${pageHeader(modules.find((item) => item.id === 'theory'), 'CIRCUIT THEORY', '')}${tabs}<div class="dsp-card">${body}</div></div>`;
}
export function bindNetworkTheoryEvents() {
  bindLabControls('net', netLab);
  document.querySelectorAll('[data-net-text]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.netText.split('.'); netLab.persist((config) => { config[group][key] = input.value; if (key === 'netlist') config[group].example = 'custom'; }); }));
  document.querySelectorAll('[data-net-example]').forEach((select) => select.addEventListener('change', () => {
    const example = NETWORK_EXAMPLES.find((entry) => entry.id === select.value);
    if (!example) return;
    const group = select.dataset.netExample;
    netLab.persist((config) => { config[group] = { ...config[group], example: example.id, netlist: example.netlist, frequency: example.frequency, ...(example.a ? { a: example.a, b: example.b } : { p1: example.p1, p2: example.p2 }) }; });
  }));
}
