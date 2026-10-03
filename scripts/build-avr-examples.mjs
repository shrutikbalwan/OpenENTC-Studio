#!/usr/bin/env node
// Compile the Arduino example sketches into Intel HEX for the built-in AVR simulator.
// Needs avr-gcc/avr-g++/avr-objcopy, the official ArduinoCore-avr and the LiquidCrystal
// library:  ARDUINO_CORE=/path/ArduinoCore-avr LIQUIDCRYSTAL=/path/LiquidCrystal node scripts/build-avr-examples.mjs
// Output: packages/mcu/src/avr/examples.mjs (sketch source + HEX, committed to the repo).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const core = process.env.ARDUINO_CORE;
const liquid = process.env.LIQUIDCRYSTAL;
if (!core || !liquid) { console.error('Set ARDUINO_CORE and LIQUIDCRYSTAL to the ArduinoCore-avr and LiquidCrystal checkouts.'); process.exit(1); }
const sketches = join(root, 'packages/mcu/src/avr/sketches');
const work = mkdtempSync(join(tmpdir(), 'avr-examples-'));
const coreDir = join(core, 'cores/arduino');
const libraries = join(core, 'libraries');
const flags = ['-mmcu=atmega328p', '-DF_CPU=16000000L', '-DARDUINO=10819', '-DARDUINO_AVR_UNO', '-DARDUINO_ARCH_AVR', '-Os', '-w', '-ffunction-sections', '-fdata-sections', `-I${coreDir}`, `-I${join(core, 'variants/standard')}`, `-I${join(liquid, 'src')}`, `-I${join(libraries, 'Wire/src')}`, `-I${join(libraries, 'Wire/src/utility')}`, `-I${join(libraries, 'SPI/src')}`];
const cppFlags = [...flags, '-std=gnu++11', '-fpermissive', '-fno-exceptions', '-fno-threadsafe-statics'];
const run = (tool, args) => execFileSync(tool, args, { stdio: ['ignore', 'pipe', 'inherit'] });

// Build the core (and LiquidCrystal) once.
const objects = [];
for (const file of readdirSync(coreDir)) {
  const source = join(coreDir, file), object = join(work, `${file}.o`);
  if (file.endsWith('.c')) run('avr-gcc', [...flags, '-std=gnu11', '-c', source, '-o', object]);
  else if (file.endsWith('.cpp')) run('avr-g++', [...cppFlags, '-c', source, '-o', object]);
  else if (file.endsWith('.S')) run('avr-gcc', [...flags, '-x', 'assembler-with-cpp', '-c', source, '-o', object]);
  else continue;
  objects.push(object);
}
const extra = [[join(liquid, 'src/LiquidCrystal.cpp'), 'avr-g++'], [join(libraries, 'Wire/src/Wire.cpp'), 'avr-g++'], [join(libraries, 'Wire/src/utility/twi.c'), 'avr-gcc'], [join(libraries, 'SPI/src/SPI.cpp'), 'avr-g++']];
for (const [source, tool] of extra) {
  const object = join(work, `lib-${source.split('/').pop()}.o`);
  run(tool, [...(tool === 'avr-g++' ? cppFlags : [...flags, '-std=gnu11']), '-c', source, '-o', object]);
  objects.push(object);
}
const coreArchive = join(work, 'core.a');
run('avr-ar', ['rcs', coreArchive, ...objects]);

const META = {
  blink: { name: 'Blink (LED 13)', board: { leds: [13], buttons: [], pots: [], lcd: null } },
  button: { name: 'Push button → LED', board: { leds: [13], buttons: [{ pin: 2, to: 'GND' }], pots: [], lcd: null } },
  fade: { name: 'Fade with PWM (pin 9)', board: { leds: [9], buttons: [], pots: [], lcd: null } },
  analog_read: { name: 'Potentiometer → serial (A0)', board: { leds: [13], buttons: [], pots: [{ pin: 'A0', volts: 2.5 }], lcd: null } },
  serial_calc: { name: 'Serial calculator', board: { leds: [13], buttons: [], pots: [], lcd: null } },
  lcd_hello: { name: 'LCD 16×2 with LiquidCrystal', board: { leds: [], buttons: [], pots: [], lcd: { rs: 12, enable: 11, d4: 5, d5: 4, d6: 3, d7: 2 } } },
  traffic_light: { name: 'Traffic light (pins 10–12)', board: { leds: [12, 11, 10], buttons: [], pots: [], lcd: null } },
  interrupt_counter: { name: 'Interrupt counter (INT0, pin 2)', board: { leds: [13], buttons: [{ pin: 2, to: 'GND' }], pots: [], lcd: null } },
  thermometer: { name: 'LM35 thermometer (A1, 1.1 V ref)', board: { leds: [13], buttons: [], pots: [{ pin: 'A1', volts: 0.25, label: 'LM35 output' }], lcd: null } },
  i2c_lcd: { name: 'I²C LCD (PCF8574 backpack, Wire)', board: { leds: [], buttons: [], pots: [], lcd: null, i2cLcd: { address: 0x27 } } },
  rtc_clock: { name: 'DS1307 real-time clock (Wire)', board: { leds: [], buttons: [], pots: [], lcd: null, rtc: true } },
  shift_register: { name: '74HC595 shift register (SPI)', board: { leds: [], buttons: [], pots: [], lcd: null, shift595: { latch: 10 } } },
  pwm_dac: { name: 'PWM DAC with RC filter (co-simulation)', board: { leds: [], buttons: [], pots: [], lcd: null } },
  rc_timer: { name: 'RC time-constant meter (co-simulation)', board: { leds: [], buttons: [], pots: [], lcd: null } },
  twin_bench: { name: 'OpenENTC Twin firmware (Real + Virtual Bench)', board: { leds: [], buttons: [], pots: [], lcd: null } },
};

const examples = [];
for (const [id, meta] of Object.entries(META)) {
  const source = readFileSync(join(sketches, `${id}.ino`), 'utf8');
  const cpp = join(work, `${id}.cpp`), object = join(work, `${id}.o`), elf = join(work, `${id}.elf`), hex = join(work, `${id}.hex`);
  writeFileSync(cpp, `#include <Arduino.h>\n#line 1 "${id}.ino"\n${source}`);
  run('avr-g++', [...cppFlags, '-c', cpp, '-o', object]);
  run('avr-gcc', ['-mmcu=atmega328p', '-Os', '-Wl,--gc-sections', '-o', elf, object, coreArchive, '-lm']);
  run('avr-objcopy', ['-O', 'ihex', '-R', '.eeprom', elf, hex]);
  const size = run('avr-size', ['-A', elf]).toString().match(/\.text\s+(\d+)/)[1];
  examples.push({ id, ...meta, source, hex: readFileSync(hex, 'utf8'), flashBytes: Number(size) });
  console.log(`${id}: ${size} bytes`);
}

const commit = execFileSync('git', ['-C', core, 'rev-parse', 'HEAD']).toString().trim();
const banner = `// Generated by scripts/build-avr-examples.mjs — do not edit by hand.
// Sketches: packages/mcu/src/avr/sketches. Compiled with avr-gcc against ArduinoCore-avr
// ${commit} (core, Wire and SPI) and the LiquidCrystal library (all LGPL-2.1; sources
// at github.com/arduino/ArduinoCore-avr and github.com/arduino-libraries/LiquidCrystal).
`;
writeFileSync(join(root, 'packages/mcu/src/avr/examples.mjs'), `${banner}export const AVR_EXAMPLES = Object.freeze(${JSON.stringify(examples, null, 1)});\n`);
console.log(`Wrote ${examples.length} examples.`);
