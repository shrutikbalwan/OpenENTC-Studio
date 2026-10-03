// Unit tests for the shared UI layers extracted from src/app.js: formatting, parsing, tables,
// plots, forms, layout and the lab controller.
import test from 'node:test';
import assert from 'node:assert/strict';

// The lab controller uses the application store, which reads localStorage when imported.
const memory = new Map();
globalThis.localStorage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k), key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size; }, clear: () => memory.clear() };

const { complexText, decibels, eng, fmt, lines, numericText, ohms, rect } = await import('../src/shared/formatting.js');
const { engineeringInput, parseNumberList } = await import('../src/shared/parsing.js');
const { esc, safeUrl } = await import('../src/shared/escaping.js');
const { comparisonRow, comparisonTable, readout, simpleTable } = await import('../src/components/tables.js');
const { indexTicks, linePlot, planeExtent, PLOT_COLORS, renderComplexPlane, renderPlotFrame, scatterPlane, stemPlot } = await import('../src/components/plots.js');
const { groupField, labSelect, labTabs, labText } = await import('../src/components/forms.js');
const { labCard, labError, pageHeader } = await import('../src/components/layout.js');
const { bindLabControls, bindLabText, makeLab } = await import('../src/controllers/lab-controls.js');
const store = await import('../src/core/store.js');

