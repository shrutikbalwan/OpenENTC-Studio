// ATmega328P peripherals: GPIO ports, timers 0/1/2 (all waveform modes, PWM outputs),
// USART0, ADC, external and pin-change interrupts, EEPROM, SPI master and a TWI master
// that sees an empty bus (so I²C code reports "no device" instead of hanging).

const bit = (value, n) => (value >> n) & 1;

/** One GPIO port (PINx, DDRx, PORTx). External circuits drive pins with `drive`. */
export class GpioPort {
  constructor(name, pinAddress) {
    this.name = name; this.pin = pinAddress; this.ddr = pinAddress + 1; this.port = pinAddress + 2;
    this.drive = new Array(8).fill(null); // null = not driven externally
    this.listeners = [];
  }
  attach(cpu) {
    this.cpu = cpu;
    cpu.onRead(this.pin, () => this.levels());
    cpu.onWrite(this.pin, (value) => { cpu.data[this.port] ^= value; this.changed(); }); // writing PINx toggles PORTx
    cpu.onWrite(this.ddr, (value) => { cpu.data[this.ddr] = value; this.changed(); });
    cpu.onWrite(this.port, (value) => { cpu.data[this.port] = value; this.changed(); });
  }
  changed() { if (this.cpu) this.cpu.irqDirty = true; for (const listener of this.listeners) listener(this); }
  /** Pin levels as the CPU reads them: outputs, external drivers, then pull-ups. */
  levels() {
    const ddr = this.cpu.data[this.ddr], port = this.cpu.data[this.port];
    let value = 0;
    for (let n = 0; n < 8; n += 1) {
      const level = bit(ddr, n) ? bit(port, n) : this.drive[n] !== null ? this.drive[n] : bit(port, n);
      value |= level << n;
    }
    return value;
  }
  setDrive(n, level) { this.drive[n] = level; this.changed(); }
}

const PRESCALE_01 = [0, 1, 8, 64, 256, 1024, 0, 0];
const PRESCALE_2 = [0, 1, 8, 32, 64, 128, 256, 1024];

