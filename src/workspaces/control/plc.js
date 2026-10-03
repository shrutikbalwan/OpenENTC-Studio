// PLC Ladder Lab workspace. Entry points: renderPlc(state); bindPlcEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState } from '../../core/store.js';
import { createPlc, LADDER_EXAMPLES, layoutCondition, operands, parseInputScript, parseLadder, runLadder, scan } from '../../../packages/plc/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { groupField, labSelect, labText } from '../../components/forms.js';
import { labCard, pageHeader } from '../../components/layout.js';
import { bindLabControls, bindLabText, makeLab } from '../../controllers/lab-controls.js';

const PLC_TABS = [['program', 'Ladder & live run'], ['timing', 'Timing diagram']];
const plcLab = makeLab('plc-lab', {
  tab: 'program',
  program: { example: 'motor', text: LADDER_EXAMPLES.motor[1], script: LADDER_EXAMPLES.motor[2], duration: 10, scanMs: 10 },
  timing: {},
});
const plcText = labText('plc');
let plcLive = null;
const plcValue = (plc, name) => (/^T/.test(name) ? Boolean(plc?.timers[name]?.done) : /^C/.test(name) ? Boolean(plc?.counters[name]?.done) : Boolean(plc?.bits[name]));
function renderLadder(rungs, plc = null) {
  const CW = 92, RH = 46, left = 24;
  let svg = '', y = 14;
  const wire = (x1, y1, x2, y2, on) => `<path class="ladder-wire${on ? ' on' : ''}" d="M${x1} ${y1}L${x2} ${y2}"/>`;
  const contactState = (node) => (plc ? (node.negated ? !plcValue(plc, node.name) : plcValue(plc, node.name)) : false);
  const draw = (node, x, top) => {
    if (node.kind === 'always') return wire(x, top + RH / 2, x + CW, top + RH / 2, Boolean(plc));
    if (node.kind === 'contact') {
      const cy = top + RH / 2, on = contactState(node);
      return `${wire(x, cy, x + 32, cy, on)}${wire(x + 60, cy, x + CW, cy, on)}<path class="ladder-contact${on ? ' on' : ''}" d="M${x + 32} ${cy - 11}V${cy + 11}M${x + 60} ${cy - 11}V${cy + 11}${node.negated ? `M${x + 36} ${cy + 10}L${x + 56} ${cy - 10}` : ''}"/><text class="ladder-label" x="${x + 46}" y="${cy - 15}" text-anchor="middle">${node.edge ? '↑' : ''}${esc(node.name)}</text>`;
    }
    if (node.kind === 'and') { let out = '', cx = x; for (const item of node.items) { out += draw(item, cx, top); cx += item.w * CW; } return out; }
    let out = '', ty = top;
    const width = node.w * CW;
    for (const item of node.items) {
      out += draw(item, x, ty);
      if (item.w < node.w) out += wire(x + item.w * CW, ty + RH / 2, x + width, ty + RH / 2, false);
      ty += item.h * RH;
    }
    const lastMid = ty - node.items.at(-1).h * RH + RH / 2;
    return `${out}${wire(x, top + RH / 2, x, lastMid, false)}${wire(x + width, top + RH / 2, x + width, lastMid, false)}`;
  };
  const maxW = Math.max(...rungs.map((r) => layoutCondition(r.condition).w));
  const coilX = left + maxW * CW + 30, rail = coilX + 150;
  rungs.forEach((rung, index) => {
    const box = layoutCondition(rung.condition);
    const rows = Math.max(box.h, rung.outputs.length);
    svg += `<text class="ladder-rung-no" x="4" y="${y + RH / 2 + 4}">${index + 1}</text>`;
    svg += draw(box, left, y);
    const powered = plc ? plcLive?.powered?.[index] : false;
    svg += wire(left + box.w * CW, y + RH / 2, coilX, y + RH / 2, powered);
    rung.outputs.forEach((out, k) => {
      const cy = y + k * RH + RH / 2;
      if (k > 0) svg += wire(coilX, y + RH / 2, coilX, cy, powered);
      const label = { coil: '( )', set: '(S)', reset: '(R)', ton: 'TON', tof: 'TOF', tp: 'TP', ctu: 'CTU', ctd: 'CTD', res: 'RES' }[out.kind];
      const active = plc && plcValue(plc, out.name);
      const detail = out.preset !== undefined ? (out.kind.startsWith('ct') ? ` ${plc?.counters[out.name]?.count ?? 0}/${out.preset}` : ` ${fmt(plc?.timers[out.name]?.elapsed ?? 0, 3)}/${fmt(out.preset, 3)} s`) : '';
      svg += `${wire(coilX, cy, coilX + 30, cy, powered)}<rect class="ladder-coil${active ? ' on' : ''}" x="${coilX + 30}" y="${cy - 13}" width="64" height="26" rx="13"/><text class="ladder-label" x="${coilX + 62}" y="${cy + 4}" text-anchor="middle">${esc(label)}</text><text class="ladder-label" x="${coilX + 100}" y="${cy + 4}">${esc(out.name)}${esc(detail)}</text>${wire(coilX + 94, cy, coilX + 96, cy, false)}`;
    });
    y += rows * RH + 10;
  });
  const height = y + 4;
  return `<svg class="ladder-svg" style="max-width:${Math.round((rail + 60) * 1.25)}px" viewBox="0 0 ${rail + 60} ${height}" role="img" aria-label="Ladder diagram"><path class="ladder-rail" d="M${left} 4V${height - 4}M${rail + 50} 4V${height - 4}"/>${svg}</svg>`;
}
function renderPlcLivePanel(rungs) {
  const list = operands(rungs);
  const plc = plcLive?.plc;
  const lamp = (name) => `<span class="plc-lamp ${plcValue(plc, name) ? 'on' : ''}"><i></i>${esc(name)}</span>`;
  return `<div class="plc-io"><div><span class="panel-label">INPUTS (CLICK TO TOGGLE)</span><div class="plc-buttons">${list.inputs.map((name) => `<button class="plc-input ${plcLive?.inputs?.[name] ? 'on' : ''}" data-plc-input="${name}">${esc(name)}</button>`).join('') || '<small>no inputs</small>'}</div></div><div><span class="panel-label">OUTPUTS</span><div class="plc-buttons">${list.outputs.map(lamp).join('') || '<small>none</small>'}</div></div><div><span class="panel-label">MEMORY, TIMERS, COUNTERS</span><div class="plc-buttons">${[...list.memory, ...list.timers, ...list.counters].map(lamp).join('') || '<small>none</small>'}</div></div><small>${plcLive?.running ? `Running · ${fmt(plc.time, 4)} s · ${plc.scans} scans` : 'Stopped'}</small></div>${renderLadder(rungs, plc ?? null)}`;
}
function renderPlcTab(config) {
  const c = config.program;
  const rungs = parseLadder(c.text);
  const controls = `${labSelect('data-plc-select', 'program.example', 'Example', c.example, [...Object.entries(LADDER_EXAMPLES).map(([id, e]) => [id, e[0]]), ['custom', 'Custom']])}${plcText('program.text', 'Ladder program (one rung per line)', c.text, 7)}`;
  if (config.tab === 'program') {
    const body = `<div class="plc-actions"><button class="button run" data-plc-live="start">▶ Run live</button><button class="button" data-plc-live="stop">■ Stop</button><button class="button" data-plc-live="reset">Reset</button></div><div data-plc-panel>${renderPlcLivePanel(rungs)}</div><p class="field-help">Syntax: <code>(I0.0 | Q0.0) /I0.1 -&gt; Q0.0</code> — a space means series (AND), <code>|</code> means parallel (OR), <code>/</code> is a normally closed contact and <code>^</code> a rising-edge contact. Outputs: a coil (<code>Q0.0</code>, <code>M0.0</code>), <code>S</code>/<code>R</code> latch and unlatch, <code>TON</code>/<code>TOF</code>/<code>TP Tn 2s</code>, <code>CTU</code>/<code>CTD Cn 5</code> and <code>RES</code>. The PLC scans every 10 ms: it reads the inputs, solves the rungs top to bottom and writes the outputs, so rung order matters.</p>`;
    return { controls, body };
  }
  const result = runLadder(rungs, { events: parseInputScript(c.script), duration: c.duration, scanTime: c.scanMs / 1000 });
  const rowH = 26, w = 600, names = result.names, tMax = result.times.at(-1) || 1;
  const rows = names.map((name, k) => {
    const tr = result.traces[name];
    const y0 = k * rowH + 20;
    const path = tr.map((v, i) => `${i ? 'L' : 'M'}${(result.times[i] / tMax * w).toFixed(1)} ${(y0 - v * 14).toFixed(1)}`).join('');
    return `<text class="ladder-label" x="-6" y="${y0 - 3}" text-anchor="end">${esc(name)}</text><path class="timing-trace" d="${path}"/>`;
  }).join('');
  const ticks = Array.from({ length: 6 }, (_, k) => `<text class="ladder-label" x="${(k / 5 * w).toFixed(1)}" y="${names.length * rowH + 22}" text-anchor="middle">${fmt(tMax * k / 5, 3)} s</text><path class="timing-grid" d="M${(k / 5 * w).toFixed(1)} 0V${names.length * rowH + 8}"/>`).join('');
  const body = `<div class="power-grid"><div><span class="panel-label">TIMING DIAGRAM FROM THE INPUT SCRIPT</span><svg class="timing-svg" viewBox="-60 -4 ${w + 70} ${names.length * rowH + 30}">${ticks}${rows}</svg></div><div class="analysis-readouts">${readout('Scans simulated', String(result.plc.scans))}${readout('Final outputs', operands(rungs).outputs.map((n) => `${n}=${plcValue(result.plc, n) ? 1 : 0}`).join(' '))}<p class="field-help">The input script lists events as <code>time I0.0=1</code> separated by semicolons. Timers count in whole scans, so a 2 s TON at a 10 ms scan finishes exactly 200 scans after its input turns on.</p></div></div>`;
  return { controls: `${controls}${plcText('program.script', 'Input script (time input=0/1; …)', c.script, 3)}${groupField('data-plc-field')('program.duration', 'Run for', c.duration, 's')}${groupField('data-plc-field')('program.scanMs', 'Scan time', c.scanMs, 'ms')}`, body };
}
export function renderPlc(state) {
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'plc'), 'PLC, LADDER LOGIC & AUTOMATION', '')}${labCard('plc', 'PLC ladder', PLC_TABS, plcLab.configuration(state), renderPlcTab)}</div>`;
}
function stopPlcLive() { if (plcLive?.timer) clearInterval(plcLive.timer); if (plcLive) { plcLive.running = false; plcLive.timer = null; } }
export function bindPlcEvents() {
  bindLabControls('plc', plcLab, ['example']);
  bindLabText('plc', plcLab, (config, group, key) => { if (key === 'text') { config.program.example = 'custom'; stopPlcLive(); plcLive = null; } });
  document.querySelectorAll('[data-plc-select="program.example"]').forEach((select) => select.addEventListener('change', () => {
    const example = LADDER_EXAMPLES[select.value];
    if (example) { stopPlcLive(); plcLive = null; plcLab.persist((config) => { config.program.text = example[1]; config.program.script = example[2]; }); }
  }));
  const panel = document.querySelector('[data-plc-panel]');
  if (!panel) { stopPlcLive(); return; }
  let rungs;
  try { rungs = parseLadder(plcLab.configuration(getState()).program.text); } catch { return; }
  const refresh = () => { const target = document.querySelector('[data-plc-panel]'); if (!target) { stopPlcLive(); return; } target.innerHTML = renderPlcLivePanel(rungs); };
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-plc-input]');
    if (!button) return;
    plcLive ??= { plc: createPlc(), inputs: {}, running: false, timer: null, powered: [] };
    plcLive.inputs[button.dataset.plcInput] = !plcLive.inputs[button.dataset.plcInput];
    if (!plcLive.running) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0);
    refresh();
  });
  document.querySelectorAll('[data-plc-live]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.plcLive;
    if (action === 'reset') { stopPlcLive(); plcLive = null; refresh(); return; }
    if (action === 'stop') { stopPlcLive(); refresh(); return; }
    plcLive ??= { plc: createPlc(), inputs: {}, running: false, timer: null, powered: [] };
    if (plcLive.running) return;
    plcLive.running = true;
    plcLive.timer = setInterval(() => { for (let k = 0; k < 10; k += 1) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0.01); refresh(); }, 100);
    refresh();
  }));
  if (plcLive?.running) { stopPlcLive(); plcLive.running = true; plcLive.timer = setInterval(() => { for (let k = 0; k < 10; k += 1) plcLive.powered = scan(plcLive.plc, rungs, plcLive.inputs, 0.01); refresh(); }, 100); }
}

// ---------------------------------------------------------------------------
// Electrical machines and power devices.



// ---------------------------------------------------------------------------
// Electronic product design.



// ---------------------------------------------------------------------------
// Fault Hunt: find the hidden fault with a virtual multimeter.
