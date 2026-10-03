// PWM DAC: analogWrite on pin 9 through an RC low-pass filter (10 kOhm, 10 uF) gives a steady
// voltage equal to the duty cycle times 5 V. A0 measures it. Co-simulation: D9 -> R -> C -> GND,
// with A0 on the capacitor.
const int levels[] = {64, 128, 192, 255, 0};

void setup() {
  Serial.begin(9600);
  Serial.println("PWM DAC: duty cycle -> filtered voltage on A0");
}

void loop() {
  for (int i = 0; i < 5; i++) {
    analogWrite(9, levels[i]);
    delay(700);                       // wait more than 5 time constants (RC = 0.1 s)
    int raw = analogRead(A0);
    Serial.print("PWM ");
    Serial.print(levels[i]);
    Serial.print("/255  expected ");
    Serial.print(5.0 * levels[i] / 255, 2);
    Serial.print(" V  measured ");
    Serial.print(raw * 5.0 / 1023, 2);
    Serial.println(" V");
  }
}
