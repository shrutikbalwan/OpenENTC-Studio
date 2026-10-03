import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLabRecord, encodeText, engineering, niceTicks, PdfDocument, textWidth, wrapText } from '../packages/report/src/index.mjs';

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

test('text metrics use the standard Helvetica widths and map Greek letters to the Symbol font', () => {
  assert.equal(textWidth('Hello', 10), 22.78); // H 722 + e 556 + l 222 + l 222 + o 556
  assert.equal(textWidth('Hello', 10, 'mono'), 30);
  assert.equal(Math.round(textWidth('Bold', 10, 'bold') * 100) / 100, 22.22); // B 722 + o 611 + l 278 + d 611
  assert.deepEqual(encodeText('1 kΩ').map((run) => [run.kind, run.bytes]), [['base', [0x31, 0x20, 0x6b]], ['symbol', [0x57]]]);
  assert.deepEqual(encodeText('25 °C ± 5 µA').flatMap((run) => run.bytes).filter((b) => b > 127), [0xb0, 0xb1, 0xb5]);
  assert.deepEqual(encodeText('a→b').map((run) => run.kind), ['base', 'symbol', 'base']);
  const lines = wrapText('The quick brown fox jumps over the lazy dog again and again', 120, 10);
  assert.ok(lines.length > 1 && lines.every((line) => textWidth(line, 10) <= 120));
  assert.deepEqual(wrapText('a\nb', 100, 10), ['a', 'b']);
  assert.ok(wrapText('x'.repeat(200), 50, 10).every((line) => textWidth(line, 10) <= 50));
});

test('axis helpers', () => {
  assert.deepEqual(niceTicks(0, 1), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(-56, 0), [-60, -40, -20, 0]);
  assert.equal(engineering(0.0047), '4.7m'); assert.equal(engineering(15_000), '15k'); assert.equal(engineering(2.5e-6), '2.5µ'); assert.equal(engineering(0), '0');
});

test('PDF structure: header, objects at their xref offsets, page tree, info and EOF', () => {
  const doc = new PdfDocument({ title: 'Test – Ω', author: 'Student', creationDate: new Date(Date.UTC(2026, 9, 2, 8, 30)) });
  const page = doc.addPage();
  page.text(50, 50, 'Hello (world) \\ 1 kΩ');
  page.line(0, 0, 100, 100); page.rect(10, 10, 20, 20, { fill: '#ff0000', stroke: '#000' }); page.polyline([[0, 0], [10, 10], [20, 0]]);
  doc.addPage();
  const text = latin1(doc.toBytes());
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.endsWith('%%EOF\n'));
  const xrefAt = Number(text.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.ok(text.startsWith('xref\n', xrefAt));
  const entries = text.slice(xrefAt).split('\n').slice(2).filter((line) => / [nf] $/.test(line));
  entries.slice(1).forEach((entry, index) => assert.ok(text.startsWith(`${index + 1} 0 obj`, Number(entry.slice(0, 10))), `object ${index + 1}`));
  assert.match(text, /\/Type \/Pages \/Kids \[\d+ 0 R \d+ 0 R\] \/Count 2/);
  assert.match(text, /\(Hello \\\(world\\\) \\\\ 1 k\) Tj/);
  assert.match(text, /\/F5 10 Tf [\d.]+ [\d.]+ Td \(W\) Tj/); // Ω from Symbol
  assert.ok(text.includes(`/Title <FEFF${[...'Test – Ω'].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('')}>`));
  assert.match(text, /\/CreationDate \(D:20261002083000Z\)/);
  // Every content stream's /Length matches its data.
  for (const match of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) assert.ok(text.startsWith('\nendstream', match.index + match[0].length + Number(match[1])));
});

// The same record was checked with pypdf (strict mode) and rendered with Ghostscript 10.02.
test('lab record: title block, sections, tables split over pages, plots, listings and page numbers', () => {
  const rows = Array.from({ length: 60 }, (_, k) => [String(k + 1), (k * 0.1).toFixed(1), (Math.sin(k) * 5).toFixed(3)]);
  const f = Array.from({ length: 50 }, (_, k) => 10 ** (1 + k / 10));
  const doc = buildLabRecord({
    institute: 'College of Engineering', department: 'E&TC', student: { name: 'Student Name', roll: '42' }, experiment: { number: '3', title: 'Half-wave rectifier', date: '02/10/2026' },
    blocks: [
      { type: 'heading', text: 'Aim' }, { type: 'paragraph', text: 'To study a half-wave rectifier with a 100 µF filter capacitor.' },
      { type: 'list', ordered: true, items: ['Connect the circuit.', 'Observe the waveforms.', ''] },
      { type: 'table', columns: ['Sr.', 'Time (s)', 'V (V)'], rows, caption: 'Observations' },
      { type: 'plot', title: 'Bode', xLabel: 'f (Hz)', yLabel: 'dB', logX: true, series: [{ name: 'gain', xs: f, ys: f.map((x) => -10 * Math.log10(1 + (x / 1000) ** 2)) }] },
      { type: 'code', title: 'Program', text: 'MOV A,#1\nSJMP $' },
      { type: 'keyvalue', pairs: [['Ripple', '1.52 Vpp']] },
    ],
  }, { creationDate: new Date(Date.UTC(2026, 0, 1)) });
  assert.ok(doc.pages.length >= 2);
  const all = doc.pages.map((page) => page.content()).join('\n');
  for (const needle of ['(College of Engineering)', '(Half-wave rectifier)', '(AIM)', '(Observations)', '(Ripple)', '(SJMP $)', `(Page 1 of ${doc.pages.length})`, '(Signature of student)']) assert.ok(all.includes(needle), needle);
  // The table header repeats on the page where the table continues.
  const pagesWithHeader = doc.pages.filter((page) => page.content().includes('(Time \\(s\\))')).length;
  assert.ok(pagesWithHeader >= 2);
  assert.ok(all.includes('(60)'));
  assert.throws(() => buildLabRecord({ blocks: [{ type: 'video' }] }), /Unknown lab-record block/);
});
