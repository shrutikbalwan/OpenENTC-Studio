// MCS-51 (8051/8052-compatible core) simulator: 256 bytes of internal RAM (upper 128
// reachable indirectly, as on the 8052), SFRs, 64 KB code and external data, cycle-accurate
// instruction timing (12 clocks per machine cycle), timers 0/1 (modes 0–3, gate, counter),
// the serial port (modes 0–3, timer-1 baud rate) and the two-level interrupt system.
import { OPCODES, SFR, instructionSize } from './isa.mjs';

const PSW = SFR.PSW - 0x80, ACC = SFR.ACC - 0x80, B = SFR.B - 0x80, SP = SFR.SP - 0x80, DPL = SFR.DPL - 0x80, DPH = SFR.DPH - 0x80;
const TCON = SFR.TCON - 0x80, TMOD = SFR.TMOD - 0x80, TL0 = SFR.TL0 - 0x80, TH0 = SFR.TH0 - 0x80, TL1 = SFR.TL1 - 0x80, TH1 = SFR.TH1 - 0x80;
const SCON = SFR.SCON - 0x80, IE = SFR.IE - 0x80, IP = SFR.IP - 0x80, PCON = SFR.PCON - 0x80;
const PORTS = [0x80, 0x90, 0xa0, 0xb0];
const CY = 0x80, AC = 0x40, OV = 0x04;
const VECTORS = [
  { flag: [TCON, 0x02], enable: 0x01, priority: 0x01, address: 0x03, name: 'INT0' },
  { flag: [TCON, 0x20], enable: 0x02, priority: 0x02, address: 0x0b, name: 'Timer 0' },
  { flag: [TCON, 0x08], enable: 0x04, priority: 0x04, address: 0x13, name: 'INT1' },
  { flag: [TCON, 0x80], enable: 0x08, priority: 0x08, address: 0x1b, name: 'Timer 1' },
  { flag: [SCON, 0x03], enable: 0x10, priority: 0x10, address: 0x23, name: 'Serial' },
];

export class Cpu8051 {
  constructor({ clock = 11_059_200 } = {}) {
    this.clock = clock;
    this.code = new Uint8Array(0x10000).fill(0xff);
    this.xram = new Uint8Array(0x10000);
    this.iram = new Uint8Array(0x100);
    this.sfr = new Uint8Array(0x80);
    this.external = new Uint8Array([0xff, 0xff, 0xff, 0xff]); // what outside circuits drive onto each port (1 = released)
    this.portListeners = [];
    this.serialOutput = [];
    this.serialInput = [];
    this.reset();
  }

  load(image, origin = 0) { this.code.fill(0xff); this.code.set(image.subarray ? image.subarray(0, 0x10000 - origin) : image, origin); this.reset(); }

  reset() {
    this.iram.fill(0); this.sfr.fill(0);
    for (const port of PORTS) this.sfr[port - 0x80] = 0xff;
    this.sfr[SP] = 0x07;
    this.pc = 0; this.cycles = 0; this.instructions = 0; this.halted = false;
    this.inService = []; // stack of active interrupt priority levels
    this.tx = null; this.rx = null; this.serialClock = 0; this.timer1Overflows = 0;
    this.previousPins = this.portPins();
    this.lastInterrupt = null;
  }

  // --- Ports -----------------------------------------------------------------
  portPins() { return PORTS.map((address, index) => this.sfr[address - 0x80] & this.external[index]); }
  pin(port, bit) { return ((this.sfr[PORTS[port] - 0x80] & this.external[port]) >> bit) & 1; }
  setExternal(port, value) { this.external[port] = value & 0xff; }
  onPortChange(listener) { this.portListeners.push(listener); }

  // --- Memory ----------------------------------------------------------------
  get acc() { return this.sfr[ACC]; }
  set acc(value) { this.sfr[ACC] = value & 0xff; }
  get bank() { return this.sfr[PSW] & 0x18; }
  reg(n) { return this.iram[this.bank + n]; }
  setReg(n, value) { this.iram[this.bank + n] = value & 0xff; }
  get dptr() { return (this.sfr[DPH] << 8) | this.sfr[DPL]; }
  set dptr(value) { this.sfr[DPH] = (value >> 8) & 0xff; this.sfr[DPL] = value & 0xff; }

