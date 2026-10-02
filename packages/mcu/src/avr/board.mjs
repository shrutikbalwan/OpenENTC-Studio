// Arduino Uno board model: digital pins D0–D13 and A0–A5 mapped to ATmega328P ports, LEDs
// (with PWM brightness), push buttons, potentiometers and an HD44780 LCD on any six pins.
import { AvrCpu } from './cpu.mjs';
import { createAtmega328p } from './peripherals.mjs';
import { Hd44780, parseIntelHex } from '../i8051/peripherals.mjs';

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

export const DEFAULT_UNO_BOARD = Object.freeze({ leds: [13], buttons: [{ pin: 2, to: 'GND' }], pots: [{ pin: 'A0', volts: 2.5 }], lcd: null });

export class UnoBoard {
  constructor(hexText, board = DEFAULT_UNO_BOARD, { clock = 16_000_000 } = {}) {
    this.mcu = createAtmega328p(AvrCpu, { clock });
    this.cpu = this.mcu.cpu;
    if (hexText) this.cpu.loadImage(parseIntelHex(hexText).image);
    this.board = structuredClone(board);
    this.pressed = new Set();
    this.lcd = new Hd44780();
    this.history = [];
    for (const port of Object.values(this.mcu.ports)) port.listeners.push(() => this.portChanged());
    this.apply();
  }

  reset() { this.cpu.reset(); this.lcd.reset(); this.history = []; this.apply(); }

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
    if (!lcd) return;
    const rs = this.level(lcd.rs), enable = this.level(lcd.enable);
    const bus = (this.level(lcd.d7) << 7) | (this.level(lcd.d6) << 6) | (this.level(lcd.d5) << 5) | (this.level(lcd.d4) << 4);
    this.lcd.clock(rs, 0, enable, bus);
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
      lcd: this.board.lcd ? { lines: this.lcd.lines(), on: this.lcd.displayOn } : null,
      millis: this.cpu.cycles / (this.cpu.clock / 1000),
      baud: this.mcu.usart.baud(),
    };
  }
}