/** Timer/Counter 0, 1 or 2. */
export class Timer {
  constructor(spec) { Object.assign(this, spec); this.vectors = [spec.vectorCompA, spec.vectorCompB, spec.vectorOvf, spec.vectorCapt].filter(Boolean); }
  reset() { this.lastDivider = 0; this.phase = 0; this.counter = 0; this.down = false; this.ocrA = 0; this.ocrB = 0; this.icr = 0; this.bufferA = 0; this.bufferB = 0; this.temp = 0; this.elapsed = 0; }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    const D = cpu.data;
    const wide = this.bits === 16;
    if (!wide) {
      cpu.onRead(this.tcnt, () => this.counter);
      cpu.onWrite(this.tcnt, (value) => { this.counter = value; });
      cpu.onRead(this.ocra, () => this.bufferA); cpu.onWrite(this.ocra, (value) => { this.bufferA = value; if (!this.isPwm()) this.ocrA = value; });
      cpu.onRead(this.ocrb, () => this.bufferB); cpu.onWrite(this.ocrb, (value) => { this.bufferB = value; if (!this.isPwm()) this.ocrB = value; });
    } else {
      // 16-bit registers share a TEMP byte: write high first; read low first.
      const pair = (low, get, set) => {
        cpu.onRead(low, () => { const value = get(); this.temp = value >> 8; return value & 0xff; });
        cpu.onRead(low + 1, () => this.temp);
        cpu.onWrite(low + 1, (value) => { this.temp = value; });
        cpu.onWrite(low, (value) => set((this.temp << 8) | value));
      };
      pair(this.tcnt, () => this.counter, (value) => { this.counter = value; });
      pair(this.ocra, () => this.bufferA, (value) => { this.bufferA = value; if (!this.isPwm()) this.ocrA = value; });
      pair(this.ocrb, () => this.bufferB, (value) => { this.bufferB = value; if (!this.isPwm()) this.ocrB = value; });
      pair(this.icrAddress, () => this.icr, (value) => { this.icr = value; });
    }
    cpu.onWrite(this.tifr, (value) => { D[this.tifr] &= ~value; }); // write 1 to clear
  }
  get wgm() {
    const D = this.cpu.data;
    if (this.bits === 16) return (D[this.tccra] & 3) | ((D[this.tccrb] >> 1) & 0x0c);
    return (D[this.tccra] & 3) | ((D[this.tccrb] >> 1) & 4);
  }
  isPwm() { const w = this.wgm; return this.bits === 16 ? ![0, 4, 12].includes(w) : ![0, 2].includes(w); }
  /** { top, dual (phase correct), tovAt: 'max' | 'top' | 'bottom', updateAt: 'now' | 'bottom' | 'top' } */
  shape() {
    const w = this.wgm, max = this.bits === 16 ? 0xffff : 0xff;
    if (this.bits === 8) {
      switch (w) {
        case 1: return { top: 0xff, dual: true, tovAt: 'bottom', updateAt: 'top' };
        case 2: return { top: this.ocrA, dual: false, tovAt: 'max', updateAt: 'now' };
        case 3: return { top: 0xff, dual: false, tovAt: 'top', updateAt: 'bottom' };
        case 5: return { top: this.ocrA, dual: true, tovAt: 'bottom', updateAt: 'top' };
        case 7: return { top: this.ocrA, dual: false, tovAt: 'top', updateAt: 'bottom' };
        default: return { top: max, dual: false, tovAt: 'max', updateAt: 'now' };
      }
    }
    const tops = { 1: 0xff, 2: 0x1ff, 3: 0x3ff, 5: 0xff, 6: 0x1ff, 7: 0x3ff };
    if ([1, 2, 3].includes(w)) return { top: tops[w], dual: true, tovAt: 'bottom', updateAt: 'top' };
    if ([5, 6, 7].includes(w)) return { top: tops[w], dual: false, tovAt: 'top', updateAt: 'bottom' };
    if (w === 4) return { top: this.ocrA, dual: false, tovAt: 'max', updateAt: 'now' };
    if (w === 12) return { top: this.icr, dual: false, tovAt: 'max', updateAt: 'now' };
    if (w === 8 || w === 10) return { top: this.icr, dual: true, tovAt: 'bottom', updateAt: w === 8 ? 'bottom' : 'top' };
    if (w === 9 || w === 11) return { top: this.ocrA, dual: true, tovAt: 'bottom', updateAt: w === 9 ? 'bottom' : 'top' };
    if (w === 14) return { top: this.icr, dual: false, tovAt: 'top', updateAt: 'bottom' };
    if (w === 15) return { top: this.ocrA, dual: false, tovAt: 'top', updateAt: 'bottom' };
    return { top: max, dual: false, tovAt: 'max', updateAt: 'now' };
  }
  divider() { return (this.timer2 ? PRESCALE_2 : PRESCALE_01)[this.cpu.data[this.tccrb] & 7]; }
  tick(cycles) {
    const divider = (this.timer2 ? PRESCALE_2 : PRESCALE_01)[this.cpu.data[this.tccrb] & 7];
    if (!divider) return;
    // The prescaler runs freely with the CPU clock, so timer ticks fall on multiples of the divider.
    if (divider !== this.lastDivider) { this.lastDivider = divider; this.phase = (this.cpu.cycles - cycles) % divider; }
    this.phase += cycles;
    while (this.phase >= divider) { this.phase -= divider; this.clock(); }
  }
  clock() {
    const D = this.cpu.data;
    const max = this.bits === 16 ? 0xffff : 0xff;
    const { top, dual, tovAt, updateAt } = this.shape();
    let tov = false;
    const update = () => { this.ocrA = this.bufferA; this.ocrB = this.bufferB; };
    if (dual) {
      if (!this.down) { if (this.counter >= top) { this.down = true; this.counter = Math.max(0, top - 1); if (updateAt === 'top') update(); } else this.counter += 1; }
      else if (this.counter === 0) { this.down = false; this.counter = 1; tov = tovAt === 'bottom'; if (updateAt === 'bottom') update(); }
      else { this.counter -= 1; if (this.counter === 0) { tov = tovAt === 'bottom'; if (updateAt === 'bottom') update(); } }
    } else if (this.counter === top) {
      this.counter = 0;
      if (tovAt === 'top' || (tovAt === 'max' && top === max)) tov = true;
      if (updateAt === 'bottom') update();
    } else {
      const wrapped = this.counter === max;
      this.counter = (this.counter + 1) & max;
      if (wrapped && tovAt === 'max') tov = true;
    }
    const before = D[this.tifr];
    if (tov) D[this.tifr] |= 1;
    if (this.counter === this.ocrA) D[this.tifr] |= 2;
    if (this.counter === this.ocrB) D[this.tifr] |= 4;
    if (D[this.tifr] !== before) this.cpu.irqDirty = true;
  }
  pendingInterrupt() {
    const D = this.cpu.data;
    const due = D[this.tifr] & D[this.timsk];
    if (!due) return 0;
    if (due & 0x20 && this.vectorCapt) return this.vectorCapt;
    if (due & 2) return this.vectorCompA;
    if (due & 4) return this.vectorCompB;
    if (due & 1) return this.vectorOvf;
    return 0;
  }
  acknowledge(vector) {
    const D = this.cpu.data;
    if (vector === this.vectorCompA) D[this.tifr] &= ~2;
    else if (vector === this.vectorCompB) D[this.tifr] &= ~4;
    else if (vector === this.vectorOvf) D[this.tifr] &= ~1;
    else if (vector === this.vectorCapt) D[this.tifr] &= ~0x20;
  }
  /** PWM duty (0–1) on output A or B when the compare output is enabled, else null. */
  duty(channel) {
    const D = this.cpu.data;
    const com = (D[this.tccra] >> (channel === 'A' ? 6 : 4)) & 3;
    if (!com || !this.isPwm() || !this.divider()) return null;
    const { top, dual } = this.shape();
    const ocr = channel === 'A' ? this.ocrA : this.ocrB;
    if (channel === 'A' && [7, 15, 5, 9, 11].includes(this.wgm)) return com === 1 ? 0.5 : null; // OCRA is TOP: toggle mode only
    let duty = dual ? Math.min(1, ocr / (top || 1)) : Math.min(1, (ocr + 1) / (top + 1));
    if (!dual && ocr === 0 && com === 2) duty = 1 / (top + 1);
    return com === 3 ? 1 - duty : duty;
  }
}

