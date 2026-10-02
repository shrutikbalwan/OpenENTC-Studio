// Interrupt counter: each press of the button on pin 2 (INT0, falling edge) is counted in an ISR.
volatile unsigned int presses = 0;
unsigned int shown = 0;

void onPress() {
  presses++;
}

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);
  Serial.println("Press the button on pin 2");
}

void loop() {
  noInterrupts();
  unsigned int count = presses;
  interrupts();
  if (count != shown) {
    shown = count;
    Serial.print("Presses: ");
    Serial.println(count);
    digitalWrite(13, count & 1);
  }
}