  readDirect(address, latch = false) {
    if (address < 0x80) return this.iram[address];
    const port = PORTS.indexOf(address);
    if (port >= 0 && !latch) return this.sfr[address - 0x80] & this.external[port];
    if (address === SFR.SBUF) return this.rxBuffer ?? 0;
    if (address === SFR.PSW) return this.withParity();
    return this.sfr[address - 0x80];
  }

  writeDirect(address, value) {
    value &= 0xff;
    if (address < 0x80) { this.iram[address] = value; return; }
    if (address === SFR.SBUF) { this.startTransmit(value); return; }
    const before = this.sfr[address - 0x80];
    this.sfr[address - 0x80] = value;
    if (PORTS.includes(address) && before !== value) this.notifyPorts();
  }

  notifyPorts() { for (const listener of this.portListeners) listener(this); }

  readBit(address, latch = false) {
    const byte = address < 0x80 ? 0x20 + (address >> 3) : address & 0xf8;
    return (this.readDirect(byte, latch) >> (address & 7)) & 1;
  }

  writeBit(address, value) {
    const byte = address < 0x80 ? 0x20 + (address >> 3) : address & 0xf8;
    const mask = 1 << (address & 7);
    const current = this.readDirect(byte, true);
    this.writeDirect(byte, value ? current | mask : current & ~mask);
  }

  withParity() {
    let a = this.sfr[ACC], parity = 0;
    while (a) { parity ^= a & 1; a >>= 1; }
    return (this.sfr[PSW] & 0xfe) | parity;
  }

  get carry() { return this.sfr[PSW] >> 7; }
  setFlag(mask, on) { this.sfr[PSW] = on ? this.sfr[PSW] | mask : this.sfr[PSW] & ~mask; }

  push(value) { this.sfr[SP] = (this.sfr[SP] + 1) & 0xff; this.iram[this.sfr[SP]] = value & 0xff; }
  pop() { const value = this.iram[this.sfr[SP]]; this.sfr[SP] = (this.sfr[SP] - 1) & 0xff; return value; }

  // --- Operand access --------------------------------------------------------
  get(kind, value, latch = false) {
    switch (kind) {
      case 'A': return this.acc;
      case 'C': return this.carry;
      case '#8': case '#16': return value;
      case 'dir': return this.readDirect(value, latch);
      case 'bit': return this.readBit(value, latch);
      case '/bit': return this.readBit(value) ^ 1;
      case '@R0': return this.iram[this.reg(0)];
      case '@R1': return this.iram[this.reg(1)];
      case 'DPTR': return this.dptr;
      default: return this.reg(Number(kind[1]));
    }
  }

  set(kind, value, data) {
    switch (kind) {
      case 'A': this.acc = value; break;
      case 'C': this.setFlag(CY, value & 1); break;
      case 'dir': this.writeDirect(data, value); break;
      case 'bit': this.writeBit(data, value & 1); break;
      case '@R0': this.iram[this.reg(0)] = value & 0xff; break;
      case '@R1': this.iram[this.reg(1)] = value & 0xff; break;
      case 'DPTR': this.dptr = value & 0xffff; break;
      default: this.setReg(Number(kind[1]), value);
    }
  }

  add(value, carry) {
    const a = this.acc, c = carry ? this.carry : 0;
    const result = a + value + c;
    this.setFlag(CY, result > 0xff);
    this.setFlag(AC, (a & 0x0f) + (value & 0x0f) + c > 0x0f);
    this.setFlag(OV, ((a ^ result) & (value ^ result) & 0x80) !== 0);
    this.acc = result;
  }

  subb(value) {
    const a = this.acc, c = this.carry;
    const result = a - value - c;
    this.setFlag(CY, result < 0);
    this.setFlag(AC, (a & 0x0f) - (value & 0x0f) - c < 0);
    this.setFlag(OV, ((a ^ value) & (a ^ result) & 0x80) !== 0);
    this.acc = result;
  }