/** USART0 in asynchronous mode. */
export class Usart {
  constructor() { this.vectors = [18, 19, 20]; this.output = []; this.input = []; }
  reset() {
    this.txShift = null; this.txBuffer = null; this.rx = null; this.rxData = 0;
    if (this.cpu) { this.cpu.data[0xc0] = 0x20; this.cpu.data[0xc2] = 0x06; } // UDRE set, 8-bit frames after reset
  }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    const D = cpu.data;
    cpu.onRead(0xc6, () => { D[0xc0] &= ~0x80; return this.rxData; });
    cpu.onWrite(0xc6, (value) => { if (!(D[0xc1] & 0x08)) return; if (this.txShift === null) this.txShift = { value, remaining: this.frameCycles() }; else this.txBuffer = value; D[0xc0] = this.txBuffer === null ? D[0xc0] | 0x20 : D[0xc0] & ~0x20; });
    cpu.onWrite(0xc0, (value) => { D[0xc0] = (D[0xc0] & ~0x03) | (value & 0x03); if (value & 0x40) D[0xc0] &= ~0x40; });
  }
  frameCycles() {
    const D = this.cpu.data;
    const ubrr = ((D[0xc5] & 0x0f) << 8) | D[0xc4];
    const perBit = (D[0xc0] & 0x02 ? 8 : 16) * (ubrr + 1);
    const c = D[0xc2];
    const dataBits = [5, 6, 7, 8][(c >> 1) & 3] + (D[0xc1] & 0x04 ? 1 : 0);
    const bits = 1 + dataBits + ((c >> 4) & 3 ? 1 : 0) + (c & 0x08 ? 2 : 1);
    return perBit * bits;
  }
  baud() { const D = this.cpu.data; const ubrr = ((D[0xc5] & 0x0f) << 8) | D[0xc4]; return this.cpu.clock / ((D[0xc0] & 0x02 ? 8 : 16) * (ubrr + 1)); }
  receive(bytes) { for (const byte of bytes) this.input.push(byte & 0xff); }
  tick(cycles) {
    const D = this.cpu.data;
    if (!this.txShift && !this.rx && !this.input.length) return;
    this.cpu.irqDirty = true;
    if (this.txShift) {
      this.txShift.remaining -= cycles;
      if (this.txShift.remaining <= 0) {
        this.output.push(this.txShift.value);
        if (this.txBuffer !== null) { this.txShift = { value: this.txBuffer, remaining: this.frameCycles() + this.txShift.remaining }; this.txBuffer = null; D[0xc0] |= 0x20; }
        else { this.txShift = null; D[0xc0] |= 0x40; }
      }
    }
    if (!this.rx && this.input.length && D[0xc1] & 0x10) this.rx = { value: this.input.shift(), remaining: this.frameCycles() };
    if (this.rx) {
      this.rx.remaining -= cycles;
      if (this.rx.remaining <= 0) {
        if (D[0xc0] & 0x80) D[0xc0] |= 0x08; // data overrun
        this.rxData = this.rx.value; D[0xc0] |= 0x80; this.rx = null;
      }
    }
  }
  pendingInterrupt() {
    const D = this.cpu.data, a = D[0xc0], b = D[0xc1];
    if (a & 0x80 && b & 0x80) return 18;
    if (a & 0x20 && b & 0x20) return 19;
    if (a & 0x40 && b & 0x40) return 20;
    return 0;
  }
  acknowledge(vector) { if (vector === 20) this.cpu.data[0xc0] &= ~0x40; }
}

