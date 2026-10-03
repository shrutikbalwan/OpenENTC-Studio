// Signals and systems: Fourier series of standard waveforms (analytic coefficients, partial
// sums, Gibbs overshoot, Parseval), Laplace and z-transform partial fractions with inverse
// transforms, and the DFT shown term by term with the radix-2 FFT butterflies.
import { cabs, cadd, cdiv, cexp, cmul, complex, cscale, csub, polyRoots } from '../../numerics/src/polynomial.mjs';

const TAU = 2 * Math.PI;
const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));

// ---------------------------------------------------------------------------
// Fourier series:  f(t) = a0 + Σ [an·cos(nω0t) + bn·sin(nω0t)], period T.

export const WAVEFORMS = Object.freeze({
  square: { label: 'Square wave (±A)', value: (u, A) => (u < 0.5 ? A : -A), a0: () => 0, an: () => 0, bn: (n, A) => (n % 2 ? 4 * A / (n * Math.PI) : 0) },
  pulse: { label: 'Pulse train (0…A, duty d)', value: (u, A, d) => (u < d ? A : 0), a0: (A, d) => A * d, an: (n, A, d) => A / (n * Math.PI) * Math.sin(TAU * n * d), bn: (n, A, d) => A / (n * Math.PI) * (1 - Math.cos(TAU * n * d)) },
  triangle: { label: 'Triangle (±A, peak at t = 0)', value: (u, A) => A * (1 - 4 * Math.abs(u < 0.5 ? u : u - 1)), a0: () => 0, an: (n, A) => (n % 2 ? 8 * A / (n * n * Math.PI * Math.PI) : 0), bn: () => 0 },
  sawtooth: { label: 'Sawtooth (−A…A rising)', value: (u, A) => A * (2 * u - 1), a0: () => 0, an: () => 0, bn: (n, A) => -2 * A / (n * Math.PI) },
  halfwave: { label: 'Half-wave rectified sine', value: (u, A) => (u < 0.5 ? A * Math.sin(TAU * u) : 0), a0: (A) => A / Math.PI, an: (n, A) => (n === 1 || n % 2 ? 0 : -2 * A / (Math.PI * (n * n - 1))), bn: (n, A) => (n === 1 ? A / 2 : 0) },
  fullwave: { label: 'Full-wave rectified sine', value: (u, A) => A * Math.sin(Math.PI * u), a0: (A) => 2 * A / Math.PI, an: (n, A) => -4 * A / (Math.PI * (4 * n * n - 1)), bn: () => 0 },
});

/** Numerical Fourier coefficients of one period sampled at `samples` points (trapezoid = rectangle for periodic data). */
export function numericCoefficients(value, harmonics, samples = 4096) {
  let a0 = 0;
  const an = new Array(harmonics + 1).fill(0), bn = new Array(harmonics + 1).fill(0);
  for (let k = 0; k < samples; k += 1) {
    const u = (k + 0.5) / samples, f = value(u);
    a0 += f;
    for (let n = 1; n <= harmonics; n += 1) { an[n] += f * Math.cos(TAU * n * u); bn[n] += f * Math.sin(TAU * n * u); }
  }
  return { a0: a0 / samples, an: an.map((v) => 2 * v / samples), bn: bn.map((v) => 2 * v / samples) };
}

/**
 * Coefficients, magnitude/phase spectrum, partial-sum synthesis with N harmonics, the Gibbs
 * overshoot and the fraction of signal power captured (Parseval).
 */
