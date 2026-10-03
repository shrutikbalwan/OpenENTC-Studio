// Number systems and binary codes for the Digital Logic Lab.

export const MAX_CODE_BITS = 32;
const BASES = Object.freeze({ binary: 2, octal: 8, decimal: 10, hex: 16 });

/** Parse an unsigned value written in binary, octal, decimal or hexadecimal. */
export function parseNumber(text, base = 'decimal') {
  if (!Object.hasOwn(BASES, base)) throw new RangeError(`Base must be one of ${Object.keys(BASES).join(', ')}.`);
  const clean = String(text).trim().replace(/[_\s]/g, '').replace(/^0[bBoOxX]/, '');
  const digits = { binary: /^[01]+$/, octal: /^[0-7]+$/, decimal: /^\d+$/, hex: /^[0-9a-fA-F]+$/ }[base];
  if (!digits.test(clean)) throw new SyntaxError(`"${text}" is not a valid ${base} number.`);
  const value = BigInt(base === 'decimal' ? clean : `0${{ binary: 'b', octal: 'o', hex: 'x' }[base]}${clean}`);
  if (value >= 2n ** BigInt(MAX_CODE_BITS)) throw new RangeError(`Values are limited to ${MAX_CODE_BITS} bits.`);
  return Number(value);
}

const binary = (value, bits) => value.toString(2).padStart(bits, '0');
const group = (text, size = 4) => text.replace(new RegExp(`\\B(?=(.{${size}})+$)`, 'g'), ' ');

export const toGray = (value) => value ^ (value >>> 1);
export function fromGray(gray) { let value = gray; for (let shift = gray >>> 1; shift; shift >>>= 1) value ^= shift; return value >>> 0; }

/** Decimal digits as 4-bit groups using a per-digit weight table (8421 BCD or excess-3). */
const decimalCode = (value, offset) => String(value).split('').map((digit) => binary(Number(digit) + offset, 4)).join(' ');

/** All representations of an unsigned value in a `bits`-wide register. */
export function convertNumber(value, bits = 8) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError('Value must be a non-negative integer.');
  if (!Number.isInteger(bits) || bits < 1 || bits > MAX_CODE_BITS) throw new RangeError(`Width must be 1 to ${MAX_CODE_BITS} bits.`);
  if (value >= 2 ** bits) throw new RangeError(`${value} needs more than ${bits} bits.`);
  const signed = value >= 2 ** (bits - 1) ? value - 2 ** bits : value;
  return {
    decimal: String(value),
    binary: group(binary(value, bits)),
    octal: value.toString(8),
    hex: value.toString(16).toUpperCase(),
    signedDecimal: String(signed),
    onesComplement: group(binary((2 ** bits - 1) - value, bits)),
    twosComplementOfValue: group(binary((2 ** bits - value) % 2 ** bits, bits)),
    gray: group(binary(toGray(value), bits)),
    bcd: decimalCode(value, 0),
    excess3: decimalCode(value, 3),
    onesCount: binary(value, bits).split('').filter((bit) => bit === '1').length,
    evenParityBit: binary(value, bits).split('').filter((bit) => bit === '1').length % 2,
  };
}
