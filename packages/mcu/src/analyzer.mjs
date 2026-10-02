// Logic analyser: digital channels as transition lists, protocol decoders (UART, SPI, I²C),
// VCD import/export and a capture helper. A channel is { name, initial, edges: [{ t, v }] }
// with times in seconds, sorted, and each edge a change of level.

export function createChannel(name, initial = 1) { return { name, initial: initial ? 1 : 0, edges: [] }; }

/** Append a level at time t (ignored if it does not change the level). */
export function record(channel, t, level) {
  const value = level ? 1 : 0;
  const last = channel.edges.length ? channel.edges[channel.edges.length - 1].v : channel.initial;
  if (value === last) return;
  if (channel.edges.length && t < channel.edges[channel.edges.length - 1].t) throw new RangeError(`Channel ${channel.name}: time went backwards.`);
  channel.edges.push({ t, v: value });
}

/** Level of a channel at time t (binary search). */
export function levelAt(channel, t) {
  const edges = channel.edges;
  let low = 0, high = edges.length - 1, result = channel.initial;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (edges[mid].t <= t) { result = edges[mid].v; low = mid + 1; } else high = mid - 1;
  }
  return result;
}

/** A copy of the channel limited to [from, to], keeping the level at `from` as the initial level. */
export function sliceChannel(channel, from, to) {
  const edges = channel.edges;
  let low = 0, high = edges.length;
  while (low < high) { const mid = (low + high) >> 1; if (edges[mid].t < from) low = mid + 1; else high = mid; }
  let end = low;
  while (end < edges.length && edges[end].t <= to) end += 1;
  return { name: channel.name, initial: levelAt(channel, from), edges: edges.slice(low, end) };
}

/** Estimate the baud rate from the narrowest pulse and snap it to a standard rate. */
export function estimateBaud(channel) {
  let narrowest = Infinity;
  for (let k = 1; k < channel.edges.length; k += 1) narrowest = Math.min(narrowest, channel.edges[k].t - channel.edges[k - 1].t);
  if (!Number.isFinite(narrowest) || narrowest <= 0) return null;
  const raw = 1 / narrowest;
  const standard = [300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 31250, 38400, 57600, 76800, 115200, 230400, 250000, 460800, 500000, 921600, 1000000, 2000000];
  const nearest = standard.reduce((best, rate) => (Math.abs(Math.log(rate / raw)) < Math.abs(Math.log(best / raw)) ? rate : best));
  return Math.abs(Math.log(nearest / raw)) < 0.06 ? nearest : Math.round(raw);
}

/**
 * Asynchronous serial decoder. Idle-high (or inverted) line; samples each bit at its centre.
 * Returns frames { start, end, value, parityOk, framingError }.
 */
export function decodeUart(channel, { baud = 9600, dataBits = 8, parity = 'none', stopBits = 1, invert = false, lsbFirst = true } = {}) {
  if (!(baud > 0)) throw new RangeError('Baud rate must be positive.');
  if (![5, 6, 7, 8, 9].includes(dataBits)) throw new RangeError('Data bits must be 5–9.');
  if (!['none', 'even', 'odd'].includes(parity)) throw new RangeError('Parity must be none, even or odd.');
  const bit = 1 / baud;
  const level = (t) => levelAt(channel, t) ^ (invert ? 1 : 0);
  const frames = [];
  let cursor = -Infinity, index = 0;
  const edges = channel.edges;
  for (;;) {
    // Next falling edge (start bit) after the cursor; the index only moves forward.
    while (index < edges.length && (edges[index].t <= cursor || (edges[index].v ^ (invert ? 1 : 0)) !== 0)) index += 1;
    if (index >= edges.length) break;
    const start = edges[index].t;
    if (level(start + bit / 2) !== 0) { cursor = start; continue; } // glitch, not a start bit
    let value = 0;
    for (let k = 0; k < dataBits; k += 1) {
      const sample = level(start + (1.5 + k) * bit);
      value |= sample << (lsbFirst ? k : dataBits - 1 - k);
    }
    let position = 1 + dataBits;
    let parityOk = true;
    if (parity !== 'none') {
      const p = level(start + (position + 0.5) * bit);
      let ones = p;
      for (let v = value; v; v >>= 1) ones += v & 1;
      parityOk = parity === 'even' ? ones % 2 === 0 : ones % 2 === 1;
      position += 1;
    }
    let framingError = false;
    for (let st = 0; st < stopBits; st += 1) if (level(start + (position + st + 0.5) * bit) !== 1) framingError = true;
    const end = start + (position + stopBits) * bit;
    frames.push({ start, end, value, parityOk, framingError });
    cursor = start + (position + stopBits - 0.5) * bit;
  }
  return frames;
}

