import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, Cpu8051, disassemble, EXAMPLES_8051, OPCODES, parseIntelHex, toImage, toIntelHex, TrainerBoard } from '../packages/mcu/src/index.mjs';

function load(source) {
  const result = assemble(source);
  assert.deepEqual(result.errors, [], 'assembles cleanly');
  const cpu = new Cpu8051();
  cpu.load(toImage(result.bytes));
  return { cpu, result };
}
const runTo = (cpu, address, limit = 5_000_000) => { let guard = 0; while (cpu.pc !== address && guard++ < limit) cpu.step(); assert.equal(cpu.pc, address, 'reached the stop label'); };

test('instruction table covers the 255 defined opcodes', () => {
  assert.equal(OPCODES.filter(Boolean).length, 255);
  assert.equal(OPCODES[0xa5], null);
});

// Encodings checked byte-for-byte against SDCC sdas8051 for every opcode.
test('assembler encodings, symbols, directives and errors', () => {
  const { result } = load(`
LED   BIT  P1.3
COUNT EQU  10
      ORG  0
START: MOV  A,#COUNT
      MOV  31H,30H
      SETB LED
      JB   P3.2,START
      AJMP START
      LCALL SUB
      CJNE A,#'A',START
      MOV  DPTR,#TABLE
      SJMP $
SUB:  RET
TABLE: DB 'Hi',0
      DW  1234H
      END`);
  const bytes = [...result.bytes.values()];
  assert.deepEqual(bytes.slice(0, 2), [0x74, 10]);
  assert.deepEqual(bytes.slice(2, 5), [0x85, 0x30, 0x31], 'MOV dir,dir stores the source first');
  assert.deepEqual(bytes.slice(5, 7), [0xd2, 0x93], 'P1.3 is bit 93H');
  assert.deepEqual(bytes.slice(7, 10), [0x20, 0xb2, 0xf6]);
  assert.deepEqual(bytes.slice(10, 12), [0x01, 0x00]);
  assert.equal(result.symbols.TABLE.value, result.symbols.SUB.value + 1);
  assert.deepEqual(bytes.slice(-5), [0x48, 0x69, 0x00, 0x12, 0x34]);
  const bad = assemble('  MOV A,#300\n  FOO R0\n  SJMP FAR\n  ORG 200H\nFAR: NOP');
  assert.equal(bad.errors.length, 3);
  assert.match(bad.errors.map((e) => e.message).join(' '), /8 bits[\s\S]*Unknown instruction[\s\S]*relative jumps/);
  assert.equal(disassemble((a) => [0x85, 0x30, 0x31][a] ?? 0, 0).text, 'MOV 31H, 30H');
});

test('arithmetic flags: ADD, ADDC, SUBB, DA, MUL, DIV', () => {
  const { cpu, result } = load(`
      MOV A,#7FH
      ADD A,#01H      ; 80H: OV=1 AC=1 CY=0
      MOV 40H,PSW
      MOV A,#0FFH
      ADD A,#01H      ; 00H: CY=1 AC=1 OV=0
      MOV 41H,PSW
      CLR C
      MOV A,#10H
      SUBB A,#20H     ; F0H: CY=1 OV=0
      MOV 42H,A
      MOV 43H,PSW
      MOV A,#59H
      ADD A,#38H
      DA A            ; 97 BCD
      MOV 44H,A
      MOV A,#200
      MOV B,#200
      MUL AB          ; 40000 = 9C40H, OV=1
      MOV 45H,A
      MOV 46H,B
      MOV 47H,PSW
      MOV A,#5
      MOV B,#0
      DIV AB          ; OV=1 on divide by zero
      MOV 48H,PSW
STOP: SJMP STOP`);
  runTo(cpu, result.symbols.STOP.value);
  assert.equal(cpu.iram[0x40] & 0xc4, 0x44, 'ADD 7F+1: AC and OV');
  assert.equal(cpu.iram[0x41] & 0xc4, 0xc0, 'ADD FF+1: CY and AC');
  assert.equal(cpu.iram[0x42], 0xf0);
  assert.equal(cpu.iram[0x43] & 0x84, 0x80, 'SUBB borrow');
  assert.equal(cpu.iram[0x44], 0x97, 'decimal adjust');
  assert.deepEqual([cpu.iram[0x45], cpu.iram[0x46]], [0x40, 0x9c]);
  assert.equal(cpu.iram[0x47] & 0x84, 0x04, 'MUL overflow');
  assert.equal(cpu.iram[0x48] & 0x84, 0x04, 'DIV by zero sets OV');
});

