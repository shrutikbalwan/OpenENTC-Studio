// Digital image processing on greyscale images { width, height, data: Float64Array (0–255) }:
// test images, point operations and histograms, Otsu thresholding, convolution and order
// filters, gradient and Canny edges, binary morphology and connected components, the 2-D FFT
// with frequency-domain filters, and JPEG-style 8×8 DCT compression with PSNR.

export const image = (width, height, data = null) => ({ width, height, data: data ?? new Float64Array(width * height) });
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const at = (img, x, y) => img.data[y * img.width + x];
const mapImage = (img, fn) => image(img.width, img.height, img.data.map(fn));

// Half-sample symmetric reflection, as scipy.ndimage mode='reflect' (d c b a | a b c d | d c b a).
const reflect = (i, n) => { if (n === 1) return 0; const period = 2 * n; i = ((i % period) + period) % period; return i < n ? i : period - 1 - i; };

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------
// Test images (generated, so nothing has to be downloaded).

export const TEST_IMAGES = Object.freeze({
  shapes: 'Shapes on a gradient', checker: 'Checkerboard', rings: 'Zone plate (rings)', text: 'Bars and text-like strokes', blobs: 'Cells (blobs) for counting', low: 'Low-contrast scene',
});
export function testImage(name = 'shapes', size = 128) {
  const img = image(size, size), s = size / 128;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    let v;
    const u = x / s, w = y / s;
    if (name === 'checker') v = (Math.floor(u / 16) + Math.floor(w / 16)) % 2 ? 220 : 35;
    else if (name === 'rings') { const r2 = ((u - 64) ** 2 + (w - 64) ** 2); v = 127.5 + 127.5 * Math.cos(r2 / 40); }
    else if (name === 'text') { v = 230; if ((u > 10 && u < 118 && ((w > 14 && w < 20) || (w > 108 && w < 114)))) v = 20; for (let k = 0; k < 8; k += 1) { const cx = 16 + k * 13; if (Math.abs(u - cx) < 2.5 && w > 30 && w < 95) v = 25; if (k % 2 && Math.abs(w - 62) < 2.5 && u > cx && u < cx + 11) v = 25; } }
    else if (name === 'blobs') { v = 40; const centres = [[24, 22, 10], [60, 30, 13], [100, 20, 9], [30, 70, 12], [75, 72, 15], [110, 66, 8], [20, 110, 9], [58, 108, 11], [96, 108, 14]]; for (const [cx, cy, r] of centres) if ((u - cx) ** 2 + (w - cy) ** 2 < r * r) v = 200 - 40 * ((u - cx) ** 2 + (w - cy) ** 2) / (r * r); }
    else if (name === 'low') { v = 100 + 30 * (u / 128) + ((u - 70) ** 2 + (w - 60) ** 2 < 900 ? 25 : 0) + (u > 15 && u < 45 && w > 80 && w < 115 ? -20 : 0); }
    else { v = 40 + 120 * u / 128; if ((u - 40) ** 2 + (w - 44) ** 2 < 400) v = 230; if (u > 70 && u < 112 && w > 24 && w < 60) v = 15; if (Math.abs(u - 64) + Math.abs(w - 98) < 22) v = 190; if (w > 120) v = 255 * (u / 128); }
    img.data[y * size + x] = clamp(v);
  }
  return img;
}

// ---------------------------------------------------------------------------
// Point operations and histograms.

