// Smith chart (constant-resistance circles and constant-reactance arcs in the reflection plane),
// shared by the RF and EM workspaces.
import { cdiv, complex } from '../../packages/numerics/src/index.mjs';
import { esc } from '../shared/escaping.js';

/** Smith chart: constant-resistance circles and constant-reactance arcs in the Γ plane. */
export function renderSmithChart({ label, points = [], traces = [] }) {
  const size = 320, c = size / 2, radius = 140;
  const px = (re) => (c + re * radius).toFixed(2), py = (im) => (c - im * radius).toFixed(2);
  const resistances = [0.2, 0.5, 1, 2, 5];
  const reactances = [0.2, 0.5, 1, 2, 5];
  const circles = resistances.map((r) => `<circle cx="${px(r / (1 + r))}" cy="${c}" r="${(radius / (1 + r)).toFixed(2)}"/>`).join('');
  const arcs = reactances.flatMap((x) => [x, -x]).map((x) => `<circle cx="${px(1)}" cy="${py(1 / x)}" r="${(radius / Math.abs(x)).toFixed(2)}"/>`).join('');
  const labels = resistances.map((r) => `<text x="${(Number(px((r - 1) / (r + 1))) + 2).toFixed(1)}" y="${c - 3}">${r}</text>`).join('')
    + reactances.flatMap((x) => [x, -x]).map((x) => { const gamma = cdiv(complex(-1, x), complex(1, x)); const scale = 1.06; return `<text x="${(c - 6 + gamma.re * radius * scale).toFixed(1)}" y="${(c + 3 - gamma.im * radius * scale).toFixed(1)}">${x > 0 ? '+' : '−'}j${Math.abs(x)}</text>`; }).join('');
  const traceSvg = traces.map((trace) => `<path class="smith-trace" stroke="${trace.color}" d="${trace.points.map((g, index) => `${index ? 'L' : 'M'}${px(g.re)} ${py(g.im)}`).join('')}"/>`).join('');
  const pointSvg = points.map((point) => `<circle class="smith-point" cx="${px(point.gamma.re)}" cy="${py(point.gamma.im)}" r="${point.radius || 4.5}" fill="${point.color}"/>${point.text ? `<text class="smith-point-label" x="${(Number(px(point.gamma.re)) + 7).toFixed(1)}" y="${(Number(py(point.gamma.im)) - 6).toFixed(1)}">${esc(point.text)}</text>` : ''}`).join('');
  return `<svg class="smith-plot" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><defs><clipPath id="smith-clip"><circle cx="${c}" cy="${c}" r="${radius}"/></clipPath></defs>
    <g class="smith-grid" clip-path="url(#smith-clip)">${circles}${arcs}<line x1="${c - radius}" y1="${c}" x2="${c + radius}" y2="${c}"/></g><circle class="smith-outline" cx="${c}" cy="${c}" r="${radius}"/><g class="smith-labels">${labels}</g>${traceSvg}${pointSvg}</svg>`;
}
