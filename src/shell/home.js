// Mission control (home page) and the generic page for catalogue-only modules.
import { modules } from '../data/modules.js';
import { esc } from '../shared/escaping.js';
import { engines } from '../core/engine-registry.js';
import { pageHeader } from '../components/layout.js';

export function renderHome(state) {
  const ready = engines.filter((engine) => ['built-in', 'integrated', 'interoperable'].includes(engine.status)).length;
  return `<div class="page scroll-page">
    ${pageHeader(modules[0], 'ONE WORKSPACE · EVERY DISCIPLINE', '<button class="button primary" data-module="circuit">Open Circuit Lab →</button>')}
    <section class="hero-card">
      <div class="hero-copy"><span class="pill live"><i></i> Local-first engineering</span><h2>Build the signal.<br><em>Understand the system.</em></h2><p>Move from a circuit idea to firmware, board design, digital logic and communication analysis without losing your project context.</p><div class="hero-actions"><button class="button bright" data-action="new-project">New engineering project</button><button class="button subtle" data-action="load-demo">Load voltage-divider demo</button></div></div>
      <div class="hero-visual" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="core-chip"><span>OE</span><small>UNIFIED<br>LAB CORE</small></div><span class="satellite s1">RF</span><span class="satellite s2">PCB</span><span class="satellite s3">DSP</span><span class="satellite s4">MCU</span></div>
    </section>
    <section class="metric-row">
      <div class="metric"><span>PROJECT</span><strong>${esc(state.project.name)}</strong><small>Updated ${new Date(state.project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
      <div class="metric"><span>MODULES</span><strong>${modules.length - 1}</strong><small>Unified ENTC workspaces</small></div>
      <div class="metric"><span>ENGINE STATUS</span><strong>${ready} available · ${engines.length - ready} unavailable</strong><small>Evidence-backed capability states</small></div>
      <div class="metric"><span>PRIVACY</span><strong>Local by default</strong><small>This browser alpha has no upload feature</small></div>
    </section>
    <div class="section-title"><div><span class="eyebrow">AUTHORED EXPERIMENTS</span><h2>Saved configurations</h2></div><span>${state.project.experiments.length} persisted</span></div>
    <section class="engine-table experiment-list">${state.project.experiments.length ? state.project.experiments.slice(-6).reverse().map((experiment) => `<div class="engine-row"><span class="engine-logo">EX</span><div><b>${esc(experiment.id)}</b><small>${esc(experiment.kind || 'experiment')} · ${esc(experiment.operation || 'configuration')}</small></div><span>Authored</span><span>Project manifest</span><span class="engine-status built-in">● Restored</span></div>`).join('') : '<div class="empty-state">Run a built-in experiment to save its authored configuration here.</div>'}</section>
    <div class="section-title"><div><span class="eyebrow">WORKBENCH</span><h2>Choose a discipline</h2></div><span>${modules.length - 2} specialist labs</span></div>
    <section class="module-grid">
      ${modules.slice(1, -1).map((item, index) => `<button class="module-card" data-module="${item.id}" style="--card:${item.color}"><span class="module-index">${String(index + 1).padStart(2, '0')}</span><span class="module-icon">${item.icon}</span><h3>${item.name}</h3><p>${item.description}</p><span class="open-label">Open workspace <b>↗</b></span></button>`).join('')}
    </section>
    <div class="section-title"><div><span class="eyebrow">ENGINE ROOM</span><h2>Open-source capabilities</h2></div><div><button class="text-button" data-action="open-toolchains">Toolchains</button><button class="text-button" data-action="engine-info">How connectors work</button></div></div>
    <section class="engine-table">
      ${engines.map((engine) => `<div class="engine-row"><span class="engine-logo">${engine.name.slice(0, 2).toUpperCase()}</span><div><b>${engine.name}</b><small>${engine.capability}</small></div><span>${engine.area}</span><span>${engine.license}</span><span class="engine-status ${engine.status}">${engine.status === 'built-in' ? '● Built in' : engine.status === 'unsupported' ? '⊘ Unsupported' : '○ Unavailable'}</span></div>`).join('')}
    </section>
  </div>`;
}
const moduleDetails = {
  pcb: { label: 'BOARD DESIGN', stats: [['Layers', '2'], ['Design rules', 'Default'], ['Nets', '3']], steps: ['Capture schematic', 'Assign footprints', 'Route board', 'Run design checks', 'Export fabrication files'], engine: 'KiCad', visual: 'board' },
  fpga: { label: 'RTL PIPELINE', stats: [['Top module', 'counter'], ['Target', 'Generic'], ['Clock', '50 MHz']], steps: ['Write Verilog/VHDL', 'Simulate testbench', 'Synthesize with Yosys', 'Place and route', 'Program target'], engine: 'Yosys + nextpnr', visual: 'logic' },
  dsp: { label: 'SIGNAL NOTEBOOK', stats: [['Samples', '2048'], ['Rate', '48 kHz'], ['Window', 'Hann']], steps: ['Generate signal', 'Add channel model', 'Apply filter', 'Inspect FFT', 'Export results'], engine: 'Octave / SciPy', visual: 'signal' },
  communication: { label: 'LINK LAB', stats: [['Modulation', 'QPSK'], ['SNR', '18 dB'], ['Rate', '1 Mbps']], steps: ['Create source', 'Encode bits', 'Modulate carrier', 'Pass through channel', 'Measure BER'], engine: 'GNU Radio', visual: 'blocks' },
  rf: { label: 'RF WORKBENCH', stats: [['Frequency', '2.4 GHz'], ['Impedance', '50 Ω'], ['VSWR', '1.00']], steps: ['Define source/load', 'Plot Smith chart', 'Create match', 'Sweep frequency', 'Export network'], engine: 'OpenENTC calculators', visual: 'smith' },
  iot: { label: 'CONNECTED SYSTEMS', stats: [['Devices', '3'], ['Broker', 'Local'], ['Messages', '0']], steps: ['Add sensors', 'Configure controller', 'Create data flow', 'Connect MQTT', 'Build dashboard'], engine: 'Open protocols', visual: 'nodes' },
  network: { label: 'PACKET LAB', stats: [['Nodes', '4'], ['Links', '3'], ['Packets', '0']], steps: ['Create topology', 'Set addresses', 'Configure routes', 'Generate traffic', 'Inspect packets'], engine: 'Wireshark connector', visual: 'network' }
};
function moduleGraphic(type) {
  if (type === 'signal') return '<svg class="feature-svg" viewBox="0 0 700 260"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="var(--active-color)" stop-opacity=".45"/><stop offset="1" stop-color="var(--active-color)" stop-opacity="0"/></linearGradient></defs><path class="area" d="M0 160 C50 20 90 240 140 120 S230 30 280 150 S370 240 430 90 S520 15 570 145 S650 235 700 95 V260H0Z"/><path class="trace" d="M0 160 C50 20 90 240 140 120 S230 30 280 150 S370 240 430 90 S520 15 570 145 S650 235 700 95"/></svg>';
  if (type === 'smith') return '<div class="smith-chart"><i></i><i></i><i></i><i></i><span>50 Ω</span></div>';
  if (type === 'board') return '<div class="pcb-art"><span class="chip c1">U1</span><span class="chip c2">U2</span><span class="pad a"></span><span class="pad b"></span><span class="pad c"></span><i></i><i></i><i></i></div>';
  if (type === 'logic') return '<div class="logic-art"><span>CLK</span><i></i><span>COUNTER</span><i></i><span>LED[3:0]</span></div>';
  if (type === 'blocks') return '<div class="block-art"><span>DATA</span><i>→</i><span>QPSK</span><i>→</i><span>AWGN</span><i>→</i><span>BER</span></div>';
  return '<div class="node-art"><span>01</span><span>02</span><span>03</span><span>04</span><i></i><i></i><i></i></div>';
}
export function renderEngineeringModule(module) {
  const detail = moduleDetails[module.id];
  return `<div class="page scroll-page specialist-page">
    ${pageHeader(module, detail.label, '<button class="button ghost" disabled>Save unavailable</button><button class="button run" disabled>Engine unavailable</button>')}
    <section class="specialist-hero"><div class="specialist-visual">${moduleGraphic(detail.visual)}<span class="engine-chip">PLANNED ENGINE · ${detail.engine}</span></div><div class="experiment-panel"><span class="panel-label">WORKFLOW PREVIEW</span><h2>${module.name} starter</h2><p>This screen is a non-executable preview. Its specialist engine is not detected or integrated.</p><ol>${detail.steps.map((step, index) => `<li><span>${index + 1}</span>${step}<i>${index === 0 ? 'PLANNED' : ''}</i></li>`).join('')}</ol><button class="button primary wide" disabled>Unavailable in this alpha</button></div></section>
    <section class="stat-grid">${detail.stats.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong><small>Project default</small></div>`).join('')}<div><span>Connector</span><strong>${detail.engine}</strong><small>External engine boundary</small></div></section>
    <section class="module-info-grid"><article><span class="eyebrow">TARGET ARCHITECTURE</span><h3>One project, shared context</h3><p>Future design data, configuration and notes will share the OpenENTC project. Exchange adapters will isolate third-party formats and licences.</p></article><article><span class="eyebrow">CURRENT STATUS</span><h3>Unavailable</h3><p>This phase records the intended workflow only. No specialist operation can run from this screen.</p></article></section>
  </div>`;
}

// ---------------------------------------------------------------------------
// Microcontroller Lab: 8051 trainer (assembler, simulator, board, serial terminal).

// ---------------------------------------------------------------------------
// Lab Bench: function generator, bench supply, oscilloscope and multimeter on the Circuit Lab schematic.

// ---------------------------------------------------------------------------
// Lab records: a practical-journal PDF built from the project's circuit, bench captures,
// simulations and programs.

// ---------------------------------------------------------------------------
// Analog Design Studio: design to a specification, then check with the simulators.

// ---------------------------------------------------------------------------
// AI lab partner (OpenAI-compatible). Non-secret settings live in localStorage; the API key is
// kept in memory, or in sessionStorage for this tab only if the user asks (src/core/credentials.js).
// Neither is ever written to the project file.
