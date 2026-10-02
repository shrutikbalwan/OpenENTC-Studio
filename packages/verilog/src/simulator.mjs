// Event-driven Verilog simulator: elaborates the parsed modules into a flat set of signals,
// continuous assignments and processes (JS generators), then runs the stratified event queue
// (active → inactive #0 → non-blocking updates → monitor) with four-state values and the
// Verilog expression width/sign rules.
import { Value, ZERO1, ONE1, mask, bitAnd, bitOr, bitXor, bitNot, reduce, truth, concat, parseNumber } from './values.mjs';
import { parse, VerilogError } from './parser.mjs';

class Finish extends Error {}

// ---------------------------------------------------------------------------
// IEEE 1364 $random (rtl_dist_uniform over the full 32-bit range).
function ieeeRandom(state) {
  const uniform = (start, end) => {
    if (state.seed === 0) state.seed = 259341593;
    const a = start, b = end;
    state.seed = (Math.imul(69069, state.seed) + 1) | 0;
    let stemp = state.seed >>> 0;
    stemp = ((stemp >>> 9) | 0x3f800000) >>> 0;
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, stemp);
    let c = view.getFloat32(0);
    c += c * 0.00000011920928955078125;
    return (b - a) * (c - 1.0) + a;
  };
  let r = (uniform(-2147483648, 2147483647) + 2147483648.0) / 4294967295.0;
  r = r * 4294967296.0 - 2147483648.0;
  const i = r >= 0 ? Math.trunc(r) : Math.trunc(r - 1);
  return i | 0;
}

