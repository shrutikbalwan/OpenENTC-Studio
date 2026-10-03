// AnalogReadSerial: read the potentiometer on A0 and print the value and voltage.
void setup() {
  Serial.begin(9600);
  Serial.println("Turn the potentiometer on A0");
}

void loop() {
  int raw = analogRead(A0);
  float volts = raw * (5.0 / 1023.0);
  Serial.print("A0 = ");
  Serial.print(raw);
  Serial.print("  (");
  Serial.print(volts, 2);
  Serial.println(" V)");
  delay(500);
}
