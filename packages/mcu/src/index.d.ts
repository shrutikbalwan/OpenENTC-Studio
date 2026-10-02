export interface Instruction { op: number; mnemonic: string; args: readonly string[]; cycles: number }
export declare const SFR: Readonly<Record<string, number>>;
export declare const BITS: Readonly<Record<string, number>>;
export declare const INSTRUCTIONS: readonly Instruction[];
export declare const OPCODES: readonly (Instruction | null)[];
export declare function instructionSize(entry: Instruction): number;
export declare function directName(address: number): string;
export declare function bitName(address: number): string;
export declare function disassemble(read: (address: number) => number, address: number): { address: number; size: number; bytes: number[]; text: string; entry: Instruction | null };

export declare class AssemblyError extends Error { line?: number; constructor(message: string, line?: number) }
export interface ListingLine { line: number; address: number | null; bytes: number[]; source: string; error?: boolean }
export interface AssemblyResult { bytes: Map<number, number>; listing: ListingLine[]; symbols: Record<string, { value: number; kind: string }>; size: number; errors: { line: number; message: string }[] }
export declare function assemble(source: string): AssemblyResult;
export declare function toImage(bytes: Map<number, number>): Uint8Array;

export interface CpuSnapshot { pc: number; a: number; b: number; psw: number; sp: number; dptr: number; registers: number[]; bank: number; ports: number[]; pins: number[]; tcon: number; tmod: number; timer0: number; timer1: number; scon: number; ie: number; ip: number; cycles: number; instructions: number; timeSeconds: number }
export declare class Cpu8051 {
  constructor(options?: { clock?: number });
  clock: number; code: Uint8Array; xram: Uint8Array; iram: Uint8Array; sfr: Uint8Array; external: Uint8Array;
  pc: number; cycles: number; instructions: number; halted: boolean; haltReason?: string; serialOutput: number[]; lastInterrupt: string | null;
  serialListeners: ((frame: { value: number; stopCycle: number; bitCycles: number; bits: number }) => void)[];
  load(image: Uint8Array, origin?: number): void;
  reset(): void;
  portPins(): number[];
  pin(port: number, bit: number): number;
  setExternal(port: number, value: number): void;
  onPortChange(listener: (cpu: Cpu8051) => void): void;
  readDirect(address: number, latch?: boolean): number;
  writeDirect(address: number, value: number): void;
  withParity(): number;
  get acc(): number;
  get dptr(): number;
  step(): number;
  receive(bytes: ArrayLike<number>): void;
  run(maxCycles: number, breakpoints?: Set<number>): { reason: 'breakpoint' | 'halted' | 'cycles'; pc: number };
  snapshot(): CpuSnapshot;
}

export interface Wiring {
  leds: { enabled: boolean; port: number; activeLow: boolean };
  switches: { enabled: boolean; port: number };
  buttons: { enabled: boolean; pins: string[] };
  sevenSegment: { enabled: boolean; port: number; commonAnode: boolean };
  lcd: { enabled: boolean; dataPort: number; rs: string; rw: string; enable: string };
  keypad: { enabled: boolean; port: number };
}
export declare const DEFAULT_WIRING: Readonly<Wiring>;
export declare class Hd44780 {
  ddram: Uint8Array; address: number; displayOn: boolean; cursorOn: boolean; eightBit: boolean; twoLines: boolean; writes: number;
  reset(): void;
  command(value: number): void;
  data(value: number): void;
  clock(rs: number, rw: number, enable: number, bus: number): void;
  status(): number;
  lines(columns?: number): string[];
}
export declare class TrainerBoard {
  constructor(cpu: Cpu8051, wiring?: Wiring);
  cpu: Cpu8051; wiring: Wiring; lcd: Hd44780; switches: number; buttons: boolean[]; keys: Set<string>; recorder: Recorder;
  startCapture(): void;
  capturePins(): void;
  setSwitches(value: number): void;
  setButton(index: number, pressed: boolean): void;
  setKey(row: number, column: number, pressed: boolean): void;
  update(): void;
  view(): { leds: boolean[]; segments: number | null; digit: string | null; decimalPoint: boolean; lcd: { lines: string[]; on: boolean; writes: number } | null; pins: number[] };
}
export declare function parseIntelHex(text: string): { image: Uint8Array; size: number; origin: number; bytes: number; ended: boolean };
export declare function toIntelHex(bytes: Map<number, number> | ArrayLike<number>): string;
export declare const EXAMPLES_8051: readonly { id: string; name: string; wiring: Wiring; source: string }[];

