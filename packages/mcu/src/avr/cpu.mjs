// ATmega328P CPU core (AVRe+): 32 registers, data space with memory-mapped I/O, 32 KB
// flash, the full instruction set of the part with per-instruction cycle counts, and the
// interrupt system. Peripherals attach through `io` read/write hooks and `tick(cycles)`.

const SREG = 0x5f, SPL = 0x5d, SPH = 0x5e;
const C = 0x01, Z = 0x02, N = 0x04, V = 0x08, S = 0x10, H = 0x20, T = 0x40, I = 0x80;
export const FLASH_WORDS = 0x4000;
export const SRAM_END = 0x08ff;

export class AvrCpu {
  constructor({ clock = 16_000_000 } = {}) {
    this.clock = clock;
    this.flash = new Uint16Array(FLASH_WORDS).fill(0xffff);
    this.data = new Uint8Array(SRAM_END + 1);
    this.readHooks = new Array(0x100);
    this.writeHooks = new Array(0x100);
    this.devices = [];
    this.tickers = []; this.interrupters = [];
    this.reset();
  }

  loadImage(bytes) {
    this.flash.fill(0xffff);
    for (let word = 0; word < FLASH_WORDS; word += 1) this.flash[word] = bytes[2 * word] | (bytes[2 * word + 1] << 8);
    this.reset();
  }

  reset() {
    this.data.fill(0);
    this.pc = 0; this.cycles = 0; this.instructions = 0;
    this.sp = SRAM_END;
    this.sleeping = false; this.halted = false; this.haltReason = null;
    this.interruptDelay = 0; this.lastInterrupt = null; this.irqDirty = true; this.pendingCache = 0;
    for (const device of this.devices) device.reset?.();
  }

  attach(device) {
    this.devices.push(device);
    this.tickers = this.devices.filter((entry) => entry.tick);
    this.interrupters = this.devices.filter((entry) => entry.pendingInterrupt);
    this._vectorOwner = null;
    device.attach?.(this);
    return device;
  }
  onRead(address, hook) { this.readHooks[address] = hook; }
  onWrite(address, hook) { this.writeHooks[address] = hook; }

  get sreg() { return this.data[SREG]; }
  set sreg(value) { this.data[SREG] = value & 0xff; }
  get sp() { return (this.data[SPH] << 8) | this.data[SPL]; }
  set sp(value) { this.data[SPH] = (value >> 8) & 0xff; this.data[SPL] = value & 0xff; }

  read(address) {
    address &= 0xffff;
    if (address < 0x100) { const hook = this.readHooks[address]; if (hook) return hook(address) & 0xff; }
    return address <= SRAM_END ? this.data[address] : 0;
  }

  write(address, value) {
    address &= 0xffff; value &= 0xff;
    if (address < 0x100) this.irqDirty = true;
    if (address < 0x100) { const hook = this.writeHooks[address]; if (hook) { hook(value, address); return; } }
    if (address <= SRAM_END) this.data[address] = value;
  }

  push(value) { const sp = this.sp; this.write(sp, value); this.sp = sp - 1; }
  pop() { const sp = this.sp + 1; this.sp = sp; return this.read(sp); }
  pushPc(pc) { this.push(pc & 0xff); this.push((pc >> 8) & 0xff); }
  popPc() { const high = this.pop(); return ((high << 8) | this.pop()) & 0x3fff; }

  flag(mask) { return this.data[SREG] & mask ? 1 : 0; }
  setFlags(mask, values) { this.data[SREG] = (this.data[SREG] & ~mask) | (values & mask); }

  /** Flags after an 8-bit result: N, Z (optionally sticky), S from N^V. */
  nzs(result, v, extra = 0, extraMask = 0, stickyZ = false) {
    const n = result & 0x80 ? N : 0;
    const z = (result & 0xff) === 0 ? (stickyZ ? this.data[SREG] & Z : Z) : 0;
    const s = (n ? 1 : 0) ^ (v ? 1 : 0) ? S : 0;
    this.setFlags(N | Z | V | S | extraMask, n | z | (v ? V : 0) | s | extra);
  }

