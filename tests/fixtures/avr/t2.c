#include "uart.h"
#include <avr/interrupt.h>
#include <avr/eeprom.h>
#include <util/delay.h>
volatile uint16_t ov0, cm1, ov2, int0n, pcn;
ISR(TIMER0_OVF_vect) { ov0++; }
ISR(TIMER1_COMPA_vect) { cm1++; }
ISR(TIMER2_OVF_vect) { ov2++; }
ISR(INT0_vect) { int0n++; }
ISR(PCINT0_vect) { pcn++; }
volatile uint32_t sink;
static uint16_t measure(void (*fn)(void)) { TCNT1 = 0; fn(); return TCNT1; }
static void f_loop(void) { for (volatile uint8_t i = 0; i < 100; i++); }
static void f_div(void) { sink = sink / 7 + sink % 13; }
static void f_mul(void) { sink = sink * 12345; }
static void f_float(void) { volatile float x = 1.234f; x = x * x / 3.3f + 2.0f; sink = (uint32_t)(x * 1000); }
static void f_delay(void) { _delay_us(100); }
int main(void) {
  uart_init();
  TCCR1A = 0; TCCR1B = 1;               // timer 1 normal, clk/1
  sink = 123456789;
  printf("loop %u\n", measure(f_loop));
  printf("div %u\n", measure(f_div));
  printf("mul %u\n", measure(f_mul));
  printf("float %u\n", measure(f_float));
  printf("delay %u\n", measure(f_delay));
  // timers with interrupts
  TCCR0A = 3; TCCR0B = 3; TIMSK0 = 1;    // fast PWM, /64, overflow interrupt (Arduino millis setup)
  TCCR1B = 0; TCNT1 = 0; TCCR1A = 0; TCCR1B = _BV(WGM12) | 2; OCR1A = 1999; TIMSK1 = _BV(OCIE1A); // CTC 1 kHz
  TCCR2A = 0; TCCR2B = 7; TIMSK2 = 1;    // normal /1024
  EICRA = 2; EIMSK = 1; DDRD |= _BV(2);  // INT0 falling edge, pin as output (software trigger)
  DDRB |= 1; PCICR = 1; PCMSK0 = _BV(0);
  sei();
  for (uint8_t k = 0; k < 10; k++) { PORTD |= _BV(2); PORTD &= ~_BV(2); PINB = 1; }
  for (volatile uint16_t i = 0; i < 20000; i++);
  cli();
  printf("ov0 %u cm1 %u ov2 %u int0 %u pc %u tcnt0 %u tcnt2 %u\n", ov0, cm1, ov2, int0n, pcn, TCNT0, TCNT2);
  eeprom_write_byte((uint8_t*)10, 0xA5); eeprom_write_word((uint16_t*)20, 0xBEEF);
  printf("ee %x %x %x\n", eeprom_read_byte((uint8_t*)10), eeprom_read_word((uint16_t*)20), eeprom_read_byte((uint8_t*)11));
  printf("done\n");
  finish();
}
