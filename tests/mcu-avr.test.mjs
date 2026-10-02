import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AVR_EXAMPLES, AvrCpu, UnoBoard, createAtmega328p, parseIntelHex, unoPin } from '../packages/mcu/src/index.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/avr/${name}`, import.meta.url), 'utf8');
function runHex(name, until = 'done\n', limit = 80_000_000) {
  const mcu = createAtmega328p(AvrCpu);
  mcu.cpu.loadImage(parseIntelHex(fixture(name)).image);
  let text = '';
  while (!text.includes(until) && mcu.cpu.cycles < limit && !mcu.cpu.halted) { mcu.cpu.run(500_000); text = Buffer.from(mcu.usart.output).toString(); }
  return { text, mcu };
}
const example = (id) => { const entry = AVR_EXAMPLES.find((item) => item.id === id); return new UnoBoard(entry.hex, entry.board); };
const ms = (board, milliseconds) => board.cpu.run(Math.round(milliseconds * 16_000));
const serial = (board) => Buffer.from(board.mcu.usart.output).toString();

// t1.c (avr-gcc -Os): 8/16/32-bit and float arithmetic, CRC-32, qsort, PROGMEM — output identical to simavr.
test('compiled C program output matches simavr exactly', () => {
  const { text } = runHex('t1.hex');
  assert.equal(text, ['u8 600 28 5', 'i16 28501 -1763 -8 -1544', 'u32 3820130823 3000000 82', 's32 431655765', 'float 8172 -32377', 'crc ffbae609',
    '-902 -809 -655 -548 -527 -283 -94 -93 85 160 208 267 347 382 570 589 676 806 879 884 ', 'flash string 12', 'fib 28657', 'done', ''].join('\n'));
});

// t2.c: Timer1 cycle counts of code blocks equal simavr's; interrupts, INT0, pin-change and EEPROM work.
test('instruction timing, timers, interrupts and EEPROM', () => {
  const { text } = runHex('t2.hex');
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(0, 5), ['loop 1309', 'div 1248', 'mul 65', 'float 974', 'delay 1602']);
  assert.match(lines[5], /^ov0 25 cm1 2[67] ov2 1 int0 10 pc 10 /);
  assert.equal(lines[6], 'ee a5 beef ff');
});

// t3.c: an empty (naked) INT0 handler costs 4 (response) + 3 (JMP) + 4 (RETI) = 11 cycles per the datasheet.
test('interrupt response time follows the ATmega328P datasheet', () => {
  const { text } = runHex('t3.hex');
  assert.match(text, /^no-int 8 with-int 19\n/);
});

test('Arduino sketches built with the official core run on the Uno model', () => {
  const blink = example('blink');
  const edges = [];
  let last = -1;
  for (let t = 0; t < 1600; t += 1) { ms(blink, 1); const level = blink.level(13); if (level !== last) { edges.push(t); last = level; } }
  assert.deepEqual(edges, [0, 500, 1000, 1500], 'millis()/delay() timing');

  const pot = example('analog_read');
  ms(pot, 600); pot.setPot('A0', 3.3); ms(pot, 600);
  assert.match(serial(pot), /A0 = 512 {2}\(2\.50 V\)[\s\S]*A0 = 675 {2}\(3\.30 V\)/);

  const calc = example('serial_calc');
  ms(calc, 50); calc.mcu.usart.receive([...Buffer.from('12\n')]); ms(calc, 1200);
  assert.match(serial(calc), /12 squared = 144, cubed = 1728/);

  const lcd = example('lcd_hello');
  ms(lcd, 2600);
  assert.deepEqual(lcd.view().lcd.lines, ['Hello, ENTC!    ', 'Uptime: 2 s     ']);

  const counter = example('interrupt_counter');
  ms(counter, 50);
  for (let k = 0; k < 3; k += 1) { counter.press(2, true); ms(counter, 20); counter.press(2, false); ms(counter, 20); }
  ms(counter, 100);
  assert.match(serial(counter), /Presses: 3/);

  const fade = example('fade');
  ms(fade, 400);
  const duty = fade.brightness(9);
  assert.ok(duty > 0 && duty < 1, `PWM duty ${duty}`);
});

test('pin mapping and board inputs', () => {
  assert.deepEqual(unoPin(13), { port: 'B', bit: 5, number: 13 });
  assert.deepEqual(unoPin('A2'), { port: 'C', bit: 2, number: 16 });
  assert.throws(() => unoPin(22), /0–13/);
  const button = example('button');
  ms(button, 5);
  assert.equal(button.level(13), 0);
  button.press(2, true); ms(button, 5);
  assert.equal(button.level(13), 1);
  const view = button.view();
  assert.equal(view.pins.length, 20);
  assert.equal(view.pins[2].pullUp, true);
  assert.equal(view.pins[13].output, true);
});