  add(rd, rr, carry) {
    const result = rd + rr + carry;
    const r = result & 0xff;
    const h = ((rd & 0x0f) + (rr & 0x0f) + carry) > 0x0f ? H : 0;
    const v = ((rd ^ r) & (rr ^ r) & 0x80) !== 0;
    this.nzs(r, v, h | (result > 0xff ? C : 0), H | C);
    return r;
  }

  sub(rd, rr, carry, stickyZ = false) {
    const result = rd - rr - carry;
    const r = result & 0xff;
    const h = ((rd & 0x0f) - (rr & 0x0f) - carry) < 0 ? H : 0;
    const v = ((rd ^ rr) & (rd ^ r) & 0x80) !== 0;
    this.nzs(r, v, h | (result < 0 ? C : 0), H | C, stickyZ);
    return r;
  }

  logic(r) { this.nzs(r, false); return r; }

  /** Size in words of the instruction at `pc` (for skips). */
  isTwoWord(word) { return (word & 0xfe0e) === 0x940c || (word & 0xfe0e) === 0x940e || (word & 0xfe0f) === 0x9000 || (word & 0xfe0f) === 0x9200; }

  /** Execute one instruction or interrupt entry; returns cycles used. */
  step() {
    if (this.halted) return 0;
    let used;
    // Interrupt state only changes when a peripheral raises a flag, I/O is written or I changes,
    // so the (exact) poll is recomputed only after one of those events.
    if (this.irqDirty) { this.irqDirty = false; this.pendingCache = this.pendingVector(); }
    const vector = this.interruptDelay || !(this.data[SREG] & I) ? 0 : this.pendingCache;
    if (this.interruptDelay) this.interruptDelay -= 1;
    if (vector) {
      this.sleeping = false;
      const device = this.vectorOwner.get(vector);
      device?.acknowledge?.(vector);
      this.pushPc(this.pc);
      this.data[SREG] &= ~I;
      this.pc = vector * 2;
      this.lastInterrupt = vector;
      this.irqDirty = true;
      used = 4;
    } else if (this.sleeping) used = 1;
    else used = this.execute();
    this.cycles += used;
    const tickers = this.tickers;
    for (let k = 0; k < tickers.length; k += 1) tickers[k].tick(used);
    return used;
  }

  pendingVector() {
    let best = 0;
    const sources = this.interrupters;
    for (let k = 0; k < sources.length; k += 1) {
      const vector = sources[k].pendingInterrupt();
      if (vector && (!best || vector < best)) best = vector;
    }
    return best;
  }

  get vectorOwner() {
    if (!this._vectorOwner) this._vectorOwner = new Map(this.devices.flatMap((device) => (device.vectors || []).map((vector) => [vector, device])));
    return this._vectorOwner;
  }

