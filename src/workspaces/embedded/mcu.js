// Microcontroller Lab workspace: the 8051 trainer, the Arduino Uno simulator, Uno-circuit
// co-simulation and the logic analyser. Entry points: renderMcu(state), bindMcuEvents(), bindUnoEvents().
// mcuConfiguration, mcuRuntime and unoRuntime are exported for Lab Records (program listings).
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { getState, notify, recordExperiment, updateProject } from '../../core/store.js';
import { circuitNodes, createCoSimulation } from '../../engines/cosim.js';
import { decimate, niceRange } from '../../core/circuit-plot.js';
import { assemble, AVR_EXAMPLES, Cpu8051, decodeI2c, decodeSpi, decodeUart, disassemble, estimateBaud, EXAMPLES_8051, fromVcd, parseIntelHex, PIN_LABELS, sliceChannel, toImage, toIntelHex, toVcd, TrainerBoard, UnoBoard, unoPin } from '../../../packages/mcu/src/index.mjs';
import { eng, fmt, hex2 } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { labField, labSelect, labTabs } from '../../components/forms.js';
import { pageHeader } from '../../components/layout.js';
import { rerender } from '../../services/render.js';
import { reportError } from '../../services/errors.js';

const MCU_SPEEDS = [['0.01', 'Slow motion (1 %)'], ['0.1', '10 %'], ['1', 'Real time'], ['10', '10×'], ['max', 'As fast as possible']];
export const mcuRuntime = { cpu: null, board: null, assembly: null, key: null, running: false, frame: 0, last: 0, breakpoints: new Set(), terminal: '', loadedHex: null, error: null };
export function mcuConfiguration(state) {
  const saved = state.project.experiments.find((experiment) => experiment?.id === 'mcu-lab')?.inputs || {};
  const example = EXAMPLES_8051[0];
  return { tab: '8051', source: example.source, exampleId: example.id, wiring: example.wiring, clockMHz: 11.0592, speed: '1', avrExampleId: 'blink', avrSpeed: '1', avrBoard: null, ...saved };
}
function persistMcu(patch) {
  const next = { ...mcuConfiguration(getState()), ...patch };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 60_000) { notify('The program is too long to save in the project (60 KB limit).', 'error'); return; }
  recordExperiment({ id: 'mcu-lab', kind: 'mcu', operation: 'mcu-lab', inputs: next });
}
/** (Re)build the simulated system when the program, wiring or clock changes. */
function mcuEnsure(config) {
  const key = JSON.stringify([config.source, config.wiring, config.clockMHz, mcuRuntime.loadedHex?.name]);
  if (mcuRuntime.key === key && mcuRuntime.cpu) return;
  mcuStop();
  mcuRuntime.key = key;
  mcuRuntime.terminal = '';
  mcuRuntime.error = null;
  const cpu = new Cpu8051({ clock: Number(config.clockMHz) * 1e6 || 11_059_200 });
  if (mcuRuntime.loadedHex) { mcuRuntime.assembly = null; cpu.load(mcuRuntime.loadedHex.image); }
  else {
    const assembly = assemble(config.source);
    mcuRuntime.assembly = assembly;
    if (!assembly.errors.length) cpu.load(toImage(assembly.bytes));
  }
  mcuRuntime.cpu = cpu;
  mcuRuntime.board = new TrainerBoard(cpu, config.wiring);
}
function mcuStop() { mcuRuntime.running = false; if (mcuRuntime.frame) cancelAnimationFrame(mcuRuntime.frame); mcuRuntime.frame = 0; }
function mcuStart() {
  const { cpu, assembly } = mcuRuntime;
  if (!cpu || assembly?.errors.length) { notify('Fix the assembly errors first.', 'error'); return; }
  if (cpu.halted) { notify(cpu.haltReason || 'The CPU has halted; press Reset.', 'error'); return; }
  mcuRuntime.running = true;
  mcuRuntime.last = performance.now();
  const tick = (now) => {
    if (!mcuRuntime.running) return;
    if (!document.querySelector('[data-mcu-root]')) { mcuStop(); return; }
    const config = mcuConfiguration(getState());
    const elapsed = Math.min(0.1, (now - mcuRuntime.last) / 1000);
    mcuRuntime.last = now;
    const budget = config.speed === 'max' ? 2_000_000 : Math.max(1, Math.round(cpu.clock / 12 * Number(config.speed) * elapsed));
    const result = cpu.run(budget, mcuRuntime.breakpoints);
    mcuDrainSerial();
    paintMcu();
    if (result.reason !== 'cycles') { mcuStop(); paintMcu(); notify(result.reason === 'breakpoint' ? `Breakpoint at ${hex4(result.pc)}` : cpu.haltReason || 'CPU halted', result.reason === 'breakpoint' ? 'success' : 'error'); return; }
    mcuRuntime.frame = requestAnimationFrame(tick);
  };
  mcuRuntime.frame = requestAnimationFrame(tick);
  paintMcu();
}
function mcuDrainSerial() {
  const output = mcuRuntime.cpu.serialOutput;
  if (!output.length) return;
  for (const byte of output) mcuRuntime.terminal += byte === 13 ? '' : byte === 10 || (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`;
  output.length = 0;
  if (mcuRuntime.terminal.length > 8000) mcuRuntime.terminal = mcuRuntime.terminal.slice(-6000);
}
const hex4 = (value) => `${value.toString(16).toUpperCase().padStart(4, '0')}H`;
const portBits = (value) => Array.from({ length: 8 }, (_, k) => `<i class="${(value >> (7 - k)) & 1 ? 'on' : ''}">${(value >> (7 - k)) & 1}</i>`).join('');
function mcuRegistersHtml(cpu) {
  const s = cpu.snapshot();
  const flags = [['CY', 7], ['AC', 6], ['F0', 5], ['RS1', 4], ['RS0', 3], ['OV', 2], ['P', 0]].map(([name, bit]) => `<span class="${(s.psw >> bit) & 1 ? 'on' : ''}">${name}</span>`).join('');
  const regs = s.registers.map((value, n) => `<div><span>R${n}</span><b>${hex2(value)}</b></div>`).join('');
  return `<div class="mcu-regs"><div><span>PC</span><b>${hex4(s.pc)}</b></div><div><span>A</span><b>${hex2(s.a)}</b></div><div><span>B</span><b>${hex2(s.b)}</b></div><div><span>SP</span><b>${hex2(s.sp)}</b></div><div><span>DPTR</span><b>${hex4(s.dptr)}</b></div><div><span>Bank</span><b>${s.bank}</b></div>${regs}</div>
    <div class="mcu-flags">${flags}</div>
    <div class="mcu-ports">${['P0', 'P1', 'P2', 'P3'].map((name, port) => `<div><span>${name}</span><code>${portBits(s.pins[port])}</code><b>${hex2(s.pins[port])}</b></div>`).join('')}</div>
    <div class="mcu-regs small"><div><span>TMOD</span><b>${hex2(s.tmod)}</b></div><div><span>TCON</span><b>${hex2(s.tcon)}</b></div><div><span>T0</span><b>${hex4(s.timer0)}</b></div><div><span>T1</span><b>${hex4(s.timer1)}</b></div><div><span>SCON</span><b>${hex2(s.scon)}</b></div><div><span>IE</span><b>${hex2(s.ie)}</b></div><div><span>IP</span><b>${hex2(s.ip)}</b></div></div>
    <p class="mcu-status">${s.instructions.toLocaleString()} instructions · ${s.cycles.toLocaleString()} machine cycles · ${eng(s.timeSeconds, 's')} at ${fmt(cpu.clock / 1e6, 6)} MHz${cpu.lastInterrupt ? ` · last interrupt: ${esc(cpu.lastInterrupt)}` : ''}</p>`;
}
function mcuRamHtml(cpu) {
  const rows = [];
  for (let base = 0; base < 0x80; base += 16) rows.push(`<div><span>${hex2(base)}</span>${Array.from({ length: 16 }, (_, k) => `<i class="${cpu.iram[base + k] ? 'nz' : ''}">${hex2(cpu.iram[base + k])}</i>`).join('')}</div>`);
  return rows.join('');
}
function mcuListingHtml() {
  const { cpu, assembly } = mcuRuntime;
  if (!assembly) {
    const lines = [];
    let address = cpu.pc;
    for (let k = 0; k < 18; k += 1) { const d = disassemble((a) => cpu.code[a], address); lines.push(`<div class="${address === cpu.pc ? 'current' : ''}${mcuRuntime.breakpoints.has(address) ? ' bp' : ''}" data-mcu-bp="${address}"><span>${hex4(address)}</span><code>${d.bytes.map(hex2).join(' ')}</code><b>${esc(d.text)}</b></div>`); address = (address + d.size) & 0xffff; }
    return lines.join('');
  }
  return assembly.listing.map((line) => {
    const current = line.address !== null && line.bytes.length && cpu.pc >= line.address && cpu.pc < line.address + line.bytes.length;
    const executable = line.address !== null && line.bytes.length;
    return `<div class="${current ? 'current' : ''}${executable && mcuRuntime.breakpoints.has(line.address) ? ' bp' : ''}${line.error ? ' err' : ''}" ${executable ? `data-mcu-bp="${line.address}"` : ''}><span>${line.address === null ? '' : hex4(line.address)}</span><code>${line.bytes.slice(0, 4).map(hex2).join(' ')}${line.bytes.length > 4 ? '…' : ''}</code><b>${esc(line.source.replace(/\t/g, '    '))}</b></div>`;
  }).join('');
}
function sevenSegmentSvg(segments) {
  const on = (bit) => (segments !== null && (segments >> bit) & 1 ? 'on' : '');
  return `<svg viewBox="0 0 60 100" class="mcu-seg" role="img" aria-label="Seven-segment display: ${segments === null ? 'off' : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].filter((_, bit) => (segments >> bit) & 1).join(' ') || 'no segments'} lit"><polygon class="${on(0)}" points="12,6 48,6 42,13 18,13"/><polygon class="${on(1)}" points="50,8 50,46 43,42 43,15"/><polygon class="${on(2)}" points="50,54 50,92 43,85 43,58"/><polygon class="${on(3)}" points="12,94 48,94 42,87 18,87"/><polygon class="${on(4)}" points="10,54 10,92 17,85 17,58"/><polygon class="${on(5)}" points="10,8 10,46 17,42 17,15"/><polygon class="${on(6)}" points="12,50 18,46 42,46 48,50 42,54 18,54"/><circle class="${on(7)}" cx="55" cy="93" r="3.5"/></svg>`;
}
function mcuBoardHtml(config) {
  const { board } = mcuRuntime;
  const view = board.view();
  const wiring = config.wiring;
  const parts = [];
  if (wiring.leds.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">LEDS · P${wiring.leds.port}</span><div class="mcu-leds">${view.leds.map((lit, bit) => `<div><i class="${lit ? 'lit' : ''}"></i><small>${bit}</small></div>`).reverse().join('')}</div></div>`);
  if (wiring.sevenSegment.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">7-SEGMENT · P${wiring.sevenSegment.port}</span>${sevenSegmentSvg(view.segments)}</div>`);
  if (wiring.lcd.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">LCD 16×2 · DATA P${wiring.lcd.dataPort}</span><div class="mcu-lcd ${view.lcd.on ? 'on' : ''}">${view.lcd.lines.map((line) => `<div>${esc(line).replaceAll(' ', '&nbsp;')}</div>`).join('')}</div></div>`);
  if (wiring.switches.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">DIP SWITCHES · P${wiring.switches.port} (down = closed = 0)</span><div class="mcu-switches">${Array.from({ length: 8 }, (_, k) => 7 - k).map((bit) => `<button class="${(board.switches >> bit) & 1 ? '' : 'closed'}" data-mcu-switch="${bit}"><i></i><small>${bit}</small></button>`).join('')}</div></div>`);
  if (wiring.buttons.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">PUSH BUTTONS (hold to press)</span><div class="mcu-buttons">${wiring.buttons.pins.map((pin, index) => `<button data-mcu-button="${index}" class="${board.buttons[index] ? 'pressed' : ''}">${esc(pin)}${pin === 'P3.2' ? ' · INT0' : pin === 'P3.3' ? ' · INT1' : ''}</button>`).join('')}</div></div>`);
  if (wiring.keypad.enabled) parts.push(`<div class="mcu-part"><span class="panel-label">4×4 KEYPAD · P${wiring.keypad.port} (rows 0–3, columns 4–7)</span><div class="mcu-keypad">${Array.from({ length: 16 }, (_, k) => `<button data-mcu-key="${Math.floor(k / 4)},${k % 4}" class="${board.keys.has(`${Math.floor(k / 4)},${k % 4}`) ? 'pressed' : ''}">${'0123456789ABCDEF'[k]}</button>`).join('')}</div></div>`);
  return parts.join('') || '<p class="module-footnote">No peripherals connected — enable some under Board wiring.</p>';
}
function paintMcu() {
  const root = document.querySelector('[data-mcu-root]');
  if (!root || !mcuRuntime.cpu) return;
  const config = mcuConfiguration(getState());
  const set = (selector, html) => { const element = root.querySelector(selector); if (element && element.innerHTML !== html) element.innerHTML = html; };
  set('[data-mcu-regs]', mcuRegistersHtml(mcuRuntime.cpu));
  set('[data-mcu-ram]', mcuRamHtml(mcuRuntime.cpu));
  set('[data-mcu-board]', mcuBoardHtml(config));
  const listing = root.querySelector('[data-mcu-listing]');
  if (listing) {
    const html = mcuListingHtml();
    if (listing.innerHTML !== html) { listing.innerHTML = html; listing.querySelector('.current')?.scrollIntoView({ block: 'nearest' }); }
  }
  const terminal = root.querySelector('[data-mcu-terminal]');
  if (terminal && terminal.textContent !== mcuRuntime.terminal) { terminal.textContent = mcuRuntime.terminal; terminal.scrollTop = terminal.scrollHeight; }
  const run = root.querySelector('[data-action="mcu-run"]');
  if (run) run.textContent = mcuRuntime.running ? 'Pause' : 'Run';
  paintAnalyzer('i8051', !mcuRuntime.running);
}
function renderMcuWiring(config) {
  const w = config.wiring;
  const portSelect = (path, value) => `<select data-mcu-wire="${path}">${[0, 1, 2, 3].map((port) => `<option value="${port}" ${port === value ? 'selected' : ''}>P${port}</option>`).join('')}</select>`;
  const check = (path, value, label) => `<label class="check-label"><input type="checkbox" data-mcu-wire="${path}" ${value ? 'checked' : ''}> ${label}</label>`;
  return `<details class="mcu-wiring"><summary>Board wiring</summary><div class="mcu-wiring-grid">
    <div>${check('leds.enabled', w.leds.enabled, 'LEDs on')}${portSelect('leds.port', w.leds.port)}${check('leds.activeLow', w.leds.activeLow, 'active low')}</div>
    <div>${check('switches.enabled', w.switches.enabled, 'DIP switches on')}${portSelect('switches.port', w.switches.port)}</div>
    <div>${check('buttons.enabled', w.buttons.enabled, 'Buttons on P3.2 / P3.3')}</div>
    <div>${check('sevenSegment.enabled', w.sevenSegment.enabled, '7-segment on')}${portSelect('sevenSegment.port', w.sevenSegment.port)}${check('sevenSegment.commonAnode', w.sevenSegment.commonAnode, 'common anode')}</div>
    <div>${check('lcd.enabled', w.lcd.enabled, 'LCD data on')}${portSelect('lcd.dataPort', w.lcd.dataPort)}<label>RS<input data-mcu-wire="lcd.rs" value="${esc(w.lcd.rs)}" size="4"></label><label>RW<input data-mcu-wire="lcd.rw" value="${esc(w.lcd.rw)}" size="4"></label><label>E<input data-mcu-wire="lcd.enable" value="${esc(w.lcd.enable)}" size="4"></label></div>
    <div>${check('keypad.enabled', w.keypad.enabled, '4×4 keypad on')}${portSelect('keypad.port', w.keypad.port)}</div>
  </div></details>`;
}
const MCU_TABS = [['8051', '8051 trainer'], ['arduino', 'Arduino Uno (ATmega328P)']];
export function renderMcu(state) {
  const module = modules.find((item) => item.id === 'mcu');
  const config = mcuConfiguration(state);
  const arduino = config.tab === 'arduino';
  return `<div class="page scroll-page mcu-page">${pageHeader(module, arduino ? 'BUILT-IN ARDUINO UNO SIMULATOR' : 'BUILT-IN 8051 SIMULATOR', '<span class="pill live"><i></i> LOCAL SIMULATION</span>')}
    ${labTabs(MCU_TABS, config.tab, 'data-mcu-tab')}${arduino ? renderUnoTab(config) : render8051Tab(config)}</div>`;
}
function render8051Tab(config) {
  mcuEnsure(config);
  const { assembly } = mcuRuntime;
  const errors = assembly?.errors || [];
  return `<div data-mcu-root>
    <div class="mcu-toolbar dsp-controls">
      ${labSelect('data-mcu-field', 'exampleId', 'Example program', config.exampleId, [...EXAMPLES_8051.map((example) => [example.id, example.name]), ['custom', 'My program']])}
      ${labSelect('data-mcu-field', 'speed', 'Speed', config.speed, MCU_SPEEDS)}
      ${labField('data-mcu-field', 'clockMHz', 'Crystal', config.clockMHz, 'MHz', 'type="number" step="0.0001" min="1" max="40"')}
      <label>Program file<input type="file" accept=".hex,.ihx,.asm,.a51,.txt" data-mcu-file></label>
      <button class="button primary" data-action="mcu-assemble">Assemble &amp; load</button><button class="button run" data-action="mcu-run">${mcuRuntime.running ? 'Pause' : 'Run'}</button><button class="button ghost" data-action="mcu-step">Step</button><button class="button ghost" data-action="mcu-reset">Reset</button><button class="button ghost" data-action="mcu-download-hex">Download HEX</button>
    </div>
    ${mcuRuntime.loadedHex ? `<div class="diagnostic warning"><b>HEX loaded</b><span>Running ${esc(mcuRuntime.loadedHex.name)} (${mcuRuntime.loadedHex.bytes} bytes). Edit the source and press “Assemble &amp; load” to go back to the assembler.</span></div>` : ''}
    <div class="mcu-layout">
      <section class="dsp-card mcu-editor"><span class="panel-label">ASSEMBLY SOURCE (A51 syntax)</span>
        <textarea data-mcu-source spellcheck="false" rows="28" aria-label="8051 assembly source">${esc(config.source)}</textarea>
        ${errors.length ? `<ul class="pcb-drc">${errors.slice(0, 12).map((error) => `<li class="error"><b>error</b> ${esc(error.message)}</li>`).join('')}</ul>` : `<p class="module-footnote">${assembly ? `${assembly.size} bytes of code · ${Object.keys(assembly.symbols).length} symbols` : ''}</p>`}
      </section>
      <section class="mcu-middle">
        <div class="dsp-card"><span class="panel-label">TRAINER BOARD</span><div class="mcu-board" data-mcu-board></div>${renderMcuWiring(config)}</div>
        <div class="dsp-card"><span class="panel-label">SERIAL TERMINAL (UART · TXD P3.1 / RXD P3.0)</span><pre class="mcu-terminal" data-mcu-terminal></pre>
          <div class="mcu-send"><input data-mcu-input placeholder="Type text and press Enter to send to RXD"><button class="button ghost" data-action="mcu-send">Send</button><button class="button ghost" data-action="mcu-clear-terminal">Clear</button></div></div>
      </section>
      <section class="mcu-right">
        <div class="dsp-card"><span class="panel-label">CPU</span><div data-mcu-regs></div></div>
        <div class="dsp-card"><span class="panel-label">LISTING (click a line for a breakpoint)</span><div class="mcu-listing" data-mcu-listing></div></div>
        <div class="dsp-card"><span class="panel-label">INTERNAL RAM 00–7F</span><div class="mcu-ram" data-mcu-ram></div></div>
      </section>
    </div>
    ${renderAnalyzerPanel('i8051')}
    <p class="module-footnote">Cycle-accurate MCS-51 core (12 clocks per machine cycle) with timers, UART and interrupts; validated against SDCC's assembler and the ucsim simulator. The LCD model ignores controller busy time.</p></div>`;
}
export function bindMcuEvents() {
  document.querySelectorAll('[data-mcu-tab]').forEach((button) => button.addEventListener('click', () => { mcuStop(); unoStop(); persistMcu({ tab: button.dataset.mcuTab }); }));
  document.querySelectorAll('[data-uno-root] [data-mcu-field]').forEach((field) => field.addEventListener('change', () => {
    if (field.dataset.mcuField === 'avrExampleId') { const example = AVR_EXAMPLES.find((entry) => entry.id === field.value); unoRuntime.hex = null; if (example) persistMcu({ avrExampleId: example.id, avrBoard: structuredClone(example.board) }); }
    else persistMcu({ [field.dataset.mcuField]: field.value });
  }));
  bindUnoEvents();
  const root = document.querySelector('[data-mcu-root]');
  if (!root) return;
  bindAnalyzerEvents('i8051');
  paintMcu();
  const config = () => mcuConfiguration(getState());
  const source = root.querySelector('[data-mcu-source]');
  source?.addEventListener('change', () => { if (source.value !== config().source) persistMcu({ source: source.value, exampleId: 'custom' }); });
  source?.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const { selectionStart: start, selectionEnd: end } = source; source.value = `${source.value.slice(0, start)}\t${source.value.slice(end)}`; source.selectionStart = source.selectionEnd = start + 1; } });
  root.querySelector('[data-action="mcu-assemble"]')?.addEventListener('mousedown', (event) => event.preventDefault());
  root.querySelector('[data-action="mcu-assemble"]')?.addEventListener('click', () => {
    mcuRuntime.loadedHex = null; mcuRuntime.key = null;
    const text = source?.value ?? config().source;
    persistMcu({ source: text, exampleId: text === config().source ? config().exampleId : 'custom' });
    const errors = mcuRuntime.assembly?.errors.length;
    notify(errors ? `${errors} assembly error(s)` : 'Assembled and loaded', errors ? 'error' : 'success');
  });
  root.querySelector('[data-action="mcu-run"]')?.addEventListener('click', () => { if (mcuRuntime.running) { mcuStop(); paintMcu(); } else mcuStart(); });
  root.querySelector('[data-action="mcu-step"]')?.addEventListener('click', () => { mcuStop(); if (mcuRuntime.cpu && !mcuRuntime.assembly?.errors.length) { mcuRuntime.cpu.step(); mcuDrainSerial(); paintMcu(); } });
  root.querySelector('[data-action="mcu-reset"]')?.addEventListener('click', () => { mcuStop(); mcuRuntime.cpu?.reset(); mcuRuntime.board?.lcd.reset(); mcuRuntime.board?.update(); mcuRuntime.terminal = ''; paintMcu(); });
  root.querySelectorAll('[data-mcu-field]').forEach((field) => field.addEventListener('change', () => {
    const name = field.dataset.mcuField;
    if (name === 'exampleId') {
      const example = EXAMPLES_8051.find((entry) => entry.id === field.value);
      if (example) { mcuRuntime.loadedHex = null; mcuRuntime.breakpoints.clear(); persistMcu({ exampleId: example.id, source: example.source, wiring: structuredClone(example.wiring) }); }
      return;
    }
    persistMcu({ [name]: name === 'clockMHz' ? Math.min(40, Math.max(1, Number(field.value) || 11.0592)) : field.value });
  }));
  root.querySelector('[data-mcu-file]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) { notify('That file is too large.', 'error'); return; }
    const text = await file.text();
    if (/\.(hex|ihx)$/i.test(file.name)) {
      try { const parsed = parseIntelHex(text); mcuRuntime.loadedHex = { name: file.name, image: parsed.image, bytes: parsed.bytes }; mcuRuntime.key = null; rerender(); notify(`Loaded ${parsed.bytes} bytes from ${file.name}`, 'success'); }
      catch (error) { reportError(error); }
    } else { mcuRuntime.loadedHex = null; persistMcu({ source: text, exampleId: 'custom' }); }
  });
  root.querySelector('[data-action="mcu-download-hex"]')?.addEventListener('click', () => {
    const { assembly } = mcuRuntime;
    if (!assembly || assembly.errors.length) { notify('Assemble the program without errors first.', 'error'); return; }
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([toIntelHex(assembly.bytes)], { type: 'text/plain' })); link.download = 'program.hex'; link.click(); URL.revokeObjectURL(link.href);
  });
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-mcu-switch],[data-mcu-bp]');
    if (!target) return;
    if (target.dataset.mcuSwitch !== undefined) { const bit = Number(target.dataset.mcuSwitch); mcuRuntime.board.setSwitches(mcuRuntime.board.switches ^ (1 << bit)); paintMcu(); }
    else { const address = Number(target.dataset.mcuBp); if (mcuRuntime.breakpoints.has(address)) mcuRuntime.breakpoints.delete(address); else mcuRuntime.breakpoints.add(address); paintMcu(); }
  });
  const press = (event, down) => {
    const button = event.target.closest('[data-mcu-button],[data-mcu-key]');
    if (!button) return;
    if (button.dataset.mcuButton !== undefined) mcuRuntime.board.setButton(Number(button.dataset.mcuButton), down);
    else { const [row, column] = button.dataset.mcuKey.split(',').map(Number); mcuRuntime.board.setKey(row, column, down); }
    paintMcu();
  };
  root.addEventListener('pointerdown', (event) => press(event, true));
  root.addEventListener('pointerup', (event) => press(event, false));
  root.addEventListener('pointerleave', () => { mcuRuntime.board?.buttons.forEach((_, index) => mcuRuntime.board.setButton(index, false)); mcuRuntime.board?.keys.clear(); mcuRuntime.board?.update(); }, true);
  const input = root.querySelector('[data-mcu-input]');
  const send = () => { if (!input?.value) return; mcuRuntime.cpu.receive([...input.value].map((character) => character.charCodeAt(0) & 0xff)); input.value = ''; };
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); send(); } });
  root.querySelector('[data-action="mcu-send"]')?.addEventListener('click', send);
  root.querySelector('[data-action="mcu-clear-terminal"]')?.addEventListener('click', () => { mcuRuntime.terminal = ''; paintMcu(); });
  root.querySelectorAll('[data-mcu-wire]').forEach((field) => field.addEventListener('change', () => {
    const wiring = structuredClone(config().wiring);
    const [group, key] = field.dataset.mcuWire.split('.');
    wiring[group][key] = field.type === 'checkbox' ? field.checked : key === 'port' || key === 'dataPort' ? Number(field.value) : field.value.trim().toUpperCase();
    try { new TrainerBoard(new Cpu8051(), wiring); persistMcu({ wiring }); } catch (error) { reportError(error); }
  }));
  if (mcuRuntime.running && !mcuRuntime.frame) mcuStart();
}
export const unoRuntime = { board: null, key: null, running: false, frame: 0, last: 0, terminal: '', hex: null, speedHistory: [] };
const UNO_SPEEDS = [['1', 'Real time'], ['0.1', '10 %'], ['max', 'As fast as possible']];
function unoExample(config) { return AVR_EXAMPLES.find((entry) => entry.id === config.avrExampleId) || AVR_EXAMPLES[0]; }
function unoEnsure(config) {
  const example = unoExample(config);
  const hex = unoRuntime.hex?.text || example.hex;
  const cosim = cosimConfiguration(config);
  const circuit = getState().project.circuit;
  const key = JSON.stringify([hex.length, unoRuntime.hex?.name, example.id, config.avrBoard, cosim.enabled ? [cosim.connections, cosim.probes, cosim.maxStep, circuit.components, circuit.wires, circuit.netLabels] : null]);
  if (unoRuntime.key === key && unoRuntime.board) return;
  unoStop();
  unoRuntime.key = key;
  unoRuntime.terminal = '';
  unoRuntime.board = new UnoBoard(hex, config.avrBoard || example.board);
  unoRuntime.cosim = null; unoRuntime.cosimError = null;
  if (cosim.enabled) {
    try { unoRuntime.cosim = createCoSimulation(unoRuntime.board, { components: circuit.components, wires: circuit.wires, netLabels: circuit.netLabels, connections: cosim.connections, probes: cosim.probes, maxStep: cosim.maxStep, historyLimit: 40_000 }); }
    catch (error) { unoRuntime.cosimError = error.message; }
  }
}
function unoStop() { unoRuntime.running = false; if (unoRuntime.frame) cancelAnimationFrame(unoRuntime.frame); unoRuntime.frame = 0; }
function unoStart() {
  const { board } = unoRuntime;
  if (!board) return;
  if (board.cpu.halted) { notify(board.cpu.haltReason || 'The CPU stopped; press Reset.', 'error'); return; }
  unoRuntime.running = true;
  unoRuntime.last = performance.now();
  const tick = (now) => {
    if (!unoRuntime.running) return;
    if (!document.querySelector('[data-uno-root]')) { unoStop(); return; }
    const config = mcuConfiguration(getState());
    const elapsed = Math.min(0.1, (now - unoRuntime.last) / 1000);
    unoRuntime.last = now;
    const target = config.avrSpeed === 'max' ? Infinity : board.cpu.clock * Number(config.avrSpeed || 1) * elapsed;
    // Run in slices but never spend more than ~14 ms of a frame simulating.
    const started = performance.now(), cyclesBefore = board.cpu.cycles;
    const cosim = unoRuntime.cosim;
    while (board.cpu.cycles - cyclesBefore < target && performance.now() - started < 14 && !board.cpu.halted) {
      const chunk = Math.min(20_000, Math.max(1, target - (board.cpu.cycles - cyclesBefore)));
      if (cosim) cosim.advance(chunk / board.cpu.clock); else board.cpu.run(chunk);
    }
    const ran = board.cpu.cycles - cyclesBefore;
    unoRuntime.speedHistory.push(elapsed ? ran / board.cpu.clock / elapsed : 0);
    if (unoRuntime.speedHistory.length > 30) unoRuntime.speedHistory.shift();
    unoDrainSerial();
    paintUno();
    if (board.cpu.halted) { unoStop(); paintUno(); notify(board.cpu.haltReason || 'CPU stopped', 'error'); return; }
    unoRuntime.frame = requestAnimationFrame(tick);
  };
  unoRuntime.frame = requestAnimationFrame(tick);
  paintUno();
}
function unoDrainSerial() {
  const output = unoRuntime.board.mcu.usart.output;
  if (!output.length) return;
  for (const byte of output) unoRuntime.terminal += byte === 13 ? '' : byte === 10 || (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '·';
  output.length = 0;
  if (unoRuntime.terminal.length > 12_000) unoRuntime.terminal = unoRuntime.terminal.slice(-9000);
}
function unoBoardHtml() {
  const { board } = unoRuntime;
  const view = board.view();
  const pinCell = (pin) => `<div class="uno-pin ${pin.output ? 'out' : 'in'} ${pin.level ? 'high' : 'low'}" title="${pin.label}: ${pin.output ? 'OUTPUT' : pin.pullUp ? 'INPUT_PULLUP' : 'INPUT'} · ${pin.level ? 'HIGH' : 'LOW'}"><b>${pin.label}</b><i style="--glow:${pin.output ? pin.brightness : 0}"></i><small>${pin.output ? 'OUT' : pin.pullUp ? 'PU' : 'IN'}</small></div>`;
  const leds = view.leds.map((led) => `<div class="uno-led"><i style="--glow:${led.brightness.toFixed(3)}"></i><small>${esc(String(led.pin))}${led.brightness > 0 && led.brightness < 1 ? ` · ${Math.round(led.brightness * 100)} %` : ''}</small></div>`).join('');
  const buttons = board.board.buttons.map((button) => `<button class="${board.pressed.has(String(button.pin)) ? 'pressed' : ''}" data-uno-button="${esc(String(button.pin))}">Button · pin ${esc(String(button.pin))} → ${button.to}</button>`).join('');
  const pots = board.board.pots.map((pot) => `<label class="uno-pot">${esc(pot.label || `Potentiometer ${pot.pin}`)} <input type="range" min="0" max="5" step="0.01" value="${pot.volts}" data-uno-pot="${esc(pot.pin)}"><b>${fmt(pot.volts, 3)} V</b></label>`).join('');
  return `<div class="uno-header"><span class="panel-label">ARDUINO UNO PINS</span><div class="uno-pins">${view.pins.map(pinCell).join('')}</div></div>
    ${leds ? `<div class="mcu-part"><span class="panel-label">LEDS</span><div class="uno-leds">${leds}</div></div>` : ''}
    ${buttons ? `<div class="mcu-part"><span class="panel-label">BUTTONS (hold to press)</span><div class="mcu-buttons">${buttons}</div></div>` : ''}
    ${pots ? `<div class="mcu-part"><span class="panel-label">ANALOG INPUTS</span>${pots}</div>` : ''}
    ${view.lcd ? `<div class="mcu-part"><span class="panel-label">LCD 16×2 (LiquidCrystal)</span><div class="mcu-lcd ${view.lcd.on ? 'on' : ''}">${view.lcd.lines.map((line) => `<div>${esc(line).replaceAll(' ', '&nbsp;')}</div>`).join('')}</div></div>` : ''}`;
}
function unoCpuHtml() {
  const { cpu } = unoRuntime.board;
  const sreg = cpu.sreg;
  const flags = ['C', 'Z', 'N', 'V', 'S', 'H', 'T', 'I'].map((name, bit) => `<span class="${(sreg >> bit) & 1 ? 'on' : ''}">${name}</span>`).reverse().join('');
  const regs = Array.from({ length: 32 }, (_, n) => `<div><span>R${n}</span><b>${hex2(cpu.data[n])}</b></div>`).join('');
  const speed = unoRuntime.speedHistory.length ? unoRuntime.speedHistory.reduce((a, b) => a + b, 0) / unoRuntime.speedHistory.length : 0;
  return `<div class="mcu-regs"><div><span>PC</span><b>${(cpu.pc * 2).toString(16).toUpperCase().padStart(4, '0')}</b></div><div><span>SP</span><b>${cpu.sp.toString(16).toUpperCase().padStart(4, '0')}</b></div>${regs}</div>
    <div class="mcu-flags">${flags}</div>
    <p class="mcu-status">${cpu.instructions.toLocaleString()} instructions · ${cpu.cycles.toLocaleString()} cycles · ${eng(cpu.cycles / cpu.clock, 's')} simulated${unoRuntime.running ? ` · running at ${Math.round(speed * 100)} % of real time` : ''} · UART ${Math.round(unoRuntime.board.mcu.usart.baud())} baud</p>`;
}
// Arduino + circuit co-simulation panel.
const cosimPart = (id, type, value, unit, n1, n2, x, y, rotation = 0) => ({ id, type, label: id, value, unit, n1, n2, x, y, rotation });
const COSIM_EXAMPLES = Object.freeze([
  { id: 'pwm-dac', name: 'PWM DAC: D9 → RC filter → A0', sketch: 'pwm_dac', maxStep: 50e-6, window: 0.01, connections: [{ pin: 'D9', node: 'pwm' }, { pin: 'A0', node: 'out' }], probes: [],
    components: [cosimPart('R1', 'resistor', 10_000, 'Ω', 'pwm', 'out', 300, 120), cosimPart('C1', 'capacitor', 10e-6, 'F', 'out', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 460, 300)] },
  { id: 'rc-timer', name: 'RC time constant: D8 charges C, A0 times it', sketch: 'rc_timer', maxStep: 50e-6, window: 0.5, connections: [{ pin: 'D8', node: 'drive' }, { pin: 'A0', node: 'cap' }], probes: [],
    components: [cosimPart('R1', 'resistor', 10_000, 'Ω', 'drive', 'cap', 300, 120), cosimPart('C1', 'capacitor', 10e-6, 'F', 'cap', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 460, 300)] },
  { id: 'divider', name: 'Voltage divider into A0 (analogRead)', sketch: 'analog_read', maxStep: 200e-6, window: 0.05, connections: [{ pin: 'A0', node: 'a0' }], probes: ['vcc'],
    components: [cosimPart('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 200), cosimPart('R1', 'resistor', 10_000, 'Ω', 'vcc', 'a0', 300, 120), cosimPart('R2', 'resistor', 4700, 'Ω', 'a0', '0', 460, 200), cosimPart('GND', 'ground', 0, 'V', '0', '0', 300, 300)] },
  { id: 'transistor-led', name: 'Transistor switch: D13 → NPN drives an LED', sketch: 'blink', maxStep: 200e-6, window: 2, connections: [{ pin: 'D13', node: 'd13' }], probes: ['b', 'c'],
    components: [cosimPart('V1', 'voltage', 5, 'V', 'vcc', '0', 120, 200), cosimPart('RL', 'resistor', 220, 'Ω', 'vcc', 'a', 300, 80), cosimPart('D1', 'led', 2, 'Vf', 'a', 'c', 460, 80), { id: 'Q1', type: 'npn', label: 'Q1', value: 100, unit: 'β', n1: 'c', n2: 'b', n3: '0', x: 600, y: 200, rotation: 0 }, cosimPart('RB', 'resistor', 1000, 'Ω', 'd13', 'b', 460, 260), cosimPart('GND', 'ground', 0, 'V', '0', '0', 600, 320)] },
]);
const COSIM_STEPS = [[10e-6, '10 µs'], [20e-6, '20 µs'], [50e-6, '50 µs'], [100e-6, '100 µs'], [200e-6, '200 µs']];
const COSIM_WINDOWS = [[0.005, '5 ms'], [0.01, '10 ms'], [0.05, '50 ms'], [0.2, '200 ms'], [0.5, '500 ms'], [2, '2 s']];
const COSIM_DEFAULTS = Object.freeze({ enabled: false, connections: [{ pin: 'D9', node: '' }], probes: [], maxStep: 50e-6, window: 0.01 });
function cosimConfiguration(config) { return { ...structuredClone(COSIM_DEFAULTS), ...(config.avrCosim || {}) }; }
function persistCosim(patch) { const config = mcuConfiguration(getState()); persistMcu({ avrCosim: { ...cosimConfiguration(config), ...patch } }); }
function loadCosimExample(id) {
  const example = COSIM_EXAMPLES.find((entry) => entry.id === id);
  const sketch = AVR_EXAMPLES.find((entry) => entry.id === example?.sketch);
  if (!example || !sketch) return;
  updateProject((project) => { project.circuit.components = structuredClone(example.components); project.circuit.wires = []; project.circuit.junctions = []; project.circuit.netLabels = []; });
  unoRuntime.hex = null;
  persistMcu({ avrExampleId: sketch.id, avrBoard: structuredClone(sketch.board), avrCosim: { enabled: true, connections: structuredClone(example.connections), probes: [...example.probes], maxStep: example.maxStep, window: example.window } });
  notify(`${example.name}: circuit loaded into Circuit Lab. Press Run.`, 'success');
}
function cosimPlotHtml() {
  const cosim = unoRuntime.cosim;
  if (!cosim) return '';
  const config = cosimConfiguration(mcuConfiguration(getState()));
  const { time, nodes } = cosim.history;
  if (time.length < 2) return '<p class="field-help">Press Run to start both simulators.</p>';
  const end = time.at(-1), start = Math.max(0, end - config.window);
  let first = time.length - 1;
  while (first > 0 && time[first - 1] >= start) first -= 1;
  const xs = time.slice(first);
  const series = Object.entries(nodes).map(([node, values], index) => ({ ...decimate(xs, values.slice(first)), color: PLOT_COLORS[index % PLOT_COLORS.length], primary: index === 0, node }));
  const all = series.flatMap((entry) => entry.ys);
  const range = niceRange(Math.min(0, ...all), Math.max(5, ...all));
  const span = Math.max(config.window, end - start);
  const xTicks = Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: eng(start + span * k / 5, 's') }));
  return `${renderPlotFrame({ title: 'Circuit node voltages', series, xMin: start, xMax: start + span, xTicks, yRange: range, formatY: (value) => eng(value, 'V') })}<div class="plot-legend">${series.map((entry) => `<span class="legend-chip" style="--chip:${entry.color}">V(${esc(entry.node)})</span>`).join('')}</div>`;
}
function cosimReadoutHtml() {
  const cosim = unoRuntime.cosim;
  if (!cosim) return '';
  const D = unoRuntime.board.cpu.data;
  return cosim.pins.map((pin) => {
    const output = (D[pin.port.ddr] >> pin.bit) & 1, pull = (D[pin.port.port] >> pin.bit) & 1;
    const mode = output ? `OUTPUT ${(pin.port.levels() >> pin.bit) & 1 ? 'HIGH' : 'LOW'}${pin.port.override[pin.bit] !== null ? ' (PWM)' : ''}` : pull ? 'INPUT_PULLUP' : 'INPUT';
    return readout(`${pin.label} ↔ ${pin.node} · ${mode}`, eng(Math.abs(pin.volts ?? 0) < 1e-4 ? 0 : pin.volts, 'V'));
  }).join('');
}
function renderCosimPanel(config) {
  const cosim = cosimConfiguration(config);
  const { components, wires, netLabels } = getState().project.circuit;
  let nodes = [];
  try { nodes = circuitNodes(components, wires, netLabels); } catch { nodes = []; }
  const nodeOptions = [['', '— not connected —'], ...nodes.map((node) => [node, node === '0' ? '0 (ground)' : node])];
  const rows = cosim.connections.map((connection, index) => `<div class="cosim-row">${labSelect('data-cosim-pin', index, 'Arduino pin', connection.pin, PIN_LABELS.map((label) => [label, label]))}${labSelect('data-cosim-node', index, 'Circuit node', connection.node, nodeOptions)}<button class="tool" data-cosim-remove="${index}" aria-label="Remove connection">Remove</button></div>`).join('');
  const probes = nodes.filter((node) => node !== '0').map((node) => `<label class="check-label"><input type="checkbox" data-cosim-probe="${esc(node)}" ${cosim.probes.includes(node) ? 'checked' : ''}> ${esc(node)}</label>`).join('');
  return `<div class="dsp-card cosim-card"><span class="panel-label">CIRCUIT CO-SIMULATION · ARDUINO PINS ↔ CIRCUIT LAB</span>
    <div class="dsp-controls"><label class="check-label"><input type="checkbox" data-cosim-enabled ${cosim.enabled ? 'checked' : ''}> Connect the board to the Circuit Lab circuit</label>
      <label>Ready experiment<select data-cosim-example><option value="">Choose…</option>${COSIM_EXAMPLES.map((example) => `<option value="${example.id}">${esc(example.name)}</option>`).join('')}</select></label>
      ${labSelect('data-cosim-field', 'maxStep', 'Circuit time step', cosim.maxStep, COSIM_STEPS)}${labSelect('data-cosim-field', 'window', 'Plot window', cosim.window, COSIM_WINDOWS)}<button class="button ghost" data-module="circuit">Edit circuit</button></div>
    ${cosim.enabled ? `${unoRuntime.cosimError ? `<div class="diagnostic error"><b>Co-simulation</b><span>${esc(unoRuntime.cosimError)}</span></div>` : ''}
    <div class="cosim-layout"><div><span class="panel-label">CONNECTIONS</span>${rows}<button class="tool" data-action="cosim-add">+ Connect another pin</button>${probes ? `<div class="cosim-probes"><span class="panel-label">ALSO PLOT</span>${probes}</div>` : ''}<div class="cosim-readout" data-uno-cosim-readout></div></div>
    <div data-uno-cosim-plot></div></div>
    <p class="field-help">The CPU runs until a connected pin changes, then the circuit solver catches up to that instant, so PWM and digital edges reach the circuit at their exact time. Outputs drive through 25 Ω, INPUT_PULLUP is 35 kΩ to 5 V, and inputs switch at 1.5 V / 3.0 V (Schmitt trigger). Analog pins feed the ADC.</p>` : '<p class="field-help">Wire Arduino pins to nodes of the Circuit Lab circuit (for example a PWM pin into an RC filter read back on A0) and run both simulators together.</p>'}</div>`;
}
function bindCosimEvents() {
  const root = document.querySelector('[data-uno-root]');
  if (!root) return;
  const config = () => cosimConfiguration(mcuConfiguration(getState()));
  root.querySelector('[data-cosim-enabled]')?.addEventListener('change', (event) => persistCosim({ enabled: event.target.checked }));
  root.querySelector('[data-cosim-example]')?.addEventListener('change', (event) => { if (event.target.value) loadCosimExample(event.target.value); });
  root.querySelectorAll('[data-cosim-field]').forEach((select) => select.addEventListener('change', () => persistCosim({ [select.dataset.cosimField]: Number(select.value) })));
  const editConnection = (index, patch) => { const connections = config().connections.map((entry, k) => (k === index ? { ...entry, ...patch } : entry)); persistCosim({ connections }); };
  root.querySelectorAll('[data-cosim-pin]').forEach((select) => select.addEventListener('change', () => editConnection(Number(select.dataset.cosimPin), { pin: select.value })));
  root.querySelectorAll('[data-cosim-node]').forEach((select) => select.addEventListener('change', () => editConnection(Number(select.dataset.cosimNode), { node: select.value })));
  root.querySelectorAll('[data-cosim-remove]').forEach((button) => button.addEventListener('click', () => persistCosim({ connections: config().connections.filter((_, k) => k !== Number(button.dataset.cosimRemove)) })));
  root.querySelector('[data-action="cosim-add"]')?.addEventListener('click', () => { const used = new Set(config().connections.map((entry) => entry.pin)); persistCosim({ connections: [...config().connections, { pin: PIN_LABELS.find((label) => !used.has(label)) ?? 'D2', node: '' }] }); });
  root.querySelectorAll('[data-cosim-probe]').forEach((input) => input.addEventListener('change', () => { const probes = new Set(config().probes); if (input.checked) probes.add(input.dataset.cosimProbe); else probes.delete(input.dataset.cosimProbe); persistCosim({ probes: [...probes] }); }));
}
function paintUno() {
  const root = document.querySelector('[data-uno-root]');
  if (!root || !unoRuntime.board) return;
  const set = (selector, html) => { const element = root.querySelector(selector); if (element && element.innerHTML !== html) element.innerHTML = html; };
  set('[data-uno-board]', unoBoardHtml());
  set('[data-uno-cpu]', unoCpuHtml());
  const terminal = root.querySelector('[data-uno-terminal]');
  if (terminal && terminal.textContent !== unoRuntime.terminal) { terminal.textContent = unoRuntime.terminal; terminal.scrollTop = terminal.scrollHeight; }
  const run = root.querySelector('[data-action="uno-run"]');
  if (run) run.textContent = unoRuntime.running ? 'Pause' : 'Run';
  paintAnalyzer('uno', !unoRuntime.running);
  if (unoRuntime.cosim) {
    set('[data-uno-cosim-readout]', cosimReadoutHtml());
    const now = performance.now();
    if (!unoRuntime.running || now - (unoRuntime.cosimPainted || 0) > 150) { unoRuntime.cosimPainted = now; set('[data-uno-cosim-plot]', cosimPlotHtml()); }
  }
}
function renderUnoTab(config) {
  unoEnsure(config);
  const example = unoExample(config);
  const board = config.avrBoard || example.board;
  const pinsText = (list) => list.map((entry) => (typeof entry === 'object' ? entry.pin : entry)).join(', ');
  return `<div data-uno-root>
    <div class="mcu-toolbar dsp-controls">
      ${labSelect('data-mcu-field', 'avrExampleId', 'Arduino example', config.avrExampleId, AVR_EXAMPLES.map((entry) => [entry.id, entry.name]))}
      ${labSelect('data-mcu-field', 'avrSpeed', 'Speed', config.avrSpeed, UNO_SPEEDS)}
      <label>Compiled sketch (.hex)<input type="file" accept=".hex,.ihx" data-uno-file></label>
      <button class="button run" data-action="uno-run">${unoRuntime.running ? 'Pause' : 'Run'}</button><button class="button ghost" data-action="uno-reset">Reset</button>
    </div>
    ${unoRuntime.hex ? `<div class="diagnostic warning"><b>Your sketch</b><span>Running ${esc(unoRuntime.hex.name)} (${unoRuntime.hex.bytes} bytes). Pick an example to go back to the built-in sketches.</span></div>` : ''}
    <div class="mcu-layout">
      <section class="dsp-card mcu-editor"><span class="panel-label">${unoRuntime.hex ? 'YOUR SKETCH (compiled HEX loaded)' : `SKETCH · ${esc(example.id)}.ino (${example.flashBytes} bytes of flash)`}</span>
        <textarea readonly spellcheck="false" rows="22" aria-label="Example program source (read only)">${esc(unoRuntime.hex ? '// Source is not available for an uploaded HEX file.' : example.source)}</textarea>
        <p class="module-footnote">To run your own sketch: in the Arduino IDE choose Sketch → Export Compiled Binary (or run <code>arduino-cli compile --output-dir . </code>) and load the <code>.hex</code> file above — the board must be Arduino Uno. The built-in examples were compiled with the official Arduino AVR core.</p>
      </section>
      <section class="mcu-middle">
        <div class="dsp-card"><div class="mcu-board" data-uno-board></div>
          <details class="mcu-wiring"><summary>Board wiring</summary><div class="mcu-wiring-grid">
            <label>LED pins<input data-uno-wire="leds" value="${esc(pinsText(board.leds))}" placeholder="13, 9"></label>
            <label>Buttons to GND<input data-uno-wire="buttons" value="${esc(pinsText(board.buttons))}" placeholder="2, 3"></label>
            <label>Potentiometers<input data-uno-wire="pots" value="${esc(pinsText(board.pots))}" placeholder="A0, A1"></label>
            <label class="check-label"><input type="checkbox" data-uno-wire="lcd" ${board.lcd ? 'checked' : ''}> LCD on 12, 11, 5, 4, 3, 2</label>
          </div></details></div>
        <div class="dsp-card"><span class="panel-label">SERIAL MONITOR</span><pre class="mcu-terminal" data-uno-terminal></pre>
          <div class="mcu-send"><input data-uno-input placeholder="Send text (newline added)"><button class="button ghost" data-action="uno-send">Send</button><button class="button ghost" data-action="uno-clear">Clear</button></div></div>
      </section>
      <section class="mcu-right"><div class="dsp-card"><span class="panel-label">ATMEGA328P · 16 MHz</span><div data-uno-cpu></div></div></section>
    </div>
    ${renderCosimPanel(config)}
    ${renderAnalyzerPanel('uno')}
    <p class="module-footnote">Instruction-level ATmega328P model (timers with PWM on the OCnx pins, USART, ADC, external and pin-change interrupts, EEPROM, SPI, TWI with an I²C LCD backpack and DS1307 RTC); register results and cycle counts match simavr on 190 test programs, and interrupt and PWM timing follow the datasheet.</p></div>`;
}
function bindUnoEvents() {
  const root = document.querySelector('[data-uno-root]');
  if (!root) return;
  bindAnalyzerEvents('uno');
  paintUno();
  root.querySelector('[data-action="uno-run"]')?.addEventListener('click', () => { if (unoRuntime.running) { unoStop(); paintUno(); } else unoStart(); });
  root.querySelector('[data-action="uno-reset"]')?.addEventListener('click', () => { unoStop(); if (unoRuntime.cosim) { unoRuntime.key = null; rerender(); return; } unoRuntime.board.reset(); unoRuntime.terminal = ''; paintUno(); });
  bindCosimEvents();
  root.querySelector('[data-uno-file]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) { notify('That file is too large for an ATmega328P.', 'error'); return; }
    try { const text = await file.text(); const parsed = parseIntelHex(text); if (parsed.size > 32_768) throw new RangeError('The program is larger than 32 KB of flash.'); unoRuntime.hex = { name: file.name, text, bytes: parsed.bytes }; unoRuntime.key = null; rerender(); notify(`Loaded ${file.name}`, 'success'); }
    catch (error) { reportError(error); }
  });
  const input = root.querySelector('[data-uno-input]');
  const send = () => { if (!input) return; unoRuntime.board.mcu.usart.receive([...`${input.value}\n`].map((character) => character.charCodeAt(0) & 0xff)); input.value = ''; };
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); send(); } });
  root.querySelector('[data-action="uno-send"]')?.addEventListener('click', send);
  root.querySelector('[data-action="uno-clear"]')?.addEventListener('click', () => { unoRuntime.terminal = ''; paintUno(); });
  root.addEventListener('pointerdown', (event) => { const button = event.target.closest('[data-uno-button]'); if (button) { unoRuntime.board.press(button.dataset.unoButton, true); paintUno(); } });
  root.addEventListener('pointerup', (event) => { const button = event.target.closest('[data-uno-button]'); if (button) { unoRuntime.board.press(button.dataset.unoButton, false); paintUno(); } });
  root.addEventListener('input', (event) => { const pot = event.target.closest('[data-uno-pot]'); if (pot) { unoRuntime.board.setPot(pot.dataset.unoPot, Number(pot.value)); paintUno(); } });
  root.querySelectorAll('[data-uno-wire]').forEach((field) => field.addEventListener('change', () => {
    const config = mcuConfiguration(getState());
    const board = structuredClone(config.avrBoard || unoExample(config).board);
    const list = field.value.split(/[\s,;]+/).filter(Boolean);
    try {
      list.forEach((pin) => unoPin(/^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase()));
      const kind = field.dataset.unoWire;
      if (kind === 'leds') board.leds = list.map((pin) => (/^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase()));
      else if (kind === 'buttons') board.buttons = list.map((pin) => ({ pin: /^\d+$/.test(pin) ? Number(pin) : pin.toUpperCase(), to: 'GND' }));
      else if (kind === 'pots') board.pots = list.map((pin) => ({ pin: pin.toUpperCase(), volts: board.pots.find((pot) => pot.pin === pin.toUpperCase())?.volts ?? 2.5 }));
      else board.lcd = field.checked ? { rs: 12, enable: 11, d4: 5, d5: 4, d6: 3, d7: 2 } : null;
      persistMcu({ avrBoard: board });
    } catch (error) { reportError(error); }
  }));
  if (unoRuntime.running && !unoRuntime.frame) unoStart();
}
const LA_WINDOWS = [['0.5', '0.5 ms'], ['2', '2 ms'], ['10', '10 ms'], ['50', '50 ms'], ['200', '200 ms'], ['1000', '1 s'], ['5000', '5 s']];
const LA_DEFAULTS = {
  uno: { windowMs: '10', channels: ['D1', 'D2', 'D9', 'D10', 'D11', 'D13', 'A4', 'A5'], decoders: [{ type: 'uart', rx: 'D1', baud: 'auto', parity: 'none' }, { type: 'spi', sck: 'D13', mosi: 'D11', miso: 'D12', cs: 'D10', mode: 0 }, { type: 'i2c', scl: 'A5', sda: 'A4' }] },
  i8051: { windowMs: '50', channels: ['P1.0', 'P1.1', 'P1.2', 'P1.3', 'P3.1', 'P3.2'], decoders: [{ type: 'uart', rx: 'P3.1', baud: 'auto', parity: 'none' }] },
};
const laState = { frozen: { uno: false, i8051: false }, offset: { uno: 0, i8051: 0 }, imported: { uno: null, i8051: null }, lastPaint: 0 };
function laConfig(target) {
  const config = mcuConfiguration(getState());
  return { ...LA_DEFAULTS[target], ...(config.analyzer?.[target] || {}) };
}
function persistLa(target, patch) {
  const config = mcuConfiguration(getState());
  persistMcu({ analyzer: { ...(config.analyzer || {}), [target]: { ...laConfig(target), ...patch } } });
}
function laSource(target) {
  if (laState.imported[target]) return { channels: laState.imported[target].channels, end: laState.imported[target].end, imported: true };
  const recorder = target === 'uno' ? unoRuntime.board?.recorder : mcuRuntime.board?.recorder;
  if (!recorder) return null;
  // The view ends at the most recent activity, so bursts stay on screen after the line goes idle.
  const now = target === 'uno' ? unoRuntime.board.cpu.cycles / unoRuntime.board.cpu.clock : mcuRuntime.cpu.cycles * 12 / mcuRuntime.cpu.clock;
  return { channels: recorder.list(), end: recorder.end > 0 ? recorder.end + 0.05 * Number(laConfig(target).windowMs) / 1000 : now, imported: false };
}
function laDecode(decoder, byName, from, to) {
  const ch = (name) => byName.get(name);
  const margin = 0.02 * (to - from) + 2e-3;
  if (decoder.type === 'uart') {
    const rx = ch(decoder.rx);
    if (!rx) return [];
    const baud = decoder.baud === 'auto' ? estimateBaud(sliceChannel(rx, from - 0.2, to)) || 9600 : Number(decoder.baud);
    return decodeUart(sliceChannel(rx, from - margin, to), { baud, parity: decoder.parity || 'none' })
      .filter((frame) => frame.end >= from && frame.start <= to)
      .map((frame) => ({ start: frame.start, end: frame.end, text: frame.value >= 32 && frame.value < 127 ? `'${String.fromCharCode(frame.value)}'` : `${hex2(frame.value)}h`, detail: `${hex2(frame.value)}h${frame.framingError ? ' framing error' : ''}${frame.parityOk ? '' : ' parity error'}`, error: frame.framingError || !frame.parityOk, label: `UART ${decoder.rx} @ ${baud}` }));
  }
  if (decoder.type === 'spi') {
    if (!ch(decoder.sck) || !ch(decoder.mosi)) return [];
    const slice = (name) => (ch(name) ? sliceChannel(ch(name), from - margin, to) : null);
    return decodeSpi({ sck: slice(decoder.sck), mosi: slice(decoder.mosi), miso: slice(decoder.miso), cs: slice(decoder.cs) }, { mode: Number(decoder.mode) || 0 })
      .map((word) => ({ start: word.start, end: word.end, text: `${hex2(word.mosi)}h`, detail: `MOSI ${hex2(word.mosi)}h${word.miso !== null ? ` · MISO ${hex2(word.miso)}h` : ''}`, label: `SPI mode ${decoder.mode}` }));
  }
  if (decoder.type === 'i2c') {
    if (!ch(decoder.scl) || !ch(decoder.sda)) return [];
    return decodeI2c({ scl: sliceChannel(ch(decoder.scl), from - margin, to), sda: sliceChannel(ch(decoder.sda), from - margin, to) })
      .map((event) => ({ start: event.t, end: event.end ?? event.t, text: event.type === 'address' ? `${hex2(event.address)}h ${event.read ? 'R' : 'W'}${event.ack ? '' : ' NACK'}` : event.type === 'data' ? `${hex2(event.value)}h${event.ack ? '' : ' N'}` : event.type === 'start' ? 'S' : event.type === 'stop' ? 'P' : 'Sr', detail: event.type, error: event.ack === false && event.type === 'address', label: 'I²C' }));
  }
  return [];
}
function laSvg(target, pixelWidth = 1000) {
  const config = laConfig(target);
  const source = laSource(target);
  if (!source) return '<p class="module-footnote">Run a program to capture signals.</p>';
  const windowSeconds = Number(config.windowMs) / 1000;
  const to = source.end - (laState.offset[target] || 0) * windowSeconds;
  const from = Math.max(0, to - windowSeconds);
  const byName = new Map(source.channels.map((channel) => [channel.name, channel]));
  const channels = source.imported ? source.channels.slice(0, 16) : config.channels.map((name) => byName.get(name)).filter(Boolean);
  const decoders = config.decoders.map((decoder) => ({ decoder, items: laDecode(decoder, byName, from, to) })).filter((entry) => entry.items.length || !source.imported);
  const width = Math.max(400, Math.round(pixelWidth)), labelWidth = 70, rowHeight = 26, decoderHeight = 24;
  const x = (t) => labelWidth + ((t - from) / (to - from || 1)) * (width - labelWidth);
  const rows = [];
  let y = 18;
  channels.forEach((channel) => {
    const slice = sliceChannel(channel, from, to);
    const top = y + 4, bottom = y + rowHeight - 6;
    const level = (v) => (v ? top : bottom);
    let path = `M${labelWidth} ${level(slice.initial)}`;
    const dense = slice.edges.length > 1500;
    if (dense) path += `L${width} ${level(slice.initial)}`;
    else { let current = slice.initial; for (const edge of slice.edges) { const px = x(edge.t).toFixed(1); path += `L${px} ${level(current)}L${px} ${level(edge.v)}`; current = edge.v; } path += `L${width} ${level(current)}`; }
    rows.push(`<text class="la-name" x="4" y="${y + 16}">${esc(channel.name)}</text>${dense ? `<rect class="la-busy" x="${labelWidth}" y="${top}" width="${width - labelWidth}" height="${bottom - top}"/><text class="la-note" x="${labelWidth + 6}" y="${y + 16}">${slice.edges.length} edges — zoom in</text>` : `<path class="la-wave" d="${path}"/>`}`);
    y += rowHeight;
  });
  decoders.forEach(({ decoder, items }) => {
    rows.push(`<text class="la-name decoder" x="4" y="${y + 15}">${esc(decoder.type.toUpperCase())}</text>`);
    for (const item of items.slice(0, 400)) {
      const x1 = Math.max(labelWidth, x(item.start)), x2 = Math.min(width, Math.max(x(item.end), x1 + 3));
      rows.push(`<g><title>${esc(`${item.label}: ${item.detail}`)}</title><rect class="la-frame${item.error ? ' error' : ''}" x="${x1.toFixed(1)}" y="${y + 3}" width="${(x2 - x1).toFixed(1)}" height="${decoderHeight - 6}" rx="3"/>${x2 - x1 > 22 ? `<text class="la-frame-text" x="${((x1 + x2) / 2).toFixed(1)}" y="${y + 16}">${esc(item.text)}</text>` : ''}</g>`);
    }
    y += decoderHeight;
  });
  const ticks = Array.from({ length: 6 }, (_, k) => { const t = from + (to - from) * k / 5; return `<line class="la-grid" x1="${x(t)}" x2="${x(t)}" y1="12" y2="${y}"/><text class="la-time" x="${x(t)}" y="10">${esc(eng(t, 's'))}</text>`; }).join('');
  return `<svg class="la-svg" role="img" aria-label="Logic analyser waveforms" viewBox="0 0 ${width} ${y + 4}" width="${width}" height="${y + 4}">${ticks}${rows.join('')}</svg>`;
}
function renderAnalyzerPanel(target) {
  const config = laConfig(target);
  const names = target === 'uno' ? PIN_LABELS : [0, 1, 2, 3].flatMap((port) => Array.from({ length: 8 }, (_, bit) => `P${port}.${bit}`));
  const decoderRow = (decoder, index) => {
    const select = (key, value) => `<select data-la-decoder="${index}" data-la-key="${key}" aria-label="Decoder ${index + 1} ${key.toUpperCase()} pin">${['', ...names].map((name) => `<option value="${name}" ${name === value ? 'selected' : ''}>${name || '—'}</option>`).join('')}</select>`;
    if (decoder.type === 'uart') return `<div class="la-decoder"><b>UART</b> RX ${select('rx', decoder.rx)} baud <select data-la-decoder="${index}" data-la-key="baud" aria-label="Decoder ${index + 1} baud rate">${['auto', 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((rate) => `<option value="${rate}" ${String(rate) === String(decoder.baud) ? 'selected' : ''}>${rate}</option>`).join('')}</select> parity <select data-la-decoder="${index}" data-la-key="parity" aria-label="Decoder ${index + 1} parity">${['none', 'even', 'odd'].map((p) => `<option ${p === decoder.parity ? 'selected' : ''}>${p}</option>`).join('')}</select><button class="tool" data-la-remove="${index}">✕</button></div>`;
    if (decoder.type === 'spi') return `<div class="la-decoder"><b>SPI</b> SCK ${select('sck', decoder.sck)} MOSI ${select('mosi', decoder.mosi)} MISO ${select('miso', decoder.miso)} CS ${select('cs', decoder.cs)} mode <select data-la-decoder="${index}" data-la-key="mode" aria-label="Decoder ${index + 1} SPI mode">${[0, 1, 2, 3].map((m) => `<option ${m === Number(decoder.mode) ? 'selected' : ''}>${m}</option>`).join('')}</select><button class="tool" data-la-remove="${index}">✕</button></div>`;
    return `<div class="la-decoder"><b>I²C</b> SCL ${select('scl', decoder.scl)} SDA ${select('sda', decoder.sda)}<button class="tool" data-la-remove="${index}">✕</button></div>`;
  };
  return `<details class="dsp-card la-panel" data-la-target="${target}" ${config.open === false ? '' : 'open'}><summary><span class="panel-label">LOGIC ANALYSER</span></summary>
    <div class="la-controls dsp-controls">
      ${labSelect('data-la-field', 'windowMs', 'Time window', config.windowMs, LA_WINDOWS)}
      <label>Scroll back<input type="range" min="0" max="20" step="0.25" value="${laState.offset[target] || 0}" data-la-offset></label>
      <button class="button ghost" data-la-action="freeze">${laState.frozen[target] ? 'Live' : 'Freeze'}</button>
      <button class="button ghost" data-la-action="export">Export VCD</button>
      <label>Import VCD<input type="file" accept=".vcd" data-la-import></label>
      ${laState.imported[target] ? '<button class="button ghost" data-la-action="live">Back to simulator</button>' : ''}
      <button class="button ghost" data-la-action="add-uart">+ UART</button><button class="button ghost" data-la-action="add-spi">+ SPI</button><button class="button ghost" data-la-action="add-i2c">+ I²C</button>
    </div>
    <details class="la-channels"><summary>Channels (${config.channels.length})</summary><div>${names.map((name) => `<label class="check-label"><input type="checkbox" data-la-channel="${name}" ${config.channels.includes(name) ? 'checked' : ''}> ${name}</label>`).join('')}</div></details>
    <div class="la-decoders">${config.decoders.map(decoderRow).join('')}</div>
    <div class="la-view" data-la-view>${laSvg(target)}</div>
    <p class="module-footnote">Captures every pin with exact simulated timestamps; the USART, SPI and TWI hardware draw their real waveforms on TXD, SCK/MOSI/MISO and SCL/SDA. UART, SPI and I²C decoding match sigrok's decoders. Exported VCD files open in GTKWave, PulseView and sigrok.</p></details>`;
}
function paintAnalyzer(target, force = false) {
  const now = performance.now();
  if (!force && now - laState.lastPaint < 200) return;
  laState.lastPaint = now;
  if (laState.frozen[target] && !force) return;
  const view = document.querySelector(`[data-la-target="${target}"] [data-la-view]`);
  if (view && view.closest('details')?.open) view.innerHTML = laSvg(target, view.clientWidth || 1000);
}
function bindAnalyzerEvents(target) {
  const panel = document.querySelector(`[data-la-target="${target}"]`);
  if (!panel) return;
  const config = () => laConfig(target);
  panel.addEventListener('toggle', (event) => { if (event.target === panel && panel.open !== (config().open !== false)) persistLa(target, { open: panel.open }); });
  panel.querySelectorAll('[data-la-field]').forEach((field) => field.addEventListener('change', () => persistLa(target, { [field.dataset.laField]: field.value })));
  panel.querySelector('[data-la-offset]')?.addEventListener('input', (event) => { laState.offset[target] = Number(event.target.value); paintAnalyzer(target, true); });
  panel.querySelectorAll('[data-la-channel]').forEach((box) => box.addEventListener('change', () => {
    const channels = new Set(config().channels);
    if (box.checked) channels.add(box.dataset.laChannel); else channels.delete(box.dataset.laChannel);
    const order = target === 'uno' ? PIN_LABELS : [0, 1, 2, 3].flatMap((port) => Array.from({ length: 8 }, (_, bit) => `P${port}.${bit}`));
    persistLa(target, { channels: order.filter((name) => channels.has(name)) });
  }));
  panel.querySelectorAll('[data-la-decoder]').forEach((field) => field.addEventListener('change', () => {
    const decoders = structuredClone(config().decoders);
    decoders[Number(field.dataset.laDecoder)][field.dataset.laKey] = field.dataset.laKey === 'mode' ? Number(field.value) : field.value;
    persistLa(target, { decoders });
  }));
  panel.querySelectorAll('[data-la-remove]').forEach((button) => button.addEventListener('click', () => { const decoders = structuredClone(config().decoders); decoders.splice(Number(button.dataset.laRemove), 1); persistLa(target, { decoders }); }));
  panel.querySelectorAll('[data-la-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.laAction;
    const uno = target === 'uno';
    if (action === 'freeze') { laState.frozen[target] = !laState.frozen[target]; button.textContent = laState.frozen[target] ? 'Live' : 'Freeze'; paintAnalyzer(target, true); }
    else if (action === 'live') { laState.imported[target] = null; rerender(); }
    else if (action.startsWith('add-')) {
      const type = action.slice(4);
      const fresh = type === 'uart' ? { type, rx: uno ? 'D1' : 'P3.1', baud: 'auto', parity: 'none' } : type === 'spi' ? { type, sck: uno ? 'D13' : 'P1.0', mosi: uno ? 'D11' : 'P1.1', miso: uno ? 'D12' : '', cs: uno ? 'D10' : '', mode: 0 } : { type, scl: uno ? 'A5' : 'P1.6', sda: uno ? 'A4' : 'P1.7' };
      persistLa(target, { decoders: [...config().decoders, fresh] });
    } else if (action === 'export') {
      const source = laSource(target);
      if (!source) { notify('Nothing captured yet.', 'error'); return; }
      const selected = source.imported ? source.channels : config().channels.map((name) => source.channels.find((channel) => channel.name === name)).filter(Boolean);
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([toVcd(selected, { endTime: source.end })], { type: 'text/plain' })); link.download = `${uno ? 'arduino' : '8051'}-capture.vcd`; link.click(); URL.revokeObjectURL(link.href);
    }
  }));
  panel.querySelector('[data-la-import]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20_000_000) { notify('VCD file is too large (20 MB limit).', 'error'); return; }
    try {
      const channels = fromVcd(await file.text());
      if (!channels.length) throw new Error('No 1-bit signals found in that VCD file.');
      const end = Math.max(...channels.map((channel) => (channel.edges.length ? channel.edges[channel.edges.length - 1].t : 0)));
      laState.imported[target] = { channels, end, name: file.name };
      persistLa(target, { windowMs: String(Math.max(0.5, Math.round(end * 1000))) });
      notify(`Imported ${channels.length} signals from ${file.name}`, 'success');
    } catch (error) { reportError(error); }
  });
}



// ---------------------------------------------------------------------------
// Networks: subnetting, routing, sliding window and MAC (plus the saved-capture reader).
