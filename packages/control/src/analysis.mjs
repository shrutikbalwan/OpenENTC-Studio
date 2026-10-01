// Control-systems analysis for rational transfer functions G(s) = N(s)/D(s):
// parsing, poles/zeros, exact (matrix-exponential) step and impulse responses,
// Bode with stability margins, Nyquist, root locus, Routh-Hurwitz and PID tuning.
import { cabs, cdiv, complex, polyadd, polymul, polyRoots, polyval, trimLeadingZeros } from '../../numerics/src/polynomial.mjs';

const MAX_DEGREE = 20;
const MAX_POINTS = 4000;

function bounded(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  return number;
}

// ---------------------------------------------------------------------------
// Polynomial parsing: "1 2 1", "[1, 2, 1]", "s^2 + 2s + 1" or "(s+1)(s+2)".

function tokenize(text) {
  const tokens = [];
  const pattern = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([s()+\-*^]))/giy;
  let match;
  while (pattern.lastIndex < text.length) {
    const start = pattern.lastIndex;
    if (!/\S/.test(text.slice(start))) break;
    match = pattern.exec(text);
    if (!match) throw new SyntaxError(`Unexpected "${text.slice(start).trim()[0]}" in polynomial "${text}".`);
    tokens.push(match[1] !== undefined ? { type: 'number', value: Number(match[1]) } : { type: match[2].toLowerCase() });
  }
  return tokens;
}

function parseExpression(text) {
  const tokens = tokenize(text);
  let position = 0;
  const peek = () => tokens[position]?.type;
  const expect = (type) => { if (peek() !== type) throw new SyntaxError(`Expected "${type}" in polynomial "${text}".`); position += 1; };
  const checkDegree = (p) => { if (p.length - 1 > MAX_DEGREE) throw new RangeError(`Polynomial degree is limited to ${MAX_DEGREE}.`); return p; };
  function primary() {
    const token = tokens[position];
    if (!token) throw new SyntaxError(`Polynomial "${text}" ends unexpectedly.`);
    position += 1;
    if (token.type === 'number') return [token.value];
    if (token.type === 's') return [1, 0];
    if (token.type === '(') { const inner = sum(); expect(')'); return inner; }
    throw new SyntaxError(`Unexpected "${token.type}" in polynomial "${text}".`);
  }
  function factor() {
    if (peek() === '-') { position += 1; return factor().map((c) => -c); }
    if (peek() === '+') { position += 1; return factor(); }
    let base = primary();
    if (peek() === '^') {
      position += 1;
      const exponent = tokens[position];
      if (exponent?.type !== 'number' || !Number.isInteger(exponent.value) || exponent.value > MAX_DEGREE) throw new SyntaxError('Powers must be whole numbers up to 20.');
      position += 1;
      let result = [1];
      for (let k = 0; k < exponent.value; k += 1) result = checkDegree(polymul(result, base));
      base = result;
    }
    return base;
  }
  function product() {
    let result = factor();
    while (['*', 'number', 's', '('].includes(peek())) { if (peek() === '*') position += 1; result = checkDegree(polymul(result, factor())); }
    return result;
  }
  function sum() {
    let result = product();
    while (peek() === '+' || peek() === '-') { const sign = peek() === '-' ? -1 : 1; position += 1; result = polyadd(result, product().map((c) => sign * c)); }
    return result;
  }
  const result = sum();
  if (position < tokens.length) throw new SyntaxError(`Unexpected "${tokens[position].type}" in polynomial "${text}".`);
  return result;
}

/** Parse a polynomial in s into descending coefficients. */
export function parsePolynomial(input) {
  if (Array.isArray(input)) return validate(input.map(Number));
  const text = String(input ?? '').trim().replace(/^\[|\]$/g, '');
  if (!text) throw new SyntaxError('Enter a polynomial, for example "s^2 + 2s + 1" or "1 2 1".');
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!/[s()*^]/i.test(text) && parts.length > 1 && parts.every((part) => /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(part))) return validate(parts.map(Number));
  return validate(parseExpression(text));
}

