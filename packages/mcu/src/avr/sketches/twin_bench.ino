// OpenENTC Twin firmware: the same program runs on a real Arduino Uno (over USB) and on the
// built-in Uno simulator, so the Real + Virtual Bench can compare the two side by side.
// Commands (one per line, 115200 baud):
//   R<us>  RC step test: D8 low for 600 ms, then high; sample A0 250 times every <us> µs
//   D      DC test: average 64 readings of A0 and A1
//   S      stream A0 and A1 every 20 ms, 50 lines
// Replies are CSV lines so any serial terminal can read them too.
const int SAMPLES = 250;
unsigned int buffer[SAMPLES];

void setup() {
  Serial.begin(115200);
  pinMode(8, OUTPUT);
  digitalWrite(8, LOW);
  Serial.println("OPENENTC-TWIN 1");
}

void rcTest(unsigned long period) {
  if (period < 120) period = 120;          // analogRead takes about 112 us
  digitalWrite(8, LOW);
  delay(600);                              // discharge the capacitor
  unsigned long next = micros();
  digitalWrite(8, HIGH);
  for (int i = 0; i < SAMPLES; i++) {
    while ((long)(micros() - next) < 0) { }
    buffer[i] = analogRead(A0);
    next += period;
  }
  Serial.print("BEGIN RC,");
  Serial.println(period);
  for (int i = 0; i < SAMPLES; i++) {
    Serial.print("RC,");
    Serial.print(i);
    Serial.print(',');
    Serial.println(buffer[i]);
  }
  Serial.println("END");
  digitalWrite(8, LOW);
}

void dcTest() {
  long a0 = 0, a1 = 0;
  for (int i = 0; i < 64; i++) { a0 += analogRead(A0); a1 += analogRead(A1); }
  Serial.print("DC,");
  Serial.print(a0 / 64.0, 2);
  Serial.print(',');
  Serial.println(a1 / 64.0, 2);
  Serial.println("END");
}

void streamTest() {
  for (int i = 0; i < 50; i++) {
    Serial.print("S,");
    Serial.print(millis());
    Serial.print(',');
    Serial.print(analogRead(A0));
    Serial.print(',');
    Serial.println(analogRead(A1));
    delay(20);
  }
  Serial.println("END");
}

void loop() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;
  char command = line.charAt(0);
  if (command == 'R') rcTest(line.length() > 1 ? (unsigned long)line.substring(1).toInt() : 2000UL);
  else if (command == 'D') dcTest();
  else if (command == 'S') streamTest();
  else Serial.println("ERR unknown command");
}
