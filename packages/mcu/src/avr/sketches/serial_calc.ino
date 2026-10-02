// Serial calculator: type a whole number in the serial monitor; the board replies with its square and cube.
void setup() {
  Serial.begin(9600);
  Serial.println("Send a number:");
}

void loop() {
  if (Serial.available()) {
    long n = Serial.parseInt();
    while (Serial.available()) Serial.read();
    Serial.print(n);
    Serial.print(" squared = ");
    Serial.print(n * n);
    Serial.print(", cubed = ");
    Serial.println(n * n * n);
  }
}
