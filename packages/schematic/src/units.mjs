const PREFIXES = Object.freeze({ p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 });
const PREFIX_ORDER = Object.freeze([['T', 1e12], ['G', 1e9], ['M', 1e6], ['k', 1e3], ['', 1], ['m', 1e-3], ['u', 1e-6], ['n', 1e-9], ['p', 1e-12]]);
const KNOWN_UNITS = new Set(['V', 'A', 'Ω', 'Ω', 'F', 'H', 's', 'Hz', 'W', 'Ohm']);

export function parseEngineeringValue(input, { unit = null } = {}) {
  if (typeof input === 'number') { if (!Number.isFinite(input)) throw new TypeError('Engineering value must be finite.'); return input; }
  if (typeof input !== 'string') throw new TypeError('Engineering value must be text or a number.');
  const match = input.trim().match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*([pnuµmkK MGT]?)(?:([A-Za-zΩΩ]+))?$/);
  if (!match) throw new TypeError('Engineering value has an invalid format.');
  const prefix = match[2].replace(' ', ''); const suffix = match[3] || '';
  if (!(prefix in PREFIXES)) throw new TypeError('Engineering prefix is unsupported.');
  if (suffix && !KNOWN_UNITS.has(suffix)) throw new TypeError('Engineering unit is unsupported.');
  if (unit && suffix && suffix !== unit) throw new TypeError(`Expected unit ${unit}.`);
  const value = Number(match[1]) * PREFIXES[prefix];
  if (!Number.isFinite(value)) throw new TypeError('Engineering value must be finite.');
  return value;
}

export function formatEngineeringValue(value, unit = '', { digits = 4 } = {}) {
  if (!Number.isFinite(value)) throw new TypeError('Engineering value must be finite.');
  if (value === 0) return `0 ${unit}`.trim();
  const absolute = Math.abs(value); const selected = PREFIX_ORDER.find(([, scale]) => absolute >= scale && absolute < scale * 1000) || PREFIX_ORDER.at(-1);
  const rendered = (value / selected[1]).toPrecision(Math.max(1, digits)).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return `${rendered} ${selected[0]}${unit}`.trim();
}
