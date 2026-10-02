// LCD: LiquidCrystal on RS=12, E=11, D4=5, D5=4, D6=3, D7=2 shows a message and seconds since reset.
#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello, ENTC!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Uptime: ");
  lcd.print(millis() / 1000);
  lcd.print(" s");
  delay(200);
}
