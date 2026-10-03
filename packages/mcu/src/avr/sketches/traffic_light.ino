// Traffic light: red (12), yellow (11) and green (10) LEDs follow a timed sequence.
const int red = 12, yellow = 11, green = 10;

void setup() {
  pinMode(red, OUTPUT);
  pinMode(yellow, OUTPUT);
  pinMode(green, OUTPUT);
}

void show(int r, int y, int g, unsigned long ms) {
  digitalWrite(red, r);
  digitalWrite(yellow, y);
  digitalWrite(green, g);
  delay(ms);
}

void loop() {
  show(HIGH, LOW, LOW, 3000);
  show(HIGH, HIGH, LOW, 1000);
  show(LOW, LOW, HIGH, 3000);
  show(LOW, HIGH, LOW, 1000);
}
