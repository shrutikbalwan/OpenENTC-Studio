// Input parsing for laboratory forms. Throws RangeError with a user-facing message on bad input.
import { parseEngineeringValue } from '../../packages/schematic/src/units.mjs';

export function engineeringInput(value, label) {
  try { const number = parseEngineeringValue(String(value)); if (!Number.isFinite(number)) throw new Error(); return number; }
  catch { throw new RangeError(`${label}: enter a number such as 100M, 2.4G or 4.7k.`); }
}

export const parseNumberList = (text, label) => String(text).split(/[\s,;]+/).filter(Boolean).map((token) => engineeringInput(token, label));
