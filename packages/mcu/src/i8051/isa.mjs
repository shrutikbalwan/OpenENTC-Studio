// MCS-51 instruction set: one table drives the assembler, disassembler and CPU.
// Operand kinds: A AB C DPTR @A+DPTR @A+PC @DPTR @R0 @R1 R0..R7 (literal registers),
// #8 #16 (immediate), dir, bit, /bit, rel, a11, a16.

export const SFR = Object.freeze({
  P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87, TCON: 0x88, TMOD: 0x89, TL0: 0x8a, TL1: 0x8b, TH0: 0x8c, TH1: 0x8d,
  P1: 0x90, SCON: 0x98, SBUF: 0x99, P2: 0xa0, IE: 0xa8, P3: 0xb0, IP: 0xb8, PSW: 0xd0, ACC: 0xe0, B: 0xf0,
});

export const BITS = Object.freeze({
  CY: 0xd7, AC: 0xd6, F0: 0xd5, RS1: 0xd4, RS0: 0xd3, OV: 0xd2, P: 0xd0,
  TF1: 0x8f, TR1: 0x8e, TF0: 0x8d, TR0: 0x8c, IE1: 0x8b, IT1: 0x8a, IE0: 0x89, IT0: 0x88,
  SM0: 0x9f, SM1: 0x9e, SM2: 0x9d, REN: 0x9c, TB8: 0x9b, RB8: 0x9a, TI: 0x99, RI: 0x98,
  EA: 0xaf, ES: 0xac, ET1: 0xab, EX1: 0xaa, ET0: 0xa9, EX0: 0xa8,
  PS: 0xbc, PT1: 0xbb, PX1: 0xba, PT0: 0xb9, PX0: 0xb8,
  RD: 0xb7, WR: 0xb6, T1: 0xb5, T0: 0xb4, INT1: 0xb3, INT0: 0xb2, TXD: 0xb1, RXD: 0xb0,
});

const table = [];
const add = (op, mnemonic, args, cycles = 1) => table.push(Object.freeze({ op, mnemonic, args: Object.freeze(args), cycles }));
const R = (n) => `R${n}`;

