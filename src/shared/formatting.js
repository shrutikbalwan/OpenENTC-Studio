// Number and engineering-unit formatting shared by every workspace. Pure functions, no DOM.
import { C } from '../../packages/network/src/index.mjs';
import { formatEngineeringValue } from '../../packages/schematic/src/units.mjs';

export const fmt = (value, digits = 3) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
export const eng = (value, unit = '') => formatEngineeringValue(Math.abs(value) < 1e-15 ? 0 : value, unit, { digits: 4 }).trim();
export const decibels = (value) => `${fmt(Math.abs(value) < 0.005 ? 0 : value, 2)} dB`;
export const ohms = (value) => (Number.isFinite(value) ? eng(value, 'Ω') : '∞');
export const complexText = (value) => (Math.abs(value.im) < 1e-12 ? fmt(value.re, 4) : `${fmt(value.re, 4)} ${value.im < 0 ? '−' : '+'} j${fmt(Math.abs(value.im), 4)}`);
export const numericText = (value) => String(Number(Number(value).toPrecision(6)));
export const lines = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
export const rect = (value, unit) => (Math.abs(value[1]) < 1e-12 * Math.max(1, C.abs(value)) ? eng(value[0], unit) : `${eng(value[0], unit)} ${value[1] >= 0 ? '+' : '−'} j${eng(Math.abs(value[1]), unit)}`);

export const binary = (value, bits) => value.toString(2).padStart(bits, '0');

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
export const finiteEng = (value, unit = '') => (Number.isFinite(value) ? eng(value, unit) : '∞');
export const hex2 = (value) => value.toString(16).toUpperCase().padStart(2, '0');
export const phasor = (value, unit) => {
  const magnitude = C.abs(value), angle = C.arg(value);
  if (magnitude < 1e-15) return `0 ${unit}`;
  return Math.abs(value[1]) < 1e-12 * Math.max(1, magnitude) ? eng(value[0], unit) : `${eng(magnitude, unit)} ∠ ${fmt(angle, 2)}°`;
};
/** "s − p" written with natural signs, e.g. s + 1 − j3. */
export const shifted = (variable, p) => `${variable}${Math.abs(p.re) > 1e-12 ? ` ${p.re > 0 ? '−' : '+'} ${fmt(Math.abs(p.re), 4)}` : ''}${Math.abs(p.im) > 1e-12 ? ` ${p.im > 0 ? '−' : '+'} j${fmt(Math.abs(p.im), 4)}` : ''}`;
