import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVR_EXAMPLES, Cpu8051, Recorder, TrainerBoard, UnoBoard, assemble, createChannel, decodeI2c, decodeSpi, decodeUart,
  estimateBaud, fromVcd, i2cTransaction, levelAt, sliceChannel, spiByte, toImage, toVcd, uartFrame,
} from '../packages/mcu/src/index.mjs';

const example = (id) => { const entry = AVR_EXAMPLES.find((item) => item.id === id); return new UnoBoard(entry.hex, entry.board); };
const ms = (board, milliseconds) => board.cpu.run(Math.round(milliseconds * 16_000));

test('channels: levels, slices and the bounded recorder', () => {
  const recorder = new Recorder(['x'], { maxEdges: 8, initial: 0 });
  for (let k = 1; k <= 20; k += 1) recorder.set('x', k, k % 2);
  const [x] = recorder.list();
  assert.ok(x.edges.length <= 8);
  assert.equal(levelAt(x, 20.5), 0);
  assert.equal(levelAt(x, 19.5), 1);
  assert.equal(levelAt(x, x.edges[0].t - 0.5), x.initial);
  recorder.set('x', 15, 1); // stamped in the past: clamped to the last edge time
  assert.equal(x.edges.at(-1).t, 20);
  const part = sliceChannel(x, 17.5, 19.2);
  assert.deepEqual(part, { name: 'x', initial: 1, edges: [{ t: 18, v: 0 }, { t: 19, v: 1 }] });
});

// Expected frames below were checked against sigrok-cli 0.7.2 (uart, spi and i2c decoders) on the same VCDs.
test('UART decoder: 8N1, 7E1 and 8O2 with automatic baud detection', () => {
  for (const [options, text] of [[{ baud: 9600 }, 'Hi!\n'], [{ baud: 115200, dataBits: 7, parity: 'even' }, 'OpenENTC'], [{ baud: 38400, parity: 'odd', stopBits: 2 }, 'U\x00\xff']]) {
    const line = createChannel('rx', 1);
    let t = 1e-3;
    for (const char of text) t = uartFrame(line, t, char.charCodeAt(0), options) + 0.5 / options.baud;
    assert.equal(estimateBaud(line), options.baud);
    const frames = decodeUart(line, options);
    assert.equal(String.fromCharCode(...frames.map((frame) => frame.value)), text);
    assert.ok(frames.every((frame) => frame.parityOk !== false && !frame.framingError));
  }
  const line = createChannel('rx', 1);
  uartFrame(line, 0, 0x41, { baud: 9600, parity: 'even' });
  assert.equal(decodeUart(line, { baud: 9600, parity: 'odd' })[0].parityOk, false);
});

test('SPI decoder: all four modes, both bit orders, MISO and chip select', () => {
  for (const mode of [0, 1, 2, 3]) {
    for (const lsbFirst of [false, true]) {
      const sck = createChannel('sck', mode >> 1), mosi = createChannel('mosi', 0), miso = createChannel('miso', 0), cs = createChannel('cs', 1);
      cs.edges.push({ t: 0.5e-6, v: 0 });
      let t = 1e-6;
      for (const [out, back] of [[0xa5, 0x3c], [0x01, 0x80], [0xff, 0x00]]) t = spiByte({ sck, mosi, miso }, t, out, back, { mode, lsbFirst }) + 1e-6;
      cs.edges.push({ t, v: 1 });
      const words = decodeSpi({ sck, mosi, miso, cs }, { mode, bitOrder: lsbFirst ? 'lsb' : 'msb' });
      assert.deepEqual(words.map((word) => [word.mosi, word.miso]), [[0xa5, 0x3c], [0x01, 0x80], [0xff, 0x00]], `mode ${mode} lsb ${lsbFirst}`);
    }
  }
});

test('I²C decoder: start, address + R/W, data, ACK/NACK and stop', () => {
  const scl = createChannel('scl', 1), sda = createChannel('sda', 1);
  let t = i2cTransaction({ scl, sda }, 1e-5, 0x27, false, [0x08, 0x0c]);
  i2cTransaction({ scl, sda }, t + 2e-5, 0x68, true, [0x45, 0x12], { acks: [true, true, false] });
  const events = decodeI2c({ scl, sda });
  assert.deepEqual(events.map((event) => event.type === 'address' ? `${event.address.toString(16)}${event.read ? 'R' : 'W'}${event.ack ? '+' : '-'}` : event.type === 'data' ? `${event.value.toString(16)}${event.ack ? '+' : '-'}` : event.type),
    ['start', '27W+', '8+', 'c+', 'stop', 'start', '68R+', '45+', '12-', 'stop']);
});

