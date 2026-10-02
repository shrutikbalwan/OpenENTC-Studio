// Four-state logic vectors: `v` holds the 0/1 value bits, `x` marks unknown bits and `z`
// (a subset of `x`) marks high-impedance bits. Widths are arbitrary (BigInt).

export const mask = (width) => (1n << BigInt(width)) - 1n;

export class Value {
  constructor(width, v = 0n, x = 0n, z = 0n, signed = false) {
    const m = mask(width);
    this.width = width; this.x = x & m; this.z = z & this.x; this.v = v & m & ~this.x; this.signed = signed;
  }
  static of(width, number, signed = false) { return new Value(width, BigInt.asUintN(width, BigInt(number)), 0n, 0n, signed); }
  static unknown(width, signed = false) { return new Value(width, 0n, mask(width), 0n, signed); }
  static highZ(width) { return new Value(width, 0n, mask(width), mask(width)); }
  get known() { return this.x === 0n; }
  /** Unsigned BigInt (unknown bits read as 0). */
  get big() { return this.v; }
  /** Signed interpretation when the value is signed. */
  get signedBig() { return this.signed ? BigInt.asIntN(this.width, this.v) : this.v; }
  toNumber() { return Number(this.signedBig); }
  isTrue() { return this.v !== 0n; } // any known 1 bit
  isFalse() { return this.known && this.v === 0n; }
  /** Resize to `width`: sign-extend when `signedExtend`, else zero-extend (unknown top bits extend as unknown). */
  resize(width, signedExtend = this.signed) {
    if (width === this.width) return new Value(width, this.v, this.x, this.z, this.signed);
    if (width < this.width) return new Value(width, this.v, this.x, this.z, this.signed);
    const top = BigInt(this.width - 1), ext = mask(width) & ~mask(this.width);
    let v = this.v, x = this.x, z = this.z;
    if (signedExtend) {
      if ((x >> top) & 1n) { x |= ext; if ((z >> top) & 1n) z |= ext; }
      else if ((v >> top) & 1n) v |= ext;
    }
    return new Value(width, v, x, z, this.signed);
  }
  withSigned(signed) { return new Value(this.width, this.v, this.x, this.z, signed); }
  equals(other) { return this.width === other.width && this.v === other.v && this.x === other.x && this.z === other.z; }
  bit(index) { const i = BigInt(index); return { v: Number((this.v >> i) & 1n), x: Number((this.x >> i) & 1n), z: Number((this.z >> i) & 1n) }; }
  toBinary() {
    let out = '';
    for (let k = this.width - 1; k >= 0; k -= 1) { const b = this.bit(k); out += b.z ? 'z' : b.x ? 'x' : String(b.v); }
    return out;
  }
}

export const ZERO1 = () => Value.of(1, 0);
export const ONE1 = () => Value.of(1, 1);
const unknownBit = () => Value.unknown(1);

// Bitwise operators with four-state truth tables.
export function bitAnd(a, b, w) {
  const known0 = (~a.v & ~a.x) | (~b.v & ~b.x);
  const v = a.v & b.v;
  const x = (a.x | b.x) & ~known0;
  return new Value(w, v, x);
}
export function bitOr(a, b, w) {
  const known1 = (a.v & ~a.x) | (b.v & ~b.x);
  return new Value(w, a.v | b.v, (a.x | b.x) & ~known1);
}
export function bitXor(a, b, w) { return new Value(w, a.v ^ b.v, a.x | b.x); }
export function bitNot(a, w) { return new Value(w, ~a.v, a.x); }

export function reduce(op, a) {
  const w = a.width;
  const bits = [];
  for (let k = 0; k < w; k += 1) bits.push(a.bit(k));
  let result;
  if (op === '&' || op === '~&') {
    if (bits.some((b) => !b.x && b.v === 0)) result = ZERO1(); else if (bits.some((b) => b.x)) result = unknownBit(); else result = ONE1();
  } else if (op === '|' || op === '~|') {
    if (bits.some((b) => !b.x && b.v === 1)) result = ONE1(); else if (bits.some((b) => b.x)) result = unknownBit(); else result = ZERO1();
  } else {
    if (bits.some((b) => b.x)) result = unknownBit(); else result = Value.of(1, bits.reduce((p, b) => p ^ b.v, 0));
  }
  if (op.startsWith('~')) result = bitNot(result, 1);
  return result;
}

/** Logical truth of a value: 1, 0 or x. */
export function truth(a) { if (a.isTrue()) return ONE1(); if (a.known) return ZERO1(); return unknownBit(); }

export function concat(values) {
  let v = 0n, x = 0n, z = 0n, width = 0;
  for (const value of values) { v = (v << BigInt(value.width)) | value.v; x = (x << BigInt(value.width)) | value.x; z = (z << BigInt(value.width)) | value.z; width += value.width; }
  return new Value(width, v, x, z);
}

/** Parse a Verilog number literal: 8'hFF, 4'b10x1, 'd12, 12, 3'sd5, 16'h_dead. */
export function parseNumber(text) {
  const clean = text.replace(/_/g, '');
  const match = clean.match(/^(\d+)?'(s?)([bodh])([0-9a-fA-FxXzZ?]+)$/i);
  if (!match) {
    const value = BigInt(clean);
    return new Value(32, BigInt.asUintN(32, value), 0n, 0n, true);
  }
  const width = match[1] ? Number(match[1]) : 32;
  const signed = match[2].toLowerCase() === 's';
  const base = { b: 2, o: 8, d: 10, h: 16 }[match[3].toLowerCase()];
  const digits = match[4];
  if (base === 10) {
    if (/^[xX]$/.test(digits)) return new Value(width, 0n, mask(width), 0n, signed);
    if (/^[zZ?]$/.test(digits)) return new Value(width, 0n, mask(width), mask(width), signed);
    return new Value(width, BigInt.asUintN(width, BigInt(digits)), 0n, 0n, signed);
  }
  const bitsPer = { 2: 1, 8: 3, 16: 4 }[base];
  let v = 0n, x = 0n, z = 0n;
  for (const digit of digits) {
    v <<= BigInt(bitsPer); x <<= BigInt(bitsPer); z <<= BigInt(bitsPer);
    const all = mask(bitsPer);
    if (/[xX]/.test(digit)) x |= all;
    else if (/[zZ?]/.test(digit)) { x |= all; z |= all; }
    else v |= BigInt(parseInt(digit, base));
  }
  // Unknown leading digits extend to the full width (e.g. 8'bx).
  const digitBits = digits.length * bitsPer;
  if (digitBits < width) {
    const topIndex = BigInt(digitBits - 1);
    const ext = mask(width) & ~mask(digitBits);
    if ((z >> topIndex) & 1n) { x |= ext; z |= ext; } else if ((x >> topIndex) & 1n) x |= ext;
  }
  return new Value(width, v, x, z, signed);
}