  // --- Execution -------------------------------------------------------------
  /** Execute one instruction (or interrupt entry). Returns machine cycles used. */
  step() {
    const pending = this.holdInterrupts ? null : this.pendingInterrupt();
    this.holdInterrupts = false;
    if (pending) {
      this.push(this.pc & 0xff); this.push(this.pc >> 8);
      this.pc = pending.address;
      this.inService.push(pending.level);
      this.lastInterrupt = pending.name;
      // Timer and edge-triggered external flags clear on vectoring; serial flags do not.
      if (pending.address === 0x0b) this.sfr[TCON] &= ~0x20;
      if (pending.address === 0x1b) this.sfr[TCON] &= ~0x80;
      if (pending.address === 0x03 && this.sfr[TCON] & 0x01) this.sfr[TCON] &= ~0x02;
      if (pending.address === 0x13 && this.sfr[TCON] & 0x04) this.sfr[TCON] &= ~0x08;
      // Flags are polled in the cycle after they are set, then a hardware LCALL takes 2 cycles.
      this.advance(3);
      return 3;
    }
    const op = this.code[this.pc];
    const entry = OPCODES[op];
    if (!entry) { this.halted = true; this.haltReason = `Undefined opcode A5H at ${this.pc.toString(16).toUpperCase().padStart(4, '0')}H`; return 0; }
    const start = this.pc;
    const size = instructionSize(entry);
    const operands = [];
    let cursor = start + 1;
    for (const kind of entry.args) {
      if (kind === '#16' || kind === 'a16') { operands.push((this.code[cursor & 0xffff] << 8) | this.code[(cursor + 1) & 0xffff]); cursor += 2; } else if (kind === '#8' || kind === 'dir' || kind === 'bit' || kind === '/bit' || kind === 'rel' || kind === 'a11') operands.push(this.code[cursor++ & 0xffff]); else operands.push(null);
    }
    if (op === 0x85) operands.reverse();
    this.pc = (start + size) & 0xffff;
    this.execute(entry, operands, op);
    this.instructions += 1;
    this.advance(entry.cycles);
    return entry.cycles;
  }

  relative(offset) { this.pc = (this.pc + ((offset << 24) >> 24)) & 0xffff; }

