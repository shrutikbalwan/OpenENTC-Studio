import test from 'node:test';
import assert from 'node:assert/strict';
import { apertureAntenna, combineCn, dipolePattern, directionalCoupler, directivity, doppler, fmcw, friisLink, gOverT, halfPowerBeamwidth, lookAngles, magnetron, orbit, pulseRadar, radarRange, reflexKlystron, satelliteLink, twoCavityKlystron, vswrMeasurement } from '../packages/radarsat/src/index.mjs';

const rel = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance + 1e-12, `${label}: ${actual} vs ${expected}`);

test('radar range equation, pulse timing, Doppler, MTI and FMCW', () => {
  const r = radarRange({ pt: 1e6, gainDb: 40, frequency: 3e9, rcs: 1, bandwidth: 1e6, noiseFigureDb: 3, snrDb: 13 });
  rel(r.snrAt(r.rmax), 13, 1e-9, 'SNR at Rmax equals the threshold');
  rel(radarRange({ pt: 16e6, gainDb: 40, frequency: 3e9 }).rmax, 2 * r.rmax, 1e-12, 'R ∝ Pt^¼');
  rel(r.noisePowerDbm, -114 + 3 + 0.0, 0.002, 'kTB at 1 MHz = −114 dBm');
  const p = pulseRadar({ prf: 1000, pulseWidth: 1e-6, pt: 1e6 });
  rel(p.unambiguousRange, 149896.229, 1e-12, 'Runamb'); rel(p.rangeResolution, 149.896229, 1e-12, 'ΔR'); rel(p.averagePower, 1000, 1e-12, 'Pav');
  const d = doppler({ frequency: 10e9, velocity: 30, prf: 1000 });
  rel(d.fd, 2 * 30 * 10e9 / 299792458, 1e-12, 'fd'); rel(d.firstBlind, 0.0299792458 * 1000 / 2, 1e-12, 'blind speed');
  assert.ok(doppler({ velocity: d.firstBlind }).cancellerGain < 1e-9);
  rel(fmcw({ bandwidth: 150e6, sweepTime: 1e-3, beat: 50e3 }).range, 299792458 * 50e3 / (2 * 150e9), 1e-12, 'FMCW range');
  rel(fmcw({ bandwidth: 150e6 }).rangeResolution, 0.999308, 1e-5, 'FMCW resolution c/2B');
});

test('orbits and look angles', () => {
  const geo = orbit({ perigeeAltitude: 35786e3 });
  rel(geo.geostationaryRadius, 42164.17e3, 1e-6, 'GEO radius');
  rel(geo.period, 86164.09, 1e-5, 'GEO period = sidereal day');
  rel(geo.perigeeSpeed, 3074.7, 1e-3, 'GEO speed');
  rel(orbit({ perigeeAltitude: 500e3, apogeeAltitude: 39873e3 }).period / 3600, 11.97, 1e-3, 'Molniya ≈ 12 h');
  const overhead = lookAngles({ latitude: 0, longitude: 83, satelliteLongitude: 83 });
  rel(overhead.elevation, 90, 1e-9, 'zenith'); rel(overhead.slantRange, 35786.03e3, 1e-6, 'slant');
  const limit = lookAngles({ latitude: 0, longitude: 0, satelliteLongitude: (180 / Math.PI) * Math.acos(6378.137 / 42164.17) });
  assert.ok(Math.abs(limit.elevation) < 1e-3, `horizon elevation ${limit.elevation}`);
  // Pratt & Bostian style check: slant range from the cosine rule and elevation from tan El = (cosγ − Re/rs)/sinγ.
  const pune = lookAngles({ latitude: 18.52, longitude: 73.86, satelliteLongitude: 83 });
  const g = Math.acos(Math.cos(18.52 * Math.PI / 180) * Math.cos(9.14 * Math.PI / 180));
  rel(pune.centralAngle, g * 180 / Math.PI, 1e-9, 'γ');
  assert.ok(pune.azimuth > 90 && pune.azimuth < 180, 'satellite to the south-east from Pune');
  assert.ok(lookAngles({ latitude: 18.52, longitude: 73.86, satelliteLongitude: 55 }).azimuth > 180, 'south-west');
  assert.ok(lookAngles({ latitude: -33.9, longitude: 151.2, satelliteLongitude: 156 }).azimuth < 90, 'southern hemisphere looks north');
});

