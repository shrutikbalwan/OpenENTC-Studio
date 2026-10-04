// Microcontroller emulation: 8051 assembler, CPU and trainer peripherals; ATmega328P core and
// Arduino Uno board; Intel HEX; logic-analyser channels with UART, SPI and I2C decoders and VCD
// exchange.
export { BITS, INSTRUCTIONS, OPCODES, SFR, bitName, directName, disassemble, instructionSize } from './i8051/isa.mjs';
export { AssemblyError, assemble, toImage } from './i8051/assembler.mjs';
export { Cpu8051 } from './i8051/cpu.mjs';
export { DEFAULT_WIRING, Hd44780, TrainerBoard, parseIntelHex, toIntelHex } from './i8051/peripherals.mjs';
export { EXAMPLES_8051 } from './i8051/examples.mjs';
export { AvrCpu } from './avr/cpu.mjs';
export { Adc, Eeprom, ExternalInterrupts, GpioPort, Spi, Timer, Twi, Usart, createAtmega328p } from './avr/peripherals.mjs';
export { DEFAULT_UNO_BOARD, PIN_LABELS, UnoBoard, unoPin } from './avr/board.mjs';
export { AVR_EXAMPLES } from './avr/examples.mjs';
export { Recorder, createChannel, decodeI2c, decodeSpi, decodeUart, estimateBaud, fromVcd, i2cTransaction, levelAt, record, sliceChannel, spiByte, toVcd, uartFrame } from './analyzer.mjs';
export { Ds1307, Pcf8574 } from './avr/peripherals.mjs';