function validate(coefficients) {
  if (!coefficients.length || coefficients.some((c) => !Number.isFinite(c))) throw new TypeError('Polynomial coefficients must be finite numbers.');
  const trimmed = trimLeadingZeros(coefficients.map((c) => (Object.is(c, -0) ? 0 : c)));
  if (trimmed.length - 1 > MAX_DEGREE) throw new RangeError(`Polynomial degree is limited to ${MAX_DEGREE}.`);
  return trimmed;
}

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const formatNumber = (value) => (Number.isInteger(value) ? String(value) : Number(value.toPrecision(5)).toString());

/** Human-readable polynomial such as "s² + 2s + 1". */
export function formatPolynomial(coefficients, variable = 's') {
  const degree = coefficients.length - 1;
  const terms = [];
  coefficients.forEach((c, index) => {
    if (c === 0) return;
    const power = degree - index;
    const magnitude = Math.abs(c);
    const body = power === 0 ? formatNumber(magnitude) : `${magnitude === 1 ? '' : formatNumber(magnitude)}${variable}${power > 1 ? [...String(power)].map((d) => SUPERSCRIPT[d]).join('') : ''}`;
    terms.push(terms.length ? `${c < 0 ? '−' : '+'} ${body}` : `${c < 0 ? '−' : ''}${body}`);
  });
  return terms.length ? terms.join(' ') : '0';
}

// ---------------------------------------------------------------------------
// Transfer functions.

/** Normalised transfer function with the denominator made monic and common s-factors cancelled. */
export function makeTransferFunction(numerator, denominator) {
  let num = parsePolynomial(numerator), den = parsePolynomial(denominator);
  if (den.every((c) => c === 0)) throw new RangeError('The denominator cannot be zero.');
  while (num.length > 1 && den.length > 1 && num.at(-1) === 0 && den.at(-1) === 0) { num = num.slice(0, -1); den = den.slice(0, -1); }
  const lead = den[0];
  num = num.map((c) => c / lead); den = den.map((c) => c / lead);
  return { kind: 'transfer-function', numerator: num, denominator: den, proper: num.length <= den.length, zeros: num.every((c) => c === 0) ? [] : polyRoots(num), poles: polyRoots(den) };
}

export const evaluateTf = (tf, s) => cdiv(polyval(tf.numerator, s), polyval(tf.denominator, s));

/** Closed loop T = G / (1 + G·H) for negative feedback (H defaults to unity). */
export function closedLoop(open, feedback = { numerator: [1], denominator: [1] }) {
  const num = polymul(open.numerator, feedback.denominator);
  const den = polyadd(polymul(open.denominator, feedback.denominator), polymul(open.numerator, feedback.numerator));
  return makeTransferFunction(num, den);
}

export const seriesTf = (first, second) => makeTransferFunction(polymul(first.numerator, second.numerator), polymul(first.denominator, second.denominator));

/** DC gain N(0)/D(0); Infinity for a type-1+ system. */
export function dcGain(tf) {
  const d = tf.denominator.at(-1), n = tf.numerator.at(-1);
  return d === 0 ? (n === 0 ? 0 : Infinity) : n / d;
}

export function classifyStability(poles) {
  const tolerance = 1e-9;
  const rightHalf = poles.filter((p) => p.re > tolerance).length;
  const axis = poles.filter((p) => Math.abs(p.re) <= tolerance);
  const repeatedAxis = axis.some((p, i) => axis.some((q, j) => j !== i && cabs({ re: p.re - q.re, im: p.im - q.im }) < 1e-6));
  if (rightHalf || repeatedAxis) return { status: 'unstable', rightHalfPlanePoles: rightHalf };
  if (axis.length) return { status: 'marginal', rightHalfPlanePoles: 0 };
  return { status: 'stable', rightHalfPlanePoles: 0 };
}

// ---------------------------------------------------------------------------
// Time response by exact discretisation of the controllable canonical form.

const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const matmul = (a, b) => a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));