export function histogram(img, bins = 256) {
  const counts = new Array(bins).fill(0);
  for (const v of img.data) counts[Math.min(bins - 1, Math.floor(clamp(Math.round(v)) * bins / 256))] += 1;
  return counts;
}
export const negative = (img) => mapImage(img, (v) => 255 - v);
export const gamma = (img, g) => mapImage(img, (v) => 255 * (v / 255) ** g);
export const logTransform = (img) => mapImage(img, (v) => 255 * Math.log1p(v) / Math.log(256));
export function contrastStretch(img, lowPercent = 1, highPercent = 99) {
  const sorted = Float64Array.from(img.data).sort(), lo = sorted[Math.floor(sorted.length * lowPercent / 100)], hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * highPercent / 100))];
  return { image: mapImage(img, (v) => clamp((v - lo) * 255 / Math.max(1e-9, hi - lo))), low: lo, high: hi };
}
/** Histogram equalisation with the classic s = round((L − 1)·CDF(r)) mapping on integer levels. */
export function equalize(img) {
  const h = histogram(img), n = img.data.length, map = new Array(256);
  let cumulative = 0;
  for (let k = 0; k < 256; k += 1) { cumulative += h[k]; map[k] = Math.round(255 * cumulative / n); }
  return { image: mapImage(img, (v) => map[clamp(Math.round(v))]), mapping: map };
}
export const threshold = (img, t) => mapImage(img, (v) => (v > t ? 255 : 0));
/** Otsu's threshold: maximise between-class variance over integer levels (as skimage). */
export function otsu(img) {
  const h = histogram(img), n = img.data.length;
  let sumAll = 0; for (let k = 0; k < 256; k += 1) sumAll += k * h[k];
  let w0 = 0, sum0 = 0, best = 0, bestT = 0;
  const variance = [];
  for (let t = 0; t < 256; t += 1) {
    w0 += h[t]; sum0 += t * h[t];
    const w1 = n - w0;
    if (!w0 || !w1) { variance.push(0); continue; }
    const m0 = sum0 / w0, m1 = (sumAll - sum0) / w1, between = w0 * w1 * (m0 - m1) ** 2 / (n * n);
    variance.push(between);
    if (between > best) { best = between; bestT = t; }
  }
  return { threshold: bestT, variance };
}
export const bitPlane = (img, bit) => mapImage(img, (v) => ((clamp(Math.round(v)) >> bit) & 1) * 255);

// ---------------------------------------------------------------------------
// Spatial filtering.

/** Correlation with a kernel (scipy.ndimage.correlate, mode='reflect'). */
export function correlate(img, kernel) {
  const kh = kernel.length, kw = kernel[0].length, cy = Math.floor(kh / 2), cx = Math.floor(kw / 2), out = image(img.width, img.height);
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    let acc = 0;
    for (let j = 0; j < kh; j += 1) { const yy = reflect(y + j - cy, img.height); for (let i = 0; i < kw; i += 1) acc += kernel[j][i] * img.data[yy * img.width + reflect(x + i - cx, img.width)]; }
    out.data[y * img.width + x] = acc;
  }
  return out;
}
export const KERNELS = Object.freeze({
  box3: { label: 'Mean 3×3', kernel: Array.from({ length: 3 }, () => Array(3).fill(1 / 9)) },
  box5: { label: 'Mean 5×5', kernel: Array.from({ length: 5 }, () => Array(5).fill(1 / 25)) },
  laplacian: { label: 'Laplacian (4-neighbour)', kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]] },
  laplacian8: { label: 'Laplacian (8-neighbour)', kernel: [[1, 1, 1], [1, -8, 1], [1, 1, 1]] },
  sharpen: { label: 'Sharpen (centre 5)', kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  emboss: { label: 'Emboss', kernel: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]] },
});
export function gaussianKernel(sigma, radius = Math.ceil(3 * sigma)) {
  const row = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const total = row.reduce((s, v) => s + v, 0) ** 2;
  return row.map((a) => row.map((b) => a * b / total));
}
export function medianFilter(img, size = 3) {
  const r = Math.floor(size / 2), out = image(img.width, img.height), window = [];
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    window.length = 0;
    for (let j = -r; j <= r; j += 1) for (let i = -r; i <= r; i += 1) window.push(at(img, reflect(x + i, img.width), reflect(y + j, img.height)));
    window.sort((a, b) => a - b);
    out.data[y * img.width + x] = window[window.length >> 1];
  }
  return out;
}
export function addNoise(img, { kind = 'gaussian', amount = 20, seed = 1 } = {}) {
  const random = mulberry32(seed);
  const gauss = () => { let u = 0; while (u === 0) u = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random()); };
  return mapImage(img, (v) => (kind === 'salt-pepper' ? (random() < amount / 100 ? (random() < 0.5 ? 0 : 255) : v) : clamp(v + amount * gauss())));
}

