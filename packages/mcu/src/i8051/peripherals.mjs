// Trainer-board peripherals wired to 8051 port pins: LEDs, DIP switches, push buttons,
// a seven-segment display, a 4×4 keypad and an HD44780 16×2 character LCD.

const pinBit = (pin) => { const match = /^P([0-3])\.([0-7])$/.exec(String(pin).toUpperCase()); if (!match) throw new RangeError(`Pin must look like P2.0, not "${pin}".`); return { port: Number(match[1]), bit: Number(match[2]) }; };

/** HD44780 controller (8- or 4-bit bus, write-only timing; busy flag always clear). */
export class Hd44780 {
  constructor() { this.reset(); }
  reset() {
    this.ddram = new Uint8Array(0x80).fill(0x20);
    this.cgram = new Uint8Array(64);
    this.address = 0; this.cgramMode = false; this.increment = true; this.shiftDisplay = false;
    this.displayOn = false; this.cursorOn = false; this.blinkOn = false;
    this.eightBit = true; this.twoLines = false; this.offset = 0;
    this.nibble = null; this.lastEnable = 0; this.writes = 0;
  }
  move(step) {
    if (this.cgramMode) { this.address = (this.address + step) & 0x3f; return; }
    let next = this.address + step;
    if (this.twoLines) {
      if (this.address <= 0x27 && next > 0x27) next = 0x40; else if (this.address >= 0x40 && next > 0x67) next = 0x00;
      else if (this.address === 0x40 && step < 0) next = 0x27; else if (this.address === 0x00 && step < 0) next = 0x67;
    } else next = ((next % 0x50) + 0x50) % 0x50;
    this.address = next;
  }
  command(value) {
    if (value & 0x80) { this.cgramMode = false; this.address = value & 0x7f; }
    else if (value & 0x40) { this.cgramMode = true; this.address = value & 0x3f; }
    else if (value & 0x20) { this.eightBit = Boolean(value & 0x10); this.twoLines = Boolean(value & 0x08); }
    else if (value & 0x10) {
      const right = value & 0x04;
      if (value & 0x08) this.offset += right ? -1 : 1; else this.move(right ? 1 : -1);
    } else if (value & 0x08) { this.displayOn = Boolean(value & 0x04); this.cursorOn = Boolean(value & 0x02); this.blinkOn = Boolean(value & 0x01); }
    else if (value & 0x04) { this.increment = Boolean(value & 0x02); this.shiftDisplay = Boolean(value & 0x01); }
    else if (value & 0x02) { this.address = 0; this.offset = 0; this.cgramMode = false; }
    else if (value & 0x01) { this.ddram.fill(0x20); this.address = 0; this.offset = 0; this.increment = true; this.cgramMode = false; }
  }
  data(value) {
    if (this.cgramMode) this.cgram[this.address] = value & 0x1f; else this.ddram[this.address] = value;
    this.writes += 1;
    this.move(this.increment ? 1 : -1);
    if (this.shiftDisplay && !this.cgramMode) this.offset += this.increment ? 1 : -1;
  }
  /** Latch on the falling edge of E. `bus` is the 8-bit data port value. */
  clock(rs, rw, enable, bus) {
    const falling = this.lastEnable && !enable;
    this.lastEnable = enable;
    if (!falling || rw) return;
    let value = bus;
    if (!this.eightBit) {
      if (this.nibble === null) { this.nibble = bus & 0xf0; return; }
      value = this.nibble | (bus >> 4); this.nibble = null;
    }
    if (rs) this.data(value); else this.command(value);
  }
  /** Status read value (busy flag 0 + address counter) driven on the bus while RW = 1, E = 1. */
  status() { return this.address & 0x7f; }
  lines(columns = 16) {
    const rows = this.twoLines ? [0x00, 0x40] : [0x00];
    return rows.map((base) => Array.from({ length: columns }, (_, k) => {
      const span = this.twoLines ? 0x28 : 0x50;
      const index = (((k + this.offset) % span) + span) % span;
      const code = this.ddram[base + index];
      return code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : code < 8 ? '▒' : '·';
    }).join(''));
  }
}

export const DEFAULT_WIRING = Object.freeze({
  leds: { enabled: true, port: 1, activeLow: false },
  switches: { enabled: true, port: 0 },
  buttons: { enabled: true, pins: ['P3.2', 'P3.3'] },
  sevenSegment: { enabled: true, port: 2, commonAnode: false },
  lcd: { enabled: false, dataPort: 1, rs: 'P2.0', rw: 'P2.1', enable: 'P2.2' },
  keypad: { enabled: false, port: 1 },
});

const SEGMENT_DIGITS = { 0x3f: '0', 0x06: '1', 0x5b: '2', 0x4f: '3', 0x66: '4', 0x6d: '5', 0x7d: '6', 0x07: '7', 0x7f: '8', 0x6f: '9', 0x77: 'A', 0x7c: 'b', 0x39: 'C', 0x5e: 'd', 0x79: 'E', 0x71: 'F' };

/** Connect a board to a CPU: inputs are driven onto port pins and outputs are decoded. */
export class TrainerBoard {
  constructor(cpu, wiring = DEFAULT_WIRING) {
    this.cpu = cpu;
    this.wiring = structuredClone(wiring);
    this.lcd = new Hd44780();
    this.switches = 0xff; // DIP switches: 1 = open (pin pulled high)
    this.buttons = this.wiring.buttons.pins.map(() => false);
    this.keys = new Set(); // pressed keypad keys as "row,col"
    cpu.onPortChange(() => this.update());
    this.update();
  }
  setSwitches(value) { this.switches = value & 0xff; this.update(); }
  setButton(index, pressed) { this.buttons[index] = pressed; this.update(); }
  setKey(row, column, pressed) { const key = `${row},${column}`; if (pressed) this.keys.add(key); else this.keys.delete(key); this.update(); }

