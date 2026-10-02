// A small MATLAB/Octave-style calculator language, interpreted without eval: real and complex
// scalars (j or i), real matrices ([1 2; 3 4], ranges a:b:c), engineering suffixes (4.7k, 10u),
// element-wise and matrix operators, A\b, user functions f(x) = …, and a library of maths,
// linear-algebra, polynomial, signal and circuit helpers. plot(x, y) returns plot data.
import { polyRoots } from '../../numerics/src/polynomial.mjs';

// ---------------------------------------------------------------------------
// Values: number | { re, im } | Matrix { rows, cols, data: Float64Array (row-major) }.

class Matrix {
  constructor(rows, cols, data) { this.rows = rows; this.cols = cols; this.data = data ?? new Float64Array(rows * cols); }
  get(r, c) { return this.data[r * this.cols + c]; }
}
export { Matrix };
const complex = (re, im) => (Math.abs(im) < 1e-300 && im === 0 ? re : { re, im });
const isComplex = (v) => typeof v === 'object' && v !== null && !(v instanceof Matrix) && 're' in v;
const isMatrix = (v) => v instanceof Matrix;
const toComplex = (v) => (isComplex(v) ? v : { re: v, im: 0 });
const tidy = (z) => (Math.abs(z.im) <= 1e-14 * Math.max(1, Math.abs(z.re)) ? z.re : Math.abs(z.re) <= 1e-14 * Math.abs(z.im) ? { re: 0, im: z.im } : z);
const rowVector = (values) => new Matrix(1, values.length, Float64Array.from(values));
const scalarOf = (v, what = 'value') => { if (isMatrix(v)) { if (v.rows * v.cols === 1) return v.data[0]; throw new RangeError(`${what} must be a scalar.`); } return v; };
const realOf = (v, what = 'value') => { const s = scalarOf(v, what); if (isComplex(s)) throw new RangeError(`${what} must be real.`); return s; };