/** Matrix exponential by scaling and squaring with a Taylor series. */
export function expm(matrix) {
  const n = matrix.length;
  const norm = Math.max(...matrix.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0)));
  const squarings = Math.max(0, Math.ceil(Math.log2(norm || 1)) + 1);
  const scaled = matrix.map((row) => row.map((value) => value / 2 ** squarings));
  let result = identity(n), term = identity(n);
  for (let k = 1; k <= 24; k += 1) {
    term = matmul(term, scaled).map((row) => row.map((value) => value / k));
    result = result.map((row, i) => row.map((value, j) => value + term[i][j]));
  }
  for (let k = 0; k < squarings; k += 1) result = matmul(result, result);
  return result;
}

function stateSpace(tf) {
  if (!tf.proper) throw new RangeError('The transfer function must be proper (numerator degree ≤ denominator degree) for a time response.');
  const den = tf.denominator, n = den.length - 1;
  const num = [...new Array(den.length - tf.numerator.length).fill(0), ...tf.numerator];
  const d = num[0];
  // Controllable canonical form: x' = A x + B u, y = C x + D u.
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === 0 ? -den[j + 1] : i === j + 1 ? 1 : 0)));
  const B = Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0));
  const C = Array.from({ length: n }, (_, j) => num[j + 1] - d * den[j + 1]);
  return { A, B, C, D: d, order: n };
}

/** A sensible simulation length from the slowest and fastest pole dynamics. */
export function defaultDuration(tf) {
  const poles = tf.poles.filter((p) => cabs(p) > 1e-9);
  if (!poles.length) return 10;
  const slowest = Math.min(...poles.map((p) => (p.re < -1e-9 ? -p.re : cabs(p))));
  const oscillation = Math.max(...poles.map((p) => Math.abs(p.im)));
  let duration = 6 / slowest;
  if (oscillation > 0) duration = Math.max(duration, 4 * Math.PI / oscillation);
  if (poles.some((p) => p.re >= -1e-9)) duration = Math.min(duration, 10 / slowest);
  return Number(Math.min(1e6, Math.max(1e-9, duration)).toPrecision(2));
}

/** Unit step (or impulse) response sampled at `points` instants over `duration` seconds. */
export function timeResponse(tf, { input = 'step', duration, points = 600 } = {}) {
  if (!['step', 'impulse'].includes(input)) throw new RangeError('Input must be step or impulse.');
  const { A, B, C, D, order } = stateSpace(tf);
  const span = duration === undefined || duration === '' ? defaultDuration(tf) : bounded(duration, 1e-9, 1e6, 'Duration');
  const count = Math.trunc(bounded(points, 2, MAX_POINTS, 'Points'));
  const h = span / (count - 1);
  const time = Array.from({ length: count }, (_, k) => k * h);
  if (order === 0) return { input, time, output: time.map(() => (input === 'step' ? D : 0)) };
  // exp([[A, B], [0, 0]]·h) gives Φ = e^{Ah} and Γ = ∫ e^{Aτ} dτ · B, exact for a held input.
  const augmented = [...A.map((row, i) => [...row.map((v) => v * h), B[i] * h]), new Array(order + 1).fill(0)];
  const exponential = expm(augmented);
  const phi = exponential.slice(0, order).map((row) => row.slice(0, order));
  const gamma = exponential.slice(0, order).map((row) => row[order]);
  let state = input === 'impulse' ? [...B] : new Array(order).fill(0);
  const u = input === 'step' ? 1 : 0;
  const output = [];
  let diverged = false;
  for (let k = 0; k < count; k += 1) {
    const y = C.reduce((sum, c, i) => sum + c * state[i], 0) + D * u;
    if (!Number.isFinite(y) || Math.abs(y) > 1e12) { diverged = true; break; }
    output.push(y);
    state = phi.map((row, i) => row.reduce((sum, value, j) => sum + value * state[j], 0) + gamma[i] * u);
  }
  return { input, time: time.slice(0, output.length), output, duration: span, diverged, directFeedthrough: input === 'impulse' && D !== 0 };
}

