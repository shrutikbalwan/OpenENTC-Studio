// Pure HTML/SVG renderers for the Digital Logic Lab.

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const GROUP_COLORS = ['#5eead4', '#f59e0b', '#a78bfa', '#fb7185', '#60a5fa', '#4ade80', '#f97316', '#e879f9'];
const VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Parse textbook minterm notation such as "Σm(1,3,7) + d(0,2)" or "m(1 3 7) d(0 2)".
 * The variable count is the smallest that holds every term (at least 2) unless given.
 */
export function parseMintermNotation(text, count = null) {
  const source = String(text).replace(/Σ|∑/g, '').replace(/sum/ig, '');
  const listFor = (letter) => {
    const match = source.match(new RegExp(`(?:^|[^A-Za-z])${letter}\\s*\\(([\\d\\s,]*)\\)`, 'i'));
    return match ? match[1].split(/[\s,]+/).filter(Boolean).map((item) => { const value = Number(item); if (!Number.isInteger(value) || value < 0) throw new SyntaxError(`"${item}" is not a valid term number.`); return value; }) : null;
  };
  const minterms = listFor('m');
  if (!minterms) return null;
  const dontCares = listFor('d') ?? [];
  const highest = Math.max(1, ...minterms, ...dontCares);
  const needed = Math.max(2, Math.ceil(Math.log2(highest + 1)));
  const variables = count ?? needed;
  if (variables < needed) throw new RangeError(`Term ${highest} needs at least ${needed} variables.`);
  if (variables > 8) throw new RangeError('Minterm notation supports up to 8 variables.');
  const overlap = minterms.find((term) => dontCares.includes(term));
  if (overlap !== undefined) throw new SyntaxError(`Term ${overlap} cannot be both a minterm and a don't-care.`);
  return { variables: VARIABLE_NAMES.slice(0, variables), minterms, dontCares };
}

