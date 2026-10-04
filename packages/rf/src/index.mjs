// RF engineering: Touchstone parsing, S-parameter conversion, reflection, matching networks,
// transmission lines, microstrip, link budgets and antenna arrays.
const MAX_POINTS = 100_000;
const UNIT_SCALE = Object.freeze({ hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9 });
const EPSILON = 1e-12;

const add = (a, b) => ({ real: a.real + b.real, imaginary: a.imaginary + b.imaginary });
const sub = (a, b) => ({ real: a.real - b.real, imaginary: a.imaginary - b.imaginary });
const mul = (a, b) => ({ real: a.real * b.real - a.imaginary * b.imaginary, imaginary: a.real * b.imaginary + a.imaginary * b.real });
const scale = (a, value) => ({ real: a.real * value, imaginary: a.imaginary * value });
const div = (a, b) => { const denominator = b.real * b.real + b.imaginary * b.imaginary; if (!Number.isFinite(denominator) || denominator <= EPSILON) throw new RangeError('RF matrix conversion encountered a singular denominator.'); return { real: (a.real * b.real + a.imaginary * b.imaginary) / denominator, imaginary: (a.imaginary * b.real - a.real * b.imaginary) / denominator }; };
const identity = () => [[{ real: 1, imaginary: 0 }, { real: 0, imaginary: 0 }], [{ real: 0, imaginary: 0 }, { real: 1, imaginary: 0 }]];
const matrixAdd = (a, b) => a.map((row, r) => row.map((value, c) => add(value, b[r][c])));
const matrixSub = (a, b) => a.map((row, r) => row.map((value, c) => sub(value, b[r][c])));
const matrixMul = (a, b) => a.map((row, r) => row.map((_value, c) => add(mul(a[r][0], b[0][c]), mul(a[r][1], b[1][c]))));
const matrixDet = (a) => sub(mul(a[0][0], a[1][1]), mul(a[0][1], a[1][0]));
const matrixInv = (a) => { const determinant = matrixDet(a); return [[div(a[1][1], determinant), scale(div(a[0][1], determinant), -1)], [scale(div(a[1][0], determinant), -1), div(a[0][0], determinant)]]; };
const matrixScale = (a, value) => a.map((row) => row.map((entry) => scale(entry, value)));
const matrixFromPoint = (point) => [[point.values[0], point.values[1]], [point.values[2], point.values[3]]];
const pointFromMatrix = (frequency, matrix) => Object.freeze({ frequency, values: Object.freeze(matrix.flat().map((value) => Object.freeze(value))) });
const validateTwoPort = (result, name = 'RF result') => { if (!result || result.kind !== 's-parameters' || result.ports !== 2 || !Array.isArray(result.points) || !result.points.length) throw new TypeError(`${name} must be a non-empty two-port S-parameter result.`); if (!Number.isFinite(result.referenceImpedance) || result.referenceImpedance <= 0) throw new TypeError('RF reference impedance is invalid.'); return result; };

function convertTwoPort(result, mode) {
  validateTwoPort(result);
  if (!['Z', 'Y', 'ABCD'].includes(mode)) throw new TypeError('RF conversion mode is unsupported.');
  const z0 = result.referenceImpedance;
  return Object.freeze({ kind: mode === 'ABCD' ? 'abcd-parameters' : `${mode.toLowerCase()}-parameters`, ports: 2, referenceImpedance: z0, points: Object.freeze(result.points.map((point) => {
    const s = matrixFromPoint(point); let matrix;
    if (mode === 'Z') matrix = matrixScale(matrixMul(matrixAdd(identity(), s), matrixInv(matrixSub(identity(), s))), z0);
    else if (mode === 'Y') matrix = matrixScale(matrixMul(matrixSub(identity(), s), matrixInv(matrixAdd(identity(), s))), 1 / z0);
    else {
      const [s11, s12, s21, s22] = point.values; const denominator = scale(s21, 2); matrix = [[div(add(mul(add({ real: 1, imaginary: 0 }, s11), sub({ real: 1, imaginary: 0 }, s22)), mul(s12, s21)), denominator), div(scale(sub(mul(add({ real: 1, imaginary: 0 }, s11), add({ real: 1, imaginary: 0 }, s22)), mul(s12, s21)), z0), denominator)], [div(scale(sub(mul(sub({ real: 1, imaginary: 0 }, s11), sub({ real: 1, imaginary: 0 }, s22)), mul(s12, s21)), 1 / z0), denominator), div(add(mul(sub({ real: 1, imaginary: 0 }, s11), add({ real: 1, imaginary: 0 }, s22)), mul(s12, s21)), denominator)]];
    }
    return pointFromMatrix(point.frequency, matrix);
  })) });
}