const C = {
  add: (a, b) => tidy({ re: a.re + b.re, im: a.im + b.im }), sub: (a, b) => tidy({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => tidy({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => { const d = b.re * b.re + b.im * b.im; return tidy({ re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }); },
  abs: (a) => Math.hypot(a.re, a.im), arg: (a) => Math.atan2(a.im, a.re),
  exp: (a) => tidy({ re: Math.exp(a.re) * Math.cos(a.im), im: Math.exp(a.re) * Math.sin(a.im) }),
  log: (a) => tidy({ re: Math.log(Math.hypot(a.re, a.im)), im: Math.atan2(a.im, a.re) }),
};
C.pow = (a, b) => { if (a.re === 0 && a.im === 0) return b.re === 0 && b.im === 0 ? 1 : 0; return C.exp(C.mul(b, toComplex(C.log(a)))); };

// ---------------------------------------------------------------------------
// Tokenizer.

const SUFFIX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, T: 1e12 };
export function tokenize(source) {
  const tokens = [];
  let i = 0;
  const push = (type, value, start, end = start + 1) => tokens.push({ type, value, start, end });
  while (i < source.length) {
    const ch = source[i];
    if (ch === '%' || ch === '#') { while (i < source.length && source[i] !== '\n') i += 1; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i += 1; continue; }
    if (ch === '\n' || ch === ';' || ch === ',') { push(ch === ',' ? ',' : ch === ';' ? ';' : 'newline', ch, i); i += 1; continue; }
    if (/[0-9.]/.test(ch) && (ch !== '.' || /[0-9]/.test(source[i + 1] ?? ''))) {
      const match = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(source.slice(i));
      let value = Number(match[0]), j = i + match[0].length;
      const next = source[j], after = source[j + 1] ?? '';
      if (next && SUFFIX[next] !== undefined && !/[A-Za-z0-9_]/.test(after)) { value *= SUFFIX[next]; j += 1; }
      if ((source[j] === 'j' || source[j] === 'i') && !/[A-Za-z0-9_]/.test(source[j + 1] ?? '')) { push('number', { re: 0, im: value }, i, j + 1); i = j + 1; continue; }
      push('number', value, i, j); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) { const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i)); push('name', match[0], i, i + match[0].length); i += match[0].length; continue; }
    if (ch === '"' || (ch === "'" && !isTransposeContext(tokens))) {
      const end = source.indexOf(ch, i + 1);
      if (end < 0) throw new SyntaxError('Unterminated string.');
      push('string', source.slice(i + 1, end), i, end + 1); i = end + 1; continue;
    }
    const two = source.slice(i, i + 2);
    if (['.*', './', '.^', "'", '==', '~=', '!=', '<=', '>=', '&&', '||', '.\''].includes(two)) { push('op', two === '!=' ? '~=' : two, i, i + 2); i += 2; continue; }
    if ('+-*/^\\()[]=<>:\'!~&|{}'.includes(ch)) { push('op', ch, i); i += 1; continue; }
    throw new SyntaxError(`Unexpected character "${ch}" at position ${i + 1}.`);
  }
  push('eof', null, source.length);
  return tokens;
}
function isTransposeContext(tokens) {
  const last = tokens.at(-1);
  return last && (last.type === 'number' || last.type === 'name' || (last.type === 'op' && (last.value === ')' || last.value === ']' || last.value === "'")));
}

// ---------------------------------------------------------------------------
// Parser (Pratt) → AST.

const BINARY = { '||': 1, '&&': 2, '==': 3, '~=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, ':': 4, '+': 5, '-': 5, '*': 6, '/': 6, '\\': 6, '.*': 6, './': 6, '^': 8, '.^': 8 };

export function parse(source) {
  const tokens = tokenize(source);
  let p = 0;
  const peek = () => tokens[p], next = () => tokens[p++];
  const expect = (value) => { const t = next(); if (t.value !== value) throw new SyntaxError(`Expected "${value}" but found "${t.value ?? 'end of input'}".`); return t; };
  const isOp = (value) => peek().type === 'op' && peek().value === value;
  function primary(inMatrix) {
    const t = next();
    if (t.type === 'number') return { type: 'num', value: t.value };
    if (t.type === 'string') return { type: 'str', value: t.value };
    if (t.type === 'name') {
      if (isOp('(')) {
        next();
        const args = [];
        if (!isOp(')')) { do { args.push(expression(0)); } while (peek().type === ',' && next()); }
        expect(')');
        return { type: 'call', name: t.value, args };
      }
      return { type: 'var', name: t.value };
    }
    if (t.type === 'op' && t.value === '(') { const e = expression(0); expect(')'); return e; }
    if (t.type === 'op' && t.value === '[') {
      const rows = [[]];
      while (!isOp(']')) {
        const tk = peek();
        if (tk.type === ';' || tk.type === 'newline') { next(); if (rows.at(-1).length) rows.push([]); continue; }
        if (tk.type === ',') { next(); continue; }
        if (tk.type === 'eof') throw new SyntaxError('Missing "]".');
        rows.at(-1).push(expression(0, true));
      }
      next();
      if (!rows.at(-1).length) rows.pop();
      return { type: 'matrix', rows };
    }
    if (t.type === 'op' && (t.value === '-' || t.value === '+' || t.value === '~' || t.value === '!')) return { type: 'unary', op: t.value === '!' ? '~' : t.value, arg: expression(7, inMatrix) };
    throw new SyntaxError(`Unexpected "${t.value ?? 'end of input'}".`);
  }
  function expression(minPrecedence, inMatrix = false) {
    let left = primary(inMatrix);
    for (;;) {
      const t = peek();
      if (t.type === 'op' && (t.value === "'" || t.value === ".'")) { next(); left = { type: 'transpose', arg: left }; continue; }
      if (t.type !== 'op' || BINARY[t.value] === undefined) break;
      // Inside [ ], "a -b" is two elements: a space before a sign that is not followed by a space.
      if (inMatrix && (t.value === '-' || t.value === '+') && tokens[p - 1].end < t.start && tokens[p + 1]?.start === t.end) break;
      const precedence = BINARY[t.value];
      if (precedence < minPrecedence) break;
      next();
      const right = expression(t.value === '^' || t.value === '.^' ? precedence : precedence + 1, inMatrix);
      left = { type: 'binary', op: t.value, left, right };
    }
    return left;
  }
  const statements = [];
  while (peek().type !== 'eof') {
    if (['newline', ';', ','].includes(peek().type)) { next(); continue; }
    const start = p;
    // f(x, y) = body  → function definition
    if (peek().type === 'name' && tokens[p + 1]?.value === '(') {
      let q = p + 2, ok = true; const params = [];
      while (tokens[q] && tokens[q].value !== ')') { if (tokens[q].type === 'name') params.push(tokens[q].value); else if (tokens[q].type !== ',') { ok = false; break; } q += 1; }
      if (ok && tokens[q]?.value === ')' && tokens[q + 1]?.value === '=' && tokens[q + 2]?.value !== '=') {
        const name = peek().value; p = q + 2;
        const body = expression(0);
        statements.push({ type: 'function', name, params, body, quiet: peek().type === ';' });
        continue;
      }
    }
    if (peek().type === 'name' && tokens[p + 1]?.value === '=' && tokens[p + 2]?.value !== '=') {
      const name = next().value; next();
      const value = expression(0);
      statements.push({ type: 'assign', name, value, quiet: peek().type === ';' });
      continue;
    }
    p = start;
    const value = expression(0);
    statements.push({ type: 'expr', value, quiet: peek().type === ';' });
  }
  return statements;
}

// ---------------------------------------------------------------------------
// Arithmetic on values.

function broadcast(a, b, op, name) {
  if (isMatrix(a) || isMatrix(b)) {
    const A = isMatrix(a) ? a : null, B = isMatrix(b) ? b : null;
    if (A && B && (A.rows !== B.rows || A.cols !== B.cols)) throw new RangeError(`${name}: sizes ${A.rows}×${A.cols} and ${B.rows}×${B.cols} do not match.`);
    const shape = A ?? B, out = new Matrix(shape.rows, shape.cols);
    for (let k = 0; k < out.data.length; k += 1) {
      const r = op(A ? A.data[k] : a, B ? B.data[k] : b);
      if (isComplex(r)) throw new RangeError(`${name}: complex results inside matrices are not supported.`);
      out.data[k] = r;
    }
    return out;
  }
  return op(a, b);
}
const scalarOp = (realFn, complexFn) => (a, b) => (isComplex(a) || isComplex(b) ? complexFn(toComplex(a), toComplex(b)) : realFn(a, b));
const add = scalarOp((a, b) => a + b, C.add), sub = scalarOp((a, b) => a - b, C.sub), mulE = scalarOp((a, b) => a * b, C.mul), divE = scalarOp((a, b) => a / b, C.div);
const powE = (a, b) => {
  if (!isComplex(a) && !isComplex(b) && (a >= 0 || Number.isInteger(b))) return a ** b;
  return C.pow(toComplex(a), toComplex(b));
};

export function matMul(A, B) {
  if (A.cols !== B.rows) throw new RangeError(`Matrix product: inner sizes ${A.cols} and ${B.rows} differ (use .* for element-wise).`);
  const out = new Matrix(A.rows, B.cols);
  for (let r = 0; r < A.rows; r += 1) for (let c = 0; c < B.cols; c += 1) { let s = 0; for (let k = 0; k < A.cols; k += 1) s += A.data[r * A.cols + k] * B.data[k * B.cols + c]; out.data[r * B.cols + c] = s; }
  return out;
}
export const transpose = (A) => { const out = new Matrix(A.cols, A.rows); for (let r = 0; r < A.rows; r += 1) for (let c = 0; c < A.cols; c += 1) out.data[c * A.rows + r] = A.data[r * A.cols + c]; return out; };
function identity(n) { const I = new Matrix(n, n); for (let k = 0; k < n; k += 1) I.data[k * n + k] = 1; return I; }

/** Gaussian elimination with partial pivoting: solves A·X = B (B may have several columns). */
export function solve(A, B) {
  if (A.rows !== A.cols) return leastSquares(A, B);
  const n = A.rows, m = B.cols, a = Array.from({ length: n }, (_, r) => [...A.data.slice(r * n, r * n + n), ...B.data.slice(r * m, r * m + m)]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col; for (let r = col + 1; r < n; r += 1) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-13 * Math.max(1, ...A.data.map(Math.abs))) throw new RangeError('The matrix is singular (or nearly so).');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r += 1) if (r !== col) { const f = a[r][col] / a[col][col]; for (let c = col; c < n + m; c += 1) a[r][c] -= f * a[col][c]; }
  }
  const out = new Matrix(n, m);
  for (let r = 0; r < n; r += 1) for (let c = 0; c < m; c += 1) out.data[r * m + c] = a[r][n + c] / a[r][r];
  return out;
}
const leastSquares = (A, B) => { const At = transpose(A); return solve(matMul(At, A), matMul(At, B)); };
export function determinant(A) {
  if (A.rows !== A.cols) throw new RangeError('det needs a square matrix.');
  const n = A.rows, a = Array.from({ length: n }, (_, r) => Array.from(A.data.slice(r * n, r * n + n)));
  let det = 1;
  for (let col = 0; col < n; col += 1) {
    let pivot = col; for (let r = col + 1; r < n; r += 1) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (a[pivot][col] === 0) return 0;
    if (pivot !== col) { [a[col], a[pivot]] = [a[pivot], a[col]]; det = -det; }
    det *= a[col][col];
    for (let r = col + 1; r < n; r += 1) { const f = a[r][col] / a[col][col]; for (let c = col; c < n; c += 1) a[r][c] -= f * a[col][c]; }
  }
  return det;
}

