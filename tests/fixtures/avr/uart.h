#include <avr/io.h>
#include <stdio.h>
static int uart_putchar(char c, FILE *stream) { while (!(UCSR0A & _BV(UDRE0))); UDR0 = c; return 0; }
static FILE uart_out = FDEV_SETUP_STREAM(uart_putchar, NULL, _FDEV_SETUP_WRITE);
static void uart_init(void) { UBRR0H = 0; UBRR0L = 8; UCSR0A = 0; UCSR0B = _BV(TXEN0) | _BV(RXEN0); UCSR0C = 3 << UCSZ00; stdout = &uart_out; }
static void finish(void) { while (!(UCSR0A & _BV(TXC0))); __asm__ volatile("cli"); for (;;) __asm__ volatile("sleep"); }