const HOSTILE = '<img src=x onerror=alert(1)>"\'&';
const assertEscaped = (html) => { assert.doesNotMatch(html, /<img/); assert.doesNotMatch(html, /onerror=alert\(1\)>"/); };

test('formatting: engineering units, decibels, ohms, complex numbers and text lines', () => {
  assert.equal(fmt(1234.5678, 2), (1234.57).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  assert.equal(eng(4700, 'Ω'), '4.7 kΩ');
  assert.equal(eng(1e-16, 'V'), '0 V', 'values below 1e-15 print as zero');
  assert.match(decibels(-3.0103), /^-3\.01 dB$/);
  assert.equal(decibels(0.001), '0 dB');
  assert.equal(ohms(Infinity), '∞');
  assert.equal(ohms(1000), '1 kΩ');
  assert.equal(complexText({ re: 1, im: 0 }), '1');
  assert.equal(complexText({ re: 1, im: -2 }), '1 − j2');
  assert.equal(numericText(1 / 3), '0.333333');
  assert.deepEqual(lines(' a \n\n b\n'), ['a', 'b']);
  assert.equal(rect([50, 0], 'Ω'), '50 Ω');
  assert.equal(rect([50, -25], 'Ω'), '50 Ω − j25 Ω');
});

test('parsing: engineering input accepts SI prefixes and rejects garbage with a helpful message', () => {
  assert.equal(engineeringInput('4.7k', 'R'), 4700);
  assert.equal(engineeringInput('100M', 'f'), 100e6);
  assert.throws(() => engineeringInput('abc', 'Resistance'), (error) => error instanceof RangeError && /^Resistance: enter a number/.test(error.message));
  assert.throws(() => engineeringInput('', 'R'), RangeError);
  assert.deepEqual(parseNumberList('1, 2k; 3m', 'list'), [1, 2000, 0.003]);
});

test('escaping facade re-exports the core implementation', () => {
  assert.equal(esc('<a>'), '&lt;a&gt;');
  assert.equal(safeUrl('javascript:alert(1)'), '');
});

test('tables escape labels and values and show — for missing numbers', () => {
  assertEscaped(readout(HOSTILE, HOSTILE));
  assertEscaped(simpleTable([HOSTILE], [[HOSTILE]]));
  const row = comparisonRow('Gain', 10.5, 10, '', 3);
  assert.match(row, /<td>Gain<\/td>/);
  assert.match(comparisonRow('Gain', NaN, null, ''), /—/);
  assert.match(comparisonRow('Duty', 0.5, 0.5, '%'), /50 %/);
  assertEscaped(comparisonTable([], HOSTILE));
  assert.match(comparisonTable(['<tr></tr>'], ''), /<th>Quantity<\/th>/);
});

test('plots render SVG with escaped titles and finite geometry', () => {
  const xs = Array.from({ length: 50 }, (_, k) => k / 49);
  const html = linePlot(HOSTILE, xs, [{ values: xs.map((x) => Math.sin(6 * x)) }, { values: xs.map((x) => x), dashed: true }], { unit: 'V' });
  assertEscaped(html);
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /plot-legend/, 'two series get a legend');
  assert.doesNotMatch(html, /NaN|Infinity/);
  const stems = stemPlot('h[n]', [1, -0.5, 0.25]);
  assert.match(stems, /plot-stem/);
  const frame = renderPlotFrame({ title: 't', series: [{ xs: [0, 1], ys: [0, 1], color: PLOT_COLORS[0], primary: true }], xMin: 0, xMax: 1, xTicks: [{ position: 0, text: '0' }], yRange: { min: 0, max: 1, ticks: [0, 1] }, formatY: String });
  assert.match(frame, /plot-trace primary/);
  const plane = renderComplexPlane({ label: HOSTILE, extent: 2, unitCircle: true, poles: [{ re: 0.5, im: 0.5 }, { re: 0.5, im: 0.5 }], zeros: [{ re: -1, im: 0 }] });
  assertEscaped(plane);
  assert.match(plane, /unit-circle/);
  assert.match(plane, /pz-count[^>]*>2</, 'repeated poles show their multiplicity');
  assert.equal(planeExtent([{ re: 2, im: -1 }]), 2.5);
  assert.deepEqual(indexTicks(0, 4).map((t) => t.text), ['0', '1', '2', '3', '4']);
  assertEscaped(scatterPlane(HOSTILE, [{ re: 0, im: 0 }]));
});

test('form controls escape values and keep the data-attribute contract', () => {
  const select = labSelect('data-x-select', 'g.k', 'Label', 'b', [['a', 'A'], ['b', HOSTILE]]);
  assert.match(select, /<select data-x-select="g\.k">/);
  assert.match(select, /<option value="b" selected>/);
  assertEscaped(select);
  assert.match(labTabs([['one', 'One'], ['two', 'Two']], 'two', 'data-x-tab'), /aria-selected="true" class="active" data-x-tab="two"/);
  assert.match(groupField('data-x-field')('g.k', 'R', 1 / 3, 'Ω'), /data-x-field="g\.k" value="0\.333333"><span>Ω<\/span>/);
  assertEscaped(labText('x')('g.k', 'Text', HOSTILE));
  assertEscaped(labText('x')('g.k', 'Text', HOSTILE, 3));
});

test('layout: page header, error panel and card fallback when a tab throws', () => {
  assert.match(pageHeader({ name: 'Lab', description: 'd' }, 'EYEBROW'), /<h1>Lab<\/h1>/);
  const error = labError('x', 'Title', new Error(HOSTILE));
  assertEscaped(error);
  assert.match(error, /data-x-reset/);
  const card = labCard('x', 'Lab', [['a', 'A']], { tab: 'a' }, () => { throw new Error('bad input'); });
  assert.match(card, /diagnostic error/);
  assert.match(card, /bad input/);
  assert.match(labCard('x', 'Lab', [['a', 'A']], { tab: 'a' }, () => ({ controls: '<i>c</i>', body: '<b>b</b>' })), /<div class="dsp-controls"><i>c<\/i><\/div><b>b<\/b>/);
});

// Minimal DOM stand-in for the controller: elements with dataset, value and listeners.
function fakeDom(elements) {
  globalThis.document = { querySelectorAll: (selector) => elements.filter((e) => e.matches(selector)) };
  return elements;
}
const element = (attribute, value, extra = {}) => {
  const listeners = {};
  const key = attribute.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return { dataset: { [key]: value }, value: extra.value ?? '', listeners, matches: (s) => s === `[${attribute}]`, addEventListener: (type, fn) => { listeners[type] = fn; }, closest: () => ({ firstChild: { textContent: extra.label ?? 'Value' } }) };
};

test('lab controller persists tab, field, select and text changes in the project experiments', () => {
  const lab = makeLab('unit-lab', { tab: 'first', first: { r: 1000, mode: 'a' }, second: { note: '' } });
  assert.equal(lab.configuration(store.getState()).first.r, 1000);
  const [tab, field, badField, select, text, reset] = fakeDom([
    element('data-u-tab', 'second'), element('data-u-field', 'first.r', { value: '4.7k' }), element('data-u-field', 'first.r', { value: 'oops', label: 'Resistance' }),
    element('data-u-select', 'first.mode', { value: 'b' }), element('data-u-text', 'second.note', { value: HOSTILE }), element('data-u-reset', ''),
  ]);
  bindLabControls('u', lab, ['mode']);
  bindLabText('u', lab);
  tab.listeners.click();
  field.listeners.change();
  select.listeners.change();
  text.listeners.change();
  let config = lab.configuration(store.getState());
  assert.equal(config.tab, 'second');
  assert.equal(config.first.r, 4700);
  assert.equal(config.first.mode, 'b');
  assert.equal(config.second.note, HOSTILE, 'text is stored verbatim; escaping happens on render');
  badField.listeners.change();
  assert.equal(lab.configuration(store.getState()).first.r, 4700, 'invalid input does not overwrite the value');
  assert.match(store.getState().toast?.message ?? '', /^Resistance: enter a number/);
  reset.listeners.click();
  config = lab.configuration(store.getState());
  assert.deepEqual(config.second, { note: '' }, 'reset restores the current tab defaults');
  assert.equal(config.first.r, 4700, 'reset leaves other tabs alone');
  delete globalThis.document;
});

test('render service forwards rerender() to the registered shell renderer', async () => {
  const { rerender, setRenderer } = await import('../src/services/render.js');
  let calls = 0;
  setRenderer(() => { calls += 1; });
  rerender(); rerender();
  assert.equal(calls, 2);
  assert.throws(() => setRenderer(null), TypeError);
});

test('reportError shows a redacted message, applies prefix and fallback, and keeps a bounded recent list', async () => {
  const { clearRecentErrors, recentErrors, reportError } = await import('../src/services/errors.js');
  const { ConvergenceError } = await import('../packages/errors/src/index.mjs');
  clearRecentErrors();
  reportError(new Error('Upload failed for /home/dana/sketch.ino with token=abcdef123456'), { prefix: 'Arduino' });
  assert.equal(store.getState().toast.message, 'Arduino: Upload failed for <home>/sketch.ino with token=[redacted]');
  assert.equal(store.getState().toast.tone, 'error');
  reportError(new Error(''), { fallback: 'Could not import project' });
  assert.equal(store.getState().toast.message, 'Could not import project');
  reportError(new ConvergenceError('Circuit did not converge.'));
  const recent = recentErrors();
  assert.equal(recent.length, 3);
  assert.equal(recent[2].code, 'OPENENTC_CONVERGENCE');
  assert.match(recent[2].recovery, /device orientation/);
  assert.doesNotMatch(JSON.stringify(recent), /dana|abcdef123456|stack/);
  for (let k = 0; k < 30; k += 1) reportError(new Error(`e${k}`));
  assert.equal(recentErrors().length, 20, 'bounded');
  clearRecentErrors();
  assert.equal(recentErrors().length, 0);
});

test('error panel: unchanged markup for plain errors, adds the recovery hint for OpenENTC errors', async () => {
  const { renderErrorPanel } = await import('../src/components/errors.js');
  const { ValidationError } = await import('../packages/errors/src/index.mjs');
  assert.equal(renderErrorPanel(new RangeError('R must be > 0.'), { title: 'Lab', resetAttribute: 'data-x-reset' }), '<div class="diagnostic error"><b>Lab</b><span>R must be &gt; 0.</span><button class="button" data-x-reset>Reset this tab to its example</button></div>');
  const html = renderErrorPanel(new ValidationError('R1 must have a resistance greater than zero.', { location: { component: 'R1' } }), { title: 'Circuit' });
  assert.match(html, /<small class="error-recovery">Check the highlighted value and try again\.<\/small>/);
  assert.doesNotMatch(html, /<button/);
  assertEscaped(renderErrorPanel(new Error(HOSTILE), { title: 'T' }));
});