function matPow(A, n) {
  if (A.rows !== A.cols) throw new RangeError('Matrix power needs a square matrix (use .^ for element-wise).');
  if (!Number.isInteger(n)) throw new RangeError('Matrix power needs an integer exponent.');
  if (n < 0) return matPow(solve(A, identity(A.rows)), -n);
  let result = identity(A.rows), base = A, e = n;
  while (e > 0) { if (e & 1) result = matMul(result, base); base = matMul(base, base); e >>= 1; }
  return result;
}

function binary(op, a, b) {
  switch (op) {
    case '+': return broadcast(a, b, add, 'Addition');
    case '-': return broadcast(a, b, sub, 'Subtraction');
    case '.*': return broadcast(a, b, mulE, 'Element-wise product');
    case './': return broadcast(a, b, divE, 'Element-wise division');
    case '.^': return broadcast(a, b, powE, 'Element-wise power');
    case '*': return isMatrix(a) && isMatrix(b) ? (a.rows * a.cols === 1 || b.rows * b.cols === 1 ? broadcast(a.rows * a.cols === 1 ? a.data[0] : a, b.rows * b.cols === 1 ? b.data[0] : b, mulE, 'Product') : matMul(a, b)) : broadcast(a, b, mulE, 'Product');
    case '/': if (isMatrix(b) && b.rows * b.cols > 1) return transpose(solve(transpose(b), transpose(isMatrix(a) ? a : rowVector([a])))); return broadcast(a, isMatrix(b) ? b.data[0] : b, divE, 'Division');
    case '\\': if (!isMatrix(a) || a.rows * a.cols === 1) return broadcast(b, scalarOf(a), divE, 'Left division'); return solve(a, isMatrix(b) ? b : rowVector([b]));
    case '^': if (isMatrix(a) && a.rows * a.cols > 1) return matPow(a, realOf(b, 'Exponent')); return powE(scalarOf(a), scalarOf(b));
    case ':': return range(realOf(a, 'Range start'), 1, realOf(b, 'Range end'));
    case '==': return broadcast(a, b, (x, y) => (C.abs(toComplex(sub(x, y))) === 0 ? 1 : 0), 'Comparison');
    case '~=': return broadcast(a, b, (x, y) => (C.abs(toComplex(sub(x, y))) === 0 ? 0 : 1), 'Comparison');
    case '<': return broadcast(a, b, (x, y) => (realOf(x) < realOf(y) ? 1 : 0), 'Comparison');
    case '>': return broadcast(a, b, (x, y) => (realOf(x) > realOf(y) ? 1 : 0), 'Comparison');
    case '<=': return broadcast(a, b, (x, y) => (realOf(x) <= realOf(y) ? 1 : 0), 'Comparison');
    case '>=': return broadcast(a, b, (x, y) => (realOf(x) >= realOf(y) ? 1 : 0), 'Comparison');
    case '&&': return truthy(a) && truthy(b) ? 1 : 0;
    case '||': return truthy(a) || truthy(b) ? 1 : 0;
    default: throw new SyntaxError(`Unknown operator ${op}.`);
  }
}
const truthy = (v) => (isMatrix(v) ? v.data.length > 0 && v.data.every((x) => x !== 0) : C.abs(toComplex(v)) !== 0);
function range(start, step, end) {
  if (step === 0) throw new RangeError('Range step cannot be zero.');
  const count = Math.floor((end - start) / step + 1e-10) + 1;
  if (count > 1e6) throw new RangeError('Range too long (over a million elements).');
  return rowVector(count > 0 ? Array.from({ length: count }, (_, k) => start + k * step) : []);
}