  execute(entry, v, op) {
    const [k0, k1, k2] = entry.args;
    switch (entry.mnemonic) {
      case 'NOP': break;
      case 'AJMP': this.pc = (this.pc & 0xf800) | ((op & 0xe0) << 3) | v[0]; break;
      case 'ACALL': this.push(this.pc & 0xff); this.push(this.pc >> 8); this.pc = (this.pc & 0xf800) | ((op & 0xe0) << 3) | v[0]; break;
      case 'LJMP': this.pc = v[0]; break;
      case 'LCALL': this.push(this.pc & 0xff); this.push(this.pc >> 8); this.pc = v[0]; break;
      case 'RET': { const high = this.pop(); this.pc = (high << 8) | this.pop(); break; }
      case 'RETI': { const high = this.pop(); this.pc = (high << 8) | this.pop(); this.inService.pop(); this.holdInterrupts = true; break; }
      case 'SJMP': this.relative(v[0]); break;
      case 'JMP': this.pc = (this.acc + this.dptr) & 0xffff; break;
      case 'JC': if (this.carry) this.relative(v[0]); break;
      case 'JNC': if (!this.carry) this.relative(v[0]); break;
      case 'JZ': if (this.acc === 0) this.relative(v[0]); break;
      case 'JNZ': if (this.acc !== 0) this.relative(v[0]); break;
      case 'JB': if (this.readBit(v[0])) this.relative(v[1]); break;
      case 'JNB': if (!this.readBit(v[0])) this.relative(v[1]); break;
      case 'JBC': if (this.readBit(v[0], true)) { this.writeBit(v[0], 0); this.relative(v[1]); } break;
      case 'CJNE': { const a = this.get(k0, v[0]), b = this.get(k1, v[1]); this.setFlag(CY, a < b); if (a !== b) this.relative(v[2]); void k2; break; }
      case 'DJNZ': { const value = (this.get(k0, v[0], true) - 1) & 0xff; this.set(k0, value, v[0]); if (value) this.relative(v[1]); break; }
      case 'MOV': this.set(k0, this.get(k1, v[1]), v[0]); break;
      case 'MOVC': this.acc = this.code[(this.acc + (k1 === '@A+PC' ? this.pc : this.dptr)) & 0xffff]; break;
      case 'MOVX': {
        const address = (k0 === '@DPTR' || k1 === '@DPTR') ? this.dptr : this.reg(k0 === '@R1' || k1 === '@R1' ? 1 : 0) | (this.sfr[SFR.P2 - 0x80] << 8);
        if (k0 === 'A') this.acc = this.xram[address]; else this.xram[address] = this.acc;
        break;
      }
      case 'PUSH': this.push(this.readDirect(v[0])); break;
      case 'POP': this.writeDirect(v[0], this.pop()); break;
      case 'XCH': { const a = this.acc; this.acc = this.get(k1, v[1]); this.set(k1, a, v[1]); break; }
      case 'XCHD': { const address = this.reg(k1 === '@R1' ? 1 : 0); const a = this.acc; this.acc = (a & 0xf0) | (this.iram[address] & 0x0f); this.iram[address] = (this.iram[address] & 0xf0) | (a & 0x0f); break; }
      case 'ADD': this.add(this.get(k1, v[1]), false); break;
      case 'ADDC': this.add(this.get(k1, v[1]), true); break;
      case 'SUBB': this.subb(this.get(k1, v[1])); break;
      case 'INC': if (k0 === 'DPTR') this.dptr = (this.dptr + 1) & 0xffff; else this.set(k0, this.get(k0, v[0], true) + 1, v[0]); break;
      case 'DEC': this.set(k0, this.get(k0, v[0], true) - 1, v[0]); break;
      case 'MUL': { const result = this.acc * this.sfr[B]; this.acc = result; this.sfr[B] = result >> 8; this.setFlag(CY, 0); this.setFlag(OV, result > 0xff); break; }
      case 'DIV': {
        const divisor = this.sfr[B];
        this.setFlag(CY, 0);
        if (divisor === 0) { this.setFlag(OV, 1); break; }
        const a = this.acc; this.acc = Math.floor(a / divisor); this.sfr[B] = a % divisor; this.setFlag(OV, 0);
        break;
      }
      case 'DA': {
        let a = this.acc;
        if ((a & 0x0f) > 9 || this.sfr[PSW] & AC) { a += 0x06; if (a > 0xff) this.setFlag(CY, 1); }
        if (((a >> 4) & 0x1f) > 9 || this.carry) { a += 0x60; if (a > 0xff) this.setFlag(CY, 1); }
        this.acc = a;
        break;
      }
      case 'ANL': case 'ORL': case 'XRL': {
        if (k0 === 'C') { const bit = this.get(k1, v[1]); this.setFlag(CY, entry.mnemonic === 'ANL' ? this.carry & bit : this.carry | bit); break; }
        const a = this.get(k0, v[0], true), b = this.get(k1, v[1]);
        this.set(k0, entry.mnemonic === 'ANL' ? a & b : entry.mnemonic === 'ORL' ? a | b : a ^ b, v[0]);
        break;
      }
      case 'CLR': if (k0 === 'A') this.acc = 0; else this.set(k0, 0, v[0]); break;
      case 'SETB': this.set(k0, 1, v[0]); break;
      case 'CPL': if (k0 === 'A') this.acc = ~this.acc; else this.set(k0, this.get(k0, v[0], true) ^ 1, v[0]); break;
      case 'RL': this.acc = (this.acc << 1) | (this.acc >> 7); break;
      case 'RR': this.acc = (this.acc >> 1) | ((this.acc & 1) << 7); break;
      case 'RLC': { const a = this.acc; this.acc = (a << 1) | this.carry; this.setFlag(CY, a >> 7); break; }
      case 'RRC': { const a = this.acc; this.acc = (a >> 1) | (this.carry << 7); this.setFlag(CY, a & 1); break; }
      case 'SWAP': this.acc = ((this.acc << 4) | (this.acc >> 4)) & 0xff; break;
      default: throw new Error(`Unimplemented ${entry.mnemonic}`);
    }
  }

