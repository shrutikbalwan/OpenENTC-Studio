// Arduino Uno board model: digital pins D0–D13 and A0–A5 mapped to ATmega328P ports, LEDs
// (with PWM brightness), push buttons, potentiometers and an HD44780 LCD on any six pins.
import { AvrCpu } from './cpu.mjs';
import { Ds1307, Pcf8574, createAtmega328p } from './peripherals.mjs';
import { Hd44780, parseIntelHex } from '../i8051/peripherals.mjs';
import { Recorder } from '../analyzer.mjs';

/** Arduino pin number (0–19, or 'A0'–'A5') → { port, bit }. */
export function unoPin(pin) {
  const number = typeof pin === 'string' && /^A[0-5]$/i.test(pin) ? 14 + Number(pin.slice(1)) : Number(pin);
  if (!Number.isInteger(number) || number < 0 || number > 19) throw new RangeError(`Arduino pin must be 0–13 or A0–A5, not "${pin}".`);
  if (number < 8) return { port: 'D', bit: number, number };
  if (number < 14) return { port: 'B', bit: number - 8, number };
  return { port: 'C', bit: number - 14, number };
}

export const PIN_LABELS = [...Array.from({ length: 14 }, (_, n) => `D${n}`), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const PWM_PINS = { 3: ['Timer2', 'B'], 5: ['Timer0', 'B'], 6: ['Timer0', 'A'], 9: ['Timer1', 'A'], 10: ['Timer1', 'B'], 11: ['Timer2', 'A'] };

export const DEFAULT_UNO_BOARD = Object.freeze({ leds: [13], buttons: [{ pin: 2, to: 'GND' }], pots: [{ pin: 'A0', volts: 2.5 }], lcd: null, i2cLcd: null, rtc: false, shift595: null });

export class UnoBoard {
  constructor(hexText, board = DEFAULT_UNO_BOARD, { clock = 16_000_000, capture = true } = {}) {
    this.mcu = createAtmega328p(AvrCpu, { clock });
    this.cpu = this.mcu.cpu;
    if (hexText) this.cpu.loadImage(parseIntelHex(hexText).image);
    this.board = { ...structuredClone(DEFAULT_UNO_BOARD), ...structuredClone(board) };
    this.pressed = new Set();
    this.lcd = new Hd44780();
    this.history = [];
    this.shiftOutputs = 0; this.shiftRegister = 0;
    for (const port of Object.values(this.mcu.ports)) port.listeners.push(() => this.portChanged());
    if (this.board.i2cLcd) {
      const expander = new Pcf8574(this.board.i2cLcd.address ?? 0x27);
      expander.listeners.push((byte) => this.lcd.clock(byte & 1, (byte >> 1) & 1, (byte >> 2) & 1, byte & 0xf0));
      this.mcu.twi.devices.push(expander);
      this.expander = expander;
    }
    if (this.board.rtc) { this.rtc = new Ds1307(this.cpu); this.mcu.twi.devices.push(this.rtc); }
    if (this.board.shift595) this.mcu.spi.listeners.push((transfer) => { this.shiftRegister = transfer.value; });
    if (capture) this.startCapture();
    this.apply();
  }

  /** Record every pin plus the waveforms the USART, SPI and TWI hardware put on their pins. */
  startCapture() {
    const recorder = new Recorder(PIN_LABELS);
    this.recorder = recorder;
    this.lastLevels = { B: -1, C: -1, D: -1 };
    const seconds = (cycle) => cycle / this.cpu.clock;
    this.mcu.usart.listeners.push(({ enable, value, startCycle, baud, dataBits, parity, stopBits }) => {
      if (enable) { recorder.set('D1', seconds(startCycle), 1); return; }
      const bit = 1 / baud;
      let t = seconds(startCycle);
      recorder.set('D1', t, 0); t += bit;
      let ones = 0;
      for (let k = 0; k < dataBits; k += 1) { const b = (value >> k) & 1; ones += b; recorder.set('D1', t, b); t += bit; }
      if (parity !== 'none') { recorder.set('D1', t, parity === 'even' ? ones % 2 : (ones + 1) % 2); t += bit; }
      recorder.set('D1', t, 1);
      void stopBits;
    });
    this.mcu.spi.listeners.push(({ value, miso, start, div, mode, lsbFirst }) => {
      const half = div / 2 / this.cpu.clock, cpol = mode >> 1, cpha = mode & 1;
      let t = seconds(start);
      recorder.set('D13', t, cpol); // SCK idles at CPOL between transfers
      for (let k = 0; k < 8; k += 1) {
        const index = lsbFirst ? k : 7 - k;
        const put = () => { recorder.set('D11', t, (value >> index) & 1); recorder.set('D12', t, (miso >> index) & 1); };
        if (!cpha) { put(); t += half; recorder.set('D13', t, 1 - cpol); t += half; recorder.set('D13', t, cpol); }
        else { recorder.set('D13', t, 1 - cpol); put(); t += half; recorder.set('D13', t, cpol); t += half; }
      }
    });
    this.mcu.twi.listeners.push((event) => {
      const q = event.period / 4 / this.cpu.clock;
      let t = seconds(event.cycle);
      const scl = (v) => recorder.set('A5', t, v), sda = (v) => recorder.set('A4', t, v);
      if (event.type === 'start' || event.type === 'repeated-start') { sda(1); t += q; scl(1); t += q; sda(0); t += q; scl(0); return; }
      if (event.type === 'stop') { scl(0); sda(0); t += q; scl(1); t += q; sda(1); return; }
      const bits = [...Array.from({ length: 8 }, (_, k) => (event.value >> (7 - k)) & 1), event.ack ? 0 : 1];
      for (const b of bits) { sda(b); t += q; scl(1); t += 2 * q; scl(0); t += q; }
    });
  }

  reset() { this.cpu.reset(); this.lcd.reset(); this.history = []; this.shiftOutputs = 0; if (this.recorder) this.startCapture(); this.apply(); }

  /** Drive buttons and potentiometers onto the pins / ADC. */
  apply() {
    for (const port of Object.values(this.mcu.ports)) port.drive.fill(null);
    for (const button of this.board.buttons) {
      const { port, bit } = unoPin(button.pin);
      if (this.pressed.has(String(button.pin))) this.mcu.ports[port].drive[bit] = button.to === 'VCC' ? 1 : 0;
      else if (button.to === 'VCC') this.mcu.ports[port].drive[bit] = 0; // pull-down resistor when released
    }
    for (const pot of this.board.pots) { const { bit } = unoPin(pot.pin); this.mcu.adc.inputs[bit] = Number(pot.volts) || 0; }
    for (const port of Object.values(this.mcu.ports)) port.changed();
  }

  press(pin, down) { if (down) this.pressed.add(String(pin)); else this.pressed.delete(String(pin)); this.apply(); }
  setPot(pin, volts) { const pot = this.board.pots.find((entry) => String(entry.pin) === String(pin)); if (pot) { pot.volts = Math.max(0, Math.min(5, Number(volts))); this.apply(); } }

  level(pin) {
    const { port, bit } = unoPin(pin);
    return (this.mcu.ports[port].levels() >> bit) & 1;
  }

  portChanged() {
    const lcd = this.board.lcd;
    if (lcd) {
      const rs = this.level(lcd.rs), enable = this.level(lcd.enable);
      const bus = (this.level(lcd.d7) << 7) | (this.level(lcd.d6) << 6) | (this.level(lcd.d5) << 5) | (this.level(lcd.d4) << 4);
      this.lcd.clock(rs, 0, enable, bus);
    }
    if (this.board.shift595) {
      const latch = this.level(this.board.shift595.latch);
      if (latch && !this.lastLatch) this.shiftOutputs = this.shiftRegister;
      this.lastLatch = latch;
    }
    if (this.recorder) {
      const t = this.cpu.cycles / this.cpu.clock;
      const D = this.cpu.data;
      const usartTx = D[0xc1] & 0x08, spiOn = D[0x4c] & 0x40, twiOn = D[0xbc] & 0x04;
      for (const [name, offset, count] of [['D', 0, 8], ['B', 8, 6], ['C', 14, 6]]) {
        const gpio = this.mcu.ports[name];
        const levels = gpio.levels();
        const key = levels | (D[gpio.ddr] << 8) | (D[gpio.port] << 16);
        if (key === this.lastLevels[name]) continue;
        this.lastLevels[name] = key;
        for (let bit = 0; bit < count; bit += 1) {
          const label = PIN_LABELS[offset + bit];
          if ((usartTx && label === 'D1') || (spiOn && (label === 'D11' || label === 'D12' || label === 'D13')) || (twiOn && (label === 'A4' || label === 'A5'))) continue;
          // A floating input (no output, pull-up or external driver) has no defined level: keep the last one.
          const floating = !((D[gpio.ddr] >> bit) & 1) && !((D[gpio.port] >> bit) & 1) && gpio.drive[bit] === null;
          if (!floating) this.recorder.set(label, t, (levels >> bit) & 1);
        }
      }
    }
  }

  /** Brightness 0–1 for a pin: PWM duty when a timer drives it, else its logic level if it is an output. */
  brightness(pin) {
    const { port, bit, number } = unoPin(pin);
    const pwm = PWM_PINS[number];
    if (pwm) {
      const timer = this.mcu.timers.find((entry) => entry.name === pwm[0]);
      const duty = timer.duty(pwm[1]);
      if (duty !== null) return duty;
    }
    const D = this.cpu.data, gpio = this.mcu.ports[port];
    if (!((D[gpio.ddr] >> bit) & 1)) return 0;
    return (D[gpio.port] >> bit) & 1;
  }

  /** Snapshot for the UI. */
  view() {
    const D = this.cpu.data;
    const pins = PIN_LABELS.map((label, number) => {
      const { port, bit } = unoPin(number);
      const gpio = this.mcu.ports[port];
      const output = Boolean((D[gpio.ddr] >> bit) & 1);
      return { label, number, output, level: (gpio.levels() >> bit) & 1, pullUp: !output && Boolean((D[gpio.port] >> bit) & 1), brightness: this.brightness(number) };
    });
    return {
      pins,
      leds: this.board.leds.map((pin) => ({ pin, brightness: this.brightness(pin) })),
      shift595: this.board.shift595 ? Array.from({ length: 8 }, (_, bit) => (this.shiftOutputs >> bit) & 1) : null,
      rtc: this.rtc ? this.rtc.now().toISOString().slice(0, 19).replace('T', ' ') : null,
      lcd: this.board.lcd || this.board.i2cLcd ? { lines: this.lcd.lines(), on: this.lcd.displayOn, i2c: Boolean(this.board.i2cLcd) } : null,
      millis: this.cpu.cycles / (this.cpu.clock / 1000),
      baud: this.mcu.usart.baud(),
    };
  }
}