/** Sobel or Prewitt gradients (scipy.ndimage.sobel/prewitt orientation) with magnitude and angle. */
export function gradient(img, operator = 'sobel') {
  const w = operator === 'prewitt' ? 1 : 2;
  const gx = correlate(img, [[-1, 0, 1], [-w, 0, w], [-1, 0, 1]]), gy = correlate(img, [[-1, -w, -1], [0, 0, 0], [1, w, 1]]);
  const magnitude = image(img.width, img.height, gx.data.map((v, i) => Math.hypot(v, gy.data[i]))), angle = gx.data.map((v, i) => Math.atan2(gy.data[i], v));
  return { gx, gy, magnitude, angle };
}

/** Canny: Gaussian smoothing, Sobel, non-maximum suppression, double threshold and hysteresis. */
export function canny(img, { sigma = 1.4, low = 20, high = 50 } = {}) {
  const smooth = correlate(img, gaussianKernel(sigma));
  const { magnitude, angle } = gradient(smooth);
  const { width, height } = img, nms = image(width, height);
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const i = y * width + x, a = ((angle[i] * 180 / Math.PI) + 180) % 180, m = magnitude.data[i];
    const [dx, dy] = a < 22.5 || a >= 157.5 ? [1, 0] : a < 67.5 ? [1, 1] : a < 112.5 ? [0, 1] : [-1, 1];
    if (m >= magnitude.data[i + dy * width + dx] && m >= magnitude.data[i - dy * width - dx]) nms.data[i] = m;
  }
  const edges = image(width, height), stack = [];
  for (let i = 0; i < nms.data.length; i += 1) if (nms.data[i] >= high) { edges.data[i] = 255; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % width, y = (i - x) / width;
    for (let j = -1; j <= 1; j += 1) for (let k = -1; k <= 1; k += 1) {
      const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const n = yy * width + xx;
      if (!edges.data[n] && nms.data[n] >= low) { edges.data[n] = 255; stack.push(n); }
    }
  }
  return { smooth, magnitude, suppressed: nms, edges, edgePixels: edges.data.reduce((s, v) => s + (v ? 1 : 0), 0) };
}

// ---------------------------------------------------------------------------
// Binary morphology and components.

export function structuringElement(shape = 'square', size = 3) {
  const r = Math.floor(size / 2);
  return Array.from({ length: size }, (_, j) => Array.from({ length: size }, (_, i) => (shape === 'cross' ? (i === r || j === r) : shape === 'disk' ? (i - r) ** 2 + (j - r) ** 2 <= r * r + r * 0.5 : true)));
}
/** Erosion/dilation of a binary image (values > 127 are foreground); outside counts as background. */
export function morphology(img, operation, element) {
  const kh = element.length, kw = element[0].length, cy = Math.floor(kh / 2), cx = Math.floor(kw / 2), { width, height } = img;
  const fg = (x, y) => x >= 0 && y >= 0 && x < width && y < height && img.data[y * width + x] > 127;
  const erodeOrDilate = (source, erode) => {
    const out = image(width, height);
    const test = source === img ? fg : (x, y) => x >= 0 && y >= 0 && x < width && y < height && source.data[y * width + x] > 127;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      let value = erode;
      for (let j = 0; j < kh && value === erode; j += 1) for (let i = 0; i < kw; i += 1) {
        if (!element[j][i]) continue;
        const hit = erode ? test(x + i - cx, y + j - cy) : test(x - (i - cx), y - (j - cy));
        if (erode && !hit) { value = false; break; }
        if (!erode && hit) { value = true; break; }
      }
      out.data[y * width + x] = value ? 255 : 0;
    }
    return out;
  };
  if (operation === 'erode') return erodeOrDilate(img, true);
  if (operation === 'dilate') return erodeOrDilate(img, false);
  if (operation === 'open') return erodeOrDilate(erodeOrDilate(img, true), false);
  if (operation === 'close') return erodeOrDilate(erodeOrDilate(img, false), true);
  if (operation === 'gradient') { const d = erodeOrDilate(img, false), e = erodeOrDilate(img, true); return image(width, height, d.data.map((v, i) => (v && !e.data[i] ? 255 : 0))); }
  if (operation === 'boundary') { const e = erodeOrDilate(img, true); return image(width, height, img.data.map((v, i) => (v > 127 && !e.data[i] ? 255 : 0))); }
  throw new RangeError(`Unknown morphological operation "${operation}".`);
}
/** Connected components (8-connectivity) of a binary image with area and centroid. */
export function components(img, connectivity = 8) {
  const { width, height } = img, labels = new Int32Array(width * height), regions = [];
  const steps = connectivity === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] || img.data[start] <= 127) continue;
    const label = regions.length + 1, stack = [start];
    labels[start] = label;
    let area = 0, sx = 0, sy = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % width, y = (i - x) / width;
      area += 1; sx += x; sy += y;
      for (const [dx, dy] of steps) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue; const n = yy * width + xx; if (!labels[n] && img.data[n] > 127) { labels[n] = label; stack.push(n); } }
    }
    regions.push({ label, area, cx: sx / area, cy: sy / area });
  }
  return { labels, regions, count: regions.length };
}