  // --- Interrupts ------------------------------------------------------------
  pendingInterrupt() {
    const ie = this.sfr[IE];
    if (!(ie & 0x80)) return null;
    const current = this.inService.length ? this.inService[this.inService.length - 1] : -1;
    let best = null;
    for (const vector of VECTORS) {
      if (!(ie & vector.enable) || !(this.sfr[vector.flag[0]] & vector.flag[1])) continue;
      const level = this.sfr[IP] & vector.priority ? 1 : 0;
      if (level <= current) continue;
      if (!best || level > best.level) best = { ...vector, level };
    }
    return best;
  }

  // --- Time: timers, serial port and external pins ---------------------------
  advance(cycles) {
    this.cycles += cycles;
    const pins = this.portPins();
    const p3 = pins[3], previous = this.previousPins[3];
    // External interrupts on P3.2 / P3.3: edge (ITx = 1) or level (ITx = 0).
    for (const [bit, it, flag] of [[2, 0x01, 0x02], [3, 0x04, 0x08]]) {
      const now = (p3 >> bit) & 1, before = (previous >> bit) & 1;
      if (this.sfr[TCON] & it) { if (before && !now) this.sfr[TCON] |= flag; } else if (now) this.sfr[TCON] &= ~flag; else this.sfr[TCON] |= flag;
    }
    const t0Edges = ((previous >> 4) & 1) && !((p3 >> 4) & 1) ? 1 : 0;
    const t1Edges = ((previous >> 5) & 1) && !((p3 >> 5) & 1) ? 1 : 0;
    this.previousPins = pins;
    this.runTimers(cycles, t0Edges, t1Edges, p3);
    this.runSerial(cycles);
  }

  runTimers(cycles, t0Edges, t1Edges, p3) {
    const tmod = this.sfr[TMOD], tcon = this.sfr[TCON];
    const gateOk = (gate, intPin) => !gate || ((p3 >> intPin) & 1);
    const mode0 = tmod & 3, mode1 = (tmod >> 4) & 3;
    const run0 = (tcon & 0x10) && gateOk(tmod & 0x08, 2);
    const run1 = (tcon & 0x40) && gateOk(tmod & 0x80, 3);
    const counts0 = tmod & 0x04 ? t0Edges : cycles;
    const counts1 = tmod & 0x40 ? t1Edges : cycles;
    if (run0 && counts0) this.countTimer(0, mode0, counts0);
    if (mode0 === 3) {
      // Mode 3: TH0 is an 8-bit timer controlled by TR1 that sets TF1.
      if (tcon & 0x40) { const th = this.sfr[TH0] + cycles; this.sfr[TH0] = th; if (th > 0xff) this.sfr[TCON] |= 0x80; }
      if (mode1 !== 3 && counts1) this.countTimer(1, mode1, counts1, false); // timer 1 still clocks the baud rate
    } else if (run1 && counts1 && mode1 !== 3) this.countTimer(1, mode1, counts1);
  }

  countTimer(timer, mode, counts, setFlag = true) {
    const low = timer ? TL1 : TL0, high = timer ? TH1 : TH0, flag = timer ? 0x80 : 0x20;
    let overflows = 0;
    if (mode === 1) {
      let value = ((this.sfr[high] << 8) | this.sfr[low]) + counts;
      while (value > 0xffff) { value -= 0x10000; overflows += 1; }
      this.sfr[high] = value >> 8; this.sfr[low] = value & 0xff;
    } else if (mode === 0) {
      let value = ((this.sfr[high] << 5) | (this.sfr[low] & 0x1f)) + counts;
      while (value > 0x1fff) { value -= 0x2000; overflows += 1; }
      this.sfr[high] = value >> 5; this.sfr[low] = (this.sfr[low] & 0xe0) | (value & 0x1f);
    } else if (mode === 2) {
      const value = this.sfr[low] + counts, reload = this.sfr[high];
      if (value > 0xff) {
        const excess = value - 0x100, period = 0x100 - reload;
        overflows = 1 + Math.floor(excess / period);
        this.sfr[low] = reload + (excess % period);
      } else this.sfr[low] = value;
    } else if (mode === 3 && timer === 0) {
      const value = this.sfr[low] + counts;
      if (value > 0xff) overflows = Math.floor(value / 0x100);
      this.sfr[low] = value;
    }
    if (overflows) {
      if (setFlag) this.sfr[TCON] |= flag;
      if (timer === 1) this.timer1Overflows += overflows;
    }
  }

