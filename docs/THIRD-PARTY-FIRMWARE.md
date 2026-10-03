# Bundled example firmware

`packages/mcu/src/avr/examples.mjs` contains Intel HEX images of the example sketches in
`packages/mcu/src/avr/sketches/`. They are produced by `scripts/build-avr-examples.mjs`
with avr-gcc and link against:

- **ArduinoCore-avr** (cores/arduino, variants/standard) — LGPL-2.1-or-later,
  https://github.com/arduino/ArduinoCore-avr (commit recorded in the generated file).
- **LiquidCrystal** — LGPL-2.1-or-later, https://github.com/arduino-libraries/LiquidCrystal.
- **avr-libc** — modified BSD licence.

The complete corresponding source is the sketches in this repository plus the upstream
projects above at the recorded revisions; rebuilding with the script reproduces the
images. The AVR test programs in `tests/fixtures/avr/` (C source included) are built
the same way with avr-gcc and avr-libc only.