/**
 * SPI decoder. Samples MOSI/MISO on the sampling edge of SCK (mode 0/3: rising, 1/2: falling)
 * while CS is low (if a CS channel is given). Returns words { start, end, mosi, miso }.
 */
export function decodeSpi({ sck, mosi, miso = null, cs = null }, { mode = 0, bitOrder = 'msb', wordSize = 8, csActiveLow = true } = {}) {
  if (![0, 1, 2, 3].includes(mode)) throw new RangeError('SPI mode must be 0–3.');
  const cpol = mode >> 1, cpha = mode & 1;
  const sampleOnRising = cpol === cpha; // modes 0 and 3
  const words = [];
  let bits = 0, mosiWord = 0, misoWord = 0, wordStart = null;
  let previousCs = cs ? levelAt(cs, -Infinity) : 0;
  const events = [...sck.edges.map((edge) => ({ ...edge, kind: 'sck' })), ...(cs ? cs.edges.map((edge) => ({ ...edge, kind: 'cs' })) : [])].sort((a, b) => a.t - b.t || (a.kind === 'cs' ? -1 : 1));
  for (const event of events) {
    if (event.kind === 'cs') {
      const active = csActiveLow ? event.v === 0 : event.v === 1;
      if (!active) { bits = 0; mosiWord = 0; misoWord = 0; wordStart = null; }
      previousCs = event.v;
      continue;
    }
    if (cs && (csActiveLow ? previousCs !== 0 : previousCs !== 1)) continue;
    if ((event.v === 1) !== sampleOnRising) continue;
    if (wordStart === null) wordStart = event.t;
    const m = levelAt(mosi, event.t), s = miso ? levelAt(miso, event.t) : 0;
    if (bitOrder === 'msb') { mosiWord = (mosiWord << 1) | m; misoWord = (misoWord << 1) | s; }
    else { mosiWord |= m << bits; misoWord |= s << bits; }
    bits += 1;
    if (bits === wordSize) { words.push({ start: wordStart, end: event.t, mosi: mosiWord, miso: miso ? misoWord : null }); bits = 0; mosiWord = 0; misoWord = 0; wordStart = null; }
  }
  return words;
}

/**
 * I²C decoder: START/STOP conditions (SDA edge while SCL high), bits sampled on SCL rising,
 * 7-bit address + R/W, ACK/NACK. Returns events { type, t, ... } in order.
 */