add(0x00, 'NOP', []);
for (let page = 0; page < 8; page += 1) { add((page << 5) | 0x01, 'AJMP', ['a11'], 2); add((page << 5) | 0x11, 'ACALL', ['a11'], 2); }
add(0x02, 'LJMP', ['a16'], 2); add(0x12, 'LCALL', ['a16'], 2);
add(0x03, 'RR', ['A']); add(0x13, 'RRC', ['A']); add(0x23, 'RL', ['A']); add(0x33, 'RLC', ['A']);
for (const [base, mnemonic] of [[0x00, 'INC'], [0x10, 'DEC']]) {
  add(base + 4, mnemonic, ['A']); add(base + 5, mnemonic, ['dir']); add(base + 6, mnemonic, ['@R0']); add(base + 7, mnemonic, ['@R1']);
  for (let n = 0; n < 8; n += 1) add(base + 8 + n, mnemonic, [R(n)]);
}
add(0x10, 'JBC', ['bit', 'rel'], 2); add(0x20, 'JB', ['bit', 'rel'], 2); add(0x30, 'JNB', ['bit', 'rel'], 2);
add(0x40, 'JC', ['rel'], 2); add(0x50, 'JNC', ['rel'], 2); add(0x60, 'JZ', ['rel'], 2); add(0x70, 'JNZ', ['rel'], 2); add(0x80, 'SJMP', ['rel'], 2);
add(0x22, 'RET', [], 2); add(0x32, 'RETI', [], 2);
for (const [base, mnemonic] of [[0x20, 'ADD'], [0x30, 'ADDC'], [0x90, 'SUBB']]) {
  add(base + 4, mnemonic, ['A', '#8']); add(base + 5, mnemonic, ['A', 'dir']); add(base + 6, mnemonic, ['A', '@R0']); add(base + 7, mnemonic, ['A', '@R1']);
  for (let n = 0; n < 8; n += 1) add(base + 8 + n, mnemonic, ['A', R(n)]);
}
for (const [base, mnemonic] of [[0x40, 'ORL'], [0x50, 'ANL'], [0x60, 'XRL']]) {
  add(base + 2, mnemonic, ['dir', 'A']); add(base + 3, mnemonic, ['dir', '#8'], 2); add(base + 4, mnemonic, ['A', '#8']); add(base + 5, mnemonic, ['A', 'dir']);
  add(base + 6, mnemonic, ['A', '@R0']); add(base + 7, mnemonic, ['A', '@R1']);
  for (let n = 0; n < 8; n += 1) add(base + 8 + n, mnemonic, ['A', R(n)]);
}
add(0x72, 'ORL', ['C', 'bit'], 2); add(0x82, 'ANL', ['C', 'bit'], 2); add(0xa0, 'ORL', ['C', '/bit'], 2); add(0xb0, 'ANL', ['C', '/bit'], 2);
add(0x73, 'JMP', ['@A+DPTR'], 2);
add(0x74, 'MOV', ['A', '#8']); add(0x75, 'MOV', ['dir', '#8'], 2); add(0x76, 'MOV', ['@R0', '#8']); add(0x77, 'MOV', ['@R1', '#8']);
for (let n = 0; n < 8; n += 1) add(0x78 + n, 'MOV', [R(n), '#8']);
add(0x83, 'MOVC', ['A', '@A+PC'], 2); add(0x93, 'MOVC', ['A', '@A+DPTR'], 2);
add(0x84, 'DIV', ['AB'], 4); add(0xa4, 'MUL', ['AB'], 4);
add(0x85, 'MOV', ['dir', 'dir'], 2); add(0x86, 'MOV', ['dir', '@R0'], 2); add(0x87, 'MOV', ['dir', '@R1'], 2);
for (let n = 0; n < 8; n += 1) add(0x88 + n, 'MOV', ['dir', R(n)], 2);
add(0x90, 'MOV', ['DPTR', '#16'], 2);
add(0x92, 'MOV', ['bit', 'C'], 2); add(0xa2, 'MOV', ['C', 'bit']);
add(0xa3, 'INC', ['DPTR'], 2);
add(0xa6, 'MOV', ['@R0', 'dir'], 2); add(0xa7, 'MOV', ['@R1', 'dir'], 2);
for (let n = 0; n < 8; n += 1) add(0xa8 + n, 'MOV', [R(n), 'dir'], 2);
add(0xb2, 'CPL', ['bit']); add(0xb3, 'CPL', ['C']);
add(0xb4, 'CJNE', ['A', '#8', 'rel'], 2); add(0xb5, 'CJNE', ['A', 'dir', 'rel'], 2); add(0xb6, 'CJNE', ['@R0', '#8', 'rel'], 2); add(0xb7, 'CJNE', ['@R1', '#8', 'rel'], 2);
for (let n = 0; n < 8; n += 1) add(0xb8 + n, 'CJNE', [R(n), '#8', 'rel'], 2);
add(0xc0, 'PUSH', ['dir'], 2); add(0xd0, 'POP', ['dir'], 2);
add(0xc2, 'CLR', ['bit']); add(0xc3, 'CLR', ['C']); add(0xd2, 'SETB', ['bit']); add(0xd3, 'SETB', ['C']);
add(0xc4, 'SWAP', ['A']); add(0xc5, 'XCH', ['A', 'dir']); add(0xc6, 'XCH', ['A', '@R0']); add(0xc7, 'XCH', ['A', '@R1']);
for (let n = 0; n < 8; n += 1) add(0xc8 + n, 'XCH', ['A', R(n)]);
add(0xd4, 'DA', ['A']); add(0xd5, 'DJNZ', ['dir', 'rel'], 2); add(0xd6, 'XCHD', ['A', '@R0']); add(0xd7, 'XCHD', ['A', '@R1']);
for (let n = 0; n < 8; n += 1) add(0xd8 + n, 'DJNZ', [R(n), 'rel'], 2);
add(0xe0, 'MOVX', ['A', '@DPTR'], 2); add(0xe2, 'MOVX', ['A', '@R0'], 2); add(0xe3, 'MOVX', ['A', '@R1'], 2);
add(0xf0, 'MOVX', ['@DPTR', 'A'], 2); add(0xf2, 'MOVX', ['@R0', 'A'], 2); add(0xf3, 'MOVX', ['@R1', 'A'], 2);
add(0xe4, 'CLR', ['A']); add(0xf4, 'CPL', ['A']);
add(0xe5, 'MOV', ['A', 'dir']); add(0xe6, 'MOV', ['A', '@R0']); add(0xe7, 'MOV', ['A', '@R1']);
for (let n = 0; n < 8; n += 1) add(0xe8 + n, 'MOV', ['A', R(n)]);
add(0xf5, 'MOV', ['dir', 'A']); add(0xf6, 'MOV', ['@R0', 'A']); add(0xf7, 'MOV', ['@R1', 'A']);
for (let n = 0; n < 8; n += 1) add(0xf8 + n, 'MOV', [R(n), 'A']);