export declare class AvrCpu {
  constructor(options?: { clock?: number });
  clock: number; flash: Uint16Array; data: Uint8Array; pc: number; cycles: number; instructions: number; sleeping: boolean; halted: boolean; haltReason: string | null; lastInterrupt: number | null;
  get sreg(): number;
  get sp(): number;
  loadImage(bytes: Uint8Array): void;
  reset(): void;
  attach<T>(device: T): T;
  onRead(address: number, hook: (address: number) => number): void;
  onWrite(address: number, hook: (value: number, address: number) => void): void;
  read(address: number): number;
  write(address: number, value: number): void;
  step(): number;
  run(maxCycles: number, breakpoints?: Set<number>): { reason: 'breakpoint' | 'halted' | 'cycles'; pc: number };
}
export declare class GpioPort { name: string; pin: number; ddr: number; port: number; drive: (number | null)[]; listeners: ((port: GpioPort) => void)[]; levels(): number; setDrive(bit: number, level: number | null): void; changed(): void }
export declare class Timer { name: string; bits: number; counter: number; ocrA: number; ocrB: number; duty(channel: 'A' | 'B'): number | null }
export interface UsartFrameEvent { enable?: boolean; value?: number; startCycle: number; baud?: number; dataBits?: number; parity?: 'none' | 'even' | 'odd'; stopBits?: number }
export declare class Usart { output: number[]; input: number[]; listeners: ((event: UsartFrameEvent) => void)[]; receive(bytes: ArrayLike<number>): void; baud(): number; frameFormat(): { dataBits: number; parity: 'none' | 'even' | 'odd'; stopBits: number } }
export declare class Adc { inputs: number[]; aref: number; vcc: number }
export declare class ExternalInterrupts { constructor(ports: GpioPort[]) }
export declare class Eeprom { memory: Uint8Array }
export interface SpiTransfer { value: number; miso: number; start: number; div: number; mode: number; lsbFirst: boolean }
export declare class Spi { sent: number[]; miso: (value: number) => number; listeners: ((transfer: SpiTransfer) => void)[] }
export interface I2cDevice { address: number; start?(read: boolean): void; stop?(): void; write(byte: number): boolean | void; read(): number }
export interface TwiEvent { type: 'start' | 'repeated-start' | 'stop' | 'byte'; value?: number; ack?: boolean; period: number; cycle: number; fromSlave?: boolean }
export declare class Twi { devices: I2cDevice[]; listeners: ((event: TwiEvent) => void)[]; log: { address: number; read: boolean; ack: boolean }[]; sclPeriodCycles(): number }
export declare class Pcf8574 implements I2cDevice { constructor(address?: number); address: number; output: number; listeners: ((byte: number) => void)[]; write(byte: number): boolean; read(): number }
export declare class Ds1307 implements I2cDevice { constructor(cpu: AvrCpu, options?: { address?: number; start?: Date }); address: number; ram: Uint8Array; halted: boolean; setTime(date: Date): void; now(): Date; registers(): number[]; start(read: boolean): void; write(byte: number): boolean; read(): number }
export interface Atmega328p { cpu: AvrCpu; ports: { B: GpioPort; C: GpioPort; D: GpioPort }; timers: Timer[]; usart: Usart; adc: Adc; interrupts: ExternalInterrupts; eeprom: Eeprom; spi: Spi; twi: Twi }
export declare function createAtmega328p(cpuClass: typeof AvrCpu, options?: { clock?: number }): Atmega328p;
export interface UnoBoardConfig { leds: (number | string)[]; buttons: { pin: number | string; to: 'GND' | 'VCC' }[]; pots: { pin: string; volts: number; label?: string }[]; lcd: { rs: number; enable: number; d4: number; d5: number; d6: number; d7: number } | null; i2cLcd?: { address?: number } | null; rtc?: boolean; shift595?: { latch: number | string } | null }
export declare const DEFAULT_UNO_BOARD: Readonly<UnoBoardConfig>;
export declare const PIN_LABELS: readonly string[];
export declare function unoPin(pin: number | string): { port: 'B' | 'C' | 'D'; bit: number; number: number };
export declare class UnoBoard {
  constructor(hexText: string | null, board?: Partial<UnoBoardConfig>, options?: { clock?: number; capture?: boolean });
  mcu: Atmega328p; cpu: AvrCpu; board: UnoBoardConfig; pressed: Set<string>; lcd: Hd44780; recorder?: Recorder; rtc?: Ds1307; expander?: Pcf8574; shiftOutputs: number;
  startCapture(): void;
  reset(): void;
  apply(): void;
  press(pin: number | string, down: boolean): void;
  setPot(pin: string, volts: number): void;
  level(pin: number | string): number;
  brightness(pin: number | string): number;
  view(): { pins: { label: string; number: number; output: boolean; level: number; pullUp: boolean; brightness: number }[]; leds: { pin: number | string; brightness: number }[]; shift595: number[] | null; rtc: string | null; lcd: { lines: string[]; on: boolean; i2c: boolean } | null; millis: number; baud: number };
}
export declare const AVR_EXAMPLES: readonly { id: string; name: string; board: UnoBoardConfig; source: string; hex: string; flashBytes: number }[];

