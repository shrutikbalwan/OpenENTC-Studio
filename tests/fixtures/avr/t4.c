// Output-compare pins in every waveform family (expected values from the ATmega328P datasheet):
// D6 = OC0A fast PWM OCR0A=63 non-inverting, D5 = OC0B inverting OCR0B=191 (976.5625 Hz, 25 %);
// D9 = OC1A phase-correct, TOP=ICR1=999, OCR1A=250 (16 MHz / (2·8·999) = 1001.0 Hz, 500/1998 = 25.03 %),
// D10 = OC1B inverting OCR1B=750 (498/1998 = 24.92 %);
// D11 = OC2A and D3 = OC2B toggled in CTC with OCR2A=99 (10 kHz, 50 %, OC2B toggles on OCR2B=49).
#include <avr/io.h>
int main(void) {
  DDRD = _BV(3) | _BV(5) | _BV(6); DDRB = _BV(1) | _BV(2) | _BV(3);
  OCR0A = 63; OCR0B = 191;
  TCCR0A = _BV(COM0A1) | _BV(COM0B1) | _BV(COM0B0) | _BV(WGM01) | _BV(WGM00); TCCR0B = _BV(CS01) | _BV(CS00);
  ICR1 = 999; OCR1A = 250; OCR1B = 750;
  TCCR1A = _BV(COM1A1) | _BV(COM1B1) | _BV(COM1B0) | _BV(WGM11); TCCR1B = _BV(WGM13) | _BV(CS11);
  OCR2A = 99; OCR2B = 49;
  TCCR2A = _BV(COM2A0) | _BV(COM2B0) | _BV(WGM21); TCCR2B = _BV(CS21);
  for (;;) {}
}
