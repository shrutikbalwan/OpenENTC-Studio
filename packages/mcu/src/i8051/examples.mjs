// Classic 8051 lab programs, each with the trainer-board wiring it expects.

const board = (patch = {}) => ({
  leds: { enabled: true, port: 1, activeLow: false },
  switches: { enabled: false, port: 0 },
  buttons: { enabled: false, pins: ['P3.2', 'P3.3'] },
  sevenSegment: { enabled: false, port: 2, commonAnode: false },
  lcd: { enabled: false, dataPort: 1, rs: 'P2.0', rw: 'P2.1', enable: 'P2.2' },
  keypad: { enabled: false, port: 1 },
  ...patch,
});

export const EXAMPLES_8051 = Object.freeze([
  {
    id: 'running-lights', name: 'Running lights (LEDs on P1)', wiring: board(),
    source: `; Rotate one lit LED across P1 with a software delay.
        ORG   0000H
        MOV   A,#01H
LOOP:   MOV   P1,A          ; show the pattern
        ACALL DELAY
        RL    A             ; next LED
        SJMP  LOOP

; about 50 ms at 11.0592 MHz
DELAY:  MOV   R6,#100
D1:     MOV   R7,#230
D2:     DJNZ  R7,D2
        DJNZ  R6,D1
        RET
        END
`,
  },
  {
    id: 'switch-to-led', name: 'DIP switches → LEDs', wiring: board({ switches: { enabled: true, port: 0 } }),
    source: `; Copy the DIP switches on P0 to the LEDs on P1 (closed switch = 0).
        ORG   0000H
        MOV   P0,#0FFH      ; make P0 an input
AGAIN:  MOV   A,P0
        CPL   A             ; closed switch lights its LED
        MOV   P1,A
        SJMP  AGAIN
        END
`,
  },
  {
    id: 'seven-segment', name: '7-segment counter 0–9 (P2)', wiring: board({ leds: { enabled: false, port: 1, activeLow: false }, sevenSegment: { enabled: true, port: 2, commonAnode: false } }),
    source: `; Count 0-9 on a common-cathode display (a = P2.0 ... g = P2.6).
        ORG   0000H
START:  MOV   DPTR,#SEG
        MOV   R2,#0
NEXT:   MOV   A,R2
        MOVC  A,@A+DPTR     ; digit -> segment pattern
        MOV   P2,A
        ACALL DELAY
        INC   R2
        CJNE  R2,#10,NEXT
        SJMP  START

DELAY:  MOV   R5,#4
D0:     MOV   R6,#250
D1:     MOV   R7,#230
D2:     DJNZ  R7,D2
        DJNZ  R6,D1
        DJNZ  R5,D0
        RET

SEG:    DB    3FH,06H,5BH,4FH,66H,6DH,7DH,07H,7FH,6FH
        END
`,
  },
  {
    id: 'lcd-hello', name: 'LCD 16×2: "HELLO ENTC"', wiring: board({ leds: { enabled: false, port: 1, activeLow: false }, lcd: { enabled: true, dataPort: 1, rs: 'P2.0', rw: 'P2.1', enable: 'P2.2' } }),
    source: `; HD44780 in 8-bit mode: data on P1, RS = P2.0, RW = P2.1, E = P2.2.
RS      BIT   P2.0
RW      BIT   P2.1
EN      BIT   P2.2
        ORG   0000H
        MOV   A,#38H        ; 8-bit, 2 lines, 5x7
        ACALL CMD
        MOV   A,#0CH        ; display on, cursor off
        ACALL CMD
        MOV   A,#01H        ; clear
        ACALL CMD
        MOV   A,#80H        ; line 1
        ACALL CMD
        MOV   DPTR,#LINE1
        ACALL PRINT
        MOV   A,#0C0H       ; line 2
        ACALL CMD
        MOV   DPTR,#LINE2
        ACALL PRINT
HERE:   SJMP  HERE

PRINT:  CLR   A
        MOVC  A,@A+DPTR
        JZ    PDONE
        ACALL DAT
        INC   DPTR
        SJMP  PRINT
PDONE:  RET

CMD:    MOV   P1,A
        CLR   RS
        SJMP  PULSE
DAT:    MOV   P1,A
        SETB  RS
PULSE:  CLR   RW
        SETB  EN
        NOP
        CLR   EN
        MOV   R7,#255       ; wait for the LCD
WT:     DJNZ  R7,WT
        RET

LINE1:  DB    'HELLO ENTC',0
LINE2:  DB    '8051 TRAINER',0
        END
`,
  },
  {
    id: 'serial-hello', name: 'Serial: send and echo at 9600 baud', wiring: board({ leds: { enabled: true, port: 1, activeLow: false } }),
    source: `; UART mode 1, 9600 baud (timer 1 mode 2, TH1 = FDH at 11.0592 MHz).
        ORG   0000H
        MOV   TMOD,#20H
        MOV   TH1,#0FDH
        MOV   SCON,#50H     ; mode 1, receiver on
        SETB  TR1
        MOV   DPTR,#MSG
SEND:   CLR   A
        MOVC  A,@A+DPTR
        JZ    ECHO
        ACALL TX
        INC   DPTR
        SJMP  SEND
ECHO:   JNB   RI,ECHO       ; wait for a byte from the terminal
        MOV   A,SBUF
        CLR   RI
        MOV   P1,A          ; show it on the LEDs
        ACALL TX            ; and send it back
        SJMP  ECHO

TX:     MOV   SBUF,A
TXW:    JNB   TI,TXW
        CLR   TI
        RET

MSG:    DB    'Hello from 8051!',13,10,'Type a key: ',0
        END
`,
  },
  {
    id: 'timer-interrupt', name: 'Timer-0 interrupt: 1 Hz blink', wiring: board(),
    source: `; Timer 0 (mode 1) interrupts every 50 ms; 20 ticks toggle P1.0 once a second.
        ORG   0000H
        LJMP  MAIN
        ORG   000BH
        LJMP  T0ISR
        ORG   0030H
MAIN:   MOV   TMOD,#01H
        MOV   TH0,#4CH      ; 65536 - 46080 = 4C00H (50 ms at 11.0592 MHz)
        MOV   TL0,#00H
        MOV   R7,#20
        SETB  ET0
        SETB  EA
        SETB  TR0
        SJMP  $             ; everything happens in the interrupt

T0ISR:  MOV   TH0,#4CH
        MOV   TL0,#00H
        DJNZ  R7,BACK
        MOV   R7,#20
        CPL   P1.0
        INC   P1            ; upper LEDs count the seconds
BACK:   RETI
        END
`,
  },
  {
    id: 'int0-counter', name: 'INT0 button presses → 7-segment', wiring: board({ leds: { enabled: false, port: 1, activeLow: false }, buttons: { enabled: true, pins: ['P3.2', 'P3.3'] }, sevenSegment: { enabled: true, port: 2, commonAnode: false } }),
    source: `; Each press of the INT0 button (P3.2, falling edge) counts 0-9.
        ORG   0000H
        LJMP  MAIN
        ORG   0003H
        LJMP  EX0ISR
        ORG   0030H
MAIN:   SETB  IT0           ; edge triggered
        SETB  EX0
        SETB  EA
        MOV   R2,#0
        MOV   DPTR,#SEG
SHOW:   MOV   A,R2
        MOVC  A,@A+DPTR
        MOV   P2,A
        SJMP  SHOW

EX0ISR: INC   R2
        CJNE  R2,#10,DONE
        MOV   R2,#0
DONE:   RETI

SEG:    DB    3FH,06H,5BH,4FH,66H,6DH,7DH,07H,7FH,6FH
        END
`,
  },
  {
    id: 'bcd-arithmetic', name: 'BCD addition, multiply and divide', wiring: board(),
    source: `; 16-bit BCD add with DA A, then MUL/DIV; results in RAM 40H-45H.
        ORG   0000H
        MOV   A,#59H        ; 1259 + 0874 = 2133 (BCD)
        ADD   A,#74H
        DA    A
        MOV   40H,A         ; low byte -> 33
        MOV   A,#12H
        ADDC  A,#08H
        DA    A
        MOV   41H,A         ; high byte -> 21
        MOV   A,#25         ; 25 x 12 = 300 = 012CH
        MOV   B,#12
        MUL   AB
        MOV   42H,A
        MOV   43H,B
        MOV   A,#200        ; 200 / 7 = 28 r 4
        MOV   B,#7
        DIV   AB
        MOV   44H,A
        MOV   45H,B
        MOV   P1,40H        ; show the low BCD byte
        SJMP  $
        END
`,
  },
  {
    id: 'keypad', name: '4×4 keypad scan → LEDs', wiring: board({ leds: { enabled: true, port: 2, activeLow: false }, keypad: { enabled: true, port: 1 } }),
    source: `; Rows on P1.0-P1.3 (outputs), columns on P1.4-P1.7 (inputs). Key code 0-15 on P2.
        ORG   0000H
SCAN:   MOV   R0,#0         ; row number
        MOV   A,#0FEH       ; drive row 0 low
ROW:    MOV   P1,A
        MOV   R1,A
        MOV   A,P1
        ANL   A,#0F0H
        CJNE  A,#0F0H,FOUND
        MOV   A,R1
        RL    A
        INC   R0
        CJNE  R0,#4,ROW
        SJMP  SCAN
FOUND:  MOV   R2,#0         ; column = position of the low bit
COL:    RLC   A
        JNC   CODE
        INC   R2
        SJMP  COL
CODE:   MOV   A,R0          ; key = row * 4 + (3 - column scan index)
        RL    A
        RL    A
        ADD   A,#3
        CLR   C
        SUBB  A,R2
        MOV   P2,A
        SJMP  SCAN
        END
`,
  },
]);