  /** Bit time in machine cycles for the current serial mode, or null if the baud clock is stopped. */
  serialBitCycles() {
    const mode = this.sfr[SCON] >> 6, smod = this.sfr[PCON] & 0x80;
    if (mode === 0) return 1;
    if (mode === 2) return (smod ? 32 : 64) / 12;
    return null; // modes 1 and 3 are clocked by timer-1 overflows
  }

  startTransmit(value) {
    const mode = this.sfr[SCON] >> 6;
    this.tx = { value, bits: mode === 0 ? 8 : mode === 1 ? 10 : 11, progress: 0 };
  }

  receive(bytes) { for (const byte of bytes) this.serialInput.push(byte & 0xff); }

  runSerial(cycles) {
    const mode = this.sfr[SCON] >> 6, smod = this.sfr[PCON] & 0x80;
    // A free-running divider makes bit ticks: timer-1 overflows ÷16/÷32 in modes 1 and 3,
    // f/12 in mode 0 and f/32 or f/64 in mode 2.
    if (mode === 1 || mode === 3) { this.serialClock += this.timer1Overflows; this.timer1Overflows = 0; }
    else this.serialClock += cycles / this.serialBitCycles();
    const divider = mode === 1 || mode === 3 ? (smod ? 16 : 32) : 1;
    const ticks = Math.floor(this.serialClock / divider);
    this.serialClock -= ticks * divider;
    if (!ticks) return;
    if (this.tx) {
      // Transmission starts at the next tick; TI rises at the start of the stop bit.
      this.tx.progress += ticks;
      if (this.tx.progress >= this.tx.bits) { this.serialOutput.push(this.tx.value); this.tx = null; this.sfr[SCON] |= 0x02; }
    }
    const ren = this.sfr[SCON] & 0x10;
    if (!this.rx && ren && this.serialInput.length && !(this.sfr[SCON] & 0x01)) this.rx = { value: this.serialInput.shift(), progress: 0, bits: mode === 0 ? 8 : mode === 1 ? 10 : 11 };
    if (this.rx) {
      this.rx.progress += ticks;
      if (this.rx.progress >= this.rx.bits) { this.rxBuffer = this.rx.value; this.rx = null; this.sfr[SCON] |= 0x01; }
    }
  }

  /** Run until `maxCycles` elapse, a breakpoint is hit or the CPU halts. */
  run(maxCycles, breakpoints = new Set()) {
    const target = this.cycles + maxCycles;
    while (this.cycles < target && !this.halted) {
      this.step();
      if (breakpoints.has(this.pc)) return { reason: 'breakpoint', pc: this.pc };
    }
    return { reason: this.halted ? 'halted' : 'cycles', pc: this.pc };
  }

  snapshot() {
    return {
      pc: this.pc, a: this.acc, b: this.sfr[B], psw: this.withParity(), sp: this.sfr[SP], dptr: this.dptr,
      registers: Array.from({ length: 8 }, (_, n) => this.reg(n)), bank: this.bank >> 3,
      ports: PORTS.map((address) => this.sfr[address - 0x80]), pins: this.portPins(),
      tcon: this.sfr[TCON], tmod: this.sfr[TMOD], timer0: (this.sfr[TH0] << 8) | this.sfr[TL0], timer1: (this.sfr[TH1] << 8) | this.sfr[TL1],
      scon: this.sfr[SCON], ie: this.sfr[IE], ip: this.sfr[IP], cycles: this.cycles, instructions: this.instructions,
      timeSeconds: this.cycles * 12 / this.clock,
    };
  }
}