export function decodeI2c({ scl, sda }) {
  const events = [];
  const merged = [...scl.edges.map((edge) => ({ ...edge, line: 'scl' })), ...sda.edges.map((edge) => ({ ...edge, line: 'sda' }))].sort((a, b) => a.t - b.t || (a.line === 'scl' ? 1 : -1));
  let inFrame = false, bits = [], expectAddress = false, byteStart = null;
  for (const edge of merged) {
    if (edge.line === 'sda') {
      if (levelAt(scl, edge.t) !== 1) continue;
      if (edge.v === 0) { events.push({ type: inFrame ? 'repeated-start' : 'start', t: edge.t }); inFrame = true; expectAddress = true; bits = []; byteStart = null; }
      else { events.push({ type: 'stop', t: edge.t }); inFrame = false; bits = []; }
      continue;
    }
    if (!inFrame || edge.v !== 1) continue; // sample on SCL rising
    if (byteStart === null) byteStart = edge.t;
    bits.push(levelAt(sda, edge.t));
    if (bits.length === 9) {
      const byte = bits.slice(0, 8).reduce((value, b) => (value << 1) | b, 0);
      const ack = bits[8] === 0;
      if (expectAddress) { events.push({ type: 'address', t: byteStart, end: edge.t, address: byte >> 1, read: Boolean(byte & 1), ack }); expectAddress = false; }
      else events.push({ type: 'data', t: byteStart, end: edge.t, value: byte, ack });
      bits = []; byteStart = null;
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// VCD import/export (1-bit wires).

/** Value Change Dump with a 1 ns (default) timescale; readable by GTKWave and sigrok. */
export function toVcd(channels, { timescaleNs = 1, module = 'openentc', endTime } = {}) {
  const ids = channels.map((_, index) => String.fromCharCode(33 + index));
  const lines = ['$date OpenENTC Studio $end', '$version OpenENTC logic analyser $end', `$timescale ${timescaleNs}ns $end`, `$scope module ${module} $end`];
  channels.forEach((channel, index) => lines.push(`$var wire 1 ${ids[index]} ${channel.name.replace(/\s+/g, '_')} $end`));
  lines.push('$upscope $end', '$enddefinitions $end', '#0', '$dumpvars', ...channels.map((channel, index) => `${channel.initial}${ids[index]}`), '$end');
  const events = channels.flatMap((channel, index) => channel.edges.map((edge) => ({ tick: Math.round(edge.t * 1e9 / timescaleNs), text: `${edge.v}${ids[index]}` })));
  events.sort((a, b) => a.tick - b.tick);
  let current = 0;
  for (const event of events) { if (event.tick !== current) { lines.push(`#${event.tick}`); current = event.tick; } lines.push(event.text); }
  // A closing timestamp lets viewers show the levels after the last change.
  const end = endTime !== undefined ? Math.round(endTime * 1e9 / timescaleNs) : current + Math.max(1, Math.round(current * 0.01));
  if (end > current) lines.push(`#${end}`);
  return `${lines.join('\n')}\n`;
}

const TIMESCALE = { s: 1, ms: 1e-3, us: 1e-6, ns: 1e-9, ps: 1e-12, fs: 1e-15 };

/** Parse 1-bit signals from a VCD file into channels. */
export function fromVcd(text) {
  const scale = text.match(/\$timescale\s+(\d+)\s*(s|ms|us|ns|ps|fs)\s+\$end/);
  const unit = scale ? Number(scale[1]) * TIMESCALE[scale[2]] : 1e-9;
  const vars = new Map();
  for (const match of text.matchAll(/\$var\s+\w+\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+\[[^\]]*\])?\s+\$end/g)) if (match[1] === '1') vars.set(match[2], createChannel(match[3], 0));
  const body = text.slice(text.indexOf('$enddefinitions'));
  let time = 0, initial = true;
  for (const token of body.split(/\s+/)) {
    if (!token || token.startsWith('$')) { if (token === '$end') initial = false; continue; }
    if (token[0] === '#') { time = Number(token.slice(1)) * unit; if (time > 0) initial = false; continue; }
    const channel = vars.get(token.slice(1));
    if (!channel || !/^[01xzXZ]$/.test(token[0])) continue;
    const value = token[0] === '1' ? 1 : 0;
    if (initial || (time === 0 && !channel.edges.length)) channel.initial = value; else record(channel, time, value);
  }
  return [...vars.values()];
}

// ---------------------------------------------------------------------------
// Waveform synthesis (used by the simulators and by tests).

/** Add the edges of one UART frame starting at `start` seconds. */
export function uartFrame(channel, start, value, { baud = 9600, dataBits = 8, parity = 'none', stopBits = 1 } = {}) {
  const bit = 1 / baud;
  let t = start;
  record(channel, t, 0); t += bit;
  let ones = 0;
  for (let k = 0; k < dataBits; k += 1) { const b = (value >> k) & 1; ones += b; record(channel, t, b); t += bit; }
  if (parity !== 'none') { record(channel, t, parity === 'even' ? ones % 2 : (ones + 1) % 2); t += bit; }
  record(channel, t, 1);
  return t + stopBits * bit;
}

/** Add an I²C transaction: START, address byte, data bytes (with ACK/NACK from `acks`), STOP. */
export function i2cTransaction({ scl, sda }, start, address, read, bytes, { period = 10e-6, acks = null } = {}) {
  const q = period / 4;
  let t = start;
  record(sda, t, 1); record(scl, t, 1); t += q;
  record(sda, t, 0); t += q; // START: SDA falls while SCL is high
  const sendBit = (b) => { record(scl, t, 0); t += q; record(sda, t, b); t += q; record(scl, t, 1); t += 2 * q; };
  const frame = [((address << 1) | (read ? 1 : 0)) & 0xff, ...bytes];
  frame.forEach((byte, index) => {
    for (let k = 7; k >= 0; k -= 1) sendBit((byte >> k) & 1);
    sendBit(acks ? (acks[index] ? 0 : 1) : 0);
  });
  record(scl, t, 0); t += q; record(sda, t, 0); t += q; record(scl, t, 1); t += q;
  record(sda, t, 1); t += q; // STOP: SDA rises while SCL is high
  return t;
}

/** Add one SPI byte (mode 0–3, MSB or LSB first) to SCK/MOSI/MISO channels. Returns end time. */
export function spiByte({ sck, mosi, miso }, start, value, misoValue = 0xff, { period = 1e-6, mode = 0, lsbFirst = false } = {}) {
  const cpol = mode >> 1, cpha = mode & 1;
  const half = period / 2;
  let t = start;
  const put = (index) => { record(mosi, t, (value >> index) & 1); if (miso) record(miso, t, (misoValue >> index) & 1); };
  for (let k = 0; k < 8; k += 1) {
    const index = lsbFirst ? k : 7 - k;
    // Data changes half a period before the sampling edge (leading edge for CPHA = 0, trailing for CPHA = 1).
    if (!cpha) { put(index); t += half; record(sck, t, 1 - cpol); t += half; record(sck, t, cpol); }
    else { record(sck, t, 1 - cpol); put(index); t += half; record(sck, t, cpol); t += half; }
  }
  return t;
}

/** Bounded multi-channel recorder: keeps at most `maxEdges` edges per channel (oldest dropped). */
export class Recorder {
  constructor(names, { maxEdges = 40_000, initial = 1 } = {}) {
    this.maxEdges = maxEdges;
    this.channels = new Map(names.map((name) => [name, createChannel(name, initial)]));
    this.end = 0;
  }
  set(name, t, level) {
    const channel = this.channels.get(name);
    if (!channel) return;
    const last = channel.edges.length ? channel.edges[channel.edges.length - 1] : null;
    if (last && t < last.t) t = last.t; // synthesized waveforms may be stamped slightly ahead
    record(channel, t, level);
    if (channel.edges.length > this.maxEdges) { const dropped = channel.edges.splice(0, channel.edges.length - this.maxEdges * 0.75); channel.initial = dropped[dropped.length - 1].v; }
    if (t > this.end) this.end = t;
  }
  list() { return [...this.channels.values()]; }
  clear() { for (const channel of this.channels.values()) { channel.initial = channel.edges.length ? channel.edges[channel.edges.length - 1].v : channel.initial; channel.edges = []; } }
}