export function fourierSeries(type, { amplitude = 1, duty = 0.5, harmonics = 9, points = 1000, frequency = 1 } = {}) {
  const wave = WAVEFORMS[type];
  if (!wave) throw new RangeError(`Unknown waveform "${type}".`);
  const N = Math.max(0, Math.min(500, Math.round(harmonics)));
  const coefficients = Array.from({ length: N }, (_, k) => {
    const n = k + 1, an = wave.an(n, amplitude, duty), bn = wave.bn(n, amplitude, duty);
    return { n, frequency: n * frequency, an, bn, magnitude: Math.hypot(an, bn), phase: Math.atan2(-bn, an) * 180 / Math.PI }; // an·cos + bn·sin = c·cos(nω0t + φ)
  });
  const a0 = wave.a0(amplitude, duty);
  const t = Array.from({ length: points }, (_, k) => 2 * k / (points - 1)); // two periods (in units of T)
  const original = t.map((x) => wave.value(x % 1, amplitude, duty));
  const synthesis = t.map((x) => coefficients.reduce((sum, c) => sum + c.an * Math.cos(TAU * c.n * x) + c.bn * Math.sin(TAU * c.n * x), a0));
  // Parseval: P = a0² + ½Σ(an² + bn²); total power from the waveform itself.
  const fine = 20000;
  let total = 0;
  for (let k = 0; k < fine; k += 1) total += wave.value((k + 0.5) / fine, amplitude, duty) ** 2;
  total /= fine;
  const captured = a0 * a0 + coefficients.reduce((sum, c) => sum + (c.an ** 2 + c.bn ** 2) / 2, 0);
  const peak = Math.max(...original), partialPeak = Math.max(...synthesis);
  return { type, a0, coefficients, t, original, synthesis, totalPower: total, capturedPower: captured, powerFraction: total > 0 ? captured / total : 1, overshoot: peak > 0 ? (partialPeak - peak) / (Math.max(...original) - Math.min(...original)) : 0, rms: Math.sqrt(total) };
}

// ---------------------------------------------------------------------------
// Complex polynomial helpers (descending coefficients, complex entries {re, im}).

const toComplex = (p) => p.map((c) => (typeof c === 'number' ? complex(c) : c));
const trim = (p) => { let i = 0; while (i < p.length - 1 && Math.abs(p[i]) < 1e-300) i += 1; return p.slice(i); };

/** Taylor coefficients of a (real, descending) polynomial around x0: P(x0 + h) = Σ c_k h^k. */
function taylorAt(poly, x0, count) {
  // Repeated synthetic division by (x − x0).
  let current = toComplex(poly);
  const out = [];
  for (let k = 0; k < count; k += 1) {
    if (!current.length) { out.push(complex(0)); continue; }
    const quotient = [];
    let carry = complex(0);
    for (const c of current) { carry = cadd(cmul(carry, x0), c); quotient.push(carry); }
    out.push(quotient.pop());
    current = quotient;
  }
  return out;
}

/** Real polynomial long division a/b (descending) → { quotient, remainder }. */
export function polyDivide(a, b) {
  const num = [...trim(a)], den = trim(b);
  if (num.length < den.length) return { quotient: [0], remainder: num };
  const quotient = new Array(num.length - den.length + 1).fill(0);
  for (let i = 0; i < quotient.length; i += 1) {
    const factor = num[i] / den[0];
    quotient[i] = factor;
    for (let j = 0; j < den.length; j += 1) num[i + j] -= factor * den[j];
  }
  return { quotient, remainder: trim(num.slice(quotient.length).length ? num.slice(quotient.length) : [0]) };
}

/** Group roots that coincide (within a relative tolerance) into poles with multiplicities. */
function clusterRoots(roots, tolerance = 1e-5) {
  const groups = [];
  for (const root of roots) {
    const group = groups.find((g) => cabs(csub(g.pole, root)) <= tolerance * Math.max(1, cabs(root)));
    if (group) { group.members.push(root); group.pole = cscale(group.members.reduce((s, r) => cadd(s, r), complex(0)), 1 / group.members.length); }
    else groups.push({ pole: root, members: [root] });
  }
  return groups.map((g) => ({ pole: complex(g.pole.re, Math.abs(g.pole.im) < 1e-9 * Math.max(1, cabs(g.pole)) ? 0 : g.pole.im), multiplicity: g.members.length }));
}

/**
 * Refine a root of multiplicity m with Newton's method on the (m − 1)-th derivative of D, where
 * it is a simple root (root finders only locate repeated roots to about ε^(1/m)).
 */
