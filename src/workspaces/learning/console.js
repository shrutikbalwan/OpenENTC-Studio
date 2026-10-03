// Math Console workspace. Entry points: renderConsole(state); bindConsoleEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { createSession as createConsoleSession, describe as describeConsole, format as formatConsole, run as runConsole } from '../../../packages/mathconsole/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { linePlot } from '../../components/plots.js';
import { pageHeader } from '../../components/layout.js';
import { makeLab } from '../../controllers/lab-controls.js';

const CONSOLE_EXAMPLES = {
  circuits: ['Circuit calculations', `% Engineering suffixes: p n u m k M G
R1 = 4.7k; R2 = 10k; C = 100n;
Rp = parallel(R1, R2)
fc = 1 / (2*pi*Rp*C)          % RC cut-off in Hz
gain_dB = db(R2 / R1)
f0 = 1 / (2*pi*sqrt(10m * 1u)) % LC resonance`],
  mesh: ['Mesh analysis with matrices', `% Mesh equations R*I = V for a three-loop circuit
R = [15 -5 0; -5 20 -10; 0 -10 25];
V = [10; 0; -5];
I = R \\ V                      % solve with left division
P = I' * R * I                 % total power
det(R)`],
  phasors: ['AC phasors (complex numbers)', `f = 50; w = 2*pi*f;
Z = 10 + j*w*50m - j/(w*200u)  % series RLC impedance
abs(Z), deg(angle(Z))
I = polar(230, 0) / Z           % current phasor
S = 230 * conj(I)               % complex power
pf = cos(angle(Z))`],
  polynomials: ['Polynomials and roots', `p = [1 -6 11 -6];
roots(p)
q = poly([2 3])
conv(p, q)
polyval(p, 4)`],
  plot: ['Plot a frequency response', `% |H(f)| of a first-order RC low-pass
f = logspace(1, 5, 200);
fc = 1k;
H = 1 ./ sqrt(1 + (f / fc).^2);
plot(log10(f), db(H))
H(1), H(200)`],
};
const consoleLab = makeLab('console-lab', { tab: 'console', console: { script: CONSOLE_EXAMPLES.circuits[1], history: [], example: 'circuits' } });
let consoleCache = { key: null, value: null };
let consoleFocus = false;
function consoleRun(c) {
  const key = JSON.stringify([c.script, c.history]);
  if (consoleCache.key !== key) {
    const session = createConsoleSession();
    const script = runConsole(c.script, session);
    const commands = (c.history || []).map((input) => ({ input, ...runConsole(input, session) }));
    consoleCache = { key, value: { session, script, commands } };
  }
  return consoleCache.value;
}
function consoleOutputs(outputs) {
  return outputs.map((o) => {
    if (o.error) return `<pre class="console-error">error: ${esc(o.error)}</pre>`;
    if (o.plot) {
      const xs = o.plot[0].x;
      return `<div class="console-plot">${linePlot('plot()', xs, o.plot.map((s, i) => ({ name: `series ${i + 1}`, values: s.y })), { xLabel: (v) => fmt(v, 4) })}</div>`;
    }
    return `<pre class="console-value">${o.name ? `<b>${esc(o.name)}</b> =\n` : ''}${esc(o.text)}</pre>`;
  }).join('');
}
export function renderConsole(state) {
  const c = consoleLab.configuration(state).console;
  const result = consoleRun(c);
  const variables = [...result.session.variables.entries()].filter(([name]) => name !== 'ans' || true);
  const functions = [...result.session.functions.values()];
  const transcript = `<div class="console-block"><span class="panel-label">SCRIPT OUTPUT</span>${consoleOutputs(result.script.outputs) || '<p class="field-help">The script printed nothing (end lines with ; to hide output).</p>'}</div>${result.commands.map((cmd) => `<div class="console-block"><pre class="console-input">&gt;&gt; ${esc(cmd.input)}</pre>${consoleOutputs(cmd.outputs)}</div>`).join('')}`;
  const help = 'Operators: + - * / \\ ^ (matrix) and .* ./ .^ (element-wise), \' transpose, a:b:c ranges, [1 2; 3 4] matrices, j or i for √−1. Define functions with f(x) = …. Functions: sin cos tan sind cosd atan2 sqrt exp log log10 abs angle real imag conj round mod deg rad db fromdb polar parallel sum mean std var rms min max cumsum diff sort length size zeros ones eye linspace logspace det inv trace rank dot cross norm roots poly polyval conv factorial nchoosek gcd lcm isprime plot. Constants: pi e c0 mu0 eps0 kB q h.';
  return `<div class="page scroll-page power-page sigsys-page console-page">${pageHeader(modules.find((item) => item.id === 'console'), 'MATH CONSOLE', '<span class="pill live"><i></i> NO EVAL — OWN INTERPRETER</span>')}
    <div class="console-layout"><div class="dsp-card"><div class="dsp-controls"><label>Example<select data-console-example>${Object.entries(CONSOLE_EXAMPLES).map(([id, [label]]) => `<option value="${id}" ${c.example === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}<option value="custom" ${c.example === 'custom' ? 'selected' : ''}>Your script</option></select></label><button class="button run" data-console-run>Run script</button><button class="button" data-console-clear>Clear history</button></div>
      <textarea class="console-script" rows="12" spellcheck="false" data-console-script>${esc(c.script)}</textarea>
      <div class="console-transcript">${transcript}</div>
      <label class="console-line"><span>&gt;&gt;</span><input type="text" spellcheck="false" autocomplete="off" placeholder="Type an expression and press Enter, e.g. sqrt(2)*230" data-console-command ${consoleFocus ? 'autofocus' : ''}></label><p class="field-help">${esc(help)}</p></div>
      <div class="dsp-card console-vars"><span class="panel-label">WORKSPACE</span><table class="truth-table comm-table power-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${variables.map(([name, value]) => `<tr><td>${esc(name)}</td><td title="${esc(describeConsole(value))}">${esc(formatConsole(value).split('\n').slice(0, 4).join(' ⏎ ').slice(0, 60))}</td></tr>`).join('') || '<tr><td colspan="2">empty</td></tr>'}${functions.map((fn) => `<tr><td>${esc(fn.name)}(${esc(fn.params.join(', '))})</td><td>function</td></tr>`).join('')}</tbody></table></div></div></div>`;
}
export function bindConsoleEvents() {
  const script = document.querySelector('[data-console-script]');
  if (!script) return;
  const update = (fn) => consoleLab.persist((config) => { fn(config.console); });
  document.querySelector('[data-console-run]')?.addEventListener('mousedown', (event) => event.preventDefault());
  document.querySelector('[data-console-run]')?.addEventListener('click', () => { consoleFocus = false; update((c) => { c.script = script.value; c.example = 'custom'; }); });
  script.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); update((c) => { c.script = script.value; c.example = 'custom'; }); } });
  document.querySelector('[data-console-clear]')?.addEventListener('click', () => update((c) => { c.history = []; }));
  document.querySelector('[data-console-example]')?.addEventListener('change', (event) => { const example = CONSOLE_EXAMPLES[event.target.value]; if (example) update((c) => { c.script = example[1]; c.example = event.target.value; c.history = []; }); });
  const command = document.querySelector('[data-console-command]');
  command?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !command.value.trim()) return;
    consoleFocus = true;
    const input = command.value.trim();
    update((c) => { c.history = [...(c.history || []), input].slice(-50); });
  });
  if (consoleFocus) { const next = document.querySelector('[data-console-command]'); next?.focus(); const transcript = document.querySelector('.console-transcript'); if (transcript) transcript.scrollTop = transcript.scrollHeight; }
}
