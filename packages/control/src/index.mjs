function coefficients(values, name) {
  if ((!Array.isArray(values) && !ArrayBuffer.isView(values)) || !values.length || values.length > 128 || Array.from(values).some((value) => typeof value !== 'number' || !Number.isFinite(value))) throw new TypeError(`${name} coefficients are invalid.`);
  return Object.freeze(Array.from(values));
}

export function createTransferFunction(numerator, denominator, { inputUnits = '1', outputUnits = '1' } = {}) {
  const num = coefficients(numerator, 'Numerator'); const den = coefficients(denominator, 'Denominator');
  if (den[0] === 0) throw new TypeError('Denominator leading coefficient must be non-zero.');
  return Object.freeze({ kind: 'transfer-function', numerator: num, denominator: den, inputUnits, outputUnits });
}

function evaluatePolynomial(values, real, imaginary) {
  let outReal = 0; let outImaginary = 0;
  for (const coefficient of values) { const nextReal = outReal * real - outImaginary * imaginary + coefficient; outImaginary = outReal * imaginary + outImaginary * real; outReal = nextReal; }
  return { real: outReal, imaginary: outImaginary };
}

function divide(a, b) {
  const denominator = b.real ** 2 + b.imaginary ** 2;
  return { real: (a.real * b.real + a.imaginary * b.imaginary) / denominator, imaginary: (a.imaginary * b.real - a.real * b.imaginary) / denominator };
}

export function frequencyResponse(transferFunction, frequencies) {
  if (!transferFunction || transferFunction.kind !== 'transfer-function') throw new TypeError('A transfer function is required.');
  if ((!Array.isArray(frequencies) && !ArrayBuffer.isView(frequencies)) || frequencies.length > 100_000 || Array.from(frequencies).some((frequency) => !Number.isFinite(frequency) || frequency < 0)) throw new TypeError('Frequencies are invalid.');
  const points = Array.from(frequencies, (frequency) => {
    const numerator = evaluatePolynomial(transferFunction.numerator, 0, 2 * Math.PI * frequency);
    const denominator = evaluatePolynomial(transferFunction.denominator, 0, 2 * Math.PI * frequency);
    const value = divide(numerator, denominator);
    return Object.freeze({ frequency, real: value.real, imaginary: value.imaginary, magnitude: Math.hypot(value.real, value.imaginary), phase: Math.atan2(value.imaginary, value.real) });
  });
  return Object.freeze({ kind: 'bode', points: Object.freeze(points), inputUnits: transferFunction.inputUnits, outputUnits: transferFunction.outputUnits });
}

export function firstOrderStep({ gain = 1, tau, sampleRate, length }) {
  if (![gain, tau, sampleRate].every((value) => Number.isFinite(value)) || tau <= 0 || sampleRate <= 0 || !Number.isInteger(length) || length < 1 || length > 1_000_000) throw new TypeError('First-order step parameters are invalid.');
  return Object.freeze({ kind: 'time-series', data: Float64Array.from({ length }, (_, index) => gain * (1 - Math.exp(-index / sampleRate / tau))), sampleRate, units: '1' });
}

export function firstOrderStability(tau) {
  if (!Number.isFinite(tau) || tau === 0) throw new TypeError('Time constant must be finite and non-zero.');
  return Object.freeze({ stable: tau > 0, reason: tau > 0 ? 'pole is in the left half-plane' : 'pole is in the right half-plane' });
}

export * from './analysis.mjs';