// ---------------------------------------------------------------------------
// Frequency domain.

function fft1(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    for (let s = 0; s < n; s += size) for (let k = 0; k < size / 2; k += 1) {
      const wr = Math.cos(angle * k), wi = Math.sin(angle * k), a = s + k, b = a + size / 2;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
  if (inverse) for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
}
/** 2-D FFT of a power-of-two image (rows then columns). */
export function fft2(img, inverse = false, imagPart = null) {
  const { width: w, height: h } = img;
  if (w & (w - 1) || h & (h - 1)) throw new RangeError('The 2-D FFT needs power-of-two dimensions.');
  const re = Float64Array.from(img.data), im = imagPart ? Float64Array.from(imagPart) : new Float64Array(w * h);
  const rowRe = new Float64Array(w), rowIm = new Float64Array(w), colRe = new Float64Array(h), colIm = new Float64Array(h);
  for (let y = 0; y < h; y += 1) { for (let x = 0; x < w; x += 1) { rowRe[x] = re[y * w + x]; rowIm[x] = im[y * w + x]; } fft1(rowRe, rowIm, inverse); for (let x = 0; x < w; x += 1) { re[y * w + x] = rowRe[x]; im[y * w + x] = rowIm[x]; } }
  for (let x = 0; x < w; x += 1) { for (let y = 0; y < h; y += 1) { colRe[y] = re[y * w + x]; colIm[y] = im[y * w + x]; } fft1(colRe, colIm, inverse); for (let y = 0; y < h; y += 1) { re[y * w + x] = colRe[y]; im[y * w + x] = colIm[y]; } }
  return { width: w, height: h, re, im };
}
/** log(1 + |F|) with the zero frequency moved to the centre, scaled to 0–255. */
export function spectrumImage(spectrum) {
  const { width: w, height: h } = spectrum, out = image(w, h);
  let max = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const v = Math.log1p(Math.hypot(spectrum.re[y * w + x], spectrum.im[y * w + x])); out.data[((y + h / 2) % h) * w + ((x + w / 2) % w)] = v; max = Math.max(max, v); }
  out.data = out.data.map((v) => 255 * v / (max || 1));
  return out;
}
export const FREQUENCY_FILTERS = Object.freeze({ ideal: 'Ideal', butterworth: 'Butterworth (order n)', gaussian: 'Gaussian' });
/** Low- or high-pass filtering in the frequency domain with cut-off D0 (in frequency samples). */
export function frequencyFilter(img, { kind = 'gaussian', pass = 'low', cutoff = 20, order = 2 } = {}) {
  const F = fft2(img), { width: w, height: h } = F;
  const H = new Float64Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const u = x < w / 2 ? x : x - w, v = y < h / 2 ? y : y - h, d = Math.hypot(u, v);
    let low = kind === 'ideal' ? (d <= cutoff ? 1 : 0) : kind === 'butterworth' ? 1 / (1 + (d / cutoff) ** (2 * order)) : Math.exp(-(d * d) / (2 * cutoff * cutoff));
    H[y * w + x] = pass === 'low' ? low : 1 - low;
  }
  const filteredRe = F.re.map((v, i) => v * H[i]), filteredIm = F.im.map((v, i) => v * H[i]);
  const back = fft2(image(w, h, filteredRe), true, filteredIm);
  const kept = filteredRe.reduce((s, v, i) => s + v * v + filteredIm[i] ** 2, 0) / F.re.reduce((s, v, i) => s + v * v + F.im[i] ** 2, 0);
  const response = image(w, h); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) response.data[((y + h / 2) % h) * w + ((x + w / 2) % w)] = 255 * H[y * w + x];
  return { image: image(w, h, back.re.map((v) => (pass === 'low' ? clamp(v) : v))), spectrum: spectrumImage(F), filtered: spectrumImage({ width: w, height: h, re: filteredRe, im: filteredIm }), response, energyKept: kept };
}

