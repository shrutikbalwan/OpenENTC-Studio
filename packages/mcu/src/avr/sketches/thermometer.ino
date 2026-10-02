// Thermometer: an LM35 (10 mV/°C) on A1 is read with the 1.1 V reference; LED 13 warns above 30 °C.
void setup() {
  Serial.begin(9600);
  analogReference(INTERNAL);
  pinMode(13, OUTPUT);
}

void loop() {
  int raw = analogRead(A1);
  float celsius = raw * (1100.0 / 1024.0) / 10.0;
  Serial.print("Temperature: ");
  Serial.print(celsius, 1);
  Serial.println(" C");
  digitalWrite(13, celsius > 30.0 ? HIGH : LOW);
  delay(1000);
}
