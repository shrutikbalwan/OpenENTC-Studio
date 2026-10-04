// Fault Hunt workspace. Entry points: renderFaultHunt(state); bindFaultHuntEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify } from '../../core/store.js';
import { simulateDC } from '../../engines/circuit-engine.js';
import { applyFault, boardNets, BOARDS, chooseFault, debrief, FAULT_TYPES, faultsFor, measureResistance as faultMeasureResistance, measureVoltage as faultMeasureVoltage, score as faultScore } from '../../../packages/faulthunt/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout, simpleTable } from '../../components/tables.js';
import { labSelect } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { makeLab } from '../../controllers/lab-controls.js';
import { reportError } from '../../services/errors.js';

const faultLab = makeLab('fault-lab', {
  tab: 'hunt',
  hunt: { board: 'divider', seed: 1, mode: 'v', red: 'a', black: '0', log: [], wrong: 0, peeked: false, solved: false, guessPart: '', guessKind: 'open', best: {}, gaveUp: false },
});
const faultSolve = (components) => simulateDC(components);
const PART_GLYPH = { resistor: 'R', capacitor: 'C', diode: 'D', led: 'LED', npn: 'NPN', pnp: 'PNP', nmos: 'N-MOS', pmos: 'P-MOS', opamp: 'OP', voltage: 'V' };
function renderBoard(board) {
  const xs = board.components.map((p) => p.x), ys = board.components.map((p) => p.y);
  const minX = Math.min(...xs) - 70, minY = Math.min(...ys) - 50, w = Math.max(...xs) - minX + 70, h = Math.max(...ys) - minY + 60;
  const parts = board.components.map((p) => {
    const nets = [p.n1, p.n2, p.n3].filter((n) => n !== undefined).map((n) => (n === '0' ? 'GND' : n)).join(' · ');
    const value = p.type === 'voltage' ? `${fmt(p.value, 4)} V` : p.type === 'npn' || p.type === 'pnp' ? `β ${p.value}` : p.type === 'opamp' ? `±${p.value} V` : eng(p.value, p.unit === 'Vf' ? 'V' : p.unit);
    return `<g class="fh-part ${p.type === 'voltage' ? 'source' : ''}"><rect x="${p.x - 52}" y="${p.y - 26}" width="104" height="52" rx="8"/><text x="${p.x}" y="${p.y - 8}" text-anchor="middle" class="fh-id">${esc(p.id)} <tspan class="fh-glyph">${esc(PART_GLYPH[p.type] ?? p.type)}</tspan></text><text x="${p.x}" y="${p.y + 7}" text-anchor="middle" class="fh-value">${esc(value)}</text><text x="${p.x}" y="${p.y + 20}" text-anchor="middle" class="fh-nets">${esc(nets)}</text></g>`;
  }).join('');
  return `<svg class="fh-board" viewBox="${minX} ${minY} ${w} ${h}" role="img" aria-label="Circuit board"><rect class="fh-pcb" x="${minX + 4}" y="${minY + 4}" width="${w - 8}" height="${h - 8}" rx="14"/>${parts}</svg>`;
}
export function renderFaultHunt(state) {
  const config = faultLab.configuration(state), c = config.hunt;
  const board = BOARDS[c.board] ?? BOARDS.divider;
  let fault, body;
  try {
    fault = chooseFault(board, c.seed, faultSolve);
    applyFault(board.components, fault); // throws if the chosen fault cannot be applied
    const nets = boardNets(board);
    const netOptions = nets.map((n) => [n, n === '0' ? 'GND (0)' : n]);
    const rows = c.log.map((entry, k) => {
      const healthy = c.peeked ? (entry.mode === 'v' ? faultMeasureVoltage(board.components, entry.red, entry.black, faultSolve) : faultMeasureResistance(board.components, entry.red, entry.black, faultSolve)) : null;
      const show = (v) => (entry.mode === 'v' ? `${fmt(v, 4)} V` : Number.isFinite(v) ? eng(v, 'Ω') : 'OL (open)');
      return [String(k + 1), entry.mode === 'v' ? 'DC volts (power on)' : 'Ohms (power off)', `${entry.red === '0' ? 'GND' : entry.red} → ${entry.black === '0' ? 'GND' : entry.black}`, show(entry.value), healthy === null ? '—' : show(healthy)];
    });
    const parts = board.components.filter((p) => faultsFor(p.type).length);
    const guessPart = parts.find((p) => p.id === c.guessPart) ?? parts[0];
    const kinds = faultsFor(guessPart.type);
    const points = faultScore({ measurements: c.log.length, wrongGuesses: c.wrong, peeked: c.peeked, solved: c.solved });
    const finished = c.solved || c.gaveUp;
    const debriefTable = finished ? `<span class="panel-label">DEBRIEF — WHAT THE FAULT DID TO EVERY NODE</span>${simpleTable(['Net', 'Good board', 'Faulty board', 'Change'], debrief(board, fault, faultSolve).map((row) => [row.net, `${fmt(row.healthy, 4)} V`, `${fmt(row.faulty, 4)} V`, `${row.change >= 0 ? '+' : ''}${fmt(row.change, 4)} V`]))}` : '';
    body = `<div class="fh-layout"><div><span class="panel-label">${esc(board.level.toUpperCase())} BOARD — ${esc(board.name.toUpperCase())}</span>${renderBoard(board)}<p class="field-help">${esc(board.description)} One part on this board has a hidden fault. Measure like you would on a real bench, then name the part and the fault.</p>
      <div class="dsp-controls fh-meter"><span class="panel-label">MULTIMETER</span>${labSelect('data-fault-select', 'hunt.mode', 'Mode', c.mode, [['v', 'DC volts — power on'], ['r', 'Ohms — power off']])}${labSelect('data-fault-select', 'hunt.red', 'Red probe', c.red, netOptions)}${labSelect('data-fault-select', 'hunt.black', 'Black probe', c.black, netOptions)}<button class="button run" data-fault-measure ${finished ? 'disabled' : ''}>Measure</button></div>
      ${simpleTable(['#', 'Mode', 'Probes', 'Reading', c.peeked ? 'Good board' : 'Good board (hidden)'], rows.length ? rows : [['—', 'No measurements yet', '', '', '']])}</div>
      <div class="fh-side"><div class="fh-score"><span>SCORE</span><b>${finished ? (c.solved ? points : 0) : faultScore({ measurements: c.log.length, wrongGuesses: c.wrong, peeked: c.peeked, solved: true })}</b><small>${finished ? (c.solved ? 'Solved!' : 'Answer shown') : 'if you solve it now'}</small></div>
      <div class="analysis-readouts">${readout('Measurements', String(c.log.length))}${readout('Wrong diagnoses', String(c.wrong))}${readout('Best on this board', c.best?.[c.board] !== undefined ? String(c.best[c.board]) : '—')}</div>
      ${finished ? `<div class="quiz-feedback ${c.solved ? 'ok' : 'bad'}"><b>${c.solved ? 'Correct!' : 'The answer'}</b> — ${esc(fault.id)}: ${esc(FAULT_TYPES[fault.kind])}${fault.kind === 'high' || fault.kind === 'low' ? ` (×${fault.kind === 'high' ? fault.factor : `1/${fault.factor}`})` : ''}.</div>${debriefTable}` : `<div class="dsp-controls"><span class="panel-label">DIAGNOSIS</span>${labSelect('data-fault-select', 'hunt.guessPart', 'Faulty part', guessPart.id, parts.map((p) => [p.id, `${p.id} (${PART_GLYPH[p.type] ?? p.type})`]))}${labSelect('data-fault-select', 'hunt.guessKind', 'Fault', kinds.includes(c.guessKind) ? c.guessKind : kinds[0], kinds.map((k) => [k, FAULT_TYPES[k]]))}<button class="button primary" data-fault-diagnose>Submit diagnosis</button></div>`}
      <div class="fh-actions"><button class="button" data-fault-peek ${c.peeked || finished ? 'disabled' : ''}>Compare with a good board (−20)</button><button class="button" data-fault-giveup ${finished ? 'disabled' : ''}>Show the answer</button><button class="button run" data-fault-new>New fault</button></div>
      <p class="field-help">Scoring: 100 points, minus 4 for every measurement after the fifth, 25 for each wrong diagnosis and 20 for looking at the good board. Tips: start with the supply, then follow the signal; in ohms mode the power is off, so you see the parts themselves (but parallel paths still count).</p></div></div>`;
  } catch (error) { body = labError('fault', 'Fault Hunt', error); }
  const boardTabs = `<div class="logic-tabs" role="tablist">${Object.entries(BOARDS).map(([id, b]) => `<button role="tab" aria-selected="${id === c.board}" class="${id === c.board ? 'active' : ''}" data-fault-board="${id}">${esc(b.name)}</button>`).join('')}</div>`;
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'faulthunt'), 'TROUBLESHOOTING PRACTICE', '')}${boardTabs}<div class="dsp-card">${body}</div></div>`;
}
export function bindFaultHuntEvents() {
  document.querySelectorAll('[data-fault-reset]').forEach((button) => button.addEventListener('click', () => faultLab.persist((config) => { config.hunt = { ...structuredClone(faultLab.defaults.hunt), best: config.hunt.best }; })));
  const fresh = (config, extra = {}) => { Object.assign(config.hunt, { seed: Math.floor(Math.random() * 1e6) + 1, log: [], wrong: 0, peeked: false, solved: false, gaveUp: false, ...extra }); };
  document.querySelectorAll('[data-fault-board]').forEach((button) => button.addEventListener('click', () => faultLab.persist((config) => { fresh(config, { board: button.dataset.faultBoard, red: boardNets(BOARDS[button.dataset.faultBoard])[1] ?? '0', black: '0', guessPart: '' }); })));
  document.querySelectorAll('[data-fault-select]').forEach((select) => select.addEventListener('change', () => { const [, key] = select.dataset.faultSelect.split('.'); faultLab.persist((config) => { config.hunt[key] = select.value; }); }));
  document.querySelectorAll('[data-fault-new]').forEach((button) => button.addEventListener('click', () => faultLab.persist((config) => fresh(config))));
  document.querySelectorAll('[data-fault-measure]').forEach((button) => button.addEventListener('click', () => {
    const c = faultLab.configuration(getState()).hunt, board = BOARDS[c.board];
    try {
      const faulty = applyFault(board.components, chooseFault(board, c.seed, faultSolve));
      const value = c.mode === 'v' ? faultMeasureVoltage(faulty, c.red, c.black, faultSolve) : faultMeasureResistance(faulty, c.red, c.black, faultSolve);
      faultLab.persist((config) => { config.hunt.log = [...config.hunt.log, { mode: c.mode, red: c.red, black: c.black, value: Number.isFinite(value) ? value : null }].slice(-40); });
    } catch (error) { reportError(error); }
  }));
  document.querySelectorAll('[data-fault-peek]').forEach((button) => button.addEventListener('click', () => faultLab.persist((config) => { config.hunt.peeked = true; })));
  document.querySelectorAll('[data-fault-giveup]').forEach((button) => button.addEventListener('click', () => faultLab.persist((config) => { config.hunt.gaveUp = true; })));
  document.querySelectorAll('[data-fault-diagnose]').forEach((button) => button.addEventListener('click', () => {
    const c = faultLab.configuration(getState()).hunt, board = BOARDS[c.board];
    const fault = chooseFault(board, c.seed, faultSolve);
    const parts = board.components.filter((p) => faultsFor(p.type).length);
    const part = parts.find((p) => p.id === c.guessPart) ?? parts[0];
    const kinds = faultsFor(part.type), kind = kinds.includes(c.guessKind) ? c.guessKind : kinds[0];
    if (part.id === fault.id && kind === fault.kind) {
      faultLab.persist((config) => { config.hunt.solved = true; const points = faultScore({ measurements: c.log.length, wrongGuesses: c.wrong, peeked: c.peeked, solved: true }); config.hunt.best = { ...config.hunt.best, [c.board]: Math.max(points, config.hunt.best?.[c.board] ?? 0) }; });
      notify('Correct diagnosis!', 'success');
    } else {
      faultLab.persist((config) => { config.hunt.wrong += 1; });
      notify(part.id === fault.id ? 'Right part, wrong kind of fault — measure again.' : 'Not that one — keep measuring.', 'error');
    }
  }));
}