/** Rise (10–90 %), peak, overshoot, settling (±2 %) and steady-state error of a step response. */
export function stepInfo(response, finalValue) {
  const { time, output } = response;
  const final = Number.isFinite(finalValue) ? finalValue : output.at(-1);
  const result = { finalValue: final, riseTime: null, peak: null, peakTime: null, overshoot: null, settlingTime: null, steadyStateError: 1 - final };
  if (!output.length || !Number.isFinite(final) || Math.abs(final) < 1e-12) return result;
  const sign = Math.sign(final);
  const crossing = (level) => {
    for (let k = 1; k < output.length; k += 1) if (sign * output[k] >= sign * level * final) { const a = output[k - 1], b = output[k]; return time[k - 1] + (time[k] - time[k - 1]) * ((level * final - a) / (b - a || 1)); }
    return null;
  };
  const t10 = crossing(0.1), t90 = crossing(0.9);
  result.riseTime = t10 !== null && t90 !== null ? t90 - t10 : null;
  let peakIndex = 0;
  output.forEach((value, k) => { if (sign * value > sign * output[peakIndex]) peakIndex = k; });
  result.peak = output[peakIndex];
  result.peakTime = time[peakIndex];
  result.overshoot = Math.max(0, (sign * (output[peakIndex] - final)) / Math.abs(final) * 100);
  let last = -1;
  output.forEach((value, k) => { if (Math.abs(value - final) > 0.02 * Math.abs(final)) last = k; });
  result.settlingTime = last === output.length - 1 ? null : last < 0 ? 0 : time[last + 1];
  return result;
}

// ---------------------------------------------------------------------------
// Frequency response and margins (ω in rad/s).

const logSpace = (from, to, count) => Array.from({ length: count }, (_, k) => 10 ** (from + (to - from) * k / (count - 1)));

/** A decade range wide enough to show every pole and zero corner. */
export function frequencyRange(tf) {
  const corners = [...tf.poles, ...tf.zeros].map(cabs).filter((value) => value > 1e-9);
  const low = corners.length ? Math.min(...corners) : 1, high = corners.length ? Math.max(...corners) : 1;
  return [Math.floor(Math.log10(low)) - 2, Math.ceil(Math.log10(high)) + 2];
}

export function bode(tf, { from, to, points = 400 } = {}) {
  const [low, high] = from === undefined ? frequencyRange(tf) : [Math.log10(bounded(from, 1e-9, 1e12, 'Start frequency')), Math.log10(bounded(to, from, 1e12, 'Stop frequency'))];
  const omega = logSpace(low, high, Math.trunc(bounded(points, 20, MAX_POINTS, 'Points')));
  const response = omega.map((w) => evaluateTf(tf, complex(0, w)));
  const magnitudeDb = response.map((value) => 20 * Math.log10(Math.max(cabs(value), 1e-300)));
  const phase = [];
  response.forEach((value, k) => {
    let angle = Math.atan2(value.im, value.re) * 180 / Math.PI;
    if (k) { while (angle - phase[k - 1] > 180) angle -= 360; while (angle - phase[k - 1] < -180) angle += 360; }
    phase.push(angle);
  });
  // Anchor the unwrapped phase to the low-frequency asymptote: −90° per free integrator, 0° or 180° for the sign.
  const integrators = tf.denominator.length - trimTrailing(tf.denominator).length - (tf.numerator.length - trimTrailing(tf.numerator).length);
  const lowGain = trimTrailing(tf.numerator).at(-1) / trimTrailing(tf.denominator).at(-1);
  const expected = -90 * integrators + (lowGain < 0 ? -180 : 0);
  const shift = 360 * Math.round((expected - phase[0]) / 360);
  return { omega, magnitudeDb, phase: phase.map((value) => value + shift), margins: margins(tf, omega, magnitudeDb, phase.map((value) => value + shift)) };
}

function trimTrailing(coefficients) { let end = coefficients.length; while (end > 1 && coefficients[end - 1] === 0) end -= 1; return coefficients.slice(0, end); }

