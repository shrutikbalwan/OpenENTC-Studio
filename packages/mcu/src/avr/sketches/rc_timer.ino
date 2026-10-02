// RC time-constant meter: charge a capacitor through R = 10 kOhm from pin 8 and time how long
// A0 takes to reach 63.2 % of 5 V (one time constant), then C = tau / R.
// Co-simulation: D8 -> R -> C -> GND, with A0 on the capacitor.
const float R = 10000.0;

void setup() {
  Serial.begin(9600);
  pinMode(8, OUTPUT);
  Serial.println("RC time-constant meter (R = 10 kOhm)");
}

void loop() {
  digitalWrite(8, LOW);
  delay(600);                         // discharge for more than 5 time constants
  unsigned long start = micros();
  digitalWrite(8, HIGH);
  while (analogRead(A0) < 647) { }    // 0.632 x 1023
  unsigned long tau = micros() - start;
  Serial.print("tau = ");
  Serial.print(tau / 1000.0, 1);
  Serial.print(" ms   C = ");
  Serial.print(tau / R, 2);
  Serial.println(" uF");
}
