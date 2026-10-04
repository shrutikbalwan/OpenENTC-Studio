// Image Processing workspace. Entry points: renderDip(state); bindDipEvents().
import { modules } from '../../data/modules.js';
import { esc } from '../../shared/escaping.js';
import { notify } from '../../core/store.js';
import { niceRange } from '../../core/circuit-plot.js';
import { addNoise, bitPlane, canny, components, contrastStretch, correlate, equalize, FREQUENCY_FILTERS, frequencyFilter, fromRgba, gamma, gaussianKernel, gradient, histogram, image, jpegCompress, KERNELS, logTransform, medianFilter, morphology, negative, otsu, psnr, structuringElement, TEST_IMAGES, testImage, threshold } from '../../../packages/imaging/src/index.mjs';
import { fmt } from '../../shared/formatting.js';
import { readout } from '../../components/tables.js';
import { PLOT_COLORS, renderPlotFrame } from '../../components/plots.js';
import { groupField, labSelect, labTabs } from '../../components/forms.js';
import { labError, pageHeader } from '../../components/layout.js';
import { bindLabControls, makeLab } from '../../controllers/lab-controls.js';

const DIP_TABS = [['point', 'Point operations & histogram'], ['spatial', 'Spatial filters & noise'], ['edges', 'Edges (Sobel, Canny)'], ['frequency', 'Frequency domain'], ['morphology', 'Morphology & counting'], ['compression', 'JPEG (DCT) compression']];
const dipLab = makeLab('dip-lab', {
  tab: 'point',
  source: { name: 'low', upload: '' },
  point: { operation: 'equalize', gamma: 0.5, threshold: 128, bit: 7 },
  spatial: { kernel: 'box3', sigma: 1.5, noise: 'salt-pepper', amount: 8, seed: 1, median: 3 },
  edges: { operator: 'sobel', sigma: 1.4, low: 20, high: 50 },
  frequency: { kind: 'gaussian', pass: 'low', cutoff: 15, order: 2 },
  morphology: { operation: 'open', shape: 'square', size: 3, auto: 'yes', threshold: 128 },
  compression: { quality: 50 },
});
const dipField = (...args) => groupField('data-dip-field')(...args);
const dipSelect = (path, label, value, options) => labSelect('data-dip-select', path, label, value, options);
const dipCanvases = new Map();
let dipCanvasId = 0;
function dipCanvas(img, caption, { signed = false } = {}) {
  const id = `dip${dipCanvasId += 1}`;
  let shown = img;
  if (signed) { const max = Math.max(1e-9, ...Array.from(img.data, Math.abs)); shown = { ...img, data: img.data.map((v) => 128 + 127 * v / max) }; }
  dipCanvases.set(id, shown);
  return `<figure class="dip-figure"><canvas data-dip-canvas="${id}" role="img" aria-label="${esc(caption)}" width="${img.width}" height="${img.height}"></canvas><figcaption>${esc(caption)}</figcaption></figure>`;
}
const dipScaled = (img) => { const max = Math.max(1e-9, ...img.data); return { ...img, data: img.data.map((v) => 255 * v / max) }; };
const dipHistogram = (img, title) => { const h = histogram(img), levels = h.map((_, k) => k); return renderPlotFrame({ title, series: [{ xs: levels, ys: h, color: PLOT_COLORS[0], stem: true }], xMin: 0, xMax: 255, xTicks: [0, 64, 128, 192, 255].map((v) => ({ position: v / 255, text: String(v) })), yRange: niceRange(0, Math.max(...h)), formatY: (v) => fmt(v, 3) }); };
const decodeUpload = (text) => { const bytes = Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0)); return image(128, 128, Float64Array.from(bytes)); };
function renderDipTab(config) {
  const c = config[config.tab];
  const source = config.source.name === 'upload' && config.source.upload ? decodeUpload(config.source.upload) : testImage(config.source.name === 'upload' ? 'shapes' : config.source.name, 128);
  const sourceControls = `${dipSelect('source.name', 'Image', config.source.name, [...Object.entries(TEST_IMAGES), ['upload', 'Your picture (upload)']])}<label>Upload a picture<input type="file" accept="image/*" data-dip-upload></label>`;
  if (config.tab === 'point') {
    let out, note = '';
    if (c.operation === 'equalize') { const r = equalize(source); out = r.image; note = 'Each level r maps to round(255 · CDF(r)): the cumulative histogram becomes a straight line.'; }
    else if (c.operation === 'stretch') { const r = contrastStretch(source); out = r.image; note = `Levels ${fmt(r.low, 4)} … ${fmt(r.high, 4)} (1st–99th percentile) are stretched to 0 … 255.`; }
    else if (c.operation === 'gamma') { out = gamma(source, c.gamma); note = `s = 255·(r/255)^γ with γ = ${c.gamma}: γ < 1 brightens shadows, γ > 1 darkens.`; }
    else if (c.operation === 'log') { out = logTransform(source); note = 's = 255·log(1 + r)/log 256 expands dark levels.'; }
    else if (c.operation === 'negative') out = negative(source);
    else if (c.operation === 'threshold') out = threshold(source, c.threshold);
    else if (c.operation === 'otsu') { const r = otsu(source); out = threshold(source, r.threshold); note = `Otsu's threshold t = ${r.threshold} maximises the between-class variance (matches scikit-image).`; }
    else { out = bitPlane(source, Math.round(c.bit)); note = `Bit ${Math.round(c.bit)} of every pixel: high bits carry the picture, low bits look like noise.`; }
    const controls = `${sourceControls}${dipSelect('point.operation', 'Operation', c.operation, [['equalize', 'Histogram equalisation'], ['stretch', 'Contrast stretching'], ['gamma', 'Gamma (power law)'], ['log', 'Log transform'], ['negative', 'Negative'], ['threshold', 'Threshold'], ['otsu', 'Otsu threshold'], ['bitplane', 'Bit-plane slicing']])}${c.operation === 'gamma' ? dipField('point.gamma', 'γ', c.gamma) : ''}${c.operation === 'threshold' ? dipField('point.threshold', 'Threshold', c.threshold) : ''}${c.operation === 'bitplane' ? dipField('point.bit', 'Bit (0–7)', c.bit) : ''}`;
    return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Input')}${dipCanvas(out, 'Output')}</div><div class="power-grid"><div>${dipHistogram(source, 'Input histogram')}</div><div>${dipHistogram(out, 'Output histogram')}</div></div><p class="field-help">${note}</p>` };
  }
  if (config.tab === 'spatial') {
    const noisy = c.noise === 'none' ? source : addNoise(source, { kind: c.noise, amount: c.amount, seed: Math.round(c.seed) });
    const kernel = c.kernel === 'gaussian' ? gaussianKernel(c.sigma) : KERNELS[c.kernel].kernel;
    const linear = correlate(noisy, kernel), median = medianFilter(noisy, Math.max(1, Math.round(c.median) | 1));
    const signed = c.kernel.startsWith('laplacian') || c.kernel === 'emboss';
    const clip = (img) => ({ ...img, data: img.data.map((v) => Math.max(0, Math.min(255, v))) });
    const controls = `${sourceControls}${dipSelect('spatial.noise', 'Add noise', c.noise, [['none', 'None'], ['gaussian', 'Gaussian (σ grey levels)'], ['salt-pepper', 'Salt & pepper (% of pixels)']])}${c.noise === 'none' ? '' : `${dipField('spatial.amount', 'Amount', c.amount)}${dipField('spatial.seed', 'Seed', c.seed)}`}${dipSelect('spatial.kernel', 'Linear filter', c.kernel, [...Object.entries(KERNELS).map(([id, k]) => [id, k.label]), ['gaussian', 'Gaussian (σ)']])}${c.kernel === 'gaussian' ? dipField('spatial.sigma', 'σ', c.sigma, 'px') : ''}${dipField('spatial.median', 'Median window', c.median, 'px')}`;
    const kernelTable = kernel.length <= 7 ? `<table class="playfair-grid dip-kernel">${kernel.map((row) => `<tr>${row.map((v) => `<td>${fmt(v, 3)}</td>`).join('')}</tr>`).join('')}</table>` : `<p class="field-help">${kernel.length}×${kernel.length} kernel.</p>`;
    return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Original')}${dipCanvas(noisy, c.noise === 'none' ? 'Input' : `Noisy — PSNR ${fmt(psnr(source, noisy), 4)} dB`)}${dipCanvas(signed ? linear : clip(linear), `${c.kernel === 'gaussian' ? `Gaussian σ = ${c.sigma}` : KERNELS[c.kernel].label} — PSNR ${fmt(psnr(source, clip(linear)), 4)} dB`, { signed })}${dipCanvas(median, `Median ${Math.round(c.median) | 1}×${Math.round(c.median) | 1} — PSNR ${fmt(psnr(source, median), 4)} dB`)}</div><div class="power-grid"><div><span class="panel-label">KERNEL (CORRELATION, EDGES REFLECTED)</span>${kernelTable}</div><p class="field-help">Mean and Gaussian filters average noise away but blur edges; the median filter removes salt-and-pepper impulses while keeping edges. Results match scipy.ndimage.</p></div>` };
  }
  if (config.tab === 'edges') {
    const g = gradient(source, c.operator), edges = canny(source, { sigma: c.sigma, low: c.low, high: c.high });
    const controls = `${sourceControls}${dipSelect('edges.operator', 'Gradient operator', c.operator, [['sobel', 'Sobel'], ['prewitt', 'Prewitt']])}${dipField('edges.sigma', 'Canny σ', c.sigma, 'px')}${dipField('edges.low', 'Low threshold', c.low)}${dipField('edges.high', 'High threshold', c.high)}`;
    return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Input')}${dipCanvas(g.gx, 'Gx (vertical edges)', { signed: true })}${dipCanvas(g.gy, 'Gy (horizontal edges)', { signed: true })}${dipCanvas(dipScaled(g.magnitude), '|∇f| = √(Gx² + Gy²)')}</div><div class="dip-row">${dipCanvas(edges.smooth, `1. Gaussian σ = ${c.sigma}`)}${dipCanvas(dipScaled(edges.magnitude), '2. Gradient magnitude')}${dipCanvas(dipScaled(edges.suppressed), '3. Non-maximum suppression')}${dipCanvas(edges.edges, `4. Hysteresis ${c.low}/${c.high} — ${edges.edgePixels} edge pixels`)}</div><p class="field-help">Canny keeps a pixel if it is a local maximum across the edge and either above the high threshold or connected to one through pixels above the low threshold.</p>` };
  }
  if (config.tab === 'frequency') {
    const r = frequencyFilter(source, { kind: c.kind, pass: c.pass, cutoff: c.cutoff, order: c.order });
    const controls = `${sourceControls}${dipSelect('frequency.kind', 'Filter', c.kind, Object.entries(FREQUENCY_FILTERS))}${dipSelect('frequency.pass', 'Type', c.pass, [['low', 'Low-pass (smooth)'], ['high', 'High-pass (detail)']])}${dipField('frequency.cutoff', 'Cut-off D₀', c.cutoff, 'cycles')}${c.kind === 'butterworth' ? dipField('frequency.order', 'Order n', c.order) : ''}`;
    return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Input')}${dipCanvas(r.spectrum, 'log(1 + |F(u, v)|), centred')}${dipCanvas(r.response, `H(u, v) — ${FREQUENCY_FILTERS[c.kind]} ${c.pass}-pass`)}${dipCanvas(r.filtered, 'F·H')}${dipCanvas(r.image, `Output — keeps ${fmt(r.energyKept * 100, 4)} % of the energy`, { signed: c.pass === 'high' })}</div><p class="field-help">The 2-D FFT is computed row by row then column by column. The ideal filter rings (Gibbs) because its impulse response is a 2-D sinc; Butterworth and Gaussian filters roll off smoothly and do not.</p>` };
  }
  if (config.tab === 'morphology') {
    const t = c.auto === 'yes' ? otsu(source).threshold : c.threshold;
    const binary = threshold(source, t), element = structuringElement(c.shape, Math.max(1, Math.round(c.size) | 1));
    const result = morphology(binary, c.operation, element), labels = components(result);
    const coloured = { ...result, data: Float64Array.from(labels.labels, (label) => (label ? 60 + (label * 53) % 190 : 0)) };
    const controls = `${sourceControls}${dipSelect('morphology.auto', 'Binarise with', c.auto, [['yes', 'Otsu threshold'], ['no', 'Fixed threshold']])}${c.auto === 'yes' ? '' : dipField('morphology.threshold', 'Threshold', c.threshold)}${dipSelect('morphology.operation', 'Operation', c.operation, [['erode', 'Erosion'], ['dilate', 'Dilation'], ['open', 'Opening (erode → dilate)'], ['close', 'Closing (dilate → erode)'], ['gradient', 'Morphological gradient'], ['boundary', 'Boundary (A − A⊖B)']])}${dipSelect('morphology.shape', 'Structuring element', c.shape, [['square', 'Square'], ['cross', 'Cross'], ['disk', 'Disk']])}${dipField('morphology.size', 'Size', c.size, 'px')}`;
    return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Input')}${dipCanvas(binary, `Binary (t = ${t})`)}${dipCanvas(result, `${c.operation} with ${c.size}×${c.size} ${c.shape}`)}${dipCanvas(coloured, `${labels.count} connected objects`)}</div><table class="truth-table comm-table power-table"><thead><tr><th>Object</th><th>Area (px)</th><th>Centroid</th></tr></thead><tbody>${labels.regions.slice(0, 20).map((r) => `<tr><td>${r.label}</td><td>${r.area}</td><td>(${fmt(r.cx, 4)}, ${fmt(r.cy, 4)})</td></tr>`).join('')}</tbody></table><p class="field-help">8-connected labelling. Erosion, dilation and labels match scipy.ndimage. Try the "Cells" image: opening separates touching blobs, closing fills small holes.</p>` };
  }
  const r = jpegCompress(source, c.quality);
  const block = (rows, title, digits = 0) => `<div><span class="panel-label">${title}</span><table class="playfair-grid dip-kernel">${rows.map((row) => `<tr>${row.map((v) => `<td class="${v === 0 ? 'zero' : ''}">${fmt(v, digits || 3)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const controls = `${sourceControls}<label>Quality ${c.quality}<input type="range" min="1" max="100" step="1" data-dip-range="compression.quality" value="${c.quality}"></label>`;
  return { controls, body: `<div class="dip-row">${dipCanvas(source, 'Original')}${dipCanvas(r.image, `Quality ${c.quality} — PSNR ${fmt(r.psnr, 4)} dB`)}${dipCanvas({ ...source, data: source.data.map((v, i) => 128 + 4 * (v - r.image.data[i])) }, 'Error × 4')}</div><div class="analysis-readouts">${readout('Non-zero coefficients kept', `${fmt(r.nonzeroFraction * 100, 4)} % (≈ ${fmt(1 / Math.max(r.nonzeroFraction, 1e-6), 3)}× fewer numbers before entropy coding)`)}</div><div class="dip-blocks">${r.firstBlock ? `${block(r.firstBlock.pixels, 'FIRST 8×8 BLOCK')}${block(r.firstBlock.coefficients, 'DCT COEFFICIENTS (LEVEL-SHIFTED)', 1)}${block(r.table, 'QUANTISATION TABLE')}${block(r.firstBlock.quantised, 'QUANTISED')}${block(r.firstBlock.restored, 'RECONSTRUCTED')}` : ''}</div><p class="field-help">JPEG baseline luminance coding without the entropy stage: shift by −128, 8×8 orthonormal DCT (matches scipy), divide by the IJG-scaled table and round. High frequencies (bottom right) quantise to zero first.</p>` };
}
export function renderDip(state) {
  const config = dipLab.configuration(state);
  dipCanvases.clear();
  let view;
  try { view = renderDipTab(config); } catch (error) { view = { controls: '', body: labError('dip', 'Image processing', error) }; }
  return `<div class="page scroll-page power-page sigsys-page dip-page">${pageHeader(modules.find((item) => item.id === 'dip'), 'DIGITAL IMAGE PROCESSING', '')}${labTabs(DIP_TABS, config.tab, 'data-dip-tab')}<div class="dsp-card"><div class="dsp-controls">${view.controls}</div>${view.body}</div></div>`;
}
export function bindDipEvents() {
  bindLabControls('dip', dipLab, ['name', 'operation', 'kernel', 'noise', 'operator', 'kind', 'pass', 'auto', 'shape']);
  document.querySelectorAll('[data-dip-canvas]').forEach((canvas) => {
    const img = dipCanvases.get(canvas.dataset.dipCanvas); if (!img) return;
    const context = canvas.getContext('2d'), data = context.createImageData(img.width, img.height);
    for (let i = 0; i < img.data.length; i += 1) { const v = Math.max(0, Math.min(255, Math.round(img.data[i]))); data.data[4 * i] = v; data.data[4 * i + 1] = v; data.data[4 * i + 2] = v; data.data[4 * i + 3] = 255; }
    context.putImageData(data, 0, 0);
  });
  document.querySelectorAll('[data-dip-range]').forEach((input) => input.addEventListener('change', () => { const [group, key] = input.dataset.dipRange.split('.'); dipLab.persist((config) => { config[group][key] = Number(input.value); }); }));
  document.querySelector('[data-dip-upload]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file), picture = new Image();
    picture.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = picture.naturalWidth; canvas.height = picture.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(picture, 0, 0);
      const grey = fromRgba(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, 128);
      URL.revokeObjectURL(url);
      const bytes = Uint8Array.from(grey.data, (v) => Math.max(0, Math.min(255, Math.round(v))));
      dipLab.persist((config) => { config.source.name = 'upload'; config.source.upload = btoa(String.fromCharCode(...bytes)); });
    };
    picture.onerror = () => { URL.revokeObjectURL(url); notify('That file could not be read as a picture.', 'error'); };
    picture.src = url;
  });
}
