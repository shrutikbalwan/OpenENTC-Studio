// Complex arithmetic and polynomials (coefficients in descending powers) shared by
// the filter designer and the control-systems lab.

export const complex = (re, im = 0) => ({ re, im });
export const cadd = (a, b) => complex(a.re + b.re, a.im + b.im);
export const csub = (a, b) => complex(a.re - b.re, a.im - b.im);
export const cmul = (a, b) => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return complex((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
export const cabs = (a) => Math.hypot(a.re, a.im);
export const cscale = (a, s) => complex(a.re * s, a.im * s);
export const csqrt = (a) => { const r = Math.sqrt(cabs(a)), angle = Math.atan2(a.im, a.re) / 2; return complex(r * Math.cos(angle), r * Math.sin(angle)); };
export const cexp = (a) => complex(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));

/** Evaluate a real- or complex-coefficient polynomial at complex x (Horner). */
export function polyval(coefficients, x) {
  let result = complex(0, 0);
  for (const c of coefficients) result = cadd(cmul(result, x), typeof c === 'number' ? complex(c) : c);
  return result;
}

/** Monic polynomial with the given complex roots; returns real coefficients when roots come in conjugate pairs. */
export function polyFromRoots(roots) {
  let coefficients = [complex(1)];
  for (const root of roots) {
    const next = coefficients.map((c) => complex(c.re, c.im)).concat([complex(0)]);
    for (let i = 1; i < next.length; i += 1) next[i] = csub(next[i], cmul(root, coefficients[i - 1]));
    coefficients = next;
  }
  return coefficients.map((c) => c.re);
}

export function trimLeadingZeros(coefficients) {
  let start = 0;
  while (start < coefficients.length - 1 && Math.abs(coefficients[start]) === 0) start += 1;
  return coefficients.slice(start);
}

/** All complex roots by the Aberth-Ehrlich method (simultaneous Newton with repulsion). */
export function polyRoots(input) {
  let coefficients = trimLeadingZeros(input.map(Number));
  if (coefficients.some((c) => !Number.isFinite(c))) throw new TypeError('Polynomial coefficients must be finite.');
  const zeros = [];
  while (coefficients.length > 1 && coefficients.at(-1) === 0) { coefficients = coefficients.slice(0, -1); zeros.push(complex(0)); }
  const degree = coefficients.length - 1;
  if (degree < 1) return zeros;
  if (degree > 128) throw new RangeError('Polynomial degree is limited to 128.');
  const monic = coefficients.map((c) => c / coefficients[0]);
  const derivative = monic.slice(0, -1).map((c, i) => c * (degree - i));
  // Fujiwara bound on root magnitudes sets the starting circle.
  const bound = 2 * Math.max(...monic.slice(1).map((c, i) => Math.abs(c) ** (1 / (i + 1))));
  let roots = Array.from({ length: degree }, (_, k) => cscale(cexp(complex(0, 2 * Math.PI * k / degree + 0.4)), Math.max(bound, 1e-3) * 0.9));
  for (let iteration = 0; iteration < 500; iteration += 1) {
    let moved = 0;
    roots = roots.map((root, k) => {
      const value = polyval(monic, root);
      const slope = polyval(derivative, root);
      if (cabs(value) === 0) return root;
      const ratio = cdiv(value, slope);
      let repulsion = complex(0);
      roots.forEach((other, j) => { if (j !== k) repulsion = cadd(repulsion, cdiv(complex(1), csub(root, other))); });
      const step = cdiv(ratio, csub(complex(1), cmul(ratio, repulsion)));
      moved = Math.max(moved, cabs(step) / Math.max(1, cabs(root)));
      return csub(root, step);
    });
    if (moved < 1e-15) break;
  }
  // Snap conjugate-pair noise so real roots read as real.
  return [...zeros, ...roots.map((root) => complex(root.re, Math.abs(root.im) < 1e-10 * Math.max(1, Math.abs(root.re)) ? 0 : root.im))]
    .sort((a, b) => a.re - b.re || a.im - b.im);
}

/** Polynomial product and sum (descending coefficients). */
export function polymul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] += x * y; }));
  return out;
}
export function polyadd(a, b) {
  const length = Math.max(a.length, b.length);
  const pad = (p) => [...new Array(length - p.length).fill(0), ...p];
  const x = pad(a), y = pad(b);
  return x.map((value, index) => value + y[index]);
}