/** 10-bit ADC with AVcc / internal 1.1 V / AREF references. */
export class Adc {
  constructor() { this.vectors = [21]; this.inputs = new Array(8).fill(0); this.aref = 5; this.vcc = 5; }
  reset() { this.converting = null; this.first = true; }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    const D = cpu.data;
    cpu.onWrite(0x7a, (value) => {
      const wasEnabled = D[0x7a] & 0x80;
      D[0x7a] = (value & ~0x10) | (D[0x7a] & 0x10 & ~(value & 0x10)); // writing 1 to ADIF clears it
      if (!(value & 0x80)) { this.converting = null; D[0x7a] &= ~0x40; return; }
      if (!wasEnabled) this.first = true;
      if (value & 0x40 && !this.converting) this.start();
    });
  }
  start() {
    const D = this.cpu.data;
    const prescale = [2, 2, 4, 8, 16, 32, 64, 128][D[0x7a] & 7];
    this.converting = { remaining: (this.first ? 25 : 13) * prescale };
    this.first = false;
  }
  sample() {
    const D = this.cpu.data;
    const mux = D[0x7c] & 0x0f, refs = D[0x7c] >> 6;
    const vref = refs === 3 ? 1.1 : refs === 1 ? this.vcc : this.aref;
    const vin = mux < 8 ? this.inputs[mux] : mux === 8 ? 0.314 : mux === 14 ? 1.1 : 0;
    return Math.max(0, Math.min(1023, Math.floor(vin * 1024 / vref)));
  }
  tick(cycles) {
    if (!this.converting) return;
    this.converting.remaining -= cycles;
    if (this.converting.remaining > 0) return;
    const D = this.cpu.data;
    const value = this.sample();
    if (D[0x7c] & 0x20) { D[0x79] = value >> 2; D[0x78] = (value & 3) << 6; } else { D[0x78] = value & 0xff; D[0x79] = value >> 8; }
    D[0x7a] = (D[0x7a] & ~0x40) | 0x10;
    this.cpu.irqDirty = true;
    this.converting = null;
    if (D[0x7a] & 0x20 && (D[0x7b] & 7) === 0) { D[0x7a] |= 0x40; this.start(); } // free running
  }
  pendingInterrupt() { const a = this.cpu.data[0x7a]; return a & 0x10 && a & 0x08 ? 21 : 0; }
  acknowledge() { this.cpu.data[0x7a] &= ~0x10; }
}

