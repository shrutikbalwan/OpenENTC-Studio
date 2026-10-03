// Analog modulation lab: AM, DSB-SC, FM and PM with demodulation and spectra.
import { amplitudeSpectrum, analyticSignal, besselJ, boundedNumber } from './math.mjs';

export const ANALOG_SCHEMES = Object.freeze(['am', 'dsb-sc', 'fm', 'pm']);
const SAMPLES = 8192;
const PLOT_POINTS = 1200;

/**
 * Modulate a single-tone message and demodulate it again.
 * index: AM modulation index μ, PM phase deviation (rad); deviation: FM peak deviation (Hz).
 */
export function simulateAnalogModulation({ scheme = 'am', carrierFrequency = 10_000, messageFrequency = 1_000, index = 0.5, deviation = 2_500, carrierAmplitude = 1 } = {}) {
  if (!ANALOG_SCHEMES.includes(scheme)) throw new RangeError(`Scheme must be one of ${ANALOG_SCHEMES.join(', ')}.`);
  const fc = boundedNumber(carrierFrequency, 10, 1e9, 'Carrier frequency');
  const fm = boundedNumber(messageFrequency, 1, fc / 2, 'Message frequency (at most half the carrier)');
  const ac = boundedNumber(carrierAmplitude, 1e-6, 1e6, 'Carrier amplitude');
  const mu = boundedNumber(index, 0, 20, 'Modulation index');
  const df = scheme === 'fm' ? boundedNumber(deviation, 0, 1e9, 'Frequency deviation') : 0;
  // 32 samples per carrier cycle; the record is an integer number of carrier periods.
  const samplesPerCycle = 32;
  const fs = fc * samplesPerCycle;
  const t = Array.from({ length: SAMPLES }, (_, n) => n / fs);
  const wc = 2 * Math.PI * fc, wm = 2 * Math.PI * fm;
  const message = t.map((time) => Math.cos(wm * time));
  const beta = scheme === 'fm' ? df / fm : scheme === 'pm' ? mu : 0;
  const modulated = t.map((time, n) => {
    if (scheme === 'am') return ac * (1 + mu * message[n]) * Math.cos(wc * time);
    if (scheme === 'dsb-sc') return ac * message[n] * Math.cos(wc * time);
    if (scheme === 'fm') return ac * Math.cos(wc * time + beta * Math.sin(wm * time));
    return ac * Math.cos(wc * time + mu * message[n]);
  });
  // Ideal receivers built on the analytic signal z = s + jH{s}: the complex envelope
  // b = z·e^(−jωc·t) gives the envelope |b|, coherent output Re(b) and phase arg(b).
  const analytic = analyticSignal(modulated);
  const inPhase = analytic.re.map((value, n) => value * Math.cos(wc * t[n]) + analytic.im[n] * Math.sin(wc * t[n]));
  const quadrature = analytic.re.map((value, n) => analytic.im[n] * Math.cos(wc * t[n]) - value * Math.sin(wc * t[n]));
  let demodulated;
  if (scheme === 'am') demodulated = inPhase.map((value, n) => Math.hypot(value, quadrature[n]));
  else if (scheme === 'dsb-sc') demodulated = inPhase;
  else {
    const phase = []; let offset = 0;
    inPhase.forEach((value, n) => { let angle = Math.atan2(quadrature[n], value) + offset; if (n && angle - phase[n - 1] > Math.PI) { offset -= 2 * Math.PI; angle -= 2 * Math.PI; } else if (n && angle - phase[n - 1] < -Math.PI) { offset += 2 * Math.PI; angle += 2 * Math.PI; } phase.push(angle); });
    // FM discriminator: instantaneous frequency deviation from the central-difference phase slope.
    demodulated = scheme === 'pm' ? phase : phase.map((value, n) => (phase[Math.min(n + 1, phase.length - 1)] - phase[Math.max(n - 1, 0)]) * fs / (2 * Math.PI * (Math.min(n + 1, phase.length - 1) - Math.max(n - 1, 0))));
  }
  const spectrum = amplitudeSpectrum(modulated, fs);
  // Skip the record edges, where the FFT-based Hilbert transform rings.
  const settle = SAMPLES / 8;
  const view = Math.min(SAMPLES - settle, Math.round(3 * fs / fm));
  const stride = Math.max(1, Math.ceil(view / PLOT_POINTS));
  const pick = (values) => values.slice(settle, settle + view).filter((_, n) => n % stride === 0);
  const carrierPower = ac * ac / 2;
  const sidebandCount = Math.ceil(beta) + 2;
  const metrics = scheme === 'am'
    ? { carrierPower, sidebandPower: carrierPower * mu * mu / 2, efficiency: mu * mu / (2 + mu * mu), bandwidth: 2 * fm, sidebands: [fc - fm, fc + fm] }
    : scheme === 'dsb-sc'
      ? { carrierPower: 0, sidebandPower: ac * ac / 4, efficiency: 1, bandwidth: 2 * fm, sidebands: [fc - fm, fc + fm] }
      : { beta, peakDeviation: beta * fm, carsonBandwidth: 2 * (beta * fm + fm), bessel: Array.from({ length: sidebandCount }, (_, order) => ({ order, frequency: fc + order * fm, amplitude: Math.abs(ac * besselJ(order, beta)) })) };
  const warnings = [];
  if (scheme === 'am' && mu > 1) warnings.push(`Over-modulation (μ = ${mu}): the envelope crosses zero, so an envelope detector distorts the message.`);
  if ((scheme === 'fm' || scheme === 'pm') && (beta + 1) * fm * 2 > fc) warnings.push('The FM/PM bandwidth reaches 0 Hz; raise the carrier frequency so the spectrum does not fold.');
  return {
    kind: 'analog-modulation', scheme, carrierFrequency: fc, messageFrequency: fm, sampleRate: fs,
    time: pick(t).map((value) => value - t[settle]), message: pick(message), modulated: pick(modulated), demodulated: pick(demodulated),
    spectrum, metrics, warnings,
  };
}