// ---------------------------------------------------------------------------
// Function library.

const mapReal = (fn, complexFn = null) => (v) => {
  if (isMatrix(v)) { const out = new Matrix(v.rows, v.cols); out.data = v.data.map((x) => { const r = fn(x); if (Number.isNaN(r) && complexFn) return NaN; return r; }); return out; }
  if (isComplex(v)) { if (!complexFn) throw new RangeError('This function needs a real argument.'); return complexFn(v); }
  const r = fn(v);
  return Number.isNaN(r) && complexFn ? complexFn(toComplex(v)) : r;
};
const vectorOf = (v) => (isMatrix(v) ? Array.from(v.data) : [realOf(v)]);
const columnsOrVector = (v, fn) => {
  if (!isMatrix(v) || v.rows === 1 || v.cols === 1) return fn(vectorOf(v));
  return rowVector(Array.from({ length: v.cols }, (_, c) => fn(Array.from({ length: v.rows }, (_, r) => v.get(r, c)))));
};
const csqrt = (z) => C.pow(z, { re: 0.5, im: 0 });
const DEG = Math.PI / 180;

export const FUNCTIONS = {
  sin: mapReal(Math.sin), cos: mapReal(Math.cos), tan: mapReal(Math.tan), asin: mapReal(Math.asin), acos: mapReal(Math.acos), atan: mapReal(Math.atan),
  sinh: mapReal(Math.sinh), cosh: mapReal(Math.cosh), tanh: mapReal(Math.tanh),
  sind: mapReal((x) => Math.sin(x * DEG)), cosd: mapReal((x) => Math.cos(x * DEG)), tand: mapReal((x) => Math.tan(x * DEG)),
  atan2: (y, x) => broadcast(y, x, (a, b) => Math.atan2(realOf(a), realOf(b)), 'atan2'),
  sqrt: mapReal(Math.sqrt, csqrt), exp: mapReal(Math.exp, C.exp), log: mapReal(Math.log, C.log), ln: mapReal(Math.log, C.log), log10: mapReal(Math.log10), log2: mapReal(Math.log2),
  abs: mapReal(Math.abs, C.abs), angle: mapReal((x) => (x < 0 ? Math.PI : 0), C.arg), arg: mapReal((x) => (x < 0 ? Math.PI : 0), C.arg),
  real: mapReal((x) => x, (z) => z.re), imag: mapReal(() => 0, (z) => z.im), conj: mapReal((x) => x, (z) => tidy({ re: z.re, im: -z.im })),
  round: mapReal(Math.round), floor: mapReal(Math.floor), ceil: mapReal(Math.ceil), fix: mapReal(Math.trunc), sign: mapReal(Math.sign),
  mod: (a, b) => broadcast(a, b, (x, y) => { const m = realOf(y); return m === 0 ? realOf(x) : realOf(x) - Math.floor(realOf(x) / m) * m; }, 'mod'),
  rem: (a, b) => broadcast(a, b, (x, y) => realOf(x) % realOf(y), 'rem'),
  deg: mapReal((x) => x / DEG), rad: mapReal((x) => x * DEG),
  db: mapReal((x) => 20 * Math.log10(Math.abs(x)), (z) => 20 * Math.log10(C.abs(z))), db10: mapReal((x) => 10 * Math.log10(x)),
  fromdb: mapReal((x) => 10 ** (x / 20)),
  polar: (r, deg) => tidy({ re: realOf(r) * Math.cos(realOf(deg) * DEG), im: realOf(r) * Math.sin(realOf(deg) * DEG) }),
  parallel: (...args) => 1 / args.reduce((s, v) => s + 1 / realOf(v), 0),
  sum: (v) => columnsOrVector(v, (x) => x.reduce((s, y) => s + y, 0)), prod: (v) => columnsOrVector(v, (x) => x.reduce((s, y) => s * y, 1)),
  mean: (v) => columnsOrVector(v, (x) => x.reduce((s, y) => s + y, 0) / x.length),
  std: (v) => columnsOrVector(v, (x) => { const m = x.reduce((s, y) => s + y, 0) / x.length; return Math.sqrt(x.reduce((s, y) => s + (y - m) ** 2, 0) / Math.max(1, x.length - 1)); }),
  var: (v) => columnsOrVector(v, (x) => { const m = x.reduce((s, y) => s + y, 0) / x.length; return x.reduce((s, y) => s + (y - m) ** 2, 0) / Math.max(1, x.length - 1); }),
  rms: (v) => columnsOrVector(v, (x) => Math.sqrt(x.reduce((s, y) => s + y * y, 0) / x.length)),
  min: (a, b) => (b === undefined ? columnsOrVector(a, (x) => Math.min(...x)) : broadcast(a, b, (x, y) => Math.min(realOf(x), realOf(y)), 'min')),
  max: (a, b) => (b === undefined ? columnsOrVector(a, (x) => Math.max(...x)) : broadcast(a, b, (x, y) => Math.max(realOf(x), realOf(y)), 'max')),
  cumsum: (v) => { const x = vectorOf(v); let s = 0; return rowVector(x.map((y) => (s += y))); },
  diff: (v) => { const x = vectorOf(v); return rowVector(x.slice(1).map((y, k) => y - x[k])); },
  sort: (v) => rowVector(vectorOf(v).sort((a, b) => a - b)),
  length: (v) => (isMatrix(v) ? Math.max(v.rows, v.cols) : 1), numel: (v) => (isMatrix(v) ? v.rows * v.cols : 1),
  size: (v) => rowVector(isMatrix(v) ? [v.rows, v.cols] : [1, 1]),
  zeros: (r, c = r) => new Matrix(realOf(r), realOf(c)), ones: (r, c = r) => { const m = new Matrix(realOf(r), realOf(c)); m.data.fill(1); return m; },
  eye: (n) => identity(realOf(n)),
  linspace: (a, b, n = 100) => { const count = realOf(n), lo = realOf(a), hi = realOf(b); return rowVector(Array.from({ length: count }, (_, k) => (count === 1 ? hi : lo + (hi - lo) * k / (count - 1)))); },
  logspace: (a, b, n = 50) => { const count = realOf(n); return rowVector(Array.from({ length: count }, (_, k) => 10 ** (realOf(a) + (realOf(b) - realOf(a)) * k / Math.max(1, count - 1)))); },
  transpose: (v) => (isMatrix(v) ? transpose(v) : v),
  det: (v) => determinant(isMatrix(v) ? v : rowVector([v])),
  inv: (v) => { if (!isMatrix(v)) return divE(1, v); if (v.rows !== v.cols) throw new RangeError('inv needs a square matrix.'); return solve(v, identity(v.rows)); },
  trace: (v) => { let s = 0; for (let k = 0; k < Math.min(v.rows, v.cols); k += 1) s += v.get(k, k); return s; },
  rank: (v) => { const A = isMatrix(v) ? v : rowVector([v]), a = Array.from({ length: A.rows }, (_, r) => Array.from(A.data.slice(r * A.cols, r * A.cols + A.cols))); let rank = 0; const tol = 1e-10 * Math.max(1, ...A.data.map(Math.abs)); for (let c = 0; c < A.cols && rank < A.rows; c += 1) { let p = rank; for (let r = rank + 1; r < A.rows; r += 1) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r; if (Math.abs(a[p][c]) <= tol) continue; [a[rank], a[p]] = [a[p], a[rank]]; for (let r = rank + 1; r < A.rows; r += 1) { const f = a[r][c] / a[rank][c]; for (let k = c; k < A.cols; k += 1) a[r][k] -= f * a[rank][k]; } rank += 1; } return rank; },
  dot: (a, b) => { const x = vectorOf(a), y = vectorOf(b); if (x.length !== y.length) throw new RangeError('dot: vectors differ in length.'); return x.reduce((s, v, k) => s + v * y[k], 0); },
  cross: (a, b) => { const [a1, a2, a3] = vectorOf(a), [b1, b2, b3] = vectorOf(b); return rowVector([a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1]); },
  norm: (v) => Math.sqrt(vectorOf(v).reduce((s, x) => s + x * x, 0)),
  roots: (v) => { const coefficients = vectorOf(v); const list = polyRoots(coefficients); return list.length === 1 ? tidy(list[0]) : { type: 'list', items: list.map(tidy) }; },
  polyval: (p, x) => { const c = vectorOf(p); return broadcast(x, 0, (value) => c.reduce((acc, k) => add(mulE(acc, value), k), 0), 'polyval'); },
  poly: (r) => { const rs = vectorOf(r); let c = [1]; for (const root of rs) c = [...c, 0].map((v, k) => v - (k ? root * c[k - 1] : 0)); return rowVector(c); },
  conv: (a, b) => { const x = vectorOf(a), y = vectorOf(b), out = new Array(x.length + y.length - 1).fill(0); x.forEach((u, i) => y.forEach((w, k) => { out[i + k] += u * w; })); return rowVector(out); },
  factorial: mapReal((n) => { let f = 1; for (let k = 2; k <= n; k += 1) f *= k; return f; }),
  nchoosek: (n, k) => { let r = 1; for (let i = 1; i <= realOf(k); i += 1) r = r * (realOf(n) - realOf(k) + i) / i; return Math.round(r); },
  gcd: (a, b) => { let x = Math.abs(realOf(a)), y = Math.abs(realOf(b)); while (y) [x, y] = [y, x % y]; return x; },
  lcm: (a, b) => Math.abs(realOf(a) * realOf(b)) / FUNCTIONS.gcd(a, b),
  isprime: mapReal((n) => { if (n < 2 || !Number.isInteger(n)) return 0; for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return 0; return 1; }),
};
export const CONSTANTS = Object.freeze({ pi: Math.PI, e: Math.E, Inf: Infinity, inf: Infinity, NaN, eps: Number.EPSILON, c0: 299_792_458, mu0: 4e-7 * Math.PI, eps0: 8.8541878128e-12, kB: 1.380649e-23, q: 1.602176634e-19, h: 6.62607015e-34, true: 1, false: 0 });