export function simulate(source, { top = null, maxTime = 1_000_000, maxSteps = 5_000_000, maxOutput = 200_000, randomSeed = 0 } = {}) {
  const modules = parse(source);
  const byName = new Map(modules.map((module) => [module.name, module]));
  const instantiated = new Set();
  for (const module of modules) for (const item of module.items) if (item.kind === 'instances') instantiated.add(item.module);
  const tops = top ? [byName.get(top)] : modules.filter((module) => !instantiated.has(module.name));
  if (!tops.length || tops.some((module) => !module)) throw new VerilogError(top ? `no module named ${top}` : 'no top-level module found');

  // ---------------- simulation state ----------------
  let now = 0, steps = 0, finished = false, stopAfterStep = false, finishReason = null;
  const active = [], inactive = [], nba = [];
  const future = new Map(); // time → callbacks
  const signals = [];
  const scopes = [];
  const monitors = [];
  const strobes = [];
  let output = '';
  const random = { seed: randomSeed };
  const dirty = new Set();

  const print = (text) => { if (output.length < maxOutput) output += text; };
  const schedule = (time, callback) => { if (!future.has(time)) future.set(time, []); future.get(time).push(callback); };

  // ---------------- signals ----------------
  function makeSignal(scope, name, { width = 1, signed = false, kind = 'reg', array = null, left = width - 1, right = 0 }) {
    const signal = { name, path: `${scope.path}.${name}`, scope, width, signed, kind, left, right, watchers: new Set(), history: [], drivers: 0 };
    if (array) {
      signal.array = array; // { low, high }
      signal.words = Array.from({ length: Math.abs(array.high - array.low) + 1 }, () => Value.unknown(width, signed));
    } else signal.value = kind === 'wire' ? Value.highZ(width).withSigned(signed) : Value.unknown(width, signed);
    scope.names.set(name, { type: 'signal', signal });
    signals.push(signal);
    return signal;
  }
  function writeSignal(signal, value) {
    const next = value.resize(signal.width, value.signed).withSigned(signal.signed);
    if (signal.value.equals(next)) return;
    const old = signal.value;
    signal.value = next;
    dirty.add(signal);
    for (const watcher of [...signal.watchers]) watcher(old, next);
  }
  function writeWord(signal, index, value) {
    const offset = index - Math.min(signal.array.low, signal.array.high);
    if (offset < 0 || offset >= signal.words.length) return;
    const next = value.resize(signal.width, value.signed).withSigned(signal.signed);
    if (signal.words[offset].equals(next)) return;
    signal.words[offset] = next;
    for (const watcher of [...signal.watchers]) watcher(null, null);
  }
  // Position of declared bit index `i` inside the stored vector.
  const bitPosition = (signal, i) => (signal.left >= signal.right ? i - signal.right : signal.right - i);

  // ---------------- scopes and constants ----------------
  const scopeByPath = new Map();
  const lookup = (scope, name, line) => {
    for (let s = scope; s; s = s.parent) if (s.names.has(name)) return s.names.get(name);
    if (name.includes('.')) {
      // Hierarchical reference: relative to this instance (or its parents), else from a top module.
      const dot = name.lastIndexOf('.'), path = name.slice(0, dot), leaf = name.slice(dot + 1);
      for (let s = scope; s; s = s.parent) { const target = scopeByPath.get(`${s.path}.${path}`); if (target?.names.has(leaf)) return target.names.get(leaf); }
      const absolute = scopeByPath.get(path);
      if (absolute?.names.has(leaf)) return absolute.names.get(leaf);
    }
    throw new VerilogError(`'${name}' is not declared`, line);
  };
  const constant = (node, scope) => {
    const value = evaluate(node, scope, null);
    if (!value.known) throw new VerilogError('a constant expression has unknown bits');
    return Number(value.signedBig);
  };

  // ---------------- static expression properties ----------------
  function selfWidth(node, scope) {
    switch (node.kind) {
      case 'number': return (node.cached ??= parseNumber(node.text)).width;
      case 'string': return Math.max(8, node.value.length * 8);
      case 'id': { const entry = lookup(scope, node.name, node.line); return entry.type === 'param' ? entry.value.width : entry.signal.width; }
      case 'index': { const base = node.target.kind === 'id' ? lookup(scope, node.target.name, node.target.line) : null; return base?.type === 'signal' && base.signal.array ? base.signal.width : 1; }
      case 'part': return Math.abs(constant(node.msb, scope) - constant(node.lsb, scope)) + 1;
      case 'indexed': return constant(node.width, scope);
      case 'concat': return node.parts.reduce((sum, part) => sum + selfWidth(part, scope), 0);
      case 'replicate': return constant(node.count, scope) * node.parts.reduce((sum, part) => sum + selfWidth(part, scope), 0);
      case 'unary': return ['!', '&', '|', '^', '~&', '~|', '~^', '^~'].includes(node.op) ? 1 : selfWidth(node.operand, scope);
      case 'binary':
        if (['==', '!=', '===', '!==', '<', '<=', '>', '>=', '&&', '||'].includes(node.op)) return 1;
        if (['<<', '>>', '<<<', '>>>', '**'].includes(node.op)) return selfWidth(node.left, scope);
        return Math.max(selfWidth(node.left, scope), selfWidth(node.right, scope));
      case 'ternary': return Math.max(selfWidth(node.whenTrue, scope), selfWidth(node.whenFalse, scope));
      case 'system': return node.name === '$time' ? 64 : ['$signed', '$unsigned'].includes(node.name) ? selfWidth(node.args[0], scope) : 32;
      case 'call': { const fn = lookup(scope, node.name, node.line); return fn.def.width ? Math.abs(constant(fn.def.width.msb, fn.scope) - constant(fn.def.width.lsb, fn.scope)) + 1 : 1; }
      default: return 1;
    }
  }
  function selfSigned(node, scope) {
    switch (node.kind) {
      case 'number': return (node.cached ??= parseNumber(node.text)).signed;
      case 'id': { const entry = lookup(scope, node.name, node.line); return entry.type === 'param' ? entry.value.signed : entry.signal.signed; }
      case 'index': { const base = node.target.kind === 'id' ? lookup(scope, node.target.name) : null; return Boolean(base?.type === 'signal' && base.signal.array && base.signal.signed); }
      case 'unary': return ['+', '-', '~'].includes(node.op) ? selfSigned(node.operand, scope) : false;
      case 'binary':
        if (['==', '!=', '===', '!==', '<', '<=', '>', '>=', '&&', '||'].includes(node.op)) return false;
        if (['<<', '>>', '<<<', '>>>', '**'].includes(node.op)) return selfSigned(node.left, scope);
        return selfSigned(node.left, scope) && selfSigned(node.right, scope);
      case 'ternary': return selfSigned(node.whenTrue, scope) && selfSigned(node.whenFalse, scope);
      case 'system': return node.name === '$random' || node.name === '$signed';
      case 'call': { const fn = lookup(scope, node.name, node.line); return fn.def.signed; }
      default: return false;
    }
  }

  // ---------------- expression evaluation ----------------
  // `width` is the context width (null: self-determined); `signed` the context signedness.
  function evaluate(node, scope, width, signed = null) {
    const w = width ?? selfWidth(node, scope);
    const s = signed ?? selfSigned(node, scope);
    const sized = (value) => value.resize(w, s && value.signed).withSigned(s);
    switch (node.kind) {
      case 'number': return sized(node.cached ??= parseNumber(node.text));
      case 'string': {
        let v = 0n;
        for (const char of node.value) v = (v << 8n) | BigInt(char.charCodeAt(0) & 0xff);
        return sized(new Value(Math.max(8, node.value.length * 8), v));
      }
      case 'id': {
        const entry = lookup(scope, node.name, node.line);
        if (entry.type === 'param') return sized(entry.value);
        if (entry.signal.array) throw new VerilogError(`memory '${node.name}' needs an index`, node.line);
        return sized(entry.signal.value);
      }
      case 'index': {
        if (node.target.kind === 'id') {
          const entry = lookup(scope, node.target.name, node.target.line);
          if (entry.type === 'signal' && entry.signal.array) {
            const index = evaluate(node.index, scope, null);
            const signal = entry.signal;
            if (!index.known) return sized(Value.unknown(signal.width, signal.signed));
            const offset = Number(index.signedBig) - Math.min(signal.array.low, signal.array.high);
            if (offset < 0 || offset >= signal.words.length) return sized(Value.unknown(signal.width, signal.signed));
            return sized(signal.words[offset]);
          }
        }
        const base = evaluate(node.target, scope, null);
        const index = evaluate(node.index, scope, null);
        if (!index.known) return sized(Value.unknown(1));
        const signal = node.target.kind === 'id' ? lookup(scope, node.target.name).signal : null;
        const position = signal ? bitPosition(signal, Number(index.signedBig)) : Number(index.big);
        if (position < 0 || position >= base.width) return sized(Value.unknown(1));
        const bit = base.bit(position);
        return sized(new Value(1, BigInt(bit.v), BigInt(bit.x), BigInt(bit.z)));
      }
      case 'part': case 'indexed': {
        const base = evaluate(node.target, scope, null);
        const signal = node.target.kind === 'id' ? lookup(scope, node.target.name).signal : null;
        let msb, lsb;
        if (node.kind === 'part') { msb = constant(node.msb, scope); lsb = constant(node.lsb, scope); }
        else {
          const start = evaluate(node.base, scope, null);
          const count = constant(node.width, scope);
          if (!start.known) return sized(Value.unknown(count));
          const b = Number(start.signedBig);
          const ascending = !signal || signal.left >= signal.right;
          if (node.up) { [lsb, msb] = ascending ? [b, b + count - 1] : [b + count - 1, b]; } else { [msb, lsb] = ascending ? [b, b - count + 1] : [b - count + 1, b]; }
        }
        const lo = signal ? Math.min(bitPosition(signal, msb), bitPosition(signal, lsb)) : Math.min(msb, lsb);
        const count = Math.abs(msb - lsb) + 1;
        const shift = BigInt(lo), m = mask(count);
        let v = base.v >> shift, x = base.x >> shift, z = base.z >> shift;
        // Bits outside the vector read as x.
        if (lo + count > base.width || lo < 0) { const outside = m & ~mask(Math.max(0, base.width - lo)); x |= outside; }
        return sized(new Value(count, v & m, x & m, z & m));
      }
      case 'concat': return sized(concat(node.parts.map((part) => evaluate(part, scope, null))));
      case 'replicate': {
        const parts = node.parts.map((part) => evaluate(part, scope, null));
        const count = constant(node.count, scope);
        return sized(concat(Array.from({ length: count }, () => parts).flat()));
      }
      case 'unary': {
        const op = node.op;
        if (op === '!') return sized(bitNot(truth(evaluate(node.operand, scope, null)), 1));
        if (['&', '|', '^', '~&', '~|', '~^', '^~'].includes(op)) return sized(reduce(op === '^~' ? '~^' : op, evaluate(node.operand, scope, null)));
        const a = evaluate(node.operand, scope, w, s);
        if (op === '~') return bitNot(a, w).withSigned(s);
        if (op === '+') return a;
        if (!a.known) return Value.unknown(w, s);
        return new Value(w, BigInt.asUintN(w, -a.v), 0n, 0n, s);
      }
      case 'binary': return binaryOp(node, scope, w, s);
      case 'ternary': {
        const condition = truth(evaluate(node.condition, scope, null));
        if (condition.known) return evaluate(condition.v ? node.whenTrue : node.whenFalse, scope, w, s);
        const a = evaluate(node.whenTrue, scope, w, s), b = evaluate(node.whenFalse, scope, w, s);
        const differ = (a.v ^ b.v) | a.x | b.x;
        return new Value(w, a.v & b.v, differ, 0n, s);
      }
      case 'system': {
        if (node.name === '$time') return sized(Value.of(64, now));
        if (node.name === '$stime') return sized(Value.of(32, now));
        if (node.name === '$random') return sized(Value.of(32, ieeeRandom(random), true));
        if (node.name === '$signed') return sized(evaluate(node.args[0], scope, null).withSigned(true));
        if (node.name === '$unsigned') return sized(evaluate(node.args[0], scope, null).withSigned(false));
        if (node.name === '$clog2') { const value = evaluate(node.args[0], scope, null); let n = 0; while ((1n << BigInt(n)) < value.big) n += 1; return sized(Value.of(32, n, true)); }
        throw new VerilogError(`${node.name} is not supported in expressions`, node.line);
      }
      case 'call': return sized(callFunction(node, scope));
      default: throw new VerilogError(`cannot evaluate ${node.kind}`);
    }
  }

  function binaryOp(node, scope, w, s) {
    const { op } = node;
    if (op === '&&' || op === '||') {
      const a = truth(evaluate(node.left, scope, null)), b = truth(evaluate(node.right, scope, null));
      const result = op === '&&' ? bitAnd(a, b, 1) : bitOr(a, b, 1);
      return result.resize(w, false).withSigned(s);
    }
    if (['==', '!=', '===', '!==', '<', '<=', '>', '>='].includes(op)) {
      const width = Math.max(selfWidth(node.left, scope), selfWidth(node.right, scope));
      const sign = selfSigned(node.left, scope) && selfSigned(node.right, scope);
      const a = evaluate(node.left, scope, width, sign), b = evaluate(node.right, scope, width, sign);
      let result;
      if (op === '===') result = Value.of(1, a.v === b.v && a.x === b.x && a.z === b.z ? 1 : 0);
      else if (op === '!==') result = Value.of(1, a.v === b.v && a.x === b.x && a.z === b.z ? 0 : 1);
      else if (op === '==' || op === '!=') {
        const differsKnown = (a.v ^ b.v) & ~a.x & ~b.x;
        if (differsKnown) result = Value.of(1, op === '!=' ? 1 : 0);
        else if (a.x | b.x) result = Value.unknown(1);
        else result = Value.of(1, op === '==' ? 1 : 0);
      } else if (!a.known || !b.known) result = Value.unknown(1);
      else {
        const x = sign ? a.signedBig : a.big, y = sign ? b.signedBig : b.big;
        result = Value.of(1, op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y);
      }
      return result.resize(w, false).withSigned(s);
    }
    if (['<<', '>>', '<<<', '>>>'].includes(op)) {
      const a = evaluate(node.left, scope, w, s), amount = evaluate(node.right, scope, null, false);
      if (!amount.known) return Value.unknown(w, s);
      const n = amount.big;
      if (op === '<<' || op === '<<<') return new Value(w, n >= BigInt(w) ? 0n : a.v << n, n >= BigInt(w) ? 0n : a.x << n, n >= BigInt(w) ? 0n : a.z << n, s);
      if (op === '>>>' && s) {
        const top = (a.v >> BigInt(w - 1)) & 1n, topX = (a.x >> BigInt(w - 1)) & 1n;
        const fill = n >= BigInt(w) ? mask(w) : mask(w) & ~(mask(w) >> n);
        return new Value(w, (a.v >> n) | (top ? fill : 0n), (a.x >> n) | (topX ? fill : 0n), a.z >> n, s);
      }
      return new Value(w, a.v >> n, a.x >> n, a.z >> n, s);
    }
    const a = evaluate(node.left, scope, op === '**' ? w : w, s), b = evaluate(node.right, scope, op === '**' ? null : w, op === '**' ? null : s);
    if (op === '&') return bitAnd(a, b, w).withSigned(s);
    if (op === '|') return bitOr(a, b, w).withSigned(s);
    if (op === '^') return bitXor(a, b, w).withSigned(s);
    if (op === '~^' || op === '^~') return bitNot(bitXor(a, b, w), w).withSigned(s);
    if (!a.known || !b.known) return Value.unknown(w, s);
    const x = s ? a.signedBig : a.big, y = s ? b.signedBig : (op === '**' && b.signed ? b.signedBig : b.big);
    let r;
    if (op === '+') r = x + y;
    else if (op === '-') r = x - y;
    else if (op === '*') r = x * y;
    else if (op === '/') { if (y === 0n) return Value.unknown(w, s); r = x / y; }
    else if (op === '%') { if (y === 0n) return Value.unknown(w, s); r = x % y; }
    else if (op === '**') { if (y < 0n) return Value.unknown(w, s); r = x ** y; }
    else throw new VerilogError(`unsupported operator ${op}`, node.line);
    return new Value(w, BigInt.asUintN(w, r), 0n, 0n, s);
  }

  // ---------------- functions and tasks ----------------
  function callFunction(node, scope) {
    const entry = lookup(scope, node.name, node.line);
    if (entry.type !== 'function') throw new VerilogError(`'${node.name}' is not a function`, node.line);
    const { def, scope: fnScope, signals: locals, result } = entry;
    const inputs = def.args.filter((arg) => arg.direction === 'input');
    inputs.forEach((arg, index) => { const target = locals.get(arg.name); writeSignal(target, evaluate(node.args[index], scope, Math.max(target.width, selfWidth(node.args[index], scope)), selfSigned(node.args[index], scope))); });
    const generator = execute(def.body, fnScope);
    for (let step = generator.next(); !step.done; step = generator.next()) throw new VerilogError(`function ${def.name} cannot wait or delay`, node.line);
    return result.value;
  }

  // ---------------- lvalues ----------------
  function lvalueWidth(node, scope) {
    if (node.kind === 'concat') return node.parts.reduce((sum, part) => sum + lvalueWidth(part, scope), 0);
    return selfWidth(node, scope);
  }
  /** Resolve an lvalue now (indices evaluated at assignment time) into a writer function. */
  function resolveTarget(node, scope) {
    if (node.kind === 'concat') {
      const parts = node.parts.map((part) => ({ width: lvalueWidth(part, scope), write: resolveTarget(part, scope) }));
      return (value) => {
        let offset = parts.reduce((sum, part) => sum + part.width, 0);
        for (const part of parts) {
          offset -= part.width;
          const shift = BigInt(offset), m = mask(part.width);
          part.write(new Value(part.width, (value.v >> shift) & m, (value.x >> shift) & m, (value.z >> shift) & m));
        }
      };
    }
    if (node.kind === 'id') {
      const entry = lookup(scope, node.name, node.line);
      if (entry.type !== 'signal') throw new VerilogError(`cannot assign to parameter '${node.name}'`, node.line);
      return (value) => writeSignal(entry.signal, value);
    }
    if (node.kind === 'index' && node.target.kind === 'id') {
      const entry = lookup(scope, node.target.name, node.target.line);
      const signal = entry.signal;
      const index = evaluate(node.index, scope, null);
      if (signal.array) {
        if (!index.known) return () => {};
        const i = Number(index.signedBig);
        return (value) => writeWord(signal, i, value);
      }
      if (!index.known) return () => {};
      const position = bitPosition(signal, Number(index.signedBig));
      return (value) => writeBits(signal, position, 1, value);
    }
    if ((node.kind === 'part' || node.kind === 'indexed') && node.target.kind === 'id') {
      const signal = lookup(scope, node.target.name, node.target.line).signal;
      let msb, lsb;
      if (node.kind === 'part') { msb = constant(node.msb, scope); lsb = constant(node.lsb, scope); }
      else {
        const start = evaluate(node.base, scope, null);
        if (!start.known) return () => {};
        const count = constant(node.width, scope), b = Number(start.signedBig);
        const ascending = signal.left >= signal.right;
        if (node.up) [lsb, msb] = ascending ? [b, b + count - 1] : [b + count - 1, b]; else [msb, lsb] = ascending ? [b, b - count + 1] : [b - count + 1, b];
      }
      const lo = Math.min(bitPosition(signal, msb), bitPosition(signal, lsb));
      const count = Math.abs(msb - lsb) + 1;
      return (value) => writeBits(signal, lo, count, value);
    }
    if (node.kind === 'index' && node.target.kind === 'index') {
      // memory word bit select: mem[i][b]
      const wordNode = node.target;
      const signal = lookup(scope, wordNode.target.name, wordNode.target.line).signal;
      const word = evaluate(wordNode.index, scope, null), bit = evaluate(node.index, scope, null);
      if (!word.known || !bit.known) return () => {};
      const offset = Number(word.signedBig) - Math.min(signal.array.low, signal.array.high);
      return (value) => {
        if (offset < 0 || offset >= signal.words.length) return;
        const old = signal.words[offset], position = BigInt(bitPosition(signal, Number(bit.signedBig)));
        const keep = ~(1n << position);
        writeWord(signal, Number(word.signedBig), new Value(old.width, (old.v & keep) | ((value.v & 1n) << position), (old.x & keep) | ((value.x & 1n) << position), (old.z & keep) | ((value.z & 1n) << position)));
      };
    }
    throw new VerilogError('unsupported assignment target', node.line);
  }
  function writeBits(signal, position, count, value) {
    if (position < 0 || position + count > signal.width) {
      const clipped = Math.max(0, position);
      if (clipped >= signal.width) return;
    }
    const old = signal.value, m = mask(count) << BigInt(Math.max(0, position));
    const shift = (bits) => (position >= 0 ? (bits & mask(count)) << BigInt(position) : (bits & mask(count)) >> BigInt(-position));
    writeSignal(signal, new Value(signal.width, (old.v & ~m) | shift(value.v), (old.x & ~m) | shift(value.x), (old.z & ~m) | shift(value.z), signal.signed));
  }
  function assignmentValue(target, valueNode, scope) {
    const width = lvalueWidth(target, scope);
    const contextWidth = Math.max(width, selfWidth(valueNode, scope));
    const value = evaluate(valueNode, scope, contextWidth, selfSigned(valueNode, scope));
    return value.resize(width);
  }

  // ---------------- sensitivity ----------------
  function reads(node, scope, set = new Set()) {
    if (!node || typeof node !== 'object') return set;
    if (node.kind === 'id') { const entry = lookup(scope, node.name, node.line); if (entry.type === 'signal') set.add(entry.signal); return set; }
    if (node.kind === 'call') { const entry = lookup(scope, node.name, node.line); node.args.forEach((arg) => reads(arg, scope, set)); readsStatement(entry.def.body, entry.scope, set, entry.signals); return set; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((item) => reads(item, scope, set));
      else if (value && typeof value === 'object' && value.kind) reads(value, scope, set);
    }
    return set;
  }
  function readsStatement(statement, scope, set = new Set(), exclude = null) {
    if (!statement) return set;
    const visit = (s) => {
      if (!s) return;
      switch (s.kind) {
        case 'block': s.body.forEach(visit); break;
        case 'blocking': case 'nonblocking': reads(s.value, scope, set); if (s.target.kind !== 'id') for (const key of ['index', 'base']) if (s.target[key]) reads(s.target[key], scope, set); break;
        case 'if': reads(s.condition, scope, set); visit(s.then); visit(s.otherwise); break;
        case 'case': reads(s.subject, scope, set); s.items.forEach((item) => { item.labels?.forEach((label) => reads(label, scope, set)); visit(item.body); }); break;
        case 'for': visit(s.init); reads(s.condition, scope, set); visit(s.step); visit(s.body); break;
        case 'while': reads(s.condition, scope, set); visit(s.body); break;
        case 'repeat': reads(s.count, scope, set); visit(s.body); break;
        case 'forever': case 'delay': case 'event': visit(s.body); break;
        case 'systask': case 'taskcall': s.args.forEach((arg) => reads(arg, scope, set)); break;
        default: break;
      }
    };
    visit(statement);
    if (exclude) for (const signal of exclude.values()) set.delete(signal);
    return set;
  }

  // ---------------- statements (generators) ----------------
  function* execute(statement, scope) {
    if (!statement) return;
    if ((steps += 1) > maxSteps) throw new VerilogError(`stopped after ${maxSteps.toLocaleString()} statements (a loop without a delay?) at time ${now}`);
    switch (statement.kind) {
      case 'null': case 'decl': return;
      case 'block': for (const child of statement.body) yield* execute(child, scope); return;
      case 'blocking': {
        if (statement.delay) {
          const value = assignmentValue(statement.target, statement.value, scope);
          yield { delay: constant(statement.delay, scope) };
          resolveTarget(statement.target, scope)(value);
          return;
        }
        const value = assignmentValue(statement.target, statement.value, scope);
        resolveTarget(statement.target, scope)(value);
        return;
      }
      case 'nonblocking': {
        const value = assignmentValue(statement.target, statement.value, scope);
        const write = resolveTarget(statement.target, scope);
        if (statement.delay) { const amount = constant(statement.delay, scope); schedule(now + amount, { nba: () => write(value) }); }
        else nba.push(() => write(value));
        return;
      }
      case 'if': {
        const condition = evaluate(statement.condition, scope, null);
        if (condition.isTrue()) yield* execute(statement.then, scope); else yield* execute(statement.otherwise, scope);
        return;
      }
      case 'case': {
        const labels = statement.items.flatMap((item) => item.labels ?? []);
        const width = Math.max(selfWidth(statement.subject, scope), ...labels.map((label) => selfWidth(label, scope)));
        const subject = evaluate(statement.subject, scope, width, false);
        let chosen = statement.items.find((item) => item.labels === null) ?? null;
        for (const item of statement.items) {
          if (!item.labels) continue;
          if (item.labels.some((label) => caseMatch(statement.type, subject, evaluate(label, scope, width, false)))) { chosen = item; break; }
        }
        if (chosen) yield* execute(chosen.body, scope);
        return;
      }
      case 'for': {
        yield* execute(statement.init, scope);
        while (evaluate(statement.condition, scope, null).isTrue()) {
          yield* execute(statement.body, scope);
          yield* execute(statement.step, scope);
          if ((steps += 1) > maxSteps) throw new VerilogError(`loop did not finish (time ${now})`);
        }
        return;
      }
      case 'while': while (evaluate(statement.condition, scope, null).isTrue()) { yield* execute(statement.body, scope); if ((steps += 1) > maxSteps) throw new VerilogError(`loop did not finish (time ${now})`); } return;
      case 'repeat': { const count = evaluate(statement.count, scope, null); for (let k = 0; count.known && k < Number(count.big); k += 1) yield* execute(statement.body, scope); return; }
      case 'forever': for (;;) { yield* execute(statement.body, scope); if ((steps += 1) > maxSteps) throw new VerilogError(`forever loop without a delay (time ${now})`); }
      case 'delay': yield { delay: constant(statement.amount, scope) }; yield* execute(statement.body, scope); return;
      case 'event': yield { event: statement.control, scope, body: statement.body }; yield* execute(statement.body, scope); return;
      case 'systask': systemTask(statement, scope); return;
      case 'taskcall': {
        const entry = lookup(scope, statement.name, statement.line);
        if (entry.type !== 'task') throw new VerilogError(`'${statement.name}' is not a task`, statement.line);
        const { def, scope: taskScope, signals: locals } = entry;
        def.args.forEach((arg, index) => { if (arg.direction !== 'output' && statement.args[index]) { const target = locals.get(arg.name); writeSignal(target, evaluate(statement.args[index], scope, Math.max(target.width, selfWidth(statement.args[index], scope)), selfSigned(statement.args[index], scope))); } });
        yield* execute(def.body, taskScope);
        def.args.forEach((arg, index) => { if (arg.direction !== 'input' && statement.args[index]) resolveTarget(statement.args[index], scope)(locals.get(arg.name).value); });
        return;
      }
      default: throw new VerilogError(`unsupported statement ${statement.kind}`);
    }
  }
  function caseMatch(type, a, b) {
    if (type === 'case') return a.v === b.v && a.x === b.x && a.z === b.z;
    const dontCare = type === 'casez' ? a.z | b.z : a.x | b.x;
    const care = ~dontCare & mask(a.width);
    return ((a.v ^ b.v) & care) === 0n && ((a.x ^ b.x) & care) === 0n;
  }

  // ---------------- system tasks and formatting ----------------
  function formatValue(value, spec, width, zeroPad) {
    const pad = (text, size) => (zeroPad || size === 0 ? text : text.padStart(size));
    const w = value.width;
    switch (spec) {
      case 'b': { const text = value.toBinary(); return zeroPad ? text.replace(/^0+(?=.)/, '') : text; }
      case 'o': case 'h': case 'x': {
        const bitsPer = spec === 'o' ? 3 : 4;
        const digits = Math.ceil(w / bitsPer);
        let text = '';
        for (let d = digits - 1; d >= 0; d -= 1) {
          let v = 0, xs = 0, zs = 0, n = 0;
          for (let k = 0; k < bitsPer; k += 1) { const i = d * bitsPer + k; if (i >= w) continue; const b = value.bit(i); n += 1; if (b.z) zs += 1; else if (b.x) xs += 1; else v |= b.v << k; }
          text += zs === n ? 'z' : xs === n ? 'x' : xs ? 'X' : zs ? 'Z' : v.toString(bitsPer === 3 ? 8 : 16);
        }
        return zeroPad ? text.replace(/^0+(?=.)/, '') : text;
      }
      case 'c': return String.fromCharCode(Number(value.v & 0xffn));
      case 's': { let text = ''; for (let k = Math.ceil(w / 8) - 1; k >= 0; k -= 1) { const code = Number((value.v >> BigInt(k * 8)) & 0xffn); if (code) text += String.fromCharCode(code); } return width ? text.padStart(width) : text; }
      case 't': return pad(value.known ? value.big.toString() : 'x', width ?? 20);
      default: {
        // Default width: digits of the largest magnitude (2ʷ − 1 unsigned, 2ʷ⁻¹ plus a sign when signed).
        const size = width ?? (value.signed ? String(1n << BigInt(Math.max(0, w - 1))).length + 1 : String(mask(w)).length);
        if (!value.known) { const m = mask(w), xOnly = value.x & ~value.z; return pad(value.z === m ? 'z' : xOnly === m ? 'x' : xOnly ? 'X' : 'Z', size); }
        return pad(value.signed ? value.signedBig.toString() : value.big.toString(), size);
      }
    }
  }
  function formatArgs(args, scope) {
    let out = '', index = 0;
    const valueOf = (node) => (node.kind === 'string' ? null : evaluate(node, scope, null));
    while (index < args.length) {
      const arg = args[index++];
      if (!arg) { out += ' '; continue; }
      if (arg.kind === 'string') {
        const text = arg.value;
        for (let i = 0; i < text.length; i += 1) {
          if (text[i] !== '%') { out += text[i]; continue; }
          const match = text.slice(i).match(/^%(0?)(\d*)([bBoOdDhHxXcCsStTmM%])/);
          if (!match) { out += '%'; continue; }
          i += match[0].length - 1;
          const spec = match[3].toLowerCase();
          if (spec === '%') { out += '%'; continue; }
          if (spec === 'm') { out += scope.path; continue; }
          const node = args[index++];
          if (!node) { out += '<missing>'; continue; }
          const zero = match[1] === '0' && match[2] === '';
          const width = match[2] !== '' ? Number(match[2]) : zero ? 0 : null;
          if (node.kind === 'string' && spec === 's') { out += width ? node.value.padStart(width) : node.value; continue; }
          out += formatValue(valueOf(node), spec, width, zero || match[2] === '0');
        }
      } else out += formatValue(valueOf(arg), arg.kind === 'system' && arg.name === '$time' ? 't' : 'd', null, false);
    }
    return out;
  }
  function systemTask(statement, scope) {
    const { name, args } = statement;
    switch (name) {
      case '$display': print(`${formatArgs(args, scope)}\n`); break;
      case '$write': print(formatArgs(args, scope)); break;
      case '$strobe': strobes.push(() => print(`${formatArgs(args, scope)}\n`)); break;
      case '$monitor': {
        const key = () => args.filter((arg) => arg && arg.kind !== 'string' && !(arg.kind === 'system' && ['$time', '$stime', '$realtime'].includes(arg.name))).map((arg) => { const v = evaluate(arg, scope, null); return `${v.v}:${v.x}:${v.z}`; }).join('|');
        monitors.length = 0;
        monitors.push({ args, scope, key, last: null });
        break;
      }
      // Like Icarus Verilog, the rest of the current time step still runs; time does not advance.
      case '$finish': case '$stop': stopAfterStep = true; finishReason = `${name} at time ${now}`; throw new Finish();
      case '$dumpfile': case '$dumpvars': case '$dumpon': case '$dumpoff': case '$timeformat': case '$monitoron': case '$monitoroff': break;
      default: throw new VerilogError(`${name} is not supported`, statement.line);
    }
  }

  // ---------------- processes ----------------
  function startProcess(body, scope, repeat) {
    const process = { scope, body, repeat, generator: null, waiting: null };
    const resume = () => {
      if (finished) return;
      process.waiting = null;
      for (;;) {
        if (!process.generator) process.generator = execute(body, scope);
        let step;
        try { step = process.generator.next(); }
        catch (error) { if (error instanceof Finish) return; throw error; }
        if (step.done) {
          process.generator = null;
          if (!repeat) return;
          if (!processHasTiming(body)) throw new VerilogError('an always block without a delay or event control would loop forever');
          continue;
        }
        wait(process, step.value, resume);
        return;
      }
    };
    active.push(resume);
    return process;
  }
  const timingCache = new WeakMap();
  function processHasTiming(statement) {
    if (timingCache.has(statement)) return timingCache.get(statement);
    let found = false;
    const visit = (s) => { if (!s || found) return; if (s.kind === 'delay' || s.kind === 'event' || ((s.kind === 'blocking') && s.delay) || s.kind === 'taskcall') { found = true; return; } for (const key of ['body', 'then', 'otherwise']) { const child = s[key]; if (Array.isArray(child)) child.forEach(visit); else visit(child); } if (s.items) s.items.forEach((item) => visit(item.body)); };
    visit(statement);
    timingCache.set(statement, found);
    return found;
  }
  function wait(process, request, resume) {
    if ('delay' in request) {
      if (request.delay <= 0) inactive.push(resume); else schedule(now + request.delay, resume);
      return;
    }
    const { event: control, scope } = request;
    const registrations = [];
    const wake = () => { for (const [signal, watcher] of registrations) signal.watchers.delete(watcher); active.push(resume); };
    if (control.star) {
      const set = readsStatement(request.body ?? process.body, process.scope);
      for (const signal of set) { const watcher = () => wake(); watcher.level = true; signal.watchers.add(watcher); registrations.push([signal, watcher]); }
      if (!set.size) return; // nothing to wait for: never wakes
      return;
    }
    for (const event of control.events) {
      const sensitive = reads(event.expr, scope);
      let previous = evaluate(event.expr, scope, null);
      for (const signal of sensitive) {
        const watcher = (_old, _new, force = false) => {
          if (force) { wake(); return; }
          const current = evaluate(event.expr, scope, null);
          const before = previous; previous = current;
          if (event.edge) {
            const a = before.bit(0), b = current.bit(0);
            const level = (bit) => (bit.x ? 'x' : String(bit.v));
            const from = level(a), to = level(b);
            if (from === to) return;
            const posedge = (from === '0' && to !== '0') || (from === 'x' && to === '1');
            const negedge = (from === '1' && to !== '1') || (from === 'x' && to === '0');
            if ((event.edge === 'posedge' && posedge) || (event.edge === 'negedge' && negedge)) wake();
          } else if (!before.equals(current)) wake();
        };
        watcher.level = !event.edge;
        signal.watchers.add(watcher);
        registrations.push([signal, watcher]);
      }
    }
  }

  // ---------------- elaboration ----------------
  function instantiate(module, path, overrides, parentScope) {
    const scope = { path, module: module.name, names: new Map(), parent: null, children: [] };
    scopes.push(scope);
    scopeByPath.set(path, scope);
    // Parameters (overrides are already evaluated in the parent scope).
    const positional = overrides.filter((entry) => entry.name === null);
    module.params.forEach((param, index) => {
      const named = overrides.find((entry) => entry.name === param.name);
      const value = named ? named.value : !param.local && positional[index] ? positional[index].value : evaluate(param.value, scope, null);
      scope.names.set(param.name, { type: 'param', value });
    });
    // Declarations (a port may be declared twice: "output q; reg [3:0] q;").
    const declared = new Map();
    for (const item of module.items) {
      if (item.kind !== 'decl') continue;
      for (const entry of item.names) {
        const width = item.width ? Math.abs(constant(item.width.msb, scope) - constant(item.width.lsb, scope)) + 1 : 1;
        const left = item.width ? constant(item.width.msb, scope) : 0, right = item.width ? constant(item.width.lsb, scope) : 0;
        const array = entry.array ? { low: constant(entry.array.msb, scope), high: constant(entry.array.lsb, scope) } : null;
        const kind = item.netType === 'reg' || item.netType === 'integer' || item.netType === 'time' ? 'reg' : 'wire';
        const existing = declared.get(entry.name);
        if (existing) {
          if (item.width) { existing.width = width; existing.left = left; existing.right = right; existing.value = (kind === 'wire' ? Value.highZ(width) : Value.unknown(width)).withSigned(existing.signed || item.signed); }
          if (kind === 'reg') { existing.kind = 'reg'; existing.value = Value.unknown(existing.width, existing.signed); }
          if (item.signed) { existing.signed = true; existing.value = existing.value.withSigned(true); }
          if (item.direction) existing.direction = item.direction;
          continue;
        }
        const signal = makeSignal(scope, entry.name, { width, signed: item.signed, kind, array, left, right });
        signal.direction = item.direction;
        declared.set(entry.name, signal);
        if (entry.init) {
          if (kind === 'wire') continuous({ kind: 'id', name: entry.name }, entry.init, scope, scope);
          else { initialized.push(signal); initialValues.push(() => writeSignal(signal, assignmentValue({ kind: 'id', name: entry.name }, entry.init, scope))); }
        }
      }
    }
    // Declarations inside procedural blocks (static variables).
    for (const item of module.items) if (item.kind === 'initial' || item.kind === 'always') collectBlockDecls(item.body, scope, declared);
    // Functions and tasks.
    for (const item of module.items) {
      if (item.kind !== 'function' && item.kind !== 'task') continue;
      const subScope = { path: `${path}.${item.name}`, names: new Map(), parent: scope, children: [] };
      const locals = new Map();
      for (const arg of item.args) locals.set(arg.name, makeSignal(subScope, arg.name, { width: arg.width ? Math.abs(constant(arg.width.msb, scope) - constant(arg.width.lsb, scope)) + 1 : 1, signed: arg.signed, left: arg.width ? constant(arg.width.msb, scope) : 0, right: arg.width ? constant(arg.width.lsb, scope) : 0 }));
      for (const decl of item.locals) for (const entry of decl.names) locals.set(entry.name, makeSignal(subScope, entry.name, { width: decl.width ? Math.abs(constant(decl.width.msb, scope) - constant(decl.width.lsb, scope)) + 1 : 1, signed: decl.signed }));
      collectBlockDecls(item.body, subScope, new Map());
      const result = item.kind === 'function' ? makeSignal(subScope, item.name, { width: item.width ? Math.abs(constant(item.width.msb, scope) - constant(item.width.lsb, scope)) + 1 : 1, signed: item.signed }) : null;
      scope.names.set(item.name, { type: item.kind, def: item, scope: subScope, signals: locals, result });
    }
    // Continuous assignments.
    for (const item of module.items) if (item.kind === 'assign') continuous(item.target, item.value, scope, scope);
    // Child instances.
    for (const item of module.items) {
      if (item.kind !== 'instances') continue;
      const child = byName.get(item.module);
      if (!child) throw new VerilogError(`unknown module '${item.module}'`);
      for (const inst of item.instances) {
        const values = item.overrides.map((entry) => ({ name: entry.name, value: evaluate(entry.value, scope, null) }));
        const childScope = instantiate(child, `${path}.${inst.name}`, values, scope);
        scope.children.push(childScope);
        inst.connections.forEach((connection, index) => {
          const portName = connection.port ?? child.ports[index];
          if (!portName) throw new VerilogError(`too many port connections for ${inst.name}`);
          if (!connection.expr) return;
          const port = childScope.names.get(portName)?.signal;
          if (!port) throw new VerilogError(`module ${child.name} has no port '${portName}'`);
          if (port.direction === 'output') continuous(connection.expr, { kind: 'id', name: portName }, scope, childScope);
          else continuous({ kind: 'id', name: portName }, connection.expr, childScope, scope);
        });
      }
    }
    for (const item of module.items) {
      if (item.kind === 'initial') processes.push(() => startProcess(item.body, scope, false));
      if (item.kind === 'always') processes.push(() => startProcess(item.body, scope, true));
    }
    void parentScope;
    return scope;
  }
  function collectBlockDecls(statement, scope, declared) {
    const visit = (s) => {
      if (!s) return;
      if (s.kind === 'decl') {
        for (const entry of s.names) {
          if (declared.has(entry.name) || scope.names.has(entry.name)) continue;
          const width = s.width ? Math.abs(constant(s.width.msb, scope) - constant(s.width.lsb, scope)) + 1 : 1;
          declared.set(entry.name, makeSignal(scope, entry.name, { width, signed: s.signed, left: s.width ? constant(s.width.msb, scope) : 0, right: s.width ? constant(s.width.lsb, scope) : 0 }));
        }
        return;
      }
      for (const key of ['body', 'then', 'otherwise']) { const child = s[key]; if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child); }
      if (s.items) s.items.forEach((item) => visit(item.body));
    };
    visit(statement);
  }
  function continuous(target, value, targetScope, valueScope) {
    const assignment = { pending: false };
    const evaluateNow = () => {
      assignment.pending = false;
      const width = lvalueWidth(target, targetScope);
      const result = evaluate(value, valueScope, Math.max(width, selfWidth(value, valueScope)), selfSigned(value, valueScope)).resize(width);
      resolveTarget(target, targetScope)(result);
    };
    assignment.trigger = () => { if (!assignment.pending) { assignment.pending = true; active.push(evaluateNow); } };
    deferred.push(() => {
      for (const signal of reads(value, valueScope)) signal.watchers.add(() => assignment.trigger());
      // Indices on the target side are also inputs.
      for (const key of ['index', 'base']) if (target[key]) for (const signal of reads(target[key], targetScope)) signal.watchers.add(() => assignment.trigger());
      assignment.trigger();
    });
  }

  const processes = [], deferred = [], initialValues = [], initialized = [];
  const topScopes = tops.map((module) => instantiate(module, module.name, [], null));

  // ---------------- run ----------------
  let error = null;
  try {
    // As in Icarus Verilog: variable initialisers are applied before time 0 starts, processes
    // then run to their first event control, and only after that do continuous assignments
    // (including port connections) propagate — so a port driven by `reg rst = 1` rises at time 0.
    for (const apply of initialValues) apply();
    for (const start of processes) start();
    // Icarus also wakes level-sensitive event controls (@(a), @*) once for each initialised
    // variable at time 0 (edge controls are not triggered).
    active.push(() => { for (const signal of initialized) for (const watcher of [...signal.watchers]) if (watcher.level) watcher(null, null, true); });
    for (const hook of deferred) hook();
    const recordChanges = () => {
      for (const signal of dirty) {
        const last = signal.history.at(-1);
        if (last && last.t === now) {
          // Only the value at the end of a time step is visible in a waveform.
          const previous = signal.history.at(-2);
          if (previous && previous.value.equals(signal.value)) signal.history.pop(); else last.value = signal.value;
        } else if (!last || !last.value.equals(signal.value)) signal.history.push({ t: now, value: signal.value });
      }
      dirty.clear();
    };
    for (const signal of signals) if (!signal.array) signal.history.push({ t: 0, value: signal.value });
    for (;;) {
      while (!finished && (active.length || inactive.length || nba.length)) {
        while (!finished && active.length) active.shift()();
        if (finished) break;
        if (inactive.length) { active.push(...inactive.splice(0)); continue; }
        if (nba.length) for (const update of nba.splice(0)) update();
      }
      for (const strobe of strobes.splice(0)) strobe();
      for (const monitor of monitors) { const key = monitor.key(); if (key !== monitor.last) { monitor.last = key; print(`${formatArgs(monitor.args, monitor.scope)}\n`); } }
      recordChanges();
      if (stopAfterStep) { finished = true; break; }
      if (finished) break;
      const times = [...future.keys()].filter((time) => time > now);
      if (!times.length) { finishReason = `no more events at time ${now}`; break; }
      const nextTime = Math.min(...times);
      if (nextTime > maxTime) { finishReason = `time limit ${maxTime} reached`; break; }
      now = nextTime;
      for (const callback of future.get(nextTime)) { if (callback.nba) nba.push(callback.nba); else active.push(callback); }
      future.delete(nextTime);
    }
    recordChanges();
  } catch (caught) {
    if (!(caught instanceof Finish)) error = caught instanceof VerilogError ? caught.message : `internal error: ${caught.message}`;
  }

  return {
    output, error, time: now, finished, finishReason: error ? 'error' : finishReason, steps,
    signals: signals.filter((signal) => !signal.array).map((signal) => ({ path: signal.path, name: signal.name, scope: signal.scope.path, width: signal.width, history: signal.history, final: signal.value })),
    scopes: scopes.map((scope) => scope.path), tops: topScopes.map((scope) => scope.path),
  };
}

