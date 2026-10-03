// Real + Virtual Bench workspace. Entry points: renderTwin(state); bindTwinEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify } from '../../core/store.js';
import { createCoSimulation } from '../../engines/cosim.js';
import { AVR_EXAMPLES, UnoBoard } from '../../../packages/mcu/src/index.mjs';
import { adcToVolts, compareDivider, compareRc, explainDifference, parseTwinOutput, rcCharge, TWIN_BANNER, TWIN_BAUD } from '../../../packages/twin/src/index.mjs';
import { eng, fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { linePlot, PLOT_COLORS } from '../../components/plots.js';
import { groupField, labSelect } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';
import { rerender } from '../../services/render.js';

const twinLab = makeLab('twin-lab', {
  tab: 'bench',
  bench: { experiment: 'rc', r: 10e3, c: 1e-6, period: 200, rTop: 10e3, rBottom: 4.7e3, vs: 5 },
});
const twinField = groupField('data-twin-field');
// Runs and the serial connection live in memory only.
const twinState = { virtual: null, real: null, busy: '', port: null, reader: null, text: '', connected: false, ready: false };
function twinCommand(c) { return c.experiment === 'rc' ? `R${Math.round(c.period)}\n` : c.experiment === 'dc' ? 'D\n' : 'S\n'; }
function analyseTwin(c, text) {
  const parsed = parseTwinOutput(text);
  if (c.experiment === 'rc') { if (!parsed.rc || parsed.rc.samples.length < 8) throw new Error('No RC samples received.'); return { kind: 'rc', parsed, run: compareRc({ r: c.r, c: c.c, vs: c.vs, period: parsed.rc.period, raws: parsed.rc.samples }) }; }
  if (c.experiment === 'dc') { if (!parsed.dc) throw new Error('No DC reading received.'); return { kind: 'dc', parsed, run: compareDivider({ vs: c.vs, rTop: c.rTop, rBottom: c.rBottom, code: parsed.dc.a1 }), a0: parsed.dc.a0 }; }
  return { kind: 'stream', parsed };
}
export function renderTwin(state) {
  const c = twinLab.configuration(state).bench;
  const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
  const serialOk = typeof navigator !== 'undefined' && 'serial' in navigator;
  const v = twinState.virtual?.kind === c.experiment ? twinState.virtual : null, r = twinState.real?.kind === c.experiment ? twinState.real : null;
  let plot = '', readouts = '';
  try {
    if (c.experiment === 'rc') {
      const base = v?.run ?? r?.run;
      const window = base ? base.times.at(-1) : 50 * c.r * c.c / 10;
      const ts = Array.from({ length: 200 }, (_, k) => window * k / 199);
      const series = [{ name: 'theory V(t) = Vs(1 − e^(−t/RC))', values: ts.map((t) => rcCharge(t, c.r, c.c, c.vs)), color: '#94a3b8', dashed: true }];
      const resample = (run) => ts.map((t) => run.volts[Math.min(run.volts.length - 1, Math.round(t / (run.times[1] - run.times[0])))]);
      if (v) series.push({ name: 'virtual Uno (simulator)', values: resample(v.run), color: PLOT_COLORS[0] });
      if (r) series.push({ name: 'real Arduino', values: resample(r.run), color: '#f59e0b' });
      plot = linePlot('Capacitor voltage after the step on D8', ts, series, { xLabel: (x) => eng(x, 's'), unit: 'V', yMin: 0, yMax: c.vs * 1.05 });
      const row = (label, run) => (run ? `${readout(`${label}: fitted τ`, `${eng(run.run.fit.tau, 's')} (${run.run.errorPercent >= 0 ? '+' : ''}${fmt(run.run.errorPercent, 3)} % vs R·C)`)}${readout(`${label}: implied C, final voltage`, `${eng(run.run.impliedC, 'F')}, ${fmt(run.run.fit.vFinal, 4)} V`)}` : '');
      readouts = `${readout('Theory τ = R·C', eng(c.r * c.c, 's'))}${row('Virtual', v)}${row('Real', r)}${v && r ? readout('Real vs virtual', explainDifference(100 * (r.run.fit.tau - v.run.fit.tau) / v.run.fit.tau)) : ''}`;
    } else if (c.experiment === 'dc') {
      const theory = c.vs * c.rBottom / (c.rTop + c.rBottom);
      readouts = `${readout('Theory V(A1)', `${fmt(theory, 5)} V`)}${v ? readout('Virtual Uno', `${fmt(v.run.measured, 5)} V (${fmt(v.run.errorPercent, 3)} %), A0 code ${fmt(v.a0, 5)}`) : ''}${r ? readout('Real Arduino', `${fmt(r.run.measured, 5)} V (${fmt(r.run.errorPercent, 3)} %), A0 code ${fmt(r.a0, 5)}`) : ''}${r ? readout('What it means', explainDifference(r.run.errorPercent)) : ''}`;
    } else {
      const s = (r ?? v)?.parsed.stream ?? [];
      if (s.length) plot = linePlot('Live stream: A0 and A1 (volts)', s.map((p) => p.ms / 1000), [{ name: 'A0', values: s.map((p) => adcToVolts(p.a0)) }, { name: 'A1', values: s.map((p) => adcToVolts(p.a1)), color: '#f59e0b' }], { xLabel: (x) => `${fmt(x, 4)} s`, unit: 'V' });
      readouts = readout('Samples', String(s.length));
    }
  } catch (error) { readouts = `<div class="diagnostic error"><b>Twin bench</b><span>${esc(error.message)}</span></div>`; }
  const controls = `${labSelect('data-twin-select', 'bench.experiment', 'Experiment', c.experiment, [['rc', 'RC step response (D8 → R → A0 → C)'], ['dc', 'Voltage divider on A1'], ['stream', 'Live stream A0, A1']])}${c.experiment === 'rc' ? `${twinField('bench.r', 'R', c.r, 'Ω')}${twinField('bench.c', 'C', c.c, 'F')}${twinField('bench.period', 'Sample period', c.period, 'µs')}` : ''}${c.experiment === 'dc' ? `${twinField('bench.rTop', 'Top resistor (5 V → A1)', c.rTop, 'Ω')}${twinField('bench.rBottom', 'Bottom resistor (A1 → GND)', c.rBottom, 'Ω')}` : ''}${twinField('bench.vs', 'Supply (measure your USB 5 V)', c.vs, 'V')}`;
  const wiring = c.experiment === 'rc' ? 'D8 → R → A0 → C → GND (capacitor − to GND)' : c.experiment === 'dc' ? '5V → top resistor → A1 → bottom resistor → GND' : 'Any signals (0–5 V) on A0 and A1';
  const window = 250 * c.period * 1e-6;
  const hint = c.experiment === 'rc' && (window < 3 * c.r * c.c || window > 60 * c.r * c.c) ? `<p class="field-help">Tip: the 250-sample window is ${eng(window, 's')}; choose a sample period near ${Math.max(120, Math.round(c.r * c.c * 5 / 250 * 1e6))} µs so it covers about five time constants.</p>` : '';
  return `<div class="page scroll-page power-page sigsys-page">${pageHeader(modules.find((item) => item.id === 'twin'), 'REAL + VIRTUAL BENCH', '')}<div class="dsp-card"><div class="dsp-controls">${controls}</div>
    <div class="twin-actions"><button class="button run" data-twin-run="virtual" ${twinState.busy ? 'disabled' : ''}>▶ Run on the simulated Uno</button>${serialOk ? `<button class="button" data-twin-connect ${twinState.busy ? 'disabled' : ''}>${twinState.connected ? '✓ Arduino connected' : '🔌 Connect real Arduino'}</button><button class="button run" data-twin-run="real" ${twinState.connected && !twinState.busy ? '' : 'disabled'}>▶ Run on the real Arduino</button>` : '<span class="pill">Real hardware needs Chrome or Edge (Web Serial)</span>'}<button class="button" data-twin-download="ino">Download firmware (.ino)</button><button class="button" data-twin-download="hex">Download HEX</button></div>
    <p class="field-help twin-status">${esc(twinState.busy || 'Ready.')}</p>
    <div class="power-grid"><div>${plot || '<p class="field-help">Run the experiment on the simulated Uno, the real Arduino, or both — the results appear here on top of the theory.</p>'}</div><div class="analysis-readouts">${readout('Wiring', wiring)}${readouts}${hint}<p class="field-help">How it works: upload the OpenENTC Twin firmware (${firmware?.flashBytes ?? '—'} bytes) to an Arduino Uno with the Arduino IDE. The <b>exact same program</b> runs here on the simulated ATmega328P, wired to the same circuit through co-simulation. Differences between the two curves are real-world effects: component tolerance, supply voltage, ADC error and breadboard contacts.</p></div></div></div></div>`;
}
function runTwinVirtual() {
  const c = twinLab.configuration(getState()).bench;
  const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
  const part = (id, type, value, n1, n2) => ({ id, type, label: id, value, n1, n2 });
  const board = new UnoBoard(firmware.hex, firmware.board);
  const components = c.experiment === 'rc' ? [part('R1', 'resistor', c.r, 'drive', 'cap'), part('C1', 'capacitor', c.c, 'cap', '0'), part('VUSB', 'voltage', c.vs, 'vcc', '0'), part('RA1', 'resistor', 1e6, 'vcc', 'a1')] : [part('VUSB', 'voltage', c.vs, 'vcc', '0'), part('R1', 'resistor', c.rTop, 'vcc', 'a1'), part('R2', 'resistor', c.rBottom, 'a1', '0'), part('RA0', 'resistor', 1e6, 'a0', '0')];
  const connections = c.experiment === 'rc' ? [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }, { pin: 'A1', node: 'a1' }] : [{ pin: 'A0', node: 'a0' }, { pin: 'A1', node: 'a1' }];
  let sim;
  try { sim = createCoSimulation(board, { components, connections, maxStep: Math.min(50e-6, c.period * 1e-6 / 2), historyLimit: 2000 }); } catch (error) { notify(error.message, 'error'); return; }
  const text = () => new TextDecoder().decode(new Uint8Array(board.mcu.usart.output));
  sim.advance(0.03);
  board.mcu.usart.receive([...new TextEncoder().encode(twinCommand(c))]);
  const limit = c.experiment === 'rc' ? 0.7 + 250 * c.period * 1e-6 + 0.6 : c.experiment === 'dc' ? 0.3 : 1.8;
  let simulated = 0;
  twinState.busy = 'Running the firmware on the simulated Uno…';
  rerender();
  const step = () => {
    try {
      for (let k = 0; k < 4; k += 1) { sim.advance(0.025); simulated += 0.025; }
      if (parseTwinOutput(text()).complete < 1 && simulated < limit) { const status = document.querySelector('.twin-status'); if (status) status.textContent = `Simulating… ${fmt(simulated, 3)} s of ${fmt(limit, 3)} s`; setTimeout(step, 0); return; }
      twinState.virtual = analyseTwin(c, text());
      twinState.busy = '';
      notify('Virtual run finished', 'success');
    } catch (error) { twinState.busy = ''; notify(`Virtual run failed: ${error.message}`, 'error'); }
    rerender();
  };
  setTimeout(step, 0);
}
async function connectTwinSerial() {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: TWIN_BAUD });
    twinState.port = port; twinState.connected = true; twinState.ready = false; twinState.text = '';
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable).catch(() => {});
    twinState.reader = decoder.readable.getReader();
    (async () => { try { for (;;) { const { value, done } = await twinState.reader.read(); if (done) break; twinState.text += value; if (twinState.text.includes(TWIN_BANNER)) twinState.ready = true; if (twinState.text.length > 200000) twinState.text = twinState.text.slice(-100000); } } catch { /* port closed */ } twinState.connected = false; rerender(); })();
    notify('Arduino connected — it restarts when the port opens, so wait a second before running.', 'success');
  } catch (error) { notify(`Could not open the serial port: ${error.message}`, 'error'); }
  rerender();
}
async function runTwinReal() {
  const c = twinLab.configuration(getState()).bench;
  if (!twinState.port) return;
  twinState.busy = 'Waiting for the real Arduino…';
  rerender();
  try {
    if (!twinState.ready) await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!twinState.ready) throw new Error('No reply from the OpenENTC Twin firmware — is it uploaded, and is the baud rate 115200?');
    twinState.text = '';
    const writer = twinState.port.writable.getWriter();
    await writer.write(new TextEncoder().encode(twinCommand(c)));
    writer.releaseLock();
    const deadline = Date.now() + 8000;
    while (parseTwinOutput(twinState.text).complete < 1 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    twinState.real = analyseTwin(c, twinState.text);
    notify('Real run finished', 'success');
  } catch (error) { notify(error.message, 'error'); }
  twinState.busy = '';
  rerender();
}
export function bindTwinEvents() {
  bindLabControls('twin', twinLab, ['experiment']);
  document.querySelectorAll('[data-twin-run="virtual"]').forEach((button) => button.addEventListener('click', runTwinVirtual));
  document.querySelectorAll('[data-twin-run="real"]').forEach((button) => button.addEventListener('click', runTwinReal));
  document.querySelectorAll('[data-twin-connect]').forEach((button) => button.addEventListener('click', () => { if (!twinState.connected) connectTwinSerial(); }));
  document.querySelectorAll('[data-twin-download]').forEach((button) => button.addEventListener('click', () => {
    const firmware = AVR_EXAMPLES.find((e) => e.id === 'twin_bench');
    const ino = button.dataset.twinDownload === 'ino';
    const blob = new Blob([ino ? firmware.source : firmware.hex], { type: 'text/plain' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = ino ? 'openentc_twin.ino' : 'openentc_twin.hex'; link.click(); URL.revokeObjectURL(link.href);
  }));
}

// ---------------------------------------------------------------------------
// Cellular planning.


// ---------------------------------------------------------------------------
// Cryptography lab.
