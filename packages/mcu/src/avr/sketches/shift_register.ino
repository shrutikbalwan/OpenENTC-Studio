// Shift register: a 74HC595 on SPI (data D11, clock D13, latch D10) drives 8 LEDs.
#include <SPI.h>

const int latchPin = 10;

void show(uint8_t pattern) {
  digitalWrite(latchPin, LOW);
  SPI.transfer(pattern);
  digitalWrite(latchPin, HIGH);      // rising edge copies the shift register to the outputs
}

void setup() {
  pinMode(latchPin, OUTPUT);
  SPI.begin();
}

void loop() {
  for (int i = 0; i < 8; i++) { show(1 << i); delay(120); }   // running light
  for (int n = 0; n < 16; n++) { show(n * 17); delay(120); }  // binary pattern
}