test('VCD export and import round trip', () => {
  const a = createChannel('clock', 0), b = createChannel('data line', 1);
  for (let k = 1; k <= 10; k += 1) a.edges.push({ t: k * 1e-6, v: k % 2 });
  b.edges.push({ t: 2.5e-6, v: 0 }, { t: 7.25e-6, v: 1 });
  const text = toVcd([a, b], { endTime: 12e-6 });
  assert.match(text, /\$timescale 1ns \$end/);
  assert.ok(text.trimEnd().endsWith('#12000'));
  const [ra, rb] = fromVcd(text);
  assert.equal(ra.name, 'clock'); assert.equal(rb.name, 'data_line');
  assert.equal(ra.initial, 0); assert.equal(rb.initial, 1);
  assert.deepEqual(ra.edges.map((edge) => [Math.round(edge.t * 1e9), edge.v]), a.edges.map((edge) => [Math.round(edge.t * 1e9), edge.v]));
  assert.deepEqual(rb.edges.map((edge) => [Math.round(edge.t * 1e9), edge.v]), [[2500, 0], [7250, 1]]);
});

test('Arduino capture: Serial output on D1 decodes to the text sent', () => {
  const board = example('serial_calc');
  ms(board, 30);
  const text = Buffer.from(board.mcu.usart.output).toString();
  assert.ok(text.length > 10);
  const d1 = board.recorder.channels.get('D1');
  const frames = decodeUart(d1, { baud: estimateBaud(d1) });
  assert.equal(String.fromCharCode(...frames.map((frame) => frame.value)), text.slice(0, frames.length));
  assert.ok(frames.length >= text.length - 1);
});

test('I²C LCD backpack (PCF8574 + Wire) shows text and its SCL/SDA capture decodes', () => {
  const board = example('i2c_lcd');
  ms(board, 900);
  assert.equal(board.view().lcd.lines[0], 'I2C LCD at 0x27 ');
  assert.match(board.view().lcd.lines[1], /^Count: \d+ *$/);
  const events = decodeI2c({ scl: board.recorder.channels.get('A5'), sda: board.recorder.channels.get('A4') });
  const addresses = events.filter((event) => event.type === 'address');
  assert.ok(addresses.length > 50);
  assert.ok(addresses.every((event) => event.address === 0x27 && !event.read && event.ack));
  assert.ok(events.filter((event) => event.type === 'data').every((event) => event.value & 0x08)); // backlight bit
});

test('DS1307 RTC runs on simulated time and the sketch prints it', () => {
  const board = example('rtc_clock');
  board.rtc.setTime(new Date(2026, 9, 2, 13, 45, 58));
  ms(board, 2100);
  const lines = Buffer.from(board.mcu.usart.output).toString().trim().split(/\r?\n/);
  assert.equal(lines[0], 'DS1307 real-time clock');
  assert.deepEqual(lines.slice(1, 4), ['2026-10-02 13:45:58', '2026-10-02 13:45:59', '2026-10-02 13:46:00']);
});

test('74HC595 on SPI: outputs follow the latch and the SCK/MOSI capture decodes', () => {
  const board = example('shift_register');
  ms(board, 5);
  assert.deepEqual(board.view().shift595, [1, 0, 0, 0, 0, 0, 0, 0]);
  ms(board, 130);
  assert.deepEqual(board.view().shift595, [0, 1, 0, 0, 0, 0, 0, 0]);
  const channels = board.recorder.channels;
  const words = decodeSpi({ sck: channels.get('D13'), mosi: channels.get('D11'), miso: channels.get('D12'), cs: channels.get('D10') }, { mode: 0 });
  assert.deepEqual(words.map((word) => word.mosi), [1, 2]);
});

test('8051 capture: serial output on P3.1 and port pins', () => {
  const source = `
        MOV TMOD,#20H
        MOV TH1,#0FDH
        MOV SCON,#50H
        SETB TR1
        MOV DPTR,#TEXT
NEXT:   CLR A
        MOVC A,@A+DPTR
        JZ DONE
        MOV SBUF,A
WAIT:   JNB TI,WAIT
        CLR TI
        CPL P1.0
        INC DPTR
        SJMP NEXT
DONE:   SJMP DONE
TEXT:   DB 'OK 8051',0`;
  const result = assemble(source);
  assert.deepEqual(result.errors, []);
  const cpu = new Cpu8051({ clock: 11_059_200 });
  cpu.load(toImage(result.bytes));
  const board = new TrainerBoard(cpu);
  cpu.run(11_059_200 / 12 * 0.02);
  const txd = board.recorder.channels.get('P3.1');
  assert.equal(estimateBaud(txd), 9600);
  assert.equal(String.fromCharCode(...decodeUart(txd, { baud: 9600 }).map((frame) => frame.value)), 'OK 8051');
  assert.equal(board.recorder.channels.get('P1.0').edges.length, 7);
});