/** Value Change Dump of a simulation result (all scopes, 1 time unit = 1 ns). */
export function resultToVcd(result) {
  const lines = ['$date OpenENTC Studio $end', '$version OpenENTC Verilog simulator $end', '$timescale 1ns $end'];
  const ids = new Map();
  let counter = 0;
  const idFor = () => { let n = counter++, id = ''; do { id += String.fromCharCode(33 + (n % 94)); n = Math.floor(n / 94); } while (n > 0); return id; };
  const byScope = new Map();
  for (const signal of result.signals) { if (!byScope.has(signal.scope)) byScope.set(signal.scope, []); byScope.get(signal.scope).push(signal); }
  const tree = {};
  for (const scope of byScope.keys()) { let node = tree; for (const part of scope.split('.')) node = node[part] ??= {}; }
  const emit = (node, prefix) => {
    for (const [name, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${name}` : name;
      lines.push(`$scope module ${name} $end`);
      for (const signal of byScope.get(path) ?? []) { const id = idFor(); ids.set(signal.path, id); lines.push(`$var wire ${signal.width} ${id} ${signal.name}${signal.width > 1 ? ` [${signal.width - 1}:0]` : ''} $end`); }
      emit(child, path);
      lines.push('$upscope $end');
    }
  };
  emit(tree, '');
  lines.push('$enddefinitions $end');
  const events = [];
  for (const signal of result.signals) for (const change of signal.history) events.push({ t: change.t, text: signal.width > 1 ? `b${change.value.toBinary()} ${ids.get(signal.path)}` : `${change.value.toBinary()}${ids.get(signal.path)}` });
  events.sort((a, b) => a.t - b.t);
  let current = null;
  for (const event of events) { if (event.t !== current) { lines.push(`#${event.t}`); current = event.t; } lines.push(event.text); }
  lines.push(`#${result.time + 1}`);
  return `${lines.join('\n')}\n`;
}