/** INT0/INT1 (PD2/PD3) and pin-change interrupts on ports B, C and D. */
export class ExternalInterrupts {
  constructor(ports) { this.ports = ports; this.vectors = [1, 2, 3, 4, 5]; }
  reset() { this.previous = null; }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    cpu.onWrite(0x3c, (value) => { cpu.data[0x3c] &= ~value; });
    cpu.onWrite(0x3b, (value) => { cpu.data[0x3b] &= ~value; });
  }
  tick() {
    const D = this.cpu.data;
    if (!(D[0x3d] & 3) && !(D[0x68] & 7)) { this.previous = null; return; } // nothing enabled: skip the pin scan
    const now = this.ports.map((port) => port.levels());
    if (this.previous) {
      const [b, c, d] = now, [pb, pc, pd] = this.previous;
      for (const [index, pin] of [[0, 2], [1, 3]]) {
        const mode = (D[0x69] >> (index * 2)) & 3, level = bit(d, pin), before = bit(pd, pin);
        if ((mode === 1 && level !== before) || (mode === 2 && before && !level) || (mode === 3 && !before && level)) D[0x3c] |= 1 << index;
      }
      [[b ^ pb, 0x6b, 0], [c ^ pc, 0x6c, 1], [d ^ pd, 0x6d, 2]].forEach(([changes, mask, flag]) => { if (changes & D[mask]) D[0x3b] |= 1 << flag; });
      if (b !== pb || c !== pc || d !== pd) this.cpu.irqDirty = true;
    }
    this.previous = now;
  }
  pendingInterrupt() {
    const D = this.cpu.data;
    const d = this.ports[2].levels();
    for (const index of [0, 1]) {
      if (!(D[0x3d] & (1 << index))) continue;
      const mode = (D[0x69] >> (index * 2)) & 3;
      if (mode === 0 ? !bit(d, 2 + index) : D[0x3c] & (1 << index)) return 1 + index;
    }
    for (const index of [0, 1, 2]) if (D[0x68] & D[0x3b] & (1 << index)) return 3 + index;
    return 0;
  }
  acknowledge(vector) {
    const D = this.cpu.data;
    if (vector <= 2) D[0x3c] &= ~(1 << (vector - 1)); else D[0x3b] &= ~(1 << (vector - 3));
  }
}

/** 1 KB EEPROM with immediate reads and writes. */
export class Eeprom {
  constructor() { this.memory = new Uint8Array(1024).fill(0xff); this.vectors = []; }
  attach(cpu) {
    this.cpu = cpu;
    const D = cpu.data;
    cpu.onWrite(0x3f, (value) => {
      const address = ((D[0x42] & 3) << 8) | D[0x41];
      if (value & 0x01) D[0x40] = this.memory[address];
      if (value & 0x02 && D[0x3f] & 0x04) {
        const mode = (value >> 4) & 3;
        if (mode === 0) this.memory[address] = D[0x40]; else if (mode === 1) this.memory[address] = 0xff; else this.memory[address] &= D[0x40];
      }
      D[0x3f] = value & 0x3c & ~(value & 0x02 ? 0x04 : 0);
    });
  }
}

/** SPI master: each byte completes after 8 SCK periods; MISO reads idle-high (0xFF). */
export class Spi {
  constructor() { this.vectors = [17]; this.sent = []; this.miso = () => 0xff; }
  reset() { this.transfer = null; }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    const D = cpu.data;
    cpu.onRead(0x4e, () => { D[0x4d] &= ~0x80; return this.received ?? 0; });
    cpu.onWrite(0x4e, (value) => {
      if (!(D[0x4c] & 0x40)) return;
      const div = [4, 16, 64, 128][D[0x4c] & 3] / (D[0x4d] & 1 ? 2 : 1);
      this.transfer = { value, remaining: 8 * div };
    });
  }
  tick(cycles) {
    if (!this.transfer) return;
    this.transfer.remaining -= cycles;
    if (this.transfer.remaining > 0) return;
    this.sent.push(this.transfer.value);
    if (this.sent.length > 4096) this.sent.splice(0, 2048);
    this.received = this.miso(this.transfer.value);
    this.transfer = null;
    this.cpu.data[0x4d] |= 0x80;
    this.cpu.irqDirty = true;
  }
  pendingInterrupt() { const D = this.cpu.data; return D[0x4d] & 0x80 && D[0x4c] & 0x80 ? 17 : 0; }
  acknowledge() { this.cpu.data[0x4d] &= ~0x80; }
}