function polishRoot(den, root, m) {
  let p = root;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const t = taylorAt(den, p, m + 1); // t[k] = D^(k)(p) / k!
    const value = cscale(t[m - 1], factorial(m - 1)), slope = cscale(t[m], factorial(m));
    if (cabs(slope) === 0) break;
    const step = cdiv(value, slope);
    p = csub(p, step);
    if (cabs(step) <= 1e-16 * Math.max(1, cabs(p))) break;
  }
  return complex(p.re, Math.abs(p.im) < 1e-12 * Math.max(1, cabs(p)) ? 0 : p.im);
}

/**
 * Partial fractions of N(s)/D(s) (descending real coefficients):
 *   F(s) = Σ direct_k s^k + Σ_poles Σ_{j=1..m} r_{p,j} / (s − p)^j.
 * For a pole of multiplicity m, r_{p,j} is the Taylor coefficient g_{m−j} of (s − p)^m F(s) at p.
 */
export function partialFractions(numerator, denominator) {
  const den = trim(denominator.map(Number));
  if (den.length < 2) throw new RangeError('The denominator must have degree ≥ 1.');
  const { quotient, remainder } = polyDivide(numerator.map(Number), den);
  const poles = clusterRoots(polyRoots(den)).map(({ pole, multiplicity }) => ({ pole: polishRoot(den, pole, multiplicity), multiplicity }));
  const terms = [];
  for (const { pole, multiplicity: m } of poles) {
    // Q(s) = D(s) / (s − p)^m: divide D by the other poles' factors via its Taylor series at p.
    const dTaylor = taylorAt(den, pole, m + m); // D(p + h) = h^m·(d_m + d_{m+1}h + …)
    const qSeries = dTaylor.slice(m, m + m); // Q(p + h) series
    const nSeries = taylorAt(remainder, pole, m);
    // Power-series division g = n / q up to order m − 1.
    const g = [];
    for (let k = 0; k < m; k += 1) {
      let acc = nSeries[k];
      for (let j = 1; j <= k; j += 1) acc = csub(acc, cmul(qSeries[j], g[k - j]));
      g.push(cdiv(acc, qSeries[0]));
    }
    for (let j = 1; j <= m; j += 1) terms.push({ pole, order: j, residue: g[m - j] });
  }
  terms.sort((a, b) => a.pole.re - b.pole.re || a.pole.im - b.pole.im || a.order - b.order);
  return { direct: quotient.every((c) => Math.abs(c) < 1e-14) ? [] : quotient, terms };
}

/** Inverse Laplace transform f(t) for t ≥ 0 (impulse terms from `direct` are reported separately). */
export function inverseLaplace(numerator, denominator) {
  const { direct, terms } = partialFractions(numerator, denominator);
  const evaluate = (t) => terms.reduce((sum, term) => sum + cmul(term.residue, cexp(cscale(term.pole, t))).re * t ** (term.order - 1) / factorial(term.order - 1), 0);
  return { direct, terms, evaluate, expression: describeTerms(terms, 't', 'continuous'), impulses: direct.length ? direct.map((c, i) => ({ order: direct.length - 1 - i, weight: c })) : [] };
}

