// VLSI Lab and RTOS Scheduler (they share one lab binder) workspace. Entry points: renderVlsi(state), renderRtos(state); bindVlsiEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { decimate, niceRange } from '../../core/circuit-plot.js';
import { DEFAULT_PROCESS, delayTheory, dynamicPower, inverterTransient, inverterVtc, symmetricPmosWidth } from '../../../packages/vlsi/src/index.mjs';
import { POLICIES, PROTOCOLS, responseTimeAnalysis, RTOS_EXAMPLES, simulateSchedule, utilisationTests } from '../../../packages/rtos/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { comparisonRow, comparisonTable, readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const vlsiLab = makeLab('vlsi-lab', { tab: 'inverter', inverter: { ...DEFAULT_PROCESS, cl: 100e-15, riseTime: 0, frequency: 100e6 } });
const vlsiField = groupField('data-vlsi-field');
let vlsiCache = { key: null, value: null };
export function renderVlsi(state) {
  const config = vlsiLab.configuration(state);
  const c = config.inverter;
  const key = JSON.stringify(c);
  let view;
  if (vlsiCache.key === key) view = vlsiCache.value;
  else {
    try {
      const process = { vdd: c.vdd, vtn: c.vtn, vtp: c.vtp, kpn: c.kpn, kpp: c.kpp, lambdaN: c.lambdaN, lambdaP: c.lambdaP, wn: c.wn, ln: c.ln, wp: c.wp, lp: c.lp };
      const vtc = inverterVtc(process, 361);
      const transient = inverterTransient(process, { cl: c.cl, riseTime: c.riseTime, steps: 8000 });
      const ideal = delayTheory({ ...process, lambdaN: 0, lambdaP: 0 }, c.cl);
      const power = dynamicPower({ cl: c.cl, vdd: c.vdd, frequency: c.frequency });
      const t = vtc.theory;
      const marker = (x, color) => ({ name: '', values: [], xs: [x, x], ys: [0, c.vdd], color, dashed: true });
      const vtcPlot = (() => {
        const series = [{ ...decimate(vtc.vin, vtc.vout, 800), color: PLOT_COLORS[0], primary: true }, { xs: [0, c.vdd], ys: [0, c.vdd], color: '#64748b', dashed: true }, ...[[vtc.vil, PLOT_COLORS[2]], [vtc.vm, PLOT_COLORS[3]], [vtc.vih, PLOT_COLORS[4]]].map(([x, color]) => marker(x, color))];
        return renderPlotFrame({ title: 'Voltage transfer characteristic (dashed: VIL, VM, VIH)', series, xMin: 0, xMax: c.vdd, xTicks: Array.from({ length: 7 }, (_, k) => ({ position: k / 6, text: `${fmt(c.vdd * k / 6, 2)} V` })), yRange: niceRange(0, c.vdd), formatY: (value) => `${fmt(value, 2)} V` });
      })();
      const currentPlot = linePlot('Short-circuit current (A) vs Vin (V)', vtc.vin, [{ name: 'I', values: vtc.current }], { xLabel: (x) => fmt(x, 2), unit: 'A' });
      const transientPlot = linePlot('Transient response (V) vs time (s)', transient.time, [{ name: 'Vin', values: transient.input, color: '#64748b' }, { name: 'Vout', values: transient.output }], { xLabel: (x) => eng(x, 's'), unit: 'V' });
      const table = comparisonTable([
        comparisonRow('Switching threshold VM', vtc.vm, t.vm, 'V'), comparisonRow('VIL', vtc.vil, t.vil, 'V'), comparisonRow('VIH', vtc.vih, t.vih, 'V'), comparisonRow('VOH / VOL', vtc.voh, c.vdd, 'V'), comparisonRow('Noise margin low NML', vtc.nml, t.nml, 'V'), comparisonRow('Noise margin high NMH', vtc.nmh, t.nmh, 'V'),
        comparisonRow('Gain at VM', vtc.gainAtVm, null, ''), comparisonRow('Peak short-circuit current', vtc.peakCurrent, null, 'A'),
        comparisonRow('tPHL', transient.tphl, ideal.tphl, 's'), comparisonRow('tPLH', transient.tplh, ideal.tplh, 's'), comparisonRow('Average delay tp', transient.tp, ideal.tp, 's'), comparisonRow('Fall time 90–10 %', transient.fallTime, null, 's'), comparisonRow('Rise time 10–90 %', transient.riseTime, null, 's'),
        comparisonRow('Energy from VDD per cycle', transient.energyPerCycle, c.cl * c.vdd * c.vdd, 'J'), comparisonRow(`Dynamic power at ${eng(c.frequency, 'Hz')}`, power.dynamic, null, 'W'),
      ], `Formula column: long-channel results with λ = 0 (Kang & Leblebici) and step-input delays; energy C·VDD² per cycle. kR = kn/kp = ${fmt(vtc.theory.kr, 4)}. The simulation itself includes λ and the input rise time.`);
      view = `<div class="power-grid"><div>${vtcPlot}${currentPlot}${transientPlot}</div><div>${table}</div></div>`;
    } catch (error) { view = `<div class="diagnostic error"><b>Inverter</b><span>${esc(error.message)}</span></div>`; }
    vlsiCache = { key, value: view };
  }
  const controls = `${vlsiField('inverter.vdd', 'VDD', c.vdd, 'V')}${vlsiField('inverter.vtn', 'VTn', c.vtn, 'V')}${vlsiField('inverter.vtp', 'VTp', c.vtp, 'V')}${vlsiField('inverter.kpn', 'kn′ = µnCox', c.kpn, 'A/V²')}${vlsiField('inverter.kpp', 'kp′ = µpCox', c.kpp, 'A/V²')}${vlsiField('inverter.wn', 'Wn', c.wn, 'µm')}${vlsiField('inverter.ln', 'Ln', c.ln, 'µm')}${vlsiField('inverter.wp', 'Wp', c.wp, 'µm')}${vlsiField('inverter.lp', 'Lp', c.lp, 'µm')}${vlsiField('inverter.lambdaN', 'λn', c.lambdaN, '1/V')}${vlsiField('inverter.lambdaP', 'λp', c.lambdaP, '1/V')}${vlsiField('inverter.cl', 'Load C', c.cl, 'F')}${vlsiField('inverter.riseTime', 'Input rise/fall time', c.riseTime, 's')}${vlsiField('inverter.frequency', 'Switching frequency', c.frequency, 'Hz')}<button class="button ghost" data-action="vlsi-symmetric">Size Wp for VM = VDD/2</button>`;
  return `<div class="page scroll-page power-page vlsi-page">${pageHeader(modules.find((item) => item.id === 'vlsi'), 'VLSI DESIGN · CMOS INVERTER', '<span class="pill live"><i></i> SPICE LEVEL-1 MODEL</span>')}<div class="dsp-card"><div class="dsp-controls">${controls}</div>${view}<p class="module-footnote">Square-law (SPICE level 1) MOSFETs with channel-length modulation. The VTC, delays and rise/fall times agree with ngspice 42 within 0.5 ps and 1 mV for the default process.</p></div></div>`;
}
const RTOS_DEFAULT = RTOS_EXAMPLES[0];
const rtosLab = makeLab('rtos-lab', { tab: 'schedule', schedule: { example: RTOS_DEFAULT.id, policy: RTOS_DEFAULT.policy, protocol: 'none', quantum: 2, tasks: structuredClone(RTOS_DEFAULT.tasks) } });
const TASK_COLORS = ['#60a5fa', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#facc15'];
function renderGantt(result) {
  const cell = Math.max(6, Math.min(24, Math.floor(900 / result.length)));
  const rowHeight = 30, left = 70, top = 20;
  const width = left + result.length * cell + 10, height = top + result.tasks.length * rowHeight + 34;
  const parts = [];
  result.tasks.forEach((task, index) => {
    const y = top + index * rowHeight;
    parts.push(`<text x="4" y="${y + 18}" class="gantt-label">${esc(task.name)}</text><line x1="${left}" x2="${left + result.length * cell}" y1="${y + rowHeight - 4}" y2="${y + rowHeight - 4}" class="gantt-axis"/>`);
  });
  result.timeline.forEach((slot, t) => {
    if (!slot) return;
    const y = top + slot.task * rowHeight;
    parts.push(`<rect x="${left + t * cell}" y="${y + 6}" width="${cell}" height="${rowHeight - 12}" fill="${TASK_COLORS[slot.task % TASK_COLORS.length]}" class="${slot.resource ? 'gantt-critical' : ''}"><title>t=${t}: ${esc(result.tasks[slot.task].name)} job ${slot.job}${slot.resource ? ` holding ${esc(slot.resource)}` : ''}</title></rect>`);
  });
  for (const event of result.events) {
    const x = left + event.time * cell, y = top + event.task * rowHeight;
    if (event.time > result.length) continue;
    if (event.type === 'release') parts.push(`<path d="M${x} ${y + rowHeight - 4} V${y + 2} m-3 4 l3 -4 l3 4" class="gantt-release"/>`);
    if (event.type === 'miss') parts.push(`<text x="${x - 4}" y="${y + 12}" class="gantt-miss">✗</text>`);
  }
  for (const job of result.jobs) {
    if (job.absoluteDeadline > result.length) continue;
    const x = left + job.absoluteDeadline * cell, y = top + job.task * rowHeight;
    parts.push(`<path d="M${x} ${y + 2} V${y + rowHeight - 4} m-3 -4 l3 4 l3 -4" class="gantt-deadline"/>`);
  }
  const step = Math.max(1, Math.ceil(30 / cell));
  for (let t = 0; t <= result.length; t += step) parts.push(`<text x="${left + t * cell}" y="${height - 8}" class="gantt-tick">${t}</text>`);
  return `<div class="gantt-scroll"><svg class="gantt" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Schedule Gantt chart">${parts.join('')}</svg></div><p class="field-help">↑ release · ↓ deadline · ✗ deadline miss · striped blocks hold a shared resource.</p>`;
}
export function renderRtos(state) {
  const config = rtosLab.configuration(state);
  const c = config.schedule;
  let body;
  try {
    const result = simulateSchedule(c.tasks, { policy: c.policy, protocol: c.protocol, quantum: c.quantum });
    const tests = utilisationTests(c.tasks);
    const fixed = ['rm', 'dm', 'fixed'].includes(c.policy);
    const rta = fixed ? responseTimeAnalysis(c.tasks, { policy: c.policy, protocol: c.protocol }) : null;
    const rows = result.perTask.map((entry, index) => `<tr><td><span class="legend-chip" style="--chip:${TASK_COLORS[index % TASK_COLORS.length]}">${esc(entry.name)}</span></td><td>${fmt(c.tasks[index].wcet / c.tasks[index].period, 3)}</td><td>${entry.worstResponse ?? '—'}</td><td>${rta ? `${rta[index].response}${rta[index].blocking ? ` (B=${rta[index].blocking})` : ''}` : '—'}</td><td>${result.tasks[index].deadline}</td><td class="${entry.misses ? 'miss' : ''}">${entry.misses}</td><td>${entry.blockedTicks}</td></tr>`).join('');
    body = `${renderGantt(result)}<div class="power-grid"><div><table class="truth-table comm-table power-table"><thead><tr><th>Task</th><th>U = C/T</th><th>Worst response (simulated)</th><th>Response-time analysis</th><th>Deadline</th><th>Misses</th><th>Blocked ticks</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="analysis-readouts">${readout('Total utilisation U', fmt(tests.utilisation, 4))}${readout('Liu–Layland bound n(2^(1/n) − 1)', `${fmt(tests.rmBound, 4)} → ${tests.rmSufficient ? 'RM guaranteed' : 'test inconclusive'}`)}${readout('Hyperbolic bound Π(Ui + 1) ≤ 2', tests.hyperbolicBound ? 'passes' : 'fails')}${readout('EDF test (D = T): U ≤ 1', tests.edfFeasible === null ? 'n/a (constrained deadlines)' : tests.edfFeasible ? 'feasible' : 'infeasible')}${readout('Simulated', `${result.length} ticks (hyperperiod ${result.hyperperiod})`)}${readout('Result', result.schedulable ? 'all deadlines met' : 'deadline missed')}${readout('Context switches', String(result.contextSwitches))}${readout('CPU busy', `${fmt(result.utilisationObserved * 100, 3)} %`)}</div></div>`;
  } catch (error) { body = `<div class="diagnostic error"><b>Schedule</b><span>${esc(error.message)}</span></div>`; }
  const taskRows = c.tasks.map((task, index) => `<tr><td><input data-rtos-task="${index}.name" value="${esc(task.name ?? `T${index + 1}`)}"></td>${['period', 'wcet', 'deadline', 'offset', 'priority'].map((field) => `<td><input type="number" min="0" step="1" data-rtos-task="${index}.${field}" value="${task[field] ?? (field === 'deadline' ? task.period : field === 'offset' ? 0 : field === 'priority' ? index + 1 : '')}"></td>`).join('')}<td><input data-rtos-task="${index}.section" placeholder="res:start:length" value="${esc((task.sections || []).map((s) => `${s.resource}:${s.start}:${s.length}`).join(' '))}"></td><td><button class="tool" data-rtos-remove="${index}">×</button></td></tr>`).join('');
  return `<div class="page scroll-page power-page rtos-page">${pageHeader(modules.find((item) => item.id === 'rtos'), 'REAL-TIME OPERATING SYSTEMS', '')}
    <div class="dsp-card"><div class="dsp-controls">${labSelect('data-rtos-example', 'example', 'Example', c.example, RTOS_EXAMPLES.map((entry) => [entry.id, entry.name]))}${labSelect('data-rtos-select', 'schedule.policy', 'Scheduling policy', c.policy, Object.entries(POLICIES))}${labSelect('data-rtos-select', 'schedule.protocol', 'Resource protocol', c.protocol, Object.entries(PROTOCOLS))}${c.policy === 'rr' ? `<label>Time quantum<input type="number" min="1" step="1" data-rtos-quantum value="${c.quantum}"></label>` : ''}</div>
    <table class="truth-table comm-table rtos-tasks"><thead><tr><th>Task</th><th>Period T</th><th>Execution C</th><th>Deadline D</th><th>Offset</th><th>Priority</th><th>Critical sections</th><th></th></tr></thead><tbody>${taskRows}</tbody></table><button class="tool" data-action="rtos-add">+ Add task</button>
    ${body}<p class="module-footnote">Tick-by-tick uniprocessor simulation from the critical instant over one hyperperiod (≤ 5000 ticks). Simulated worst-case responses equal exact response-time analysis for fixed-priority task sets, and EDF schedules every implicit-deadline set with U ≤ 1 (checked on hundreds of random task sets).</p></div></div>`;
}
export function bindVlsiEvents() {
  bindLabControls('vlsi', vlsiLab);
  document.querySelector('[data-action="vlsi-symmetric"]')?.addEventListener('click', () => vlsiLab.persist((config) => { const c = config.inverter; c.wp = Number(symmetricPmosWidth({ ...c, lambdaN: 0, lambdaP: 0 }).toPrecision(4)); }));
  document.querySelector('[data-rtos-example]')?.addEventListener('change', (event) => { const example = RTOS_EXAMPLES.find((entry) => entry.id === event.target.value); if (example) rtosLab.persist((config) => { config.schedule = { ...config.schedule, example: example.id, policy: example.policy, protocol: example.protocol ?? 'none', tasks: structuredClone(example.tasks) }; }); });
  document.querySelectorAll('[data-rtos-select]').forEach((select) => select.addEventListener('change', () => { const [, key] = select.dataset.rtosSelect.split('.'); rtosLab.persist((config) => { config.schedule[key] = select.value; }); }));
  document.querySelector('[data-rtos-quantum]')?.addEventListener('change', (event) => rtosLab.persist((config) => { config.schedule.quantum = Math.max(1, Math.round(Number(event.target.value) || 1)); }));
  document.querySelectorAll('[data-rtos-task]').forEach((input) => input.addEventListener('change', () => {
    const [index, field] = input.dataset.rtosTask.split('.');
    rtosLab.persist((config) => {
      const task = config.schedule.tasks[Number(index)];
      if (field === 'name') task.name = input.value.trim().slice(0, 16) || `T${Number(index) + 1}`;
      else if (field === 'section') task.sections = input.value.trim().split(/\s+/).filter(Boolean).map((text) => { const [resource, start, length] = text.split(':'); return { resource: resource || 'R', start: Number(start) || 0, length: Number(length) || 1 }; });
      else task[field] = Math.max(field === 'offset' ? 0 : 1, Math.round(Number(input.value) || 0));
    });
  }));
  document.querySelectorAll('[data-rtos-remove]').forEach((button) => button.addEventListener('click', () => rtosLab.persist((config) => { if (config.schedule.tasks.length > 1) config.schedule.tasks.splice(Number(button.dataset.rtosRemove), 1); })));
  document.querySelector('[data-action="rtos-add"]')?.addEventListener('click', () => rtosLab.persist((config) => { if (config.schedule.tasks.length < 8) config.schedule.tasks.push({ name: `T${config.schedule.tasks.length + 1}`, period: 10, wcet: 1 }); }));
}

// ---------------------------------------------------------------------------
// Network theory lab.
