#include "uart.h"
#include <avr/interrupt.h>
volatile uint8_t n;
ISR(INT0_vect, ISR_NAKED) { __asm__ volatile("reti"); }
int main(void) {
  uart_init();
  DDRD |= _BV(2); EICRA = 2; TCCR1A = 0; TCCR1B = 1; sei();
  uint16_t a, b;
  EIMSK = 0; TCNT1 = 0; PORTD |= _BV(2); PORTD &= ~_BV(2); __asm__ volatile("nop\n nop"); a = TCNT1;
  EIFR = 1; EIMSK = 1; TCNT1 = 0; PORTD |= _BV(2); PORTD &= ~_BV(2); __asm__ volatile("nop\n nop"); b = TCNT1;
  printf("no-int %u with-int %u\n", a, b);
  printf("done\n"); finish();
}