/** Human-readable sum, combining conjugate pairs into e^{σt}·cos/sin form. */
function describeTerms(terms, variable, kind) {
  const parts = [];
  const used = new Set();
  const num = (x) => Number(x.toPrecision(5)).toString().replace('-', '−');
  const rate = (x) => (Math.abs(Math.abs(x) - 1) < 1e-12 ? (x < 0 ? '−' : '') : num(x)); // e^(−t) rather than e^(−1t); angles in radians
  terms.forEach((term, index) => {
    if (used.has(index)) return;
    const power = term.order - 1;
    const tFactor = kind === 'continuous' ? (power ? `${power === 1 ? variable : `${variable}^${power}`}${power > 1 ? `/${factorial(power)}` : ''}·` : '') : (power ? `C(${variable}+${power},${power})·` : '');
    if (Math.abs(term.pole.im) < 1e-12) {
      if (cabs(term.residue) < 1e-12) return;
      const base = kind === 'continuous' ? (Math.abs(term.pole.re) < 1e-12 ? '' : `e^(${rate(term.pole.re)}${variable})`) : `(${num(term.pole.re)})^${variable}`;
      parts.push([num(term.residue.re), tFactor.replace(/·$/, ''), base].filter(Boolean).join('·'));
      return;
    }
    const partner = terms.findIndex((other, j) => j !== index && !used.has(j) && other.order === term.order && Math.abs(other.pole.re - term.pole.re) < 1e-9 * Math.max(1, cabs(term.pole)) && Math.abs(other.pole.im + term.pole.im) < 1e-9 * Math.max(1, cabs(term.pole)));
    if (partner >= 0) used.add(partner);
    used.add(index);
    const magnitude = 2 * cabs(term.residue), angle = Math.atan2(term.residue.im, term.residue.re) * Math.sign(term.pole.im || 1);
    if (kind === 'continuous') parts.push(`${num(magnitude)}·${tFactor}${Math.abs(term.pole.re) < 1e-12 ? '' : `e^(${rate(term.pole.re)}${variable})·`}cos(${rate(Math.abs(term.pole.im))}${variable}${Math.abs(angle) < 1e-12 ? '' : ` ${angle >= 0 ? '+' : '−'} ${num(Math.abs(angle))}`})`);
    else parts.push(`${num(magnitude)}·${tFactor}${num(cabs(term.pole))}^${variable}·cos(${num(Math.abs(Math.atan2(term.pole.im, term.pole.re)))}${variable} ${angle >= 0 ? '+' : '−'} ${num(Math.abs(angle))})`);
  });
  return parts.join(' + ').replace(/\+ −/g, '− ') || '0';
}

/** Initial and final value theorems for F(s). */
export function limitTheorems(numerator, denominator) {
  const num = trim(numerator.map(Number)), den = trim(denominator.map(Number));
  // f(0+) = lim s→∞ s·F(s): finite only if deg N < deg D.
  const initial = num.length < den.length ? (num.length === den.length - 1 ? num[0] / den[0] : 0) : null;
  const poles = polyRoots(den);
  const nonZero = poles.filter((p) => cabs(p) > 1e-9);
  const atOrigin = poles.length - nonZero.length;
  const stable = nonZero.every((p) => p.re < -1e-12) && atOrigin <= 1;
  const final = stable ? (atOrigin === 1 ? (num.at(-1) / den.at(-2)) : 0) : null;
  return { initial, final, finalExists: stable };
}

// ---------------------------------------------------------------------------
// z-transform: H(z) = Σ b_k z^{−k} / Σ a_k z^{−k}.

/** Partial fractions in z⁻¹ (like scipy.signal.residuez): H = Σ r/(1 − p z⁻¹)^j + Σ k_i z^{−i}. */
export function partialFractionsZ(b, a) {
  const B = b.map(Number), A = a.map(Number);
  while (A.length > 1 && A.at(-1) === 0) A.pop();
  // In w = z⁻¹ the polynomials are B(w), A(w) with ascending coefficients → reverse for descending.
  const result = partialFractions([...B].reverse(), [...A].reverse());
  const terms = result.terms.map((term) => {
    // r'/(w − w0)^j = r'·(−p)^j / (1 − p w)^j with p = 1/w0.
    const p = cdiv(complex(1), term.pole);
    let factor = complex(1);
    for (let k = 0; k < term.order; k += 1) factor = cmul(factor, cscale(p, -1));
    return { pole: p, order: term.order, residue: cmul(term.residue, factor) };
  });
  terms.sort((x, y) => x.pole.re - y.pole.re || x.pole.im - y.pole.im || x.order - y.order);
  return { direct: [...result.direct].reverse(), terms };
}

const binomial = (n, k) => { let r = 1; for (let i = 1; i <= k; i += 1) r = r * (n - k + i) / i; return r; };