// ---------------------------------------------------------------------------
// Interpreter.

export function createSession() { return { variables: new Map(), functions: new Map() }; }

function evaluate(node, session, scope = null, depth = 0) {
  if (depth > 200) throw new RangeError('Recursion too deep.');
  switch (node.type) {
    case 'num': return node.value;
    case 'str': return { type: 'string', value: node.value };
    case 'var': {
      if (scope?.has(node.name)) return scope.get(node.name);
      if (session.variables.has(node.name)) return session.variables.get(node.name);
      if ((node.name === 'j' || node.name === 'i')) return { re: 0, im: 1 };
      if (CONSTANTS[node.name] !== undefined) return CONSTANTS[node.name];
      throw new ReferenceError(`"${node.name}" is not defined.`);
    }
    case 'unary': { const v = evaluate(node.arg, session, scope, depth); if (node.op === '-') return broadcast(v, -1, mulE, 'Negation'); if (node.op === '~') return broadcast(v, 0, (x) => (C.abs(toComplex(x)) === 0 ? 1 : 0), 'Not'); return v; }
    case 'transpose': { const v = evaluate(node.arg, session, scope, depth); return isMatrix(v) ? transpose(v) : isComplex(v) ? tidy({ re: v.re, im: -v.im }) : v; }
    case 'binary': {
      // a:b:c is parsed as (a:b):c
      if (node.op === ':' && node.left.type === 'binary' && node.left.op === ':') return range(realOf(evaluate(node.left.left, session, scope, depth)), realOf(evaluate(node.left.right, session, scope, depth)), realOf(evaluate(node.right, session, scope, depth)));
      return binary(node.op, evaluate(node.left, session, scope, depth), evaluate(node.right, session, scope, depth));
    }
    case 'matrix': {
      const rows = node.rows.map((row) => row.map((e) => evaluate(e, session, scope, depth)));
      // Concatenate: each element is a scalar or a matrix block.
      const blocks = rows.map((row) => {
        const parts = row.map((v) => { if (isComplex(v)) throw new RangeError('Complex numbers inside matrices are not supported.'); return isMatrix(v) ? v : new Matrix(1, 1, Float64Array.of(v)); }).filter((m) => m.rows * m.cols > 0);
        if (!parts.length) return new Matrix(0, 0);
        const height = parts[0].rows;
        if (parts.some((m) => m.rows !== height)) throw new RangeError('Horizontal concatenation: row counts differ.');
        const width = parts.reduce((s, m) => s + m.cols, 0), out = new Matrix(height, width);
        let offset = 0;
        for (const m of parts) { for (let r = 0; r < height; r += 1) for (let c = 0; c < m.cols; c += 1) out.data[r * width + offset + c] = m.get(r, c); offset += m.cols; }
        return out;
      }).filter((m) => m.rows * m.cols > 0);
      if (!blocks.length) return new Matrix(0, 0);
      const width = blocks[0].cols;
      if (blocks.some((m) => m.cols !== width)) throw new RangeError('Vertical concatenation: column counts differ.');
      const height = blocks.reduce((s, m) => s + m.rows, 0), out = new Matrix(height, width);
      let row = 0;
      for (const m of blocks) { out.data.set(m.data, row * width); row += m.rows; }
      return height === 1 && width === 1 ? out.data[0] : out;
    }
    case 'call': {
      const args = node.args.map((a) => evaluate(a, session, scope, depth));
      const local = scope?.get(node.name) ?? session.variables.get(node.name);
      if (local !== undefined && isMatrix(local)) {
        // Indexing (1-based): v(k), A(r, c); a vector index selects several elements.
        const index = (value, size) => vectorOf(value).map((k) => { if (!Number.isInteger(k) || k < 1 || k > size) throw new RangeError(`Index ${k} is outside 1…${size}.`); return k - 1; });
        if (args.length === 1) { const picked = index(args[0], local.data.length).map((k) => local.data[k]); return picked.length === 1 ? picked[0] : rowVector(picked); }
        const rowsSel = index(args[0], local.rows), colsSel = index(args[1], local.cols), out = new Matrix(rowsSel.length, colsSel.length);
        rowsSel.forEach((r, i) => colsSel.forEach((c, k) => { out.data[i * colsSel.length + k] = local.get(r, c); }));
        return out.rows * out.cols === 1 ? out.data[0] : out;
      }
      if (session.functions.has(node.name)) {
        const fn = session.functions.get(node.name);
        if (args.length !== fn.params.length) throw new RangeError(`${node.name} takes ${fn.params.length} argument(s).`);
        return evaluate(fn.body, session, new Map(fn.params.map((p, k) => [p, args[k]])), depth + 1);
      }
      if (node.name === 'plot') return { type: 'plot', series: plotSeries(args) };
      if (node.name === 'disp') return args[0];
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new ReferenceError(`Unknown function "${node.name}".`);
      return fn(...args);
    }
    default: throw new SyntaxError(`Cannot evaluate ${node.type}.`);
  }
}
function plotSeries(args) {
  const series = [];
  for (let k = 0; k < args.length;) {
    if (args[k + 1] !== undefined && isMatrix(args[k + 1]) && isMatrix(args[k])) { series.push({ x: Array.from(args[k].data), y: Array.from(args[k + 1].data) }); k += 2; }
    else { const y = vectorOf(args[k]); series.push({ x: y.map((_, i) => i + 1), y }); k += 1; }
    if (args[k]?.type === 'string') k += 1;
  }
  if (series.some((s) => s.x.length !== s.y.length)) throw new RangeError('plot: x and y lengths differ.');
  return series;
}