  /** Recompute everything external circuits drive onto the pins. */
  update() {
    const drive = [0xff, 0xff, 0xff, 0xff];
    const { switches, buttons, keypad, lcd } = this.wiring;
    if (switches.enabled) drive[switches.port] &= this.switches;
    if (buttons.enabled) buttons.pins.forEach((pin, index) => { if (this.buttons[index]) { const { port, bit } = pinBit(pin); drive[port] &= ~(1 << bit); } });
    if (keypad.enabled && this.keys.size) {
      // Rows on bits 0–3 (driven by the program), columns on bits 4–7 (inputs with pull-ups).
      const latch = this.cpu.sfr[[0x80, 0x90, 0xa0, 0xb0][keypad.port] - 0x80];
      for (const key of this.keys) { const [row, column] = key.split(',').map(Number); if (!((latch >> row) & 1)) drive[keypad.port] &= ~(1 << (4 + column)); }
    }
    if (lcd.enabled) {
      const rs = pinBit(lcd.rs), rw = pinBit(lcd.rw), en = pinBit(lcd.enable);
      const latches = [0x80, 0x90, 0xa0, 0xb0].map((address) => this.cpu.sfr[address - 0x80]);
      const level = (pin) => (latches[pin.port] >> pin.bit) & 1;
      this.lcd.clock(level(rs), level(rw), level(en), latches[lcd.dataPort]);
      if (level(rw) && level(en)) drive[lcd.dataPort] &= this.lcd.status();
    }
    for (let port = 0; port < 4; port += 1) this.cpu.setExternal(port, drive[port]);
  }

  /** What the board shows: LED states, seven-segment pattern and digit, LCD text. */
  view() {
    const pins = this.cpu.portPins();
    const { leds, sevenSegment, lcd } = this.wiring;
    const ledLevels = leds.enabled ? Array.from({ length: 8 }, (_, bit) => Boolean(((pins[leds.port] >> bit) & 1) ^ (leds.activeLow ? 1 : 0))) : [];
    let segments = null, digit = null;
    if (sevenSegment.enabled) { segments = sevenSegment.commonAnode ? ~pins[sevenSegment.port] & 0xff : pins[sevenSegment.port]; digit = SEGMENT_DIGITS[segments & 0x7f] ?? (segments & 0x7f ? '?' : ' '); }
    return { leds: ledLevels, segments, digit, decimalPoint: segments !== null && Boolean(segments & 0x80), lcd: lcd.enabled ? { lines: this.lcd.lines(), on: this.lcd.displayOn, writes: this.lcd.writes } : null, pins };
  }
}

// ---------------------------------------------------------------------------
// Intel HEX.

/** Parse Intel HEX (records 00, 01, 02, 04) into a 64 KB image; returns { image, size, origin }. */
export function parseIntelHex(text) {
  const image = new Uint8Array(0x10000).fill(0xff);
  let base = 0, used = 0, low = Infinity, high = 0, ended = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    if (!/^:[0-9A-Fa-f]+$/.test(line) || line.length < 11 || line.length % 2 === 0) throw new SyntaxError(`HEX line ${index + 1} is malformed.`);
    const bytes = line.slice(1).match(/../g).map((pair) => parseInt(pair, 16));
    const sum = bytes.reduce((total, byte) => total + byte, 0) & 0xff;
    if (sum !== 0) throw new SyntaxError(`HEX line ${index + 1} has a bad checksum.`);
    const [count, hi, lo, type] = bytes;
    if (bytes.length !== count + 5) throw new SyntaxError(`HEX line ${index + 1} has the wrong length.`);
    const data = bytes.slice(4, 4 + count);
    if (type === 0) {
      for (let k = 0; k < count; k += 1) {
        const address = base + ((hi << 8) | lo) + k;
        if (address > 0xffff) throw new RangeError('HEX data lies above 64 KB.');
        image[address] = data[k]; used += 1; low = Math.min(low, address); high = Math.max(high, address);
      }
    } else if (type === 1) ended = true;
    else if (type === 2) base = ((data[0] << 8) | data[1]) << 4;
    else if (type === 4) base = ((data[0] << 8) | data[1]) << 16;
  });
  if (!used) throw new SyntaxError('The HEX file contains no data.');
  return { image, size: high + 1, origin: low, bytes: used, ended };
}

/** Intel HEX text for a byte map or image range. */
export function toIntelHex(bytes) {
  const entries = bytes instanceof Map ? [...bytes].sort((a, b) => a[0] - b[0]) : [...bytes].map((value, address) => [address, value]);
  const lines = [];
  let k = 0;
  while (k < entries.length) {
    const start = entries[k][0];
    const run = [];
    while (k < entries.length && run.length < 16 && entries[k][0] === start + run.length) run.push(entries[k++][1]);
    const record = [run.length, start >> 8, start & 0xff, 0, ...run];
    const sum = (0x100 - (record.reduce((total, byte) => total + byte, 0) & 0xff)) & 0xff;
    lines.push(`:${[...record, sum].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
  }
  lines.push(':00000001FF');
  return `${lines.join('\n')}\n`;
}