/** Causal inverse z-transform h[n], ROC and stability. */
export function inverseZ(b, a, count = 30) {
  const { direct, terms } = partialFractionsZ(b, a);
  const h = Array.from({ length: count }, (_, n) => terms.reduce((sum, term) => {
    let pn = complex(1);
    for (let k = 0; k < n; k += 1) pn = cmul(pn, term.pole);
    return sum + cmul(term.residue, pn).re * binomial(n + term.order - 1, term.order - 1);
  }, 0) + (direct[n] ?? 0));
  const radius = Math.max(0, ...terms.map((term) => cabs(term.pole)));
  return { direct, terms, h, rocRadius: radius, stable: radius < 1 - 1e-12, expression: describeTerms(terms, 'n', 'discrete') };
}

/** Impulse response by running the difference equation a0·y[n] = Σ b_k x[n−k] − Σ_{k≥1} a_k y[n−k]. */
export function differenceEquation(b, a, input) {
  const y = [];
  for (let n = 0; n < input.length; n += 1) {
    let acc = 0;
    b.forEach((coefficient, k) => { if (n - k >= 0) acc += coefficient * input[n - k]; });
    a.forEach((coefficient, k) => { if (k > 0 && n - k >= 0) acc -= coefficient * y[n - k]; });
    y.push(acc / a[0]);
  }
  return y;
}

/** Power-series (long division) coefficients of H(z) in z⁻¹. */
export function longDivision(b, a, count = 10) { return differenceEquation(b, a, Array.from({ length: count }, (_, n) => (n === 0 ? 1 : 0))); }

// ---------------------------------------------------------------------------
// DFT step by step and radix-2 FFT butterflies.

export function dftSteps(x) {
  const N = x.length;
  if (N < 1 || N > 32) throw new RangeError('Use 1 to 32 samples for the step-by-step DFT.');
  const twiddle = (m) => complex(Math.cos(-TAU * m / N), Math.sin(-TAU * m / N));
  const rows = Array.from({ length: N }, (_, k) => {
    const terms = x.map((value, n) => ({ n, exponent: (n * k) % N, w: twiddle((n * k) % N), product: cscale(twiddle((n * k) % N), value) }));
    const sum = terms.reduce((acc, term) => cadd(acc, term.product), complex(0));
    return { k, terms, value: sum, magnitude: cabs(sum), phase: Math.atan2(sum.im, sum.re) * 180 / Math.PI };
  });
  return { N, rows, twiddles: Array.from({ length: N }, (_, m) => twiddle(m)), operations: { multiplications: N * N, additions: N * (N - 1) } };
}

/** Decimation-in-time radix-2 FFT with every butterfly recorded. */
export function fftButterflies(x) {
  const N = x.length;
  if (N < 2 || (N & (N - 1)) || N > 64) throw new RangeError('The butterfly view needs 2, 4, 8, 16, 32 or 64 samples.');
  const bits = Math.log2(N);
  const reverse = (i) => { let r = 0; for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b); return r; };
  let values = Array.from({ length: N }, (_, i) => complex(x[reverse(i)]));
  const order = Array.from({ length: N }, (_, i) => reverse(i));
  const stages = [];
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2, next = [...values], butterflies = [];
    for (let start = 0; start < N; start += size) for (let k = 0; k < half; k += 1) {
      const top = start + k, bottom = top + half;
      const w = complex(Math.cos(-TAU * k / size), Math.sin(-TAU * k / size));
      const product = cmul(w, values[bottom]);
      next[top] = cadd(values[top], product); next[bottom] = csub(values[top], product);
      butterflies.push({ top, bottom, twiddle: `W${size}^${k}`, w, inTop: values[top], inBottom: values[bottom], outTop: next[top], outBottom: next[bottom] });
    }
    stages.push({ size, butterflies, values: next });
    values = next;
  }
  return { N, bitReversedOrder: order, stages, output: values, operations: { multiplications: (N / 2) * bits, additions: N * bits } };
}
