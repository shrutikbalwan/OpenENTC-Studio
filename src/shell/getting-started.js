// First-run guide and example library on Mission control. The guide's progress is a per-browser
// convenience (localStorage, failures ignored); it is not part of the project.
import { esc } from '../shared/escaping.js';
import { setState } from '../core/store.js';
import { exampleCircuits } from '../data/example-circuits.js';
import { loadExampleCircuit } from '../workspaces/circuit/circuit.js';
import { VERILOG_EXAMPLES } from '../../packages/verilog/src/examples.mjs';
import { EXAMPLES_8051 } from '../../packages/mcu/src/i8051/examples.mjs';
import { AVR_EXAMPLES } from '../../packages/mcu/src/avr/examples.mjs';
import { RTOS_EXAMPLES } from '../../packages/rtos/src/index.mjs';
import { NETWORK_EXAMPLES } from '../../packages/network/src/index.mjs';
import { LADDER_EXAMPLES } from '../../packages/plc/src/index.mjs';
import { SDR_EXAMPLES } from '../../packages/sdr/src/index.mjs';

const KEY = 'openentc-onboarding-v1';
const ONBOARDING_STEPS = Object.freeze([
  { id: 'example', title: 'Open an example circuit', detail: 'Load the RC low-pass filter into the Circuit Lab.', action: 'Load example' },
  { id: 'simulate', title: 'Run a simulation', detail: 'Press Run in the Circuit Lab and read the Bode plot.', action: 'Open Circuit Lab' },
  { id: 'limits', title: 'Know the limits', detail: 'Results come from simplified educational models. See what is and is not checked.', action: 'Read the limits' },
  { id: 'save', title: 'Keep your work', detail: 'Projects are saved in this browser. Export a project file to keep a copy.', action: 'Export project' },
]);

/** @returns {{ dismissed: boolean, done: string[] }} */
function onboardingState(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || 'null');
    if (value && typeof value === 'object') return { dismissed: value.dismissed === true, done: Array.isArray(value.done) ? value.done.filter((id) => ONBOARDING_STEPS.some((step) => step.id === id)) : [] };
  } catch { /* storage unavailable or corrupted: start fresh */ }
  return { dismissed: false, done: [] };
}

function saveOnboardingState(next, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: the guide simply reappears */ }
}

export function renderGettingStarted() {
  const progress = onboardingState();
  const guide = progress.dismissed ? '' : `<section class="onboarding" aria-labelledby="onboarding-title" data-onboarding>
    <div class="onboarding-head"><div><span class="eyebrow">FIRST STEPS</span><h2 id="onboarding-title">Getting started</h2></div><span class="onboarding-count">${progress.done.length} of ${ONBOARDING_STEPS.length} done</span><button class="text-button" data-onboarding-dismiss>Hide guide</button></div>
    <ol class="onboarding-steps">${ONBOARDING_STEPS.map((step) => `<li class="${progress.done.includes(step.id) ? 'done' : ''}"><div><b>${esc(step.title)}</b><small>${esc(step.detail)}</small></div><button class="button ${progress.done.includes(step.id) ? 'ghost' : 'primary'}" data-onboarding-step="${step.id}">${progress.done.includes(step.id) ? '✓ ' : ''}${esc(step.action)}</button></li>`).join('')}</ol>
  </section>`;
  const other = [['Verilog designs', VERILOG_EXAMPLES.length, 'fpga'], ['8051 programs', EXAMPLES_8051.length, 'mcu'], ['Arduino Uno sketches', AVR_EXAMPLES.length, 'mcu'], ['RTOS task sets', RTOS_EXAMPLES.length, 'rtos'], ['Network theory netlists', NETWORK_EXAMPLES.length, 'theory'], ['PLC ladder programs', Object.keys(LADDER_EXAMPLES).length, 'plc'], ['SDR flowgraphs', Object.keys(SDR_EXAMPLES).length, 'sdr']];
  const library = `<section class="example-library" aria-labelledby="examples-title">
    <div class="section-title"><div><span class="eyebrow">EXAMPLE LIBRARY</span><h2 id="examples-title">Start from a working example</h2></div><span>${exampleCircuits.length + other.reduce((sum, [, count]) => sum + count, 0)} examples</span></div>
    <div class="example-grid">${exampleCircuits.map((example) => `<button class="example-card" data-home-example="${esc(example.id)}"><b>${esc(example.name)}</b><small>${esc(example.summary)}</small><span>Circuit Lab</span></button>`).join('')}
    ${other.map(([name, count, module]) => `<button class="example-card" data-module="${module}"><b>${esc(name)}</b><small>${count} examples in the lab's example menu</small><span>Open lab</span></button>`).join('')}</div>
  </section>`;
  return guide + library;
}

function markDone(id) {
  const progress = onboardingState();
  if (!progress.done.includes(id)) saveOnboardingState({ ...progress, done: [...progress.done, id] });
}

/** Bind the guide and library buttons; `actions` supplies shell actions (export, help). */
export function bindGettingStarted({ exportProject, showHelp }) {
  document.querySelector('[data-onboarding-dismiss]')?.addEventListener('click', () => { saveOnboardingState({ ...onboardingState(), dismissed: true }); setState({ activeModule: 'home' }); });
  document.querySelectorAll('[data-onboarding-step]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.onboardingStep;
    markDone(id);
    if (id === 'example') { setState({ activeModule: 'circuit' }); loadExampleCircuit('rc-lowpass'); }
    else if (id === 'simulate') setState({ activeModule: 'circuit' });
    else if (id === 'limits') showHelp();
    else if (id === 'save') exportProject();
  }));
  document.querySelectorAll('[data-home-example]').forEach((button) => button.addEventListener('click', () => { setState({ activeModule: 'circuit' }); loadExampleCircuit(button.dataset.homeExample); }));
}

