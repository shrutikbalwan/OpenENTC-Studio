// SVG plot primitives: line and stem plots, complex-plane (s/z, Smith) plots and scatter planes.
import { eng, fmt } from '../shared/formatting.js';
import { decimate, linePath, niceRange } from '../core/circuit-plot.js';
import { esc } from '../shared/escaping.js';

export const PLOT_COLORS = ['#5eead4', '#60a5fa', '#f59e0b', '#fb7185', '#a78bfa', '#4ade80', '#f97316', '#22d3ee'];
export function renderPlotFrame({ title, series, xMin, xMax, logX = false, xTicks, yRange, formatY }) {
  const width = 600, height = 150;
  const yPosition = (value) => (1 - (value - yRange.min) / (yRange.max - yRange.min || 1));
  const grid = yRange.ticks.map((tick) => `<line x1="0" x2="${width}" y1="${(yPosition(tick) * height).toFixed(2)}" y2="${(yPosition(tick) * height).toFixed(2)}"/>`).join('')
    + xTicks.map((tick) => `<line y1="0" y2="${height}" x1="${(tick.position * width).toFixed(2)}" x2="${(tick.position * width).toFixed(2)}"/>`).join('');
  const stemPath = (entry) => {
    const zero = Math.min(1, Math.max(0, yPosition(0))) * height;
    return entry.xs.map((x, index) => { const px = ((x - xMin) / (xMax - xMin || 1) * width).toFixed(2); return Number.isFinite(entry.ys[index]) ? `M${px} ${zero.toFixed(2)}V${(yPosition(entry.ys[index]) * height).toFixed(2)}` : ''; }).join('');
  };
  const paths = [...series].reverse().map((entry) => entry.stem
    ? `<path class="plot-stem" stroke="${entry.color}" d="${stemPath(entry)}"/><path class="plot-stem-head" stroke="${entry.color}" d="${entry.xs.map((x, index) => Number.isFinite(entry.ys[index]) ? `M${((x - xMin) / (xMax - xMin || 1) * width).toFixed(2)} ${(yPosition(entry.ys[index]) * height).toFixed(2)}h0` : '').join('')}"/>`
    : `<path class="plot-trace${entry.primary ? ' primary' : ''}${entry.dashed ? ' dashed' : ''}" stroke="${entry.color}" d="${linePath(entry.xs, entry.ys, { width, height, xMin, xMax, yMin: yRange.min, yMax: yRange.max, logX })}"/>`).join('');
  const xLabel = (tick) => `<span style="left:${(tick.position * 100).toFixed(2)}%;transform:translateX(${tick.position <= 0.001 ? '0' : tick.position >= 0.999 ? '-100%' : '-50%'})">${esc(tick.text)}</span>`;
  return `<div class="circuit-plot"><span class="plot-title">${esc(title)}</span><div class="plot-body"><div class="plot-y">${yRange.ticks.map((tick) => `<span style="top:${(yPosition(tick) * 100).toFixed(2)}%">${esc(formatY(tick))}</span>`).join('')}</div><div class="plot-area"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}"><g class="plot-grid">${grid}</g>${paths}</svg><div class="plot-x">${xTicks.map(xLabel).join('')}</div></div></div></div>`;
}
export const linePlot = (title, xs, series, { xLabel = (value) => fmt(value, 3), unit = '', yMin = null, yMax = null } = {}) => {
  const prepared = series.map((entry, index) => ({ ...decimate(xs, entry.values, 1200), color: entry.color ?? PLOT_COLORS[index], primary: index === 0, dashed: entry.dashed }));
  const values = prepared.flatMap((entry) => entry.ys).filter(Number.isFinite);
  const xMin = xs[0], xMax = xs.at(-1);
  return `${renderPlotFrame({ title, series: prepared, xMin, xMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: xLabel(xMin + (xMax - xMin) * k / 5) })), yRange: niceRange(yMin ?? Math.min(...values), yMax ?? Math.max(...values)), formatY: (value) => (unit ? eng(value, unit) : fmt(value, 3)) })}${series.length > 1 ? `<div class="plot-legend">${series.map((entry, index) => `<span class="legend-chip" style="--chip:${entry.color ?? PLOT_COLORS[index]}">${esc(entry.name)}</span>`).join('')}</div>` : ''}`;
};
export const stemPlot = (title, values, { color = PLOT_COLORS[0] } = {}) => {
  const xs = values.map((_, k) => k), xMax = Math.max(1, xs.length - 1);
  return renderPlotFrame({ title, series: [{ xs, ys: values, color, stem: true, primary: true }], xMin: 0, xMax, xTicks: Array.from({ length: 6 }, (_, k) => ({ position: k / 5, text: fmt(xMax * k / 5, 3) })), yRange: niceRange(Math.min(0, ...values), Math.max(0, ...values)), formatY: (value) => fmt(value, 3) });
};
/** s- or z-plane plot: optional unit circle, curves, poles (×), zeros (○) and highlighted points. */
export function renderComplexPlane({ label, extent, unitCircle = false, curves = [], poles = [], zeros = [], marks = [], criticalPoint = false }) {
  const size = 300, centre = size / 2, scale = 130 / extent;
  const x = (re) => Math.max(-5e3, Math.min(5e3, centre + re * scale)).toFixed(2);
  const y = (im) => Math.max(-5e3, Math.min(5e3, centre - im * scale)).toFixed(2);
  const group = (points) => points.reduce((list, point) => { const same = list.find((entry) => Math.hypot(entry.re - point.re, entry.im - point.im) < extent * 1e-3); if (same) same.count += 1; else list.push({ ...point, count: 1 }); return list; }, []);
  const multiplicity = (point) => (point.count > 1 ? `<text class="pz-count" x="${(Number(x(point.re)) + 7).toFixed(1)}" y="${(Number(y(point.im)) - 7).toFixed(1)}">${point.count}</text>` : '');
  const tick = Number((extent / 2).toPrecision(1));
  const axisLabels = `<text class="pz-axis-label" x="${x(tick)}" y="${centre + 12}">${fmt(tick, 3)}</text><text class="pz-axis-label" x="${centre + 4}" y="${y(tick)}">j${fmt(tick, 3)}</text>`;
  const curvePaths = curves.map((curve) => `<path class="pz-curve${curve.dashed ? ' dashed' : ''}" stroke="${curve.color}" d="${curve.points.map((point, index) => `${index ? 'L' : 'M'}${x(point.re)} ${y(point.im)}`).join('')}"/>`).join('');
  return `<svg class="pz-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><path class="axis" d="M${centre} 4V${size - 4}M4 ${centre}H${size - 4}"/>${unitCircle ? `<circle class="unit-circle" cx="${centre}" cy="${centre}" r="${scale}"/>` : ''}${axisLabels}${curvePaths}
    ${criticalPoint ? `<circle class="pz-critical" cx="${x(-1)}" cy="${y(0)}" r="4"/><text class="pz-axis-label" x="${Number(x(-1)) - 14}" y="${centre - 8}">−1</text>` : ''}
    ${group(zeros).map((zero) => `<circle class="pz-zero" cx="${x(zero.re)}" cy="${y(zero.im)}" r="5"/>${multiplicity(zero)}`).join('')}
    ${group(poles).map((pole) => `<path class="pz-pole" d="M${Number(x(pole.re)) - 5} ${Number(y(pole.im)) - 5}l10 10m0 -10l-10 10"/>${multiplicity(pole)}`).join('')}
    ${marks.map((mark) => `<rect class="pz-mark" x="${Number(x(mark.re)) - 3.5}" y="${Number(y(mark.im)) - 3.5}" width="7" height="7"/>`).join('')}</svg>`;
}
export const planeExtent = (points, minimum = 1) => { const values = points.flatMap((point) => [Math.abs(point.re), Math.abs(point.im)]).filter(Number.isFinite); return Math.max(minimum, ...values) * 1.25; };
export const indexTicks = (first, last) => { const span = Math.max(1, last - first); const step = Math.max(1, Math.ceil(span / 8)); const ticks = []; for (let n = first; n <= last; n += step) ticks.push({ position: (n - first) / span, text: String(n) }); return ticks; };

export const scatterPlane = (label, points, extent = 1.6, color = PLOT_COLORS[0]) => {
  const size = 300, centre = size / 2, scale = 130 / extent;
  const dots = points.slice(0, 1500).map((p) => `<circle cx="${(centre + Math.max(-extent, Math.min(extent, p.re)) * scale).toFixed(1)}" cy="${(centre - Math.max(-extent, Math.min(extent, p.im)) * scale).toFixed(1)}" r="1.6" fill="${color}" fill-opacity="0.65"/>`).join('');
  return `<svg class="pz-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><path class="axis" d="M${centre} 4V${size - 4}M4 ${centre}H${size - 4}"/>${dots}</svg>`;
};

export const linearTicks = (min, max, unit) => Array.from({ length: 6 }, (_, index) => ({ position: index / 5, text: eng(min + (max - min) * index / 5, unit) }));