  execute() {
    const pc = this.pc;
    const op = this.flash[pc];
    this.instructions += 1;
    const d5 = (op >> 4) & 0x1f;
    const r5 = (op & 0x0f) | ((op >> 5) & 0x10);
    const R = this.data;
    const K8 = (op & 0x0f) | ((op >> 4) & 0xf0);
    const d16 = 16 + ((op >> 4) & 0x0f);
    this.pc = (pc + 1) & 0x3fff;
    switch (op >> 12) {
      case 0x0: {
        if (op === 0) return 1; // NOP
        const top = op & 0x0f00;
        if (top === 0x0100) { const d = ((op >> 4) & 0x0f) * 2, r = (op & 0x0f) * 2; R[d] = R[r]; R[d + 1] = R[r + 1]; return 1; } // MOVW
        if (top === 0x0200) { // MULS
          const a = (R[d16] << 24) >> 24, b = (R[16 + (op & 0x0f)] << 24) >> 24;
          return this.multiply(a * b, false);
        }
        if (top === 0x0300) {
          const d = 16 + ((op >> 4) & 7), r = 16 + (op & 7);
          const kind = ((op >> 6) & 2) | ((op >> 3) & 1);
          const sd = (R[d] << 24) >> 24, sr = (R[r] << 24) >> 24;
          if (kind === 0) return this.multiply(sd * R[r], false); // MULSU
          if (kind === 1) return this.multiply(R[d] * R[r], true); // FMUL
          if (kind === 2) return this.multiply(sd * sr, true); // FMULS
          return this.multiply(sd * R[r], true); // FMULSU
        }
        const sel = (op >> 10) & 3;
        if (sel === 0) return this.illegal(op, pc);
        if (sel === 1) { this.sub(R[d5], R[r5], this.flag(C), true); return 1; } // CPC
        if (sel === 2) { R[d5] = this.sub(R[d5], R[r5], this.flag(C), true); return 1; } // SBC
        R[d5] = this.add(R[d5], R[r5], 0); return 1; // ADD
      }
      case 0x1: {
        const sel = (op >> 10) & 3;
        if (sel === 0) { if (R[d5] === R[r5]) return this.skip(); return 1; } // CPSE
        if (sel === 1) { this.sub(R[d5], R[r5], 0); return 1; } // CP
        if (sel === 2) { R[d5] = this.sub(R[d5], R[r5], 0); return 1; } // SUB
        R[d5] = this.add(R[d5], R[r5], this.flag(C)); return 1; // ADC
      }
      case 0x2: {
        const sel = (op >> 10) & 3;
        if (sel === 0) R[d5] = this.logic(R[d5] & R[r5]);
        else if (sel === 1) R[d5] = this.logic(R[d5] ^ R[r5]);
        else if (sel === 2) R[d5] = this.logic(R[d5] | R[r5]);
        else R[d5] = R[r5]; // MOV
        return 1;
      }
      case 0x3: this.sub(R[d16], K8, 0); return 1; // CPI
      case 0x4: R[d16] = this.sub(R[d16], K8, this.flag(C), true); return 1; // SBCI
      case 0x5: R[d16] = this.sub(R[d16], K8, 0); return 1; // SUBI
      case 0x6: R[d16] = this.logic(R[d16] | K8); return 1; // ORI
      case 0x7: R[d16] = this.logic(R[d16] & K8); return 1; // ANDI
      case 0x8: case 0xa: { // LDD/STD with displacement (Y or Z)
        const q = (op & 7) | ((op >> 7) & 0x18) | ((op >> 8) & 0x20);
        const base = op & 0x08 ? (R[29] << 8) | R[28] : (R[31] << 8) | R[30];
        if (op & 0x0200) this.write(base + q, R[d5]); else R[d5] = this.read(base + q);
        return 2;
      }
      case 0x9: return this.execute9(op, d5, r5);
      case 0xb: { // IN / OUT
        const a = 0x20 + ((op & 0x0f) | ((op >> 5) & 0x30));
        if (op & 0x0800) this.write(a, R[d5]); else R[d5] = this.read(a);
        return 1;
      }
      case 0xc: this.pc = (this.pc + (((op & 0x0fff) << 20) >> 20)) & 0x3fff; return 2; // RJMP
      case 0xd: this.pushPc(this.pc); this.pc = (this.pc + (((op & 0x0fff) << 20) >> 20)) & 0x3fff; return 3; // RCALL
      case 0xe: R[d16] = K8; return 1; // LDI
      case 0xf: {
        const b = op & 7;
        if (!(op & 0x0800)) { // BRBS / BRBC
          const k = ((op >> 3) & 0x7f) << 25 >> 25;
          const set = this.flag(1 << b);
          if ((op & 0x0400 ? !set : set)) { this.pc = (this.pc + k) & 0x3fff; return 2; }
          return 1;
        }
        const sel = (op >> 9) & 3;
        if (sel === 0) { R[d5] = this.flag(T) ? R[d5] | (1 << b) : R[d5] & ~(1 << b); return 1; } // BLD
        if (sel === 1) { this.setFlags(T, (R[d5] >> b) & 1 ? T : 0); return 1; } // BST
        const bit = (R[d5] >> b) & 1;
        if ((sel === 2 && !bit) || (sel === 3 && bit)) return this.skip(); // SBRC / SBRS
        return 1;
      }
    }
    return this.illegal(op, pc);
  }

