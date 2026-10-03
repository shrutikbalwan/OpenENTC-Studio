// Two-pass MCS-51 assembler (Intel/Keil A51-style syntax).
// Supports labels, ORG, DB, DW, DS, EQU, SET, DATA, BIT, CODE, END, $-directives (ignored),
// expressions with + - * / MOD AND OR XOR NOT SHL SHR HIGH() LOW() and C operators, and
// generic JMP/CALL (assembled as LJMP/LCALL).
import { BITS, INSTRUCTIONS, SFR, instructionSize } from './isa.mjs';

const LITERAL_KINDS = new Set(['A', 'AB', 'C', 'DPTR', '@A+DPTR', '@A+PC', '@DPTR', '@R0', '@R1', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);
const BY_MNEMONIC = INSTRUCTIONS.reduce((map, entry) => { (map[entry.mnemonic] ||= []).push(entry); return map; }, {});
const ALIASES = { JMP: 'LJMP', CALL: 'LCALL' };

export class AssemblyError extends Error {
  constructor(message, line) { super(line ? `Line ${line}: ${message}` : message); this.line = line; }
}

function parseNumber(token) {
  const text = token.toUpperCase();
  if (/^0X[0-9A-F]+$/.test(text)) return parseInt(text.slice(2), 16);
  if (/^0B[01]+$/.test(text)) return parseInt(text.slice(2), 2);
  if (/^[0-9][0-9A-F]*H$/.test(text)) return parseInt(text.slice(0, -1), 16);
  if (/^[01]+B$/.test(text)) return parseInt(text.slice(0, -1), 2);
  if (/^[0-7]+[OQ]$/.test(text)) return parseInt(text.slice(0, -1), 8);
  if (/^[0-9]+D?$/.test(text)) return parseInt(text, 10);
  return null;
}

function tokenize(text, line) {
  const tokens = [];
  const pattern = /\s*(?:('(?:[^'\\]|\\.)')|([0-9][0-9A-Za-z]*)|([A-Za-z_?][A-Za-z0-9_?]*)|(<<|>>|[-+*/%&|^~().$]))/y;
  let match;
  while (pattern.lastIndex < text.length) {
    const start = pattern.lastIndex;
    if (!text.slice(start).trim()) break;
    match = pattern.exec(text);
    if (!match) throw new AssemblyError(`Cannot read "${text.slice(start).trim()}" in expression.`, line);
    if (match[1]) tokens.push({ type: 'num', value: match[1].slice(1, -1).replace(/\\(.)/, '$1').charCodeAt(0) });
    else if (match[2]) { const value = parseNumber(match[2]); if (value === null) throw new AssemblyError(`Bad number "${match[2]}".`, line); tokens.push({ type: 'num', value }); }
    else if (match[3]) tokens.push({ type: 'name', value: match[3].toUpperCase() });
    else tokens.push({ type: 'op', value: match[4] });
  }
  return tokens;
}

const WORD_OPERATORS = { MOD: '%', AND: '&', OR: '|', XOR: '^', SHL: '<<', SHR: '>>' };

/** Evaluate an expression; unknown symbols yield `undefined` when `lenient` (pass 1). */
function evaluate(text, context, line, lenient) {
  const tokens = tokenize(text, line).map((token) => (token.type === 'name' && WORD_OPERATORS[token.value] ? { type: 'op', value: WORD_OPERATORS[token.value] } : token.type === 'name' && token.value === 'NOT' ? { type: 'op', value: '~' } : token));
  let position = 0;
  let unknown = false;
  const peek = () => tokens[position];
  const isOp = (value) => peek()?.type === 'op' && peek().value === value;
  const binary = (next, operators) => () => {
    let left = next();
    while (peek()?.type === 'op' && operators.includes(peek().value)) {
      const op = tokens[position++].value, right = next();
      left = { '+': left + right, '-': left - right, '*': left * right, '/': right ? Math.trunc(left / right) : 0, '%': right ? left % right : 0, '&': left & right, '|': left | right, '^': left ^ right, '<<': left << right, '>>': left >> right }[op];
    }
    return left;
  };
  function primary() {
    const token = tokens[position++];
    if (!token) throw new AssemblyError(`Expression "${text}" ends unexpectedly.`, line);
    if (token.type === 'num') return token.value;
    if (token.type === 'op' && token.value === '(') { const value = or(); if (!isOp(')')) throw new AssemblyError(`Missing ")" in "${text}".`, line); position += 1; return value; }
    if (token.type === 'op' && token.value === '-') return -bitSelect();
    if (token.type === 'op' && token.value === '+') return bitSelect();
    if (token.type === 'op' && token.value === '~') return ~bitSelect() & 0xffff;
    if (token.type === 'op' && token.value === '$') return context.pc;
    if (token.type === 'name') {
      if ((token.value === 'HIGH' || token.value === 'LOW') && isOp('(')) { const value = primary(); return token.value === 'HIGH' ? (value >> 8) & 0xff : value & 0xff; }
      if (token.value in context.symbols) return context.symbols[token.value].value;
      if (lenient) { unknown = true; return 0; }
      throw new AssemblyError(`Unknown symbol "${token.value}".`, line);
    }
    throw new AssemblyError(`Unexpected "${token.value}" in "${text}".`, line);
  }
  // `byte.bit` addressing: P1.3, 20H.0, ACC.7
  function bitSelect() {
    const base = primary();
    if (!isOp('.')) return base;
    position += 1;
    const bit = primary();
    if (bit < 0 || bit > 7) throw new AssemblyError(`Bit number must be 0–7 in "${text}".`, line);
    if (base >= 0x20 && base <= 0x2f) return (base - 0x20) * 8 + bit;
    if (base >= 0x80 && base <= 0xff && base % 8 === 0) return base + bit;
    if (lenient && unknown) return 0;
    throw new AssemblyError(`${base.toString(16).toUpperCase()}H is not bit-addressable.`, line);
  }
  const multiplicative = binary(bitSelect, ['*', '/', '%']);
  const additive = binary(multiplicative, ['+', '-']);
  const shift = binary(additive, ['<<', '>>']);
  const and = binary(shift, ['&']);
  const xor = binary(and, ['^']);
  const or = binary(xor, ['|']);
  const value = or();
  if (position < tokens.length) throw new AssemblyError(`Unexpected "${tokens[position].value}" in "${text}".`, line);
  return unknown ? undefined : value;
}

/** Split operands on commas outside quotes. */
function splitOperands(text) {
  const parts = [];
  let current = '', quote = false;
  for (const character of text) {
    if (character === "'") quote = !quote;
    if (character === ',' && !quote) { parts.push(current.trim()); current = ''; } else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function classify(operand) {
  const upper = operand.toUpperCase().replace(/\s+/g, '');
  if (LITERAL_KINDS.has(upper)) return { kind: upper };
  if (upper.startsWith('#')) return { kind: 'imm', text: operand.trim().slice(1) };
  if (upper.startsWith('/')) return { kind: 'nbit', text: operand.trim().slice(1) };
  return { kind: 'expr', text: operand.trim() };
}

const ACCEPTS = { '#8': 'imm', '#16': 'imm', dir: 'expr', bit: 'expr', '/bit': 'nbit', rel: 'expr', a11: 'expr', a16: 'expr' };

function selectInstruction(mnemonic, operands, line) {
  const candidates = BY_MNEMONIC[mnemonic];
  if (!candidates && !ALIASES[mnemonic]) throw new AssemblyError(`Unknown instruction "${mnemonic}".`, line);
  const classified = operands.map(classify);
  // PUSH A / POP A are common slips for ACC.
  if ((mnemonic === 'PUSH' || mnemonic === 'POP') && classified[0]?.kind === 'A') classified[0] = { kind: 'expr', text: 'ACC' };
  const match = (candidates || []).find((entry) => entry.args.length === classified.length && entry.args.every((kind, index) => (LITERAL_KINDS.has(kind) ? classified[index].kind === kind : classified[index].kind === ACCEPTS[kind])));
  if (!match) throw new AssemblyError(`${mnemonic} does not take operands "${operands.join(', ')}".`, line);
  return { entry: match, classified };
}

function parseLine(raw) {
  let text = '';
  let quote = false;
  for (const character of raw) { if (character === "'") quote = !quote; if (character === ';' && !quote) break; text += character; }
  text = text.trim();
  const result = { label: null, name: null, mnemonic: null, operands: '' };
  if (!text || text.startsWith('$')) return result;
  const labelMatch = text.match(/^([A-Za-z_?][A-Za-z0-9_?]*)\s*:\s*(.*)$/);
  if (labelMatch) { result.label = labelMatch[1].toUpperCase(); text = labelMatch[2]; }
  // NAME EQU value / NAME BIT P1.0 / NAME DATA 30H
  const defineMatch = text.match(/^([A-Za-z_?][A-Za-z0-9_?]*)\s+(EQU|SET|DATA|BIT|CODE|IDATA|XDATA)\s+(.+)$/i);
  if (defineMatch) { result.name = defineMatch[1].toUpperCase(); result.mnemonic = defineMatch[2].toUpperCase(); result.operands = defineMatch[3].trim(); return result; }
  const instruction = text.match(/^([A-Za-z]+)\s*(.*)$/);
  if (instruction) { result.mnemonic = instruction[1].toUpperCase(); result.operands = instruction[2].trim(); }
  else if (text) result.mnemonic = text.toUpperCase();
  return result;
}

function dataItems(operands, context, line, lenient, word) {
  const bytes = [];
  for (const item of splitOperands(operands)) {
    const string = item.match(/^'(.*)'$/s) || item.match(/^"(.*)"$/s);
    if (string && !word && string[1].length !== 1) { for (const character of string[1]) bytes.push(character.charCodeAt(0) & 0xff); continue; }
    const value = evaluate(item, context, line, lenient) ?? 0;
    if (word) bytes.push((value >> 8) & 0xff, value & 0xff); else bytes.push(value & 0xff);
  }
  return bytes;
}

function encode(entry, classified, context, line, lenient) {
  const bytes = [entry.op];
  const next = context.pc + instructionSize(entry);
  const operandValues = [];
  entry.args.forEach((kind, index) => {
    if (LITERAL_KINDS.has(kind)) return;
    let value = evaluate(classified[index].text, context, line, lenient);
    const known = value !== undefined;
    if (!known) value = kind === 'rel' || kind === 'a11' ? next : 0;
    const check = (ok, message) => { if (known && !ok) throw new AssemblyError(message, line); };
    if (kind === '#8') { check(value >= -128 && value <= 255, `Immediate ${value} does not fit in 8 bits.`); operandValues.push([value & 0xff]); }
    else if (kind === '#16') { check(value >= -32768 && value <= 0xffff, `Immediate ${value} does not fit in 16 bits.`); operandValues.push([(value >> 8) & 0xff, value & 0xff]); }
    else if (kind === 'dir' || kind === 'bit' || kind === '/bit') { check(value >= 0 && value <= 0xff, `Address ${value} is outside 00H–FFH.`); operandValues.push([value & 0xff]); }
    else if (kind === 'rel') { const offset = value - next; check(offset >= -128 && offset <= 127, `Jump target is ${offset} bytes away; relative jumps reach −128…+127 (use LJMP).`); operandValues.push([offset & 0xff]); }
    else if (kind === 'a11') { check((value & 0xf800) === (next & 0xf800), 'AJMP/ACALL target is outside the current 2 KB page.'); bytes[0] = entry.op | ((value >> 3) & 0xe0); operandValues.push([value & 0xff]); }
    else if (kind === 'a16') { check(value >= 0 && value <= 0xffff, 'Address must be 0000H–FFFFH.'); operandValues.push([(value >> 8) & 0xff, value & 0xff]); }
  });
  if (entry.op === 0x85) operandValues.reverse(); // MOV dir,dir encodes source first
  return bytes.concat(...operandValues);
}

function builtinSymbols() {
  const symbols = {};
  for (const [name, value] of Object.entries(SFR)) symbols[name] = { value, kind: 'sfr' };
  for (const [name, value] of Object.entries(BITS)) symbols[name] = { value, kind: 'bit' };
  return symbols;
}

/**
 * Assemble source text. Returns { bytes (Map address→byte), listing, symbols, size, errors }.
 * Errors are collected (assembly stops at 50) instead of throwing.
 */
export function assemble(source) {
  if (typeof source !== 'string') throw new TypeError('Source must be text.');
  if (source.length > 500_000) throw new RangeError('Source is too large (500 KB limit).');
  const lines = source.split(/\r?\n/);
  const context = { pc: 0, symbols: builtinSymbols() };
  const user = new Set();
  const errors = [];
  const record = (error, line) => { errors.push({ line, message: error instanceof AssemblyError ? error.message : `Line ${line}: ${error.message}` }); };
  const parsed = lines.map(parseLine);
  for (let pass = 1; pass <= 2; pass += 1) {
    context.pc = 0;
    const lenient = pass === 1;
    const memory = new Map();
    const listing = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const line = index + 1, item = parsed[index];
      const start = context.pc;
      let bytes = [];
      try {
        if (item.label) {
          if (pass === 1) {
            if (user.has(item.label)) throw new AssemblyError(`Label "${item.label}" is defined twice.`, line);
            if (item.label in context.symbols) throw new AssemblyError(`"${item.label}" is a reserved name.`, line);
            user.add(item.label);
          }
          context.symbols[item.label] = { value: context.pc, kind: 'code' };
        }
        const mnemonic = item.mnemonic;
        if (!mnemonic) { listing.push({ line, address: null, bytes: [], source: lines[index] }); continue; }
        if (item.name) {
          if (pass === 1 && user.has(item.name) && mnemonic !== 'SET') throw new AssemblyError(`"${item.name}" is defined twice.`, line);
          const value = evaluate(item.operands, context, line, lenient);
          if (value !== undefined || pass === 1) context.symbols[item.name] = { value: value ?? 0, kind: mnemonic === 'BIT' ? 'bit' : 'value' };
          user.add(item.name);
        } else if (mnemonic === 'END') { listing.push({ line, address: null, bytes: [], source: lines[index] }); break; }
        else if (mnemonic === 'ORG') { const value = evaluate(item.operands, context, line, false); if (value < 0 || value > 0xffff) throw new AssemblyError('ORG address must be 0000H–FFFFH.', line); context.pc = value; }
        else if (mnemonic === 'DB' || mnemonic === 'DW') bytes = dataItems(item.operands, context, line, lenient, mnemonic === 'DW');
        else if (mnemonic === 'DS') { const count = evaluate(item.operands, context, line, false); if (count < 0 || count > 0x10000) throw new AssemblyError('DS size is out of range.', line); context.pc += count; }
        else if (['USING', 'CSEG', 'NAME', 'PUBLIC', 'EXTRN', 'RSEG', 'SEGMENT'].includes(mnemonic)) { /* accepted for compatibility */ }
        else {
          const operandList = item.operands ? splitOperands(item.operands) : [];
          let selection;
          try { selection = selectInstruction(mnemonic, operandList, line); } catch (error) { if (!ALIASES[mnemonic]) throw error; selection = selectInstruction(ALIASES[mnemonic], operandList, line); }
          const { entry, classified } = selection;
          bytes = encode(entry, classified, context, line, lenient);
        }
        bytes.forEach((byte, k) => {
          const address = (context.pc + k) & 0xffff;
          if (pass === 2 && memory.has(address)) throw new AssemblyError(`Code overlaps at ${address.toString(16).toUpperCase()}H.`, line);
          memory.set(address, byte);
        });
        context.pc += bytes.length;
        if (context.pc > 0x10000) throw new AssemblyError('Program runs past FFFFH.', line);
        listing.push({ line, address: bytes.length || item.label ? start : null, bytes, source: lines[index] });
      } catch (error) {
        if (pass === 1 || !errors.some((entry) => entry.line === line)) record(error, line);
        listing.push({ line, address: null, bytes: [], source: lines[index], error: true });
        if (errors.length >= 50) break;
      }
    }
    if (pass === 2) {
      const userSymbols = Object.fromEntries([...user].map((name) => [name, context.symbols[name]]));
      const size = memory.size ? Math.max(...memory.keys()) + 1 : 0;
      return { bytes: memory, listing, symbols: userSymbols, size, errors };
    }
  }
  return { bytes: new Map(), listing: [], symbols: {}, size: 0, errors };
}

/** Flatten assembled bytes into a 64 KB code image (unused bytes are 0xFF). */
export function toImage(bytes) {
  const image = new Uint8Array(0x10000).fill(0xff);
  for (const [address, value] of bytes) image[address] = value;
  return image;
}
