// Fade: PWM on pin 9 ramps an LED up and down with analogWrite().
const int ledPin = 9;
int brightness = 0;
int step = 5;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  analogWrite(ledPin, brightness);
  brightness += step;
  if (brightness <= 0 || brightness >= 255) step = -step;
  delay(30);
}