  skip() { const two = this.isTwoWord(this.flash[this.pc]); this.pc = (this.pc + (two ? 2 : 1)) & 0x3fff; return two ? 3 : 2; }

  multiply(product, fractional) {
    const raw = product & 0xffff;
    const result = fractional ? (raw << 1) & 0xffff : raw;
    this.data[0] = result & 0xff; this.data[1] = result >> 8;
    this.setFlags(C | Z, (raw & 0x8000 ? C : 0) | (result === 0 ? Z : 0));
    return 2;
  }

  illegal(op, pc) { this.halted = true; this.haltReason = `Unsupported instruction ${op.toString(16).padStart(4, '0')} at byte address ${(pc * 2).toString(16)}`; return 1; }

  pointer(low) { return (this.data[low + 1] << 8) | this.data[low]; }
  setPointer(low, value) { this.data[low] = value & 0xff; this.data[low + 1] = (value >> 8) & 0xff; }

  execute9(op, d5, r5) {
    const R = this.data;
    const second = op & 0x0f00;
    if (second <= 0x0300) { // 1001 00xd: loads (000) and stores (001)
      const store = op & 0x0200;
      const mode = op & 0x0f;
      if (mode === 0x0) { const address = this.flash[this.pc]; this.pc = (this.pc + 1) & 0x3fff; if (store) this.write(address, R[d5]); else R[d5] = this.read(address); return 2; } // LDS/STS
      if (mode === 0xf) { if (store) this.push(R[d5]); else R[d5] = this.pop(); return 2; } // PUSH/POP
      if (!store && (mode === 0x4 || mode === 0x5)) { // LPM Rd,Z(+)
        const z = this.pointer(30);
        R[d5] = (this.flash[(z >> 1) & 0x3fff] >> ((z & 1) * 8)) & 0xff;
        if (mode === 0x5) this.setPointer(30, z + 1);
        return 3;
      }
      if (mode === 0x6 || mode === 0x7 || (store && mode >= 0x4 && mode <= 0x7)) return this.illegal(op, (this.pc - 1) & 0x3fff); // ELPM / XCH family
      const register = mode >= 0xc ? 26 : mode >= 0x9 ? 28 : 30;
      const variant = mode >= 0xc ? mode - 0xc : mode >= 0x9 ? mode - 0x8 : mode; // 0 plain, 1 post-inc, 2 pre-dec
      let address = this.pointer(register);
      if (variant === 2) { address = (address - 1) & 0xffff; this.setPointer(register, address); }
      if (store) this.write(address, R[d5]); else R[d5] = this.read(address);
      if (variant === 1) this.setPointer(register, address + 1);
      return 2;
    }
    if (second === 0x0400 || second === 0x0500) { // 1001 010x
      const low = op & 0x0f;
      if (low <= 0x7 && low !== 0x4) {
        const rd = R[d5];
        switch (low) {
          case 0x0: { const r = (~rd) & 0xff; this.nzs(r, false, C, C); R[d5] = r; return 1; } // COM
          case 0x1: { const r = (-rd) & 0xff; this.nzs(r, r === 0x80, (r ? C : 0) | ((r | rd) & 0x08 ? H : 0), C | H); R[d5] = r; return 1; } // NEG
          case 0x2: R[d5] = ((rd << 4) | (rd >> 4)) & 0xff; return 1; // SWAP
          case 0x3: { const r = (rd + 1) & 0xff; this.nzs(r, r === 0x80); R[d5] = r; return 1; } // INC
          case 0x5: { const r = (rd >> 1) | (rd & 0x80); const c = rd & 1; this.nzs(r, ((r >> 7) ^ c) === 1, c ? C : 0, C); R[d5] = r; return 1; } // ASR
          case 0x6: { const r = rd >> 1; const c = rd & 1; this.nzs(r, c === 1, c ? C : 0, C); R[d5] = r; return 1; } // LSR
          case 0x7: { const r = (rd >> 1) | (this.flag(C) << 7); const c = rd & 1; this.nzs(r, ((r >> 7) ^ c) === 1, c ? C : 0, C); R[d5] = r; return 1; } // ROR
        }
      }
      if (low === 0xa) { const rd = R[d5]; const r = (rd - 1) & 0xff; this.nzs(r, r === 0x7f); R[d5] = r; return 1; } // DEC
      if ((low & 0xc) === 0xc) { const k = ((op & 0x01f0) << 13) | ((op & 1) << 16) | this.flash[this.pc]; this.pc = (this.pc + 1) & 0x3fff; if ((low & 0xe) === 0xe) { this.pushPc(this.pc); this.pc = k & 0x3fff; return 4; } this.pc = k & 0x3fff; return 3; } // JMP/CALL
      if (low === 0x8) {
        if (second === 0x0400) { const s = (op >> 4) & 7; this.setFlags(1 << s, op & 0x0080 ? 0 : 1 << s); if (s === 7 && !(op & 0x0080)) { this.interruptDelay = 1; this.irqDirty = true; } return 1; } // BSET/BCLR
        switch (op) {
          case 0x9508: this.pc = this.popPc(); return 4; // RET
          case 0x9518: this.pc = this.popPc(); this.data[SREG] |= I; this.interruptDelay = 1; this.irqDirty = true; return 4; // RETI
          case 0x9588: this.sleeping = Boolean(this.read(0x53) & 1); return 1; // SLEEP (when SE is set)
          case 0x9598: return 1; // BREAK (treated as NOP)
          case 0x95a8: return 1; // WDR
          case 0x95c8: { const z = this.pointer(30); R[0] = (this.flash[(z >> 1) & 0x3fff] >> ((z & 1) * 8)) & 0xff; return 3; } // LPM
          case 0x95e8: return 1; // SPM: self-programming not modelled
          default: return this.illegal(op, (this.pc - 1) & 0x3fff);
        }
      }
      if (op === 0x9409) { this.pc = this.pointer(30) & 0x3fff; return 2; } // IJMP
      if (op === 0x9509) { this.pushPc(this.pc); this.pc = this.pointer(30) & 0x3fff; return 3; } // ICALL
      return this.illegal(op, (this.pc - 1) & 0x3fff);
    }
    if (second === 0x0600 || second === 0x0700) { // ADIW / SBIW
      const d = 24 + ((op >> 3) & 6), k = (op & 0x0f) | ((op >> 2) & 0x30);
      const value = this.pointer(d);
      const high = R[d + 1];
      const r = second === 0x0600 ? (value + k) & 0xffff : (value - k) & 0xffff;
      const r15 = r >> 15, rh7 = high >> 7;
      const v = second === 0x0600 ? !rh7 && r15 : rh7 && !r15;
      const c = second === 0x0600 ? !r15 && rh7 : r15 && !rh7;
      const n = r15;
      this.setFlags(C | Z | N | V | S, (c ? C : 0) | (r === 0 ? Z : 0) | (n ? N : 0) | (v ? V : 0) | ((n ^ (v ? 1 : 0)) ? S : 0));
      this.setPointer(d, r);
      return 2;
    }
    if (second >= 0x0800 && second <= 0x0b00) { // CBI / SBIC / SBI / SBIS
      const a = 0x20 + ((op >> 3) & 0x1f), b = op & 7;
      const kind = (second >> 8) & 3;
      if (kind === 0 || kind === 2) { const value = this.read(a); this.write(a, kind === 2 ? value | (1 << b) : value & ~(1 << b)); return 2; }
      const bit = (this.read(a) >> b) & 1;
      if ((kind === 1 && !bit) || (kind === 3 && bit)) return this.skip();
      return 1;
    }
    // 1001 11rd: MUL
    return this.multiply(R[d5] * R[r5], false);
  }

  /** Run up to `maxCycles`; stops on breakpoints (byte addresses) or halt. */
  run(maxCycles, breakpoints) {
    const target = this.cycles + maxCycles;
    while (this.cycles < target && !this.halted) {
      this.step();
      if (breakpoints?.size && breakpoints.has(this.pc * 2)) return { reason: 'breakpoint', pc: this.pc * 2 };
    }
    return { reason: this.halted ? 'halted' : 'cycles', pc: this.pc * 2 };
  }
}
