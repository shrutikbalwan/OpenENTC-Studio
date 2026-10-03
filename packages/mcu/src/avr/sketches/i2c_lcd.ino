// I2C LCD: a 16x2 LCD on a PCF8574 backpack at address 0x27 (SDA = A4, SCL = A5), driven with Wire.
#include <Wire.h>

const uint8_t LCD_ADDR = 0x27;
const uint8_t RS = 0x01, EN = 0x04, BACKLIGHT = 0x08;

void expanderWrite(uint8_t data) {
  Wire.beginTransmission(LCD_ADDR);
  Wire.write(data | BACKLIGHT);
  Wire.endTransmission();
}

void pulse(uint8_t data) {
  expanderWrite(data | EN);
  delayMicroseconds(1);
  expanderWrite(data & ~EN);
  delayMicroseconds(50);
}

void send(uint8_t value, uint8_t mode) {
  pulse((value & 0xF0) | mode);
  pulse(((value << 4) & 0xF0) | mode);
}

void command(uint8_t c) { send(c, 0); }
void print(const char *text) { while (*text) send(*text++, RS); }

void lcdInit() {
  delay(50);
  pulse(0x30); delayMicroseconds(4500);
  pulse(0x30); delayMicroseconds(4500);
  pulse(0x30); delayMicroseconds(150);
  pulse(0x20);                  // 4-bit mode
  command(0x28);                // 2 lines, 5x8 font
  command(0x0C);                // display on
  command(0x01); delay(2);      // clear
  command(0x06);                // entry mode: increment
}

void setup() {
  Wire.begin();
  lcdInit();
  print("I2C LCD at 0x27");
}

void loop() {
  char line[17];
  command(0xC0);                // second line
  snprintf(line, sizeof line, "Count: %-8lu", millis() / 250);
  print(line);
  delay(250);
}