export const INSTRUCTIONS = Object.freeze(table);
/** Opcode → instruction (0xA5 is the single undefined opcode). */
export const OPCODES = Object.freeze(Array.from({ length: 256 }, (_, op) => table.find((entry) => entry.op === op) || null));

const operandBytes = { '#8': 1, '#16': 2, dir: 1, bit: 1, '/bit': 1, rel: 1, a11: 1, a16: 2 };
export const instructionSize = (entry) => 1 + entry.args.reduce((sum, kind) => sum + (operandBytes[kind] || 0), 0);

const SFR_NAMES = Object.fromEntries(Object.entries(SFR).map(([name, address]) => [address, name]));
const BIT_NAMES = Object.fromEntries(Object.entries(BITS).map(([name, address]) => [address, name === 'CY' ? 'C' : name]));
const hex = (value, digits) => `${value.toString(16).toUpperCase().padStart(digits, '0')}H`.replace(/^([A-F])/, '0$1');
export const directName = (address) => SFR_NAMES[address] || hex(address, 2);
export function bitName(address) {
  if (BIT_NAMES[address]) return BIT_NAMES[address];
  if (address < 0x80) return `${hex(0x20 + (address >> 3), 2)}.${address & 7}`;
  return `${directName(address & 0xf8)}.${address & 7}`;
}

/** Decode one instruction at `address` from a byte reader. */
export function disassemble(read, address) {
  const op = read(address);
  const entry = OPCODES[op];
  if (!entry) return { address, size: 1, bytes: [op], text: `DB ${hex(op, 2)}`, entry: null };
  const size = instructionSize(entry);
  const bytes = Array.from({ length: size }, (_, k) => read((address + k) & 0xffff));
  let cursor = 1;
  const next = address + size;
  const operands = [];
  const raw = [];
  for (const kind of entry.args) {
    if (kind === '#16' || kind === 'a16') { raw.push((bytes[cursor] << 8) | bytes[cursor + 1]); cursor += 2; } else if (operandBytes[kind]) raw.push(bytes[cursor++]); else raw.push(null);
  }
  // MOV dir,dir stores the source byte first.
  if (op === 0x85) raw.reverse();
  entry.args.forEach((kind, index) => {
    const value = raw[index];
    if (kind === '#8') operands.push(`#${hex(value, 2)}`);
    else if (kind === '#16') operands.push(`#${hex(value, 4)}`);
    else if (kind === 'dir') operands.push(directName(value));
    else if (kind === 'bit') operands.push(bitName(value));
    else if (kind === '/bit') operands.push(`/${bitName(value)}`);
    else if (kind === 'rel') operands.push(hex((next + ((value << 24) >> 24)) & 0xffff, 4));
    else if (kind === 'a11') operands.push(hex((next & 0xf800) | ((op & 0xe0) << 3) | value, 4));
    else if (kind === 'a16') operands.push(hex(value, 4));
    else operands.push(kind);
  });
  return { address, size, bytes, text: operands.length ? `${entry.mnemonic} ${operands.join(', ')}` : entry.mnemonic, entry };
}