function complexPair(magnitude, angle, format) {
  if (format === 'RI') return { real: magnitude, imaginary: angle };
  if (format === 'MA') { const radians = angle * Math.PI / 180; return { real: magnitude * Math.cos(radians), imaginary: magnitude * Math.sin(radians) }; }
  const linear = 10 ** (magnitude / 20); const radians = angle * Math.PI / 180;
  return { real: linear * Math.cos(radians), imaginary: linear * Math.sin(radians) };
}

export function parseTouchstone(text, { ports = 2 } = {}) {
  if (typeof text !== 'string' || text.length > 20 * 1024 * 1024) throw new TypeError('Touchstone input is missing or exceeds the size limit.');
  if (!Number.isInteger(ports) || ports < 1 || ports > 32) throw new RangeError('Touchstone port count is outside the supported range.');
  let frequencyUnit = null; let format = null; let referenceImpedance = 50; const valuesPerPoint = 2 * ports * ports; const points = []; let pending = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/!.*/, '').trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const tokens = line.slice(1).trim().toUpperCase().split(/\s+/);
      frequencyUnit = tokens[0];
      if (!UNIT_SCALE[frequencyUnit.toLowerCase()]) throw new TypeError('Touchstone frequency unit is unsupported.');
      if (tokens[1] !== 'S') throw new TypeError('Only S-parameters are supported.');
      format = tokens[2];
      if (!['RI', 'MA', 'DB'].includes(format)) throw new TypeError('Touchstone data format is unsupported.');
      const rIndex = tokens.indexOf('R'); if (rIndex >= 0) referenceImpedance = Number(tokens[rIndex + 1]);
      if (!Number.isFinite(referenceImpedance) || referenceImpedance <= 0) throw new TypeError('Touchstone reference impedance is invalid.');
      continue;
    }
    pending.push(...line.split(/\s+/).map(Number));
    while (pending.length >= valuesPerPoint + 1) {
      const row = pending.splice(0, valuesPerPoint + 1); const frequency = row.shift();
      const scaledFrequency = frequency * UNIT_SCALE[frequencyUnit.toLowerCase()];
      if (!Number.isFinite(frequency) || (points.length && scaledFrequency <= points.at(-1).frequency)) throw new TypeError('Touchstone frequencies must be finite and strictly increasing.');
      const values = []; for (let i = 0; i < row.length; i += 2) { if (!Number.isFinite(row[i]) || !Number.isFinite(row[i + 1])) throw new TypeError('Touchstone data contains a non-finite value.'); values.push(complexPair(row[i], row[i + 1], format)); }
      points.push(Object.freeze({ frequency: scaledFrequency, values: Object.freeze(values) }));
      if (points.length > MAX_POINTS) throw new RangeError('Touchstone point count exceeds the limit.');
    }
  }
  if (!frequencyUnit || !format || pending.length || !points.length) throw new TypeError('Touchstone header or data is incomplete.');
  return Object.freeze({ kind: 's-parameters', ports, frequencyUnit: frequencyUnit.toLowerCase(), format, referenceImpedance, points: Object.freeze(points) });
}

export function convertSParameters(result, mode) {
  return convertTwoPort(result, mode);
}

export function cascadeAbcd(first, second) {
  if (!first || first.kind !== 'abcd-parameters' || !second || second.kind !== 'abcd-parameters' || first.points.length !== second.points.length || first.points.some((point, index) => point.frequency !== second.points[index].frequency)) throw new TypeError('ABCD cascades require matching frequency points.');
  return Object.freeze({ kind: 'abcd-parameters', ports: 2, referenceImpedance: first.referenceImpedance, points: Object.freeze(first.points.map((point, index) => pointFromMatrix(point.frequency, matrixMul(matrixFromPoint(point), matrixFromPoint(second.points[index]))))) });
}

export function reflectionCoefficient(impedance, referenceImpedance = 50) {
  if (!impedance || !Number.isFinite(impedance.real) || !Number.isFinite(impedance.imaginary) || !Number.isFinite(referenceImpedance) || referenceImpedance <= 0) throw new TypeError('RF impedance and reference impedance are invalid.');
  return div(sub(impedance, { real: referenceImpedance, imaginary: 0 }), add(impedance, { real: referenceImpedance, imaginary: 0 }));
}

export * from './rf-tools.mjs';
