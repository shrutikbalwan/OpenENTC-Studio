import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addNoise, canny, components, correlate, dct8, equalize, fft2, frequencyFilter, gradient, histogram, image, jpegCompress, medianFilter, morphology, otsu, psnr, structuringElement, testImage } from '../packages/imaging/src/index.mjs';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
// scipy.ndimage 1.17 and scikit-image 0.26 on the same 64×64 test images (rounded to integers).
const ref = JSON.parse(readFileSync(new URL('./fixtures/imaging/scipy-skimage.json', import.meta.url), 'utf8'));
const load = (name) => { const img = testImage(name, 64); img.data = img.data.map(Math.round); return img; };
const same = (actual, expected, label, tolerance = 1e-9) => expected.forEach((v, i) => near(actual[i], v, tolerance, `${label}[${i}]`));

test('convolution, Sobel and median filters equal scipy.ndimage (mode reflect)', () => {
  const a = load('shapes');
  const g = gradient(a);
  same(g.gx.data, ref.sobelx, 'sobel x'); same(g.gy.data, ref.sobely, 'sobel y');
  same(correlate(a, [[0, 1, 0], [1, -4, 1], [0, 1, 0]]).data, ref.laplace, 'laplace');
  same(medianFilter(a, 3).data, ref.median3, 'median 3');
  same(medianFilter(load('low'), 5).data, ref.median5, 'median 5');
});

test('Otsu thresholds equal scikit-image; morphology and labels equal scipy', () => {
  for (const name of ['shapes', 'blobs', 'low']) assert.equal(otsu(load(name)).threshold, ref.otsu[name], name);
  const blobs = load('blobs'), t = otsu(blobs).threshold;
  const binary = image(64, 64, blobs.data.map((v) => (v > t ? 255 : 0)));
  const square = structuringElement('square', 3);
  assert.equal(Array.from(morphology(binary, 'erode', square).data, (v) => (v ? 1 : 0)).join(''), ref.erode);
  assert.equal(Array.from(morphology(binary, 'dilate', square).data, (v) => (v ? 1 : 0)).join(''), ref.dilate);
  assert.equal(components(binary).count, ref.labels);
  assert.equal(components(binary).count, 9, 'nine cells');
  // Opening never adds pixels, closing never removes them.
  const open = morphology(binary, 'open', square), close = morphology(binary, 'close', square);
  binary.data.forEach((v, i) => { assert.ok(open.data[i] <= v); assert.ok(close.data[i] >= v); });
});

test('2-D FFT equals the direct DFT and inverts; frequency filters behave', () => {
  const small = image(8, 8, Float64Array.from({ length: 64 }, (_, i) => (i * 37) % 23));
  const F = fft2(small);
  for (const [u, v] of [[0, 0], [1, 3], [5, 2], [7, 7]]) {
    let re = 0, im = 0;
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const angle = -2 * Math.PI * (u * x + v * y) / 8; re += small.data[y * 8 + x] * Math.cos(angle); im += small.data[y * 8 + x] * Math.sin(angle); }
    near(F.re[v * 8 + u], re, 1e-9, `Re F(${u},${v})`); near(F.im[v * 8 + u], im, 1e-9, `Im F(${u},${v})`);
  }
  const back = fft2(image(8, 8, F.re), true, F.im);
  same(back.re, Array.from(small.data), 'inverse');
  const a = load('shapes');
  const lowPass = frequencyFilter(a, { kind: 'gaussian', pass: 'low', cutoff: 8 });
  assert.ok(lowPass.energyKept < 1 && lowPass.energyKept > 0.9);
  near(lowPass.image.data.reduce((s, v) => s + v, 0) / 4096, a.data.reduce((s, v) => s + v, 0) / 4096, 0.5, 'low-pass keeps the mean');
  const highPass = frequencyFilter(a, { kind: 'ideal', pass: 'high', cutoff: 1 });
  near(highPass.image.data.reduce((s, v) => s + v, 0), 0, 1e-6, 'high-pass removes DC');
});

test('DCT equals scipy dctn(norm=ortho); JPEG quality trades size for PSNR', () => {
  const block = Array.from({ length: 8 }, (_, y) => ref.dct_block.slice(8 * y, 8 * y + 8));
  same(dct8(block).flat(), ref.dct, 'dct', 1e-8);
  same(dct8(dct8(block), true).flat(), ref.dct_block, 'idct', 1e-9);
  const a = testImage('shapes', 128);
  const q90 = jpegCompress(a, 90), q10 = jpegCompress(a, 10);
  assert.ok(q90.psnr > q10.psnr + 5, `${q90.psnr} vs ${q10.psnr}`);
  assert.ok(q90.nonzeroFraction > q10.nonzeroFraction);
  assert.equal(q10.table[0][0], 80, 'IJG scaling: Q = 10 → 5000/10 = 500 % of 16');
  near(psnr(load('shapes'), load('low')), ref.psnr, 1e-9, 'PSNR = skimage');
});

test('histogram equalisation, noise and Canny', () => {
  const low = testImage('low', 128), eq = equalize(low);
  const spread = (img) => { const h = histogram(img); const used = h.map((c, k) => (c ? k : -1)).filter((k) => k >= 0); return used.at(-1) - used[0]; };
  assert.ok(spread(eq.image) > 3 * spread(low));
  assert.equal(eq.mapping[255], 255);
  const noisy = addNoise(testImage('shapes', 64), { kind: 'salt-pepper', amount: 10, seed: 3 });
  assert.ok(psnr(testImage('shapes', 64), medianFilter(noisy, 3)) > psnr(testImage('shapes', 64), noisy) + 8, 'median removes impulses');
  const edges = canny(testImage('checker', 64), { sigma: 1, low: 30, high: 80 });
  assert.ok(edges.edgePixels > 200);
  // Checker squares are 8 px wide at size 64: along row 4 every edge pixel sits within 1 px of a square boundary.
  const row = Array.from({ length: 60 }, (_, x) => x + 2).filter((x) => edges.edges.data[4 * 64 + x]);
  assert.ok(row.length >= 6, `edges found on row 4: ${row}`);
  for (const x of row) assert.ok(Math.min(x % 8, 8 - (x % 8)) <= 1, `edge at x = ${x}`);
});
