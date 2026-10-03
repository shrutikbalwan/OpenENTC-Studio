// RTC clock: read the time from a DS1307 (I2C address 0x68) once a second and print it.
#include <Wire.h>

const uint8_t RTC_ADDR = 0x68;

uint8_t bcdToDec(uint8_t value) { return (value >> 4) * 10 + (value & 0x0F); }

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("DS1307 real-time clock");
}

void loop() {
  Wire.beginTransmission(RTC_ADDR);
  Wire.write(0);                       // start at the seconds register
  if (Wire.endTransmission() != 0) {
    Serial.println("RTC not found");
    delay(1000);
    return;
  }
  Wire.requestFrom(RTC_ADDR, (uint8_t)7);
  uint8_t sec = bcdToDec(Wire.read() & 0x7F);
  uint8_t min = bcdToDec(Wire.read());
  uint8_t hour = bcdToDec(Wire.read() & 0x3F);
  Wire.read();                         // day of week
  uint8_t day = bcdToDec(Wire.read());
  uint8_t month = bcdToDec(Wire.read());
  uint8_t year = bcdToDec(Wire.read());
  char text[24];
  snprintf(text, sizeof text, "20%02u-%02u-%02u %02u:%02u:%02u", year, month, day, hour, min, sec);
  Serial.println(text);
  delay(1000);
}