/** K-map table with wrap-around group colours shown as stacked bars in each cell. */
export function renderKarnaugh(analysis) {
  const map = analysis.karnaugh;
  if (!map) return '<p class="field-help">K-maps are drawn for 2 to 4 variables; the minimized forms below still apply.</p>';
  const ones = new Set(analysis.minterms), free = new Set(analysis.dontCares);
  const header = `<th class="kmap-corner">${escapeHtml(map.rowVariables.join(''))}\\${escapeHtml(map.colVariables.join(''))}</th>${map.cols.map((col) => `<th>${col}</th>`).join('')}`;
  const rows = map.rows.map((row, r) => `<tr><th>${row}</th>${map.cells[r].map((term) => {
    const value = ones.has(term) ? '1' : free.has(term) ? 'X' : '0';
    const bars = analysis.groups.map((group, index) => group.includes(term) ? `<i style="background:${GROUP_COLORS[index % GROUP_COLORS.length]}"></i>` : '').join('');
    return `<td class="kmap-cell v${value}" title="m${term}"><b>${value}</b><small>${term}</small><span class="kmap-groups">${bars}</span></td>`;
  }).join('')}</tr>`).join('');
  return `<table class="kmap" aria-label="Karnaugh map"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Two-level AND-OR gate diagram of a minimal SOP, with literal labels on each AND input. */
export function renderGateDiagram(implicants, variables) {
  const terms = implicants.map((pattern) => [...pattern].map((bit, index) => bit === '-' ? null : `${variables[index]}${bit === '0' ? "'" : ''}`).filter(Boolean));
  if (!terms.length || terms.some((term) => !term.length)) return '';
  const rowHeight = 46, height = Math.max(70, terms.length * rowHeight + 20), orX = 250, orY = height / 2;
  const gateAt = (index) => 14 + index * rowHeight;
  const parts = terms.map((term, index) => {
    const y = gateAt(index), mid = y + 16;
    if (term.length === 1) return `<text x="96" y="${mid + 4}" class="gate-label">${escapeHtml(term[0])}</text><path class="gate-wire" d="M120 ${mid}H${orX - 6}V${orY - 8 + (index - (terms.length - 1) / 2) * 6}"/>`;
    const inputs = term.map((literal, k) => { const iy = y + 4 + (k + 0.5) * (24 / term.length); return `<text x="${68 - literal.length * 7}" y="${iy + 3}" class="gate-label small">${escapeHtml(literal)}</text><path class="gate-wire" d="M72 ${iy}H96"/>`; }).join('');
    return `${inputs}<path class="gate-body" d="M96 ${y}h18a16 16 0 0 1 0 32h-18z"/><path class="gate-wire" d="M130 ${mid}H${orX - 6}V${orY - 8 + (index - (terms.length - 1) / 2) * 6}"/>`;
  }).join('');
  const or = terms.length > 1 ? `<path class="gate-body" d="M${orX - 10} ${orY - 18}q10 18 0 36q30 0 44 -18q-14 -18 -44 -18z"/><path class="gate-wire" d="M${orX + 34} ${orY}H${orX + 70}"/><text x="${orX + 74}" y="${orY + 4}" class="gate-label">F</text>` : `<text x="${orX}" y="${orY + 4}" class="gate-label">F</text>`;
  return `<svg class="gate-diagram" viewBox="0 0 ${orX + 100} ${height}" role="img" aria-label="AND-OR gate diagram">${parts}${or}</svg>`;
}

const niceStep = (span) => [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].find((step) => span / step <= 12) ?? 50000;

/** Timing diagram of a digital trace: 0/1 as levels, unknown (x) as a hatched band. */
export function renderTimingDiagram(trace, names) {
  const signals = names.map((name) => trace.signals.find((signal) => signal.name === name)).filter(Boolean);
  const left = 92, width = 860, rowHeight = 34, top = 10, stop = Math.max(1, trace.stopTime);
  const height = top + signals.length * rowHeight + 26;
  const x = (time) => left + (Math.min(time, stop) / stop) * width;
  const rows = signals.map((signal, index) => {
    const y = top + index * rowHeight, high = y + 4, low = y + 22;
    const points = signal.samples.length && signal.samples[0].time === 0 ? signal.samples : [{ time: 0, value: 'x' }, ...signal.samples];
    let path = '', bands = '';
    points.forEach((sample, k) => {
      const start = x(sample.time), end = x(points[k + 1]?.time ?? stop);
      if (sample.value === 'x') { bands += `<rect class="timing-x" x="${start.toFixed(1)}" y="${high}" width="${Math.max(0.5, end - start).toFixed(1)}" height="${low - high}"/>`; return; }
      const level = sample.value === '1' ? high : low;
      path += `${path ? 'L' : 'M'}${start.toFixed(1)} ${level}H${end.toFixed(1)}`;
      const next = points[k + 1];
      if (next && next.value !== 'x') path += `V${next.value === '1' ? high : low}`;
    });
    return `<text x="${left - 8}" y="${y + 17}" class="timing-name">${escapeHtml(signal.name)}</text><line class="timing-row" x1="${left}" x2="${left + width}" y1="${y + rowHeight - 3}" y2="${y + rowHeight - 3}"/>${bands}<path class="timing-wave" d="${path}"/>`;
  }).join('');
  const step = niceStep(stop);
  const ticks = Array.from({ length: Math.floor(stop / step) + 1 }, (_, index) => index * step).map((time) => `<line class="timing-tick" x1="${x(time)}" x2="${x(time)}" y1="${top}" y2="${height - 22}"/><text class="timing-time" x="${x(time)}" y="${height - 8}">${time}</text>`).join('');
  return `<svg class="timing-diagram" viewBox="0 0 ${left + width + 20} ${height}" role="img" aria-label="Timing diagram">${ticks}${rows}<text class="timing-time" x="${left + width + 4}" y="${height - 8}">ns</text></svg>`;
}