// Program and expected values cross-checked against the ucsim s51 simulator (48 720 clocks).
test('timer-0 interrupts, calls and lookup tables match ucsim timing', () => {
  const { cpu, result } = load(`
	ORG 0
	LJMP MAIN
	ORG 0BH
	LJMP T0ISR
	ORG 30H
MAIN:	MOV SP,#60H
	MOV 40H,#0
	MOV R7,#0
	MOV TMOD,#01H
	MOV TH0,#0FCH
	MOV TL0,#18H
	SETB ET0
	SETB EA
	SETB TR0
	MOV DPTR,#TABLE
	MOV R2,#0
	MOV R3,#5
SUMLP:	MOV A,R2
	MOVC A,@A+DPTR
	ADD A,40H
	MOV 40H,A
	INC R2
	DJNZ R3,SUMLP
	ACALL SQUARE
	MOV 42H,A
WAIT:	CJNE R7,#4,WAIT
	CLR TR0
	JNB 20H.0,SKIP
	MOV 43H,#99H
SKIP:	MOV 44H,TL0
	MOV 45H,TH0
DONE:	SJMP DONE
SQUARE:	MOV A,40H
	MOV B,A
	MUL AB
	MOV 41H,B
	RET
T0ISR:	MOV TH0,#0FCH
	MOV TL0,#18H
	INC R7
	SETB 20H.0
	RETI
TABLE:	DB 1,2,3,4,5`);
  runTo(cpu, result.symbols.DONE.value);
  assert.equal(cpu.cycles * 12, 48720);
  assert.deepEqual([...cpu.iram.slice(0x40, 0x46)], [0x0f, 0x00, 0xe1, 0x99, 0x20, 0xfc]);
});

test('UART mode 1 transmits and receives at the timer-1 baud rate', () => {
  const example = EXAMPLES_8051.find((entry) => entry.id === 'serial-hello');
  const { cpu } = load(example.source);
  cpu.run(200_000);
  assert.equal(Buffer.from(cpu.serialOutput).toString(), 'Hello from 8051!\r\nType a key: ');
  cpu.serialOutput.length = 0;
  cpu.receive([0x41]);
  cpu.run(5000);
  assert.equal(cpu.portPins()[1], 0x41, 'received byte shown on P1');
  assert.deepEqual(cpu.serialOutput, [0x41], 'and echoed');
});

test('trainer board: LCD, seven-segment, switches, INT0 button and keypad', () => {
  const lcdExample = EXAMPLES_8051.find((entry) => entry.id === 'lcd-hello');
  let { cpu } = load(lcdExample.source);
  let board = new TrainerBoard(cpu, lcdExample.wiring);
  cpu.run(100_000);
  assert.deepEqual(board.view().lcd.lines, ['HELLO ENTC      ', '8051 TRAINER    ']);

  const segment = EXAMPLES_8051.find((entry) => entry.id === 'seven-segment');
  ({ cpu } = load(segment.source));
  board = new TrainerBoard(cpu, segment.wiring);
  cpu.run(1000);
  assert.equal(board.view().digit, '0');

  const switches = EXAMPLES_8051.find((entry) => entry.id === 'switch-to-led');
  ({ cpu } = load(switches.source));
  board = new TrainerBoard(cpu, switches.wiring);
  board.setSwitches(0b11110010); // switches 0, 2, 3 closed
  cpu.run(100);
  assert.deepEqual(board.view().leds, [true, false, true, true, false, false, false, false]);

  const counter = EXAMPLES_8051.find((entry) => entry.id === 'int0-counter');
  ({ cpu } = load(counter.source));
  board = new TrainerBoard(cpu, counter.wiring);
  cpu.run(200);
  for (let press = 0; press < 3; press += 1) { board.setButton(0, true); cpu.run(50); board.setButton(0, false); cpu.run(50); }
  assert.equal(board.view().digit, '3', 'three falling edges counted');

  const keypad = EXAMPLES_8051.find((entry) => entry.id === 'keypad');
  ({ cpu } = load(keypad.source));
  board = new TrainerBoard(cpu, keypad.wiring);
  board.setKey(2, 1, true);
  cpu.run(2000);
  assert.equal(cpu.portPins()[2], 9, 'row 2, column 1 → key 9');
});

test('BCD example and Intel HEX round trip', () => {
  const example = EXAMPLES_8051.find((entry) => entry.id === 'bcd-arithmetic');
  const { cpu, result } = load(example.source);
  cpu.run(200);
  assert.deepEqual([...cpu.iram.slice(0x40, 0x46)], [0x33, 0x21, 0x2c, 0x01, 28, 4]);
  const hex = toIntelHex(result.bytes);
  assert.match(hex, /^:10000000/);
  assert.ok(hex.trimEnd().endsWith(':00000001FF'));
  const parsed = parseIntelHex(hex);
  for (const [address, value] of result.bytes) assert.equal(parsed.image[address], value);
  assert.throws(() => parseIntelHex(':0100000000FE'), /checksum/);
});

test('every example assembles and runs without halting', () => {
  for (const example of EXAMPLES_8051) {
    const result = assemble(example.source);
    assert.deepEqual(result.errors, [], example.id);
    const cpu = new Cpu8051();
    cpu.load(toImage(result.bytes));
    new TrainerBoard(cpu, example.wiring);
    cpu.run(20_000);
    assert.equal(cpu.halted, false, example.id);
  }
});