function refine(f, a, b) {
  let fa = f(a);
  for (let k = 0; k < 80; k += 1) { const m = Math.sqrt(a * b), fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
  return Math.sqrt(a * b);
}

/** Gain margin (dB) at the −180° crossing and phase margin (°) at the 0 dB crossing. */
export function margins(tf, omega, magnitudeDb, phase) {
  const magnitudeAt = (w) => 20 * Math.log10(cabs(evaluateTf(tf, complex(0, w))));
  const gainCrossings = [], phaseCrossings = [];
  for (let k = 1; k < omega.length; k += 1) {
    if (Math.sign(magnitudeDb[k]) !== Math.sign(magnitudeDb[k - 1])) {
      const w = refine(magnitudeAt, omega[k - 1], omega[k]);
      const value = evaluateTf(tf, complex(0, w));
      const p = Math.atan2(value.im, value.re) * 180 / Math.PI;
      gainCrossings.push({ omega: w, phaseMargin: 180 + p - 360 * Math.round((p + 180) / 360) });
    }
    // Phase crossover: the phase passes −180° + 360°·k between neighbouring samples.
    const before = Math.floor((phase[k - 1] + 180) / 360), after = Math.floor((phase[k] + 180) / 360);
    if (before !== after) {
      const level = 360 * Math.max(before, after) - 180;
      // On the −180° line L(jω) is real and negative, so polish the crossing on Im L(jω).
      const imaginary = (x) => evaluateTf(tf, complex(0, x)).im;
      const guess = omega[k - 1] * (omega[k] / omega[k - 1]) ** ((level - phase[k - 1]) / (phase[k] - phase[k - 1]));
      const w = Math.sign(imaginary(omega[k - 1])) !== Math.sign(imaginary(omega[k])) ? refine(imaginary, omega[k - 1], omega[k]) : guess;
      phaseCrossings.push({ omega: w, gainMargin: -magnitudeAt(w) });
    }
  }
  const pm = gainCrossings.length ? gainCrossings.reduce((best, c) => (c.phaseMargin < best.phaseMargin ? c : best)) : null;
  const gm = phaseCrossings.length ? phaseCrossings.reduce((best, c) => (c.gainMargin < best.gainMargin ? c : best)) : null;
  return { gainMarginDb: gm ? gm.gainMargin : Infinity, phaseCrossover: gm ? gm.omega : null, phaseMarginDeg: pm ? pm.phaseMargin : Infinity, gainCrossover: pm ? pm.omega : null };
}

/** Nyquist plot of L(jω) for ω > 0 (the ω < 0 branch is its mirror image). */
export function nyquist(tf, { points = 600 } = {}) {
  const [low, high] = frequencyRange(tf);
  const omega = logSpace(low - 1, high + 1, Math.trunc(bounded(points, 20, MAX_POINTS, 'Points')));
  const values = omega.map((w) => evaluateTf(tf, complex(0, w)));
  return { omega, real: values.map((v) => v.re), imaginary: values.map((v) => v.im) };
}

// ---------------------------------------------------------------------------
// Root locus of 1 + K·G(s) = 0.

export function rootLocus(tf, { maxGain, points = 240 } = {}) {
  const num = tf.numerator, den = tf.denominator;
  const n = den.length - 1, m = num.length - 1;
  if (m > n) throw new RangeError('Root locus needs a proper open-loop transfer function.');
  const scale = Math.abs(den.at(-1) / (num.at(-1) || 1)) || 1;
  const top = maxGain === undefined || maxGain === '' ? scale * 1e4 : bounded(maxGain, 1e-9, 1e15, 'Maximum gain');
  const count = Math.trunc(bounded(points, 20, 2000, 'Points'));
  const gains = [0, ...logSpace(Math.log10(top) - 7, Math.log10(top), count - 1)];
  const branches = Array.from({ length: n }, () => []);
  let previous = null;
  for (const gain of gains) {
    let roots = polyRoots(polyadd(den, num.map((c) => c * gain)));
    if (previous) {
      // Keep each branch continuous by matching to the nearest unused previous root.
      const used = new Set();
      roots = previous.map((last) => {
        let best = -1, distance = Infinity;
        roots.forEach((root, index) => { const d = cabs({ re: root.re - last.re, im: root.im - last.im }); if (!used.has(index) && d < distance) { distance = d; best = index; } });
        used.add(best);
        return roots[best];
      });
    }
    roots.forEach((root, index) => branches[index].push({ gain, re: root.re, im: root.im }));
    previous = roots;
  }
  const excess = n - m;
  const centroid = excess > 0 ? (tf.poles.reduce((sum, p) => sum + p.re, 0) - tf.zeros.reduce((sum, z) => sum + z.re, 0)) / excess : null;
  const asymptotes = Array.from({ length: Math.max(0, excess) }, (_, k) => (180 * (2 * k + 1)) / excess);
  return { branches, poles: tf.poles, zeros: tf.zeros, centroid, asymptoteAngles: asymptotes, crossings: imaginaryAxisCrossings(tf, top) };
}

/** Gains where closed-loop poles reach the jω axis, from roots of Im and Re of D(jω) + K·N(jω). */
function imaginaryAxisCrossings(tf, maxGain) {
  const crossings = [];
  const [low, high] = frequencyRange(tf);
  const omega = logSpace(low - 1, high + 2, 2000);
  // On the axis, K = −D(jω)/N(jω) must be real and positive.
  const gainAt = (w) => { const value = cdiv(polyval(tf.denominator, complex(0, w)), polyval(tf.numerator, complex(0, w))); return { re: -value.re, im: -value.im }; };
  for (let k = 1; k < omega.length; k += 1) {
    const a = gainAt(omega[k - 1]), b = gainAt(omega[k]);
    if (Math.sign(a.im) !== Math.sign(b.im) && Number.isFinite(a.im) && Number.isFinite(b.im)) {
      const w = refine((x) => gainAt(x).im, omega[k - 1], omega[k]);
      const gain = gainAt(w);
      if (gain.re > 0 && gain.re <= maxGain && Math.abs(gain.im) < 1e-6 * Math.max(1, Math.abs(gain.re))) crossings.push({ omega: w, gain: gain.re });
    }
  }
  const dcGainCrossing = -tf.denominator.at(-1) / (tf.numerator.at(-1) || NaN);
  if (dcGainCrossing > 0 && dcGainCrossing <= maxGain) crossings.push({ omega: 0, gain: dcGainCrossing });
  return crossings.sort((a, b) => a.gain - b.gain);
}

// ---------------------------------------------------------------------------
// Routh-Hurwitz.

export function routhArray(input) {
  const coefficients = parsePolynomial(input);
  const n = coefficients.length - 1;
  if (n < 1) throw new RangeError('The characteristic polynomial must have degree 1 or more.');
  const width = Math.floor(n / 2) + 1;
  const rows = [
    Array.from({ length: width }, (_, j) => coefficients[2 * j] ?? 0),
    Array.from({ length: width }, (_, j) => coefficients[2 * j + 1] ?? 0),
  ];
  const notes = [];
  const epsilon = 1e-9 * Math.max(...coefficients.map(Math.abs));
  for (let r = 2; r <= n; r += 1) {
    const above = rows[r - 1], twoAbove = rows[r - 2];
    if (above.every((value) => Math.abs(value) < epsilon)) {
      // Row of zeros: replace with the derivative of the auxiliary polynomial from the row above it.
      const power = n - (r - 2);
      notes.push(`Row s^${n - r + 1} was all zero: replaced by the derivative of the auxiliary polynomial (symmetric roots, e.g. on the jω axis).`);
      for (let j = 0; j < width; j += 1) above[j] = twoAbove[j] * (power - 2 * j);
    } else if (Math.abs(above[0]) < epsilon) {
      notes.push(`First element of row s^${n - r + 1} was zero: replaced by a small ε.`);
      above[0] = epsilon;
    }
    rows.push(Array.from({ length: width }, (_, j) => {
      const value = (above[0] * (twoAbove[j + 1] ?? 0) - twoAbove[0] * (above[j + 1] ?? 0)) / above[0];
      return Math.abs(value) < epsilon * 1e-3 ? 0 : value;
    }));
  }
  const first = rows.map((row) => row[0]);
  let changes = 0;
  for (let k = 1; k < first.length; k += 1) if (Math.sign(first[k]) !== Math.sign(first[k - 1]) && first[k] !== 0) changes += 1;
  const marginal = notes.some((note) => note.startsWith('Row'));
  return {
    coefficients, rows: rows.map((row, index) => ({ power: n - index, values: row })), signChanges: changes, notes,
    stable: changes === 0 && !marginal && coefficients.every((c) => Math.sign(c) === Math.sign(coefficients[0])),
    verdict: changes ? `${changes} root${changes === 1 ? '' : 's'} in the right half-plane: unstable.${marginal ? ' Other roots lie on the jω axis.' : ''}` : marginal ? 'No right-half-plane roots, but roots lie on the jω axis: marginally stable.' : 'All roots in the left half-plane: stable.',
  };
}

// ---------------------------------------------------------------------------
// PID control and Ziegler-Nichols tuning.

/** C(s) = Kp + Ki/s + Kd·s/(Tf·s + 1). */
export function pidController({ kp = 1, ki = 0, kd = 0, tf: filter = 0.01 } = {}) {
  const p = bounded(kp, -1e9, 1e9, 'Kp'), i = bounded(ki, -1e9, 1e9, 'Ki'), d = bounded(kd, -1e9, 1e9, 'Kd');
  const t = d === 0 ? 0 : bounded(filter, 1e-9, 1e6, 'Derivative filter time constant');
  // [Kp·s(Tf·s+1) + Ki(Tf·s+1) + Kd·s²] / [s(Tf·s+1)]
  return makeTransferFunction([p * t + d, p + i * t, i], [t, 1, 0]);
}

/** Ultimate gain/period from the phase crossover and the classic Ziegler-Nichols table. */
export function zieglerNichols(plant) {
  const { margins: result } = bode(plant, { from: undefined });
  if (!result.phaseCrossover) return { ultimateGain: null, ultimatePeriod: null, rules: [], note: 'The plant phase never reaches −180°, so proportional gain alone cannot make it oscillate.' };
  const ku = 10 ** (result.gainMarginDb / 20);
  const tu = 2 * Math.PI / result.phaseCrossover;
  const rule = (name, kp, ti, td) => ({ name, kp, ki: ti ? kp / ti : 0, kd: kp * td, ti, td });
  return { ultimateGain: ku, ultimatePeriod: tu, rules: [rule('P', 0.5 * ku, 0, 0), rule('PI', 0.45 * ku, tu / 1.2, 0), rule('PID', 0.6 * ku, tu / 2, tu / 8)] };
}

/** Unity-feedback loop of C(s)·G(s) with step response, metrics and margins. */
export function pidLoop(plantInput, gains, options = {}) {
  const plant = plantInput.kind === 'transfer-function' ? plantInput : makeTransferFunction(plantInput.numerator, plantInput.denominator);
  const open = seriesTf(pidController(gains), plant);
  const closed = closedLoop(open);
  const stability = classifyStability(closed.poles);
  const response = timeResponse(closed, { duration: options.duration, points: options.points ?? 600 });
  const final = stability.status === 'stable' ? dcGain(closed) : NaN;
  return { open, closed, stability, response, info: stepInfo(response, final), margins: bode(open).margins };
}

/** Full analysis of an open-loop G(s) with optional unity-feedback closed loop. */
export function analyzeSystem(numerator, denominator, { feedback = false, duration } = {}) {
  const open = makeTransferFunction(numerator, denominator);
  const system = feedback ? closedLoop(open) : open;
  const stability = classifyStability(system.poles);
  const step = system.proper ? timeResponse(system, { duration }) : null;
  const impulse = system.proper ? timeResponse(system, { input: 'impulse', duration: step?.duration }) : null;
  const gain = dcGain(system);
  return {
    open, system, feedback, stability, dcGain: gain, step, impulse,
    info: step ? stepInfo(step, stability.status === 'stable' ? gain : NaN) : null,
    bode: bode(open), nyquist: nyquist(open), routh: routhArray(system.denominator),
  };
}