export interface Edge { t: number; v: 0 | 1 }
export interface Channel { name: string; initial: 0 | 1; edges: Edge[] }
export declare function createChannel(name: string, initial?: number): Channel;
export declare function record(channel: Channel, t: number, level: number | boolean): void;
export declare function levelAt(channel: Channel, t: number): 0 | 1;
export declare function sliceChannel(channel: Channel, from: number, to: number): Channel;
export declare function estimateBaud(channel: Channel): number | null;
export interface UartOptions { baud?: number; dataBits?: number; parity?: 'none' | 'even' | 'odd'; stopBits?: number; invert?: boolean; lsbFirst?: boolean }
export interface UartFrame { start: number; end: number; value: number; parityOk: boolean; framingError: boolean }
export declare function decodeUart(channel: Channel, options?: UartOptions): UartFrame[];
export declare function decodeSpi(lines: { sck: Channel; mosi: Channel; miso?: Channel | null; cs?: Channel | null }, options?: { mode?: number; bitOrder?: 'msb' | 'lsb'; wordSize?: number; csActiveLow?: boolean }): { start: number; end: number; mosi: number; miso: number | null }[];
export type I2cEvent =
  | { type: 'start' | 'repeated-start' | 'stop'; t: number }
  | { type: 'address'; t: number; end: number; address: number; read: boolean; ack: boolean }
  | { type: 'data'; t: number; end: number; value: number; ack: boolean };
export declare function decodeI2c(lines: { scl: Channel; sda: Channel }): I2cEvent[];
export declare function toVcd(channels: Channel[], options?: { timescaleNs?: number; module?: string; endTime?: number }): string;
export declare function fromVcd(text: string): Channel[];
export declare function uartFrame(channel: Channel, start: number, value: number, options?: UartOptions): number;
export declare function i2cTransaction(lines: { scl: Channel; sda: Channel }, start: number, address: number, read: boolean, bytes: number[], options?: { period?: number; acks?: boolean[] | null }): number;
export declare function spiByte(lines: { sck: Channel; mosi: Channel; miso?: Channel | null }, start: number, value: number, misoValue?: number, options?: { period?: number; mode?: number; lsbFirst?: boolean }): number;
export declare class Recorder {
  constructor(names: string[], options?: { maxEdges?: number; initial?: number });
  maxEdges: number; channels: Map<string, Channel>; end: number;
  set(name: string, t: number, level: number): void;
  list(): Channel[];
  clear(): void;
}