/** Run a script; returns one entry per statement that should be shown, plus plots. */
export function run(source, session = createSession()) {
  const outputs = [];
  let statements;
  try { statements = parse(source); } catch (error) { return { session, outputs: [{ error: error.message }] }; }
  for (const statement of statements) {
    try {
      if (statement.type === 'function') { session.functions.set(statement.name, statement); if (!statement.quiet) outputs.push({ text: `${statement.name}(${statement.params.join(', ')}) defined` }); continue; }
      const value = evaluate(statement.value, session);
      if (value?.type === 'plot') { outputs.push({ plot: value.series }); continue; }
      if (statement.type === 'assign') session.variables.set(statement.name, value);
      else if (value?.type !== 'string') session.variables.set('ans', value);
      if (!statement.quiet) outputs.push({ name: statement.type === 'assign' ? statement.name : 'ans', value, text: format(value) });
    } catch (error) { outputs.push({ error: error.message }); break; }
  }
  return { session, outputs };
}

// ---------------------------------------------------------------------------
// Formatting.

const num = (x) => { if (!Number.isFinite(x)) return Number.isNaN(x) ? 'NaN' : x > 0 ? 'Inf' : '-Inf'; if (x === 0) return '0'; const a = Math.abs(x); return a >= 1e6 || a < 1e-4 ? x.toExponential(5).replace(/\.?0+e/, 'e') : String(Number(x.toPrecision(7))); };
export function format(value) {
  if (value?.type === 'string') return value.value;
  if (value?.type === 'list') return value.items.map(format).join('\n');
  if (isComplex(value)) return `${num(value.re)} ${value.im < 0 ? '-' : '+'} ${num(Math.abs(value.im))}j`;
  if (isMatrix(value)) {
    if (value.rows * value.cols === 0) return '[](0x0)';
    const scale = Math.max(...value.data.map(Math.abs).filter(Number.isFinite), 0), clean = (x) => (Math.abs(x) < 1e-13 * scale ? 0 : x);
    const cells = Array.from({ length: value.rows }, (_, r) => Array.from({ length: value.cols }, (_, c) => num(clean(value.get(r, c)))));
    const width = Math.max(...cells.flat().map((s) => s.length));
    return cells.map((row) => row.map((s) => s.padStart(width)).join('  ')).join('\n');
  }
  return num(value);
}
export const describe = (value) => (isMatrix(value) ? `${value.rows}×${value.cols} matrix` : isComplex(value) ? 'complex' : value?.type === 'list' ? `${value.items.length} values` : 'scalar');