// ---------------------------------------------------------------------------
// Quality and compression.

export function mse(a, b) { let s = 0; for (let i = 0; i < a.data.length; i += 1) s += (a.data[i] - b.data[i]) ** 2; return s / a.data.length; }
export const psnr = (a, b) => { const m = mse(a, b); return m === 0 ? Infinity : 10 * Math.log10(255 * 255 / m); };

const C8 = Array.from({ length: 8 }, (_, k) => Array.from({ length: 8 }, (_, n) => (k === 0 ? Math.SQRT1_2 : 1) * 0.5 * Math.cos((2 * n + 1) * k * Math.PI / 16)));
/** Orthonormal 8×8 DCT-II (scipy.fft.dctn(norm='ortho')). */
export function dct8(block, inverse = false) {
  const out = Array.from({ length: 8 }, () => new Array(8).fill(0));
  for (let u = 0; u < 8; u += 1) for (let v = 0; v < 8; v += 1) {
    let s = 0;
    for (let x = 0; x < 8; x += 1) for (let y = 0; y < 8; y += 1) s += inverse ? C8[x][u] * C8[y][v] * block[x][y] : C8[u][x] * C8[v][y] * block[x][y];
    out[u][v] = s;
  }
  return out;
}
export const JPEG_LUMINANCE = Object.freeze([[16, 11, 10, 16, 24, 40, 51, 61], [12, 12, 14, 19, 26, 58, 60, 55], [14, 13, 16, 24, 40, 57, 69, 56], [14, 17, 22, 29, 51, 87, 80, 62], [18, 22, 37, 56, 68, 109, 103, 77], [24, 35, 55, 64, 81, 104, 113, 92], [49, 64, 78, 87, 103, 121, 120, 101], [72, 92, 95, 98, 112, 100, 103, 99]]);
/** JPEG-style coding: level shift, 8×8 DCT, quantise with the IJG-scaled table, reconstruct. */
export function jpegCompress(img, quality = 50) {
  const q = Math.max(1, Math.min(100, quality)), scale = q < 50 ? 5000 / q : 200 - 2 * q;
  const table = JPEG_LUMINANCE.map((row) => row.map((v) => Math.max(1, Math.min(255, Math.floor((v * scale + 50) / 100)))));
  const out = image(img.width, img.height);
  let nonzero = 0, blocks = 0, firstBlock = null;
  for (let by = 0; by < img.height; by += 8) for (let bx = 0; bx < img.width; bx += 8) {
    const block = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => at(img, Math.min(img.width - 1, bx + x), Math.min(img.height - 1, by + y)) - 128));
    const coefficients = dct8(block), quantised = coefficients.map((row, u) => row.map((v, k) => Math.round(v / table[u][k])));
    nonzero += quantised.flat().filter((v) => v !== 0).length; blocks += 1;
    const restored = dct8(quantised.map((row, u) => row.map((v, k) => v * table[u][k])), true);
    if (!firstBlock) firstBlock = { pixels: block.map((row) => row.map((v) => v + 128)), coefficients, quantised, restored: restored.map((row) => row.map((v) => clamp(Math.round(v + 128)))) };
    for (let y = 0; y < 8 && by + y < img.height; y += 1) for (let x = 0; x < 8 && bx + x < img.width; x += 1) out.data[(by + y) * img.width + bx + x] = clamp(Math.round(restored[y][x] + 128));
  }
  return { image: out, table, nonzeroFraction: nonzero / (blocks * 64), psnr: psnr(img, out), firstBlock };
}

/** Resize (bilinear) and convert RGBA bytes to grey (ITU-R BT.601 luma) for uploaded pictures. */
export function fromRgba(rgba, width, height, size = 128) {
  const out = image(size, size);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const sx = Math.min(width - 1, Math.floor(x * width / size)), sy = Math.min(height - 1, Math.floor(y * height / size)), i = 4 * (sy * width + sx);
    out.data[y * size + x] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return out;
}