test('satellite link budget, combined C/N and G/T', () => {
  const link = satelliteLink({ eirpDbw: 50, frequency: 4e9, distance: 38000e3, gtDb: 20, otherLossDb: 1, bandwidth: 36e6 });
  rel(link.fspl, 196.08, 1e-4, 'FSPL at 4 GHz, 38 000 km');
  rel(link.cn0, 50 - link.fspl - 1 + 20 + 228.599, 1e-5, 'C/N0');
  rel(combineCn(20, 20), 16.9897, 1e-5, 'two equal links lose 3 dB');
  const gt = gOverT({ antennaGainDb: 45, antennaNoise: 30, feedLossDb: 0, lnaNoise: 50, lnaGainDb: 50, receiverNoise: 1000 });
  rel(gt.tsys, 30 + 50 + 0.01, 1e-9, 'Tsys'); rel(gt.gtDb, 45 - 10 * Math.log10(80.01), 1e-12, 'G/T');
});

test('antenna patterns and aperture formulas', () => {
  const half = dipolePattern(0.5, 1801);
  rel(directivity(half.field, half.angles), 1.6409, 1e-4, 'half-wave dipole D');
  rel(halfPowerBeamwidth(half.field, half.angles), 78.08, 1e-3, 'half-wave HPBW');
  const short = dipolePattern(0.01, 1801);
  rel(directivity(short.field, short.angles), 1.5, 1e-3, 'short dipole D');
  rel(halfPowerBeamwidth(short.field, short.angles), 90, 1e-3, 'short dipole HPBW');
  rel(directivity(...Object.values(dipolePattern(1, 1801)).reverse()), 2.41, 2e-3, 'full-wave dipole D');
  const ap = apertureAntenna({ frequency: 10e9, diameter: 1, efficiency: 0.55 });
  rel(ap.dishGainDb, 10 * Math.log10(0.55 * (Math.PI / 0.0299792458) ** 2), 1e-12, 'dish gain');
  rel(ap.effectiveArea(ap.dishGain), 0.55 * Math.PI * 0.25, 1e-12, 'Ae = η·physical area');
  rel(friisLink({ ptDbm: 20, gtDb: 10, grDb: 10, frequency: 2.4e9, distance: 1000 }).fspl, 100.05, 1e-4, 'FSPL 2.4 GHz 1 km');
});

test('microwave tubes and measurements (Liao examples)', () => {
  const m = magnetron({ v0: 26e3, b0: 0.336, cathodeRadius: 0.05, anodeRadius: 0.1 });
  rel(m.hullField, 0.0145, 0.005, 'Hull cut-off field');
  rel(magnetron({ v0: 26e3, b0: m.hullField, cathodeRadius: 0.05, anodeRadius: 0.1 }).hullVoltage, 26e3, 1e-12, 'Hull voltage and field are inverses');
  rel(m.hullVoltage, 1.396e7, 1e-3, 'Hull cut-off voltage at 0.336 T');
  rel(m.cyclotron, 1.602176634e-19 * 0.336 / 9.1093837015e-31 / (2 * Math.PI), 1e-12, 'cyclotron');
  const rk = reflexKlystron({ v0: 300, frequency: 9e9, spacing: 1e-3 });
  rel(rk.modes[1].efficiency, 0.2271, 2e-3, '1¾-mode efficiency 22.7 %');
  // The repeller voltage satisfies the transit-angle condition.
  const { repeller } = rk.modes[1];
  rel((300 + repeller) ** 2 / 300, 8 * (2 * Math.PI * 9e9) ** 2 * 1e-6 * 9.1093837015e-31 / ((2 * Math.PI * 2 - Math.PI / 2) ** 2 * 1.602176634e-19), 1e-9, 'Liao repeller relation');
  rel(twoCavityKlystron({ v0: 1000, v1: twoCavityKlystron({ v0: 1000 }).optimumV1 }).efficiency, 0.5819, 1e-3, 'max bunching efficiency');
  const dc = directionalCoupler({ p1: 1, p2: 0.89, p3: 0.01, p4: 1e-5 });
  assert.deepEqual([dc.coupling, dc.directivity, dc.isolation].map((v) => Number(v.toFixed(6))), [20, 30, 50]);
  const v = vswrMeasurement({ vmax: 3, vmin: 1 });
  rel(v.gamma, 0.5, 1e-12, 'Γ'); rel(v.returnLoss, 6.0206, 1e-4, 'RL');
  rel(vswrMeasurement({ guideWavelength: 0.04, minimumWidth: 0.001 }).doubleMinimum, Math.sqrt(1 + 1 / Math.sin(Math.PI * 0.025) ** 2), 1e-12, 'double minimum');
});