/** TWI master on an empty bus: START works, every address is NACKed. */
export class Twi {
  constructor() { this.vectors = [24]; this.log = []; }
  reset() { this.pending = null; this.started = false; this.addressNext = false; if (this.cpu) this.cpu.data[0xb9] = 0xf8; }
  attach(cpu) {
    this.cpu = cpu; this.reset();
    const D = cpu.data;
    cpu.onWrite(0xbc, (value) => {
      const twint = value & 0x80;
      D[0xbc] = value & ~0x80; // writing TWINT = 1 clears the flag
      if (!(value & 0x04) || !twint) return;
      if (value & 0x10) { this.started = false; D[0xbc] &= ~0x10; this.log.push({ event: 'stop' }); return; }
      if (value & 0x20) { this.pending = { status: this.started ? 0x10 : 0x08, remaining: 20 }; this.started = true; this.addressNext = true; this.log.push({ event: 'start' }); return; }
      if (this.addressNext) { const address = D[0xbb]; this.addressNext = false; this.log.push({ event: 'address', address: address >> 1, read: Boolean(address & 1), ack: false }); this.pending = { status: address & 1 ? 0x48 : 0x20, remaining: 180 }; return; }
      this.pending = { status: 0x30, remaining: 180 };
    });
  }
  tick(cycles) {
    if (!this.pending) return;
    this.pending.remaining -= cycles;
    if (this.pending.remaining > 0) return;
    const D = this.cpu.data;
    D[0xb9] = (D[0xb9] & 3) | this.pending.status;
    D[0xbc] |= 0x80;
    this.cpu.irqDirty = true;
    this.pending = null;
  }
  pendingInterrupt() { const D = this.cpu.data; return D[0xbc] & 0x80 && D[0xbc] & 0x01 ? 24 : 0; }
}

/** Build an ATmega328P: CPU plus every peripheral, wired at the datasheet addresses. */
export function createAtmega328p(AvrCpu, options = {}) {
  const cpu = new AvrCpu(options);
  const portB = cpu.attach(new GpioPort('B', 0x23));
  const portC = cpu.attach(new GpioPort('C', 0x26));
  const portD = cpu.attach(new GpioPort('D', 0x29));
  const timer0 = cpu.attach(new Timer({ name: 'Timer0', bits: 8, tccra: 0x44, tccrb: 0x45, tcnt: 0x46, ocra: 0x47, ocrb: 0x48, timsk: 0x6e, tifr: 0x35, vectorCompA: 14, vectorCompB: 15, vectorOvf: 16 }));
  const timer1 = cpu.attach(new Timer({ name: 'Timer1', bits: 16, tccra: 0x80, tccrb: 0x81, tcnt: 0x84, ocra: 0x88, ocrb: 0x8a, icrAddress: 0x86, timsk: 0x6f, tifr: 0x36, vectorCapt: 10, vectorCompA: 11, vectorCompB: 12, vectorOvf: 13 }));
  const timer2 = cpu.attach(new Timer({ name: 'Timer2', bits: 8, timer2: true, tccra: 0xb0, tccrb: 0xb1, tcnt: 0xb2, ocra: 0xb3, ocrb: 0xb4, timsk: 0x70, tifr: 0x37, vectorCompA: 7, vectorCompB: 8, vectorOvf: 9 }));
  const usart = cpu.attach(new Usart());
  const adc = cpu.attach(new Adc());
  const interrupts = cpu.attach(new ExternalInterrupts([portB, portC, portD]));
  const eeprom = cpu.attach(new Eeprom());
  const spi = cpu.attach(new Spi());
  const twi = cpu.attach(new Twi());
  cpu.reset();
  return { cpu, ports: { B: portB, C: portC, D: portD }, timers: [timer0, timer1, timer2], usart, adc, interrupts, eeprom, spi, twi };
}
